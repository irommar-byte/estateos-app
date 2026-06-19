/** Pełny numer KW (PL): 4 znaki alfanum. / 8 cyfr / 1 cyfra kontrolna — np. WA1M/00012345/9 */
export const KW_FULL_REGEX = /^[A-Z]{2}[0-9A-Z]{2}\/[0-9]{8}\/[0-9]$/;

const KW_SANITIZE_REGEX = /[^A-Za-z0-9/]/g;

/**
 * Formatuje wpis KW — segmenty po ukośnikach, żeby nie gubić cyfr (stary slice(4,12) ucinał przez „/”).
 */
export function normalizeLandRegistryInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(KW_SANITIZE_REGEX, "");
  const parts = cleaned.split("/").filter((_, i, arr) => i < 3 || arr.length <= 3);

  let head = (parts[0] ?? "").replace(/[^A-Z0-9]/g, "").slice(0, 4);
  let middle = (parts[1] ?? "").replace(/[^0-9]/g, "").slice(0, 8);
  let tail = (parts[2] ?? "").replace(/[^0-9]/g, "").slice(0, 1);

  if (parts.length === 1 && !cleaned.includes("/") && cleaned.length > 4) {
    const compact = cleaned.replace(/[^A-Z0-9]/g, "");
    head = compact.slice(0, 4);
    middle = compact.slice(4, 12).replace(/[^0-9]/g, "").slice(0, 8);
    tail = compact.slice(12, 13).replace(/[^0-9]/g, "").slice(0, 1);
  }

  if (!middle) {
    if (parts.length >= 2 || cleaned.endsWith("/")) return `${head}/`;
    return head;
  }
  if (!tail) {
    if (parts.length >= 3 || cleaned.endsWith("/")) return `${head}/${middle}/`;
    return `${head}/${middle}`;
  }
  return `${head}/${middle}/${tail}`;
}

export function isValidLandRegistryNumber(value: unknown): boolean {
  const normalized = normalizeLandRegistryInput(String(value ?? ""));
  if (!normalized) return true;
  return KW_FULL_REGEX.test(normalized);
}
