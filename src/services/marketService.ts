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
