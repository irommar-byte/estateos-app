import type { Locale } from "@/i18n/config";

export type OfferPageCopy = {
  backToMap: string;
  offerId: string;
  views: string;
  listedSince: string;
  renewedOn: string;
  agency: string;
  privateOwner: string;
  verified: string;
  verifiedHint: string;
  legalVerifiedKw: string;
  legalUnverifiedKw: string;
  legalVerifiedKwSublabel: string;
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
  country: string;
  city: string;
  locality: string;
  district: string;
  street: string;
  area: string;
  plotArea: string;
  pricePerSqm: string;
  priceInEur: string;
  pricePerSqmEur: string;
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
  costsSection: string;
  agentCommission: string;
  agentCommissionZero: string;
  commissionZeroBadge: string;
  commissionZeroTitle: string;
  commissionZeroSub: string;
  commissionPercent: string;
  commissionAmount: string;
  commissionCompany: string;
  openCompanyProfile: string;
  photoGalleryCount: string;
  negotiatorsOne: string;
  negotiatorsMany: (n: number) => string;
  contactDisabled: string;
  submitOffer: string;
  startNegotiations: string;
  proposeViewing: string;
  securedBy: string;
  authRequired: string;
  submitBid: string;
  listingPriceIncludesCommission: string;
};

const PL: OfferPageCopy = {
  backToMap: "← Powrót do mapy",
  offerId: "ID Oferty",
  views: "Odsłony",
  listedSince: "Dodano",
  renewedOn: "Odnowiono",
  agency: "Agencja",
  privateOwner: "Właściciel prywatny",
  verified: "Zweryfikowana",
  verifiedHint: "Odznaka jakości EstateOS",
  legalVerifiedKw: "Zweryfikowany",
  legalUnverifiedKw: "Niezweryfikowany",
  legalVerifiedKwSublabel: "EstateOS™ Quality Shield",
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
  country: "Państwo",
  city: "Miasto",
  locality: "Miejscowość",
  district: "Dzielnica",
  street: "Ulica",
  area: "Powierzchnia",
  plotArea: "Metraż działki",
  pricePerSqm: "Cena za m²",
  priceInEur: "Cena w EUR",
  pricePerSqmEur: "Cena za m² (EUR)",
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
  costsSection: "Koszty i prowizja",
  agentCommission: "Prowizja agenta",
  agentCommissionZero: "Brak prowizji agenta przy tej ofercie.",
  commissionZeroBadge: "Prowizja agenta",
  commissionZeroTitle: "ZERO PROWIZJI",
  commissionZeroSub:
    "Cena oferty nie zawiera prowizji pośrednika — atrakcyjna transakcja dla kupującego.",
  commissionPercent: "Prowizja %",
  commissionAmount: "Kwota prowizji",
  commissionCompany: "Firma obsługująca",
  openCompanyProfile: "Otwórz wizytówkę",
  photoGalleryCount: "Galeria · {n} zdjęć",
  negotiatorsOne: "1 osoba złożyła ofertę",
  negotiatorsMany: (n) => `${n} osoby złożyły ofertę`,
  contactDisabled: "Kontakt wyłączony",
  submitOffer: "Złóż ofertę",
  startNegotiations: "Rozpocznij negocjacje",
  proposeViewing: "Zaproponuj termin prezentacji",
  securedBy: "Zabezpieczone przez EstateOS™",
  authRequired: "Musisz być zalogowany, aby rozpocząć negocjacje.",
  submitBid: "Złóż ofertę",
  listingPriceIncludesCommission:
    "To finalna cena brutto: tyle widzisz, tyle płacisz — bez dopłat. Z tej kwoty rozliczana jest prowizja pośrednika wskazana w ofercie.",
};

const EN: OfferPageCopy = {
  backToMap: "← Back to map",
  offerId: "Listing ID",
  views: "Views",
  listedSince: "Listed",
  renewedOn: "Renewed",
  agency: "Agency",
  privateOwner: "Private owner",
  verified: "Verified",
  verifiedHint: "EstateOS quality badge",
  legalVerifiedKw: "Verified",
  legalUnverifiedKw: "Unverified",
  legalVerifiedKwSublabel: "EstateOS™ Quality Shield",
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
  country: "Country",
  city: "City",
  locality: "Town / locality",
  district: "District",
  street: "Street",
  area: "Area",
  plotArea: "Plot size",
  pricePerSqm: "Price per m²",
  priceInEur: "Price in EUR",
  pricePerSqmEur: "Price per m² (EUR)",
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
  costsSection: "Costs & commission",
  agentCommission: "Agent commission",
  agentCommissionZero: "No agent commission on this listing.",
  commissionZeroBadge: "Agent commission",
  commissionZeroTitle: "Zero commission",
  commissionZeroSub: "The listing price does not include agent commission — a better deal for the buyer.",
  commissionPercent: "Commission %",
  commissionAmount: "Commission amount",
  commissionCompany: "Handling company",
  openCompanyProfile: "Open profile card",
  photoGalleryCount: "Gallery · {n} photos",
  negotiatorsOne: "1 person submitted an offer",
  negotiatorsMany: (n) => `${n} people submitted offers`,
  contactDisabled: "Contact disabled",
  submitOffer: "Submit offer",
  startNegotiations: "Start negotiations",
  proposeViewing: "Propose a viewing",
  securedBy: "Secured by EstateOS™",
  authRequired: "You must be signed in to start negotiations.",
  submitBid: "Submit offer",
  listingPriceIncludesCommission:
    "This is the final gross price: what you see is what you pay, with no surcharge. The intermediary commission shown in this listing is settled from that amount.",
};

export function getOfferPageCopy(locale: Locale): OfferPageCopy {
  return locale === "pl" ? PL : EN;
}
