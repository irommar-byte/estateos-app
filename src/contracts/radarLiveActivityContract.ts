export type RadarLiveActivityTransactionType = 'SELL' | 'RENT';

/**
 * Migawka konfiguracji radaru wyświetlana w Live Activity (lock screen / Dynamic Island)
 * oraz w sticky-notification fallbacku. Pola opisują pełny stan kalibracji,
 * by użytkownik na ekranie blokady widział, co radar śledzi w tej chwili.
 */
export interface RadarLiveActivitySnapshot {
  enabled: boolean;
  transactionType: RadarLiveActivityTransactionType;
  /** Zwykle nazwa miasta z kalibracji (np. „Warszawa"). */
  city: string;
  /** Lista wybranych dzielnic / obszarów; pusta = całe miasto. */
  districts: string[];
  /** Typ nieruchomości: FLAT, HOUSE, PLOT, PREMISES, ALL. */
  propertyType: string;
  /** Górny limit ceny w PLN. `null` = bez limitu. */
  maxPrice: number | null;
  /** Minimalny metraż w m². `null` = bez minimum. */
  minArea: number | null;
  /** Najstarszy akceptowany rok budowy. `null` = bez limitu. */
  minYear: number | null;
  /** Promień zaznaczonego obszaru na mapie (km). `null` = brak obszaru. */
  areaRadiusKm: number | null;
  /** Próg dopasowania (50–100%). */
  minMatchThreshold: number;
  /** Liczba ofert aktualnie spełniających kryteria radaru. */
  activeMatchesCount: number;
  /**
   * Liczba dopasowań, których użytkownik jeszcze nie widział od ostatniego
   * wejścia na zakładkę „Radar". Pokazujemy je w widgetcie jako „NOWE! N",
   * resztę traktujemy jako już oglądnięte i pomijamy w prezentacji.
   */
  newMatchesCount: number;
  /** Nieprzeczytane wiadomości w Dealroomach. */
  unreadDealroomMessagesCount: number;
  /** Wymagania udogodnień (true = wymagane). */
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  updatedAtIso: string;
}

const clampThreshold = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(50, Math.min(100, Math.round(parsed)));
};

const normalizeTransactionType = (value: unknown): RadarLiveActivityTransactionType =>
  String(value).toUpperCase() === 'RENT' ? 'RENT' : 'SELL';

const normalizeCity = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > 0 ? raw : 'Warszawa';
};

const normalizeMatches = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
};

const normalizeDistricts = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
    if (cleaned.length >= 12) break; // chronimy payload Live Activity (max 4 KB)
  }
  return cleaned;
};

const normalizePropertyType = (value: unknown): string => {
  const raw = String(value || '').toUpperCase().trim();
  return raw || 'ALL';
};

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeBool = (value: unknown): boolean => value === true;

export const buildRadarLiveActivitySnapshot = (input: Partial<RadarLiveActivitySnapshot>): RadarLiveActivitySnapshot => ({
  enabled: input.enabled === true,
  transactionType: normalizeTransactionType(input.transactionType),
  city: normalizeCity(input.city),
  districts: normalizeDistricts(input.districts),
  propertyType: normalizePropertyType(input.propertyType),
  maxPrice: normalizeOptionalNumber(input.maxPrice),
  minArea: normalizeOptionalNumber(input.minArea),
  minYear: normalizeOptionalNumber(input.minYear),
  areaRadiusKm: normalizeOptionalNumber(input.areaRadiusKm),
  minMatchThreshold: clampThreshold(input.minMatchThreshold),
  activeMatchesCount: normalizeMatches(input.activeMatchesCount),
  newMatchesCount: normalizeMatches(input.newMatchesCount),
  unreadDealroomMessagesCount: normalizeMatches(input.unreadDealroomMessagesCount),
  requireBalcony: normalizeBool(input.requireBalcony),
  requireGarden: normalizeBool(input.requireGarden),
  requireElevator: normalizeBool(input.requireElevator),
  requireParking: normalizeBool(input.requireParking),
  requireFurnished: normalizeBool(input.requireFurnished),
  updatedAtIso: typeof input.updatedAtIso === 'string' && input.updatedAtIso.trim().length > 0
    ? input.updatedAtIso
    : new Date().toISOString(),
});

// ============================================================================
// HUMAN-READABLE FORMAT (Apple-style)
// ============================================================================

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  FLAT: 'Mieszkanie',
  HOUSE: 'Dom',
  PLOT: 'Działka',
  PREMISES: 'Lokal użytkowy',
  ALL: 'Dowolny typ',
};

const transactionLabel = (type: RadarLiveActivityTransactionType) =>
  type === 'RENT' ? 'Wynajem' : 'Sprzedaż';

