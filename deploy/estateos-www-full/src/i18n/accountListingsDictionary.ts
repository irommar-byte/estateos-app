import type { Locale } from "./config";

export type AccountListingsDictionary = {
  title: string;
  titleAccent: string;
  subtitle: string;
  tabHome: string;
  tabCars: string;
  priceOnRequest: string;
  loading: string;
  emptyHome: string;
  emptyCars: string;
  addHome: string;
  addCar: string;
  edit: string;
  archive: string;
  archiving: string;
  deleteCar: string;
  deleting: string;
  statusActive: string;
  statusDraft: string;
  statusArchived: string;
  promoted: string;
  loginRequired: string;
};

const pl: AccountListingsDictionary = {
  title: "Moje",
  titleAccent: "ogłoszenia",
  subtitle: "Zarządzaj ofertami nieruchomości i samochodów w jednym miejscu.",
  tabHome: "Nieruchomości",
  tabCars: "Samochody",
  priceOnRequest: "Cena na zapytanie",
  loading: "Ładowanie...",
  emptyHome: "Nie masz jeszcze ogłoszeń nieruchomości.",
  emptyCars: "Nie masz jeszcze ogłoszeń samochodowych.",
  addHome: "Dodaj ofertę",
  addCar: "Dodaj auto",
  edit: "Edytuj",
  archive: "Archiwizuj",
  archiving: "Archiwizuję...",
  deleteCar: "Usuń",
  deleting: "Usuwam...",
  statusActive: "Aktywne",
  statusDraft: "Szkic",
  statusArchived: "Zarchiwizowane",
  promoted: "Wyróżnione",
  loginRequired: "Zaloguj się, aby zobaczyć swoje ogłoszenia.",
};

const en: AccountListingsDictionary = {
  ...pl,
  title: "My",
  titleAccent: "listings",
  subtitle: "Manage property and car listings in one place.",
  tabHome: "Properties",
  tabCars: "Cars",
  priceOnRequest: "Price on request",
  loading: "Loading...",
  emptyHome: "You have no property listings yet.",
  emptyCars: "You have no car listings yet.",
  addHome: "Add listing",
  addCar: "Add car",
  edit: "Edit",
  archive: "Archive",
  archiving: "Archiving...",
  deleteCar: "Delete",
  deleting: "Deleting...",
  statusActive: "Active",
  statusDraft: "Draft",
  statusArchived: "Archived",
  promoted: "Featured",
  loginRequired: "Sign in to see your listings.",
};

const uk: AccountListingsDictionary = {
  ...en,
  title: "Мої",
  titleAccent: "оголошення",
  subtitle: "Керуйте оголошеннями нерухомості та авто в одному місці.",
  tabHome: "Нерухомість",
  tabCars: "Авто",
  priceOnRequest: "Ціна за запитом",
  loading: "Завантаження...",
  emptyHome: "У вас ще немає оголошень про нерухомість.",
  emptyCars: "У вас ще немає оголошень про авто.",
  addHome: "Додати оголошення",
  addCar: "Додати авто",
  edit: "Редагувати",
  archive: "Архівувати",
  archiving: "Архівую...",
  deleteCar: "Видалити",
  deleting: "Видаляю...",
  statusActive: "Активне",
  statusDraft: "Чернетка",
  statusArchived: "В архіві",
  promoted: "Виділене",
  loginRequired: "Увійдіть, щоб побачити свої оголошення.",
};

export function getAccountListingsDictionary(locale: Locale): AccountListingsDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
