import { canonicalizeCity, canonicalizeDistrict } from '@/lib/location/locationCatalog';

const OTODOM_HOST = 'otodom.pl';
const FETCH_TIMEOUT_MS = 20_000;

export type OtodomImportDraft = {
  source: 'OTODOM';
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
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
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

export function isOtodomOfferUrl(input: string): boolean {
  try {
    normalizeOtodomUrl(input);
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
