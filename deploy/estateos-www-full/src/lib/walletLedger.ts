import { prisma } from '@/lib/prisma';
import { ensureOfferPublicationSchema } from '@/lib/offerPublication';
import { ensureProfilePromoCardTable } from '@/lib/profilePromoCards';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';

export type WalletLedgerDirection = 'GRANT' | 'CONSUME';

export type WalletLedgerEventInput = {
  userId: number;
  direction: WalletLedgerDirection;
  assetType: string;
  amount?: number;
  balanceAfter?: number | null;
  purpose: string;
  referenceType?: string | null;
  referenceId?: string | null;
  label: string;
  meta?: Record<string, unknown> | null;
};

export type WalletSnapshot = {
  credits: number;
  plusExpiresAt: string | null;
  creditsActive: boolean;
  activeCoupons: number;
  usedCoupons: number;
  totalCoupons: number;
  firstFreeUsed: boolean;
};

export type WalletTimelineEntry = {
  id: string;
  occurredAt: string;
  direction: WalletLedgerDirection;
  assetType: string;
  amount: number;
  balanceAfter: number | null;
  label: string;
  purpose: string;
  referenceType: string | null;
  referenceId: string | null;
  source: 'ledger' | 'reconstructed';
};

let ledgerTableReady = false;

export async function ensureWalletLedgerTable() {
  if (ledgerTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS WalletLedgerEvent (
      id BIGINT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      direction VARCHAR(8) NOT NULL,
      assetType VARCHAR(32) NOT NULL,
      amount INT NOT NULL DEFAULT 1,
      balanceAfter INT NULL,
      purpose VARCHAR(64) NOT NULL,
      referenceType VARCHAR(32) NULL,
      referenceId VARCHAR(128) NULL,
      label VARCHAR(255) NOT NULL,
      meta JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY WalletLedgerEvent_user_created_idx (userId, createdAt),
      KEY WalletLedgerEvent_ref_idx (referenceType, referenceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  ledgerTableReady = true;
}

function hasActivePlusCredit(user: {
  extraListings?: number | null;
  plusExpiresAt?: Date | string | null;
}): boolean {
  const credits = Number(user.extraListings ?? 0);
  if (!Number.isFinite(credits) || credits <= 0) return false;
  if (!user.plusExpiresAt) return false;
  return new Date(user.plusExpiresAt).getTime() > Date.now();
}

export async function appendWalletLedgerEvent(input: WalletLedgerEventInput): Promise<void> {
  await ensureWalletLedgerTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO WalletLedgerEvent
        (userId, direction, assetType, amount, balanceAfter, purpose, referenceType, referenceId, label, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userId,
    input.direction,
    String(input.assetType).slice(0, 32),
    Math.max(1, Number(input.amount ?? 1)),
    input.balanceAfter == null ? null : Number(input.balanceAfter),
    String(input.purpose).slice(0, 64),
    input.referenceType ? String(input.referenceType).slice(0, 32) : null,
    input.referenceId ? String(input.referenceId).slice(0, 128) : null,
    String(input.label).slice(0, 255),
    input.meta ? JSON.stringify(input.meta) : null,
  );
}

export async function readUserCreditBalance(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { extraListings: true, plusExpiresAt: true },
  });
  if (!user || !hasActivePlusCredit(user)) return 0;
  return Number(user.extraListings ?? 0);
}

export async function getWalletSnapshotForUser(userId: number): Promise<WalletSnapshot> {
  await ensureProfilePromoCardTable();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { extraListings: true, plusExpiresAt: true },
  });
  const firstFreeRows = (await prisma.$queryRawUnsafe<Array<{ firstFreePublicationUsed: number }>>(
    'SELECT firstFreePublicationUsed FROM `User` WHERE id = ? LIMIT 1',
    userId,
  )) as Array<{ firstFreePublicationUsed: number }>;

  const couponRows = (await prisma.$queryRawUnsafe<
    Array<{ activeCoupons: number | string | bigint; usedCoupons: number | string | bigint }>
  >(
    `
      SELECT
        SUM(CASE WHEN couponUsed = 0 AND (expiresAt IS NULL OR expiresAt > NOW(3)) THEN 1 ELSE 0 END) AS activeCoupons,
        SUM(CASE WHEN couponUsed = 1 THEN 1 ELSE 0 END) AS usedCoupons
      FROM MobileProfilePromoCard
      WHERE userId = ?
    `,
    userId,
  )) as Array<{ activeCoupons: number | string | bigint; usedCoupons: number | string | bigint }>;

  const activeCoupons = Number(couponRows[0]?.activeCoupons ?? 0);
  const usedCoupons = Number(couponRows[0]?.usedCoupons ?? 0);
  const creditsActive = hasActivePlusCredit(user || {});
  const credits = creditsActive ? Number(user?.extraListings ?? 0) : 0;

  return {
    credits,
    plusExpiresAt: user?.plusExpiresAt ? new Date(user.plusExpiresAt).toISOString() : null,
    creditsActive,
    activeCoupons,
    usedCoupons,
    totalCoupons: activeCoupons + usedCoupons,
    firstFreeUsed: Number(firstFreeRows[0]?.firstFreePublicationUsed ?? 0) > 0,
  };
}

