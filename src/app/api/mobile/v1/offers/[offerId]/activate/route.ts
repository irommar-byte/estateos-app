export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { getPublicationQuote, stageOfferPublicationForReview } from '@/lib/offerPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';
import {
  assertContactVerified,
  contactVerificationJson,
  loadUserForContactVerification,
  PUBLISH_CONTACT_REQUIREMENTS,
} from '@/lib/contactVerification';

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
    const publisher = await loadUserForContactVerification(userId);
    const publishGate = assertContactVerified(publisher, PUBLISH_CONTACT_REQUIREMENTS);
    if (!publishGate.ok) return contactVerificationJson(publishGate);

    const body = await req.json().catch(() => ({} as any));
    const quote = await getPublicationQuote({ userId, offerId, action: 'ACTIVATE' });
    if (quote.reason === 'ALREADY_ACTIVE') {
      return NextResponse.json({
        success: true,
        offerId,
        publication: { status: 'ACTIVE', kind: null, endReason: null },
      });
    }

    const pub = body?.publication;
    const txId = String(body?.iapTransactionId ?? pub?.iapTransactionId ?? '').trim();
    const bypassPaymentRequirement =
      pub?.kind === 'FREE_FIRST' ||
      Boolean(pub?.bonusCouponId) ||
      pub?.kind === 'PLUS_CREDIT' ||
      pub?.consumePlusPublication === true;

    if (quote.requiresPayment && !txId && !bypassPaymentRequirement) {
      return NextResponse.json(
        {
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Publikacja tego ogłoszenia na 30 dni wymaga Pakiet Plus.',
          quote,
        },
        { status: 422 }
      );
    }
    const activationKind =
      pub?.kind === 'PLUS_PAID' || (txId && pub?.kind !== 'FREE_FIRST' && pub?.kind !== 'PLUS_CREDIT')
        ? 'PLUS_PAID'
        : pub?.kind === 'PLUS_CREDIT' || pub?.consumePlusPublication === true
          ? 'PLUS_CREDIT'
          : pub?.kind === 'FREE_FIRST' || pub?.bonusCouponId
            ? 'FREE_FIRST'
            : txId
              ? 'PLUS_PAID'
              : 'PLUS_CREDIT';

    const bonusCouponId = pub?.bonusCouponId ? String(pub.bonusCouponId).trim() : '';

    const staged = await stageOfferPublicationForReview({
      userId,
      offerId,
      kind: activationKind,
      bonusCouponId: bonusCouponId || null,
      iapTransactionId: activationKind === 'PLUS_PAID' ? txId : null,
      iapProductId: quote.productId,
    });

    if (bonusCouponId && activationKind === 'FREE_FIRST') {
      await markProfilePromoCardUsed(userId, bonusCouponId);
    }

    return NextResponse.json({
      success: true,
      offerId,
      awaitingModeration: true,
      publication: {
        status: staged.status,
        kind: staged.kind,
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
    if (message === 'NO_PLUS_CREDIT_AVAILABLE') {
      return NextResponse.json(
        {
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Brak dostępnego kredytu Pakietu Plus. Kup nowy pakiet i spróbuj ponownie.',
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

