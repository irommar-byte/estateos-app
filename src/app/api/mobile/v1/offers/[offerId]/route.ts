export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enrichOfferWithLegalAliases } from '@/lib/mobileOfferLegalPayload';
import { MOBILE_OFFER_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

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
