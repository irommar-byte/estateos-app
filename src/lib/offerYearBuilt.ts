/** Najstarszy rok budowy akceptowany w kreatorze i edycji oferty. */
export const OFFER_YEAR_BUILT_MIN = 1850;

/** Lata od bieżącego w dół do OFFER_YEAR_BUILT_MIN (pusta wartość = brak wyboru). */
export function buildYearBuiltPickerValues(): string[] {
  const current = new Date().getFullYear();
  const years = [''];
  for (let y = current; y >= OFFER_YEAR_BUILT_MIN; y -= 1) {
    years.push(String(y));
  }
  return years;
}

export function isValidOfferYearBuilt(raw: unknown): boolean {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) return false;
  return n >= OFFER_YEAR_BUILT_MIN && n <= new Date().getFullYear() + 2;
}
