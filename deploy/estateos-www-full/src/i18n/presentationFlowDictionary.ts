import type { Locale } from './config';

export type PresentationFlowDictionary = {
  profile: {
    title: string;
    loading: string;
    loadError: string;
    reviewsNone: string;
    reviewsCount: string;
    presentationHistory: string;
    held: string;
    heldHint: string;
    noShow: string;
    noShowHint: string;
    scheduledOf: string;
    otherOffers: string;
    reviewsSection: string;
    reviewsSectionHint: string;
    reviewsPolicyHint: string;
    noReviewsUser: string;
    reviewNoComment: string;
    reviewerFallback: string;
    backToProfile: string;
  };
  outcome: {
    badge: string;
    title: string;
    subtitle: string;
    offerLabel: string;
    dateLabel: string;
    counterpartyLabel: string;
    instructionTitle: string;
    instructionBody: string;
    completedTitle: string;
    completedDesc: string;
    noShowTitle: string;
    noShowDesc: string;
    cancelledTitle: string;
    cancelledDesc: string;
    noteLabel: string;
    notePlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    tooEarlyTitle: string;
    tooEarlyBody: string;
    dismiss: string;
  };
  review: {
    badge: string;
    title: string;
    subtitle: string;
    instructionTitle: string;
    instructionBody: string;
    starsRequired: string;
    commentLabel: string;
    commentPlaceholder: string;
    commentHint: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    dismiss: string;
  };
  hints: {
    navbarPending: string;
    crmBanner: string;
    crmBannerOpen: string;
    dealRoomBanner: string;
    dealRoomBannerOpen: string;
  };
};

const pl: PresentationFlowDictionary = {
  profile: {
    title: 'Profil użytkownika',
    loading: 'Wczytywanie profilu…',
    loadError: 'Nie udało się wczytać profilu.',
    reviewsNone: 'Brak opinii',
    reviewsCount: '{n} opinii',
    presentationHistory: 'Historia prezentacji',
    held: 'Odbyte',
    heldHint: 'Spotkania zrealizowane po umówionym terminie',
    noShow: 'Nieobecność',
    noShowHint: 'Umówiony termin minął — druga strona nie przyszła',
    scheduledOf: 'z {n} zakończonych umówień',
    otherOffers: 'Inne oferty ({n})',
    reviewsSection: 'Opinie po transakcjach',
    reviewsSectionHint:
      'Opinie wystawia się wyłącznie po uzgodnieniu ceny i potwierdzeniu wycofania oferty — nie po samych prezentacjach.',
    reviewsPolicyHint:
      'Oceny na profilu dotyczą zakończonych transakcji (cena ustalona, oferta wycofana), nie wizyt prezentacyjnych.',
    noReviewsUser:
      'Brak opinii po transakcjach. Opinie pojawiają się dopiero po uzgodnieniu ceny i potwierdzeniu wycofania oferty.',
    reviewNoComment: 'Bez komentarza',
    reviewerFallback: 'Użytkownik #{id}',
    backToProfile: 'Wróć do poprzedniego profilu',
  },
  outcome: {
    badge: 'Podsumowanie wizyty',
    title: 'Jak zakończyła się prezentacja?',
    subtitle: 'To wpływa na reputację obu stron. Wybierz wynik zgodny ze stanem faktycznym.',
    offerLabel: 'Nieruchomość',
    dateLabel: 'Termin',
    counterpartyLabel: 'Kontrahent',
    instructionTitle: 'Jak to działa',
    instructionBody:
      'Po buforze od terminu domknij wizytę. Potem obie strony wystawiają krótką ocenę (gwiazdki + komentarz). Odwołanie przed spotkaniem nie jest nieobecnością.',
    completedTitle: 'Prezentacja odbyła się',
    completedDesc: 'Spotkanie na miejscu lub online się odbyło.',
    noShowTitle: 'Druga strona nie przyszła',
    noShowDesc: 'Termin był zaakceptowany, ale kontrahent nie pojawił się.',
    cancelledTitle: 'Odwołane przed spotkaniem',
    cancelledDesc: 'Wizyta nie doszła do skutku — strony się rozminęły lub odwołały termin.',
    noteLabel: 'Notatka (opcjonalnie)',
    notePlaceholder: 'Np. czekałem 20 min pod adresem…',
    submit: 'Zapisz wynik wizyty',
    submitting: 'Zapisuję…',
    successTitle: 'Wynik zapisany',
    successBody: 'Za chwilę poprosimy Cię o krótką ocenę kontrahenta.',
    tooEarlyTitle: 'Jeszcze za wcześnie',
    tooEarlyBody: 'Domknięcie wizyty będzie możliwe 2 godziny po planowanym terminie.',
    dismiss: 'Przypomnij później',
  },
  review: {
    badge: 'Ocena po prezentacji',
    title: 'Oceń kontrahenta',
    subtitle: 'Oceń współpracę z {name}. Opinia pojawi się na profilu po zapisaniu.',
    instructionTitle: 'Wskazówka',
    instructionBody:
      'Oceniaj komunikację, punktualność i rzetelność — nie samą nieruchomość. Jedna para opinii na każdą zakończoną wizytę.',
    starsRequired: 'Wybierz ocenę w gwiazdkach (1–5).',
    commentLabel: 'Komentarz',
    commentPlaceholder: 'Np. punktualny, konkretny, polecam współpracę…',
    commentHint: 'Maks. ok. 500 znaków. Bez danych wrażliwych i wulgaryzmów.',
    submit: 'Opublikuj opinię',
    submitting: 'Publikuję…',
    successTitle: 'Dziękujemy',
    successBody: 'Opinia została zapisana i wzbogaca profil kontrahenta.',
    dismiss: 'Zamknij',
  },
  hints: {
    navbarPending: 'Masz zaległe podsumowanie wizyty lub ocenę kontrahenta.',
    crmBanner: 'Uzupełnij wynik prezentacji — wpływa na statystyki i opinie.',
    crmBannerOpen: 'Otwórz formularz wyniku prezentacji',
    dealRoomBanner: 'Po terminie prezentacji domknij wizytę i oceń kontrahenta.',
    dealRoomBannerOpen: 'Otwórz podsumowanie wizyty',
  },
};

