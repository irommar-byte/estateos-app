import type { CarsAdvancedFilters } from './carsAdvancedFilters';

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

function parseDigits(value: string): number | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
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
    pushNotifications: params.pushNotifications !== false,
    enabled,
    minMatchThreshold: 70,
  };
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
