/** Oferty spoza listy głównych aglomeracji — miejscowość trzymamy w `district` (np. „Przemyśl”). */
import {
  inferWarsawDistrictFromCoordinates,
  minDistanceToWarsawDistrictSeeds,
} from './warsawDistrictSeeds';

export const REST_OF_COUNTRY_CITY = 'Reszta kraju' as const;

/** Miejscowości podmiejskie często błędnie przypisywane do miast strict (np. Sitaniec → Zamość). */
const KNOWN_STANDALONE_LOCALITIES = new Set([
  'sitaniec',
  'skaraszewice',
  'labunie',
  'niemirow',
  'radecznica',
  'sitno',
]);

/** Gminy/miasta satelickie wokół metropolii — pinezka w promieniu ≠ dzielnica macierzystego miasta. */
const METRO_SATELLITE_MUNICIPALITIES: Array<{
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}> = [
  { name: 'Pruszków', lat: 52.161, lng: 20.812, radiusKm: 7 },
  { name: 'Piaseczno', lat: 52.081, lng: 21.024, radiusKm: 7 },
  { name: 'Legionowo', lat: 52.401, lng: 20.926, radiusKm: 6 },
  { name: 'Otwock', lat: 52.105, lng: 21.261, radiusKm: 7 },
  { name: 'Marki', lat: 52.321, lng: 21.106, radiusKm: 5 },
  { name: 'Ząbki', lat: 52.292, lng: 21.111, radiusKm: 4 },
  { name: 'Piastów', lat: 52.184, lng: 20.839, radiusKm: 4 },
  { name: 'Raszyn', lat: 52.156, lng: 20.882, radiusKm: 5 },
  { name: 'Konstancin-Jeziorna', lat: 52.091, lng: 21.117, radiusKm: 6 },
  { name: 'Józefów', lat: 52.137, lng: 21.236, radiusKm: 5 },
  { name: 'Sulejówek', lat: 52.244, lng: 21.269, radiusKm: 4 },
  { name: 'Wołomin', lat: 52.348, lng: 21.242, radiusKm: 6 },
  { name: 'Łomianki', lat: 52.335, lng: 20.896, radiusKm: 4 },
  { name: 'Milanówek', lat: 52.118, lng: 20.671, radiusKm: 4 },
  { name: 'Brwinów', lat: 52.142, lng: 20.699, radiusKm: 4 },
  { name: 'Nadarzyn', lat: 52.095, lng: 20.817, radiusKm: 5 },
  { name: 'Wieliczka', lat: 49.987, lng: 20.065, radiusKm: 7 },
  { name: 'Skawina', lat: 49.976, lng: 19.828, radiusKm: 6 },
  { name: 'Zielonki', lat: 50.115, lng: 19.932, radiusKm: 5 },
  { name: 'Mogilany', lat: 49.938, lng: 19.889, radiusKm: 5 },
];

/** Gminy w pierścieniu wokół Warszawy — promień satelity nie może nadpisać dzielnicy z pinezki. */
const WARSAW_INNER_BORDER_SATELLITE_NAMES = new Set([
  'zabki',
  'marki',
  'sulejowek',
  'jozefow',
  'wolomin',
  'lomianki',
  'otwock',
  'legionowo',
]);

type MetroSatelliteDef = (typeof METRO_SATELLITE_MUNICIPALITIES)[number];

function getMetroSatelliteDefinition(name: string): MetroSatelliteDef | null {
  const norm = normalizeLocationMatch(name);
  return (
    METRO_SATELLITE_MUNICIPALITIES.find((item) => normalizeLocationMatch(item.name) === norm) ??
    null
  );
}

function isWarsawInnerBorderSatellite(name: string): boolean {
  return WARSAW_INNER_BORDER_SATELLITE_NAMES.has(normalizeLocationMatch(name));
}

function isOuterMetroSatellite(name: string): boolean {
  const norm = normalizeLocationMatch(name);
  return (
    METRO_SATELLITE_MUNICIPALITIES.some((item) => normalizeLocationMatch(item.name) === norm) &&
    !isWarsawInnerBorderSatellite(name)
  );
}

/** Pinezka bliżej zarodków dzielnicy Warszawy niż centrum satelity — administracyjnie miasto, nie gmina obok. */
function warsawDistrictDominatesSatellite(
  district: string,
  lat: number,
  lng: number,
  satellite: MetroSatelliteDef | null,
): boolean {
  const districtKm = minDistanceToWarsawDistrictSeeds(district, lat, lng);
  if (!Number.isFinite(districtKm)) return false;
  if (!satellite) return districtKm <= 4.5;
  const satelliteKm = haversineKm(lat, lng, satellite.lat, satellite.lng);
  return districtKm + 1.2 < satelliteKm;
}

function tryResolveWarsawStrictFromPin(
  lat: number,
  lng: number,
  place: GeocodedPlaceInput,
  streetHint: string,
  satellite: string | null,
): PinLocationResolution | null {
  if (!isPinWithinStrictCityEnvelope('Warszawa', lat, lng)) return null;
  const inferredDistrict = inferWarsawDistrictFromCoordinates(lat, lng);
  if (!inferredDistrict) return null;

  const satelliteDef = satellite ? getMetroSatelliteDefinition(satellite) : null;
  if (
    satellite &&
    isOuterMetroSatellite(satellite) &&
    shouldUseSatelliteOverGeocoder(place, satellite, streetHint, lat, lng)
  ) {
    return null;
  }

  if (warsawDistrictDominatesSatellite(inferredDistrict, lat, lng, satelliteDef)) {
    return { mode: 'strict', strictCity: 'Warszawa' };
  }

  if (geocoderConfirmsStrictCity('Warszawa', place, streetHint)) {
    return { mode: 'strict', strictCity: 'Warszawa' };
  }

  if (
    satellite &&
    isWarsawInnerBorderSatellite(satellite) &&
    satelliteDef &&
    normalizeLocationMatch(String(place.city ?? '')) === normalizeLocationMatch(satellite)
  ) {
    const districtKm = minDistanceToWarsawDistrictSeeds(inferredDistrict, lat, lng);
    const satelliteKm = haversineKm(lat, lng, satelliteDef.lat, satelliteDef.lng);
    if (satelliteKm <= districtKm) return null;
  }

  return null;
}

function isKnownStandaloneLocality(name: unknown): boolean {
  const norm = normalizeLocationMatch(String(name ?? '').trim());
  return norm.length > 0 && KNOWN_STANDALONE_LOCALITIES.has(norm);
}

export const DEFAULT_LOCALITY_COUNTRY = 'Polska';
export const DEFAULT_LOCALITY_COUNTRY_CODE = 'PL';

const ENGLISH_COUNTRY_TO_PL: Record<string, string> = {
  poland: 'Polska',
  ukraine: 'Ukraina',
  germany: 'Niemcy',
  czechia: 'Czechy',
  'czech republic': 'Czechy',
  slovakia: 'Słowacja',
  belarus: 'Białoruś',
  lithuania: 'Litwa',
  russia: 'Rosja',
  austria: 'Austria',
  hungary: 'Węgry',
  romania: 'Rumunia',
  moldova: 'Mołdawia',
  'united states': 'Stany Zjednoczone',
  'united states of america': 'Stany Zjednoczone',
  usa: 'Stany Zjednoczone',
  australia: 'Australia',
  'united kingdom': 'Wielka Brytania',
  'great britain': 'Wielka Brytania',
  england: 'Wielka Brytania',
  canada: 'Kanada',
  france: 'Francja',
  spain: 'Hiszpania',
  italy: 'Włochy',
  netherlands: 'Holandia',
  belgium: 'Belgia',
  switzerland: 'Szwajcaria',
  sweden: 'Szwecja',
  norway: 'Norwegia',
  denmark: 'Dania',
  ireland: 'Irlandia',
  portugal: 'Portugalia',
  greece: 'Grecja',
  turkey: 'Turcja',
  japan: 'Japonia',
  china: 'Chiny',
  india: 'Indie',
  brazil: 'Brazylia',
  mexico: 'Meksyk',
  'new zealand': 'Nowa Zelandia',
  singapore: 'Singapur',
};

const PL_COUNTRY_TO_ISO: Record<string, string> = {
  Polska: 'PL',
  Ukraina: 'UA',
  Niemcy: 'DE',
  Czechy: 'CZ',
  Słowacja: 'SK',
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
  Szwecja: 'SE',
  Norwegia: 'NO',
  Dania: 'DK',
  Irlandia: 'IE',
  Portugalia: 'PT',
  Grecja: 'GR',
  Turcja: 'TR',
  Japonia: 'JP',
  Chiny: 'CN',
  Indie: 'IN',
  Brazylia: 'BR',
  Meksyk: 'MX',
  'Nowa Zelandia': 'NZ',
  Singapur: 'SG',
};

const KNOWN_COUNTRY_ISO_CODES = new Set(Object.values(PL_COUNTRY_TO_ISO));

