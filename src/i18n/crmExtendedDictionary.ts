import type { Locale } from "./config";

export type CrmExtendedDictionary = {
  proStatus: {
    eyebrow: string;
    validUntil: string;
    daysLeft: string;
    dayOne: string;
    dayMany: string;
    periodHint: string;
    creditsLine: string;
    barCaption: string;
    compactUntil: string;
    creditsShort: string;
  };
  proTools: {
    eyebrow: string;
    title: string;
    lead: string;
    importTitle: string;
    importSubtitle: string;
    importTag: string;
    openHouseTitle: string;
    openHouseSubtitle: string;
    openHouseTag: string;
    footer: string;
    importModalTitle: string;
    importUrlPlaceholder: string;
    importAnalyze: string;
    importCreate: string;
    importSuccess: string;
    importNoCredit: string;
    openHouseModalTitle: string;
    openHouseCreateTab: string;
    openHouseListTab: string;
    openHousePickOffer: string;
    openHouseNoOffers: string;
    openHousePublish: string;
    openHouseSuccess: string;
    openHouseEmpty: string;
    openHouseCancel: string;
    openHouseViewOffer: string;
    visitModeFlex: string;
    visitMode30: string;
    visitMode60: string;
    slotDay: string;
    slotFrom: string;
    slotTo: string;
    slotCapacity: string;
    openHousePublishError: string;
    openHouseCancelConfirm: string;
    openHouseCancelError: string;
    openHouseOptionalTitle: string;
    openHouseOptionalDescription: string;
    exclusiveBadge: string;
    auctionTitle: string;
    auctionSubtitle: string;
    auctionSoon: string;
    openHouseSpotsLeft: string;
    importModalLead: string;
    importLinkLabel: string;
    importHint: string;
    importPreviewLabel: string;
    importPayCreate: string;
    importEditLink: string;
    importPreviewLink: string;
    importPubTitle: string;
    importPubSubtitle: string;
    importBuyPlusHint: string;
    importUrlEmpty: string;
    importWalletError: string;
    importSourceOfferFallback: string;
  };
  proWidget: {
    investmentDemand: string;
    marketAverage: string;
    pulseTitle: string;
    pulseLive: string;
    pulseSync: string;
    encryptedConnection: string;
    noteTitle: string;
    notePlaceholder: string;
    noteSave: string;
    noteSaveCloud: string;
    noteSaveError: string;
    weekdays: string[];
    months: string[];
  };
  pulseSchedule: {
    section: string;
    empty: string;
    emptyHint: string;
    live: string;
    pending: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    starts: string;
    prevEvent: string;
    nextEvent: string;
    detailsLink: string;
    eventLabel: string;
  };
  boot: { initLabel: string; greetings: string[] };
  verification: {
    bannerTitle: string;
    both: string;
    phoneOnly: string;
    emailOnly: string;
    cta: string;
    verifiedBadge: string;
    confirmEmail: string;
    confirmPhone: string;
  };
  welcome: string;
  reviewsNone: string;
  offerFilter: { active: string; pending: string; completed: string };
  radar: {
    recalibratingTitle: string;
    recalibratingSub: string;
    emptyHint: string;
    deposit: string;
    adminFee: string;
    investmentHighlight: string;
  };
  offers: {
    emptyActive: string;
    emptyPending: string;
    emptyCompleted: string;
    addProperty: string;
    addAnother: string;
    badgeExpired: string;
    badgeInReview: string;
    badgeNew: string;
    badgeActive: string;
    petsAllowed: string;
    reach: string;
    bidsPendingTitle: string;
    bidCash: string;
    bidMortgage: string;
    bidAccept: string;
    bidReject: string;
    renewProcessing: string;
    renewCta: string;
    pubStatus: string;
    pubAwaiting: string;
    pubValidUntil: string;
    pubDaysLeft: string;
    pubLabel: string;
    pubLive: string;
    edit: string;
    editHint: string;
    pause: string;
    thumbAlt: string;
  };
  deals: {
    back: string;
    emptyTitle: string;
    emptyDesc: string;
    fallbackTitle: string;
    dealId: string;
    unread: string;
    pin: string;
    pinned: string;
    lastMessage: string;
    pendingBids: string;
    pendingAppointments: string;
    profile: string;
    openProfile: string;
    msgNone: string;
    msgApptAccepted: string;
    msgApptProposed: string;
    msgApptDeclined: string;
    msgApptCountered: string;
    msgBidAccepted: string;
    msgBidProposed: string;
    msgBidRejected: string;
    msgBidCountered: string;
    msgGeneric: string;
  };
  planning: {
    stepDay: string;
    stepTime: string;
    stepSend: string;
    confirmed: string;
    proposed: string;
    stepOf: string;
    dateTime: string;
    property: string;
    addressHidden: string;
    unitNo: string;
    offerId: string;
    proposedBy: string;
    counterparty: string;
    cancelPresentation: string;
    waiting: string;
    confirm: string;
    reschedule: string;
    noActions: string;
    newSlot: string;
    sendCounter: string;
  };
  wow: {
    investorTitle: string;
    investorSub: string;
    agencyTitle: string;
    agencySub: string;
    plusTitle: string;
    plusSub: string;
    renewalTitle: string;
    renewalSub: string;
    auth: string;
    confirmed: string;
    stripeVerify: string;
  };
  wowPlus: { brand: string; activated: string };
  profile: {
    verified: string;
    loading: string;
    reviewsEmpty: string;
    reviewsDetail: string;
    accountType: string;
    attendance: string;
    planAgency: string;
    planPro: string;
    planStandard: string;
    activeOffers: string;
  };
  profileModal: {
    title: string;
    avgRating: string;
    comments: string;
    otherOffers: string;
    noComment: string;
    noComments: string;
    noOffers: string;
    loadFailed: string;
  };
  archive: {
    title: string;
    body: string;
    warningTitle: string;
    warningBody: string;
    cancel: string;
    confirm: string;
    deletePermanent: string;
  };
  alerts: {
    bidUseDealRoom: string;
    bidError: string;
    network: string;
    archiveError: string;
    deleteArchived: string;
    deleteError: string;
    paymentError: string;
    cancelApptError: string;
    saveError: string;
    proposalError: string;
  };
  confirms: { cancelAppointment: string };
  reviewsModalUserFallback: string;
};

