/** Najstarszy rok budowy akceptowany w formularzach oferty. */
export const OFFER_YEAR_BUILT_MIN = 1850;

export function buildYearBuiltSelectOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= OFFER_YEAR_BUILT_MIN; y -= 1) {
    years.push(String(y));
  }
  return years;
}

export function isValidOfferYearBuilt(raw: unknown): boolean {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return false;
  return n >= OFFER_YEAR_BUILT_MIN && n <= new Date().getFullYear() + 2;
}