/** Współrzędne mapy — dowolny kwadrant (ujemne lat/lng: AU, US, UK…). */
export function hasValidMapCoordinates(lat: unknown, lng: unknown): boolean {
  const latN = Number(String(lat ?? '').replace(/\s/g, '').replace(',', '.'));
  const lngN = Number(String(lng ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return false;
  if (latN === 0 && lngN === 0) return false;
  return Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
}

/** Dwuliterowy kod kraju (PL, US…) — nie skrót stanu USA (TX, CA…). */
export function isKnownCountryIso(code: string): boolean {
  return KNOWN_COUNTRY_ISO_CODES.has(String(code || '').trim().toUpperCase());
}

export function countryLabelPlFromIso(iso: string): string {
  const code = String(iso || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    const dn = new Intl.DisplayNames(['pl-PL'], { type: 'region' });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

/** Państwo z wyniku `reverseGeocodeAsync` (ISO → polska nazwa, np. Polska / Ukraina). */
export function resolveLocalityCountryFromPlace(place: {
  country?: string | null;
  isoCountryCode?: string | null;
}): { code: string; labelPl: string } {
  const iso = String(place.isoCountryCode || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) {
    return {
      code: iso,
      labelPl: countryLabelPlFromIso(iso) || DEFAULT_LOCALITY_COUNTRY,
    };
  }
  const raw = String(place.country || '').trim();
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    return { code, labelPl: countryLabelPlFromIso(code) || code };
  }
  if (!raw) {
    return { code: DEFAULT_LOCALITY_COUNTRY_CODE, labelPl: DEFAULT_LOCALITY_COUNTRY };
  }
  const fromEn = ENGLISH_COUNTRY_TO_PL[raw.toLowerCase()];
  if (fromEn) {
    return { code: PL_COUNTRY_TO_ISO[fromEn] || DEFAULT_LOCALITY_COUNTRY_CODE, labelPl: fromEn };
  }
  if (/^polska$/i.test(raw)) return { code: 'PL', labelPl: 'Polska' };
  const fromPlIso = PL_COUNTRY_TO_ISO[raw];
  if (fromPlIso) return { code: fromPlIso, labelPl: raw };
  return { code: '', labelPl: raw };
}

/** Polska nazwa kraju — akceptuje też dwuliterowy kod (np. CZ → Czechy). */
export function normalizeLocalityCountryLabel(labelOrCode?: unknown): string {
  const s = String(labelOrCode || '').trim();
  if (!s) return DEFAULT_LOCALITY_COUNTRY;
  if (/^[A-Za-z]{2}$/.test(s)) {
    return countryLabelPlFromIso(s.toUpperCase()) || s.toUpperCase();
  }
  return s;
}

/** Kod ISO (PL, UA…) z draftu lub polskiej nazwy kraju. */
export function localityCountryIso(code?: string | null, labelPl?: string | null): string {
  const iso = String(code || '').trim().toUpperCase();
  const label = String(labelPl || '').trim();
  const labelIso = label ? PL_COUNTRY_TO_ISO[label] : undefined;

  if (/^[A-Z]{2}$/.test(iso)) {
    // Domyślne PL z geokodera, gdy etykieta wskazuje inny kraj (np. Stany Zjednoczone).
    if (iso === DEFAULT_LOCALITY_COUNTRY_CODE && labelIso && labelIso !== DEFAULT_LOCALITY_COUNTRY_CODE) {
      return labelIso;
    }
    return iso;
  }
  if (labelIso) return labelIso;
  if (label) {
    const fromEn = ENGLISH_COUNTRY_TO_PL[label.toLowerCase()];
    if (fromEn) {
      const fromEnIso = PL_COUNTRY_TO_ISO[fromEn];
      if (fromEnIso) return fromEnIso;
    }
  }
  return DEFAULT_LOCALITY_COUNTRY_CODE;
}

/** Miejscowość z wyniku reverse-geocode — pomija kody kraju, skróty stanów USA i nazwy ulic. */
export function localityNameFromGeocodedPlace(
  place: {
    city?: string | null;
    subregion?: string | null;
    name?: string | null;
    region?: string | null;
    district?: string | null;
    street?: string | null;
    isoCountryCode?: string | null;
    country?: string | null;
  },
  options?: { streetHint?: string | null; lat?: number | null; lng?: number | null },
): string {
  const lat = Number(options?.lat);
  const lng = Number(options?.lng);

  const streetHint = String(options?.streetHint ?? '').trim();
  const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
  const nameNorm = normalizeLocationMatch(String(place.name ?? ''));
  const hintStreetNorm = normalizeLocationMatch(streetHint.split(/\s+\d/)[0] || '');

  const villageFromHint = extractVillageLocalityFromStreet(streetHint);
  if (villageFromHint && isLikelyStandaloneVillage(villageFromHint)) {
    if (geocoderNamesStandaloneSettlement(place, villageFromHint)) {
      return villageFromHint;
    }
    const strictFromCity = detectStrictCityFromGeocodeText(String(place.city ?? ''));
    if (
      strictFromCity &&
      streetNorm === normalizeLocationMatch(villageFromHint) &&
      !pinMatchesStrictCity(strictFromCity, villageFromHint, place.district)
    ) {
      if (nameNorm === normalizeLocationMatch(villageFromHint)) {
        return villageFromHint;
      }
    }
  }

  const nameIsStreet =
    Boolean(streetNorm) &&
    Boolean(nameNorm) &&
    (nameNorm === streetNorm || streetNorm.includes(nameNorm) || nameNorm.includes(streetNorm));

  const isStreetLikeLocality = (token: string): boolean => {
    const tokenNorm = normalizeLocationMatch(token);
    if (!tokenNorm) return true;
    if (hintStreetNorm && tokenNorm === hintStreetNorm) return true;
    if (streetNorm && tokenNorm === streetNorm) return true;
    if (streetHint && geocodeTokenMatchesStreet(token, place, streetHint)) return true;
    if (streetNorm && tokenNorm !== streetNorm && !detectStrictCityFromGeocodeText(token)) {
      const adminFromSubregion = detectStrictCityFromGeocodeText(String(place.subregion ?? ''));
      if (adminFromSubregion && !token.includes(' ')) return true;
    }
    return false;
  };

  const candidates = [place.city];
  if (place.name && !nameIsStreet) {
    candidates.push(place.name);
  }
  candidates.push(place.subregion, place.region);

  for (const raw of candidates) {
    const token = String(raw || '').trim();
    if (!token) continue;
    if (/powiat|gmina|województwo|wojewodztwo/i.test(token)) continue;
    if (isStreetLikeLocality(token)) continue;
    if (/^[A-Za-z]{2}$/i.test(token)) {
      const upper = token.toUpperCase();
      if (isKnownCountryIso(upper)) continue;
      continue;
    }
    return token;
  }
  return 'Ogólna';
}

export function countryFieldsFromGeocodedPlace(
  place: { country?: string | null; isoCountryCode?: string | null } | null | undefined,
): { localityCountry: string; localityCountryCode: string } {
  if (!place) {
    return {
      localityCountry: DEFAULT_LOCALITY_COUNTRY,
      localityCountryCode: DEFAULT_LOCALITY_COUNTRY_CODE,
    };
  }
  const geocoded = resolveLocalityCountryFromPlace(place);
  const placeIso = String(place.isoCountryCode || '').trim().toUpperCase();
  let code =
    (geocoded.code && /^[A-Z]{2}$/.test(geocoded.code) ? geocoded.code : '') ||
    (/^[A-Z]{2}$/.test(placeIso) ? placeIso : '') ||
    PL_COUNTRY_TO_ISO[geocoded.labelPl] ||
    '';
  if (!/^[A-Z]{2}$/.test(code)) {
    code = DEFAULT_LOCALITY_COUNTRY_CODE;
  }
  return {
    localityCountry: normalizeLocalityCountryLabel(
      geocoded.labelPl || countryLabelPlFromIso(code),
    ),
    localityCountryCode: code,
  };
}

export function buildGeocodeQuery(addressPart: string, countryLabelPl: string): string {
  const part = String(addressPart || '').trim();
  let country = normalizeLocalityCountryLabel(countryLabelPl);
  if (/^[A-Z]{2}$/.test(country)) {
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      country = dn.of(country) || country;
    } catch {
      /* noop */
    }
  }
  country = String(country || DEFAULT_LOCALITY_COUNTRY).trim() || DEFAULT_LOCALITY_COUNTRY;
  if (!part) return country;
  return `${part}, ${country}`;
}

export type DraftLocationPresentation = {
  city: string;
  district: string;
  countryLabelPl: string;
  countryIso: string;
  locationText: string;
};

const isStrictCityName = (city: string) =>
  (STRICT_CITIES as readonly string[]).includes(city);

/**
 * Ujednolica zapis lokalizacji w szkicu (m.in. naprawa: city=Pilzno, district=CZ).
 * Zwraca gotowy tekst „Miejscowość, Państwo” oraz kod ISO pod flagę.
 */
export function getDraftLocationPresentation(draft: {
  city?: string;
  district?: string;
  localityCountry?: string;
  localityCountryCode?: string;
}): DraftLocationPresentation {
  let city = String(draft.city ?? '').trim();
  let district = String(draft.district ?? '').trim();
  let countryLabelPl = normalizeLocalityCountryLabel(draft.localityCountry);
  let countryIso = localityCountryIso(draft.localityCountryCode, countryLabelPl);

  if (!isStrictCityName(city) && city && city !== REST_OF_COUNTRY_CITY) {
    if (/^[A-Za-z]{2}$/i.test(district) && isKnownCountryIso(district)) {
      countryIso = district.toUpperCase();
      countryLabelPl = countryLabelPlFromIso(countryIso) || countryLabelPl;
    }
    district = city;
    city = REST_OF_COUNTRY_CITY;
  } else if (
    city === REST_OF_COUNTRY_CITY &&
    /^[A-Za-z]{2}$/i.test(district) &&
    isKnownCountryIso(district)
  ) {
    const isoFromDistrict = district.toUpperCase();
    const codeFromDraft = String(draft.localityCountryCode ?? '').trim().toUpperCase();
    countryIso = /^[A-Z]{2}$/.test(codeFromDraft) ? codeFromDraft : isoFromDistrict;
    countryLabelPl =
      countryLabelPlFromIso(countryIso) || normalizeLocalityCountryLabel(draft.localityCountry) || countryLabelPl;
    // Kod kraju (np. „US”) trafił do district — wyczyść slot miejscowości.
    district = '';
  }

  if (city === REST_OF_COUNTRY_CITY && !String(district).trim()) {
    district = 'Ogólna';
  }

  const locationText = formatLocationLabel(city, district, DEFAULT_LOCALITY_COUNTRY, countryLabelPl);
  return { city, district, countryLabelPl, countryIso, locationText };
}

/** Patch do `updateDraft`, gdy lokalizacja w szkicu jest w starym / błędnym kształcie. */
export function getLocationDraftRepairPatch(
  draft: {
    city?: string;
    district?: string;
    localityCountry?: string;
    localityCountryCode?: string;
  },
  coords?: { lat?: number; lng?: number } | null,
): {
  city: string;
  district: string;
  localityCountry: string;
  localityCountryCode: string;
} | null {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const countryIso = localityCountryIso(draft.localityCountryCode, draft.localityCountry);

  if (hasCoords && countryIso === DEFAULT_LOCALITY_COUNTRY_CODE) {
    const satellite = detectSatelliteMunicipalityFromCoordinates(lat, lng);
    const city = String(draft.city ?? '').trim();
    const district = String(draft.district ?? '').trim();

    // Stała: „Reszta kraju" + nazwa = dzielnica miasta strict, a pinezka leży w jego
    // obwiedni ⇒ to dzielnica tego miasta, nie osobna miejscowość (np. zapisany
    // wcześniej REST + „Targówek" przy Świętego Wincentego ⇒ Warszawa + Targówek).
    if (city === REST_OF_COUNTRY_CITY && district) {
      const promoteCity = detectStrictCityFromCoordinates(lat, lng);
      if (
        promoteCity &&
        isPinWithinStrictCityEnvelope(promoteCity, lat, lng) &&
        isStrictCityDistrictName(promoteCity, district)
      ) {
        const promoteDistricts = STRICT_CITY_DISTRICTS[promoteCity] || [];
        const matchedDistrict =
          promoteDistricts.find(
            (d) => normalizeLocationMatch(d) === normalizeLocationMatch(district),
          ) || district;
        return {
          city: promoteCity,
          district: matchedDistrict,
          localityCountry: DEFAULT_LOCALITY_COUNTRY,
          localityCountryCode: DEFAULT_LOCALITY_COUNTRY_CODE,
        };
      }
    }

    const envelopeCity = detectStrictCityFromCoordinates(lat, lng);
    const cityIsMetro =
      envelopeCity &&
      (city === envelopeCity || detectStrictCityFromGeocodeText(city) === envelopeCity);
    if (satellite && cityIsMetro && isOuterMetroSatellite(satellite)) {
      return {
        city: REST_OF_COUNTRY_CITY,
        district: satellite,
        localityCountry: normalizeLocalityCountryLabel(draft.localityCountry),
        localityCountryCode: countryIso,
      };
    }
    const districtLooksLikeMetroArtifact =
      !district ||
      district === 'Ogólna' ||
      Boolean(envelopeCity && isStrictCityDistrictName(envelopeCity, district));
    if (
      satellite &&
      city === REST_OF_COUNTRY_CITY &&
      districtLooksLikeMetroArtifact &&
      normalizeLocationMatch(district) !== normalizeLocationMatch(satellite)
    ) {
      return {
        city: REST_OF_COUNTRY_CITY,
        district: satellite,
        localityCountry: normalizeLocalityCountryLabel(draft.localityCountry),
        localityCountryCode: countryIso,
      };
    }
  }

  const fixed = getDraftLocationPresentation(draft);
  const city = String(draft.city ?? '').trim();
  const district = String(draft.district ?? '').trim();
  const country = normalizeLocalityCountryLabel(draft.localityCountry);
  const iso = String(draft.localityCountryCode ?? '').trim().toUpperCase();

  const needsRepair =
    city !== fixed.city ||
    district !== fixed.district ||
    country !== fixed.countryLabelPl ||
    (iso !== fixed.countryIso && !(iso === '' && fixed.countryIso === DEFAULT_LOCALITY_COUNTRY_CODE));

  if (needsRepair) {
    return {
      city: fixed.city,
      district: fixed.district,
      localityCountry: fixed.countryLabelPl,
      localityCountryCode: fixed.countryIso,
    };
  }

  if (isStrictCityName(fixed.city) && fixed.city !== REST_OF_COUNTRY_CITY) {
    const allowed = STRICT_CITY_DISTRICTS[fixed.city] || [];
    if (allowed.length > 0 && district && !allowed.includes(district)) {
      // Ulica z geokodera (np. Łochowska) — nie demotuj do „Reszta kraju”.
      return {
        city: fixed.city,
        district: '',
        localityCountry: fixed.countryLabelPl,
        localityCountryCode: fixed.countryIso,
      };
    }
    if (allowed.length > 0 && !district) {
      return {
        city: fixed.city,
        district: allowed[0],
        localityCountry: fixed.countryLabelPl,
        localityCountryCode: fixed.countryIso,
      };
    }
  }

  return null;
}

/** Wyciąga nazwę miejscowości z adresu typu „Sitaniec 454" (bez ul./al.). Jedno słowo przed numerem. */
export function extractVillageLocalityFromStreet(
  streetInput: unknown,
  strictCity?: string | null,
): string {
  const street = String(streetInput ?? '').trim();
  if (!street || /^(ul\.?|al\.?|pl\.?|os\.?|ulica|aleja|plac|osiedle)\s/i.test(street)) {
    return '';
  }
  const match = street.match(/^(.+?)\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:\/\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/u);
  if (!match) return '';
  const candidate = match[1].trim();
  if (!candidate) return '';
  if (candidate.split(/\s+/).length !== 1) return '';
  if (strictCity) {
    const normCandidate = normalizeLocationMatch(candidate);
    const normCity = normalizeLocationMatch(strictCity);
    if (normCandidate === normCity) return '';
    const districts = STRICT_CITY_DISTRICTS[strictCity] || [];
    if (districts.some((d) => normalizeLocationMatch(d) === normCandidate)) return '';
  }
  return candidate;
}

/** Adres wiejski: jedno słowo + numer (np. „Sitaniec 464") — to miejscowość, nie ulica w mieście. */
export function isVillageStyleAddress(streetInput: unknown, villageName?: unknown): boolean {
  const street = String(streetInput ?? '').trim();
  if (!street || /^(ul\.?|al\.?|pl\.?|os\.?|ulica|aleja|plac|osiedle)\s/i.test(street)) {
    return false;
  }
  const match = street.match(/^(.+?)\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:\/\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?/u);
  if (!match) return false;
  const word = match[1].trim();
  if (!word || word.split(/\s+/).length !== 1) return false;
  if (villageName) {
    return normalizeLocationMatch(word) === normalizeLocationMatch(String(villageName));
  }
  return true;
}

/** Czy nazwa to osobna miejscowość (nie miasto strict ani jego dzielnica). */
export function isLikelyStandaloneVillage(villageName: unknown): boolean {
  const norm = normalizeLocationMatch(String(villageName ?? '').trim());
  if (!norm) return false;
  for (const city of STRICT_CITIES) {
    if (city === REST_OF_COUNTRY_CITY) continue;
    if (normalizeLocationMatch(city) === norm) return false;
    const districts = STRICT_CITY_DISTRICTS[city] || [];
    if (districts.some((d) => normalizeLocationMatch(d) === norm)) return false;
  }
  return true;
}

/** Adres wiejski z potwierdzoną nazwą miejscowości (np. Sitaniec 464, nie Zamość 13 w Kielcach). */
export function isStandaloneVillageAddress(streetInput: unknown, villageName: unknown): boolean {
  const village = String(villageName ?? '').trim();
  if (!village || !isVillageStyleAddress(streetInput, village)) return false;
  return isLikelyStandaloneVillage(village);
}

export type LocationDraftFieldsPatch = {
  city: string;
  district: string;
  localityCountry: string;
  localityCountryCode: string;
};

/** Czy patch realnie zmienia szkic (zanim wywołamy updateDraft). */
export function locationDraftPatchHasChanges(
  draft: {
    city?: string;
    district?: string;
    localityCountry?: string;
    localityCountryCode?: string;
  },
  patch: LocationDraftFieldsPatch,
): boolean {
  return (Object.keys(patch) as (keyof LocationDraftFieldsPatch)[]).some(
    (key) => String(draft[key] ?? '').trim() !== String(patch[key] ?? '').trim(),
  );
}

export function formatLocationLabel(
  cityInput: unknown,
  districtInput: unknown,
  fallback = 'Polska',
  countryLabel?: unknown,
): string {
  const city = String(cityInput ?? '').trim();
  const districtRaw = String(districtInput ?? '').trim();
  const district =
    !districtRaw ||
    /^(inny obszar|other|inne|og[oó]lna|ogolna|brak|n\/a|pozostałe|pozostale|-|—)$/i.test(districtRaw) ||
    (city && districtRaw.toLowerCase() === city.toLowerCase())
      ? ''
      : districtRaw;
  const country = normalizeLocalityCountryLabel(countryLabel);
  if (city === REST_OF_COUNTRY_CITY) {
    if (district && country) return `${district}, ${country}`;
    return district || country || fallback;
  }
  if (city && district) return `${city}, ${district}`;
  if (city) return city;
  if (district) return district;
  return fallback;
}

/**
 * Czy oferta ma włączoną „Dokładną lokalizację".
 * Domyślnie TRUE (zgodnie z polem domyślnym w useOfferStore i Step2).
 * Wyłączone tylko wtedy, gdy wartość jednoznacznie wskazuje na FALSE.
 */
export function resolveIsExactLocation(value: unknown): boolean {
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return true;
}

/**
 * Usuwa końcowy numer budynku/mieszkania z nazwy ulicy.
 *
 * KIEDY UŻYWAMY
 * ─────────────
 * Przełącznik „Dokładna lokalizacja" w aplikacji rozróżnia dwa publicznie
 * widoczne tryby:
 *  • ON  → pokazujemy ulicę razem z numerem (pełny adres),
 *  • OFF → pokazujemy SAMĄ ulicę (bez numeru) — kupujący wie, „w której
 *          ulicy" jest oferta, ale nie zna dokładnego adresu.
 *
 * Ten helper bezpiecznie odcina TYLKO ostatni segment numerowy, łącznie
 * z opcjonalną literą („5A"), separatorem „/" lub „-" i drugim numerem
 * („27/29", „23a/15"), oraz „nr/numer" prefix („nr 12", „numer 12").
 *
 * Co świadomie ZACHOWUJEMY
 * ────────────────────────
 *  • cyfry w ŚRODKU nazwy ulicy („3 Maja", „Aleja 700-lecia", „1 Sierpnia"),
 *  • cyfry rzymskie po nazwie („Jana Pawła II"),
 *  • prefiksy „ul.", „al.", „pl." w oryginalnej formie.
 */
export function stripHouseNumber(streetInput: unknown): string {
  const street = String(streetInput ?? '').trim();
  if (!street) return '';
  // 1) Najpierw zdejmujemy końcowe „nr 12", „nr 12a/3", „numer 12".
  let cleaned = street.replace(/\s+(?:nr\.?|numer)\s*\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:[\/\-]\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/iu, '');
  // 2) Następnie czysty końcowy numer typu „12", „5A", „27/29", „23a-15".
  cleaned = cleaned.replace(/\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:[\/\-]\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/u, '');
  return cleaned.trim();
}

/**
 * Buduje publiczny napis lokalizacji oferty zgodnie z trybem prywatności:
 *  - isExact === true  → "Miasto, Dzielnica • Ulica 12" (pełny adres),
 *  - isExact === false → "Miasto, Dzielnica • Ulica"   (sama nazwa ulicy
 *                                                       bez numeru — kupujący
 *                                                       wie w której ulicy
 *                                                       jest oferta, ale nie
 *                                                       zna dokładnego adresu).
 *
 * Jeśli ulicy nie znamy lub jest pusta — zwracamy `baseLabel` jak dotąd.
 */
/** Dom i działka domyślnie w trybie przybliżonym (bez numeru budynku na mapie / w adresie). */
export function defaultExactLocationForPropertyType(propertyType: unknown): boolean {
  const t = String(propertyType || '').toUpperCase();
  if (t === 'HOUSE' || t === 'PLOT') return false;
  if (t === 'APARTMENT' || t === 'FLAT' || t === 'PREMISES') return true;
  return true;
}

export function formatPublicAddress(
  cityInput: unknown,
  districtInput: unknown,
  streetInput: unknown,
  isExactInput: unknown,
  countryOrFallback = DEFAULT_LOCALITY_COUNTRY,
): string {
  const country = normalizeLocalityCountryLabel(countryOrFallback);
  const baseLabel = formatLocationLabel(cityInput, districtInput, country, country);
  const isExact = resolveIsExactLocation(isExactInput);
  const street = String(streetInput ?? '').trim();
  if (!street) return baseLabel;
  const visibleStreet = isExact ? street : stripHouseNumber(street);
  if (!visibleStreet) return baseLabel;
  return `${baseLabel} • ${visibleStreet}`;
}

/** Jedna linia na listę ofert (Profil, admin): miejscowość + kraj + opcjonalnie ulica. Bez „Reszta kraju”. */
/** Adres z wyniku reverse-geocode (Apple Maps). W USA `streetNumber` bywa puste — bierzemy też `name`. */
/** Zachowaj pełny adres użytkownika (np. „Sitaniec 454"), gdy geokoder zwraca samą nazwę wsi bez numeru. */
export function preserveVillageStreetHint(userStreet: unknown, geocodedStreet: unknown): string {
  const user = String(userStreet ?? '').trim();
  const geocoded = String(geocodedStreet ?? '').trim();
  if (!user) return geocoded;
  if (!geocoded) return user;
  const villageFromUser = extractVillageLocalityFromStreet(user);
  if (!villageFromUser || !isStandaloneVillageAddress(user, villageFromUser)) {
    return geocoded;
  }
  if (extractVillageLocalityFromStreet(geocoded)) {
    return geocoded;
  }
  const geocodedHead = geocoded.split(/\s+/)[0] || geocoded;
  if (normalizeLocationMatch(geocodedHead) === normalizeLocationMatch(villageFromUser)) {
    return user;
  }
  return geocoded;
}

export function streetLineFromGeocodedPlace(
  place: { street?: string | null; streetNumber?: string | null; name?: string | null } | null | undefined,
  fallback = '',
): string {
  const street = String(place?.street ?? '').trim();
  const num = String(place?.streetNumber ?? '').trim();
  if (street && num) return `${street} ${num}`.trim();
  if (street) return street;
  const name = String(place?.name ?? '').trim();
  if (name.length > 2) return name;
  return String(fallback || '').trim();
}

/** Przybliżony bounding box Polski — wystarcza do ukrycia KW / EKW poza krajem. */
export function isCoordinatesInPoland(lat: number, lng: number): boolean {
  return lat >= 49.0 && lat <= 54.95 && lng >= 14.05 && lng <= 24.25;
}

/** Księga wieczysta (KW) dotyczy wyłącznie nieruchomości w Polsce. */
export function isPolandLocationDraft(draft: {
  city?: unknown;
  district?: unknown;
  localityCountry?: unknown;
  localityCountryCode?: unknown;
  lat?: unknown;
  lng?: unknown;
} | null | undefined): boolean {
  if (!draft) return true;

  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !isCoordinatesInPoland(lat, lng)) {
    return false;
  }

  const explicitCode = String(draft.localityCountryCode ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(explicitCode) && explicitCode !== DEFAULT_LOCALITY_COUNTRY_CODE) {
    return false;
  }

  const countryLabel = String(draft.localityCountry ?? '').trim();
  if (countryLabel) {
    if (/^polska$/i.test(countryLabel)) {
      // jawna Polska
    } else {
      const isoFromPl = PL_COUNTRY_TO_ISO[countryLabel];
      if (isoFromPl) return isoFromPl === DEFAULT_LOCALITY_COUNTRY_CODE;
      if (/^[A-Za-z]{2}$/.test(countryLabel)) {
        return countryLabel.toUpperCase() === DEFAULT_LOCALITY_COUNTRY_CODE;
      }
      const fromEn = ENGLISH_COUNTRY_TO_PL[countryLabel.toLowerCase()];
      if (fromEn) return fromEn === DEFAULT_LOCALITY_COUNTRY;
      if (countryLabel !== DEFAULT_LOCALITY_COUNTRY) return false;
    }
  }

  const pres = getDraftLocationPresentation({
    city: String(draft.city ?? ''),
    district: String(draft.district ?? ''),
    localityCountry: countryLabel,
    localityCountryCode: explicitCode,
  });
  return pres.countryIso === DEFAULT_LOCALITY_COUNTRY_CODE;
}

/**
 * Payload `city`/`district` dla API — bez „Reszta kraju” w polu miasta,
 * żeby geowalidacja pinezki nie odrzucała Raszyna, Kiszyniowa itd.
 */
export function normalizeOfferLocationForApi(draft: {
  city?: unknown;
  district?: unknown;
  localityCountry?: unknown;
  localityCountryCode?: unknown;
}): {
  city: string;
  district: string;
  localityCountry: string;
  localityCountryCode: string;
} {
  const pres = getDraftLocationPresentation({
    city: String(draft?.city ?? ''),
    district: String(draft?.district ?? ''),
    localityCountry: String(draft?.localityCountry ?? ''),
    localityCountryCode: String(draft?.localityCountryCode ?? ''),
  });

  let city = pres.city;
  let district = pres.district;

  if (city === REST_OF_COUNTRY_CITY) {
    const locality = String(district).trim();
    if (locality && locality !== 'Ogólna') {
      city = locality;
      district = 'Inny obszar';
    }
  }

  return {
    city,
    district: district || 'Inny obszar',
    localityCountry: pres.countryLabelPl,
    localityCountryCode: pres.countryIso,
  };
}

export function isLocationStepComplete(draft: {
  lat?: unknown;
  lng?: unknown;
  city?: unknown;
  district?: unknown;
  street?: unknown;
  localityCountry?: unknown;
  localityCountryCode?: unknown;
} | null | undefined): boolean {
  if (!draft) return false;
  if (!hasValidMapCoordinates(draft.lat, draft.lng)) return false;

  const pres = getDraftLocationPresentation({
    city: String(draft.city ?? ''),
    district: String(draft.district ?? ''),
    localityCountry: String(draft.localityCountry ?? ''),
    localityCountryCode: String(draft.localityCountryCode ?? ''),
  });
  const locality = String(pres.district || '').trim();
  const hasLocality = locality.length > 0 && locality !== 'Ogólna';
  const isPoland = pres.countryIso === DEFAULT_LOCALITY_COUNTRY_CODE;
  const street = String(draft.street || '').trim();

  if (isPoland) {
    return hasLocality && street.length > 2 && /\d/.test(street);
  }
  return hasLocality || street.length >= 3;
}

export function formatOfferLocationLine(
  offer: {
    city?: unknown;
    district?: unknown;
    street?: unknown;
    localityCountry?: unknown;
    localityCountryCode?: unknown;
    isExactLocation?: unknown;
  } | null
  | undefined,
): string {
  if (!offer) return '';
  const pres = getDraftLocationPresentation({
    city: String(offer.city ?? ''),
    district: String(offer.district ?? ''),
    localityCountry: String(offer.localityCountry ?? ''),
    localityCountryCode: String(offer.localityCountryCode ?? ''),
  });
  return formatPublicAddress(
    pres.city,
    pres.district,
    offer.street,
    offer.isExactLocation,
    pres.countryLabelPl,
  );
}

export const STRICT_CITIES = [
  'Warszawa',
  'Kraków',
  'Wrocław',
  'Poznań',
  'Łódź',
  'Lublin',
  'Gdańsk',
  'Gdynia',
  'Sopot',
  'Katowice',
  'Rybnik',
  'Białystok',
  'Zamość',
  REST_OF_COUNTRY_CITY,
] as const;

/** Metropolie na filtrach wyszukiwania (bez „Reszta kraju”). */
export const METRO_STRICT_CITIES = STRICT_CITIES.filter((c) => c !== REST_OF_COUNTRY_CITY);

export const STRICT_CITY_DISTRICTS: Record<string, string[]> = {
  Warszawa: ['Bemowo', 'Białołęka', 'Bielany', 'Mokotów', 'Ochota', 'Praga-Południe', 'Praga-Północ', 'Rembertów', 'Śródmieście', 'Targówek', 'Ursus', 'Ursynów', 'Wawer', 'Wesoła', 'Wilanów', 'Włochy', 'Wola', 'Żoliborz'],
  Kraków: ['Stare Miasto', 'Grzegórzki', 'Prądnik Czerwony', 'Prądnik Biały', 'Krowodrza', 'Bronowice', 'Zwierzyniec', 'Dębniki', 'Łagiewniki-Borek Fałęcki', 'Swoszowice', 'Podgórze Duchackie', 'Bieżanów-Prokocim', 'Podgórze', 'Czyżyny', 'Mistrzejowice', 'Bieńczyce', 'Wzgórza Krzesławickie', 'Nowa Huta'],
  Wrocław: ['Stare Miasto', 'Śródmieście', 'Krzyki', 'Fabryczna', 'Psie Pole'],
  Poznań: ['Stare Miasto', 'Nowe Miasto', 'Jeżyce', 'Grunwald', 'Wilda'],
  Łódź: ['Bałuty', 'Górna', 'Polesie', 'Śródmieście', 'Widzew'],
  Lublin: ['Śródmieście', 'Czechów Północny', 'Czechów Południowy', 'Czuby Północne', 'Czuby Południowe', 'LSM', 'Rury', 'Kalinowszczyzna', 'Tatary', 'Bronowice', 'Dziesiąta', 'Wrotków', 'Sławinek', 'Sławin', 'Węglin Północny', 'Węglin Południowy', 'Ponikwoda', 'Hajdów-Zadębie', 'Za Cukrownią', 'Abramowice'],
  Gdańsk: ['Śródmieście', 'Wrzeszcz Górny', 'Wrzeszcz Dolny', 'Oliwa', 'Przymorze Małe', 'Przymorze Wielkie', 'Zaspa-Młyniec', 'Zaspa-Rozstaje', 'Jasień', 'Chełm', 'Ujeścisko-Łostowice', 'Piecki-Migowo', 'Osowa', 'Brzeźno', 'Nowy Port', 'Orunia-Św. Wojciech-Lipce', 'Stogi', 'Żabianka-Wejhera-Jelitkowo-Tysiąclecia'],
  Gdynia: ['Śródmieście', 'Orłowo', 'Redłowo', 'Wzgórze Św. Maksymiliana', 'Działki Leśne', 'Grabówek', 'Chylonia', 'Oksywie', 'Obłuże', 'Karwiny', 'Dąbrowa', 'Wielki Kack', 'Mały Kack', 'Pogórze', 'Cisowa', 'Leszczynki'],
  Sopot: ['Dolny Sopot', 'Górny Sopot', 'Kamienny Potok', 'Brodwino', 'Karlikowo', 'Przylesie', 'Sopot Wyścigi'],
  Katowice: ['Śródmieście', 'Załęże', 'Załęska Hałda-Brynów', 'Osiedle Tysiąclecia', 'Koszutka', 'Bogucice', 'Dąb', 'Ligota-Panewniki', 'Piotrowice-Ochojec', 'Giszowiec', 'Szopienice-Burowiec', 'Murcki', 'Wełnowiec-Józefowiec', 'Janów-Nikiszowiec'],
  Rybnik: ['Śródmieście', 'Boguszowice Osiedle', 'Boguszowice Stare', 'Chwałęcice', 'Chwałowice', 'Golejów', 'Gotartowice', 'Kamień', 'Kłokocin', 'Ligota-Ligocka Kuźnia', 'Meksyk', 'Niedobczyce', 'Niewiadom', 'Ochojec', 'Orzepowice', 'Paruszowiec-Piaski', 'Popielów', 'Radziejów', 'Rybnicka Kuźnia', 'Smolna', 'Stodoły', 'Wielopole', 'Zamysłów', 'Zebrzydowice'],
  Białystok: ['Centrum', 'Białostoczek', 'Bojary', 'Dziesięciny I', 'Dziesięciny II', 'Antoniuk', 'Piaski', 'Przydworcowe', 'Sienkiewicza', 'Młodych', 'Starosielce', 'Nowe Miasto', 'Wysoki Stoczek', 'Zielone Wzgórza', 'Słoneczny Stok', 'Leśna Dolina', 'Bacieczki', 'Jaroszówka', 'Dojlidy', 'Skorupy', 'Zawady'],
  Zamość: ['Stare Miasto', 'Nowe Miasto', 'Planty', 'Janowice', 'Karolówka', 'Promyk', 'Powiatowa', 'Rataja', 'Zamczysko', 'Słoneczny Stok'],
  [REST_OF_COUNTRY_CITY]: [],
};

/** Centrum miasta strict — pinezka w promieniu = miasto, poza = miejscowość (niezależnie od szumu geokodera). */
const STRICT_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Warszawa: { lat: 52.2297, lng: 21.0122 },
  Kraków: { lat: 50.0614, lng: 19.9366 },
  Wrocław: { lat: 51.1079, lng: 17.0385 },
  Poznań: { lat: 52.4064, lng: 16.9252 },
  Łódź: { lat: 51.7592, lng: 19.4560 },
  Lublin: { lat: 51.2465, lng: 22.5684 },
  Gdańsk: { lat: 54.3520, lng: 18.6466 },
  Gdynia: { lat: 54.5189, lng: 18.5305 },
  Sopot: { lat: 54.4416, lng: 18.5601 },
  Katowice: { lat: 50.2649, lng: 19.0238 },
  Rybnik: { lat: 50.0971, lng: 18.5418 },
  Białystok: { lat: 53.1325, lng: 23.1688 },
  Zamość: { lat: 50.7231, lng: 23.2519 },
};

