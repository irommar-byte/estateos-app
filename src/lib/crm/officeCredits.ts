import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Kredyty biurowe (granatowa moneta): pula biura z pakietu Partner i z dokupionych paczek.
 * Działają tylko przy aktywnym pakiecie Partner (inaczej są zamrożone, nie przepadają).
 * Idą wyłącznie na ogłoszenia i usługi biura: publikację ogłoszeń agentów i Smart Agent OS™.
 */

export const OFFICE_LOW_POOL = 3;

export const OFFICE_CREDIT_PACKS = [
  { id: 'office_credits_5', credits: 5, unitPln: 39 },
  { id: 'office_credits_10', credits: 10, unitPln: 29 },
  { id: 'office_credits_20', credits: 20, unitPln: 20 },
] as const;
export type OfficeCreditPackId = (typeof OFFICE_CREDIT_PACKS)[number]['id'];

export function officeCreditPack(id: unknown) {
  return OFFICE_CREDIT_PACKS.find((p) => p.id === String(id || '').trim().toLowerCase()) || null;
}

export type OfficeLedgerKind = 'PURCHASE' | 'PARTNER' | 'LISTING' | 'SMART_AGENT' | 'TRANSFER' | 'REFUND' | 'ADMIN';

const LEDGER_LABEL: Record<string, string> = {
  PURCHASE: 'Zakup kredytów biurowych',
  PARTNER: 'Pakiet Partner',
  LISTING: 'Publikacja ogłoszenia',
  SMART_AGENT: 'Smart Agent OS™',
  TRANSFER: 'Przydział kredytów agentowi',
  REFUND: 'Zwrot',
  ADMIN: 'Korekta EstateOS™',
};

type Db = typeof prisma | Prisma.TransactionClient;

export type OfficeContext = {
  companyId: number;
  companyName: string;
  ownerUserId: number;
  nip: string | null;
  /** właściciel albo rola ADMIN — kupuje kredyty, ustawia widoczność monety, limity agentów */
  isManager: boolean;
  /** właściciel, ADMIN albo MANAGER — zatwierdza prośby agentów */
  canApprove: boolean;
  balance: number;
  poolActive: boolean;
  poolExpiresAt: string | null;
  visibleToAgents: boolean;
  monthlyLimit: number;
};

/** Biuro użytkownika (aktywne członkostwo albo właściciel) i jego pula. */
export async function officeContext(userId: number, db: Db = prisma): Promise<OfficeContext | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const member = await db.agencyCompanyMember.findUnique({
    where: { userId },
    select: { role: true, status: true, companyId: true },
  });
  let companyId = member && member.status === 'ACTIVE' ? member.companyId : null;
  if (!companyId) {
    const owned = await db.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
    companyId = owned?.id ?? null;
  }
  if (!companyId) return null;
  const rows = (await db.$queryRawUnsafe(
    `SELECT id, name, ownerUserId, nip, extraListings, plusExpiresAt, officeCoinVisibleToAgents FROM AgencyCompany WHERE id = ? LIMIT 1`,
    companyId,
  )) as Array<{ id: number; name: string; ownerUserId: number; nip: string | null; extraListings: number; plusExpiresAt: Date | null; officeCoinVisibleToAgents: number }>;
  const c = rows[0];
  if (!c) return null;
  const limitRows = member
    ? ((await db.$queryRawUnsafe(`SELECT officeCreditMonthlyLimit AS l FROM AgencyCompanyMember WHERE userId = ? LIMIT 1`, userId)) as Array<{ l: number }>)
    : [];
  const isOwner = c.ownerUserId === userId;
  const role = member?.status === 'ACTIVE' ? member.role : null;
  const expires = c.plusExpiresAt ? new Date(c.plusExpiresAt) : null;
  return {
    companyId: c.id,
    companyName: c.name,
    ownerUserId: c.ownerUserId,
    nip: c.nip,
    isManager: isOwner || role === 'ADMIN',
    canApprove: isOwner || role === 'ADMIN' || role === 'MANAGER',
    balance: Math.max(0, Number(c.extraListings) || 0),
    poolActive: Boolean(expires && expires.getTime() > Date.now()),
    poolExpiresAt: expires ? expires.toISOString() : null,
    visibleToAgents: Number(c.officeCoinVisibleToAgents) > 0,
    monthlyLimit: Math.max(0, Number(limitRows[0]?.l) || 0),
  };
}

