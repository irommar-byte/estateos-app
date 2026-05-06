import { create } from 'zustand';

interface OfferStore {
  currentStep: number;
  draft: any;
  setCurrentStep: (step: number) => void;
  updateDraft: (data: any) => void;
  resetDraft: () => void;
}

// CZYSTE MAPOWANIE 1:1 Z MYSQL (Bez petsAllowed i airConditioning)
const initialDraft = {
  // Krok 1 & 2: Podstawy i Lokalizacja
  title: '',
  description: '',
  transactionType: 'SALE',
  propertyType: 'APARTMENT',
  condition: null,
  city: 'Warszawa',
  district: 'OTHER',
  street: '',
  buildingNumber: '',
  lat: null,
  lng: null,
  isExactLocation: true,

  // Krok 3: Finanse i Wymiary
  price: '',
  adminFee: '',
  deposit: '',
  area: '',
  plotArea: '',
  rooms: '',
  floor: '',
  totalFloors: '',
  yearBuilt: '',

  // Krok 4: Udogodnienia
  heating: '',
  hasBalcony: false,
  hasElevator: false,
  hasStorage: false,
  hasParking: false,
  hasGarden: false,
  isFurnished: false,
  apartmentNumber: '',
  landRegistryNumber: '',

  // Krok 5: Media
  images: [],
  /** Rozmiary plików (bajty) wg URI — suma MB i limit bez „znikania” po nawigacji */
  imageByteSizes: {} as Record<string, number>,
  videoUrl: '',
  floorPlanUrl: ''
};

export const useOfferStore = create<OfferStore>((set) => ({
  currentStep: 0,
  draft: initialDraft,
  setCurrentStep: (step) => set({ currentStep: step }),
  updateDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  resetDraft: () => set({ 
    currentStep: 0, 
    draft: initialDraft 
  }),
}));
