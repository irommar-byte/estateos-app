/** Wyciąga same cyfry z pola tekstowego (np. "58 000" → "58000"). */
export function parsePlIntegerInput(display: string): string {
  return display.replace(/\D/g, "");
}

/** Formatuje cyfry z separatorem tysięcy pl-PL (np. "58000" → "58 000"). */
export function formatPlIntegerInput(digits: string): string {
  const clean = parsePlIntegerInput(digits);
  if (!clean) return "";
  const n = Number(clean);
  if (!Number.isFinite(n)) return clean;
  return n.toLocaleString("pl-PL");
}
