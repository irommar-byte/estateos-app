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
import { sendNotification } from '@/lib/core/notification.core';
import { sendAgencyClientBusinessCard } from '@/lib/agencyClientBusinessCard';
import { normalizePrepItemIds, prepItemLabels } from '@/lib/crm/clientJourney';

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
      activities: {
        where: { kind: 'ACQUISITION_MEETING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { metadata: true },
      },
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
        ? {
            sellerCity: body.sellerCity ? String(body.sellerCity).trim() : null,
            sellerDistrict: body.sellerDistrict ? String(body.sellerDistrict).trim() : null,
            sellerPrice:
              body.sellerPrice != null && Number.isFinite(Number(body.sellerPrice))
                ? Number(body.sellerPrice)
                : null,
            sellerDescription: (() => {
              const listingUrl = body.listingUrl ? String(body.listingUrl).trim() : '';
              const desc = body.sellerDescription ? String(body.sellerDescription).trim() : '';
              return listingUrl || desc || null;
            })(),
          }
        : {}),
      ...(body.buyerFilters
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

  if (client.buyerPreference) {
    await refreshAgencyClientMatches(client.id);
  }

  const meeting = body.acquisitionMeeting;
  const prepItems = normalizePrepItemIds(body.prepItems ?? meeting?.prepItems);
  const prepLabels = prepItemLabels(prepItems);
  let meetingPayload: { startsAt: Date; location: string; notes: string } | null = null;
  if (
    type === 'SELLER' &&
    meeting &&
    typeof meeting === 'object' &&
    typeof meeting.startsAt === 'string'
  ) {
    const startsAt = new Date(meeting.startsAt);
    if (!Number.isNaN(startsAt.getTime())) {
      const location = meeting.location ? String(meeting.location).trim() : '';
      const notes = meeting.notes ? String(meeting.notes).trim() : '';
      meetingPayload = { startsAt, location, notes };
      await prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId,
          kind: 'ACQUISITION_MEETING',
          title: `Pozyskanie · ${firstName} ${lastName}`,
          body: [location, notes].filter(Boolean).join(' · ') || 'Spotkanie pozyskania',
          metadata: {
            startsAt: startsAt.toISOString(),
            location: location || null,
            notes: notes || null,
            listingUrl: body.listingUrl ? String(body.listingUrl).trim() : null,
            prepItems,
            proposedBy: 'agent',
            status: 'confirmed',
          },
        },
      });

      await sendNotification({
        userId: agencyUserId,
        type: 'CRM_EVENT',
        title: 'Spotkanie pozyskania',
        body: `${firstName} ${lastName} · ${startsAt.toLocaleString('pl-PL')}`,
        data: { clientId: client.id, href: `/moje-konto/crm?tab=klienci&clientId=${client.id}` },
        idempotencyKey: `acq-meet-${client.id}-${startsAt.toISOString()}`,
      }).catch(() => {});
    }
  }

  if (emailRaw) {
    await sendAgencyClientBusinessCard({
      clientId: client.id,
      agencyUserId,
      customMessage: meetingPayload
        ? 'Potwierdzam nasze spotkanie i przesyłam wizytówkę. W panelu klienta możesz napisać do mnie, potwierdzić termin albo zaproponować inną godzinę.'
        : undefined,
      meeting: meetingPayload
        ? {
            startsAt: meetingPayload.startsAt,
            location: meetingPayload.location || null,
            notes: meetingPayload.notes || null,
          }
        : undefined,
      prepLabels,
    }).catch(() => {});
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
