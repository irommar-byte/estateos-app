export const RENT_ADDITIONAL_FEE_STEP = 50;
export const RENT_ADDITIONAL_FEE_MAX = 10_000;

export function buildRentAdditionalFeeSelectOptions(): number[] {
  const values: number[] = [0];
  for (let v = RENT_ADDITIONAL_FEE_STEP; v <= RENT_ADDITIONAL_FEE_MAX; v += RENT_ADDITIONAL_FEE_STEP) {
    values.push(v);
  }
  return values;
}

export function parseRentAdditionalFeeForApi(raw: unknown): number | null {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(RENT_ADDITIONAL_FEE_MAX, Math.round(n));
}
