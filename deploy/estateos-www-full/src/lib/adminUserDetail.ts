import { shapeRadarPreference, type RadarPreferenceDto } from '@/lib/radarPreferenceShape';
import { radarIntelligenceLabel } from '@/lib/radarCalibrationWeb';
import type { WalletSnapshot } from '@/lib/walletLedger';

export type AdminUserDeviceRow = {
  id: string;
  platform: string;
  deviceModel: string | null;
  appVersion: string | null;
  isActive: boolean;
  lastSyncedAt: string;
  createdAt: string;
};

export type AdminRadarHistoryRow = {
  id: number;
  eventType: string;
  source: string;
  city: string | null;
  transactionType: string | null;
  propertyType: string | null;
  matchCount: number | null;
  radius: number | null;
  searchedAt: string;
  queryText: string | null;
};

export type AdminAgencyMembershipSummary = {
  companyId: number;
  companyName: string;
  companySlug: string | null;
  memberRole: string;
  agentTitle: string;
  status: string;
  isOfficeBoard: boolean;
};

export type AdminUserDetail = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  planType: string | null;
  isPro: boolean;
  proExpiresAt: string | null;
  plusExpiresAt: string | null;
  companyName: string | null;
  nip: string | null;
  isVerified: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
  image: string | null;
  extraListings: number;
  wallet?: WalletSnapshot;
  legacyPreferences: {
    searchType: string | null;
    searchTransactionType: string | null;
    searchDistricts: string | null;
    searchMaxPrice: number | null;
    searchAreaFrom: number | null;
    searchAreaTo: number | null;
    searchPlotArea: number | null;
    searchRooms: number | null;
    buyerType: string | null;
    searchAmenities: string | null;
  };
  radar: (RadarPreferenceDto & {
    calibrationMode: 'MAP' | 'CITY' | null;
    intelligenceLabel: string;
  }) | null;
  radarHistory: AdminRadarHistoryRow[];
  discovery: {
    likesCount: number;
    dislikesCount: number;
    fastTrackCount: number;
    opensCount: number;
    cityStats: unknown;
    districtStats: unknown;
    propertyStats: unknown;
    updatedAt: string | null;
  } | null;
  devices: AdminUserDeviceRow[];
  passkeysCount: number;
  sessionsCount: number;
  channels: string[];
  offers: Array<{ id: number; title: string; price: number; status: string }>;
  agencyMembership: AdminAgencyMembershipSummary | null;
};

const PROPERTY_LABELS: Record<string, string> = {
  FLAT: 'Mieszkanie',
  HOUSE: 'Dom',
  PLOT: 'Działka',
  COMMERCIAL: 'Lokal użytkowy',
};

const TRANSACTION_LABELS: Record<string, string> = {
  SELL: 'Sprzedaż',
  RENT: 'Wynajem',
};

export function labelPropertyType(raw: string | null | undefined): string {
  if (!raw) return '—';
  return PROPERTY_LABELS[String(raw).toUpperCase()] || raw;
}

export function labelTransactionType(raw: string | null | undefined): string {
  if (!raw) return '—';
  return TRANSACTION_LABELS[String(raw).toUpperCase()] || raw;
}

export function labelSearchType(raw: string | null | undefined): string {
  const v = String(raw || '').toLowerCase();
  if (!v) return '—';
  if (v.includes('flat') || v.includes('mieszkan')) return 'Mieszkania';
  if (v.includes('house') || v.includes('dom')) return 'Domy';
  if (v.includes('plot') || v.includes('dział')) return 'Działki';
  if (v.includes('commercial') || v.includes('lokal')) return 'Komercyjne';
  if (v === 'all') return 'Wszystkie typy';
  return raw || '—';
}

