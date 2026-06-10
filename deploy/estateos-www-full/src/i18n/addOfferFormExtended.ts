import type { Locale } from "./config";

/** Dodatkowe etykiety formularza dodawania oferty (kroki 3–6, modale, podsumowanie, portfel). */
export type AddOfferFormExtended = {
  floorGround: string;
  rentPriceLabel: string;
  salePriceLabel: string;
  plotAreaLabel: string;
  buildYearLabel: string;
  heatingTypeLabel: string;
  furnishedLabel: string;
  yes: string;
  no: string;
  adminFeeLabel: string;
  adminFeeOptional: string;
  commissionBlockTitle: string;
  commissionBlockIntro: string;
  pricePerSqm: string;
  nbpTag: string;
  aiValuationKicker: string;
  aiSegmentOpportunity: string;
  aiSegmentPremium: string;
  aiSegmentLuxury: string;
  offerTitleLabel: string;
  offerTitlePlaceholder: string;
  titleMinHint: string;
  photoGalleryLabel: string;
  photoGalleryUsed: string;
  photoAddLine1: string;
  photoAddLine2: string;
  photoGalleryHint: string;
  exclusiveDescLabel: string;
  generating: string;
  aiAssistantBtn: string;
  propertyPlanLabel: string;
  uploadFloorPlanBtn: string;
  rentDetailsHeading: string;
  rentAdminFeeLabel: string;
  rentAdminFeeHint: string;
  rentNoneOption: string;
  rentPerMonthSuffix: string;
  depositLabel: string;
  rentTypeLabel: string;
  rentTypePlaceholder: string;
  petsAcceptLabel: string;
  amenitiesPremiumLabel: string;
  advertiserProfileTitle: string;
  advertiserPrivate: string;
  advertiserAgency: string;
  agencyNameRequired: string;
  contactNameLabel: string;
  phoneLabel: string;
  emailLabel: string;
  passwordLabel: string;
  phoneTakenMsg: string;
  emailTakenMsg: string;
  publishSummaryHeading: string;
  sumTitle: string;
  sumTypeTransaction: string;
  sumPriceArea: string;
  sumLocation: string;
  sumParams: string;
  sumCostsCommission: string;
  sumAmenitiesMedia: string;
  sumRooms: string;
  sumFloor: string;
  sumYear: string;
  sumHeating: string;
  sumFurnished: string;
  sumRent: string;
  sumCommission: string;
  sumNoAmenities: string;
  sumPhotos: string;
  sumFloorPlan: string;
  sumPhotoPreviewAlt: string;
  sumFloorPreviewAlt: string;
  sumNoPhotos: string;
  acctVerifyTitle: string;
  acctVerifyBefore: string;
  acctVerifyPhone: string;
  acctVerifyEmail: string;
  acctVerifyAnd: string;
  acctVerifyGo: string;
  publishFinishGuest: string;
  publishSelectMethod: string;
  processing: string;
  fillMissingData: string;
  stepRequiredHint: string;
  addressCityConflict: string;
  geocodeCityHint: string;
  mapTokenMissing: string;
  selectPublicationMethod: string;
  progressSendingOffer: string;
  progressCreatingOffer: string;
  progressUploadingFloorPlan: string;
  progressUploadingPhoto: string;
  photoUploadFailed: string;
  floorPlanUploadError: string;
  serverRejected: string;
  apiConnectionError: string;
  stripePaymentError: string;
  addressFormMismatch: string;
  createOfferFailed: string;
  createOfferNoId: string;
  plusPackageRequired: string;
  activationFailed: string;
  walletFetchFailed: string;
  plusCheckoutFailed: string;
  modalVerifyTitle: string;
  modalVerifyDefault: string;
  modalVerifyBtn: string;
  modalClose: string;
  modalSuccessTitle: string;
  modalSuccessBody: string;
  modalSuccessPanel: string;
  modalErrorTitle: string;
  modalFixData: string;
  modalLimitTitle: string;
  modalLimitBadge: string;
  modalLimitBody: string;
  modalUnlock: string;
  modalCheckoutLoading: string;
  modalAutoPublish: string;
  modalBackEdit: string;
  aiGenPropertyFallback: string;
  aiGenLocationFallback: string;
  aiGenTemplate: string;
  commissionEditorNote: string;
  commissionPercentField: string;
  commissionAmountField: string;
  commissionStepPct: string;
  commissionAmountFromPrice: string;
  commissionAmountComputed: string;
  commissionInvalidWarning: string;
  walletBonusCoupons: string;
  walletActiveCouponsCount: string;
  walletNoCoupons: string;
  walletPlusPackage: string;
  walletPlusCreditsAvailable: string;
  walletNoPlusCredit: string;
  walletValidUntil: string;
  walletBuyPlus: string;
  walletPublishMethod: string;
  walletRenewMethod: string;
  walletPublishHint: string;
  walletRenewHint: string;
  walletLoadFailed: string;
  walletHttpError: string;
  walletUsePlusCredit: string;
  walletPlusCreditLine: string;
  walletNoPlusOnAccount: string;
  walletPayRenewal: string;
  walletBuyPlusAction: string;
  walletRenewPaymentDesc: string;
  walletBuyPlusPaymentDesc: string;
  sumSecOffer: string;
  sumSecLocation: string;
  sumSecParams: string;
  sumSecRent: string;
  sumSecAmenities: string;
  sumSecContact: string;
  sumRowTransaction: string;
  sumRowPropertyType: string;
  sumRowCondition: string;
  sumRowTitle: string;
  sumRowDescription: string;
  sumRowLocation: string;
  sumRowMapVisibility: string;
  sumRowStreet: string;
  sumRowCity: string;
  sumRowDistrict: string;
  sumRowApartment: string;
  sumRowLandRegistry: string;
  sumRowCoordinates: string;
  sumRowPrice: string;
  sumRowArea: string;
  sumRowRooms: string;
  sumRowFloor: string;
  sumRowBuildYear: string;
  sumRowPlotArea: string;
  sumRowHeating: string;
  sumRowFurnished: string;
  sumRowCommission: string;
  sumRowAdminFee: string;
  sumRowRentAdmin: string;
  sumRowDeposit: string;
  sumRowMinPeriod: string;
  sumRowAvailableFrom: string;
  sumRowRentType: string;
  sumRowPets: string;
  sumRowAdvertiser: string;
  sumRowAgencyName: string;
  sumRowContactName: string;
  sumRowPhone: string;
  sumRowEmail: string;
  sumSelected: string;
  sumLocExact: string;
  sumLocApprox: string;
  sumCommissionZero: string;
  sumAdvertiserAgency: string;
  sumAdvertiserPrivate: string;
  step3FinancialTitle: string;
  step4GalleryTitle: string;
  plusReachBadge: string;
  plusActivatedBody: string;
  plusViewStats: string;
};

