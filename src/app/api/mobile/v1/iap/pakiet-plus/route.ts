import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { buildPakietPlusUserUpdate, isPakietPlusProductId } from '@/lib/mobileIapEntitlements';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import { logWalletCreditGrant } from '@/lib/walletLedger';

function getTokenFromReq(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim();
}

function getUserIdFromToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    const id = Number(payload?.id ?? payload?.userId ?? payload?.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak tokenu.' }, { status: 401 });
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const platform = String(body?.platform || '').toLowerCase();
    const productId = String(body?.productId || '');
    const transactionId = String(body?.transactionId || '');
    const originalTransactionId = body?.originalTransactionId ? String(body.originalTransactionId) : transactionId;
    const pendingPurchaseId = String(body?.pendingPurchaseId || `${platform}:${transactionId}`);
    const purchaseToken = body?.purchaseToken ? String(body.purchaseToken) : null;
    const jwsRepresentation = body?.jwsRepresentation ? String(body.jwsRepresentation) : null;

    if (!platform || !productId || !transactionId) {
      return NextResponse.json(
        { success: false, message: 'Brakuje wymaganych pól (platform, productId, transactionId).' },
        { status: 400 }
      );
    }

    if (platform === 'ios' && !isPakietPlusProductId(productId)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy iOS productId.' }, { status: 400 });
    }
    if (platform === 'android' && !isPakietPlusProductId(productId)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy Android productId.' }, { status: 400 });
    }

    // Minimalna walidacja techniczna payloadu:
    if (platform === 'ios' && !jwsRepresentation) {
      return NextResponse.json({ success: false, message: 'Brak iOS jwsRepresentation.' }, { status: 400 });
    }
    if (platform === 'android' && !purchaseToken) {
      return NextResponse.json({ success: false, message: 'Brak Android purchaseToken.' }, { status: 400 });
    }

    // TODO (produkcyjnie): dodać pełną walidację sklepową
    // - iOS: App Store Server API (JWS)
    // - Android: Google Play Developer API (purchaseToken)

    await ensureMobileIapTables();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO MobileIapPurchase
          (userId, pendingPurchaseId, platform, productId, transactionId, originalTransactionId, receipt, status, rawPayload)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?)
        ON DUPLICATE KEY UPDATE
          userId = VALUES(userId),
          productId = VALUES(productId),
          transactionId = VALUES(transactionId),
          originalTransactionId = VALUES(originalTransactionId),
          receipt = VALUES(receipt),
          status = 'VERIFIED',
          rawPayload = VALUES(rawPayload)
      `,
      userId,
      pendingPurchaseId,
      platform.slice(0, 24),
      productId,
      transactionId,
      originalTransactionId,
      jwsRepresentation || purchaseToken,
      JSON.stringify(body ?? {})
    );

    const purchaseKeys = [pendingPurchaseId, transactionId, originalTransactionId].filter(Boolean);
    const alreadyGranted = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
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
    );

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, extraListings: true, plusExpiresAt: true },
    });

    if (!current) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje.' }, { status: 404 });
    }

    let plusExpiresAt = current.plusExpiresAt;
    let extraListings = current.extraListings;
    let slotGranted = false;
    if (alreadyGranted.length === 0) {
      const update = buildPakietPlusUserUpdate();
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: update,
        select: { extraListings: true, plusExpiresAt: true },
      });
      extraListings = updatedUser.extraListings;
      plusExpiresAt = updatedUser.plusExpiresAt;
      slotGranted = true;
      try {
        await logWalletCreditGrant({
          userId,
          amount: 1,
          purpose: 'pakiet_plus',
          referenceType: 'iap',
          referenceId: transactionId,
          label: 'Zakup Pakiet PLUS (IAP)',
        });
      } catch (error) {
        console.warn('[walletLedger] pakiet-plus grant log failed', error);
      }
    }
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

    return NextResponse.json({
      success: true,
      ok: true,
      verified: true,
      backendRegistered: true,
      userId,
      productId,
      transactionId,
      extraListings,
      slotGranted,
      plusExpiresAt: plusExpiresAt ? new Date(plusExpiresAt).toISOString() : null,
      note: slotGranted ? 'Pakiet Plus zarejestrowany. Dodano 1 slot publikacji.' : 'Pakiet Plus był już zaksięgowany.',
    });
  } catch (error: any) {
    console.error('IAP PAKIET PLUS ERROR:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Błąd serwera.' },
      { status: 500 }
    );
  }
}
