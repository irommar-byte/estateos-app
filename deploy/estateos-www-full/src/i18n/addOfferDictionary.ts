import type { Locale } from "./config";

export type AddOfferDictionary = {
  formBadge: string;
  title: string;
  titleHighlight: string;
  stepLabel: string;
  stepOf: string;
  stepExperience: string;
  sell: string;
  rent: string;
  step1Title: string;
  step2Title: string;
  step3Title: string;
  step4Title: string;
  step5Title: string;
  step6Title: string;
  conditionLabel: string;
  locationExact: string;
  locationApprox: string;
  locationVisibilityTitle: string;
  locationVisibilityBody: string;
  searchAddress: string;
  searchAddressPlaceholder: string;
  buildingNumberRequired: string;
  city: string;
  district: string;
  areaLabel: string;
  areaPlaceholder: string;
  apartmentNumber: string;
  apartmentPlaceholder: string;
  landRegistry: string;
  landRegistryPlaceholder: string;
  pinError: string;
  price: string;
  priceCurrency: string;
  pricePln: string;
  priceEur: string;
  nbpApprox: string;
  area: string;
  rooms: string;
  floor: string;
  description: string;
  descriptionPlaceholder: string;
  amenities: string;
  heating: string;
  photos: string;
  photosMain: string;
  photosUpload: string;
  photosError: string;
  photosDrag: string;
  agencyName: string;
  agencyPlaceholder: string;
  commission: string;
  prev: string;
  next: string;
  publish: string;
  publishing: string;
  limitReached: string;
  verifyAccount: string;
  serverError: string;
  serverErrorHint: string;
  propertyFlat: string;
  propertyHouse: string;
  propertyPlot: string;
  propertyCommercial: string;
  conditionReady: string;
  conditionRenovation: string;
  conditionDeveloper: string;
  amenityBalcony: string;
  amenityGarage: string;
  amenityStorage: string;
  amenityGarden: string;
  amenityDuplex: string;
  amenityElevator: string;
  amenityAc: string;
  heatingCity: string;
  heatingGas: string;
  heatingElectric: string;
  heatingHeatPump: string;
  heatingCoal: string;
  heatingOther: string;
  selectPlaceholder: string;
  mapLoading: string;
};

const pl: AddOfferDictionary = {
  formBadge: "Formularz EstateOS Premium",
  title: "Dodaj",
  titleHighlight: "Ofertę.",
  stepLabel: "Krok",
  stepOf: "z",
  stepExperience: "EstateOS Form Experience",
  sell: "Sprzedaż",
  rent: "Wynajem",
  step1Title: "Rodzaj Nieruchomości",
  step2Title: "Lokalizacja i Mapa",
  step3Title: "Parametry i Cena",
  step4Title: "Opis i Udogodnienia",
  step5Title: "Zdjęcia",
  step6Title: "Publikacja",
  conditionLabel: "Stan wykończenia",
  locationExact: "Dokładna (Szpilka)",
  locationApprox: "Przybliżona (Dysk)",
  locationVisibilityTitle: "Widoczność publiczna:",
  locationVisibilityBody:
    "Przy Dokładnej lokalizacji wyświetlimy nazwę ulicy (i nr budynku dla mieszkań). Przy Przybliżonej pokazujemy jedynie orientacyjny obszar dzielnicy.",
  searchAddress: "Wyszukaj Adres *",
  searchAddressPlaceholder: "Np. Główna 12...",
  buildingNumberRequired: "Wymagany numer budynku przed przecinkiem.",
  city: "Miasto *",
  district: "Dzielnica *",
  areaLabel: "Obszar / osiedle",
  areaPlaceholder: "Np. osiedle / sołectwo / część miasta",
  apartmentNumber: "Nr mieszkania",
  apartmentPlaceholder: "Np. 12",
  landRegistry: "Nr KW (opcjonalnie)",
  landRegistryPlaceholder: "Np. WA1M/00000000/0",
  pinError: "Nie udało się ustawić pinezki. Wybierz adres z listy podpowiedzi.",
  price: "Cena *",
  priceCurrency: "Waluta ceny",
  pricePln: "PLN",
  priceEur: "EUR",
  nbpApprox: "Przeliczenie orientacyjne (NBP):",
  area: "Powierzchnia (m²) *",
  rooms: "Liczba pokoi",
  floor: "Piętro",
  description: "Opis oferty",
  descriptionPlaceholder: "Rozpocznij tworzenie luksusowego opisu...",
  amenities: "Udogodnienia",
  heating: "Ogrzewanie",
  photos: "Galeria zdjęć",
  photosMain: "Główne",
  photosUpload: "Dodaj zdjęcia",
  photosError: "Błąd",
  photosDrag: "Przeciągnij zdjęcia lub kliknij, aby dodać",
  agencyName: "Nazwa biura",
  agencyPlaceholder: "Wpisz nazwę biura...",
  commission: "Prowizja agenta (%)",
  prev: "Wstecz",
  next: "Dalej",
  publish: "Opublikuj ofertę",
  publishing: "Publikuję…",
  limitReached: "Osiągnięto limit aktywnych ogłoszeń. Rozszerz plan w cenniku.",
  verifyAccount: "Zweryfikuj konto (e-mail i telefon), aby publikować oferty.",
  serverError: "Nie udało się zapisać oferty",
  serverErrorHint: "Sprawdź poprawność wprowadzonych danych.",
  propertyFlat: "Mieszkanie",
  propertyHouse: "Dom",
  propertyPlot: "Działka",
  propertyCommercial: "Lokal",
  conditionReady: "Gotowe",
  conditionRenovation: "Do remontu",
  conditionDeveloper: "Deweloperski",
  amenityBalcony: "Balkon",
  amenityGarage: "Garaż/Miejsce park.",
  amenityStorage: "Piwnica/Pom. gosp.",
  amenityGarden: "Ogródek",
  amenityDuplex: "Dwupoziomowe",
  amenityElevator: "Winda",
  amenityAc: "Klimatyzacja",
  heatingCity: "Miejskie",
  heatingGas: "Gazowe",
  heatingElectric: "Elektryczne",
  heatingHeatPump: "Pompa Ciepła",
  heatingCoal: "Węglowe/Pellet",
  heatingOther: "Inne",
  selectPlaceholder: "Wybierz...",
  mapLoading: "Ładowanie mapy…",
};

