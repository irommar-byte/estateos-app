import type { Locale } from "./config";

export type ClientPortalDictionary = {
  unavailableTitle: string;
  unavailableBody: string;
  loadError: string;
  sendFail: string;
  eyebrow: string;
  welcome: string;
  buyerSubtitle: string;
  sellerSubtitle: string;
  agencyManaged: string;
  active: string;
  feedbackPlaceholder: string;
  updateFeedback: string;
  sendFeedback: string;
};

const pl: ClientPortalDictionary = {
  unavailableTitle: "Panel niedostępny",
  unavailableBody: "Link wygasł lub jest nieprawidłowy.",
  loadError: "Błąd ładowania",
  sendFail: "Nie udało się wysłać",
  eyebrow: "Panel klienta",
  welcome: "Witaj",
  buyerSubtitle: "Twój agent przygotował dla Ciebie oferty i materiały.",
  sellerSubtitle: "Status Twojej nieruchomości i komunikacja z agentem.",
  agencyManaged: "Prowadzone przez agencję",
  active: "Aktywne",
  feedbackPlaceholder: "Np. za mała kuchnia, ale świetna lokalizacja…",
  updateFeedback: "Zaktualizuj uwagi",
  sendFeedback: "Wyślij uwagi do agenta",
};

const en: ClientPortalDictionary = {
  ...pl,
  unavailableTitle: "Portal unavailable",
  unavailableBody: "Link expired or invalid.",
  loadError: "Load error",
  sendFail: "Could not send",
  eyebrow: "Client portal",
  welcome: "Welcome",
  buyerSubtitle: "Your agent prepared listings and materials for you.",
  sellerSubtitle: "Your property status and communication with the agent.",
  agencyManaged: "Agency managed",
  active: "Active",
  feedbackPlaceholder: "E.g. kitchen too small but great location…",
  updateFeedback: "Update notes",
  sendFeedback: "Send notes to agent",
};

const uk: ClientPortalDictionary = {
  ...en,
  unavailableTitle: "Панель недоступна",
  unavailableBody: "Посилання застаріло або недійсне.",
  loadError: "Помилка завантаження",
  sendFail: "Не вдалося надіслати",
  eyebrow: "Панель клієнта",
  welcome: "Вітаємо",
  buyerSubtitle: "Ваш агент підготував для вас пропозиції та матеріали.",
  sellerSubtitle: "Статус вашої нерухомості та зв'язок з агентом.",
  agencyManaged: "Веде агенція",
  active: "Активне",
  feedbackPlaceholder: "Напр. мала кухня, але чудова локація…",
  updateFeedback: "Оновити зауваження",
  sendFeedback: "Надіслати зауваження агенту",
};

export function getClientPortalDictionary(locale: Locale): ClientPortalDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
