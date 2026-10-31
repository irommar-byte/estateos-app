import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import { sendNotification } from '@/lib/core/notification.core';
import { consumeOfficeCreditsInTx } from '@/lib/crm/officeCredits';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { logTeamEvent } from '@/lib/crm/teamLog';

/**
 * Smart Agent OS™ — automatyczny agent poszukiwań.
 * Dostęp: 1 stanowisko w aktywnym Partner Enterprise (domyślnie kierownik biura, może je przenieść),
 * 10 kredytów biurowych za 30 dni (kierownik włącza sobie albo agentowi; stanowisko należy do biura)
 * albo 5 kredytów własnych za 30 dni dla dowolnego agenta.
 * Agent sam ustawia, które reakcje kupującego przenoszą go do lejka transakcji.
 */

/** Smart Agent OS™ na 30 dni: 5 kredytów własnych (złotych) albo 10 kredytów biurowych z puli. */
export const SMART_AGENT_PRICE_CREDITS = 5;
export const SMART_AGENT_OFFICE_PRICE_CREDITS = 10;
export const SMART_AGENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SmartAgentTriggers = { like: boolean; maybe: boolean; favorite: boolean };
export const DEFAULT_TRIGGERS: SmartAgentTriggers = { like: true, maybe: false, favorite: false };

export type SmartAgentAccess = {
  active: boolean;
  mode: 'enterprise' | 'paid' | null;
  /** czym opłacony aktywny dostęp: office — pula biura (link należy do biura), personal — kredyty agenta */
  paidWith: 'office' | 'personal' | null;
  from: string | null;
  until: string | null;
  /** Kto w biurze ma stanowisko z pakietu Enterprise (gdy biuro ma Enterprise). */
  seat: { enterprise: boolean; holderUserId: number | null; holderName: string | null; isAdmin: boolean } | null;
  /** zakup za kredyty własne (5) albo — dla kierownika — z puli biura (10) */
  canBuy: { ok: boolean; from: 'pool' | 'personal' | null; reason: string | null; /** ile kredytów brakuje do włączenia */ missing: number };
  /** agent biura bez własnych kredytów może poprosić kierownika o włączenie z puli */
  canRequest: boolean;
  /** prośba do kierownika czeka od (ISO) */
  requestedAt: string | null;
};

type SeatRow = {
  userId: number;
  settings: unknown;
  paidUntil: Date | null;
  paidFrom: Date | null;
  paidWith: string | null;
  companyId: number | null;
  requestedAt: Date | null;
};

async function seatRow(userId: number): Promise<SeatRow | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe<SeatRow[]>(
      `SELECT userId, settings, paidUntil, paidFrom, paidWith, companyId, requestedAt FROM SmartAgentSeat WHERE userId = ? LIMIT 1`,
      userId,
    )) as SeatRow[];
    return rows[0] || null;
  } catch {
    return null;
  }
}

function parseTriggers(raw: unknown): SmartAgentTriggers {
  let obj: Record<string, unknown> = {};
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  } catch {
    obj = {};
  }
  const t = (obj.triggers && typeof obj.triggers === 'object' ? obj.triggers : {}) as Record<string, unknown>;
  return {
    like: t.like === undefined ? DEFAULT_TRIGGERS.like : Boolean(t.like),
    maybe: t.maybe === undefined ? DEFAULT_TRIGGERS.maybe : Boolean(t.maybe),
    favorite: t.favorite === undefined ? DEFAULT_TRIGGERS.favorite : Boolean(t.favorite),
  };
}

export async function getSmartAgentTriggers(userId: number): Promise<SmartAgentTriggers> {
  return parseTriggers((await seatRow(userId))?.settings);
}