const en: AddOfferDictionary = {
  formBadge: "EstateOS Premium form",
  title: "Add",
  titleHighlight: "listing.",
  stepLabel: "Step",
  stepOf: "of",
  stepExperience: "EstateOS form experience",
  sell: "Sale",
  rent: "Rent",
  step1Title: "Property type",
  step2Title: "Location & map",
  step3Title: "Details & price",
  step4Title: "Description & amenities",
  step5Title: "Photos",
  step6Title: "Publish",
  conditionLabel: "Condition",
  locationExact: "Exact (pin)",
  locationApprox: "Approximate (area)",
  locationVisibilityTitle: "Public visibility:",
  locationVisibilityBody:
    "With exact location we show the street name (and building no. for flats). With approximate we show only the district area.",
  searchAddress: "Search address *",
  searchAddressPlaceholder: "e.g. Main St 12…",
  buildingNumberRequired: "Building number required before the comma.",
  city: "City *",
  district: "District *",
  areaLabel: "Area / estate",
  areaPlaceholder: "e.g. estate / village part",
  apartmentNumber: "Flat no.",
  apartmentPlaceholder: "e.g. 12",
  landRegistry: "Land registry no. (optional)",
  landRegistryPlaceholder: "e.g. WA1M/00000000/0",
  pinError: "Could not place pin. Pick an address from suggestions.",
  price: "Price *",
  priceCurrency: "Price currency",
  pricePln: "PLN",
  priceEur: "EUR",
  nbpApprox: "Indicative conversion (NBP):",
  area: "Area (m²) *",
  rooms: "Rooms",
  floor: "Floor",
  description: "Listing description",
  descriptionPlaceholder: "Start writing your listing description…",
  amenities: "Amenities",
  heating: "Heating",
  photos: "Photo gallery",
  photosMain: "Main",
  photosUpload: "Add photos",
  photosError: "Error",
  photosDrag: "Drag photos or click to add",
  agencyName: "Agency name",
  agencyPlaceholder: "Enter agency name…",
  commission: "Agent commission (%)",
  prev: "Back",
  next: "Next",
  publish: "Publish listing",
  publishing: "Publishing…",
  limitReached: "Active listing limit reached. Upgrade on the pricing page.",
  verifyAccount: "Verify email and phone to publish listings.",
  serverError: "Could not save listing",
  serverErrorHint: "Check the data you entered.",
  propertyFlat: "Apartment",
  propertyHouse: "House",
  propertyPlot: "Plot",
  propertyCommercial: "Commercial",
  conditionReady: "Ready to move in",
  conditionRenovation: "Needs renovation",
  conditionDeveloper: "Developer standard",
  amenityBalcony: "Balcony",
  amenityGarage: "Garage / parking",
  amenityStorage: "Storage",
  amenityGarden: "Garden",
  amenityDuplex: "Duplex",
  amenityElevator: "Elevator",
  amenityAc: "Air conditioning",
  heatingCity: "District heating",
  heatingGas: "Gas",
  heatingElectric: "Electric",
  heatingHeatPump: "Heat pump",
  heatingCoal: "Coal / pellet",
  heatingOther: "Other",
  selectPlaceholder: "Select…",
  mapLoading: "Loading map…",
};

export function getAddOfferDictionary(locale: Locale): AddOfferDictionary {
  return locale === "en" ? en : pl;
}

/** Klucze udogodnień → pole słownika */
export const AMENITY_DICT_KEYS = [
  "amenityBalcony",
  "amenityGarage",
  "amenityStorage",
  "amenityGarden",
  "amenityDuplex",
  "amenityElevator",
  "amenityAc",
] as const;

export const HEATING_DICT_KEYS = [
  "heatingCity",
  "heatingGas",
  "heatingElectric",
  "heatingHeatPump",
  "heatingCoal",
  "heatingOther",
] as const;
