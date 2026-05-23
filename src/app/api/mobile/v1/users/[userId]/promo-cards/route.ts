export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { mobileBearerUserId } from '@/lib/mobileApiAuth';
import { prisma } from '@/lib/prisma';
import { listProfilePromoCardsForUser } from '@/lib/profilePromoCards';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const authUserId = mobileBearerUserId(req);
  if (!authUserId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const { userId: userIdParam } = await context.params;
  const targetUserId = Number(userIdParam);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
  }

  if (authUserId !== targetUserId) {
    const actor = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { role: true },
    });
    if (actor?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 });
    }
  }

  const cards = await listProfilePromoCardsForUser(targetUserId);
  return NextResponse.json({ success: true, cards });
}
