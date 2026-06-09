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
    dealRoomBanner: string;
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
    reviewsSection: 'Opinie po prezentacjach',
    noReviewsUser: 'Brak opinii dla tego użytkownika.',
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
      'Po upływie buforu od planowanej godziny prosimy o domknięcie wizyty. Następnie obie strony mogą wystawić krótką ocenę (gwiazdki + komentarz). Odwołanie przed spotkaniem nie liczy się jako nieobecność.',
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
    dealRoomBanner: 'Po terminie prezentacji domknij wizytę i oceń kontrahenta.',
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
    reviewsSection: 'Reviews after viewings',
    noReviewsUser: 'No reviews for this user yet.',
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
    dealRoomBanner: 'After the viewing slot, close the visit and rate your counterparty.',
  },
};

const uk: PresentationFlowDictionary = {
  profile: {
    title: "Профіль користувача",
    loading: "Завантаження профілю…",
    loadError: "Не вдалося завантажити профіль.",
    reviewsNone: "Немає відгуків",
    reviewsCount: "{n} відгуків",
    presentationHistory: "Історія презентацій",
    held: "Відбулися",
    heldHint: "Зустрічі, що відбулися за домовленістю",
    noShow: "Неявка",
    noShowHint: "Термін минув — контрагент не прийшов",
    scheduledOf: "з {n} завершених записів",
    otherOffers: "Інші оголошення ({n})",
    reviewsSection: "Відгуки після переглядів",
    noReviewsUser: "Немає відгуків для цього користувача.",
    reviewNoComment: "Без коментаря",
    reviewerFallback: "Користувач #{id}",
    backToProfile: "Назад до попереднього профілю",
  },
  outcome: {
    badge: "Підсумок візиту",
    title: "Як завершився перегляд?",
    subtitle: "Це впливає на репутацію обох сторін. Оберіть результат відповідно до факту.",
    offerLabel: "Нерухомість",
    dateLabel: "Термін",
    counterpartyLabel: "Контрагент",
    instructionTitle: "Як це працює",
    instructionBody:
      "Через 2 години після запланованого часу просимо закрити візит. Потім кожна сторона може залишити коротку оцінку. Раннє скасування не вважається неявкою.",
    completedTitle: "Презентація відбулася",
    completedDesc: "Зустріч на місці або онлайн відбулася.",
    noShowTitle: "Контрагент не прийшов",
    noShowDesc: "Термін був прийнятий, але друга сторона не з'явилася.",
    cancelledTitle: "Скасовано до візиту",
    cancelledDesc: "Візит не відбувся — скасовано або перенесено вчасно.",
    noteLabel: "Нотатка (необов'язково)",
    notePlaceholder: "Напр. чекав 20 хв за адресою…",
    submit: "Зберегти результат візиту",
    submitting: "Збереження…",
    successTitle: "Результат збережено",
    successBody: "Незабаром попросимо коротко оцінити контрагента.",
    tooEarlyTitle: "Занадто рано",
    tooEarlyBody: "Закрити візит можна через 2 години після запланованого часу.",
    dismiss: "Нагадати пізніше",
  },
  review: {
    badge: "Оцінка після візиту",
    title: "Оцініть контрагента",
    subtitle: "Оцініть співпрацю з {name}. Відгук з'явиться в профілі після збереження.",
    instructionTitle: "Підказка",
    instructionBody:
      "Оцінюйте комунікацію, пунктуальність і надійність — не саму нерухомість. Одна пара відгуків на кожен завершений візит.",
    starsRequired: "Оберіть оцінку зірками (1–5).",
    commentLabel: "Коментар",
    commentPlaceholder: "Напр. пунктуальний, конкретний, рекомендую…",
    commentHint: "До ~500 символів. Без чутливих даних і лайки.",
    submit: "Опублікувати відгук",
    submitting: "Публікація…",
    successTitle: "Дякуємо",
    successBody: "Відгук збережено і доповнює профіль контрагента.",
    dismiss: "Закрити",
  },
  hints: {
    navbarPending: "У вас є незавершене підсумкування візиту або оцінка контрагента.",
    crmBanner: "Доповніть результат презентації — це впливає на статистику та відгуки.",
    dealRoomBanner: "Після терміну презентації закрийте візит і оцініть контрагента.",
  },
};

export function getPresentationFlowDictionary(locale: Locale): PresentationFlowDictionary {
  if (locale === "pl") return pl;
  if (locale === "uk") return uk;
  return en;
}

export function fmtPresentation(s: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    s,
  );
}
