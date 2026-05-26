import type { Locale } from "./config";

export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    login: string;
    profile: string;
    manage: string;
    manageCentral: string;
    manageAccount: string;
    discoverMap: string;
    market: string;
    elite: string;
    logout: string;
    langPl: string;
    langEn: string;
  };
  theme: {
    label: string;
    light: string;
    dark: string;
    system: string;
  };
  notifications: {
    label: string;
    title: string;
    new: string;
    empty: string;
    markAllRead: string;
    messages: string;
  };
  hero: {
    eyebrow: string;
    lead: string;
    leadBold: string;
    leadExtra: string;
    ctaRadar: string;
    ctaList: string;
    ctaAccount: string;
    ctaPro: string;
    exploreMap: string;
  };
  pulse: {
    title: string;
    liveFrom: string;
    synced: string;
    listings: string;
    new24h: string;
    markets: string;
    members: string;
    avgSqm: string;
    listingOne: string;
    listingMany: string;
    fallbackTicker: string;
    delayedTicker: string;
  };
  highlights: {
    eyebrow: string;
    title: string;
    body: string;
    radarTitle: string;
    radarBody: string;
    verifiedTitle: string;
    verifiedBody: string;
    passkeyTitle: string;
    passkeyBody: string;
    dealsTitle: string;
    dealsBody: string;
  };
  homePremium: {
    loading: string;
    emptyTitle: string;
    emptySearch: string;
    errorTitle: string;
    dealRoom: string;
    priceOnRequest: string;
    pricePerMonth: string;
    livePulseActive: string;
    searchPlaceholder: string;
    searchSale: string;
    searchRent: string;
    searchTypeAll: string;
    searchTypeFlat: string;
    searchTypeHouse: string;
    searchTypeCommercial: string;
    searchTypePlot: string;
    searchButton: string;
    statsActiveOffers: string;
    statsNewOffers24h: string;
    statsMarketCities: string;
    statsRegisteredMembers: string;
    galleryEyebrow: string;
    galleryTitle: string;
    galleryTitleHighlight: string;
    gallerySubtitle: string;
    galleryViewAll: string;
    galleryPriceLabel: string;
    galleryAreaLabel: string;
    galleryRoomsLabel: string;
    mapEyebrow: string;
    mapTitle: string;
    mapTitleHighlight: string;
    mapSubtitle: string;
    trustRadarTitle: string;
    trustRadarDesc: string;
    trustSecurityTitle: string;
    trustSecurityDesc: string;
    trustLegalTitle: string;
    trustLegalDesc: string;
  };
  map: {
    forSale: string;
    forRent: string;
    market: string;
    allMarkets: string;
    type: string;
    allTypes: string;
    apartment: string;
    house: string;
    land: string;
    commercial: string;
    price: string;
    pricePerMonth: string;
    allPrices: string;
    minPlot: string;
    districts: string;
    allDistricts: string;
    districtsHint: string;
    loadingDistricts: string;
    clearDistricts: string;
    showOnMap: string;
    listing: string;
    listings: string;
    wholeCity: string;
    selectedCount: string;
    placeholderPlot: string;
  };
  footer: {
    rights: string;
    tagline: string;
    terms: string;
    privacy: string;
    listings: string;
    central: string;
  };
  badges: {
    admin: string;
    agent: string;
    partner: string;
    investorPro: string;
  };
  crm: {
    accountEyebrow: string;
    userIdLabel: string;
    tabRadar: string;
    tabMyOffers: string;
    tabFavorites: string;
    tabPlanning: string;
    tabDeals: string;
    radarTitle: string;
    radarTitlePro: string;
    radarDesc: string;
    radarDescPro: string;
    activeScanning: string;
    radarPro: string;
    radarProDual: string;
    radarOff: string;
    radarActive: string;
    calibrate: string;
    location: string;
    propertyType: string;
    minArea: string;
    budget: string;
    matchThreshold: string;
    matchLabel: string;
    sale: string;
    rent: string;
    rooms: string;
    statusActive: string;
    viewOffer: string;
    perMonth: string;
    noMatches: string;
    standardUser: string;
    seeProfile: string;
    dealsTitle: string;
    dealsTitleHighlight: string;
    dealsDesc: string;
    planningTitle: string;
    planningTitleHighlight: string;
    planningDesc: string;
    favoritesTitle: string;
    favoritesTitleHighlight: string;
    favoritesDesc: string;
    myOffersTitle: string;
    myOffersTitleHighlight: string;
    myOffersDesc: string;
  };
  pricing: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    titleSuffix: string;
    subtitle: string;
    tabPrivate: string;
    tabAgency: string;
    basicName: string;
    basicDesc: string;
    basicPrice: string;
    basicF1: string;
    basicF2: string;
    basicF3: string;
    basicF4: string;
    basicCta: string;
    proBadge: string;
    proName: string;
    proDesc: string;
    proWas: string;
    proPrice: string;
    proF1: string;
    proF2: string;
    proF3: string;
    proF4: string;
    proF5: string;
    proCta: string;
    proCtaLoading: string;
    agencySoon: string;
    agencySoonTitle: string;
    agencySoonDesc: string;
    modalTitle: string;
    modalSubtitle: string;
    modalBuy: string;
    modalBuyDesc: string;
    modalSell: string;
    modalSellDesc: string;
  };
};

