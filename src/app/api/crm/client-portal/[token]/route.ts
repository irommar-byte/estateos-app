import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { buyerPrefToWebRadarFilters } from '@/lib/agencyClientShape';
import { formatRadarSummary } from '@/lib/radarCalibrationWeb';
import { sendNotification } from '@/lib/core/notification.core';
import type { AcquisitionFormData } from '@/lib/acquisitionWorkflow';
import {
  CLIENT_PREP_ITEMS,
  JOURNEY_ACTIVITY,
  buildJourneyStages,
  parseStartsAtInput,
  prepItemLabels,
  resolveMeeting,
  resolvePresentation,
} from '@/lib/crm/clientJourney';
import { listPortalChat, sendPortalChat } from '@/lib/crm/portalChat';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { buildListingProgress, listingStatusLabel } from '@/lib/crm/acquisitionOffer';

type RouteCtx = { params: Promise<{ token: string }> };

function shapeSearchCriteria(pref: Parameters<typeof buyerPrefToWebRadarFilters>[0]) {
  if (!pref) return null;
  const filters = buyerPrefToWebRadarFilters(pref);
  const summary = formatRadarSummary(filters);
  const amenities = [
    filters.requireBalcony ? 'Balkon' : null,
    filters.requireGarden ? 'Ogródek' : null,
    filters.requireElevator ? 'Winda' : null,
    filters.requireParking ? 'Parking' : null,
    filters.requireFurnished ? 'Umeblowane' : null,
  ].filter(Boolean) as string[];
  return {
    ...summary,
    districts: filters.selectedDistricts,
    amenities,
    calibrationMode: filters.calibrationMode,
  };
}

