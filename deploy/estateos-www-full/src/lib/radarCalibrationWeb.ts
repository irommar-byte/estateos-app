import type { RadarPreferenceDto } from '@/lib/radarPreferenceShape';

/** Pola kalibracji radaru — parity z `RadarCalibrationModal` (aplikacja mobilna). */
export type WebRadarFilters = {
  calibrationMode: 'MAP' | 'CITY';
  transactionType: 'RENT' | 'SELL';
  propertyType: string;
  city: string;
  selectedDistricts: string[];
  maxPrice: number;
  minArea: number;
  minYear: number;
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  requireTwoLevel: boolean;
  pushNotifications: boolean;
  matchThreshold: number;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
};

export function defaultWebRadarFilters(city = 'Warszawa'): WebRadarFilters {
  return {
    calibrationMode: 'CITY',
    transactionType: 'SELL',
    propertyType: 'FLAT',
    city,
    selectedDistricts: [],
    maxPrice: 0,
    minArea: 0,
    minYear: 1900,
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
    pushNotifications: true,
    matchThreshold: 70,
    lat: null,
    lng: null,
    radiusKm: null,
  };
}

export function radarIntelligenceLabel(threshold: number): { title: string; desc: string; color: string } {
  const t = Math.max(50, Math.min(100, threshold));
  if (t >= 90) {
    return {
      title: 'Snajperski',
      desc: 'Tylko niemal idealne dopasowania — mniej alertów, wyższa precyzja.',
      color: '#a78bfa',
    };
  }
  if (t >= 75) {
    return {
      title: 'Wyselekcjonowany',
      desc: 'Silne dopasowanie lokalizacji, budżetu i parametrów.',
      color: '#10b981',
    };
  }
  if (t >= 60) {
    return {
      title: 'Zbalansowany',
      desc: 'Równowaga między liczbą alertów a trafnością.',
      color: '#38bdf8',
    };
  }
  return {
    title: 'Szeroki zasięg',
    desc: 'Więcej propozycji — niższy próg dopasowania.',
    color: '#f59e0b',
  };
}

function legacyTransactionToMobile(raw: string | null | undefined): 'RENT' | 'SELL' {
  const v = String(raw || '').toLowerCase();
  if (v === 'rent' || v === 'wynajem') return 'RENT';
  return 'SELL';
}

function mobileTransactionToLegacy(tx: 'RENT' | 'SELL'): 'all' | 'sale' | 'rent' {
  if (tx === 'RENT') return 'rent';
  return 'sale';
}

export function webRadarFiltersFromPreference(
  pref: RadarPreferenceDto | null | undefined,
  legacy?: {
    searchDistricts?: string | null;
    searchMaxPrice?: number | null;
    searchAreaFrom?: number | null;
    searchRooms?: number | null;
    searchTransactionType?: string | null;
    searchAmenities?: string | null;
  },
  fallbackCity = 'Warszawa',
): WebRadarFilters {
  const base = defaultWebRadarFilters(fallbackCity);
  if (!pref && !legacy) return base;

  const districts =
    pref?.selectedDistricts?.length
      ? pref.selectedDistricts
      : String(legacy?.searchDistricts || '')
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);

  const hasMap =
    pref?.lat != null &&
    pref?.lng != null &&
    pref?.radius != null &&
    Number(pref.radius) > 0;

  const amenities = String(legacy?.searchAmenities || '').toLowerCase();

  return {
    ...base,
    calibrationMode: hasMap ? 'MAP' : 'CITY',
    transactionType:
      pref?.transactionType === 'RENT' || pref?.transactionType === 'SELL'
        ? pref.transactionType
        : legacyTransactionToMobile(legacy?.searchTransactionType),
    propertyType: pref?.propertyType || base.propertyType,
    city: pref?.city || fallbackCity,
    selectedDistricts: districts,
    maxPrice: pref?.maxPrice ?? legacy?.searchMaxPrice ?? 0,
    minArea: pref?.minArea ?? legacy?.searchAreaFrom ?? 0,
    minYear: pref?.minYear ?? 1900,
    requireBalcony: pref?.requireBalcony ?? amenities.includes('balkon'),
    requireGarden: pref?.requireGarden ?? amenities.includes('ogr'),
    requireElevator: pref?.requireElevator ?? amenities.includes('winda'),
    requireParking: pref?.requireParking ?? amenities.includes('parking'),
    requireFurnished: pref?.requireFurnished ?? amenities.includes('umeblow'),
    requireTwoLevel: pref?.requireTwoLevel ?? amenities.includes('dwupoziom'),
    pushNotifications: pref?.pushNotifications !== false,
    matchThreshold: pref?.minMatchThreshold ?? 70,
    lat: pref?.lat ?? null,
    lng: pref?.lng ?? null,
    radiusKm: pref?.radius ?? null,
  };
}

