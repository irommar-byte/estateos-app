import type { Locale } from "@/i18n/config";
import {
  formatCarMileageLocalized,
  formatCarPriceLocalized,
  getCarSortOptions,
  type CarsDictionary,
} from "@/i18n/carsDictionary";

export type CarSortKey = "newest" | "price-asc" | "price-desc" | "year-desc" | "mileage-asc";

/** @deprecated Use getCarSortOptions(locale) */
export const CAR_SORT_OPTIONS = getCarSortOptions("pl");

export function getCarSortOptionsForLocale(locale: Locale) {
  return getCarSortOptions(locale);
}

export function formatCarPrice(price: number, locale: Locale = "pl"): string {
  return formatCarPriceLocalized(price, locale);
}

export function formatMileage(km: number, locale: Locale = "pl"): string {
  return formatCarMileageLocalized(km, locale);
}

export function carImageSrc(imageUrl?: string | null): string {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) {
    return "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80";
  }
  return trimmed;
}

export function sortCarListings<T extends { pricePln: number; year: number; mileageKm: number; createdAt?: string }>(
  rows: T[],
  sort: CarSortKey,
): T[] {
  const copy = [...rows];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.pricePln - b.pricePln);
    case "price-desc":
      return copy.sort((a, b) => b.pricePln - a.pricePln);
    case "year-desc":
      return copy.sort((a, b) => b.year - a.year);
    case "mileage-asc":
      return copy.sort((a, b) => a.mileageKm - b.mileageKm);
    case "newest":
    default:
      return copy.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
  }
}

export function buildCarInquiryMessage(
  input: {
    carTitle: string;
    make: string;
    model: string;
    year: number;
    pricePln: number;
    city: string;
    viewingPreference: string;
    userMessage: string;
    phone?: string;
    carUrl: string;
  },
  locale: Locale = "pl",
): string {
  const lines = [
    locale === "uk"
      ? "Запит про оголошення EstateOS™Car"
      : locale === "en"
        ? "EstateOS™Car listing inquiry"
        : "Zapytanie o ogłoszenie EstateOS™Car",
    "",
    locale === "uk"
      ? `Авто: ${input.carTitle}`
      : locale === "en"
        ? `Vehicle: ${input.carTitle}`
        : `Pojazd: ${input.carTitle}`,
    `${input.make} ${input.model} · ${input.year}`,
    `${locale === "uk" ? "Ціна" : locale === "en" ? "Price" : "Cena"}: ${formatCarPrice(input.pricePln, locale)}`,
    `${locale === "uk" ? "Локація" : locale === "en" ? "Location" : "Lokalizacja"}: ${input.city}`,
    `Link: ${input.carUrl}`,
    "",
    `${locale === "uk" ? "Бажаний час огляду" : locale === "en" ? "Preferred viewing" : "Preferowany termin oględzin"}: ${input.viewingPreference}`,
  ];
  if (input.phone?.trim()) {
    lines.push(
      `${locale === "uk" ? "Телефон" : locale === "en" ? "Phone" : "Telefon kontaktowy"}: ${input.phone.trim()}`,
    );
  }
  lines.push("", locale === "uk" ? "Повідомлення:" : locale === "en" ? "Message:" : "Wiadomość:", input.userMessage.trim());
  return lines.join("\n");
}

export type { CarsDictionary };
