import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EcosystemVertical = 'home' | 'car';

type EcosystemState = {
  activeVertical: EcosystemVertical;
  setActiveVertical: (vertical: EcosystemVertical) => void;
};

export const useEcosystemStore = create<EcosystemState>()(
  persist(
    (set) => ({
      activeVertical: 'home',
      setActiveVertical: (vertical) => set({ activeVertical: vertical }),
    }),
    {
      name: 'estateos-ecosystem-vertical',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
