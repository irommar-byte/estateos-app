import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '../config/network';
import { resolveMediaUrl } from '../utils/userAvatar';
import {
  buildDiscoveryEventPayload,
  parseDiscoveryFeedItems,
  parseDiscoveryFeedProfile,
  type DiscoveryEventPayload,
  type DiscoveryEventType,
  type DiscoveryFeedItem,
  type DiscoveryFeedProfile,
} from '../contracts/discoveryContracts';

const QUEUE_KEY = '@estateos_discovery_event_queue_v2';
const SESSION_KEY = '@estateos_discovery_session_v1';
const SUPPRESSED_OFFERS_KEY = '@estateos_discovery_suppressed_offers_v1';
const MAX_QUEUE = 160;
const MAX_SUPPRESSED = 500;
const SUPPRESS_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;
const SUPPRESS_MS_LOCATION = 21 * 24 * 60 * 60 * 1000;

export type DiscoverySession = {
  id: string;
  startedAt: string;
};

export type DiscoveryFeedResponse = {
  items: DiscoveryFeedItem[];
  profile: DiscoveryFeedProfile | null;
  session: { id: string; tempoMode?: string } | null;
};

export type EstateOsGuideContext = {
  confidence: number;
  contradictionIndex: number;
  searchPhase: string;
  tropes: Array<{ offerId: number; status: string; priority: boolean }>;
  nextStep: { key: string; title: string; action: 'DISCOVERY' | 'TROPES' | 'PROFILE'; offerId?: number };
};

export type DiscoveryTrope = {
  id: string;
  offerId: number;
  status: 'SAVED' | 'SERIOUS' | 'VISITED';
  priority: boolean;
  visitOutcome: 'YES' | 'NO' | 'DIFFERENT' | null;
  offer: {
    id?: number;
    title?: string | null;
    city?: string | null;
    district?: string | null;
    images?: unknown;
    imageUrl?: string | null;
    userId?: number | null;
    ownerName?: string | null;
    ownerImage?: string | null;
    [key: string]: unknown;
  } | null;
};

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function headers(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeDiscoveryPlatform(os: string): 'ios' | 'android' | 'web' {
  if (os === 'ios' || os === 'android' || os === 'web') return os;
  return 'web';
}

function normalizeDislikeReason(
  value?: string | null,
): 'PRICE_TOO_HIGH' | 'LOCATION_MISMATCH' | 'LAYOUT_MISMATCH' | 'QUALITY_LOW' | null | undefined {
  if (value == null) return value;
  const norm = String(value).trim().toUpperCase();
  if (norm === 'PRICE_TOO_HIGH' || norm === 'LOCATION_MISMATCH' || norm === 'LAYOUT_MISMATCH' || norm === 'QUALITY_LOW') {
    return norm;
  }
  return undefined;
}

function normalizeVisitOutcome(value?: string | null): 'YES' | 'NO' | 'DIFFERENT' | null | undefined {
  if (value == null) return value;
  const norm = String(value).trim().toUpperCase();
  if (norm === 'YES' || norm === 'NO' || norm === 'DIFFERENT') return norm;
  return undefined;
}

type SuppressedOfferRow = {
  offerId: number;
  untilTs: number;
  reasonCode: string | null;
  updatedAt: string;
};

function suppressMsForReason(reasonCode?: string | null): number {
  return String(reasonCode || '').trim().toUpperCase() === 'LOCATION_MISMATCH'
    ? SUPPRESS_MS_LOCATION
    : SUPPRESS_MS_DEFAULT;
}

async function readSuppressedRows(): Promise<SuppressedOfferRow[]> {
  try {
    const raw = await AsyncStorage.getItem(SUPPRESSED_OFFERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .map((row: any) => ({
        offerId: Number(row?.offerId) || 0,
        untilTs: Number(row?.untilTs) || 0,
        reasonCode: row?.reasonCode == null ? null : String(row.reasonCode),
        updatedAt: String(row?.updatedAt || ''),
      }))
      .filter((row) => row.offerId > 0 && row.untilTs > now);
  } catch {
    return [];
  }
}

async function writeSuppressedRows(rows: SuppressedOfferRow[]): Promise<void> {
  const next = rows
    .slice()
    .sort((a, b) => b.untilTs - a.untilTs)
    .slice(0, MAX_SUPPRESSED);
  await AsyncStorage.setItem(SUPPRESSED_OFFERS_KEY, JSON.stringify(next));
}

async function suppressOfferLocally(offerId: number, reasonCode?: string | null): Promise<void> {
  if (!Number.isFinite(offerId) || offerId <= 0) return;
  const now = Date.now();
  const ttl = suppressMsForReason(reasonCode);
  const current = await readSuppressedRows();
  const nextRow: SuppressedOfferRow = {
    offerId,
    untilTs: now + ttl,
    reasonCode: reasonCode ? String(reasonCode) : null,
    updatedAt: new Date(now).toISOString(),
  };
  const merged = [nextRow, ...current.filter((row) => row.offerId !== offerId)];
  await writeSuppressedRows(merged);
}

export async function getOrCreateDiscoverySession(): Promise<DiscoverySession> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DiscoverySession;
      if (parsed?.id && parsed?.startedAt) return parsed;
    }
  } catch {
    // Create a fresh, safe session below.
  }
  const session = { id: createId('ds'), startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearDiscoverySession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function readQueue(): Promise<DiscoveryEventPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: DiscoveryEventPayload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

export async function enqueueDiscoveryEvent(payload: DiscoveryEventPayload): Promise<void> {
  const queue = await readQueue();
  if (!queue.some((event) => event.idempotencyKey === payload.idempotencyKey)) queue.push(payload);
  await writeQueue(queue);
}

export async function postDiscoveryEvent(payload: DiscoveryEventPayload, token: string | null): Promise<boolean> {
  if (!token) {
    await enqueueDiscoveryEvent(payload);
    return false;
  }
  try {
    const response = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload),
    });
    if (response.ok) return true;
  } catch {
    // Queue below.
  }
  await enqueueDiscoveryEvent(payload);
  return false;
}

