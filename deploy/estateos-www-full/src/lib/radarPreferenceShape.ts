import type { RadarPreference } from '@prisma/client';

export type RadarPreferenceDto = {
  transactionType: string | null;
  propertyType: string | null;
  city: string | null;
  selectedDistricts: string[];
  maxPrice: number | null;
  minArea: number | null;
  minYear: number | null;
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  requireTwoLevel: boolean;
  pushNotifications: boolean;
  minMatchThreshold: number;
  lat: number | null;
  lng: number | null;
  radius: number | null;
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

/** Pełny kształt preferencji radaru (parity z POST /api/radar/preferences). */
function inferRequireTwoLevel(legacyAmenities?: string | null): boolean {
  return String(legacyAmenities || '')
    .toLowerCase()
    .includes('dwupoziom');
}

export function shapeRadarPreference(
  pref: RadarPreference | null | undefined,
  legacyAmenities?: string | null,
): RadarPreferenceDto | null {
  if (!pref) return null;

  return {
    transactionType: pref.transactionType ?? null,
    propertyType: pref.propertyType ?? null,
    city: pref.city ?? null,
    selectedDistricts: parseDistricts(pref.districts),
    maxPrice: pref.maxPrice ?? null,
    minArea: pref.minArea ?? null,
    minYear: pref.minYear ?? null,
    requireBalcony: !!pref.requireBalcony,
    requireGarden: !!pref.requireGarden,
    requireElevator: !!pref.requireElevator,
    requireParking: !!pref.requireParking,
    requireFurnished: !!pref.requireFurnished,
    requireTwoLevel: inferRequireTwoLevel(legacyAmenities),
    pushNotifications: pref.pushNotifications !== false,
    minMatchThreshold: pref.minMatchThreshold ?? 70,
    lat: pref.lat ?? null,
    lng: pref.lng ?? null,
    radius: pref.radius ?? null,
  };
}
