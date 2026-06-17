import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { shapeClientListItem, webRadarFiltersToBuyerPrefCreate } from '@/lib/agencyClientShape';
import { refreshAgencyClientMatches, buildAgencyClientReport } from '@/lib/agencyClientMatching';
import {
  assertAgencyCanCreateForClient,
  linkOfferToAgencyClient,
} from '@/lib/offerAgencyManagement';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('report') === '1') {
    const report = await buildAgencyClientReport(agencyUserId);
    return NextResponse.json({ success: true, report });
  }

  const type = url.searchParams.get('type');
  const where: { agencyUserId: number; status: 'ACTIVE'; type?: 'BUYER' | 'SELLER' } = {
    agencyUserId,
    status: 'ACTIVE',
  };
  if (type === 'BUYER' || type === 'SELLER') where.type = type;

  const clients = await prisma.agencyClient.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      buyerPreference: true,
      matches: { orderBy: { score: 'desc' }, take: 1, select: { score: true } },
      _count: { select: { matches: true } },
    },
  });

  return NextResponse.json({
    success: true,
    clients: clients.map(shapeClientListItem),
  });
}

export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const body = await req.json();
  const type = String(body.type || '').toUpperCase();
  if (type !== 'BUYER' && type !== 'SELLER') {
    return NextResponse.json({ error: 'Wybierz typ klienta: kupujący lub sprzedający.' }, { status: 400 });
  }

  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Imię i nazwisko są wymagane.' }, { status: 400 });
  }

  const client = await prisma.agencyClient.create({
    data: {
      agencyUserId,
      type: type as 'BUYER' | 'SELLER',
      firstName,
      lastName,
      email: body.email ? String(body.email).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      ...(type === 'SELLER'
        ? {
            sellerTransactionType: body.sellerTransactionType || 'SELL',
            sellerPropertyType: body.sellerPropertyType || 'FLAT',
            sellerCity: body.sellerCity ? String(body.sellerCity).trim() : null,
            sellerDistrict: body.sellerDistrict ? String(body.sellerDistrict).trim() : null,
            sellerPrice: body.sellerPrice ? Number(body.sellerPrice) : null,
            sellerArea: body.sellerArea ? Number(body.sellerArea) : null,
            sellerRooms: body.sellerRooms ? Number(body.sellerRooms) : null,
            sellerDescription: body.sellerDescription ? String(body.sellerDescription).trim() : null,
          }
        : {}),
      ...(type === 'BUYER' && body.buyerFilters
        ? {
            buyerPreference: {
              create: webRadarFiltersToBuyerPrefCreate(body.buyerFilters as WebRadarFilters),
            },
          }
        : {}),
    },
    include: { buyerPreference: true, _count: { select: { matches: true } }, matches: true },
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId,
      kind: 'CLIENT_CREATED',
      title: 'Dodano klienta',
      body: `${firstName} ${lastName} — ${type === 'BUYER' ? 'kupujący' : 'sprzedający'}.`,
    },
  });

  if (type === 'BUYER') {
    await refreshAgencyClientMatches(client.id);
  }

  const fresh = await prisma.agencyClient.findUnique({
    where: { id: client.id },
    include: {
      buyerPreference: true,
      matches: { orderBy: { score: 'desc' }, take: 1, select: { score: true } },
      _count: { select: { matches: true } },
    },
  });

  return NextResponse.json({
    success: true,
    client: fresh ? shapeClientListItem(fresh) : shapeClientListItem(client),
  });
}
