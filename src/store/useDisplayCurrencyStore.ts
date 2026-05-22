import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DisplayCurrencyPreference } from '../money/types';

const STORAGE_KEY = '@estateos_display_currency_v1';

type State = {
  preference: DisplayCurrencyPreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (p: DisplayCurrencyPreference) => Promise<void>;
};

export const useDisplayCurrencyStore = create<State>((set, get) => ({
  preference: 'PLN',
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw === 'PLN' || raw === 'EUR' || raw === 'LISTING') {
        set({ preference: raw, hydrated: true });
        return;
      }
    } catch {
      // noop
    }
    set({ hydrated: true });
  },
  setPreference: async (p) => {
    set({ preference: p });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    } catch {
      // noop
    }
  },
}));