const pl: CrmExtendedDictionary = {
  proStatus: {
    eyebrow: "INVESTOR PRO",
    validUntil: "Bieżący okres do:",
    daysLeft: "Pozostało {n} {unit} do odnowienia",
    dayOne: "dzień",
    dayMany: "dni",
    periodHint: "Subskrypcja miesięczna — po opłacie w App Store okres przedłuża się automatycznie.",
    creditsLine: "Kredyty publikacji w pakiecie: {n} (ważne do {date})",
    barCaption: "Pasek: pozostało {n} z {total} dni bieżącego okresu",
    compactUntil: "Do {date}",
    creditsShort: "Kredyty EOS",
  },
  proTools: {
    eyebrow: "Investor Pro",
    title: "Narzędzia premium",
    lead: "Import ofert z portali i organizacja dni otwartych — w jednym miejscu.",
    importTitle: "Import z OtoDom + OLX + Nieruchomosci-Online",
    importSubtitle: "Przenieś ogłoszenie na EstateOS — z opłatą publikacji jak przy zwykłym wystawieniu.",
    importTag: "Import",
    openHouseTitle: "Dzień otwartych drzwi",
    openHouseSubtitle: "Zaplanuj terminy wizyt i rezerwacje gości przy swojej ofercie.",
    openHouseTag: "Pro",
    footer: "Funkcje dostępne dla aktywnego pakietu Investor Pro.",
    importModalTitle: "Import oferty z portalu",
    importUrlPlaceholder: "https://www.otodom.pl/... lub OLX / Nieruchomosci-Online",
    importAnalyze: "Analizuj link",
    importCreate: "Utwórz ofertę",
    importSuccess: "Oferta została utworzona.",
    importNoCredit: "Brak kredytu Pakietu Plus — kup pakiet, aby opublikować import.",
    openHouseModalTitle: "Dzień otwartych drzwi",
    openHouseCreateTab: "Nowy",
    openHouseListTab: "Moje wydarzenia",
    openHousePickOffer: "Wybierz ogłoszenie",
    openHouseNoOffers: "Brak aktywnych ogłoszeń.",
    openHousePublish: "Opublikuj dzień otwarty",
    openHouseSuccess: "Dzień otwarty opublikowany.",
    openHouseEmpty: "Nie masz jeszcze zaplanowanych dni otwartych.",
    openHouseCancel: "Anuluj wydarzenie",
    openHouseViewOffer: "Zobacz ogłoszenie",
    visitModeFlex: "Dowolna godzina w przedziale",
    visitMode30: "Sloty co 30 min",
    visitMode60: "Sloty co 60 min",
    slotDay: "Dzień",
    slotFrom: "Od",
    slotTo: "Do",
    slotCapacity: "Limit gości",
    openHousePublishError: "Nie udało się opublikować.",
    openHouseCancelConfirm: "Anulować ten dzień otwarty?",
    openHouseCancelError: "Nie udało się anulować.",
    openHouseOptionalTitle: "Tytuł (opcjonalnie)",
    openHouseOptionalDescription: "Informacje dla gości (opcjonalnie)",
    exclusiveBadge: "Ekskluzywne narzędzie Pro",
    auctionTitle: "Licytacje online",
    auctionSubtitle: "Transparentne licytacje ofert — moduł aktywujemy w najbliższym czasie.",
    auctionSoon: "Wkrótce",
    openHouseSpotsLeft: "wolnych miejsc",
    importModalLead:
      "Wklej link do ogłoszenia — kliknij w pole, a adres ze schowka wklei się automatycznie. Przed konwersją wybierzesz kupon lub kredyt Plus. Po opłaceniu oferta trafi do weryfikacji z zarezerwowaną publikacją.",
    importLinkLabel: "Link ogłoszenia (auto detect)",
    importHint: "Wskazówka: skopiuj link z OtoDom, OLX lub Nieruchomosci-Online, kliknij pole powyżej — wklei się sam.",
    importPreviewLabel: "Podgląd",
    importPayCreate: "Opłać i utwórz na EstateOS",
    importEditLink: "Edytuj",
    importPreviewLink: "Podgląd",
    importPubTitle: "Opłata za publikację importu",
    importPubSubtitle:
      "Import z OtoDom, OLX lub Nieruchomosci-Online zużywa ten sam kredyt lub kupon co zwykłe wystawienie oferty na 30 dni. Po opłaceniu oferta trafi do weryfikacji z zarezerwowaną publikacją.",
    importBuyPlusHint: "Kup Pakiet Plus w portfelu publikacji, a następnie ponów import.",
    importUrlEmpty: "Wklej link do oferty z OtoDom, OLX lub Nieruchomosci-Online.",
    importWalletError: "Nie udało się pobrać portfela publikacji.",
    importSourceOfferFallback: "Oferta źródłowa",
  },
  proWidget: {
    investmentDemand: "Popyt inwestycyjny",
    marketAverage: "Średnia rynkowa",
    pulseTitle: "Puls Rynku",
    pulseLive: "Live",
    pulseSync: "Sync…",
    encryptedConnection: "Połączenie z serwerem szyfrowane",
    noteTitle: "Twoja Notatka",
    notePlaceholder: "Wpisz tajne informacje dla tego dnia (np. negocjacje, spotkanie z klientem)…",
    noteSave: "Zapisz",
    noteSaveCloud: "Zapisz w chmurze",
    noteSaveError: "Błąd zapisu notatki",
    weekdays: ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"],
    months: [
      "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
      "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
    ],
  },
  pulseSchedule: {
    section: "Twój harmonogram",
    empty: "Brak zaplanowanych wydarzeń",
    emptyHint: "Prezentacje i dni otwarte pojawią się tutaj.",
    live: "Trwa teraz",
    pending: "Oczekuje",
    days: "Dni",
    hours: "Godz",
    minutes: "Min",
    seconds: "Sek",
    starts: "Start",
    prevEvent: "Poprzednie wydarzenie",
    nextEvent: "Następne wydarzenie",
    detailsLink: "Szczegóły →",
    eventLabel: "Wydarzenie",
  },
  boot: {
    initLabel: "Inicjalizacja Systemów PRO",
    greetings: [
      "System gotowy. Twój ruch, {name}.",
      "Witaj {name}, rynek czeka na Twoje inwestycje.",
      "Dzień dobry, {name}. Kolejny dzień, nowe możliwości.",
      "Zabezpieczenie PRO aktywne. Miłego dnia, {name}.",
    ],
  },
  verification: {
    bannerTitle: "Weryfikacja konta",
    both: "Potwierdź telefon (SMS) i e-mail, aby odblokować pełne funkcje.",
    phoneOnly: "Potwierdź telefon SMS-em, aby odblokować pełne funkcje.",
    emailOnly: "Potwierdź e-mail, aby odblokować pełne funkcje.",
    cta: "Zweryfikuj teraz",
    verifiedBadge: "Konto zweryfikowane",
    confirmEmail: "Potwierdź e-mail",
    confirmPhone: "Potwierdź telefon SMS",
  },
  welcome: "Witaj",
  reviewsNone: "Brak opinii",
  offerFilter: {
    active: "Aktywne ({n})",
    pending: "Oczekujące ({n})",
    completed: "Zakończone ({n})",
  },
  radar: {
    recalibratingTitle: "Rekalibracja Radaru...",
    recalibratingSub: "Aktualizujemy kryteria • Przeszukujemy bazę ukrytych ofert",
    emptyHint: "Ustaw kryteria Radaru — dopasowane oferty pojawią się tutaj.",
    deposit: "Kaucja:",
    adminFee: "Czynsz adm:",
    investmentHighlight: "inwestycji",
  },
  offers: {
    emptyActive: "Brak aktywnych ogłoszeń.",
    emptyPending: "Brak ogłoszeń oczekujących.",
    emptyCompleted: "Brak zakończonych ogłoszeń.",
    addProperty: "DODAJ SWOJĄ NIERUCHOMOŚĆ",
    addAnother: "Dodaj kolejną",
    badgeExpired: "Wygasło",
    badgeInReview: "W weryfikacji",
    badgeNew: "Nowe!",
    badgeActive: "Aktywne",
    petsAllowed: "Zwierzęta akceptowane",
    reach: "Zasięg (wyświetlenia)",
    bidsPendingTitle: "Oczekujące propozycje",
    bidCash: "Gotówka",
    bidMortgage: "Kredyt bankowy",
    bidAccept: "Akceptuj w Deal Room",
    bidReject: "Odrzuć",
    renewProcessing: "Przetwarzam...",
    renewCta: "Odnów ofertę (49,00 zł)",
    pubStatus: "Status publikacji",
    pubAwaiting: "Czeka na akceptację EstateOS™",
    pubValidUntil: "Ważne do:",
    pubDaysLeft: "Pozostało {n} dni",
    pubLabel: "Publikacja",
    pubLive: "Aktywna na rynku",
    edit: "Edytuj",
    editHint: "Edycja cofa do weryfikacji.",
    pause: "Wstrzymaj",
    thumbAlt: "Miniatura oferty",
  },
  deals: {
    back: "← Wróć do listy transakcji",
    emptyTitle: "Brak aktywnych transakcji",
    emptyDesc:
      "Złóż ofertę zakupu lub zaakceptuj propozycję kupującego, aby otworzyć szyfrowany Deal Room.",
    fallbackTitle: "Nieruchomość",
    dealId: "Deal #{id}",
    unread: "+{n} nieodczytane",
    pin: "Przypnij",
    pinned: "Przypięte",
    lastMessage: "Ostatnia wiadomość",
    pendingBids: "{n} oczek. ofert",
    pendingAppointments: "{n} oczek. terminów",
    profile: "Profil: {name}",
    openProfile: "Otwórz profil",
    msgNone: "Brak wiadomości",
    msgApptAccepted: "Termin spotkania został zaakceptowany.",
    msgApptProposed: "Zaproponowano nowy termin spotkania.",
    msgApptDeclined: "Termin spotkania został odrzucony.",
    msgApptCountered: "Zaproponowano kontrofertę terminu.",
    msgBidAccepted: "Oferta cenowa została zaakceptowana.",
    msgBidProposed: "Złożono nową ofertę cenową.",
    msgBidRejected: "Oferta cenowa została odrzucona.",
    msgBidCountered: "Zaproponowano kontrofertę cenową.",
    msgGeneric: "Aktualizacja przebiegu transakcji.",
  },
  planning: {
    stepDay: "Wybierz dzień",
    stepTime: "Wybierz godzinę",
    stepSend: "Wyślij",
    confirmed: "Zatwierdzone",
    proposed: "Propozycja terminu",
    stepOf: "Krok {n} z 3",
    dateTime: "Data i czas",
    property: "Nieruchomość",
    addressHidden: "Adres widoczny po akceptacji terminu",
    unitNo: "Nr lokalu:",
    offerId: "Oferta #{id}",
    proposedBy: "Propozycja od",
    counterparty: "Kontrahent",
    cancelPresentation: "Odwołaj prezentację",
    waiting: "Oczekujesz na odpowiedź kontrahenta",
    confirm: "Potwierdź",
    reschedule: "Zmień termin",
    noActions: "Brak dostępnych akcji dla tego wpisu.",
    newSlot: "Twój nowy termin",
    sendCounter: "Wyślij kontrofertę",
  },
  wow: {
    investorTitle: "ZŁOTY INWESTOR",
    investorSub: "Eksplozja możliwości! Radar z opóźnieniem 0s jest Twój.",
    agencyTitle: "AGENCJA PRO",
    agencySub: "Pełen dostęp. Limit ogłoszeń zniesiony.",
    plusTitle: "PAKIET +",
    plusSub: "Twoje ogłoszenie zostało odblokowane i trafia na rynek.",
    renewalTitle: "RYNEK ZDOBYTY",
    renewalSub: "Oferta odnowiona. Czas na dominację.",
    auth: "Autoryzacja...",
    confirmed: "POTWIERDZONY",
    stripeVerify: "Weryfikacja płatności Stripe...",
  },
  wowPlus: { brand: "EstateOS Ultra", activated: "AKTYWOWANY" },
  profile: {
    verified: "Tożsamość zweryfikowana",
    loading: "Ładowanie profilu…",
    reviewsEmpty: "Brak opinii po transakcjach",
    reviewsDetail: "{n} opinii • Zobacz szczegóły",
    accountType: "Typ konta",
    attendance: "Stawiennictwo",
    planAgency: "Agencja",
    planPro: "PRO",
    planStandard: "Standard",
    activeOffers: "Aktywne oferty ({n})",
  },
  profileModal: {
    title: "Profil użytkownika",
    avgRating: "Średnia ocen",
    comments: "Komentarze",
    otherOffers: "Pozostałe oferty użytkownika",
    noComment: "Bez komentarza",
    noComments: "Brak komentarzy.",
    noOffers: "Brak innych ofert.",
    loadFailed: "Nie udało się pobrać profilu.",
  },
  archive: {
    title: "Wstrzymać sprzedaż?",
    body: "Ta akcja jest natychmiastowa — oferta znika z mapy i trafia do archiwum.",
    warningTitle: "Ważna informacja",
    warningBody:
      "Obecny opłacony czas emisji przepada. Aby wrócić na rynek, wymagane będzie odnowienie (49,00 zł).",
    cancel: "Anuluj",
    confirm: "Zdejmij z rynku",
    deletePermanent: "Usuń ofertę trwale",
  },
  alerts: {
    bidUseDealRoom: "Otwórz Deal Room w zakładce Transakcje, aby obsłużyć ofertę.",
    bidError: "Wystąpił błąd przy przetwarzaniu oferty.",
    network: "Błąd połączenia z serwerem.",
    archiveError: "Błąd podczas wstrzymywania oferty.",
    deleteArchived:
      "Oferta ma historię negocjacji — została zarchiwizowana zamiast usunięta.",
    deleteError: "Błąd podczas usuwania oferty.",
    paymentError: "Błąd połączenia z operatorem płatności.",
    cancelApptError: "Nie udało się odwołać spotkania.",
    saveError: "Nie udało się zapisać zmian.",
    proposalError: "Nie udało się wysłać propozycji.",
  },
  confirms: {
    cancelAppointment: "Czy na pewno chcesz odwołać to spotkanie?",
  },
  reviewsModalUserFallback: "Inwestor",
};

