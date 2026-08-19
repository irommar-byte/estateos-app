import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAgencyClientForUser, requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  buyerPrefToWebRadarFilters,
  shapeClientListItem,
  webRadarFiltersToBuyerPrefCreate,
} from '@/lib/agencyClientShape';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import {
  notifyAgencyClientAboutOffer,
  notifyAgencyClientAboutOffers,
  buildAgencyClientEmailPreview,
  buildPortalUrl,
} from '@/lib/agencyClientNotify';
import { sendAgencyClientBusinessCard } from '@/lib/agencyClientBusinessCard';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { sendSMS } from '@/lib/sms';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { linkOfferToAgencyClient } from '@/lib/offerAgencyManagement';
import { parsePesel } from '@/lib/pesel';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { sendNotification } from '@/lib/core/notification.core';
import {
  JOURNEY_ACTIVITY,
  buildJourneyStages,
  parseStartsAtInput,
  prepItemLabels,
  resolveMeeting,
  resolvePresentation,
} from '@/lib/crm/clientJourney';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { listPortalChat, sendPortalChat } from '@/lib/crm/portalChat';
import { createOfferFromAcquisitionRecord } from '@/lib/crm/acquisitionOffer';
import { emailClientSchedule } from '@/lib/crm/clientScheduleNotify';
import { fetchPublicLinkPreview } from '@/lib/crm/publicLinkPreview';
import { recordExternalPortalListing } from '@/lib/crm/sellerSaleUpdates';

type RouteCtx = { params: Promise<{ id: string }> };

