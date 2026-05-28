import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { shapeOfferForCrmCard } from '@/lib/favorites/offerShape';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  try {
    const rows = await prisma.favoriteOffer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        offerId: true,
        createdAt: true,
        offer: {
          select: {
            id: true,
            title: true,
            price: true,
            priceCurrency: true,
            area: true,
            rooms: true,
            city: true,
            district: true,
            street: true,
            images: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            transactionType: true,
            userId: true,
          },
        },
      },
    });

    const rawOffers = rows.map((row) => row.offer).filter(Boolean);
    const offerIds = rawOffers
      .map((o) => Number(o.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const pubIds = offerIds.length ? await activePublicationOfferIds(offerIds) : new Set<number>();

    const offers = rawOffers.map((offer) =>
      shapeOfferForCrmCard({
        ...offer,
        imageUrl: resolveOfferPrimaryImage(offer),
        marketVisible: canShowOfferOnPublicMarket(offer, pubIds),
      } as Record<string, unknown>),
    );

    return NextResponse.json({ success: true, offerIds, offers });
  } catch (error) {
    console.error('FAVORITES GET:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