export async function saveSmartAgentTriggers(userId: number, triggers: SmartAgentTriggers): Promise<void> {
  if (!triggers.like && !triggers.maybe && !triggers.favorite) throw new Error('Zaznacz co najmniej jedną reakcję.');
  const settings = JSON.stringify({ triggers });
  await prisma.$executeRawUnsafe(
    `INSERT INTO SmartAgentSeat (userId, settings) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
    userId,
    settings,
  );
  const labels = [triggers.like && '„Chcę obejrzeć”', triggers.maybe && '„Do przemyślenia”', triggers.favorite && 'ulubione'].filter(Boolean).join(', ');
  await logTeamEvent({ userId, kind: 'SMART_AGENT_SETTINGS', title: `Smart Agent OS™: do lejka trafia ${labels}` });
}

async function companyContext(userId: number) {
  const member = await prisma.agencyCompanyMember.findUnique({
    where: { userId },
    select: { role: true, status: true, company: { select: { id: true, ownerUserId: true, extraListings: true, plusExpiresAt: true } } },
  });
  const company =
    (member?.status === 'ACTIVE' ? member.company : null) ||
    (await prisma.agencyCompany.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, ownerUserId: true, extraListings: true, plusExpiresAt: true },
    }));
  if (!company) return null;
  let holder: number | null = null;
  try {
    const rows = (await prisma.$queryRawUnsafe<Array<{ smartAgentUserId: number | null }>>(
      `SELECT smartAgentUserId FROM AgencyCompany WHERE id = ? LIMIT 1`,
      company.id,
    )) as Array<{ smartAgentUserId: number | null }>;
    holder = rows[0]?.smartAgentUserId ?? null;
  } catch {
    holder = null;
  }
  const activeAgents = await prisma.agencyCompanyMember.count({ where: { companyId: company.id, status: 'ACTIVE' } });
  const plan = await resolveCompanyPartnerPlanStatus({
    ownerUserId: company.ownerUserId,
    extraListings: company.extraListings,
    plusExpiresAt: company.plusExpiresAt,
    activeAgents,
  });
  const enterprise = plan.isSubscriptionActive && plan.displayPlanId === 'enterprise';
  return {
    company,
    isAdmin: company.ownerUserId === userId || (member?.status === 'ACTIVE' && member.role === 'ADMIN'),
    holderUserId: holder ?? company.ownerUserId,
    enterprise,
    poolActive: Boolean(company.plusExpiresAt && new Date(company.plusExpiresAt).getTime() > Date.now()),
  };
}

export async function getSmartAgentAccess(userId: number): Promise<SmartAgentAccess> {
  const [ctx, seat, user] = await Promise.all([
    companyContext(userId),
    seatRow(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { extraListings: true, plusExpiresAt: true } }),
  ]);

  let holderName: string | null = null;
  if (ctx?.enterprise) {
    const h = await prisma.user.findUnique({ where: { id: ctx.holderUserId }, select: { name: true } });
    holderName = h?.name || null;
  }
  const seatInfo = ctx
    ? { enterprise: ctx.enterprise, holderUserId: ctx.enterprise ? ctx.holderUserId : null, holderName, isAdmin: ctx.isAdmin }
    : null;

  const now = Date.now();
  const paidUntil = seat?.paidUntil ? new Date(seat.paidUntil).getTime() : 0;

  const poolOk = Boolean(ctx?.poolActive && (ctx.company.extraListings ?? 0) >= SMART_AGENT_OFFICE_PRICE_CREDITS && ctx.isAdmin);
  const personalActive = user?.plusExpiresAt && new Date(user.plusExpiresAt).getTime() > now ? (user.extraListings ?? 0) : 0;
  const personalOk = personalActive >= SMART_AGENT_PRICE_CREDITS;
  const missing = Math.max(1, SMART_AGENT_PRICE_CREDITS - personalActive);
  const canBuy: SmartAgentAccess['canBuy'] = poolOk
    ? { ok: true, from: 'pool', reason: null, missing: 0 }
    : personalOk
      ? { ok: true, from: 'personal', reason: null, missing: 0 }
      : { ok: false, from: null, reason: `Brakuje ${missing} z ${SMART_AGENT_PRICE_CREDITS} kredytów.`, missing };
  const canRequest = Boolean(ctx && !ctx.isAdmin && ctx.poolActive);
  const requestedAt = seat?.requestedAt ? new Date(seat.requestedAt).toISOString() : null;
  const base = { seat: seatInfo, canBuy, canRequest, requestedAt };

  if (ctx?.enterprise && ctx.holderUserId === userId) {
    const until = ctx.company.plusExpiresAt ? new Date(ctx.company.plusExpiresAt) : null;
    const from = until ? new Date(until.getTime() - SMART_AGENT_DAYS * DAY_MS) : null;
    return { active: true, mode: 'enterprise', paidWith: 'office', from: from?.toISOString() ?? null, until: until?.toISOString() ?? null, ...base };
  }
  if (paidUntil > now) {
    const from = seat?.paidFrom ? new Date(seat.paidFrom) : new Date(paidUntil - SMART_AGENT_DAYS * DAY_MS);
    // Opłacony z puli działa, dopóki agent jest w tym biurze.
    const officeSeatValid = seat?.paidWith !== 'office' || (ctx != null && ctx.company.id === seat.companyId);
    if (officeSeatValid) {
      return {
        active: true,
        mode: 'paid',
        paidWith: seat?.paidWith === 'office' ? 'office' : 'personal',
        from: from.toISOString(),
        until: new Date(paidUntil).toISOString(),
        ...base,
      };
    }
  }
  return { active: false, mode: null, paidWith: null, from: null, until: null, ...base };
}

async function writeSeatPurchase(
  tx: Prisma.TransactionClient,
  params: { forUserId: number; payerUserId: number; paidWith: 'office' | 'personal'; companyId: number | null },
): Promise<Date> {
  const seat = (
    (await tx.$queryRawUnsafe(`SELECT paidUntil, paidFrom, paidWith FROM SmartAgentSeat WHERE userId = ? LIMIT 1 FOR UPDATE`, params.forUserId)) as Array<{
      paidUntil: Date | null;
      paidFrom: Date | null;
      paidWith: string | null;
    }>
  )[0];
  const now = new Date();
  const stillActive = seat?.paidUntil && new Date(seat.paidUntil).getTime() > now.getTime();
  const base = stillActive ? new Date(seat!.paidUntil!) : now;
  const until = new Date(base.getTime() + SMART_AGENT_DAYS * DAY_MS);
  const from = stillActive && seat?.paidFrom ? new Date(seat.paidFrom) : now;
  await tx.$executeRawUnsafe(
    `INSERT INTO SmartAgentSeat (userId, paidUntil, paidFrom, paidWith, paidByUserId, companyId, requestedAt) VALUES (?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE paidUntil = VALUES(paidUntil), paidFrom = VALUES(paidFrom), paidWith = VALUES(paidWith),
       paidByUserId = VALUES(paidByUserId), companyId = VALUES(companyId), requestedAt = NULL`,
    params.forUserId,
    until,
    from,
    params.paidWith,
    params.payerUserId,
    params.companyId,
  );
  return until;
}

function untilLabel(until: Date) {
  return until.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Włączenie na 30 dni. Kierownik: 10 kredytów biurowych z puli (dla siebie albo agenta biura).
 * Agent: 5 własnych kredytów. Opłacony z puli należy do biura — kierownik może go przenieść.
 */
export async function buySmartAgent(userId: number, options: { forUserId?: number; from?: 'pool' | 'personal' } = {}): Promise<void> {
  const forUserId = options.forUserId && options.forUserId > 0 ? options.forUserId : userId;
  const ctx = await companyContext(userId);
  const access = await getSmartAgentAccess(userId);
  const usePool = options.from === 'pool' || forUserId !== userId || (options.from == null && access.canBuy.from === 'pool');

  if (usePool) {
    if (!ctx?.isAdmin) throw new Error('Z puli biura Smart Agenta włącza kierownik biura.');
    if (forUserId !== ctx.company.ownerUserId) {
      const member = await prisma.agencyCompanyMember.findFirst({ where: { companyId: ctx.company.id, userId: forUserId, status: 'ACTIVE' } });
      if (!member) throw new Error('Ten agent nie jest aktywnym członkiem biura.');
    }
    let until: Date;
    try {
      until = await prisma.$transaction(async (tx) => {
        await consumeOfficeCreditsInTx(tx, {
          forUserId,
          actorUserId: userId,
          amount: SMART_AGENT_OFFICE_PRICE_CREDITS,
          kind: 'SMART_AGENT',
          refType: 'smart_agent',
          refId: String(forUserId),
          note: 'Smart Agent OS™ · 30 dni',
        });
        return writeSeatPurchase(tx, { forUserId, payerUserId: userId, paidWith: 'office', companyId: ctx.company.id });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'NO_OFFICE_CREDIT') throw new Error(`W puli biura brakuje kredytów — Smart Agent OS™ kosztuje ${SMART_AGENT_OFFICE_PRICE_CREDITS} kredytów biurowych.`);
      if (message === 'OFFICE_POOL_INACTIVE') throw new Error('Kredyty biura są zamrożone — najpierw przedłuż pakiet Partner.');
      throw error;
    }
    const who = forUserId === userId ? null : await prisma.user.findUnique({ where: { id: forUserId }, select: { name: true } });
    await logTeamEvent({
      userId,
      kind: 'SMART_AGENT_BOUGHT',
      title: who ? `Włączył Smart Agent OS™ dla: ${who.name || `agent #${forUserId}`}` : `Włączył Smart Agent OS™ do ${untilLabel(until)}`,
      body: `${SMART_AGENT_OFFICE_PRICE_CREDITS} kredytów biurowych · do ${untilLabel(until)}`,
    });
    if (forUserId !== userId) {
      await sendNotification({
        userId: forUserId,
        type: 'CRM_EVENT',
        title: 'Smart Agent OS™ włączony',
        body: `Kierownik włączył Ci Smart Agent OS™ do ${untilLabel(until)} — z kredytów biura.`,
        data: { type: 'smart_agent_enabled' },
      }).catch(() => {});
    }
    return;
  }

  if (forUserId !== userId) throw new Error('Za kredyty własne Smart Agenta włączasz tylko sobie.');
  if (access.canBuy.from !== 'personal') throw new Error(access.canBuy.reason || 'Brak kredytów.');
  const until = await prisma.$transaction(async (tx) => {
    const n = await tx.$executeRawUnsafe(
      `UPDATE \`User\` SET extraListings = extraListings - ? WHERE id = ? AND extraListings >= ? AND plusExpiresAt > NOW(3)`,
      SMART_AGENT_PRICE_CREDITS,
      userId,
      SMART_AGENT_PRICE_CREDITS,
    );
    if (Number(n) < 1) throw new Error('Za mało aktywnych kredytów.');
    return writeSeatPurchase(tx, { forUserId: userId, payerUserId: userId, paidWith: 'personal', companyId: null });
  });
  await logTeamEvent({
    userId,
    kind: 'SMART_AGENT_BOUGHT',
    title: `Włączył Smart Agent OS™ do ${untilLabel(until)}`,
    body: `${SMART_AGENT_PRICE_CREDITS} kredytów własnych`,
  });
}

