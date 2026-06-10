export const LOCALES = ["pl", "en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "estateos_lang";

export const LOCALE_FLAGS: Record<Locale, string> = {
  pl: "🇵🇱",
  en: "🇬🇧",
  uk: "🇺🇦",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "pl" || value === "en" || value === "uk";
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl.NumberFormat / toLocaleString. */
export function numberFormatLocale(locale: Locale): string {
  if (locale === "pl") return "pl-PL";
  if (locale === "uk") return "uk-UA";
  return "en-US";
}
