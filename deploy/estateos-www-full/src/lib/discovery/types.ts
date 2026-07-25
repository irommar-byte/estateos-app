export const DISCOVERY_ENGINE_VERSION = 'discovery-foundation-v1';
export const DISCOVERY_DNA_VERSION = 'discovery-dna-v1';
export const DISCOVERY_EMBEDDING_MODEL_VERSION = 'provider-agnostic-v1';
export const DISCOVERY_GALLERY_ALGORITHM_VERSION = 'gallery-foundation-v1';

export const DISCOVERY_EVENT_TYPES = [
  'DISCOVERY_OPEN_SESSION',
  'DISCOVERY_VIEW_CARD',
  'DISCOVERY_PHOTO_VIEW',
  'DISCOVERY_DEPTH_OPEN',
  'DISCOVERY_LIKE',
  'DISCOVERY_DISLIKE',
  'DISCOVERY_PRIORITY',
  'DISCOVERY_SAVE',
  'DISCOVERY_UNDO',
  'DISCOVERY_INSIGHT_OPEN',
  'DISCOVERY_CORRECTION',
  'DISCOVERY_VISIT_FEEDBACK',
  'DISCOVERY_PAUSE',
  'DISCOVERY_RESUME',
  'DISCOVERY_PHASE_END',
] as const;

export type DiscoveryEventType = (typeof DISCOVERY_EVENT_TYPES)[number];

export const DISCOVERY_LEGACY_EVENT_ALIASES: Record<string, DiscoveryEventType> = {
  DISCOVERY_FAST_TRACK: 'DISCOVERY_PRIORITY',
  DISCOVERY_OPEN: 'DISCOVERY_DEPTH_OPEN',
  DISCOVERY_DISLIKE_REASON: 'DISCOVERY_DISLIKE',
};

export const DISCOVERY_DISLIKE_REASONS = [
  'PRICE_TOO_HIGH',
  'LOCATION_MISMATCH',
  'LAYOUT_MISMATCH',
  'QUALITY_LOW',
] as const;
export type DiscoveryDislikeReason = (typeof DISCOVERY_DISLIKE_REASONS)[number];

export const DISCOVERY_VISIT_OUTCOMES = ['YES', 'NO', 'DIFFERENT'] as const;
export type DiscoveryVisitOutcome = (typeof DISCOVERY_VISIT_OUTCOMES)[number];

export type NumericMap = Record<string, number>;

export type TasteVector = {
  version: number;
  updatedAt: string;
  affinity: {
    city: NumericMap;
    district: NumericMap;
    propertyType: NumericMap;
    transactionType: NumericMap;
  };
  price: {
    likedSum: number;
    likedCount: number;
    dislikedSum: number;
    dislikedCount: number;
    elasticity: number;
  };
  space: {
    likedAreaSum: number;
    likedAreaCount: number;
    likedRoomsSum: number;
    likedRoomsCount: number;
  };
  behavioural: {
    decisionCount: number;
    priorityCount: number;
    visitPositiveCount: number;
    visitNegativeCount: number;
    medianDecisionLatencyMs: number | null;
    hesitationRate: number;
  };
};

export type PreferenceVector = {
  version: number;
  sourceTags: string[];
  transactionPrior: NumericMap;
  cityPrior: NumericMap;
  budgetHypothesis: { center: number; width: number } | null;
  spaceHypothesis: { areaCenter: number | null; roomsCenter: number | null } | null;
  strength: number;
  expiresAt: string | null;
};

export type DiscoveryReasonCode =
  | 'CITY_AFFINITY'
  | 'DISTRICT_AFFINITY'
  | 'PROPERTY_TYPE_AFFINITY'
  | 'TRANSACTION_AFFINITY'
  | 'PRICE_REVEALED_AFFINITY'
  | 'SPACE_AFFINITY'
  | 'AMENITY_AFFINITY'
  | 'VISIT_CONFIRMED_PATTERN'
  | 'EXPLORATION_NOVELTY'
  | 'COLD_START_DIVERSITY';

export type DiscoveryReasonAtom = {
  code: DiscoveryReasonCode;
  strength: number;
  message: string;
  evidence: string | null;
};

export type GalleryAssetRole = 'HERO' | 'LAYOUT' | 'LIGHT' | 'CONTEXT' | 'ADDITIONAL';

export type DiscoveryGalleryPlan = {
  algorithmVersion: string;
  sourceHash: string;
  orderedAssets: string[];
  assetRoles: Array<{ asset: string; role: GalleryAssetRole }>;
  status: 'READY' | 'PENDING';
};

export type DiscoveryScoreComponents = {
  base: number;
  cityAffinity: number;
  districtAffinity: number;
  propertyTypeAffinity: number;
  transactionAffinity: number;
  priceAffinity: number;
  spaceAffinity: number;
  amenityAffinity: number;
  visitPattern: number;
  explorationBonus: number;
  penalty: number;
};

export type DiscoveryCandidate = {
  id: number;
  title: string;
  price: number;
  pricePln: number | null;
  priceCurrency: string;
  listPricePln: number | null;
  city: string;
  district: string;
  propertyType: string;
  transactionType: string;
  area: number;
  rooms: number | null;
  hasBalcony: boolean;
  hasParking: boolean;
  hasGarden?: boolean;
  hasElevator?: boolean;
  isFurnished: boolean;
  images: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DiscoveryScoredCandidate = DiscoveryCandidate & {
  score: number;
  matchScore: number;
  scoreComponents: DiscoveryScoreComponents;
  reasons: DiscoveryReasonAtom[];
  reason: string;
  galleryPlan: DiscoveryGalleryPlan;
  exploreFlag: boolean;
  confidence: number;
};

export type DiscoveryProfileSnapshot = {
  tasteVector: TasteVector;
  preferenceVector: PreferenceVector;
  confidence: number;
  contradictionIndex: number;
  explorationHunger: number;
  searchPhase: string;
};

export type DiscoveryIncomingEvent = {
  eventType: DiscoveryEventType;
  legacyReasonOnly?: boolean;
  offerId?: number | null;
  sessionId?: string | null;
  idempotencyKey?: string | null;
  photoIndex?: number | null;
  score?: number | null;
  reasonCode?: DiscoveryDislikeReason | null;
  visitOutcome?: DiscoveryVisitOutcome | null;
  correctionTarget?: string | null;
  dwellMs?: number | null;
  decisionLatencyMs?: number | null;
  source: string;
  platform: 'ios' | 'android' | 'web';
  at: Date;
};