/** Agent prosi kierownika o Smart Agenta z puli biura. */
export async function requestSmartAgent(userId: number): Promise<void> {
  const ctx = await companyContext(userId);
  if (!ctx) throw new Error('Prośbę wysyła agent biura.');
  if (ctx.isAdmin) throw new Error('Jako kierownik włączasz Smart Agenta z puli bez prośby.');
  if (!ctx.poolActive) throw new Error('Kredyty biura są zamrożone — kierownik musi przedłużyć pakiet Partner.');
  await prisma.$executeRawUnsafe(
    `INSERT INTO SmartAgentSeat (userId, requestedAt) VALUES (?, NOW(3)) ON DUPLICATE KEY UPDATE requestedAt = NOW(3)`,
    userId,
  );
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const managers = await prisma.agencyCompanyMember.findMany({
    where: { companyId: ctx.company.id, status: 'ACTIVE', role: { in: ['ADMIN'] } },
    select: { userId: true },
  });
  const recipients = new Set<number>([ctx.company.ownerUserId, ...managers.map((m) => m.userId)]);
  recipients.delete(userId);
  await Promise.all(
    [...recipients].map((to) =>
      sendNotification({
        userId: to,
        type: 'CRM_EVENT',
        title: 'Prośba o Smart Agent OS™',
        body: `${me?.name || 'Agent'} prosi o włączenie Smart Agent OS™ — ${SMART_AGENT_OFFICE_PRICE_CREDITS} kredytów biura.`,
        data: { type: 'smart_agent_request' },
      }).catch(() => {}),
    ),
  );
  await logTeamEvent({ userId, kind: 'SMART_AGENT_REQUEST', title: 'Poprosił kierownika o Smart Agent OS™' });
}

