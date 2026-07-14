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
    agencyCatalog: string;
    discoverMapShort: string;
    marketShort: string;
    agencyCatalogShort: string;
    manageCentralShort: string;
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
    eyebrowHome: string;
    eyebrowCar: string;
    eyebrowSuffix: string;
    lead: string;
    leadBold: string;
    leadExtra: string;
    ctaMap: string;
    ctaList: string;
    ctaPrivate: string;
    ctaAgency: string;
    exploreMap: string;
    scroll: string;
    tagline: string;
    homeCard: {
      brand: string;
      title: string;
      subtitle: string;
      bullets: string[];
      ctaList: string;
      ctaBrowse: string;
      ctaMine: string;
    };
    carCard: {
      brand: string;
      title: string;
      subtitle: string;
      bullets: string[];
      ctaList: string;
      ctaBrowse: string;
      ctaMine: string;
    };
    agencyStrip: {
      title: string;
      subtitle: string;
      cta: string;
    };
    privateCard: {
      title: string;
      subtitle: string;
      bullets: string[];
      cta: string;
    };
    agencyCard: {
      title: string;
      subtitle: string;
      bullets: string[];
      cta: string;
      footnote: string;
    };
  };
  audiencePrivate: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    features: { title: string; body: string }[];
    ctaPrimary: string;
    ctaSecondary: string;
    ctaLogin: string;
    ctaPricing: string;
    closing: string;
  };
  audienceAgency: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    features: { title: string; body: string }[];
    ctaPrimary: string;
    ctaSecondary: string;
    ctaLogin: string;
    ctaPricing: string;
    closing: string;
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
    androidBetaLabel: string;
    androidBetaBadge: string;
    androidBetaHint: string;
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
    tabClients: string;
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
    clientsTitle: string;
    clientsTitleHighlight: string;
    clientsDesc: string;
  };
  crmClients: {
    statsBuyers: string;
    statsSellers: string;
    statsMatches: string;
    statsOutreach: string;
    segmentBuyers: string;
    segmentSellers: string;
    addClient: string;
    loading: string;
    emptyTitle: string;
    emptyBody: string;
    selectClientTitle: string;
    selectClientBody: string;
    buyerBadge: string;
    sellerBadge: string;
    refreshMatches: string;
    matchesTitle: string;
    noMatches: string;
    sendEmail: string;
    viewOffer: string;
    sellerLocationEmpty: string;
    createListing: string;
    editListing: string;
    viewLinkedListing: string;
    activityTitle: string;
    reportTopMatches: string;
    matchCountLabel: string;
    formEyebrow: string;
    formTitle: string;
    typeBuyerTitle: string;
    typeBuyerBody: string;
    typeSellerTitle: string;
    typeSellerBody: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notes: string;
    buyerCriteriaLead: string;
    configureCriteria: string;
    transactionSell: string;
    transactionRent: string;
    typeFlat: string;
    typeHouse: string;
    typePlot: string;
    typeCommercial: string;
    city: string;
    district: string;
    price: string;
    area: string;
    rooms: string;
    sellerNotes: string;
    back: string;
    next: string;
    saveClient: string;
    saving: string;
    saveError: string;
    emailPreviewEyebrow: string;
    emailPreviewTitle: string;
    emailPreviewTo: string;
    emailPreviewNoEmail: string;
    emailPreviewGreeting: string;
    emailPreviewOffers: string;
    emailPreviewHtml: string;
    confirmSendEmail: string;
    sendingEmail: string;
    sentBadge: string;
    sendSelected: string;
    scanningMatches: string;
    scanningTitle: string;
    scanningBody: string;
    copyPortalLink: string;
    portalLinkCopied: string;
    clientFeedbackLabel: string;
    addClientListing: string;
    addOwnLead: string;
    sellerPanelEmpty: string;
    sellerPanelLead: string;
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
      mine: string;
      auction: string;
    };
    mineRequiresLogin: string;
    mineLoginCta: string;
    mineLead: string;
    auctionLead: string;
    nearestRequiresLocation: string;
    errorUnexpected: string;
    errorNetwork: string;
    countryDefault: string;
    offerTitleFallback: string;
    offerImageAlt: string;
    locationFilter: {
      title: string;
      country: string;
      city: string;
      district: string;
      allCountries: string;
      allCities: string;
      allDistricts: string;
      clear: string;
      offersCount: string;
    };
    transactionToggle: {
      sale: string;
      rent: string;
    };
  };
  offerNewBadge: string;
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
    subtitlePrivate: string;
    subtitleAgency: string;
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
    proPeriod: string;
    proF1: string;
    proF2: string;
    proF3: string;
    proF4: string;
    proF5: string;
    proCta: string;
    proCtaLoading: string;
    pakietPlusFootnote: string;
    partnerPeriod: string;
    partnerAgentsUnlimited: string;
    partnerCta: string;
    partnerCtaActivate: string;
    partnerActivationNote: string;
    partnerPoolBadge: string;
    partnerFreeBadge: string;
    partnerFreeHeroTitle: string;
    partnerFreeHeroSubtitle: string;
    partnerFreeName: string;
    partnerFreeDesc: string;
    partnerFreeF1: string;
    partnerFreeF2: string;
    partnerFreeF3: string;
    partnerFreeF4: string;
    partnerFreeF5: string;
    partnerFreePeriod: string;
    partnerFreeCta: string;
    partnerFreeNote: string;
    partnerPaidIntro: string;
    partnerValueBadge: string;
    partnerSavingsVsRetail: string;
    partnerBreakEvenCredits: string;
    partnerStartName: string;
    partnerStartDesc: string;
    partnerStartF1: string;
    partnerStartF2: string;
    partnerStartF3: string;
    partnerStartF4: string;
    partnerStartF5: string;
    partnerProName: string;
    partnerProDesc: string;
    partnerProF1: string;
    partnerProF2: string;
    partnerProF3: string;
    partnerProF4: string;
    partnerProF5: string;
    partnerProF6: string;
    partnerEnterpriseName: string;
    partnerEnterpriseDesc: string;
    partnerEnterpriseF1: string;
    partnerEnterpriseF2: string;
    partnerEnterpriseF3: string;
    partnerEnterpriseF4: string;
    partnerEnterpriseF5: string;
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
    agencyCatalog: "Katalog agencji",
    discoverMapShort: "Mapa",
    marketShort: "Rynek",
    agencyCatalogShort: "Agencje",
    manageCentralShort: "Centrala",
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
    system: "Auto",
  },
  prefsDock: {
    introTitle: "Ustawienia wyświetlania",
    introBody:
      "Tu zmienisz motyw (jasny / ciemny / auto), język (PL / EN / UA) i walutę cen (PLN, EUR lub waluta oferty). Panel chowa się sam — otwórz go ponownie ikoną koła zębatego.",
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
    eyebrow: "EstateOS™Home i EstateOS™Car · jedna platforma",
    eyebrowHome: "Home",
    eyebrowCar: "Car",
    eyebrowSuffix: "jedna platforma",
    lead: "Wystaw ",
    leadBold: "nieruchomość lub samochód",
    leadExtra: " — jedno konto, dwa katalogi, pełna kontrola nad ogłoszeniami.",
    ctaMap: "Szukaj na mapie",
    ctaList: "Dodaj swoją ofertę",
    ctaPrivate: "Dla osób prywatnych",
    ctaAgency: "Dla agencji i pośredników",
    exploreMap: "Mapa ofert",
    scroll: "Przewiń",
    tagline: "Sprzedajesz mieszkanie, dom lub auto? Opublikuj od razu — bez prowizji portalowej.",
    homeCard: {
      brand: "EstateOS™Home",
      title: "Nieruchomości",
      subtitle:
        "Mieszkania, domy i działki na mapie ofert. Publikacja bez prowizji platformy — z biurem lub samodzielnie.",
      bullets: [
        "Wystaw ogłoszenie bez opłat za publikację",
        "Mapa ofert i Radar Inwestycji na koncie",
        "Deal Room i bezpieczny kontakt z kupującymi",
      ],
      ctaList: "Wystaw nieruchomość",
      ctaBrowse: "Przeglądaj oferty",
      ctaMine: "Moje ogłoszenia",
    },
    carCard: {
      brand: "EstateOS™Car",
      title: "Samochody",
      subtitle:
        "Profesjonalny katalog aut — skan dowodu, galeria zdjęć i mapa lokalizacji. Formularz możesz wypełnić bez logowania.",
      bullets: [
        "Dodaj auto ze zdjęciami i skanem dowodu",
        "Publikacja bez prowizji portalowej",
        "Powiadomienia o zapytaniach na Twoim koncie",
      ],
      ctaList: "Wystaw samochód",
      ctaBrowse: "Katalog Cars",
      ctaMine: "Moje samochody",
    },
    agencyStrip: {
      title: "Dla biur i agencji nieruchomości",
      subtitle: "CRM, zespół w jednym panelu, Concierge i pakiety Partner — ten sam ekosystem co dla właścicieli.",
      cta: "Zobacz pakiety Partner",
    },
    privateCard: {
      title: "Dla osób prywatnych",
      subtitle:
        "Wystaw mieszkanie, dom lub działkę bez opłat. Przeglądaj mapę ofert i — gdy chcesz — współpracuj z biurem na przejrzystych zasadach.",
      bullets: [
        "Publikacja ogłoszenia bez prowizji platformy",
        "Mapa ofert i Radar dopasowań na Twoim koncie",
        "Współpraca z agencjami na jednej platformie — przejrzyste zasady",
        "Ten sam Deal Room i mapa ofert — z biurem lub samodzielnie",
        "Bezpieczny kontakt w jednym miejscu",
      ],
      cta: "Załóż konto — za darmo",
    },
    agencyCard: {
      title: "Dla biur i agencji",
      subtitle:
        "CRM, zespół w jednym panelu i leady od prywatnych sprzedawców — publikacje z puli kredytów, którą kontrolujesz jako administrator.",
      bullets: [
        "Załóż profil firmy i dodawaj agentów do zespołu",
        "CRM, klienci, Deal Room — ten sam ekosystem co dla osób prywatnych",
        "Administrator rozdziela kredyty publikacji między agentów",
        "Concierge — prywatni właściciele proszą biuro o pomoc przy sprzedaży",
        "Współpraca z właścicielami na przejrzystych warunkach",
        "Mapa ofert i rynek — widoczność jak u prywatnych inwestorów",
      ],
      cta: "Zobacz pakiety Partner",
      footnote: "Bezpłatna rejestracja biura — na stronie Dla agencji",
    },
  },
  audiencePrivate: {
    eyebrow: "EstateOS™ · osoby prywatne",
    title: "Twój dom.",
    titleAccent: "Twoje zasady.",
    subtitle:
      "Wystaw mieszkanie, dom lub działkę bez opłat za publikację. Przeglądaj rynek na mapie, włącz Radar dopasowań i negocjuj w Deal Room — wszystko z jednego konta, na stronie i w aplikacji.",
    features: [
      {
        title: "Publikacja bez prowizji platformy",
        body: "Dodajesz ogłoszenie samodzielnie — bez ukrytych opłat za sam fakt wystawienia oferty na EstateOS™.",
      },
      {
        title: "Mapa i Radar Inwestycji",
        body: "Szukasz? Ustaw kryteria — system monitoruje rynek i powiadamia o nowych dopasowaniach. Sprzedajesz? Twoja oferta trafia na radary aktywnych kupujących.",
      },
      {
        title: "Deal Room i bezpieczny kontakt",
        body: "Rozmowy, propozycje cenowe i dokumenty w jednym miejscu — bez rozproszenia na dziesiątkach wiadomości.",
      },
      {
        title: "Weryfikacja i zaufanie",
        body: "Status dokumentów i przejrzysty profil wystawcy — wiesz, z kim rozmawiasz, zanim przejdziesz do spotkania.",
      },
      {
        title: "Aplikacja z Passkey",
        body: "Logowanie biometryczne, powiadomienia push i pełna mapa w kieszeni — iOS i Android.",
      },
      {
        title: "Jedno konto wszędzie",
        body: "Ta sama baza ofert na estateos.pl i w aplikacji mobilnej — bez duplikowania ogłoszeń.",
      },
    ],
    ctaPrimary: "Załóż konto — za darmo",
    ctaSecondary: "Przeglądaj mapę ofert",
    ctaLogin: "Mam już konto",
    ctaPricing: "",
    closing:
      "Nie musisz być profesjonalistą rynku, żeby działać jak profesjonalista. EstateOS™ daje Ci narzędzia, które do tej pory były zarezerwowane dla agencji.",
  },
  audienceAgency: {
    eyebrow: "EstateOS™ · agencje i pośrednicy",
    title: "Biuro od",
    titleAccent: "zera złotych.",
    subtitle:
      "Załóż konto biura — od razu dostajesz Partner Free: profil w katalogu agencji, Concierge (leady od prywatnych właścicieli), CRM zespołu i 5 kredytów publikacji na 90 dni. Bez karty, bez rozmów handlowych.",
    features: [
      {
        title: "Partner Free przy rejestracji",
        body: "5 publikacji, 2 miejsca w zespole, Concierge i katalog — aktywuje się automatycznie, gdy zakładasz biuro jako administrator.",
      },
      {
        title: "Centrala i CRM zespołu",
        body: "Panel zarządzania ofertami, statystykami i użytkownikami — przejrzysty widok całego biura w jednym miejscu.",
      },
      {
        title: "Concierge — leady od właścicieli",
        body: "Prywatni sprzedawcy szukają pośrednika — Ty dostajesz zapytania bez płacenia za leady z zewnętrznych portali.",
      },
      {
        title: "Radar dopasowań dla klientów",
        body: "Aktywuj kryteria dla kupujących i wynajmujących — system dostarcza leady, gdy pojawia się idealna oferta.",
      },
      {
        title: "Deal Room transakcyjny",
        body: "Negocjacje, dokumenty i harmonogram spotkań w zamkniętym pokoju — bez chaosu w mailach i komunikatorach.",
      },
      {
        title: "Skaluj, gdy rośniesz",
        body: "Od 299 zł/mies., gdy potrzebujesz więcej kredytów i agentów — bez zmiany platformy i bez migracji danych.",
      },
    ],
    ctaPrimary: "Załóż biuro za 0 zł",
    ctaSecondary: "Przeglądaj rynek",
    ctaLogin: "Logowanie dla zespołu",
    ctaPricing: "Porównaj pakiety",
    closing:
      "Rynek nie czeka na umowy wdrożeniowe. Wejdź dziś, opublikuj pierwszą ofertę jutro — EstateOS™ rośnie razem z Twoim biurem.",
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
    androidBetaLabel: "Pobierz na Androida",
    androidBetaBadge: "Beta",
    androidBetaHint:
      "Wersja testowa (APK) — po pobraniu zezwól na instalację z tego źródła w ustawieniach telefonu. Alternatywnie dołącz do",
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
    galleryTitle: "Najnowsze",
    galleryTitleHighlight: "ogłoszenia",
    gallerySubtitle: "Świeże oferty z ostatnich 24 godzin — sprzedaż i wynajem, ten sam katalog co na mapie.",
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
    tabClients: "Klienci",
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
    clientsTitle: "Twoi",
    clientsTitleHighlight: "klienci",
    clientsDesc:
      "Profesjonalne CRM dla biura — kupujący spoza bazy, dopasowania ofert, powiadomienia w Twoim imieniu i pełna historia współpracy.",
  },
  crmClients: {
    statsBuyers: "Kupujący",
    statsSellers: "Sprzedający",
    statsMatches: "Dopasowania",
    statsOutreach: "Kontakt 30 dni",
    segmentBuyers: "Kupujący",
    segmentSellers: "Sprzedający",
    addClient: "Dodaj klienta",
    loading: "Ładowanie…",
    emptyTitle: "Brak klientów w tej sekcji",
    emptyBody: "Dodaj pierwszego klienta — nawet jeśli nie ma konta w EstateOS, prowadzisz go tutaj jak w premium CRM.",
    selectClientTitle: "Wybierz klienta",
    selectClientBody: "Zobacz dopasowania, wyślij ofertę e-mailem podpisanym Twoim imieniem i śledź historię działań.",
    buyerBadge: "Klient kupujący",
    sellerBadge: "Klient sprzedający",
    refreshMatches: "Odśwież dopasowania",
    matchesTitle: "Dopasowane oferty z bazy",
    noMatches: "Brak dopasowań — zaktualizuj kryteria lub odśwież skan rynku.",
    sendEmail: "Wyślij e-mail",
    viewOffer: "Oferta",
    sellerLocationEmpty: "Lokalizacja do uzupełnienia",
    createListing: "Utwórz ogłoszenie",
    editListing: "Dodaj ogłoszenie klienta",
    viewLinkedListing: "Zobacz ogłoszenie",
    activityTitle: "Historia działań",
    reportTopMatches: "Najlepsze dopasowania w biurze",
    matchCountLabel: "{n} dopasowań",
    formEyebrow: "CRM · nowy klient",
    formTitle: "Dodaj klienta",
    typeBuyerTitle: "Kupujący",
    typeBuyerBody: "Szuka nieruchomości — ustawiasz kryteria i system dopasowuje oferty z bazy EstateOS.",
    typeSellerTitle: "Sprzedający",
    typeSellerBody: "Chce sprzedać lub wynająć — zapisujesz kontakt, a ogłoszenie dodajesz później standardowym formularzem.",
    firstName: "Imię",
    lastName: "Nazwisko",
    email: "E-mail",
    phone: "Telefon",
    notes: "Notatki wewnętrzne",
    buyerCriteriaLead: "Kryteria wyszukiwania — ten sam algorytm co Radar Inwestycji.",
    configureCriteria: "Ustaw kryteria dopasowania",
    transactionSell: "Sprzedaż",
    transactionRent: "Wynajem",
    typeFlat: "Mieszkanie",
    typeHouse: "Dom",
    typePlot: "Działka",
    typeCommercial: "Lokal",
    city: "Miasto",
    district: "Dzielnica",
    price: "Cena (PLN)",
    area: "Metraż (m²)",
    rooms: "Pokoje",
    sellerNotes: "Opis nieruchomości / oczekiwania klienta",
    back: "Wstecz",
    next: "Dalej",
    saveClient: "Zapisz klienta",
    saving: "Zapisywanie…",
    saveError: "Nie udało się zapisać klienta.",
    emailPreviewEyebrow: "Podgląd wiadomości",
    emailPreviewTitle: "Sprawdź, co wyślesz klientowi",
    emailPreviewTo: "Do",
    emailPreviewNoEmail: "Klient nie ma adresu e-mail — dodaj go w profilu.",
    emailPreviewGreeting: "Tekst powitalny",
    emailPreviewOffers: "Oferty w wiadomości",
    emailPreviewHtml: "Podgląd e-maila",
    confirmSendEmail: "Wyślij do klienta",
    sendingEmail: "Wysyłanie…",
    sentBadge: "Wysłano",
    sendSelected: "Wyślij zaznaczone",
    scanningMatches: "Skanowanie rynku…",
    scanningTitle: "System szuka dopasowań",
    scanningBody: "Przeszukujemy bazę EstateOS według kryteriów klienta — to potrwa kilka sekund.",
    copyPortalLink: "Link panelu klienta",
    portalLinkCopied: "Skopiowano!",
    clientFeedbackLabel: "Uwagi klienta",
    addClientListing: "Dodaj ogłoszenie klienta",
    addOwnLead: "Dodaj swój pozysk",
    sellerPanelEmpty: "Brak ogłoszenia — dodaj je standardowym formularzem.",
    sellerPanelLead: "Po utworzeniu klienta dodajesz ogłoszenie tak jak każdą inną ofertę w systemie.",
  },
  catalog: {
    title: "Profesjonalny katalog",
    subtitle: "nieruchomości",
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
      mine: "Moje",
      auction: "Na licytacji",
    },
    mineRequiresLogin: "Zaloguj się, aby zobaczyć swoje ogłoszenia tak, jak widzą je inni użytkownicy.",
    mineLoginCta: "Zaloguj się",
    mineLead: "Twoje aktywne ogłoszenia na rynku — dokładnie ten sam widok, który mają kupujący.",
    auctionLead: "Trwające licytacje — odliczanie do końca, aktualna cena i możliwość złożenia oferty bez wychodzenia z katalogu.",
    nearestRequiresLocation: "Udostępnij lokalizację, aby posortować oferty według odległości.",
    errorUnexpected: "Niespodziewany format odpowiedzi serwera.",
    errorNetwork: "Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.",
    countryDefault: "Polska",
    offerTitleFallback: "Oferta #{id}",
    offerImageAlt: "Oferta {id}",
    locationFilter: {
      title: "Lokalizacja",
      country: "Państwo",
      city: "Miasto",
      district: "Dzielnica",
      allCountries: "Wszystkie kraje",
      allCities: "Wszystkie miasta",
      allDistricts: "Całe miasto",
      clear: "Wyczyść filtry",
      offersCount: "{n} ofert w wybranej lokalizacji",
    },
    transactionToggle: {
      sale: "Kupno",
      rent: "Wynajem",
    },
  },
  offerNewBadge: "Nowe",
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
    subtitlePrivate:
      "Konto za darmo albo przewaga czasowa na rynku. Publikujesz wtedy, kiedy chcesz — kuponem, kredytem z PRO albo Pakietem +.",
    subtitleAgency:
      "Załóż biuro za 0 zł — Partner Free włącza się przy rejestracji (5 kredytów, Concierge, katalog). Poniżej pakiety płatne, gdy zespół się rozwinie.",
    tabPrivate: "Prywatni & Inwestorzy",
    tabAgency: "EstateOS™ Partner",
    basicName: "Basic",
    basicDesc:
      "Darmowe konto na start. Mapa, rynek i Radar — publikujesz, gdy potrzebujesz (kupon, Pakiet + lub kredyty z PRO).",
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
    proDesc:
      "Dla aktywnych inwestorów i sprzedawców: 5 publikacji w cenie + podgląd rynku i Radar bez 24-godzinnego oczekiwania. Odnowienie co 30 dni na stronie.",
    proWas: "299 PLN",
    proPrice: "249",
    proPeriod: "PLN / msc",
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
    pakietPlusFootnote: "Potrzebujesz tylko jednej publikacji? Pakiet + — 49 zł / 30 dni (także w aplikacji mobilnej).",
    partnerPeriod: "PLN / msc",
    partnerAgentsUnlimited: "bez limitu",
    partnerCta: "Załóż biuro",
    partnerCtaActivate: "Aktywuj plan",
    partnerActivationNote: "Wymaga konta administratora biura. Nie masz biura? Załóż je bezpłatnie przed aktywacją.",
    partnerPoolBadge: "CRM · pula kredytów",
    partnerFreeBadge: "Start za 0 zł",
    partnerFreeHeroTitle: "Zacznij za 0 zł — publikuj od razu",
    partnerFreeHeroSubtitle:
      "Rejestracja biura = Partner Free: katalog agencji, Concierge i kredyty na start. Płatny pakiet dopiero wtedy, gdy zespół urośnie.",
    partnerFreeName: "Partner Free",
    partnerFreeDesc:
      "Start dla każdego biura — bez karty i bez abonamentu. Wystarczy rejestracja z nazwą firmy.",
    partnerFreeF1: "{credits} kredytów publikacji na pulę firmową — wystarczają na pierwsze oferty.",
    partnerFreeF2: "Do {agents} aktywnych agentów (Ty + jeden w zespole).",
    partnerFreeF3: "Profil w Katalogu agencji i oznaczenia zaufania od pierwszego dnia.",
    partnerFreeF4: "Concierge — leady od prywatnych sprzedawców szukających pośrednika.",
    partnerFreeF5: "CRM, Deal Room i mapa ofert — pełny ekosystem przez 90 dni.",
    partnerFreePeriod: "zł · 90 dni · bez karty",
    partnerFreeCta: "Załóż biuro za 0 zł",
    partnerFreeNote:
      "Partner Free aktywuje się automatycznie przy rejestracji biura (rola agenta + nowa firma).",
    partnerPaidIntro:
      "Publikujesz więcej niż pojedyncze ogłoszenia? Im wyższy pakiet, tym tańszy kredyt — Pro to zwykle punkt, w którym biuro realnie zarabia na różnicy.",
    partnerValueBadge: "Najlepsza wartość",
    partnerSavingsVsRetail: "−{savings}% vs Pakiet + ({retail} zł / kredyt)",
    partnerBreakEvenCredits: "Opłaca się od {count} publikacji miesięcznie",
    partnerStartName: "Partner Start",
    partnerStartDesc:
      "Małe biuro lub jednoosobowa agencja — pierwszy krok po Partner Free, gdy zaczynasz regularnie wystawiać oferty.",
    partnerStartF1:
      "{credits} kredytów miesięcznie — ok. {unitPrice} zł za publikację zamiast {retail} zł w detalu.",
    partnerStartF2: "Do {agents} aktywnych agentów w zespole.",
    partnerStartF3: "CRM klientów, Deal Room, Concierge i mapa ofert — cały ekosystem w jednym panelu.",
    partnerStartF4: "Profil w Katalogu agencji — wyróżnienie względem ogłoszeń prywatnych.",
    partnerStartF5: "{breakEven}+ publikacji/mies.? Abonament wygrywa z kupowaniem pojedynczych kredytów.",
    partnerProName: "Partner Pro",
    partnerProDesc:
      "Najczęściej wybierany — 3× więcej kredytów niż Start przy 2× cenie. Dla biur, które żyją z obrotu ofert.",
    partnerProF1: "{credits} kredytów miesięcznie — tylko {unitPrice} zł za publikację (−{savings}% vs detal).",
    partnerProF2: "Do {agents} aktywnych agentów — cały zespół w jednym CRM.",
    partnerProF3: "Wszystko ze Start + priorytet w Katalogu agencji i Concierge.",
    partnerProF4: "Concierge priorytetowy — pierwszeństwo przy leadach od prywatnych właścicieli.",
    partnerProF5: "Statystyki zespołu, transfer ofert między agentami, portal klienta CRM.",
    partnerProF6:
      "Jedna transakcja miesięcznie zwraca się szybciej niż {breakEven}× Pakiet + — reszta to czysta marża biura.",
    partnerEnterpriseName: "Partner Enterprise",
    partnerEnterpriseDesc:
      "Sieci i duże biura — 100 publikacji po 10 zł, bez limitu agentów. Najniższy koszt kredytu w ekosystemie.",
    partnerEnterpriseF1: "{credits} kredytów miesięcznie — {unitPrice} zł za publikację (−{savings}% vs detal).",
    partnerEnterpriseF2: "Agenci: {agents} — skaluj zespół bez dopłat za każde miejsce.",
    partnerEnterpriseF3: "Priorytetowy Concierge i wyróżnienie w katalogu agencji.",
    partnerEnterpriseF4: "Docelowo: synchronizacja XML / feed ofert (w przygotowaniu).",
    partnerEnterpriseF5: "Dedykowany onboarding — roczne pakiety kredytów na życzenie.",
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
    agencyCatalog: "Agency catalog",
    discoverMapShort: "Map",
    marketShort: "Market",
    agencyCatalogShort: "Agencies",
    manageCentralShort: "Central",
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
    system: "Auto",
  },
  prefsDock: {
    introTitle: "Display settings",
    introBody:
      "Adjust theme (light / dark / auto), language (PL / EN / UA), and price currency (PLN, EUR, or listing currency). The panel auto-hides — reopen it with the gear icon.",
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
    eyebrow: "EstateOS™Home and EstateOS™Car · one platform",
    eyebrowHome: "Home",
    eyebrowCar: "Car",
    eyebrowSuffix: "one platform",
    lead: "List a ",
    leadBold: "property or a car",
    leadExtra: " — one account, two catalogs, full control over your listings.",
    ctaMap: "Search on the map",
    ctaList: "Add your listing",
    ctaPrivate: "For private owners",
    ctaAgency: "For agencies & brokers",
    exploreMap: "Listing map",
    scroll: "Scroll",
    tagline: "Selling a home or a car? Publish right away — no portal commission.",
    homeCard: {
      brand: "EstateOS™Home",
      title: "Real estate",
      subtitle:
        "Flats, houses and land on the live map. No platform listing fee — with an agency or on your own.",
      bullets: [
        "Publish with no listing fee",
        "Live map and Investment Radar on your account",
        "Deal Room and secure buyer contact",
      ],
      ctaList: "List a property",
      ctaBrowse: "Browse listings",
      ctaMine: "My listings",
    },
    carCard: {
      brand: "EstateOS™Car",
      title: "Cars",
      subtitle:
        "Professional car catalog — registration scan, photo gallery and location map. You can fill the form without logging in.",
      bullets: [
        "Add a car with photos and registration scan",
        "No portal commission",
        "Inquiry notifications on your account",
      ],
      ctaList: "List a car",
      ctaBrowse: "Cars catalog",
      ctaMine: "My cars",
    },
    agencyStrip: {
      title: "For real estate agencies & offices",
      subtitle: "CRM, team panel, Concierge and Partner plans — the same ecosystem as for private owners.",
      cta: "See Partner plans",
    },
    privateCard: {
      title: "For private owners",
      subtitle:
        "List with no listing fee, browse the map — and when you want, work with an agency on transparent terms.",
      bullets: [
        "Publish with no platform listing fee",
        "Live map and Investment Radar on your account",
        "Collaborate with agencies on one platform — transparent terms",
        "The same Deal Room and listing map — with an office or on your own",
        "Secure contact in one place",
      ],
      cta: "Create a free account",
    },
    agencyCard: {
      title: "For agencies & offices",
      subtitle:
        "CRM, your team in one panel, and leads from private sellers — publications from a credit pool you control as administrator.",
      bullets: [
        "Set up your company profile and add agents to the team",
        "CRM, clients, Deal Room — the same ecosystem as for private users",
        "The administrator distributes publication credits among agents",
        "Concierge — private owners ask your office for help selling",
        "Collaboration with owners on transparent terms",
        "Listing map and market — visibility like for private investors",
      ],
      cta: "See Partner plans",
      footnote: "Free office registration — on the For agencies page",
    },
  },
  audiencePrivate: {
    eyebrow: "EstateOS™ · private owners",
    title: "Your home.",
    titleAccent: "Your rules.",
    subtitle:
      "List a flat, house, or plot with no listing fee. Browse the live map, enable Investment Radar, and negotiate in Deal Room — one account on web and mobile.",
    features: [
      {
        title: "No platform listing fee",
        body: "Publish on your own — no hidden charge just for going live on EstateOS™.",
      },
      {
        title: "Map & Investment Radar",
        body: "Buying? Set criteria and get notified. Selling? Your listing reaches active buyer radars.",
      },
      {
        title: "Deal Room & secure contact",
        body: "Messages, offers, and documents in one place — not scattered across apps.",
      },
      {
        title: "Verification & trust",
        body: "Document status and a clear seller profile before you meet in person.",
      },
      {
        title: "App with Passkey",
        body: "Biometric sign-in, push alerts, and the full map in your pocket — iOS and Android.",
      },
      {
        title: "One account everywhere",
        body: "The same listing database on estateos.pl and in the mobile app.",
      },
    ],
    ctaPrimary: "Create a free account",
    ctaSecondary: "Explore the map",
    ctaLogin: "I already have an account",
    ctaPricing: "",
    closing:
      "You do not need to be a market pro to act like one. EstateOS™ gives you tools that used to be reserved for agencies.",
  },
  audienceAgency: {
    eyebrow: "EstateOS™ · agencies & brokers",
    title: "An office from",
    titleAccent: "zero PLN.",
    subtitle:
      "Create your agency account — Partner Free activates instantly: agency catalog profile, Concierge (leads from private owners), team CRM, and 5 publication credits for 90 days. No card, no sales calls.",
    features: [
      {
        title: "Partner Free on signup",
        body: "5 publications, 2 team seats, Concierge, and catalog — granted automatically when you register as the office administrator.",
      },
      {
        title: "Headquarters & team CRM",
        body: "Manage listings, stats, and users — a clear view of the whole office.",
      },
      {
        title: "Concierge — owner leads",
        body: "Private sellers look for an agent — you receive inquiries without paying external lead portals.",
      },
      {
        title: "Client match Radar",
        body: "Set buyer and tenant criteria — the system delivers leads when the right listing appears.",
      },
      {
        title: "Transactional Deal Room",
        body: "Negotiations, documents, and meetings in a private room — no email chaos.",
      },
      {
        title: "Scale when you grow",
        body: "From 299 PLN/mo when you need more credits and agents — same platform, no data migration.",
      },
    ],
    ctaPrimary: "Register your office for 0 PLN",
    ctaSecondary: "Browse the market",
    ctaLogin: "Team sign-in",
    ctaPricing: "Compare plans",
    closing:
      "The market will not wait for enterprise contracts. Join today, publish your first listing tomorrow — EstateOS™ grows with your office.",
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
    androidBetaLabel: "Download for Android",
    androidBetaBadge: "Beta",
    androidBetaHint:
      "Test build (APK) — after download, allow installation from this source in your phone settings. Or join the",
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
    galleryTitle: "Latest",
    galleryTitleHighlight: "listings",
    gallerySubtitle: "Fresh listings from the last 24 hours — sale and rent, the same catalog as on the map.",
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
    tabClients: "Clients",
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
    clientsTitle: "Your",
    clientsTitleHighlight: "clients",
    clientsDesc:
      "Professional office CRM — off-platform buyers, listing matches, outreach in your name, and full activity history.",
  },
  crmClients: {
    statsBuyers: "Buyers",
    statsSellers: "Sellers",
    statsMatches: "Matches",
    statsOutreach: "Outreach 30d",
    segmentBuyers: "Buyers",
    segmentSellers: "Sellers",
    addClient: "Add client",
    loading: "Loading…",
    emptyTitle: "No clients in this section",
    emptyBody: "Add your first client — even without an EstateOS account, manage them here like a premium CRM.",
    selectClientTitle: "Select a client",
    selectClientBody: "View matches, email listings signed with your name, and track every touchpoint.",
    buyerBadge: "Buyer client",
    sellerBadge: "Seller client",
    refreshMatches: "Refresh matches",
    matchesTitle: "Matched listings",
    noMatches: "No matches — update criteria or rescan the market.",
    sendEmail: "Send email",
    viewOffer: "Listing",
    sellerLocationEmpty: "Location to be added",
    createListing: "Create listing",
    editListing: "Add client listing",
    viewLinkedListing: "View listing",
    activityTitle: "Activity log",
    reportTopMatches: "Top office matches",
    matchCountLabel: "{n} matches",
    formEyebrow: "CRM · new client",
    formTitle: "Add client",
    typeBuyerTitle: "Buyer",
    typeBuyerBody: "Looking for property — set criteria and the system matches EstateOS listings.",
    typeSellerTitle: "Seller",
    typeSellerBody: "Wants to sell or rent — save contact details and add the listing later via the standard form.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    notes: "Internal notes",
    buyerCriteriaLead: "Search criteria — same algorithm as Investment Radar.",
    configureCriteria: "Set match criteria",
    transactionSell: "Sale",
    transactionRent: "Rent",
    typeFlat: "Apartment",
    typeHouse: "House",
    typePlot: "Plot",
    typeCommercial: "Commercial",
    city: "City",
    district: "District",
    price: "Price (PLN)",
    area: "Area (m²)",
    rooms: "Rooms",
    sellerNotes: "Property description / client expectations",
    back: "Back",
    next: "Next",
    saveClient: "Save client",
    saving: "Saving…",
    saveError: "Could not save client.",
    emailPreviewEyebrow: "Message preview",
    emailPreviewTitle: "Review before sending",
    emailPreviewTo: "To",
    emailPreviewNoEmail: "Client has no email — add it in their profile.",
    emailPreviewGreeting: "Greeting text",
    emailPreviewOffers: "Listings in message",
    emailPreviewHtml: "Email preview",
    confirmSendEmail: "Send to client",
    sendingEmail: "Sending…",
    sentBadge: "Sent",
    sendSelected: "Send selected",
    scanningMatches: "Scanning market…",
    scanningTitle: "Finding matches",
    scanningBody: "Searching the EstateOS database for listings that match this client's criteria.",
    copyPortalLink: "Client portal link",
    portalLinkCopied: "Copied!",
    clientFeedbackLabel: "Client feedback",
    addClientListing: "Add client listing",
    addOwnLead: "Add your lead",
    sellerPanelEmpty: "No listing yet — add one using the standard form.",
    sellerPanelLead: "After creating the client, add a listing the same way as any other property in the system.",
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
      mine: "Mine",
      auction: "On auction",
    },
    mineRequiresLogin: "Sign in to see your listings exactly as other users see them.",
    mineLoginCta: "Sign in",
    mineLead: "Your active market listings — the same view buyers get on the map and catalog.",
    auctionLead: "Live auctions — countdown, current price, and bidding without leaving the catalog.",
    nearestRequiresLocation: "Share your location to sort listings by distance.",
    errorUnexpected: "Unexpected server response format.",
    errorNetwork: "No server connection. Check your network and try again.",
    countryDefault: "Poland",
    offerTitleFallback: "Listing #{id}",
    offerImageAlt: "Listing {id}",
    locationFilter: {
      title: "Location",
      country: "Country",
      city: "City",
      district: "District",
      allCountries: "All countries",
      allCities: "All cities",
      allDistricts: "Whole city",
      clear: "Clear filters",
      offersCount: "{n} listings in selected location",
    },
    transactionToggle: {
      sale: "Buy",
      rent: "Rent",
    },
  },
  offerNewBadge: "New",
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
    subtitlePrivate:
      "A free account or a time advantage on the market. Publish when you need — welcome coupon, PRO credits, or Pakiet +.",
    subtitleAgency:
      "Register your office for 0 PLN — Partner Free activates on signup (5 credits, Concierge, catalog). Paid plans below when your team scales up.",
    tabPrivate: "Private & Investors",
    tabAgency: "EstateOS™ Partner",
    basicName: "Basic",
    basicDesc:
      "Free account to start. Map, market, and Radar — publish when you need (coupon, Pakiet +, or PRO credits).",
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
    proDesc:
      "For active investors and sellers: 5 publications included + market preview and Radar without the 24-hour wait. Renew every 30 days on the website.",
    proWas: "299 PLN",
    proPrice: "249",
    proPeriod: "PLN / mo",
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
    pakietPlusFootnote: "Need just one publication? Pakiet + — 49 PLN / 30 days (also in the mobile app).",
    partnerPeriod: "PLN / mo",
    partnerAgentsUnlimited: "unlimited",
    partnerCta: "Register your office",
    partnerCtaActivate: "Activate plan",
    partnerActivationNote: "Requires a company administrator account. No office yet? Register for free before activating.",
    partnerPoolBadge: "CRM · credit pool",
    partnerFreeBadge: "Start at 0 PLN",
    partnerFreeHeroTitle: "Start at 0 PLN — publish right away",
    partnerFreeHeroSubtitle:
      "Office registration = Partner Free: agency catalog, Concierge, and starter credits. Paid plans only when your team outgrows the free tier.",
    partnerFreeName: "Partner Free",
    partnerFreeDesc:
      "A real start for every office — no card and no subscription. Just register with your company name.",
    partnerFreeF1: "{credits} publication credits in the company pool — enough for your first listings.",
    partnerFreeF2: "Up to {agents} active agents (you + one teammate).",
    partnerFreeF3: "Agency catalog profile and trust badges from day one.",
    partnerFreeF4: "Concierge — leads from private sellers looking for an agent.",
    partnerFreeF5: "CRM, Deal Room, and listing map — full ecosystem for 90 days.",
    partnerFreePeriod: "PLN · 90 days · no card",
    partnerFreeCta: "Register your office for 0 PLN",
    partnerFreeNote:
      "Partner Free activates automatically when you register an office (agent role + new company).",
    partnerPaidIntro:
      "Publishing more than one-off listings? Higher tiers mean cheaper credits — Pro is usually where offices start making money on the spread.",
    partnerValueBadge: "Best value",
    partnerSavingsVsRetail: "−{savings}% vs Pakiet + ({retail} PLN / credit)",
    partnerBreakEvenCredits: "Pays off from {count} publications per month",
    partnerStartName: "Partner Start",
    partnerStartDesc:
      "Small office or solo agency — your first step after Partner Free when you publish regularly.",
    partnerStartF1:
      "{credits} credits per month — about {unitPrice} PLN per listing instead of {retail} PLN retail.",
    partnerStartF2: "Up to {agents} active agents on the team.",
    partnerStartF3: "Client CRM, Deal Room, Concierge, and listing map — one dashboard.",
    partnerStartF4: "Agency catalog profile — stand out from private listings.",
    partnerStartF5: "{breakEven}+ publications/month? The subscription beats buying single credits.",
    partnerProName: "Partner Pro",
    partnerProDesc:
      "Most popular — 3× the credits of Start for 2× the price. Built for offices that live on listing volume.",
    partnerProF1: "{credits} credits per month — only {unitPrice} PLN per listing (−{savings}% vs retail).",
    partnerProF2: "Up to {agents} active agents — whole team in one CRM.",
    partnerProF3: "Everything in Start + priority in the agency catalog and Concierge.",
    partnerProF4: "Priority Concierge — first access to leads from private owners.",
    partnerProF5: "Team stats, offer transfers between agents, CRM client portal.",
    partnerProF6:
      "One deal a month pays back faster than {breakEven}× Pakiet + — the rest is margin for your office.",
    partnerEnterpriseName: "Partner Enterprise",
    partnerEnterpriseDesc:
      "Networks and large offices — 100 publications at 10 PLN each, unlimited agents. Lowest credit cost in the ecosystem.",
    partnerEnterpriseF1: "{credits} credits per month — {unitPrice} PLN per listing (−{savings}% vs retail).",
    partnerEnterpriseF2: "Agents: {agents} — scale the team without per-seat fees.",
    partnerEnterpriseF3: "Priority Concierge and featured placement in the agency catalog.",
    partnerEnterpriseF4: "Coming soon: XML / listing feed sync.",
    partnerEnterpriseF5: "Dedicated onboarding — annual credit packages on request.",
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
