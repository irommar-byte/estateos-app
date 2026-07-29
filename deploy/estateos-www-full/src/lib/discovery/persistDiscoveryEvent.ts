import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { DISCOVERY_META } from '@/lib/discoveryInsights';
import { updateDiscoveryProfileFromEvent } from '@/lib/discovery/behaviour';
import { buildDiscoveryEventIdempotencyKey } from '@/lib/discovery/events';
import { createDiscoveryProfileSnapshot } from '@/lib/discovery/engine';
import type { DiscoveryCandidate, DiscoveryIncomingEvent } from '@/lib/discovery/types';

function incrementLegacy(map: Record<string, number>, key: string, delta: number) {
  if (!key) return;
  map[key] = Number(map[key] || 0) + delta;
}

function tropeId() {
  return `dt_${crypto.randomUUID()}`;
}

export type PersistDiscoveryEventResult =
  | { ok: true; id: string; idempotent: boolean }
  | { ok: false; status: 403 | 404 | 500; error: string };

export type PersistDiscoveryEventOptions = {
  /** When PRIORITY/SERIOUS: also upsert DiscoveryTrope as SERIOUS (web + mobile). */
  upsertSeriousTrope?: boolean;
};

/**
 * Shared Discovery event persistence for mobile + web.
 * One source of truth — Apple-grade: no divergent side effects between clients.
 */