/** Kierownik odrzuca prośbę agenta o Smart Agenta. */
export async function rejectSmartAgentRequest(managerUserId: number, forUserId: number): Promise<void> {
  const ctx = await companyContext(managerUserId);
  if (!ctx?.isAdmin) throw new Error('Prośby rozpatruje kierownik biura.');
  await prisma.$executeRawUnsafe(
    `UPDATE SmartAgentSeat s JOIN AgencyCompanyMember m ON m.userId = s.userId AND m.companyId = ? SET s.requestedAt = NULL WHERE s.userId = ?`,
    ctx.company.id,
    forUserId,
  );
  await sendNotification({
    userId: forUserId,
    type: 'CRM_EVENT',
    title: 'Prośba o Smart Agent OS™',
    body: 'Kierownik nie włączył teraz Smart Agenta z puli biura.',
    data: { type: 'smart_agent_request_rejected' },
  }).catch(() => {});
}

/** Prośby agentów biura czekające na kierownika. */
export async function listSmartAgentRequests(companyId: number): Promise<Array<{ userId: number; name: string; requestedAt: string }>> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT s.userId, s.requestedAt, u.name FROM SmartAgentSeat s
     JOIN AgencyCompanyMember m ON m.userId = s.userId AND m.companyId = ? AND m.status = 'ACTIVE'
     JOIN \`User\` u ON u.id = s.userId
     WHERE s.requestedAt IS NOT NULL ORDER BY s.requestedAt ASC`,
    companyId,
  )) as Array<{ userId: number; requestedAt: Date; name: string | null }>;
  return rows.map((r) => ({ userId: r.userId, name: r.name || `Agent #${r.userId}`, requestedAt: new Date(r.requestedAt).toISOString() }));
}

