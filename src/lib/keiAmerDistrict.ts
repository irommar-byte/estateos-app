import { getDistrictsForCity, normalizeText } from '@/lib/location/locationCatalog';

export function normalizeKeiPlaceName(value: string): string {
  return normalizeText(value).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

let sortedWarsawDistricts: string[] | null = null;
function warsawDistricts(): string[] {
  if (!sortedWarsawDistricts) {
    sortedWarsawDistricts = [...getDistrictsForCity('Warszawa')].sort(
      (a, b) => normalizeKeiPlaceName(b).length - normalizeKeiPlaceName(a).length,
    );
  }
  return sortedWarsawDistricts;
}

/**
 * Dzielnica Warszawy z adresu KEI („warszawa, białołęka, żerań”).
 * Dopasowanie po całych słowach — „Ochota” w zdaniu „ochota na kawę” nie liczy się, bo czytamy tylko adres.
 */
export function extractWarsawDistrictFromKeiAddress(address: string): string {
  const raw = String(address || '').trim();
  if (!raw) return '';

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  // Najpierw drugi człon adresu — tam KEI trzyma dzielnicę.
  if (parts.length >= 2) {
    const second = normalizeKeiPlaceName(parts[1]);
    const hit = warsawDistricts().find((district) => normalizeKeiPlaceName(district) === second);
    if (hit) return hit;
  }

  const hay = normalizeKeiPlaceName(raw);
  for (const district of warsawDistricts()) {
    const needle = normalizeKeiPlaceName(district);
    if (!needle) continue;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(hay)) return district;
  }
  return '';
}

/** Czy wiersz KEI jest w Warszawie — po adresie (pierwszy człon), a nie po wzmiance w opisie. */
export function isWarsawAddress(address: string | null | undefined, fallbackText?: string | null): boolean {
  const first = normalizeKeiPlaceName(String(address || '').split(',')[0] || '');
  if (first) return first === 'warszawa' || first.startsWith('warszawa ');
  const hay = normalizeKeiPlaceName(String(fallbackText || ''));
  return /(^|\s)warszawa(\s|$)/.test(hay);
}

export function districtMatches(filter: string, address: string | null | undefined): boolean {
  const wanted = normalizeKeiPlaceName(filter);
  if (!wanted) return true;
  const extracted = extractWarsawDistrictFromKeiAddress(String(address || ''));
  if (extracted) {
    const got = normalizeKeiPlaceName(extracted);
    // „Praga” pasuje do obu Prag, „Praga-Południe” tylko do siebie.
    return got === wanted || got.startsWith(`${wanted} `);
  }
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizeKeiPlaceName(String(address || '')));
}