export function parseDistrictList(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

function inferCalibrationMode(radar: RadarPreferenceDto | null): 'MAP' | 'CITY' | null {
  if (!radar) return null;
  if (radar.lat != null && radar.lng != null && radar.radius != null && Number(radar.radius) > 0) {
    return 'MAP';
  }
  if (radar.city || radar.selectedDistricts.length > 0) return 'CITY';
  return null;
}

function resolveChannels(input: {
  sessionsCount: number;
  devices: AdminUserDeviceRow[];
  radarHistory: AdminRadarHistoryRow[];
  lastLoginAt: string | null;
}): string[] {
  const channels = new Set<string>();
  if (input.sessionsCount > 0 || input.lastLoginAt) channels.add('WWW');
  for (const d of input.devices) {
    const p = String(d.platform || '').toUpperCase();
    if (p === 'IOS') channels.add('Aplikacja iOS');
    else if (p === 'ANDROID') channels.add('Aplikacja Android');
    else if (d.platform) channels.add(`Mobile (${d.platform})`);
  }
  for (const h of input.radarHistory) {
    const src = String(h.source || '').toLowerCase();
    if (src.includes('web')) channels.add('Radar WWW');
    if (src.includes('mobile')) channels.add('Radar Mobile');
  }
  return Array.from(channels);
}

export function shapeAdminUserDetail(user: {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  planType: string | null;
  isPro: boolean;
  proExpiresAt: Date | null;
  plusExpiresAt: Date | null;
  companyName: string | null;
  nip: string | null;
  isVerified: boolean;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginIp?: string | null;
  lastLoginAt?: Date | null;
  image: string | null;
  extraListings: number;
  searchType: string | null;
  searchTransactionType: string | null;
  searchDistricts: string | null;
  searchMaxPrice: number | null;
  searchAreaFrom: number | null;
  searchAreaTo: number | null;
  searchPlotArea: number | null;
  searchRooms: number | null;
  buyerType: string | null;
  searchAmenities: string | null;
  offers: Array<{ id: number; title: string; price: number; status: string }>;
  radarPreference: Parameters<typeof shapeRadarPreference>[0];
  radarSearchHistory: Array<{
    id: number;
    eventType: string;
    source: string;
    city: string | null;
    transactionType: string | null;
    propertyType: string | null;
    matchCount: number | null;
    radius: number | null;
    searchedAt: Date;
    queryText: string | null;
  }>;
  discoveryProfile: {
    likesCount: number;
    dislikesCount: number;
    fastTrackCount: number;
    opensCount: number;
    cityStats: unknown;
    districtStats: unknown;
    propertyStats: unknown;
    updatedAt: Date;
  } | null;
  devices: Array<{
    id: string;
    platform: string;
    deviceModel: string | null;
    appVersion: string | null;
    isActive: boolean;
    lastSyncedAt: Date;
    createdAt: Date;
  }>;
  _count: { sessions: number; Authenticator: number };
  agencyMembership?: {
    role: string;
    status: string;
    agentTitle: string;
    company: { id: number; name: string; slug: string | null };
  } | null;
}): AdminUserDetail {
  const shapedRadar = shapeRadarPreference(user.radarPreference, user.searchAmenities);
  const radar = shapedRadar
    ? {
        ...shapedRadar,
        calibrationMode: inferCalibrationMode(shapedRadar),
        intelligenceLabel: radarIntelligenceLabel(shapedRadar.minMatchThreshold).title,
      }
    : null;

  const devices: AdminUserDeviceRow[] = user.devices.map((d) => ({
    id: d.id,
    platform: d.platform,
    deviceModel: d.deviceModel,
    appVersion: d.appVersion,
    isActive: d.isActive,
    lastSyncedAt: d.lastSyncedAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
  }));

  const radarHistory: AdminRadarHistoryRow[] = user.radarSearchHistory.map((h) => ({
    id: h.id,
    eventType: h.eventType,
    source: h.source,
    city: h.city,
    transactionType: h.transactionType,
    propertyType: h.propertyType,
    matchCount: h.matchCount,
    radius: h.radius,
    searchedAt: h.searchedAt.toISOString(),
    queryText: h.queryText,
  }));

  const lastLoginAt = user.lastLoginAt?.toISOString() ?? null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    planType: user.planType,
    isPro: user.isPro,
    proExpiresAt: user.proExpiresAt?.toISOString() ?? null,
    plusExpiresAt: user.plusExpiresAt?.toISOString() ?? null,
    companyName: user.companyName,
    nip: user.nip,
    isVerified: user.isVerified,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginIp: user.lastLoginIp ?? null,
    lastLoginAt,
    image: user.image,
    extraListings: user.extraListings,
    legacyPreferences: {
      searchType: user.searchType,
      searchTransactionType: user.searchTransactionType,
      searchDistricts: user.searchDistricts,
      searchMaxPrice: user.searchMaxPrice,
      searchAreaFrom: user.searchAreaFrom,
      searchAreaTo: user.searchAreaTo,
      searchPlotArea: user.searchPlotArea,
      searchRooms: user.searchRooms,
      buyerType: user.buyerType,
      searchAmenities: user.searchAmenities,
    },
    radar,
    radarHistory,
    discovery: user.discoveryProfile
      ? {
          likesCount: user.discoveryProfile.likesCount,
          dislikesCount: user.discoveryProfile.dislikesCount,
          fastTrackCount: user.discoveryProfile.fastTrackCount,
          opensCount: user.discoveryProfile.opensCount,
          cityStats: user.discoveryProfile.cityStats,
          districtStats: user.discoveryProfile.districtStats,
          propertyStats: user.discoveryProfile.propertyStats,
          updatedAt: user.discoveryProfile.updatedAt.toISOString(),
        }
      : null,
    devices,
    passkeysCount: user._count.Authenticator,
    sessionsCount: user._count.sessions,
    channels: resolveChannels({
      sessionsCount: user._count.sessions,
      devices,
      radarHistory,
      lastLoginAt,
    }),
    offers: user.offers,
    agencyMembership: user.agencyMembership
      ? {
          companyId: user.agencyMembership.company.id,
          companyName: user.agencyMembership.company.name,
          companySlug: user.agencyMembership.company.slug,
          memberRole: user.agencyMembership.role,
          agentTitle: user.agencyMembership.agentTitle,
          status: user.agencyMembership.status,
          isOfficeBoard:
            user.agencyMembership.role === 'ADMIN' ||
            user.agencyMembership.agentTitle === 'KIEROWNIK_BIURO' ||
            user.agencyMembership.agentTitle === 'ZASTEPCA_KIEROWNIKA',
        }
      : null,
  };
}
