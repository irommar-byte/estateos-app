/** Wartość w kafelku parametru oferty — pierwsza litera wielka (np. „Miejskie”). */
export function formatParamDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return text;
  if (/^\d/.test(text)) return text;
  if (/\d[\d\s.,]*\s*(m²|pln|zł)/i.test(text)) return text;
  const first = text.charAt(0);
  if (first === first.toLocaleUpperCase("pl-PL")) return text;
  return first.toLocaleUpperCase("pl-PL") + text.slice(1);
}
