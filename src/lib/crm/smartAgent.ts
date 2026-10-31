import { prisma } from '@/lib/prisma';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { logTeamEvent } from '@/lib/crm/teamLog';

/**
 * Smart Agent OS™ — automatyczny agent poszukiwań.
 * Dostęp: 1 stanowisko w aktywnym Partner Enterprise (domyślnie kierownik biura, może je przenieść)
 * albo 5 kredytów za 30 dni dla dowolnego agenta.
 * Agent sam ustawia, które reakcje kupującego przenoszą go do lejka transakcji.
 */

export const SMART_AGENT_PRICE_CREDITS = 5;
export const SMART_AGENT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SmartAgentTriggers = { like: boolean; maybe: boolean; favorite: boolean };
export const DEFAULT_TRIGGERS: SmartAgentTriggers = { like: true, maybe: false, favorite: false };

export type SmartAgentAccess = {
  active: boolean;
  mode: 'enterprise' | 'paid' | null;
  from: string | null;
  until: string | null;
  /** Kto w biurze ma stanowisko z pakietu Enterprise (gdy biuro ma Enterprise). */
  seat: { enterprise: boolean; holderUserId: number | null; holderName: string | null; isAdmin: boolean } | null;
  canBuy: { ok: boolean; from: 'pool' | 'personal' | null; reason: string | null };
};

type SeatRow = { userId: number; settings: unknown; paidUntil: Date | null; paidFrom: Date | null };

async function seatRow(userId: number): Promise<SeatRow | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe<SeatRow[]>(
      `SELECT userId, settings, paidUntil, paidFrom FROM SmartAgentSeat WHERE userId = ? LIMIT 1`,
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
    member?.company ||
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
    isAdmin: company.ownerUserId === userId || member?.role === 'ADMIN',
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

  const poolOk = Boolean(ctx?.poolActive && (ctx.company.extraListings ?? 0) >= SMART_AGENT_PRICE_CREDITS && ctx.isAdmin);
  const personalOk = Boolean(
    (user?.extraListings ?? 0) >= SMART_AGENT_PRICE_CREDITS && user?.plusExpiresAt && new Date(user.plusExpiresAt).getTime() > now,
  );
  const canBuy: SmartAgentAccess['canBuy'] = poolOk
    ? { ok: true, from: 'pool', reason: null }
    : personalOk
      ? { ok: true, from: 'personal', reason: null }
      : { ok: false, from: null, reason: `Potrzebujesz ${SMART_AGENT_PRICE_CREDITS} aktywnych kredytów.` };

  if (ctx?.enterprise && ctx.holderUserId === userId) {
    const until = ctx.company.plusExpiresAt ? new Date(ctx.company.plusExpiresAt) : null;
    const from = until ? new Date(until.getTime() - SMART_AGENT_DAYS * DAY_MS) : null;
    return { active: true, mode: 'enterprise', from: from?.toISOString() ?? null, until: until?.toISOString() ?? null, seat: seatInfo, canBuy };
  }
  if (paidUntil > now) {
    const from = seat?.paidFrom ? new Date(seat.paidFrom) : new Date(paidUntil - SMART_AGENT_DAYS * DAY_MS);
    return { active: true, mode: 'paid', from: from.toISOString(), until: new Date(paidUntil).toISOString(), seat: seatInfo, canBuy };
  }
  return { active: false, mode: null, from: null, until: null, seat: seatInfo, canBuy };
}

/** Włączenie na 30 dni za 5 kredytów: najpierw z puli biura (kierownik), potem z kredytów własnych. */
export async function buySmartAgent(userId: number): Promise<void> {
  const access = await getSmartAgentAccess(userId);
  if (!access.canBuy.ok) throw new Error(access.canBuy.reason || 'Brak kredytów.');
  const ctx = await companyContext(userId);
  const now = new Date();
  const seat = await seatRow(userId);
  const base = seat?.paidUntil && new Date(seat.paidUntil).getTime() > now.getTime() ? new Date(seat.paidUntil) : now;
  const until = new Date(base.getTime() + SMART_AGENT_DAYS * DAY_MS);
  const from = base === now ? now : seat?.paidFrom ? new Date(seat.paidFrom) : now;

  await prisma.$transaction(async (tx) => {
    if (access.canBuy.from === 'pool' && ctx) {
      const n = await tx.$executeRawUnsafe(
        `UPDATE AgencyCompany SET extraListings = extraListings - ? WHERE id = ? AND extraListings >= ? AND plusExpiresAt > NOW(3)`,
        SMART_AGENT_PRICE_CREDITS,
        ctx.company.id,
        SMART_AGENT_PRICE_CREDITS,
      );
      if (Number(n) < 1) throw new Error('Za mało kredytów w puli biura.');
    } else {
      const n = await tx.$executeRawUnsafe(
        `UPDATE \`User\` SET extraListings = extraListings - ? WHERE id = ? AND extraListings >= ? AND plusExpiresAt > NOW(3)`,
        SMART_AGENT_PRICE_CREDITS,
        userId,
        SMART_AGENT_PRICE_CREDITS,
      );
      if (Number(n) < 1) throw new Error('Za mało aktywnych kredytów.');
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO SmartAgentSeat (userId, paidUntil, paidFrom) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE paidUntil = VALUES(paidUntil), paidFrom = VALUES(paidFrom)`,
      userId,
      until,
      from,
    );
  });
  await logTeamEvent({
    userId,
    kind: 'SMART_AGENT_BOUGHT',
    title: `Włączył Smart Agent OS™ do ${until.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    body: `${SMART_AGENT_PRICE_CREDITS} kredytów ${access.canBuy.from === 'pool' ? 'z puli biura' : 'własnych'}`,
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
