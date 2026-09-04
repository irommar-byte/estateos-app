import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shapeAgencyClientMatchOffer } from '@/lib/crm/matchOfferShape';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { buyerPrefToWebRadarFilters } from '@/lib/agencyClientShape';
import { formatRadarSummary } from '@/lib/radarCalibrationWeb';
import { formatAgentTitle } from '@/lib/agentProfile';
import type { AgencyClientBuyerPreference } from '@prisma/client';
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
import {
  getPortalChatState,
  isPortalPeerTyping,
  markPortalChatRead,
  markPortalTyping,
  sendPortalChat,
} from '@/lib/crm/portalChat';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { touchPortalLinkedPresence } from '@/lib/crm/portalPresence';
import { buildListingProgress, listingStatusLabel } from '@/lib/crm/acquisitionOffer';
import { isPromotionActive } from '@/lib/listingPromotion';
import {
  parseClientOfferFeedback,
  serializeClientOfferFeedback,
  clientFeedbackHasContent,
  formatClientFeedbackForAgent,
  clientFeedbackChatMessage,
} from '@/lib/crm/clientPortalFeedback';
import { applyIntelligenceLearning, sendIntelligenceOffer } from '@/lib/crm/clientIntelligenceRun';
import { bearerUserIdFromRequest, resolvePortalAccountStatus, resolvePortalActivationHint } from '@/lib/crm/portalAccountLink';
import {
  getPendingCheckback,
  respondToIntelligenceCheckback,
} from '@/lib/crm/intelligenceCheckback';
import {
  buildCheckbackChoicePrompt,
  mapChatTextToCheckbackOption,
} from '@/lib/crm/intelligenceCheckbackChat';
import {
  handleCheckbackFollowUpSend,
  handleIntelligenceAfterFeedback,
} from '@/lib/crm/intelligenceFeedbackReply';
import { notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import {
  buildSellerListingPath,
  isActivityVisibleToClient,
  isMarketingActivityKind,
  loadSellerPortalMarketing,
  respondToClientDecision,
} from '@/lib/crm/sellerMarketing';
import { mirrorPresentationActivity } from '@/lib/crm/mirrorClientSchedule';

type RouteCtx = { params: Promise<{ token: string }> };

function shapeSearchCriteria(pref: AgencyClientBuyerPreference | null) {
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
    minYear: pref.minYear && pref.minYear > 1900 ? pref.minYear : null,
    minRooms: pref.minRooms && pref.minRooms > 0 ? pref.minRooms : null,
    maxArea: pref.maxArea && pref.maxArea > 0 ? pref.maxArea : null,
  };
}

function mergeQualificationIntoPref(
  pref: AgencyClientBuyerPreference,
  qualification: Record<string, unknown> | null | undefined,
): AgencyClientBuyerPreference {
  if (pref.maxArea != null || pref.minArea != null) return pref;
  const maxArea = Number(qualification?.maxArea);
  const minArea = Number(qualification?.minArea);
  if (!Number.isFinite(maxArea) && !Number.isFinite(minArea)) return pref;
  return {
    ...pref,
    minArea: Number.isFinite(minArea) && minArea > 0 ? minArea : pref.minArea,
    maxArea: Number.isFinite(maxArea) && maxArea > 0 ? maxArea : pref.maxArea,
  };
}

async function resolveSearchCriteria(
  clientId: number,
  agencyUserId: number,
  pref: AgencyClientBuyerPreference | null,
) {
  if (!pref) return null;
  let working = pref;
  if (working.maxArea == null && working.minArea == null) {
    const deskCase = await prisma.deskCase.findFirst({
      where: { clientId, agencyUserId, kind: 'BUY' },
      orderBy: { updatedAt: 'desc' },
      select: { metadata: true },
    });
    const meta =
      deskCase?.metadata && typeof deskCase.metadata === 'object'
        ? (deskCase.metadata as Record<string, unknown>)
        : null;
    const qualification =
      meta?.qualification && typeof meta.qualification === 'object'
        ? (meta.qualification as Record<string, unknown>)
        : null;
    working = mergeQualificationIntoPref(pref, qualification);
  }
  return shapeSearchCriteria(working);
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
    select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
  });
}