export async function getWalletSnapshotsForUserIds(
  userIds: number[],
): Promise<Record<number, WalletSnapshot>> {
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  const out: Record<number, WalletSnapshot> = {};
  if (!unique.length) return out;

  await ensureProfilePromoCardTable();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, extraListings: true, plusExpiresAt: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const placeholders = unique.map(() => '?').join(',');
  const couponRows = (await prisma.$queryRawUnsafe<
    Array<{ userId: number; activeCoupons: number | string | bigint; usedCoupons: number | string | bigint }>
  >(
    `
      SELECT
        userId,
        SUM(CASE WHEN couponUsed = 0 AND (expiresAt IS NULL OR expiresAt > NOW(3)) THEN 1 ELSE 0 END) AS activeCoupons,
        SUM(CASE WHEN couponUsed = 1 THEN 1 ELSE 0 END) AS usedCoupons
      FROM MobileProfilePromoCard
      WHERE userId IN (${placeholders})
      GROUP BY userId
    `,
    ...unique,
  )) as Array<{ userId: number; activeCoupons: number | string | bigint; usedCoupons: number | string | bigint }>;
  const couponByUser = new Map(couponRows.map((r) => [Number(r.userId), r]));

  for (const id of unique) {
    const user = userById.get(id);
    const coupon = couponByUser.get(id);
    const creditsActive = hasActivePlusCredit(user || {});
    out[id] = {
      credits: creditsActive ? Number(user?.extraListings ?? 0) : 0,
      plusExpiresAt: user?.plusExpiresAt ? new Date(user.plusExpiresAt).toISOString() : null,
      creditsActive,
      activeCoupons: Number(coupon?.activeCoupons ?? 0),
      usedCoupons: Number(coupon?.usedCoupons ?? 0),
      totalCoupons: Number(coupon?.activeCoupons ?? 0) + Number(coupon?.usedCoupons ?? 0),
      firstFreeUsed: false,
    };
  }

  return out;
}

function publicationKindLabel(kind: string): string {
  const k = String(kind || '').toUpperCase();
  if (k === 'FREE_FIRST') return 'Darmowa pierwsza publikacja';
  if (k === 'PLUS_CREDIT') return 'Kredyt publikacji (PLUS)';
  if (k === 'PLUS_PAID') return 'Pakiet PLUS (IAP)';
  return kind || 'Publikacja';
}