/** Promień (km) wokół centrum — wewnątrz = miasto strict. Zamość 5.5 km wyklucza Sitiniec (~5.6 km). */
const STRICT_CITY_ENVELOPE_KM: Record<string, number> = {
  Warszawa: 22,
  Kraków: 14,
  Wrocław: 12,
  Poznań: 12,
  Łódź: 12,
  Lublin: 10,
  Gdańsk: 10,
  Gdynia: 8,
  Sopot: 4,
  Katowice: 10,
  Rybnik: 6,
  Białystok: 8,
  Zamość: 5.5,
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Czy współrzędne leżą w granicach miasta strict. */
export function isPinWithinStrictCityEnvelope(city: string, lat: number, lng: number): boolean {
  if (!isStrictCityName(city) || city === REST_OF_COUNTRY_CITY) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const center = STRICT_CITY_CENTERS[city];
  if (!center) return false;
  const maxKm = STRICT_CITY_ENVELOPE_KM[city] ?? 10;
  return haversineKm(lat, lng, center.lat, center.lng) <= maxKm;
}

/** Najbliższe miasto strict dla pinezki — null gdy poza wszystkimi obwiedniami. */
export function detectStrictCityFromCoordinates(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let bestCity: string | null = null;
  let bestKm = Infinity;
  for (const city of STRICT_CITIES) {
    if (city === REST_OF_COUNTRY_CITY) continue;
    const center = STRICT_CITY_CENTERS[city];
    if (!center) continue;
    const km = haversineKm(lat, lng, center.lat, center.lng);
    const maxKm = STRICT_CITY_ENVELOPE_KM[city] ?? 10;
    if (km <= maxKm && km < bestKm) {
      bestKm = km;
      bestCity = city;
    }
  }
  return bestCity;
}

/** Pinezka w gminie satelickiej metropolii (np. Pruszków przy Warszawie). */
export function detectSatelliteMunicipalityFromCoordinates(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { name: string; km: number } | null = null;
  for (const sat of METRO_SATELLITE_MUNICIPALITIES) {
    const km = haversineKm(lat, lng, sat.lat, sat.lng);
    if (km <= sat.radiusKm && (!best || km < best.km)) {
      best = { name: sat.name, km };
    }
  }
  return best?.name ?? null;
}

function isStrictCityDistrictName(strictCity: string, district: string): boolean {
  const norm = normalizeLocationMatch(String(district ?? '').trim());
  if (!norm) return false;
  const districts = STRICT_CITY_DISTRICTS[strictCity] || [];
  return districts.some((d) => normalizeLocationMatch(d) === norm);
}

/** Geokoder podał inną gminę niż promień satelity (np. Grodzisk ≠ Milanówek) — ufaj geokoderowi. */
function geocoderNamesDistinctMunicipality(place: GeocodedPlaceInput, satellite: string): boolean {
  const independent = extractIndependentMunicipalityFromGeocodedPlace(place);
  if (!independent) return false;
  return normalizeLocationMatch(independent) !== normalizeLocationMatch(satellite);
}

/**
 * Satelita z promienia tylko gdy geokoder błędnie przypisuje metropolię (Warszawa/Ursus zamiast Pruszków).
 * Nie nadpisuj jawnej miejscowości z reverse-geocode pinezki.
 */
function shouldUseSatelliteOverGeocoder(
  place: GeocodedPlaceInput,
  satellite: string,
  streetHint: string,
  lat: number,
  lng: number,
): boolean {
  const envelopeCity = detectStrictCityFromCoordinates(lat, lng);
  if (!envelopeCity) return false;
  if (geocoderNamesDistinctMunicipality(place, satellite)) return false;

  if (envelopeCity === 'Warszawa' && isWarsawInnerBorderSatellite(satellite)) {
    if (geocoderConfirmsStrictCity(envelopeCity, place, streetHint)) return false;
    if (detectStrictCityFromGeocodeText(String(place.subregion ?? '')) === envelopeCity) {
      return false;
    }
    const geoStrict = detectStrictCityFromGeocodeText(String(place.city ?? ''));
    if (geoStrict === envelopeCity) return false;
    const inferredDistrict = inferWarsawDistrictFromCoordinates(lat, lng);
    const satelliteDef = getMetroSatelliteDefinition(satellite);
    if (
      inferredDistrict &&
      warsawDistrictDominatesSatellite(inferredDistrict, lat, lng, satelliteDef)
    ) {
      return false;
    }
    const normDistrict = normalizeLocationMatch(String(place.district ?? ''));
    if (isStrictCityDistrictName(envelopeCity, String(place.district ?? ''))) return false;
    if (
      normalizeLocationMatch(String(place.city ?? '')) === normalizeLocationMatch(satellite) &&
      inferredDistrict &&
      satelliteDef
    ) {
      const districtKm = minDistanceToWarsawDistrictSeeds(inferredDistrict, lat, lng);
      const satelliteKm = haversineKm(lat, lng, satelliteDef.lat, satelliteDef.lng);
      return satelliteKm <= districtKm;
    }
    return false;
  }

  const geoCity = String(place.city ?? '').trim();
  const geoStrict = detectStrictCityFromGeocodeText(geoCity);
  if (
    !geoStrict &&
    geoCity &&
    normalizeLocationMatch(geoCity) === normalizeLocationMatch(satellite)
  ) {
    return false;
  }

  if (geoStrict === envelopeCity) return true;
  if (geocoderConfirmsStrictCity(envelopeCity, place, streetHint)) return true;
  const district = String(place.district ?? '').trim();
  if (district && isStrictCityDistrictName(envelopeCity, district)) return true;
  return false;
}

/** Ufaj polu city z reverse-geocode zamiast promienia satelity — tylko gdy to realna gmina, nie osiedle/ulica w mieście strict. */
function shouldTrustGeocoderMunicipalityOverCoords(
  geoMunicipality: string,
  place: GeocodedPlaceInput,
  streetHint: string,
  lat: number,
  lng: number,
  satellite: string | null,
): boolean {
  if (
    satellite &&
    normalizeLocationMatch(geoMunicipality) === normalizeLocationMatch(satellite)
  ) {
    return false;
  }

  const envelopeCity = detectStrictCityFromCoordinates(lat, lng);
  if (!envelopeCity) return true;

  if (envelopeCity === 'Warszawa') {
    const inferredDistrict = inferWarsawDistrictFromCoordinates(lat, lng);
    const satelliteDef = satellite ? getMetroSatelliteDefinition(satellite) : null;
    if (
      inferredDistrict &&
      warsawDistrictDominatesSatellite(inferredDistrict, lat, lng, satelliteDef)
    ) {
      return false;
    }
  }

  if (!isPinWithinStrictCityEnvelope(envelopeCity, lat, lng)) return true;

  const normGeo = normalizeLocationMatch(geoMunicipality);
  const normDistrict = normalizeLocationMatch(String(place.district ?? ''));
  if (normGeo === normDistrict) return false;
  if (isStrictCityDistrictName(envelopeCity, geoMunicipality)) return false;
  if (isMislabeledStreetAsCity(streetHint, place)) return false;
  if (geocoderConfirmsStrictCity(envelopeCity, place, streetHint)) return false;
  if (pinMatchesStrictCity(envelopeCity, geoMunicipality, place.district)) return false;
  if (detectStrictCityFromGeocodeText(String(place.subregion ?? '')) === envelopeCity) {
    return false;
  }
  if (detectStrictCityFromGeocodeText(String(place.region ?? '')) === envelopeCity) {
    return false;
  }
  return true;
}

/** Dopasowanie filtra miasta — tylko konkretna aglomeracja (bez „Reszta kraju”). */
export function offerMatchesCityFilter(raw: Record<string, unknown>, selectedCity: string): boolean {
  const sel = normalizeLocationMatch(String(selectedCity || '').trim());
  if (!sel) return true;
  const rawCity = normalizeLocationMatch(String(raw.city ?? '').trim());
  if (rawCity === sel) return true;
  return false;
}

/** ISO kraju oferty na liście / w filtrach — z pól API, współrzędnych lub nazwy miasta. */
export function offerListingCountryIso(raw: Record<string, unknown>): string {
  const explicitCode = String(raw.localityCountryCode ?? '').trim().toUpperCase();
  const explicitLabel = normalizeLocalityCountryLabel(String(raw.localityCountry ?? ''));

  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  if (hasCoords) {
    if (isCoordinatesInPoland(lat, lng)) return DEFAULT_LOCALITY_COUNTRY_CODE;
    const fromCoords = inferCountryIsoFromCoordinates(lat, lng);
    if (fromCoords) return fromCoords;
  }

  if (/^[A-Z]{2}$/.test(explicitCode) && explicitCode !== DEFAULT_LOCALITY_COUNTRY_CODE) {
    return explicitCode;
  }
  const labelIso = explicitLabel ? PL_COUNTRY_TO_ISO[explicitLabel] : undefined;
  if (labelIso && labelIso !== DEFAULT_LOCALITY_COUNTRY_CODE) return labelIso;
  if (explicitLabel && !/^polska$/i.test(explicitLabel)) {
    const fromEn = ENGLISH_COUNTRY_TO_PL[explicitLabel.toLowerCase()];
    if (fromEn) {
      const fromEnIso = PL_COUNTRY_TO_ISO[fromEn];
      if (fromEnIso && fromEnIso !== DEFAULT_LOCALITY_COUNTRY_CODE) return fromEnIso;
    }
  }

  const city = String(raw.city ?? '').trim();
  const fromCity = inferCountryIsoFromCityName(city);
  if (fromCity) return fromCity;

  if (/^[A-Z]{2}$/.test(explicitCode)) return explicitCode;
  if (labelIso) return labelIso;
  if (hasCoords) {
    // Współrzędne poza PL, bez rozpoznanego kraju — nie przypisuj na siłę Polski.
    return '';
  }
  return DEFAULT_LOCALITY_COUNTRY_CODE;
}

/** Polska nazwa kraju oferty (do filtra państw). */
export function offerListingCountryLabel(raw: Record<string, unknown>): string {
  const iso = offerListingCountryIso(raw);
  if (!iso) return '';
  return countryLabelPlFromIso(iso) || iso;
}

type CountryBBox = {
  iso: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

const LISTING_COUNTRY_BBOXES: CountryBBox[] = [
  { iso: 'DE', latMin: 47.2, latMax: 55.2, lngMin: 5.8, lngMax: 15.1 },
  { iso: 'CZ', latMin: 48.5, latMax: 51.1, lngMin: 12.0, lngMax: 18.9 },
  { iso: 'SK', latMin: 47.7, latMax: 49.6, lngMin: 16.8, lngMax: 22.6 },
  { iso: 'UA', latMin: 44.3, latMax: 52.4, lngMin: 22.1, lngMax: 40.2 },
  { iso: 'BY', latMin: 51.2, latMax: 56.2, lngMin: 23.0, lngMax: 32.8 },
  { iso: 'LT', latMin: 53.8, latMax: 56.5, lngMin: 20.9, lngMax: 26.9 },
  { iso: 'AT', latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 },
];

function inferCountryIsoFromCoordinates(lat: number, lng: number): string | null {
  const hits: string[] = [];
  for (const box of LISTING_COUNTRY_BBOXES) {
    if (lat >= box.latMin && lat <= box.latMax && lng >= box.lngMin && lng <= box.lngMax) {
      hits.push(box.iso);
    }
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return hits[0];
  return null;
}

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
  lviv: 'UA',
  london: 'GB',
  paris: 'FR',
  amsterdam: 'NL',
  brussels: 'BE',
  bruxelles: 'BE',
  rome: 'IT',
  roma: 'IT',
  madrid: 'ES',
  lisbon: 'PT',
  lisboa: 'PT',
  newyork: 'US',
  losangeles: 'US',
};

function inferCountryIsoFromCityName(city: string): string | null {
  const norm = normalizeLocationMatch(city);
  if (!norm) return null;
  if (detectStrictCityFromGeocodeText(city)) return DEFAULT_LOCALITY_COUNTRY_CODE;
  if (KNOWN_FOREIGN_CITY_ISO[norm]) return KNOWN_FOREIGN_CITY_ISO[norm];
  return null;
}

export type GeocodedPlaceInput = {
  city?: string | null;
  subregion?: string | null;
  name?: string | null;
  region?: string | null;
  district?: string | null;
  street?: string | null;
  isoCountryCode?: string | null;
  country?: string | null;
};

function normalizeLocationMatch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Wykrywa strict city z pojedynczego pola geokodera (nie łączy subregion + city). */
export function detectStrictCityFromGeocodeText(raw: string): string | null {
  const cityInfo = normalizeLocationMatch(raw);
  if (!cityInfo) return null;
  if (/powiat|gmina|wojewodztwo|województwo/.test(cityInfo)) return null;
  if (cityInfo.includes('warszawa') || cityInfo.includes('warsaw')) return 'Warszawa';
  if (cityInfo.includes('kraków') || cityInfo.includes('krakow') || cityInfo.includes('cracow')) return 'Kraków';
  if (cityInfo.includes('łódź') || cityInfo.includes('lodz')) return 'Łódź';
  if (cityInfo.includes('wrocław') || cityInfo.includes('wroclaw')) return 'Wrocław';
  if (cityInfo.includes('poznań') || cityInfo.includes('poznan')) return 'Poznań';
  if (cityInfo.includes('lublin')) return 'Lublin';
  if (cityInfo.includes('zamość') || cityInfo.includes('zamosc')) return 'Zamość';
  if (cityInfo.includes('gdańsk') || cityInfo.includes('gdansk')) return 'Gdańsk';
  if (cityInfo.includes('gdynia')) return 'Gdynia';
  if (cityInfo.includes('sopot')) return 'Sopot';
  if (cityInfo.includes('katowice')) return 'Katowice';
  if (cityInfo.includes('rybnik')) return 'Rybnik';
  if (cityInfo.includes('białystok') || cityInfo.includes('bialystok')) return 'Białystok';
  return null;
}

/** Strict city z pól reverse-geocode (miasto, region, dopasowanie dzielnicy). */
export function detectStrictCityFromGeocodedPlace(place: GeocodedPlaceInput): string | null {
  const fromCity = detectStrictCityFromGeocodeText(place.city || '');
  if (fromCity) return fromCity;

  const independent = extractIndependentMunicipalityFromGeocodedPlace(place);
  const metroFromRegion = detectStrictCityFromGeocodeText(
    [place.subregion, place.region].filter(Boolean).join(' '),
  );
  if (
    independent &&
    !metroFromRegion &&
    normalizeLocationMatch(independent) === normalizeLocationMatch(String(place.city ?? ''))
  ) {
    return null;
  }

  const districtToken = String(place.district ?? '').trim();
  if (districtToken) {
    const normDistrict = normalizeLocationMatch(districtToken);
    const districtMatches: string[] = [];
    for (const city of STRICT_CITIES) {
      if (city === REST_OF_COUNTRY_CITY) continue;
      const districts = STRICT_CITY_DISTRICTS[city] || [];
      if (districts.some((d) => normalizeLocationMatch(d) === normDistrict)) {
        districtMatches.push(city);
      }
    }
    if (districtMatches.length === 1) return districtMatches[0];
    if (districtMatches.length > 1) {
      const blob = normalizeLocationMatch(
        [place.city, place.subregion, place.region, place.name].filter(Boolean).join(' '),
      );
      for (const city of districtMatches) {
        if (blob.includes(normalizeLocationMatch(city))) return city;
      }
      return null;
    }
  }

  return detectStrictCityFromGeocodeText(
    [place.subregion, place.region].filter(Boolean).join(' '),
  );
}

function geocodeTokenMatchesStreet(
  token: string,
  place: GeocodedPlaceInput,
  streetHint: string,
): boolean {
  const normToken = normalizeLocationMatch(token);
  if (!normToken) return false;
  if (isVillageStyleAddress(streetHint, token) && geocoderNamesStandaloneSettlement(place, token)) {
    return false;
  }
  const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
  const hintNorm = normalizeLocationMatch(streetHint);
  const hintStreetName = normalizeLocationMatch(streetHint.split(/\s+\d/)[0] || '');
  if (streetNorm && streetNorm !== hintStreetName) {
    if (normToken === streetNorm || streetNorm.includes(normToken) || normToken.includes(streetNorm)) {
      return true;
    }
  }
  if (hintStreetName && hintStreetName.split(/\s+/).length > 1) {
    if (normToken === hintStreetName || hintStreetName.includes(normToken) || normToken.includes(hintStreetName)) {
      return true;
    }
  }
  return false;
}

/** Geokoder zwrócił prawdziwą wieś — nie ulicę, której nazwa trafiła też do pola city. */
function geocoderNamesStandaloneSettlement(
  place: GeocodedPlaceInput,
  settlementName: string,
): boolean {
  const norm = normalizeLocationMatch(settlementName);
  if (!norm) return false;
  const city = normalizeLocationMatch(String(place.city ?? ''));
  const street = normalizeLocationMatch(String(place.street ?? ''));
  const name = normalizeLocationMatch(String(place.name ?? ''));
  if (city === norm && street === norm) return false;
  if (city === norm) return true;
  if (name === norm && name !== street) return true;
  if (street === norm && city !== norm && isKnownStandaloneLocality(settlementName)) {
    return true;
  }
  return false;
}

function geocoderConfirmsStrictCity(
  strictCity: string,
  place: GeocodedPlaceInput,
  streetHint = '',
): boolean {
  if (detectStrictCityFromGeocodeText(String(place.city ?? '')) === strictCity) {
    const word = extractVillageLocalityFromStreet(streetHint);
    const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
    const villageNorm = word ? normalizeLocationMatch(word) : '';
    if (villageNorm && streetNorm === villageNorm) {
      if (isMislabeledStreetAsCity(streetHint, place)) {
        return false;
      }
      // Geokoder: city=Zamość, street=Sitaniec — znana wieś podmiejska, nie strict city.
      if (word && isKnownStandaloneLocality(word) && !pinMatchesStrictCity(strictCity, villageNorm, place.district)) {
        return false;
      }
      const pinNorm = normalizeLocationMatch(
        localityNameFromGeocodedPlace(place, { streetHint }),
      );
      if (!pinMatchesStrictCity(strictCity, pinNorm, place.district)) {
        return false;
      }
    }
    return true;
  }
  const normDistrict = normalizeLocationMatch(String(place.district ?? ''));
  const districts = STRICT_CITY_DISTRICTS[strictCity] || [];
  if (!districts.some((d) => normalizeLocationMatch(d) === normDistrict)) {
    return false;
  }
  const word = extractVillageLocalityFromStreet(streetHint);
  const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
  const villageNorm = word ? normalizeLocationMatch(word) : '';
  // Błędna dzielnica miasta przy wsi (np. Karolówka + street Sitaniec przy Sitaniu).
  if (
    villageNorm &&
    streetNorm === villageNorm &&
    !detectStrictCityFromGeocodeText(String(place.city ?? '')) &&
    !pinMatchesStrictCity(strictCity, villageNorm, place.district)
  ) {
    return false;
  }
  return true;
}

function isMislabeledStreetAsCity(streetHint: string, place: GeocodedPlaceInput): boolean {
  const streetWord = extractVillageLocalityFromStreet(streetHint);
  if (!streetWord) return false;
  const wordNorm = normalizeLocationMatch(streetWord);
  const cityNorm = normalizeLocationMatch(String(place.city ?? ''));
  const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
  return cityNorm === wordNorm && streetNorm === wordNorm;
}

/** Adres „X 5" jako wieś tylko gdy geokoder/pinezka potwierdzają miejscowość, nie ulicę w mieście strict. */
function shouldResolveAsStandaloneVillage(
  streetHint: string,
  villageFromStreet: string,
  place: GeocodedPlaceInput,
  strictCandidate: string | null,
): boolean {
  if (!villageFromStreet || !isStandaloneVillageAddress(streetHint, villageFromStreet)) {
    return false;
  }
  if (geocoderNamesStandaloneSettlement(place, villageFromStreet)) {
    return true;
  }
  const strictFromPlace = strictCandidate || detectStrictCityFromGeocodedPlace(place);
  const villageNorm = normalizeLocationMatch(villageFromStreet);
  const streetNorm = normalizeLocationMatch(String(place.street ?? ''));
  if (
    isKnownStandaloneLocality(villageFromStreet) &&
    streetNorm === villageNorm &&
    strictFromPlace &&
    !pinMatchesStrictCity(strictFromPlace, villageNorm, place.district)
  ) {
    return true;
  }
  if (strictFromPlace && geocoderConfirmsStrictCity(strictFromPlace, place, streetHint) && streetNorm === villageNorm) {
    return false;
  }
  // Geokoder często zwraca tylko miasto macierzyste + dzielnicę (np. Zamość/Karolówka)
  // bez street/name — wtedy ufamy wzorcowi adresu „Sitaniec 454" z hintu użytkownika.
  if (
    strictFromPlace &&
    geocoderConfirmsStrictCity(strictFromPlace, place, streetHint) &&
    streetNorm !== villageNorm &&
    villageNorm !== normalizeLocationMatch(strictFromPlace) &&
    !pinMatchesStrictCity(strictFromPlace, villageFromStreet, place.district)
  ) {
    return true;
  }
  if (isMislabeledStreetAsCity(streetHint, place)) {
    return false;
  }
  const pinLocality = localityNameFromGeocodedPlace(place, { streetHint });
  const pinNorm = normalizeLocationMatch(pinLocality);
  if (pinNorm === villageNorm) return true;
  if (strictFromPlace && !pinMatchesStrictCity(strictFromPlace, pinNorm, place.district)) {
    return true;
  }
  return false;
}

/** Czy pinezka faktycznie leży w mieście strict / jego dzielnicy (a nie np. Sitaniu przy Zamościu). */
export function pinMatchesStrictCity(
  strictCity: string,
  pinLocality: string,
  placeDistrict?: string | null,
): boolean {
  if (!isStrictCityName(strictCity)) return false;
  const districts = STRICT_CITY_DISTRICTS[strictCity] || [];
  const normPin = normalizeLocationMatch(pinLocality);
  const normCity = normalizeLocationMatch(strictCity);
  const normDistrict = normalizeLocationMatch(String(placeDistrict ?? ''));

  // Inna miejscowość niż miasto i jego dzielnice (np. Sitaniec przy Zamościu).
  if (normPin && normPin !== 'ogolna' && normPin !== normCity) {
    const pinIsDistrict = districts.some((d) => normalizeLocationMatch(d) === normPin);
    if (!pinIsDistrict) return false;
  }

  if (normDistrict === normCity) {
    return normPin === normCity || normPin === 'ogolna' || districts.some((d) => normalizeLocationMatch(d) === normPin);
  }
  if (normDistrict && districts.some((d) => normalizeLocationMatch(d) === normDistrict)) {
    if (normPin && normPin !== 'ogolna' && normPin !== normCity && !districts.some((d) => normalizeLocationMatch(d) === normPin)) {
      return false;
    }
    return true;
  }
  if (!normPin || normPin === 'ogolna') return false;
  if (normPin === normCity) return true;
  return districts.some((d) => normalizeLocationMatch(d) === normPin);
}

export type PinLocationResolution =
  | { mode: 'strict'; strictCity: string }
  | {
      mode: 'locality';
      city: string;
      district: string;
      localityCountry: string;
      localityCountryCode: string;
    };

/** Osobna gmina/miejscowość z geokodera — nie miasto strict ani jego dzielnica. */
export function extractIndependentMunicipalityFromGeocodedPlace(place: GeocodedPlaceInput): string | null {
  for (const raw of [place.city, place.subregion]) {
    const token = String(raw ?? '').trim();
    if (!token) continue;
    if (/powiat|gmina|województwo|wojewodztwo/i.test(token)) continue;
    if (/^(ul\.?|al\.?|pl\.?|os\.?|ulica|aleja|plac|osiedle)\s/i.test(token)) continue;
    if (detectStrictCityFromGeocodeText(token)) continue;
    const street = String(place.street ?? '').trim();
    if (street && normalizeLocationMatch(token) === normalizeLocationMatch(street)) continue;
    const norm = normalizeLocationMatch(token);
    let isDistrict = false;
    for (const city of STRICT_CITIES) {
      if (city === REST_OF_COUNTRY_CITY) continue;
      const districts = STRICT_CITY_DISTRICTS[city] || [];
      if (districts.some((d) => normalizeLocationMatch(d) === norm)) {
        isDistrict = true;
        break;
      }
    }
    if (isDistrict) continue;
    return token;
  }
  return null;
}

function coordStrictCityConfirmedByGeocoder(
  strictCity: string,
  place: GeocodedPlaceInput,
  streetHint: string,
  lat: number,
  lng: number,
): boolean {
  const satellite = detectSatelliteMunicipalityFromCoordinates(lat, lng);
  if (
    satellite &&
    isOuterMetroSatellite(satellite) &&
    shouldUseSatelliteOverGeocoder(place, satellite, streetHint, lat, lng)
  ) {
    return false;
  }

  if (strictCity === 'Warszawa') {
    const inferredDistrict = inferWarsawDistrictFromCoordinates(lat, lng);
    const satelliteDef = satellite ? getMetroSatelliteDefinition(satellite) : null;
    if (
      inferredDistrict &&
      warsawDistrictDominatesSatellite(inferredDistrict, lat, lng, satelliteDef)
    ) {
      return true;
    }
  }

  const geocodeStrict = detectStrictCityFromGeocodeText(String(place.city ?? ''));
  if (geocodeStrict === strictCity) return true;

  const regionStrict = detectStrictCityFromGeocodeText(
    [place.subregion, place.region].filter(Boolean).join(' '),
  );
  if (regionStrict === strictCity && isPinWithinStrictCityEnvelope(strictCity, lat, lng)) {
    const cityOnlyIndependent = extractIndependentMunicipalityFromGeocodedPlace({ city: place.city });
    if (cityOnlyIndependent) {
      const norm = normalizeLocationMatch(cityOnlyIndependent);
      const isSatellite = METRO_SATELLITE_MUNICIPALITIES.some(
        (s) => normalizeLocationMatch(s.name) === norm,
      );
      if (isSatellite || isKnownStandaloneLocality(cityOnlyIndependent)) {
        return false;
      }
    }
    return true;
  }

  const pinLocality = localityNameFromGeocodedPlace(place, { streetHint, lat, lng });
  if (pinMatchesStrictCity(strictCity, pinLocality, place.district)) return true;
  return geocoderConfirmsStrictCity(strictCity, place, streetHint);
}

function resolveLocalityOutsideStrictEnvelope(
  place: GeocodedPlaceInput,
  streetHint: string,
  lat: number,
  lng: number,
  envelopeCity: string,
  countryFields: { localityCountry: string; localityCountryCode: string },
): PinLocationResolution | null {
  const satellite = detectSatelliteMunicipalityFromCoordinates(lat, lng);
  if (satellite && shouldUseSatelliteOverGeocoder(place, satellite, streetHint, lat, lng)) {
    return {
      mode: 'locality',
      city: REST_OF_COUNTRY_CITY,
      district: satellite,
      ...countryFields,
    };
  }

  const independent = extractIndependentMunicipalityFromGeocodedPlace(place);
  if (independent && !pinMatchesStrictCity(envelopeCity, independent, place.district)) {
    const normIndep = normalizeLocationMatch(independent);
    const normDistrict = normalizeLocationMatch(String(place.district ?? ''));
    // Osiedle w granicach miasta strict (np. Altanowa w Zamościu) — nie traktuj jako osobna gmina.
    if (normIndep === normDistrict && isPinWithinStrictCityEnvelope(envelopeCity, lat, lng)) {
      return null;
    }
    return {
      mode: 'locality',
      city: REST_OF_COUNTRY_CITY,
      district: independent,
      ...countryFields,
    };
  }

  const pinLocality = localityNameFromGeocodedPlace(place, { streetHint, lat, lng });
  if (
    pinLocality &&
    pinLocality !== 'Ogólna' &&
    !pinMatchesStrictCity(envelopeCity, pinLocality, place.district)
  ) {
    return {
      mode: 'locality',
      city: REST_OF_COUNTRY_CITY,
      district: pinLocality,
      ...countryFields,
    };
  }

  return null;
}

/**
 * Lokalizacja z reverse-geocode pinezki.
 * Wieś podmiejska (np. Sitaniec przy Zamościu) → Reszta kraju + miejscowość, nie dzielnica miasta.
 */
export function resolvePinLocationFromGeocodedPlace(
  place: GeocodedPlaceInput,
  options?: {
    streetHint?: string | null;
    lat?: number | null;
    lng?: number | null;
    /** Gdy user już wybrał miasto strict — trzymaj je, dopóki pinezka jest w jego obwiedni. */
    anchorStrictCity?: string | null;
  },
): PinLocationResolution {
  const countryFields = countryFieldsFromGeocodedPlace(place);
  const streetHint = String(options?.streetHint ?? place.street ?? '').trim();
  const lat = Number(options?.lat);
  const lng = Number(options?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const anchorStrictCity = String(options?.anchorStrictCity ?? '').trim();
  const strictFromCity = detectStrictCityFromGeocodeText(place.city || '');
  const strictFromPlace = detectStrictCityFromGeocodedPlace(place);
  const strictCandidate = strictFromCity || strictFromPlace;
  const villageFromStreet = extractVillageLocalityFromStreet(streetHint, strictCandidate);

  // Pinezka w granicach miasta strict — tylko gdy geokoder / miejscowość to potwierdzają.
  if (hasCoords) {
    const satellite = detectSatelliteMunicipalityFromCoordinates(lat, lng);
    const warsawStrict = tryResolveWarsawStrictFromPin(lat, lng, place, streetHint, satellite);
    if (warsawStrict) return warsawStrict;

    const geoMunicipality = extractIndependentMunicipalityFromGeocodedPlace(place);
    if (
      geoMunicipality &&
      shouldTrustGeocoderMunicipalityOverCoords(
        geoMunicipality,
        place,
        streetHint,
        lat,
        lng,
        satellite,
      )
    ) {
      return {
        mode: 'locality',
        city: REST_OF_COUNTRY_CITY,
        district: geoMunicipality,
        ...countryFields,
      };
    }

    if (satellite && shouldUseSatelliteOverGeocoder(place, satellite, streetHint, lat, lng)) {
      return {
        mode: 'locality',
        city: REST_OF_COUNTRY_CITY,
        district: satellite,
        ...countryFields,
      };
    }

    const envelopeCity =
      anchorStrictCity && isPinWithinStrictCityEnvelope(anchorStrictCity, lat, lng)
        ? anchorStrictCity
        : detectStrictCityFromCoordinates(lat, lng);
    if (envelopeCity) {
      if (coordStrictCityConfirmedByGeocoder(envelopeCity, place, streetHint, lat, lng)) {
        return { mode: 'strict', strictCity: envelopeCity };
      }
      const outside = resolveLocalityOutsideStrictEnvelope(
        place,
        streetHint,
        lat,
        lng,
        envelopeCity,
        countryFields,
      );
      if (outside) return outside;
      if (isPinWithinStrictCityEnvelope(envelopeCity, lat, lng)) {
        return { mode: 'strict', strictCity: envelopeCity };
      }
    }
  }

  if (
    villageFromStreet &&
    shouldResolveAsStandaloneVillage(streetHint, villageFromStreet, place, strictCandidate)
  ) {
    return {
      mode: 'locality',
      city: REST_OF_COUNTRY_CITY,
      district: villageFromStreet,
      ...countryFields,
    };
  }

  if (isMislabeledStreetAsCity(streetHint, place) && strictFromPlace) {
    return { mode: 'strict', strictCity: strictFromPlace };
  }

  const pinLocality = localityNameFromGeocodedPlace(place, { streetHint, lat, lng });

  if (strictFromCity && pinMatchesStrictCity(strictFromCity, pinLocality, place.district)) {
    return { mode: 'strict', strictCity: strictFromCity };
  }

  if (strictFromPlace && pinMatchesStrictCity(strictFromPlace, pinLocality, place.district)) {
    return { mode: 'strict', strictCity: strictFromPlace };
  }

  if (strictFromPlace && geocodeTokenMatchesStreet(pinLocality, place, streetHint)) {
    return { mode: 'strict', strictCity: strictFromPlace };
  }

  if (strictFromCity && geocodeTokenMatchesStreet(pinLocality, place, streetHint)) {
    return { mode: 'strict', strictCity: strictFromCity };
  }

  if (strictFromCity && pinMatchesStrictCity(strictFromCity, pinLocality, place.district)) {
    return { mode: 'strict', strictCity: strictFromCity };
  }

  const locality =
    pinLocality && pinLocality !== 'Ogólna' && !geocodeTokenMatchesStreet(pinLocality, place, streetHint)
      ? pinLocality
      : 'Ogólna';
  return {
    mode: 'locality',
    city: REST_OF_COUNTRY_CITY,
    district: locality,
    ...countryFields,
  };
}

const cityKeys = Object.keys(STRICT_CITY_DISTRICTS);
const missingInDistrictMap = STRICT_CITIES.filter((city) => !cityKeys.includes(city));
const extraInDistrictMap = cityKeys.filter((city) => !STRICT_CITIES.includes(city as any));
if (missingInDistrictMap.length > 0 || extraInDistrictMap.length > 0) {
  throw new Error(
    `[locationEcosystem] Niespójne miasta/dzielnice. Braki: ${missingInDistrictMap.join(', ') || '-'}; Nadmiarowe: ${extraInDistrictMap.join(', ') || '-'}`
  );
}

Object.freeze(STRICT_CITIES);
cityKeys.forEach((city) => Object.freeze(STRICT_CITY_DISTRICTS[city]));
Object.freeze(STRICT_CITY_DISTRICTS);
