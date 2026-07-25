import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import {
  buildLegacyPreferenceVector,
  createDiscoveryProfileSnapshot,
  diversifiedDiscoveryRank,
  scoreDiscoveryCandidate,
} from '@/lib/discovery/engine';
import { DISCOVERY_ENGINE_VERSION } from '@/lib/discovery/types';

export async function GET(req: Request) {
  try {
    const auth = await authorizeMobile(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;
    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || 'for_you');
    const limitRaw = Number(url.searchParams.get('limit') || 40);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 80) : 40;
    const sessionId = String(url.searchParams.get('sessionId') || '').trim() || null;

    if (mode !== 'for_you') {
      return NextResponse.json({ items: [], profile: null, session: null });
    }

    const [profile, legacyPreferenceSource, recentEvents, session, offers] = await Promise.all([
      prisma.discoveryProfile.findUnique({
        where: { userId },
        select: {
          tasteVector: true,
          preferenceVector: true,
          cityStats: true,
          districtStats: true,
          propertyStats: true,
          reasonStats: true,
          confidence: true,
          contradictionIndex: true,
          explorationHunger: true,
          searchPhase: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          searchTransactionType: true,
          searchDistricts: true,
          searchMaxPrice: true,
          searchAreaFrom: true,
          searchAreaTo: true,
          searchRooms: true,
        },
      }),
      prisma.discoveryEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 600,
        select: { eventType: true, offerId: true, visitOutcome: true },
      }),
      sessionId
        ? prisma.discoverySession.findFirst({
            where: { id: sessionId, userId },
            select: { id: true, shownOfferIds: true, tempoMode: true },
          })
        : null,
      prisma.offer.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          title: true,
          price: true,
          pricePln: true,
          priceCurrency: true,
          listPricePln: true,
          city: true,
          district: true,
          propertyType: true,
          transactionType: true,
          area: true,
          rooms: true,
          hasBalcony: true,
          hasParking: true,
          hasGarden: true,
          hasElevator: true,
          isFurnished: true,
          status: true,
          expiresAt: true,
          images: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const profileSnapshot = createDiscoveryProfileSnapshot({
      tasteVector: profile?.tasteVector,
      preferenceVector: profile?.preferenceVector || buildLegacyPreferenceVector(legacyPreferenceSource || {}),
      confidence: profile?.confidence,
      contradictionIndex: profile?.contradictionIndex,
      explorationHunger: profile?.explorationHunger,
      searchPhase: profile?.searchPhase,
      cityStats: profile?.cityStats,
      districtStats: profile?.districtStats,
      propertyStats: profile?.propertyStats,
      reasonStats: profile?.reasonStats,
    });

    if (profileSnapshot.searchPhase === 'COMPLETED') {
      return NextResponse.json({
        items: [],
        profile: {
          confidence: profileSnapshot.confidence,
          contradictionIndex: profileSnapshot.contradictionIndex,
          explorationHunger: profileSnapshot.explorationHunger,
          searchPhase: profileSnapshot.searchPhase,
          engineVersion: DISCOVERY_ENGINE_VERSION,
        },
        session: session ? { id: session.id, tempoMode: session.tempoMode } : null,
      });
    }

    const [activePublicationIds, readyEmbeddingRows] = await Promise.all([
      activePublicationOfferIds(offers.map((offer) => offer.id)),
      prisma.discoveryEmbeddingJob.findMany({
        where: { offerId: { in: offers.map((offer) => offer.id) }, status: 'READY' },
        select: { offerId: true, vector: true },
      }),
    ]);
    const embeddingByOfferId = new Map(
      readyEmbeddingRows.map((row) => [
        row.offerId,
        Array.isArray(row.vector) ? row.vector.map(Number).filter(Number.isFinite) : null,
      ]),
    );
    const dislikedOfferIds = new Set(
      recentEvents
        .filter((event) => event.eventType === 'DISCOVERY_DISLIKE' ||
          (event.eventType === 'DISCOVERY_VISIT_FEEDBACK' && event.visitOutcome === 'NO'))
        .map((event) => event.offerId)
        .filter((offerId): offerId is number => Number.isFinite(offerId)),
    );
    const likedOfferIds = new Set(
      recentEvents
        .filter((event) => ['DISCOVERY_LIKE', 'DISCOVERY_PRIORITY', 'DISCOVERY_FAST_TRACK', 'DISCOVERY_SAVE'].includes(event.eventType))
        .map((event) => event.offerId)
        .filter((offerId): offerId is number => Number.isFinite(offerId)),
    );
    const viewedOfferIds = new Set(
      recentEvents
        .filter((event) => event.eventType === 'DISCOVERY_VIEW_CARD' || event.eventType === 'DISCOVERY_SKIP')
        .map((event) => event.offerId)
        .filter((offerId): offerId is number => Number.isFinite(offerId)),
    );
    const recentShown = new Set(
      Array.isArray(session?.shownOfferIds)
        ? session.shownOfferIds.map((id) => Number(id)).filter(Number.isFinite)
        : [],
    );
    // Twarde wykluczenie: już ocenione + niedawno pokazane — talii nie zawracamy w kółko.
    const excludedOfferIds = new Set<number>([
      ...dislikedOfferIds,
      ...likedOfferIds,
      ...viewedOfferIds,
      ...recentShown,
    ]);

    const scored = offers
      .filter((offer) => !excludedOfferIds.has(offer.id))
      .filter((offer) => canShowOfferOnPublicMarket(offer, activePublicationIds))
      .map((offer) =>
        scoreDiscoveryCandidate({
          candidate: { ...offer, embeddingVector: embeddingByOfferId.get(offer.id) || null },
          profile: profileSnapshot,
          recentShown,
          recentDisliked: dislikedOfferIds,
          recentLiked: likedOfferIds,
        }),
      );
    const ranked = diversifiedDiscoveryRank(scored, limit);

    await Promise.all([
      ...ranked.slice(0, 30).map((item) =>
        prisma.discoveryGalleryPlan.upsert({
          where: { offerId: item.id },
          create: {
            id: `dgp_${item.id}_${Date.now().toString(36)}`,
            offerId: item.id,
            algorithmVersion: item.galleryPlan.algorithmVersion,
            sourceHash: item.galleryPlan.sourceHash,
            orderedAssets: item.galleryPlan.orderedAssets,
            assetRoles: item.galleryPlan.assetRoles,
          },
          update: {
            algorithmVersion: item.galleryPlan.algorithmVersion,
            sourceHash: item.galleryPlan.sourceHash,
            orderedAssets: item.galleryPlan.orderedAssets,
            assetRoles: item.galleryPlan.assetRoles,
          },
        }),
      ),
      ...ranked.slice(0, 30).map((item) =>
        prisma.discoveryEmbeddingJob.upsert({
          where: {
            offerId_modelVersion: {
              offerId: item.id,
              modelVersion: 'provider-agnostic-v1',
            },
          },
          create: {
            id: `dej_${item.id}_${Date.now().toString(36)}`,
            offerId: item.id,
            status: 'PENDING',
            modelVersion: 'provider-agnostic-v1',
            inputHash: item.galleryPlan.sourceHash,
          },
          update: {
            inputHash: item.galleryPlan.sourceHash,
          },
        }),
      ),
    ]);

    return NextResponse.json({
      items: ranked.map((item) => ({
        ...item,
        offerId: item.id,
        engineVersion: DISCOVERY_ENGINE_VERSION,
      })),
      profile: {
        preferredBudgetPln: profileSnapshot.tasteVector.price.likedCount
          ? Math.round(profileSnapshot.tasteVector.price.likedSum / profileSnapshot.tasteVector.price.likedCount)
          : null,
        preferredAreaM2: profileSnapshot.tasteVector.space.likedAreaCount
          ? Math.round(profileSnapshot.tasteVector.space.likedAreaSum / profileSnapshot.tasteVector.space.likedAreaCount)
          : null,
        interactions: profileSnapshot.tasteVector.behavioural.decisionCount,
        confidence: profileSnapshot.confidence,
        contradictionIndex: profileSnapshot.contradictionIndex,
        explorationHunger: profileSnapshot.explorationHunger,
        searchPhase: profileSnapshot.searchPhase,
        engineVersion: DISCOVERY_ENGINE_VERSION,
      },
      session: session ? { id: session.id, tempoMode: session.tempoMode } : null,
    });
  } catch (error) {
    console.error('[DISCOVERY FEED ERROR]', error);
    return NextResponse.json({ error: 'Nie udało się zbudować Discovery feed.' }, { status: 500 });
  }
}