async function reconstructWalletTimeline(userId: number): Promise<WalletTimelineEntry[]> {
  await ensureOfferPublicationSchema();
  await ensureProfilePromoCardTable();
  await ensureMobileIapTables();

  const events: WalletTimelineEntry[] = [];

  const promoRows = (await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      kind: string;
      purpose: string | null;
      couponUsed: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    `
      SELECT id, title, kind, purpose, couponUsed, createdAt, updatedAt
      FROM MobileProfilePromoCard
      WHERE userId = ?
      ORDER BY createdAt ASC
    `,
    userId,
  )) as Array<{
    id: string;
    title: string;
    kind: string;
    purpose: string | null;
    couponUsed: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

  for (const card of promoRows) {
    events.push({
      id: `promo-grant-${card.id}`,
      occurredAt: new Date(card.createdAt).toISOString(),
      direction: 'GRANT',
      assetType: 'COUPON',
      amount: 1,
      balanceAfter: null,
      label: card.title || 'Kupon',
      purpose: card.purpose || card.kind || 'coupon',
      referenceType: 'promo_card',
      referenceId: card.id,
      source: 'reconstructed',
    });
    if (card.couponUsed === 1) {
      events.push({
        id: `promo-consume-${card.id}`,
        occurredAt: new Date(card.updatedAt).toISOString(),
        direction: 'CONSUME',
        assetType: 'COUPON',
        amount: 1,
        balanceAfter: null,
        label: `Wykorzystano: ${card.title || 'kupon'}`,
        purpose: card.purpose || 'publication',
        referenceType: 'promo_card',
        referenceId: card.id,
        source: 'reconstructed',
      });
    }
  }

  const pubs = (await prisma.$queryRawUnsafe<
    Array<{
      id: bigint | number;
      offerId: number;
      kind: string;
      startedAt: Date;
      iapTransactionId: string | null;
      iapProductId: string | null;
    }>
  >(
    `
      SELECT id, offerId, kind, startedAt, iapTransactionId, iapProductId
      FROM OfferPublication
      WHERE userId = ?
      ORDER BY startedAt ASC
    `,
    userId,
  )) as Array<{
    id: bigint | number;
    offerId: number;
    kind: string;
    startedAt: Date;
    iapTransactionId: string | null;
    iapProductId: string | null;
  }>;

  for (const pub of pubs) {
    const assetType =
      pub.kind === 'PLUS_CREDIT'
        ? 'CREDIT'
        : pub.kind === 'PLUS_PAID'
          ? 'IAP_PAKIET_PLUS'
          : pub.kind === 'FREE_FIRST'
            ? 'FREE_FIRST'
            : 'PUBLICATION';
    events.push({
      id: `pub-${String(pub.id)}`,
      occurredAt: new Date(pub.startedAt).toISOString(),
      direction: 'CONSUME',
      assetType,
      amount: 1,
      balanceAfter: null,
      label: `${publicationKindLabel(pub.kind)} · oferta #${pub.offerId}`,
      purpose: 'publication',
      referenceType: 'offer_publication',
      referenceId: String(pub.id),
      source: 'reconstructed',
    });
  }

  const iapRows = (await prisma.$queryRawUnsafe<
    Array<{
      id: bigint | number;
      productId: string;
      transactionId: string | null;
      entitlementGrantedAt: Date | null;
      consumedAt: Date | null;
      offerId: number | null;
      createdAt: Date;
    }>
  >(
    `
      SELECT id, productId, transactionId, entitlementGrantedAt, consumedAt, offerId, createdAt
      FROM MobileIapPurchase
      WHERE userId = ?
      ORDER BY createdAt ASC
    `,
    userId,
  )) as Array<{
    id: bigint | number;
    productId: string;
    transactionId: string | null;
    entitlementGrantedAt: Date | null;
    consumedAt: Date | null;
    offerId: number | null;
    createdAt: Date;
  }>;

  for (const iap of iapRows) {
    const product = String(iap.productId || '');
    const isPro = product.includes('investor') || product.includes('pro_sub');
    const assetType = isPro ? 'IAP_INVESTOR_PRO' : 'IAP_PAKIET_PLUS';
    const grantedAt = iap.entitlementGrantedAt || iap.createdAt;
    events.push({
      id: `iap-grant-${String(iap.id)}`,
      occurredAt: new Date(grantedAt).toISOString(),
      direction: 'GRANT',
      assetType,
      amount: 1,
      balanceAfter: null,
      label: isPro ? 'Nadanie Investor Pro (IAP)' : 'Zakup Pakiet PLUS (IAP)',
      purpose: isPro ? 'investor_pro' : 'pakiet_plus',
      referenceType: 'iap',
      referenceId: iap.transactionId || String(iap.id),
      source: 'reconstructed',
    });
    if (iap.consumedAt) {
      events.push({
        id: `iap-consume-${String(iap.id)}`,
        occurredAt: new Date(iap.consumedAt).toISOString(),
        direction: 'CONSUME',
        assetType,
        amount: 1,
        balanceAfter: null,
        label: iap.offerId
          ? `Wykorzystano IAP na ofercie #${iap.offerId}`
          : 'Wykorzystano zakup IAP',
        purpose: 'publication',
        referenceType: 'iap',
        referenceId: iap.transactionId || String(iap.id),
        source: 'reconstructed',
      });
    }
  }

  return events;
}

function ledgerRowToEntry(row: {
  id: bigint | number;
  occurredAt: Date;
  direction: string;
  assetType: string;
  amount: number;
  balanceAfter: number | null;
  label: string;
  purpose: string;
  referenceType: string | null;
  referenceId: string | null;
}): WalletTimelineEntry {
  return {
    id: `ledger-${String(row.id)}`,
    occurredAt: new Date(row.occurredAt).toISOString(),
    direction: row.direction === 'CONSUME' ? 'CONSUME' : 'GRANT',
    assetType: row.assetType,
    amount: Number(row.amount ?? 1),
    balanceAfter: row.balanceAfter == null ? null : Number(row.balanceAfter),
    label: row.label,
    purpose: row.purpose,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    source: 'ledger',
  };
}

