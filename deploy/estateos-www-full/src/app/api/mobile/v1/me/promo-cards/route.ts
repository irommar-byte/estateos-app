export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { mobileBearerUserId } from '@/lib/mobileApiAuth';
import { ensureWelcomePromoCardForUser, listProfilePromoCardsForUser } from '@/lib/profilePromoCards';

export async function GET(req: Request) {
  const userId = mobileBearerUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  await ensureWelcomePromoCardForUser(userId);
  const cards = await listProfilePromoCardsForUser(userId);
  return NextResponse.json({ success: true, cards });
}