const pl: Dictionary = {
  meta: {
    title: "EstateOS™ | Premium nieruchomości na świecie",
    description:
      "Odkrywaj, wystawiaj i zamykaj transakcje premium. Mapa 3D, Inteligentny Radar, weryfikacja i Passkey.",
  },
  nav: {
    login: "Zaloguj",
    profile: "Profil",
    manage: "Zarządzaj",
    manageCentral: "Zarządzaj (Centrala)",
    manageAccount: "Zarządzaj kontem",
    discoverMap: "Odkryj mapę",
    market: "Rynek nieruchomości",
    elite: "EstateOS™ Elite",
    logout: "Wyloguj",
    langPl: "PL",
    langEn: "EN",
  },
  theme: {
    label: "Motyw",
    light: "Jasny",
    dark: "Ciemny",
    system: "System",
  },
  notifications: {
    label: "Powiadomienia",
    title: "Powiadomienia",
    new: "Nowe",
    empty: "Brak nowych powiadomień.",
    markAllRead: "Oznacz jako przeczytane",
    messages: "wiadomości",
  },
  hero: {
    eyebrow: "Globalna inteligencja rynku premium",
    lead: "Wystaw rezydencję ",
    leadBold: "bez kosztów",
    leadExtra:
      " lub odkryj swój nowy adres. Ustaw Inteligentny Radar raz — oferty premium dotrą do Ciebie same.",
    ctaRadar: "Szukaj na Radarze",
    ctaList: "Dodaj ofertę",
    ctaAccount: "Moje konto",
    ctaPro: "Pakiety Pro",
    exploreMap: "Mapa ofert",
  },
  pulse: {
    title: "Puls rynku",
    liveFrom: "Na żywo z EstateOS™",
    synced: "Synchronizacja",
    listings: "Aktywne oferty",
    new24h: "Nowe · 24h",
    markets: "Rynki",
    members: "Użytkownicy",
    avgSqm: "Śr. za m²",
    listingOne: "oferta",
    listingMany: "ofert",
    fallbackTicker: "EstateOS™ — premium nieruchomości na świecie",
    delayedTicker: "Opóźniona synchronizacja — Puls rynku EstateOS™",
  },
  highlights: {
    eyebrow: "Doświadczenie EstateOS",
    title: "Stworzone dla globalnego premium",
    body:
      "EstateOS™ łączy odkrywanie, zaufanie i proces transakcyjny w jednej platformie — od pierwszego wrażenia po podpis umowy.",
    radarTitle: "Inteligentny Radar",
    radarBody:
      "Ustaw kryteria raz. Dopasowane oferty premium pojawiają się automatycznie na rynkach globalnych.",
    verifiedTitle: "Zweryfikowane oferty",
    verifiedBody:
      "Kontrole prawne, sygnały zaufania i workflow concierge dla poważnych transakcji.",
    passkeyTitle: "Dostęp Passkey",
    passkeyBody:
      "Logowanie biometryczne — szybko, bezpiecznie i wygodnie w aplikacji mobilnej.",
    dealsTitle: "Oferty prywatne",
    dealsBody:
      "Wczesny dostęp i transakcje off-market dla członków, którzy działają pierwsi.",
  },
  homePremium: {
    loading: "Wczytywanie...",
    emptyTitle: "Brak wyników",
    emptySearch: "Zmień kryteria wyszukiwania, aby odkryć inne nieruchomości.",
    errorTitle: "Błąd połączenia",
    dealRoom: "Deal Room",
    priceOnRequest: "Cena na zapytanie",
    pricePerMonth: "/ mc",
    livePulseActive: "Aktywnych Ofert",
    searchPlaceholder: "Wpisz miasto lub dzielnicę...",
    searchSale: "Na sprzedaż",
    searchRent: "Na wynajem",
    searchTypeAll: "Wszystkie typy",
    searchTypeFlat: "Apartamenty",
    searchTypeHouse: "Domy",
    searchTypeCommercial: "Komercyjne",
    searchTypePlot: "Działki",
    searchButton: "Szukaj",
    statsActiveOffers: "Zweryfikowanych Ofert",
    statsNewOffers24h: "Nowych w 24h",
    statsMarketCities: "Obsługiwanych Miast",
    statsRegisteredMembers: "Zaufanych Klientów",
    galleryEyebrow: "Wyselekcjonowane z rynku",
    galleryTitle: "Ekskluzywne",
    galleryTitleHighlight: "Odkrycia",
    gallerySubtitle: "Wyselekcjonowane oferty z rynku EstateOS, przygotowane do odkrywania premium.",
    galleryViewAll: "Zobacz całą kolekcję",
    galleryPriceLabel: "Cena",
    galleryAreaLabel: "Powierzchnia",
    galleryRoomsLabel: "pokoje",
    mapEyebrow: "Radar nieruchomości live",
    mapTitle: "Inteligentny",
    mapTitleHighlight: "Radar",
    mapSubtitle:
      "Interaktywna mapa globalnych ofert premium. Zdefiniuj parametry i pozwól systemowi zlokalizować Twoją następną inwestycję.",
    trustRadarTitle: "Inteligentny Radar",
    trustRadarDesc:
      "Zdefiniuj swoje parametry. Nasz system 24/7 skanuje rynek i dostarcza idealnie dopasowane inwestycje.",
    trustSecurityTitle: "Technologia Passkey",
    trustSecurityDesc:
      "Biometryczna autoryzacja bez haseł. Zapewniamy bezpieczeństwo klasy korporacyjnej dla Twoich danych.",
    trustLegalTitle: "Weryfikacja Prawna",
    trustLegalDesc:
      "Integracja z Księgami Wieczystymi i procesy audytu zabezpieczają każdą transakcję na platformie.",
  },
  map: {
    forSale: "Na sprzedaż",
    forRent: "Na wynajem",
    market: "Rynek",
    allMarkets: "Wszystkie rynki",
    type: "Typ",
    allTypes: "Wszystkie typy",
    apartment: "Mieszkanie",
    house: "Dom",
    land: "Działka",
    commercial: "Lokal",
    price: "Cena",
    pricePerMonth: "Cena / mc",
    allPrices: "Wszystkie",
    minPlot: "Min. pow. działki (m²)",
    districts: "Dzielnice",
    allDistricts: "Wszystkie dzielnice",
    districtsHint: "Przesuń palcem — wybór jak w wyszukiwarce. Pusto = cały rynek.",
    loadingDistricts: "Ładuję listę…",
    clearDistricts: "Wyczyść dzielnice",
    showOnMap: "Pokaż na mapie",
    listing: "oferta",
    listings: "ofert",
    wholeCity: "Całe miasto",
    selectedCount: "{n} wybrane",
    placeholderPlot: "np. 500",
  },
  footer: {
    rights: "© 2026 EstateOS™. Wszelkie prawa zastrzeżone.",
    tagline: "Globalna inteligencja nieruchomości premium",
    terms: "Regulamin",
    privacy: "Prywatność",
    listings: "Oferty",
    central: "Centrala",
  },
  badges: {
    admin: "Administrator",
    agent: "Agent EstateOS",
    partner: "Partner EstateOS",
    investorPro: "Investor Pro",
  },
  crm: {
    accountEyebrow: "Moje konto EstateOS™",
    userIdLabel: "ID użytkownika",
    tabRadar: "Radar inwestycji",
    tabMyOffers: "Moje ogłoszenia",
    tabFavorites: "Ulubione",
    tabPlanning: "Planowanie",
    tabDeals: "Transakcje",
    radarTitle: "Radar",
    radarTitlePro: "PRO",
    radarDesc:
      "Ustaw kryteria jak w aplikacji: lokalizacja, metraż, budżet i tryb transakcji. Po zapisie radar natychmiast przelicza dopasowania.",
    radarDescPro:
      "Radar PRO: kalibracja jak w aplikacji — tryb MAP (obszar na mapie) lub miasto i dzielnice. Po zapisie natychmiastowe przeliczenie dopasowań.",
    activeScanning: "Aktywne skanowanie",
    radarPro: "Radar PRO",
    radarProDual: "Podwójny skan · Radar PRO",
    radarOff: "Radar wyłączony",
    radarActive: "Radar aktywny",
    calibrate: "Kalibruj radar",
    location: "Lokalizacja",
    propertyType: "Typ",
    minArea: "Metraż",
    budget: "Budżet",
    matchThreshold: "Próg dopasowania",
    matchLabel: "Dopasowanie",
    sale: "Sprzedaż",
    rent: "Wynajem",
    rooms: "Pokoje",
    statusActive: "Aktywna",
    viewOffer: "Zobacz ofertę",
    perMonth: "/ mc",
    noMatches: "Brak dopasowań — skalibruj radar, aby zobaczyć oferty.",
    standardUser: "Użytkownik",
    seeProfile: "Zobacz profil",
    dealsTitle: "Szyfrowane",
    dealsTitleHighlight: "pokoje transakcyjne",
    dealsDesc: "Prywatne Deal roomy do finalizacji: wiadomości, oferty cenowe, dokumenty.",
    planningTitle: "Centrum",
    planningTitleHighlight: "planowania",
    planningDesc: "Kalendarz spotkań, wizyty i priorytety powiązane z transakcjami.",
    favoritesTitle: "Moje",
    favoritesTitleHighlight: "ulubione",
    favoritesDesc: "Obserwowane oferty i szybki powrót do statusu na rynku.",
    myOffersTitle: "Moje",
    myOffersTitleHighlight: "ogłoszenia",
    myOffersDesc: "Zarządzaj statusami, odnowieniami i statystykami swoich ofert.",
  },
  pricing: {
    eyebrow: "Wybierz swój poziom",
    title: "Inwestuj",
    titleHighlight: "mądrzej",
    titleSuffix: ", nie ciężej.",
    subtitle:
      "Niezależnie od tego, czy sprzedajesz swoje pierwsze mieszkanie, polujesz na okazje zanim pojawią się na szerokim rynku, czy zarządzasz agencją – mamy plan skrojony pod Ciebie.",
    tabPrivate: "Prywatni & Inwestorzy",
    tabAgency: "Agencje PRO",
    basicName: "Basic",
    basicDesc: "Idealny start do sprzedaży własnej nieruchomości lub szukania ofert.",
    basicPrice: "0 PLN",
    basicF1: "1 aktywne ogłoszenie w naszej bazie.",
    basicF2:
      "Radar: na Basic widzisz mniej w pierwszych 24 godzinach premiery — po tym czasie jak na szerokim rynku. PRO widzi pełny obraz od razu.",
    basicF3: "Podstawowe statystyki wyświetleń.",
    basicF4:
      "Opcjonalnie: Pakiet + — jedno dodatkowe ogłoszenie na 30 dni (4. i kolejne poza limitem planu).",
    basicCta: "Załóż darmowe konto",
    proBadge: "Rekomendowane",
    proName: "Investor PRO",
    proDesc: "Dla łowców okazji. Bądź zawsze o krok przed resztą rynku.",
    proWas: "299 PLN",
    proPrice: "249",
    proF1:
      "Natychmiastowy Radar — bez 24‑godzinnego okna premiery jak na Basic. Powiadomienia PUSH w ułamek sekundy.",
    proF2:
      "3 aktywne ogłoszenia w złotych slotach PRO — ramka premium i priorytet na mapie.",
    proF3:
      "4. i kolejne ogłoszenia — jak dla wszystkich: Pakiet + (jedno ogłoszenie / 30 dni za kredyt).",
    proF4: "Wczesny dostęp — szczegóły ofert 24 h przed premierą na szerokim rynku.",
    proF5: "Złota rama wyróżniająca Twoje oferty.",
    proCta: "Wybieram PRO",
    proCtaLoading: "Przetwarzam...",
    agencySoon: "Wkrótce",
    agencySoonTitle: "EstateOS Agency PRO",
    agencySoonDesc:
      "Pakiet dla biur nieruchomości przygotowujemy — CRM, import XML i leady Concierge. Wróć za chwilę.",
    modalTitle: "Jaki jest Twój Cel?",
    modalSubtitle: "Wybierz odpowiednią ścieżkę, abyśmy mogli dopasować narzędzia do Twoich potrzeb.",
    modalBuy: "Chcę Kupić",
    modalBuyDesc: "Przeglądaj ekskluzywne oferty i korzystaj z Radaru.",
    modalSell: "Chcę Sprzedać",
    modalSellDesc: "Dodaj swoją nieruchomość do bazy i znajdź kupca.",
  },
};

