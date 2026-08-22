import type { AgencyClient, AgencyClientBuyerPreference, PropertyType } from '@prisma/client';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { calculateRadarMatchScore, radarMatchThreshold } from '@/lib/radarMatchScore';

export type AgencyClientListItem = {
  id: number;
  type: 'BUYER' | 'SELLER';
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pesel: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  notes: string | null;
  matchCount: number;
  topMatchScore: number | null;
  updatedAt: string;
  sellerCity: string | null;
  sellerPrice: number | null;
  buyerCity: string | null;
  buyerMaxPrice: number | null;
  linkedUserId: number | null;
  linkedUserEmail: string | null;
  linkedUserLastLoginAt: string | null;
  upcomingMeetingStartsAt?: string | null;
  upcomingMeetingLocation?: string | null;
  portalUrl?: string | null;
};

export function buyerPrefToRadarRecord(pref: AgencyClientBuyerPreference | null): Record<string, unknown> {
  if (!pref) return { minMatchThreshold: 70 };
  return {
    transactionType: pref.transactionType,
    propertyType: pref.propertyType,
    city: pref.city,
    districts: pref.districts,
    maxPrice: pref.maxPrice,
    minArea: pref.minArea,
    minYear: pref.minYear,
    requireBalcony: pref.requireBalcony,
    requireGarden: pref.requireGarden,
    requireElevator: pref.requireElevator,
    requireParking: pref.requireParking,
    requireFurnished: pref.requireFurnished,
    minMatchThreshold: pref.minMatchThreshold,
    lat: pref.lat,
    lng: pref.lng,
    radius: pref.radius,
  };
}

function normalizeBuyerPropertyType(raw: string): PropertyType {
  if (raw === 'HOUSE' || raw === 'PLOT' || raw === 'COMMERCIAL') return raw;
  return 'FLAT';
}

export function webRadarFiltersToBuyerPrefCreate(filters: WebRadarFilters) {
  const mapMode = filters.calibrationMode === 'MAP';
  return {
    transactionType: filters.transactionType,
    propertyType: normalizeBuyerPropertyType(filters.propertyType),
    city: filters.city || null,
    districts: filters.selectedDistricts.length ? filters.selectedDistricts : undefined,
    maxPrice: filters.maxPrice > 0 ? filters.maxPrice : null,
    minArea: filters.minArea > 0 ? filters.minArea : null,
    minYear: filters.minYear > 1900 ? filters.minYear : null,
    requireBalcony: filters.requireBalcony,
    requireGarden: filters.requireGarden,
    requireElevator: filters.requireElevator,
    requireParking: filters.requireParking,
    requireFurnished: filters.requireFurnished,
    minMatchThreshold: filters.matchThreshold,
    lat: mapMode ? filters.lat : null,
    lng: mapMode ? filters.lng : null,
    radius: mapMode && filters.radiusKm ? filters.radiusKm : null,
  };
}

export function buyerPrefToWebRadarFilters(
  pref: AgencyClientBuyerPreference | null,
  cityFallback = 'Warszawa',
): WebRadarFilters {
  const mapMode = pref?.lat != null && pref?.lng != null && pref?.radius != null;
  const districts = Array.isArray(pref?.districts)
    ? (pref!.districts as string[])
    : [];
  return {
    calibrationMode: mapMode ? 'MAP' : 'CITY',
    transactionType: (pref?.transactionType as 'RENT' | 'SELL') || 'SELL',
    propertyType: pref?.propertyType || 'FLAT',
    city: pref?.city || cityFallback,
    selectedDistricts: districts,
    maxPrice: pref?.maxPrice ?? 0,
    minArea: pref?.minArea ?? 0,
    minYear: pref?.minYear ?? 1900,
    requireBalcony: !!pref?.requireBalcony,
    requireGarden: !!pref?.requireGarden,
    requireElevator: !!pref?.requireElevator,
    requireParking: !!pref?.requireParking,
    requireFurnished: !!pref?.requireFurnished,
    requireTwoLevel: false,
    // Client buyer prefs are CRM match criteria only — not personal radar push.
    pushNotifications: false,
    matchThreshold: pref?.minMatchThreshold ?? 70,
    lat: pref?.lat ?? null,
    lng: pref?.lng ?? null,
    radiusKm: pref?.radius ?? null,
  };
}

export function shapeClientListItem(
  client: AgencyClient & {
    buyerPreference: AgencyClientBuyerPreference | null;
    _count?: { matches: number };
    matches?: { score: number }[];
    linkedUser?: { id: number; email: string; lastLoginAt: Date | null } | null;
    activities?: Array<{ metadata: unknown }>;
  },
): AgencyClientListItem {
  const top = client.matches?.[0]?.score ?? null;
  const meetingAct = client.activities?.[0];
  const meetingMeta = (meetingAct?.metadata || {}) as Record<string, unknown>;
  const rawMeetingStart = typeof meetingMeta.startsAt === 'string' ? meetingMeta.startsAt : null;
  const meetingStartMs = rawMeetingStart ? new Date(rawMeetingStart).getTime() : NaN;
  const meetingStillRelevant =
    Number.isFinite(meetingStartMs) && meetingStartMs + 60 * 60 * 1000 > Date.now();
  const upcomingMeetingStartsAt = meetingStillRelevant ? rawMeetingStart : null;
  const upcomingMeetingLocation =
    meetingStillRelevant && typeof meetingMeta.location === 'string' ? meetingMeta.location : null;

  return {
    id: client.id,
    type: client.type,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    pesel: client.pesel ?? null,
    emailVerifiedAt: client.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: client.phoneVerifiedAt?.toISOString() ?? null,
    notes: client.notes,
    matchCount: client._count?.matches ?? client.matches?.length ?? 0,
    topMatchScore: top,
    updatedAt: client.updatedAt.toISOString(),
    sellerCity: client.sellerCity,
    sellerPrice: client.sellerPrice,
    buyerCity: client.buyerPreference?.city ?? null,
    buyerMaxPrice: client.buyerPreference?.maxPrice ?? null,
    linkedUserId: client.linkedUser?.id ?? client.linkedUserId ?? null,
    linkedUserEmail: client.linkedUser?.email ?? null,
    linkedUserLastLoginAt: client.linkedUser?.lastLoginAt?.toISOString() ?? null,
    upcomingMeetingStartsAt,
    upcomingMeetingLocation,
    portalUrl: client.portalToken ? buildPortalUrl(client.portalToken) : null,
  };
}

export type MatchUpsert = { offerId: number; score: number };

export function scoreOfferForBuyerPref(
  pref: AgencyClientBuyerPreference | null,
  offer: Record<string, unknown>,
): number {
  return calculateRadarMatchScore(buyerPrefToRadarRecord(pref), offer);
}

export function passesBuyerThreshold(
  pref: AgencyClientBuyerPreference | null,
  score: number,
): boolean {
  return score >= radarMatchThreshold(buyerPrefToRadarRecord(pref));
}