const pl: AddOfferFormExtended = {
  floorGround: "Parter",
  rentPriceLabel: "Czynsz najmu",
  salePriceLabel: "Cena",
  plotAreaLabel: "Powierzchnia działki (m²) *",
  buildYearLabel: "Rok budowy *",
  heatingTypeLabel: "Rodzaj ogrzewania",
  furnishedLabel: "Umeblowane",
  yes: "Tak",
  no: "Nie",
  adminFeeLabel: "Czynsz administracyjny",
  adminFeeOptional: "(Opcjonalnie)",
  commissionBlockTitle: "Prowizja agenta (procent lub kwota)",
  commissionBlockIntro:
    "Wpisz prowizję procentowo lub kwotowo. Dopuszczalne: 0% (bez prowizji) albo od {min}% wzwyż — bez górnego limitu. Cena ogłoszenia pozostaje finalną kwotą brutto dla klienta, a prowizja jest rozliczana poza platformą.",
  pricePerSqm: "{currency}/m²",
  nbpTag: "(NBP)",
  aiValuationKicker: "EstateOS AI: Wycena za m²",
  aiSegmentOpportunity: "Okazja Rynkowa",
  aiSegmentPremium: "Standard Premium",
  aiSegmentLuxury: "Segment Luksusowy",
  offerTitleLabel: "Tytuł oferty *",
  offerTitlePlaceholder: "np. Luksusowy apartament z widokiem na skyline",
  titleMinHint: "Minimum 10 znaków, tak jak w aplikacji mobilnej.",
  photoGalleryLabel: "Galeria zdjęć (min. 1) *",
  photoGalleryUsed: "Użyto:",
  photoAddLine1: "Dodaj",
  photoAddLine2: "Zdjęcia",
  photoGalleryHint:
    "Możesz dodać dowolną liczbę zdjęć, przeciągnij je aby ułożyć kolejność. Łączna waga plików to max 30 MB.",
  exclusiveDescLabel: "Ekskluzywny opis",
  generating: "Generowanie...",
  aiAssistantBtn: "Asystent AI",
  propertyPlanLabel: "Plan nieruchomości",
  uploadFloorPlanBtn: "Wgraj rzut",
  rentDetailsHeading: "Szczegóły wynajmu",
  rentAdminFeeLabel: "Opłaty dodatkowe (czynsz)",
  rentAdminFeeHint:
    "Osobno od czynszu najmu — wspólnota, media, administracja. Wybierz z listy lub zostaw „Brak”.",
  rentNoneOption: "Brak",
  rentPerMonthSuffix: "PLN / mc",
  depositLabel: "Kaucja (PLN)",
  rentTypeLabel: "Typ umowy / Dostępność",
  rentTypePlaceholder: "np. Najem okazjonalny, od 01.07",
  petsAcceptLabel: "Akceptuję zwierzęta",
  amenitiesPremiumLabel: "Udogodnienia (Premium)",
  advertiserProfileTitle: "Profil ogłoszeniodawcy",
  advertiserPrivate: "Osoba prywatna",
  advertiserAgency: "Agencja / biuro",
  agencyNameRequired: "Nazwa agencji nieruchomości *",
  contactNameLabel: "Imię i nazwisko / agent *",
  phoneLabel: "Telefon *",
  emailLabel: "E-mail *",
  passwordLabel: "Hasło (min. 6 znaków) *",
  phoneTakenMsg: "Ten numer jest przypisany do innego konta.",
  emailTakenMsg: "Adres jest już zajęty. Zaloguj się.",
  publishSummaryHeading: "Podsumowanie publikacji",
  sumTitle: "Tytuł",
  sumTypeTransaction: "Typ / transakcja",
  sumPriceArea: "Cena / metraż",
  sumLocation: "Lokalizacja",
  sumParams: "Parametry",
  sumCostsCommission: "Koszty i prowizja",
  sumAmenitiesMedia: "Udogodnienia i media",
  sumRooms: "Pokoje",
  sumFloor: "Piętro",
  sumYear: "Rok",
  sumHeating: "Ogrzewanie",
  sumFurnished: "Umeblowane",
  sumRent: "Czynsz",
  sumCommission: "Prowizja",
  sumNoAmenities: "Brak wybranych udogodnień",
  sumPhotos: "Zdjęcia",
  sumFloorPlan: "Rzut",
  sumPhotoPreviewAlt: "Podgląd zdjęcia {n}",
  sumFloorPreviewAlt: "Podgląd rzutu",
  sumNoPhotos: "Brak zdjęć w podsumowaniu — dodaj zdjęcia w kroku mediów.",
  acctVerifyTitle: "Weryfikacja konta",
  acctVerifyBefore: "Przed publikacją potwierdź",
  acctVerifyPhone: "telefon (SMS)",
  acctVerifyEmail: "adres e-mail",
  acctVerifyAnd: "oraz",
  acctVerifyGo: "Przejdź do weryfikacji",
  publishFinishGuest: "ZAKOŃCZ I OPUBLIKUJ",
  publishSelectMethod: "WYBIERZ METODĘ PUBLIKACJI",
  processing: "Przetwarzanie...",
  fillMissingData: "Uzupełnij brakujące dane",
  stepRequiredHint: "Uzupełnij wymagane pola tego kroku, aby przejść dalej.",
  addressCityConflict:
    "Adres wskazuje inne miasto niż wybrane. Wybierz adres z listy podpowiedzi lub zmień miasto.",
  geocodeCityHint:
    "Dopisz miejscowość po przecinku (np. „Bernardyńska 8, Kalwaria Zebrzydowska”) lub wybierz wynik z listy podpowiedzi.",
  mapTokenMissing: "Brak klucza mapy (NEXT_PUBLIC_MAPBOX_TOKEN).",
  selectPublicationMethod: "Wybierz metodę publikacji: kupon, kredyt Plus lub zakup Pakietu Plus.",
  progressSendingOffer: "Wysyłanie oferty...",
  progressCreatingOffer: "Tworzenie oferty...",
  progressUploadingFloorPlan: "Wysyłanie rzutu nieruchomości...",
  progressUploadingPhoto: "Wysyłanie zdjęcia {current}/{total}...",
  photoUploadFailed: "Upload zdjęcia {n} nie powiódł się.",
  floorPlanUploadError: "Upload rzutu nieruchomości nie powiódł się.",
  serverRejected: "Odrzucono przez serwer",
  apiConnectionError: "Błąd połączenia z serwerem API.",
  stripePaymentError: "Błąd połączenia z kasą Stripe.",
  addressFormMismatch:
    "Adres wskazuje inne miasto niż wybrane w formularzu. Popraw lokalizację na mapie.",
  createOfferFailed: "Nie udało się utworzyć oferty.",
  createOfferNoId: "Oferta została utworzona, ale brak ID do aktywacji.",
  plusPackageRequired: "Do publikacji wymagany jest Pakiet Plus.",
  activationFailed: "Nie udało się aktywować publikacji.",
  walletFetchFailed: "Nie udało się pobrać portfela publikacji.",
  plusCheckoutFailed: "Nie udało się uruchomić płatności Pakiet Plus.",
  modalVerifyTitle: "Potwierdź kontakt",
  modalVerifyDefault: "Publikacja wymaga zweryfikowanego telefonu i e-maila.",
  modalVerifyBtn: "Weryfikacja konta",
  modalClose: "Zamknij",
  modalSuccessTitle: "Gotowe!",
  modalSuccessBody:
    "Oferta została zapisana i przesłana do akceptacji EstateOS™. Do czasu zatwierdzenia nie pojawi się na mapie ani na rynku — zobaczysz ją w zakładce „Oczekujące” w panelu.",
  modalSuccessPanel: "Panel zarządzania",
  modalErrorTitle: "Odrzucono",
  modalFixData: "Popraw dane",
  modalLimitTitle: "Osiągnięto limit",
  modalLimitBadge: "⚡ Oferta limitowana",
  modalLimitBody: "Odblokuj to ogłoszenie w specjalnej cenie:",
  modalUnlock: "ODBLOKUJ I OPUBLIKUJ",
  modalCheckoutLoading: "ŁADOWANIE KASY...",
  modalAutoPublish: "AUTOPUBLIKACJA PO PŁATNOŚCI",
  modalBackEdit: "Wróć do edycji",
  aiGenPropertyFallback: "Nieruchomość",
  aiGenLocationFallback: "wybranej lokalizacji",
  aiGenTemplate:
    "Przedstawiamy wyjątkową ofertę: {hint} Komfortowy układ pomieszczeń, funkcjonalna przestrzeń oraz doskonała lokalizacja czynią tę nieruchomość idealną zarówno do zamieszkania, jak i inwestycji.",
  commissionEditorNote:
    "Cena z ogłoszenia pozostaje finalną kwotą brutto — bez dopłaty ponad to, co widzi klient. Wpisz prowizję procentowo albo kwotowo; oba pola synchronizują się ze sobą.",
  commissionPercentField: "Procent prowizji",
  commissionAmountField: "Kwota z ceny ofertowej (PLN)",
  commissionStepPct: "Krok {step}%",
  commissionAmountFromPrice: "Kwota liczona od ceny brutto widocznej w ogłoszeniu.",
  commissionAmountComputed: "Odpowiada {pct} ceny ofertowej.",
  commissionInvalidWarning:
    "Dozwolone: 0% (bez prowizji) albo co najmniej {min}% ceny ofertowej brutto.",
  walletBonusCoupons: "Kupony bonusowe",
  walletActiveCouponsCount: "{count} aktywnych kuponów",
  walletNoCoupons: "Brak aktywnych kuponów.",
  walletPlusPackage: "Pakiet Plus",
  walletPlusCreditsAvailable: "{count} publikacja Plus do wykorzystania",
  walletNoPlusCredit: "Brak aktywnego kredytu Plus",
  walletValidUntil: "Ważne do {date}",
  walletBuyPlus: "Kup Pakiet Plus",
  walletPublishMethod: "Metoda publikacji",
  walletRenewMethod: "Metoda odnowienia",
  walletPublishHint:
    "Wybierz kupon, wykorzystaj kredyt Plus lub opłać nową publikację — tak jak w aplikacji mobilnej.",
  walletRenewHint:
    "Wybierz kupon, wykorzystaj kredyt Plus lub opłać odnowienie oferty na 30 dni.",
  walletLoadFailed: "Nie udało się załadować portfela.",
  walletHttpError: "Nie udało się załadować portfela (błąd HTTP).",
  walletUsePlusCredit: "Użyj kredytu Plus",
  walletPlusCreditLine:
    "{count} publikacja do wykorzystania · {days} dni na rynku{expiry}",
  walletNoPlusOnAccount: "Brak aktywnego kredytu Plus na koncie.",
  walletPayRenewal: "Opłać odnowienie",
  walletBuyPlusAction: "Kup Pakiet Plus",
  walletRenewPaymentDesc: "Przedłuż ofertę o {days} dni · {price}",
  walletBuyPlusPaymentDesc:
    "Opłać 1 dodatkowe wystawienie ({price}) — kredyt pojawi się na koncie po płatności",
  sumSecOffer: "Oferta",
  sumSecLocation: "Lokalizacja",
  sumSecParams: "Parametry i finanse",
  sumSecRent: "Warunki najmu",
  sumSecAmenities: "Udogodnienia",
  sumSecContact: "Kontakt",
  sumRowTransaction: "Rodzaj transakcji",
  sumRowPropertyType: "Typ nieruchomości",
  sumRowCondition: "Stan wykończenia",
  sumRowTitle: "Tytuł ogłoszenia",
  sumRowDescription: "Opis",
  sumRowLocation: "Lokalizacja",
  sumRowMapVisibility: "Widoczność na mapie",
  sumRowStreet: "Ulica i numer",
  sumRowCity: "Miasto",
  sumRowDistrict: "Dzielnica",
  sumRowApartment: "Nr mieszkania",
  sumRowLandRegistry: "Księga wieczysta (KW)",
  sumRowCoordinates: "Współrzędne",
  sumRowPrice: "Cena",
  sumRowArea: "Metraż",
  sumRowRooms: "Liczba pokoi",
  sumRowFloor: "Piętro",
  sumRowBuildYear: "Rok budowy",
  sumRowPlotArea: "Powierzchnia działki",
  sumRowHeating: "Ogrzewanie",
  sumRowFurnished: "Umeblowanie",
  sumRowCommission: "Prowizja agenta",
  sumRowAdminFee: "Czynsz administracyjny",
  sumRowRentAdmin: "Opłaty dodatkowe (admin)",
  sumRowDeposit: "Kaucja",
  sumRowMinPeriod: "Minimalny okres najmu",
  sumRowAvailableFrom: "Dostępne od",
  sumRowRentType: "Rodzaj najmu",
  sumRowPets: "Zwierzęta",
  sumRowAdvertiser: "Rodzaj ogłoszeniodawcy",
  sumRowAgencyName: "Nazwa agencji",
  sumRowContactName: "Osoba kontaktowa",
  sumRowPhone: "Telefon",
  sumRowEmail: "E-mail",
  sumSelected: "Wybrane",
  sumLocExact: "Dokładna — ulica i numer",
  sumLocApprox: "Przybliżona — tylko obszar dzielnicy",
  sumCommissionZero: "Bez prowizji (0%)",
  sumAdvertiserAgency: "Agencja / biuro",
  sumAdvertiserPrivate: "Osoba prywatna",
  step3FinancialTitle: "Parametry finansowe",
  step4GalleryTitle: "Galeria i prezentacja",
  plusReachBadge: "Zasięg zwielokrotniony",
  plusActivatedBody: "Aktywowana. Twoje ogłoszenie trafia właśnie do tysięcy inwestorów.",
  plusViewStats: "Zobacz statystyki",
};