/** Wpis w historii puli. Ten sam zakup (kind + refType + refId) zapisuje się tylko raz. */
export async function writeOfficeLedger(
  db: Db,
  entry: { companyId: number; delta: number; kind: OfficeLedgerKind; userId?: number | null; forUserId?: number | null; refType?: string | null; refId?: string | null; note?: string | null },
): Promise<boolean> {
  const n = await db.$executeRawUnsafe(
    `INSERT IGNORE INTO AgencyOfficeCreditLedger (companyId, delta, kind, userId, forUserId, refType, refId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.companyId,
    entry.delta,
    entry.kind,
    entry.userId ?? null,
    entry.forUserId ?? null,
    entry.refType ?? null,
    entry.refId ?? null,
    entry.note ? String(entry.note).slice(0, 255) : null,
  );
  return Number(n) > 0;
}

/**
 * Pobiera kredyty z puli biura (w transakcji). Błędy: OFFICE_NOT_MEMBER, OFFICE_POOL_INACTIVE, NO_OFFICE_CREDIT.
 * `actorUserId` — kto zdecydował (kierownik przy zatwierdzeniu albo sam agent w ramach limitu).
 */
export async function consumeOfficeCreditsInTx(
  tx: Db,
  params: { forUserId: number; actorUserId: number; amount: number; kind: 'LISTING' | 'SMART_AGENT'; refType: string; refId: string; note?: string | null },
): Promise<{ companyId: number }> {
  const ctx = await officeContext(params.forUserId, tx);
  if (!ctx) throw new Error('OFFICE_NOT_MEMBER');
  if (!ctx.poolActive) throw new Error('OFFICE_POOL_INACTIVE');
  const n = await tx.$executeRawUnsafe(
    `UPDATE AgencyCompany SET extraListings = extraListings - ? WHERE id = ? AND extraListings >= ? AND plusExpiresAt > NOW(3)`,
    params.amount,
    ctx.companyId,
    params.amount,
  );
  if (Number(n) < 1) throw new Error('NO_OFFICE_CREDIT');
  await writeOfficeLedger(tx, {
    companyId: ctx.companyId,
    delta: -params.amount,
    kind: params.kind,
    userId: params.actorUserId,
    forUserId: params.forUserId,
    refType: params.refType,
    // ten sam obiekt może być opłacony ponownie (np. ponowna publikacja) — znacznik czasu odróżnia wpisy
    refId: `${params.refId}:${Date.now()}`,
    note: params.note ?? null,
  });
  return { companyId: ctx.companyId };
}

function warsawMonthStart(now = new Date()): Date {
  const ymd = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  return new Date(`${ymd.slice(0, 7)}-01T00:00:00+01:00`);
}

/** Ile kredytów biura agent może jeszcze w tym miesiącu wykorzystać bez zgody kierownika. */
export async function trustedRemaining(userId: number): Promise<number> {
  const ctx = await officeContext(userId);
  if (!ctx || ctx.monthlyLimit <= 0) return 0;
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(-delta), 0) AS used FROM AgencyOfficeCreditLedger
     WHERE companyId = ? AND forUserId = ? AND userId = ? AND kind = 'LISTING' AND createdAt >= ?`,
    ctx.companyId,
    userId,
    userId,
    warsawMonthStart(),
  )) as Array<{ used: number | bigint }>;
  return Math.max(0, ctx.monthlyLimit - Number(rows[0]?.used || 0));
}

export type OfficeCreditsSummary = {
  companyId: number;
  companyName: string;
  role: 'manager' | 'agent';
  balance: number;
  poolActive: boolean;
  poolExpiresAt: string | null;
  frozen: boolean;
  low: boolean;
  visibleToAgents: boolean;
  canBuy: boolean;
  buyBlockedReason: string | null;
  packs: Array<{ id: string; credits: number; unitPln: number; totalPln: number }>;
  history: Array<{ id: string; at: string; delta: number; label: string; who: string | null; note: string | null }>;
  pendingApprovals: number;
  monthlyLimit: number;
  trustedRemaining: number;
};

