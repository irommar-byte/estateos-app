import { normalizeOfferPropertyType } from './offerFieldLabels';

export type MarketPropertyFilter = 'ALL' | 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL';

export const MARKET_PROPERTY_TYPES: Array<{ id: MarketPropertyFilter; label: string }> = [
  { id: 'ALL', label: 'Wszystkie' },
  { id: 'FLAT', label: 'Mieszkanie' },
  { id: 'HOUSE', label: 'Dom' },
  { id: 'PLOT', label: 'Działka' },
  { id: 'COMMERCIAL', label: 'Lokal użytkowy' },
];

export type MarketOfferRow = {
  price?: unknown;
  area?: unknown;
  district?: string | null;
  city?: string | null;
  status?: string | null;
  propertyType?: string | null;
  localityCountry?: string | null;
  localityCountryCode?: string | null;
};

export type MarketBucket = {
  key: string;
  label: string;
  avgSqm: number;
  count: number;
  sharePct: number;
  totalPrice: number;
};

export type MarketDrillPath = {
  countryCode?: string;
  countryName?: string;
  city?: string;
};

export const MARKET_CHART_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

function canonPropertyType(raw: unknown): MarketPropertyFilter | null {
  const c = normalizeOfferPropertyType(raw);
  if (!c) return null;
  if (c === 'PREMISES') return 'COMMERCIAL';
  if (c === 'FLAT' || c === 'HOUSE' || c === 'PLOT') return c;
  return null;
}

function parsePrice(price: unknown): number {
  const n = Number(String(price ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseArea(area: unknown): number {
  const n = parseFloat(String(area ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeCity(city: unknown): string {
  const c = String(city ?? '').trim();
  return c || 'Nieznane miasto';
}

function normalizeDistrict(district: unknown): string {
  const d = String(district ?? '').trim();
  if (!d || d.toUpperCase() === 'OTHER') return 'Pozostałe';
  return d;
}

function countryMeta(offer: MarketOfferRow) {
  const code = String(offer.localityCountryCode || 'PL')
    .trim()
    .toUpperCase()
    .slice(0, 8) || 'PL';
  const name = String(offer.localityCountry || (code === 'PL' ? 'Polska' : code)).trim() || code;
  return { code, name };
}

export function filterMarketOffers(offers: MarketOfferRow[], propertyFilter: MarketPropertyFilter): MarketOfferRow[] {
  return offers.filter((o) => {
    if (String(o.status || '').toUpperCase() === 'REJECTED') return false;
    if (propertyFilter === 'ALL') return true;
    return canonPropertyType(o.propertyType) === propertyFilter;
  });
}

function aggregateBuckets(
  offers: MarketOfferRow[],
  pickKey: (o: MarketOfferRow) => string,
  pickLabel: (o: MarketOfferRow, key: string) => string,
): MarketBucket[] {
  const map = new Map<string, { label: string; totalPrice: number; totalArea: number; count: number }>();

  for (const o of offers) {
    const price = parsePrice(o.price);
    const area = parseArea(o.area);
    if (price <= 0 || area <= 0) continue;
    const key = pickKey(o);
    const row = map.get(key) ?? { label: pickLabel(o, key), totalPrice: 0, totalArea: 0, count: 0 };
    row.totalPrice += price;
    row.totalArea += area;
    row.count += 1;
    map.set(key, row);
  }

  const totalCount = Array.from(map.values()).reduce((s, r) => s + r.count, 0);
  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      avgSqm: data.totalArea > 0 ? Math.round(data.totalPrice / data.totalArea) : 0,
      count: data.count,
      sharePct: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
      totalPrice: data.totalPrice,
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.avgSqm - a.avgSqm);
}

export function summarizeOffers(offers: MarketOfferRow[]) {
  let totalPrice = 0;
  let totalArea = 0;
  let count = 0;
  for (const o of offers) {
    const price = parsePrice(o.price);
    const area = parseArea(o.area);
    if (price <= 0 || area <= 0) continue;
    totalPrice += price;
    totalArea += area;
    count += 1;
  }
  return {
    avgSqm: totalArea > 0 ? Math.round(totalPrice / totalArea) : 0,
    count,
    totalPrice,
    totalArea,
  };
}

export function buildMarketView(offers: MarketOfferRow[], propertyFilter: MarketPropertyFilter, path: MarketDrillPath) {
  const filtered = filterMarketOffers(offers, propertyFilter);
  const summary = summarizeOffers(filtered);

  if (!path.countryCode) {
    const buckets = aggregateBuckets(
      filtered,
      (o) => countryMeta(o).code,
      (o) => countryMeta(o).name,
    );
    return { level: 'country' as const, buckets, summary };
  }

  const inCountry = filtered.filter((o) => countryMeta(o).code === path.countryCode);

  if (!path.city) {
    const buckets = aggregateBuckets(
      inCountry,
      (o) => normalizeCity(o.city),
      (o) => normalizeCity(o.city),
    );
    return { level: 'city' as const, buckets, summary: summarizeOffers(inCountry) };
  }

  const inCity = inCountry.filter((o) => normalizeCity(o.city) === path.city);
  const buckets = aggregateBuckets(
    inCity,
    (o) => normalizeDistrict(o.district),
    (o) => normalizeDistrict(o.district),
  );
  return { level: 'district' as const, buckets, summary: summarizeOffers(inCity) };
}

export function countOffersByPropertyType(offers: MarketOfferRow[]): Record<MarketPropertyFilter, number> {
  const counts: Record<MarketPropertyFilter, number> = {
    ALL: 0,
    FLAT: 0,
    HOUSE: 0,
    PLOT: 0,
    COMMERCIAL: 0,
  };
  for (const o of offers) {
    if (String(o.status || '').toUpperCase() === 'REJECTED') continue;
    const price = parsePrice(o.price);
    const area = parseArea(o.area);
    if (price <= 0 || area <= 0) continue;
    counts.ALL += 1;
    const canon = canonPropertyType(o.propertyType);
    if (canon) counts[canon] += 1;
  }
  return counts;
}
