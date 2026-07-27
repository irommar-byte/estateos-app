import { formatOfferPropertyType } from "@/lib/offerDisplayLabels";
import type { Locale } from "@/i18n/config";

/** Human labels for Discovery / Inteligence UI — never show raw enums like FLAT. */

const REASON_LABELS_PL: Record<string, string> = {
  PRICE_TOO_HIGH: "Cena",
  LOCATION_MISMATCH: "Lokalizacja",
  LAYOUT_MISMATCH: "Układ",
  QUALITY_LOW: "Jakość",
};

const TRANSACTION_LABELS_PL: Record<string, string> = {
  SELL: "Sprzedaż",
  RENT: "Wynajem",
  MIXED: "Sprzedaż i wynajem",
  SALE: "Sprzedaż",
  BUY: "Kupno",
};

const EVENT_LABELS_PL: Record<string, string> = {
  DISCOVERY_LIKE: "Pasuje",
  DISCOVERY_DISLIKE: "Nie dla mnie",
  DISCOVERY_PRIORITY: "Na poważnie",
  DISCOVERY_DEPTH_OPEN: "Otwarto",
  LIKE: "Pasuje",
  DISLIKE: "Nie dla mnie",
  SERIOUS: "Na poważnie",
  OPEN: "Otwarto",
};

export function discoveryPropertyTypeLabel(raw: unknown, locale: Locale = "pl"): string | null {
  const labeled = formatOfferPropertyType(raw, locale);
  if (labeled) return labeled;
  const key = String(raw ?? "").trim();
  if (!key) return null;
  if (/^[A-Z][A-Z0-9_]*$/.test(key)) return null;
  return key;
}

export function discoveryReasonLabel(raw: unknown): string | null {
  const key = String(raw ?? "").trim();
  if (!key) return null;
  return REASON_LABELS_PL[key] || REASON_LABELS_PL[key.toUpperCase()] || null;
}

export function discoveryTransactionLabel(raw: unknown): string | null {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) return null;
  return TRANSACTION_LABELS_PL[key] || null;
}

export function discoveryEventLabel(raw: unknown): string | null {
  const key = String(raw ?? "").trim();
  if (!key) return null;
  return EVENT_LABELS_PL[key] || EVENT_LABELS_PL[key.toUpperCase()] || null;
}

/**
 * Best-effort label for any Discovery stat / enum key shown in UI.
 * Prefer typed helpers when the domain is known.
 */
export function discoveryDisplayLabel(raw: unknown, locale: Locale = "pl"): string {
  const key = String(raw ?? "").trim();
  if (!key) return "";

  const asType = discoveryPropertyTypeLabel(key, locale);
  if (asType) return asType;

  const asReason = discoveryReasonLabel(key);
  if (asReason) return asReason;

  const asTx = discoveryTransactionLabel(key);
  if (asTx) return asTx;

  const asEvent = discoveryEventLabel(key);
  if (asEvent) return asEvent;

  // Screaming enum with no mapping — never dump it raw
  if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
    return key
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return key;
}
