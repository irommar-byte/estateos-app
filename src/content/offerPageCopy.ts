import type { Locale } from "@/i18n/config";

export type OfferPageCopy = {
  backToMap: string;
  offerId: string;
  views: string;
  listedSince: string;
  agency: string;
  privateOwner: string;
  verified: string;
  verifiedHint: string;
  legalVerifiedKw: string;
  newOfferBadge: string;
  pendingReview: string;
  pendingHint: string;
  notVerified: string;
  notVerifiedHint: string;
  beforeLaunchTitle: string;
  archivedTitle: string;
  archivedSubtitle: string;
  lockTitle: string;
  lockBody: string;
  unlockPro: string;
  noData: string;
  hiddenLocation: string;
  hiddenPrice: string;
  city: string;
  district: string;
  street: string;
  area: string;
  pricePerSqm: string;
  rooms: string;
  floor: string;
  standard: string;
  buildingType: string;
  buildYear: string;
  heating: string;
  furnished: string;
  furnishedYes: string;
  furnishedNo: string;
  rentFee: string;
  availability: string;
  aboutProperty: string;
  amenities: string;
  floorPlan: string;
  enlarge: string;
  locationSection: string;
  mainParamsSection: string;
  buildingSection: string;
  agentCommission: string;
  agentCommissionZero: string;
  negotiatorsOne: string;
  negotiatorsMany: (n: number) => string;
  contactDisabled: string;
  submitOffer: string;
  startNegotiations: string;
  proposeViewing: string;
  securedBy: string;
  authRequired: string;
  submitBid: string;
};

const PL: OfferPageCopy = {
  backToMap: "← Powrót do mapy",
  offerId: "ID Oferty",
  views: "Odsłony",
  listedSince: "Dodano",
  agency: "Agencja",
  privateOwner: "Właściciel prywatny",
  verified: "Zweryfikowana",
  verifiedHint: "Odznaka jakości EstateOS",
  legalVerifiedKw: "zweryfikowane",
  newOfferBadge: "NOWA OFERTA",
  pendingReview: "Weryfikacja w toku",
  pendingHint: "Sprawdzamy dokumenty",
  notVerified: "Bez pełnej weryfikacji",
  notVerifiedHint: "Brak pełnej weryfikacji dokumentów",
  beforeLaunchTitle: "Przed rynkiem",
  archivedTitle: "Nieaktualne",
  archivedSubtitle: "Oferta została zarchiwizowana",
  lockTitle: "Przedpremierowy dostęp",
  lockBody:
    "Przez pierwsze 24 godziny od publikacji szczegóły i adres ukryte są dla rynku. Jako użytkownik PRO masz wgląd do nich natychmiast.",
  unlockPro: "Odblokuj dostęp PRO",
  noData: "Brak danych",
  hiddenLocation: "Ukryta do premiery",
  hiddenPrice: "Ukryta",
  city: "Miasto",
  district: "Dzielnica",
  street: "Ulica",
  area: "Powierzchnia",
  pricePerSqm: "Cena za m²",
  rooms: "Pokoje",
  floor: "Piętro",
  standard: "Standard",
  buildingType: "Typ obiektu",
  buildYear: "Rok budowy",
  heating: "Ogrzewanie",
  furnished: "Umeblowane",
  furnishedYes: "Tak",
  furnishedNo: "Nie",
  rentFee: "Czynsz",
  availability: "Dostępność",
  aboutProperty: "O nieruchomości",
  amenities: "Udogodnienia",
  floorPlan: "Rzut lokalu",
  enlarge: "Powiększ",
  locationSection: "Lokalizacja",
  mainParamsSection: "Główne parametry",
  buildingSection: "Budynek i koszty",
  agentCommission: "Prowizja agenta",
  agentCommissionZero: "Brak prowizji agenta przy tej ofercie.",
  negotiatorsOne: "1 osoba złożyła ofertę",
  negotiatorsMany: (n) => `${n} osoby złożyły ofertę`,
  contactDisabled: "Kontakt wyłączony",
  submitOffer: "Złóż ofertę",
  startNegotiations: "Rozpocznij negocjacje",
  proposeViewing: "Zaproponuj termin prezentacji",
  securedBy: "Zabezpieczone przez EstateOS™",
  authRequired: "Musisz być zalogowany, aby rozpocząć negocjacje.",
  submitBid: "Złóż ofertę",
};

const EN: OfferPageCopy = {
  backToMap: "← Back to map",
  offerId: "Listing ID",
  views: "Views",
  listedSince: "Listed",
  agency: "Agency",
  privateOwner: "Private owner",
  verified: "Verified",
  verifiedHint: "EstateOS quality badge",
  legalVerifiedKw: "verified",
  newOfferBadge: "NEW LISTING",
  pendingReview: "Verification in progress",
  pendingHint: "We are reviewing documents",
  notVerified: "Not fully verified",
  notVerifiedHint: "Full document verification missing",
  beforeLaunchTitle: "Before market launch",
  archivedTitle: "Archived",
  archivedSubtitle: "This listing has been archived",
  lockTitle: "Pre-market access",
  lockBody:
    "For the first 24 hours after publishing, details and address are hidden from the open market. PRO users see everything immediately.",
  unlockPro: "Unlock with PRO",
  noData: "No data",
  hiddenLocation: "Hidden until launch",
  hiddenPrice: "Hidden",
  city: "City",
  district: "District",
  street: "Street",
  area: "Area",
  pricePerSqm: "Price per m²",
  rooms: "Rooms",
  floor: "Floor",
  standard: "Finish standard",
  buildingType: "Property type",
  buildYear: "Year built",
  heating: "Heating",
  furnished: "Furnished",
  furnishedYes: "Yes",
  furnishedNo: "No",
  rentFee: "Service charge",
  availability: "Availability",
  aboutProperty: "About the property",
  amenities: "Amenities",
  floorPlan: "Floor plan",
  enlarge: "Enlarge",
  locationSection: "Location",
  mainParamsSection: "Main parameters",
  buildingSection: "Building & costs",
  agentCommission: "Agent commission",
  agentCommissionZero: "No agent commission on this listing.",
  negotiatorsOne: "1 person submitted an offer",
  negotiatorsMany: (n) => `${n} people submitted offers`,
  contactDisabled: "Contact disabled",
  submitOffer: "Submit offer",
  startNegotiations: "Start negotiations",
  proposeViewing: "Propose a viewing",
  securedBy: "Secured by EstateOS™",
  authRequired: "You must be signed in to start negotiations.",
  submitBid: "Submit offer",
};

export function getOfferPageCopy(locale: Locale): OfferPageCopy {
  return locale === "pl" ? PL : EN;
}
