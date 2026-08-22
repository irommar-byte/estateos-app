import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const mode = new URL(req.url).searchParams.get('mode') || 'all';
  const caseId = Number(new URL(req.url).searchParams.get('caseId') || 0);

  const [offers, cases, ohEvents, auctions] = await Promise.all([
    prisma.offer.findMany({
      where: { userId: agencyUserId, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        pricePln: true,
        city: true,
        district: true,
        lat: true,
        lng: true,
        status: true,
      },
      take: 200,
    }),
    prisma.deskCase.findMany({
      where: {
        agencyUserId,
        ...(caseId ? { id: caseId } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sellerCity: true,
            buyerPreference: { select: { city: true, lat: true, lng: true } },
          },
        },
      },
      take: 150,
    }),
    prisma.openHouseEvent.findMany({
      where: { hostUserId: agencyUserId, status: { in: ['PUBLISHED', 'COMPLETED'] } },
      include: { offer: { select: { id: true, title: true, lat: true, lng: true, city: true } } },
      take: 30,
    }),
    prisma.auctionEvent.findMany({
      where: { hostUserId: agencyUserId, status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] } },
      include: { offer: { select: { id: true, title: true, lat: true, lng: true, city: true } } },
      take: 30,
    }),
  ]);

  let matchedOffers: Array<{
    id: number;
    title: string | null;
    pricePln: number | null;
    city: string | null;
    district: string | null;
    lat: number | null;
    lng: number | null;
    status: string;
  }> = [];
  if (caseId) {
    const buyCase = cases.find((c) => c.kind === 'BUY');
    if (buyCase) {
      const matches = await prisma.agencyClientMatch.findMany({
        where: { clientId: buyCase.clientId },
        orderBy: { score: 'desc' },
        take: 20,
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              pricePln: true,
              city: true,
              district: true,
              lat: true,
              lng: true,
              status: true,
            },
          },
        },
      });
      matchedOffers = matches.map((m) => m.offer);
    }
  }

  const clientPins = cases
    .map((c) => {
      const lat = c.client.buyerPreference?.lat;
      const lng = c.client.buyerPreference?.lng;
      const city = c.client.buyerPreference?.city || c.client.sellerCity;
      return {
        caseId: c.id,
        kind: c.kind,
        label: `${c.client.firstName} ${c.client.lastName}`,
        lat: lat ?? null,
        lng: lng ?? null,
        city,
        stage: c.pipelineStage,
      };
    })
    .filter((p) => p.lat != null && p.lng != null || p.city);

  const payload: Record<string, unknown> = {
    offers: mode === 'clients' ? [] : offers.filter((o) => o.lat != null && o.lng != null),
    clients: clientPins,
    openHouses: ohEvents.map((e) => ({
      id: e.id,
      offerId: e.offerId,
      title: e.title || e.offer?.title,
      lat: e.offer?.lat,
      lng: e.offer?.lng,
      city: e.offer?.city,
      status: e.status,
    })),
    auctions: auctions.map((a) => ({
      id: a.id,
      offerId: a.offerId,
      title: a.title || a.offer?.title,
      lat: a.offer?.lat,
      lng: a.offer?.lng,
      status: a.status,
      currentPrice: a.currentPrice,
    })),
    matchedOffers: matchedOffers.filter((o) => o.lat != null && o.lng != null),
  };

  return NextResponse.json({ success: true, ...payload });
}
