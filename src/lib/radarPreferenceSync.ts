import { prisma } from '@/lib/prisma';
import { canonicalizeCity, canonicalizeDistrict, getDistrictsForCity, isStrictCity } from '@/lib/location/locationCatalog';

export type RadarPreferencePayload = {
  userId: number;
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

function mobileTransactionToLegacy(tx: string | null | undefined): 'all' | 'sale' | 'rent' {
  const v = String(tx || '').toUpperCase();
  if (v === 'RENT') return 'rent';
  if (v === 'SELL') return 'sale';
  return 'all';
}

function legacyAmenitiesFromPayload(payload: RadarPreferencePayload): string[] {
  const amenities: string[] = [];
  if (payload.requireBalcony) amenities.push('Balkon');
  if (payload.requireGarden) amenities.push('Ogródek');
  if (payload.requireElevator) amenities.push('Winda');
  if (payload.requireParking) amenities.push('Garaż/Miejsce park.');
  if (payload.requireFurnished) amenities.push('Umeblowanie');
  if (payload.requireTwoLevel) amenities.push('Dwupoziomowe');
  return amenities;
}

/**
 * Po zapisie RadarPreference synchronizuj legacy `User.search*` (CRM, stare ekrany).
 * Jedno źródło prawdy dla mobile ↔ WWW.
 */
export async function syncUserLegacySearchFromRadarPreference(
  userId: number,
  payload: RadarPreferencePayload,
) {
  const normalizedCity = payload.city ? canonicalizeCity(String(payload.city)) : 'Warszawa';
  const strictCity = isStrictCity(normalizedCity);
  const districts = Array.isArray(payload.selectedDistricts)
    ? payload.selectedDistricts
        .map((d) => canonicalizeDistrict(normalizedCity, String(d)))
        .filter((d) => {
          if (!d) return false;
          if (!strictCity) return true;
          const allowed = getDistrictsForCity(normalizedCity);
          return allowed.some((entry) => entry.toLowerCase() === d.toLowerCase());
        })
    : [];

  await prisma.user.update({
    where: { id: userId },
    data: {
      searchType: payload.propertyType || null,
      searchDistricts: districts.join(','),
      searchMaxPrice:
        payload.maxPrice != null && Number(payload.maxPrice) > 0
          ? Math.round(Number(payload.maxPrice))
          : null,
      searchTransactionType: mobileTransactionToLegacy(payload.transactionType),
      searchAreaFrom:
        payload.minArea != null && Number(payload.minArea) > 0
          ? Math.round(Number(payload.minArea))
          : null,
      searchAmenities: legacyAmenitiesFromPayload(payload).join(',') || null,
    },
  });
}
