export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enrichOfferWithLegalAliases } from '@/lib/mobileOfferLegalPayload';
import { MOBILE_OFFER_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { OfferValidationError, updateOffer } from '@/lib/services/offer.service';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import { endOfferPublication } from '@/lib/offerPublication';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as { id?: number; userId?: number; sub?: number };
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function GET(_req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  try {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: MOBILE_OFFER_PRISMA_SELECT as any,
    });

    if (!offer) {
      return NextResponse.json({ success: false, message: 'Nie znaleziono oferty' }, { status: 404 });
    }

    const legalOverrides = await legalStatusOverridesForOffers(prisma, [offerId]);
    const legalOffer = applyLegalStatusOverride(offer as any, legalOverrides);

    return NextResponse.json({ success: true, offer: enrichOfferWithLegalAliases(legalOffer) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        {
          success: false,
          message: getOfferSchemaCompatibilityMessage(),
          code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  const authUserId = parseUserIdFromBearer(req);
  if (!authUserId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const offer = await updateOffer({
      ...body,
      id: offerId,
      userId: authUserId,
    });
    const requestedStatus = String(body?.newStatus ?? body?.status ?? '').toUpperCase();
    if (requestedStatus === 'ARCHIVED') {
      await endOfferPublication({
        offerId,
        endReason: 'MANUAL_ARCHIVE',
        offerStatus: 'ARCHIVED',
      });
    }
    const legalOffer = enrichOfferWithLegalAliases(offer);
    return NextResponse.json(
      { success: true, offer: legalOffer },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: unknown) {
    if (e instanceof OfferValidationError) {
      return NextResponse.json(
        { success: false, message: e.message, code: 'OFFER_VALIDATION' },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    const status = message.includes('uprawnień') ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  return PATCH(req, context);
}