const en: AddOfferFormExtended = {
  floorGround: "Ground floor",
  rentPriceLabel: "Monthly rent",
  salePriceLabel: "Price",
  plotAreaLabel: "Plot area (m²) *",
  buildYearLabel: "Year built *",
  heatingTypeLabel: "Heating type",
  furnishedLabel: "Furnished",
  yes: "Yes",
  no: "No",
  adminFeeLabel: "HOA / admin fee",
  adminFeeOptional: "(Optional)",
  commissionBlockTitle: "Agent commission (percent or amount)",
  commissionBlockIntro:
    "Enter commission as a percentage or fixed amount. Allowed: 0% (no commission) or from {min}% upward — no upper cap. The listing price stays the final gross amount for the buyer; commission is settled off-platform.",
  pricePerSqm: "{currency}/m²",
  nbpTag: "(NBP)",
  aiValuationKicker: "EstateOS AI: Price per m²",
  aiSegmentOpportunity: "Market opportunity",
  aiSegmentPremium: "Premium standard",
  aiSegmentLuxury: "Luxury segment",
  offerTitleLabel: "Listing title *",
  offerTitlePlaceholder: "e.g. Luxury apartment with skyline view",
  titleMinHint: "Minimum 10 characters, same as in the mobile app.",
  photoGalleryLabel: "Photo gallery (min. 1) *",
  photoGalleryUsed: "Used:",
  photoAddLine1: "Add",
  photoAddLine2: "Photos",
  photoGalleryHint:
    "Add any number of photos and drag to reorder. Total file size max 30 MB.",
  exclusiveDescLabel: "Exclusive description",
  generating: "Generating…",
  aiAssistantBtn: "AI assistant",
  propertyPlanLabel: "Floor plan",
  uploadFloorPlanBtn: "Upload plan",
  rentDetailsHeading: "Rental details",
  rentAdminFeeLabel: "Additional fees (HOA)",
  rentAdminFeeHint:
    "Separate from rent — community, utilities, administration. Pick from the list or leave “None”.",
  rentNoneOption: "None",
  rentPerMonthSuffix: "PLN / mo",
  depositLabel: "Deposit (PLN)",
  rentTypeLabel: "Contract type / availability",
  rentTypePlaceholder: "e.g. Occasional lease, from 01 Jul",
  petsAcceptLabel: "Pets allowed",
  amenitiesPremiumLabel: "Amenities (Premium)",
  advertiserProfileTitle: "Advertiser profile",
  advertiserPrivate: "Private person",
  advertiserAgency: "Agency / office",
  agencyNameRequired: "Real estate agency name *",
  contactNameLabel: "Full name / agent *",
  phoneLabel: "Phone *",
  emailLabel: "Email *",
  passwordLabel: "Password (min. 6 characters) *",
  phoneTakenMsg: "This number is linked to another account.",
  emailTakenMsg: "Email is already taken. Please sign in.",
  publishSummaryHeading: "Publication summary",
  sumTitle: "Title",
  sumTypeTransaction: "Type / transaction",
  sumPriceArea: "Price / area",
  sumLocation: "Location",
  sumParams: "Details",
  sumCostsCommission: "Fees & commission",
  sumAmenitiesMedia: "Amenities & media",
  sumRooms: "Rooms",
  sumFloor: "Floor",
  sumYear: "Year",
  sumHeating: "Heating",
  sumFurnished: "Furnished",
  sumRent: "HOA fee",
  sumCommission: "Commission",
  sumNoAmenities: "No amenities selected",
  sumPhotos: "Photos",
  sumFloorPlan: "Floor plan",
  sumPhotoPreviewAlt: "Photo preview {n}",
  sumFloorPreviewAlt: "Floor plan preview",
  sumNoPhotos: "No photos in summary — add photos in the media step.",
  acctVerifyTitle: "Account verification",
  acctVerifyBefore: "Before publishing, confirm your",
  acctVerifyPhone: "phone (SMS)",
  acctVerifyEmail: "email address",
  acctVerifyAnd: "and",
  acctVerifyGo: "Go to verification",
  publishFinishGuest: "FINISH & PUBLISH",
  publishSelectMethod: "SELECT PUBLICATION METHOD",
  processing: "Processing…",
  fillMissingData: "Complete missing fields",
  stepRequiredHint: "Complete required fields in this step to continue.",
  addressCityConflict:
    "The address points to a different city than selected. Pick from suggestions or change the city.",
  geocodeCityHint:
    "Add the locality after a comma (e.g. “Main St 8, Kalwaria Zebrzydowska”) or pick a suggestion.",
  mapTokenMissing: "Missing map key (NEXT_PUBLIC_MAPBOX_TOKEN).",
  selectPublicationMethod: "Select publication method: coupon, Plus credit, or buy Plus package.",
  progressSendingOffer: "Sending listing…",
  progressCreatingOffer: "Creating listing…",
  progressUploadingFloorPlan: "Uploading floor plan…",
  progressUploadingPhoto: "Uploading photo {current}/{total}…",
  photoUploadFailed: "Photo {n} upload failed.",
  floorPlanUploadError: "Floor plan upload failed.",
  serverRejected: "Rejected by server",
  apiConnectionError: "API connection error.",
  stripePaymentError: "Stripe checkout connection error.",
  addressFormMismatch:
    "The address points to a different city than in the form. Fix the location on the map.",
  createOfferFailed: "Could not create listing.",
  createOfferNoId: "Listing was created but activation ID is missing.",
  plusPackageRequired: "Plus package is required to publish.",
  activationFailed: "Could not activate publication.",
  walletFetchFailed: "Could not load publication wallet.",
  plusCheckoutFailed: "Could not start Plus package checkout.",
  modalVerifyTitle: "Confirm contact details",
  modalVerifyDefault: "Publishing requires a verified phone and email.",
  modalVerifyBtn: "Account verification",
  modalClose: "Close",
  modalSuccessTitle: "Done!",
  modalSuccessBody:
    "Your listing was saved and sent for EstateOS™ review. Until approved it won't appear on the map or market — you'll find it under “Pending” in your panel.",
  modalSuccessPanel: "Management panel",
  modalErrorTitle: "Rejected",
  modalFixData: "Fix data",
  modalLimitTitle: "Limit reached",
  modalLimitBadge: "⚡ Limited listing",
  modalLimitBody: "Unlock this listing at a special price:",
  modalUnlock: "UNLOCK & PUBLISH",
  modalCheckoutLoading: "LOADING CHECKOUT…",
  modalAutoPublish: "AUTO-PUBLISH AFTER PAYMENT",
  modalBackEdit: "Back to editing",
  aiGenPropertyFallback: "Property",
  aiGenLocationFallback: "selected location",
  aiGenTemplate:
    "We present an exceptional offer: {hint} A comfortable layout, functional space and excellent location make this property ideal for living or investment.",
  commissionEditorNote:
    "The listing price remains the final gross amount — no extra charge for the buyer. Enter commission as percent or amount; both fields stay in sync.",
  commissionPercentField: "Commission percent",
  commissionAmountField: "Amount from listing price (PLN)",
  commissionStepPct: "Step {step}%",
  commissionAmountFromPrice: "Amount calculated from gross listing price.",
  commissionAmountComputed: "Equals {pct} of listing price.",
  commissionInvalidWarning:
    "Allowed: 0% (no commission) or at least {min}% of gross listing price.",
  walletBonusCoupons: "Bonus coupons",
  walletActiveCouponsCount: "{count} active coupons",
  walletNoCoupons: "No active coupons.",
  walletPlusPackage: "Plus package",
  walletPlusCreditsAvailable: "{count} Plus publication(s) available",
  walletNoPlusCredit: "No active Plus credit",
  walletValidUntil: "Valid until {date}",
  walletBuyPlus: "Buy Plus package",
  walletPublishMethod: "Publication method",
  walletRenewMethod: "Renewal method",
  walletPublishHint:
    "Choose a coupon, use Plus credit, or pay for a new publication — same as in the mobile app.",
  walletRenewHint:
    "Choose a coupon, use Plus credit, or pay to renew the listing for 30 days.",
  walletLoadFailed: "Could not load wallet.",
  walletHttpError: "Could not load wallet (HTTP error).",
  walletUsePlusCredit: "Use Plus credit",
  walletPlusCreditLine:
    "{count} publication(s) available · {days} days on market{expiry}",
  walletNoPlusOnAccount: "No active Plus credit on account.",
  walletPayRenewal: "Pay renewal",
  walletBuyPlusAction: "Buy Plus package",
  walletRenewPaymentDesc: "Extend listing by {days} days · {price}",
  walletBuyPlusPaymentDesc:
    "Pay for 1 extra listing ({price}) — credit appears after payment",
  sumSecOffer: "Listing",
  sumSecLocation: "Location",
  sumSecParams: "Details & finances",
  sumSecRent: "Rental terms",
  sumSecAmenities: "Amenities",
  sumSecContact: "Contact",
  sumRowTransaction: "Transaction type",
  sumRowPropertyType: "Property type",
  sumRowCondition: "Condition",
  sumRowTitle: "Listing title",
  sumRowDescription: "Description",
  sumRowLocation: "Location",
  sumRowMapVisibility: "Map visibility",
  sumRowStreet: "Street & number",
  sumRowCity: "City",
  sumRowDistrict: "District",
  sumRowApartment: "Flat no.",
  sumRowLandRegistry: "Land registry (KW)",
  sumRowCoordinates: "Coordinates",
  sumRowPrice: "Price",
  sumRowArea: "Area",
  sumRowRooms: "Rooms",
  sumRowFloor: "Floor",
  sumRowBuildYear: "Year built",
  sumRowPlotArea: "Plot area",
  sumRowHeating: "Heating",
  sumRowFurnished: "Furnished",
  sumRowCommission: "Agent commission",
  sumRowAdminFee: "HOA / admin fee",
  sumRowRentAdmin: "Additional fees (admin)",
  sumRowDeposit: "Deposit",
  sumRowMinPeriod: "Minimum lease period",
  sumRowAvailableFrom: "Available from",
  sumRowRentType: "Lease type",
  sumRowPets: "Pets",
  sumRowAdvertiser: "Advertiser type",
  sumRowAgencyName: "Agency name",
  sumRowContactName: "Contact person",
  sumRowPhone: "Phone",
  sumRowEmail: "Email",
  sumSelected: "Selected",
  sumLocExact: "Exact — street and number",
  sumLocApprox: "Approximate — district area only",
  sumCommissionZero: "No commission (0%)",
  sumAdvertiserAgency: "Agency / office",
  sumAdvertiserPrivate: "Private person",
  step3FinancialTitle: "Financial details",
  step4GalleryTitle: "Gallery & presentation",
  plusReachBadge: "Reach multiplied",
  plusActivatedBody: "Activated. Your listing is reaching thousands of investors.",
  plusViewStats: "View statistics",
};

