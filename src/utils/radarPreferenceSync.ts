import type { RadarFilters } from '../components/RadarCalibrationModal';
import type { CanonicalRadarPreferencesDto } from '../contracts/parityContracts';

/** Kształt z GET /api/radar/preferences lub profilu (shapeRadarPreference). */
export type ApiRadarPreference = {
  transactionType?: string | null;
  propertyType?: string | null;
  city?: string | null;
  selectedDistricts?: string[];
  maxPrice?: number | null;
  minArea?: number | null;
  minYear?: number | null;
  requireBalcony?: boolean;
  requireGarden?: boolean;
  requireElevator?: boolean;
  requireParking?: boolean;
  requireFurnished?: boolean;
  requireTwoLevel?: boolean;
  pushNotifications?: boolean;
  minMatchThreshold?: number | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
};

export type RadarMapBounds = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

function parseDistricts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((d) => String(d).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((d) => String(d).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function legacyTransactionToMobile(raw: string | null | undefined): 'RENT' | 'SELL' {
  const v = String(raw || '').toLowerCase();
  if (v === 'rent' || v === 'wynajem') return 'RENT';
  return 'SELL';
}

/**
 * Odczyt preferencji z backendu → stan modala / mapy w aplikacji (parity z CRM WWW).
 */
export function radarFiltersFromApiPreference(
  pref: ApiRadarPreference | null | undefined,
  defaults: RadarFilters,
  legacy?: {
    searchDistricts?: string | null;
    searchMaxPrice?: number | null;
    searchAreaFrom?: number | null;
    searchTransactionType?: string | null;
    searchAmenities?: string | null;
  },
): { filters: RadarFilters; mapBounds: RadarMapBounds | null } {
  if (!pref && !legacy) {
    return { filters: defaults, mapBounds: null };
  }

  const districts =
    pref?.selectedDistricts?.length
      ? pref.selectedDistricts
      : parseDistricts(legacy?.searchDistricts);

  const lat = pref?.lat != null ? Number(pref.lat) : null;
  const lng = pref?.lng != null ? Number(pref.lng) : null;
  const radius = pref?.radius != null ? Number(pref.radius) : null;
  const hasMap =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    radius != null &&
    Number.isFinite(radius) &&
    radius > 0;

  const amenities = String(legacy?.searchAmenities || '').toLowerCase();

  const filters: RadarFilters = {
    ...defaults,
    calibrationMode: hasMap ? 'MAP' : 'CITY',
    transactionType:
      pref?.transactionType === 'RENT' || pref?.transactionType === 'SELL'
        ? pref.transactionType
        : legacyTransactionToMobile(legacy?.searchTransactionType),
    propertyType: pref?.propertyType || defaults.propertyType || 'ALL',
    city: String(pref?.city || defaults.city || 'Warszawa'),
    selectedDistricts: districts,
    maxPrice: pref?.maxPrice ?? legacy?.searchMaxPrice ?? defaults.maxPrice,
    minArea: pref?.minArea ?? legacy?.searchAreaFrom ?? defaults.minArea,
    minYear: pref?.minYear ?? defaults.minYear,
    requireBalcony: pref?.requireBalcony ?? amenities.includes('balkon'),
    requireGarden: pref?.requireGarden ?? amenities.includes('ogr'),
    requireElevator: pref?.requireElevator ?? amenities.includes('winda'),
    requireParking: pref?.requireParking ?? amenities.includes('parking'),
    requireFurnished: pref?.requireFurnished ?? amenities.includes('umeblow'),
    requireTwoLevel: pref?.requireTwoLevel ?? amenities.includes('dwupoziom'),
    pushNotifications: pref?.pushNotifications !== false,
    matchThreshold: pref?.minMatchThreshold ?? defaults.matchThreshold,
  };

  const mapBounds: RadarMapBounds | null = hasMap
    ? { centerLat: lat!, centerLng: lng!, radiusKm: radius! }
    : null;

  return { filters, mapBounds };
}

export function mapContextForCanonicalDto(
  filters: RadarFilters,
  mapBounds: RadarMapBounds | null | undefined,
): { lat?: number | null; lng?: number | null; radius?: number | null } {
  if (filters.calibrationMode !== 'MAP' || !mapBounds) {
    return { lat: null, lng: null, radius: null };
  }
  return {
    lat: mapBounds.centerLat,
    lng: mapBounds.centerLng,
    radius: mapBounds.radiusKm,
  };
}

export async function fetchRadarPreferenceForUser(
  apiUrl: string,
  userId: number,
  token?: string | null,
): Promise<ApiRadarPreference | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${apiUrl}/api/radar/preferences?userId=${userId}`, {
      headers,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return (data.radarPreference ?? data.pref ?? null) as ApiRadarPreference | null;
  } catch {
    return null;
  }
}
