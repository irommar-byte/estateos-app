import { API_URL } from '../config/network';
import { registerPushNotifications } from '../hooks/usePushNotifications';
import { EMPTY_CARS_ADVANCED_FILTERS, type CarsAdvancedFilters } from './carsAdvancedFilters';
import {
  carRadarFiltersFromApiPreference,
  fetchCarRadarPreferenceForUser,
} from './carRadarPreferenceSync';

export type RestoredCarRadarSession = {
  filters: CarsAdvancedFilters;
  active: boolean;
};

/**
 * Po loginie / restoreSession: serwer jest źródłem prawdy dla radaru aut.
 * Wylogowanie nie gasi `enabled` na backendzie — po ponownym logowaniu radar wraca.
 */
export async function restoreCarRadarSessionFromServer(params: {
  userId: number;
  token: string | null | undefined;
  setCarRadarActive: (active: boolean) => Promise<void>;
  commitCarRadarFilters: (filters: CarsAdvancedFilters, activate?: boolean) => Promise<void>;
}): Promise<RestoredCarRadarSession | null> {
  const userId = Number(params.userId);
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const pref = await fetchCarRadarPreferenceForUser(API_URL, userId, params.token);
  if (!pref) return null;

  const filters = carRadarFiltersFromApiPreference(pref, EMPTY_CARS_ADVANCED_FILTERS);
  const isActive = pref.enabled === true;
  const withPush: CarsAdvancedFilters = {
    ...filters,
    pushNotifications: pref.pushNotifications !== false,
  };

  await params.commitCarRadarFilters(withPush, isActive);
  if (!isActive) {
    await params.setCarRadarActive(false);
  }

  if (isActive && params.token && withPush.pushNotifications) {
    void registerPushNotifications(params.token, { showPrompt: true });
  }

  return { filters: withPush, active: isActive };
}
