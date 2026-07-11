import type { Locale } from "./config";

export type AgentPublicProfileDictionary = {
  agentProfile: string;
  ownerProfile: string;
  defaultAgent: string;
  defaultUser: string;
  office: string;
  agentOffers: string;
  userOffers: string;
  noAgentReviews: string;
  noUserReviews: string;
  client: string;
  noComment: string;
};

const pl: AgentPublicProfileDictionary = {
  agentProfile: "Profil agenta nieruchomości",
  ownerProfile: "Profil właściciela",
  defaultAgent: "Agent",
  defaultUser: "Użytkownik",
  office: "Biuro",
  agentOffers: "Oferty agenta",
  userOffers: "Oferty",
  noAgentReviews: "Ten agent nie ma jeszcze opinii od klientów.",
  noUserReviews: "Ten użytkownik nie ma jeszcze opinii.",
  client: "Klient",
  noComment: "Ocena bez komentarza tekstowego.",
};

const en: AgentPublicProfileDictionary = {
  ...pl,
  agentProfile: "Real-estate agent profile",
  ownerProfile: "Owner profile",
  defaultAgent: "Agent",
  defaultUser: "User",
  office: "Office",
  agentOffers: "Agent listings",
  userOffers: "Listings",
  noAgentReviews: "This agent has no client reviews yet.",
  noUserReviews: "This user has no reviews yet.",
  client: "Client",
  noComment: "Rating without a text comment.",
};

const uk: AgentPublicProfileDictionary = {
  ...en,
  agentProfile: "Профіль агента з нерухомості",
  ownerProfile: "Профіль власника",
  defaultUser: "Користувач",
  office: "Офіс",
  agentOffers: "Оголошення агента",
  userOffers: "Оголошення",
  noAgentReviews: "У цього агента ще немає відгуків клієнтів.",
  noUserReviews: "У цього користувача ще немає відгуків.",
  client: "Клієнт",
  noComment: "Оцінка без текстового коментаря.",
};

export function getAgentPublicProfileDictionary(locale: Locale): AgentPublicProfileDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
