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
  commandCenter: string;
  logout: string;
  boardTitle: string;
  boardSubtitle: string;
  cardOffersDesc: string;
  cardUsersDesc: string;
  cardWalletDesc: string;
  cardStatsDesc: string;
  enter: string;
  loadingCentral: string;
  accessDenied: string;
  apiError: string;
  noSession: string;
  accessDeniedRole: string;
  serverError: string;
  tabPrivate: string;
  tabPrivateHint: string;
  tabAgents: string;
  tabAgentsHint: string;
  tabAgencies: string;
  tabAgenciesHint: string;
  tabPartner: string;
  tabPartnerHint: string;
  searchUsersPlaceholder: string;
  accountsLabel: string;
  activeOffersLabel: string;
  estWalletsLabel: string;
  userSegmentsAria: string;
  proToggleFail: string;
  proToggleNetwork: string;
  deleteUserConfirm: string;
  deleteUserFail: string;
  chatOpenFail: string;
  chatOpenNetwork: string;
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
  commandCenter: "Centrala Dowodzenia",
  logout: "Wyloguj",
  boardTitle: "Zarząd EstateOS",
  boardSubtitle: "Zalogowano pomyślnie na konto Master Admin. Masz pełen dostęp do platformy.",
  cardOffersDesc: "Zarządzaj nieruchomościami.",
  cardUsersDesc: "Zarządzaj kontami.",
  cardWalletDesc: "Kredyty, kupony i historia.",
  cardStatsDesc: "Przeglądaj ruch.",
  enter: "Wejdź",
  loadingCentral: "Wczytywanie Centrali...",
  accessDenied: "Brak Uprawnień",
  apiError: "Błąd API",
  noSession: "Brak sesji",
  accessDeniedRole: "Odmowa dostępu. Twoja rola to:",
  serverError: "Błąd serwera.",
  tabPrivate: "Prywatni",
  tabPrivateHint: "Osoby fizyczne",
  tabAgents: "Agenci",
  tabAgentsHint: "Agenci i doradcy",
  tabAgencies: "Agencje",
  tabAgenciesHint: "Biura nieruchomości",
  tabPartner: "Partner PRO",
  tabPartnerHint: "Status PRO / inwestor",
  searchUsersPlaceholder: "Szukaj: ID, e-mail, imię, telefon, firma…",
  accountsLabel: "Konta",
  activeOffersLabel: "Aktywne oferty",
  estWalletsLabel: "Szac. portfele",
  userSegmentsAria: "Segmenty użytkowników",
  proToggleFail: "Nie udało się zmienić statusu PRO.",
  proToggleNetwork: "Błąd sieci przy zmianie statusu PRO.",
  deleteUserConfirm: "Czy na pewno usunąć tego użytkownika i powiązane dane? Operacji nie można cofnąć.",
  deleteUserFail: "Błąd podczas usuwania.",
  chatOpenFail: "Nie udało się otworzyć czatu.",
  chatOpenNetwork: "Błąd sieci przy otwieraniu czatu.",
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
  commandCenter: "Command Center",
  logout: "Log out",
  boardTitle: "EstateOS Board",
  boardSubtitle: "Signed in successfully na konto Master Admin. Masz pełen dostęp do platformy.",
  cardOffersDesc: "Manage listings.",
  cardUsersDesc: "Manage accounts.",
  cardWalletDesc: "Credits, coupons, and history.",
  cardStatsDesc: "Review traffic.",
  enter: "Enter",
  loadingCentral: "Loading admin hub...",
  accessDenied: "Access denied",
  apiError: "API error",
  noSession: "No session",
  accessDeniedRole: "Access denied. Your role:",
  serverError: "Server error.",
  tabPrivate: "Private",
  tabPrivateHint: "Individuals",
  tabAgents: "Agents",
  tabAgentsHint: "Agents and advisors",
  tabAgencies: "Agencies",
  tabAgenciesHint: "Real-estate offices",
  tabPartner: "PRO partner",
  tabPartnerHint: "PRO / investor status",
  searchUsersPlaceholder: "Search: ID, e-mail, imię, telefon, firma…",
  accountsLabel: "Accounts",
  activeOffersLabel: "Active listings",
  estWalletsLabel: "Est. wallets",
  userSegmentsAria: "User segments",
  proToggleFail: "Could not change PRO status.",
  proToggleNetwork: "Network error changing PRO status.",
  deleteUserConfirm: "Delete this user and related data? This cannot be undone. tego użytkownika i powiązane dane? Operacji nie można cofnąć.",
  deleteUserFail: "Delete failed.",
  chatOpenFail: "Could not open chat.",
  chatOpenNetwork: "Network error opening chat.",
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
  commandCenter: "Центр керування",
  logout: "Вийти",
  boardTitle: "Рада EstateOS",
  boardSubtitle: "Успішний вхід як Master Admin. Повний доступ до платформи.",
  cardOffersDesc: "Керування оголошеннями.",
  cardUsersDesc: "Керування акаунтами.",
  cardWalletDesc: "Кредити, купони та історія.",
  cardStatsDesc: "Перегляд трафіку.",
  enter: "Увійти",
  loadingCentral: "Завантаження адмін-центру...",
  accessDenied: "Немає доступу",
  apiError: "Помилка API",
  noSession: "Немає сесії",
  accessDeniedRole: "Відмова в доступі. Ваша роль:",
  serverError: "Помилка сервера.",
  tabPrivate: "Приватні",
  tabPrivateHint: "Фізичні особи",
  tabAgents: "Агенти",
  tabAgentsHint: "Агенти та радники",
  tabAgencies: "Агенції",
  tabAgenciesHint: "Агентства нерухомості",
  tabPartner: "Партнер PRO",
  tabPartnerHint: "Статус PRO / інвестор",
  searchUsersPlaceholder: "Пошук: ID, e-mail, ім'я, телефон, компанія…",
  accountsLabel: "Акаунти",
  activeOffersLabel: "Активні оголошення",
  estWalletsLabel: "Оцінка портфелів",
  userSegmentsAria: "Сегменти користувачів",
  proToggleFail: "Не вдалося змінити статус PRO.",
  proToggleNetwork: "Помилка мережі при зміні PRO.",
  deleteUserConfirm: "Видалити цього користувача та пов'язані дані? Це незворотно.",
  deleteUserFail: "Помилка видалення.",
  chatOpenFail: "Не вдалося відкрити чат.",
  chatOpenNetwork: "Помилка мережі при відкритті чату.",
};

export function getAdminCentralDictionary(locale: Locale): AdminCentralDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
