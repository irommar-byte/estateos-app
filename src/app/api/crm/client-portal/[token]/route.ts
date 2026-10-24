import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { deliverChatToClient } from '@/lib/crm/clientOutbox';
import { prisma } from '@/lib/prisma';
import { mirrorPortalFeedbackToDiscovery } from '@/lib/crm/discoveryBridge';
import { buildPortalSyncVersion } from '@/lib/crm/portalSyncVersion';
import { shapeAgencyClientMatchOffer } from '@/lib/crm/matchOfferShape';
import { loadPresentationOfferPreview } from '@/lib/crm/presentationOfferPreview';
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
  parsePortalChatCursor,
  sendPortalChat,
} from '@/lib/crm/portalChat';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { documentsSummary, loadClientDocuments } from '@/lib/crm/clientDocuments';
import { logPortalEvent } from '@/lib/crm/portalEvents';
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
  extractOtherAgenciesPresence,
  isActivityVisibleToClient,
  isMarketingActivityKind,
  loadSellerPortalMarketing,
  respondToClientDecision,
} from '@/lib/crm/sellerMarketing';
import { mirrorPresentationActivity } from '@/lib/crm/mirrorClientSchedule';
import { emailClientSchedule } from '@/lib/crm/clientScheduleNotify';
import { ensurePresentationOfferMatch } from '@/lib/crm/ensurePresentationOfferMatch';
import {
  PARTNER_ALLOWED_ACTIONS,
  createPortalCompanion,
  listPortalCompanions,
  loadCompanionFeedback,
  parsePortalPermissions,
  resolvePortalAccess,
  revokePortalCompanion,
  saveCompanionFeedback,
  type PortalViewer,
} from '@/lib/crm/portalAccess';
import { favoriteBadge, parseFavoriteSnapshot, setMatchFavorite } from '@/lib/crm/portalFavorites';
import { listAgentFreeSlots, requestSelfBooking } from '@/lib/crm/portalBooking';
import { parseSearchPolygon } from '@/lib/geo/searchPolygon';
import {
  computeNetProceeds,
  loadListingStats,
  loadSellerBuyerOffers,
  loadSellerCompetition,
  loadShowingFeedbackSummary,
  parseSellerFinance,
  respondToBuyerOffer,
} from '@/lib/crm/sellerPortal';
import { buildClientVoice } from '@/lib/crm/clientVoice';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { qrSvg } from '@/lib/qrSvg';
import { ensureClientInviteCode, inviteDeepLink } from '@/lib/crm/clientInviteCode';

type RouteCtx = { params: Promise<{ token: string }> };

function clientWhyFromIntelMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const why = (metadata as Record<string, unknown>).clientWhy;
  return typeof why === 'string' && why.trim() ? why.trim() : null;
}

