import { API_URL } from '../config/network';

export type MarketComp = {
  id: number;
  deedAt: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  price: number;
  ppsm: number;
  address: string | null;
  district: string | null;
  distanceM: number;
  marketType: string | null;
};

export type ValuationResult = {
  ok: true;
  estimated: { low: number; mid: number; high: number; ppsm: number; recommendedAsk: number };
  stats: { medianPpsm: number; meanPpsm: number; count: number; radiusM: number; windowMonths: number; basis: string };
  vsListing: {
    score: number;
    tone: 'good' | 'fair' | 'high' | 'low';
    label: string;
    detail: string;
    vsMedianPct: number;
  } | null;
  comps: MarketComp[];
  coverage: { city: string; source: string; ingestedAt: string | null; transactionCount: number; disclaimer: string };
  access?: { quota?: MarketReportQuota | null; marketReportCredits?: number };
};

export type MarketReportQuota = {
  kind: 'admin' | 'investor' | 'office' | 'credits' | 'none';
  used: number;
  cap: number | null;
  remaining: number;
  windowLabel: string;
  message: string;
};

function authHeaders(token?: string | null) {
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function fetchMarketValuation(
  token: string | null,
  body: Record<string, unknown>,
): Promise<ValuationResult | { ok: false; message: string; code?: string }> {
  const res = await fetch(`${API_URL}/api/market/valuation`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    return { ok: false, message: String(json?.message || 'Nie udało się policzyć wyceny.'), code: json?.code };
  }
  return json as ValuationResult;
}

export async function sendMarketReport(token: string | null, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/market/report`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: Boolean(json?.ok), status: res.status, json };
}

export async function previewMarketReport(token: string | null, body: Record<string, unknown>) {
  return sendMarketReport(token, { ...body, preview: true });
}

export async function fetchMarketReportQuota(token: string | null): Promise<MarketReportQuota | null> {
  const res = await fetch(`${API_URL}/api/market/report`, { headers: authHeaders(token) });
  const json = await res.json().catch(() => ({}));
  return json?.quota || null;
}

export async function fetchMarketStats(periodDays = 365) {
  const res = await fetch(`${API_URL}/api/market/stats?city=Warszawa&periodDays=${periodDays}`);
  return res.json().catch(() => ({}));
}

export async function fetchMarketIntelligence(periodDays = 365) {
  const res = await fetch(`${API_URL}/api/market/intelligence?city=Warszawa&periodDays=${periodDays}`);
  return res.json().catch(() => ({}));
}

export function formatPln(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

export function formatPpsm(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł/m²`;
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return 'n/d';
  if (Math.abs(value) < 0.05) return '0,0%';
  const shown = Math.abs(value).toFixed(digits).replace('.', ',');
  return `${value > 0 ? '+' : '-'}${shown}%`;
}

export type PricePulseTone = 'up' | 'down' | 'flat';
export type PricePulseDirection = 'rising' | 'falling' | 'stable';

export type PricePulseWindow = {
  days: number;
  listingPpsm: number | null;
  deedPpsm: number | null;
  vsDeedsPct: number | null;
  listingChangePct: number | null;
  deedChangePct: number | null;
  listingCount: number;
  deedCount: number;
};

export type PricePulsePayload = {
  ok: true;
  city: string;
  source: string;
  disclaimer: string;
  updatedAt: string;
  vsDeedsPct: number | null;
  listingPpsm: number | null;
  deedPpsm: number | null;
  tone: PricePulseTone;
  direction: PricePulseDirection;
  windows: { d7: PricePulseWindow; d30: PricePulseWindow; d90: PricePulseWindow };
  series: Array<{ date: string; listingPpsm: number | null; deedPpsm: number | null; vsDeedsPct: number | null }>;
  sparkline: Array<number | null>;
  districts: Array<{
    district: string;
    vsDeedsPct: number;
    listingPpsm: number;
    deedPpsm: number;
    listingCount: number;
  }>;
};

export async function fetchPricePulse(
  token?: string | null,
): Promise<PricePulsePayload | { ok: false; message: string }> {
  const res = await fetch(`${API_URL}/api/market/price-pulse`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    return { ok: false, message: String(json?.message || 'Brak pulsu cenowego.') };
  }
  return json as PricePulsePayload;
}

export function formatTapeDelta(vsMedianPct: number, locale: string): string {
  if (!Number.isFinite(vsMedianPct)) return '';
  if (Math.abs(vsMedianPct) < 3) {
    if (locale === 'en') return 'at deed prices';
    if (locale === 'ru') return 'у актов';
    return 'przy aktach';
  }
  const n = Math.abs(Math.round(vsMedianPct));
  if (vsMedianPct > 0) {
    if (locale === 'en') return `+${n}% above deeds`;
    if (locale === 'ru') return `+${n}% над актами`;
    return `+${n}% powyżej aktów`;
  }
  if (locale === 'en') return `-${n}% below deeds`;
  if (locale === 'ru') return `-${n}% под актами`;
  return `-${n}% poniżej aktów`;
}

export function formatTapeBadge(vsMedianPct: number): string {
  if (!Number.isFinite(vsMedianPct) || Math.abs(vsMedianPct) < 3) return '0%';
  return `${vsMedianPct > 0 ? '+' : '-'}${Math.abs(Math.round(vsMedianPct))}%`;
}

export type ListingTapeItem = {
  id: number;
  title?: string | null;
  imageUrl?: string | null;
  city?: string | null;
  district?: string | null;
  area?: number | null;
  price?: number | null;
  pricePln?: number | null;
  marketTape?: {
    vsMedianPct: number;
    listingPpsm: number;
    medianPpsm: number;
    score: number;
    tone: 'good' | 'fair' | 'high' | 'low';
    label: string;
    district: string;
  };
};

export async function fetchListingTape(
  locale: string,
  token?: string | null,
  opts?: { offset?: number; limit?: number },
): Promise<{ items: ListingTapeItem[]; hasMore: boolean; total: number }> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(80, Math.max(8, opts?.limit ?? 24));
  const res = await fetch(
    `${API_URL}/api/market/listing-tape?locale=${encodeURIComponent(locale)}&limit=${limit}&offset=${offset}`,
    { headers },
  );
  const json = await res.json().catch(() => ({}));
  return {
    items: Array.isArray(json?.items) ? (json.items as ListingTapeItem[]) : [],
    hasMore: Boolean(json?.hasMore),
    total: Number(json?.total || 0),
  };
}
