import type { Locale } from "./config";

export type ExpertProfileDictionary = {
  notFound: string;
  backToCatalog: string;
  verifiedAgent: string;
  portfolioTitle: string;
  noOffers: string;
  reviewsTitle: string;
  noReviews: string;
  defaultReviewComment: string;
};

const pl: ExpertProfileDictionary = {
  notFound: "Ekspert nie odnaleziony",
  backToCatalog: "Wróć do katalogu",
  verifiedAgent: "Zweryfikowany Agent",
  portfolioTitle: "Portfolio Eksperta",
  noOffers: "Agent nie ma obecnie aktywnych ofert.",
  reviewsTitle: "Opinie Klientów",
  noReviews: "Brak opinii. Bądź pierwszy!",
  defaultReviewComment: "Użytkownik ocenił współpracę bez komentarza.",
};

const en: ExpertProfileDictionary = {
  ...pl,
  notFound: "Expert not found",
  backToCatalog: "Back to catalog",
  verifiedAgent: "Verified agent",
  portfolioTitle: "Expert portfolio",
  noOffers: "This agent has no active listings.",
  reviewsTitle: "Client reviews",
  noReviews: "No reviews yet. Be the first!",
  defaultReviewComment: "User rated cooperation without a comment.",
};

const uk: ExpertProfileDictionary = {
  ...en,
  notFound: "Експерта не знайдено",
  backToCatalog: "Назад до каталогу",
  verifiedAgent: "Верифікований агент",
  portfolioTitle: "Портфоліо експерта",
  noOffers: "У агента немає активних оголошень.",
  reviewsTitle: "Відгуки клієнтів",
  noReviews: "Немає відгуків. Будьте першим!",
  defaultReviewComment: "Користувач оцінив співпрацю без коментаря.",
};

export function getExpertProfileDictionary(locale: Locale): ExpertProfileDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
