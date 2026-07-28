import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Shared EstateOS™ Favor prefs — Homes + Cars heart mode use one calibration. */
export type FavoritesFavorPrefs = {
  enabled: boolean;
  notifyPriceChange: boolean;
  notifyDealProposals: boolean;
  notifyStatusChange: boolean;
  notifyNewSimilar: boolean;
};

type FavoritesFavorState = FavoritesFavorPrefs & {
  /** Heart mode active on Market (survives Homes↔Cars without screen transition). */
  browseActive: boolean;
  setBrowseActive: (active: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  applyPrefs: (prefs: Partial<FavoritesFavorPrefs>) => void;
};

const defaults: FavoritesFavorPrefs = {
  enabled: false,
  notifyPriceChange: true,
  notifyDealProposals: true,
  notifyStatusChange: true,
  notifyNewSimilar: true,
};

export const useFavoritesFavorStore = create<FavoritesFavorState>()(
  persist(
    (set) => ({
      ...defaults,
      browseActive: false,
      setBrowseActive: (browseActive) => set({ browseActive }),
      setEnabled: (enabled) => set({ enabled }),
      applyPrefs: (prefs) => set((s) => ({ ...s, ...prefs })),
    }),
    {
      name: 'estateos-favorites-favor',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        enabled: s.enabled,
        notifyPriceChange: s.notifyPriceChange,
        notifyDealProposals: s.notifyDealProposals,
        notifyStatusChange: s.notifyStatusChange,
        notifyNewSimilar: s.notifyNewSimilar,
      }),
    },
  ),
);