export type OfficeSmartSeat = { userId: number; name: string; until: string };

/** Stanowiska Smart Agenta opłacone z puli biura (do przenoszenia przez kierownika). */
export async function listOfficeSmartSeats(managerUserId: number): Promise<OfficeSmartSeat[]> {
  const ctx = await companyContext(managerUserId);
  if (!ctx?.isAdmin) return [];
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT s.userId, s.paidUntil, u.name FROM SmartAgentSeat s JOIN \`User\` u ON u.id = s.userId
     WHERE s.companyId = ? AND s.paidWith = 'office' AND s.paidUntil > NOW(3) ORDER BY s.paidUntil ASC`,
    ctx.company.id,
  )) as Array<{ userId: number; paidUntil: Date; name: string | null }>;
  return rows.map((r) => ({ userId: r.userId, name: r.name || `Agent #${r.userId}`, until: new Date(r.paidUntil).toISOString() }));
}

/**
 * Kierownik przenosi stanowisko opłacone z puli biura na innego agenta (pozostały czas przechodzi razem z nim).
 * Link wyszukiwarki tego stanowiska zostaje ten sam — pokazuje nowego agenta.
 */
export async function transferOfficeSmartSeat(managerUserId: number, fromUserId: number, toUserId: number): Promise<void> {
  const ctx = await companyContext(managerUserId);
  if (!ctx?.isAdmin) throw new Error('Stanowisko przenosi kierownik biura.');
  if (fromUserId === toUserId) return;
  if (toUserId !== ctx.company.ownerUserId) {
    const member = await prisma.agencyCompanyMember.findFirst({ where: { companyId: ctx.company.id, userId: toUserId, status: 'ACTIVE' } });
    if (!member) throw new Error('Ten agent nie jest aktywnym członkiem biura.');
  }
  const target = await getSmartAgentAccess(toUserId);
  if (target.active) throw new Error('Ten agent ma już aktywnego Smart Agenta.');
  await prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRawUnsafe(
      `SELECT paidUntil, paidFrom FROM SmartAgentSeat WHERE userId = ? AND companyId = ? AND paidWith = 'office' AND paidUntil > NOW(3) LIMIT 1 FOR UPDATE`,
      fromUserId,
      ctx.company.id,
    )) as Array<{ paidUntil: Date; paidFrom: Date | null }>;
    const seat = rows[0];
    if (!seat) throw new Error('To stanowisko nie jest już aktywne.');
    await tx.$executeRawUnsafe(
      `INSERT INTO SmartAgentSeat (userId, paidUntil, paidFrom, paidWith, paidByUserId, companyId, requestedAt) VALUES (?, ?, ?, 'office', ?, ?, NULL)
       ON DUPLICATE KEY UPDATE paidUntil = VALUES(paidUntil), paidFrom = VALUES(paidFrom), paidWith = 'office',
         paidByUserId = VALUES(paidByUserId), companyId = VALUES(companyId), requestedAt = NULL`,
      toUserId,
      seat.paidUntil,
      seat.paidFrom,
      managerUserId,
      ctx.company.id,
    );
    await tx.$executeRawUnsafe(`UPDATE SmartAgentSeat SET paidUntil = NOW(3) WHERE userId = ?`, fromUserId);
    // link biura idzie za stanowiskiem
    await tx.$executeRawUnsafe(
      `UPDATE SmartSearchLink SET userId = ? WHERE scope = 'office' AND companyId = ? AND userId = ? AND revokedAt IS NULL`,
      toUserId,
      ctx.company.id,
      fromUserId,
    );
  });
  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { name: true } }),
  ]);
  await logTeamEvent({
    userId: managerUserId,
    kind: 'SMART_AGENT_SEAT',
    title: `Przeniósł Smart Agent OS™ z ${from?.name || `#${fromUserId}`} na ${to?.name || `#${toUserId}`}`,
  });
}

