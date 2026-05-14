export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId } from '@/lib/mobileApiAuth';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';

type RouteContext = {
  params: Promise<{ pendingPurchaseId: string }> | { pendingPurchaseId: string };
};

export async function GET(req: Request, context: RouteContext) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  const params = await context.params;
  const pendingPurchaseId = String(params.pendingPurchaseId || '').trim();
  if (!pendingPurchaseId) {
    return NextResponse.json({ success: false, message: 'Brak pendingPurchaseId' }, { status: 400 });
  }

  await ensureMobileIapTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT pendingPurchaseId, productId, transactionId, status, createdAt, updatedAt
      FROM MobileIapPurchase
      WHERE userId = ? AND pendingPurchaseId = ?
      LIMIT 1
    `,
    userId,
    pendingPurchaseId
  );

  const purchase = rows[0] || null;
  return NextResponse.json({ success: true, purchase }, { headers: { 'Cache-Control': 'no-store' } });
}
