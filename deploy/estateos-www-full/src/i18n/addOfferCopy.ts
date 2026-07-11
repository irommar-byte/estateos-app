import type { Locale } from "./config";
import { addOfferCopyUk } from "./addOfferCopyUk";

export type AddOfferCopy = {
  badge: string;
  title: string;
  titleAccent: string;
  stepProgress: string;
  formExperience: string;
  transactionSell: string;
  transactionRent: string;
  step1Title: string;
  propertyFlat: string;
  propertyHouse: string;
  propertyPlot: string;
  propertyCommercial: string;
  conditionLabel: string;
  conditionReady: string;
  conditionRenovation: string;
  conditionDeveloper: string;
  step2Title: string;
  locationExact: string;
  locationApproximate: string;
  locationVisibilityTitle: string;
  locationVisibilityBody: string;
  searchAddress: string;
  searchAddressPlaceholder: string;
  buildingNumberRequired: string;
  city: string;
  district: string;
  districtArea: string;
  selectPlaceholder: string;
  areaPlaceholder: string;
  docVerificationTitle: string;
  apartmentNumber: string;
  landRegistryNumber: string;
  docVerificationHint: string;
  step3Title: string;
  priceCurrency: string;
  rentPriceLabel: string;
  salePriceLabel: string;
  area: string;
  plotArea: string;
  rooms: string;
  floor: string;
  floorGround: string;
  buildYear: string;
  heating: string;
  heatingSelect: string;
  furnished: string;
  furnishedYes: string;
  furnishedNo: string;
  adminFee: string;
  adminFeeOptional: string;
  agentCommissionLabel: string;
  agentCommissionHint: string;
  agentCommissionPlaceholder: string;
  aiValuationLabel: string;
  aiMarketDeal: string;
  aiPremium: string;
  aiLuxury: string;
  step4Title: string;
  titleLabel: string;
  titlePlaceholder: string;
  titleMinHint: string;
  galleryLabel: string;
  galleryAdd: string;
  galleryHint: string;
  galleryUsed: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  aiAssistant: string;
  aiGenerating: string;
  floorPlan: string;
  floorPlanUpload: string;
  rentDetailsTitle: string;
  rentTypeLabel: string;
  rentTypePlaceholder: string;
  petsAllowed: string;
  amenitiesLabel: string;
  amenityBalcony: string;
  amenityGarage: string;
  amenityStorage: string;
  amenityGarden: string;
  amenityDuplex: string;
  amenityElevator: string;
  amenityAc: string;
  step5Title: string;
  advertiserPrivate: string;
  advertiserAgency: string;
  agencyNameLabel: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactPassword: string;
  verificationBannerTitle: string;
  verificationBannerBody: string;
  verificationBannerCta: string;
  submit: string;
  submitIncomplete: string;
  submitProcessing: string;
  back: string;
  next: string;
  stepIncompleteHint: string;
  uploadSending: string;
  uploadCreating: string;
  uploadPhotoProgress: string;
  uploadFloorPlan: string;
  errorMapToken: string;
  errorPinFailed: string;
  errorUploadPhoto: string;
  errorUploadFloorPlan: string;
  errorServerRejected: string;
  errorServerConnection: string;
  errorImagesNotUploaded: string;
  modalVerifyTitle: string;
  modalVerifyBody: string;
  modalVerifyCta: string;
  modalClose: string;
  modalSuccessTitle: string;
  modalSuccessBody: string;
  modalSuccessCta: string;
  modalErrorTitle: string;
  modalErrorBody: string;
  modalErrorCta: string;
  modalLimitTitle: string;
  modalLimitBadge: string;
  modalLimitBody: string;
  modalLimitCta: string;
  modalLimitLoading: string;
  modalLimitAutopublish: string;
  modalProWelcome: string;
  modalProStart: string;
  modalPlusBadge: string;
  modalPlusTitle: string;
  modalPlusBody: string;
  thumbnailAlt: string;
  mainPhoto: string;
  heatingMunicipal: string;
  heatingGas: string;
  heatingElectric: string;
  heatingHeatPump: string;
  heatingCoal: string;
  heatingOther: string;
};

