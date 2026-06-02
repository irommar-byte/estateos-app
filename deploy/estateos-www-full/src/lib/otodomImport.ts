import { canonicalizeCity, canonicalizeDistrict } from '@/lib/location/locationCatalog';

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
  const plotArea = resolvePlotAreaFromCharacteristics(chars, descriptionHtml);

  const characteristics: Record<string, { value: string; label: string }> = {};
  chars.forEach((value, key) => {
    characteristics[key] = value;
  });

  return {
    source: 'OTODOM',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.slug ?? ''),
    title: String(ad.title ?? '').trim(),
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
    descriptionText: stripHtml(descriptionHtml),
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

  return {
    source: 'OLX',
    externalId: parseNumber(ad.id) ?? 0,
    externalUrl: String(ad.url ?? sourceUrl),
    slug: String(ad.urlPath ?? ''),
    title: String(ad.title ?? '').trim(),
    transactionType: mapOlxTransactionType(ad),
    propertyType: mapOlxPropertyType(ad),
    price: parseNumber(((ad.price ?? {}) as Record<string, unknown>).regularPrice
      ? (((ad.price ?? {}) as Record<string, unknown>).regularPrice as Record<string, unknown>).value
      : null),
    priceCurrency: 'PLN',
    adminFee: null,
    deposit: null,
    area: parseNumber(map('m')?.value ?? map('m')?.label),
    plotArea:
      parseNumber(map('plot_area')?.value ?? map('plot_area')?.label) ??
      parseNumber(map('terrain_area')?.value ?? map('terrain_area')?.label) ??
      parseNumber(map('dzialka')?.value ?? map('dzialka')?.label),
    rooms: parseNumber(map('rooms')?.value ?? map('rooms')?.label),
    floor: parseFloor(map('floor_select')?.value ?? map('floor')?.value),
    totalFloors: null,
    yearBuilt: parseNumber(map('buildyear')?.value ?? map('build_year')?.value),
    condition: map('market')?.label ?? null,
    conditionCode: map('market')?.value ?? null,
    heating: map('heating')?.label ?? null,
    heatingCode: map('heating')?.value ?? null,
    buildingType: map('builttype')?.label ?? map('building_type')?.label ?? null,
    city,
    district,
    neighborhood: null,
    street: null,
    lat: parseNumber(mapData.lat),
    lng: parseNumber(mapData.lon),
    localityCountryCode: 'PL',
    descriptionHtml: String(ad.description ?? ''),
    descriptionText: stripHtml(String(ad.description ?? '')),
    features: params.map((entry) => {
      const name = String(entry.name ?? '').trim();
      const value = String(entry.value ?? '').trim();
      return name && value ? `${name}: ${value}` : '';
    }).filter((value) => Boolean(value)),
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

function parseNierOnlineHtml(html: string, sourceUrl: string): OtodomImportDraft {
  const normalizedHtml = decodeImportHtmlText(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = String((ogTitle || titleMatch?.[1] || '').replace(/\s+/g, ' ').trim());

  const descriptionMeta =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
  const descriptionText = String(descriptionMeta).trim();
  const descriptionHtml = descriptionText ? `<p>${descriptionText}</p>` : '';

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
    parseNumber(normalizedHtml.match(/info-secondary-price[^>]*>\s*([\d\s.,]+)\s*(?:zł|PLN)/i)?.[1]) ??
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
  const areaFromLabel = parseNumber(
    normalizedHtml.match(/powierzchni[aey]?\s*(?:użytkowa|mieszkania|całkowita)?[:\s]*([\d\s.,]+)\s*m(?:2|²|kw)/i)?.[1]
  );
  const areaFromTable = parseNumber(
    normalizedHtml.match(/\|\s*([\d\s.,]{2,12})\s*m(?:2|²|kw)\s*\|/i)?.[1]
  );
  const areaFromRange = parseNumber(
    normalizedHtml.match(/metra(?:że|ze)\s*(?:od)?\s*([\d\s.,]+)\s*(?:do\s*[\d\s.,]+)?\s*m(?:2|²|kw)/i)?.[1]
  );
  const areaFromAny = parseNumber(
    normalizedHtml.match(/([\d]{2,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1]
  );
  const areaFromTitle = parseNumber(
    decodeImportHtmlText(title).match(/([\d]{2,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1]
  );
  const areaFromDescription = parseNumber(
    decodeImportHtmlText(descriptionText).match(/([\d]{2,4}(?:[.,]\d{1,2})?)\s*m(?:2|²|kw)\b/i)?.[1]
  );
  const area = areaFromLabel ?? areaFromTable ?? areaFromRange ?? areaFromAny;
  const plotArea = parseNumber(
    html.match(/powierzchni[aey]?\s*dzia[łl]ki[:\s]*([\d\s.,]+)\s*m(?:2|²)/i)?.[1]
  );
  const areaResolved = area ?? areaFromTitle ?? areaFromDescription;
  const rooms =
    parseNumber(normalizedHtml.match(/(\d+)\s*pok(?:ó|o)j/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/(\d+)\s*pok\./i)?.[1]) ??
    parseNumber(normalizedHtml.match(/liczba\s+pokoi[:\s]*([\d]+)/i)?.[1]) ??
    parseNumber(normalizedHtml.match(/(\d+)\s*pomieszczeni(?:a|e)/i)?.[1]);
  const floor = parseFloor(html.match(/pi(?:ę|e)tro[:\s]*([\w\/-]+)/i)?.[1]);
  const yearBuilt = parseNumber(html.match(/rok\s*budow[yia][:\s]*([\d]{4})/i)?.[1]);
  const lat = parseNumber(html.match(/"latitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);
  const lng = parseNumber(html.match(/"longitude"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/i)?.[1]);

  const cityRaw =
    cityFromHost ||
    html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/\b,\s*([A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\- ]+)\s*$/m)?.[1] ||
    '';
  const city = canonicalizeCity(String(cityRaw || '').trim());
  const district = canonicalizeDistrict(city, '');
  const htmlWithUnescapedSlashes = html.replace(/\\\//g, '/');
  const imageFromOg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';
  const imageFromCdn = Array.from(
    new Set(
      (htmlWithUnescapedSlashes.match(/https?:\/\/i\.st-nieruchomosci-online\.pl\/[^\s"'<>)]*\.(?:jpe?g|png|webp)/gi) || [])
        .map((url) => String(url).trim())
        .filter(Boolean)
    )
  );
  const imageUrls = Array.from(new Set([imageFromOg, ...imageFromCdn].filter(Boolean)));

  const transactionType = /wynajem|do wynajęcia|na wynajem/i.test(html) ? 'RENT' : 'SALE';
  const propertyType = /dom/i.test(title)
    ? 'HOUSE'
    : /dzia[łl]k/i.test(title)
      ? 'PLOT'
      : /lokal|u[żz]ytkow|handlow|biurow|magazyn|us[łl]ugow/i.test(`${title} ${descriptionText}`)
        ? 'COMMERCIAL'
        : 'FLAT';

  return {
    source: 'NIERUCHOMOSCI_ONLINE',
    externalId: hashStringToPositiveInt(cleanCanonical),
    externalUrl: cleanCanonical,
    slug,
    title: title || 'Oferta z Nieruchomosci-Online',
    transactionType,
    propertyType,
    price,
    priceCurrency: 'PLN',
    adminFee: null,
    deposit: null,
    area: areaResolved,
    plotArea,
    rooms,
    floor,
    totalFloors: null,
    yearBuilt,
    condition: null,
    conditionCode: null,
    heating: null,
    heatingCode: null,
    buildingType: null,
    city,
    district,
    neighborhood: null,
    street: null,
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
