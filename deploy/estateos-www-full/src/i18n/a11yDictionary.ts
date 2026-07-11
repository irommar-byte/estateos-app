import type { Locale } from "./config";

export type A11yDictionary = {
  skipToContent: string;
};

const pl: A11yDictionary = { skipToContent: "Przejdź do treści" };
const en: A11yDictionary = { skipToContent: "Skip to content" };
const uk: A11yDictionary = { skipToContent: "Перейти до змісту" };

export function getA11yDictionary(locale: Locale): A11yDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
