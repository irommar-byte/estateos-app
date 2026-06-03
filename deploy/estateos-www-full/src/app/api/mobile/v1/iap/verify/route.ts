export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import {
  buildInvestorProSubscriptionUserUpdate,
  buildPakietPlusUserUpdate,
  extractSubscriptionExpiresAtFromJws,
  isInvestorProProductId,
  isPakietPlusProductId,
  isSupportedIapProductId,
} from '@/lib/mobileIapEntitlements';

export async function POST(req: Request) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  const body = await readJson(req);
  const productId = String(body?.productId ?? body?.productIdentifier ?? '').trim();
  const pendingPurchaseId = String(
    body?.pendingPurchaseId ?? body?.transactionId ?? body?.originalTransactionId ?? `${userId}:${Date.now()}`
  ).trim();
  const transactionId = body?.transactionId != null ? String(body.transactionId).trim() : null;
  const originalTransactionId =
    body?.originalTransactionId != null ? String(body.originalTransactionId).trim() : null;
  const receipt = body?.receipt ?? body?.receiptData ?? body?.transactionReceipt ?? null;
  const deferPublicationConsume = Boolean(body?.deferPublicationConsume);
  const publicationIntent = String(body?.publicationIntent ?? '').trim().slice(0, 32);
  const targetOfferIdRaw = Number(body?.targetOfferId);
  const targetOfferId = Number.isFinite(targetOfferIdRaw) && targetOfferIdRaw > 0 ? targetOfferIdRaw : null;

  if (!productId) {
    return NextResponse.json({ success: false, message: 'Brak productId' }, { status: 400 });
  }
  if (!isSupportedIapProductId(productId)) {
    return NextResponse.json({ success: false, message: 'Nieobsługiwany productId IAP' }, { status: 400 });
  }

  const isPlus = isPakietPlusProductId(productId);
  const isInvestorPro = isInvestorProProductId(productId);

  await ensureMobileIapTables();

  let subscriptionTransferred = false;
  let subscriptionOwnerKey: string | null = null;

  /** Jedna subskrypcja Apple = jedno konto EstateOS naraz; można przenieść na bieżące logowanie. */
  if (isInvestorPro) {
    subscriptionOwnerKey = originalTransactionId || transactionId;
    if (subscriptionOwnerKey) {
      const subscriptionOwners = await prisma.$queryRawUnsafe<Array<{ userId: number }>>(
        `
          SELECT userId
          FROM MobileIapPurchase
          WHERE productId = ?
            AND entitlementGrantedAt IS NOT NULL
            AND (
              originalTransactionId = ?
              OR (originalTransactionId IS NULL AND transactionId = ?)
            )
          ORDER BY entitlementGrantedAt ASC
          LIMIT 1
        `,
        productId,
        subscriptionOwnerKey,
        subscriptionOwnerKey,
      );
      const subscriptionOwnerUserId = subscriptionOwners[0]?.userId;
      const allowSubscriptionTransfer = Boolean(body?.allowSubscriptionTransfer);
      if (subscriptionOwnerUserId != null && subscriptionOwnerUserId !== userId) {
        if (!allowSubscriptionTransfer) {
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message:
                'Subskrypcja z Apple ID na tym telefonie jest przypisana do innego konta EstateOS. Możesz przenieść ją na to konto albo zalogować się na właściwe. Własna subskrypcja wymaga własnego Apple ID w App Store.',
              code: 'SUBSCRIPTION_LINKED_TO_OTHER_ACCOUNT',
              errorCode: 'SUBSCRIPTION_LINKED_TO_OTHER_ACCOUNT',
              shouldRetry: false,
            },
            { status: 409 },
          );
        }
        subscriptionTransferred = true;
        await prisma.user.update({
          where: { id: subscriptionOwnerUserId },
          data: {
            isPro: false,
            proExpiresAt: null,
            planType: 'NONE',
          },
        });
        await prisma.$executeRawUnsafe(
          `
            UPDATE MobileIapPurchase
            SET userId = ?
            WHERE productId = ?
              AND (
                originalTransactionId = ?
                OR (originalTransactionId IS NULL AND transactionId = ?)
              )
          `,
          userId,
          productId,
          subscriptionOwnerKey,
          subscriptionOwnerKey,
        );
      }
    }
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileIapPurchase
        (userId, pendingPurchaseId, platform, productId, transactionId, originalTransactionId, receipt, status, verifyStatus, targetOfferId, rawPayload)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', 'VERIFIED', ?, ?)
      ON DUPLICATE KEY UPDATE
        productId = VALUES(productId),
        transactionId = VALUES(transactionId),
        originalTransactionId = VALUES(originalTransactionId),
        receipt = VALUES(receipt),
        status = 'VERIFIED',
        verifyStatus = 'VERIFIED',
        targetOfferId = COALESCE(VALUES(targetOfferId), targetOfferId),
        rawPayload = VALUES(rawPayload)
    `,
    userId,
    pendingPurchaseId,
    String(body?.platform || 'ios').slice(0, 24),
    productId,
    transactionId,
    originalTransactionId,
    receipt ? String(receipt).slice(0, 10000) : null,
    targetOfferId,
    JSON.stringify({ ...(body ?? {}), publicationIntent, deferPublicationConsume })
  );

  const purchaseKeys = [pendingPurchaseId, transactionId, originalTransactionId].filter(Boolean);
  const subscriptionTxKeys = [pendingPurchaseId, transactionId].filter(Boolean);
  const alreadyGrantedPlus = purchaseKeys.length
    ? await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
        `
          SELECT id
          FROM MobileIapPurchase
          WHERE productId = ?
            AND entitlementGrantedAt IS NOT NULL
            AND (
              pendingPurchaseId IN (${purchaseKeys.map(() => '?').join(',')})
              OR transactionId IN (${purchaseKeys.map(() => '?').join(',')})
              OR originalTransactionId IN (${purchaseKeys.map(() => '?').join(',')})
            )
          LIMIT 1
        `,
        productId,
        ...purchaseKeys,
        ...purchaseKeys,
        ...purchaseKeys
      )
    : [];
  const investorProKeys = [...subscriptionTxKeys, originalTransactionId].filter(Boolean);
  const alreadyGrantedInvestorPro =
    isInvestorPro && investorProKeys.length
      ? await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          `
          SELECT id
          FROM MobileIapPurchase
          WHERE productId = ?
            AND entitlementGrantedAt IS NOT NULL
            AND (
              pendingPurchaseId IN (${investorProKeys.map(() => '?').join(',')})
              OR transactionId IN (${investorProKeys.map(() => '?').join(',')})
              OR originalTransactionId IN (${investorProKeys.map(() => '?').join(',')})
            )
          LIMIT 1
        `,
          productId,
          ...investorProKeys,
          ...investorProKeys,
          ...investorProKeys
        )
      : [];
  const alreadyGranted = isInvestorPro ? alreadyGrantedInvestorPro : alreadyGrantedPlus;

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { extraListings: true, plusExpiresAt: true, isPro: true, proExpiresAt: true },
  });
  if (!current) {
    return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
  }

  let plusExpiresAt = current.plusExpiresAt;
  let extraListings = current.extraListings;
  let proExpiresAt = current.proExpiresAt;
  let isPro = current.isPro;
  let entitlementGranted = false;
  let investorProGranted = false;

  const shouldGrantPlus = isPlus && !deferPublicationConsume && alreadyGranted.length === 0;
  const shouldGrantInvestorPro = isInvestorPro && alreadyGranted.length === 0;

  if (shouldGrantPlus) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: buildPakietPlusUserUpdate(),
      select: { extraListings: true, plusExpiresAt: true, isPro: true, proExpiresAt: true, planType: true },
    });
    extraListings = updatedUser.extraListings;
    plusExpiresAt = updatedUser.plusExpiresAt;
    isPro = updatedUser.isPro;
    proExpiresAt = updatedUser.proExpiresAt;
    entitlementGranted = true;
  }

  let proCreditsGranted = false;

  if (isInvestorPro) {
    const jws =
      body?.jwsRepresentation ?? body?.receipt ?? body?.receiptData ?? receipt ?? null;
    const subscriptionExpiresAt = extractSubscriptionExpiresAtFromJws(
      jws != null ? String(jws) : null,
    );

    /** Kredyty tylko przy pierwszym przypisaniu subskrypcji lub nowym okresie rozliczeniowym (nowy transactionId). */
    let grantMonthlyCredits = shouldGrantInvestorPro;
    if (!grantMonthlyCredits && transactionId) {
      const txAlreadyCredited = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
        `
          SELECT id
          FROM MobileIapPurchase
          WHERE productId = ?
            AND transactionId = ?
            AND entitlementGrantedAt IS NOT NULL
          LIMIT 1
        `,
        productId,
        transactionId,
      );
      grantMonthlyCredits = txAlreadyCredited.length === 0 && alreadyGranted.length > 0;
    }

    const slotsBefore = Number(current.extraListings ?? 0);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: buildInvestorProSubscriptionUserUpdate(
        subscriptionExpiresAt,
        current.proExpiresAt,
        current.plusExpiresAt,
        undefined,
        { grantMonthlyCredits },
      ),
      select: { extraListings: true, plusExpiresAt: true, isPro: true, proExpiresAt: true, planType: true },
    });

    extraListings = updatedUser.extraListings;
    plusExpiresAt = updatedUser.plusExpiresAt;
    isPro = updatedUser.isPro;
    proExpiresAt = updatedUser.proExpiresAt;
    proCreditsGranted =
      grantMonthlyCredits && Number(updatedUser.extraListings ?? 0) > slotsBefore;

    if (shouldGrantInvestorPro || updatedUser.isPro) {
      entitlementGranted = entitlementGranted || shouldGrantInvestorPro;
      if (updatedUser.isPro) investorProGranted = true;
    }
  }

  if (
    purchaseKeys.length &&
    (shouldGrantPlus || shouldGrantInvestorPro || (isInvestorPro && isPro))
  ) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE MobileIapPurchase
        SET
          userId = ?,
          entitlementGrantedAt = COALESCE(entitlementGrantedAt, NOW(3))
        WHERE productId = ?
          AND (
            pendingPurchaseId IN (${purchaseKeys.map(() => '?').join(',')})
            OR transactionId IN (${purchaseKeys.map(() => '?').join(',')})
            OR originalTransactionId IN (${purchaseKeys.map(() => '?').join(',')})
          )
      `,
      userId,
      productId,
      ...purchaseKeys,
      ...purchaseKeys,
      ...purchaseKeys
    );
  }

  return NextResponse.json({
    success: true,
    verified: true,
    status: 'VERIFIED',
    publicationConsumeDeferred: isPlus ? deferPublicationConsume : false,
    pendingPurchaseId,
    productId,
    transactionId,
    extraListings: isPlus && deferPublicationConsume ? 0 : extraListings,
    plusExpiresAt: plusExpiresAt ? new Date(plusExpiresAt).toISOString() : null,
    isPro: Boolean(isPro),
    proExpiresAt: proExpiresAt ? new Date(proExpiresAt).toISOString() : null,
    investorProGranted,
    proCreditsGranted,
    subscriptionTransferred,
    backendRegistered: true,
    entitlementGranted,
    entitlements: {
      plus: isPlus,
      plusExpiresAt: plusExpiresAt ? new Date(plusExpiresAt).toISOString() : null,
      investorPro: isInvestorPro,
      proExpiresAt: proExpiresAt ? new Date(proExpiresAt).toISOString() : null,
    },
  });
}
