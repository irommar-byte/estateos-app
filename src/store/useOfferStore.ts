import { create } from 'zustand';

interface OfferStore {
  currentStep: number;
  draft: any;
  setCurrentStep: (step: number) => void;
  updateDraft: (data: any) => void;
  resetDraft: () => void;
}

// Zabezpieczony, pełny szablon pustej oferty
const initialDraft = {
  images: [], 
  title: '', 
  price: '', 
  rent: '', 
  area: '', 
  city: '', 
  district: '', 
  propertyType: '', 
  transactionType: '', 
  condition: '',
  rooms: ''
};

export const useOfferStore = create<OfferStore>((set) => ({
  currentStep: 0,
  draft: initialDraft,
  setCurrentStep: (step) => set({ currentStep: step }),
  updateDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  
  // Czyszczenie po opublikowaniu - nazwane tak, jak chce tego Krok 6
  resetDraft: () => set({ 
    currentStep: 0, 
    draft: initialDraft 
  }),
}));
