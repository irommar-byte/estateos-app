export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';

function plusExpiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

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

  if (!productId) {
    return NextResponse.json({ success: false, message: 'Brak productId' }, { status: 400 });
  }

  await ensureMobileIapTables();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileIapPurchase
        (userId, pendingPurchaseId, platform, productId, transactionId, originalTransactionId, receipt, status, rawPayload)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?)
      ON DUPLICATE KEY UPDATE
        productId = VALUES(productId),
        transactionId = VALUES(transactionId),
        originalTransactionId = VALUES(originalTransactionId),
        receipt = VALUES(receipt),
        status = 'VERIFIED',
        rawPayload = VALUES(rawPayload)
    `,
    userId,
    pendingPurchaseId,
    String(body?.platform || 'ios').slice(0, 24),
    productId,
    transactionId,
    originalTransactionId,
    receipt ? String(receipt).slice(0, 10000) : null,
    JSON.stringify(body ?? {})
  );

  const proExpiresAt = plusExpiry();
  await prisma.user.update({
    where: { id: userId },
    data: { isPro: true, planType: 'PRO' as any, proExpiresAt },
  });

  return NextResponse.json({
    success: true,
    status: 'VERIFIED',
    pendingPurchaseId,
    productId,
    entitlements: { plus: true, proExpiresAt: proExpiresAt.toISOString() },
  });
}