function intelWhyByOfferId(
  rows: Array<{ offerId: number | null; metadata: unknown }>,
): Map<number, string> {
  const whyByOffer = new Map<number, string>();
  for (const row of rows) {
    const why = clientWhyFromIntelMetadata(row.metadata);
    if (!why) continue;
    if (row.offerId && !whyByOffer.has(row.offerId)) whyByOffer.set(row.offerId, why);
    const rec = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
    const ids = rec.offerIds;
    if (!Array.isArray(ids)) continue;
    for (const raw of ids) {
      const id = Number(raw);
      if (Number.isFinite(id) && id > 0 && !whyByOffer.has(id)) whyByOffer.set(id, why);
    }
  }
  return whyByOffer;
}

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
          JOURNEY_ACTIVITY.PRESENTATION_HELD,
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
  const { token: rawToken } = await ctx.params;
  const access = await resolvePortalAccess(rawToken);
  if (!access) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }
  const token = access.portalToken;
  const viewer: PortalViewer = access.viewer;
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
              lat: true,
              lng: true,
              floor: true,
              totalFloors: true,
              yearBuilt: true,
              hasBalcony: true,
              hasParking: true,
              hasElevator: true,
              hasGarden: true,
              floorPlanUrl: true,
              createdAt: true,
            },
          },
        },
      },
      linkedOffer: {
        select: {
          id: true,
          title: true,
          area: true,
          rooms: true,
          price: true,
          priceCurrency: true,
          city: true,
          district: true,
          status: true,
          officeReviewStatus: true,
          managementStatus: true,
          images: true,
          promotedUntil: true,
          createdAt: true,
          updatedAt: true,
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
              'OTHER_AGENCY_OUTREACH',
              'OPEN_HOUSE_PROPOSAL',
              'OPEN_HOUSE_CONFIRMED',
              'AUCTION_PROPOSAL',
              'AUCTION_CONFIRMED',
              JOURNEY_ACTIVITY.MEETING_CHANGE,
              JOURNEY_ACTIVITY.MEETING_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
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
  const intelWhyRows = client.buyerPreference && client.matches.length
    ? await prisma.agencyClientActivity.findMany({
        where: { clientId: client.id, kind: 'INTELLIGENCE_OFFER' },
        orderBy: { createdAt: 'desc' },
        take: 300,
        select: { offerId: true, metadata: true },
      })
    : [];
  const whyByOffer = intelWhyByOfferId(intelWhyRows);
  const scheduleActs = await loadJourneyActivities(client.id);
  const meeting = resolveMeeting(scheduleActs);
  const presentation = resolvePresentation(scheduleActs);
  if (client.type === 'BUYER' && presentation?.offerId && !presentation.heldAt) {
    const seeded = await ensurePresentationOfferMatch({
      buyerClientId: client.id,
      offerId: presentation.offerId,
    }).catch(() => ({ created: false, matchId: null }));
    if (seeded?.created) {
      const refreshed = await prisma.agencyClientMatch.findMany({
        where: { clientId: client.id },
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
              lat: true,
              lng: true,
              floor: true,
              totalFloors: true,
              yearBuilt: true,
              hasBalcony: true,
              hasParking: true,
              hasElevator: true,
              hasGarden: true,
              floorPlanUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ notifiedAt: 'desc' }, { id: 'desc' }],
      });
      (client as { matches: typeof refreshed }).matches = refreshed;
    }
  }
  const presentationOffer = await loadPresentationOfferPreview(presentation?.offerId);
  const intelligenceEnabled = Boolean(client.intelligenceEnabled);
  /** Przy wyłączonym asystencie cofamy auto-wypuszczone karty Intelligence — klient nie powinien ich widzieć. */
  if (!intelligenceEnabled && client.type === 'BUYER') {
    const leaked = client.matches.filter((m) => m.intelligenceSent && m.notifiedAt);
    if (leaked.length) {
      await prisma.agencyClientMatch.updateMany({
        where: {
          clientId: client.id,
          intelligenceSent: true,
          notifiedAt: { not: null },
        },
        data: {
          notifiedAt: null,
          sharedAt: null,
          intelligenceSent: false,
          intelligenceReason: null,
        },
      });
      client.matches = client.matches.map((m) =>
        m.intelligenceSent
          ? {
              ...m,
              notifiedAt: null,
              sharedAt: null,
              intelligenceSent: false,
              intelligenceReason: null,
            }
          : m,
      );
    }
  }
  const portalMatches = intelligenceEnabled
    ? client.matches.filter((m) => m.notifiedAt)
    : client.matches.filter((m) => m.notifiedAt && !m.intelligenceSent);
  const notifiedMatches = portalMatches;
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

  const buyerDeal =
    client.type === 'BUYER' && client.linkedUserId
      ? await prisma.deal.findFirst({
          where: { buyerId: client.linkedUserId, status: { not: 'CANCELLED' } },
          orderBy: { updatedAt: 'desc' },
          select: {
            status: true,
            offerId: true,
            acceptedBid: { select: { amount: true } },
            offer: {
              select: {
                id: true,
                title: true,
                price: true,
                city: true,
                district: true,
                street: true,
                status: true,
              },
            },
          },
        })
      : null;
  const shownOfferSold = String(buyerDeal?.offer.status || '').toUpperCase() === 'SOLD';
  const dealFinalized = buyerDeal?.status === 'FINALIZED' || shownOfferSold;
  const dealOpen = Boolean(buyerDeal && !dealFinalized);
  const DEAL_PHASE_LABEL: Record<string, string> = {
    INITIATED: 'Rozmowa otwarta',
    NEGOTIATION: 'Negocjacje ceny',
    AGREED: 'Cena uzgodniona',
    MEETING: 'Domknięcie transakcji',
    FINALIZED: 'Kupione',
  };
  const shortPlace = (parts: Array<string | null | undefined>) => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const part of parts) {
      const value = String(part || '').trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      if (key === 'polska' || key === 'poland' || key.startsWith('województwo') || key.startsWith('woj.')) continue;
      seen.add(key);
      unique.push(value);
    }
    return unique.join(', ');
  };
  const purchaseOffer = buyerDeal?.offer || (presentation?.heldAt ? presentationOffer : null);
  const purchasePrice = buyerDeal?.acceptedBid?.amount ?? (purchaseOffer ? Number(purchaseOffer.price) || null : null);
  const purchase =
    client.type === 'BUYER' && purchaseOffer && (Boolean(presentation?.heldAt) || Boolean(buyerDeal))
      ? {
          phase: dealFinalized ? 'closed' : dealOpen ? 'negotiating' : 'viewed',
          title: purchaseOffer.title,
          price: purchasePrice,
          address: shortPlace([purchaseOffer.street, purchaseOffer.district, purchaseOffer.city]),
          offerId: purchaseOffer.id,
          statusLabel: dealFinalized
            ? 'Kupione'
            : dealOpen
              ? DEAL_PHASE_LABEL[buyerDeal?.status || ''] || 'Transakcja w toku'
              : 'Po pokazie — jeszcze nie zakup',
        }
      : null;

  const stages = buildJourneyStages({
    clientType: client.type,
    hasMeeting: Boolean(meeting),
    meetingConfirmed: meeting?.status === 'confirmed',
    acquisitionStarted: Boolean(client.acquisition && client.acquisition.currentStep > 1),
    signed: acquired,
    hasOffer: listingVisible,
    hasPresentation: Boolean(presentation),
    presentationConfirmed: presentation?.status === 'confirmed',
    presentationHeld: Boolean(presentation?.heldAt),
    hasCriteria: Boolean(client.buyerPreference),
    sentOfferCount: notifiedMatches.length,
    reactedCount: reactedMatches.length,
    lastOfferSentAt: lastOfferSentAt ? lastOfferSentAt.toISOString() : null,
    lastReactionAt: lastReactionAt ? lastReactionAt.toISOString() : null,
    listingSold:
      client.type === 'SELLER' &&
      ['SOLD', 'ARCHIVED'].includes(String(client.linkedOffer?.status || '').toUpperCase()),
    dealClosed: client.type === 'BUYER' ? dealFinalized : false,
    dealOpen: client.type === 'BUYER' ? dealOpen : false,
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
  const syncVersion = buildPortalSyncVersion([
    client.updatedAt,
    client.acquisition?.updatedAt,
    client.linkedOffer?.updatedAt,
    client.matches.reduce<Date | null>(
      (latest, match) => (!latest || match.updatedAt > latest ? match.updatedAt : latest),
      null,
    ),
    client.activities[0]?.createdAt,
  ]);

  const permissions = parsePortalPermissions(client.portalPermissions);
  const companionFeedback = await loadCompanionFeedback(client.id, portalMatches.map((m) => m.id));
  const companions =
    viewer.role === 'owner'
      ? (await listPortalCompanions(client.id)).map((c) => ({
          id: c.id,
          name: c.name,
          url: buildPortalUrl(c.token),
          lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
        }))
      : [];
  const voice = buildClientVoice({
    clientId: client.id,
    firstName: viewer.role === 'partner' ? viewer.name : client.firstName,
    salutation: viewer.role === 'partner' ? null : client.salutation,
    agentName,
  });
  const appInviteCode = await ensureClientInviteCode(
    client.id,
    viewer.role === 'partner' ? viewer.companionId : null,
  ).catch(() => null);
  const sellerFinance = parseSellerFinance(client.sellerFinance);
  const listingPrice = Number(client.linkedOffer?.price || 0);
  const seller =
    client.type === 'SELLER'
      ? {
          stats: permissions.sellerStats ? await loadListingStats(client.id, client.linkedOffer?.id ?? null) : null,
          buyerOffers: await loadSellerBuyerOffers(client.id),
          showingFeedback: permissions.sellerFeedback ? await loadShowingFeedbackSummary(client.id) : null,
          competition: permissions.sellerCompetition ? await loadSellerCompetition(client.linkedOffer ?? null) : null,
          finance: sellerFinance,
          netAtListPrice: listingPrice > 0 ? computeNetProceeds(listingPrice, sellerFinance) : null,
        }
      : null;
  const documents = permissions.documents ? await loadClientDocuments(client.id, client.type).catch(() => []) : [];
  const lastReview = await prisma.agencyClientActivity
    .findFirst({
      where: { clientId: client.id, kind: 'PORTAL_EVENT', title: { startsWith: 'Ocena współpracy' } },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    })
    .catch(() => null);
  const reviewMeta = (lastReview?.metadata || {}) as Record<string, unknown>;

  return NextResponse.json({
    success: true,
    portal: {
      viewer,
      greeting: voice.greeting.replace(/,$/, ''),
      clientFirstName: client.firstName,
      salutation: client.salutation,
      permissions,
      companions,
      appInvite: appInviteCode
        ? { code: appInviteCode, link: inviteDeepLink(appInviteCode), qrSvg: qrSvg(inviteDeepLink(appInviteCode)) }
        : null,
      searchPolygon: parseSearchPolygon(client.buyerPreference?.searchPolygon),
      seller,
      documents,
      documentsSummary: documentsSummary(documents),
      review: lastReview
        ? { rating: Number(reviewMeta.rating || 0), comment: reviewMeta.comment ? String(reviewMeta.comment) : null, at: lastReview.createdAt.toISOString() }
        : null,
      reviewLink: `https://www.google.com/search?q=${encodeURIComponent(`${agencyName} opinie`)}`,
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
      syncVersion,
      searchCriteria,
      intelligenceEnabled,
      pendingCheckback: intelligenceEnabled ? pendingCheckback : null,
      unscoredMatchCount:
        intelligenceEnabled && client.buyerPreference
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
      presentation: presentation
        ? {
            ...presentation,
            offer: presentationOffer,
          }
        : null,
      journey: stages,
      purchase,
      matches: client.buyerPreference
        ? portalMatches.map((m) => ({
            id: m.id,
            score: m.score,
            notifiedAt: m.notifiedAt?.toISOString() ?? null,
            clientFeedback: m.clientFeedback,
            clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
            intelligenceSent: Boolean(m.intelligenceSent),
            // Internal assistant analysis (confidence, learned budget) stays with the agent.
            intelligenceReason: null,
            clientWhy: intelligenceEnabled ? whyByOffer.get(m.offerId) || null : null,
            favorite: Boolean(m.clientFavorite),
            favoriteBadge: m.clientFavorite ? favoriteBadge(parseFavoriteSnapshot(m.favoriteSnapshot), m.offer) : null,
            partnerFeedback: companionFeedback.get(m.id) || [],
            offer: shapeAgencyClientMatchOffer(m.offer),
          }))
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
            createdAt: client.linkedOffer.createdAt.toISOString(),
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
      otherAgencies:
        client.type === 'SELLER'
          ? extractOtherAgenciesPresence(client.activities)
          : { live: false, body: null },
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
  const { token: rawToken } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }
  const action = String(body.action || '');
  const access = await resolvePortalAccess(rawToken);
  if (!access) {
    return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  }
  const token = access.portalToken;
  const viewer: PortalViewer = access.viewer;
  if (viewer.role === 'partner' && !PARTNER_ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Ta czynność jest dostępna tylko dla właściciela panelu.' }, { status: 403 });
  }

  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      id: true,
      type: true,
      agencyUserId: true,
      linkedUserId: true,
      firstName: true,
      lastName: true,
      intelligenceEnabled: true,
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

  const clientName =
    viewer.role === 'partner' ? viewer.name : `${client.firstName} ${client.lastName}`.trim();

  const v2 = await handlePortalV2Action({ action, body: body as Record<string, unknown>, client, viewer, clientName });
  if (v2) return v2;

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
    if (!client.intelligenceEnabled) {
      return NextResponse.json({
        success: false,
        reason: 'Asystent wyłączony — oferty wypuszcza tylko agent.',
      });
    }

    // Only the very first proposal can be pulled by the client; later ones follow the assistant's rhythm.
    const alreadySent = await prisma.agencyClientMatch.count({
      where: { clientId: client.id, notifiedAt: { not: null } },
    });
    if (alreadySent > 0) {
      return NextResponse.json({
        success: false,
        reason: 'Pierwsza propozycja już jest w panelu — kolejne przyjdą w ustalonym rytmie.',
      });
    }

    const intel = await sendIntelligenceOffer({
      clientId: client.id,
      ignoreInterval: true,
      channel: 'manual',
    });
    if (intel.sent && intel.pick.offerId) {
      return NextResponse.json({ success: true, offerId: intel.pick.offerId, via: 'intelligence' });
    }
    if (intel.approvalId) {
      // Agent najpierw sprawdza propozycję — klient dostaje ją po akceptacji.
      return NextResponse.json({
        success: true,
        pendingAgent: true,
        message: 'Twój agent sprawdza pierwszą propozycję. Pojawi się tutaj, gdy ją zatwierdzi.',
      });
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

    const released = await notifyAgencyClientAboutOffer({
      clientId: client.id,
      offerId: topMatch.offerId,
      agencyUserId: client.agencyUserId,
      channel: 'manual',
      matchScore: topMatch.score,
      intelligence: {
        reason: `EstateOS™ Intelligence · dopasowanie ${topMatch.score}%`,
      },
    });

    if ('queued' in released && released.queued) {
      return NextResponse.json({
        success: true,
        pendingAgent: true,
        message: 'Twój agent sprawdza pierwszą propozycję. Pojawi się tutaj, gdy ją zatwierdzi.',
      });
    }
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

    void mirrorPortalFeedbackToDiscovery({
      linkedUserId: client.linkedUserId,
      matchId,
      offerId: match.offerId,
      sentiment: parsed.sentiment,
      phrases: parsed.phrases,
      note: parsed.note,
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
          offerTitle: match.offer.title,
          sentiment: parsed.sentiment,
          kind: 'chat',
          audience: 'both',
        },
      });
    }

    const agent = await prisma.user.findUnique({
      where: { id: client.agencyUserId },
      select: { name: true, companyName: true },
    });
    const agentFirstName = agent?.name?.trim().split(/\s+/)[0] || null;

    let intelligenceReply: { action: string; message?: string; emailSent?: boolean } | null = null;
    try {
      intelligenceReply = await handleIntelligenceAfterFeedback({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        matchId,
        agentFirstName,
      });
    } catch (error) {
      console.error('[intelligence.submit_feedback]', error);
      await prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          kind: 'INTELLIGENCE_STALLED',
          title: 'Asystent nie dokończył tury po reakcji',
          body: 'Reakcja klienta została zapisana, ale kolejna oferta nie poszła. Sprawdź asystenta albo wyślij ręcznie.',
          metadata: { agentStatus: 'pending', matchId, source: 'feedback_reply_error' },
        },
      }).catch(() => {});
      intelligenceReply = {
        action: 'error',
        message: 'Zapisano opinię, ale kolejna oferta nie poszła. Agent dostanie zadanie.',
      };
    }

    await applyIntelligenceLearning(client.id).catch((error) => {
      console.error('[intelligence.applyLearning]', error);
    });

    return NextResponse.json({ success: true, intelligenceReply });
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
    if (slot.heldAt) {
      return NextResponse.json({ error: 'Ta prezentacja już się odbyła.' }, { status: 400 });
    }
    const startsAt = parseStartsAtInput(body.startsAt) || new Date(slot.startsAt);
    if (!isMeeting && (slot.proposedSlots || []).length > 1) {
      const ok = [slot.startsAt, ...slot.proposedSlots].some(
        (value) => new Date(value).getTime() === startsAt.getTime(),
      );
      if (!ok) {
        return NextResponse.json({ error: 'Wybierz jeden z zaproponowanych terminów.' }, { status: 400 });
      }
    }
    const metadata = {
      startsAt: startsAt.toISOString(),
      proposedSlots: slot.proposedSlots?.length ? slot.proposedSlots : [startsAt.toISOString()],
      location: slot.location,
      notes: slot.notes,
      prepItems: slot.prepItems,
      proposedBy: 'client',
      status: 'confirmed',
      offerId: slot.offerId,
      showingKind: slot.showingKind || null,
      listingRequestSent: Boolean(slot.listingRequestSent),
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
      const resolvedBuyerId =
        client.type === 'BUYER'
          ? client.id
          : Number(slot.buyerClientId) > 0
            ? Number(slot.buyerClientId)
            : null;

      // Bogaty mail potwierdzenia zawsze do kupującego (mapa + dowód).
      if (resolvedBuyerId) {
        await emailClientSchedule({
          clientId: resolvedBuyerId,
          kind: 'presentation',
          mode: 'confirmed',
          startsAt,
          location: slot.location,
          notes: slot.notes,
          offerId: slot.offerId,
          audience: 'buyer',
        });
        if (slot.offerId) {
          await ensurePresentationOfferMatch({
            buyerClientId: resolvedBuyerId,
            offerId: slot.offerId,
          }).catch(() => {});
        }
      }

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
        // Mirror wyśle lekką notę do counterpart (sprzedający jeśli potwierdził kupujący).
        emailMode: client.type === 'BUYER' ? 'confirmed' : null,
      });

      // Gdy potwierdza sprzedający — counterpart (buyer) dostał mail powyżej; jeśli brak buyerId w meta, wyślij do klienta potwierdzającego tylko gdy to buyer (już obsłużone).
      if (client.type === 'SELLER' && !resolvedBuyerId) {
        /* brak kupującego w metadanych — skip */
      }
    } else {
      await emailClientSchedule({
        clientId: client.id,
        kind: 'meeting',
        mode: 'confirmed',
        startsAt,
        location: slot.location,
        notes: slot.notes,
      });
    }
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: isMeeting ? 'Termin spotkania potwierdzony' : 'Prezentacja potwierdzona',
      body: isMeeting
        ? `${clientName} · ${startsAt.toLocaleString('pl-PL')}`
        : `${clientName} potwierdził(a) · ${startsAt.toLocaleString('pl-PL')} · wysłano mail z mapą i prośbą o dowód`,
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
    const { messages, unreadCount, nextCursor, incremental } = await getPortalChatState(
      client.id,
      'client',
      { updatedSince: parsePortalChatCursor(body.updatedSince) },
    );
    return NextResponse.json({
      success: true,
      messages,
      unreadCount,
      nextCursor,
      incremental,
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
        await deliverChatToClient({
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          from: 'agent',
          content: prompt,
          checkbackQuickReplies: {
            activityId: pending.activityId,
            options: pending.options,
          },
          activityMetadata: {
            audience: 'both',
            kind: 'checkback',
            source: 'intelligence_checkback_prompt',
          },
        }, { category: 'assistant', source: 'intelligence_checkback_prompt' });
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


// ── Panel klienta v2: ulubione, druga osoba, samodzielne umawianie, obszar, sprzedający ──────────

async function handlePortalV2Action(params: {
  action: string;
  body: Record<string, unknown>;
  client: { id: number; type: string; agencyUserId: number; firstName: string; lastName: string };
  viewer: PortalViewer;
  clientName: string;
}): Promise<NextResponse | null> {
  const { action, body, client, viewer, clientName } = params;
  const fail = (e: unknown, status = 400) =>
    NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });

  if (action === 'toggle_favorite') {
    try {
      await setMatchFavorite({ clientId: client.id, matchId: Number(body.matchId), favorite: body.favorite !== false });
      if (body.favorite !== false) {
        const fav = await prisma.agencyClientMatch.findFirst({
          where: { id: Number(body.matchId), clientId: client.id },
          select: { offerId: true, offer: { select: { title: true } } },
        });
        await logPortalEvent({
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          event: 'favorite',
          title: `${viewer.role === 'partner' ? viewer.name : clientName} dodał(a) do ulubionych`,
          body: fav?.offer.title || null,
          offerId: fav?.offerId ?? null,
        });
      }
      return NextResponse.json({ success: true });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === 'partner_feedback') {
    if (viewer.role !== 'partner') return fail('Ocena drugiej osoby jest dostępna z jej linku.');
    try {
      await saveCompanionFeedback({
        clientId: client.id,
        companionId: viewer.companionId,
        matchId: Number(body.matchId),
        sentiment: String(body.sentiment || ''),
        note: body.note ? String(body.note) : null,
      });
      await logPortalEvent({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        event: 'partner_rating',
        title: `${viewer.name} ocenił(a) ofertę`,
        body: `${viewer.name} (druga osoba u: ${client.firstName}) — ${String(body.sentiment) === 'like' ? 'chce obejrzeć' : String(body.sentiment) === 'dislike' ? 'nie pasuje' : 'do przemyślenia'}`,
        meta: { matchId: Number(body.matchId), sentiment: String(body.sentiment || '') },
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === 'create_partner_link') {
    const permissions = parsePortalPermissions(
      (await prisma.agencyClient.findUnique({ where: { id: client.id }, select: { portalPermissions: true } }))?.portalPermissions,
    );
    if (!permissions.partnerAccess) return fail('Agent wyłączył zapraszanie drugiej osoby.', 403);
    try {
      const companion = await createPortalCompanion(client.id, String(body.name || ''));
      await prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          kind: 'PORTAL_PARTNER_INVITED',
          title: `Druga osoba w panelu: ${companion.name}`,
          body: `${clientName} zaprosił(a) do panelu: ${companion.name}.`,
          metadata: { companionId: companion.id },
        },
      });
      return NextResponse.json({ success: true, companion: { id: companion.id, name: companion.name, url: buildPortalUrl(companion.token) } });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === 'revoke_partner_link') {
    await revokePortalCompanion(client.id, Number(body.companionId));
    return NextResponse.json({ success: true });
  }

  if (action === 'list_free_slots') {
    const permissions = parsePortalPermissions(
      (await prisma.agencyClient.findUnique({ where: { id: client.id }, select: { portalPermissions: true } }))?.portalPermissions,
    );
    if (!permissions.selfBooking) return NextResponse.json({ success: true, enabled: false, slots: [] });
    const slots = await listAgentFreeSlots(client.agencyUserId, 10);
    return NextResponse.json({ success: true, enabled: true, slots });
  }

  if (action === 'request_booking') {
    const permissions = parsePortalPermissions(
      (await prisma.agencyClient.findUnique({ where: { id: client.id }, select: { portalPermissions: true } }))?.portalPermissions,
    );
    if (!permissions.selfBooking) return fail('Terminy ustala agent — proszę napisać w rozmowie.', 403);
    try {
      const booked = await requestSelfBooking({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        offerId: Number(body.offerId),
        startsAt: String(body.startsAt || ''),
        note: body.note ? String(body.note) : null,
        requestedBy: clientName,
      });
      await logPortalEvent({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        event: 'self_booking',
        title: 'Klient wybrał termin oglądania — potwierdź',
        body: `${clientName}: ${booked.label} · ${booked.title}`.slice(0, 180),
        offerId: Number(body.offerId),
        meta: { startsAt: booked.startsAt },
      });
      return NextResponse.json({ success: true, booking: booked });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === 'save_search_area') {
    const polygon = body.polygon == null ? null : parseSearchPolygon(body.polygon);
    if (body.polygon != null && !polygon) return fail('Zaznacz co najmniej 3 punkty na mapie.');
    const row = await prisma.agencyClient.findUnique({
      where: { id: client.id },
      select: { portalPermissions: true, buyerPreference: { select: { id: true } } },
    });
    if (!row?.buyerPreference) return fail('Najpierw agent musi ustalić kryteria poszukiwań.');
    const permissions = parsePortalPermissions(row.portalPermissions);
    if (permissions.criteriaEdit) {
      await prisma.agencyClientBuyerPreference.update({
        where: { clientId: client.id },
        data: { searchPolygon: polygon ?? Prisma.JsonNull },
      });
      const { refreshAgencyClientMatches } = await import('@/lib/agencyClientMatching');
      await refreshAgencyClientMatches(client.id).catch(() => {});
    }
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        kind: 'PORTAL_CRITERIA_REQUEST',
        title: polygon ? 'Klient narysował obszar poszukiwań' : 'Klient usunął obszar z mapy',
        body: permissions.criteriaEdit ? 'Zastosowano od razu (klient może zmieniać kryteria).' : 'Czeka na Twoją akceptację.',
        metadata: { searchPolygon: polygon, status: permissions.criteriaEdit ? 'applied' : 'pending' },
      },
    });
    await notifyAgent({
      agencyUserId: client.agencyUserId,
      clientId: client.id,
      title: polygon ? 'Nowy obszar poszukiwań od klienta' : 'Klient usunął obszar z mapy',
      body: `${clientName}${permissions.criteriaEdit ? '' : ' — czeka na akceptację'}`,
      data: { kind: 'PORTAL_CRITERIA_REQUEST' },
    });
    return NextResponse.json({ success: true, applied: permissions.criteriaEdit });
  }

  if (action === 'respond_buyer_offer') {
    if (client.type !== 'SELLER') return fail('Panel niedostępny.', 404);
    try {
      const response = String(body.response || '') as 'accept' | 'counter' | 'reject';
      if (!['accept', 'counter', 'reject'].includes(response)) return fail('Wybierz odpowiedź.');
      const row = await respondToBuyerOffer({
        clientId: client.id,
        offerId: Number(body.buyerOfferId),
        response,
        counterAmount: body.counterAmount == null ? null : Number(body.counterAmount),
        comment: body.comment ? String(body.comment) : null,
      });
      const label =
        response === 'accept'
          ? 'przyjmuje ofertę'
          : response === 'counter'
            ? `proponuje ${Number(row.counterAmount).toLocaleString('pl-PL')} zł`
            : 'odrzuca ofertę';
      await logPortalEvent({
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        event: 'buyer_offer_response',
        title: `Sprzedający ${label}`,
        body: `${clientName}: ${row.buyerLabel} · ${row.amount.toLocaleString('pl-PL')} zł`,
        meta: { buyerOfferId: row.id, response },
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      return fail(e);
    }
  }

  if (action === 'save_seller_finance') {
    if (client.type !== 'SELLER') return fail('Panel niedostępny.', 404);
    const current = await prisma.agencyClient.findUnique({ where: { id: client.id }, select: { sellerFinance: true } });
    const merged = { ...parseSellerFinance(current?.sellerFinance) };
    const input = (body.finance && typeof body.finance === 'object' ? body.finance : {}) as Record<string, unknown>;
    for (const key of ['mortgageBalance', 'purchaseYear', 'purchasePrice'] as const) {
      if (key in input) {
        const n = Number(input[key]);
        merged[key] = Number.isFinite(n) && n >= 0 ? n : null;
      }
    }
    await prisma.agencyClient.update({ where: { id: client.id }, data: { sellerFinance: merged } });
    return NextResponse.json({ success: true, finance: merged });
  }

  if (action === 'submit_review') {
    if (viewer.role !== 'owner') return fail('Ocenę wystawia właściciel panelu.', 403);
    const rating = Math.round(Number(body.rating));
    if (!(rating >= 1 && rating <= 5)) return fail('Wybierz ocenę od 1 do 5.');
    const comment = String(body.comment || '').trim().slice(0, 1000) || null;
    await logPortalEvent({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      event: 'review',
      title: `Ocena współpracy: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      body: `${clientName}${comment ? `: „${comment}”` : ''}`,
      meta: { rating, comment },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'send_referral') {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const phone = String(body.phone || '').replace(/[^\d+ ]/g, '').trim().slice(0, 32);
    const email = String(body.email || '').trim().slice(0, 160);
    const need = ['BUYER', 'SELLER', 'RENT'].includes(String(body.need)) ? String(body.need) : 'BUYER';
    const note = String(body.note || '').trim().slice(0, 500) || null;
    if (!name) return fail('Podaj imię polecanej osoby.');
    if (!phone && !email) return fail('Podaj telefon albo e-mail.');
    const needLabel = need === 'SELLER' ? 'chce sprzedać' : need === 'RENT' ? 'szuka najmu' : 'szuka nieruchomości';
    await logPortalEvent({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      event: 'referral',
      title: `Polecenie od ${viewer.role === 'partner' ? viewer.name : clientName}: ${name}`,
      body: [needLabel, phone, email, note].filter(Boolean).join(' · '),
      meta: { referral: { name, phone: phone || null, email: email || null, need, note } },
    });
    return NextResponse.json({ success: true });
  }

  return null;
}
