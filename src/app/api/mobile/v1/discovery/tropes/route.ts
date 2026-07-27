import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';

function id() {
  return `dt_${crypto.randomUUID()}`;
}

export async function GET(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const tropes = await prisma.discoveryTrope.findMany({
    where: { userId: auth.userId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  const offerIds = tropes.map((trope) => trope.offerId);
  const offers = offerIds.length
    ? await prisma.offer.findMany({
        where: { id: { in: offerIds } },
        select: {
          id: true,
          title: true,
          city: true,
          district: true,
          price: true,
          pricePln: true,
          priceCurrency: true,
          area: true,
          images: true,
          status: true,
          userId: true,
          user: { select: { id: true, name: true, image: true } },
        },
      })
    : [];
  const byId = new Map(
    offers.map((offer) => [
      offer.id,
      {
        id: offer.id,
        title: offer.title,
        city: offer.city,
        district: offer.district,
        price: offer.price,
        pricePln: offer.pricePln,
        priceCurrency: offer.priceCurrency,
        area: offer.area,
        images: offer.images,
        status: offer.status,
        userId: offer.userId,
        ownerName: offer.user?.name ?? null,
        ownerImage: offer.user?.image ?? null,
      },
    ]),
  );
  return NextResponse.json({
    items: tropes.map((trope) => ({ ...trope, offer: byId.get(trope.offerId) || null })),
  });
}

export async function POST(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const offerId = Number(body.offerId);
  const action = String(body.action || 'SAVE').toUpperCase();
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'offerId musi być > 0' }, { status: 400 });
  }
  if (!['SAVE', 'PRIORITIZE', 'UNPRIORITIZE', 'REMOVE', 'SERIOUS'].includes(action)) {
    return NextResponse.json({ error: 'Niepoprawna akcja tropu' }, { status: 400 });
  }
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true } });
  if (!offer) return NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 });
  if (action === 'REMOVE') {
    await prisma.discoveryTrope.deleteMany({ where: { userId: auth.userId, offerId } });
    return NextResponse.json({ success: true, removed: true });
  }
  const trope = await prisma.discoveryTrope.upsert({
    where: { userId_offerId: { userId: auth.userId, offerId } },
    create: {
      id: id(),
      userId: auth.userId,
      offerId,
      priority: action === 'PRIORITIZE' || action === 'SERIOUS',
      status: action === 'SERIOUS' ? 'SERIOUS' : 'SAVED',
    },
    update: {
      priority: action === 'PRIORITIZE' || action === 'SERIOUS',
      status: action === 'SERIOUS' ? 'SERIOUS' : 'SAVED',
    },
  });
  return NextResponse.json({ success: true, trope });
}

export async function PATCH(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const offerId = Number(body.offerId);
  const visitOutcome = body.visitOutcome == null ? null : String(body.visitOutcome).toUpperCase();
  if (!Number.isFinite(offerId) || offerId <= 0 || !['YES', 'NO', 'DIFFERENT'].includes(String(visitOutcome))) {
    return NextResponse.json({ error: 'Niepoprawny feedback wizyty' }, { status: 400 });
  }
  const trope = await prisma.discoveryTrope.upsert({
    where: { userId_offerId: { userId: auth.userId, offerId } },
    create: { id: id(), userId: auth.userId, offerId, visitOutcome, status: 'VISITED' },
    update: { visitOutcome, status: 'VISITED' },
  });
  return NextResponse.json({ success: true, trope });
}
