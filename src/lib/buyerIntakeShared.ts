import {
  canonicalizeCity,
  getDistrictsForCity,
  getStrictCities,
  inferCityFromMapboxFeature,
  isStrictCity,
  normalizeText,
  validateCityDistrict,
} from '@/lib/location/locationCatalog';
import { normalizePhoneE164 } from '@/lib/phoneE164';

export const BUYER_MISSION_COOKIE = 'eos_buyer_mission';
export const BUYER_MISSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
export const BUYER_INTAKE_TOTAL_STEPS = 6;
/** Kroki 1–4: formularz na /szukam; 5–6: panel klienta z propozycjami. */
export const BUYER_INTAKE_FORM_STEPS = 4;

export function buyerIntakeProgressPercent(uiStep: 1 | 2 | 3 | 4, intakeComplete: boolean): string {
  if (intakeComplete) return '100%';
  return `${((uiStep / BUYER_INTAKE_TOTAL_STEPS) * 100).toFixed(3)}%`;
}

export function buyerIntakeStepCaption(uiStep: 1 | 2 | 3 | 4, intakeComplete: boolean): string {
  if (intakeComplete) return 'Gotowe — otwórz panel';
  if (uiStep === BUYER_INTAKE_FORM_STEPS) return `Krok ${uiStep} z ${BUYER_INTAKE_TOTAL_STEPS} · ostatni przed panelem`;
  return `Krok ${uiStep} z ${BUYER_INTAKE_TOTAL_STEPS}`;
}

export type BuyerPropertyType = 'apartment' | 'house' | 'plot' | 'commercial';
export type BuyerMarketType = 'primary' | 'secondary' | 'both';
export type BuyerTransactionType = 'SELL' | 'RENT';
export type BuyerPurchaseTimeline = 'asap' | '1-3m' | '3-6m' | 'flexible';
export type BuyerMustHaveKey =
  | 'requireBalcony'
  | 'requireGarden'
  | 'requireElevator'
  | 'requireParking'
  | 'requireFurnished'
  | 'requireTwoLevel';

export function buyerIntakeFreeServiceLine(transactionType: BuyerTransactionType | null | undefined): string {
  if (transactionType === 'RENT') {
    return 'Usługa dla szukających najmu jest bezpłatna — wynagrodzenie agenta po stronie wynajmującego.';
  }
  return 'Usługa dla kupujących jest bezpłatna — wynagrodzenie agenta po stronie sprzedającego.';
}

export type BuyerMissionRecord = {
  typ: 'buyer_mission';
  v: 2;
  agentUserId: number;
  propertyType: BuyerPropertyType | null;
  step: number;
  city: string | null;
  districts: string[];
  budgetMax: number | null;
  minArea: number | null;
  maxArea: number | null;
  rooms: number[];
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  requireTwoLevel: boolean;
  marketType: BuyerMarketType | null;
  transactionType: BuyerTransactionType | null;
  purchaseTimeline: BuyerPurchaseTimeline | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clientId: number | null;
  consentContact: boolean;
};

export const BUYER_PROPERTY_OPTIONS: Array<{
  id: BuyerPropertyType;
  label: string;
  emoji: string;
  hint: string;
}> = [
  { id: 'apartment', label: 'Mieszkanie', emoji: '🏠', hint: 'Kawalerka – 5 pokoi' },
  { id: 'house', label: 'Dom', emoji: '🏡', hint: 'Segment, bliźniak' },
  { id: 'plot', label: 'Działka', emoji: '🌳', hint: 'Budowlana, rekreacyjna' },
  { id: 'commercial', label: 'Lokal', emoji: '🏢', hint: 'Biuro, usługi' },
];

export const BUYER_CITY_OPTIONS = [
  'Warszawa',
  'Kraków',
  'Gdańsk',
  'Wrocław',
  'Poznań',
  'Łódź',
  'Katowice',
  'Lublin',
] as const;

