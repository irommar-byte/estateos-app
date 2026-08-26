import { fetchOtodomOfferHtml } from '@/lib/otodomImport';
import {
  canonicalizeCity,
  canonicalizeDistrict,
  containsNormalizedToken,
  inferDistrictFromStreet,
  normalizeText,
} from '@/lib/location/locationCatalog';
import { locationNamesEquivalent } from '@/lib/location/locationNameMatch';

export type NierOnlinePropertyType = 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL';
export type NierOnlineTransactionType = 'SELL' | 'SALE' | 'RENT';

export type NierOnlineSearchFilters = {
  city: string;
  districts?: string[];
  propertyType?: NierOnlinePropertyType | string | null;
  transactionType?: NierOnlineTransactionType | string | null;
  maxPrice?: number | null;
  minArea?: number | null;
  minYear?: number | null;
  requireBalcony?: boolean;
  requireGarden?: boolean;
  requireElevator?: boolean;
  requireParking?: boolean;
  requireFurnished?: boolean;
};

export type NierOnlineSearchHit = {
  url: string;
  title: string;
  price: number | null;
  area: number | null;
  rooms: number | null;
  street: string | null;
  city: string | null;
  districtHint: string | null;
  description: string;
  source: 'nieruchomosci-online';
};

const NIER_ONLINE_HOST = 'nieruchomosci-online.pl';
const LISTING_PATH_RE = /\/[^/?#]+\/(\d{5,})\.html(?:$|[?#])/i;
const LISTING_URL_RE =
  /https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.)?nieruchomosci-online\.pl\/[^"'<>\s]+\/\d{5,}\.html/gi;

const PROPERTY_PATH: Record<string, { list: string; singular: string }> = {
  FLAT: { list: 'mieszkania', singular: 'mieszkanie' },
  HOUSE: { list: 'domy', singular: 'dom' },
  PLOT: { list: 'dzialki', singular: 'dzialka' },
  COMMERCIAL: { list: 'lokale', singular: 'lokal' },
};

function parseLooseNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const text = String(raw).replace(/\s/g, '').replace(',', '.');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  const n = Number(match ? match[0] : text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function slugifyNierOnlineCity(city: string): string {
  return normalizeText(canonicalizeCity(city) || city)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function nierOnlinePropertyPath(propertyType?: string | null): { list: string; singular: string } {
  const key = String(propertyType || 'FLAT').toUpperCase();
  return PROPERTY_PATH[key] || PROPERTY_PATH.FLAT;
}

export function nierOnlineTransactionPath(transactionType?: string | null): string {
  const key = String(transactionType || 'SELL').toUpperCase();
  return key === 'RENT' ? 'wynajem' : 'sprzedaz';
}

export function isNierOnlineListingUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== NIER_ONLINE_HOST && !host.endsWith(`.${NIER_ONLINE_HOST}`)) return false;
    if (/\/(porady|szukaj|blog|agencje)\b/i.test(url.pathname)) return false;
    return LISTING_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

export function normalizeNierOnlineListingUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function buildNierOnlineSearchUrl(filters: NierOnlineSearchFilters, page = 1): string {
  const citySlug = slugifyNierOnlineCity(filters.city) || 'warszawa';
  const property = nierOnlinePropertyPath(filters.propertyType);
  const transaction = nierOnlineTransactionPath(filters.transactionType);
  const url = new URL(`https://${citySlug}.${NIER_ONLINE_HOST}/${property.list},${transaction}/`);
  if (page > 1) url.searchParams.set('p', String(page));
  return url.toString();
}

export function buildNierOnlineSearchFallbackUrl(filters: NierOnlineSearchFilters): string {
  const city = (canonicalizeCity(filters.city) || filters.city || 'Warszawa').trim();
  const property = nierOnlinePropertyPath(filters.propertyType);
  const transaction = nierOnlineTransactionPath(filters.transactionType);
  return `https://www.${NIER_ONLINE_HOST}/szukaj.html?3,${property.singular},${transaction},,${encodeURIComponent(city)}`;
}

function amenityGroups(filters: NierOnlineSearchFilters): string[][] {
  const groups: string[][] = [];
  if (filters.requireBalcony) groups.push(['balkon', 'loggia', 'taras']);
  if (filters.requireGarden) groups.push(['ogrod', 'ogrodek']);
  if (filters.requireElevator) groups.push(['winda']);
  if (filters.requireParking) groups.push(['parking', 'garaz', 'miejsce postojowe', 'miejsce w garazu']);
  if (filters.requireFurnished) groups.push(['umeblowan', 'wyposazon']);
  return groups;
}

function haystackOf(
  hit: Pick<NierOnlineSearchHit, 'title' | 'description' | 'street' | 'districtHint' | 'city'>,
  city?: string,
): string {
  const inferred = city && hit.street ? inferDistrictFromStreet(city, hit.street) : '';
  return [hit.title, hit.description, hit.street, hit.districtHint, hit.city, inferred].filter(Boolean).join(' ');
}

export function listingMatchesClientFilters(hit: NierOnlineSearchHit, filters: NierOnlineSearchFilters): boolean {
  const wantedCity = canonicalizeCity(filters.city) || String(filters.city || '').trim();
  if (wantedCity && hit.city) {
    const hitCity = canonicalizeCity(hit.city) || hit.city;
    if (!locationNamesEquivalent(wantedCity, hitCity)) return false;
  }

  if (filters.maxPrice != null && Number.isFinite(filters.maxPrice) && filters.maxPrice > 0) {
    if (hit.price == null || hit.price > filters.maxPrice) return false;
  }

  if (filters.minArea != null && Number.isFinite(filters.minArea) && filters.minArea > 0) {
    if (hit.area != null && hit.area < filters.minArea) return false;
  }

  const districts = (filters.districts || []).map((d) => String(d || '').trim()).filter(Boolean);
  if (districts.length) {
    const hay = haystackOf(hit, wantedCity || filters.city);
    const city = canonicalizeCity(filters.city) || filters.city;
    const matched = districts.some((district) => {
      const canonical = city ? canonicalizeDistrict(city, district) || district : district;
      return containsNormalizedToken(hay, canonical) || containsNormalizedToken(hay, district);
    });
    if (!matched) return false;
  }

  if (filters.minYear != null && Number.isFinite(filters.minYear) && filters.minYear > 1900) {
    const years = Array.from(haystackOf(hit, wantedCity || filters.city).matchAll(/\b(19|20)\d{2}\b/g)).map((m) => Number(m[0]));
    if (years.length && !years.some((year) => year >= filters.minYear!)) return false;
  }

  const groups = amenityGroups(filters);
  if (groups.length) {
    const hay = normalizeText(haystackOf(hit, wantedCity || filters.city));
    if (hay.length >= 40) {
      const missingGroup = groups.some((group) => !group.some((needle) => hay.includes(normalizeText(needle))));
      if (missingGroup) return false;
    }
  }

  return true;
}

function collectJsonLdNodes(html: string): unknown[] {
  const nodes: unknown[] = [];
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(String(script[1] || '').trim());
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else nodes.push(parsed);
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return nodes;
}

function walkOffers(node: unknown, acc: Record<string, unknown>[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkOffers(item, acc);
    return;
  }
  if (typeof node !== 'object') return;
  const rec = node as Record<string, unknown>;
  const type = String(rec['@type'] || '');
  if (/offer/i.test(type) && rec.url) acc.push(rec);
  for (const value of Object.values(rec)) {
    if (value && typeof value === 'object') walkOffers(value, acc);
  }
}

function hitFromOfferNode(node: Record<string, unknown>): NierOnlineSearchHit | null {
  const urlRaw = String(node.url || '').trim();
  if (!isNierOnlineListingUrl(urlRaw)) return null;
  const url = normalizeNierOnlineListingUrl(urlRaw);
  const item =
    node.itemOffered && typeof node.itemOffered === 'object'
      ? (node.itemOffered as Record<string, unknown>)
      : {};
  const address =
    item.address && typeof item.address === 'object' ? (item.address as Record<string, unknown>) : {};
  const floorSize =
    item.floorSize && typeof item.floorSize === 'object'
      ? (item.floorSize as Record<string, unknown>)
      : {};
  const cityRaw = String(address.addressLocality || '').trim();
  const street = String(address.streetAddress || '').trim() || null;
  const title = String(node.name || item.name || '').replace(/\s+/g, ' ').trim();
  const description = String(item.description || node.description || '').replace(/\s+/g, ' ').trim();
  return {
    url,
    title: title || 'Oferta z Nieruchomości-Online',
    price: parseLooseNumber(node.price) ?? parseLooseNumber(node.highPrice),
    area: parseLooseNumber(floorSize.value) ?? parseLooseNumber(title.match(/([\d]{1,3}(?:[.,]\d{1,2})?)\s*m/i)?.[1]),
    rooms: parseLooseNumber(item.numberOfRooms),
    street,
    city: canonicalizeCity(cityRaw) || cityRaw || null,
    districtHint: street,
    description,
    source: 'nieruchomosci-online',
  };
}

function hitsFromListingUrls(html: string): NierOnlineSearchHit[] {
  const urls = Array.from(new Set((html.match(LISTING_URL_RE) || []).map((raw) => {
    try {
      return normalizeNierOnlineListingUrl(raw);
    } catch {
      return '';
    }
  }))).filter((url) => isNierOnlineListingUrl(url));

  return urls.map((url) => ({
    url,
    title: 'Oferta z Nieruchomości-Online',
    price: null,
    area: null,
    rooms: null,
    street: null,
    city: null,
    districtHint: null,
    description: '',
    source: 'nieruchomosci-online' as const,
  }));
}

export function parseNierOnlineSearchHtml(html: string): NierOnlineSearchHit[] {
  const offers: Record<string, unknown>[] = [];
  for (const node of collectJsonLdNodes(html)) walkOffers(node, offers);

  const byUrl = new Map<string, NierOnlineSearchHit>();
  for (const offer of offers) {
    const hit = hitFromOfferNode(offer);
    if (!hit) continue;
    const prev = byUrl.get(hit.url);
    if (!prev || (hit.price != null && prev.price == null) || hit.description.length > prev.description.length) {
      byUrl.set(hit.url, prev ? { ...prev, ...hit, title: hit.title || prev.title } : hit);
    }
  }

  if (byUrl.size === 0) {
    for (const hit of hitsFromListingUrls(html)) {
      if (!byUrl.has(hit.url)) byUrl.set(hit.url, hit);
    }
  }

  return [...byUrl.values()];
}

export async function searchNieruchomosciOnline(
  filters: NierOnlineSearchFilters,
  options?: { pages?: number; limit?: number },
): Promise<{ hits: NierOnlineSearchHit[]; searchUrl: string; scanned: number; fallbackUsed: boolean }> {
  const pages = Math.max(1, Math.min(options?.pages ?? 2, 3));
  const limit = Math.max(1, Math.min(options?.limit ?? 24, 40));
  const primary = buildNierOnlineSearchUrl(filters, 1);
  const collected: NierOnlineSearchHit[] = [];
  const seen = new Set<string>();
  let fallbackUsed = false;
  let searchUrl = primary;

  const ingest = (html: string) => {
    for (const hit of parseNierOnlineSearchHtml(html)) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      collected.push(hit);
    }
  };

  try {
    ingest(await fetchOtodomOfferHtml(primary));
  } catch {
    collected.length = 0;
    seen.clear();
  }

  for (let page = 2; page <= pages && collected.length > 0 && collected.length < 80; page += 1) {
    try {
      ingest(await fetchOtodomOfferHtml(buildNierOnlineSearchUrl(filters, page)));
    } catch {
      break;
    }
  }

  if (collected.length === 0) {
    const fallback = buildNierOnlineSearchFallbackUrl(filters);
    searchUrl = fallback;
    fallbackUsed = true;
    ingest(await fetchOtodomOfferHtml(fallback));
  }

  const matched = collected.filter((hit) => listingMatchesClientFilters(hit, filters));
  const relaxed =
    matched.length === 0 && (filters.districts || []).length
      ? collected.filter((hit) => listingMatchesClientFilters(hit, { ...filters, districts: [] }))
      : matched;
  return {
    hits: relaxed.slice(0, limit),
    searchUrl,
    scanned: collected.length,
    fallbackUsed,
  };
}
