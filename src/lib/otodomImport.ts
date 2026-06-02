import {
  canonicalizeCity,
  canonicalizeDistrict,
  isPlaceholderDistrict,
  matchDistrictAlias,
  pickDistrictFromPlaceName,
} from '@/lib/location/locationCatalog';

const OTODOM_HOST = 'otodom.pl';
const OLX_HOST = 'olx.pl';
const NIERUCHOMOSCI_ONLINE_HOST = 'nieruchomosci-online.pl';
const FETCH_TIMEOUT_MS = 20_000;

function hostMatches(host: string, baseHost: string): boolean {
  return host === baseHost || host.endsWith(`.${baseHost}`);
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
  const fromToken = value.match(/floor_(\d+)/i);
  if (fromToken) return parseNumber(fromToken[1]);
  return parseNumber(value);
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

function normalizeCategoryToken(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

const OTODOM_CATEGORY_MAP: Record<string, OtodomImportDraft['propertyType']> = {
  FLAT: 'FLAT',
  APARTMENT: 'FLAT',
  STUDIO_FLAT: 'FLAT',
  ONE_ROOM: 'FLAT',
  ROOM: 'FLAT',
  MIESZKANIE: 'FLAT',
  HOUSE: 'HOUSE',
  DETACHED_HOUSE: 'HOUSE',
  SEMI_DETACHED: 'HOUSE',
  SEMI_DETACHED_HOUSE: 'HOUSE',
  TERRACED_HOUSE: 'HOUSE',
  TERRAIN: 'PLOT',
  LAND: 'PLOT',
  PLOT: 'PLOT',
  BUILDING_PLOT: 'PLOT',
  DZIALKA: 'PLOT',
  DZIALKI: 'PLOT',
  GRUNT: 'PLOT',
  GRUNTY: 'PLOT',
  COMMERCIAL: 'COMMERCIAL',
  COMMERCIAL_PREMISE: 'COMMERCIAL',
  COMMERCIAL_PROPERTY: 'COMMERCIAL',
  OFFICE: 'COMMERCIAL',
  HALL: 'COMMERCIAL',
  WAREHOUSE: 'COMMERCIAL',
  LOKAL: 'COMMERCIAL',
  LOKAL_UZYTKOWY: 'COMMERCIAL',
  USLUGOWY: 'COMMERCIAL',
  GARAGE: 'COMMERCIAL',
  INVESTMENT: 'COMMERCIAL',
};

function scorePropertyTypeFromText(text: string): Record<OtodomImportDraft['propertyType'], number> {
  const scores: Record<OtodomImportDraft['propertyType'], number> = {
    FLAT: 0,
    HOUSE: 0,
    PLOT: 0,
    COMMERCIAL: 0,
  };
  const t = text.toLowerCase();

  if (/\b(działk|dzialk|grunt|teren\b|roln|rekreacyjn|budowl|inwestycyjn|sad\b|łąk|lak\b|pastwisk|terrain|plot|land)\b/.test(t)) {
    scores.PLOT += 4;
  }
  if (/\b(dom\b|jednorodzin|bliźniak|blizniak|szeregow|willa|segment\b|detached|house)\b/.test(t)) {
    scores.HOUSE += 4;
  }
  if (/\b(lokal|biuro|magazyn|hala\b|handlow|usług|gastronom|komercyj|commercial|office|warehouse|retail)\b/.test(t)) {
    scores.COMMERCIAL += 4;
  }
  if (/\b(mieszkan|kawalerk|apartment|flat|studio|loft|pokojow|pokój|pokoi)\b/.test(t)) {
    scores.FLAT += 4;
  }

  return scores;
}

export function resolveOtodomPropertyType(input: {
  adCategory?: Record<string, unknown> | null;
  title?: string | null;
  slug?: string | null;
  descriptionText?: string | null;
  buildingType?: string | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
}): OtodomImportDraft['propertyType'] {
  const adCategory = input.adCategory ?? {};
  const tokens = [
    adCategory.name,
    adCategory.type,
    adCategory.id,
    adCategory.label,
    adCategory.technicalName,
  ]
    .map(normalizeCategoryToken)
    .filter(Boolean);

  for (const token of tokens) {
    const direct = OTODOM_CATEGORY_MAP[token];
    if (direct) return direct;
    if (token.includes('TERRAIN') || token.includes('DZIALK') || token.includes('GRUNT')) return 'PLOT';
    if (token.includes('APARTMENT') || token.includes('MIESZKAN') || token.includes('FLAT')) return 'FLAT';
    if (token.includes('HOUSE') || token.includes('DOM')) return 'HOUSE';
    if (token.includes('COMMERCIAL') || token.includes('LOKAL') || token.includes('OFFICE') || token.includes('HALL')) {
      return 'COMMERCIAL';
    }
  }

  const textBlob = [
    input.slug,
    input.title,
    input.descriptionText,
    input.buildingType,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 6000);

  const scores = scorePropertyTypeFromText(textBlob);

  const area = input.area;
  const rooms = input.rooms;
  const floor = input.floor;
  const hasApartmentSignals = (rooms != null && rooms > 0) || (floor != null && floor >= 0);

  if (area != null && area >= 350 && !hasApartmentSignals) {
    scores.PLOT += 5;
  }
  if (area != null && area >= 900 && !hasApartmentSignals) {
    scores.PLOT += 3;
  }
  if (hasApartmentSignals) {
    scores.FLAT += 3;
  }

  const building = String(input.buildingType ?? '').toLowerCase();
  if (building && /działk|grunt|teren|roln|inwestycyjn/.test(building)) scores.PLOT += 6;
  if (building && /dom|willa|segment/.test(building)) scores.HOUSE += 4;
  if (building && /biuro|lokal|magazyn|hala|handlow/.test(building)) scores.COMMERCIAL += 4;

  const ranked = (Object.entries(scores) as [OtodomImportDraft['propertyType'], number][])
    .sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = ranked[0] ?? ['FLAT', 0];
  const [, secondScore] = ranked[1] ?? ['FLAT', 0];

  if (bestScore > 0 && bestScore >= secondScore) return bestType;
  if (hasApartmentSignals) return 'FLAT';
  if (area != null && area >= 350) return 'PLOT';
  return 'FLAT';
}

function mapPropertyType(raw: unknown): OtodomImportDraft['propertyType'] {
  return resolveOtodomPropertyType({ adCategory: { name: raw } });
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
    throw new Error('Nie udało się odczytać payloadu OLX.');
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

function extractNieruchomosciOnlineAdPayload(html: string): RawAd {
  const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown> | Array<Record<string, unknown>>;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const apartment = rows.find((row) => String(row?.['@type'] ?? '').toLowerCase() === 'apartment');
      if (apartment && typeof apartment === 'object') return apartment as RawAd;
    } catch {
      continue;
    }
  }
  throw new Error('Nie znaleziono danych ogłoszenia (JSON-LD Apartment) w Nieruchomosci-Online.');
}

function normalizeOtodomUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Nieprawidłowy adres URL.');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!hostMatches(host, OTODOM_HOST)) {
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
  if (!hostMatches(host, OLX_HOST)) {
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
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!hostMatches(host, NIERUCHOMOSCI_ONLINE_HOST)) {
    throw new Error('Obsługiwane są wyłącznie linki z nieruchomosci-online.pl.');
  }
  if (!/\/\d+\.html$/i.test(url.pathname)) {
    throw new Error('URL musi wskazywać stronę ogłoszenia Nieruchomosci-Online.');
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
  if (hostMatches(host, OTODOM_HOST)) return 'OTODOM';
  if (hostMatches(host, OLX_HOST)) return 'OLX';
  if (hostMatches(host, NIERUCHOMOSCI_ONLINE_HOST)) return 'NIERUCHOMOSCI_ONLINE';
  throw new Error('Obsługiwane są wyłącznie linki z OtoDom, OLX lub Nieruchomosci-Online.');
}

export function isSupportedImportOfferUrl(input: string): boolean {
  try {
    const source = detectImportSource(input);
    if (source === 'OTODOM') normalizeOtodomUrl(input);
    if (source === 'OLX') normalizeOlxUrl(input);
    if (source === 'NIERUCHOMOSCI_ONLINE') normalizeNieruchomosciOnlineUrl(input);
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

  const city = canonicalizeCity(String(cityObj.name ?? ''));
  const otodomDistrict = String(districtObj.name ?? '').trim();
  const neighborhoodEntry = [...reverseLocations]
    .reverse()
    .find((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      return String((entry as Record<string, unknown>).locationLevel ?? '') === 'residential';
    }) as Record<string, unknown> | undefined;
  const neighborhood = neighborhoodEntry ? String(neighborhoodEntry.name ?? '').trim() || null : null;

  const districtCandidates = [otodomDistrict, neighborhood].filter(
    (value) => value && !isPlaceholderDistrict(value),
  );
  const combinedLocationText = districtCandidates.join(', ');
  const districtFromCombined = combinedLocationText
    ? pickDistrictFromPlaceName(city, combinedLocationText)
    : '';
  const district =
    districtFromCombined ||
    canonicalizeDistrict(city, otodomDistrict || neighborhood || '') ||
    matchDistrictAlias(city, neighborhood) ||
    matchDistrictAlias(city, otodomDistrict) ||
    '';
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

  const characteristics: Record<string, { value: string; label: string }> = {};
  chars.forEach((value, key) => {
    characteristics[key] = value;
  });

  const area = parseNumber(chars.get('m')?.value);
  const rooms = parseNumber(chars.get('rooms_num')?.value);
  const floor = parseFloor(chars.get('floor_no')?.value);
  const descriptionText = stripHtml(descriptionHtml);

  const propertyType = resolveOtodomPropertyType({
    adCategory,
    title: String(ad.title ?? '').trim(),
    slug: String(ad.slug ?? ''),
    descriptionText,
    buildingType: chars.get('building_type')?.label ?? chars.get('building_type')?.value ?? null,
    area,
    rooms,
    floor,
  });

  return {
    source: 'OTODOM',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.slug ?? ''),
    title: String(ad.title ?? '').trim(),
    transactionType: mapTransactionType(adCategory.type),
    propertyType,
    price: parseNumber(chars.get('price')?.value),
    priceCurrency: 'PLN',
    adminFee: parseNumber(chars.get('rent')?.value),
    deposit: parseNumber(chars.get('deposit')?.value),
    area,
    rooms,
    floor,
    totalFloors: parseNumber(chars.get('building_floors_num')?.value),
    yearBuilt: parseNumber(chars.get('build_year')?.value),
    condition: chars.get('construction_status')?.label ?? null,
    conditionCode: chars.get('construction_status')?.value ?? null,
    heating: chars.get('heating')?.label ?? null,
    heatingCode: chars.get('heating')?.value ?? null,
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
    features: Array.isArray(ad.features) ? ad.features.map((f) => String(f)) : [],
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
  return {
    value: String(row.normalizedValue ?? row.value ?? '').trim(),
    label: String(row.value ?? row.normalizedValue ?? '').trim(),
  };
}

function mapOlxTransactionType(ad: RawAd): OtodomImportDraft['transactionType'] {
  const category = (ad.category ?? {}) as Record<string, unknown>;
  const categoryId = Number(category.id);
  if (categoryId === 15 || categoryId === 20 || categoryId === 25 || categoryId === 127) return 'RENT';
  const path = String(ad.urlPath ?? ad.url ?? '').toLowerCase();
  return path.includes('/wynajem/') ? 'RENT' : 'SALE';
}

function mapOlxPropertyType(ad: RawAd): OtodomImportDraft['propertyType'] {
  const path = String(ad.urlPath ?? ad.url ?? '').toLowerCase();
  if (path.includes('/domy/')) return 'HOUSE';
  if (path.includes('/dzialki/')) return 'PLOT';
  if (path.includes('/biura-lokale/') || path.includes('/pozostale-nieruchomosci/')) return 'COMMERCIAL';
  return 'FLAT';
}

export function parseOlxAd(ad: RawAd, sourceUrl: string): OtodomImportDraft {
  const paramsRaw = Array.isArray(ad.params) ? ad.params : [];
  const params = paramsRaw.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
  const get = (key: string) => getOlxParam(params, key);
  const location = (ad.location ?? {}) as Record<string, unknown>;
  const mapData = (ad.map ?? {}) as Record<string, unknown>;
  const user = (ad.user ?? null) as Record<string, unknown> | null;
  const city = canonicalizeCity(String(location.cityName ?? '').trim());
  const district = canonicalizeDistrict(city, String(location.districtName ?? '').trim());
  const priceNode = ((ad.price ?? {}) as Record<string, unknown>).regularPrice as Record<string, unknown> | undefined;

  const characteristics: Record<string, { value: string; label: string }> = {};
  for (const entry of params) {
    const key = String(entry.key ?? '').trim();
    if (!key) continue;
    characteristics[key] = {
      value: String(entry.normalizedValue ?? entry.value ?? ''),
      label: String(entry.value ?? entry.normalizedValue ?? ''),
    };
  }

  const imageUrls = Array.isArray(ad.photos)
    ? ad.photos.map((row) => String(row ?? '').trim()).filter((value) => Boolean(value))
    : [];

  return {
    source: 'OLX',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.urlPath ?? ''),
    title: String(ad.title ?? '').trim(),
    transactionType: mapOlxTransactionType(ad),
    propertyType: mapOlxPropertyType(ad),
    price: parseNumber(priceNode?.value),
    priceCurrency: 'PLN',
    adminFee: null,
    deposit: null,
    area: parseNumber(get('m')?.value ?? get('m')?.label),
    rooms: parseNumber(get('rooms')?.value ?? get('rooms')?.label),
    floor: parseFloor(get('floor_select')?.value ?? get('floor')?.value),
    totalFloors: null,
    yearBuilt: parseNumber(get('buildyear')?.value ?? get('build_year')?.value),
    condition: get('market')?.label ?? null,
    conditionCode: get('market')?.value ?? null,
    heating: get('heating')?.label ?? null,
    heatingCode: get('heating')?.value ?? null,
    buildingType: get('builttype')?.label ?? get('building_type')?.label ?? null,
    city,
    district,
    neighborhood: null,
    street: null,
    lat: parseNumber(mapData.lat),
    lng: parseNumber(mapData.lon),
    localityCountryCode: 'PL',
    descriptionHtml: String(ad.description ?? ''),
    descriptionText: stripHtml(String(ad.description ?? '')),
    features: params
      .map((entry) => {
        const name = String(entry.name ?? '').trim();
        const value = String(entry.value ?? '').trim();
        return name && value ? `${name}: ${value}` : '';
      })
      .filter((value) => Boolean(value)),
    imageUrls,
    imageCount: imageUrls.length,
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

function extractNoAdditionalPropertyValue(ad: RawAd, candidateNames: string[]): string {
  const rows = Array.isArray(ad.additionalProperty) ? ad.additionalProperty : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? '').trim().toLowerCase();
    if (!name) continue;
    if (candidateNames.some((candidate) => name === candidate.toLowerCase())) {
      return String(r.value ?? '').trim();
    }
  }
  return '';
}

export function parseNieruchomosciOnlineAd(ad: RawAd, sourceUrl: string): OtodomImportDraft {
  const title = String(ad.name ?? '').trim();
  const descriptionHtml = String(ad.description ?? '');
  const geo = (ad.geo ?? {}) as Record<string, unknown>;
  const addr = (ad.address ?? {}) as Record<string, unknown>;
  const offers = Array.isArray(ad.offers) ? ad.offers : [];
  const offer = (offers[0] ?? {}) as Record<string, unknown>;
  const floorSize = (ad.floorSize ?? {}) as Record<string, unknown>;
  const images = Array.isArray(ad.image) ? ad.image : [];
  const agent = (ad.agent ?? null) as Record<string, unknown> | null;

  const city = canonicalizeCity(String(addr.addressLocality ?? '').trim());
  const district = canonicalizeDistrict(city, String(addr.addressDistrict ?? '').trim());
  const area = parseNumber(floorSize.value ?? extractNoAdditionalPropertyValue(ad, ['Floor area']));
  const rooms = parseNumber(ad.numberOfRooms ?? extractNoAdditionalPropertyValue(ad, ['Number of rooms']));
  const floor = parseNumber(ad.floorLevel ?? extractNoAdditionalPropertyValue(ad, ['Floor level']));
  const yearBuilt = parseNumber(ad.yearBuilt ?? extractNoAdditionalPropertyValue(ad, ['Year built']));
  const adminFee = parseNumber(extractNoAdditionalPropertyValue(ad, ['Rent']));

  const features: string[] = [];
  const amenityList = Array.isArray(ad.amenityFeature) ? ad.amenityFeature : [];
  for (const row of amenityList) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (r.value === true) {
      const name = String(r.name ?? '').trim();
      if (name) features.push(name);
    }
  }

  const propertyType = resolveOtodomPropertyType({
    adCategory: { name: ad['@type'] },
    title,
    slug: String(ad.url ?? ''),
    descriptionText: stripHtml(descriptionHtml),
    area,
    rooms,
    floor,
  });

  const characteristics: Record<string, { value: string; label: string }> = {
    source_type: { value: String(ad['@type'] ?? ''), label: String(ad['@type'] ?? '') },
  };

  return {
    source: 'NIERUCHOMOSCI_ONLINE',
    externalId: parseNumber(String(sourceUrl.match(/\/(\d+)\.html$/)?.[1] ?? '')) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(sourceUrl.split('/').pop() ?? ''),
    title,
    transactionType: /wynajem/i.test(String(ad.name ?? '') + ' ' + String(ad.description ?? '')) ? 'RENT' : 'SALE',
    propertyType,
    price: parseNumber(offer.price),
    priceCurrency: String(offer.priceCurrency ?? 'PLN').toUpperCase() === 'PLN' ? 'PLN' : 'PLN',
    adminFee: adminFee && adminFee > 0 ? adminFee : null,
    deposit: null,
    area,
    rooms,
    floor,
    totalFloors: parseNumber(extractNoAdditionalPropertyValue(ad, ['Number of floors', 'Building floors'])),
    yearBuilt,
    condition: extractNoAdditionalPropertyValue(ad, ['Condition']) || null,
    conditionCode: null,
    heating: features.find((f) => /heating|ogrzewanie/i.test(f)) ?? null,
    heatingCode: null,
    buildingType: String(ad['@type'] ?? '').trim() || null,
    city,
    district,
    neighborhood: String(addr.addressRegion ?? '').trim() || null,
    street: String(addr.streetAddress ?? '').trim() || null,
    lat: parseNumber(geo.latitude),
    lng: parseNumber(geo.longitude),
    localityCountryCode: 'PL',
    descriptionHtml,
    descriptionText: stripHtml(descriptionHtml),
    features,
    imageUrls: images.map((row) => String(row ?? '').trim()).filter((value) => Boolean(value)),
    imageCount: images.length,
    agency: agent
      ? {
          id: parseNumber(agent.identifier) ?? 0,
          name: String(agent.name ?? '').trim(),
          phone: String(agent.telephone ?? '').trim() || null,
          address: null,
        }
      : null,
    advertiserType: 'business',
    status: 'active',
    createdAt: String(ad.datePosted ?? '').trim() || null,
    modifiedAt: String(ad.datePosted ?? '').trim() || null,
    characteristics,
    locationWarnings: !district
      ? ['Nieruchomosci-Online nie podał dzielnicy lub aliasu — sprawdź mapowanie lokalizacji.']
      : [],
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
  if (source === 'OTODOM') return importOfferFromOtodomUrl(inputUrl);

  if (source === 'OLX') {
    const url = normalizeOlxUrl(inputUrl);
    const html = await fetchOtodomOfferHtml(url);
    const ad = extractOlxAdPayload(html);
    return parseOlxAd(ad, url);
  }

  const url = normalizeNieruchomosciOnlineUrl(inputUrl);
  const html = await fetchOtodomOfferHtml(url);
  const ad = extractNieruchomosciOnlineAdPayload(html);
  return parseNieruchomosciOnlineAd(ad, url);
}
