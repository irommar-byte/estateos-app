import type { Locale } from "./config";

export type CrmExtendedDictionary = {
  proStatus: { eyebrow: string; validUntil: string; daysLeft: string };
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
    eyebrow: "PRO STATUS",
    validUntil: "Ważny do:",
    daysLeft: "Pozostało {n} dni",
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
    eyebrow: "PRO STATUS",
    validUntil: "Valid until:",
    daysLeft: "{n} days left",
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

export function getCrmExtended(locale: Locale): CrmExtendedDictionary {
  return locale === "pl" ? pl : en;
}

export function fmtDict(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(val)),
    template,
  );
}
