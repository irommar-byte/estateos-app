import { create } from 'zustand';

/**
 * Gate przed nawigacją z kreatora "Dodaj ofertę".
 *
 * Wywoływany ZAWSZE przez `FloatingNextButton` (główny FAB w tab barze) oraz
 * przez `AddOfferStepper` (numerki 1..6) zanim wykonają `navigation.navigate`.
 *
 * Jeśli gate zwróci `false`, to znaczy że bieżący ekran:
 *  - przejął kontrolę nad nawigacją (np. otworzył modal potwierdzenia),
 *  - sam wykona finalny `navigate` po decyzji usera.
 *
 * Jeśli zwróci `true` (lub gate nie jest zarejestrowany) — nawigacja idzie
 * standardową ścieżką.
 */
type NavigationGate = (targetStep: number) => boolean;

interface OfferStore {
  currentStep: number;
  draft: any;
  navigationGate: NavigationGate | null;
  setCurrentStep: (step: number) => void;
  updateDraft: (data: any) => void;
  resetDraft: () => void;
  setNavigationGate: (gate: NavigationGate | null) => void;
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
  /**
   * Prowizja agenta (procent, np. "2.5"). Pole widoczne w kreatorze TYLKO gdy
   * user.role === 'AGENT' — dla osób prywatnych zostaje pusty string (backend
   * traktuje jako null). Z ceny ofertowej nic nie jest doliczane, kwota
   * prowizji jest informacyjnie pokazywana kupującemu w OfferDetail.
   */
  agentCommissionPercent: '',
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
  navigationGate: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  updateDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  resetDraft: () => set({ 
    currentStep: 0, 
    draft: initialDraft 
  }),
  setNavigationGate: (gate) => set({ navigationGate: gate }),
}));
