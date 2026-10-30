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
  pricePln?: unknown;
  transactionType?: string | null;
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

/**
 * Cena z bazy przychodzi jako liczba albo tekst („899000.00”, „1 250 000 zł”, „1.250.000”).
 * Dawniej wycinaliśmy wszystko poza cyframi — „899000.00” stawało się 89 900 000 zł i zawyżało zł/m² stokrotnie.
 */
function parseMoney(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0;
  let s = String(raw ?? '').replace(/[\s\u00a0]/g, '').replace(/zł|pln/gi, '');
  if (!s) return 0;
  // „1.250.000” / „1,250,000” — separatory tysięcy; „899000.00” / „899000,50” — część dziesiętna.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parsePrice(offer: MarketOfferRow): number {
  return parseMoney(offer.pricePln) || parseMoney(offer.price);
}

/** Realne widełki zł/m² dla sprzedaży — poza nimi to literówka w cenie lub metrażu, nie rynek. */
const PPSM_RANGE: Record<Exclude<MarketPropertyFilter, 'ALL'>, [number, number]> = {
  FLAT: [3_000, 80_000],
  HOUSE: [1_500, 60_000],
  PLOT: [20, 15_000],
  COMMERCIAL: [1_500, 90_000],
};

function isSale(offer: MarketOfferRow) {
  const t = String(offer.transactionType || 'SELL').toUpperCase();
  return !(t.includes('RENT') || t.includes('WYNAJ') || t.includes('LEASE'));
}

/** zł/m² oferty albo null, gdy oferta nie nadaje się do statystyki cen. */
function offerPpsm(offer: MarketOfferRow): number | null {
  if (!isSale(offer)) return null;
  const price = parsePrice(offer);
  const area = parseArea(offer.area);
  if (price <= 0 || area <= 0) return null;
  const ppsm = price / area;
  const type = canonPropertyType(offer.propertyType);
  const [min, max] = type && type !== 'ALL' ? PPSM_RANGE[type] : [500, 90_000];
  if (ppsm < min || ppsm > max) return null;
  return ppsm;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
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
  const map = new Map<string, { label: string; ppsm: number[]; totalPrice: number }>();

  for (const o of offers) {
    const ppsm = offerPpsm(o);
    if (ppsm == null) continue;
    const key = pickKey(o);
    const row = map.get(key) ?? { label: pickLabel(o, key), ppsm: [], totalPrice: 0 };
    row.ppsm.push(ppsm);
    row.totalPrice += parsePrice(o);
    map.set(key, row);
  }

  const totalCount = Array.from(map.values()).reduce((s, r) => s + r.ppsm.length, 0);
  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      avgSqm: median(data.ppsm),
      count: data.ppsm.length,
      sharePct: totalCount > 0 ? Math.round((data.ppsm.length / totalCount) * 100) : 0,
      totalPrice: data.totalPrice,
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.avgSqm - a.avgSqm);
}

/** Podsumowanie: mediana zł/m² (pole `avgSqm` zostaje dla zgodności z widokiem). */
export function summarizeOffers(offers: MarketOfferRow[]) {
  const values: number[] = [];
  let totalPrice = 0;
  for (const o of offers) {
    const ppsm = offerPpsm(o);
    if (ppsm == null) continue;
    values.push(ppsm);
    totalPrice += parsePrice(o);
  }
  return { avgSqm: median(values), count: values.length, totalPrice, totalArea: 0 };
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
    if (offerPpsm(o) == null) continue;
    counts.ALL += 1;
    const canon = canonPropertyType(o.propertyType);
    if (canon) counts[canon] += 1;
  }
  return counts;
}
