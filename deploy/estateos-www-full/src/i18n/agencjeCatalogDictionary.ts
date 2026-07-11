import type { Locale } from "./config";

export type AgencjeCatalogDictionary = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  loading: string;
  empty: string;
  reviewsCta: string;
  offersCta: string;
  offersCount: (n: number) => string;
  ctaJoin: string;
  ctaJoinTitle: string;
  detailEyebrow: string;
  close: string;
  loadError: string;
  ratingLabel: string;
  tabOffers: string;
  tabReviews: string;
  noOffers: string;
  noReviews: string;
  noComment: string;
  messageCta: string;
  websiteCta: string;
  phoneCta: string;
  verified: string;
};

const pl: AgencjeCatalogDictionary = {
  eyebrow: "EstateOS™ · katalog partnerów",
  title: "Katalog",
  titleAccent: "agencji",
  subtitle:
    "Zweryfikowane biura nieruchomości w ekosystemie EstateOS — oferty, opinie i bezpośredni kontakt.",
  loading: "Ładowanie agencji...",
  empty: "Brak zarejestrowanych agencji.",
  reviewsCta: "Zobacz opinie",
  offersCta: "Zobacz oferty",
  offersCount: (n) => `${n} ofert`,
  ctaJoin: "Dołącz jako agencja",
  ctaJoinTitle: "Masz ogłoszenie i chcesz oddać sprzedaż w ręce ekspertów?",
  detailEyebrow: "Szczegóły biura",
  close: "Zamknij",
  loadError: "Nie udało się wczytać danych agencji.",
  ratingLabel: "Ocena",
  tabOffers: "Oferty",
  tabReviews: "Opinie",
  noOffers: "Brak aktywnych ofert.",
  noReviews: "Brak opinii od klientów.",
  noComment: "Bez komentarza tekstowego.",
  messageCta: "Wyślij wiadomość",
  websiteCta: "Strona WWW",
  phoneCta: "Zadzwoń",
  verified: "Zweryfikowana",
};

const en: AgencjeCatalogDictionary = {
  ...pl,
  eyebrow: "EstateOS™ · partner catalog",
  title: "Agency",
  titleAccent: "catalog",
  subtitle: "Verified real estate offices in EstateOS — listings, reviews, and direct contact.",
  loading: "Loading agencies...",
  empty: "No registered agencies yet.",
  reviewsCta: "View reviews",
  offersCta: "View listings",
  offersCount: (n) => `${n} listings`,
  ctaJoin: "Join as agency",
  ctaJoinTitle: "Have a listing and want experts to handle the sale?",
  detailEyebrow: "Office details",
  close: "Close",
  loadError: "Could not load agency data.",
  ratingLabel: "Rating",
  tabOffers: "Listings",
  tabReviews: "Reviews",
  noOffers: "No active listings.",
  noReviews: "No client reviews yet.",
  noComment: "No text comment.",
  messageCta: "Send message",
  websiteCta: "Website",
  phoneCta: "Call",
  verified: "Verified",
};

const uk: AgencjeCatalogDictionary = {
  ...en,
  eyebrow: "EstateOS™ · каталог партнерів",
  title: "Каталог",
  titleAccent: "агентств",
  subtitle: "Верифіковані агентства нерухомості в EstateOS — оголошення, відгуки та прямий контакт.",
  loading: "Завантаження агентств...",
  empty: "Немає зареєстрованих агентств.",
  reviewsCta: "Переглянути відгуки",
  offersCta: "Переглянути оголошення",
  offersCount: (n) => `${n} оголошень`,
  ctaJoin: "Приєднатися як агентство",
  ctaJoinTitle: "Маєте оголошення і хочете передати продаж експертам?",
  detailEyebrow: "Деталі офісу",
  close: "Закрити",
  loadError: "Не вдалося завантажити дані агентства.",
  ratingLabel: "Оцінка",
  tabOffers: "Оголошення",
  tabReviews: "Відгуки",
  noOffers: "Немає активних оголошень.",
  noReviews: "Немає відгуків від клієнтів.",
  noComment: "Без текстового коментаря.",
  messageCta: "Надіслати повідомлення",
  websiteCta: "Веб-сайт",
  phoneCta: "Зателефонувати",
  verified: "Верифіковано",
};

export function getAgencjeCatalogDictionary(locale: Locale): AgencjeCatalogDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
