import { prisma } from "@/lib/prisma";
import { buildPakietPlusUserUpdate } from "@/lib/mobileIapEntitlements";
import { ensureMobileIapTables } from "@/lib/mobileIapTables";
import { PAKIET_PLUS_PRODUCT_ID } from "@/lib/publicationConstants";
import { stageOfferPublicationForReview } from "@/lib/offerPublication";

export function stripeTransactionId(checkoutSessionId: string) {
  return `stripe_${String(checkoutSessionId).trim()}`;
}

export async function grantPlusCreditFromStripeCheckout(params: {
  userId: number;
  checkoutSessionId: string;
  /** ile kredytów kupiono w tej sesji (domyślnie 1) */
  credits?: number;
}) {
  await ensureMobileIapTables();
  const txId = stripeTransactionId(params.checkoutSessionId);
  const pendingId = `stripe_credit_${params.checkoutSessionId}`;
  const credits = Math.min(50, Math.max(1, Math.floor(Number(params.credits) || 1)));

  const existing = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase WHERE pendingPurchaseId = ? OR transactionId = ? LIMIT 1`,
    pendingId,
    txId,
  )) as Array<{ id: bigint }>;
  if (existing.length) return { transactionId: txId };

  // Webhook i powrót z płatności mogą przyjść naraz — kredyty dostaje tylko ten, który zapisał zakup.
  const inserted = await prisma.$executeRawUnsafe(
    `
      INSERT IGNORE INTO MobileIapPurchase
        (userId, pendingPurchaseId, platform, productId, transactionId, status, verifyStatus, entitlementGrantedAt)
      VALUES (?, ?, 'web', ?, ?, 'VERIFIED', 'VERIFIED', NOW(3))
    `,
    params.userId,
    pendingId,
    PAKIET_PLUS_PRODUCT_ID,
    txId,
  );
  if (Number(inserted) < 1) return { transactionId: txId };

  await prisma.user.update({
    where: { id: params.userId },
    data: buildPakietPlusUserUpdate(new Date(), credits),
  });

  return { transactionId: txId };
}

export async function registerStripePublicationPurchase(params: {
  userId: number;
  checkoutSessionId: string;
  targetOfferId?: number | null;
}) {
  await ensureMobileIapTables();
  const txId = stripeTransactionId(params.checkoutSessionId);
  const pendingId = `stripe_pub_${params.checkoutSessionId}`;

  const rows = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase WHERE pendingPurchaseId = ? LIMIT 1`,
    pendingId,
  )) as Array<{ id: bigint }>;

  if (rows.length === 0) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO MobileIapPurchase
          (userId, pendingPurchaseId, platform, productId, transactionId, status, verifyStatus, targetOfferId)
        VALUES (?, ?, 'web', ?, ?, 'VERIFIED', 'VERIFIED', ?)
      `,
      params.userId,
      pendingId,
      PAKIET_PLUS_PRODUCT_ID,
      txId,
      params.targetOfferId ?? null,
    );
  }

  return { transactionId: txId };
}

export async function activateOfferFromStripeRenewal(params: {
  userId: number;
  offerId: number;
  checkoutSessionId: string;
}) {
  const { transactionId } = await registerStripePublicationPurchase({
    userId: params.userId,
    checkoutSessionId: params.checkoutSessionId,
    targetOfferId: params.offerId,
  });

  return stageOfferPublicationForReview({
    userId: params.userId,
    offerId: params.offerId,
    kind: "PLUS_PAID",
    iapTransactionId: transactionId,
    iapProductId: PAKIET_PLUS_PRODUCT_ID,
  });
}
