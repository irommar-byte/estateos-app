import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RadarFilters } from '../components/RadarCalibrationModal';

const STORAGE_KEY = '@estateos_radar_recent_areas_v1';
const MAX_ENTRIES = 3;

export type RadarRecentMapBounds = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

/** Zapis po udanej kalibracji — max. 3 ostatnie, z podpisem miejscowości + parametrów. */
export type RadarRecentSavedArea = {
  savedAtIso: string;
  filters: RadarFilters;
  mapBounds: RadarRecentMapBounds | null;
  title: string;
  subtitle: string;
  areaSummaryLine: string;
};

export function isRadarFactoryDefaults(f: RadarFilters): boolean {
  return (
    f.calibrationMode === 'MAP' &&
    f.transactionType === 'SELL' &&
    f.propertyType === 'ALL' &&
    f.city === 'Warszawa' &&
    f.selectedDistricts.length === 0 &&
    f.maxPrice === 5000000 &&
    f.minArea === 0 &&
    f.minYear === 1900 &&
    !f.requireBalcony &&
    !f.requireGarden &&
    !f.requireElevator &&
    !f.requireParking &&
    !f.requireFurnished &&
    f.matchThreshold === 100
  );
}

function propertyTypeLabel(code: string): string {
  switch (String(code || '').toUpperCase()) {
    case 'FLAT':
      return 'Mieszkanie';
    case 'HOUSE':
      return 'Dom';
    case 'PLOT':
      return 'Działka';
    case 'PREMISES':
      return 'Lokal';
    case 'ALL':
    default:
      return 'Dowolny typ';
  }
}

function formatPriceShort(n: number, transactionType: 'RENT' | 'SELL'): string {
  const cap = transactionType === 'RENT' ? 50000 : 5_000_000;
  if (n >= cap) return 'bez limitu ceny';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `do ${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')} mln`;
  }
  if (n >= 1000) return `do ${Math.round(n / 1000)} tys.`;
  return `do ${n} PLN`;
}

export function buildRadarRecentLabels(
  filters: RadarFilters,
  mapBounds: RadarRecentMapBounds | null
): { title: string; subtitle: string } {
  const trans = filters.transactionType === 'RENT' ? 'Wynajem' : 'Sprzedaż';
  let title: string;
  if (filters.calibrationMode === 'MAP' && mapBounds) {
    title = `${filters.city} · obszar ${mapBounds.radiusKm.toFixed(1)} km`;
  } else if (filters.selectedDistricts.length > 0) {
    title = `${filters.city} · ${filters.selectedDistricts.length} dziel.`;
  } else {
    title = `${filters.city} · całe miasto`;
  }

  const parts: string[] = [
    trans,
    formatPriceShort(filters.maxPrice, filters.transactionType),
    `próg ${filters.matchThreshold}%`,
    propertyTypeLabel(filters.propertyType),
  ];
  if (filters.minArea > 0) parts.push(`min. ${filters.minArea} m²`);
  if (filters.minYear > 1900) parts.push(`od ${filters.minYear} r.`);

  return { title, subtitle: parts.join(' · ') };
}

function fingerprint(filters: RadarFilters, mapBounds: RadarRecentMapBounds | null): string {
  return JSON.stringify({
    m: filters.calibrationMode,
    c: filters.city,
    d: filters.selectedDistricts,
    t: filters.transactionType,
    p: filters.propertyType,
    x: filters.maxPrice,
    a: filters.minArea,
    y: filters.minYear,
    th: filters.matchThreshold,
    req: [
      filters.requireBalcony,
      filters.requireGarden,
      filters.requireElevator,
      filters.requireParking,
      filters.requireFurnished,
    ],
    b: mapBounds,
  });
}

function cloneFilters(f: RadarFilters): RadarFilters {
  return JSON.parse(JSON.stringify(f)) as RadarFilters;
}

export async function loadRadarRecentAreas(): Promise<RadarRecentSavedArea[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RadarRecentSavedArea[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Partial<RadarRecentSavedArea>;
      if (!r.filters || typeof r.savedAtIso !== 'string' || typeof r.title !== 'string') continue;
      out.push({
        savedAtIso: r.savedAtIso,
        filters: cloneFilters(r.filters),
        mapBounds: r.mapBounds ?? null,
        title: r.title,
        subtitle: typeof r.subtitle === 'string' ? r.subtitle : '',
        areaSummaryLine: typeof r.areaSummaryLine === 'string' ? r.areaSummaryLine : '',
      });
      if (out.length >= MAX_ENTRIES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function pushRadarRecentArea(params: {
  filters: RadarFilters;
  mapBounds: RadarRecentMapBounds | null;
  areaSummaryLine: string;
}): Promise<void> {
  const { filters, mapBounds, areaSummaryLine } = params;
  if (isRadarFactoryDefaults(filters)) return;

  const fpNew = fingerprint(filters, mapBounds);
  const labels = buildRadarRecentLabels(filters, mapBounds);
  const entry: RadarRecentSavedArea = {
    savedAtIso: new Date().toISOString(),
    filters: cloneFilters(filters),
    mapBounds: mapBounds ? { ...mapBounds } : null,
    title: labels.title,
    subtitle: labels.subtitle,
    areaSummaryLine: areaSummaryLine || `${labels.title} · ${labels.subtitle}`,
  };

  try {
    const prev = await loadRadarRecentAreas();
    const filtered = prev.filter((e) => fingerprint(e.filters, e.mapBounds) !== fpNew);
    const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}