const uk: AddOfferFormExtended = {
  floorGround: "Партер",
  rentPriceLabel: "Орендна плата",
  salePriceLabel: "Ціна",
  plotAreaLabel: "Площа ділянки (м²) *",
  buildYearLabel: "Рік будівництва *",
  heatingTypeLabel: "Тип опалення",
  furnishedLabel: "Мебльоване",
  yes: "Так",
  no: "Ні",
  adminFeeLabel: "Комунальний / адмін. внесок",
  adminFeeOptional: "(Необов'язково)",
  commissionBlockTitle: "Комісія агента (відсоток або сума)",
  commissionBlockIntro:
    "Вкажіть комісію у відсотках або сумою. Дозволено: 0% (без комісії) або від {min}% і вище — без верхньої межі. Ціна в оголошенні залишається фінальною брутто для клієнта; комісія розраховується поза платформою.",
  pricePerSqm: "{currency}/m²",
  nbpTag: "(NBP)",
  aiValuationKicker: "EstateOS AI: Ціна за м²",
  aiSegmentOpportunity: "Ринкова нагода",
  aiSegmentPremium: "Преміум-стандарт",
  aiSegmentLuxury: "Люкс-сегмент",
  offerTitleLabel: "Заголовок оголошення *",
  offerTitlePlaceholder: "напр. Розкішний апартамент з видом на місто",
  titleMinHint: "Мінімум 10 символів, як у мобільному застосунку.",
  photoGalleryLabel: "Галерея фото (мін. 1) *",
  photoGalleryUsed: "Використано:",
  photoAddLine1: "Додати",
  photoAddLine2: "Фото",
  photoGalleryHint:
    "Додайте будь-яку кількість фото та перетягніть для зміни порядку. Загальний розмір файлів — до 30 МБ.",
  exclusiveDescLabel: "Ексклюзивний опис",
  generating: "Генерація…",
  aiAssistantBtn: "AI-асистент",
  propertyPlanLabel: "План нерухомості",
  uploadFloorPlanBtn: "Завантажити план",
  rentDetailsHeading: "Деталі оренди",
  rentAdminFeeLabel: "Додаткові платежі (комунальні)",
  rentAdminFeeHint:
    "Окремо від орендної плати — ОСББ, медіа, адміністрація. Оберіть зі списку або залиште «Немає».",
  rentNoneOption: "Немає",
  rentPerMonthSuffix: "PLN / міс",
  depositLabel: "Завдаток (PLN)",
  rentTypeLabel: "Тип договору / доступність",
  rentTypePlaceholder: "напр. Оренда на умовах, з 01.07",
  petsAcceptLabel: "Дозволені тварини",
  amenitiesPremiumLabel: "Зручності (Premium)",
  advertiserProfileTitle: "Профіль рекламодавця",
  advertiserPrivate: "Приватна особа",
  advertiserAgency: "Агентство / офіс",
  agencyNameRequired: "Назва агентства нерухомості *",
  contactNameLabel: "Ім'я та прізвище / агент *",
  phoneLabel: "Телефон *",
  emailLabel: "E-mail *",
  passwordLabel: "Пароль (мін. 6 символів) *",
  phoneTakenMsg: "Цей номер прив'язаний до іншого облікового запису.",
  emailTakenMsg: "E-mail уже зайнятий. Увійдіть у систему.",
  publishSummaryHeading: "Підсумок публікації",
  sumTitle: "Заголовок",
  sumTypeTransaction: "Тип / угода",
  sumPriceArea: "Ціна / площа",
  sumLocation: "Локація",
  sumParams: "Параметри",
  sumCostsCommission: "Витрати та комісія",
  sumAmenitiesMedia: "Зручності та медіа",
  sumRooms: "Кімнати",
  sumFloor: "Поверх",
  sumYear: "Рік",
  sumHeating: "Опалення",
  sumFurnished: "Мебльоване",
  sumRent: "Комунальний",
  sumCommission: "Комісія",
  sumNoAmenities: "Зручності не обрано",
  sumPhotos: "Фото",
  sumFloorPlan: "План",
  sumPhotoPreviewAlt: "Попередній перегляд фото {n}",
  sumFloorPreviewAlt: "Попередній перегляд плану",
  sumNoPhotos: "Немає фото в підсумку — додайте фото на кроці медіа.",
  acctVerifyTitle: "Верифікація облікового запису",
  acctVerifyBefore: "Перед публікацією підтвердіть",
  acctVerifyPhone: "телефон (SMS)",
  acctVerifyEmail: "адресу e-mail",
  acctVerifyAnd: "та",
  acctVerifyGo: "Перейти до верифікації",
  publishFinishGuest: "ЗАВЕРШИТИ І ОПУБЛІКУВАТИ",
  publishSelectMethod: "ОБЕРІТЬ СПОСІБ ПУБЛІКАЦІЇ",
  processing: "Обробка…",
  fillMissingData: "Заповніть відсутні дані",
  stepRequiredHint: "Заповніть обов'язкові поля цього кроку, щоб продовжити.",
  addressCityConflict:
    "Адреса вказує на інше місто, ніж обране. Оберіть з підказок або змініть місто.",
  geocodeCityHint:
    "Додайте населений пункт після коми (напр. «Bernardyńska 8, Kalwaria Zebrzydowska») або оберіть зі списку.",
  mapTokenMissing: "Відсутній ключ карти (NEXT_PUBLIC_MAPBOX_TOKEN).",
  selectPublicationMethod:
    "Оберіть спосіб публікації: купон, кредит Plus або покупка пакета Plus.",
  progressSendingOffer: "Надсилання оголошення…",
  progressCreatingOffer: "Створення оголошення…",
  progressUploadingFloorPlan: "Надсилання плану нерухомості…",
  progressUploadingPhoto: "Надсилання фото {current}/{total}…",
  photoUploadFailed: "Не вдалося завантажити фото {n}.",
  floorPlanUploadError: "Не вдалося завантажити план.",
  serverRejected: "Відхилено сервером",
  apiConnectionError: "Помилка з'єднання з API.",
  stripePaymentError: "Помилка з'єднання з касою Stripe.",
  addressFormMismatch:
    "Адреса вказує на інше місто, ніж у формі. Виправте локацію на карті.",
  createOfferFailed: "Не вдалося створити оголошення.",
  createOfferNoId: "Оголошення створено, але немає ID для активації.",
  plusPackageRequired: "Для публікації потрібен пакет Plus.",
  activationFailed: "Не вдалося активувати публікацію.",
  walletFetchFailed: "Не вдалося завантажити гаманець публікації.",
  plusCheckoutFailed: "Не вдалося запустити оплату пакета Plus.",
  modalVerifyTitle: "Підтвердіть контакт",
  modalVerifyDefault: "Публікація потребує підтвердженого телефону та e-mail.",
  modalVerifyBtn: "Верифікація облікового запису",
  modalClose: "Закрити",
  modalSuccessTitle: "Готово!",
  modalSuccessBody:
    "Оголошення збережено та надіслано на перевірку EstateOS™. До схвалення воно не з'явиться на карті чи ринку — знайдете його у вкладці «Очікують» в панелі.",
  modalSuccessPanel: "Панель керування",
  modalErrorTitle: "Відхилено",
  modalFixData: "Виправити дані",
  modalLimitTitle: "Досягнуто ліміт",
  modalLimitBadge: "⚡ Обмежене оголошення",
  modalLimitBody: "Розблокуйте це оголошення за спеціальною ціною:",
  modalUnlock: "РОЗБЛОКУВАТИ І ОПУБЛІКУВАТИ",
  modalCheckoutLoading: "ЗАВАНТАЖЕННЯ КАСИ…",
  modalAutoPublish: "АВТОПУБЛІКАЦІЯ ПІСЛЯ ОПЛАТИ",
  modalBackEdit: "Повернутися до редагування",
  aiGenPropertyFallback: "Нерухомість",
  aiGenLocationFallback: "обраної локації",
  aiGenTemplate:
    "Пропонуємо унікальну пропозицію: {hint} Зручне планування, функціональний простір і чудова локація роблять цю нерухомість ідеальною для проживання чи інвестиції.",
  commissionEditorNote:
    "Ціна в оголошенні залишається фінальною брутто — без доплат для покупця. Вкажіть комісію у відсотках або сумою; обидва поля синхронізуються.",
  commissionPercentField: "Відсоток комісії",
  commissionAmountField: "Сума від ціни оголошення (PLN)",
  commissionStepPct: "Крок {step}%",
  commissionAmountFromPrice: "Сума розраховується від брутто-ціни в оголошенні.",
  commissionAmountComputed: "Відповідає {pct} ціни оголошення.",
  commissionInvalidWarning:
    "Дозволено: 0% (без комісії) або щонайменше {min}% брутто-ціни оголошення.",
  walletBonusCoupons: "Бонусні купони",
  walletActiveCouponsCount: "{count} активних купонів",
  walletNoCoupons: "Немає активних купонів.",
  walletPlusPackage: "Пакет Plus",
  walletPlusCreditsAvailable: "{count} публікацій Plus до використання",
  walletNoPlusCredit: "Немає активного кредиту Plus",
  walletValidUntil: "Дійсний до {date}",
  walletBuyPlus: "Купити пакет Plus",
  walletPublishMethod: "Спосіб публікації",
  walletRenewMethod: "Спосіб поновлення",
  walletPublishHint:
    "Оберіть купон, використайте кредит Plus або оплатіть нову публікацію — як у мобільному застосунку.",
  walletRenewHint:
    "Оберіть купон, використайте кредит Plus або оплатіть поновлення оголошення на 30 днів.",
  walletLoadFailed: "Не вдалося завантажити гаманець.",
  walletHttpError: "Не вдалося завантажити гаманець (помилка HTTP).",
  walletUsePlusCredit: "Використати кредит Plus",
  walletPlusCreditLine:
    "{count} публікація(й) · {days} днів на ринку{expiry}",
  walletNoPlusOnAccount: "Немає активного кредиту Plus на обліковому записі.",
  walletPayRenewal: "Оплатити поновлення",
  walletBuyPlusAction: "Купити пакет Plus",
  walletRenewPaymentDesc: "Подовжити оголошення на {days} днів · {price}",
  walletBuyPlusPaymentDesc:
    "Оплатити 1 додаткову публікацію ({price}) — кредит з'явиться після оплати",
  sumSecOffer: "Оголошення",
  sumSecLocation: "Локація",
  sumSecParams: "Параметри та фінанси",
  sumSecRent: "Умови оренди",
  sumSecAmenities: "Зручності",
  sumSecContact: "Контакт",
  sumRowTransaction: "Тип угоди",
  sumRowPropertyType: "Тип нерухомості",
  sumRowCondition: "Стан оздоблення",
  sumRowTitle: "Заголовок оголошення",
  sumRowDescription: "Опис",
  sumRowLocation: "Локація",
  sumRowMapVisibility: "Видимість на карті",
  sumRowStreet: "Вулиця та номер",
  sumRowCity: "Місто",
  sumRowDistrict: "Район",
  sumRowApartment: "№ квартири",
  sumRowLandRegistry: "Книга постійних прав (KW)",
  sumRowCoordinates: "Координати",
  sumRowPrice: "Ціна",
  sumRowArea: "Площа",
  sumRowRooms: "Кількість кімнат",
  sumRowFloor: "Поверх",
  sumRowBuildYear: "Рік будівництва",
  sumRowPlotArea: "Площа ділянки",
  sumRowHeating: "Опалення",
  sumRowFurnished: "Меблі",
  sumRowCommission: "Комісія агента",
  sumRowAdminFee: "Комунальний внесок",
  sumRowRentAdmin: "Додаткові платежі (адмін)",
  sumRowDeposit: "Завдаток",
  sumRowMinPeriod: "Мінімальний термін оренди",
  sumRowAvailableFrom: "Доступно з",
  sumRowRentType: "Тип оренди",
  sumRowPets: "Тварини",
  sumRowAdvertiser: "Тип рекламодавця",
  sumRowAgencyName: "Назва агентства",
  sumRowContactName: "Контактна особа",
  sumRowPhone: "Телефон",
  sumRowEmail: "E-mail",
  sumSelected: "Обрано",
  sumLocExact: "Точна — вулиця та номер",
  sumLocApprox: "Приблизна — лише район",
  sumCommissionZero: "Без комісії (0%)",
  sumAdvertiserAgency: "Агентство / офіс",
  sumAdvertiserPrivate: "Приватна особа",
  step3FinancialTitle: "Фінансові параметри",
  step4GalleryTitle: "Галерея та презентація",
  plusReachBadge: "Охоплення помножене",
  plusActivatedBody: "Активовано. Ваше оголошення потрапляє до тисяч інвесторів.",
  plusViewStats: "Переглянути статистику",
};

export function getAddOfferFormExtended(locale: Locale): AddOfferFormExtended {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
