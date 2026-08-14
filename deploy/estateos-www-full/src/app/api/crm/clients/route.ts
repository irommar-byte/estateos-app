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
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { sendNotification } from '@/lib/core/notification.core';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';

function buildAcquisitionIcs(params: {
  title: string;
  startsAt: Date;
  location?: string | null;
  description?: string | null;
}): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const ends = new Date(params.startsAt.getTime() + 60 * 60 * 1000);
  const uid = `acq-${Date.now()}@estateos.pl`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EstateOS//CRM//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(params.startsAt)}`,
    `DTEND:${fmt(ends)}`,
    `SUMMARY:${params.title.replace(/\n/g, ' ')}`,
  ];
  if (params.location) lines.push(`LOCATION:${params.location.replace(/\n/g, ' ')}`);
  if (params.description) lines.push(`DESCRIPTION:${params.description.replace(/\n/g, '\\n')}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

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
        ? {
            sellerCity: body.sellerCity ? String(body.sellerCity).trim() : null,
            sellerPrice:
              body.sellerPrice != null && Number.isFinite(Number(body.sellerPrice))
                ? Number(body.sellerPrice)
                : null,
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

  const meeting = body.acquisitionMeeting;
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

      if (emailRaw) {
        const agent = await prisma.user.findUnique({
          where: { id: agencyUserId },
          select: { name: true, companyName: true, email: true, phone: true },
        });
        const agentName = resolveSellerPersonName(agent) || agent?.name || 'Twój agent';
        const agencyName = agent?.companyName?.trim() || 'EstateOS';
        const ics = buildAcquisitionIcs({
          title: `Pozyskanie nieruchomości · ${agencyName}`,
          startsAt,
          location,
          description: notes || `Spotkanie z agentem ${agentName}`,
        });
        await sendTransactionalEmail({
          to: emailRaw,
          subject: `Spotkanie pozyskania · ${agencyName}`,
          html: `<div style="font-family:-apple-system,sans-serif;padding:24px"><p>Witaj ${firstName},</p><p>Umówiliśmy wstępne spotkanie w sprawie nieruchomości.</p><p><strong>${startsAt.toLocaleString('pl-PL')}</strong>${location ? `<br/>${location}` : ''}</p><p>${notes || ''}</p><p>Pozdrawiam,<br/><strong>${agentName}</strong><br/>${agencyName}</p><p style="color:#6b7280;font-size:12px">W załączniku plik kalendarza (.ics).</p></div>`,
          attachments: [
            {
              filename: 'spotkanie-pozyskanie.ics',
              content: ics,
              contentType: 'text/calendar; charset=utf-8',
            },
          ],
        }).catch(() => {});
      }
    }
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
