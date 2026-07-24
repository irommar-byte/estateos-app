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

/** Dzielnica tylko gdy to prawdziwa nazwa — inaczej pusty string. */
export function sanitizePublicDistrict(district: unknown, city?: unknown): string {
  const districtLabel = String(district || '').trim();
  const cityLabel = String(city || '').trim();
  if (isGenericDistrictLabel(districtLabel)) return '';
  if (cityLabel && districtLabel.toLowerCase() === cityLabel.toLowerCase()) return '';
  return districtLabel;
}

/** Lokalizacja do share / OG / wizytówki — bez „Inny obszar”. */
export function formatPublicOfferLocation(city: unknown, district?: unknown): string {
  const cityLabel = String(city || '').trim();
  const districtLabel = sanitizePublicDistrict(district, cityLabel);
  if (cityLabel && districtLabel) {
    return `${districtLabel}, ${cityLabel}`;
  }
  return cityLabel || 'Polska';
}

/** Linia adresu: ulica + dzielnica (jeśli sensowna) + miasto. */
export function formatPublicAddressLine(parts: {
  street?: unknown;
  district?: unknown;
  city?: unknown;
}): string {
  const street = String(parts.street || '').trim();
  const cityLabel = String(parts.city || '').trim();
  const districtLabel = sanitizePublicDistrict(parts.district, cityLabel);
  return [street, districtLabel, cityLabel].filter(Boolean).join(', ');
}