function normalizePhone(raw: unknown): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;
  const normalized = input.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+') || normalized.length < 8) return null;
  return normalized;
}

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

  const meeting = resolveMeeting(client.activities);
  const presentation = resolvePresentation(client.activities);
  const messages = await listPortalChat(client.id, 'agent');
  const acquisition = await prisma.agencyClientAcquisition.findUnique({
    where: { clientId: client.id },
    select: { status: true, currentStep: true, signedAt: true },
  });
  const journey = buildJourneyStages({
    hasMeeting: Boolean(meeting),
    meetingConfirmed: meeting?.status === 'confirmed',
    acquisitionStarted: Boolean(acquisition && acquisition.currentStep > 1),
    signed: acquisition?.status === 'SIGNED' || Boolean(acquisition?.signedAt),
    hasOffer: Boolean(client.linkedOfferId),
    hasPresentation: Boolean(presentation),
    presentationConfirmed: presentation?.status === 'confirmed',
  });

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
      pesel: client.pesel,
      emailVerifiedAt: client.emailVerifiedAt?.toISOString() ?? null,
      phoneVerifiedAt: client.phoneVerifiedAt?.toISOString() ?? null,
      linkedOfferId: client.linkedOfferId,
      linkedUserId: client.linkedUserId,
      linkedUserEmail: client.linkedUser?.email ?? null,
      linkedUserLastLoginAt: client.linkedUser?.lastLoginAt?.toISOString() ?? null,
      portalToken: client.portalToken,
      portalUrl: client.portalToken ? buildPortalUrl(client.portalToken) : null,
      buyerFilters: client.buyerPreference
        ? buyerPrefToWebRadarFilters(client.buyerPreference)
        : null,
      matches: client.matches.map((m) => ({
        id: m.id,
        score: m.score,
        notifiedAt: m.notifiedAt?.toISOString() ?? null,
        sharedAt: m.sharedAt?.toISOString() ?? null,
        clientFeedback: m.clientFeedback,
        clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
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
      meeting,
      presentation,
      journey,
      messages,
      activities: client.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        offerId: a.offerId,
        createdAt: a.createdAt.toISOString(),
        metadata: a.metadata,
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
  const nextEmail = body.email !== undefined ? (body.email ? String(body.email).trim().toLowerCase() : null) : undefined;
  const nextPhone = body.phone !== undefined ? normalizePhone(body.phone) : undefined;
  if (body.phone !== undefined && body.phone && !nextPhone) {
    return NextResponse.json({ error: 'Telefon musi być w formacie międzynarodowym, np. +48501234567.' }, { status: 400 });
  }
  const nextPesel = body.pesel !== undefined ? (body.pesel ? String(body.pesel).trim() : null) : undefined;
  if (nextPesel && !parsePesel(nextPesel)) {
    return NextResponse.json({ error: 'Nieprawidłowy PESEL.' }, { status: 400 });
  }

  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      firstName: body.firstName != null ? String(body.firstName).trim() : undefined,
      lastName: body.lastName != null ? String(body.lastName).trim() : undefined,
      email: nextEmail,
      phone: nextPhone,
      pesel: nextPesel !== undefined ? (nextPesel ? nextPesel.replace(/\D/g, '') : null) : undefined,
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

  if (nextEmail !== undefined) {
    if (nextEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
      if (existingUser) {
        await prisma.agencyClient.update({
          where: { id: clientId },
          data: { linkedUserId: existingUser.id },
        });
      } else {
        const createdUser = await prisma.user.create({
          data: {
            email: nextEmail,
            phone: nextPhone ?? undefined,
            name: `${body.firstName ?? existing.firstName} ${body.lastName ?? existing.lastName}`.trim(),
            role: 'USER',
          },
          select: { id: true },
        });
        await prisma.agencyClient.update({
          where: { id: clientId },
          data: { linkedUserId: createdUser.id },
        });
      }
    } else {
      await prisma.agencyClient.update({
        where: { id: clientId },
        data: { linkedUserId: null },
      });
    }
  }

  if (body.buyerFilters || body.alsoSearching === true) {
    const prefData = webRadarFiltersToBuyerPrefCreate(
      (body.buyerFilters || {}) as WebRadarFilters,
    );
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
  } else if (body.alsoSearching === false && existing.buyerPreference) {
    await prisma.agencyClientMatch.deleteMany({ where: { clientId } });
    await prisma.agencyClientBuyerPreference.delete({ where: { clientId } });
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
      where: { id: clientId, agencyUserId },
      include: { buyerPreference: true },
    });
    if (!client || !client.buyerPreference) {
      return NextResponse.json({ error: 'Brak kryteriów wyszukiwania dla tego klienta.' }, { status: 404 });
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

  if (action === 'preview_offers') {
    const offerIds = Array.isArray(body.offerIds)
      ? body.offerIds.map(Number).filter(Number.isFinite)
      : [Number(body.offerId)].filter(Number.isFinite);
    if (!offerIds.length) {
      return NextResponse.json({ error: 'Wybierz co najmniej jedną ofertę.' }, { status: 400 });
    }
    const preview = await buildAgencyClientEmailPreview({
      clientId,
      offerIds,
      agencyUserId,
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, preview });
  }

  if (action === 'notify_offers') {
    const offerIds = Array.isArray(body.offerIds)
      ? body.offerIds.map(Number).filter(Number.isFinite)
      : [];
    if (!offerIds.length) {
      return NextResponse.json({ error: 'Wybierz co najmniej jedną ofertę.' }, { status: 400 });
    }
    const result = await notifyAgencyClientAboutOffers({
      clientId,
      offerIds,
      agencyUserId,
      channel: body.channel === 'email' ? 'email' : 'manual',
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'send_business_card') {
    try {
      const acts = await prisma.agencyClientActivity.findMany({
        where: {
          clientId,
          kind: {
            in: [
              JOURNEY_ACTIVITY.MEETING,
              JOURNEY_ACTIVITY.MEETING_CHANGE,
              JOURNEY_ACTIVITY.MEETING_CONFIRMED,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      const slot = resolveMeeting(acts);
      const result = await sendAgencyClientBusinessCard({
        clientId,
        agencyUserId,
        customMessage: typeof body.message === 'string' ? body.message : undefined,
        meeting: slot
          ? {
              startsAt: new Date(slot.startsAt),
              location: slot.location,
              notes: slot.notes,
            }
          : undefined,
        prepLabels: slot ? prepItemLabels(slot.prepItems) : undefined,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wysłać wizytówki.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === 'link_offer') {
    const offerId = Number(body.offerId);
    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
    }
    const result = await linkOfferToAgencyClient({ agencyUserId, clientId, offerId });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'create_offer_from_acquisition') {
    const result = await createOfferFromAcquisitionRecord({ agencyUserId, clientId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, offerId: result.offerId });
  }

  if (action === 'add_external_portal') {
    const url = String(body.url || '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Wklej link do ogłoszenia na innym portalu.' }, { status: 400 });
    }
    try {
      const preview = await fetchPublicLinkPreview(url);
      const recorded = await recordExternalPortalListing({
        clientId,
        agencyUserId,
        preview,
      });
      if (!recorded.ok) {
        return NextResponse.json({ error: recorded.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, preview, emailed: recorded.emailed });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać linku.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === 'send_email_code') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, firstName: true, email: true },
    });
    if (!client?.email) {
      return NextResponse.json({ error: 'Brak e-maila klienta.' }, { status: 400 });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { emailVerifyCode: code, emailVerifyExpiresAt: expires },
    });
    await sendTransactionalEmail({
      to: client.email,
      subject: 'Kod weryfikacji e-mail — EstateOS CRM',
      html: `<div style="font-family:Arial,sans-serif"><h2>Weryfikacja e-mail</h2><p>Twój kod: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Kod ważny 10 minut.</p></div>`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'verify_email_code') {
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Podaj kod e-mail.' }, { status: 400 });
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, emailVerifyCode: true, emailVerifyExpiresAt: true },
    });
    if (!client || client.emailVerifyCode !== code) {
      return NextResponse.json({ error: 'Nieprawidłowy kod.' }, { status: 400 });
    }
    if (client.emailVerifyExpiresAt && new Date() > client.emailVerifyExpiresAt) {
      return NextResponse.json({ error: 'Kod wygasł. Wyślij nowy.' }, { status: 400 });
    }
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { emailVerifiedAt: new Date(), emailVerifyCode: null, emailVerifyExpiresAt: null },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'send_sms_code') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, phone: true },
    });
    if (!client?.phone) {
      return NextResponse.json({ error: 'Brak telefonu klienta.' }, { status: 400 });
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { smsVerifyCode: code, smsVerifyExpiresAt: expires },
    });
    await sendSMS(client.phone, `Kod EstateOS CRM: ${code}`);
    return NextResponse.json({ success: true });
  }

  if (action === 'verify_sms_code') {
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Podaj kod SMS.' }, { status: 400 });
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, smsVerifyCode: true, smsVerifyExpiresAt: true },
    });
    if (!client || client.smsVerifyCode !== code) {
      return NextResponse.json({ error: 'Nieprawidłowy kod SMS.' }, { status: 400 });
    }
    if (client.smsVerifyExpiresAt && new Date() > client.smsVerifyExpiresAt) {
      return NextResponse.json({ error: 'Kod SMS wygasł. Wyślij nowy.' }, { status: 400 });
    }
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { phoneVerifiedAt: new Date(), smsVerifyCode: null, smsVerifyExpiresAt: null },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'list_portal_messages') {
    const messages = await listPortalChat(clientId, 'agent');
    return NextResponse.json({ success: true, messages });
  }

  if (action === 'send_portal_message') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, linkedUserId: true, firstName: true, lastName: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
    const result = await sendPortalChat({
      clientId,
      agencyUserId,
      linkedUserId: client.linkedUserId,
      from: 'agent',
      content: String(body.content || ''),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      clientName: `${client.firstName} ${client.lastName}`.trim(),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, message: result.message });
  }

  if (action === 'propose_presentation' || action === 'propose_meeting') {
    const startsAt = parseStartsAtInput(body.startsAt);
    if (!startsAt) {
      return NextResponse.json({ error: 'Wybierz termin i godzinę.' }, { status: 400 });
    }
    const isMeeting = action === 'propose_meeting';
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
    const location = body.location ? String(body.location).trim() : '';
    const notes = body.notes ? String(body.notes).trim() : '';
    await prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId,
        kind: isMeeting ? JOURNEY_ACTIVITY.MEETING : JOURNEY_ACTIVITY.PRESENTATION,
        title: isMeeting
          ? `Spotkanie · ${client.firstName} ${client.lastName}`
          : `Prezentacja · ${client.firstName} ${client.lastName}`,
        body: [startsAt.toLocaleString('pl-PL'), location, notes].filter(Boolean).join(' · '),
        metadata: {
          startsAt: startsAt.toISOString(),
          location: location || null,
          notes: notes || null,
          proposedBy: 'agent',
          status: isMeeting ? 'confirmed' : 'pending',
        },
      },
    });
    await sendNotification({
      userId: agencyUserId,
      type: 'CRM_EVENT',
      title: isMeeting ? 'Termin spotkania' : 'Propozycja prezentacji',
      body: `${client.firstName} ${client.lastName} · ${startsAt.toLocaleString('pl-PL')}`,
      data: crmAgentPushData(clientId, { notificationType: 'crm_client_schedule' }),
    }).catch(() => {});
    await emailClientSchedule({
      clientId,
      kind: isMeeting ? 'meeting' : 'presentation',
      mode: isMeeting ? 'confirmed' : 'proposed',
      startsAt,
      location: location || null,
      notes: notes || null,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'accept_schedule_change') {
    const kind = String(body.kind || '') === 'presentation' ? 'presentation' : 'meeting';
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      include: {
        activities: {
          where: {
            kind: {
              in: [
                JOURNEY_ACTIVITY.MEETING,
                JOURNEY_ACTIVITY.MEETING_CHANGE,
                JOURNEY_ACTIVITY.MEETING_CONFIRMED,
                JOURNEY_ACTIVITY.PRESENTATION,
                JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
                JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
              ],
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!client) {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
    const slot = kind === 'presentation' ? resolvePresentation(client.activities) : resolveMeeting(client.activities);
    if (!slot || slot.status !== 'pending') {
      return NextResponse.json({ error: 'Brak oczekującej propozycji zmiany.' }, { status: 400 });
    }
    await prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId,
        kind: kind === 'presentation' ? JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED : JOURNEY_ACTIVITY.MEETING_CONFIRMED,
        title: kind === 'presentation' ? 'Zaakceptowano nowy termin prezentacji' : 'Zaakceptowano nowy termin spotkania',
        body: new Date(slot.startsAt).toLocaleString('pl-PL'),
        metadata: {
          startsAt: slot.startsAt,
          location: slot.location,
          notes: slot.notes,
          prepItems: slot.prepItems,
          proposedBy: 'agent',
          status: 'confirmed',
        },
      },
    });
    await emailClientSchedule({
      clientId,
      kind,
      mode: 'confirmed',
      startsAt: new Date(slot.startsAt),
      location: slot.location,
      notes: slot.notes,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