export async function trackDiscoveryEvent(params: {
  token: string | null;
  eventType: DiscoveryEventType;
  offerId?: number | null;
  sessionId?: string | null;
  photoIndex?: number | null;
  score?: number | null;
  reasonCode?: string | null;
  visitOutcome?: string | null;
  correctionTarget?: string | null;
  dwellMs?: number | null;
  decisionLatencyMs?: number | null;
}): Promise<DiscoveryEventPayload | null> {
  const session = params.sessionId ? null : await getOrCreateDiscoverySession();
  const payload = buildDiscoveryEventPayload({
    eventType: params.eventType,
    offerId: params.offerId,
    sessionId: params.sessionId ?? session?.id ?? null,
    photoIndex: params.photoIndex,
    score: params.score,
    reasonCode: normalizeDislikeReason(params.reasonCode),
    visitOutcome: normalizeVisitOutcome(params.visitOutcome),
    correctionTarget: params.correctionTarget,
    dwellMs: params.dwellMs,
    decisionLatencyMs: params.decisionLatencyMs,
    platform: normalizeDiscoveryPlatform(Platform.OS),
  });
  if (!payload) return null;
  await postDiscoveryEvent(payload, params.token);
  return payload;
}

export async function flushDiscoveryEventQueue(token: string | null): Promise<void> {
  if (!token) return;
  const queue = await readQueue();
  if (!queue.length) return;
  const pending: DiscoveryEventPayload[] = [];
  for (const payload of queue) {
    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(payload),
      });
      if (!response.ok) pending.push(payload);
    } catch {
      pending.push(payload);
    }
  }
  await writeQueue(pending);
}

