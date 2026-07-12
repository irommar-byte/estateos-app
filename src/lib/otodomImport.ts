import { canonicalizeCity, canonicalizeDistrict, isStrictCity, pickDistrictFromPlaceName } from '@/lib/location/locationCatalog';
import { locationNamesEquivalent } from '@/lib/location/locationNameMatch';
import { inferCityFromImportSlug, inferCityFromLocationHints } from '@/lib/portalImportEnrich';

const OTODOM_HOST = 'otodom.pl';
const OLX_HOST = 'olx.pl';
const NIERUCHOMOSCI_ONLINE_HOST = 'nieruchomosci-online.pl';
const FETCH_TIMEOUT_MS = 40_000;

function isNieruchomosciOnlineHost(host: string): boolean {
  const normalized = String(host || '').replace(/^www\./, '').toLowerCase();
  return (
    normalized === NIERUCHOMOSCI_ONLINE_HOST ||
    normalized.endsWith(`.${NIERUCHOMOSCI_ONLINE_HOST}`)
  );
}

export type OtodomImportDraft = {
  source: 'OTODOM' | 'OLX' | 'NIERUCHOMOSCI_ONLINE';
  externalId: number;
  externalUrl: string;
  slug: string;
  title: string;
  transactionType: 'RENT' | 'SALE';
  propertyType: 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL';
  price: number | null;
  priceCurrency: 'PLN';
  adminFee: number | null;
  deposit: number | null;
  area: number | null;
  plotArea: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  yearBuilt: number | null;
  condition: string | null;
  conditionCode: string | null;
  heating: string | null;
  heatingCode: string | null;
  buildingType: string | null;
  city: string;
  district: string;
  neighborhood: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
  localityCountryCode: 'PL';
  descriptionHtml: string;
  descriptionText: string;
  features: string[];
  imageUrls: string[];
  imageCount: number;
  agency: { id: number; name: string; phone: string | null; address: string | null } | null;
  advertiserType: string | null;
  status: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  characteristics: Record<string, { value: string; label: string }>;
  locationWarnings: string[];
  parsedAt: string;
};

type RawAd = Record<string, unknown>;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decodeImportHtmlText(html: string): string {
  return String(html || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&sup2;|&#178;/gi, '²')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}

/** Czytelny tekst z fragmentu HTML listy portali (bez tagów i śmieci z anchorów). */
function plainImportListText(html: string): string {
  return stripHtml(decodeImportHtmlText(html)).replace(/\s+/g, ' ').trim();
}

const IMPORT_HEATING_CANONICAL = [
  'Miejskie',
  'Gazowe',
  'Elektryczne',
  'Pompa Ciepła',
  'Węglowe/Pellet',
  'Inne',
] as const;

type ImportHeatingCanonical = (typeof IMPORT_HEATING_CANONICAL)[number];

/** Normalizuje ogrzewanie ze wszystkich portali do kanonicznych etykiet aplikacji. */
export function sanitizeImportHeating(
  raw: string | null | undefined,
  code?: string | null,
): ImportHeatingCanonical | null {
  const plain = plainImportListText(String(raw || ''));
  const codeToken = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  const fromCode: Record<string, ImportHeatingCanonical> = {
    city: 'Miejskie',
    district: 'Miejskie',
    municipal: 'Miejskie',
    central: 'Miejskie',
    central_heating: 'Miejskie',
    gas: 'Gazowe',
    electric: 'Elektryczne',
    electrical: 'Elektryczne',
    heat_pump: 'Pompa Ciepła',
    heatpump: 'Pompa Ciepła',
    coal: 'Węglowe/Pellet',
    pellet: 'Węglowe/Pellet',
    coal_pellet: 'Węglowe/Pellet',
    other: 'Inne',
    none: 'Inne',
  };
  if (codeToken && fromCode[codeToken]) return fromCode[codeToken];

  const probe = plain.toLowerCase();
  if (!probe) return null;
  if (/miejsk|ciepłoci|mco|co\s+miejsk|centraln/i.test(probe)) return 'Miejskie';
  if (/gaz|gazow/i.test(probe)) return 'Gazowe';
  if (/elektryczn/i.test(probe)) return 'Elektryczne';
  if (/pomp/i.test(probe)) return 'Pompa Ciepła';
  if (/węg|weg|pellet|ekogroszek|kotł/i.test(probe)) return 'Węglowe/Pellet';
  if (/komink|piecek|piece/i.test(probe)) return 'Inne';
  if (/<a\s|href\s*=|https?:\/\//i.test(plain)) return null;
  if (plain.length > 48) return null;

  const exact = IMPORT_HEATING_CANONICAL.find(
    (label) => label.toLowerCase() === probe || label.toLowerCase().replace(/\s+/g, '_') === codeToken,
  );
  if (exact) return exact;

  if (/[a-ząćęłńóśźż]/i.test(plain) && plain.length >= 3) return 'Inne';
  return null;
}

export function normalizeImportDraftHeating(draft: OtodomImportDraft): OtodomImportDraft {
  const heating = sanitizeImportHeating(draft.heating, draft.heatingCode);
  return {
    ...draft,
    heating,
    heatingCode: heating ? heating.toLowerCase().replace(/\s+/g, '_') : null,
  };
}

function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).replace(/\s/g, '').replace(',', '.');
  const match = value.match(/-?\d+(?:\.\d+)?/);
  const n = Number(match ? match[0] : value);
  return Number.isFinite(n) ? n : null;
}

function parseFloor(raw: unknown): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/parter/i.test(value)) return 0;
  const fromToken = value.match(/floor_(\d+)/i);
  if (fromToken) return parseNumber(fromToken[1]);
  return parseNumber(value);
}

const OLX_WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  more: 12,
};

export function capitalizeImportTitle(title: string): string {
  const trimmed = String(title || '').trim();
  if (!trimmed) return trimmed;
  const first = trimmed.charAt(0);
  const upper = first.toLocaleUpperCase('pl-PL');
  if (first === upper) return trimmed;
  return upper + trimmed.slice(1);
}

