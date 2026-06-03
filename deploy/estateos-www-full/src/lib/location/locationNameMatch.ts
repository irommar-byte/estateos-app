import { normalizeText } from '@/lib/location/locationCatalog';

const POLAND_COUNTRY_CODES = new Set(['pl', 'pol', 'polska']);

/** Współrzędne poza przybliżoną obwiednią Polski (z buforem). */
export function isOutsidePolandBounds(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat < 49 || lat > 55.5 || lng < 14 || lng > 24.5;
}

export function isInternationalCountryCode(code?: string | null): boolean {
  const norm = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/^country:/, '');
  if (!norm) return false;
  return !POLAND_COUNTRY_CODES.has(norm);
}

/** Ujednolica typowe warianty transliteracji (UA/RU → łacina). */
export function transliterationComparisonKey(value: string): string {
  return normalizeText(value)
    .replace(/kh/g, 'h')
    .replace(/zh/g, 'z')
    .replace(/ts/g, 'c')
    .replace(/w/g, 'v')
    .replace(/y/g, 'i');
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Czy dwie nazwy miejscowości opisują to samo (Vapniarka ≈ Vapnyarka, drobne literówki).
 */
export function locationNamesEquivalent(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ka = transliterationComparisonKey(a);
  const kb = transliterationComparisonKey(b);
  if (ka === kb) return true;

  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }

  const maxLen = Math.max(ka.length, kb.length);
  if (maxLen < 3) return false;

  const distance = levenshteinDistance(ka, kb);
  if (distance <= 1) return true;
  if (maxLen >= 6 && distance <= 2) return true;
  return distance / maxLen <= 0.2;
}
