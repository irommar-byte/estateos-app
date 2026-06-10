import type { Locale } from "./config";
import type { AddOfferDictionary } from "./addOfferDictionary";
import { getAddOfferDictionary } from "./addOfferDictionary";
import type { AuthDictionary } from "./authDictionary";
import { getAuthDictionary } from "./authDictionary";
import type { CrmExtendedDictionary } from "./crmExtendedDictionary";
import { getCrmExtended } from "./crmExtendedDictionary";
import { buildUkDictionary } from "./dictionaryUk";

export type Dictionary = {
  auth: AuthDictionary;
  addOffer: AddOfferDictionary;
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
    langUk: string;
    language: string;
  };
  theme: {
    label: string;
    light: string;
    dark: string;
    system: string;
  };
  prefsDock: {
    introTitle: string;
    introBody: string;
    showSettings: string;
    hideSettings: string;
  };
  currency: {
    sectionTitle: string;
    labelPln: string;
    labelEur: string;
    labelListing: string;
    shortPln: string;
    shortEur: string;
    shortListing: string;
    footer: string;
  };
  notifications: {
    label: string;
    title: string;
    new: string;
    empty: string;
    markAllRead: string;
    messages: string;
    close: string;
  };
  webNotifications: {
    promptTitle: string;
    promptBody: string;
    enable: string;
    later: string;
  };
  welcomeGate: {
    seekerTitle: string;
    seekerTitleMuted: string;
    seekerSubtitle: string;
    sellerTitle: string;
    sellerTitleMuted: string;
    sellerSubtitle: string;
    formTitle: string;
    formTitleMuted: string;
    formSubtitle: string;
    emailLabel: string;
    budgetLabel: string;
    phoneLabel: string;
    phoneHint: string;
    propertyTypesLabel: string;
    districtsLabel: string;
    back: string;
    submit: string;
    close: string;
  };
  hero: {
    eyebrow: string;
    lead: string;
    leadBold: string;
    leadExtra: string;
    ctaMap: string;
    ctaList: string;
    exploreMap: string;
    scroll: string;
  };
  homeAppPitch: {
    eyebrow: string;
    headline: string;
    headlineAccent: string;
    radarTitle: string;
    radarBody: string;
    sellerTitle: string;
    sellerBody: string;
    closing: string;
    downloadLabel: string;
    androidSoon: string;
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
  radarLive: {
    eyebrow: string;
    joinSuffix: string;
    newJoin: string;
    subtitle: string;
    hint: string;
    collapse: string;
    expand: string;
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
    advancedFilters: string;
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
    countryDefault: string;
    listingFallback: string;
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
    maxPriceLabel: string;
    maxRentLabel: string;
    locateMe: string;
    geolocationDenied: string;
    teaserTitleHighlight: string;
    teaserTitle: string;
    teaserBody: string;
    teaserLogin: string;
    teaserBack: string;
    guideTitle: string;
    guidePan: string;
    guidePinch: string;
    guideHoverZoom: string;
    hoverZoomHint: string;
    hoverZoomActive: string;
    guideButton: string;
    guideOk: string;
    tokenMissing: string;
    configError: string;
    loadError: string;
  };
  footer: {
    rights: string;
    tagline: string;
    terms: string;
    privacy: string;
    help: string;
    contact: string;
    appStore: string;
  };
  contact: {
    title: string;
    subtitle: string;
    emailTo: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    topic: string;
    topicGeneral: string;
    topicSupport: string;
    topicListing: string;
    topicPartnership: string;
    topicOther: string;
    message: string;
    messagePlaceholder: string;
    send: string;
    sending: string;
    success: string;
    error: string;
    close: string;
    required: string;
    fallbackMailto: string;
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
    favoritesEmpty: string;
    favoritesDiscoverMarket: string;
    myOffersTitle: string;
    myOffersTitleHighlight: string;
    myOffersDesc: string;
  };
  catalog: {
    title: string;
    subtitle: string;
    lead: string;
    loading: string;
    retry: string;
    empty: string;
    discover: string;
    cardCaption: string;
    resultSummary: string;
    sections: {
      all: string;
      nearest: string;
      sale: string;
      rent: string;
      newest: string;
      discounted: string;
      featured: string;
    };
    nearestRequiresLocation: string;
    errorUnexpected: string;
    errorNetwork: string;
    countryDefault: string;
    offerTitleFallback: string;
    offerImageAlt: string;
  };
  editOffer: {
    noAccess: string;
    noPermission: string;
    mainPhoto: string;
    save: string;
    saving: string;
    saved: string;
    backToCrm: string;
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
  auth: getAuthDictionary("pl"),
  addOffer: getAddOfferDictionary("pl"),
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
    langUk: "UA",
    language: "Język",
  },
  theme: {
    label: "Motyw",
    light: "Jasny",
    dark: "Ciemny",
    system: "System",
  },
  prefsDock: {
    introTitle: "Ustawienia wyświetlania",
    introBody:
      "Tu zmienisz motyw (jasny/ciemny), język (PL / EN / UA) i walutę cen (PLN, EUR lub waluta oferty). Panel chowa się sam — otwórz go ponownie ikoną koła zębatego.",
    showSettings: "Pokaż ustawienia",
    hideSettings: "Schowaj ustawienia",
  },
  currency: {
    sectionTitle: "Waluta cen",
    labelPln: "Złotówki (PLN)",
    labelEur: "Euro (EUR)",
    labelListing: "Waluta oferty",
    shortPln: "PLN",
    shortEur: "EUR",
    shortListing: "Oferta",
    footer: "Przeliczenia po kursie NBP (tabela A).",
  },
  notifications: {
    label: "Powiadomienia",
    title: "Powiadomienia",
    new: "Nowe",
    empty: "Brak nowych powiadomień.",
    markAllRead: "Oznacz jako przeczytane",
    messages: "wiadomości",
    close: "Zamknij",
  },
  webNotifications: {
    promptTitle: "Powiadomienia w przeglądarce",
    promptBody:
      "Włącz alerty systemowe — gdy coś pojawi się w dzwoneczku (Deal Room, oferty, wizyty), dostaniesz też powiadomienie na pulpicie.",
    enable: "Włącz powiadomienia",
    later: "Później",
  },
  welcomeGate: {
    seekerTitle: "Szukam",
    seekerTitleMuted: "miejsca.",
    seekerSubtitle: "Ustaw preferencje, załóż konto i bądź pierwszy przy nowych ofertach.",
    sellerTitle: "Sprzedaję",
    sellerTitleMuted: "nieruchomość.",
    sellerSubtitle: "Wystaw ogłoszenie i dotrzyj do klientów premium.",
    formTitle: "Czego",
    formTitleMuted: "szukasz?",
    formSubtitle: "Po wysłaniu formularza zakładamy konto — hasło wyślemy e-mailem.",
    emailLabel: "Twój e-mail *",
    budgetLabel: "Budżet do (PLN) *",
    phoneLabel: "Telefon (opcjonalnie)",
    phoneHint: "Możemy też powiadamiać SMS o pilnych ofertach.",
    propertyTypesLabel: "Typ nieruchomości (wiele)",
    districtsLabel: "Dzielnica (wiele)",
    back: "Wstecz",
    submit: "Załóż konto i odkryj mapę",
    close: "Zamknij",
  },
  hero: {
    eyebrow: "Rynek nieruchomości · jedna platforma",
    lead: "Wystaw nieruchomość ",
    leadBold: "bez opłat za publikację",
    leadExtra:
      ". Przeglądaj oferty na mapie, dodaj ogłoszenie lub włącz Radar Inwestycji — dopasowania trafią do Twojego konta.",
    ctaMap: "Szukaj na mapie",
    ctaList: "Dodaj swoją ofertę",
    exploreMap: "Mapa ofert",
    scroll: "Przewiń",
  },
  homeAppPitch: {
    eyebrow: "Radar Inwestycji",
    headline: "Nie szukaj nieruchomości.",
    headlineAccent: "Niech to one szukają Ciebie.",
    radarTitle: "Twój Radar na rynku",
    radarBody:
      "Ustaw lokalizację, budżet i parametry w EstateOS™ — system monitoruje rynek i powiadamia Cię o ofertach, które pasują do Twoich kryteriów, gdy tylko się pojawią.",
    sellerTitle: "Sprzedajesz lub wynajmujesz?",
    sellerBody:
      "Dodaj nieruchomość do EstateOS™ — trafi na radary osób aktywnie szukających i inwestorów. Jedna baza na stronie i w aplikacji.",
    closing:
      "To nie kolejny portal ogłoszeniowy. To nowoczesny system operacyjny nieruchomości — zawsze pod ręką, na telefonie i w przeglądarce.",
    downloadLabel: "Pobierz aplikację",
    androidSoon: "Wkrótce",
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
    eyebrow: "EstateOS™",
    title: "Rynek, radar i transakcje w jednym miejscu",
    body:
      "Ta sama baza ofert na stronie i w aplikacji: mapa na żywo, ogłoszenia, Radar Inwestycji oraz Deal Room do negocjacji.",
    radarTitle: "Radar Inwestycji",
    radarBody:
      "Lokalizacja, budżet, metraż i typ transakcji — system monitoruje rynek i pokazuje dopasowania w koncie.",
    verifiedTitle: "Weryfikacja ofert",
    verifiedBody:
      "Status dokumentów, sygnały zaufania i przejrzysty profil wystawcy przed kontaktem.",
    passkeyTitle: "Logowanie Passkey",
    passkeyBody:
      "Bezpieczne logowanie biometryczne w aplikacji — bez haseł na co dzień.",
    dealsTitle: "Deal Room",
    dealsBody:
      "Prywatne pokoje transakcyjne: wiadomości, oferty cenowe i dokumenty w jednym miejscu.",
  },
  radarLive: {
    eyebrow: "Radar · na żywo",
    joinSuffix: "inwestorów aktywnie czeka na dopasowania",
    newJoin: "Ktoś właśnie włączył Radar!",
    subtitle: "Rosnąca społeczność łowców okazji — dołącz, zanim pojawią się na rynku.",
    hint: "Licznik rośnie w czasie rzeczywistym wraz z aktywacjami Radaru.",
    collapse: "Zwiń panel",
    expand: "Pokaż aktywnych inwestorów",
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
    advancedFilters: "Filtry zaawansowane",
    statsActiveOffers: "Zweryfikowanych Ofert",
    statsNewOffers24h: "Nowych w 24h",
    statsMarketCities: "Obsługiwanych Miast",
    statsRegisteredMembers: "Zaufanych Klientów",
    galleryEyebrow: "Aktywny rynek",
    galleryTitle: "Wybrane",
    galleryTitleHighlight: "ogłoszenia",
    gallerySubtitle: "Aktualne oferty z bazy EstateOS — sprzedaż i wynajem, ten sam katalog co na mapie.",
    galleryViewAll: "Zobacz całą kolekcję",
    galleryPriceLabel: "Cena",
    galleryAreaLabel: "Powierzchnia",
    galleryRoomsLabel: "pokoje",
    countryDefault: "Polska",
    listingFallback: "Oferta",
    mapEyebrow: "Rynek na żywo",
    mapTitle: "Mapa",
    mapTitleHighlight: "ofert",
    mapSubtitle:
      "Przeglądaj aktywne ogłoszenia, filtruj lokalizację i typ nieruchomości — ten sam rynek co w aplikacji mobilnej.",
    trustRadarTitle: "Radar Inwestycji",
    trustRadarDesc:
      "Ustaw kryteria w koncie. System skanuje rynek i pokazuje dopasowane oferty w zakładce radaru.",
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
    maxPriceLabel: "Maks. cena",
    maxRentLabel: "Maks. czynsz",
    locateMe: "Zlokalizuj mnie",
    geolocationDenied:
      "Zezwól na dostęp do lokalizacji w przeglądarce, aby przejść do swojego miasta.",
    teaserTitleHighlight: "Zastrzeżony",
    teaserTitle: "dostęp",
    teaserBody:
      "Szczegóły oferty i kontakt są dostępne po zalogowaniu. Utwórz konto lub zaloguj się, aby odblokować adres na mapie.",
    teaserLogin: "Zaloguj się",
    teaserBack: "Wróć do mapy",
    guideTitle: "Nawigacja mapy",
    guidePan: "Przesuwaj mapę jednym palcem lub myszką.",
    guidePinch: "Przybliżaj i oddalaj dwoma palcami (pinch).",
    guideHoverZoom: "Najedź kursorem na pinezkę, aby płynnie przybliżyć lokalizację.",
    hoverZoomHint: "Najedź na pinezkę, aby przybliżyć",
    hoverZoomActive: "Przybliżanie do pinezki",
    guideButton: "Instrukcja",
    guideOk: "OK",
    tokenMissing: "Brak klucza Mapbox na serwerze (NEXT_PUBLIC_MAPBOX_TOKEN lub MAPBOX_TOKEN).",
    configError: "Nie udało się pobrać konfiguracji mapy.",
    loadError: "Mapa nie załadowała się — sprawdź token Mapbox i domenę w panelu Mapbox.",
  },
  footer: {
    rights: "© 2026 EstateOS™. Wszelkie prawa zastrzeżone.",
    tagline: "Globalna inteligencja nieruchomości premium",
    terms: "Regulamin",
    privacy: "Prywatność",
    help: "Pomoc",
    contact: "Kontakt",
    appStore: "Pobierz EstateOS w App Store",
  },
  contact: {
    title: "Kontakt z EstateOS™",
    subtitle: "Napisz do nas — odpowiadamy na pytania o platformę, ogłoszenia i współpracę.",
    emailTo: "kontakt@estateos.pl",
    name: "Imię i nazwisko",
    namePlaceholder: "Jan Kowalski",
    email: "Twój e-mail",
    emailPlaceholder: "jan@example.com",
    topic: "Temat",
    topicGeneral: "Pytanie ogólne",
    topicSupport: "Wsparcie techniczne",
    topicListing: "Publikacja ogłoszenia",
    topicPartnership: "Współpraca / Partner",
    topicOther: "Inne",
    message: "Wiadomość",
    messagePlaceholder: "Opisz swoją sprawę — im więcej szczegółów, tym szybciej pomożemy.",
    send: "Wyślij wiadomość",
    sending: "Wysyłanie…",
    success: "Dziękujemy. Wiadomość została wysłana — odezwiemy się na podany adres e-mail.",
    error: "Nie udało się wysłać wiadomości. Spróbuj ponownie lub napisz bezpośrednio na kontakt@estateos.pl.",
    close: "Zamknij",
    required: "To pole jest wymagane.",
    fallbackMailto: "Otwórz klienta poczty",
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
    favoritesEmpty: "Nie obserwujesz jeszcze żadnych ofert.",
    favoritesDiscoverMarket: "Odkryj Rynek",
    myOffersTitle: "Moje",
    myOffersTitleHighlight: "ogłoszenia",
    myOffersDesc: "Zarządzaj statusami, odnowieniami i statystykami swoich ofert.",
  },
  catalog: {
    title: "Katalog",
    subtitle: "EstateOS™",
    lead: "Oferty na sprzedaż i wynajem — ten sam zestaw co na mapie i w aplikacji mobilnej.",
    loading: "Ładowanie katalogu",
    retry: "Spróbuj ponownie",
    empty: "Brak aktywnych ofert w tym dziale.",
    discover: "Odkryj",
    cardCaption: "ofert",
    resultSummary: "{n} ofert",
    sections: {
      all: "Wszystkie",
      nearest: "Najbliższe",
      sale: "Kup",
      rent: "Wynajem",
      newest: "Najnowsze",
      discounted: "Przecenione",
      featured: "Wyróżnione",
    },
    nearestRequiresLocation: "Udostępnij lokalizację, aby posortować oferty według odległości.",
    errorUnexpected: "Niespodziewany format odpowiedzi serwera.",
    errorNetwork: "Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.",
    countryDefault: "Polska",
    offerTitleFallback: "Oferta #{id}",
    offerImageAlt: "Oferta {id}",
  },
  editOffer: {
    noAccess: "Brak dostępu lub oferty.",
    noPermission: "Brak uprawnień do edycji.",
    mainPhoto: "Główne",
    save: "Zapisz zmiany",
    saving: "Zapisywanie...",
    saved: "Zapisano!",
    backToCrm: "Wróć do panelu",
  },
  pricing: {
    eyebrow: "Wybierz swój poziom",
    title: "Inwestuj",
    titleHighlight: "mądrzej",
    titleSuffix: ", nie ciężej.",
    subtitle:
      "Niezależnie od tego, czy sprzedajesz swoje pierwsze mieszkanie, polujesz na okazje zanim pojawią się na szerokim rynku, czy zarządzasz agencją – mamy plan skrojony pod Ciebie.",
    tabPrivate: "Prywatni & Inwestorzy",
    tabAgency: "EstateOS™ Partner",
    basicName: "Basic",
    basicDesc: "Darmowe konto — przeglądasz mapę i rynek, ustawiasz Radar i dodajesz własną ofertę.",
    basicPrice: "0 PLN",
    basicF1:
      "Jedna aktywna oferta w panelu. Publikacja na mapie i rynku (30 dni): kupon powitalny, Pakiet + (49 zł) lub kredyty z PRO.",
    basicF2: "Radar Inwestycji — ten sam algorytm dopasowań co w Investor PRO (lokalizacja, budżet, metraż).",
    basicF3: "Podstawowe statystyki wyświetleń oferty w Moje konto.",
    basicF4:
      "Nowe oferty innych: pełne szczegóły (adres, galeria) widoczne po 24 h od publikacji. PRO ma podgląd od razu.",
    basicCta: "Załóż darmowe konto",
    proBadge: "Rekomendowane",
    proName: "Investor PRO",
    proDesc: "Abonament 30 dni: 5 kredytów publikacji i wczesny podgląd rynku. Aktywacja tylko na stronie.",
    proWas: "299 PLN",
    proPrice: "249",
    proF1:
      "Wczesny podgląd nowych ofert — adres, galeria i parametry od razu (Basic: te same dane po 24 h od publikacji).",
    proF2:
      "5 kredytów publikacji przy aktywacji — każde wystawienie zużywa 1 kredyt (30 dni widoczności na mapie i rynku).",
    proF3:
      "Radar sprzedawcy bez czekania — dopasowanych kupców widzisz od razu po publikacji (Basic: lista po 24 h).",
    proF4: "Odznaka Investor PRO w profilu publicznym.",
    proF5: "Po wykorzystaniu puli PRO — Pakiet + (1 kredyt / 30 dni, 49 zł).",
    proCta: "Wybieram PRO",
    proCtaLoading: "Przetwarzam...",
    agencySoon: "Wkrótce",
    agencySoonTitle: "EstateOS™ Partner",
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
  auth: getAuthDictionary("en"),
  addOffer: getAddOfferDictionary("en"),
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
    langUk: "UA",
    language: "Language",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  prefsDock: {
    introTitle: "Display settings",
    introBody:
      "Adjust theme (light/dark), language (PL / EN / UA), and price currency (PLN, EUR, or listing currency). The panel auto-hides — reopen it with the gear icon.",
    showSettings: "Show settings",
    hideSettings: "Hide settings",
  },
  currency: {
    sectionTitle: "Price currency",
    labelPln: "Polish złoty (PLN)",
    labelEur: "Euro (EUR)",
    labelListing: "Listing currency",
    shortPln: "PLN",
    shortEur: "EUR",
    shortListing: "Listing",
    footer: "Conversions use NBP table A rate.",
  },
  notifications: {
    label: "Notifications",
    title: "Notifications",
    new: "New",
    empty: "No new notifications.",
    markAllRead: "Mark all as read",
    messages: "messages",
    close: "Close",
  },
  webNotifications: {
    promptTitle: "Browser notifications",
    promptBody:
      "Enable desktop alerts — when something appears in the bell (Deal Room, offers, visits), you will also get a browser notification.",
    enable: "Enable notifications",
    later: "Later",
  },
  welcomeGate: {
    seekerTitle: "I am looking",
    seekerTitleMuted: "for a place.",
    seekerSubtitle: "Set preferences, create a free account, and be first to see new listings.",
    sellerTitle: "I am selling",
    sellerTitleMuted: "property.",
    sellerSubtitle: "List your property and reach premium clients.",
    formTitle: "What are you",
    formTitleMuted: "looking for?",
    formSubtitle: "Submitting this form creates your account — we will email your password.",
    emailLabel: "Your email *",
    budgetLabel: "Budget up to (PLN) *",
    phoneLabel: "Phone (optional)",
    phoneHint: "We can also notify you by SMS about urgent listings.",
    propertyTypesLabel: "Property type (multiple)",
    districtsLabel: "District (multiple)",
    back: "Back",
    submit: "Create account and explore map",
    close: "Close",
  },
  hero: {
    eyebrow: "Real estate market · one platform",
    lead: "List a property ",
    leadBold: "with no listing fee",
    leadExtra:
      ". Browse live listings on the map, publish your own, or enable Investment Radar — matches land in your account.",
    ctaMap: "Search on the map",
    ctaList: "Add your listing",
    exploreMap: "Listing map",
    scroll: "Scroll",
  },
  homeAppPitch: {
    eyebrow: "Investment Radar",
    headline: "Stop chasing listings.",
    headlineAccent: "Let the right ones find you.",
    radarTitle: "Your market radar",
    radarBody:
      "Set location, budget, and criteria in EstateOS™ — the system watches the market and notifies you when matching listings appear.",
    sellerTitle: "Selling or renting?",
    sellerBody:
      "Add your property to EstateOS™ — it reaches radars of active buyers and investors. One database on web and mobile.",
    closing:
      "Not another classifieds site. A modern real-estate operating system — in your pocket and in the browser.",
    downloadLabel: "Get the app",
    androidSoon: "Coming soon",
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
    eyebrow: "EstateOS™",
    title: "Market, radar, and deals in one place",
    body:
      "The same listing database on web and mobile: live map, listings, Investment Radar, and Deal Rooms for negotiations.",
    radarTitle: "Investment Radar",
    radarBody:
      "Location, budget, size, and transaction type — the system monitors the market and surfaces matches in your account.",
    verifiedTitle: "Listing verification",
    verifiedBody:
      "Document status, trust signals, and a clear advertiser profile before you reach out.",
    passkeyTitle: "Passkey sign-in",
    passkeyBody:
      "Secure biometric login in the app — no daily password friction.",
    dealsTitle: "Deal Room",
    dealsBody:
      "Private deal rooms: messages, price offers, and documents in one workflow.",
  },
  radarLive: {
    eyebrow: "Radar · live",
    joinSuffix: "investors actively waiting for matches",
    newJoin: "Someone just turned on Radar!",
    subtitle: "A growing community of deal hunters — join before listings hit the open market.",
    hint: "The counter grows in real time as investors activate Radar.",
    collapse: "Collapse panel",
    expand: "Show active investors",
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
    advancedFilters: "Advanced filters",
    statsActiveOffers: "Verified Listings",
    statsNewOffers24h: "New in 24h",
    statsMarketCities: "Cities Covered",
    statsRegisteredMembers: "Trusted Members",
    galleryEyebrow: "Active market",
    galleryTitle: "Featured",
    galleryTitleHighlight: "listings",
    gallerySubtitle: "Live listings from EstateOS — sale and rent, the same catalog as on the map.",
    galleryViewAll: "View full catalog",
    galleryPriceLabel: "Price",
    galleryAreaLabel: "Area",
    galleryRoomsLabel: "rooms",
    countryDefault: "Poland",
    listingFallback: "Listing",
    mapEyebrow: "Live market",
    mapTitle: "Listing",
    mapTitleHighlight: "map",
    mapSubtitle:
      "Browse active listings, filter by location and property type — the same market as in the mobile app.",
    trustRadarTitle: "Investment Radar",
    trustRadarDesc:
      "Set criteria in your account. The system scans the market and shows matches in your radar tab.",
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
    maxPriceLabel: "Max price",
    maxRentLabel: "Max rent",
    locateMe: "Locate me",
    geolocationDenied:
      "Allow location access in your browser to fly to your area on the map.",
    teaserTitleHighlight: "Restricted",
    teaserTitle: "access",
    teaserBody:
      "Listing details and contact unlock after sign-in. Log in or create an account to open this pin.",
    teaserLogin: "Sign in",
    teaserBack: "Back to map",
    guideTitle: "Map controls",
    guidePan: "Drag with one finger or mouse to pan.",
    guidePinch: "Pinch with two fingers to zoom in and out.",
    guideHoverZoom: "Hover a pin to smoothly zoom into that location.",
    hoverZoomHint: "Hover a pin to zoom",
    hoverZoomActive: "Zooming to pin",
    guideButton: "Guide",
    guideOk: "OK",
    tokenMissing: "Mapbox token missing on server (NEXT_PUBLIC_MAPBOX_TOKEN or MAPBOX_TOKEN).",
    configError: "Could not load map configuration.",
    loadError: "Map failed to load — check Mapbox token and allowed URLs.",
  },
  footer: {
    rights: "© 2026 EstateOS™. All rights reserved.",
    tagline: "Global premium real estate intelligence",
    terms: "Terms",
    privacy: "Privacy",
    help: "Help",
    contact: "Contact",
    appStore: "Get EstateOS on the App Store",
  },
  contact: {
    title: "Contact EstateOS™",
    subtitle: "Reach out — we answer questions about the platform, listings, and partnerships.",
    emailTo: "kontakt@estateos.pl",
    name: "Full name",
    namePlaceholder: "Jane Doe",
    email: "Your email",
    emailPlaceholder: "jane@example.com",
    topic: "Topic",
    topicGeneral: "General question",
    topicSupport: "Technical support",
    topicListing: "Listing publication",
    topicPartnership: "Partnership",
    topicOther: "Other",
    message: "Message",
    messagePlaceholder: "Describe your request — the more detail, the faster we can help.",
    send: "Send message",
    sending: "Sending…",
    success: "Thank you. Your message was sent — we will reply to your email.",
    error: "Could not send the message. Try again or email kontakt@estateos.pl directly.",
    close: "Close",
    required: "This field is required.",
    fallbackMailto: "Open email client",
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
    favoritesEmpty: "You are not watching any listings yet.",
    favoritesDiscoverMarket: "Explore the market",
    myOffersTitle: "My",
    myOffersTitleHighlight: "listings",
    myOffersDesc: "Manage statuses, renewals, and listing statistics.",
  },
  catalog: {
    title: "Catalog",
    subtitle: "EstateOS™",
    lead: "Properties for sale and rent — the same set as on the map and in the mobile app.",
    loading: "Loading catalog",
    retry: "Try again",
    empty: "No active listings in this section.",
    discover: "Discover",
    cardCaption: "listings",
    resultSummary: "{n} listings",
    sections: {
      all: "All",
      nearest: "Nearest",
      sale: "Buy",
      rent: "Rent",
      newest: "Newest",
      discounted: "Reduced",
      featured: "Featured",
    },
    nearestRequiresLocation: "Share your location to sort listings by distance.",
    errorUnexpected: "Unexpected server response format.",
    errorNetwork: "No server connection. Check your network and try again.",
    countryDefault: "Poland",
    offerTitleFallback: "Listing #{id}",
    offerImageAlt: "Listing {id}",
  },
  editOffer: {
    noAccess: "No access or listing not found.",
    noPermission: "You cannot edit this listing.",
    mainPhoto: "Main",
    save: "Save changes",
    saving: "Saving...",
    saved: "Saved!",
    backToCrm: "Back to dashboard",
  },
  pricing: {
    eyebrow: "Choose your level",
    title: "Invest",
    titleHighlight: "smarter",
    titleSuffix: ", not harder.",
    subtitle:
      "Whether you are selling your first home, hunting deals before they hit the open market, or running an agency — we have a plan built for you.",
    tabPrivate: "Private & Investors",
    tabAgency: "EstateOS™ Partner",
    basicName: "Basic",
    basicDesc: "Free account — browse the map and market, set up Radar, and add your own listing.",
    basicPrice: "0 PLN",
    basicF1:
      "One active listing slot in your panel. Market publication (30 days): welcome coupon, Pakiet + (49 PLN), or PRO credits.",
    basicF2: "Investment Radar — the same matching algorithm as Investor PRO (location, budget, size).",
    basicF3: "Basic view statistics for your listing in My account.",
    basicF4:
      "Other users' new listings: full details (address, gallery) after 24 h from publication. PRO sees them immediately.",
    basicCta: "Create free account",
    proBadge: "Recommended",
    proName: "Investor PRO",
    proDesc: "30-day subscription: 5 publication credits and early market preview. Web activation only.",
    proWas: "299 PLN",
    proPrice: "249",
    proF1:
      "Early preview of new listings — address, gallery, and details right away (Basic: same data after 24 h from publication).",
    proF2:
      "5 publication credits on activation — each listing uses 1 credit (30 days visible on map and market).",
    proF3:
      "Seller Radar without the wait — matched buyers visible immediately after publication (Basic: list after 24 h).",
    proF4: "Investor PRO badge on your public profile.",
    proF5: "After using the PRO pool — Pakiet + (1 credit / 30 days, 49 PLN).",
    proCta: "Choose PRO",
    proCtaLoading: "Processing...",
    agencySoon: "Coming soon",
    agencySoonTitle: "EstateOS™ Partner",
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

const uk = buildUkDictionary(en);

export const dictionaries: Record<Locale, Dictionary> = { pl, en, uk };

export type FullDictionary = Dictionary & {
  crm: Dictionary["crm"] & CrmExtendedDictionary;
};

export function getDictionary(locale: Locale): FullDictionary {
  const base = dictionaries[locale];
  return {
    ...base,
    crm: { ...base.crm, ...getCrmExtended(locale) },
  };
}
