import { prisma } from '@/lib/prisma';
import { ensureOfferPendingPublicationColumns } from '@/lib/offerPendingPublication';
import {
  ensureProfilePromoCardTable,
  ensureWelcomePromoCardForUser,
  welcomePromoCardId,
} from '@/lib/profilePromoCards';

export type ImportPublicationRedemptionKind = 'PLUS_CREDIT' | 'BONUS_COUPON' | 'PLUS_IAP';

export type ImportRedemptionInput = {
  source: 'plus_credit' | 'bonus_coupon' | 'plus_iap';
  couponId?: string;
  transactionId?: string;
};

/** Kontrakt WWW (`POST /api/otodom-import/create`) — zgodny z `buildCreatePublicationPayload`. */
export type OtodomPublicationInput = {
  kind?: string;
  bonusCouponId?: string;
  iapTransactionId?: string;
  consumePlusPublication?: boolean;
};

export function publicationInputToRedemption(
  pub: OtodomPublicationInput,
): ImportRedemptionInput | null {
  const bonusCouponId = String(pub.bonusCouponId || '').trim();
  const iapTransactionId = String(pub.iapTransactionId || '').trim();
  const kind = String(pub.kind || '').trim().toUpperCase();

  if (bonusCouponId || kind === 'FREE_FIRST') {
    return { source: 'bonus_coupon', couponId: bonusCouponId || undefined };
  }
  if (iapTransactionId || kind === 'PLUS_PAID') {
    return { source: 'plus_iap', transactionId: iapTransactionId || undefined };
  }
  if (pub.consumePlusPublication === true || kind === 'PLUS_CREDIT') {
    return { source: 'plus_credit' };
  }
  return null;
}

/** Kupon powitalny — standardowa pierwsza publikacja dla nowego właściciela. */
export function buildWelcomeCouponPublicationInput(userId: number): OtodomPublicationInput {
  return {
    kind: 'FREE_FIRST',
    bonusCouponId: welcomePromoCardId(userId),
  };
}

/**
 * Rezerwuje publikację kuponem powitalnym (np. import /dolacz lub brak rezerwacji przy akceptacji admina).
 */
export async function tryReserveWelcomeCouponPublication(params: {
  offerId: number;
  userId: number;
}): Promise<boolean> {
  await ensureWelcomePromoCardForUser(params.userId);
  try {
    await consumeAndReserveImportPublication({
      offerId: params.offerId,
      userId: params.userId,
      redemption: {
        source: 'bonus_coupon',
        couponId: welcomePromoCardId(params.userId),
      },
    });
    return true;
  } catch (error) {
    if (error instanceof ImportPublicationError) {
      return false;
    }
    throw error;
  }
}

export class ImportPublicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'ImportPublicationError';
  }
}

