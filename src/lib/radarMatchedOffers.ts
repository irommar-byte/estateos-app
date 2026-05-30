import type { RadarPreferenceDto } from '@/lib/radarPreferenceShape';
import {
  calculateRadarMatchScore,
  radarMatchThreshold,
} from '@/lib/radarMatchScore';
import { shapeMatchedOfferForCrm } from '@/lib/crmMatchedOffer';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { webRadarFiltersFromPreference } from '@/lib/radarCalibrationWeb';

export function radarPreferenceToScoreInput(
  pref: RadarPreferenceDto,
): Record<string, unknown> {
  return {
    transactionType: pref.transactionType,
    propertyType: pref.propertyType,
    city: pref.city,
    districts: pref.selectedDistricts,
    maxPrice: pref.maxPrice,
    minArea: pref.minArea,
    minYear: pref.minYear,
    requireBalcony: pref.requireBalcony,
    requireGarden: pref.requireGarden,
    requireElevator: pref.requireElevator,
    requireParking: pref.requireParking,
    requireFurnished: pref.requireFurnished,
    requireTwoLevel: pref.requireTwoLevel,
    minMatchThreshold: pref.minMatchThreshold,
    lat: pref.lat,
    lng: pref.lng,
    radius: pref.radius,
  };
}

export function webRadarFiltersToScoreInput(filters: WebRadarFilters): Record<string, unknown> {
  return {
    transactionType: filters.transactionType,
    propertyType: filters.propertyType,
    city: filters.city,
    districts: filters.selectedDistricts,
    maxPrice: filters.maxPrice > 0 ? filters.maxPrice : null,
    minArea: filters.minArea > 0 ? filters.minArea : null,
    minYear: filters.minYear > 1900 ? filters.minYear : null,
    requireBalcony: filters.requireBalcony,
    requireGarden: filters.requireGarden,
    requireElevator: filters.requireElevator,
    requireParking: filters.requireParking,
    requireFurnished: filters.requireFurnished,
    requireTwoLevel: filters.requireTwoLevel,
    minMatchThreshold: filters.matchThreshold,
    lat: filters.calibrationMode === 'MAP' ? filters.lat : null,
    lng: filters.calibrationMode === 'MAP' ? filters.lng : null,
    radius: filters.calibrationMode === 'MAP' ? filters.radiusKm : null,
  };
}

type OfferRow = Record<string, unknown>;

const MATCHED_OFFER_SELECT = {
  id: true,
  title: true,
  price: true,
  pricePln: true,
  priceCurrency: true,
  area: true,
  rooms: true,
  city: true,
  district: true,
  propertyType: true,
  hasBalcony: true,
  hasElevator: true,
  hasParking: true,
  hasGarden: true,
  hasStorage: true,
  isFurnished: true,
  isTwoLevel: true,
  yearBuilt: true,
  lat: true,
  lng: true,
  images: true,
  transactionType: true,
  status: true,
  userId: true,
} as const;

export { MATCHED_OFFER_SELECT };

export function scoreOffersForRadarPreference(
  offers: OfferRow[],
  prefInput: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const threshold = radarMatchThreshold(prefInput);

  return offers
    .map((offer) => {
      const matchScore = Math.round(calculateRadarMatchScore(prefInput, offer));
      return {
        ...shapeMatchedOfferForCrm(offer),
        matchScore,
      };
    })
    .filter((offer) => Number(offer.matchScore) >= threshold)
    .sort((a, b) => Number(b.matchScore) - Number(a.matchScore));
}

export function buildRadarScoreInputFromUser(
  user: {
    searchType?: string | null;
    searchMaxPrice?: number | null;
    searchAreaFrom?: number | null;
    searchRooms?: number | null;
    searchDistricts?: string | null;
    searchAmenities?: string | null;
    searchTransactionType?: string | null;
  },
  radarPreference: RadarPreferenceDto | null,
): Record<string, unknown> | null {
  if (radarPreference) {
    return radarPreferenceToScoreInput(radarPreference);
  }

  if (!user.searchType && !user.searchMaxPrice && !user.searchDistricts) {
    return null;
  }

  const filters = webRadarFiltersFromPreference(null, user);
  return webRadarFiltersToScoreInput(filters);
}

/** Czy formularz kalibracji ma wymagane pola do zapisu aktywnego radaru. */
export function isWebRadarCalibrationReady(
  filters: WebRadarFilters,
  _cityDistrictOptions: string[] = [],
): boolean {
  if (!filters.pushNotifications) return true;

  if (filters.transactionType !== 'RENT' && filters.transactionType !== 'SELL') return false;
  if (!filters.propertyType) return false;

  if (filters.calibrationMode === 'MAP') {
    return (
      filters.lat != null &&
      filters.lng != null &&
      Number(filters.radiusKm) > 0
    );
  }

  return Boolean(String(filters.city || '').trim());
}