const en: CrmExtendedDictionary = {
  proStatus: {
    eyebrow: "INVESTOR PRO",
    validUntil: "Current period until:",
    daysLeft: "{n} {unit} until renewal",
    dayOne: "day",
    dayMany: "days",
    periodHint: "Monthly subscription — renews automatically after App Store billing.",
    creditsLine: "Publication credits in plan: {n} (valid until {date})",
    barCaption: "Bar: {n} of {total} days left in the current period",
    compactUntil: "Until {date}",
    creditsShort: "EOS credits",
  },
  proTools: {
    eyebrow: "Investor Pro",
    title: "Premium tools",
    lead: "Portal import and open house scheduling in one place.",
    importTitle: "Import from OtoDom + OLX + Nieruchomosci-Online",
    importSubtitle: "Move a listing to EstateOS — same publication fee as a standard listing.",
    importTag: "Import",
    openHouseTitle: "Open house day",
    openHouseSubtitle: "Schedule visit slots and guest reservations for your listing.",
    openHouseTag: "Pro",
    footer: "Available for active Investor Pro members.",
    importModalTitle: "Import listing from portal",
    importUrlPlaceholder: "https://www.otodom.pl/... or OLX / Nieruchomosci-Online",
    importAnalyze: "Analyze link",
    importCreate: "Create listing",
    importSuccess: "Listing created.",
    importNoCredit: "No Plus Package credit — buy a package to publish the import.",
    openHouseModalTitle: "Open house day",
    openHouseCreateTab: "New",
    openHouseListTab: "My events",
    openHousePickOffer: "Select listing",
    openHouseNoOffers: "No active listings.",
    openHousePublish: "Publish open house",
    openHouseSuccess: "Open house published.",
    openHouseEmpty: "No open house events yet.",
    openHouseCancel: "Cancel event",
    openHouseViewOffer: "View listing",
    visitModeFlex: "Flexible arrival window",
    visitMode30: "30-minute slots",
    visitMode60: "60-minute slots",
    slotDay: "Day",
    slotFrom: "From",
    slotTo: "To",
    slotCapacity: "Guest limit",
    openHousePublishError: "Could not publish.",
    openHouseCancelConfirm: "Cancel this open house?",
    openHouseCancelError: "Could not cancel.",
    openHouseOptionalTitle: "Title (optional)",
    openHouseOptionalDescription: "Notes for guests (optional)",
    exclusiveBadge: "Exclusive Pro tool",
    auctionTitle: "Online auctions",
    auctionSubtitle: "Transparent listing auctions — module coming soon.",
    auctionSoon: "Coming soon",
    openHouseSpotsLeft: "spots left",
    importModalLead:
      "Paste a listing link — click the field and the URL from your clipboard fills in automatically. Before conversion you choose a coupon or Plus credit. After payment the listing goes to review with publication reserved.",
    importLinkLabel: "Listing link (auto detect)",
    importHint: "Tip: copy a link from OtoDom, OLX, or Nieruchomosci-Online, click the field above — it pastes itself.",
    importPreviewLabel: "Preview",
    importPayCreate: "Pay & create on EstateOS",
    importEditLink: "Edit",
    importPreviewLink: "Preview",
    importPubTitle: "Import publication fee",
    importPubSubtitle:
      "Import from OtoDom, OLX, or Nieruchomosci-Online uses the same coupon or credit as a standard 30-day listing. After payment the listing goes to review with publication reserved.",
    importBuyPlusHint: "Buy a Plus package in the publication wallet, then retry the import.",
    importUrlEmpty: "Paste a listing link from OtoDom, OLX, or Nieruchomosci-Online.",
    importWalletError: "Could not load publication wallet.",
    importSourceOfferFallback: "Source listing",
  },
  proWidget: {
    investmentDemand: "Investment demand",
    marketAverage: "Market average",
    pulseTitle: "Market Pulse",
    pulseLive: "Live",
    pulseSync: "Sync…",
    encryptedConnection: "Encrypted server connection",
    noteTitle: "Your note",
    notePlaceholder: "Private notes for this day (e.g. negotiations, client meeting)…",
    noteSave: "Save",
    noteSaveCloud: "Save to cloud",
    noteSaveError: "Could not save note",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
  },
  pulseSchedule: {
    section: "Your schedule",
    empty: "No scheduled events",
    emptyHint: "Presentations and open houses will appear here.",
    live: "Live now",
    pending: "Pending",
    days: "Days",
    hours: "Hrs",
    minutes: "Min",
    seconds: "Sec",
    starts: "Starts",
    prevEvent: "Previous event",
    nextEvent: "Next event",
    detailsLink: "Details →",
    eventLabel: "Event",
  },
  boot: {
    initLabel: "Initializing PRO systems",
    greetings: [
      "Systems ready. Your move, {name}.",
      "Welcome {name} — the market awaits your next move.",
      "Good morning, {name}. New day, new opportunities.",
      "PRO security active. Have a great day, {name}.",
    ],
  },
  verification: {
    bannerTitle: "Account verification",
    both: "Confirm phone (SMS) and email to unlock full features.",
    phoneOnly: "Confirm your phone via SMS to unlock full features.",
    emailOnly: "Confirm your email to unlock full features.",
    cta: "Verify now",
    verifiedBadge: "Verified account",
    confirmEmail: "Confirm email",
    confirmPhone: "Confirm SMS phone",
  },
  welcome: "Welcome",
  reviewsNone: "No reviews yet",
  offerFilter: {
    active: "Active ({n})",
    pending: "Pending ({n})",
    completed: "Completed ({n})",
  },
  radar: {
    recalibratingTitle: "Recalibrating radar...",
    recalibratingSub: "Updating criteria • Scanning hidden listings",
    emptyHint: "Set radar criteria — matched listings will appear here.",
    deposit: "Deposit:",
    adminFee: "Admin fee:",
    investmentHighlight: "investment",
  },
  offers: {
    emptyActive: "No active listings.",
    emptyPending: "No pending listings.",
    emptyCompleted: "No completed listings.",
    addProperty: "ADD YOUR PROPERTY",
    addAnother: "Add another",
    badgeExpired: "Expired",
    badgeInReview: "In review",
    badgeNew: "New!",
    badgeActive: "Active",
    petsAllowed: "Pets allowed",
    reach: "Reach (views)",
    bidsPendingTitle: "Pending proposals",
    bidCash: "Cash",
    bidMortgage: "Bank mortgage",
    bidAccept: "Accept in Deal Room",
    bidReject: "Decline",
    renewProcessing: "Processing...",
    renewCta: "Renew listing (49.00 PLN)",
    pubStatus: "Publication status",
    pubAwaiting: "Awaiting EstateOS™ approval",
    pubValidUntil: "Valid until:",
    pubDaysLeft: "{n} days left",
    pubLabel: "Publication",
    pubLive: "Live on market",
    edit: "Edit",
    editHint: "Editing sends listing back to review.",
    pause: "Pause",
    thumbAlt: "Listing thumbnail",
  },
  deals: {
    back: "← Back to transactions",
    emptyTitle: "No active transactions",
    emptyDesc:
      "Submit a purchase bid or accept a buyer proposal to open an encrypted Deal Room.",
    fallbackTitle: "Property",
    dealId: "Deal #{id}",
    unread: "+{n} unread",
    pin: "Pin",
    pinned: "Pinned",
    lastMessage: "Last message",
    pendingBids: "{n} pending bids",
    pendingAppointments: "{n} pending appointments",
    profile: "Profile: {name}",
    openProfile: "Open profile",
    msgNone: "No messages",
    msgApptAccepted: "Viewing time was accepted.",
    msgApptProposed: "A new viewing time was proposed.",
    msgApptDeclined: "Viewing time was declined.",
    msgApptCountered: "A counter time was proposed.",
    msgBidAccepted: "Price offer was accepted.",
    msgBidProposed: "A new price offer was submitted.",
    msgBidRejected: "Price offer was declined.",
    msgBidCountered: "A price counter-offer was submitted.",
    msgGeneric: "Transaction update.",
  },
  planning: {
    stepDay: "Choose day",
    stepTime: "Choose time",
    stepSend: "Send",
    confirmed: "Confirmed",
    proposed: "Time proposal",
    stepOf: "Step {n} of 3",
    dateTime: "Date & time",
    property: "Property",
    addressHidden: "Address visible after acceptance",
    unitNo: "Unit no.:",
    offerId: "Listing #{id}",
    proposedBy: "Proposed by",
    counterparty: "Counterparty",
    cancelPresentation: "Cancel viewing",
    waiting: "Waiting for counterparty",
    confirm: "Confirm",
    reschedule: "Reschedule",
    noActions: "No actions available for this entry.",
    newSlot: "Your new time slot",
    sendCounter: "Send counter-offer",
  },
  wow: {
    investorTitle: "GOLD INVESTOR",
    investorSub: "Unlimited possibilities! Zero-delay radar is yours.",
    agencyTitle: "AGENCY PRO",
    agencySub: "Full access. Listing limit removed.",
    plusTitle: "PAKIET +",
    plusSub: "Your listing is unlocked and heading to market.",
    renewalTitle: "MARKET SECURED",
    renewalSub: "Listing renewed. Time to dominate.",
    auth: "Authorizing...",
    confirmed: "CONFIRMED",
    stripeVerify: "Verifying Stripe payment...",
  },
  wowPlus: { brand: "EstateOS Ultra", activated: "ACTIVATED" },
  profile: {
    verified: "Identity verified",
    loading: "Loading profile…",
    reviewsEmpty: "No post-transaction reviews",
    reviewsDetail: "{n} reviews • See details",
    accountType: "Account type",
    attendance: "Attendance",
    planAgency: "Agency",
    planPro: "PRO",
    planStandard: "Standard",
    activeOffers: "Active listings ({n})",
  },
  profileModal: {
    title: "User profile",
    avgRating: "Average rating",
    comments: "Comments",
    otherOffers: "Other listings by this user",
    noComment: "No comment",
    noComments: "No comments.",
    noOffers: "No other listings.",
    loadFailed: "Could not load profile.",
  },
  archive: {
    title: "Pause listing?",
    body: "This is immediate — the listing leaves the map and moves to archive.",
    warningTitle: "Important",
    warningBody:
      "Remaining paid display time ends. Returning to market requires renewal (49.00 PLN).",
    cancel: "Cancel",
    confirm: "Remove from market",
    deletePermanent: "Delete listing permanently",
  },
  alerts: {
    bidUseDealRoom: "Open Deal Room under Transactions to handle this bid.",
    bidError: "An error occurred while processing the bid.",
    network: "Connection error.",
    archiveError: "Could not pause listing.",
    deleteArchived: "Listing has negotiation history — archived instead of deleted.",
    deleteError: "Could not delete listing.",
    paymentError: "Payment provider connection error.",
    cancelApptError: "Could not cancel appointment.",
    saveError: "Could not save changes.",
    proposalError: "Could not send proposal.",
  },
  confirms: {
    cancelAppointment: "Are you sure you want to cancel this viewing?",
  },
  reviewsModalUserFallback: "Investor",
};

