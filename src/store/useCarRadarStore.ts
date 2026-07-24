import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  EMPTY_CARS_ADVANCED_FILTERS,
  type CarsAdvancedFilters,
} from '../utils/carsAdvancedFilters';

const ACTIVE_KEY = '@estateos_car_radar_active';
const FILTERS_KEY = '@estateos_car_radar_filters';

type CarRadarState = {
  isCarRadarActive: boolean;
  carRadarFilters: CarsAdvancedFilters;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCarRadarActive: (active: boolean) => Promise<void>;
  commitCarRadarFilters: (filters: CarsAdvancedFilters, activate?: boolean) => Promise<void>;
};

export const useCarRadarStore = create<CarRadarState>((set, get) => ({
  isCarRadarActive: false,
  carRadarFilters: EMPTY_CARS_ADVANCED_FILTERS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [activeRaw, filtersRaw] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_KEY),
        AsyncStorage.getItem(FILTERS_KEY),
      ]);
      let filters = EMPTY_CARS_ADVANCED_FILTERS;
      if (filtersRaw) {
        try {
          filters = { ...EMPTY_CARS_ADVANCED_FILTERS, ...(JSON.parse(filtersRaw) as CarsAdvancedFilters) };
        } catch {
          filters = EMPTY_CARS_ADVANCED_FILTERS;
        }
      }
      set({
        isCarRadarActive: activeRaw === '1',
        carRadarFilters: filters,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setCarRadarActive: async (active) => {
    set({ isCarRadarActive: active });
    try {
      await AsyncStorage.setItem(ACTIVE_KEY, active ? '1' : '0');
    } catch {
      /* ignore */
    }
  },

  commitCarRadarFilters: async (filters, activate = true) => {
    set({
      carRadarFilters: filters,
      isCarRadarActive: activate ? true : get().isCarRadarActive,
    });
    try {
      await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
      if (activate) await AsyncStorage.setItem(ACTIVE_KEY, '1');
    } catch {
      /* ignore */
    }
  },
}));
