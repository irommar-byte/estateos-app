type AnyObj = Record<string, any>;

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

export const DISCOVERY_LEGACY_EVENT_ALIASES = {
  DISCOVERY_FAST_TRACK: 'DISCOVERY_PRIORITY',
  DISCOVERY_OPEN: 'DISCOVERY_DEPTH_OPEN',
  DISCOVERY_DISLIKE_REASON: 'DISCOVERY_DISLIKE',
} as const;

export const DISCOVERY_DISLIKE_REASON_CODES = [
  'PRICE_TOO_HIGH',
  'LOCATION_MISMATCH',
  'LAYOUT_MISMATCH',
  'QUALITY_LOW',
] as const;
export type DiscoveryDislikeReasonCode = (typeof DISCOVERY_DISLIKE_REASON_CODES)[number];

export const DISCOVERY_VISIT_OUTCOMES = ['YES', 'NO', 'DIFFERENT'] as const;
export type DiscoveryVisitOutcome = (typeof DISCOVERY_VISIT_OUTCOMES)[number];

export type DiscoveryEventPayload = {
  eventType: DiscoveryEventType;
  offerId?: number | null;
  sessionId?: string | null;
  idempotencyKey: string;
  photoIndex?: number | null;
  score?: number | null;
  reasonCode?: DiscoveryDislikeReasonCode | null;
  visitOutcome?: DiscoveryVisitOutcome | null;
  correctionTarget?: string | null;
  dwellMs?: number | null;
  decisionLatencyMs?: number | null;
  source: 'mobile_discovery';
  platform: 'ios' | 'android' | 'web';
  at: string;
};

export type DiscoveryReasonAtom = {
  code: string;
  strength: number;
  message: string;
  evidence?: string | null;
};

export type DiscoveryGalleryPlan = {
  algorithmVersion: string;
  sourceHash: string;
  orderedAssets: string[];
  assetRoles: { asset: string; role: 'HERO' | 'LAYOUT' | 'LIGHT' | 'CONTEXT' | 'ADDITIONAL' }[];
  status: 'READY' | 'PENDING';
};

export type DiscoveryFeedItem = {
  id: number | string;
  score?: number | null;
  reason?: string | null;
  reasons?: DiscoveryReasonAtom[];
  galleryPlan?: DiscoveryGalleryPlan | null;
  scoreComponents?: Record<string, number>;
  exploreFlag?: boolean;
  confidence?: number;
};

export type DiscoveryFeedProfile = {
  preferredBudgetPln?: number | null;
  preferredAreaM2?: number | null;
  interactions?: number;
  confidence?: number;
  contradictionIndex?: number;
  explorationHunger?: number;
  searchPhase?: string;
  engineVersion?: string;
};

