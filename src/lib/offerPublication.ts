import { prisma } from '@/lib/prisma';
import {
  clearPendingPublication,
  ensureOfferPendingPublicationColumns,
  readPendingPublication,
} from '@/lib/offerPendingPublication';

const PUBLICATION_DURATION_DAYS = 30;
const PAKIET_PLUS_PRODUCT_ID = 'pl.estateos.app.pakiet_plus_30d';

export type PublicationKind = 'FREE_FIRST' | 'PLUS_PAID' | 'PLUS_CREDIT';
export type PublicationEndReason = 'EXPIRED' | 'MANUAL_ARCHIVE' | 'SOLD' | 'ADMIN';
export type PublicationQuoteReason =
  | 'NOT_FIRST_OFFER'
  | 'FREE_ALREADY_USED'
  | 'PLUS_CREDIT_AVAILABLE'
  | 'PUBLICATION_REQUIRES_PLUS'
  | 'REACTIVATION_AFTER_ARCHIVE'
  | 'REACTIVATION_AFTER_SOLD'
  | 'ALREADY_ACTIVE'
  | null;

type DbClient = typeof prisma;

type OfferPublicationRow = {
  id: bigint | number;
  offerId: number;
  userId: number;
  kind: PublicationKind;
  status: 'ACTIVE' | 'ENDED';
  startedAt: Date;
  endsAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  iapTransactionId: string | null;
  iapProductId: string | null;
  dealId: number | null;
  createdAt: Date;
};

export type PublicationQuote = {
  offerId: number;
  action: 'CREATE_AND_ACTIVATE' | 'ACTIVATE';
  requiresPayment: boolean;
  allowedFreeFirst: boolean;
  reason: PublicationQuoteReason;
  productId: string;
};

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

function asDb(db?: any): any {
  return db || prisma;
}

function toBooleanFlag(value: unknown): boolean {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0;
}

function hasPlusCreditOnUser(user: { extraListings?: number | null; plusExpiresAt?: Date | string | null }) {
  const credits = Number(user?.extraListings ?? 0);
  if (!Number.isFinite(credits) || credits <= 0) return false;
  if (!user?.plusExpiresAt) return false;
  const expiresAt = new Date(user.plusExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function isIgnorableSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Duplicate column name|already exists/i.test(message);
}

function isIfNotExistsSyntaxError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /syntax/i.test(message) && /if not exists/i.test(message);
}

async function hasColumn(tableName: string, columnName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    tableName,
    columnName
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (await hasColumn(tableName, columnName)) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${tableName}\` ADD COLUMN IF NOT EXISTS \`${columnName}\` ${definition}`
    );
  } catch (error) {
    if (isIgnorableSchemaError(error)) return;
    if (!isIfNotExistsSyntaxError(error)) throw error;
    if (!(await hasColumn(tableName, columnName))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
      );
    }
  }
}