/** Popularne miasta spoza szybkich chipów — lokalne sugestie bez czekania na Mapbox. */
export const BUYER_EXTRA_CITY_OPTIONS = [
  'Tarnów',
  'Rzeszów',
  'Szczecin',
  'Bydgoszcz',
  'Białystok',
  'Gdynia',
  'Sopot',
  'Toruń',
  'Kielce',
  'Radom',
  'Piaseczno',
  'Otwock',
  'Pruszków',
  'Legnica',
  'Opole',
  'Płock',
  'Gliwice',
  'Zabrze',
  'Częstochowa',
  'Sosnowiec',
  'Tychy',
  'Nowy Sącz',
  'Jelenia Góra',
  'Koszalin',
  'Kalisz',
  'Konin',
  'Słupsk',
  'Elbląg',
  'Wałbrzych',
  'Włocławek',
] as const;

export const BUYER_BUDGET_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'do 500 tys.', value: 500_000 },
  { label: 'do 800 tys.', value: 800_000 },
  { label: 'do 1,2 mln', value: 1_200_000 },
  { label: 'do 2 mln', value: 2_000_000 },
  { label: '2 mln+', value: 3_000_000 },
];

export const BUYER_BUDGET_RENT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'do 2,5 tys.', value: 2_500 },
  { label: 'do 3,5 tys.', value: 3_500 },
  { label: 'do 5 tys.', value: 5_000 },
  { label: 'do 7 tys.', value: 7_000 },
  { label: '7 tys.+', value: 10_000 },
];

export function getBuyerBudgetOptions(
  transactionType: BuyerTransactionType | null | undefined,
  propertyType: BuyerPropertyType | null | undefined = 'apartment',
): Array<{ label: string; value: number }> {
  const tx = transactionType === 'RENT' ? 'RENT' : 'SELL';
  const type = propertyType ?? 'apartment';
  return BUYER_BUDGET_MATRIX[type][tx];
}

export function isBuyerBudgetValueForTransaction(
  value: number | null | undefined,
  transactionType: BuyerTransactionType | null | undefined,
  propertyType: BuyerPropertyType | null | undefined = 'apartment',
): boolean {
  if (value == null) return false;
  return getBuyerBudgetOptions(transactionType, propertyType).some((option) => option.value === value);
}

const BUYER_BUDGET_MATRIX: Record<
  BuyerPropertyType,
  Record<'SELL' | 'RENT', Array<{ label: string; value: number }>>
> = {
  apartment: {
    SELL: BUYER_BUDGET_OPTIONS,
    RENT: BUYER_BUDGET_RENT_OPTIONS,
  },
  house: {
    SELL: [
      { label: 'do 800 tys.', value: 800_000 },
      { label: 'do 1,2 mln', value: 1_200_000 },
      { label: 'do 2 mln', value: 2_000_000 },
      { label: 'do 3 mln', value: 3_000_000 },
      { label: '3 mln+', value: 4_500_000 },
    ],
    RENT: [
      { label: 'do 4 tys.', value: 4_000 },
      { label: 'do 6 tys.', value: 6_000 },
      { label: 'do 8 tys.', value: 8_000 },
      { label: 'do 12 tys.', value: 12_000 },
      { label: '12 tys.+', value: 18_000 },
    ],
  },
  plot: {
    SELL: [
      { label: 'do 150 tys.', value: 150_000 },
      { label: 'do 300 tys.', value: 300_000 },
      { label: 'do 500 tys.', value: 500_000 },
      { label: 'do 800 tys.', value: 800_000 },
      { label: '800 tys.+', value: 1_200_000 },
    ],
    RENT: [
      { label: 'do 500 zł', value: 500 },
      { label: 'do 1 tys.', value: 1_000 },
      { label: 'do 2 tys.', value: 2_000 },
      { label: 'do 4 tys.', value: 4_000 },
      { label: '4 tys.+', value: 8_000 },
    ],
  },
  commercial: {
    SELL: [
      { label: 'do 300 tys.', value: 300_000 },
      { label: 'do 600 tys.', value: 600_000 },
      { label: 'do 1 mln', value: 1_000_000 },
      { label: 'do 2 mln', value: 2_000_000 },
      { label: '2 mln+', value: 3_000_000 },
    ],
    RENT: [
      { label: 'do 3 tys.', value: 3_000 },
      { label: 'do 6 tys.', value: 6_000 },
      { label: 'do 12 tys.', value: 12_000 },
      { label: 'do 20 tys.', value: 20_000 },
      { label: '20 tys.+', value: 35_000 },
    ],
  },
};

