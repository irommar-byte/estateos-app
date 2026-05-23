export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { getCreatePublicationQuote, getPublicationQuote } from '@/lib/offerPublication';

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as any;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function GET(req: Request) {
  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const offerIdRaw = Number(searchParams.get('offerId'));
    const offerId = Number.isFinite(offerIdRaw) && offerIdRaw > 0 ? offerIdRaw : null;

    if (!offerId) {
      const quote = await getCreatePublicationQuote({ userId });
      return NextResponse.json(quote);
    }

    const quote = await getPublicationQuote({
      userId,
      offerId,
      action: 'ACTIVATE',
    });
    return NextResponse.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    const status = message === 'OFFER_NOT_FOUND_OR_FORBIDDEN' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

