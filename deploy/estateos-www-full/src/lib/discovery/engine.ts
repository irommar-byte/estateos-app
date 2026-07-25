import { DISCOVERY_DNA, capComponent, clampScore, safeRatio } from './dna';
import { planDiscoveryGallery } from './gallery';
import type {
  DiscoveryCandidate,
  DiscoveryProfileSnapshot,
  DiscoveryReasonAtom,
  DiscoveryScoreComponents,
  DiscoveryScoredCandidate,
  NumericMap,
  PreferenceVector,
  TasteVector,
} from './types';

const EMPTY_MAP: NumericMap = {};

function asNumericMap(value: unknown): NumericMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, Number(raw)] as const)
      .filter(([, raw]) => Number.isFinite(raw)),
  );
}

function numberOr(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function emptyTasteVector(): TasteVector {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    affinity: {
      city: {},
      district: {},
      propertyType: {},
      transactionType: {},
    },
    price: { likedSum: 0, likedCount: 0, dislikedSum: 0, dislikedCount: 0, elasticity: 0.3 },
    space: { likedAreaSum: 0, likedAreaCount: 0, likedRoomsSum: 0, likedRoomsCount: 0 },
    behavioural: {
      decisionCount: 0,
      priorityCount: 0,
      visitPositiveCount: 0,
      visitNegativeCount: 0,
      medianDecisionLatencyMs: null,
      hesitationRate: 0,
    },
    semantic: { mu: null, count: 0 },
  };
}

export function emptyPreferenceVector(): PreferenceVector {
  return {
    version: 1,
    sourceTags: [],
    transactionPrior: {},
    cityPrior: {},
    budgetHypothesis: null,
    spaceHypothesis: null,
    strength: 0,
    expiresAt: null,
  };
}

