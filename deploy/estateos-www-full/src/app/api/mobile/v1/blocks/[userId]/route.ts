export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId } from '@/lib/mobileApiAuth';
import { ensureMobileUgcTables } from '@/lib/mobileUgcTables';

type RouteContext = { params: Promise<{ userId: string }> | { userId: string } };

export async function DELETE(req: Request, context: RouteContext) {
  const userId = mobileBearerUserId(req);
  if (!userId) return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });

  const params = await context.params;
  const blockedUserId = Number(params.userId);
  if (!Number.isFinite(blockedUserId) || blockedUserId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy użytkownik' }, { status: 400 });
  }

  await ensureMobileUgcTables();
  await prisma.$executeRawUnsafe(
    `DELETE FROM MobileUserBlock WHERE blockerUserId = ? AND blockedUserId = ?`,
    userId,
    blockedUserId
  );
  return NextResponse.json({ success: true, blockedUserId }, { headers: { 'Cache-Control': 'no-store' } });
}
