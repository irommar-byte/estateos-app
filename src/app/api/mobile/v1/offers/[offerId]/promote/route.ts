export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { promoteOfferListing } from '@/lib/listingPromotion';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as any;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function POST(req: Request, context: RouteContext) {
  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const credits = Number((body as { credits?: unknown })?.credits);
    const result = await promoteOfferListing({
      userId,
      offerId,
      ...(Number.isFinite(credits) ? { credits } : {}),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się wyróżnić ogłoszenia.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