/** Dane granatowej monety. Agent bez zgody kierownika na podgląd dostaje null. */
export async function officeCreditsSummary(userId: number): Promise<OfficeCreditsSummary | null> {
  const ctx = await officeContext(userId);
  if (!ctx) return null;
  if (!ctx.isManager && !ctx.visibleToAgents) return null;

  const [ledger, transfers, pending, remaining] = await Promise.all([
    ctx.isManager
      ? (prisma.$queryRawUnsafe(
          `SELECT l.id, l.createdAt, l.delta, l.kind, l.note, u.name AS forName
           FROM AgencyOfficeCreditLedger l LEFT JOIN \`User\` u ON u.id = l.forUserId
           WHERE l.companyId = ? ORDER BY l.createdAt DESC LIMIT 40`,
          ctx.companyId,
        ) as Promise<Array<{ id: bigint; createdAt: Date; delta: number; kind: string; note: string | null; forName: string | null }>>)
      : Promise.resolve([]),
    ctx.isManager
      ? prisma.agencyCompanyCreditTransfer.findMany({
          where: { companyId: ctx.companyId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, amount: true, note: true, createdAt: true, toUser: { select: { name: true } } },
        })
      : Promise.resolve([]),
    ctx.canApprove ? countPendingApprovals(ctx.companyId) : Promise.resolve(0),
    ctx.isManager ? Promise.resolve(0) : trustedRemaining(userId),
  ]);

  // Przydziały sprzed historii puli pokazujemy z tabeli przydziałów (nowe są też w historii).
  const ledgerTransferIds = new Set(
    (ledger as Array<{ kind: string; note: string | null }>).filter((l) => l.kind === 'TRANSFER').map((l) => l.note || ''),
  );
  const history = [
    ...(ledger as Array<{ id: bigint; createdAt: Date; delta: number; kind: string; note: string | null; forName: string | null }>).map((l) => ({
      id: `l${l.id}`,
      at: new Date(l.createdAt).toISOString(),
      delta: Number(l.delta),
      label: LEDGER_LABEL[l.kind] || l.kind,
      who: l.forName,
      note: l.kind === 'TRANSFER' ? null : l.note,
    })),
    ...transfers
      .filter((t) => !ledgerTransferIds.has(`transfer:${t.id}`))
      .map((t) => ({
        id: `t${t.id}`,
        at: t.createdAt.toISOString(),
        delta: -t.amount,
        label: LEDGER_LABEL.TRANSFER,
        who: t.toUser?.name || null,
        note: t.note,
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 40);

  return {
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    role: ctx.isManager ? 'manager' : 'agent',
    balance: ctx.balance,
    poolActive: ctx.poolActive,
    poolExpiresAt: ctx.poolExpiresAt,
    frozen: !ctx.poolActive,
    low: ctx.poolActive && ctx.balance <= OFFICE_LOW_POOL,
    visibleToAgents: ctx.visibleToAgents,
    canBuy: ctx.isManager && ctx.poolActive,
    buyBlockedReason: !ctx.isManager
      ? 'Kredyty biurowe kupuje kierownik biura.'
      : !ctx.poolActive
        ? 'Najpierw aktywuj pakiet Partner — kredyty biurowe działają tylko przy aktywnym pakiecie.'
        : null,
    packs: OFFICE_CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, unitPln: p.unitPln, totalPln: p.credits * p.unitPln })),
    history,
    pendingApprovals: pending,
    monthlyLimit: ctx.monthlyLimit,
    trustedRemaining: remaining,
  };
}

