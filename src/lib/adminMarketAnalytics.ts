import { normalizeOfferPropertyType } from '@/lib/offerDisplayLabels';

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
  pricePln?: unknown;
  pricePerSqm?: unknown;
  area?: unknown;
  district?: string | null;
  city?: string | null;
  status?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;
  localityCountry?: string | null;
  localityCountryCode?: string | null;
};

export type MarketBucket = {
  key: string;
  label: string;
  avgSqm: number;
  medianSqm: number;
  count: number;
  sharePct: number;
  totalPrice: number;
  excludedOutliers: number;
};

export type MarketDrillPath = {
  countryCode?: string;
  countryName?: string;
  city?: string;
};

/** Realistic PLN/m² bounds for Polish sale listings (guards bad area/price data). */
const UNIT_PRICE_BOUNDS: Record<Exclude<MarketPropertyFilter, 'ALL'>, { min: number; max: number; minArea: number }> = {
  FLAT: { min: 2_500, max: 55_000, minArea: 12 },
  HOUSE: { min: 1_500, max: 45_000, minArea: 40 },
  PLOT: { min: 20, max: 8_000, minArea: 100 },
  COMMERCIAL: { min: 1_500, max: 60_000, minArea: 15 },
};

function parseMoney(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseArea(area: unknown): number {
  if (typeof area === 'number' && Number.isFinite(area) && area > 0) return area;
  const cleaned = String(area ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const n = Number(cleaned);
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
  const code =
    String(offer.localityCountryCode || 'PL')
      .trim()
      .toUpperCase()
      .slice(0, 8) || 'PL';
  const name = String(offer.localityCountry || (code === 'PL' ? 'Polska' : code)).trim() || code;
  return { code, name };
}

function propertyCanon(offer: MarketOfferRow): Exclude<MarketPropertyFilter, 'ALL'> | null {
  const canon = normalizeOfferPropertyType(offer.propertyType);
  if (canon === 'FLAT' || canon === 'HOUSE' || canon === 'PLOT' || canon === 'COMMERCIAL') return canon;
  return null;
}

/** Unit price suitable for market averages — rejects rent and broken area/price pairs. */
export function resolveOfferUnitPrice(offer: MarketOfferRow): number | null {
  const tx = String(offer.transactionType || 'SELL').toUpperCase();
  if (tx === 'RENT' || tx === 'LEASE') return null;

  const status = String(offer.status || '').toUpperCase();
  if (status && status !== 'ACTIVE') return null;

  const canon = propertyCanon(offer) ?? 'FLAT';
  const bounds = UNIT_PRICE_BOUNDS[canon];
  const area = parseArea(offer.area);
  if (area < bounds.minArea) return null;

  const listedUnit = parseMoney(offer.pricePerSqm);
  if (listedUnit >= bounds.min && listedUnit <= bounds.max) return Math.round(listedUnit);

  const price = parseMoney(offer.pricePln) || parseMoney(offer.price);
  if (price <= 0) return null;

  const computed = price / area;
  if (computed < bounds.min || computed > bounds.max) return null;
  return Math.round(computed);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

export function filterMarketOffers(offers: MarketOfferRow[], propertyFilter: MarketPropertyFilter): MarketOfferRow[] {
  return offers.filter((o) => {
    if (String(o.status || '').toUpperCase() !== 'ACTIVE') return false;
    const tx = String(o.transactionType || 'SELL').toUpperCase();
    if (tx === 'RENT' || tx === 'LEASE') return false;
    if (propertyFilter === 'ALL') return true;
    return propertyCanon(o) === propertyFilter;
  });
}

function aggregateBuckets(
  offers: MarketOfferRow[],
  pickKey: (o: MarketOfferRow) => string,
  pickLabel: (o: MarketOfferRow, key: string) => string,
): MarketBucket[] {
  const map = new Map<
    string,
    { label: string; unitPrices: number[]; totalPrice: number; count: number; skipped: number }
  >();

  for (const o of offers) {
    const key = pickKey(o);
    const row = map.get(key) ?? {
      label: pickLabel(o, key),
      unitPrices: [],
      totalPrice: 0,
      count: 0,
      skipped: 0,
    };
    const unit = resolveOfferUnitPrice(o);
    if (unit == null) {
      row.skipped += 1;
      map.set(key, row);
      continue;
    }
    const price = parseMoney(o.pricePln) || parseMoney(o.price);
    row.unitPrices.push(unit);
    row.totalPrice += price;
    row.count += 1;
    map.set(key, row);
  }

  const totalCount = Array.from(map.values()).reduce((s, r) => s + r.count, 0);
  return Array.from(map.entries())
    .map(([key, data]) => {
      const avgSqm = data.unitPrices.length
        ? Math.round(data.unitPrices.reduce((a, b) => a + b, 0) / data.unitPrices.length)
        : 0;
      return {
        key,
        label: data.label,
        avgSqm,
        medianSqm: median(data.unitPrices),
        count: data.count,
        sharePct: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
        totalPrice: data.totalPrice,
        excludedOutliers: data.skipped,
      };
    })
    .filter((b) => b.count > 0)
    .sort((a, b) => b.medianSqm - a.medianSqm);
}

export function summarizeOffers(offers: MarketOfferRow[]) {
  const unitPrices: number[] = [];
  let totalPrice = 0;
  let excludedOutliers = 0;
  for (const o of offers) {
    const unit = resolveOfferUnitPrice(o);
    if (unit == null) {
      excludedOutliers += 1;
      continue;
    }
    unitPrices.push(unit);
    totalPrice += parseMoney(o.pricePln) || parseMoney(o.price);
  }
  const avgSqm = unitPrices.length
    ? Math.round(unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length)
    : 0;
  return {
    avgSqm,
    medianSqm: median(unitPrices),
    count: unitPrices.length,
    totalPrice,
    excludedOutliers,
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
    if (resolveOfferUnitPrice(o) == null) continue;
    counts.ALL += 1;
    const canon = propertyCanon(o);
    if (canon) counts[canon] += 1;
  }
  return counts;
}

export const MARKET_CHART_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
];
