import { API_URL } from '../config/network';
import { buildCanonicalRadarPreferencesDto } from '../contracts/parityContracts';
import type { RadarFilters } from '../components/RadarCalibrationModal';
import { isRadarFactoryDefaults } from '../utils/radarRecentAreas';

export type SearchEventSource = 'radar_calibration' | 'advanced_search' | 'favorites_calibration';

export type AdvancedSearchPayload = {
  transactionType: 'RENT' | 'SELL';
  priceCurrency?: 'PLN' | 'EUR';
  city?: string;
  districts?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
  minRooms?: number | null;
  propertyType?: string;
  locationMode?: string;
  mapBounds?: { centerLat: number; centerLng: number; radiusKm: number } | null;
};

function buildEventBody(params: {
  userId: number;
  source: SearchEventSource;
  filters: Record<string, unknown>;
  mapContext?: { lat?: number; lng?: number; radius?: number };
}) {
  const { userId, source, filters, mapContext } = params;
  const lat = mapContext?.lat ?? filters.lat;
  const lng = mapContext?.lng ?? filters.lng;
  const radius = mapContext?.radius ?? filters.radius;
  return {
    userId,
    source,
    eventType: 'RADAR_SEARCH',
    searchedAt: new Date().toISOString(),
    ...filters,
    ...(lat != null && lng != null
      ? { lat: Number(lat), lng: Number(lng), radius: radius != null ? Number(radius) : null }
      : {}),
  };
}

/** Zapisuje pojedyncze wyszukiwanie / kalibrację — fire-and-forget. */
export async function logUserSearchEvent(params: {
  token: string | null | undefined;
  userId: number | null | undefined;
  source: SearchEventSource;
  filters: Record<string, unknown>;
  mapContext?: { lat?: number; lng?: number; radius?: number };
}): Promise<void> {
  const { token, userId, source, filters, mapContext } = params;
  if (!token || !userId || !Number.isFinite(Number(userId))) return;

  const body = buildEventBody({
    userId: Number(userId),
    source,
    filters,
    mapContext,
  });

  const paths = [
    '/api/radar/search-history',
    '/api/mobile/v1/radar/search-history',
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
    } catch {
      // próba następnego URL
    }
  }
}

export function logRadarCalibrationSearch(params: {
  token: string | null | undefined;
  userId: number | null | undefined;
  filters: RadarFilters;
  mapBounds?: { centerLat: number; centerLng: number; radiusKm: number } | null;
}): void {
  const { token, userId, filters, mapBounds } = params;
  if (isRadarFactoryDefaults(filters)) return;
  const dto = buildCanonicalRadarPreferencesDto({
    userId: Number(userId),
    filters,
    mapContext: mapBounds
      ? { lat: mapBounds.centerLat, lng: mapBounds.centerLng, radius: mapBounds.radiusKm }
      : undefined,
  });
  void logUserSearchEvent({
    token,
    userId,
    source: 'radar_calibration',
    filters: dto as unknown as Record<string, unknown>,
    mapContext: mapBounds
      ? { lat: mapBounds.centerLat, lng: mapBounds.centerLng, radius: mapBounds.radiusKm }
      : undefined,
  });
}

export function logAdvancedMapSearch(params: {
  token: string | null | undefined;
  userId: number | null | undefined;
  payload: AdvancedSearchPayload;
}): void {
  const { token, userId, payload } = params;
  const hasSignal =
    String(payload.city || '').trim() ||
    (payload.districts && payload.districts.length > 0) ||
    payload.maxPrice != null ||
    payload.minPrice != null ||
    payload.minArea != null ||
    payload.mapBounds;
  if (!hasSignal) return;

  void logUserSearchEvent({
    token,
    userId,
    source: 'advanced_search',
    filters: {
      transactionType: payload.transactionType,
      propertyType: payload.propertyType === 'ALL' ? null : payload.propertyType,
      city: payload.city || '',
      selectedDistricts: payload.districts || [],
      maxPrice: payload.maxPrice,
      minPrice: payload.minPrice,
      minArea: payload.minArea,
      maxArea: payload.maxArea,
      minRooms: payload.minRooms,
      locationMode: payload.locationMode,
      mapBounds: payload.mapBounds,
    },
    mapContext: payload.mapBounds
      ? {
          lat: payload.mapBounds.centerLat,
          lng: payload.mapBounds.centerLng,
          radius: payload.mapBounds.radiusKm,
        }
      : undefined,
  });
}