function dedupeTimeline(entries: WalletTimelineEntry[]): WalletTimelineEntry[] {
  const seen = new Set<string>();
  const out: WalletTimelineEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.direction}|${entry.referenceType || ''}|${entry.referenceId || ''}|${entry.assetType}|${entry.occurredAt.slice(0, 19)}`;
    if (entry.referenceType && entry.referenceId && seen.has(key)) continue;
    if (entry.referenceType && entry.referenceId) seen.add(key);
    out.push(entry);
  }
  return out;
}

export async function listWalletTimelineForUser(
  userId: number,
  limit = 120,
): Promise<WalletTimelineEntry[]> {
  await ensureWalletLedgerTable();

  const ledgerRows = (await prisma.$queryRawUnsafe<
    Array<{
      id: bigint | number;
      direction: string;
      assetType: string;
      amount: number;
      balanceAfter: number | null;
      purpose: string;
      referenceType: string | null;
      referenceId: string | null;
      label: string;
      createdAt: Date;
    }>
  >(
    `
      SELECT id, direction, assetType, amount, balanceAfter, purpose, referenceType, referenceId, label, createdAt
      FROM WalletLedgerEvent
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `,
    userId,
    Math.min(500, Math.max(1, limit)),
  )) as Array<{
    id: bigint | number;
    direction: string;
    assetType: string;
    amount: number;
    balanceAfter: number | null;
    purpose: string;
    referenceType: string | null;
    referenceId: string | null;
    label: string;
    createdAt: Date;
  }>;

  const ledger = ledgerRows.map((row) =>
    ledgerRowToEntry({
      ...row,
      occurredAt: row.createdAt,
    }),
  );
  const reconstructed = await reconstructWalletTimeline(userId);
  const merged = dedupeTimeline([...ledger, ...reconstructed]);
  merged.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return merged.slice(0, limit);
}

export async function logWalletCreditGrant(params: {
  userId: number;
  amount: number;
  purpose: string;
  referenceType: string;
  referenceId: string;
  label: string;
  meta?: Record<string, unknown>;
}) {
  const balanceAfter = await readUserCreditBalance(params.userId);
  await appendWalletLedgerEvent({
    userId: params.userId,
    direction: 'GRANT',
    assetType: 'CREDIT',
    amount: params.amount,
    balanceAfter,
    purpose: params.purpose,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    label: params.label,
    meta: params.meta,
  });
}

export async function logWalletCreditConsume(params: {
  userId: number;
  amount?: number;
  purpose: string;
  referenceType: string;
  referenceId: string;
  label: string;
  meta?: Record<string, unknown>;
}) {
  const balanceAfter = await readUserCreditBalance(params.userId);
  await appendWalletLedgerEvent({
    userId: params.userId,
    direction: 'CONSUME',
    assetType: 'CREDIT',
    amount: params.amount ?? 1,
    balanceAfter,
    purpose: params.purpose,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    label: params.label,
    meta: params.meta,
  });
}

export async function logWalletCouponGrant(params: {
  userId: number;
  cardId: string;
  label: string;
  purpose?: string;
  meta?: Record<string, unknown>;
}) {
  await appendWalletLedgerEvent({
    userId: params.userId,
    direction: 'GRANT',
    assetType: 'COUPON',
    amount: 1,
    balanceAfter: null,
    purpose: params.purpose || 'coupon',
    referenceType: 'promo_card',
    referenceId: params.cardId,
    label: params.label,
    meta: params.meta,
  });
}

export async function logWalletCouponConsume(params: {
  userId: number;
  cardId: string;
  label: string;
  purpose?: string;
  referenceType?: string;
  referenceId?: string;
  meta?: Record<string, unknown>;
}) {
  await appendWalletLedgerEvent({
    userId: params.userId,
    direction: 'CONSUME',
    assetType: 'COUPON',
    amount: 1,
    balanceAfter: null,
    purpose: params.purpose || 'publication',
    referenceType: params.referenceType || 'promo_card',
    referenceId: params.referenceId || params.cardId,
    label: params.label,
    meta: params.meta,
  });
}