export const BUYER_AREA_MIN_OPTIONS = [20, 30, 40, 50, 70, 100] as const;
export const BUYER_AREA_MAX_OPTIONS = [40, 50, 60, 70, 90, 120] as const;
/** @deprecated użyj getBuyerAreaMinOptions(propertyType) */
export const BUYER_AREA_OPTIONS = BUYER_AREA_MIN_OPTIONS;

const BUYER_AREA_BY_TYPE: Record<
  BuyerPropertyType,
  { min: readonly number[]; max: readonly number[]; heading: string; hint: string }
> = {
  apartment: {
    min: [20, 30, 40, 50, 70, 100],
    max: [40, 50, 60, 70, 90, 120],
    heading: 'Metraż',
    hint: 'Opcjonalnie — np. od 40 do 50 m²',
  },
  house: {
    min: [70, 90, 110, 130, 160, 200],
    max: [100, 130, 160, 200, 250, 300],
    heading: 'Metraż domu',
    hint: 'Opcjonalnie — np. od 90 do 130 m²',
  },
  commercial: {
    min: [20, 40, 60, 100, 150, 250],
    max: [50, 100, 150, 250, 400, 600],
    heading: 'Powierzchnia lokalu',
    hint: 'Opcjonalnie — np. od 50 do 150 m²',
  },
  plot: {
    min: [300, 500, 700, 1000, 1500, 2000],
    max: [500, 1000, 1500, 2000, 3000, 5000],
    heading: 'Powierzchnia działki',
    hint: 'Opcjonalnie — np. od 500 do 1000 m²',
  },
};

export function getBuyerAreaMinOptions(propertyType: BuyerPropertyType | null | undefined): readonly number[] {
  if (!propertyType) return BUYER_AREA_BY_TYPE.apartment.min;
  return BUYER_AREA_BY_TYPE[propertyType].min;
}

export function getBuyerAreaMaxOptions(propertyType: BuyerPropertyType | null | undefined): readonly number[] {
  if (!propertyType) return BUYER_AREA_BY_TYPE.apartment.max;
  return BUYER_AREA_BY_TYPE[propertyType].max;
}

export function getBuyerAreaHeading(propertyType: BuyerPropertyType | null | undefined): string {
  if (!propertyType) return BUYER_AREA_BY_TYPE.apartment.heading;
  return BUYER_AREA_BY_TYPE[propertyType].heading;
}

export function getBuyerAreaHint(propertyType: BuyerPropertyType | null | undefined): string {
  if (!propertyType) return BUYER_AREA_BY_TYPE.apartment.hint;
  return BUYER_AREA_BY_TYPE[propertyType].hint;
}

export function isBuyerAreaValueForPropertyType(
  value: number | null | undefined,
  propertyType: BuyerPropertyType | null | undefined,
  kind: 'min' | 'max',
): boolean {
  if (value == null) return false;
  const options = kind === 'min' ? getBuyerAreaMinOptions(propertyType) : getBuyerAreaMaxOptions(propertyType);
  return options.includes(value);
}

export function sanitizeBuyerAreaForPropertyType(
  propertyType: BuyerPropertyType | null | undefined,
  minArea: number | null | undefined,
  maxArea: number | null | undefined,
): { minArea: number | null; maxArea: number | null } {
  const min = isBuyerAreaValueForPropertyType(minArea, propertyType, 'min') ? minArea! : null;
  let max = isBuyerAreaValueForPropertyType(maxArea, propertyType, 'max') ? maxArea! : null;
  if (min != null && max != null && max < min) max = null;
  return { minArea: min, maxArea: max };
}

