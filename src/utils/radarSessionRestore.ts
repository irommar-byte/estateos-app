import { API_URL } from '../config/network';
import type { RadarFilters } from '../components/RadarCalibrationModal';
import { OFFER_YEAR_BUILT_MIN } from '../lib/offerYearBuilt';
import { registerPushNotifications } from '../hooks/usePushNotifications';
import { saveRadarCommittedState } from './radarCommittedStorage';
import {
  fetchRadarPreferenceForUser,
  radarFiltersFromApiPreference,
  type RadarMapBounds,
} from './radarPreferenceSync';

/** Minimalne domyślne filtry do hydracji z API (login / restore). */
export const RADAR_SESSION_DEFAULT_FILTERS: RadarFilters = {
  calibrationMode: 'CITY',
  transactionType: 'SELL',
  propertyType: 'ALL',
  city: 'Warszawa',
  selectedDistricts: [],
  maxPrice: 0,
  minArea: 0,
  minYear: OFFER_YEAR_BUILT_MIN,
  requireBalcony: false,
  requireGarden: false,
  requireElevator: false,
  requireParking: false,
  requireFurnished: false,
  requireTwoLevel: false,
  pushNotifications: false,
  matchThreshold: 66,
  favoritesNotifyPriceChange: true,
  favoritesNotifyDealProposals: true,
  favoritesNotifyIncludeAmounts: false,
  favoritesNotifyStatusChange: true,
  favoritesNotifyNewSimilar: true,
};

export type RestoredRadarSession = {
  filters: RadarFilters;
  mapBounds: RadarMapBounds | null;
  active: boolean;
};

/**
 * Po loginie / restoreSession / reinstalacji: serwer (jak WWW kalibracja) jest źródłem prawdy.
 */
export async function restoreRadarSessionFromServer(params: {
  userId: number;
  token: string | null | undefined;
  defaults?: RadarFilters;
  setRadarActive: (isActive: boolean) => Promise<void>;
}): Promise<RestoredRadarSession | null> {
  const userId = Number(params.userId);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const pref = await fetchRadarPreferenceForUser(API_URL, userId, params.token);
  if (!pref) return null;

  const defaults = params.defaults || RADAR_SESSION_DEFAULT_FILTERS;
  const { filters: fromApi, mapBounds } = radarFiltersFromApiPreference(pref, defaults);
  const active = pref.pushNotifications !== false;
  const filters: RadarFilters = { ...fromApi, pushNotifications: active };

  await params.setRadarActive(active);
  await saveRadarCommittedState({
    userId,
    filters,
    mapBounds,
    areaSummary: mapBounds
      ? `${filters.city || 'Obszar'} · ${mapBounds.radiusKm} km`
      : filters.city
        ? String(filters.city)
        : '',
    committedAtIso: new Date().toISOString(),
  });

  if (active && params.token) {
    void registerPushNotifications(params.token, { showPrompt: true });
  }

  return { filters, mapBounds, active };
}
