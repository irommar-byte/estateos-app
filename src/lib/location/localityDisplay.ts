import { normalizeText } from "@/lib/location/locationCatalog";

/** Czy etykieta wygląda jak adres ulicy (np. „Wesoła 3", „Zamość 13"), a nie miejscowość. */
export function looksLikeStreetAddress(label: unknown): boolean {
  const token = String(label ?? "").trim();
  if (!token) return false;
  if (/^(ul\.?|al\.?|pl\.?|os\.?|ulica|aleja|plac|osiedle)\s/i.test(token)) return true;
  return /\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:\/\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/u.test(token);
}

/** Czy token to ta sama ulica co w hintcie (np. „Zamość" vs „Zamość 13"). */
export function tokenMatchesStreetHint(token: unknown, streetHint: unknown): boolean {
  const normToken = normalizeText(String(token ?? ""));
  if (!normToken) return false;
  const street = String(streetHint ?? "").trim();
  const streetName = normalizeText(street.split(/\s+\d/)[0] || street);
  const streetFull = normalizeText(street);
  if (!streetName && !streetFull) return false;
  return (
    normToken === streetName ||
    normToken === streetFull ||
    streetFull.startsWith(`${normToken} `) ||
    streetName.startsWith(normToken) ||
    normToken.startsWith(streetName)
  );
}

/** Dla miast spoza listy strict — usuwa ulicę i duplikaty miasta z pola obszaru. */
export function sanitizeNonStrictAreaLabel(
  raw: unknown,
  city: unknown,
  streetHint?: unknown,
): string {
  const token = String(raw ?? "").trim();
  if (!token) return "";
  const cityNorm = normalizeText(String(city ?? ""));
  const tokenNorm = normalizeText(token);
  if (!tokenNorm) return "";
  if (cityNorm && tokenNorm === cityNorm) return "";
  if (looksLikeStreetAddress(token)) return "";
  if (streetHint && tokenMatchesStreetHint(token, streetHint)) return "";
  if (/^(powiat|gmina|województwo)\s/i.test(token)) return "";
  return token;
}

export function flagEmojiFromIso2(iso2: unknown): string {
  const code = String(iso2 ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (code.length !== 2) return "🏳️";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65,
  );
}