export async function countPendingApprovals(companyId: number): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*) FROM Offer o JOIN AgencyCompanyMember m ON m.userId = o.userId AND m.companyId = ? AND m.status = 'ACTIVE'
         WHERE o.officeReviewStatus = 'OFFICE_REVIEW') +
       (SELECT COUNT(*) FROM SmartAgentSeat s JOIN AgencyCompanyMember m ON m.userId = s.userId AND m.companyId = ? AND m.status = 'ACTIVE'
         WHERE s.requestedAt IS NOT NULL) AS n`,
    companyId,
    companyId,
  )) as Array<{ n: number | bigint }>;
  return Number(rows[0]?.n || 0);
}

export async function setOfficeCoinVisibility(userId: number, visible: boolean): Promise<void> {
  const ctx = await officeContext(userId);
  if (!ctx?.isManager) throw new Error('Widoczność monety biura ustawia kierownik biura.');
  await prisma.$executeRawUnsafe(`UPDATE AgencyCompany SET officeCoinVisibleToAgents = ? WHERE id = ?`, visible ? 1 : 0, ctx.companyId);
}

/** Kierownik ustawia agentowi miesięczny limit kredytów biura bez czekania na zgodę (0 = zawsze prośba). */
export async function setMemberMonthlyLimit(managerUserId: number, memberUserId: number, limit: number): Promise<void> {
  const ctx = await officeContext(managerUserId);
  if (!ctx?.isManager) throw new Error('Limit ustawia kierownik biura.');
  const value = Math.max(0, Math.min(100, Math.floor(Number(limit) || 0)));
  const n = await prisma.$executeRawUnsafe(
    `UPDATE AgencyCompanyMember SET officeCreditMonthlyLimit = ? WHERE userId = ? AND companyId = ?`,
    value,
    memberUserId,
    ctx.companyId,
  );
  if (Number(n) < 1) throw new Error('Ten agent nie należy do Twojego biura.');
}

/** Po płatności Stripe: dopisuje kredyty do puli biura dokładnie raz (webhook i powrót z płatności mogą przyjść naraz). */
export async function grantOfficeCreditsFromCheckout(params: { sessionId: string; companyId: number; credits: number; buyerUserId: number | null }): Promise<boolean> {
  const credits = Math.max(1, Math.min(500, Math.floor(params.credits)));
  return prisma.$transaction(async (tx) => {
    const fresh = await writeOfficeLedger(tx, {
      companyId: params.companyId,
      delta: credits,
      kind: 'PURCHASE',
      userId: params.buyerUserId,
      refType: 'stripe',
      refId: params.sessionId,
      note: `Paczka ${credits} kredytów biurowych`,
    });
    if (!fresh) return false;
    await tx.$executeRawUnsafe(`UPDATE AgencyCompany SET extraListings = extraListings + ? WHERE id = ?`, credits, params.companyId);
    return true;
  });
}

export type OfficePublicationOption = {
  /** direct — kierownik publikuje od razu; limit — agent w ramach miesięcznego limitu; request — prośba do kierownika */
  mode: 'direct' | 'limit' | 'request';
  balance: number;
  poolActive: boolean;
  remaining: number;
  companyName: string;
};

/** Opcja „kredyt biura” przy publikacji ogłoszenia (dla członków biura). */
export async function officePublicationOption(userId: number): Promise<OfficePublicationOption | null> {
  const ctx = await officeContext(userId);
  if (!ctx) return null;
  const remaining = ctx.canApprove ? 0 : await trustedRemaining(userId);
  return {
    mode: ctx.canApprove ? 'direct' : remaining > 0 ? 'limit' : 'request',
    balance: ctx.balance,
    poolActive: ctx.poolActive,
    remaining,
    companyName: ctx.companyName,
  };
}

/** Limit agenta do podglądu w panelu kierownika (null — brak uprawnień albo agent spoza biura). */
export async function memberMonthlyLimit(managerUserId: number, memberUserId: number): Promise<number | null> {
  const ctx = await officeContext(managerUserId);
  if (!ctx?.isManager) return null;
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT officeCreditMonthlyLimit AS l FROM AgencyCompanyMember WHERE userId = ? AND companyId = ? LIMIT 1`,
    memberUserId,
    ctx.companyId,
  )) as Array<{ l: number }>;
  return rows[0] ? Number(rows[0].l) || 0 : null;
}