const en: PresentationFlowDictionary = {
  profile: {
    title: 'User profile',
    loading: 'Loading profile…',
    loadError: 'Could not load profile.',
    reviewsNone: 'No reviews',
    reviewsCount: '{n} reviews',
    presentationHistory: 'Presentation history',
    held: 'Completed',
    heldHint: 'Meetings that took place as scheduled',
    noShow: 'No-show',
    noShowHint: 'Accepted slot passed — counterparty did not attend',
    scheduledOf: 'of {n} closed bookings',
    otherOffers: 'Other listings ({n})',
    reviewsSection: 'Reviews after transactions',
    reviewsSectionHint:
      'Reviews can only be left after the price is agreed and the owner confirms withdrawing the listing — not after viewings alone.',
    reviewsPolicyHint:
      'Profile ratings reflect completed transactions (price agreed, listing withdrawn), not presentation visits.',
    noReviewsUser:
      'No transaction reviews yet. Reviews appear only after the price is agreed and the listing is withdrawn.',
    reviewNoComment: 'No comment',
    reviewerFallback: 'User #{id}',
    backToProfile: 'Back to previous profile',
  },
  outcome: {
    badge: 'Viewing summary',
    title: 'How did the viewing end?',
    subtitle: 'This affects both parties’ reputation. Pick the outcome that matches reality.',
    offerLabel: 'Property',
    dateLabel: 'Slot',
    counterpartyLabel: 'Counterparty',
    instructionTitle: 'How it works',
    instructionBody:
      'Two hours after the scheduled time we ask you to close the visit. Then each side can leave a short star rating and comment. Early cancellation is not counted as a no-show.',
    completedTitle: 'Viewing took place',
    completedDesc: 'The meeting happened on site or online.',
    noShowTitle: 'Counterparty did not show',
    noShowDesc: 'The slot was accepted but the other party did not attend.',
    cancelledTitle: 'Cancelled before the visit',
    cancelledDesc: 'The visit did not happen — cancelled or rescheduled in time.',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. waited 20 minutes at the address…',
    submit: 'Save visit outcome',
    submitting: 'Saving…',
    successTitle: 'Outcome saved',
    successBody: 'We will ask you for a short rating of your counterparty next.',
    tooEarlyTitle: 'Too early',
    tooEarlyBody: 'You can close the visit 2 hours after the scheduled time.',
    dismiss: 'Remind me later',
  },
  review: {
    badge: 'Post-viewing rating',
    title: 'Rate your counterparty',
    subtitle: 'Rate your experience with {name}. The review appears on their profile.',
    instructionTitle: 'Tip',
    instructionBody:
      'Rate communication, punctuality, and reliability — not the property itself. One review pair per completed visit.',
    starsRequired: 'Select a star rating (1–5).',
    commentLabel: 'Comment',
    commentPlaceholder: 'e.g. punctual, clear, would meet again…',
    commentHint: 'About 500 characters max. No sensitive data or abuse.',
    submit: 'Publish review',
    submitting: 'Publishing…',
    successTitle: 'Thank you',
    successBody: 'Your review was saved and enriches their profile.',
    dismiss: 'Close',
  },
  hints: {
    navbarPending: 'You have a pending viewing summary or counterparty rating.',
    crmBanner: 'Complete the viewing outcome — it drives stats and reviews.',
    crmBannerOpen: 'Open viewing outcome form',
    dealRoomBanner: 'After the viewing slot, close the visit and rate your counterparty.',
    dealRoomBannerOpen: 'Open viewing summary',
  },
};

export function getPresentationFlowDictionary(locale: Locale): PresentationFlowDictionary {
  return locale === 'en' ? en : pl;
}

export function fmtPresentation(s: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    s,
  );
}