async function notifyAgent(params: {
  agencyUserId: number;
  clientId: number;
  title: string;
  body: string;
  type?: 'CRM_EVENT' | 'CHAT_MESSAGE';
  data?: Record<string, unknown>;
}) {
  await sendNotification({
    userId: params.agencyUserId,
    type: params.type || 'CRM_EVENT',
    title: params.title,
    body: params.body,
    data: crmAgentPushData(params.clientId, {
      ...params.data,
      notificationType: params.type === 'CHAT_MESSAGE' ? 'crm_client_message' : 'crm_client',
    }),
  }).catch(() => {});
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const sessionUserId = bearerUserIdFromRequest(_req);
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
        take: 80,
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              price: true,
              priceCurrency: true,
              city: true,
              district: true,
              street: true,
              description: true,
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
          officeReviewStatus: true,
          managementStatus: true,
          images: true,
          promotedUntil: true,
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
              'CLIENT_FEEDBACK',
              'INTELLIGENCE_OFFER',
              'INTELLIGENCE_PLANNED',
              'INTELLIGENCE_CHECKBACK',
              'INTELLIGENCE_HANDOFF',
              'FEEDBACK_REMINDER',
              'ACQUISITION_MEETING',
              'ACQUISITION_SIGNED',
              'MARKET_REPORT_SENT',
              'LISTING_FEATURED',
              'EXTERNAL_PORTAL',
              'ESTATEOS_ACTIVATED',
              'ESTATEOS_PROMOTED',
              'EXTERNAL_PORTAL_LISTED',
              'EXTERNAL_PORTAL_UPDATED',
              'MARKETING_NOTE',
              JOURNEY_ACTIVITY.MEETING_CHANGE,
              JOURNEY_ACTIVITY.MEETING_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }

  await touchPortalLinkedPresence(client.linkedUserId);

  const agent = client.agencyUser;
  const member = agent.agencyMembership;
  const company = member?.company;

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Dedykowany Agent';
  const agentPhoto = member?.profilePhotoUrl || agent.image || null;
  const agentTitle = member?.agentTitle
    ? formatAgentTitle(member.agentTitle)
    : 'Dedykowany Doradca d/s Nieruchomości';
  const agencyName = company?.name || agent.companyName || 'EstateOS Biuro Nieruchomości';
  const agencyLogo = company?.logoUrl || null;
  const agencySlug = company?.slug ? `/firma/${company.slug}` : null;
  const agencyWebsite = company?.website || null;
  const agencyPhone = company?.officePhone || agent.phone || null;
  const agencyEmail = company?.officeEmail || agent.email || null;
  const agencyAddress = company?.address || null;

  const searchCriteria = await resolveSearchCriteria(client.id, client.agencyUserId, client.buyerPreference);
  const scheduleActs = await loadJourneyActivities(client.id);
  const meeting = resolveMeeting(scheduleActs);
  const presentation = resolvePresentation(scheduleActs);
  const notifiedMatches = client.matches.filter((m) => m.notifiedAt);
  const reactedMatches = notifiedMatches.filter((m) => clientFeedbackHasContent(parseClientOfferFeedback(m.clientFeedback)));
  const lastOfferSentAt = notifiedMatches
    .map((m) => m.notifiedAt)
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
  const lastReactionAt = reactedMatches
    .map((m) => m.clientFeedbackAt)
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
  const acquired =
    client.acquisition?.status === 'SIGNED' || Boolean(client.acquisition?.signedAt);
  const listingVisible = acquired && Boolean(client.linkedOffer);
  const stages = buildJourneyStages({
    clientType: client.type,
    hasMeeting: Boolean(meeting),
    meetingConfirmed: meeting?.status === 'confirmed',
    acquisitionStarted: Boolean(client.acquisition && client.acquisition.currentStep > 1),
    signed: acquired,
    hasOffer: listingVisible,
    hasPresentation: Boolean(presentation),
    presentationConfirmed: presentation?.status === 'confirmed',
    hasCriteria: Boolean(client.buyerPreference),
    sentOfferCount: notifiedMatches.length,
    reactedCount: reactedMatches.length,
    lastOfferSentAt: lastOfferSentAt ? lastOfferSentAt.toISOString() : null,
    lastReactionAt: lastReactionAt ? lastReactionAt.toISOString() : null,
    listingSold: ['SOLD', 'ARCHIVED'].includes(String(client.linkedOffer?.status || '').toUpperCase()),
  });

  const pendingCheckback = await getPendingCheckback(client.id);

  const sellerMarketing =
    client.type === 'SELLER'
      ? await loadSellerPortalMarketing(client.id, { visibleOnly: true }).catch(() => ({
          estateos: null,
          activeChannels: [],
          sellerNextStep: null,
          pendingDecisions: [],
          marketingTimeline: [],
          facebookGroups: [],
          sellerEvents: null,
        }))
      : null;

  let sessionUserEmail: string | null = null;
  if (sessionUserId) {
    const sessionUser = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { email: true },
    });
    sessionUserEmail = sessionUser?.email ?? null;
  }
  const account = resolvePortalAccountStatus({
    clientEmail: client.email,
    clientLinkedUserId: client.linkedUserId,
    sessionUserId,
    sessionUserEmail,
  });
  const activation =
    account.status === 'anonymous'
      ? resolvePortalActivationHint({ clientEmail: client.email, clientPhone: client.phone })
      : null;

  return NextResponse.json({
    success: true,
    portal: {
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      type: client.type,
      agencyName,
      agentName,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      agentPhoto: agentPhoto ? absolutizeMediaUrl(agentPhoto) : null,
      agentTitle,
      agencyLogo,
      agencySlug,
      agencyWebsite,
      agencyPhone,
      agencyEmail,
      agencyAddress,
      searchCriteria,
      intelligenceEnabled: Boolean(client.intelligenceEnabled),
      pendingCheckback,
      unscoredMatchCount: client.buyerPreference
        ? await prisma.agencyClientMatch.count({
            where: {
              clientId: client.id,
              notifiedAt: null,
              score: { gte: client.buyerPreference.minMatchThreshold ?? 70 },
            },
          })
        : 0,
      canChat: true,
      account: { ...account, activation },
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
        ? client.matches.map((m) => {
            const intelActivity = client.activities.find(
              (a) =>
                a.kind === 'INTELLIGENCE_OFFER' &&
                (a.offerId === m.offerId ||
                  (a.metadata &&
                    typeof a.metadata === 'object' &&
                    Array.isArray((a.metadata as Record<string, unknown>).offerIds) &&
                    ((a.metadata as Record<string, unknown>).offerIds as number[]).includes(m.offerId))),
            );
            const intelMeta =
              intelActivity?.metadata && typeof intelActivity.metadata === 'object'
                ? (intelActivity.metadata as Record<string, unknown>)
                : {};
            return {
            id: m.id,
            score: m.score,
            notifiedAt: m.notifiedAt?.toISOString() ?? null,
            clientFeedback: m.clientFeedback,
            clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
            intelligenceSent: Boolean(m.intelligenceSent),
            intelligenceReason: m.intelligenceReason || null,
            clientWhy: typeof intelMeta.clientWhy === 'string' ? intelMeta.clientWhy : null,
            offer: shapeAgencyClientMatchOffer(m.offer),
          };
          })
        : [],
      listing: listingVisible && client.linkedOffer
        ? {
            id: client.linkedOffer.id,
            title: client.linkedOffer.title,
            price: client.linkedOffer.price,
            priceCurrency: client.linkedOffer.priceCurrency,
            city: client.linkedOffer.city,
            district: client.linkedOffer.district,
            status: client.linkedOffer.status,
            statusLabel: listingStatusLabel(
              client.linkedOffer.status,
              client.linkedOffer.officeReviewStatus,
            ),
            officeReviewStatus: client.linkedOffer.officeReviewStatus,
            managementStatus: client.linkedOffer.managementStatus,
            imageUrl: absolutizeMediaUrl(resolveOfferPrimaryImage(client.linkedOffer)),
            promotedUntil: client.linkedOffer.promotedUntil
              ? client.linkedOffer.promotedUntil.toISOString()
              : null,
            featured: isPromotionActive(client.linkedOffer.promotedUntil),
          }
        : null,
      listingProgress: listingVisible
        ? buildListingProgress({
            signed: acquired,
            offer: client.linkedOffer,
          })
        : [],
      listingPath:
        client.type === 'SELLER'
          ? buildSellerListingPath({
              activities: client.activities,
              linkedOfferId: client.linkedOffer?.id ?? null,
              listingImage: client.linkedOffer
                ? absolutizeMediaUrl(resolveOfferPrimaryImage(client.linkedOffer))
                : null,
            })
          : [],
      marketingTimeline:
        sellerMarketing?.marketingTimeline.map((item) => ({
          ...item,
          evidenceUrl: item.evidenceUrl ? absolutizeMediaUrl(item.evidenceUrl) : null,
        })) || [],
      activeChannels: sellerMarketing?.activeChannels || [],
      sellerNextStep: sellerMarketing?.sellerNextStep || null,
      pendingDecisions: sellerMarketing?.pendingDecisions || [],
      sellerEvents: sellerMarketing?.sellerEvents || null,
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
      activities: client.activities
        .filter(
          (activity) =>
            client.type !== 'SELLER' ||
            !isMarketingActivityKind(activity.kind) ||
            isActivityVisibleToClient(activity.metadata),
        )
        .map((a) => {
        const meta =
          a.metadata && typeof a.metadata === 'object' ? (a.metadata as Record<string, unknown>) : {};
        const offerIds = [
          ...(Array.isArray(meta.offerIds) ? meta.offerIds.map((id) => Number(id)) : []),
          ...(a.offerId ? [a.offerId] : []),
        ].filter((id) => Number.isFinite(id));
        const related = client.matches.filter((m) => offerIds.includes(m.offer.id));
        return {
          id: a.id,
          kind: a.kind,
          title: a.title,
          body: a.body,
          offerId: a.offerId,
          createdAt: a.createdAt.toISOString(),
          metadata: a.metadata,
          offers: related.map((m) => ({
            id: m.offer.id,
            title: m.offer.title,
            city: m.offer.city,
            district: m.offer.district,
            imageUrl: absolutizeMediaUrl(resolveOfferPrimaryImage(m.offer)),
          })),
        };
        }),
    },
  });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }
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
      buyerPreference: { select: { minMatchThreshold: true } },
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

  await touchPortalLinkedPresence(client.linkedUserId, {
    force: action === 'send_message' || action === 'typing',
  });

  const clientName = `${client.firstName} ${client.lastName}`.trim();

  if (action === 'respond_decision') {
    if (client.type !== 'SELLER') {
      return NextResponse.json({ error: 'Dostępne tylko dla sprzedających.' }, { status: 400 });
    }
    const decisionId = Number(body.decisionId);
    const response = String(body.response || '').trim() as 'approve' | 'reject' | 'comment';
    if (!Number.isFinite(decisionId) || !['approve', 'reject', 'comment'].includes(response)) {
      return NextResponse.json({ error: 'Wybierz odpowiedź na prośbę agenta.' }, { status: 400 });
    }
    const result = await respondToClientDecision({
      clientId: client.id,
      decisionId,
      response,
      comment: body.comment != null ? String(body.comment) : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      success: true,
      decision: result.decision,
      fulfillError: result.fulfillError || null,
    });
  }

  if (action === 'release_first_match') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Dostępne tylko dla kupujących.' }, { status: 400 });
    }

    const intel = await sendIntelligenceOffer({
      clientId: client.id,
      force: true,
      ignoreInterval: true,
      channel: 'manual',
    });
    if (intel.sent && intel.pick.offerId) {
      return NextResponse.json({ success: true, offerId: intel.pick.offerId, via: 'intelligence' });
    }

    const minScore = client.buyerPreference?.minMatchThreshold ?? 70;
    const topMatch = await prisma.agencyClientMatch.findFirst({
      where: {
        clientId: client.id,
        notifiedAt: null,
        score: { gte: minScore },
      },
      orderBy: { score: 'desc' },
      select: { offerId: true, score: true },
    });
    if (!topMatch) {
      return NextResponse.json({
        success: false,
        reason: intel.pick.skipReason || 'Brak dopasowań do udostępnienia.',
      });
    }

    await notifyAgencyClientAboutOffer({
      clientId: client.id,
      offerId: topMatch.offerId,
      agencyUserId: client.agencyUserId,
      channel: 'manual',
      matchScore: topMatch.score,
      customMessage: `Pierwsza propozycja pod Twoje kryteria — dopasowanie ${topMatch.score}%.`,
      intelligence: {
        reason: `EstateOS™ Intelligence · dopasowanie ${topMatch.score}%`,
      },
    });

    return NextResponse.json({ success: true, offerId: topMatch.offerId, via: 'match' });
  }

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

  if (action === 'ack_agent_reply') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
    }
    const matchId = Number(body.matchId);
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return NextResponse.json({ error: 'Nie znaleziono odpowiedzi.' }, { status: 400 });
    }
    const match = await prisma.agencyClientMatch.findFirst({
      where: { id: matchId, clientId: client.id },
      select: { id: true, clientFeedback: true },
    });
    if (!match) {
      return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
    }
    const existing = parseClientOfferFeedback(match.clientFeedback);
    if (!existing.agentReply) {
      return NextResponse.json({ error: 'Brak odpowiedzi agenta.' }, { status: 404 });
    }
    await prisma.agencyClientMatch.update({
      where: { id: match.id },
      data: {
        clientFeedback: serializeClientOfferFeedback({
          ...existing,
          agentReplyReadAt: existing.agentReplyReadAt || new Date().toISOString(),
        }),
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'submit_feedback') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
    }
    const matchId = Number(body.matchId);
    const parsed = parseClientOfferFeedback({
      sentiment: body.sentiment,
      liked: body.liked,
      disliked: body.disliked,
      phrases: body.phrases,
      note: body.note || body.feedback,
    });
    if (!Number.isFinite(matchId) || !clientFeedbackHasContent(parsed)) {
      return NextResponse.json({ error: 'Oceń ofertę: co się podoba, a co nie.' }, { status: 400 });
    }

    const match = await prisma.agencyClientMatch.findFirst({
      where: { id: matchId, clientId: client.id },
      include: { offer: { select: { id: true, title: true, city: true, district: true } } },
    });
    if (!match) {
      return NextResponse.json({ error: 'Nie znaleziono dopasowania.' }, { status: 404 });
    }

    const existingFeedback = parseClientOfferFeedback(match.clientFeedback);
    const stored = serializeClientOfferFeedback({
      ...parsed,
      agentReply: existingFeedback.agentReply,
      agentReplyAt: existingFeedback.agentReplyAt,
      agentReplyReadAt: existingFeedback.agentReplyReadAt,
    });
    const agentSummary = formatClientFeedbackForAgent(stored);
    await prisma.$transaction([
      prisma.agencyClientMatch.update({
        where: { id: matchId },
        data: { clientFeedback: stored, clientFeedbackAt: new Date() },
      }),
      prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          offerId: match.offerId,
          kind: 'CLIENT_FEEDBACK',
          title: `Reakcja klienta: ${match.offer.title}`,
          body: agentSummary,
          metadata: {
            matchId,
            offerTitle: match.offer.title,
            offerCity: match.offer.city,
            offerDistrict: match.offer.district,
            sentiment: parsed.sentiment,
          },
        },
      }),
    ]);
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: `Reakcja do oferty: ${match.offer.title}`,
      body: `${clientName}: ${agentSummary.slice(0, 160)}`,
      data: {
        kind: 'CLIENT_FEEDBACK',
        matchId,
        offerId: match.offerId,
      },
    });

    const feedbackChatMessage = clientFeedbackChatMessage(stored, match.offer.title);
    if (feedbackChatMessage) {
      await sendPortalChat({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        from: 'client',
        content: feedbackChatMessage,
        clientName,
        activityOnly: true,
        activityMetadata: {
          source: 'client_feedback',
          matchId,
          offerId: match.offerId,
        },
      });
    }

    const agent = await prisma.user.findUnique({
      where: { id: client.agencyUserId },
      select: { name: true, companyName: true },
    });
    const agentFirstName = agent?.name?.trim().split(/\s+/)[0] || null;

    const reply = await handleIntelligenceAfterFeedback({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      matchId,
      agentFirstName,
    }).catch(() => ({ action: 'none' as const }));

    await applyIntelligenceLearning(client.id).catch(() => {});

    return NextResponse.json({ success: true, intelligenceReply: reply });
  }

  if (action === 'intelligence_checkback') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
    }
    const activityId = Number(body.activityId);
    const optionId = String(body.optionId || '').trim();
    if (!Number.isFinite(activityId) || !optionId) {
      return NextResponse.json({ error: 'Wybierz odpowiedź.' }, { status: 400 });
    }
    const result = await respondToIntelligenceCheckback({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      activityId,
      optionId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Nie udało się zapisać.' }, { status: 400 });
    }
    let followUp = null;
    if (result.followUp === 'send_offer') {
      followUp = await handleCheckbackFollowUpSend({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
      });
    }
    return NextResponse.json({ success: true, followUp });
  }

  if (action === 'confirm_meeting' || action === 'confirm_presentation') {
    const isMeeting = action === 'confirm_meeting';
    const activities = await loadJourneyActivities(client.id);
    const slot = isMeeting ? resolveMeeting(activities) : resolvePresentation(activities);
    if (!slot) {
      return NextResponse.json({ error: 'Brak terminu do potwierdzenia.' }, { status: 400 });
    }
    const startsAt = parseStartsAtInput(body.startsAt) || new Date(slot.startsAt);
    const metadata = {
      startsAt: startsAt.toISOString(),
      location: slot.location,
      notes: slot.notes,
      prepItems: slot.prepItems,
      proposedBy: 'client',
      status: 'confirmed',
      offerId: slot.offerId,
      buyerClientId: slot.buyerClientId,
      sellerClientId: slot.sellerClientId,
    };
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        offerId: slot.offerId,
        kind: isMeeting ? JOURNEY_ACTIVITY.MEETING_CONFIRMED : JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
        title: isMeeting ? 'Klient potwierdził spotkanie' : 'Klient potwierdził prezentację',
        body: startsAt.toLocaleString('pl-PL'),
        metadata,
      },
    });
    if (!isMeeting) {
      await mirrorPresentationActivity({
        agencyUserId: client.agencyUserId,
        sourceClientId: client.id,
        sourceClientType: client.type,
        sourceClientName: clientName,
        kind: JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
        title: 'Druga strona potwierdziła prezentację',
        body: startsAt.toLocaleString('pl-PL'),
        offerId: slot.offerId,
        metadata,
        emailMode: 'confirmed',
      });
    }
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
    const metadata = {
      startsAt: startsAt.toISOString(),
      location: body.location ? String(body.location).trim() : slot?.location || null,
      notes: slot?.notes || null,
      prepItems: slot?.prepItems || [],
      proposedBy: 'client',
      status: 'pending',
      reason,
      previousStartsAt: slot?.startsAt || null,
      offerId: slot?.offerId || null,
      buyerClientId: slot?.buyerClientId || null,
      sellerClientId: slot?.sellerClientId || null,
    };
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        offerId: slot?.offerId || null,
        kind: isMeeting ? JOURNEY_ACTIVITY.MEETING_CHANGE : JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
        title: isMeeting ? 'Klient proponuje inny termin spotkania' : 'Klient proponuje inny termin prezentacji',
        body: `${startsAt.toLocaleString('pl-PL')} · ${reason}`,
        metadata,
      },
    });
    if (!isMeeting) {
      await mirrorPresentationActivity({
        agencyUserId: client.agencyUserId,
        sourceClientId: client.id,
        sourceClientType: client.type,
        sourceClientName: clientName,
        kind: JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
        title: 'Druga strona prosi o inny termin prezentacji',
        body: `${startsAt.toLocaleString('pl-PL')} · ${reason}`,
        offerId: slot?.offerId || null,
        metadata,
        emailMode: 'changed',
      });
    }
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: isMeeting ? 'Propozycja zmiany spotkania' : 'Propozycja zmiany prezentacji',
      body: `${clientName} proponuje ${startsAt.toLocaleString('pl-PL')}: ${reason}`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'list_messages') {
    const { messages, unreadCount } = await getPortalChatState(client.id, 'client');
    return NextResponse.json({
      success: true,
      messages,
      unreadCount,
      peerTyping: isPortalPeerTyping(client.id, 'client'),
    });
  }

  if (action === 'mark_messages_read') {
    await markPortalChatRead(client.id, 'client');
    return NextResponse.json({ success: true, unreadCount: 0 });
  }

  if (action === 'typing') {
    markPortalTyping(client.id, 'client');
    return NextResponse.json({ success: true });
  }

  if (action === 'send_message') {
    const content = String(body.content || '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (client.type === 'BUYER' && content && attachments.length === 0) {
      const pending = await getPendingCheckback(client.id);
      if (pending) {
        const mapped = mapChatTextToCheckbackOption(content, pending.options);
        if (mapped && mapped !== 'ambiguous') {
          await sendPortalChat({
            clientId: client.id,
            agencyUserId: client.agencyUserId,
            linkedUserId: client.linkedUserId,
            from: 'client',
            content,
            clientName,
          });
          const result = await respondToIntelligenceCheckback({
            clientId: client.id,
            agencyUserId: client.agencyUserId,
            activityId: pending.activityId,
            optionId: mapped,
          });
          if (!result.ok) {
            return NextResponse.json({ error: result.error || 'Nie udało się zapisać odpowiedzi.' }, { status: 400 });
          }
          let followUp = null;
          if (result.followUp === 'send_offer') {
            followUp = await handleCheckbackFollowUpSend({
              clientId: client.id,
              agencyUserId: client.agencyUserId,
            });
          }
          const { messages, unreadCount } = await getPortalChatState(client.id, 'client');
          return NextResponse.json({
            success: true,
            checkbackResolved: true,
            optionId: mapped,
            followUp,
            messages,
            unreadCount,
          });
        }

        const prompt = buildCheckbackChoicePrompt(pending.options);
        await sendPortalChat({
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          from: 'agent',
          content: prompt,
          checkbackQuickReplies: {
            activityId: pending.activityId,
            options: pending.options,
          },
        });
        if (content) {
          await sendPortalChat({
            clientId: client.id,
            agencyUserId: client.agencyUserId,
            linkedUserId: client.linkedUserId,
            from: 'client',
            content,
            clientName,
          });
        }
        const { messages, unreadCount } = await getPortalChatState(client.id, 'client');
        return NextResponse.json({
          success: true,
          needsCheckbackChoice: true,
          pendingCheckback: pending,
          messages,
          unreadCount,
        });
      }
    }

    const result = await sendPortalChat({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      linkedUserId: client.linkedUserId,
      from: 'client',
      content,
      attachments,
      clientName,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, message: result.message });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
