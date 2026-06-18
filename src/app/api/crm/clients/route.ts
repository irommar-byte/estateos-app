import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { shapeClientListItem, webRadarFiltersToBuyerPrefCreate } from '@/lib/agencyClientShape';
import { refreshAgencyClientMatches, buildAgencyClientReport } from '@/lib/agencyClientMatching';
import {
  assertAgencyCanCreateForClient,
  linkOfferToAgencyClient,
} from '@/lib/offerAgencyManagement';
import { generatePortalToken } from '@/lib/agencyClientNotify';
import { parsePesel } from '@/lib/pesel';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';

function normalizePhone(raw: unknown): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;
  const normalized = input.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+') || normalized.length < 8) return null;
  return normalized;
}

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
      linkedUser: { select: { id: true, email: true, lastLoginAt: true } },
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

  const emailRaw = body.email ? String(body.email).trim().toLowerCase() : null;
  const phoneRaw = normalizePhone(body.phone);
  if (body.phone && !phoneRaw) {
    return NextResponse.json({ error: 'Telefon musi być w formacie międzynarodowym, np. +48501234567.' }, { status: 400 });
  }
  const peselRaw = body.pesel ? String(body.pesel).trim() : null;
  if (peselRaw && !parsePesel(peselRaw)) {
    return NextResponse.json({ error: 'Nieprawidłowy PESEL.' }, { status: 400 });
  }

  let linkedUserId: number | null = null;
  if (emailRaw) {
    const existingUser = await prisma.user.findUnique({ where: { email: emailRaw }, select: { id: true } });
    if (existingUser) {
      linkedUserId = existingUser.id;
    } else {
      const createdUser = await prisma.user.create({
        data: {
          email: emailRaw,
          phone: phoneRaw,
          name: `${firstName} ${lastName}`.trim(),
          role: 'USER',
        },
        select: { id: true },
      });
      linkedUserId = createdUser.id;
    }
  }

  const client = await prisma.agencyClient.create({
    data: {
      agencyUserId,
      type: type as 'BUYER' | 'SELLER',
      firstName,
      lastName,
      email: emailRaw,
      phone: phoneRaw,
      pesel: peselRaw ? peselRaw.replace(/\D/g, '') : null,
      linkedUserId,
      emailVerifiedAt: body.emailVerified === true ? new Date() : null,
      phoneVerifiedAt: body.phoneVerified === true ? new Date() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      portalToken: generatePortalToken(),
      ...(type === 'SELLER'
        ? {}
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
      linkedUser: { select: { id: true, email: true, lastLoginAt: true } },
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
