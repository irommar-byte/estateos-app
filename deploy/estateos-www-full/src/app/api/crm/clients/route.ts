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
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';
import { seedAcquisitionForm } from '@/lib/crm/acquisitionOffer';
import { findDuplicateAgencyClients, findPeselCollision } from '@/lib/crm/clientDuplicate';
import { hashPesel, normalizePeselDigits } from '@/lib/crm/peselHash';
import { archiveAgencyClients } from '@/lib/crm/clientArchive';
import {
  apartmentNumberForType,
  parseSellerPropertyType,
} from '@/lib/crm/sellerProperty';

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
  const peselDigits = normalizePeselDigits(peselRaw);
  const peselHash = hashPesel(peselDigits);
  const peselCollision = await findPeselCollision({ pesel: peselDigits });

  if (body.forceCreate !== true) {
    const duplicates = await findDuplicateAgencyClients({
      agencyUserId,
      email: emailRaw,
      phone: phoneRaw || body.phone,
    });
    if (duplicates.length) {
      return NextResponse.json(
        {
          error: 'Klient o tym e-mailu lub telefonie już jest w CRM.',
          code: 'DUPLICATE_CLIENT',
          matches: duplicates,
          peselCollision: peselCollision.exists ? { exists: true, message: peselCollision.message } : undefined,
        },
        { status: 409 },
      );
    }
  }

  const linkedUserId = await ensureAgencyClientLinkedUser({
    email: emailRaw,
    phone: phoneRaw,
    name: `${firstName} ${lastName}`.trim(),
  });

  const client = await prisma.agencyClient.create({
    data: {
      agencyUserId,
      type: type as 'BUYER' | 'SELLER',
      firstName,
      lastName,
      email: emailRaw,
      phone: phoneRaw,
      pesel: peselDigits,
      peselHash,
      linkedUserId,
      emailVerifiedAt: body.emailVerified === true ? new Date() : null,
      phoneVerifiedAt: body.phoneVerified === true ? new Date() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      portalToken: generatePortalToken(),
      ...(type === 'SELLER'
        ? {
            sellerCity: body.sellerCity ? String(body.sellerCity).trim() : null,
            sellerDistrict: body.sellerDistrict ? String(body.sellerDistrict).trim() : null,
            sellerPropertyType: parseSellerPropertyType(body.sellerPropertyType),
            sellerPrice:
              body.sellerPrice != null && Number.isFinite(Number(body.sellerPrice))
                ? Number(body.sellerPrice)
                : null,
            sellerArea:
              body.sellerArea != null && Number.isFinite(Number(body.sellerArea))
                ? Number(body.sellerArea)
                : null,
            sellerRooms:
              body.sellerRooms != null && Number.isFinite(Number(body.sellerRooms))
                ? Math.round(Number(body.sellerRooms))
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
        data: crmAgentPushData(client.id, { notificationType: 'crm_client_schedule' }),
        idempotencyKey: `acq-meet-${client.id}-${startsAt.toISOString()}`,
      }).catch(() => {});
    }
  }

  if (type === 'SELLER') {
    const lat = Number(body.lat ?? meeting?.lat);
    const lng = Number(body.lng ?? meeting?.lng);
    await prisma.agencyClientAcquisition.create({
      data: {
        clientId: client.id,
        agencyUserId,
        status: 'PREPARATION',
        currentStep: 1,
        formData: seedAcquisitionForm({
          client,
          meeting: meetingPayload
            ? {
                startsAt: meetingPayload.startsAt.toISOString(),
                location: meetingPayload.location,
                notes: meetingPayload.notes,
              }
            : null,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          prepItems,
          sellerPropertyType: client.sellerPropertyType,
          apartmentNumber: apartmentNumberForType(client.sellerPropertyType, body.apartmentNumber),
        }),
      },
    }).catch(() => {});
  }

  if (emailRaw) {
    await sendAgencyClientBusinessCard({
      clientId: client.id,
      agencyUserId,
      customMessage: meetingPayload
        ? 'Umówiliśmy się na spotkanie. Termin jest ustalony — szczegóły i listę przygotowań znajdziesz poniżej.'
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
    peselWarning: peselCollision.exists
      ? { exists: true, message: peselCollision.message }
      : null,
  });
}

/** Bulk soft-archive for the current agent. */
export async function PATCH(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (String(body.action || '') !== 'archive_bulk') {
    return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
  }
  const clientIds = Array.isArray(body.clientIds) ? body.clientIds.map((id: unknown) => Number(id)) : [];
  const result = await archiveAgencyClients({ agencyUserId, clientIds });
  return NextResponse.json({
    success: true,
    ...result,
    message: result.archivedIds.length
      ? `Przeniesiono ${result.archivedIds.length} klientów do archiwum. Spotkania zostały wyczyszczone.`
      : 'Nie znaleziono aktywnych klientów do archiwizacji.',
  });
}
