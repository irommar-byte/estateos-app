import {
  ensureKeiAmerSession,
  fetchKeiListingsPage,
  isSupportedKeiPortalUrl,
  isWarsawListing,
  parseKeiListingDate,
  parseKeiNumeric,
  rowMatchesKeiFilters,
  type KeiListingRow,
  type KeiPropertyKind,
  type KeiTransactionKind,
} from '@/lib/keiAmerClient';
import { getDistrictsForCity, normalizeText } from '@/lib/location/locationCatalog';

export type KeiFacetOption = {
  id: string;
  label: string;
  count: number;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type KeiSearchFacets = {
  ok: true;
  propertyKind: KeiPropertyKind;
  transactionKind: KeiTransactionKind;
  sampled: number;
  districts: KeiFacetOption[];
  priceRanges: KeiFacetOption[];
  areaRanges: KeiFacetOption[];
  datePresets: KeiFacetOption[];
};

type RangeDef = {
  id: string;
  label: string;
  min?: number;
  max?: number;
};

const FACETS_TTL_MS = 5 * 60 * 1000;
const facetsCache = new Map<string, { expires: number; value: KeiSearchFacets }>();

function normalizeForMatch(value: string): string {
  return normalizeText(value).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDayOffset(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

export function extractWarsawDistrictFromKeiAddress(address: string): string {
  const raw = String(address || '').trim();
  if (!raw) return '';

  const districts = getDistrictsForCity('Warszawa');
  const hay = normalizeForMatch(raw);
  const sorted = [...districts].sort(
    (a, b) => normalizeForMatch(b).length - normalizeForMatch(a).length,
  );

  for (const district of sorted) {
    const needle = normalizeForMatch(district);
    if (!needle) continue;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    if (re.test(hay)) return district;
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const second = normalizeForMatch(parts[1]);
    const hit = districts.find((district) => normalizeForMatch(district) === second);
    if (hit) return hit;
  }

  return '';
}

function inRange(value: number | null, min?: number, max?: number): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  if (min != null && value < min) return false;
  if (max != null && value >= max) return false;
  return true;
}

export function salePriceRangeDefs(): RangeDef[] {
  return [
    { id: 'lt500k', label: 'do 500 tys.', max: 500_000 },
    { id: '500-800k', label: '500–800 tys.', min: 500_000, max: 800_000 },
    { id: '800k-1.2m', label: '800 tys.–1,2 mln', min: 800_000, max: 1_200_000 },
    { id: '1.2-2m', label: '1,2–2 mln', min: 1_200_000, max: 2_000_000 },
    { id: 'gt2m', label: 'powyżej 2 mln', min: 2_000_000 },
  ];
}

export function rentPriceRangeDefs(): RangeDef[] {
  return [
    { id: 'lt3k', label: 'do 3 tys.', max: 3_000 },
    { id: '3-5k', label: '3–5 tys.', min: 3_000, max: 5_000 },
    { id: '5-8k', label: '5–8 tys.', min: 5_000, max: 8_000 },
    { id: '8-12k', label: '8–12 tys.', min: 8_000, max: 12_000 },
    { id: 'gt12k', label: 'powyżej 12 tys.', min: 12_000 },
  ];
}

export function apartmentAreaRangeDefs(): RangeDef[] {
  return [
    { id: 'lt40', label: 'do 40 m²', max: 40 },
    { id: '40-55', label: '40–55 m²', min: 40, max: 55 },
    { id: '55-70', label: '55–70 m²', min: 55, max: 70 },
    { id: '70-90', label: '70–90 m²', min: 70, max: 90 },
    { id: '90-120', label: '90–120 m²', min: 90, max: 120 },
    { id: 'gt120', label: 'powyżej 120 m²', min: 120 },
  ];
}

export function houseAreaRangeDefs(): RangeDef[] {
  return [
    { id: 'lt100', label: 'do 100 m²', max: 100 },
    { id: '100-150', label: '100–150 m²', min: 100, max: 150 },
    { id: '150-200', label: '150–200 m²', min: 150, max: 200 },
    { id: '200-300', label: '200–300 m²', min: 200, max: 300 },
    { id: 'gt300', label: 'powyżej 300 m²', min: 300 },
  ];
}

function countRange(values: number[], def: RangeDef): number {
  return values.filter((value) => inRange(value, def.min, def.max)).length;
}

function toRangeOptions(
  defs: RangeDef[],
  values: number[],
  kind: 'price' | 'area',
): KeiFacetOption[] {
  return defs.map((def) => ({
    id: def.id,
    label: def.label,
    count: countRange(values, def),
    ...(kind === 'price'
      ? { minPrice: def.min, maxPrice: def.max != null ? def.max - 1 : undefined }
      : { minArea: def.min, maxArea: def.max != null ? Number((def.max - 0.01).toFixed(2)) : undefined }),
  }));
}

export function buildKeiSearchFacets(
  rows: KeiListingRow[],
  options: { propertyKind: KeiPropertyKind; transactionKind: KeiTransactionKind },
): KeiSearchFacets {
  const propertyKind = options.propertyKind === 'house' ? 'house' : 'apartment';
  const transactionKind = options.transactionKind === 'rent' ? 'rent' : 'sale';
  const sampled = rows.length;

  const districtCounts = new Map<string, number>();
  for (const name of getDistrictsForCity('Warszawa')) districtCounts.set(name, 0);

  const prices: number[] = [];
  const areas: number[] = [];
  const dates: Date[] = [];

  for (const row of rows) {
    const district = extractWarsawDistrictFromKeiAddress(`${row.adres || ''} ${row.tekst || ''}`);
    if (district) districtCounts.set(district, (districtCounts.get(district) || 0) + 1);

    const price = parseKeiNumeric(row.cena);
    if (price != null) prices.push(price);
    const area = parseKeiNumeric(row.pow);
    if (area != null) areas.push(area);
    const listingDate = parseKeiListingDate(row.data);
    if (listingDate) dates.push(listingDate);
  }

  const districts: KeiFacetOption[] = [...districtCounts.entries()]
    .map(([name, count]) => ({
      id: name,
      label: name,
      count,
      district: name,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl'));

  const priceDefs = transactionKind === 'rent' ? rentPriceRangeDefs() : salePriceRangeDefs();
  const areaDefs = propertyKind === 'house' ? houseAreaRangeDefs() : apartmentAreaRangeDefs();

  const day7 = startOfDayOffset(-7);
  const day30 = startOfDayOffset(-30);
  const day90 = startOfDayOffset(-90);

  const datePresets: KeiFacetOption[] = [
    {
      id: '7d',
      label: 'Ostatnie 7 dni',
      count: dates.filter((d) => d >= day7).length,
      dateFrom: isoDay(day7),
    },
    {
      id: '30d',
      label: 'Ostatnie 30 dni',
      count: dates.filter((d) => d >= day30).length,
      dateFrom: isoDay(day30),
    },
    {
      id: '90d',
      label: 'Ostatnie 90 dni',
      count: dates.filter((d) => d >= day90).length,
      dateFrom: isoDay(day90),
    },
    {
      id: 'older90',
      label: 'Starsze niż 90 dni',
      count: dates.filter((d) => d < day90).length,
      dateTo: isoDay(startOfDayOffset(-91)),
    },
  ];

  return {
    ok: true,
    propertyKind,
    transactionKind,
    sampled,
    districts,
    priceRanges: toRangeOptions(priceDefs, prices, 'price'),
    areaRanges: toRangeOptions(areaDefs, areas, 'area'),
    datePresets,
  };
}

async function sampleWarsawKeiRows(
  propertyKind: KeiPropertyKind,
  transactionKind: KeiTransactionKind,
): Promise<KeiListingRow[]> {
  const rows: KeiListingRow[] = [];
  const limit = 50;
  const maxPages = 4;

  for (let page = 0; page < maxPages; page += 1) {
    const chunk = await fetchKeiListingsPage({
      start: page * limit,
      limit,
      sort: 'data',
      dir: 'DESC',
      propertyKind,
      transactionKind,
      okres: '0',
    });
    for (const row of chunk.rows) {
      if (!isWarsawListing(row)) continue;
      if (!isSupportedKeiPortalUrl(row.www || '')) continue;
      if (!rowMatchesKeiFilters(row, propertyKind, transactionKind)) continue;
      rows.push(row);
    }
    if (chunk.rows.length < limit) break;
  }

  return rows;
}

export async function collectKeiSearchFacets(options?: {
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
}): Promise<KeiSearchFacets> {
  const propertyKind = options?.propertyKind === 'house' ? 'house' : 'apartment';
  const transactionKind = options?.transactionKind === 'rent' ? 'rent' : 'sale';
  const cacheKey = `${propertyKind}:${transactionKind}`;
  const cached = facetsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const session = await ensureKeiAmerSession();
  if (!session.ok) {
    throw new Error(session.message);
  }

  const rows = await sampleWarsawKeiRows(propertyKind, transactionKind);
  const value = buildKeiSearchFacets(rows, { propertyKind, transactionKind });
  facetsCache.set(cacheKey, { expires: Date.now() + FACETS_TTL_MS, value });
  return value;
}