export async function fetchDiscoveryFeed(token: string | null, sessionId?: string | null): Promise<DiscoveryFeedResponse> {
  if (!token) return { items: [], profile: null, session: null };
  const params = new URLSearchParams({ mode: 'for_you', limit: '40' });
  if (sessionId) params.set('sessionId', sessionId);
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/feed?${params.toString()}`, {
    headers: headers(token),
  });
  if (!response.ok) throw new Error(`DISCOVERY_FEED_${response.status}`);
  const json = await response.json().catch(() => ({}));
  return {
    items: parseDiscoveryFeedItems(json),
    profile: parseDiscoveryFeedProfile(json),
    session: json?.session?.id ? { id: String(json.session.id), tempoMode: String(json.session.tempoMode || '') } : null,
  };
}

export async function fetchDiscoveryTropes(token: string | null): Promise<DiscoveryTrope[]> {
  if (!token) return [];
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, { headers: headers(token) });
  if (!response.ok) throw new Error(`DISCOVERY_TROPES_${response.status}`);
  const json = await response.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.map((raw: any) => {
    const offer = raw?.offer && typeof raw.offer === 'object' ? { ...raw.offer } : null;
    if (offer) {
      offer.imageUrl = resolveTropeOfferImage(offer);
    }
    return {
      ...raw,
      offer,
    } as DiscoveryTrope;
  });
}

/** First usable photo URL from a trope/offer payload (images JSON, imageUrl, relative /uploads). */
export function resolveTropeOfferImage(offer: any): string | null {
  if (!offer || typeof offer !== 'object') return null;
  const direct = absolutizeDiscoveryImage(offer.imageUrl);
  if (direct) return direct;

  let images: unknown = offer.images;
  if (typeof images === 'string') {
    const trimmed = images.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      return absolutizeDiscoveryImage(trimmed);
    }
    try {
      images = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === 'string') return absolutizeDiscoveryImage(first);
  if (first && typeof first === 'object') {
    const obj = first as Record<string, unknown>;
    return absolutizeDiscoveryImage(obj.url ?? obj.src ?? obj.uri ?? obj.path ?? obj.image);
  }
  return null;
}

export async function fetchEstateOsGuideContext(token: string | null): Promise<EstateOsGuideContext | null> {
  if (!token) return null;
  const response = await fetch(`${API_URL}/api/guide/context`, { headers: headers(token) });
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  return json?.guide || null;
}

export type DiscoveryPulseCta = {
  label: string;
  href?: string;
  action?: string;
};

export type DiscoveryPulsePayload = {
  stage?: string;
  stageLabel: string;
  progress: number;
  confidence: number;
  contradictionIndex: number;
  directionLine: string;
  summaryLine?: string;
  suggestion: string;
  decisionCount?: number;
  primaryCta?: DiscoveryPulseCta | null;
  secondaryCta?: DiscoveryPulseCta | null;
  updatedAt?: string | null;
};

export async function fetchDiscoveryPulse(token: string | null): Promise<DiscoveryPulsePayload | null> {
  if (!token) return null;
  try {
    const response = await fetch(`${API_URL}/api/discovery/pulse`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (response.status === 401 || !response.ok) return null;
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      pulse?: DiscoveryPulsePayload;
    } | null;
    if (!json?.success || !json.pulse) return null;
    return {
      stage: json.pulse.stage,
      stageLabel: String(json.pulse.stageLabel || 'Odkrywanie'),
      progress: Math.round(Math.min(100, Math.max(0, Number(json.pulse.progress) || 0))),
      confidence: Number(json.pulse.confidence) || 0,
      contradictionIndex: Number(json.pulse.contradictionIndex) || 0,
      directionLine: String(json.pulse.directionLine || ''),
      summaryLine: json.pulse.summaryLine ? String(json.pulse.summaryLine) : undefined,
      suggestion: String(json.pulse.suggestion || ''),
      decisionCount: Number(json.pulse.decisionCount) || 0,
      primaryCta: json.pulse.primaryCta || null,
      secondaryCta: json.pulse.secondaryCta || null,
      updatedAt: json.pulse.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export type DiscoveryOfferBrief = {
  id: number;
  title: string;
  city: string | null;
  imageUrl: string | null;
};

function absolutizeDiscoveryImage(raw: unknown): string | null {
  return resolveMediaUrl(raw);
}

function mapOfferBrief(raw: any): DiscoveryOfferBrief | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    title: String(raw.title || `Oferta #${id}`),
    city: raw.city == null ? null : String(raw.city),
    imageUrl: absolutizeDiscoveryImage(raw.imageUrl),
  };
}

function mapForYouItem(raw: any): ForYouRailItem | null {
  const offerId = Number(raw?.offerId ?? raw?.id);
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  return {
    id: Number(raw?.id) || offerId,
    offerId,
    title: String(raw?.title || `Oferta #${offerId}`),
    city: String(raw?.city || ''),
    district: String(raw?.district || ''),
    price: Number(raw?.price) || 0,
    pricePln: raw?.pricePln == null ? null : Number(raw.pricePln),
    priceCurrency: String(raw?.priceCurrency || 'PLN'),
    listPricePln: raw?.listPricePln == null ? null : Number(raw.listPricePln),
    propertyType: String(raw?.propertyType || ''),
    transactionType: String(raw?.transactionType || ''),
    area: Number(raw?.area) || 0,
    imageUrl: absolutizeDiscoveryImage(raw?.imageUrl),
    score: Number(raw?.score) || 0,
    reason: String(raw?.reason || ''),
    exploreFlag: Boolean(raw?.exploreFlag),
    createdAt: String(raw?.createdAt || ''),
  };
}