export async function ensureOfferPublicationSchema() {
  if (schemaEnsured) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS OfferPublication (
        id BIGINT NOT NULL AUTO_INCREMENT,
        offerId INT NOT NULL,
        userId INT NOT NULL,
        kind VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        endsAt DATETIME(3) NOT NULL,
        endedAt DATETIME(3) NULL,
        endReason VARCHAR(30) NULL,
        iapTransactionId VARCHAR(128) NULL,
        iapProductId VARCHAR(64) NULL,
        dealId INT NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY OfferPublication_offer_status_idx (offerId, status),
        KEY OfferPublication_user_status_idx (userId, status),
        KEY OfferPublication_ends_at_idx (endsAt, status),
        KEY OfferPublication_deal_idx (dealId),
        UNIQUE KEY OfferPublication_iap_tx_unique (iapTransactionId),
        CONSTRAINT OfferPublication_offer_fk FOREIGN KEY (offerId) REFERENCES Offer(id) ON DELETE CASCADE,
        CONSTRAINT OfferPublication_user_fk FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        CONSTRAINT OfferPublication_deal_fk FOREIGN KEY (dealId) REFERENCES Deal(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await addColumnIfMissing('User', 'firstFreePublicationUsed', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing(
      'MobileIapPurchase',
      'verifyStatus',
      "VARCHAR(24) NOT NULL DEFAULT 'VERIFIED'"
    );
    await addColumnIfMissing('MobileIapPurchase', 'targetOfferId', 'INT NULL');
    await addColumnIfMissing('MobileIapPurchase', 'offerId', 'INT NULL');
    await addColumnIfMissing('MobileIapPurchase', 'consumedAt', 'DATETIME(3) NULL');
    schemaEnsured = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

async function readOfferOwnership(db: any, offerId: number) {
  const offer = await db.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, status: true },
  });
  return offer;
}

async function activePublicationForOffer(db: any, offerId: number) {
  const rows = (await db.$queryRawUnsafe(
    `
      SELECT *
      FROM OfferPublication
      WHERE offerId = ? AND status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1
    `,
    offerId
  )) as OfferPublicationRow[];
  return rows[0] ?? null;
}

async function lastPublicationForOffer(db: any, offerId: number) {
  const rows = (await db.$queryRawUnsafe(
    `
      SELECT *
      FROM OfferPublication
      WHERE offerId = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    offerId
  )) as OfferPublicationRow[];
  return rows[0] ?? null;
}

export async function getPublicationQuote(params: {
  userId: number;
  offerId: number;
  action?: 'CREATE_AND_ACTIVATE' | 'ACTIVATE';
  db?: DbClient;
}): Promise<PublicationQuote> {
  const db = asDb(params.db);
  const { userId, offerId } = params;
  const action = params.action ?? 'ACTIVATE';

  await ensureOfferPublicationSchema();

  const offer = await readOfferOwnership(db, offerId);
  if (!offer || offer.userId !== userId) {
    throw new Error('OFFER_NOT_FOUND_OR_FORBIDDEN');
  }

  const active = await activePublicationForOffer(db, offerId);
  if (active) {
    return {
      offerId,
      action,
      requiresPayment: false,
      allowedFreeFirst: false,
      reason: 'ALREADY_ACTIVE',
      productId: PAKIET_PLUS_PRODUCT_ID,
    };
  }

  const userRows = (await db.$queryRawUnsafe(
    'SELECT id, firstFreePublicationUsed, extraListings, plusExpiresAt FROM `User` WHERE id = ? LIMIT 1',
    userId
  )) as Array<{
    id: number;
    firstFreePublicationUsed: number;
    extraListings: number | null;
    plusExpiresAt: Date | string | null;
  }>;
  const user = userRows[0];
  if (!user) throw new Error('USER_NOT_FOUND');

  if (hasPlusCreditOnUser(user)) {
    return {
      offerId,
      action,
      requiresPayment: false,
      allowedFreeFirst: false,
      reason: 'PLUS_CREDIT_AVAILABLE',
      productId: PAKIET_PLUS_PRODUCT_ID,
    };
  }

  const last = await lastPublicationForOffer(db, offerId);
  let reason: PublicationQuoteReason = 'NOT_FIRST_OFFER';
  if (last?.endReason === 'SOLD') reason = 'REACTIVATION_AFTER_SOLD';
  else if (last) reason = 'REACTIVATION_AFTER_ARCHIVE';

  return {
    offerId,
    action,
    requiresPayment: true,
    allowedFreeFirst: false,
    reason,
    productId: PAKIET_PLUS_PRODUCT_ID,
  };
}

export async function getCreatePublicationQuote(params: {
  userId: number;
  db?: DbClient;
}): Promise<Omit<PublicationQuote, 'offerId'> & { offerId: null }> {
  const db = asDb(params.db);
  await ensureOfferPublicationSchema();
  const userRows = (await db.$queryRawUnsafe(
    'SELECT id, firstFreePublicationUsed, extraListings, plusExpiresAt FROM `User` WHERE id = ? LIMIT 1',
    params.userId
  )) as Array<{
    id: number;
    firstFreePublicationUsed: number;
    extraListings: number | null;
    plusExpiresAt: Date | string | null;
  }>;
  const user = userRows[0];
  if (!user) throw new Error('USER_NOT_FOUND');

  const hasPlusCredit = hasPlusCreditOnUser(user);
  const requiresPayment = !hasPlusCredit;
  return {
    offerId: null,
    action: 'CREATE_AND_ACTIVATE',
    requiresPayment,
    allowedFreeFirst: false,
    reason: hasPlusCredit ? 'PLUS_CREDIT_AVAILABLE' : 'PUBLICATION_REQUIRES_PLUS',
    productId: PAKIET_PLUS_PRODUCT_ID,
  };
}

async function consumePublicationEntitlementInTx(
  tx: any,
  params: {
    userId: number;
    offerId: number;
    kind: PublicationKind;
    iapTransactionId?: string | null;
    iapProductId?: string | null;
    consumeFreeFirst?: boolean;
  },
) {
  const txId = params.kind === 'PLUS_PAID' ? String(params.iapTransactionId || '').trim() : null;
  const iapProductId = String(params.iapProductId || PAKIET_PLUS_PRODUCT_ID).slice(0, 64);

  if (params.kind === 'PLUS_PAID') {
    if (!txId) throw new Error('IAP_TRANSACTION_REQUIRED');
    const consume = await tx.$executeRawUnsafe(
      `
          UPDATE MobileIapPurchase
          SET consumedAt = COALESCE(consumedAt, NOW(3)),
              offerId = ?,
              verifyStatus = 'VERIFIED'
          WHERE userId = ?
            AND transactionId = ?
            AND productId = ?
            AND consumedAt IS NULL
            AND verifyStatus = 'VERIFIED'
        `,
      params.offerId,
      params.userId,
      txId,
      iapProductId,
    );
    if (Number(consume || 0) < 1) {
      throw new Error('IAP_TRANSACTION_NOT_AVAILABLE');
    }
  } else if (params.kind === 'PLUS_CREDIT') {
    const consumeCredit = await tx.$executeRawUnsafe(
      `
          UPDATE \`User\`
          SET extraListings = GREATEST(0, extraListings - 1)
          WHERE id = ?
            AND extraListings > 0
            AND plusExpiresAt IS NOT NULL
            AND plusExpiresAt > NOW(3)
        `,
      params.userId,
    );
    if (Number(consumeCredit || 0) < 1) {
      throw new Error('NO_PLUS_CREDIT_AVAILABLE');
    }
  }

  if (params.consumeFreeFirst && params.kind === 'FREE_FIRST') {
    await tx.$executeRawUnsafe(
      'UPDATE `User` SET firstFreePublicationUsed = 1 WHERE id = ?',
      params.userId,
    );
  }
}

async function writePendingPublicationInTx(
  tx: any,
  params: {
    offerId: number;
    kind: PublicationKind;
    bonusCouponId?: string | null;
    iapTransactionId?: string | null;
  },
) {
  await ensureOfferPendingPublicationColumns();
  await tx.$executeRawUnsafe(
    `
      UPDATE \`Offer\`
      SET pendingPublicationKind = ?,
          pendingBonusCouponId = ?,
          pendingIapTransactionId = ?,
          pendingPublicationCreatedAt = NOW(3)
      WHERE id = ?
    `,
    params.kind,
    params.bonusCouponId ? String(params.bonusCouponId).slice(0, 64) : null,
    params.iapTransactionId ? String(params.iapTransactionId).slice(0, 128) : null,
    params.offerId,
  );
}

/**
 * Rezerwuje płatność / kredyt i zapisuje oczekującą publikację.
 * Oferta pozostaje PENDING do akceptacji w panelu admina (wtedy activateOfferPublication).
 */
export async function stageOfferPublicationForReview(params: {
  userId: number;
  offerId: number;
  kind: PublicationKind;
  bonusCouponId?: string | null;
  iapTransactionId?: string | null;
  iapProductId?: string | null;
  db?: DbClient;
}) {
  const db = asDb(params.db);
  await ensureOfferPublicationSchema();

  const offer = await readOfferOwnership(db, params.offerId);
  if (!offer || offer.userId !== params.userId) throw new Error('OFFER_NOT_FOUND_OR_FORBIDDEN');
  const alreadyActive = await activePublicationForOffer(db, params.offerId);
  if (alreadyActive) throw new Error('PUBLICATION_ALREADY_ACTIVE');

  const txId = params.kind === 'PLUS_PAID' ? String(params.iapTransactionId || '').trim() : null;
  if (params.kind === 'PLUS_PAID' && !txId) {
    throw new Error('IAP_TRANSACTION_REQUIRED');
  }

  return db.$transaction(async (tx: any) => {
    const concurrentActive = await activePublicationForOffer(tx, params.offerId);
    if (concurrentActive) throw new Error('PUBLICATION_ALREADY_ACTIVE');

    if (params.kind === 'PLUS_CREDIT') {
      const userRows = (await tx.$queryRawUnsafe(
        'SELECT extraListings, plusExpiresAt FROM `User` WHERE id = ? LIMIT 1',
        params.userId,
      )) as Array<{ extraListings: number | null; plusExpiresAt: Date | string | null }>;
      if (!hasPlusCreditOnUser(userRows[0] || {})) {
        throw new Error('NO_PLUS_CREDIT_AVAILABLE');
      }
    }

    if (params.kind === 'PLUS_PAID') {
      const iapProductId = String(params.iapProductId || PAKIET_PLUS_PRODUCT_ID).slice(0, 64);
      const rows = (await tx.$queryRawUnsafe(
        `
          SELECT id FROM MobileIapPurchase
          WHERE userId = ? AND transactionId = ? AND productId = ?
            AND consumedAt IS NULL AND verifyStatus = 'VERIFIED'
          LIMIT 1
        `,
        params.userId,
        txId,
        iapProductId,
      )) as Array<{ id: unknown }>;
      if (!rows.length) throw new Error('IAP_TRANSACTION_NOT_AVAILABLE');
    }

    await writePendingPublicationInTx(tx, {
      offerId: params.offerId,
      kind: params.kind,
      bonusCouponId: params.bonusCouponId,
      iapTransactionId: txId,
    });

    await tx.offer.update({
      where: { id: params.offerId },
      data: { status: 'PENDING', updatedAt: new Date() },
    });

    return {
      offerId: params.offerId,
      status: 'PENDING' as const,
      kind: params.kind,
      awaitingModeration: true,
    };
  });
}

export async function activateOfferPublication(params: {
  userId: number;
  offerId: number;
  kind: PublicationKind;
  iapTransactionId?: string | null;
  iapProductId?: string | null;
  db?: DbClient;
}) {
  const db = asDb(params.db);
  await ensureOfferPublicationSchema();

  const offer = await readOfferOwnership(db, params.offerId);
  if (!offer || offer.userId !== params.userId) throw new Error('OFFER_NOT_FOUND_OR_FORBIDDEN');
  const alreadyActive = await activePublicationForOffer(db, params.offerId);
  if (alreadyActive) throw new Error('PUBLICATION_ALREADY_ACTIVE');

  const now = new Date();
  const endsAt = new Date(now.getTime() + PUBLICATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const txId = params.kind === 'PLUS_PAID' ? String(params.iapTransactionId || '').trim() : null;
  if (params.kind === 'PLUS_PAID' && !txId) {
    throw new Error('IAP_TRANSACTION_REQUIRED');
  }

  const iapProductId = String(params.iapProductId || PAKIET_PLUS_PRODUCT_ID).slice(0, 64);

  return db.$transaction(async (tx: any) => {
    const concurrentActive = await activePublicationForOffer(tx, params.offerId);
    if (concurrentActive) throw new Error('PUBLICATION_ALREADY_ACTIVE');

    await consumePublicationEntitlementInTx(tx, {
      userId: params.userId,
      offerId: params.offerId,
      kind: params.kind,
      iapTransactionId: params.iapTransactionId,
      iapProductId: params.iapProductId,
      consumeFreeFirst: true,
    });

    await tx.$executeRawUnsafe(
      `
        INSERT INTO OfferPublication
          (offerId, userId, kind, status, startedAt, endsAt, iapTransactionId, iapProductId)
        VALUES
          (?, ?, ?, 'ACTIVE', NOW(3), ?, ?, ?)
      `,
      params.offerId,
      params.userId,
      params.kind,
      endsAt,
      txId,
      iapProductId
    );

    await tx.offer.update({
      where: { id: params.offerId },
      data: { status: 'ACTIVE', expiresAt: endsAt, updatedAt: new Date() },
    });

    const publication = await activePublicationForOffer(tx, params.offerId);
    return {
      offerId: params.offerId,
      status: 'ACTIVE' as const,
      kind: params.kind,
      endsAt,
      publication,
    };
  });
}

export async function endOfferPublication(params: {
  offerId: number;
  endReason: PublicationEndReason;
  dealId?: number | null;
  offerStatus: 'ARCHIVED' | 'SOLD';
  db?: DbClient;
}) {
  const db = asDb(params.db);
  await ensureOfferPublicationSchema();

  return db.$transaction(async (tx: any) => {
    return endOfferPublicationInTx(tx, params);
  });
}

export async function endOfferPublicationInTx(
  tx: any,
  params: {
    offerId: number;
    endReason: PublicationEndReason;
    dealId?: number | null;
    offerStatus: 'ARCHIVED' | 'SOLD';
  }
) {
  await tx.$executeRawUnsafe(
    `
      UPDATE OfferPublication
      SET status = 'ENDED',
          endedAt = NOW(3),
          endReason = ?,
          dealId = COALESCE(?, dealId)
      WHERE offerId = ? AND status = 'ACTIVE'
    `,
    params.endReason,
    params.dealId ?? null,
    params.offerId
  );

  const endedAt = new Date();
  await tx.offer.update({
    where: { id: params.offerId },
    data: {
      status: params.offerStatus,
      expiresAt: endedAt,
      updatedAt: endedAt,
    },
  });

  const rows = (await tx.$queryRawUnsafe(
    `
      SELECT *
      FROM OfferPublication
      WHERE offerId = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    params.offerId
  )) as OfferPublicationRow[];
  return rows[0] ?? null;
}

export async function activePublicationOfferIds(offerIds: number[]) {
  await ensureOfferPublicationSchema();
  if (!offerIds.length) return new Set<number>();
  const safeIds = offerIds.filter((id) => Number.isFinite(id));
  if (!safeIds.length) return new Set<number>();
  const rows = await prisma.$queryRawUnsafe<Array<{ offerId: number }>>(
    `
      SELECT offerId
      FROM OfferPublication
      WHERE status = 'ACTIVE'
        AND offerId IN (${safeIds.map(() => '?').join(',')})
    `,
    ...safeIds
  );
  return new Set(rows.map((row) => Number(row.offerId)).filter((id) => Number.isFinite(id)));
}

export type AdminOfferApprovalResult =
  | { ok: true; endsAt: Date; alreadyOnMarket: boolean }
  | { ok: false; code: 'NO_PENDING_PUBLICATION' | 'ACTIVATION_FAILED'; message: string };

/**
 * Po akceptacji admina: uruchamia oczekującą publikację (30 dni) i ustawia expiresAt.
 * Bez tego oferta ma status ACTIVE, ale wygasłe expiresAt → „nieaktualna” na rynku.
 */
export async function completeAdminOfferApproval(params: {
  offerId: number;
  ownerUserId: number;
  onFreeFirstCouponUsed?: (userId: number, couponId: string) => Promise<unknown>;
}): Promise<AdminOfferApprovalResult> {
  await ensureOfferPublicationSchema();
  const offerId = params.offerId;

  const active = await activePublicationForOffer(prisma, offerId);
  if (active) {
    const endsAt = new Date(active.endsAt);
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'ACTIVE', expiresAt: endsAt, updatedAt: new Date() },
    });
    await clearPendingPublication(offerId);
    return { ok: true, endsAt, alreadyOnMarket: true };
  }

  const pending = await readPendingPublication(offerId);
  if (!pending?.kind) {
    return {
      ok: false,
      code: 'NO_PENDING_PUBLICATION',
      message:
        'Brak zarezerwowanej publikacji. Sprzedawca musi ponownie opłacić wrzucenie oferty na rynek przed akceptacją.',
    };
  }

  try {
    const quote = await getPublicationQuote({
      userId: params.ownerUserId,
      offerId,
      action: 'ACTIVATE',
    });
    const txId =
      pending.kind === 'PLUS_PAID' ? String(pending.iapTransactionId || '').trim() : '';
    const activation = await activateOfferPublication({
      userId: params.ownerUserId,
      offerId,
      kind: pending.kind,
      iapTransactionId: pending.kind === 'PLUS_PAID' ? txId : null,
      iapProductId: quote.productId,
    });

    if (pending.bonusCouponId && pending.kind === 'FREE_FIRST' && params.onFreeFirstCouponUsed) {
      await params.onFreeFirstCouponUsed(params.ownerUserId, pending.bonusCouponId);
    }
    await clearPendingPublication(offerId);
    return { ok: true, endsAt: activation.endsAt, alreadyOnMarket: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 'ACTIVATION_FAILED', message };
  }
}