function parseOlxNumericToken(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const fromDigits = parseNumber(text);
  if (fromDigits != null) return fromDigits;
  const word = text.toLowerCase();
  if (OLX_WORD_NUMBERS[word] != null) return OLX_WORD_NUMBERS[word];
  const roomsInText = text.match(/(\d+)\s*pok/i);
  if (roomsInText) return parseNumber(roomsInText[1]);
  return null;
}

function findOlxParamRow(
  params: Array<Record<string, unknown>>,
  keys: string[],
  nameHints: string[] = [],
): Record<string, unknown> | null {
  for (const key of keys) {
    const row = params.find((entry) => String(entry.key ?? '') === key);
    if (row) return row;
  }
  if (nameHints.length) {
    const row = params.find((entry) => {
      const name = String(entry.name ?? '').toLowerCase();
      return nameHints.some((hint) => name.includes(hint));
    });
    if (row) return row;
  }
  return null;
}

function parseOlxParamNumber(
  params: Array<Record<string, unknown>>,
  keys: string[],
  nameHints: string[] = [],
): number | null {
  const row = findOlxParamRow(params, keys, nameHints);
  if (!row) return null;
  const label = String(row.value ?? '').trim();
  const normalized = String(row.normalizedValue ?? '').trim();
  return parseOlxNumericToken(label) ?? parseOlxNumericToken(normalized);
}

function parseOlxParamText(
  params: Array<Record<string, unknown>>,
  keys: string[],
  nameHints: string[] = [],
): string | null {
  const row = findOlxParamRow(params, keys, nameHints);
  if (!row) return null;
  const label = String(row.value ?? '').trim();
  const normalized = String(row.normalizedValue ?? '').trim();
  const text = label || normalized;
  return text || null;
}

export function sanitizeImportYearBuilt(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1800 || n > 2100) return null;
  return n;
}