const en: Dictionary = {
  meta: {
    title: "EstateOS™ | Global Premium Real Estate",
    description:
      "Discover, list, and close premium properties worldwide. 3D map, Intelligent Radar, verification, and Passkey.",
  },
  nav: {
    login: "Sign in",
    profile: "Profile",
    manage: "Manage",
    manageCentral: "Manage (Central)",
    manageAccount: "Manage account",
    discoverMap: "Discover map",
    market: "Property market",
    elite: "EstateOS™ Elite",
    logout: "Log out",
    langPl: "PL",
    langEn: "EN",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  notifications: {
    label: "Notifications",
    title: "Notifications",
    new: "New",
    empty: "No new notifications.",
    markAllRead: "Mark all as read",
    messages: "messages",
  },
  hero: {
    eyebrow: "Global premium real estate intelligence",
    lead: "List a residence ",
    leadBold: "at no cost",
    leadExtra:
      " or discover your next address anywhere. Set Intelligent Radar once — premium matches arrive on their own.",
    ctaRadar: "Search on Radar",
    ctaList: "List property",
    ctaAccount: "My account",
    ctaPro: "Pro plans",
    exploreMap: "Explore market",
  },
  pulse: {
    title: "Market pulse",
    liveFrom: "Live from EstateOS™",
    synced: "Synced",
    listings: "Live listings",
    new24h: "New · 24h",
    markets: "Markets",
    members: "Members",
    avgSqm: "Avg / m²",
    listingOne: "listing",
    listingMany: "listings",
    fallbackTicker: "EstateOS™ — global premium real estate",
    delayedTicker: "Live sync delayed — EstateOS™ market pulse",
  },
  highlights: {
    eyebrow: "Signature experience",
    title: "Built for global premium real estate",
    body:
      "EstateOS™ combines discovery, trust, and deal flow in one refined platform — from first impression to signed agreement.",
    radarTitle: "Intelligent Radar",
    radarBody:
      "Set your criteria once. Premium matches surface automatically across global markets.",
    verifiedTitle: "Verified listings",
    verifiedBody:
      "Legal checks, trust signals, and concierge-grade workflows for serious transactions.",
    passkeyTitle: "Passkey access",
    passkeyBody:
      "Biometric-grade sign-in designed for speed, security, and seamless mobile use.",
    dealsTitle: "Private deals",
    dealsBody:
      "Early visibility windows and off-market flows for members who move first.",
  },
  homePremium: {
    loading: "Loading...",
    emptyTitle: "No Results Found",
    emptySearch: "Adjust your parameters to discover other properties.",
    errorTitle: "Connection Error",
    dealRoom: "Deal Room",
    priceOnRequest: "Price on Request",
    pricePerMonth: "/ mo",
    livePulseActive: "Active Listings",
    searchPlaceholder: "City or neighborhood...",
    searchSale: "For Sale",
    searchRent: "For Rent",
    searchTypeAll: "All Properties",
    searchTypeFlat: "Apartments",
    searchTypeHouse: "Houses",
    searchTypeCommercial: "Commercial",
    searchTypePlot: "Land / Plots",
    searchButton: "Search",
    statsActiveOffers: "Verified Listings",
    statsNewOffers24h: "New in 24h",
    statsMarketCities: "Cities Covered",
    statsRegisteredMembers: "Trusted Members",
    galleryEyebrow: "Exclusive Global Selection",
    galleryTitle: "Curated",
    galleryTitleHighlight: "Residences",
    gallerySubtitle: "Real listings from the EstateOS market, presented with a gallery made for premium discovery.",
    galleryViewAll: "View all collection",
    galleryPriceLabel: "Price",
    galleryAreaLabel: "Area",
    galleryRoomsLabel: "rooms",
    mapEyebrow: "Live property radar",
    mapTitle: "Intelligent",
    mapTitleHighlight: "Radar",
    mapSubtitle:
      "Interactive global map of premium listings. Define your parameters and let EstateOS locate your next legacy asset.",
    trustRadarTitle: "AI Radar",
    trustRadarDesc:
      "Automated matchmaking. Define your parameters and let the system hunt for properties 24/7.",
    trustSecurityTitle: "Passkey Security",
    trustSecurityDesc:
      "Biometric authentication. No passwords. Enterprise-grade security for your assets.",
    trustLegalTitle: "Legal Verification",
    trustLegalDesc:
      "Integrated land registry checks and legal auditing before deals are closed.",
  },
  map: {
    forSale: "For sale",
    forRent: "For lease",
    market: "Market",
    allMarkets: "All markets",
    type: "Type",
    allTypes: "All property types",
    apartment: "Apartment",
    house: "House",
    land: "Land",
    commercial: "Commercial",
    price: "Price",
    pricePerMonth: "Price / mo",
    allPrices: "All ranges",
    minPlot: "Min. plot area (m²)",
    districts: "Districts",
    allDistricts: "All districts",
    districtsHint: "Swipe to select districts. Empty = entire market.",
    loadingDistricts: "Loading districts…",
    clearDistricts: "Clear districts",
    showOnMap: "Show on map",
    listing: "listing",
    listings: "listings",
    wholeCity: "Entire city",
    selectedCount: "{n} selected",
    placeholderPlot: "e.g. 500",
  },
  footer: {
    rights: "© 2026 EstateOS™. All rights reserved.",
    tagline: "Global premium real estate intelligence",
    terms: "Terms",
    privacy: "Privacy",
    listings: "Listings",
    central: "Central",
  },
  badges: {
    admin: "Administrator",
    agent: "Agent EstateOS",
    partner: "Partner EstateOS",
    investorPro: "Investor Pro",
  },
  crm: {
    accountEyebrow: "My EstateOS™ account",
    userIdLabel: "User ID",
    tabRadar: "Investment radar",
    tabMyOffers: "My listings",
    tabFavorites: "Favorites",
    tabPlanning: "Planning",
    tabDeals: "Transactions",
    radarTitle: "Investment",
    radarTitlePro: "Radar PRO",
    radarDesc:
      "Set criteria exactly like in the mobile app: location, area, budget, and transaction mode. After saving, radar recalculates matches instantly.",
    radarDescPro:
      "Radar PRO: calibration like the app — MAP area or city and districts. Matches refresh right after you save.",
    activeScanning: "Active scanning",
    radarPro: "Radar PRO",
    radarProDual: "Dual scan · Radar PRO",
    radarOff: "Radar off",
    radarActive: "Radar active",
    calibrate: "Calibrate radar",
    location: "Location",
    propertyType: "Type",
    minArea: "Min. area",
    budget: "Budget",
    matchThreshold: "Match threshold",
    matchLabel: "Match",
    sale: "For sale",
    rent: "For rent",
    rooms: "Rooms",
    statusActive: "Active",
    viewOffer: "View listing",
    perMonth: "/ mo",
    noMatches: "No matches yet — calibrate radar to see listings.",
    standardUser: "Member",
    seeProfile: "View profile",
    dealsTitle: "Encrypted",
    dealsTitleHighlight: "deal rooms",
    dealsDesc: "Private deal rooms to close: messages, bids, documents.",
    planningTitle: "Planning",
    planningTitleHighlight: "center",
    planningDesc: "Calendar for viewings, negotiations, and daily priorities.",
    favoritesTitle: "My",
    favoritesTitleHighlight: "favorites",
    favoritesDesc: "Watchlist and quick return to listing status.",
    myOffersTitle: "My",
    myOffersTitleHighlight: "listings",
    myOffersDesc: "Manage statuses, renewals, and listing statistics.",
  },
  pricing: {
    eyebrow: "Choose your level",
    title: "Invest",
    titleHighlight: "smarter",
    titleSuffix: ", not harder.",
    subtitle:
      "Whether you are selling your first home, hunting deals before they hit the open market, or running an agency — we have a plan built for you.",
    tabPrivate: "Private & Investors",
    tabAgency: "Agency PRO",
    basicName: "Basic",
    basicDesc: "Perfect start for selling your property or searching listings.",
    basicPrice: "0 PLN",
    basicF1: "1 active listing in our database.",
    basicF2:
      "Radar: on Basic you see less during the first 24 launch hours — after that it matches open market visibility. PRO sees full details instantly.",
    basicF3: "Basic view statistics.",
    basicF4:
      "Optional: Pakiet + — one extra listing for 30 days (4th and further listings beyond your plan limit).",
    basicCta: "Create free account",
    proBadge: "Recommended",
    proName: "Investor PRO",
    proDesc: "For opportunity hunters. Stay one step ahead of the market.",
    proWas: "299 PLN",
    proPrice: "249",
    proF1:
      "Instant Radar — no 24-hour premiere window like on Basic. PUSH notifications in a fraction of a second.",
    proF2:
      "Up to 3 active listings in gold PRO slots — premium frame and map priority.",
    proF3:
      "4th and further listings — same as everyone: Pakiet + (one listing / 30 days per credit).",
    proF4: "Early access — listing details 24 h before the public market premiere.",
    proF5: "Gold frame highlighting your listings.",
    proCta: "Choose PRO",
    proCtaLoading: "Processing...",
    agencySoon: "Coming soon",
    agencySoonTitle: "EstateOS Agency PRO",
    agencySoonDesc:
      "The agency package is in preparation — CRM, XML import, and Concierge leads. Check back soon.",
    modalTitle: "What is your goal?",
    modalSubtitle: "Pick a path so we can tailor tools to your needs.",
    modalBuy: "I want to buy",
    modalBuyDesc: "Browse exclusive listings and use Radar.",
    modalSell: "I want to sell",
    modalSellDesc: "Add your property and find a buyer.",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { pl, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