export function normalizeBuyerArea(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function normalizeBuyerAreaRange(input: {
  minArea?: unknown;
  maxArea?: unknown;
}): { minArea: number | null; maxArea: number | null; error?: string } {
  const minArea = input.minArea == null ? null : normalizeBuyerArea(input.minArea);
  const maxArea = input.maxArea == null ? null : normalizeBuyerArea(input.maxArea);
  if (minArea != null && maxArea != null && maxArea < minArea) {
    return {
      minArea,
      maxArea,
      error: 'Metraż „do” nie może być mniejszy niż „od”.',
    };
  }
  return { minArea, maxArea };
}

export function formatBuyerArea(
  minArea: number | null | undefined,
  maxArea?: number | null | undefined,
): string | null {
  const min = normalizeBuyerArea(minArea);
  const max = normalizeBuyerArea(maxArea);
  if (min != null && max != null) {
    if (min === max) return `${min} m²`;
    return `${min}–${max} m²`;
  }
  if (min != null) return `od ${min} m²`;
  if (max != null) return `do ${max} m²`;
  return null;
}

export const BUYER_ROOM_OPTIONS = [1, 2, 3, 4, 5] as const;

const BUYER_KNOWN_CITY_SET = new Set<string>(BUYER_CITY_OPTIONS);

export type BuyerLocationValidation =
  | { ok: true; city: string; districts: string[] }
  | { ok: false; error: string };

function sanitizeBuyerLocationText(raw: string): string {
  return String(raw || '').trim().slice(0, 128);
}

function vowelRatio(text: string): number {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters.length) return 0;
  const vowels = letters.replace(/[^aeiouyąćęłńóśźż]/giu, '').length;
  return vowels / letters.length;
}

