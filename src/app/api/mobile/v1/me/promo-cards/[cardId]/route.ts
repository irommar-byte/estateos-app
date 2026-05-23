export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';

type RouteContext = { params: Promise<{ cardId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const userId = mobileBearerUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const { cardId } = await context.params;
  const id = String(cardId || '').trim();
  if (!id) {
    return NextResponse.json({ success: false, message: 'Brak cardId' }, { status: 400 });
  }

  const body = await readJson(req);
  if (body?.couponUsed !== true) {
    return NextResponse.json({ success: false, message: 'couponUsed: true wymagane' }, { status: 400 });
  }

  const ok = await markProfilePromoCardUsed(userId, id);
  if (!ok) {
    return NextResponse.json({ success: false, message: 'Kupon nie znaleziony' }, { status: 404 });
  }
  return NextResponse.json({ success: true, cardId: id, couponUsed: true });
}
