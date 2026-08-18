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
  /** Po udanej publikacji — wejście na zakładkę „Dodaj” zaczyna od Step1. */
  needsFreshAddOfferEntry: boolean;
  navigationGate: NavigationGate | null;
  setCurrentStep: (step: number) => void;
  updateDraft: (data: any) => void;
  resetDraft: () => void;
  clearFreshAddOfferEntry: () => void;
  setNavigationGate: (gate: NavigationGate | null) => void;
}

// CZYSTE MAPOWANIE 1:1 Z MYSQL (Bez petsAllowed i airConditioning)
const initialDraft = {
  // Krok 1 & 2: Podstawy i Lokalizacja
  title: '',
  description: '',
  /** Puste — user wybiera sam w Kroku 1 (po kolei: cel → typ → stan). */
  transactionType: '',
  propertyType: '',
  condition: null,
  city: 'Warszawa',
  district: 'Bemowo',
  /** Państwo miejscowości (geokodowanie), np. Polska, Ukraina */
  localityCountry: 'Polska',
  localityCountryCode: 'PL',
  street: '',
  buildingNumber: '',
  lat: null,
  lng: null,
  isExactLocation: true,

  // Krok 3: Finanse i Wymiary
  /** Waluta wpisywanej ceny oferty (PLN | EUR). */
  priceCurrency: 'PLN',
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
  isTwoLevel: false,
  isFurnished: false,
  apartmentNumber: '',
  landRegistryNumber: '',

  // Krok 5: Media
  images: [],
  /** Rozmiary plików (bajty) wg URI — suma MB i limit bez „znikania” po nawigacji */
  imageByteSizes: {} as Record<string, number>,
  videoUrl: '',
  floorPlanUrl: '',
  floorPlan: null as string | null,
  floorPlan3d: null as string | null,
  floorPlanScanMeta: null as string | null,
  propertyRoomScans: [],
  wholePropertyScan: null,
};

export const useOfferStore = create<OfferStore>((set) => ({
  currentStep: 0,
  draft: initialDraft,
  needsFreshAddOfferEntry: false,
  navigationGate: null,
  setCurrentStep: (step) =>
    set((state) => (state.currentStep === step ? state : { currentStep: step })),
  updateDraft: (data) =>
    set((state) => {
      if (!data || typeof data !== 'object') return state;
      const keys = Object.keys(data);
      if (keys.length === 0) return state;

      const sameValue = (prev: unknown, next: unknown): boolean => {
        if (Object.is(prev, next)) return true;
        if (Array.isArray(prev) && Array.isArray(next)) {
          return prev.length === next.length && prev.every((v, i) => Object.is(v, next[i]));
        }
        if (
          prev &&
          next &&
          typeof prev === 'object' &&
          typeof next === 'object' &&
          !Array.isArray(prev) &&
          !Array.isArray(next)
        ) {
          try {
            return JSON.stringify(prev) === JSON.stringify(next);
          } catch {
            return false;
          }
        }
        return false;
      };

      if (keys.every((k) => sameValue(state.draft[k], (data as Record<string, unknown>)[k]))) {
        return state;
      }
      return { draft: { ...state.draft, ...data } };
    }),
  resetDraft: () =>
    set({
      currentStep: 0,
      needsFreshAddOfferEntry: true,
      draft: { ...initialDraft, images: [], imageByteSizes: {} },
    }),
  clearFreshAddOfferEntry: () =>
    set((state) => (state.needsFreshAddOfferEntry ? { needsFreshAddOfferEntry: false } : state)),
  setNavigationGate: (gate) => set({ navigationGate: gate }),
}));
