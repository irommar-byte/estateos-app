import type { Locale } from "./config";

export type PressKitDictionary = {
  eyebrow: string;
  title: string;
  subtitle: string;
  officialLinks: string;
  copy: string;
  copied: string;
  socialPosts: string;
  pressBlurb: string;
  aiInstruction: string;
  appBadges: string;
};

const pl: PressKitDictionary = {
  eyebrow: "Press kit",
  title: "EstateOS™ — materiały do promocji",
  subtitle:
    "Gotowe teksty, linki kampanii i fakty o produkcie. Kopiuj i wklejaj na LinkedIn, Facebook, w mailach do agencji lub w zapytaniach prasowych.",
  officialLinks: "Oficjalne linki",
  copy: "Kopiuj",
  copied: "Skopiowano",
  socialPosts: "Gotowe posty",
  pressBlurb: "Opis prasowy",
  aiInstruction: "Instrukcja dla asystentów AI",
  appBadges: "Aplikacja mobilna",
};

const en: PressKitDictionary = {
  ...pl,
  title: "EstateOS™ — promotion materials",
  subtitle:
    "Ready texts, campaign links, and product facts. Copy and paste on LinkedIn, Facebook, agency emails, or press inquiries.",
  officialLinks: "Official links",
  copy: "Copy",
  copied: "Copied",
  socialPosts: "Ready posts",
  pressBlurb: "Press blurb",
  aiInstruction: "AI assistant instruction",
  appBadges: "Mobile app",
};

const uk: PressKitDictionary = {
  ...en,
  title: "EstateOS™ — матеріали для промоції",
  subtitle:
    "Готові тексти, посилання кампанії та факти про продукт. Копіюйте в LinkedIn, Facebook, листи агентствам або прес-запити.",
  officialLinks: "Офіційні посилання",
  copy: "Копіювати",
  copied: "Скопійовано",
  socialPosts: "Готові пости",
  pressBlurb: "Прес-опис",
  aiInstruction: "Інструкція для AI-асистентів",
  appBadges: "Мобільний застосунок",
};

export function getPressKitDictionary(locale: Locale): PressKitDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
