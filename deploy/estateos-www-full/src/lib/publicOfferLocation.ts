/**
 * Etykiety dzielnicy/obszaru, których nie pokazujemy publicznie
 * (brzmią jak placeholder, nie jak poważna lokalizacja).
 */
const GENERIC_DISTRICT_RE =
  /^(inny obszar|other|inne|og[oó]lna|ogolna|brak|n\/a|pozostałe|pozostale|-|—)$/i;

export function isGenericDistrictLabel(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (!raw) return true;
  return GENERIC_DISTRICT_RE.test(raw);
}

/** Lokalizacja do share / OG / wizytówki — bez „Inny obszar”. */
export function formatPublicOfferLocation(city: unknown, district?: unknown): string {
  const cityLabel = String(city || '').trim();
  const districtLabel = String(district || '').trim();
  if (cityLabel && !isGenericDistrictLabel(districtLabel) && districtLabel.toLowerCase() !== cityLabel.toLowerCase()) {
    return `${districtLabel}, ${cityLabel}`;
  }
  return cityLabel || 'Polska';
}
