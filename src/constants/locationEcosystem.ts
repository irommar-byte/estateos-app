/** Oferty spoza listy głównych aglomeracji — miejscowość trzymamy w `district` (np. „Przemyśl”). */
export const REST_OF_COUNTRY_CITY = 'Reszta kraju' as const;

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
};

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
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  const label = String(labelPl || '').trim();
  return PL_COUNTRY_TO_ISO[label] || DEFAULT_LOCALITY_COUNTRY_CODE;
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
    if (/^[A-Za-z]{2}$/i.test(district)) {
      countryIso = district.toUpperCase();
      countryLabelPl = countryLabelPlFromIso(countryIso) || countryLabelPl;
    }
    district = city;
    city = REST_OF_COUNTRY_CITY;
  } else if (city === REST_OF_COUNTRY_CITY && /^[A-Za-z]{2}$/i.test(district)) {
    const isoFromDistrict = district.toUpperCase();
    const codeFromDraft = String(draft.localityCountryCode ?? '').trim().toUpperCase();
    countryIso = /^[A-Z]{2}$/.test(codeFromDraft) ? codeFromDraft : isoFromDistrict;
    countryLabelPl =
      countryLabelPlFromIso(countryIso) || normalizeLocalityCountryLabel(draft.localityCountry) || countryLabelPl;
    // Kod kraju (np. „US”) trafił do district — nie zamieniaj miejscowości na „Ogólna”.
    district = '';
  }

  if (city === REST_OF_COUNTRY_CITY && !String(district).trim()) {
    district = 'Ogólna';
  }

  const locationText = formatLocationLabel(city, district, DEFAULT_LOCALITY_COUNTRY, countryLabelPl);
  return { city, district, countryLabelPl, countryIso, locationText };
}

/** Patch do `updateDraft`, gdy lokalizacja w szkicu jest w starym / błędnym kształcie. */
export function getLocationDraftRepairPatch(draft: {
  city?: string;
  district?: string;
  localityCountry?: string;
  localityCountryCode?: string;
}): {
  city: string;
  district: string;
  localityCountry: string;
  localityCountryCode: string;
} | null {
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
    if (allowed.length > 0 && !allowed.includes(district)) {
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

export function formatLocationLabel(
  cityInput: unknown,
  districtInput: unknown,
  fallback = 'Polska',
  countryLabel?: unknown,
): string {
  const city = String(cityInput ?? '').trim();
  const district = String(districtInput ?? '').trim();
  const country = normalizeLocalityCountryLabel(countryLabel);
  if (city === REST_OF_COUNTRY_CITY) {
    const locality = district;
    if (locality && country) return `${locality}, ${country}`;
    return locality || country || fallback;
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
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

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
  return hasLocality && (street.length > 2 || hasLocality);
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
