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
import { shapeAgencyClientMatchOffer } from '@/lib/crm/matchOfferShape';
import { parseIntelligenceLocks, parseIntelligencePatch, shapeIntelligenceSettings } from '@/lib/crm/clientIntelligence';
import { ensureIntelligenceLockedFieldsColumn, pickIntelligenceOffer, sendIntelligenceOffer } from '@/lib/crm/clientIntelligenceRun';
import { linkOfferToAgencyClient } from '@/lib/offerAgencyManagement';
import { parsePesel } from '@/lib/pesel';
import { findPeselCollision } from '@/lib/crm/clientDuplicate';
import { hashPesel, normalizePeselDigits } from '@/lib/crm/peselHash';
import { archiveAgencyClients } from '@/lib/crm/clientArchive';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { parseSellerPropertyType } from '@/lib/crm/sellerProperty';
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
import {
  getPortalChatState,
  isPortalPeerTyping,
  markPortalChatRead,
  markPortalTyping,
  sendPortalChat,
} from '@/lib/crm/portalChat';
import { createOfferFromAcquisitionRecord } from '@/lib/crm/acquisitionOffer';
import { stampKwFromAcquisitionForm } from '@/lib/legalVerificationAgentStamp';
import { emailClientSchedule } from '@/lib/crm/clientScheduleNotify';
import { fetchPublicLinkPreview } from '@/lib/crm/publicLinkPreview';
import { recordExternalPortalListing } from '@/lib/crm/sellerSaleUpdates';
import {
  createClientDecisionRequest,
  loadSellerPortalMarketing,
  MARKETING_ACTIVITY,
  parseOptionalDate,
  recordMarketingActivity,
  removeExternalPortalListing,
  setMarketingActivityVisibility,
  upsertSellerNextStep,
  updateExternalPortalListing,
  isActivityVisibleToClient,
} from '@/lib/crm/sellerMarketing';
import { parseClientOfferFeedback, clientFeedbackHasContent } from '@/lib/crm/clientPortalFeedback';
import { resolveClientNextStep } from '@/lib/crm/clientNextStep';
import { getPendingCheckback } from '@/lib/crm/intelligenceCheckback';
import { huntNieruchomosciOnlineForClient } from '@/lib/nieruchomosciOnlineClientHunt';
import { attachMatchImportBrief, listMatchImportBriefs } from '@/lib/crm/matchImportProvenance';

