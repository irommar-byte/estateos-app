import { prisma } from "@/lib/prisma";
import { activePublicationOfferIds } from "@/lib/offerPublication";
import { canShowOfferOnPublicMarket } from "@/lib/offerMarketVisibility";
import {
  buildLegacyPreferenceVector,
  createDiscoveryProfileSnapshot,
  diversifiedDiscoveryRank,
  scoreDiscoveryCandidate,
} from "@/lib/discovery/engine";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import { absolutizeMediaUrl } from "@/lib/offerShareLanding";
import { DISCOVERY_ENGINE_VERSION, type DiscoveryScoredCandidate } from "@/lib/discovery/types";

const OFFER_SELECT = {
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
} as const;

function topAffinityCities(cityStats: unknown, limit = 3): string[] {
  if (!cityStats || typeof cityStats !== "object") return [];
  return Object.entries(cityStats as Record<string, number>)
    .map(([key, value]) => [String(key || "").trim(), Number(value) || 0] as const)
    .filter(([key, value]) => key.length > 0 && value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

async function loadForYouOfferPool(input: {
  topCities: string[];
  transaction?: string;
}): Promise<
  Array<{
    id: number;
    title: string | null;
    price: number | null;
    pricePln: number | null;
    priceCurrency: string | null;
    listPricePln: number | null;
    city: string | null;
    district: string | null;
    propertyType: string | null;
    transactionType: string | null;
    area: number | null;
    rooms: number | null;
    hasBalcony: boolean | null;
    hasParking: boolean | null;
    hasGarden: boolean | null;
    hasElevator: boolean | null;
    isFurnished: boolean | null;
    status: string;
    expiresAt: Date | null;
    images: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  const txFilter = String(input.transaction || "").trim().toUpperCase();
  const baseWhere: {
    status: "ACTIVE";
    city?: { in: string[] };
    transactionType?: "RENT" | { in: ("SALE" | "SELL")[] };
  } = { status: "ACTIVE" };

  if (txFilter === "SALE" || txFilter === "SELL") {
    baseWhere.transactionType = { in: ["SALE", "SELL"] };
  } else if (txFilter === "RENT") {
    baseWhere.transactionType = "RENT";
  }

  if (input.topCities.length > 0) {
    const [affinity, explore] = await Promise.all([
      prisma.offer.findMany({
        where: { ...baseWhere, city: { in: input.topCities } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: OFFER_SELECT,
      }),
      prisma.offer.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        take: 80,
        select: OFFER_SELECT,
      }),
    ]);
    const seen = new Set<number>();
    const merged: typeof affinity = [];
    for (const row of [...affinity, ...explore]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    return merged;
  }

  return prisma.offer.findMany({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    take: 150,
    select: OFFER_SELECT,
  });
}

export type DiscoveryForYouItem = {
  id: number;
  offerId: number;
  title: string;
  city: string;
  district: string;
  price: number;
  pricePln: number | null;
  priceCurrency: string;
  listPricePln: number | null;
  propertyType: string;
  transactionType: string;
  area: number;
  imageUrl: string | null;
  score: number;
  reason: string;
  exploreFlag: boolean;
  createdAt: string;
};

export type DiscoveryForYouResult = {
  items: DiscoveryForYouItem[];
  profile: {
    confidence: number;
    decisionCount: number;
    searchPhase: string;
    engineVersion: string;
    ready: boolean;
  };
  explain: { offerId: number; reason: string; score: number } | null;
};

function toItem(row: DiscoveryScoredCandidate): DiscoveryForYouItem {
  return {
    id: row.id,
    offerId: row.id,
    title: row.title || `Oferta #${row.id}`,
    city: row.city || "",
    district: row.district || "",
    price: Number(row.price) || 0,
    pricePln: row.pricePln == null ? null : Number(row.pricePln),
    priceCurrency: String(row.priceCurrency || "PLN"),
    listPricePln: row.listPricePln == null ? null : Number(row.listPricePln),
    propertyType: String(row.propertyType || ""),
    transactionType: String(row.transactionType || ""),
    area: Number(row.area) || 0,
    imageUrl: (() => {
      const raw = resolveOfferPrimaryImage({ images: row.images });
      return raw ? absolutizeMediaUrl(raw) || null : null;
    })(),
    score: row.score,
    reason: row.reason,
    exploreFlag: Boolean(row.exploreFlag),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/**
 * Soft “for you” ranking for WWW catalog / explainers.
 * No gallery/embedding side-effects (those stay on mobile feed).
 */
export async function buildDiscoveryForYou(input: {
  userId: number;
  limit?: number;
  transaction?: string | null;
  explainOfferId?: number | null;
}): Promise<DiscoveryForYouResult> {
  const limit = Math.min(24, Math.max(1, input.limit ?? 12));
  const txFilter = String(input.transaction || "")
    .trim()
    .toUpperCase();
  const explainOfferId =
    typeof input.explainOfferId === "number" && Number.isFinite(input.explainOfferId)
      ? input.explainOfferId
      : null;

  const [profile, legacyPreferenceSource, recentEvents] = await Promise.all([
    prisma.discoveryProfile.findUnique({
      where: { userId: input.userId },
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
        likesCount: true,
        dislikesCount: true,
        fastTrackCount: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: input.userId },
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
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { eventType: true, offerId: true, visitOutcome: true },
    }),
  ]);

  const offers = await loadForYouOfferPool({
    topCities: topAffinityCities(profile?.cityStats),
    transaction: txFilter,
  });

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

  const decisionCount =
    Number(profile?.likesCount || 0) +
    Number(profile?.dislikesCount || 0) +
    Number(profile?.fastTrackCount || 0);

  const empty = (ready = false): DiscoveryForYouResult => ({
    items: [],
    profile: {
      confidence: profileSnapshot.confidence,
      decisionCount,
      searchPhase: profileSnapshot.searchPhase,
      engineVersion: DISCOVERY_ENGINE_VERSION,
      ready,
    },
    explain: null,
  });

  if (profileSnapshot.searchPhase === "COMPLETED") {
    return empty(false);
  }

  // Soft threshold: need a few decisions OR some confidence before personalizing the rail.
  const ready = decisionCount >= 3 || profileSnapshot.confidence >= 0.12;
  if (!ready && !explainOfferId) {
    return empty(false);
  }

  const activePublicationIds = await activePublicationOfferIds(offers.map((o) => o.id));

  const dislikedOfferIds = new Set(
    recentEvents
      .filter(
        (event) =>
          event.eventType === "DISCOVERY_DISLIKE" ||
          (event.eventType === "DISCOVERY_VISIT_FEEDBACK" && event.visitOutcome === "NO"),
      )
      .map((event) => event.offerId)
      .filter((id): id is number => Number.isFinite(id)),
  );
  const likedOfferIds = new Set(
    recentEvents
      .filter((event) =>
        ["DISCOVERY_LIKE", "DISCOVERY_PRIORITY", "DISCOVERY_FAST_TRACK", "DISCOVERY_SAVE"].includes(
          event.eventType,
        ),
      )
      .map((event) => event.offerId)
      .filter((id): id is number => Number.isFinite(id)),
  );

  const recentShown = new Set<number>();

  let explain: DiscoveryForYouResult["explain"] = null;
  if (explainOfferId) {
    let target = offers.find((o) => o.id === explainOfferId) || null;
    if (!target) {
      target = await prisma.offer.findUnique({
        where: { id: explainOfferId },
        select: OFFER_SELECT,
      });
    }
    if (target) {
      const pubIds = await activePublicationOfferIds([target.id]);
      if (canShowOfferOnPublicMarket(target, pubIds)) {
        const scored = scoreDiscoveryCandidate({
          candidate: { ...target, embeddingVector: null },
          profile: profileSnapshot,
          recentShown,
          recentDisliked: dislikedOfferIds,
          recentLiked: likedOfferIds,
        });
        if (scored.reason) {
          explain = { offerId: scored.id, reason: scored.reason, score: scored.score };
        }
      }
    }
  }

  if (!ready) {
    return { ...empty(false), explain };
  }

  const scored = offers
    .filter((offer) => !dislikedOfferIds.has(offer.id) && !likedOfferIds.has(offer.id))
    .filter((offer) => canShowOfferOnPublicMarket(offer, activePublicationIds))
    .filter((offer) => {
      if (!txFilter) return true;
      const tx = String(offer.transactionType || "").toUpperCase();
      if (txFilter === "SALE" || txFilter === "SELL") return tx === "SALE" || tx === "SELL";
      if (txFilter === "RENT") return tx === "RENT";
      return true;
    })
    .map((offer) =>
      scoreDiscoveryCandidate({
        candidate: { ...offer, embeddingVector: null },
        profile: profileSnapshot,
        recentShown,
        recentDisliked: dislikedOfferIds,
        recentLiked: likedOfferIds,
      }),
    )
    .filter((row) => row.score > 8);

  const ranked = diversifiedDiscoveryRank(scored, limit);

  return {
    items: ranked.map(toItem),
    profile: {
      confidence: profileSnapshot.confidence,
      decisionCount,
      searchPhase: profileSnapshot.searchPhase,
      engineVersion: DISCOVERY_ENGINE_VERSION,
      ready: true,
    },
    explain,
  };
}