export type DiscoveryProfilePayload = {
  likesCount: number;
  dislikesCount: number;
  fastTrackCount: number;
  opensCount: number;
  topCities: Array<{ key: string; value: number }>;
  topDistricts: Array<{ key: string; value: number }>;
  topPropertyTypes: Array<{ key: string; value: number }>;
  dislikeReasons: Array<{ key: string; value: number }>;
  preferredBudgetPln: number | null;
  preferredAreaM2: number | null;
  preferredTransaction: 'SELL' | 'RENT' | 'MIXED' | null;
  summaryLine: string;
  confidence: number;
  contradictionIndex: number;
  explorationHunger: number;
  searchPhase: string;
  engineVersion?: string;
  hasProfile: boolean;
  updatedAt: string | null;
};

export type DiscoveryProfileTrope = {
  offerId: number;
  status: string;
  priority: boolean;
  visitOutcome?: string | null;
  updatedAt: string;
  offer: DiscoveryOfferBrief | null;
};

export type DiscoveryRecentEvent = {
  id: string;
  eventType: string;
  reasonCode: string | null;
  source?: string;
  platform?: string;
  at: string;
  offer: DiscoveryOfferBrief | null;
};

export type DiscoveryGuidePayload = {
  intentStage?: string;
  intentLabel?: string;
  body?: string;
  stageProgress?: number;
  nextStep?: { title?: string; action?: string; offerId?: number | null };
  primaryCta?: { label: string; href: string; action?: string };
  secondaryCta?: { label: string; href: string; action?: string };
};

export type DiscoveryProfileResponse = {
  auth: 'guest' | 'user';
  profile: DiscoveryProfilePayload | null;
  tropes: DiscoveryProfileTrope[];
  recent: DiscoveryRecentEvent[];
  guide: DiscoveryGuidePayload | null;
  error?: string | null;
};

