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
  setActiveVertical: (vertical: EcosystemVertical) => void;
  requestVerticalSwitch: (to: EcosystemVertical) => void;
  clearVerticalSwitch: () => void;
};

export const useEcosystemStore = create<EcosystemState>()(
  persist(
    (set, get) => ({
      activeVertical: 'home',
      pendingSwitch: null,
      setActiveVertical: (vertical) => set({ activeVertical: vertical }),
      requestVerticalSwitch: (to) => {
        const from = get().activeVertical;
        if (from === to || get().pendingSwitch) return;
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