async function setPendingPublicationTx(
  tx: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown> },
  params: {
    offerId: number;
    kind: 'FREE_FIRST' | 'PLUS_CREDIT' | 'PLUS_PAID';
    bonusCouponId?: string | null;
    iapTransactionId?: string | null;
    entitlementConsumed?: boolean;
  },
) {
  await tx.$executeRawUnsafe(
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

async function consumePlusCreditTx(
  tx: {
    $executeRawUnsafe: typeof prisma.$executeRawUnsafe;
    $queryRawUnsafe: typeof prisma.$queryRawUnsafe;
  },
  userId: number,
) {
  const rows = (await tx.$queryRawUnsafe(
    `
      SELECT extraListings, plusExpiresAt
      FROM \`User\`
      WHERE id = ?
      FOR UPDATE
    `,
    userId,
  )) as Array<{ extraListings: number; plusExpiresAt: Date | string | null }>;
  const row = rows[0];
  if (!row) throw new ImportPublicationError('Nie znaleziono użytkownika.', 'USER_NOT_FOUND', 404);
  const slots = Number(row.extraListings ?? 0);
  const exp = row.plusExpiresAt ? new Date(row.plusExpiresAt).getTime() : 0;
  if (slots < 1 || !Number.isFinite(exp) || exp <= Date.now()) {
    throw new ImportPublicationError(
      'Brak dostępnego kredytu Pakietu Plus. Użyj kuponu lub doładuj kredyt.',
      'PUBLICATION_REQUIRES_PLUS',
    );
  }
  const consumed = await tx.$executeRawUnsafe(
    `
      UPDATE \`User\`
      SET extraListings = GREATEST(0, extraListings - 1)
      WHERE id = ?
        AND extraListings > 0
        AND plusExpiresAt IS NOT NULL
        AND plusExpiresAt > NOW(3)
    `,
    userId,
  );
  if (Number(consumed || 0) < 1) {
    throw new ImportPublicationError(
      'Brak dostępnego kredytu Pakietu Plus. Użyj kuponu lub doładuj kredyt.',
      'PUBLICATION_REQUIRES_PLUS',
    );
  }
}

async function consumeBonusCouponTx(
  tx: { $executeRawUnsafe: typeof prisma.$executeRawUnsafe },
  userId: number,
  couponId: string,
) {
  const normalized = couponId.slice(0, 64);
  if (normalized.startsWith('welcome_')) {
    await ensureWelcomePromoCardForUser(userId);
  }
  const consumedCoupon = await tx.$executeRawUnsafe(
    `
      UPDATE MobileProfilePromoCard
      SET couponUsed = 1, updatedAt = NOW(3)
      WHERE id = ?
        AND userId = ?
        AND grantsFreeListing = 1
        AND couponUsed = 0
        AND (expiresAt IS NULL OR expiresAt > NOW(3))
    `,
    normalized,
    userId,
  );
  if (Number(consumedCoupon || 0) < 1) {
    throw new ImportPublicationError(
      'Kupon jest nieważny, wygasł lub został już wykorzystany.',
      'COUPON_NOT_AVAILABLE',
    );
  }
  if (normalized.startsWith('welcome_')) {
    await tx.$executeRawUnsafe('UPDATE `User` SET firstFreePublicationUsed = 1 WHERE id = ?', userId);
  }
}

async function consumePlusIapTx(
  tx: { $executeRawUnsafe: typeof prisma.$executeRawUnsafe },
  userId: number,
  offerId: number,
  iapTransactionId: string,
) {
  const txId = iapTransactionId.slice(0, 128);
  const consumedIap = await tx.$executeRawUnsafe(
    `
      UPDATE MobileIapPurchase
      SET consumedAt = COALESCE(consumedAt, NOW(3)),
          offerId = ?,
          verifyStatus = 'VERIFIED'
      WHERE userId = ?
        AND transactionId = ?
        AND productId = 'pl.estateos.app.pakiet_plus_30d'
        AND consumedAt IS NULL
        AND verifyStatus = 'VERIFIED'
    `,
    offerId,
    userId,
    txId,
  );
  if (Number(consumedIap || 0) < 1) {
    throw new ImportPublicationError(
      'Nie znaleziono niewykorzystanej transakcji IAP dla Pakietu Plus.',
      'IAP_TRANSACTION_NOT_AVAILABLE',
    );
  }
  return txId;
}

/**
 * Atomowo: pobiera kredyt/kupon/IAP i rezerwuje publikację na ofercie (wymagane przy akceptacji admina).
 */
export async function consumeAndReserveImportPublication(params: {
  offerId: number;
  userId: number;
  redemption: ImportRedemptionInput;
}): Promise<{
  kind: ImportPublicationRedemptionKind;
  couponId: string | null;
  iapTransactionId: string | null;
  extraListings: number;
  plusExpiresAt: string | null;
}> {
  await ensureOfferPendingPublicationColumns();
  await ensureProfilePromoCardTable();
  const source = params.redemption.source;
  const couponId = String(params.redemption.couponId || '').trim();
  const iapTx = String(params.redemption.transactionId || '').trim();

  const payment = await prisma.$transaction(async (tx) => {
    if (source === 'plus_credit') {
      await consumePlusCreditTx(tx, params.userId);
      await setPendingPublicationTx(tx, {
        offerId: params.offerId,
        kind: 'PLUS_CREDIT',
        entitlementConsumed: true,
      });
      return {
        kind: 'PLUS_CREDIT' as const,
        couponId: null,
        iapTransactionId: null,
      };
    }

    if (source === 'bonus_coupon') {
      if (!couponId) {
        throw new ImportPublicationError('Podaj ID kuponu do wykorzystania.', 'COUPON_REQUIRED', 400);
      }
      await consumeBonusCouponTx(tx, params.userId, couponId);
      const consumedCouponId = couponId.slice(0, 64);
      await setPendingPublicationTx(tx, {
        offerId: params.offerId,
        kind: 'FREE_FIRST',
        bonusCouponId: consumedCouponId,
        entitlementConsumed: true,
      });
      return {
        kind: 'BONUS_COUPON' as const,
        couponId: consumedCouponId,
        iapTransactionId: null,
      };
    }

    if (source === 'plus_iap') {
      if (!iapTx) {
        throw new ImportPublicationError('Brak ID transakcji IAP.', 'IAP_TRANSACTION_REQUIRED', 400);
      }
      const consumedIapTransactionId = await consumePlusIapTx(tx, params.userId, params.offerId, iapTx);
      await setPendingPublicationTx(tx, {
        offerId: params.offerId,
        kind: 'PLUS_PAID',
        iapTransactionId: consumedIapTransactionId,
        entitlementConsumed: true,
      });
      return {
        kind: 'PLUS_IAP' as const,
        couponId: null,
        iapTransactionId: consumedIapTransactionId,
      };
    }

    throw new ImportPublicationError(
      'Przed utworzeniem oferty wybierz wykorzystanie kredytu Plus albo kuponu.',
      'ENTITLEMENT_REQUIRED',
      422,
    );
  });

  const wallet = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { extraListings: true, plusExpiresAt: true },
  });

  return {
    ...payment,
    extraListings: Number(wallet?.extraListings ?? 0),
    plusExpiresAt: wallet?.plusExpiresAt ? new Date(wallet.plusExpiresAt).toISOString() : null,
  };
}

export async function deleteOfferAfterImportPaymentFailure(offerId: number): Promise<void> {
  try {
    await prisma.offer.delete({ where: { id: offerId } });
  } catch {
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'ARCHIVED', updatedAt: new Date() },
    });
  }
}
