import { create } from 'zustand';

interface OfferStore {
  step: number;
  data: any;
  setStep: (step: number) => void;
  updateData: (newData: any) => void;
}

export const useOfferStore = create<OfferStore>((set) => ({
  step: 1,
  data: {},
  setStep: (step) => set({ step }),
  updateData: (newData) => set((state) => ({ data: { ...state.data, ...newData } })),
}));
