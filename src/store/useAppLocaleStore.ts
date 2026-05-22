import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '../i18n/types';
import {
  resolveAppLocale,
  resolveEffectiveLocale,
  type AppLocalePreference,
} from '../i18n/resolveLocale';
import { setAppLocale } from '../i18n/translate';

export type { AppLocalePreference };

const STORAGE_KEY = '@estateos_app_locale_v1';

type State = {
  preference: AppLocalePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: AppLocalePreference) => Promise<void>;
};

function applyLocale(preference: AppLocalePreference): void {
  setAppLocale(resolveEffectiveLocale(preference));
}

export const useAppLocaleStore = create<State>((set, get) => ({
  preference: 'system',
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw === 'system' || raw === 'pl' || raw === 'en' || raw === 'ru') {
        set({ preference: raw, hydrated: true });
        applyLocale(raw);
        return;
      }
    } catch {
      // noop
    }
    const initial = 'system' as const;
    set({ preference: initial, hydrated: true });
    applyLocale(initial);
  },
  setPreference: async (preference) => {
    set({ preference });
    applyLocale(preference);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // noop
    }
  },
}));

/** Bieżący język UI (po uwzględnieniu preferencji użytkownika). */
export function getEffectiveAppLocale(): AppLocale {
  return resolveEffectiveLocale(useAppLocaleStore.getState().preference);
}

/** Tylko do podpowiedzi w profilu — język urządzenia bez zapisanej preferencji. */
export function getDeviceAppLocale(): AppLocale {
  return resolveAppLocale();
}