const pl: AddOfferCopy = {
  badge: "Formularz EstateOS Premium",
  title: "Dodaj",
  titleAccent: "Ofertę.",
  stepProgress: "Krok {current} z {total}",
  formExperience: "EstateOS Form Experience",
  transactionSell: "Sprzedaż",
  transactionRent: "Wynajem",
  step1Title: "Rodzaj Nieruchomości",
  propertyFlat: "Mieszkanie",
  propertyHouse: "Dom",
  propertyPlot: "Działka",
  propertyCommercial: "Lokal",
  conditionLabel: "Standard wykończenia",
  conditionReady: "Gotowe",
  conditionRenovation: "Do remontu",
  conditionDeveloper: "Deweloperski",
  step2Title: "Lokalizacja i Mapa",
  locationExact: "Dokładna (Szpilka)",
  locationApproximate: "Przybliżona (Dysk)",
  locationVisibilityTitle: "Widoczność lokalizacji",
  locationVisibilityBody:
    "Dokładna lokalizacja pokazuje pin na mapie. Przybliżona ukrywa numer budynku przed publikacją.",
  searchAddress: "Wyszukaj adres",
  searchAddressPlaceholder: "Ulica, numer, miasto…",
  buildingNumberRequired: "Podaj numer budynku dla dokładnej lokalizacji.",
  city: "Miasto",
  district: "Dzielnica",
  districtArea: "Obszar / osiedle",
  selectPlaceholder: "Wybierz…",
  areaPlaceholder: "np. Mokotów",
  docVerificationTitle: "Weryfikacja dokumentów (opcjonalnie)",
  apartmentNumber: "Numer lokalu",
  landRegistryNumber: "Numer KW",
  docVerificationHint: "Przyspiesza weryfikację oferty przez zespół EstateOS.",
  step3Title: "Parametry Finansowe",
  priceCurrency: "Waluta ceny",
  rentPriceLabel: "Czynsz najmu (PLN/mies.)",
  salePriceLabel: "Cena sprzedaży",
  area: "Metraż (m²)",
  plotArea: "Powierzchnia działki (m²)",
  rooms: "Liczba pokoi",
  floor: "Piętro",
  floorGround: "Parter",
  buildYear: "Rok budowy",
  heating: "Ogrzewanie",
  heatingSelect: "Wybierz ogrzewanie",
  furnished: "Umeblowane",
  furnishedYes: "Tak",
  furnishedNo: "Nie",
  adminFee: "Czynsz administracyjny",
  adminFeeOptional: "Opcjonalnie",
  agentCommissionLabel: "Prowizja agenta (%)",
  agentCommissionHint: "Zgodnie z ustawą — od 0% do 3%, krok 0,1%",
  agentCommissionPlaceholder: "np. 2,0",
  aiValuationLabel: "Sugestia AI (orientacyjna)",
  aiMarketDeal: "Okazja Rynkowa",
  aiPremium: "Standard Premium",
  aiLuxury: "Segment Luksusowy",
  step4Title: "Galeria i Prezentacja",
  titleLabel: "Tytuł ogłoszenia",
  titlePlaceholder: "Krótki, chwytliwy tytuł…",
  titleMinHint: "Minimum 10 znaków",
  galleryLabel: "Galeria zdjęć",
  galleryAdd: "Dodaj zdjęcia",
  galleryHint: "Przeciągnij, aby zmienić kolejność. Pierwsze zdjęcie = okładka.",
  galleryUsed: "zdjęć",
  descriptionLabel: "Opis premium",
  descriptionPlaceholder: "Opisz atuty nieruchomości, okolicę i warunki transakcji…",
  aiAssistant: "Asystent AI",
  aiGenerating: "Generowanie opisu…",
  floorPlan: "Rzut / plan piętra",
  floorPlanUpload: "Dodaj rzut",
  rentDetailsTitle: "Szczegóły wynajmu",
  rentTypeLabel: "Rodzaj najmu",
  rentTypePlaceholder: "np. krótkoterminowy, długoterminowy",
  petsAllowed: "Akceptuję zwierzęta",
  amenitiesLabel: "Udogodnienia",
  amenityBalcony: "Balkon",
  amenityGarage: "Garaż/Miejsce park.",
  amenityStorage: "Piwnica/Pom. gosp.",
  amenityGarden: "Ogródek",
  amenityDuplex: "Dwupoziomowe",
  amenityElevator: "Winda",
  amenityAc: "Klimatyzacja",
  step5Title: "Profil Ogłoszeniodawcy",
  advertiserPrivate: "Osoba Prywatna",
  advertiserAgency: "Agencja / Biuro",
  agencyNameLabel: "Nazwa agencji",
  contactName: "Imię i nazwisko kontaktu",
  contactPhone: "Telefon",
  contactEmail: "E-mail",
  contactPassword: "Hasło (jeśli nowe konto)",
  verificationBannerTitle: "Zweryfikuj konto, aby opublikować",
  verificationBannerBody:
    "Oferta zostanie zapisana jako szkic do czasu weryfikacji telefonu lub e-maila.",
  verificationBannerCta: "Przejdź do weryfikacji",
  submit: "ZAKOŃCZ I OPUBLIKUJ",
  submitIncomplete: "Uzupełnij wymagane pola",
  submitProcessing: "Przetwarzanie…",
  back: "Wstecz",
  next: "Dalej",
  stepIncompleteHint: "Uzupełnij wymagane pola na tym kroku.",
  uploadSending: "Wysyłanie…",
  uploadCreating: "Tworzenie oferty…",
  uploadPhotoProgress: "Zdjęcie",
  uploadFloorPlan: "Rzut",
  errorMapToken: "Brak tokenu Mapbox — skontaktuj się z administratorem.",
  errorPinFailed: "Nie udało się ustawić pinezki na mapie.",
  errorUploadPhoto: "Błąd wysyłania zdjęcia.",
  errorUploadFloorPlan: "Błąd wysyłania rzutu.",
  errorServerRejected: "Serwer odrzucił ofertę.",
  errorServerConnection: "Błąd połączenia z serwerem.",
  errorImagesNotUploaded: "Nie wszystkie zdjęcia zostały wysłane.",
  modalVerifyTitle: "Weryfikacja wymagana",
  modalVerifyBody: "Zweryfikuj telefon lub e-mail, aby opublikować ofertę.",
  modalVerifyCta: "Weryfikuj konto",
  modalClose: "Zamknij",
  modalSuccessTitle: "Oferta wysłana",
  modalSuccessBody: "Twoja oferta trafiła do moderacji EstateOS.",
  modalSuccessCta: "Moje ogłoszenia",
  modalErrorTitle: "Błąd publikacji",
  modalErrorBody: "Spróbuj ponownie lub skontaktuj się z supportem.",
  modalErrorCta: "Spróbuj ponownie",
  modalLimitTitle: "Limit darmowych ogłoszeń",
  modalLimitBadge: "LIMIT",
  modalLimitBody:
    "Wykorzystałeś darmowy limit. Wykup pakiet PRO lub PLUS, aby kontynuować.",
  modalLimitCta: "Zobacz cennik",
  modalLimitLoading: "Przekierowanie…",
  modalLimitAutopublish: "Publikuj po płatności",
  modalProWelcome: "Witaj w PRO",
  modalProStart: "Rozpocznij",
  modalPlusBadge: "PLUS+ LISTING",
  modalPlusTitle: "Zasięg zwielokrotniony",
  modalPlusBody: "Twoja oferta otrzyma priorytet w Radarze i na mapie.",
  thumbnailAlt: "Miniatura",
  mainPhoto: "Główne",
  heatingMunicipal: "Miejskie",
  heatingGas: "Gazowe",
  heatingElectric: "Elektryczne",
  heatingHeatPump: "Pompa Ciepła",
  heatingCoal: "Węglowe/Pellet",
  heatingOther: "Inne",
};