const uk: CrmExtendedDictionary = {
  ...en,
  proTools: {
    ...en.proTools,
    eyebrow: "Investor Pro",
    title: "Преміум-інструменти",
    lead: "Імпорт оголошень з порталів і організація днів відкритих дверей — в одному місці.",
    importTitle: "Імпорт з OtoDom + OLX + Nieruchomosci-Online",
    importSubtitle: "Перенесіть оголошення на EstateOS — з такою ж оплатою публікації, як при звичайному розміщенні.",
    importTag: "Імпорт",
    openHouseTitle: "День відкритих дверей",
    openHouseSubtitle: "Заплануйте візити та бронювання гостей для вашого оголошення.",
    openHouseTag: "Pro",
    footer: "Функції доступні з активним пакетом Investor Pro.",
    importModalTitle: "Імпорт оголошення з порталу",
    importUrlPlaceholder: "https://www.otodom.pl/... або OLX / Nieruchomosci-Online",
    importAnalyze: "Аналізувати посилання",
    importCreate: "Створити оголошення",
    importSuccess: "Оголошення створено.",
    importNoCredit: "Немає кредиту Pakiet Plus — купіть пакет для публікації імпорту.",
    openHouseModalTitle: "День відкритих дверей",
    openHouseCreateTab: "Новий",
    openHouseListTab: "Мої події",
    openHousePickOffer: "Оберіть оголошення",
    openHouseNoOffers: "Немає активних оголошень.",
    openHousePublish: "Опублікувати день відкритих дверей",
    openHouseSuccess: "День відкритих дверей опубліковано.",
    openHouseEmpty: "У вас ще немає запланованих днів відкритих дверей.",
    openHouseCancel: "Скасувати подію",
    openHouseViewOffer: "Переглянути оголошення",
    visitModeFlex: "Будь-який час у вікні",
    visitMode30: "Слоти по 30 хв",
    visitMode60: "Слоти по 60 хв",
    slotDay: "День",
    slotFrom: "Від",
    slotTo: "До",
    slotCapacity: "Ліміт гостей",
    openHousePublishError: "Не вдалося опублікувати.",
    openHouseCancelConfirm: "Скасувати цей день відкритих дверей?",
    openHouseCancelError: "Не вдалося скасувати.",
    openHouseOptionalTitle: "Назва (необов'язково)",
    openHouseOptionalDescription: "Інформація для гостей (необов'язково)",
    exclusiveBadge: "Ексклюзивний інструмент Pro",
    auctionTitle: "Онлайн-аукціони",
    auctionSubtitle: "Прозорі аукціони оголошень — модуль незабаром.",
    auctionSoon: "Незабаром",
    openHouseSpotsLeft: "вільних місць",
    importModalLead:
      "Вставте посилання на оголошення — натисніть поле, і адреса з буфера вставиться автоматично. Перед конверсією оберіть купон або кредит Plus. Після оплати оголошення потрапить на перевірку з зарезервованою публікацією.",
    importLinkLabel: "Посилання на оголошення (auto detect)",
    importHint: "Підказка: скопіюйте посилання з OtoDom, OLX або Nieruchomosci-Online, натисніть поле вище — воно вставиться само.",
    importPreviewLabel: "Попередній перегляд",
    importPayCreate: "Оплатити та створити на EstateOS",
    importEditLink: "Редагувати",
    importPreviewLink: "Перегляд",
    importPubTitle: "Оплата за публікацію імпорту",
    importPubSubtitle:
      "Імпорт з OtoDom, OLX або Nieruchomosci-Online використовує той самий купон або кредит, що й звичайне розміщення на 30 днів. Після оплати оголошення потрапить на перевірку з зарезервованою публікацією.",
    importBuyPlusHint: "Купіть Pakiet Plus у гаманці публікацій, потім повторіть імпорт.",
    importUrlEmpty: "Вставте посилання на оголошення з OtoDom, OLX або Nieruchomosci-Online.",
    importWalletError: "Не вдалося завантажити гаманець публікацій.",
    importSourceOfferFallback: "Вихідне оголошення",
  },
  proWidget: {
    investmentDemand: "Інвестиційний попит",
    marketAverage: "Середня ринкова",
    pulseTitle: "Пульс ринку",
    pulseLive: "Live",
    pulseSync: "Sync…",
    encryptedConnection: "З'єднання з сервером зашифровано",
    noteTitle: "Ваша нотатка",
    notePlaceholder: "Приватні нотатки на цей день (напр. переговори, зустріч з клієнтом)…",
    noteSave: "Зберегти",
    noteSaveCloud: "Зберегти в хмарі",
    noteSaveError: "Помилка збереження нотатки",
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
    months: [
      "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
      "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
    ],
  },
  pulseSchedule: {
    section: "Ваш розклад",
    empty: "Немає запланованих подій",
    emptyHint: "Презентації та дні відкритих дверей з'являться тут.",
    live: "Зараз триває",
    pending: "Очікує",
    days: "Дні",
    hours: "Год",
    minutes: "Хв",
    seconds: "Сек",
    starts: "Початок",
    prevEvent: "Попередня подія",
    nextEvent: "Наступна подія",
    detailsLink: "Деталі →",
    eventLabel: "Подія",
  },
  boot: {
    initLabel: "Ініціалізація систем PRO",
    greetings: [
      "Система готова. Ваш хід, {name}.",
      "Вітаємо, {name} — ринок чекає на ваші інвестиції.",
      "Доброго дня, {name}. Новий день — нові можливості.",
      "Захист PRO активний. Гарного дня, {name}.",
    ],
  },
  verification: {
    bannerTitle: "Верифікація акаунта",
    both: "Підтвердіть телефон (SMS) та e-mail, щоб розблокувати повний функціонал.",
    phoneOnly: "Підтвердіть телефон SMS, щоб розблокувати повний функціонал.",
    emailOnly: "Підтвердіть e-mail, щоб розблокувати повний функціонал.",
    cta: "Верифікувати зараз",
    verifiedBadge: "Акаунт верифіковано",
    confirmEmail: "Підтвердити e-mail",
    confirmPhone: "Підтвердити телефон SMS",
  },
  welcome: "Вітаємо",
  alerts: {
    ...en.alerts,
    network: "Помилка з'єднання з сервером.",
  },
};

export function getCrmExtended(locale: Locale): CrmExtendedDictionary {
  if (locale === "pl") return pl;
  if (locale === "uk") return uk;
  return en;
}

export function fmtDict(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(val)),
    template,
  );
}