const formatPriceShort = (value: number, type: RadarLiveActivityTransactionType): string => {
  if (type === 'RENT' || value < 100_000) {
    return `${Math.round(value).toLocaleString('pl-PL')} zł`;
  }
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const decimals = millions >= 10 ? 0 : 1;
    return `${millions.toFixed(decimals).replace('.', ',')} mln zł`;
  }
  const thousands = Math.round(value / 1000);
  return `${thousands.toLocaleString('pl-PL')} tys. zł`;
};

const formatDistricts = (districts: string[]): string => {
  if (districts.length === 0) return 'cały obszar';
  if (districts.length <= 2) return districts.join(', ');
  return `${districts.slice(0, 2).join(', ')} +${districts.length - 2}`;
};

/**
 * Zwraca tablicę zwięzłych linii statusowych w stylu Apple (max ~48 znaków),
 * gotowych do tickera w widgetcie i body fallback-notification.
 *
 * Układ docelowy:
 *   1) „Radar aktywny · skan rynku trwa"
 *   2) „{Tryb} · {Miasto} · próg {X}%"
 *   3) „{Typ} · od {X} m² · do {Y} zł · {N} dopasowań"
 *   4) (opcjonalnie) „Dzielnice: …" lub „Obszar mapy: {X} km"
 *   5) (opcjonalnie) „od {YYYY} r."
 *   6) (opcjonalnie) „Wymagania: …"
 *
 * Wszystko, czego użytkownik nie ustawił, jest pomijane.
 */
export const formatRadarLiveActivityLines = (snapshot: RadarLiveActivitySnapshot): string[] => {
  const lines: string[] = ['Radar aktywny · skan rynku trwa'];

  // Linia 2 — tryb · miasto · próg jakości
  lines.push(`${transactionLabel(snapshot.transactionType)} · ${snapshot.city} · próg ${snapshot.minMatchThreshold}%`);

  // Linia 3 (dolna) — typ · od metrażu · do ceny [ · NOWE! N (tylko gdy nowe)]
  // ZASADA: liczbę dopasowań pokazujemy WYŁĄCZNIE, gdy są nowe od ostatniego wejścia
  // na zakładkę Radar. Po obejrzeniu listy znikają — odznaczenie „przeczytane".
  // Dzięki temu lock-screen pełni rolę alertu, a nie statycznego licznika.
  const typeLabel = PROPERTY_TYPE_LABELS[snapshot.propertyType] || 'Dowolny typ';
  const bottomParts: string[] = [typeLabel];
  if (snapshot.minArea != null) bottomParts.push(`od ${Math.round(snapshot.minArea)} m²`);
  if (snapshot.maxPrice != null) bottomParts.push(`do ${formatPriceShort(snapshot.maxPrice, snapshot.transactionType)}`);
  if (snapshot.newMatchesCount > 0) {
    // Prefix „NOWE!" jest sygnałem dla Swift-owego widgetu, że ma stylizować
    // ten segment akcentem (czerwona kapsuła + bold).
    bottomParts.push(`NOWE! ${snapshot.newMatchesCount}`);
  }
  lines.push(bottomParts.join(' · '));

  // Linia 4 — dzielnice albo obszar (jeśli ustawione)
  if (snapshot.areaRadiusKm != null) {
    lines.push(`Obszar mapy: ${snapshot.areaRadiusKm.toFixed(1).replace('.', ',')} km`);
  } else if (snapshot.districts.length > 0) {
    lines.push(`Dzielnice: ${formatDistricts(snapshot.districts)}`);
  }

  // Linia 5 — rok budowy (opcjonalnie)
  if (snapshot.minYear != null) {
    lines.push(`Rok budowy: od ${Math.round(snapshot.minYear)} r.`);
  }

  // Linia 6 — wymagania (opcjonalnie)
  const requirements: string[] = [];
  if (snapshot.requireBalcony) requirements.push('balkon');
  if (snapshot.requireGarden) requirements.push('ogród');
  if (snapshot.requireElevator) requirements.push('winda');
  if (snapshot.requireParking) requirements.push('parking');
  if (snapshot.requireFurnished) requirements.push('umeblowane');
  if (requirements.length > 0) {
    lines.push(`Wymagania: ${requirements.join(', ')}`);
  }

  return lines;
};


export interface RadarLiveActivityPushPayload {
  type: 'RADAR_LIVE_ACTIVITY_UPDATE';
  radar: RadarLiveActivitySnapshot;
}

export const validateRadarLiveActivityPushPayload = (payload: unknown): RadarLiveActivityPushPayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.type !== 'RADAR_LIVE_ACTIVITY_UPDATE') return null;
  if (!p.radar || typeof p.radar !== 'object') return null;

  return {
    type: 'RADAR_LIVE_ACTIVITY_UPDATE',
    radar: buildRadarLiveActivitySnapshot(p.radar as Partial<RadarLiveActivitySnapshot>),
  };
};
