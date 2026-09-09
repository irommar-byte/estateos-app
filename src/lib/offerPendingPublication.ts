import { prisma } from "@/lib/prisma";

export type PendingPublicationKind = "FREE_FIRST" | "PLUS_CREDIT" | "PLUS_PAID";

export async function ensureOfferPendingPublicationColumns() {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
}

export async function setPendingPublication(params: {
  offerId: number;
  kind: PendingPublicationKind;
  bonusCouponId?: string | null;
  iapTransactionId?: string | null;
  entitlementConsumed?: boolean;
}) {
  await ensureOfferPendingPublicationColumns();
  await prisma.$executeRawUnsafe(
    `
      UPDATE \`Offer\`
      SET pendingPublicationKind = ?,
          pendingBonusCouponId = ?,
          pendingIapTransactionId = ?,
          pendingPublicationCreatedAt = NOW(3),
          pendingPublicationEntitlementConsumed = ?
      WHERE id = ?
    `,
    params.kind,
    params.bonusCouponId ? String(params.bonusCouponId).slice(0, 64) : null,
    params.iapTransactionId ? String(params.iapTransactionId).slice(0, 128) : null,
    params.entitlementConsumed ? 1 : 0,
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
          pendingPublicationCreatedAt = NULL,
          pendingPublicationEntitlementConsumed = 0
      WHERE id = ?
    `,
    offerId,
  );
}

export async function readPendingPublication(offerId: number): Promise<{
  kind: PendingPublicationKind | null;
  bonusCouponId: string | null;
  iapTransactionId: string | null;
  entitlementConsumed: boolean;
} | null> {
  await ensureOfferPendingPublicationColumns();
  const rows = (await prisma.$queryRawUnsafe<
    Array<{
      pendingPublicationKind: string | null;
      pendingBonusCouponId: string | null;
      pendingIapTransactionId: string | null;
      pendingPublicationEntitlementConsumed: number | string | null;
    }>
  >(
    `
      SELECT pendingPublicationKind, pendingBonusCouponId, pendingIapTransactionId,
             pendingPublicationEntitlementConsumed
      FROM \`Offer\`
      WHERE id = ?
      LIMIT 1
    `,
    offerId,
  )) as Array<{
    pendingPublicationKind: string | null;
    pendingBonusCouponId: string | null;
    pendingIapTransactionId: string | null;
    pendingPublicationEntitlementConsumed: number | string | null;
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
    entitlementConsumed: Number(row.pendingPublicationEntitlementConsumed ?? 0) > 0,
  };
}

