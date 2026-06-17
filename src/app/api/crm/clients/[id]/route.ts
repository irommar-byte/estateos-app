import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAgencyClientForUser, requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  buyerPrefToWebRadarFilters,
  shapeClientListItem,
  webRadarFiltersToBuyerPrefCreate,
} from '@/lib/agencyClientShape';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import { notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const client = await getAgencyClientForUser(clientId, agencyUserId);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    client: {
      ...shapeClientListItem(client),
      notes: client.notes,
      sellerTransactionType: client.sellerTransactionType,
      sellerPropertyType: client.sellerPropertyType,
      sellerCity: client.sellerCity,
      sellerDistrict: client.sellerDistrict,
      sellerPrice: client.sellerPrice,
      sellerArea: client.sellerArea,
      sellerRooms: client.sellerRooms,
      sellerDescription: client.sellerDescription,
      linkedOfferId: client.linkedOfferId,
      buyerFilters:
        client.type === 'BUYER'
          ? buyerPrefToWebRadarFilters(client.buyerPreference)
          : null,
      matches: client.matches.map((m) => ({
        id: m.id,
        score: m.score,
        notifiedAt: m.notifiedAt?.toISOString() ?? null,
        sharedAt: m.sharedAt?.toISOString() ?? null,
        offer: {
          id: m.offer.id,
          title: m.offer.title,
          price: m.offer.price,
          pricePln: m.offer.pricePln,
          priceCurrency: m.offer.priceCurrency,
          city: m.offer.city,
          district: m.offer.district,
          area: m.offer.area,
          rooms: m.offer.rooms,
          transactionType: m.offer.transactionType,
          imageUrl: resolveOfferPrimaryImage(m.offer),
        },
      })),
      activities: client.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        offerId: a.offerId,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const existing = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    include: { buyerPreference: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  const body = await req.json();

  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      firstName: body.firstName != null ? String(body.firstName).trim() : undefined,
      lastName: body.lastName != null ? String(body.lastName).trim() : undefined,
      email: body.email !== undefined ? (body.email ? String(body.email).trim() : null) : undefined,
      phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : undefined,
      notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined,
      ...(existing.type === 'SELLER'
        ? {
            sellerTransactionType: body.sellerTransactionType,
            sellerPropertyType: body.sellerPropertyType,
            sellerCity: body.sellerCity,
            sellerDistrict: body.sellerDistrict,
            sellerPrice: body.sellerPrice != null ? Number(body.sellerPrice) : undefined,
            sellerArea: body.sellerArea != null ? Number(body.sellerArea) : undefined,
            sellerRooms: body.sellerRooms != null ? Number(body.sellerRooms) : undefined,
            sellerDescription: body.sellerDescription,
          }
        : {}),
    },
  });

  if (existing.type === 'BUYER' && body.buyerFilters) {
    const prefData = webRadarFiltersToBuyerPrefCreate(body.buyerFilters as WebRadarFilters);
    if (existing.buyerPreference) {
      await prisma.agencyClientBuyerPreference.update({
        where: { clientId },
        data: prefData,
      });
    } else {
      await prisma.agencyClientBuyerPreference.create({
        data: { clientId, ...prefData },
      });
    }
    await refreshAgencyClientMatches(clientId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const updated = await prisma.agencyClient.updateMany({
    where: { id: clientId, agencyUserId },
    data: { status: 'ARCHIVED' },
  });
  if (!updated.count) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const body = await req.json();
  const action = String(body.action || '');

  if (action === 'refresh_matches') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, type: 'BUYER' },
    });
    if (!client) {
      return NextResponse.json({ error: 'Klient kupujący nie istnieje.' }, { status: 404 });
    }
    const result = await refreshAgencyClientMatches(clientId);
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'notify_offer') {
    const offerId = Number(body.offerId);
    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
    }
    const result = await notifyAgencyClientAboutOffer({
      clientId,
      offerId,
      agencyUserId,
      channel: body.channel === 'email' ? 'email' : 'manual',
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
