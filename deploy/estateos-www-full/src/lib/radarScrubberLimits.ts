/** Limity suwaków radaru — zgodne z aplikacją mobilną. */
export const RADAR_MIN_AREA = 10;
export const RADAR_MAX_AREA = 250;
export const RADAR_MIN_YEAR = 1900;
export const RADAR_MAX_YEAR = new Date().getFullYear();
export const RADAR_MIN_BUDGET = 50_000;
export const RADAR_MAX_BUDGET = 15_000_000;

export function formatRadarYearLabel(year: number): string {
  if (!year || year <= RADAR_MIN_YEAR) return "Dowolny rok";
  return `od ${year} r.`;
}

export function formatRadarAreaLabel(area: number): string {
  if (!area || area <= 0) return "Dowolna powierzchnia";
  return `od ${area} m²`;
}

export function formatRadarBudgetLabel(price: number): string {
  if (!price || price <= 0) return "Bez limitu";
  return `${Math.round(price).toLocaleString("pl-PL")} PLN`;
}
