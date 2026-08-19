import {
  REST_OF_COUNTRY_CITY,
  STRICT_CITIES,
  STRICT_CITY_DISTRICTS,
  resolvePinLocationFromGeocodedPlace,
  streetLineFromGeocodedPlace,
  type GeocodedPlaceInput,
} from '../constants/locationEcosystem';
import { inferWarsawDistrictFromCoordinates } from '../constants/warsawDistrictSeeds';

export type DetectedOfferLocation = {
  city: string;
  district: string;
};

const STRICT_CITY_SET = new Set<string>(STRICT_CITIES as unknown as string[]);

const S8_LINE: Array<{ lng: number; lat: number }> = [
  { lng: 20.975, lat: 52.306 },
  { lng: 21.0, lat: 52.3056 },
  { lng: 21.02, lat: 52.305 },
  { lng: 21.045, lat: 52.3044 },
  { lng: 21.07, lat: 52.3039 },
  { lng: 21.095, lat: 52.3034 },
];

function s8LatitudeAtLongitude(lng: number): number | null {
  if (lng < S8_LINE[0].lng || lng > S8_LINE[S8_LINE.length - 1].lng) return null;
  for (let i = 0; i < S8_LINE.length - 1; i++) {
    const a = S8_LINE[i];
    const b = S8_LINE[i + 1];
    if (lng >= a.lng && lng <= b.lng) {
      const t = (lng - a.lng) / (b.lng - a.lng);
      return a.lat + t * (b.lat - a.lat);
    }
  }
  return null;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ł]/g, 'l')
    .replace(/[-_/]/g, ' ')
    .replace(/[.,;:()]+/g, ' ')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function districtsForCity(city: string): string[] {
  return STRICT_CITY_DISTRICTS[city] || [];
}

export function isStrictOfferCity(city: string): boolean {
  return Boolean(city && STRICT_CITY_SET.has(city) && city !== REST_OF_COUNTRY_CITY);
}

export function polishStrictCities(): string[] {
  return (STRICT_CITIES as unknown as string[]).filter((city) => city !== REST_OF_COUNTRY_CITY);
}

export function matchDistrictByName(rawDistrict: string | null | undefined, city: string): string | null {
  if (!rawDistrict) return null;
  const cityDistricts = districtsForCity(city);
  if (!cityDistricts.length) return null;
  const needle = normalizeForMatch(rawDistrict);
  if (!needle) return null;

  if (city === 'Warszawa' && /\bpraga\b/.test(needle)) {
    if (/\b(polnoc|pn)\b/.test(needle)) return 'Praga-Północ';
    if (/\b(poludnie|pd|poludniowa)\b/.test(needle)) return 'Praga-Południe';
    if (needle === 'praga') return null;
  }

  for (const district of cityDistricts) {
    if (normalizeForMatch(district) === needle) return district;
  }

  let prefixMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeForMatch(district);
    if (n.startsWith(needle) || needle.startsWith(n)) {
      if (prefixMatch && prefixMatch !== district) return null;
      prefixMatch = district;
    }
  }
  if (prefixMatch) return prefixMatch;

  let substringMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeForMatch(district);
    if (n.includes(needle) || needle.includes(n)) {
      if (substringMatch && substringMatch !== district) return null;
      substringMatch = district;
    }
  }
  return substringMatch;
}

function closestDistrictFromHints(
  lat: number,
  lng: number,
  city: string,
  hints: Array<string | null | undefined>,
): string {
  const cityDistricts = districtsForCity(city);
  if (!cityDistricts.length) {
    return String(hints.find((item) => String(item || '').trim()) || '').trim();
  }

  const isWarszawa = city === 'Warszawa';
  const s8Lat = isWarszawa ? s8LatitudeAtLongitude(lng) : null;
  const s8Tolerance = 0.0009;
  const isNorthOfS8 = s8Lat !== null && lat >= s8Lat + s8Tolerance;
  const isSouthOfS8 = s8Lat !== null && lat <= s8Lat - s8Tolerance;

  if (isWarszawa && cityDistricts.includes('Białołęka') && isNorthOfS8) {
    return 'Białołęka';
  }

  for (const hint of hints) {
    const matched = matchDistrictByName(hint, city);
    if (!matched) continue;
    if (isWarszawa && isSouthOfS8 && matched === 'Białołęka') continue;
    return matched;
  }

  if (isWarszawa) {
    const inferred = inferWarsawDistrictFromCoordinates(lat, lng);
    if (inferred && cityDistricts.includes(inferred)) {
      if (isSouthOfS8 && inferred === 'Białołęka') {
        return 'Targówek';
      }
      return inferred;
    }
  }

  return '';
}

export function detectOfferLocationFromPin(params: {
  lat: number;
  lng: number;
  place?: GeocodedPlaceInput | null;
  streetHint?: string | null;
  preferredCity?: string | null;
}): DetectedOfferLocation {
  const place = params.place || {};
  const hint = params.streetHint || streetLineFromGeocodedPlace(place, '');
  const preferred = String(params.preferredCity || '').trim();
  const resolution = resolvePinLocationFromGeocodedPlace(place, {
    streetHint: hint,
    lat: params.lat,
    lng: params.lng,
    anchorStrictCity: preferred && STRICT_CITY_SET.has(preferred) ? preferred : null,
  });

  if (resolution.mode === 'locality') {
    return {
      city: resolution.city || REST_OF_COUNTRY_CITY,
      district: String(resolution.district || '').trim(),
    };
  }

  const city = resolution.strictCity;
  const district = closestDistrictFromHints(params.lat, params.lng, city, [
    place.district,
    place.name,
    place.subregion,
    place.city === city ? null : place.city,
  ]);
  return { city, district };
}
