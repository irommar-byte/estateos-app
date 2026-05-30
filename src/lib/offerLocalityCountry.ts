/**
 * Państwo oferty — zapis w DB + wnioskowanie z współrzędnych / miasta gdy brak jawnych pól.
 */

const DEFAULT_COUNTRY_LABEL = 'Polska';
const DEFAULT_COUNTRY_CODE = 'PL';

const PL_COUNTRY_TO_ISO: Record<string, string> = {
  Polska: 'PL',
  Niemcy: 'DE',
  Czechy: 'CZ',
  Słowacja: 'SK',
  Ukraina: 'UA',
  Białoruś: 'BY',
  Litwa: 'LT',
  'Stany Zjednoczone': 'US',
  Australia: 'AU',
  'Wielka Brytania': 'GB',
  Kanada: 'CA',
  Francja: 'FR',
  Hiszpania: 'ES',
  Włochy: 'IT',
  Holandia: 'NL',
  Belgia: 'BE',
  Szwajcaria: 'CH',
  Austria: 'AT',
};

const ENGLISH_COUNTRY_TO_PL: Record<string, string> = {
  poland: 'Polska',
  germany: 'Niemcy',
  czechia: 'Czechy',
  'czech republic': 'Czechy',
  slovakia: 'Słowacja',
  ukraine: 'Ukraina',
  belarus: 'Białoruś',
  lithuania: 'Litwa',
  austria: 'Austria',
  france: 'Francja',
  spain: 'Hiszpania',
  italy: 'Włochy',
  netherlands: 'Holandia',
  belgium: 'Belgia',
  'united kingdom': 'Wielka Brytania',
  'united states': 'Stany Zjednoczone',
  usa: 'Stany Zjednoczone',
};

const METRO_PL_CITIES = new Set([
  'warszawa',
  'warsaw',
  'krakow',
  'kraków',
  'wroclaw',
  'wrocław',
  'poznan',
  'poznań',
  'lodz',
  'łódź',
  'lublin',
  'gdansk',
  'gdańsk',
  'gdynia',
  'sopot',
  'katowice',
  'rybnik',
  'bialystok',
  'białystok',
  'zamosc',
  'zamość',
]);

const KNOWN_FOREIGN_CITY_ISO: Record<string, string> = {
  berlin: 'DE',
  hamburg: 'DE',
  munchen: 'DE',
  muenchen: 'DE',
  frankfurt: 'DE',
  koln: 'DE',
  cologne: 'DE',
  dresden: 'DE',
  wien: 'AT',
  vienna: 'AT',
  praha: 'CZ',
  prague: 'CZ',
  bratislava: 'SK',
  kyiv: 'UA',
  kiev: 'UA',
  london: 'GB',
  paris: 'FR',
  amsterdam: 'NL',
  brussels: 'BE',
  bruxelles: 'BE',
  rome: 'IT',
  roma: 'IT',
  madrid: 'ES',
};

const COUNTRY_BBOXES: Array<{
  iso: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}> = [
  { iso: 'DE', latMin: 47.2, latMax: 55.2, lngMin: 5.8, lngMax: 15.1 },
  { iso: 'CZ', latMin: 48.5, latMax: 51.1, lngMin: 12.0, lngMax: 18.9 },
  { iso: 'SK', latMin: 47.7, latMax: 49.6, lngMin: 16.8, lngMax: 22.6 },
  { iso: 'UA', latMin: 44.3, latMax: 52.4, lngMin: 22.1, lngMax: 40.2 },
  { iso: 'AT', latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 },
];

function normalizeMatch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