export async function fetchDiscoveryProfile(token: string | null): Promise<DiscoveryProfileResponse> {
  if (!token) {
    return { auth: 'guest', profile: null, tropes: [], recent: [], guide: null };
  }
  try {
    const response = await fetch(`${API_URL}/api/discovery/profile`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (response.status === 401) {
      return { auth: 'guest', profile: null, tropes: [], recent: [], guide: null };
    }
    if (!response.ok) {
      return {
        auth: 'user',
        profile: null,
        tropes: [],
        recent: [],
        guide: null,
        error: 'Nie udało się wczytać danych.',
      };
    }
    const data = await response.json().catch(() => ({}));
    const tropesRaw = Array.isArray(data?.tropes) ? data.tropes : [];
    const recentRaw = Array.isArray(data?.recent) ? data.recent : [];
    return {
      auth: 'user',
      profile: (data?.profile || null) as DiscoveryProfilePayload | null,
      tropes: tropesRaw.map((row: any) => ({
        offerId: Number(row?.offerId) || 0,
        status: String(row?.status || ''),
        priority: Boolean(row?.priority),
        visitOutcome: row?.visitOutcome ?? null,
        updatedAt: String(row?.updatedAt || ''),
        offer: mapOfferBrief(row?.offer),
      })),
      recent: recentRaw.map((row: any) => ({
        id: String(row?.id || ''),
        eventType: String(row?.eventType || ''),
        reasonCode: row?.reasonCode == null ? null : String(row.reasonCode),
        source: row?.source,
        platform: row?.platform,
        at: String(row?.at || ''),
        offer: mapOfferBrief(row?.offer),
      })),
      guide: (data?.guide || null) as DiscoveryGuidePayload | null,
      error: null,
    };
  } catch {
    return {
      auth: 'user',
      profile: null,
      tropes: [],
      recent: [],
      guide: null,
      error: 'Brak połączenia.',
    };
  }
}

export type ForYouRailItem = {
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

export type DiscoveryForYouResponse = {
  auth: 'guest' | 'user';
  items: ForYouRailItem[];
  profile: {
    confidence: number;
    decisionCount: number;
    searchPhase: string;
    engineVersion: string;
    ready: boolean;
  } | null;
  explain: { offerId: number; reason: string; score: number } | null;
};

export async function fetchDiscoveryForYou(
  token: string | null,
  opts?: { limit?: number; transaction?: 'SALE' | 'RENT' | ''; offerId?: number },
): Promise<DiscoveryForYouResponse> {
  if (!token) {
    return { auth: 'guest', items: [], profile: null, explain: null };
  }
  try {
    const qs = new URLSearchParams({
      limit: String(Math.max(1, Math.min(24, opts?.limit ?? 12))),
    });
    if (opts?.transaction) qs.set('transaction', opts.transaction);
    if (opts?.offerId && Number.isFinite(opts.offerId) && opts.offerId > 0) {
      qs.set('offerId', String(opts.offerId));
    }
    const response = await fetch(`${API_URL}/api/discovery/for-you?${qs}`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (response.status === 401) {
      return { auth: 'guest', items: [], profile: null, explain: null };
    }
    if (!response.ok) {
      return { auth: 'user', items: [], profile: null, explain: null };
    }
    const data = await response.json().catch(() => ({}));
    const itemsRaw = Array.isArray(data?.items) ? data.items : [];
    const suppressed =
      opts?.offerId && Number.isFinite(opts.offerId) && opts.offerId > 0
        ? new Set<number>()
        : new Set((await readSuppressedRows()).map((row) => row.offerId));
    const filteredRaw = suppressed.size
      ? itemsRaw.filter((raw: any) => {
          const id = Number(raw?.offerId ?? raw?.id ?? raw?.offer?.id);
          return !Number.isFinite(id) || !suppressed.has(id);
        })
      : itemsRaw;
    return {
      auth: 'user',
      items: filteredRaw
        .map(mapForYouItem)
        .filter((item: ForYouRailItem | null): item is ForYouRailItem => Boolean(item)),
      profile: data?.profile
        ? {
            confidence: Number(data.profile.confidence) || 0,
            decisionCount: Number(data.profile.decisionCount) || 0,
            searchPhase: String(data.profile.searchPhase || ''),
            engineVersion: String(data.profile.engineVersion || ''),
            ready: Boolean(data.profile.ready),
          }
        : null,
      explain: data?.explain
        ? {
            offerId: Number(data.explain.offerId) || 0,
            reason: String(data.explain.reason || ''),
            score: Number(data.explain.score) || 0,
          }
        : null,
    };
  } catch {
    return { auth: 'user', items: [], profile: null, explain: null };
  }
}

export type DiscoveryTasteAction = 'LIKE' | 'DISLIKE' | 'SERIOUS' | 'OPEN';

function mapTasteActionToDiscoveryEventType(action: DiscoveryTasteAction): DiscoveryEventType {
  switch (action) {
    case 'LIKE':
      return 'DISCOVERY_LIKE';
    case 'DISLIKE':
      return 'DISCOVERY_DISLIKE';
    case 'SERIOUS':
      return 'DISCOVERY_PRIORITY';
    case 'OPEN':
    default:
      return 'DISCOVERY_DEPTH_OPEN';
  }
}

/** Mobile taste events via /api/mobile/v1/discovery/events (Bearer auth). */
export async function postDiscoveryTasteEvent(params: {
  token: string | null;
  offerId: number;
  eventType: DiscoveryTasteAction;
  reasonCode?: string | null;
  source?: string;
}): Promise<{ ok: boolean; authRequired?: boolean }> {
  if (!params.token) return { ok: false, authRequired: true };
  const id = Number(params.offerId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false };

  const idempotencyKey =
    params.eventType === 'OPEN'
      ? `mobile-open-${id}-${new Date().toISOString().slice(0, 10)}`
      : `mobile-${params.eventType.toLowerCase()}-${id}-${Date.now()}`;

  const payload: DiscoveryEventPayload = {
    eventType: mapTasteActionToDiscoveryEventType(params.eventType),
    offerId: id,
    sessionId: null,
    idempotencyKey,
    reasonCode: normalizeDislikeReason(params.reasonCode) ?? null,
    source: 'mobile_discovery',
    platform: normalizeDiscoveryPlatform(Platform.OS),
    at: new Date().toISOString(),
  };
  const source = String(params.source || 'mobile_offer_card').slice(0, 32);

  try {
    const response = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
      method: 'POST',
      headers: headers(params.token),
      body: JSON.stringify({ ...payload, source }),
    });
    if (response.status === 401) return { ok: false, authRequired: true };
    if (!response.ok) {
      await enqueueDiscoveryEvent(payload);
      return { ok: false };
    }
    if (params.eventType === 'DISLIKE') {
      void suppressOfferLocally(id, params.reasonCode);
    }
    return { ok: true };
  } catch {
    await enqueueDiscoveryEvent(payload);
    return { ok: false };
  }
}

export async function mutateDiscoveryTrope(
  token: string | null,
  input: { offerId: number; action: 'SAVE' | 'PRIORITIZE' | 'UNPRIORITIZE' | 'REMOVE' | 'SERIOUS' },
): Promise<void> {
  if (!token) return;
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`DISCOVERY_TROPE_${response.status}`);
}

export async function submitDiscoveryVisitFeedback(
  token: string | null,
  input: { offerId: number; visitOutcome: 'YES' | 'NO' | 'DIFFERENT' },
): Promise<void> {
  if (!token) return;
  const response = await fetch(`${API_URL}/api/mobile/v1/discovery/tropes`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`DISCOVERY_VISIT_${response.status}`);
}
