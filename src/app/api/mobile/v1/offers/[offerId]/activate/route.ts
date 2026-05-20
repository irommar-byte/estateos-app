export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { activateOfferPublication, getPublicationQuote } from '@/lib/offerPublication';

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
    const body = await req.json().catch(() => ({} as any));
    const quote = await getPublicationQuote({ userId, offerId, action: 'ACTIVATE' });
    if (quote.reason === 'ALREADY_ACTIVE') {
      return NextResponse.json({
        success: true,
        offerId,
        publication: { status: 'ACTIVE', kind: null, endReason: null },
      });
    }

    const txId = String(body?.iapTransactionId ?? '').trim();
    if (quote.requiresPayment && !txId) {
      return NextResponse.json(
        {
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Publikacja tego ogłoszenia na 30 dni wymaga Pakiet Plus.',
          quote,
        },
        { status: 422 }
      );
    }

    const activation = await activateOfferPublication({
      userId,
      offerId,
      kind: quote.allowedFreeFirst ? 'FREE_FIRST' : 'PLUS_PAID',
      iapTransactionId: quote.allowedFreeFirst ? null : txId,
      iapProductId: quote.productId,
    });

    return NextResponse.json({
      success: true,
      offerId,
      publication: {
        status: activation.status,
        kind: activation.kind,
        endsAt: activation.endsAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    if (message === 'IAP_TRANSACTION_NOT_AVAILABLE') {
      return NextResponse.json(
        {
          errorCode: 'IAP_TRANSACTION_NOT_AVAILABLE',
          message: 'Nie znaleziono niewykorzystanej transakcji IAP dla tej publikacji.',
        },
        { status: 409 }
      );
    }
    if (message === 'PUBLICATION_ALREADY_ACTIVE') {
      return NextResponse.json(
        {
          success: true,
          offerId,
          publication: { status: 'ACTIVE', kind: null, endReason: null },
        },
        { status: 200 }
      );
    }
    const status = message === 'OFFER_NOT_FOUND_OR_FORBIDDEN' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