export function buildRadarPreferencesPostBody(userId: number, filters: WebRadarFilters) {
  return {
    userId,
    transactionType: filters.transactionType,
    propertyType: filters.propertyType === 'ALL' ? null : filters.propertyType,
    city: filters.city,
    selectedDistricts: filters.selectedDistricts,
    maxPrice: filters.maxPrice > 0 ? filters.maxPrice : null,
    minArea: filters.minArea > 0 ? filters.minArea : null,
    minYear: filters.minYear > 1900 ? filters.minYear : null,
    requireBalcony: filters.requireBalcony,
    requireGarden: filters.requireGarden,
    requireElevator: filters.requireElevator,
    requireParking: filters.requireParking,
    requireFurnished: filters.requireFurnished,
    requireTwoLevel: filters.requireTwoLevel,
    pushNotifications: filters.pushNotifications,
    minMatchThreshold: filters.matchThreshold,
    lat: filters.calibrationMode === 'MAP' ? filters.lat : null,
    lng: filters.calibrationMode === 'MAP' ? filters.lng : null,
    radius: filters.calibrationMode === 'MAP' ? filters.radiusKm : null,
  };
}

/** Legacy `User.search*` — CRM /api/crm/radar nadal czyta te pola u kupujących. */
export function buildLegacyRadarUpdateBody(filters: WebRadarFilters) {
  const amenities: string[] = [];
  if (filters.requireBalcony) amenities.push('Balkon');
  if (filters.requireGarden) amenities.push('Ogródek');
  if (filters.requireElevator) amenities.push('Winda');
  if (filters.requireParking) amenities.push('Garaż/Miejsce park.');
  if (filters.requireFurnished) amenities.push('Umeblowanie');
  if (filters.requireTwoLevel) amenities.push('Dwupoziomowe');

  return {
    city: filters.city,
    districts: filters.selectedDistricts,
    transactionType: mobileTransactionToLegacy(filters.transactionType),
    maxPrice: filters.maxPrice > 0 ? filters.maxPrice : null,
    areaFrom: filters.minArea > 0 ? filters.minArea : null,
    amenities,
    type: filters.propertyType === 'ALL' ? null : filters.propertyType,
  };
}

export function formatRadarSummary(filters: WebRadarFilters): {
  location: string;
  minArea: string;
  maxBudget: string;
  propertyType: string;
  transactionType: string;
  threshold: string;
} {
  const location =
    filters.calibrationMode === 'MAP' && filters.lat != null && filters.lng != null
      ? `${filters.city || 'Obszar'} · ${filters.radiusKm ?? '?'} km`
      : filters.selectedDistricts.length
        ? `${filters.selectedDistricts.join(', ')} · ${filters.city}`
        : `Całe ${filters.city}`;

  const txLabel =
    filters.transactionType === 'RENT'
      ? 'Wynajem'
      : filters.transactionType === 'SELL'
        ? 'Kupno'
        : '—';

  return {
    location,
    minArea: filters.minArea > 0 ? `Od ${filters.minArea} m²` : 'Dowolny metraż',
    maxBudget:
      filters.maxPrice > 0
        ? `Do ${new Intl.NumberFormat('pl-PL').format(filters.maxPrice)} PLN`
        : 'Bez limitu',
    propertyType:
      filters.propertyType === 'FLAT'
        ? 'Mieszkanie'
        : filters.propertyType === 'HOUSE'
          ? 'Dom'
          : filters.propertyType === 'PLOT'
            ? 'Działka'
            : filters.propertyType === 'COMMERCIAL'
              ? 'Lokal'
              : filters.propertyType || 'Wszystkie',
    transactionType: txLabel,
    threshold: `${filters.matchThreshold}% dopasowania`,
  };
}
