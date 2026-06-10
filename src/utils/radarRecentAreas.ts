import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RadarFilters } from '../components/RadarCalibrationModal';
import {
  localityCountryIso,
  normalizeLocalityCountryLabel,
  REST_OF_COUNTRY_CITY,
} from '../constants/locationEcosystem';
import { t } from '../i18n/translate';
import { flagEmojiFromIso2 } from './phoneRegions';

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
    !f.requireTwoLevel &&
    !f.requireElevator &&
    !f.requireParking &&
    !f.requireFurnished &&
    f.matchThreshold === 100
  );
}

function propertyTypeLabel(code: string): string {
  switch (String(code || '').toUpperCase()) {
    case 'FLAT':
      return t('radar.home.propertyFlat');
    case 'HOUSE':
      return t('radar.home.propertyHouse');
    case 'PLOT':
      return t('radar.home.propertyPlot');
    case 'COMMERCIAL':
    case 'PREMISES':
      return t('radar.home.propertyPremises');
    case 'ALL':
    default:
      return t('radar.home.propertyAny');
  }
}

function formatPriceShort(n: number, transactionType: 'RENT' | 'SELL'): string {
  const cap = transactionType === 'RENT' ? 50000 : 5_000_000;
  if (n >= cap) return t('radar.home.scope.noPriceLimit');
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return t('radar.home.scope.priceToMillion', { value: m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '') });
  }
  if (n >= 1000) return t('radar.home.scope.priceToThousand', { value: String(Math.round(n / 1000)) });
  return t('radar.home.scope.priceToPln', { value: String(n) });
}

function effectiveMapRadiusKm(baseRadiusKm: number, matchThreshold: number): number {
  const t = Math.max(50, Math.min(100, matchThreshold));
  const relax = Math.max(0, Math.min(1, (100 - t) / 50));
  return baseRadiusKm * (1 + relax);
}

/** Jedna linia pod „Status: LIVE" na mapie — gdzie i czego szuka radar. */
export function buildRadarActiveScopeLine(
  filters: RadarFilters,
  mapBounds: RadarRecentMapBounds | null,
): string {
  const country = normalizeLocalityCountryLabel(filters.localityCountry);
  const flag = flagEmojiFromIso2(localityCountryIso(filters.localityCountryCode, country));
  const cityRaw = String(filters.city || '').trim() || 'Polska';
  const cityLabel =
    cityRaw === REST_OF_COUNTRY_CITY && filters.selectedDistricts.length > 0
      ? filters.selectedDistricts[0]
      : cityRaw;

  let where: string;
  if (filters.calibrationMode === 'MAP' && mapBounds) {
    const km = effectiveMapRadiusKm(mapBounds.radiusKm, filters.matchThreshold)
      .toFixed(1)
      .replace('.', ',');
    where = t('radar.home.scope.areaKm', { city: cityLabel, flag, km });
  } else if (filters.selectedDistricts.length === 1) {
    where = t('radar.home.scope.singleDistrict', { city: cityLabel, flag, district: filters.selectedDistricts[0] });
  } else if (filters.selectedDistricts.length > 1) {
    where = t('radar.home.scope.multiDistrict', { city: cityLabel, flag, count: String(filters.selectedDistricts.length) });
  } else {
    where = t('radar.home.scope.wholeCity', { city: cityLabel, flag });
  }

  const trans = filters.transactionType === 'RENT' ? t('radar.home.transactionRentShort') : t('radar.home.transactionSellShort');
  return t('radar.home.scope.line', { where, transaction: trans, propertyType: propertyTypeLabel(filters.propertyType) });
}

export function buildRadarRecentLabels(
  filters: RadarFilters,
  mapBounds: RadarRecentMapBounds | null
): { title: string; subtitle: string } {
  const trans = filters.transactionType === 'RENT' ? t('radar.home.transactionRentShort') : t('radar.home.transactionSellShort');
  let title: string;
  if (filters.calibrationMode === 'MAP' && mapBounds) {
    title = t('radar.home.scope.recentMapTitle', { city: filters.city, radius: mapBounds.radiusKm.toFixed(1) });
  } else if (filters.selectedDistricts.length > 0) {
    title = t('radar.home.scope.recentCityDistricts', { city: filters.city, count: String(filters.selectedDistricts.length) });
  } else {
    title = t('radar.home.scope.recentWholeCity', { city: filters.city });
  }

  const parts: string[] = [
    trans,
    formatPriceShort(filters.maxPrice, filters.transactionType),
    t('radar.home.scope.threshold', { value: String(filters.matchThreshold) }),
    propertyTypeLabel(filters.propertyType),
  ];
  if (filters.minArea > 0) parts.push(t('radar.home.scope.minArea', { value: String(filters.minArea) }));
  if (filters.minYear > 1900) parts.push(t('radar.home.scope.minYear', { value: String(filters.minYear) }));

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
      filters.requireTwoLevel,
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
