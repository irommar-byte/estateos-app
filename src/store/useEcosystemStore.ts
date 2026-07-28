import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EcosystemVertical = 'home' | 'car';

export type EcosystemSwitchRequest = {
  from: EcosystemVertical;
  to: EcosystemVertical;
};

type EcosystemState = {
  activeVertical: EcosystemVertical;
  pendingSwitch: EcosystemSwitchRequest | null;
  /** When true, Homes↔Cars skips the full-screen transition (favorites browse). */
  skipVerticalTransition: boolean;
  setActiveVertical: (vertical: EcosystemVertical) => void;
  setSkipVerticalTransition: (skip: boolean) => void;
  requestVerticalSwitch: (to: EcosystemVertical) => void;
  clearVerticalSwitch: () => void;
};

export const useEcosystemStore = create<EcosystemState>()(
  persist(
    (set, get) => ({
      activeVertical: 'home',
      pendingSwitch: null,
      skipVerticalTransition: false,
      setActiveVertical: (vertical) => set({ activeVertical: vertical }),
      setSkipVerticalTransition: (skipVerticalTransition) => set({ skipVerticalTransition }),
      requestVerticalSwitch: (to) => {
        const from = get().activeVertical;
        if (from === to || get().pendingSwitch) return;
        // Ulubione: switch vertical instantly — no crest / sweep animation.
        if (get().skipVerticalTransition) {
          set({ activeVertical: to, pendingSwitch: null });
          return;
        }
        set({ pendingSwitch: { from, to } });
      },
      clearVerticalSwitch: () => set({ pendingSwitch: null }),
    }),
    {
      name: 'estateos-ecosystem-vertical',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeVertical: state.activeVertical }),
    },
  ),
);
