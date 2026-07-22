/** Numer do `tel:` — tylko cyfry i opcjonalny wiodący `+`. */
export function toTelHref(phone: string): string {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const plus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `tel:${plus}${digits}`;
}

/** Czytelny numer do UI (bez zmian formatu konta, tylko trim). */
export function formatDisplayPhone(phone: string): string {
  return String(phone || "").trim();
}