function resolveYearBuiltFromCharacteristics(
  chars: Map<string, { value: string; label: string }>,
  fallbacks: { title: string; descriptionText: string; descriptionHtml?: string; features: string[] },
): number | null {
  const charKeys = ['build_year', 'construction_year', 'building_year', 'year', 'built_year'];
  for (const key of charKeys) {
    const fromChar = sanitizeImportYearBuilt(parseNumber(chars.get(key)?.value));
    if (fromChar) return fromChar;
    const fromLabel = sanitizeImportYearBuilt(parseNumber(chars.get(key)?.label));
    if (fromLabel) return fromLabel;
  }

  const textHints = enrichImportFieldsFromText(fallbacks);
  if (textHints.yearBuilt) return textHints.yearBuilt;

  const htmlBlob = String(fallbacks.descriptionHtml || '');
  const htmlYear =
    sanitizeImportYearBuilt(parseNumber(htmlBlob.match(/"buildYear"\s*:\s*"?(\d{4})"?/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(htmlBlob.match(/"yearBuilt"\s*:\s*"?(\d{4})"?/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(htmlBlob.match(/"constructionYear"\s*:\s*"?(\d{4})"?/i)?.[1]));
  return htmlYear;
}

function enrichImportFieldsFromText(input: {
  title: string;
  descriptionText: string;
  features: string[];
}): {
  rooms: number | null;
  yearBuilt: number | null;
  heating: string | null;
  adminFee: number | null;
} {
  const blob = [input.title, input.descriptionText, ...input.features].join('\n');
  const plain = decodeImportHtmlText(blob);

  const rooms =
    parseNumber(plain.match(/(\d+)\s*pok(?:ó|o)j(?:e|ów|owy|owe|owa)?/i)?.[1]) ??
    parseNumber(plain.match(/(\d+)\s*[-–]\s*pokojow/i)?.[1]) ??
    parseNumber(plain.match(/(\d+)-pokojow/i)?.[1]) ??
    parseNumber(plain.match(/liczba\s+pokoi[:\s]*(\d+)/i)?.[1]);

  const yearBuilt =
    sanitizeImportYearBuilt(parseNumber(plain.match(/rok\s*(?:budowy|budow[yai]|konstrukcji)[:\s]*(\d{4})/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(plain.match(/r\.\s*budow[yai][:\s]*(\d{4})/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(plain.match(/(?:zbudowan[eoy]|budyn(?:ek|ku))\s+(?:w\s+)?(?:roku\s+)?(\d{4})/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(plain.match(/\bz\s+(19\d{2}|20\d{2})\s+r\.?\b/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(plain.match(/\b(19\d{2}|20\d{2})\s*r\.?\b/i)?.[1]));

  const heatingMatch =
    plain.match(/ogrzewani[eę][:\s]+([^.\n;]+)/i) ??
    plain.match(/(?:typ|rodzaj)\s+ogrzewania[:\s]+([^.\n;]+)/i);
  let heating = heatingMatch ? heatingMatch[1].trim() : null;
  if (heating) {
    heating = sanitizeImportHeating(heating);
  }

  const adminFee =
    parseNumber(plain.match(/czynsz(?:\s+administracyjny|\s+do\s+administracji)?[:\s]*(\d[\d\s.,]*)\s*(?:zł|pln)/i)?.[1]) ??
    parseNumber(plain.match(/opłat[aey]\s+administracyjn[aey][^0-9]{0,24}(\d[\d\s.,]*)\s*(?:zł|pln)/i)?.[1]) ??
    parseNumber(plain.match(/(?:\+|plus)\s*czynsz[^0-9]{0,16}(\d[\d\s.,]*)\s*(?:zł|pln)/i)?.[1]);

  return { rooms, yearBuilt, heating, adminFee };
}

function characteristicsMap(ad: RawAd): Map<string, { value: string; label: string }> {
  const map = new Map<string, { value: string; label: string }>();
  const list = ad.characteristics;
  if (!Array.isArray(list)) return map;
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    map.set(key, {
      value: String(row.value ?? ''),
      label: String(row.localizedValue ?? row.value ?? ''),
    });
  }
  return map;
}

function resolvePlotAreaFromCharacteristics(
  chars: Map<string, { value: string; label: string }>,
  descriptionHtml: string,
): number | null {
  const keyCandidates = [
    'plot_area',
    'terrain_area',
    'parcel_area',
    'lot_area',
    'dzialka',
    'dzialka_area',
    'land_area',
  ];
  for (const key of keyCandidates) {
    const n = parseNumber(chars.get(key)?.value ?? chars.get(key)?.label);
    if (n != null && n > 0) return n;
  }

  for (const entry of chars.values()) {
    const label = String(entry.label || '').toLowerCase();
    if (!label) continue;
    if (label.includes('działk') || label.includes('dzialk') || label.includes('parcel') || label.includes('teren')) {
      const n = parseNumber(entry.value || entry.label);
      if (n != null && n > 0) return n;
    }
  }

  const plain = stripHtml(descriptionHtml || '');
  const m = plain.match(/powierzchnia\s+dzia[łl]ki[:\s]*([\d\s,.]+)\s*m/i);
  const fallback = parseNumber(m?.[1]);
  return fallback != null && fallback > 0 ? fallback : null;
}

function mapPropertyType(raw: unknown): OtodomImportDraft['propertyType'] {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'HOUSE') return 'HOUSE';
  if (value === 'PLOT' || value === 'LAND') return 'PLOT';
  if (value === 'COMMERCIAL' || value === 'OFFICE' || value === 'HALL') return 'COMMERCIAL';
  return 'FLAT';
}

function mapTransactionType(raw: unknown): OtodomImportDraft['transactionType'] {
  const value = String(raw ?? '').trim().toUpperCase();
  return value === 'RENT' ? 'RENT' : 'SALE';
}

function extractAdPayload(html: string): RawAd {
  const scriptMatch = html.match(/<script[^>]*>(\{"props"[\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Nie znaleziono danych ogłoszenia w HTML OtoDom.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(scriptMatch[1]);
  } catch {
    throw new Error('Nie udało się sparsować JSON z OtoDom.');
  }

  const ad = (payload as { props?: { pageProps?: { ad?: RawAd } } }).props?.pageProps?.ad;
  if (!ad || typeof ad !== 'object') {
    throw new Error('Brak obiektu ogłoszenia (pageProps.ad) w odpowiedzi OtoDom.');
  }
  return ad;
}

function extractOlxAdPayload(html: string): RawAd {
  const key = 'window.__PRERENDERED_STATE__=';
  const startIdx = html.indexOf(key);
  if (startIdx < 0) {
    throw new Error('Nie znaleziono danych ogłoszenia w HTML OLX.');
  }

  const quoteStart = html.indexOf('"', startIdx + key.length);
  if (quoteStart < 0) {
    throw new Error('Nie znaleziono zakodowanego payloadu OLX.');
  }

  let i = quoteStart + 1;
  let escaped = false;
  while (i < html.length) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      i += 1;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      i += 1;
      continue;
    }
    if (ch === '"') break;
    i += 1;
  }

  if (i >= html.length) {
    throw new Error('Nie udało się odczytać końca payloadu OLX.');
  }

  const encoded = html.slice(quoteStart + 1, i);
  let decoded: string;
  try {
    decoded = JSON.parse(`"${encoded}"`) as string;
  } catch {
    throw new Error('Nie udało się odkodować payloadu OLX.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decoded);
  } catch {
    throw new Error('Nie udało się sparsować JSON payloadu OLX.');
  }

  const ad = (payload as { ad?: { ad?: RawAd } }).ad?.ad;
  if (!ad || typeof ad !== 'object') {
    throw new Error('Brak obiektu ogłoszenia OLX (ad.ad).');
  }

  return ad;
}

function normalizeOtodomUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Nieprawidłowy adres URL.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== OTODOM_HOST) {
    throw new Error('Obsługiwane są wyłącznie linki z otodom.pl.');
  }
  if (!url.pathname.includes('/oferta/')) {
    throw new Error('URL musi wskazywać stronę oferty (/pl/oferta/...).');
  }

  url.search = '';
  url.hash = '';
  return url.toString();
}

function normalizeOlxUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Nieprawidłowy adres URL.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== OLX_HOST) {
    throw new Error('Obsługiwane są wyłącznie linki z olx.pl.');
  }
  if (!url.pathname.includes('/d/oferta/')) {
    throw new Error('URL musi wskazywać stronę ogłoszenia OLX (/d/oferta/...).');
  }

  url.hash = '';
  return url.toString();
}

function normalizeNieruchomosciOnlineUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Nieprawidłowy adres URL.');
  }
  const host = url.hostname;
  if (!isNieruchomosciOnlineHost(host)) {
    throw new Error('Obsługiwane są wyłącznie linki z nieruchomosci-online.pl.');
  }
  url.hash = '';
  return url.toString();
}

export function detectImportSource(input: string): OtodomImportDraft['source'] {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Nieprawidłowy adres URL.');
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === OTODOM_HOST) return 'OTODOM';
  if (host === OLX_HOST) return 'OLX';
  if (isNieruchomosciOnlineHost(host)) return 'NIERUCHOMOSCI_ONLINE';
  throw new Error('Obsługiwane są wyłącznie linki z OtoDom, OLX lub Nieruchomosci-Online.');
}

export function isSupportedImportOfferUrl(input: string): boolean {
  try {
    const source = detectImportSource(input);
    if (source === 'OTODOM') {
      normalizeOtodomUrl(input);
    } else if (source === 'OLX') {
      normalizeOlxUrl(input);
    } else {
      normalizeNieruchomosciOnlineUrl(input);
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchOtodomOfferHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pl-PL,pl;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`OtoDom zwrócił HTTP ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Przekroczono limit czasu pobierania strony OtoDom.');
    }
    throw error instanceof Error ? error : new Error('Błąd pobierania strony OtoDom.');
  } finally {
    clearTimeout(timer);
  }
}

export function parseOtodomAd(ad: RawAd, sourceUrl: string): OtodomImportDraft {
  const chars = characteristicsMap(ad);
  const adCategory = (ad.adCategory ?? {}) as Record<string, unknown>;
  const location = (ad.location ?? {}) as Record<string, unknown>;
  const coordinates = (location.coordinates ?? {}) as Record<string, unknown>;
  const address = (location.address ?? {}) as Record<string, unknown>;
  const cityObj = (address.city ?? {}) as Record<string, unknown>;
  const districtObj = (address.district ?? {}) as Record<string, unknown>;
  const streetObj = (address.street ?? {}) as Record<string, unknown>;
  const reverseGeocoding = (location.reverseGeocoding ?? {}) as Record<string, unknown>;
  const reverseLocations = Array.isArray(reverseGeocoding.locations) ? reverseGeocoding.locations : [];

  const otodomDistrict = String(districtObj.name ?? '').trim();
  const neighborhoodEntry = [...reverseLocations]
    .reverse()
    .find((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      return String((entry as Record<string, unknown>).locationLevel ?? '') === 'residential';
    }) as Record<string, unknown> | undefined;
  const neighborhood = neighborhoodEntry ? String(neighborhoodEntry.name ?? '').trim() || null : null;

  let city = canonicalizeCity(String(cityObj.name ?? ''));
  if (!city) {
    for (const entry of reverseLocations) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const level = String(row.locationLevel ?? '').toLowerCase();
      const name = String(row.name ?? '').trim();
      if (!name) continue;
      if (level === 'city' || level === 'place') {
        const candidate = canonicalizeCity(name);
        if (candidate) {
          city = candidate;
          break;
        }
      }
    }
  }

  const hintedCity = inferCityFromLocationHints(
    otodomDistrict,
    neighborhood,
    String(ad.title ?? ''),
    sourceUrl,
  );
  if (hintedCity && (!city || (!isStrictCity(city) && !locationNamesEquivalent(city, hintedCity)))) {
    city = hintedCity;
  }

  if (!city) {
    city = inferCityFromImportSlug(sourceUrl, String(ad.title ?? ''));
  }

  const district = canonicalizeDistrict(city, otodomDistrict || neighborhood || '');
  const locationWarnings: string[] = [];
  if (neighborhood && otodomDistrict && normalizeText(neighborhood) !== normalizeText(otodomDistrict)) {
    locationWarnings.push(`OtoDom: dzielnica „${otodomDistrict}”, rejon „${neighborhood}”.`);
  }

  const images = Array.isArray(ad.images) ? ad.images : [];
  const imageUrls = images
    .map((image) => {
      if (!image || typeof image !== 'object') return null;
      const row = image as Record<string, unknown>;
      return String(row.large ?? row.medium ?? row.small ?? '').trim() || null;
    })
    .filter((value): value is string => Boolean(value));

  const agencyRaw = (ad.agency ?? null) as Record<string, unknown> | null;
  const phones = Array.isArray(agencyRaw?.phones) ? agencyRaw?.phones : [];
  const descriptionHtml = String(ad.description ?? '');
  const plotArea = resolvePlotAreaFromCharacteristics(chars, descriptionHtml);

  const characteristics: Record<string, { value: string; label: string }> = {};
  chars.forEach((value, key) => {
    characteristics[key] = value;
  });

  const title = capitalizeImportTitle(String(ad.title ?? '').trim());
  const descriptionText = stripHtml(descriptionHtml);
  const features = Array.isArray(ad.features) ? ad.features.map((f) => String(f)) : [];
  const yearBuilt = resolveYearBuiltFromCharacteristics(chars, {
    title,
    descriptionText,
    descriptionHtml,
    features,
  });

  return {
    source: 'OTODOM',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.slug ?? ''),
    title,
    transactionType: mapTransactionType(adCategory.type),
    propertyType: mapPropertyType(adCategory.name),
    price: parseNumber(chars.get('price')?.value),
    priceCurrency: 'PLN',
    adminFee: parseNumber(chars.get('rent')?.value),
    deposit: parseNumber(chars.get('deposit')?.value),
    area: parseNumber(chars.get('m')?.value),
    plotArea,
    rooms: parseNumber(chars.get('rooms_num')?.value),
    floor: parseFloor(chars.get('floor_no')?.value),
    totalFloors: parseNumber(chars.get('building_floors_num')?.value),
    yearBuilt,
    condition: chars.get('construction_status')?.label ?? null,
    conditionCode: chars.get('construction_status')?.value ?? null,
    heating: sanitizeImportHeating(chars.get('heating')?.label ?? null, chars.get('heating')?.value ?? null),
    heatingCode: (() => {
      const normalized = sanitizeImportHeating(
        chars.get('heating')?.label ?? null,
        chars.get('heating')?.value ?? null,
      );
      return normalized ? normalized.toLowerCase().replace(/\s+/g, '_') : null;
    })(),
    buildingType: chars.get('building_type')?.label ?? null,
    city,
    district,
    neighborhood,
    street: String(streetObj.name ?? '').trim() || null,
    lat: parseNumber(coordinates.latitude),
    lng: parseNumber(coordinates.longitude),
    localityCountryCode: 'PL',
    descriptionHtml,
    descriptionText,
    features,
    imageUrls,
    imageCount: imageUrls.length,
    agency: agencyRaw
      ? {
          id: parseNumber(agencyRaw.id) ?? 0,
          name: String(agencyRaw.name ?? '').trim(),
          phone: phones.length ? String(phones[0]) : null,
          address: String(agencyRaw.address ?? '').trim() || null,
        }
      : null,
    advertiserType: String(ad.advertiserType ?? ad.advertType ?? '').trim() || null,
    status: String(ad.status ?? '').trim() || null,
    createdAt: String(ad.createdAt ?? '').trim() || null,
    modifiedAt: String(ad.modifiedAt ?? '').trim() || null,
    characteristics,
    locationWarnings,
    parsedAt: new Date().toISOString(),
  };
}

function getOlxParam(
  params: Array<Record<string, unknown>>,
  key: string,
): { value: string; label: string } | null {
  const row = params.find((entry) => String(entry.key ?? '') === key);
  if (!row) return null;
  const value = String(row.normalizedValue ?? row.value ?? '').trim();
  const label = String(row.value ?? row.normalizedValue ?? '').trim();
  return { value, label };
}

function mapOlxTransactionType(ad: RawAd): OtodomImportDraft['transactionType'] {
  const category = (ad.category ?? {}) as Record<string, unknown>;
  const categoryId = Number(category.id);
  if (categoryId === 15 || categoryId === 20 || categoryId === 25 || categoryId === 127) {
    return 'RENT';
  }
  const urlPath = String(ad.urlPath ?? ad.url ?? '').toLowerCase();
  if (urlPath.includes('/wynajem/')) return 'RENT';
  return 'SALE';
}

function mapOlxPropertyType(ad: RawAd): OtodomImportDraft['propertyType'] {
  const urlPath = String(ad.urlPath ?? ad.url ?? '').toLowerCase();
  if (urlPath.includes('/domy/')) return 'HOUSE';
  if (urlPath.includes('/dzialki/')) return 'PLOT';
  if (urlPath.includes('/biura-lokale/') || urlPath.includes('/pozostale-nieruchomosci/')) return 'COMMERCIAL';
  return 'FLAT';
}

export function parseOlxAd(ad: RawAd, sourceUrl: string): OtodomImportDraft {
  const paramsRaw = Array.isArray(ad.params) ? ad.params : [];
  const params = paramsRaw.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
  const map = (key: string) => getOlxParam(params, key);
  const location = (ad.location ?? {}) as Record<string, unknown>;
  const mapData = (ad.map ?? {}) as Record<string, unknown>;
  const user = (ad.user ?? null) as Record<string, unknown> | null;
  const city = canonicalizeCity(String(location.cityName ?? '').trim());
  const district = canonicalizeDistrict(city, String(location.districtName ?? '').trim());

  const characteristics: Record<string, { value: string; label: string }> = {};
  for (const entry of params) {
    const key = String(entry.key ?? '').trim();
    if (!key) continue;
    characteristics[key] = {
      value: String(entry.normalizedValue ?? entry.value ?? ''),
      label: String(entry.value ?? entry.normalizedValue ?? ''),
    };
  }

  const images = Array.isArray(ad.photos)
    ? ad.photos.map((photo) => String(photo ?? '').trim()).filter((value) => Boolean(value))
    : [];

  const title = capitalizeImportTitle(String(ad.title ?? '').trim());
  const descriptionHtml = String(ad.description ?? '');
  const descriptionText = stripHtml(descriptionHtml);
  const features = params
    .map((entry) => {
      const name = String(entry.name ?? '').trim();
      const value = String(entry.value ?? '').trim();
      return name && value ? `${name}: ${value}` : '';
    })
    .filter((value) => Boolean(value));

  const textHints = enrichImportFieldsFromText({ title, descriptionText, features });

  const rooms =
    parseOlxParamNumber(params, ['rooms', 'rooms_num', 'number_of_rooms'], ['liczba pokoi', 'pokoi']) ??
    textHints.rooms;
  const yearBuilt =
    parseOlxParamNumber(params, ['buildyear', 'build_year', 'construction_year', 'year_built'], ['rok budowy']) ??
    textHints.yearBuilt;
  const sanitizedYearBuilt = sanitizeImportYearBuilt(yearBuilt);
  const heatingRaw =
    parseOlxParamText(params, ['heating', 'heating_type'], ['ogrzewanie']) ?? textHints.heating;
  const heating = sanitizeImportHeating(heatingRaw, map('heating')?.value ?? map('heating_type')?.value ?? null);
  const adminFee =
    parseOlxParamNumber(params, ['rent', 'czynsz', 'admin_fee', 'monthly_rent', 'fee'], ['czynsz', 'opłat administr']) ??
    textHints.adminFee;

  return {
    source: 'OLX',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.urlPath ?? ''),
    title,
    transactionType: mapOlxTransactionType(ad),
    propertyType: mapOlxPropertyType(ad),
    price: parseNumber(((ad.price ?? {}) as Record<string, unknown>).regularPrice
      ? (((ad.price ?? {}) as Record<string, unknown>).regularPrice as Record<string, unknown>).value
      : null),
    priceCurrency: 'PLN',
    adminFee: adminFee != null && adminFee > 0 ? adminFee : null,
    deposit: parseOlxParamNumber(params, ['deposit', 'kaucja'], ['kaucja']),
    area: parseOlxParamNumber(params, ['m'], ['powierzchnia']) ?? parseNumber(map('m')?.label),
    plotArea:
      parseOlxParamNumber(params, ['plot_area', 'terrain_area', 'dzialka'], ['działk', 'dzialk']) ??
      parseNumber(map('plot_area')?.label ?? map('terrain_area')?.label ?? map('dzialka')?.label),
    rooms,
    floor:
      parseFloor(map('floor_select')?.value ?? map('floor_select')?.label) ??
      parseFloor(map('floor')?.value ?? map('floor')?.label),
    totalFloors: parseOlxParamNumber(params, ['floornumber', 'building_floors', 'floors'], ['liczba pięter', 'pięter w budynku']),
    yearBuilt: sanitizedYearBuilt,
    condition: map('market')?.label ?? null,
    conditionCode: map('market')?.value ?? null,
    heating,
    heatingCode: heating ? heating.toLowerCase().replace(/\s+/g, '_') : null,
    buildingType: map('builttype')?.label ?? map('building_type')?.label ?? null,
    city,
    district,
    neighborhood: null,
    street: null,
    lat: parseNumber(mapData.lat),
    lng: parseNumber(mapData.lon),
    localityCountryCode: 'PL',
    descriptionHtml,
    descriptionText,
    features,
    imageUrls: images,
    imageCount: images.length,
    agency: user
      ? {
          id: parseNumber(user.id) ?? 0,
          name: String(user.name ?? '').trim(),
          phone: null,
          address: null,
        }
      : null,
    advertiserType: user ? (ad.isBusiness ? 'business' : 'private') : null,
    status: String(ad.status ?? '').trim() || null,
    createdAt: String(ad.createdTime ?? '').trim() || null,
    modifiedAt: String(ad.lastRefreshTime ?? '').trim() || null,
    characteristics,
    locationWarnings: !district ? ['OLX nie podał dzielnicy — sprawdź mapowanie lokalizacji.'] : [],
    parsedAt: new Date().toISOString(),
  };
}

function hashStringToPositiveInt(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = Math.abs(hash >>> 0);
  return normalized > 0 ? normalized : 1;
}

function extractNierOnlineListValue(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<strong>\\s*${escaped}\\s*:\\s*<\\/strong>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`,
    'i',
  );
  const match = html.match(re);
  if (!match?.[1]) return '';
  return plainImportListText(match[1]);
}

function parseNierOnlineAdminFee(html: string): number | null {
  const czynszText = extractNierOnlineListValue(html, 'Czynsz');
  if (!czynszText) {
    const fallback = html.match(/<strong>\s*Czynsz:\s*<\/strong>\s*([\d\s.,]+)\s*(?:&nbsp;|\s)*zł/i)?.[1];
    return parseNumber(fallback);
  }
  const amount = parseNumber(czynszText.replace(/[^\d\s.,]/g, ' '));
  return amount;
}

function parseNierOnlineArea(
  html: string,
  normalizedHtml: string,
  title: string,
  descriptionText: string,
): number | null {
  const fromList = (label: string) => {
    const raw = extractNierOnlineListValue(html, label);
    if (!raw) return null;
    return (
      parseNumber(raw.match(/([\d\s.,]+)\s*m(?:2|²|kw)/i)?.[1]) ??
      parseNumber(raw.replace(/[^\d\s.,]/g, ' '))
    );
  };

  const areaFromStructured =
    fromList('Powierzchnia użytkowa') ??
    fromList('Powierzchnia') ??
    fromList('Powierzchnia całkowita') ??
    fromList('Powierzchnia mieszkania');

  const areaFromLabel = parseNumber(
    normalizedHtml.match(/powierzchni[aey]?\s*(?:użytkowa|mieszkania|całkowita)?[:\s]*([\d\s.,]+)\s*m(?:2|²|kw)/i)?.[1],
  );
  const areaFromTable = parseNumber(
    normalizedHtml.match(/\|\s*([\d\s.,]{1,12})\s*m(?:2|²|kw)\s*\|/i)?.[1],
  );
  const areaFromRange = parseNumber(
    normalizedHtml.match(/metra(?:że|ze)\s*(?:od)?\s*([\d\s.,]+)\s*(?:do\s*[\d\s.,]+)?\s*m(?:2|²|kw)/i)?.[1],
  );
  const areaFromAny = parseNumber(
    normalizedHtml.match(/([\d]{1,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1],
  );
  const areaFromTitle = parseNumber(
    decodeImportHtmlText(title).match(/([\d]{1,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1],
  );
  const areaFromDescription = parseNumber(
    decodeImportHtmlText(descriptionText).match(/([\d]{1,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1],
  );

  return (
    areaFromStructured ??
    areaFromLabel ??
    areaFromTable ??
    areaFromRange ??
    areaFromAny ??
    areaFromTitle ??
    areaFromDescription
  );
}

function parseNierOnlineDescription(html: string, fallbackMeta: string): { text: string; html: string } {
  const candidates = [
    html.match(/<div[^>]+class="[^"]*ad-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1],
    html.match(/<section[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i)?.[1],
    html.match(/<div[^>]+id="description"[^>]*>([\s\S]*?)<\/div>/i)?.[1],
    html.match(/<div[^>]+class="[^"]*offer-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const text = stripHtml(decodeImportHtmlText(raw));
    if (text.length >= 24) {
      const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');
      return { text, html: paragraphs || `<p>${text}</p>` };
    }
  }

  const meta = String(fallbackMeta || '').trim();
  return {
    text: meta,
    html: meta ? `<p>${meta}</p>` : '',
  };
}

function parseNierOnlineListNumber(html: string, label: string): number | null {
  const raw = extractNierOnlineListValue(html, label);
  if (!raw) return null;
  return parseNumber(raw.replace(/[^\d\s.,]/g, ' '));
}

function parseNierOnlineHeating(html: string): string | null {
  const media = extractNierOnlineListValue(html, 'Media');
  if (!media) {
    const block = html.match(/<strong>\s*Media:\s*<\/strong>[\s\S]*?ogrzewanie\s*:\s*([^<,;]+)/i);
    return sanitizeImportHeating(block?.[1] ? plainImportListText(block[1]) : null);
  }
  const labeled = media.match(/ogrzewanie\s*:\s*([^,;]+)/i);
  if (labeled?.[1]) return sanitizeImportHeating(labeled[1]);
  if (/miejsk/i.test(media)) return 'Miejskie';
  if (/gaz/i.test(media)) return 'Gazowe';
  if (/elektryczn/i.test(media)) return 'Elektryczne';
  if (/komink/i.test(media)) return 'Inne';
  return sanitizeImportHeating(media.length <= 80 ? media : null);
}

function parseNierOnlineLocation(html: string): { locationText: string; street: string | null; districtHint: string } {
  const locationText =
    extractNierOnlineListValue(html, 'Lokalizacja') ||
    extractNierOnlineListValue(html, 'Adres') ||
    decodeImportHtmlText(
      html.match(/class="[^"]*(?:location|ad-location|offer-location)[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] || '',
    )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const streetFromLabel = locationText.match(/(?:ul\.?|al\.?|os\.?)\s*([^,]+)/i)?.[1]?.trim() || '';
  const streetFromStrong = decodeImportHtmlText(
    html.match(/<strong>\s*(?:ul\.?|al\.?)\s*([^<]+)<\/strong>/i)?.[1] || '',
  )
    .replace(/\s+/g, ' ')
    .trim();
  const street = (streetFromLabel || streetFromStrong || '').trim() || null;

  const districtHint =
    locationText
      .split(',')
      .map((part) => part.trim())
      .find((part) => part && !/(?:ul\.?|al\.?|os\.?)\s/i.test(part) && !/^\d/.test(part)) || '';

  return { locationText, street, districtHint };
}

function parseNierOnlineHtml(html: string, sourceUrl: string): OtodomImportDraft {
  const normalizedHtml = decodeImportHtmlText(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = String((ogTitle || titleMatch?.[1] || '').replace(/\s+/g, ' ').trim());

  const descriptionMeta =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
  const parsedDescription = parseNierOnlineDescription(html, descriptionMeta);
  const descriptionText = parsedDescription.text;
  const descriptionHtml = parsedDescription.html;

  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || sourceUrl;
  const cleanCanonical = normalizeNieruchomosciOnlineUrl(canonical);
  const slug = (() => {
    try {
      const u = new URL(cleanCanonical);
      const bits = u.pathname.split('/').filter(Boolean);
      return bits[bits.length - 1] || '';
    } catch {
      return '';
    }
  })();

  const cityFromHost = (() => {
    try {
      const u = new URL(cleanCanonical);
      const host = String(u.hostname || '').replace(/^www\./i, '').toLowerCase();
      const suffix = `.${NIERUCHOMOSCI_ONLINE_HOST}`;
      if (!host.endsWith(suffix)) return '';
      const prefix = host.slice(0, -suffix.length);
      if (!prefix || prefix.includes('.')) return '';
      return canonicalizeCity(prefix.replace(/-/g, ' '));
    } catch {
      return '';
    }
  })();

  const priceMain =
    parseNumber(normalizedHtml.match(/info-primary-price[^>]*>\s*([\d\s.,]+)\s*(?:zł|PLN)/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/price:\s*['"][^'"]*?(\d[\d\s.,]*)\s*(?:zł|PLN)\s*(?:\(|$)/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/price:\s*['"][^'"]*?(\d[\d\s.,]*)\s*(?:zł|PLN)[^'"]*['"]/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/"price"\s*:\s*"?(\d[\d\s.,]*)"?/i)?.[1]);
  const priceCandidates = Array.from(
    normalizedHtml.matchAll(/(\d[\d\s.,]*)\s*(?:zł|PLN)(?!\s*\/\s*m(?:2|²|kw))/gi)
  )
    .map((m) => parseNumber(m[1]))
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  const price =
    priceMain ??
    priceCandidates[0] ??
    parseNumber(normalizedHtml.match(/price["']?\s*[:=]\s*["']?(\d[\d\s.,]*)/i)?.[1]);
  const areaResolved = parseNierOnlineArea(html, normalizedHtml, title, descriptionText);
  const plotArea =
    parseNierOnlineListNumber(html, 'Powierzchnia działki') ??
    parseNumber(html.match(/powierzchni[aey]?\s*dzia[łl]ki[:\s]*([\d\s.,]+)\s*m(?:2|²)/i)?.[1]);
  const rooms =
    parseNierOnlineListNumber(html, 'Liczba pokoi') ??
    parseNierOnlineListNumber(html, 'Pokoje') ??
    parseNumber(normalizedHtml.match(/(\d+)\s*pok(?:ó|o)j/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/(\d+)\s*pok\./i)?.[1]) ??
    parseNumber(normalizedHtml.match(/liczba\s+pokoi[:\s]*([\d]+)/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/(\d+)\s*pomieszczeni(?:a|e)/i)?.[1]);
  const floorFromList = extractNierOnlineListValue(html, 'Piętro');
  const floor =
    parseFloor(floorFromList) ??
    parseFloor(html.match(/pi(?:ę|e)tro[:\s]*([\w\/-]+)/i)?.[1]) ??
    parseFloor(normalizedHtml.match(/pi(?:ę|e)tro\s*([0-9]+)\s*\/\s*[0-9]+/i)?.[1]);
  const yearBuilt =
    sanitizeImportYearBuilt(parseNumber(html.match(/rok\s*budow[yia][:\s]*([\d]{4})/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(html.match(/r\.\s*budow[yia][:\s]*([\d]{4})/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(html.match(/"buildYear"\s*:\s*"?(\d{4})"?/i)?.[1])) ??
    sanitizeImportYearBuilt(parseNumber(html.match(/"yearBuilt"\s*:\s*"?(\d{4})"?/i)?.[1])) ??
    resolveYearBuiltFromCharacteristics(new Map(), {
      title,
      descriptionText,
      descriptionHtml: html,
      features: [],
    });
  const lat = parseNumber(html.match(/"latitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);
  const lng = parseNumber(html.match(/"longitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);

  const { locationText, street: streetFromLocation, districtHint } = parseNierOnlineLocation(html);

  const cityRaw =
    cityFromHost ||
    html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/\b(?:miasto|lokalizacja)[:\s]+([A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\- ]+)/i)?.[1] ||
    html.match(/\b,\s*([A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\- ]+)\s*$/m)?.[1] ||
    '';
  let city = canonicalizeCity(String(cityRaw || '').trim());
  if (!city) {
    city = inferCityFromLocationHints(locationText, districtHint, title, descriptionText, cleanCanonical);
  }
  if (!city) {
    city = inferCityFromImportSlug(cleanCanonical, title);
  }
  let district = city
    ? pickDistrictFromPlaceName(city, [locationText, districtHint, title, descriptionText].filter(Boolean).join(' ')) ||
      canonicalizeDistrict(city, districtHint)
    : '';
  const htmlWithUnescapedSlashes = html.replace(/\\\//g, '/');
  const photosJsonMatch = html.match(/photos:\s*(\{[\s\S]*?\})\s*,\s*adType\s*:/i);
  let photosPreferred: string[] = [];
  if (photosJsonMatch?.[1]) {
    try {
      const parsed = JSON.parse(photosJsonMatch[1]) as { l?: string[]; x?: string[]; m?: string[] };
      photosPreferred = Array.isArray(parsed.l) && parsed.l.length
        ? parsed.l
        : Array.isArray(parsed.x) && parsed.x.length
          ? parsed.x
          : Array.isArray(parsed.m)
            ? parsed.m
            : [];
    } catch {
      photosPreferred = [];
    }
  }
  const imageFromOg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
  const imageFromCdn = Array.from(
    new Set(
      (htmlWithUnescapedSlashes.match(/https?:\/\/i\.st-nieruchomosci-online\.pl\/[^\s"'<>)]*\.(?:jpe?g|png|webp)/gi) || [])
        .map((url) => String(url).trim())
        .filter(Boolean)
    )
  );
  const imageUrls =
    photosPreferred.length > 0
      ? Array.from(new Set(photosPreferred.filter(Boolean)))
      : Array.from(new Set([imageFromOg, ...imageFromCdn].filter(Boolean)));

  const adTypeToken =
    html.match(/adTypeName:\s*"([^"]+)"/i)?.[1] ||
    html.match(/adType:\s*'([^']+)'/i)?.[1] ||
    '';
  const canonicalLower = cleanCanonical.toLowerCase();
  const transactionType =
    /sprzeda|sale/.test(adTypeToken.toLowerCase()) || canonicalLower.includes(',sprzedaz/')
      ? 'SALE'
      : /wynajem|rent/.test(adTypeToken.toLowerCase()) || canonicalLower.includes(',na-wynajem/')
        ? 'RENT'
        : /wynajem|do wynajęcia|na wynajem/i.test(normalizedHtml)
          ? 'RENT'
          : 'SALE';
  const propertyType = /dom/i.test(title)
    ? 'HOUSE'
    : /dzia[łl]k/i.test(title)
      ? 'PLOT'
      : /lokal|u[żz]ytkow|handlow|biurow|magazyn|us[łl]ugow/i.test(`${title} ${descriptionText}`)
        ? 'COMMERCIAL'
        : 'FLAT';

  const adminFee = parseNierOnlineAdminFee(html);
  const heating = parseNierOnlineHeating(html);
  const conditionFromHtml =
    extractNierOnlineListValue(html, 'Stan') ||
    extractNierOnlineListValue(html, 'Stan wykończenia') ||
    '';
  const conditionCode =
    /bardzo dobry|doskonał/i.test(conditionFromHtml)
      ? 'very_good'
      : /do remontu|do wykończenia/i.test(conditionFromHtml)
        ? 'to_renovation'
        : /dewelopersk/i.test(conditionFromHtml)
          ? 'developer_state'
          : conditionFromHtml
            ? 'ready'
            : null;

  return {
    source: 'NIERUCHOMOSCI_ONLINE',
    externalId: hashStringToPositiveInt(cleanCanonical),
    externalUrl: cleanCanonical,
    slug,
    title: capitalizeImportTitle(title || 'Oferta z Nieruchomosci-Online'),
    transactionType,
    propertyType,
    price,
    priceCurrency: 'PLN',
    adminFee,
    deposit: null,
    area: areaResolved,
    plotArea,
    rooms,
    floor,
    totalFloors: null,
    yearBuilt,
    condition: conditionFromHtml || null,
    conditionCode,
    heating,
    heatingCode: heating ? heating.toLowerCase().replace(/\s+/g, '_') : null,
    buildingType: null,
    city,
    district,
    neighborhood: districtHint || null,
    street: streetFromLocation,
    lat,
    lng,
    localityCountryCode: 'PL',
    descriptionHtml,
    descriptionText: stripHtml(descriptionHtml),
    features: [],
    imageUrls,
    imageCount: imageUrls.length,
    agency: null,
    advertiserType: null,
    status: null,
    createdAt: null,
    modifiedAt: null,
    characteristics: {},
    locationWarnings: !lat || !lng ? ['Nieruchomosci-Online nie podał dokładnych współrzędnych GPS.'] : [],
    parsedAt: new Date().toISOString(),
  };
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function importOfferFromOtodomUrl(inputUrl: string): Promise<OtodomImportDraft> {
  const url = normalizeOtodomUrl(inputUrl);
  const html = await fetchOtodomOfferHtml(url);
  const ad = extractAdPayload(html);
  return parseOtodomAd(ad, url);
}

export async function importOfferFromUrl(inputUrl: string): Promise<OtodomImportDraft> {
  const source = detectImportSource(inputUrl);
  if (source === 'OTODOM') {
    return importOfferFromOtodomUrl(inputUrl);
  }
  if (source === 'OLX') {
    const url = normalizeOlxUrl(inputUrl);
    const html = await fetchOtodomOfferHtml(url);
    const ad = extractOlxAdPayload(html);
    return parseOlxAd(ad, url);
  }

  const url = normalizeNieruchomosciOnlineUrl(inputUrl);
  const html = await fetchOtodomOfferHtml(url);
  return parseNierOnlineHtml(html, url);
}

/** Kanoniczny URL portalu do wykrywania duplikatów importu. */
export function normalizeImportPortalUrl(inputUrl: string): string {
  const source = detectImportSource(inputUrl);
  if (source === 'OTODOM') return normalizeOtodomUrl(inputUrl);
  if (source === 'OLX') return normalizeOlxUrl(inputUrl);
  return normalizeNieruchomosciOnlineUrl(inputUrl);
}
