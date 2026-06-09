/**
 * Etykiety ofert na WWW — bez surowych ENUMów (FLAT, READY, …) w UI.
 */

import type { Locale } from "@/i18n/config";

export type OfferConditionKey =
  | "READY"
  | "DEVELOPER"
  | "TO_RENOVATION"
  | "NEW"
  | "VERY_GOOD"
  | "GOOD"
  | "RENOVATION"
  | "NOT_APPLICABLE";

const CONDITION_ALIASES: Record<string, OfferConditionKey> = {
  NEEDS_RENOVATION: "TO_RENOVATION",
  DEVELOPER_STATE: "DEVELOPER",
  DEVELOPER_FINISH: "DEVELOPER",
  MOVE_IN_READY: "READY",
  MOVE_IN: "READY",
  FINISHED: "READY",
  RENOVATION: "TO_RENOVATION",
  TO_RENOVATE: "TO_RENOVATION",
  FOR_RENOVATION: "TO_RENOVATION",
};

const CONDITION_LABELS_PL: Record<OfferConditionKey, string> = {
  READY: "Gotowe do wprowadzenia",
  DEVELOPER: "Stan deweloperski",
  TO_RENOVATION: "Do remontu",
  NEW: "Nowe",
  VERY_GOOD: "Bardzo dobry",
  GOOD: "Dobry",
  RENOVATION: "Do remontu",
  NOT_APPLICABLE: "—",
};

const CONDITION_LABELS_EN: Record<OfferConditionKey, string> = {
  READY: "Move-in ready",
  DEVELOPER: "Developer standard",
  TO_RENOVATION: "Needs renovation",
  NEW: "New",
  VERY_GOOD: "Very good",
  GOOD: "Good",
  RENOVATION: "Needs renovation",
  NOT_APPLICABLE: "—",
};

export function normalizeOfferCondition(raw: unknown): OfferConditionKey | null {
  const normalized = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (CONDITION_ALIASES[normalized]) return CONDITION_ALIASES[normalized];
  if (normalized in CONDITION_LABELS_PL) return normalized as OfferConditionKey;
  return null;
}

export function formatOfferCondition(
  raw: unknown,
  locale: Locale = "pl",
): string | null {
  const key = normalizeOfferCondition(raw);
  if (!key) {
    const leftover = String(raw ?? "").trim();
    if (!leftover) return null;
    const upper = leftover.toUpperCase();
    if (upper === leftover && /^[A-Z_]+$/.test(upper)) return null;
    return leftover;
  }
  return locale === "en" || locale === "uk" ? CONDITION_LABELS_EN[key] : CONDITION_LABELS_PL[key];
}

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  FLAT: "FLAT",
  APARTMENT: "FLAT",
  STUDIO: "FLAT",
  MIESZKANIE: "FLAT",
  HOUSE: "HOUSE",
  DOM: "HOUSE",
  PLOT: "PLOT",
  LAND: "PLOT",
  DZIAŁKA: "PLOT",
  DZIALKA: "PLOT",
  COMMERCIAL: "COMMERCIAL",
  PREMISES: "COMMERCIAL",
  OFFICE: "COMMERCIAL",
  RETAIL: "COMMERCIAL",
  LOKAL: "COMMERCIAL",
};

const PROPERTY_TYPE_LABELS_PL: Record<string, string> = {
  FLAT: "Mieszkanie",
  HOUSE: "Dom",
  PLOT: "Działka",
  COMMERCIAL: "Lokal użytkowy",
};

const PROPERTY_TYPE_LABELS_EN: Record<string, string> = {
  FLAT: "Apartment",
  HOUSE: "House",
  PLOT: "Plot",
  COMMERCIAL: "Commercial unit",
};

export function normalizeOfferPropertyType(raw: unknown): string | null {
  const normalized = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  return PROPERTY_TYPE_ALIASES[normalized] ?? (normalized in PROPERTY_TYPE_LABELS_PL ? normalized : null);
}

export function formatOfferPropertyType(
  raw: unknown,
  locale: Locale = "pl",
): string | null {
  const canon = normalizeOfferPropertyType(raw);
  if (!canon) {
    const leftover = String(raw ?? "").trim();
    if (!leftover) return null;
    const upper = leftover.toUpperCase();
    if (upper === leftover && /^[A-Z_]+$/.test(upper)) return null;
    return leftover;
  }
  const map = locale === "en" || locale === "uk" ? PROPERTY_TYPE_LABELS_EN : PROPERTY_TYPE_LABELS_PL;
  return map[canon] ?? null;
}

/** Rok budowy z różnych nazw pól API (mobile: yearBuilt, WWW form: buildYear). */
export function resolveOfferBuildYear(raw: Record<string, unknown> | null | undefined): number | null {
  if (!raw) return null;
  for (const key of ["yearBuilt", "buildYear", "year"]) {
    const v = raw[key];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

export function formatOfferBuildYear(raw: Record<string, unknown> | null | undefined): string | null {
  const y = resolveOfferBuildYear(raw);
  return y ? String(y) : null;
}
