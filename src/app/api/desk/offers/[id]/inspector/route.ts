import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { fetchOfferPriceHistory, resolveEffectiveListPricePln } from '@/lib/offerPriceHistory';
import { findCarById } from '@/lib/carsStorage';

type Ctx = { params: Promise<{ id: string }> };

async function countViews(offerId: number) {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      offerId,
    )) as Array<{ total: bigint | number }>;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const id = Number((await ctx.params).id);
  const asset = new URL(req.url).searchParams.get('asset') || 'home';
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID.' }, { status: 400 });
  }

  if (asset === 'car') {
    const car = await findCarById(id);
    if (!car || car.userId !== agencyUserId) {
      return NextResponse.json({ error: 'Nie znaleziono ogłoszenia samochodu.' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      asset: 'car',
      car: {
        id: car.id,
        title: car.title,
        make: car.make,
        model: car.model,
        year: car.year,
        mileageKm: car.mileageKm,
        fuelType: car.fuelType,
        transmission: car.transmission,
        bodyType: car.bodyType,
        vin: car.vin,
        registrationNumber: car.registrationNumber,
        firstRegistrationDate: car.firstRegistrationDate,
        pricePln: car.pricePln,
        city: car.city,
        status: 'ACTIVE',
        cepik: {
          vin: car.vin,
          registrationNumber: car.registrationNumber,
          firstRegistrationDate: car.firstRegistrationDate,
          insuranceValidUntil: car.insuranceValidUntil,
        },
      },
    });
  }

  const offer = await prisma.offer.findFirst({
    where: { id, userId: agencyUserId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }

  const [history, views, matches, ohCount, deals, deskCase] = await Promise.all([
    fetchOfferPriceHistory(id),
    countViews(id),
    prisma.agencyClientMatch.count({ where: { offerId: id } }),
    prisma.openHouseReservation.count({ where: { slot: { event: { offerId: id } } } }).catch(() => 0),
    prisma.deal.findMany({
      where: { offerId: id },
      select: { id: true, status: true, buyer: { select: { name: true } } },
      take: 5,
    }),
    prisma.deskCase.findFirst({
      where: { linkedOfferId: id, agencyUserId, kind: 'SELL' },
      select: { id: true, pipelineStage: true, client: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const price = Number(offer.pricePln || offer.price || 0);
  const area = Number(offer.area || 0);
  const listPrice = resolveEffectiveListPricePln(offer as Record<string, unknown>);

  const sellerClient = await prisma.agencyClient.findFirst({
    where: { linkedOfferId: id, agencyUserId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });

  return NextResponse.json({
    success: true,
    asset: 'home',
    offer: {
      id: offer.id,
      title: offer.title,
      status: offer.status,
      pricePln: offer.pricePln,
      listPricePln: listPrice,
      pricePerM2: area > 0 ? Math.round(price / area) : null,
      city: offer.city,
      district: offer.district,
      street: offer.street,
      area: offer.area,
      rooms: offer.rooms,
      lat: offer.lat,
      lng: offer.lng,
      expiresAt: offer.expiresAt,
      agentCommissionPercent: offer.agentCommissionPercent,
    },
    metrics: { views, matches, openHouseGuests: ohCount, presentations: 0 },
    priceHistory: history.map((h) => ({
      at: h.recordedAt.toISOString(),
      pricePln: h.pricePln,
      changeType: h.changeType,
    })),
    seller: sellerClient,
    listingAgent: offer.user,
    deskCase,
    deals,
  });
}
