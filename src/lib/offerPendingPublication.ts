import { prisma } from "@/lib/prisma";

export type PendingPublicationKind = "FREE_FIRST" | "PLUS_CREDIT" | "PLUS_PAID";

let ensured = false;
let ensuring: Promise<void> | null = null;

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
    columnName,
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  if (await hasColumn(tableName, columnName)) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${tableName}\` ADD COLUMN IF NOT EXISTS \`${columnName}\` ${definition}`,
    );
  } catch (error) {
    if (isIgnorableSchemaError(error)) return;
    if (!isIfNotExistsSyntaxError(error)) throw error;
    if (!(await hasColumn(tableName, columnName))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
      );
    }
  }
}

export async function ensureOfferPendingPublicationColumns() {
  if (ensured) return;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    await addColumnIfMissing("Offer", "pendingPublicationKind", "VARCHAR(20) NULL");
    await addColumnIfMissing("Offer", "pendingBonusCouponId", "VARCHAR(64) NULL");
    await addColumnIfMissing("Offer", "pendingIapTransactionId", "VARCHAR(128) NULL");
    await addColumnIfMissing("Offer", "pendingPublicationCreatedAt", "DATETIME(3) NULL");
    ensured = true;
  })();
  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

export async function setPendingPublication(params: {
  offerId: number;
  kind: PendingPublicationKind;
  bonusCouponId?: string | null;
  iapTransactionId?: string | null;
}) {
  await ensureOfferPendingPublicationColumns();
  await prisma.$executeRawUnsafe(
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

export async function clearPendingPublication(offerId: number) {
  await ensureOfferPendingPublicationColumns();
  await prisma.$executeRawUnsafe(
    `
      UPDATE \`Offer\`
      SET pendingPublicationKind = NULL,
          pendingBonusCouponId = NULL,
          pendingIapTransactionId = NULL,
          pendingPublicationCreatedAt = NULL
      WHERE id = ?
    `,
    offerId,
  );
}

export async function readPendingPublication(offerId: number): Promise<{
  kind: PendingPublicationKind | null;
  bonusCouponId: string | null;
  iapTransactionId: string | null;
} | null> {
  await ensureOfferPendingPublicationColumns();
  const rows = (await prisma.$queryRawUnsafe<
    Array<{
      pendingPublicationKind: string | null;
      pendingBonusCouponId: string | null;
      pendingIapTransactionId: string | null;
    }>
  >(
    `
      SELECT pendingPublicationKind, pendingBonusCouponId, pendingIapTransactionId
      FROM \`Offer\`
      WHERE id = ?
      LIMIT 1
    `,
    offerId,
  )) as Array<{
    pendingPublicationKind: string | null;
    pendingBonusCouponId: string | null;
    pendingIapTransactionId: string | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  const kind =
    row.pendingPublicationKind === "FREE_FIRST" ||
    row.pendingPublicationKind === "PLUS_CREDIT" ||
    row.pendingPublicationKind === "PLUS_PAID"
      ? (row.pendingPublicationKind as PendingPublicationKind)
      : null;
  return {
    kind,
    bonusCouponId: row.pendingBonusCouponId,
    iapTransactionId: row.pendingIapTransactionId,
  };
}