export const maxDuration = 300;

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

  await ensureIntelligenceLockedFieldsColumn();
  const { id } = await ctx.params;
  const clientId = Number(id);
  const client = await getAgencyClientForUser(clientId, agencyUserId);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  const meeting = resolveMeeting(client.activities);
  const presentation = resolvePresentation(client.activities);
  const portalChat = await getPortalChatState(client.id, 'agent');
  const acquisition = await prisma.agencyClientAcquisition.findUnique({
    where: { clientId: client.id },
    select: { status: true, currentStep: true, signedAt: true, formData: true },
  });
  await stampKwFromAcquisitionForm({
    offerId: client.linkedOfferId,
    agentUserId: agencyUserId,
    formData: acquisition?.formData,
  }).catch(() => {});
  const journey = buildJourneyStages({
    clientType: client.type,
    hasMeeting: Boolean(meeting),
    meetingConfirmed: meeting?.status === 'confirmed',
    acquisitionStarted: Boolean(acquisition && acquisition.currentStep > 1),
    signed: acquisition?.status === 'SIGNED' || Boolean(acquisition?.signedAt),
    hasOffer: Boolean(client.linkedOfferId),
    hasPresentation: Boolean(presentation),
    presentationConfirmed: presentation?.status === 'confirmed',
    hasCriteria: Boolean(client.buyerPreference),
    sentOfferCount: client.matches.filter((m) => m.notifiedAt).length,
    reactedCount: client.matches.filter((m) =>
      clientFeedbackHasContent(parseClientOfferFeedback(m.clientFeedback)),
    ).length,
    lastOfferSentAt: client.matches
      .map((m) => m.notifiedAt)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0]
      ?.toISOString?.() || null,
    lastReactionAt: client.matches
      .map((m) => m.clientFeedbackAt)
      .filter(Boolean)
      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0]
      ?.toISOString?.() || null,
  });

  const pendingCheckback = await getPendingCheckback(client.id);

  const sellerMarketing =
    client.type === 'SELLER'
      ? await loadSellerPortalMarketing(client.id).catch(() => ({
          estateos: null,
          activeChannels: [],
          sellerNextStep: null,
          pendingDecisions: [],
          marketingTimeline: [],
        }))
      : null;

  const nextStep = resolveClientNextStep({
    type: client.type,
    email: client.email,
    phone: client.phone,
    emailVerifiedAt: client.emailVerifiedAt,
    phoneVerifiedAt: client.phoneVerifiedAt,
    linkedUserId: client.linkedUserId,
    hasCriteria: Boolean(client.buyerPreference),
    matchCount: client.matches.length,
    sentCount: client.matches.filter((m) => m.notifiedAt).length,
    feedbackCount: client.matches.filter((m) =>
      clientFeedbackHasContent(parseClientOfferFeedback(m.clientFeedback)),
    ).length,
    meetingStatus: meeting?.status ?? null,
    presentationStatus: presentation?.status ?? null,
    acquisitionStatus: acquisition?.status ?? null,
    linkedOfferId: client.linkedOfferId,
    pendingIntelligenceCheckback: Boolean(pendingCheckback),
  });

  return NextResponse.json({
    success: true,
    client: {
      ...shapeClientListItem(client),
      nextStep,
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
      matches: attachMatchImportBrief(
        client.matches.map((m) => ({
          id: m.id,
          score: m.score,
          notifiedAt: m.notifiedAt?.toISOString() ?? null,
          sharedAt: m.sharedAt?.toISOString() ?? null,
          clientFeedback: m.clientFeedback,
          clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
          intelligenceSent: Boolean(m.intelligenceSent),
          intelligenceReason: m.intelligenceReason || null,
          offer: shapeAgencyClientMatchOffer(m.offer),
        })),
        await listMatchImportBriefs(client.matches.map((m) => m.offer.id)),
      ),
      intelligence: shapeIntelligenceSettings(client, client.buyerPreference),
      pendingCheckback,
      meeting,
      presentation,
      journey,
      messages: portalChat.messages,
      portalUnreadCount: portalChat.unreadCount,
      activities: client.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        offerId: a.offerId,
        createdAt: a.createdAt.toISOString(),
        metadata: a.metadata,
        visibleToClient: isActivityVisibleToClient(a.metadata),
      })),
      sellerMarketing: sellerMarketing
        ? {
            estateos: sellerMarketing.estateos,
            activeChannels: sellerMarketing.activeChannels,
            sellerNextStep: sellerMarketing.sellerNextStep,
            pendingDecisions: sellerMarketing.pendingDecisions,
            marketingTimeline: sellerMarketing.marketingTimeline,
          }
        : null,
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
  const nextPeselDigits = nextPesel !== undefined ? normalizePeselDigits(nextPesel) : undefined;
  const nextPeselHash = nextPesel !== undefined ? hashPesel(nextPeselDigits) : undefined;
  const peselCollision =
    nextPeselDigits
      ? await findPeselCollision({ pesel: nextPeselDigits, excludeId: clientId })
      : { exists: false, message: null };

  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      firstName: body.firstName != null ? String(body.firstName).trim() : undefined,
      lastName: body.lastName != null ? String(body.lastName).trim() : undefined,
      email: nextEmail,
      phone: nextPhone,
      pesel: nextPesel !== undefined ? nextPeselDigits : undefined,
      peselHash: nextPesel !== undefined ? nextPeselHash : undefined,
      notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined,
      ...(existing.type === 'SELLER'
        ? {
            sellerTransactionType: body.sellerTransactionType,
            sellerPropertyType:
              body.sellerPropertyType != null
                ? parseSellerPropertyType(body.sellerPropertyType)
                : undefined,
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

  if (body.intelligence && typeof body.intelligence === 'object') {
    await ensureIntelligenceLockedFieldsColumn();
    const intelPatch = parseIntelligencePatch(body.intelligence);
    if (intelPatch && Object.keys(intelPatch).length) {
      await prisma.agencyClient.update({
        where: { id: clientId },
        data: intelPatch,
      });
    }
  }

  if (body.buyerFilters || body.alsoSearching === true) {
    const prefData = webRadarFiltersToBuyerPrefCreate(
      (body.buyerFilters || {}) as WebRadarFilters,
    );
    const previousPrice = existing.buyerPreference?.maxPrice ?? null;
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
    const nextPrice = prefData.maxPrice ?? null;
    if (nextPrice != null && Number(nextPrice) !== Number(previousPrice)) {
      const current = await prisma.agencyClient.findUnique({
        where: { id: clientId },
        select: { intelligenceLockedFields: true, buyerPreference: true },
      });
      const locks = parseIntelligenceLocks(
        (body.intelligence as { lockedFields?: unknown } | undefined)?.lockedFields ??
          current?.intelligenceLockedFields,
        current?.buyerPreference || existing.buyerPreference,
      );
      locks.maxPrice = true;
      await ensureIntelligenceLockedFieldsColumn();
      await prisma.agencyClient.update({
        where: { id: clientId },
        data: { intelligenceLockedFields: locks },
      });
    }
    await refreshAgencyClientMatches(clientId);
  } else if (body.alsoSearching === false && existing.buyerPreference) {
    await prisma.agencyClientMatch.deleteMany({ where: { clientId } });
    await prisma.agencyClientBuyerPreference.delete({ where: { clientId } });
  }

  return NextResponse.json({
    success: true,
    peselWarning: peselCollision.exists
      ? { exists: true, message: peselCollision.message }
      : null,
  });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const result = await archiveAgencyClients({ agencyUserId, clientIds: [clientId] });
  if (!result.archivedIds.length) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...result });
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

  if (action === 'intelligence_preview') {
    const owned = await prisma.agencyClient.findFirst({ where: { id: clientId, agencyUserId }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    const { pick } = await pickIntelligenceOffer(clientId, { preview: true });
    return NextResponse.json({ success: true, pick });
  }

  if (action === 'intelligence_send') {
    const owned = await prisma.agencyClient.findFirst({ where: { id: clientId, agencyUserId }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    const result = await sendIntelligenceOffer({ clientId, force: true });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'portal_hunt') {
    try {
      const result = await huntNieruchomosciOnlineForClient({
        clientId,
        agencyUserId,
        mode: body.mode === 'import' ? 'import' : 'preview',
        send: body.mode === 'import' ? body.send !== false : false,
        count: Number(body.count) || undefined,
        urls: Array.isArray(body.urls) ? body.urls.map(String) : undefined,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się przeszukać Nieruchomości-Online.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
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
      skipIfNotified: body.allowResend ? false : undefined,
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
      allowResend: Boolean(body.allowResend),
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
        visibleToClient: body.visibleToClient === true,
        portal: body.portal ? String(body.portal) : null,
        status: body.status ? String(body.status) : 'active',
        note: body.note ? String(body.note) : null,
        publishedAt: parseOptionalDate(body.publishedAt),
        renewalDueAt: parseOptionalDate(body.renewalDueAt),
        evidenceUrl: body.evidenceUrl ? String(body.evidenceUrl) : null,
        evidenceName: body.evidenceName ? String(body.evidenceName) : null,
        evidenceMimeType: body.evidenceMimeType ? String(body.evidenceMimeType) : null,
      });
      if (!recorded.ok) {
        return NextResponse.json({ error: recorded.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        preview,
        activityId: recorded.activityId,
        visibleToClient: recorded.visibleToClient,
        emailed: recorded.emailed,
        pushed: recorded.pushed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać linku.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === 'update_external_portal') {
    const activityId = Number(body.activityId);
    if (!Number.isFinite(activityId)) {
      return NextResponse.json({ error: 'Brak ID publikacji.' }, { status: 400 });
    }
    const result = await updateExternalPortalListing({
      clientId,
      agencyUserId,
      activityId,
      url: body.url != null ? String(body.url) : undefined,
      status: body.status != null ? String(body.status) : undefined,
      note: body.note != null ? String(body.note) : undefined,
      renewalDueAt: parseOptionalDate(body.renewalDueAt),
      visibleToClient: body.visibleToClient === true ? true : body.visibleToClient === false ? false : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, activityId: result.activityId });
  }

  if (action === 'remove_external_portal') {
    const activityId = Number(body.activityId);
    if (!Number.isFinite(activityId)) {
      return NextResponse.json({ error: 'Brak ID publikacji.' }, { status: 400 });
    }
    const result = await removeExternalPortalListing({
      clientId,
      agencyUserId,
      activityId,
      note: body.note != null ? String(body.note) : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, activityId: result.activityId });
  }

  if (action === 'set_marketing_visibility') {
    const activityId = Number(body.activityId);
    if (!Number.isFinite(activityId)) {
      return NextResponse.json({ error: 'Brak ID wpisu.' }, { status: 400 });
    }
    const result = await setMarketingActivityVisibility({
      clientId,
      agencyUserId,
      activityId,
      visibleToClient: body.visibleToClient === true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'publish_latest_estateos_promotion') {
    const offerId = Number(body.offerId);
    const activity = await prisma.agencyClientActivity.findFirst({
      where: {
        clientId,
        agencyUserId,
        ...(Number.isFinite(offerId) ? { offerId } : {}),
        kind: { in: [MARKETING_ACTIVITY.ESTATEOS_PROMOTED, 'LISTING_FEATURED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!activity) {
      return NextResponse.json(
        { error: 'Nie znaleziono ostatniego wyróżnienia EstateOS™.' },
        { status: 404 },
      );
    }
    const result = await setMarketingActivityVisibility({
      clientId,
      agencyUserId,
      activityId: activity.id,
      visibleToClient: true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, activityId: activity.id, ...result });
  }

  if (action === 'add_marketing_note') {
    const note = String(body.note || body.body || '').trim();
    if (note.length < 3) {
      return NextResponse.json({ error: 'Wpisz krótką notatkę marketingową.' }, { status: 400 });
    }
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { linkedOfferId: true },
    });
    const result = await recordMarketingActivity({
      clientId,
      agencyUserId,
      kind: MARKETING_ACTIVITY.MARKETING_NOTE,
      title: String(body.title || 'Aktualizacja promocji').slice(0, 255),
      body: note,
      offerId: client?.linkedOfferId,
      visibleToClient: body.visibleToClient === true,
      metadata: { note },
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'set_seller_next_step') {
    const result = await upsertSellerNextStep({
      clientId,
      agencyUserId,
      currentStep: String(body.currentStep || ''),
      nextAction: String(body.nextAction || ''),
      clientMessage: body.clientMessage != null ? String(body.clientMessage) : null,
      dueAt: parseOptionalDate(body.dueAt),
      visibleToClient: body.visibleToClient === true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, sellerNextStep: result.nextStep });
  }

  if (action === 'request_client_decision') {
    const result = await createClientDecisionRequest({
      clientId,
      agencyUserId,
      kind: String(body.kind || 'other'),
      title: String(body.title || ''),
      clientMessage: String(body.clientMessage || body.message || ''),
      dueAt: parseOptionalDate(body.dueAt),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, decision: result.decision });
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

  if (['list_portal_messages', 'mark_portal_messages_read', 'portal_typing'].includes(action)) {
    const owned = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
  }

  if (action === 'list_portal_messages') {
    const { messages, unreadCount } = await getPortalChatState(clientId, 'agent');
    return NextResponse.json({
      success: true,
      messages,
      unreadCount,
      peerTyping: isPortalPeerTyping(clientId, 'agent'),
    });
  }

  if (action === 'mark_portal_messages_read') {
    await markPortalChatRead(clientId, 'agent');
    return NextResponse.json({ success: true, unreadCount: 0 });
  }

  if (action === 'portal_typing') {
    markPortalTyping(clientId, 'agent');
    return NextResponse.json({ success: true });
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
      select: { id: true, type: true, firstName: true, lastName: true, linkedOfferId: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
    }
    const location = body.location ? String(body.location).trim() : '';
    const notes = body.notes ? String(body.notes).trim() : '';
    const offerIdRaw = Number(body.offerId || 0);
    const offerId = Number.isFinite(offerIdRaw) && offerIdRaw > 0 ? offerIdRaw : client.linkedOfferId || null;
    if (!isMeeting && client.type === 'BUYER' && !offerId) {
      return NextResponse.json({ error: 'Podaj ID oferty, którą chcesz prezentować kupującemu.' }, { status: 400 });
    }

    let counterpartId: number | null = null;
    if (!isMeeting && offerId) {
      if (client.type === 'BUYER') {
        const seller = await prisma.agencyClient.findFirst({
          where: { agencyUserId, type: 'SELLER', linkedOfferId: offerId, status: 'ACTIVE' },
          select: { id: true },
        });
        counterpartId = seller?.id || null;
      } else if (client.type === 'SELLER') {
        const buyerId = Number(body.buyerClientId || 0);
        if (Number.isFinite(buyerId) && buyerId > 0) counterpartId = buyerId;
      }
    }

    const metadata = {
      startsAt: startsAt.toISOString(),
      location: location || null,
      notes: notes || null,
      proposedBy: 'agent',
      status: isMeeting ? 'confirmed' : 'pending',
      offerId,
      buyerClientId: client.type === 'BUYER' ? client.id : counterpartId,
      sellerClientId: client.type === 'SELLER' ? client.id : counterpartId,
    };

    const targets = [clientId, ...(counterpartId && counterpartId !== clientId ? [counterpartId] : [])];
    for (const targetId of targets) {
      const target = targetId === clientId
        ? client
        : await prisma.agencyClient.findFirst({
            where: { id: targetId, agencyUserId, status: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true },
          });
      if (!target) continue;
      await prisma.agencyClientActivity.create({
        data: {
          clientId: targetId,
          agencyUserId,
          offerId,
          kind: isMeeting ? JOURNEY_ACTIVITY.MEETING : JOURNEY_ACTIVITY.PRESENTATION,
          title: isMeeting
            ? `Spotkanie · ${target.firstName} ${target.lastName}`
            : `Prezentacja oferty${offerId ? ` #${offerId}` : ''} · ${target.firstName} ${target.lastName}`,
          body: [startsAt.toLocaleString('pl-PL'), location, notes].filter(Boolean).join(' · '),
          metadata,
        },
      });
      await emailClientSchedule({
        clientId: targetId,
        kind: isMeeting ? 'meeting' : 'presentation',
        mode: isMeeting ? 'confirmed' : 'proposed',
        startsAt,
        location: location || null,
        notes: notes || null,
      });
    }
    await sendNotification({
      userId: agencyUserId,
      type: 'CRM_EVENT',
      title: isMeeting ? 'Termin spotkania' : 'Propozycja prezentacji',
      body: `${client.firstName} ${client.lastName} · ${startsAt.toLocaleString('pl-PL')}${offerId ? ` · oferta #${offerId}` : ''}`,
      data: crmAgentPushData(clientId, { notificationType: 'crm_client_schedule' }),
    }).catch(() => {});
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