function looksLikeUnknownPlaceName(text: string): boolean {
  const trimmed = sanitizeBuyerLocationText(text);
  if (trimmed.length < 3) return false;
  if (!/^[\p{L}\s.'-]+$/u.test(trimmed)) return false;
  return vowelRatio(trimmed) >= 0.28;
}

export function validateBuyerStep2Location(input: {
  city: string;
  districts?: string[];
  customDistrict?: string;
}): BuyerLocationValidation {
  const rawCity = sanitizeBuyerLocationText(input.city);
  if (!rawCity) {
    return { ok: false, error: 'Podaj miasto.' };
  }

  const canonicalCity = canonicalizeCity(rawCity);
  const city = canonicalCity || rawCity;

  const cityKnown =
    BUYER_KNOWN_CITY_SET.has(city as (typeof BUYER_CITY_OPTIONS)[number]) ||
    isStrictCity(city) ||
    Boolean(canonicalCity && canonicalCity !== rawCity);

  if (!cityKnown && !looksLikeUnknownPlaceName(city)) {
    return {
      ok: false,
      error: 'Nie rozpoznajemy tego miasta — wybierz z listy lub wpisz prawdziwą nazwę.',
    };
  }

  const mergedDistricts = normalizeBuyerDistricts([
    ...(input.districts ?? []),
    ...String(input.customDistrict || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ]);

  if (!mergedDistricts.length) {
    return { ok: true, city, districts: [] };
  }

  if (isStrictCity(city)) {
    const validated: string[] = [];
    for (const district of mergedDistricts) {
      const result = validateCityDistrict(city, district);
      if (!result.valid) {
        return {
          ok: false,
          error: result.message || `Wybierz dzielnicę z listy dla miasta ${city}.`,
        };
      }
      if (result.district && !validated.includes(result.district)) {
        validated.push(result.district);
      }
    }
    return { ok: true, city, districts: validated };
  }

  for (const district of mergedDistricts) {
    if (district.length < 2) {
      return { ok: false, error: 'Dzielnica — minimum 2 znaki.' };
    }
    if (!/^[\p{L}\s.'-]+$/u.test(district)) {
      return { ok: false, error: 'Usuń cyfry i symbole z nazwy dzielnicy.' };
    }
    if (!looksLikeUnknownPlaceName(district) && district.length >= 4) {
      return { ok: false, error: 'Sprawdź nazwę dzielnicy — wybierz z listy lub popraw.' };
    }
  }

  return { ok: true, city, districts: mergedDistricts };
}

/** Popularne dzielnice na szybki wybór (reszta po „Pokaż więcej”). */
export const BUYER_DISTRICT_QUICK: Partial<Record<(typeof BUYER_CITY_OPTIONS)[number], string[]>> = {
  Warszawa: ['Mokotów', 'Żoliborz', 'Ursynów', 'Wola', 'Praga-Południe', 'Śródmieście', 'Wilanów', 'Bielany'],
  Kraków: ['Krowodrza', 'Podgórze', 'Nowa Huta', 'Stare Miasto', 'Dębniki', 'Bronowice', 'Czyżyny'],
  Gdańsk: ['Wrzeszcz Górny', 'Oliwa', 'Przymorze Wielkie', 'Śródmieście', 'Zaspa-Rozstaje', 'Jasień'],
  Wrocław: ['Krzyki', 'Fabryczna', 'Stare Miasto', 'Psie Pole'],
  Poznań: ['Jeżyce', 'Grunwald', 'Stare Miasto', 'Wilda'],
  Łódź: ['Śródmieście', 'Bałuty', 'Górna', 'Polesie'],
  Katowice: ['Bogucice', 'Ligota-Panewniki', 'Szopienice-Burowiec', 'Śródmieście'],
  Lublin: ['Centrum', 'Czuby Południowe', 'Sławin', 'Dziesięciny I'],
};

export const BUYER_SUGGEST_MIN_CHARS = 3;

function scoreBuyerLocationMatch(label: string, query: string): number {
  const normalized = normalizeText(label);
  if (normalized.startsWith(query)) return 3;
  if (normalized.split(/\s+/).some((part) => part.startsWith(query))) return 2;
  if (normalized.includes(query)) return 1;
  return 0;
}

export function buildBuyerCitySuggestionPool(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const city of [...BUYER_CITY_OPTIONS, ...BUYER_EXTRA_CITY_OPTIONS, ...getStrictCities()]) {
    const key = normalizeText(city);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
  }
  return out;
}

export function buildBuyerCityGeocodeQuery(raw: string): string {
  const query = String(raw || '').trim();
  if (!query) return query;
  if (/[,]/.test(query) || /\b(polska|poland)\b/i.test(query)) return query;
  return `${query}, Polska`;
}

export function extractBuyerCitySuggestionsFromMapboxFeatures(
  features: unknown[],
  query: string,
  limit = 8,
): string[] {
  const q = normalizeText(String(query || '').trim());
  if (q.length < BUYER_SUGGEST_MIN_CHARS) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const feature of features) {
    const city = inferCityFromMapboxFeature(
      feature as Parameters<typeof inferCityFromMapboxFeature>[0],
    );
    if (!city || scoreBuyerLocationMatch(city, q) <= 0) continue;
    const key = normalizeText(city);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
    if (out.length >= limit) break;
  }
  return out;
}

export function mergeBuyerCitySuggestions(
  local: string[],
  remote: string[],
  limit = 8,
): string[] {
  const merged = [...local];
  const seen = new Set(merged.map((city) => normalizeText(city)));
  for (const city of remote) {
    const key = normalizeText(city);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(city);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function searchBuyerCitySuggestions(query: string, limit = 6): string[] {
  const q = normalizeText(String(query || '').trim());
  if (q.length < BUYER_SUGGEST_MIN_CHARS) return [];

  return buildBuyerCitySuggestionPool()
    .map((city) => ({ city, score: scoreBuyerLocationMatch(city, q) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.city.localeCompare(b.city, 'pl', { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map((entry) => entry.city);
}

export function searchBuyerDistrictSuggestions(city: string, query: string, limit = 8): string[] {
  const q = normalizeText(String(query || '').trim());
  if (q.length < BUYER_SUGGEST_MIN_CHARS) return [];

  return getDistrictsForCity(city)
    .map((district) => ({ district, score: scoreBuyerLocationMatch(district, q) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.district.localeCompare(b.district, 'pl', { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map((entry) => entry.district);
}

export function normalizeBuyerRooms(value: unknown): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => Number(item)).filter((n) => Number.isFinite(n) && n > 0))]
      .sort((a, b) => a - b)
      .slice(0, 6);
  }
  const single = Number(value);
  if (Number.isFinite(single) && single > 0) return [Math.round(single)];
  return [];
}

export function normalizeBuyerDistricts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 12);
}

export function formatBuyerRooms(rooms: number[] | null | undefined): string | null {
  const list = normalizeBuyerRooms(rooms ?? []);
  if (!list.length) return null;
  const labels = list.map((n) => (n >= 5 ? '5+' : String(n)));
  if (list.length === 1) return `${labels[0]} pok.`;

  const consecutive =
    list.length > 1 && list.every((n, i) => i === 0 || n === list[i - 1] + 1);
  if (consecutive) {
    const min = labels[0];
    const max = labels[labels.length - 1];
    return min === max ? `${min} pok.` : `${min}–${max} pok.`;
  }
  return `${labels.join(' lub ')} pok.`;
}

export function formatBuyerDistricts(districts: string[] | null | undefined): string | null {
  const list = normalizeBuyerDistricts(districts ?? []);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} lub ${list[1]}`;
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`;
}

export function isBuyerIntakePath(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/szukam'));
}

export function buyerMissionShowsRooms(propertyType: BuyerPropertyType | null): boolean {
  return propertyType === 'apartment' || propertyType === 'house';
}

export function buyerMissionShowsArea(propertyType: BuyerPropertyType | null): boolean {
  return Boolean(propertyType);
}

export function buyerMissionShowsAmenities(propertyType: BuyerPropertyType | null): boolean {
  return propertyType === 'apartment' || propertyType === 'house' || propertyType === 'commercial';
}

export const BUYER_MUST_HAVE_OPTIONS: Array<{
  id: BuyerMustHaveKey;
  label: string;
  hint: string;
}> = [
  { id: 'requireBalcony', label: 'Balkon / taras', hint: 'Balkon, loggia lub taras' },
  { id: 'requireGarden', label: 'Ogródek', hint: 'Ogród lub ogródek' },
  { id: 'requireTwoLevel', label: 'Dwupoziomowe', hint: 'Mieszkanie lub dom na 2 poziomach' },
  { id: 'requireElevator', label: 'Winda', hint: 'W budynku musi być winda' },
  { id: 'requireParking', label: 'Garaż / parking', hint: 'Miejsce postojowe lub garaż' },
  { id: 'requireFurnished', label: 'Umeblowane', hint: 'Gotowe do wprowadzenia' },
];

export function getBuyerMustHaveOptionsForPropertyType(
  propertyType: BuyerPropertyType | null | undefined,
): typeof BUYER_MUST_HAVE_OPTIONS {
  if (propertyType === 'commercial') {
    return BUYER_MUST_HAVE_OPTIONS.filter((option) =>
      ['requireElevator', 'requireParking', 'requireFurnished', 'requireTwoLevel'].includes(option.id),
    );
  }
  if (propertyType === 'house') {
    return BUYER_MUST_HAVE_OPTIONS.filter((option) => option.id !== 'requireElevator');
  }
  if (propertyType === 'apartment') {
    return BUYER_MUST_HAVE_OPTIONS;
  }
  return [];
}

export const BUYER_TRANSACTION_OPTIONS: Array<{ id: BuyerTransactionType; label: string; hint: string }> = [
  { id: 'SELL', label: 'Kupno', hint: 'Zakup nieruchomości' },
  { id: 'RENT', label: 'Wynajem', hint: 'Mieszkanie lub lokal' },
];

export const BUYER_MARKET_OPTIONS: Array<{ id: BuyerMarketType; label: string; hint: string }> = [
  { id: 'both', label: 'Obojętnie', hint: 'Pierwotny i wtórny' },
  { id: 'secondary', label: 'Rynek wtórny', hint: 'Od poprzedniego właściciela' },
  { id: 'primary', label: 'Rynek pierwotny', hint: 'Nowe od dewelopera' },
];

export const BUYER_TIMELINE_OPTIONS: Array<{ id: BuyerPurchaseTimeline; label: string; hint: string }> = [
  { id: 'asap', label: 'Od razu', hint: 'Szukamy natychmiast' },
  { id: '1-3m', label: '1–3 mies.', hint: 'W najbliższym kwartale' },
  { id: '3-6m', label: '3–6 mies.', hint: 'Bez pośpiechu, ale konkretnie' },
  { id: 'flexible', label: 'Spokojnie', hint: 'Czekam na idealną ofertę' },
];

export function normalizeBuyerTransactionType(value: unknown): BuyerTransactionType | null {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SELL' || raw === 'RENT') return raw;
  return null;
}

export function normalizeBuyerMarketType(value: unknown): BuyerMarketType | null {
  const raw = String(value || '').trim();
  if (raw === 'primary' || raw === 'secondary' || raw === 'both') return raw;
  return null;
}

export function normalizeBuyerPurchaseTimeline(value: unknown): BuyerPurchaseTimeline | null {
  const raw = String(value || '').trim();
  if (raw === 'asap' || raw === '1-3m' || raw === '3-6m' || raw === 'flexible') return raw;
  return null;
}

export function listBuyerMustHaves(
  record: Pick<
    BuyerMissionRecord,
    | 'requireBalcony'
    | 'requireGarden'
    | 'requireElevator'
    | 'requireParking'
    | 'requireFurnished'
    | 'requireTwoLevel'
  >,
): string[] {
  return BUYER_MUST_HAVE_OPTIONS.filter((option) => record[option.id]).map((option) => option.label);
}

export function formatBuyerMustHaves(
  record: Pick<
    BuyerMissionRecord,
    | 'requireBalcony'
    | 'requireGarden'
    | 'requireElevator'
    | 'requireParking'
    | 'requireFurnished'
    | 'requireTwoLevel'
  >,
): string | null {
  const labels = listBuyerMustHaves(record);
  if (!labels.length) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} i ${labels[1]}`;
  return labels.join(', ');
}

export function formatBuyerTransactionType(value: BuyerTransactionType | null | undefined): string | null {
  if (!value) return null;
  return BUYER_TRANSACTION_OPTIONS.find((item) => item.id === value)?.label ?? null;
}

export function formatBuyerMarketType(value: BuyerMarketType | null | undefined): string | null {
  if (!value || value === 'both') return null;
  return BUYER_MARKET_OPTIONS.find((item) => item.id === value)?.label ?? null;
}

export function formatBuyerPurchaseTimeline(value: BuyerPurchaseTimeline | null | undefined): string | null {
  if (!value) return null;
  return BUYER_TIMELINE_OPTIONS.find((item) => item.id === value)?.label ?? null;
}

export function formatBuyerStep3Summary(record: BuyerMissionRecord): string[] {
  const parts: string[] = [];
  parts.push(...listBuyerMustHaves(record));
  const transaction = formatBuyerTransactionType(record.transactionType);
  if (transaction) parts.push(transaction);
  const timeline = formatBuyerPurchaseTimeline(record.purchaseTimeline);
  if (timeline) parts.push(timeline);
  return parts;
}

export function resolveBuyerUiStep(mission: BuyerMissionRecord | null): 1 | 2 | 3 | 4 {
  if (!mission?.propertyType) return 1;
  if (!isBuyerStep2Complete(mission)) return 2;
  if (!isBuyerStep3Complete(mission)) return 3;
  if (!isBuyerStep4Complete(mission)) return 4;
  return 4;
}

export function isBuyerStep2Complete(mission: BuyerMissionRecord | null): boolean {
  return Boolean(mission?.city && mission?.budgetMax && (mission?.step ?? 0) >= 3);
}

export function isBuyerStep3Complete(mission: BuyerMissionRecord | null): boolean {
  return Boolean(isBuyerStep2Complete(mission) && (mission?.step ?? 0) >= 4);
}

export function isBuyerStep4Complete(mission: BuyerMissionRecord | null): boolean {
  return Boolean(
    isBuyerStep3Complete(mission) &&
      (mission?.step ?? 0) >= 5 &&
      Number(mission?.clientId) > 0 &&
      mission?.consentContact,
  );
}

export function buyerIntakePropertyTypeToPrisma(
  value: BuyerPropertyType | null | undefined,
): 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL' {
  if (value === 'house') return 'HOUSE';
  if (value === 'plot') return 'PLOT';
  if (value === 'commercial') return 'COMMERCIAL';
  return 'FLAT';
}

export function buyerMissionToBuyerPrefCreate(mission: BuyerMissionRecord) {
  return {
    transactionType: mission.transactionType ?? 'SELL',
    propertyType: buyerIntakePropertyTypeToPrisma(mission.propertyType),
    city: mission.city || null,
    districts: mission.districts.length ? mission.districts : undefined,
    maxPrice: mission.budgetMax,
    minArea: mission.minArea,
    maxArea: mission.maxArea,
    requireBalcony: mission.requireBalcony,
    requireGarden: mission.requireGarden,
    requireElevator: mission.requireElevator,
    requireParking: mission.requireParking,
    requireFurnished: mission.requireFurnished,
    minMatchThreshold: 70,
  };
}

export function buyerMissionQualificationMeta(mission: BuyerMissionRecord) {
  return {
    purchaseTimeline: mission.purchaseTimeline,
    rooms: mission.rooms.length ? mission.rooms : null,
    maxArea: mission.maxArea,
    requireTwoLevel: mission.requireTwoLevel,
    source: 'buyer_intake_szukam',
    qualifiedAt: new Date().toISOString(),
  };
}

export type BuyerContactValidation =
  | {
      ok: true;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string;
      consentContact: true;
    }
  | { ok: false; error: string };

export function normalizeBuyerContactEmail(raw: unknown): string | null {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 191);
}

export function validateBuyerStep4Contact(input: {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  consentContact?: unknown;
}): BuyerContactValidation {
  const firstName = String(input.firstName || '').trim().slice(0, 96);
  const lastName = String(input.lastName || '').trim().slice(0, 96);
  if (!firstName || firstName.length < 2) {
    return { ok: false, error: 'Podaj imię (min. 2 znaki).' };
  }
  if (!lastName || lastName.length < 2) {
    return { ok: false, error: 'Podaj nazwisko (min. 2 znaki).' };
  }
  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164) {
    return {
      ok: false,
      error: 'Podaj poprawny numer z kodem kraju — wybierz prefix i wpisz numer krajowy.',
    };
  }
  const emailRaw = String(input.email || '').trim();
  const email = normalizeBuyerContactEmail(emailRaw);
  if (emailRaw && !email) {
    return { ok: false, error: 'Sprawdź adres e-mail — np. jan@example.com' };
  }
  if (!input.consentContact) {
    return { ok: false, error: 'Zaznacz zgodę na kontakt, żebyśmy mogli ruszyć ze współpracą.' };
  }
  return {
    ok: true,
    firstName,
    lastName,
    email,
    phone: phoneE164,
    consentContact: true,
  };
}

export function formatBuyerBudget(
  value: number | null | undefined,
  transactionType: BuyerTransactionType | null | undefined = 'SELL',
): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (transactionType === 'RENT') {
    if (n >= 10_000) return 'od 7 tys. zł/mies.';
    if (n >= 1_000) {
      const thousands = n / 1_000;
      const label =
        thousands >= 10
          ? Math.round(thousands).toString()
          : thousands.toFixed(1).replace('.0', '').replace('.', ',');
      return `do ${label} tys. zł/mies.`;
    }
    return `do ${Math.round(n)} zł/mies.`;
  }
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    const label = millions >= 2 ? Math.round(millions) : millions.toFixed(1).replace('.0', '').replace('.', ',');
    return `do ${label} mln zł`;
  }
  return `do ${Math.round(n / 1000)} tys. zł`;
}

export function buyerIntakeTimelineHeading(transactionType: BuyerTransactionType | null | undefined): string {
  return transactionType === 'RENT' ? 'Kiedy się wprowadzasz?' : 'Kiedy kupujesz?';
}

export function buyerIntakeTimelineHint(
  firstName: string,
  transactionType: BuyerTransactionType | null | undefined,
): string {
  if (transactionType === 'RENT') {
    return `Termin najmu — ${firstName} dopasuje priorytety`;
  }
  return `Tempo zakupu — ${firstName} dopasuje priorytety`;
}

export function buyerIntakeBudgetHeading(transactionType: BuyerTransactionType | null | undefined): string {
  return transactionType === 'RENT' ? 'Czynsz (max)' : 'Budżet (max)';
}
