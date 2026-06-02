export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import {
  buildInvestorProIapUserUpdate,
  buildPakietPlusUserUpdate,
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
  const alreadyGranted = purchaseKeys.length
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
      select: { extraListings: true, plusExpiresAt: true, isPro: true, proExpiresAt: true },
    });
    extraListings = updatedUser.extraListings;
    plusExpiresAt = updatedUser.plusExpiresAt;
    isPro = updatedUser.isPro;
    proExpiresAt = updatedUser.proExpiresAt;
    entitlementGranted = true;
  }

  if (shouldGrantInvestorPro) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: buildInvestorProIapUserUpdate(current.proExpiresAt),
      select: { extraListings: true, plusExpiresAt: true, isPro: true, proExpiresAt: true },
    });
    extraListings = updatedUser.extraListings;
    plusExpiresAt = updatedUser.plusExpiresAt;
    isPro = updatedUser.isPro;
    proExpiresAt = updatedUser.proExpiresAt;
    entitlementGranted = true;
    investorProGranted = true;
  }

  if (purchaseKeys.length && (shouldGrantPlus || shouldGrantInvestorPro)) {
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
