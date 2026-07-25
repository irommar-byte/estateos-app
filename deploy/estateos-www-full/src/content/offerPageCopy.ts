import type { Locale } from "@/i18n/config";
import { UK } from "@/i18n/offerPageCopyUk";

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
  legalVerifiedKwSublabel: string;
  legalUnverifiedKw: string;
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
  totalFloors: string;
  standard: string;
  buildingType: string;
  buildYear: string;
  heating: string;
  furnished: string;
  furnishedYes: string;
  furnishedNo: string;
  rentFee: string;
  rentAdditionalCosts: string;
  rentCostsMonthlyHint: string;
  availability: string;
  aboutProperty: string;
  amenities: string;
  floorPlan: string;
  enlarge: string;
  floorPlanScan: {
    layoutSubtitle: string;
    subtitle: string;
    lidarBadge: string;
    viewImage: string;
    viewInteractive: string;
  };
  floorPlanWalkthrough: {
    title: string;
    subtitle: string;
    openAr: string;
    loading: string;
    iosHint: string;
    desktopHint: string;
  };
  locationSection: string;
  neighborhoodPreview: string;
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
  contactSeller: string;
  askSeller: string;
  sellerOnline: string;
  sellerOffline: string;
  sellerLastSeenPrefix: string;
  guestAsk: {
    title: string;
    subtitle: string;
    questionsLabel: string;
    questions: { key: string; label: string }[];
    phoneLabel: string;
    phonePlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    nameLabel: string;
    nameOptional: string;
    namePlaceholder: string;
    send: string;
    sending: string;
    successTitle: string;
    successBody: string;
    close: string;
    errorGeneric: string;
  };
  agentPhotoAlt: string;
  companyLogoAlt: string;
  agentRoleLabel: string;
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
  openHouse: {
    bannerTitle: string;
    bannerSubtitle: (date: string, spots: number) => string;
    bannerCta: string;
    modalTitle: string;
    modalSubtitle: string;
    slotsSection: string;
    pickHourSection: string;
    pickHourHint: string;
    flexWindowHint: string;
    pickSlotRequired: string;
    guestCount: string;
    note: string;
    notePlaceholder: string;
    reserveCta: string;
    reservedCta: string;
    cancelReservation: string;
    slotTaken: string;
    spotsLeft: (n: number) => string;
    loginRequired: string;
    reserveSuccess: string;
    reserveSuccessHint: string;
    loadError: string;
    loadErrorHint: string;
    errorGeneric: string;
    close: string;
  };
  auction: {
    bannerTitle: string;
    bannerSubtitleLive: (price: string, bids: number) => string;
    bannerSubtitleScheduled: (date: string) => string;
    bannerCta: string;
    liveBadge: string;
    modalTitle: string;
    modalSubtitle: string;
    currentPrice: string;
    nextMinBid: string;
    yourBid: string;
    bidCta: string;
    leadingBadge: string;
    outbidBadge: string;
    timeLeft: string;
    recentBids: string;
    bidSuccess: string;
    bidSuccessHint: string;
    loginRequired: string;
    hostCannotBid: string;
    auctionClosed: string;
    bidTooLow: string;
    loadError: string;
    loadErrorHint: string;
    errorGeneric: string;
    close: string;
    quickBid: string;
    endedTitle: string;
    endedHint: string;
    scheduledHint: string;
    countdownToStart: string;
    notStartedYet: string;
    contactHost: string;
    viewHostProfile: string;
  };
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
  legalVerifiedKw: "Zweryfikowane",
  legalVerifiedKwSublabel: "KW",
  legalUnverifiedKw: "Bez weryfikacji",
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
  totalFloors: "Pięter w budynku",
  standard: "Standard",
  buildingType: "Typ obiektu",
  buildYear: "Rok budowy",
  heating: "Ogrzewanie",
  furnished: "Umeblowane",
  furnishedYes: "Tak",
  furnishedNo: "Nie",
  rentFee: "Czynsz",
  rentAdditionalCosts: "koszty",
  rentCostsMonthlyHint: "Opłaty administracyjne — miesięcznie, poza czynszem najmu.",
  availability: "Dostępność",
  aboutProperty: "O nieruchomości",
  amenities: "Udogodnienia",
  floorPlan: "Rzut lokalu",
  enlarge: "Powiększ",
  floorPlanScan: {
    layoutSubtitle: "Układ pomieszczeń i metraż",
    subtitle: "Plan wygenerowany ze skanu LiDAR",
    lidarBadge: "LiDAR",
    viewImage: "Rzut",
    viewInteractive: "Skan interaktywny",
  },
  floorPlanWalkthrough: {
    title: "Wirtualny spacer 3D",
    subtitle: "Przeglądaj model pomieszczeń ze skanu LiDAR",
    openAr: "AR Quick Look",
    loading: "Ładowanie modelu 3D…",
    iosHint: "Na iPhone/iPad dotknij AR Quick Look, aby zobaczyć model w rozszerzonej rzeczywistości.",
    desktopHint: "Obróć model myszą. Pełny spacer AR dostępny w Safari na iPhone/iPad.",
  },
  locationSection: "Lokalizacja",
  neighborhoodPreview: "Okolica nieruchomości",
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
  contactSeller: "Skontaktuj się ze sprzedawcą",
  askSeller: "Zapytaj",
  sellerOnline: "Online",
  sellerOffline: "Offline",
  sellerLastSeenPrefix: "Ostatnio online",
  guestAsk: {
    title: "Zapytaj wystawcę",
    subtitle:
      "Bez rejestracji — zostaw telefon i krótką wiadomość. Wystawca dostanie e-mail oraz powiadomienie w EstateOS.",
    questionsLabel: "Popularne pytania",
    questions: [
      { key: "isAvailable", label: "Czy oferta jest nadal aktualna?" },
      { key: "viewingWhen", label: "Kiedy można obejrzeć?" },
      { key: "priceNegotiable", label: "Czy cena jest do negocjacji?" },
      { key: "moreInfo", label: "Proszę o więcej informacji" },
    ],
    phoneLabel: "Twój telefon",
    phonePlaceholder: "+48 …",
    messageLabel: "Krótka wiadomość",
    messagePlaceholder: "Napisz, o co chcesz zapytać…",
    nameLabel: "Imię",
    nameOptional: "opcjonalnie",
    namePlaceholder: "Jak się do Ciebie zwracać?",
    send: "Wyślij zapytanie",
    sending: "Wysyłanie…",
    successTitle: "Zapytanie wysłane",
    successBody:
      "Wystawca otrzymał Twoją wiadomość na e-mail oraz powiadomienie. Oczekuj kontaktu telefonicznego.",
    close: "Zamknij",
    errorGeneric: "Nie udało się wysłać zapytania. Spróbuj ponownie.",
  },
  agentPhotoAlt: "Zdjęcie agenta",
  companyLogoAlt: "Logo firmy",
  agentRoleLabel: "Agent",
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
  openHouse: {
    bannerTitle: "Dzień otwartych drzwi",
    bannerSubtitle: (date, spots) => `Najbliższy termin: ${date} · ${spots} wolnych miejsc`,
    bannerCta: "Zarezerwuj wizytę",
    modalTitle: "Dzień otwarty",
    modalSubtitle: "Wybierz termin wizyty",
    slotsSection: "Terminy wizyt",
    pickHourSection: "Wybierz godzinę wizyty",
    pickHourHint: "Dotknij wolnej godziny — dopiero potem potwierdź rezerwację.",
    flexWindowHint: "Możesz przyjść w dowolnym momencie w tym przedziale.",
    pickSlotRequired: "Wybierz konkretną godzinę wizyty.",
    guestCount: "Liczba osób",
    note: "Notatka dla gospodarza (opcjonalnie)",
    notePlaceholder: "Np. przyjadę z partnerem, proszę o kontakt na WhatsApp…",
    reserveCta: "Zarezerwuj ten termin",
    reservedCta: "Masz rezerwację",
    cancelReservation: "Anuluj rezerwację",
    slotTaken: "Zajęty",
    spotsLeft: (n) => `${n} wolnych miejsc`,
    loginRequired: "Zaloguj się, aby zarezerwować termin.",
    reserveSuccess: "Termin zarezerwowany",
    reserveSuccessHint: "Organizator otrzyma powiadomienie o Twojej wizycie.",
    loadError: "Nie udało się wczytać wydarzenia",
    loadErrorHint: "Wydarzenie mogło wygasnąć lub zostało anulowane.",
    errorGeneric: "Coś poszło nie tak. Spróbuj ponownie.",
    close: "Zamknij",
  },
  auction: {
    bannerTitle: "Licytacja online",
    bannerSubtitleLive: (price, bids) => `Aktualna oferta: ${price} · ${bids} ofert`,
    bannerSubtitleScheduled: (date) => `Start: ${date}`,
    bannerCta: "Licytuj",
    liveBadge: "Na żywo",
    modalTitle: "Licytacja",
    modalSubtitle: "Złóż ofertę wyższą od aktualnej",
    currentPrice: "Aktualna cena",
    nextMinBid: "Minimalna oferta",
    yourBid: "Twoja oferta (PLN)",
    bidCta: "Złóż ofertę",
    leadingBadge: "Prowadzisz",
    outbidBadge: "Przebito",
    timeLeft: "Pozostało",
    recentBids: "Ostatnie oferty",
    bidSuccess: "Oferta złożona",
    bidSuccessHint: "Otrzymasz powiadomienie, jeśli ktoś Cię przebije.",
    loginRequired: "Zaloguj się, aby licytować.",
    hostCannotBid: "Organizator nie może licytować własnej aukcji.",
    auctionClosed: "Licytacja zakończona.",
    bidTooLow: "Oferta za niska — podnieś kwotę.",
    loadError: "Nie udało się wczytać licytacji",
    loadErrorHint: "Licytacja mogła wygasnąć lub zostać anulowana.",
    errorGeneric: "Coś poszło nie tak. Spróbuj ponownie.",
    close: "Zamknij",
    quickBid: "Szybka oferta",
    endedTitle: "Licytacja zakończona",
    endedHint: "Zwycięzca został powiadomiony. Skontaktuj się ze sprzedającym.",
    scheduledHint: "Licytacja rozpocznie się automatycznie o wyznaczonej godzinie.",
    countdownToStart: "Do startu",
    notStartedYet: "Licytacja jeszcze się nie rozpoczęła — oferty będą możliwe po starcie.",
    contactHost: "Napisz do wystawiającego",
    viewHostProfile: "Profil wystawiającego",
  },
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
  legalVerifiedKw: "Verified",
  legalVerifiedKwSublabel: "KW",
  legalUnverifiedKw: "Unverified",
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
  totalFloors: "Building floors",
  standard: "Finish standard",
  buildingType: "Property type",
  buildYear: "Year built",
  heating: "Heating",
  furnished: "Furnished",
  furnishedYes: "Yes",
  furnishedNo: "No",
  rentFee: "Service charge",
  rentAdditionalCosts: "costs",
  rentCostsMonthlyHint: "Administrative charges — monthly, on top of the rent.",
  availability: "Availability",
  aboutProperty: "About the property",
  amenities: "Amenities",
  floorPlan: "Floor plan",
  enlarge: "Enlarge",
  floorPlanScan: {
    layoutSubtitle: "Layout and room arrangement",
    subtitle: "Floor plan generated from a LiDAR scan",
    lidarBadge: "LiDAR",
    viewImage: "Image",
    viewInteractive: "Interactive scan",
  },
  floorPlanWalkthrough: {
    title: "3D virtual walkthrough",
    subtitle: "Explore the LiDAR room model",
    openAr: "AR Quick Look",
    loading: "Loading 3D model…",
    iosHint: "On iPhone/iPad, tap AR Quick Look to view the model in augmented reality.",
    desktopHint: "Rotate the model with your mouse. Full AR walkthrough is available in Safari on iPhone/iPad.",
  },
  locationSection: "Location",
  neighborhoodPreview: "Neighborhood",
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
  contactSeller: "Contact the seller",
  askSeller: "Ask",
  sellerOnline: "Online",
  sellerOffline: "Offline",
  sellerLastSeenPrefix: "Last seen",
  guestAsk: {
    title: "Ask the seller",
    subtitle:
      "No account needed — leave your phone and a short message. The seller gets an email and an EstateOS notification.",
    questionsLabel: "Popular questions",
    questions: [
      { key: "isAvailable", label: "Is this listing still available?" },
      { key: "viewingWhen", label: "When can I view the property?" },
      { key: "priceNegotiable", label: "Is the price negotiable?" },
      { key: "moreInfo", label: "Please share more details" },
    ],
    phoneLabel: "Your phone",
    phonePlaceholder: "+48 …",
    messageLabel: "Short message",
    messagePlaceholder: "What would you like to ask?",
    nameLabel: "Name",
    nameOptional: "optional",
    namePlaceholder: "How should we address you?",
    send: "Send inquiry",
    sending: "Sending…",
    successTitle: "Inquiry sent",
    successBody:
      "The seller received your message by email and as a notification. Expect a phone callback.",
    close: "Close",
    errorGeneric: "Could not send the inquiry. Please try again.",
  },
  agentPhotoAlt: "Agent photo",
  companyLogoAlt: "Company logo",
  agentRoleLabel: "Agent",
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
  openHouse: {
    bannerTitle: "Open house day",
    bannerSubtitle: (date, spots) => `Next slot: ${date} · ${spots} spots left`,
    bannerCta: "Book a visit",
    modalTitle: "Open house",
    modalSubtitle: "Pick your visit time",
    slotsSection: "Visit slots",
    pickHourSection: "Choose a visit time",
    pickHourHint: "Tap an available hour, then confirm your booking.",
    flexWindowHint: "You may arrive anytime within this window.",
    pickSlotRequired: "Please select a specific visit time.",
    guestCount: "Guests",
    note: "Note for the host (optional)",
    notePlaceholder: "E.g. arriving with a partner, please call on WhatsApp…",
    reserveCta: "Book this slot",
    reservedCta: "You are booked",
    cancelReservation: "Cancel booking",
    slotTaken: "Taken",
    spotsLeft: (n) => `${n} spots left`,
    loginRequired: "Sign in to book a visit.",
    reserveSuccess: "Visit booked",
    reserveSuccessHint: "The host will be notified about your visit.",
    loadError: "Could not load this event",
    loadErrorHint: "The event may have expired or been cancelled.",
    errorGeneric: "Something went wrong. Please try again.",
    close: "Close",
  },
  auction: {
    bannerTitle: "Online auction",
    bannerSubtitleLive: (price, bids) => `Current bid: ${price} · ${bids} bids`,
    bannerSubtitleScheduled: (date) => `Starts: ${date}`,
    bannerCta: "Place bid",
    liveBadge: "Live",
    modalTitle: "Auction",
    modalSubtitle: "Bid higher than the current price",
    currentPrice: "Current price",
    nextMinBid: "Minimum bid",
    yourBid: "Your bid (PLN)",
    bidCta: "Submit bid",
    leadingBadge: "You are leading",
    outbidBadge: "Outbid",
    timeLeft: "Time left",
    recentBids: "Recent bids",
    bidSuccess: "Bid placed",
    bidSuccessHint: "You will be notified if someone outbids you.",
    loginRequired: "Sign in to place a bid.",
    hostCannotBid: "The host cannot bid on their own auction.",
    auctionClosed: "Auction has ended.",
    bidTooLow: "Bid too low — increase your amount.",
    loadError: "Could not load auction",
    loadErrorHint: "The auction may have expired or been cancelled.",
    errorGeneric: "Something went wrong. Please try again.",
    close: "Close",
    quickBid: "Quick bid",
    endedTitle: "Auction ended",
    endedHint: "The winner has been notified. Contact the seller to proceed.",
    scheduledHint: "The auction will start automatically at the scheduled time.",
    countdownToStart: "Starts in",
    notStartedYet: "The auction has not started yet — bidding opens at the scheduled time.",
    contactHost: "Message seller",
    viewHostProfile: "Seller profile",
  },
};

export function getOfferPageCopy(locale: Locale): OfferPageCopy {
  if (locale === "pl") return PL;
  if (locale === "uk") return UK;
  return EN;
}
