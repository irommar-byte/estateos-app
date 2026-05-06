type AnyObj = Record<string, any>;

export const DISCOVERY_EVENT_TYPES = [
  'DISCOVERY_LIKE',
  'DISCOVERY_DISLIKE',
  'DISCOVERY_FAST_TRACK',
  'DISCOVERY_OPEN',
  'DISCOVERY_DISLIKE_REASON',
] as const;
export type DiscoveryEventType = (typeof DISCOVERY_EVENT_TYPES)[number];

export const DISCOVERY_DISLIKE_REASON_CODES = [
  'PRICE_TOO_HIGH',
  'LOCATION_MISMATCH',
  'LAYOUT_MISMATCH',
  'QUALITY_LOW',
] as const;
export type DiscoveryDislikeReasonCode = (typeof DISCOVERY_DISLIKE_REASON_CODES)[number];

export type DiscoveryEventPayload = {
  eventType: DiscoveryEventType;
  offerId: number;
  photoIndex?: number | null;
  score?: number | null;
  reasonCode?: DiscoveryDislikeReasonCode | null;
  source: 'mobile_discovery';
  platform: 'ios' | 'android' | 'web';
  at: string;
};

export type DiscoveryFeedItem = {
  id: number | string;
  score?: number | null;
  reason?: string | null;
};

function includesLiteral<T extends readonly string[]>(arr: T, value: string): value is T[number] {
  return (arr as readonly string[]).includes(value);
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function validateDiscoveryEventPayload(raw: AnyObj): DiscoveryEventPayload | null {
  const eventType = String(raw?.eventType || '').trim().toUpperCase();
  if (!includesLiteral(DISCOVERY_EVENT_TYPES, eventType)) return null;
  const offerId = parsePositiveInt(raw?.offerId);
  if (!offerId) return null;
  const platform = String(raw?.platform || '').trim().toLowerCase();
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') return null;
  const at = String(raw?.at || '').trim();
  const date = new Date(at);
  if (!at || Number.isNaN(date.getTime())) return null;

  const photoIndex =
    raw?.photoIndex === null || raw?.photoIndex === undefined
      ? null
      : Math.max(0, Math.round(Number(raw.photoIndex) || 0));
  const score =
    raw?.score === null || raw?.score === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  const reasonCodeRaw = raw?.reasonCode == null ? '' : String(raw.reasonCode).trim().toUpperCase();
  const reasonCode = reasonCodeRaw
    ? includesLiteral(DISCOVERY_DISLIKE_REASON_CODES, reasonCodeRaw)
      ? reasonCodeRaw
      : null
    : null;

  if (eventType === 'DISCOVERY_DISLIKE_REASON' && !reasonCode) return null;

  return {
    eventType,
    offerId,
    photoIndex,
    score,
    reasonCode,
    source: 'mobile_discovery',
    platform,
    at: date.toISOString(),
  };
}

export function buildDiscoveryEventPayload(params: {
  eventType: unknown;
  offerId: unknown;
  photoIndex?: unknown;
  score?: unknown;
  reasonCode?: unknown;
  platform: unknown;
  at?: unknown;
}): DiscoveryEventPayload | null {
  return validateDiscoveryEventPayload({
    eventType: params.eventType,
    offerId: params.offerId,
    photoIndex: params.photoIndex,
    score: params.score,
    reasonCode: params.reasonCode,
    source: 'mobile_discovery',
    platform: params.platform,
    at: params.at || new Date().toISOString(),
  });
}

export function parseDiscoveryFeedItems(raw: unknown): DiscoveryFeedItem[] {
  const base = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as AnyObj)?.offers)
      ? (raw as AnyObj).offers
      : Array.isArray((raw as AnyObj)?.items)
        ? (raw as AnyObj).items
        : [];
  return base
    .map((item: AnyObj) => {
      const id = item?.id ?? item?.offerId;
      if (id == null || id === '') return null;
      const scoreRaw = item?.score ?? item?.matchScore ?? null;
      const scoreNum = scoreRaw == null ? null : Number(scoreRaw);
      const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : null;
      const reason = item?.reason == null ? null : String(item.reason);
      return { ...item, id, score, reason } as DiscoveryFeedItem;
    })
    .filter(Boolean) as DiscoveryFeedItem[];
}