const en: AddOfferCopy = {
  ...pl,
  badge: "EstateOS Premium form",
  title: "Add",
  titleAccent: "listing.",
  stepProgress: "Step {current} of {total}",
  formExperience: "EstateOS Form Experience",
  transactionSell: "Sale",
  transactionRent: "Rent",
  step1Title: "Property type",
  propertyFlat: "Apartment",
  propertyHouse: "House",
  propertyPlot: "Plot",
  propertyCommercial: "Commercial",
  conditionLabel: "Finish standard",
  conditionReady: "Move-in ready",
  conditionRenovation: "Needs renovation",
  conditionDeveloper: "Developer standard",
  step2Title: "Location & map",
  locationExact: "Exact (pin)",
  locationApproximate: "Approximate (area)",
  locationVisibilityTitle: "Location visibility",
  locationVisibilityBody:
    "Exact location shows a map pin. Approximate hides the building number until publication.",
  searchAddress: "Search address",
  searchAddressPlaceholder: "Street, number, city…",
  buildingNumberRequired: "Enter building number for exact location.",
  city: "City",
  district: "District",
  districtArea: "Area / estate",
  selectPlaceholder: "Select…",
  areaPlaceholder: "e.g. Downtown",
  docVerificationTitle: "Document verification (optional)",
  apartmentNumber: "Unit number",
  landRegistryNumber: "Land registry no.",
  docVerificationHint: "Speeds up listing verification by EstateOS team.",
  step3Title: "Financial details",
  priceCurrency: "Price currency",
  rentPriceLabel: "Monthly rent (PLN)",
  salePriceLabel: "Sale price",
  area: "Area (m²)",
  plotArea: "Plot area (m²)",
  rooms: "Rooms",
  floor: "Floor",
  floorGround: "Ground floor",
  buildYear: "Year built",
  heating: "Heating",
  heatingSelect: "Select heating",
  furnished: "Furnished",
  furnishedYes: "Yes",
  furnishedNo: "No",
  adminFee: "Admin fee",
  adminFeeOptional: "Optional",
  agentCommissionLabel: "Agent commission (%)",
  agentCommissionHint: "By law — 0% to 3%, step 0.1%",
  agentCommissionPlaceholder: "e.g. 2.0",
  aiValuationLabel: "AI suggestion (indicative)",
  aiMarketDeal: "Market deal",
  aiPremium: "Premium standard",
  aiLuxury: "Luxury segment",
  step4Title: "Gallery & presentation",
  titleLabel: "Listing title",
  titlePlaceholder: "Short, catchy title…",
  titleMinHint: "At least 10 characters",
  galleryLabel: "Photo gallery",
  galleryAdd: "Add photos",
  galleryHint: "Drag to reorder. First photo = cover.",
  galleryUsed: "photos",
  descriptionLabel: "Premium description",
  descriptionPlaceholder: "Describe the property, area, and transaction terms…",
  aiAssistant: "AI assistant",
  aiGenerating: "Generating description…",
  floorPlan: "Floor plan",
  floorPlanUpload: "Add floor plan",
  rentDetailsTitle: "Rental details",
  rentTypeLabel: "Rental type",
  rentTypePlaceholder: "e.g. short-term, long-term",
  petsAllowed: "Pets allowed",
  amenitiesLabel: "Amenities",
  amenityBalcony: "Balcony",
  amenityGarage: "Garage/Parking",
  amenityStorage: "Storage",
  amenityGarden: "Garden",
  amenityDuplex: "Duplex",
  amenityElevator: "Elevator",
  amenityAc: "Air conditioning",
  step5Title: "Advertiser profile",
  advertiserPrivate: "Private individual",
  advertiserAgency: "Agency / office",
  agencyNameLabel: "Agency name",
  contactName: "Contact name",
  contactPhone: "Phone",
  contactEmail: "Email",
  contactPassword: "Password (if new account)",
  verificationBannerTitle: "Verify account to publish",
  verificationBannerBody:
    "Listing will be saved as draft until phone or email is verified.",
  verificationBannerCta: "Go to verification",
  submit: "FINISH & PUBLISH",
  submitIncomplete: "Complete required fields",
  submitProcessing: "Processing…",
  back: "Back",
  next: "Next",
  stepIncompleteHint: "Complete required fields on this step.",
  uploadSending: "Uploading…",
  uploadCreating: "Creating listing…",
  uploadPhotoProgress: "Photo",
  uploadFloorPlan: "Floor plan",
  errorMapToken: "Mapbox token missing — contact administrator.",
  errorPinFailed: "Could not place map pin.",
  errorUploadPhoto: "Photo upload failed.",
  errorUploadFloorPlan: "Floor plan upload failed.",
  errorServerRejected: "Server rejected listing.",
  errorServerConnection: "Server connection error.",
  errorImagesNotUploaded: "Not all photos were uploaded.",
  modalVerifyTitle: "Verification required",
  modalVerifyBody: "Verify phone or email to publish listing.",
  modalVerifyCta: "Verify account",
  modalClose: "Close",
  modalSuccessTitle: "Listing submitted",
  modalSuccessBody: "Your listing was sent to EstateOS moderation.",
  modalSuccessCta: "My listings",
  modalErrorTitle: "Publish error",
  modalErrorBody: "Try again or contact support.",
  modalErrorCta: "Try again",
  modalLimitTitle: "Free listing limit",
  modalLimitBadge: "LIMIT",
  modalLimitBody: "Free limit reached. Get PRO or PLUS to continue.",
  modalLimitCta: "View pricing",
  modalLimitLoading: "Redirecting…",
  modalLimitAutopublish: "Publish after payment",
  modalProWelcome: "Welcome to PRO",
  modalProStart: "Get started",
  modalPlusBadge: "PLUS+ LISTING",
  modalPlusTitle: "Amplified reach",
  modalPlusBody: "Your listing gets priority in Radar and on the map.",
  thumbnailAlt: "Thumbnail",
  mainPhoto: "Cover",
  heatingMunicipal: "District heating",
  heatingGas: "Gas",
  heatingElectric: "Electric",
  heatingHeatPump: "Heat pump",
  heatingCoal: "Coal/pellet",
  heatingOther: "Other",
};

const uk: AddOfferCopy = addOfferCopyUk;

export function getAddOfferCopy(locale: Locale): AddOfferCopy {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
