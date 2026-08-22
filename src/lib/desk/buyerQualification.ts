import type { AgencyClientBuyerPreference } from '@prisma/client';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { webRadarFiltersToBuyerPrefCreate } from '@/lib/agencyClientShape';

/** Extended buyer qualification stored on DeskCase.metadata.qualification */
export type BuyerQualificationExtended = {
  minPrice?: number | null;
  maxPrice?: number | null;
  financing?: 'cash' | 'credit' | 'mixed';
  downPayment?: number | null;
  maxArea?: number | null;
  rooms?: number | null;
  marketType?: 'primary' | 'secondary' | 'both';
  purchaseTimeline?: string | null;
  purchaseGoal?: string | null;
  mustHave?: string | null;
  niceToHave?: string | null;
  exclusions?: string | null;
  qualificationNotes?: string | null;
  qualifiedAt?: string | null;
};

export type BuyerQualificationPayload = BuyerQualificationExtended & {
  buyerFilters: WebRadarFilters;
  notes?: string | null;
};

export function buyerPrefToQualificationForm(
  pref: AgencyClientBuyerPreference | null,
  extended: BuyerQualificationExtended | null,
): Partial<BuyerQualificationPayload> {
  const districts = Array.isArray(pref?.districts) ? (pref!.districts as string[]) : [];
  return {
    minPrice: extended?.minPrice ?? null,
    maxPrice: pref?.maxPrice ?? extended?.maxPrice ?? null,
    financing: extended?.financing ?? 'credit',
    downPayment: extended?.downPayment ?? null,
    maxArea: extended?.maxArea ?? null,
    rooms: extended?.rooms ?? null,
    marketType: extended?.marketType ?? 'both',
    purchaseTimeline: extended?.purchaseTimeline ?? null,
    purchaseGoal: extended?.purchaseGoal ?? null,
    mustHave: extended?.mustHave ?? null,
    niceToHave: extended?.niceToHave ?? null,
    exclusions: extended?.exclusions ?? null,
    qualificationNotes: extended?.qualificationNotes ?? null,
    buyerFilters: {
      calibrationMode: pref?.lat != null && pref?.lng != null ? 'MAP' : 'CITY',
      transactionType: (pref?.transactionType as 'RENT' | 'SELL') || 'SELL',
      propertyType: pref?.propertyType || 'FLAT',
      city: pref?.city || 'Warszawa',
      selectedDistricts: districts,
      maxPrice: pref?.maxPrice ?? 0,
      minArea: pref?.minArea ?? 0,
      minYear: pref?.minYear ?? 1900,
      requireBalcony: pref?.requireBalcony ?? false,
      requireGarden: pref?.requireGarden ?? false,
      requireElevator: pref?.requireElevator ?? false,
      requireParking: pref?.requireParking ?? false,
      requireFurnished: pref?.requireFurnished ?? false,
      requireTwoLevel: false,
      pushNotifications: true,
      matchThreshold: pref?.minMatchThreshold ?? 70,
      lat: pref?.lat ?? null,
      lng: pref?.lng ?? null,
      radiusKm: pref?.radius ?? null,
    },
  };
}

export function qualificationPayloadToBuyerPref(payload: BuyerQualificationPayload) {
  const base = webRadarFiltersToBuyerPrefCreate(payload.buyerFilters);
  if (payload.maxPrice != null && payload.maxPrice > 0) {
    base.maxPrice = payload.maxPrice;
  }
  if (payload.buyerFilters.minArea > 0) {
    base.minArea = payload.buyerFilters.minArea;
  }
  return base;
}

export function parseQualificationFromMetadata(metadata: unknown): BuyerQualificationExtended | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const q = (metadata as Record<string, unknown>).qualification;
  if (!q || typeof q !== 'object') return null;
  return q as BuyerQualificationExtended;
}

export function isQualificationComplete(payload: BuyerQualificationPayload): boolean {
  const city = payload.buyerFilters.city?.trim();
  const hasBudget =
    (payload.maxPrice != null && payload.maxPrice > 0) ||
    (payload.buyerFilters.maxPrice != null && payload.buyerFilters.maxPrice > 0);
  return Boolean(city && hasBudget && payload.financing);
}
