import type { CarsAdvancedFilters } from './carsAdvancedFilters';
import { EMPTY_CARS_ADVANCED_FILTERS } from './carsAdvancedFilters';

export type CanonicalCarRadarPreferencesDto = {
  userId: number;
  query?: string;
  queryText?: string;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  fuelType?: string | null;
  bodyType?: string | null;
  exteriorColor?: string | null;
  transmission?: string | null;
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minYear?: number | null;
  maxYear?: number | null;
  minMileage?: number | null;
  maxMileage?: number | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  pushNotifications?: boolean;
  enabled?: boolean;
  minMatchThreshold?: number;
};

export type CarRadarApiPreference = {
  queryText?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  fuelType?: string | null;
  bodyType?: string | null;
  exteriorColor?: string | null;
  transmission?: string | null;
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minYear?: number | null;
  maxYear?: number | null;
  minMileage?: number | null;
  maxMileage?: number | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  pushNotifications?: boolean;
  enabled?: boolean;
  minMatchThreshold?: number | null;
};

function parseDigits(value: string): number | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function numToFilterString(value: unknown): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n)) : '';
}

function clampThreshold(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.max(50, Math.min(100, Math.round(n)));
}

function normalizeBearerToken(token: string | null | undefined): string | null {
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, '').trim() || null;
}

export function buildCanonicalCarRadarPreferencesDto(params: {
  userId: number;
  filters: CarsAdvancedFilters;
  enabled: boolean;
  pushNotifications?: boolean;
}): CanonicalCarRadarPreferencesDto {
  const { userId, filters, enabled } = params;
  const bounds = filters.mapBounds;
  const pushOn = params.pushNotifications ?? filters.pushNotifications !== false;
  return {
    userId,
    query: filters.query,
    queryText: filters.query,
    vehicleType: filters.vehicleType || null,
    make: filters.make || null,
    model: filters.model || null,
    generation: filters.generation || null,
    fuelType: filters.fuelType || null,
    bodyType: filters.bodyType || null,
    exteriorColor: filters.exteriorColor || null,
    transmission: filters.transmission || null,
    city: filters.city || null,
    minPrice: parseDigits(filters.minPrice),
    maxPrice: parseDigits(filters.maxPrice),
    minYear: parseDigits(filters.minYear),
    maxYear: parseDigits(filters.maxYear),
    minMileage: parseDigits(filters.minMileage),
    maxMileage: parseDigits(filters.maxMileage),
    lat: bounds?.centerLat ?? null,
    lng: bounds?.centerLng ?? null,
    radius: bounds?.radiusKm ?? null,
    pushNotifications: enabled ? pushOn : false,
    enabled,
    minMatchThreshold: clampThreshold(filters.matchThreshold),
  };
}

export function carRadarFiltersFromApiPreference(
  pref: CarRadarApiPreference,
  defaults: CarsAdvancedFilters = EMPTY_CARS_ADVANCED_FILTERS,
): CarsAdvancedFilters {
  const lat = Number(pref.lat);
  const lng = Number(pref.lng);
  const radius = Number(pref.radius);
  const hasMap =
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0;

  return {
    ...defaults,
    query: String(pref.queryText || '').trim(),
    vehicleType: String(pref.vehicleType || '').trim(),
    make: String(pref.make || '').trim(),
    makeSlug: String(pref.make || '').trim(),
    model: String(pref.model || '').trim(),
    modelSlug: String(pref.model || '').trim(),
    generation: String(pref.generation || '').trim(),
    generationSlug: String(pref.generation || '').trim(),
    fuelType: String(pref.fuelType || '').trim(),
    bodyType: String(pref.bodyType || '').trim(),
    exteriorColor: String(pref.exteriorColor || '').trim(),
    transmission: String(pref.transmission || '').trim(),
    city: String(pref.city || '').trim(),
    minPrice: numToFilterString(pref.minPrice),
    maxPrice: numToFilterString(pref.maxPrice),
    minYear: numToFilterString(pref.minYear),
    maxYear: numToFilterString(pref.maxYear),
    minMileage: numToFilterString(pref.minMileage),
    maxMileage: numToFilterString(pref.maxMileage),
    mapBounds: hasMap
      ? { centerLat: lat, centerLng: lng, radiusKm: radius }
      : null,
    matchThreshold: clampThreshold(pref.minMatchThreshold),
    pushNotifications: pref.pushNotifications !== false,
  };
}

export async function fetchCarRadarPreferenceForUser(
  apiUrl: string,
  userId: number,
  token: string | null | undefined,
): Promise<CarRadarApiPreference | null> {
  const bearer = normalizeBearerToken(token);
  if (!bearer || !(userId > 0)) return null;
  try {
    const res = await fetch(`${apiUrl}/api/cars/radar/preferences?userId=${userId}`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    const pref = json?.carRadarPreference || json?.pref;
    return pref && typeof pref === 'object' ? (pref as CarRadarApiPreference) : null;
  } catch {
    return null;
  }
}

/** Zapis preferencji radaru aut — backend wymaga Bearer. */
export async function postCarRadarPreferencesToBackend(params: {
  apiUrl: string;
  token: string | null | undefined;
  dto: CanonicalCarRadarPreferencesDto;
}): Promise<boolean> {
  const bearer = normalizeBearerToken(params.token);
  if (!bearer || !params.dto?.userId) return false;
  try {
    const res = await fetch(`${params.apiUrl}/api/cars/radar/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(params.dto),
    });
    return res.ok;
  } catch {
    return false;
  }
}