export async function persistDiscoveryEvent(
  userId: number,
  event: DiscoveryIncomingEvent,
  options: PersistDiscoveryEventOptions = {},
): Promise<PersistDiscoveryEventResult> {
  const idempotencyKey = buildDiscoveryEventIdempotencyKey(userId, event);
  const existingEvent = await prisma.discoveryEvent.findUnique({ where: { idempotencyKey } });
  if (existingEvent) {
    return { ok: true, id: String(existingEvent.id), idempotent: true };
  }

  const offer = event.offerId
    ? await prisma.offer.findUnique({
        where: { id: event.offerId },
        select: {
          id: true,
          title: true,
          city: true,
          district: true,
          propertyType: true,
          transactionType: true,
          price: true,
          pricePln: true,
          priceCurrency: true,
          listPricePln: true,
          area: true,
          rooms: true,
          hasBalcony: true,
          hasParking: true,
          hasGarden: true,
          hasElevator: true,
          isFurnished: true,
          images: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  if (event.offerId && !offer) {
    return { ok: false, status: 404, error: 'Oferta nie istnieje' };
  }

  const embedding = offer
    ? await prisma.discoveryEmbeddingJob.findFirst({
        where: { offerId: offer.id, status: 'READY' },
        select: { vector: true },
      })
    : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (event.sessionId) {
        const session = await tx.discoverySession.findUnique({ where: { id: event.sessionId } });
        if (session && session.userId !== userId) {
          throw new Error('DISCOVERY_SESSION_FORBIDDEN');
        }
        await tx.discoverySession.upsert({
          where: { id: event.sessionId },
          create: { id: event.sessionId, userId, lastActivityAt: event.at },
          update: {
            lastActivityAt: event.at,
            status: event.eventType === 'DISCOVERY_PHASE_END' ? 'COMPLETED' : 'ACTIVE',
            ...(event.eventType === 'DISCOVERY_PAUSE' ? { tempoMode: 'PAUSED', endedAt: event.at } : {}),
          },
        });
      }

      const reasonOnlyFollowUp =
        event.eventType === 'DISCOVERY_DISLIKE' && !!event.reasonCode && !!event.offerId
          ? await tx.discoveryEvent.findFirst({
              where: {
                userId,
                offerId: event.offerId,
                eventType: 'DISCOVERY_DISLIKE',
                reasonCode: null,
                createdAt: { gte: new Date(event.at.getTime() - 10 * 60_000) },
              },
              select: { id: true },
            })
          : null;

      const profileEvent = reasonOnlyFollowUp ? { ...event, legacyReasonOnly: true } : event;
      const existingProfile = await tx.discoveryProfile.findUnique({ where: { userId } });
      const profile = createDiscoveryProfileSnapshot({
        tasteVector: existingProfile?.tasteVector,
        preferenceVector: existingProfile?.preferenceVector,
        confidence: existingProfile?.confidence,
        contradictionIndex: existingProfile?.contradictionIndex,
        explorationHunger: existingProfile?.explorationHunger,
        searchPhase: existingProfile?.searchPhase,
        cityStats: existingProfile?.cityStats,
        districtStats: existingProfile?.districtStats,
        propertyStats: existingProfile?.propertyStats,
        reasonStats: existingProfile?.reasonStats,
      });

      const candidate = offer
        ? ({
            ...offer,
            embeddingVector: Array.isArray(embedding?.vector)
              ? embedding.vector.map(Number).filter(Number.isFinite)
              : null,
          } as DiscoveryCandidate)
        : null;

      const nextProfile =
        profileEvent.legacyReasonOnly || !candidate
          ? profile
          : updateDiscoveryProfileFromEvent({ existing: profile, event: profileEvent, candidate });

      const cityStats = { ...((existingProfile?.cityStats as Record<string, number>) || {}) };
      const districtStats = { ...((existingProfile?.districtStats as Record<string, number>) || {}) };
      const propertyStats = { ...((existingProfile?.propertyStats as Record<string, number>) || {}) };
      const reasonStats = { ...((existingProfile?.reasonStats as Record<string, number>) || {}) };

      const delta = profileEvent.legacyReasonOnly
        ? 0
        : event.eventType === 'DISCOVERY_LIKE' || event.eventType === 'DISCOVERY_PRIORITY'
          ? 1
          : event.eventType === 'DISCOVERY_DISLIKE' ||
              (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'NO')
            ? -1
            : 0;

      if (delta) {
        incrementLegacy(cityStats, candidate?.city || '', delta);
        incrementLegacy(districtStats, candidate?.district || '', delta);
        incrementLegacy(propertyStats, String(candidate?.propertyType || ''), delta);
      }
      if (event.reasonCode) incrementLegacy(reasonStats, event.reasonCode, 1);

      if (candidate && !profileEvent.legacyReasonOnly) {
        const candidatePrice = Number(candidate.pricePln ?? candidate.price ?? 0);
        if (event.eventType === 'DISCOVERY_LIKE' || event.eventType === 'DISCOVERY_PRIORITY') {
          reasonStats[DISCOVERY_META.priceLikedSum] =
            Number(reasonStats[DISCOVERY_META.priceLikedSum] || 0) + candidatePrice;
          reasonStats[DISCOVERY_META.priceLikedN] = Number(reasonStats[DISCOVERY_META.priceLikedN] || 0) + 1;
          reasonStats[DISCOVERY_META.areaLikedSum] =
            Number(reasonStats[DISCOVERY_META.areaLikedSum] || 0) + Number(candidate.area || 0);
          reasonStats[DISCOVERY_META.areaLikedN] = Number(reasonStats[DISCOVERY_META.areaLikedN] || 0) + 1;
          const txKey = candidate.transactionType === 'RENT' ? DISCOVERY_META.txRent : DISCOVERY_META.txSell;
          reasonStats[txKey] = Number(reasonStats[txKey] || 0) + 1;
        } else if (event.eventType === 'DISCOVERY_DISLIKE') {
          reasonStats[DISCOVERY_META.priceDislikedSum] =
            Number(reasonStats[DISCOVERY_META.priceDislikedSum] || 0) + candidatePrice;
          reasonStats[DISCOVERY_META.priceDislikedN] =
            Number(reasonStats[DISCOVERY_META.priceDislikedN] || 0) + 1;
        }
      }

      const evt = await tx.discoveryEvent.create({
        data: {
          userId,
          sessionId: event.sessionId,
          idempotencyKey,
          eventType: event.eventType,
          offerId: event.offerId,
          photoIndex: event.photoIndex,
          score: event.score,
          reasonCode: event.reasonCode,
          visitOutcome: event.visitOutcome,
          correctionTarget: event.correctionTarget,
          dwellMs: event.dwellMs,
          decisionLatencyMs: event.decisionLatencyMs,
          source: event.source,
          platform: event.platform,
          at: event.at,
        },
      });

      await tx.discoveryProfile.upsert({
        where: { userId },
        create: {
          userId,
          likesCount: event.eventType === 'DISCOVERY_LIKE' ? 1 : 0,
          dislikesCount: event.eventType === 'DISCOVERY_DISLIKE' && !profileEvent.legacyReasonOnly ? 1 : 0,
          fastTrackCount: event.eventType === 'DISCOVERY_PRIORITY' ? 1 : 0,
          opensCount: event.eventType === 'DISCOVERY_DEPTH_OPEN' ? 1 : 0,
          reasonStats,
          cityStats,
          districtStats,
          propertyStats,
          tasteVector: nextProfile.tasteVector,
          preferenceVector: nextProfile.preferenceVector,
          confidence: nextProfile.confidence,
          contradictionIndex: nextProfile.contradictionIndex,
          explorationHunger: nextProfile.explorationHunger,
          searchPhase: nextProfile.searchPhase,
          ...(event.eventType === 'DISCOVERY_CORRECTION' ? { lastCorrectionAt: event.at } : {}),
          ...(event.eventType === 'DISCOVERY_VISIT_FEEDBACK' ? { lastVisitAt: event.at } : {}),
        },
        update: {
          likesCount: { increment: event.eventType === 'DISCOVERY_LIKE' ? 1 : 0 },
          dislikesCount: {
            increment: event.eventType === 'DISCOVERY_DISLIKE' && !profileEvent.legacyReasonOnly ? 1 : 0,
          },
          fastTrackCount: { increment: event.eventType === 'DISCOVERY_PRIORITY' ? 1 : 0 },
          opensCount: { increment: event.eventType === 'DISCOVERY_DEPTH_OPEN' ? 1 : 0 },
          reasonStats,
          cityStats,
          districtStats,
          propertyStats,
          tasteVector: nextProfile.tasteVector,
          preferenceVector: nextProfile.preferenceVector,
          confidence: nextProfile.confidence,
          contradictionIndex: nextProfile.contradictionIndex,
          explorationHunger: nextProfile.explorationHunger,
          searchPhase: nextProfile.searchPhase,
          ...(event.eventType === 'DISCOVERY_CORRECTION' ? { lastCorrectionAt: event.at } : {}),
          ...(event.eventType === 'DISCOVERY_VISIT_FEEDBACK' ? { lastVisitAt: event.at } : {}),
        },
      });

      if (event.sessionId) {
        const currentSession = await tx.discoverySession.findUnique({
          where: { id: event.sessionId },
          select: { shownOfferIds: true, decisionCount: true },
        });
        const shownOfferIds = Array.isArray(currentSession?.shownOfferIds)
          ? currentSession.shownOfferIds.map((id) => Number(id)).filter(Number.isFinite)
          : [];
        if (event.eventType === 'DISCOVERY_VIEW_CARD' && event.offerId && !shownOfferIds.includes(event.offerId)) {
          shownOfferIds.push(event.offerId);
        }
        const isDecision =
          ['DISCOVERY_LIKE', 'DISCOVERY_DISLIKE', 'DISCOVERY_PRIORITY'].includes(event.eventType) &&
          !profileEvent.legacyReasonOnly;
        await tx.discoverySession.update({
          where: { id: event.sessionId },
          data: {
            shownOfferIds: shownOfferIds.slice(-120),
            decisionCount: (currentSession?.decisionCount || 0) + (isDecision ? 1 : 0),
            lastActivityAt: event.at,
          },
        });
      }

      if (
        options.upsertSeriousTrope &&
        event.eventType === 'DISCOVERY_PRIORITY' &&
        event.offerId &&
        Number.isFinite(event.offerId)
      ) {
        await tx.discoveryTrope.upsert({
          where: { userId_offerId: { userId, offerId: event.offerId } },
          create: {
            id: tropeId(),
            userId,
            offerId: event.offerId,
            priority: true,
            status: 'SERIOUS',
          },
          update: {
            priority: true,
            status: 'SERIOUS',
          },
        });
      }

      return evt;
    });

    return { ok: true, id: String(created.id), idempotent: false };
  } catch (error) {
    if (error instanceof Error && error.message === 'DISCOVERY_SESSION_FORBIDDEN') {
      return { ok: false, status: 403, error: 'Sesja Discovery nie należy do użytkownika' };
    }
    console.error('[DISCOVERY PERSIST ERROR]', error);
    return { ok: false, status: 500, error: 'Błąd serwera' };
  }
}
