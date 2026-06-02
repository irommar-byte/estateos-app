import { prisma } from '@/lib/prisma';
import { setPendingPublication } from '@/lib/offerPendingPublication';

export type ImportPublicationRedemptionKind = 'PLUS_CREDIT' | 'BONUS_COUPON' | 'PLUS_IAP';

/** Po pobraniu kredytu/kuponu/IAP — rezerwacja publikacji na ofercie (wymagane przy akceptacji admina). */
export async function reservePublicationForImportedOffer(params: {
  offerId: number;
  userId: number;
  consumedKind: ImportPublicationRedemptionKind;
  couponId?: string | null;
  iapTransactionId?: string | null;
}): Promise<void> {
  const offerId = params.offerId;
  const userId = params.userId;

  if (params.consumedKind === 'PLUS_CREDIT') {
    await setPendingPublication({
      offerId,
      kind: 'PLUS_CREDIT',
      entitlementConsumed: true,
    });
    return;
  }

  if (params.consumedKind === 'BONUS_COUPON') {
    const couponId = String(params.couponId || '').trim().slice(0, 64) || null;
    await setPendingPublication({
      offerId,
      kind: 'FREE_FIRST',
      bonusCouponId: couponId,
      entitlementConsumed: true,
    });
    if (couponId?.startsWith('welcome_')) {
      await prisma.$executeRawUnsafe(
        'UPDATE `User` SET firstFreePublicationUsed = 1 WHERE id = ?',
        userId,
      );
    }
    return;
  }

  const txId = String(params.iapTransactionId || '').trim().slice(0, 128) || null;
  await setPendingPublication({
    offerId,
    kind: 'PLUS_PAID',
    iapTransactionId: txId,
    entitlementConsumed: true,
  });
  if (txId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE MobileIapPurchase
        SET offerId = ?
        WHERE userId = ?
          AND transactionId = ?
          AND productId = 'pl.estateos.app.pakiet_plus_30d'
      `,
      offerId,
      userId,
      txId,
    );
  }
}

export async function rollbackImportPublicationConsumption(params: {
  userId: number;
  consumedKind: ImportPublicationRedemptionKind;
  couponId?: string | null;
  iapTransactionId?: string | null;
}): Promise<void> {
  const userId = params.userId;
  if (params.consumedKind === 'PLUS_CREDIT') {
    await prisma.$executeRawUnsafe(
      'UPDATE `User` SET extraListings = extraListings + 1 WHERE id = ?',
      userId,
    );
    return;
  }
  if (params.consumedKind === 'BONUS_COUPON' && params.couponId) {
    await prisma.$executeRawUnsafe(
      'UPDATE MobileProfilePromoCard SET couponUsed = 0, updatedAt = NOW(3) WHERE id = ? AND userId = ?',
      String(params.couponId).slice(0, 64),
      userId,
    );
    if (String(params.couponId).startsWith('welcome_')) {
      await prisma.$executeRawUnsafe(
        'UPDATE `User` SET firstFreePublicationUsed = 0 WHERE id = ?',
        userId,
      );
    }
    return;
  }
  if (params.consumedKind === 'PLUS_IAP' && params.iapTransactionId) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE MobileIapPurchase
        SET consumedAt = NULL, offerId = NULL
        WHERE userId = ?
          AND transactionId = ?
          AND productId = 'pl.estateos.app.pakiet_plus_30d'
      `,
      userId,
      String(params.iapTransactionId).slice(0, 128),
    );
  }
}
