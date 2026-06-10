import type { Locale } from "./config";

export type OfferModalsDictionary = {
  appointment: {
    successTitle: string;
    stepDay: string;
    stepHour: string;
    stepDetails: string;
    stepOf: (step: number) => string;
    successHeading: string;
    successBody: string;
    selectedSlot: string;
    messageLabel: string;
    messagePlaceholder: string;
    confirmCta: string;
    saveError: string;
    connectionError: string;
    contactConsentNote: string;
  };
  bidding: {
    title: string;
    successTitle: string;
    successBody: string;
    amountLabel: string;
    financingLabel: string;
    cash: string;
    credit: string;
    submitCta: string;
    securedBy: string;
    loginRequired: string;
    connectionError: string;
  };
  shareLink: {
    title: string;
    body: string;
    copy: string;
    copied: string;
    copyPrompt: string;
    openNewTab: string;
  };
  writeMessage: string;
  writeMessageError: string;
};

const pl: OfferModalsDictionary = {
  appointment: {
    successTitle: "Sukces",
    stepDay: "Wybierz dzień",
    stepHour: "Wybierz godzinę",
    stepDetails: "Szczegóły",
    stepOf: (step) => `Krok ${step} z 3`,
    successHeading: "Wysłano!",
    successBody: "Oczekuj na potwierdzenie od właściciela.",
    selectedSlot: "Wybrany termin",
    messageLabel: "Wiadomość do właściciela (opcjonalnie)",
    messagePlaceholder: "Napisz krótko o czym chciałbyś porozmawiać…",
    confirmCta: "Zatwierdź propozycję",
    saveError: "Błąd zapisu",
    connectionError: "Błąd połączenia.",
    contactConsentNote: "\n\n[Zgoda na udostępnienie kontaktów]",
  },
  bidding: {
    title: "Oferta zakupu",
    successTitle: "Oferta złożona",
    successBody: "Właściciel otrzymał Twoją oficjalną propozycję finansową. Status znajdziesz w swoim CRM.",
    amountLabel: "Proponowana kwota",
    financingLabel: "Źródło finansowania",
    cash: "Gotówka",
    credit: "Kredyt",
    submitCta: "Złóż wiążącą ofertę",
    securedBy: "Transakcja zabezpieczona przez EstateOS™",
    loginRequired: "Zaloguj się, aby licytować.",
    connectionError: "Błąd połączenia.",
  },
  shareLink: {
    title: "Udostępnij wizytówkę",
    body: "Krótki link z podglądem oferty — wygodny do social i wiadomości. Po kliknięciu z telefonu może otworzyć aplikację EstateOS (Universal Links).",
    copy: "Kopiuj",
    copied: "Skopiowano",
    copyPrompt: "Skopiuj link:",
    openNewTab: "Otwórz wizytówkę w nowej karcie",
  },
  writeMessage: "Napisz",
  writeMessageError: "Nie udało się otworzyć czatu.",
};

const en: OfferModalsDictionary = {
  appointment: {
    successTitle: "Success",
    stepDay: "Pick a day",
    stepHour: "Pick a time",
    stepDetails: "Details",
    stepOf: (step) => `Step ${step} of 3`,
    successHeading: "Sent!",
    successBody: "Wait for confirmation from the owner.",
    selectedSlot: "Selected slot",
    messageLabel: "Message to the owner (optional)",
    messagePlaceholder: "Briefly say what you would like to discuss…",
    confirmCta: "Confirm proposal",
    saveError: "Could not save",
    connectionError: "Connection error.",
    contactConsentNote: "\n\n[Consent to share contact details]",
  },
  bidding: {
    title: "Purchase offer",
    successTitle: "Offer submitted",
    successBody: "The owner received your formal financial proposal. Check status in your CRM.",
    amountLabel: "Proposed amount",
    financingLabel: "Financing source",
    cash: "Cash",
    credit: "Mortgage",
    submitCta: "Submit binding offer",
    securedBy: "Transaction secured by EstateOS™",
    loginRequired: "Sign in to submit an offer.",
    connectionError: "Connection error.",
  },
  shareLink: {
    title: "Share offer sheet",
    body: "Short preview link — handy for social and messaging. On mobile it may open the EstateOS app (Universal Links).",
    copy: "Copy",
    copied: "Copied",
    copyPrompt: "Copy link:",
    openNewTab: "Open offer sheet in new tab",
  },
  writeMessage: "Message",
  writeMessageError: "Could not open chat.",
};

const uk: OfferModalsDictionary = {
  appointment: {
    successTitle: "Успіх",
    stepDay: "Оберіть день",
    stepHour: "Оберіть час",
    stepDetails: "Деталі",
    stepOf: (step) => `Крок ${step} з 3`,
    successHeading: "Надіслано!",
    successBody: "Очікуйте підтвердження від власника.",
    selectedSlot: "Обраний термін",
    messageLabel: "Повідомлення власнику (необов'язково)",
    messagePlaceholder: "Коротко напишіть, про що хочете поговорити…",
    confirmCta: "Підтвердити пропозицію",
    saveError: "Помилка збереження",
    connectionError: "Помилка з'єднання.",
    contactConsentNote: "\n\n[Згода на надання контактів]",
  },
  bidding: {
    title: "Пропозиція купівлі",
    successTitle: "Пропозицію надіслано",
    successBody: "Власник отримав вашу офіційну фінансову пропозицію. Статус — у вашому CRM.",
    amountLabel: "Запропонована сума",
    financingLabel: "Джерело фінансування",
    cash: "Готівка",
    credit: "Кредит",
    submitCta: "Надіслати обов'язкову пропозицію",
    securedBy: "Угоду захищено EstateOS™",
    loginRequired: "Увійдіть, щоб надіслати пропозицію.",
    connectionError: "Помилка з'єднання.",
  },
  shareLink: {
    title: "Поділитися візитівкою",
    body: "Коротке посилання з прев'ю — зручно для соцмереж і месенджерів. На телефоні може відкрити застосунок EstateOS (Universal Links).",
    copy: "Копіювати",
    copied: "Скопійовано",
    copyPrompt: "Скопіюйте посилання:",
    openNewTab: "Відкрити візитівку в новій вкладці",
  },
  writeMessage: "Написати",
  writeMessageError: "Не вдалося відкрити чат.",
};

export function getOfferModalsDictionary(locale: Locale): OfferModalsDictionary {
  if (locale === "pl") return pl;
  if (locale === "uk") return uk;
  return en;
}

export function appointmentDateLocale(locale: Locale): string {
  if (locale === "pl") return "pl-PL";
  if (locale === "uk") return "uk-UA";
  return "en-GB";
}