/** Kierownik przenosi stanowisko Enterprise na innego aktywnego agenta. */
export async function assignSmartAgentSeat(adminUserId: number, toUserId: number): Promise<void> {
  const ctx = await companyContext(adminUserId);
  if (!ctx || !ctx.isAdmin) throw new Error('Stanowisko przypisuje tylko kierownik biura.');
  if (!ctx.enterprise) throw new Error('Stanowisko Smart Agent OS™ jest w aktywnym pakiecie Partner Enterprise.');
  if (toUserId !== ctx.company.ownerUserId) {
    const member = await prisma.agencyCompanyMember.findFirst({ where: { companyId: ctx.company.id, userId: toUserId, status: 'ACTIVE' } });
    if (!member) throw new Error('Ten agent nie jest aktywnym członkiem biura.');
  }
  await prisma.$executeRawUnsafe(`UPDATE AgencyCompany SET smartAgentUserId = ? WHERE id = ?`, toUserId, ctx.company.id);
  const to = await prisma.user.findUnique({ where: { id: toUserId }, select: { name: true } });
  await logTeamEvent({ userId: adminUserId, kind: 'SMART_AGENT_SEAT', title: `Przekazał stanowisko Smart Agent OS™: ${to?.name || `agent #${toUserId}`}` });
}

export async function listSeatCandidates(adminUserId: number): Promise<Array<{ userId: number; name: string }>> {
  const ctx = await companyContext(adminUserId);
  if (!ctx) return [];
  const members = await prisma.agencyCompanyMember.findMany({
    where: { companyId: ctx.company.id, status: 'ACTIVE' },
    select: { userId: true, user: { select: { name: true } } },
  });
  const owner = await prisma.user.findUnique({ where: { id: ctx.company.ownerUserId }, select: { name: true } });
  const map = new Map<number, string>([[ctx.company.ownerUserId, owner?.name || 'Kierownik biura']]);
  for (const m of members) map.set(m.userId, m.user?.name || `Agent #${m.userId}`);
  return [...map.entries()].map(([userId, name]) => ({ userId, name }));
}

/** Kontekst biura dla linku wyszukiwarki: Enterprise, aktywny posiadacz stanowiska, właściciel. */
export async function smartCompanyContext(userId: number) {
  const ctx = await companyContext(userId);
  return ctx ? { companyId: ctx.company.id, ownerUserId: ctx.company.ownerUserId, enterprise: ctx.enterprise, holderUserId: ctx.holderUserId, isAdmin: ctx.isAdmin } : null;
}

/* ───────── tablica: co agent poszukiwań wysłał i jak reagują kupujący ───────── */

export type SmartStage = 'sent' | 'maybe' | 'favorite' | 'like' | 'dislike';

export type SmartBoardItem = {
  matchId: number;
  clientId: number;
  clientName: string;
  offerId: number;
  offerTitle: string;
  offerPrice: number | null;
  score: number;
  stage: SmartStage;
  sentAt: string | null;
  reactedAt: string | null;
  note: string | null;
  /** Czy ta reakcja przenosi kupującego do lejka (wg ustawień i aktywnego dostępu). */
  toFunnel: boolean;
};

export async function smartAgentBoard(userId: number, access: SmartAgentAccess, triggers: SmartAgentTriggers) {
  const since = new Date(Date.now() - 60 * DAY_MS);
  const rows = await prisma.agencyClientMatch.findMany({
    where: {
      client: { agencyUserId: userId, type: 'BUYER', status: 'ACTIVE' },
      OR: [{ notifiedAt: { gte: since } }, { sharedAt: { gte: since } }, { clientFeedbackAt: { gte: since } }, { favoriteAt: { gte: since } }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 400,
    select: {
      id: true,
      clientId: true,
      offerId: true,
      score: true,
      notifiedAt: true,
      sharedAt: true,
      clientFeedback: true,
      clientFeedbackAt: true,
      clientFavorite: true,
      favoriteAt: true,
      client: { select: { firstName: true, lastName: true } },
      offer: { select: { title: true, price: true } },
    },
  });

  const items: SmartBoardItem[] = rows.map((r) => {
    const parsed = parseClientOfferFeedback(r.clientFeedback);
    const stage: SmartStage =
      parsed.sentiment === 'like'
        ? 'like'
        : parsed.sentiment === 'dislike'
          ? 'dislike'
          : parsed.sentiment === 'maybe'
            ? 'maybe'
            : r.clientFavorite
              ? 'favorite'
              : 'sent';
    const reactedAt = stage === 'favorite' ? r.favoriteAt : stage === 'sent' ? null : r.clientFeedbackAt;
    const sent = r.sharedAt || r.notifiedAt;
    return {
      matchId: r.id,
      clientId: r.clientId,
      clientName: `${r.client.firstName} ${r.client.lastName}`.trim(),
      offerId: r.offerId,
      offerTitle: r.offer?.title || `Oferta #${r.offerId}`,
      offerPrice: r.offer?.price ?? null,
      score: r.score,
      stage,
      sentAt: sent ? sent.toISOString() : null,
      reactedAt: reactedAt ? reactedAt.toISOString() : null,
      note: parsed.note || null,
      toFunnel: access.active && ((stage === 'like' && triggers.like) || (stage === 'maybe' && triggers.maybe) || (stage === 'favorite' && triggers.favorite)),
    };
  });

  const periodFrom = access.from ? new Date(access.from).getTime() : Date.now() - SMART_AGENT_DAYS * DAY_MS;
  const inPeriod = (iso: string | null) => Boolean(iso && new Date(iso).getTime() >= periodFrom);
  const stats = {
    sent: items.filter((i) => inPeriod(i.sentAt)).length,
    reactions: items.filter((i) => i.stage !== 'sent' && inPeriod(i.reactedAt)).length,
    toFunnel: items.filter((i) => i.toFunnel && inPeriod(i.reactedAt)).length,
    toFunnelValue: items.filter((i) => i.toFunnel && inPeriod(i.reactedAt)).reduce((s, i) => s + (Number(i.offerPrice) || 0), 0),
    buyers: new Set(items.filter((i) => inPeriod(i.sentAt)).map((i) => i.clientId)).size,
  };
  return { items, stats };
}
