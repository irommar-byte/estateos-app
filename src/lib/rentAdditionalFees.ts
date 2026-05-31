/** Opłaty dodatkowe przy wynajmie (czynsz do wspólnoty / admin) — bęben w kreatorze. */
export const RENT_ADDITIONAL_FEE_STEP = 50;
export const RENT_ADDITIONAL_FEE_MAX = 10_000;

/** Wartości bębna: '' = brak, potem 50…10000 co 50 PLN. */
export function buildRentAdditionalFeePickerValues(): string[] {
  const values = [''];
  for (let v = RENT_ADDITIONAL_FEE_STEP; v <= RENT_ADDITIONAL_FEE_MAX; v += RENT_ADDITIONAL_FEE_STEP) {
    values.push(String(v));
  }
  return values;
}

export function parseRentAdditionalFeeForApi(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(RENT_ADDITIONAL_FEE_MAX, Math.round(n));
}
