import type { Locale } from "./config";
import { getDictionary } from "./dictionaries";

export type PulseTickerItem = {
  id: number;
  city: string | null;
  propertyType: string | null;
  transactionType: string | null;
  at: string;
};

export function formatPulseTicker(item: PulseTickerItem, locale: Locale): string {
  const dict = getDictionary(locale);

  if (item.id === 0 && !item.city && !item.propertyType && !item.transactionType) {
    return dict.pulse.delayedTicker;
  }

  const city =
    item.city?.trim() ||
    (locale === "pl" ? "globalny rynek" : "global market");
  const rent = String(item.transactionType ?? "").toUpperCase() === "RENT";

  if (locale === "pl") {
    const tx = rent ? "wynajem" : "sprzedaż";
    return `Nowa oferta · ${tx} · ${city}`;
  }

  const tx = rent ? "lease" : "listing";
  return `New listing · ${tx} · ${city}`;
}
