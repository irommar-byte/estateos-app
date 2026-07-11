import type { Locale } from "./config";

export type AdminCentralDictionary = {
  hubEyebrow: string;
  hubTitle: string;
  hubSubtitle: string;
  navUsers: string;
  navOffers: string;
  navStats: string;
  navWallet: string;
  loading: string;
  backToHub: string;
  usersTitle: string;
  usersSubtitle: string;
  statsTitle: string;
  statsSubtitle: string;
  walletTitle: string;
  walletSubtitle: string;
  close: string;
  save: string;
  cancel: string;
  search: string;
  noResults: string;
  errorLoad: string;
};

const pl: AdminCentralDictionary = {
  hubEyebrow: "EstateOS™ · centrala",
  hubTitle: "Panel administracyjny",
  hubSubtitle: "Moderacja, użytkownicy, statystyki i portfel publikacji.",
  navUsers: "Użytkownicy",
  navOffers: "Oferty",
  navStats: "Statystyki",
  navWallet: "Portfel",
  loading: "Ładowanie...",
  backToHub: "← Centrala",
  usersTitle: "Użytkownicy",
  usersSubtitle: "Konta, role, weryfikacja i moderacja.",
  statsTitle: "Statystyki",
  statsSubtitle: "Ruch, konwersje i aktywność platformy.",
  walletTitle: "Portfel publikacji",
  walletSubtitle: "Kredyty i pakiety publikacji.",
  close: "Zamknij",
  save: "Zapisz",
  cancel: "Anuluj",
  search: "Szukaj",
  noResults: "Brak wyników",
  errorLoad: "Nie udało się wczytać danych.",
};

const en: AdminCentralDictionary = {
  ...pl,
  hubEyebrow: "EstateOS™ · admin",
  hubTitle: "Admin panel",
  hubSubtitle: "Moderation, users, statistics, and publication wallet.",
  navUsers: "Users",
  navOffers: "Listings",
  navStats: "Statistics",
  navWallet: "Wallet",
  loading: "Loading...",
  backToHub: "← Admin hub",
  usersTitle: "Users",
  usersSubtitle: "Accounts, roles, verification, and moderation.",
  statsTitle: "Statistics",
  statsSubtitle: "Traffic, conversions, and platform activity.",
  walletTitle: "Publication wallet",
  walletSubtitle: "Credits and publication packages.",
  close: "Close",
  save: "Save",
  cancel: "Cancel",
  search: "Search",
  noResults: "No results",
  errorLoad: "Could not load data.",
};

const uk: AdminCentralDictionary = {
  ...en,
  hubEyebrow: "EstateOS™ · адмін",
  hubTitle: "Панель адміністратора",
  hubSubtitle: "Модерація, користувачі, статистика та портфель публікацій.",
  navUsers: "Користувачі",
  navOffers: "Оголошення",
  navStats: "Статистика",
  navWallet: "Портфель",
  loading: "Завантаження...",
  backToHub: "← Адмін-центр",
  usersTitle: "Користувачі",
  usersSubtitle: "Акаунти, ролі, верифікація та модерація.",
  statsTitle: "Статистика",
  statsSubtitle: "Трафік, конверсії та активність платформи.",
  walletTitle: "Портфель публікацій",
  walletSubtitle: "Кредити та пакети публікацій.",
  close: "Закрити",
  save: "Зберегти",
  cancel: "Скасувати",
  search: "Пошук",
  noResults: "Немає результатів",
  errorLoad: "Не вдалося завантажити дані.",
};

export function getAdminCentralDictionary(locale: Locale): AdminCentralDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
