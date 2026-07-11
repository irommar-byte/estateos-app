import type { Locale } from "./config";

export type CompanyPublicDictionary = {
  notFound: string;
  connectionError: string;
  unavailable: string;
  agents: string;
  offers: string;
  reviews: string;
  rating: string;
  team: string;
  teamAgent: string;
  officeOffers: string;
  clientReviews: string;
};

const pl: CompanyPublicDictionary = {
  notFound: "Nie znaleziono biura.",
  connectionError: "Błąd połączenia.",
  unavailable: "Biuro niedostępne",
  agents: "Agenci",
  offers: "Oferty",
  reviews: "Opinie",
  rating: "Ocena",
  team: "Zespół",
  teamAgent: "Agent",
  officeOffers: "Oferty biura",
  clientReviews: "Opinie klientów",
};

const en: CompanyPublicDictionary = {
  ...pl,
  notFound: "Office not found.",
  connectionError: "Connection error.",
  unavailable: "Office unavailable",
  agents: "Agents",
  offers: "Listings",
  reviews: "Reviews",
  rating: "Rating",
  team: "Team",
  teamAgent: "Agent",
  officeOffers: "Office listings",
  clientReviews: "Client reviews",
};

const uk: CompanyPublicDictionary = {
  ...en,
  notFound: "Агентство не знайдено.",
  connectionError: "Помилка з'єднання.",
  unavailable: "Агентство недоступне",
  agents: "Агенти",
  offers: "Оголошення",
  reviews: "Відгуки",
  rating: "Оцінка",
  team: "Команда",
  teamAgent: "Агент",
  officeOffers: "Оголошення агентства",
  clientReviews: "Відгуки клієнтів",
};

export function getCompanyPublicDictionary(locale: Locale): CompanyPublicDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