export function countryLabelFromIso(iso: string): string {
  const code = String(iso || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return DEFAULT_COUNTRY_LABEL;
  try {
    const dn = new Intl.DisplayNames(['pl-PL'], { type: 'region' });
    return dn.of(code) || code;
  } catch {
    const fromMap = Object.entries(PL_COUNTRY_TO_ISO).find(([, v]) => v === code)?.[0];
    return fromMap || code;
  }
}

export function isCoordinatesInPoland(lat: number, lng: number): boolean {
  return lat >= 49.0 && lat <= 54.95 && lng >= 14.05 && lng <= 24.25;
}

function inferCountryIsoFromCoordinates(lat: number, lng: number): string | null {
  for (const box of COUNTRY_BBOXES) {
    if (lat >= box.latMin && lat <= box.latMax && lng >= box.lngMin && lng <= box.lngMax) {
      return box.iso;
    }
  }
  return null;
}

function inferCountryIsoFromCity(city: string): string | null {
  const norm = normalizeMatch(city);
  if (!norm) return null;
  if (METRO_PL_CITIES.has(norm) || [...METRO_PL_CITIES].some((c) => norm.includes(c))) {
    return DEFAULT_COUNTRY_CODE;
  }
  if (KNOWN_FOREIGN_CITY_ISO[norm]) return KNOWN_FOREIGN_CITY_ISO[norm];
  return null;
}

function labelFromExplicit(code: string, label: string): { code: string; label: string } | null {
  const iso = String(code || '').trim().toUpperCase();
  const lbl = String(label || '').trim();
  if (/^[A-Z]{2}$/.test(iso) && iso !== DEFAULT_COUNTRY_CODE) {
    return { code: iso, label: lbl || countryLabelFromIso(iso) };
  }
  if (lbl && !/^polska$/i.test(lbl)) {
    const fromPl = PL_COUNTRY_TO_ISO[lbl];
    if (fromPl && fromPl !== DEFAULT_COUNTRY_CODE) {
      return { code: fromPl, label: lbl };
    }
    const fromEn = ENGLISH_COUNTRY_TO_PL[lbl.toLowerCase()];
    if (fromEn) {
      const fromEnIso = PL_COUNTRY_TO_ISO[fromEn];
      if (fromEnIso) return { code: fromEnIso, label: fromEn };
    }
  }
  if (/^[A-Z]{2}$/.test(iso)) {
    return { code: iso, label: lbl || countryLabelFromIso(iso) };
  }
  return null;
}

export type LocalityPersistInput = {
  localityCountry?: unknown;
  localityCountryCode?: unknown;
  city?: unknown;
  lat?: unknown;
  lng?: unknown;
};

/** Kanoniczny kraj do zapisu w `Offer.localityCountry*`. */
export function resolvePersistedLocalityFields(input: LocalityPersistInput): {
  localityCountry: string;
  localityCountryCode: string;
} {
  const explicit = labelFromExplicit(
    String(input.localityCountryCode ?? ''),
    String(input.localityCountry ?? ''),
  );

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  if (hasCoords) {
    if (isCoordinatesInPoland(lat, lng)) {
      return { localityCountry: DEFAULT_COUNTRY_LABEL, localityCountryCode: DEFAULT_COUNTRY_CODE };
    }
    const fromCoords = inferCountryIsoFromCoordinates(lat, lng);
    if (fromCoords) {
      return { localityCountry: countryLabelFromIso(fromCoords), localityCountryCode: fromCoords };
    }
  }

  if (explicit) return { localityCountry: explicit.label, localityCountryCode: explicit.code };

  const fromCity = inferCountryIsoFromCity(String(input.city ?? ''));
  if (fromCity) {
    return { localityCountry: countryLabelFromIso(fromCity), localityCountryCode: fromCity };
  }

  return { localityCountry: DEFAULT_COUNTRY_LABEL, localityCountryCode: DEFAULT_COUNTRY_CODE };
}

/** Odczyt kraju oferty z API (z fallbackiem na współrzędne). */
export function offerListingCountryIso(raw: Record<string, unknown>): string {
  return resolvePersistedLocalityFields({
    localityCountry: raw.localityCountry,
    localityCountryCode: raw.localityCountryCode,
    city: raw.city,
    lat: raw.lat,
    lng: raw.lng,
  }).localityCountryCode;
}

export function offerListingCountryLabel(raw: Record<string, unknown>): string {
  return resolvePersistedLocalityFields({
    localityCountry: raw.localityCountry,
    localityCountryCode: raw.localityCountryCode,
    city: raw.city,
    lat: raw.lat,
    lng: raw.lng,
  }).localityCountry;
}