export function buildLegacyPreferenceVector(input: {
  searchTransactionType?: string | null;
  searchDistricts?: string | null;
  searchMaxPrice?: number | null;
  searchAreaFrom?: number | null;
  searchAreaTo?: number | null;
  searchRooms?: number | null;
}): PreferenceVector {
  const cities: NumericMap = {};
  const districts = String(input.searchDistricts || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  // Legacy searchDistricts has no stable city relation; retain it only as a
  // source tag rather than inventing a false city prior.
  const transaction = String(input.searchTransactionType || '').toUpperCase();
  const areaFrom = Number(input.searchAreaFrom || 0);
  const areaTo = Number(input.searchAreaTo || 0);
  const areaCenter = areaFrom && areaTo ? (areaFrom + areaTo) / 2 : areaFrom || areaTo || null;
  const budget = Number(input.searchMaxPrice || 0);

  return {
    version: 1,
    sourceTags: [
      ...(transaction ? ['legacy_transaction'] : []),
      ...(districts.length ? ['legacy_districts'] : []),
      ...(budget ? ['legacy_budget'] : []),
    ],
    transactionPrior: transaction === 'SELL' || transaction === 'RENT' ? { [transaction]: 1 } : {},
    cityPrior: cities,
    budgetHypothesis: budget ? { center: budget, width: 0.45 } : null,
    spaceHypothesis: {
      areaCenter,
      roomsCenter: Number(input.searchRooms || 0) || null,
    },
    strength: Math.min(
      DISCOVERY_DNA.maxProfilePriorWeight,
      (transaction ? 0.12 : 0) + (districts.length ? 0.08 : 0) + (budget ? 0.12 : 0) + (areaCenter ? 0.08 : 0),
    ),
    expiresAt: null,
  };
}

export function parseTasteVector(raw: unknown): TasteVector {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const affinity = value.affinity && typeof value.affinity === 'object' ? value.affinity as Record<string, unknown> : {};
  const price = value.price && typeof value.price === 'object' ? value.price as Record<string, unknown> : {};
  const space = value.space && typeof value.space === 'object' ? value.space as Record<string, unknown> : {};
  const behavioural = value.behavioural && typeof value.behavioural === 'object'
    ? value.behavioural as Record<string, unknown>
    : {};
  const semantic = value.semantic && typeof value.semantic === 'object'
    ? value.semantic as Record<string, unknown>
    : {};

  return {
    ...emptyTasteVector(),
    version: Math.max(1, Math.round(numberOr(value.version, 1))),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    affinity: {
      city: asNumericMap(affinity.city),
      district: asNumericMap(affinity.district),
      propertyType: asNumericMap(affinity.propertyType),
      transactionType: asNumericMap(affinity.transactionType),
    },
    price: {
      likedSum: numberOr(price.likedSum),
      likedCount: numberOr(price.likedCount),
      dislikedSum: numberOr(price.dislikedSum),
      dislikedCount: numberOr(price.dislikedCount),
      elasticity: Math.max(0.05, Math.min(1, numberOr(price.elasticity, 0.3))),
    },
    space: {
      likedAreaSum: numberOr(space.likedAreaSum),
      likedAreaCount: numberOr(space.likedAreaCount),
      likedRoomsSum: numberOr(space.likedRoomsSum),
      likedRoomsCount: numberOr(space.likedRoomsCount),
    },
    behavioural: {
      decisionCount: numberOr(behavioural.decisionCount),
      priorityCount: numberOr(behavioural.priorityCount),
      visitPositiveCount: numberOr(behavioural.visitPositiveCount),
      visitNegativeCount: numberOr(behavioural.visitNegativeCount),
      medianDecisionLatencyMs:
        behavioural.medianDecisionLatencyMs == null ? null : numberOr(behavioural.medianDecisionLatencyMs),
      hesitationRate: Math.max(0, Math.min(1, numberOr(behavioural.hesitationRate))),
    },
    semantic: {
      mu: Array.isArray(semantic.mu) && semantic.mu.every((value) => Number.isFinite(Number(value)))
        ? semantic.mu.map(Number)
        : null,
      count: Math.max(0, Math.round(numberOr(semantic.count))),
    },
  };
}

export function tasteVectorFromLegacy(input: {
  cityStats?: unknown;
  districtStats?: unknown;
  propertyStats?: unknown;
  reasonStats?: unknown;
}): TasteVector {
  const taste = emptyTasteVector();
  const reasons = asNumericMap(input.reasonStats);
  taste.affinity.city = asNumericMap(input.cityStats);
  taste.affinity.district = asNumericMap(input.districtStats);
  taste.affinity.propertyType = asNumericMap(input.propertyStats);
  taste.price.likedSum = numberOr(reasons.__priceLikedSum);
  taste.price.likedCount = numberOr(reasons.__priceLikedN);
  taste.price.dislikedSum = numberOr(reasons.__priceDislikedSum);
  taste.price.dislikedCount = numberOr(reasons.__priceDislikedN);
  taste.space.likedAreaSum = numberOr(reasons.__areaLikedSum);
  taste.space.likedAreaCount = numberOr(reasons.__areaLikedN);
  taste.affinity.transactionType = {
    SELL: numberOr(reasons.__txSell),
    RENT: numberOr(reasons.__txRent),
  };
  taste.behavioural.decisionCount = Math.max(
    0,
    taste.price.likedCount + taste.price.dislikedCount,
  );
  return taste;
}

export function parsePreferenceVector(raw: unknown): PreferenceVector {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const budgetRaw = value.budgetHypothesis && typeof value.budgetHypothesis === 'object'
    ? value.budgetHypothesis as Record<string, unknown>
    : null;
  const spaceRaw = value.spaceHypothesis && typeof value.spaceHypothesis === 'object'
    ? value.spaceHypothesis as Record<string, unknown>
    : null;
  const expired =
    typeof value.expiresAt === 'string' && !Number.isNaN(new Date(value.expiresAt).getTime())
      ? new Date(value.expiresAt).getTime() < Date.now()
      : false;
  return {
    ...emptyPreferenceVector(),
    version: Math.max(1, Math.round(numberOr(value.version, 1))),
    sourceTags: Array.isArray(value.sourceTags) ? value.sourceTags.map(String).slice(0, 12) : [],
    transactionPrior: asNumericMap(value.transactionPrior),
    cityPrior: asNumericMap(value.cityPrior),
    budgetHypothesis:
      budgetRaw && numberOr(budgetRaw.center) > 0
        ? {
            center: numberOr(budgetRaw.center),
            width: Math.max(0.05, numberOr(budgetRaw.width, 0.35)),
          }
        : null,
    spaceHypothesis:
      spaceRaw && (numberOr(spaceRaw.areaCenter) > 0 || numberOr(spaceRaw.roomsCenter) > 0)
        ? {
            areaCenter: numberOr(spaceRaw.areaCenter) || null,
            roomsCenter: numberOr(spaceRaw.roomsCenter) || null,
          }
        : null,
    strength: expired ? 0 : Math.max(0, Math.min(DISCOVERY_DNA.maxProfilePriorWeight, numberOr(value.strength))),
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null,
  };
}

function affinity(map: NumericMap | undefined, key: string): number {
  return numberOr(map?.[key], 0);
}

function average(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}

function softDistance(value: number, center: number | null, width: number): number {
  if (!(value > 0) || !(center && center > 0)) return 0;
  const distance = Math.abs(Math.log(value) - Math.log(center));
  return Math.exp(-distance / Math.max(0.05, width));
}

function pushReason(reasons: DiscoveryReasonAtom[], code: DiscoveryReasonAtom['code'], strength: number, message: string, evidence: string | null) {
  if (strength <= 0) return;
  reasons.push({ code, strength: Math.round(strength * 100) / 100, message, evidence });
}

function reasonText(reasons: DiscoveryReasonAtom[], score: number): string {
  return reasons.sort((a, b) => b.strength - a.strength)[0]?.message ??
    (score >= 65 ? 'dopasowanie do historii Twoich wyborów' : 'nowy kierunek do sprawdzenia');
}

function candidateNovelty(candidate: DiscoveryCandidate, recentShown: Set<number>): number {
  return recentShown.has(candidate.id) ? 0 : 1;
}

export function deriveProfileConfidence(taste: TasteVector, contradictionIndex: number): number {
  const evidence = Math.min(1, taste.behavioural.decisionCount / 24);
  const stability = 1 - Math.min(0.7, contradictionIndex);
  return Math.round(Math.max(0, Math.min(1, evidence * stability)) * 100) / 100;
}

export function scoreDiscoveryCandidate(input: {
  candidate: DiscoveryCandidate;
  profile: DiscoveryProfileSnapshot;
  recentShown: Set<number>;
  recentDisliked: Set<number>;
  recentLiked: Set<number>;
}): DiscoveryScoredCandidate {
  const { candidate, profile, recentShown, recentDisliked, recentLiked } = input;
  const taste = profile.tasteVector;
  const preference = profile.preferenceVector;
  const reasons: DiscoveryReasonAtom[] = [];
  const components: DiscoveryScoreComponents = {
    base: 50,
    cityAffinity: 0,
    districtAffinity: 0,
    propertyTypeAffinity: 0,
    transactionAffinity: 0,
    priceAffinity: 0,
    spaceAffinity: 0,
    amenityAffinity: 0,
    embeddingAffinity: 0,
    visitPattern: 0,
    explorationBonus: 0,
    penalty: 0,
  };
  if (candidate.embeddingVector?.length && taste.semantic.mu?.length === candidate.embeddingVector.length) {
    const dot = candidate.embeddingVector.reduce((sum, value, index) => sum + value * (taste.semantic.mu?.[index] || 0), 0);
    const norm = Math.sqrt(candidate.embeddingVector.reduce((sum, value) => sum + value * value, 0)) *
      Math.sqrt(taste.semantic.mu.reduce((sum, value) => sum + value * value, 0));
    const cosine = norm > 0 ? dot / norm : 0;
    components.embeddingAffinity = capComponent(Math.max(0, cosine) * 18);
    if (components.embeddingAffinity >= 5) {
      pushReason(reasons, 'EMBEDDING_NEAR_LIKED' as DiscoveryReasonAtom['code'], components.embeddingAffinity, 'opis i charakter miejsca są bliskie ofertom, które wybierałeś', null);
    }
  }
  const priorWeight = preference.strength * (1 - profile.confidence);
  const effectiveCity = affinity(taste.affinity.city, candidate.city) * (1 - priorWeight) +
    affinity(preference.cityPrior, candidate.city) * priorWeight;
  components.cityAffinity = capComponent(effectiveCity * 2.4);
  if (components.cityAffinity > 0) {
    pushReason(reasons, 'CITY_AFFINITY', components.cityAffinity, `pasuje do miasta: ${candidate.city}`, candidate.city);
  }

  components.districtAffinity = capComponent(affinity(taste.affinity.district, candidate.district) * 3);
  if (components.districtAffinity > 0) {
    pushReason(reasons, 'DISTRICT_AFFINITY', components.districtAffinity, `blisko dzielnic, które wybierasz`, candidate.district);
  }

  components.propertyTypeAffinity = capComponent(affinity(taste.affinity.propertyType, candidate.propertyType) * 3.2);
  if (components.propertyTypeAffinity > 0) {
    pushReason(reasons, 'PROPERTY_TYPE_AFFINITY', components.propertyTypeAffinity, 'typ podobny do miejsc, które wybierałeś', candidate.propertyType);
  }

  const txAffinity = affinity(taste.affinity.transactionType, candidate.transactionType) * (1 - priorWeight) +
    affinity(preference.transactionPrior, candidate.transactionType) * priorWeight;
  components.transactionAffinity = capComponent(txAffinity * 3);
  if (components.transactionAffinity > 0) {
    pushReason(reasons, 'TRANSACTION_AFFINITY', components.transactionAffinity, 'forma transakcji zgodna z Twoim kierunkiem', candidate.transactionType);
  }

  const price = Number(candidate.pricePln ?? candidate.price);
  const likedPrice = average(taste.price.likedSum, taste.price.likedCount);
  const dislikedPrice = average(taste.price.dislikedSum, taste.price.dislikedCount);
  const preferencePrice = preference.budgetHypothesis?.center ?? null;
  const priceCenter = likedPrice ?? preferencePrice;
  const priceSoft = softDistance(price, priceCenter, taste.price.elasticity || preference.budgetHypothesis?.width || 0.35);
  components.priceAffinity = capComponent(priceSoft * 16);
  if (likedPrice && dislikedPrice && softDistance(price, dislikedPrice, 0.18) > 0.8) {
    components.priceAffinity = capComponent(components.priceAffinity - 10);
  }
  if (components.priceAffinity >= 7) {
    pushReason(reasons, 'PRICE_REVEALED_AFFINITY', components.priceAffinity, 'cena bliska miejscom, na które reagujesz', null);
  }

  const likedArea = average(taste.space.likedAreaSum, taste.space.likedAreaCount);
  const preferenceArea = preference.spaceHypothesis?.areaCenter ?? null;
  components.spaceAffinity = capComponent(softDistance(candidate.area, likedArea ?? preferenceArea, 0.32) * 12);
  if (components.spaceAffinity >= 6) {
    pushReason(reasons, 'SPACE_AFFINITY', components.spaceAffinity, 'metraż zbliżony do lubianych miejsc', null);
  }

  const amenityPositive = [candidate.hasBalcony, candidate.hasParking, candidate.hasGarden, candidate.hasElevator, candidate.isFurnished]
    .filter(Boolean).length;
  components.amenityAffinity = Math.min(DISCOVERY_DNA.maxAmenityContribution, amenityPositive * 1.2);
  if (components.amenityAffinity >= 4) {
    pushReason(reasons, 'AMENITY_AFFINITY', components.amenityAffinity, 'cechy miejsca wspierają Twój dotychczasowy kierunek', null);
  }

  if (taste.behavioural.visitPositiveCount > taste.behavioural.visitNegativeCount) {
    components.visitPattern = Math.min(6, (taste.behavioural.visitPositiveCount - taste.behavioural.visitNegativeCount) * 0.8);
    if (components.visitPattern > 0) {
      pushReason(reasons, 'VISIT_CONFIRMED_PATTERN', components.visitPattern, 'nawiązuje do kierunków potwierdzonych w rzeczywistości', null);
    }
  }

  const novelty = candidateNovelty(candidate, recentShown);
  const explore = profile.explorationHunger > 0.45 && novelty > 0 && !recentLiked.has(candidate.id);
  components.explorationBonus = explore ? Math.min(12, profile.explorationHunger * 12) : 0;
  if (components.explorationBonus >= 5) {
    pushReason(reasons, 'EXPLORATION_NOVELTY', components.explorationBonus, 'nowy kierunek do spokojnego sprawdzenia', null);
  }

  if (recentDisliked.has(candidate.id)) components.penalty -= DISCOVERY_DNA.maxDislikePenalty;
  if (recentLiked.has(candidate.id)) components.penalty -= 45;

  const raw = Object.values(components).reduce((sum, value) => sum + value, 0);
  const score = clampScore(raw);
  const sortedReasons = reasons.sort((a, b) => b.strength - a.strength).slice(0, 3);

  return {
    ...candidate,
    score,
    matchScore: score,
    scoreComponents: components,
    reasons: sortedReasons,
    reason: reasonText(sortedReasons, score),
    galleryPlan: planDiscoveryGallery(candidate.images),
    exploreFlag: explore,
    confidence: profile.confidence,
  };
}

function redundant(a: DiscoveryScoredCandidate, accepted: DiscoveryScoredCandidate[]): number {
  if (!accepted.length) return 0;
  return Math.max(
    ...accepted.map((other) => {
      let similarity = 0;
      if (other.city === a.city) similarity += 0.35;
      if (other.district === a.district) similarity += 0.25;
      if (other.propertyType === a.propertyType) similarity += 0.2;
      if (other.transactionType === a.transactionType) similarity += 0.1;
      return similarity;
    }),
  );
}

export function diversifiedDiscoveryRank(
  candidates: DiscoveryScoredCandidate[],
  limit: number,
): DiscoveryScoredCandidate[] {
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  const ranked: DiscoveryScoredCandidate[] = [];
  const explorationTarget = Math.ceil(limit * DISCOVERY_DNA.minExplorationRatio);

  while (remaining.length && ranked.length < limit) {
    const selected = remaining
      .map((candidate) => ({
        candidate,
        adjusted: candidate.score - redundant(candidate, ranked) * 18 +
          (candidate.exploreFlag && ranked.filter((item) => item.exploreFlag).length < explorationTarget ? 8 : 0),
      }))
      .sort((a, b) => b.adjusted - a.adjusted)[0];
    ranked.push(selected.candidate);
    remaining.splice(remaining.findIndex((candidate) => candidate.id === selected.candidate.id), 1);
  }
  return ranked;
}

export function createDiscoveryProfileSnapshot(input: {
  tasteVector: unknown;
  preferenceVector: unknown;
  confidence: unknown;
  contradictionIndex: unknown;
  explorationHunger: unknown;
  searchPhase: unknown;
  cityStats?: unknown;
  districtStats?: unknown;
  propertyStats?: unknown;
  reasonStats?: unknown;
}): DiscoveryProfileSnapshot {
  const tasteVector = input.tasteVector
    ? parseTasteVector(input.tasteVector)
    : tasteVectorFromLegacy(input);
  const contradictionIndex = Math.max(0, Math.min(1, numberOr(input.contradictionIndex)));
  return {
    tasteVector,
    preferenceVector: parsePreferenceVector(input.preferenceVector),
    confidence: Math.max(0, Math.min(1, numberOr(input.confidence, deriveProfileConfidence(tasteVector, contradictionIndex)))),
    contradictionIndex,
    explorationHunger: Math.max(0, Math.min(1, numberOr(input.explorationHunger, 1))),
    searchPhase: String(input.searchPhase || 'ACTIVE'),
  };
}

export function estimateContradictionIndex(taste: TasteVector): number {
  const maps = [taste.affinity.city, taste.affinity.district, taste.affinity.propertyType, taste.affinity.transactionType];
  const values = maps.flatMap((map) => Object.values(map));
  if (!values.length) return 0;
  const positives = values.filter((value) => value > 0).length;
  const negatives = values.filter((value) => value < 0).length;
  return Math.round(safeRatio(Math.min(positives, negatives), Math.max(1, positives + negatives)) * 100) / 100;
}

export const EMPTY_DISCOVERY_MAP = EMPTY_MAP;