function includesLiteral<T extends readonly string[]>(arr: T, value: string): value is T[number] {
  return (arr as readonly string[]).includes(value);
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseOptionalNonNegativeInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function normalizeEventType(value: unknown): DiscoveryEventType | null {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = (DISCOVERY_LEGACY_EVENT_ALIASES as Record<string, string>)[raw] || raw;
  return includesLiteral(DISCOVERY_EVENT_TYPES, normalized) ? normalized : null;
}

function generateIdempotencyKey(): string {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) return cryptoLike.randomUUID();
  return `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function validateDiscoveryEventPayload(raw: AnyObj): DiscoveryEventPayload | null {
  const rawEventType = String(raw?.eventType || '').trim().toUpperCase();
  const eventType = normalizeEventType(raw?.eventType);
  if (!eventType) return null;
  const offerId = raw?.offerId == null ? null : parsePositiveInt(raw?.offerId);
  const requiresOffer = ![
    'DISCOVERY_OPEN_SESSION',
    'DISCOVERY_PAUSE',
    'DISCOVERY_RESUME',
    'DISCOVERY_PHASE_END',
  ].includes(eventType);
  if (requiresOffer && !offerId) return null;
  const platform = String(raw?.platform || '').trim().toLowerCase();
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') return null;
  const at = String(raw?.at || '').trim();
  const date = new Date(at);
  if (!at || Number.isNaN(date.getTime())) return null;
  const reasonCodeRaw = raw?.reasonCode == null ? '' : String(raw.reasonCode).trim().toUpperCase();
  const reasonCode = reasonCodeRaw
    ? includesLiteral(DISCOVERY_DISLIKE_REASON_CODES, reasonCodeRaw) ? reasonCodeRaw : null
    : null;
  const visitOutcomeRaw = raw?.visitOutcome == null ? '' : String(raw.visitOutcome).trim().toUpperCase();
  const visitOutcome = visitOutcomeRaw
    ? includesLiteral(DISCOVERY_VISIT_OUTCOMES, visitOutcomeRaw) ? visitOutcomeRaw : null
    : null;
  const correctionTarget = raw?.correctionTarget == null ? null : String(raw.correctionTarget).trim().slice(0, 128);
  const sessionId = raw?.sessionId == null ? null : String(raw.sessionId).trim().slice(0, 64);
  const idempotencyKey = String(raw?.idempotencyKey || generateIdempotencyKey()).trim();
  const score = parseOptionalNonNegativeInt(raw?.score);

  if (!idempotencyKey || idempotencyKey.length > 96) return null;
  if (reasonCodeRaw && !reasonCode) return null;
  if (rawEventType === 'DISCOVERY_DISLIKE_REASON' && !reasonCode) return null;
  if (eventType === 'DISCOVERY_VISIT_FEEDBACK' && !visitOutcome) return null;
  if (eventType === 'DISCOVERY_CORRECTION' && !correctionTarget) return null;
  if (score != null && score > 100) return null;

  return {
    eventType,
    offerId,
    sessionId: sessionId || null,
    idempotencyKey,
    photoIndex: parseOptionalNonNegativeInt(raw?.photoIndex),
    score,
    reasonCode,
    visitOutcome,
    correctionTarget: correctionTarget || null,
    dwellMs: parseOptionalNonNegativeInt(raw?.dwellMs),
    decisionLatencyMs: parseOptionalNonNegativeInt(raw?.decisionLatencyMs),
    source: 'mobile_discovery',
    platform,
    at: date.toISOString(),
  };
}

export function buildDiscoveryEventPayload(params: Omit<Partial<DiscoveryEventPayload>, 'source' | 'idempotencyKey'> & {
  eventType: unknown;
  offerId?: unknown;
  platform: unknown;
  at?: unknown;
}): DiscoveryEventPayload | null {
  return validateDiscoveryEventPayload({
    ...params,
    source: 'mobile_discovery',
    idempotencyKey: generateIdempotencyKey(),
    at: params.at || new Date().toISOString(),
  });
}

export function parseDiscoveryFeedItems(raw: unknown): DiscoveryFeedItem[] {
  const root = raw as AnyObj;
  const base = Array.isArray(raw) ? raw : Array.isArray(root?.offers) ? root.offers : Array.isArray(root?.items) ? root.items : [];
  return base
    .map((item: AnyObj) => {
      const id = item?.id ?? item?.offerId;
      if (id == null || id === '') return null;
      const scoreRaw = item?.score ?? item?.matchScore ?? null;
      const scoreNum = scoreRaw == null ? null : Number(scoreRaw);
      const score = typeof scoreNum === 'number' && Number.isFinite(scoreNum)
        ? Math.max(0, Math.min(100, Math.round(scoreNum)))
        : null;
      const reasons = Array.isArray(item?.reasons)
        ? item.reasons
            .filter((reason: any) => reason && typeof reason.message === 'string')
            .slice(0, 3)
            .map((reason: any) => ({
              code: String(reason.code || ''),
              strength: Number(reason.strength || 0),
              message: String(reason.message),
              evidence: reason.evidence == null ? null : String(reason.evidence),
            }))
        : [];
      return {
        ...item,
        id,
        score,
        reason: item?.reason == null ? null : String(item.reason),
        reasons,
        galleryPlan: item?.galleryPlan || null,
      } as DiscoveryFeedItem;
    })
    .filter((item): item is DiscoveryFeedItem => item != null) as DiscoveryFeedItem[];
}

export function parseDiscoveryFeedProfile(raw: unknown): DiscoveryFeedProfile | null {
  const profile = (raw as AnyObj)?.profile;
  if (!profile || typeof profile !== 'object') return null;
  return {
    preferredBudgetPln: Number.isFinite(Number(profile.preferredBudgetPln)) ? Number(profile.preferredBudgetPln) : null,
    preferredAreaM2: Number.isFinite(Number(profile.preferredAreaM2)) ? Number(profile.preferredAreaM2) : null,
    interactions: Number.isFinite(Number(profile.interactions)) ? Number(profile.interactions) : 0,
    confidence: Number.isFinite(Number(profile.confidence)) ? Number(profile.confidence) : 0,
    contradictionIndex: Number.isFinite(Number(profile.contradictionIndex)) ? Number(profile.contradictionIndex) : 0,
    explorationHunger: Number.isFinite(Number(profile.explorationHunger)) ? Number(profile.explorationHunger) : 1,
    searchPhase: String(profile.searchPhase || 'ACTIVE'),
    engineVersion: String(profile.engineVersion || ''),
  };
}