async function loadJourneyActivities(clientId: number) {
  return prisma.agencyClientActivity.findMany({
    where: {
      clientId,
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
    select: { id: true, kind: true, title: true, body: true, createdAt: true, metadata: true },
  });
}

async function notifyAgent(params: {
  agencyUserId: number;
  clientId: number;
  title: string;
  body: string;
  type?: 'CRM_EVENT' | 'CHAT_MESSAGE';
}) {
  await sendNotification({
    userId: params.agencyUserId,
    type: params.type || 'CRM_EVENT',
    title: params.title,
    body: params.body,
    data: crmAgentPushData(params.clientId, {
      notificationType: params.type === 'CHAT_MESSAGE' ? 'crm_client_message' : 'crm_client',
    }),
  }).catch(() => {});
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    include: {
      agencyUser: {
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          email: true,
          image: true,
          agencyMembership: {
            select: {
              agentTitle: true,
              profilePhotoUrl: true,
              company: {
                select: {
                  name: true,
                  slug: true,
                  logoUrl: true,
                  officePhone: true,
                  officeEmail: true,
                  website: true,
                  address: true,
                },
              },
            },
          },
        },
      },
      buyerPreference: true,
      matches: {
        where: { notifiedAt: { not: null } },
        orderBy: { score: 'desc' },
        take: 50,
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              price: true,
              priceCurrency: true,
              city: true,
              district: true,
              area: true,
              rooms: true,
              transactionType: true,
              status: true,
              managementStatus: true,
              images: true,
            },
          },
        },
      },
      linkedOffer: {
        select: {
          id: true,
          title: true,
          price: true,
          priceCurrency: true,
          city: true,
          district: true,
          status: true,
          managementStatus: true,
          images: true,
        },
      },
      acquisition: {
        select: {
          id: true,
          status: true,
          currentStep: true,
          formData: true,
          agreementSnapshot: true,
          clientAcknowledgedAt: true,
          clientAcknowledgementName: true,
          signedAt: true,
          signerName: true,
          documentHash: true,
          copyEmailSentAt: true,
          updatedAt: true,
        },
      },
      activities: {
        where: {
          kind: {
            in: [
              'LISTING_LINKED',
              'CLIENT_NOTIFIED',
              'OFFER_SHARED',
              'ACQUISITION_MEETING',
              'ACQUISITION_SIGNED',
              JOURNEY_ACTIVITY.MEETING_CHANGE,
              JOURNEY_ACTIVITY.MEETING_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 16,
        select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }

  const agent = client.agencyUser;
  const member = agent.agencyMembership;
  const company = member?.company;

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Dedykowany Agent';
  const agentPhoto = member?.profilePhotoUrl || agent.image || null;
  const agentTitle = member?.agentTitle ? String(member.agentTitle) : 'Dedykowany Doradca d/s Nieruchomości';
  const agencyName = company?.name || agent.companyName || 'EstateOS Biuro Nieruchomości';
  const agencyLogo = company?.logoUrl || null;
  const agencySlug = company?.slug ? `/firma/${company.slug}` : null;
  const agencyWebsite = company?.website || null;
  const agencyPhone = company?.officePhone || agent.phone || null;
  const agencyEmail = company?.officeEmail || agent.email || null;
  const agencyAddress = company?.address || null;

  const searchCriteria = client.buyerPreference ? shapeSearchCriteria(client.buyerPreference) : null;
  const scheduleActs = await loadJourneyActivities(client.id);
  const meeting = resolveMeeting(scheduleActs);
  const presentation = resolvePresentation(scheduleActs);
  const stages = buildJourneyStages({
    hasMeeting: Boolean(meeting),
    meetingConfirmed: meeting?.status === 'confirmed',
    acquisitionStarted: Boolean(client.acquisition && client.acquisition.currentStep > 1),
    signed: client.acquisition?.status === 'SIGNED' || Boolean(client.acquisition?.signedAt),
    hasOffer: Boolean(client.linkedOffer),
    hasPresentation: Boolean(presentation),
    presentationConfirmed: presentation?.status === 'confirmed',
  });

  return NextResponse.json({
    success: true,
    portal: {
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      type: client.type,
      agencyName,
      agentName,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      agentPhoto,
      agentTitle,
      agencyLogo,
      agencySlug,
      agencyWebsite,
      agencyPhone,
      agencyEmail,
      agencyAddress,
      searchCriteria,
      canChat: true,
      meeting: meeting
        ? {
            ...meeting,
            prepLabels: prepItemLabels(meeting.prepItems),
            prepCatalog: CLIENT_PREP_ITEMS,
          }
        : null,
      presentation,
      journey: stages,
      matches: client.buyerPreference
        ? client.matches.map((m) => ({
            id: m.id,
            score: m.score,
            notifiedAt: m.notifiedAt?.toISOString() ?? null,
            clientFeedback: m.clientFeedback,
            clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
            offer: {
              id: m.offer.id,
              title: m.offer.title,
              price: m.offer.price,
              priceCurrency: m.offer.priceCurrency,
              city: m.offer.city,
              district: m.offer.district,
              area: m.offer.area,
              rooms: m.offer.rooms,
              imageUrl: resolveOfferPrimaryImage(m.offer),
            },
          }))
        : [],
      listing: client.linkedOffer
        ? {
            id: client.linkedOffer.id,
            title: client.linkedOffer.title,
            price: client.linkedOffer.price,
            priceCurrency: client.linkedOffer.priceCurrency,
            city: client.linkedOffer.city,
            district: client.linkedOffer.district,
            status: client.linkedOffer.status,
            statusLabel: listingStatusLabel(client.linkedOffer.status),
            managementStatus: client.linkedOffer.managementStatus,
            imageUrl: resolveOfferPrimaryImage(client.linkedOffer),
          }
        : null,
      listingProgress: buildListingProgress({
        signed: client.acquisition?.status === 'SIGNED' || Boolean(client.acquisition?.signedAt),
        offer: client.linkedOffer,
      }),
      acquisition: client.acquisition
        ? {
            status: client.acquisition.status,
            currentStep: client.acquisition.currentStep,
            formData: client.acquisition.formData as unknown as AcquisitionFormData,
            agreementSnapshot: client.acquisition.agreementSnapshot,
            clientAcknowledgedAt: client.acquisition.clientAcknowledgedAt?.toISOString() ?? null,
            clientAcknowledgementName: client.acquisition.clientAcknowledgementName,
            signedAt: client.acquisition.signedAt?.toISOString() ?? null,
            signerName: client.acquisition.signerName,
            documentHash: client.acquisition.documentHash,
            copyEmailSentAt: client.acquisition.copyEmailSentAt?.toISOString() ?? null,
            updatedAt: client.acquisition.updatedAt.toISOString(),
          }
        : null,
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

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || '');

  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      id: true,
      type: true,
      agencyUserId: true,
      linkedUserId: true,
      firstName: true,
      lastName: true,
      acquisition: {
        select: {
          id: true,
          status: true,
          formData: true,
          clientAcknowledgedAt: true,
        },
      },
    },
  });
  if (!client) {
    return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  }

  const clientName = `${client.firstName} ${client.lastName}`.trim();

  if (action === 'update_acquisition_checklist') {
    if (client.type !== 'SELLER' || !client.acquisition || client.acquisition.status === 'SIGNED') {
      return NextResponse.json({ error: 'Proces pozyskania nie jest dostępny do edycji.' }, { status: 400 });
    }
    const incoming = body.documents && typeof body.documents === 'object' ? body.documents : {};
    const currentForm = client.acquisition.formData as unknown as AcquisitionFormData;
    const documents = Object.fromEntries(
      Object.entries(incoming)
        .slice(0, 30)
        .map(([key, value]) => [String(key).slice(0, 64), Boolean(value)]),
    );
    await prisma.agencyClientAcquisition.update({
      where: { id: client.acquisition.id },
      data: { formData: { ...currentForm, documents } },
    });
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: 'Klient zaktualizował dokumenty',
      body: `${clientName} zaznaczył przygotowane dokumenty na spotkanie.`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'acknowledge_acquisition') {
    if (client.type !== 'SELLER' || !client.acquisition || !['TERMS_READY', 'IN_MEETING'].includes(client.acquisition.status)) {
      return NextResponse.json({ error: 'Warunki nie są jeszcze gotowe do potwierdzenia.' }, { status: 400 });
    }
    const acknowledgementName = String(body.name || '').trim();
    if (acknowledgementName.length < 3) {
      return NextResponse.json({ error: 'Wpisz imię i nazwisko.' }, { status: 400 });
    }
    const acknowledgedAt = new Date();
    await prisma.$transaction([
      prisma.agencyClientAcquisition.update({
        where: { id: client.acquisition.id },
        data: {
          clientAcknowledgedAt: acknowledgedAt,
          clientAcknowledgementName: acknowledgementName.slice(0, 191),
        },
      }),
      prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          kind: 'ACQUISITION_ACKNOWLEDGED',
          title: 'Klient zapoznał się z warunkami',
          body: `${acknowledgementName} potwierdził(a) zapoznanie się z dokumentem.`,
          metadata: { acknowledgedAt: acknowledgedAt.toISOString(), via: 'client_portal' },
        },
      }),
    ]);
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: 'Klient potwierdził warunki',
      body: `${acknowledgementName} zapoznał się z kartą pozyskania.`,
    });
    return NextResponse.json({ success: true, acknowledgedAt: acknowledgedAt.toISOString() });
  }

  if (action === 'submit_feedback') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
    }
    const matchId = Number(body.matchId);
    const feedback = String(body.feedback || '').trim();
    if (!Number.isFinite(matchId) || !feedback) {
      return NextResponse.json({ error: 'Podaj komentarz do oferty.' }, { status: 400 });
    }

    const match = await prisma.agencyClientMatch.findFirst({
      where: { id: matchId, clientId: client.id },
      include: { offer: { select: { id: true, title: true } } },
    });
    if (!match) {
      return NextResponse.json({ error: 'Nie znaleziono dopasowania.' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.agencyClientMatch.update({
        where: { id: matchId },
        data: { clientFeedback: feedback, clientFeedbackAt: new Date() },
      }),
      prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          offerId: match.offerId,
          kind: 'CLIENT_FEEDBACK',
          title: 'Uwagi klienta do oferty',
          body: feedback,
          metadata: { matchId, offerTitle: match.offer.title },
        },
      }),
    ]);
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: 'Uwagi klienta do oferty',
      body: `${clientName}: ${feedback.slice(0, 140)}`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'confirm_meeting' || action === 'confirm_presentation') {
    const isMeeting = action === 'confirm_meeting';
    const activities = await loadJourneyActivities(client.id);
    const slot = isMeeting ? resolveMeeting(activities) : resolvePresentation(activities);
    if (!slot) {
      return NextResponse.json({ error: 'Brak terminu do potwierdzenia.' }, { status: 400 });
    }
    const startsAt = parseStartsAtInput(body.startsAt) || new Date(slot.startsAt);
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        kind: isMeeting ? JOURNEY_ACTIVITY.MEETING_CONFIRMED : JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
        title: isMeeting ? 'Klient potwierdził spotkanie' : 'Klient potwierdził prezentację',
        body: startsAt.toLocaleString('pl-PL'),
        metadata: {
          startsAt: startsAt.toISOString(),
          location: slot.location,
          notes: slot.notes,
          prepItems: slot.prepItems,
          proposedBy: 'client',
          status: 'confirmed',
        },
      },
    });
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: isMeeting ? 'Termin spotkania potwierdzony' : 'Prezentacja potwierdzona',
      body: `${clientName} · ${startsAt.toLocaleString('pl-PL')}`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'propose_meeting_change' || action === 'propose_presentation_change') {
    const isMeeting = action === 'propose_meeting_change';
    const startsAt = parseStartsAtInput(body.startsAt);
    const reason = String(body.reason || '').trim();
    if (!startsAt) {
      return NextResponse.json({ error: 'Wybierz nowy termin i godzinę.' }, { status: 400 });
    }
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Dopisz powód zmiany terminu.' }, { status: 400 });
    }
    const activities = await loadJourneyActivities(client.id);
    const slot = isMeeting ? resolveMeeting(activities) : resolvePresentation(activities);
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        kind: isMeeting ? JOURNEY_ACTIVITY.MEETING_CHANGE : JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
        title: isMeeting ? 'Klient proponuje inny termin spotkania' : 'Klient proponuje inny termin prezentacji',
        body: `${startsAt.toLocaleString('pl-PL')} · ${reason}`,
        metadata: {
          startsAt: startsAt.toISOString(),
          location: body.location ? String(body.location).trim() : slot?.location || null,
          notes: slot?.notes || null,
          prepItems: slot?.prepItems || [],
          proposedBy: 'client',
          status: 'pending',
          reason,
          previousStartsAt: slot?.startsAt || null,
        },
      },
    });
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: isMeeting ? 'Propozycja zmiany spotkania' : 'Propozycja zmiany prezentacji',
      body: `${clientName} proponuje ${startsAt.toLocaleString('pl-PL')}: ${reason}`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'list_messages') {
    const messages = await listPortalChat(client.id, 'client');
    return NextResponse.json({ success: true, messages });
  }

  if (action === 'send_message') {
    const result = await sendPortalChat({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      linkedUserId: client.linkedUserId,
      from: 'client',
      content: String(body.content || ''),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      clientName,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, message: result.message });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
