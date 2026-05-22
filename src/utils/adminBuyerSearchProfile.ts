/**
 * Profil poszukiwań kupującego — normalizacja danych admin API + podsumowanie na bieżąco.
 */

import { computeBuyerSearchAnalytics } from './buyerSearchAnalytics';

export type { BuyerSearchAnalytics, SearchPatternGroup, DimensionFrequency } from './buyerSearchAnalytics';
export { computeBuyerSearchAnalytics, searchSnapshotFingerprint } from './buyerSearchAnalytics';

export type BuyerSearchSnapshot = {
  id: string;
  savedAtIso: string | null;
  source: 'active' | 'history' | 'advanced';
  title: string;
  subtitle: string;
  params: Record<string, string | number | boolean | string[]>;
  raw: unknown;
};

export type BuyerIntentSummary = {
  headline: string;
  bullets: string[];
  confidence: 'low' | 'medium' | 'high';
  confidenceLabel: string;
  snapshotCount: number;
  historyEventCount: number;
  dominantTransaction: 'RENT' | 'SELL' | null;
  dominantCities: string[];
  probabilityPercent: number;
  probabilityLabel: string;
};

const TX_LABEL: Record<string, string> = {
  RENT: 'wynajmu',
  SELL: 'zakupu (sprzedaż)',
};

const PROP_LABEL: Record<string, string> = {
  FLAT: 'mieszkania',
  HOUSE: 'domu',
  PLOT: 'działki',
  PREMISES: 'lokalu użytkowego',
  ALL: 'nieruchomości (dowolny typ)',
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatPln(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')} mln PLN`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)} tys. PLN`;
  return `${Math.round(n)} PLN`;
}

function formatPriceCap(n: number | null, tx: string): string {
  if (n == null || n <= 0) return 'bez limitu ceny';
  const capRent = 50_000;
  const capSell = 5_000_000;
  const cap = tx === 'RENT' ? capRent : capSell;
  if (n >= cap) return 'bez limitu ceny';
  return `do ${formatPln(n)}`;
}

function amenityLabels(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (row.requireBalcony) out.push('balkon');
  if (row.requireGarden) out.push('ogród');
  if (row.requireElevator) out.push('winda');
  if (row.requireParking) out.push('parking');
  if (row.requireFurnished) out.push('umeblowane');
  return out;
}

function normalizePrefRow(row: Record<string, unknown>, source: BuyerSearchSnapshot['source'], idx: number): BuyerSearchSnapshot | null {
  const tx = String(row.transactionType || row.transaction_type || 'SELL').toUpperCase();
  const city = pickString(row.city, row.locality, row.localityCity);
  const districts = asArray<string>(row.selectedDistricts || row.selected_districts || row.districts).filter(Boolean);
  const propertyType = String(row.propertyType || row.property_type || 'ALL').toUpperCase();
  const maxPrice = pickNumber(row.maxPrice, row.max_price);
  const minArea = pickNumber(row.minArea, row.min_area);
  const minYear = pickNumber(row.minYear, row.min_year);
  const threshold = pickNumber(row.minMatchThreshold, row.matchThreshold, row.match_threshold) ?? 70;
  const push = row.pushNotifications === true || row.push_notifications === true;
  const savedAt = pickString(row.savedAt, row.saved_at, row.createdAt, row.created_at, row.updatedAt, row.updated_at) || null;

  if (!city && !districts.length && maxPrice == null && source !== 'active') return null;

  const where =
    districts.length === 1
      ? `${city || '—'} · ${districts[0]}`
      : districts.length > 1
        ? `${city || '—'} · ${districts.length} dzielnice`
        : city || '—';

  const parts = [
    tx === 'RENT' ? 'Wynajem' : 'Sprzedaż',
    formatPriceCap(maxPrice, tx),
    `próg ${threshold}%`,
    PROP_LABEL[propertyType] || propertyType,
  ];
  if (minArea != null && minArea > 0) parts.push(`min. ${minArea} m²`);
  if (minYear != null && minYear > 1900) parts.push(`od ${minYear} r.`);

  const amenities = amenityLabels(row);
  if (amenities.length) parts.push(amenities.join(', '));

  const params: BuyerSearchSnapshot['params'] = {
    transactionType: tx,
    city: city || '—',
    propertyType,
    maxPrice: maxPrice ?? 0,
    minArea: minArea ?? 0,
    minYear: minYear ?? 0,
    minMatchThreshold: threshold,
    pushNotifications: push,
  };
  if (districts.length) params.selectedDistricts = districts.join(', ');

  return {
    id: `${source}-${idx}-${where}`,
    savedAtIso: savedAt,
    source,
    title: where,
    subtitle: parts.join(' · '),
    params,
    raw: row,
  };
}

function coalesceActivePreference(u: Record<string, unknown>): Record<string, unknown> | null {
  const direct =
    u.radarPreference ||
    u.radar_preference ||
    u.RadarPreference ||
    u.preference;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  const list = u.radarPreferences || u.radar_preferences;
  if (Array.isArray(list) && list[0] && typeof list[0] === 'object') {
    return list[0] as Record<string, unknown>;
  }
  if (
    u.city != null ||
    u.transactionType != null ||
    u.transaction_type != null ||
    u.pushNotifications != null ||
    u.minMatchThreshold != null
  ) {
    return u;
  }
  return null;
}

/** Wyciąga historię i aktywne preferencje z obiektu user (różne kształty API). */
export function extractSearchSnapshotsFromUser(user: unknown): BuyerSearchSnapshot[] {
  if (!user || typeof user !== 'object') return [];
  const u = user as Record<string, unknown>;
  const out: BuyerSearchSnapshot[] = [];

  const active = coalesceActivePreference(u);
  if (active) {
    const snap = normalizePrefRow(active, 'active', 0);
    if (snap) out.push(snap);
  }

  const historyKeys = [
    'radarSearchHistory',
    'radar_search_history',
    'radarCalibrationHistory',
    'calibrationHistory',
    'searchHistory',
    'search_history',
    'radarRecentAreas',
    'radar_recent_areas',
    'buyerSearchHistory',
    'buyer_search_history',
  ];

  for (const key of historyKeys) {
    const list = asArray<unknown>(u[key]);
    list.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const row = entry as Record<string, unknown>;
      const filters = (row.filters || row.params || row.preferences || row) as Record<string, unknown>;
      const snap = normalizePrefRow(filters, 'history', idx);
      if (snap) {
        snap.savedAtIso =
          pickString(row.savedAt, row.saved_at, row.savedAtIso, filters.savedAt) || snap.savedAtIso;
        if (typeof row.title === 'string') snap.title = row.title;
        if (typeof row.subtitle === 'string') snap.subtitle = row.subtitle;
        out.push(snap);
      }
    });
  }

  const advanced = asArray<unknown>(u.advancedSearchHistory || u.advanced_search_history);
  advanced.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const row = entry as Record<string, unknown>;
    const snap = normalizePrefRow(
      {
        transactionType: row.transactionType || row.transaction_type,
        city: row.city,
        selectedDistricts: row.districts || row.selectedDistricts,
        maxPrice: row.maxPrice ?? row.max_price,
        minArea: row.minArea ?? row.min_area,
        propertyType: row.propertyType || row.property_type,
        minMatchThreshold: 70,
      },
      'advanced',
      idx,
    );
    if (snap) out.push(snap);
  });

  return out;
}

function modeOf<T>(items: T[]): T | null {
  if (!items.length) return null;
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) || 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function median(nums: number[]): number | null {
  const sorted = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Heurystyczne podsumowanie — „na bieżąco”, bez zewnętrznego AI. */
export function buildBuyerIntentSummary(snapshots: BuyerSearchSnapshot[]): BuyerIntentSummary {
  const analytics = computeBuyerSearchAnalytics(snapshots);
  const count = snapshots.length;
  if (count === 0) {
    return {
      headline: 'Brak zapisanych parametrów wyszukiwania — profil kupującego nie jest jeszcze zdefiniowany.',
      bullets: ['Użytkownik nie skonfigurował radaru ani nie ma historii kalibracji w systemie.'],
      confidence: 'low',
      confidenceLabel: 'Brak danych',
      snapshotCount: 0,
      historyEventCount: 0,
      dominantTransaction: null,
      dominantCities: [],
      probabilityPercent: 0,
      probabilityLabel: 'Brak danych',
    };
  }

  const txs = snapshots.map((s) => String(s.params.transactionType || 'SELL').toUpperCase());
  const dominantTx = (modeOf(txs) as 'RENT' | 'SELL') || 'SELL';
  const cities = snapshots
    .map((s) => String(s.params.city || '').trim())
    .filter((c) => c && c !== '—');
  const dominantCities = [...new Set(cities)].slice(0, 3);
  const cityPhrase =
    dominantCities.length === 0
      ? 'nieokreślonej lokalizacji'
      : dominantCities.length === 1
        ? dominantCities[0]
        : `${dominantCities[0]} (+${dominantCities.length - 1} inne)`;

  const propTypes = snapshots.map((s) => String(s.params.propertyType || 'ALL').toUpperCase());
  const domProp = modeOf(propTypes) || 'ALL';
  const propPhrase = PROP_LABEL[domProp] || 'nieruchomości';

  const prices = snapshots
    .map((s) => Number(s.params.maxPrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  const medPrice = median(prices);
  const pricePhrase = medPrice ? formatPriceCap(medPrice, dominantTx) : 'bez wyraźnego limitu ceny';

  const areas = snapshots.map((s) => Number(s.params.minArea)).filter((n) => n > 0);
  const medArea = median(areas);

  const thresholds = snapshots
    .map((s) => Number(s.params.minMatchThreshold))
    .filter((n) => Number.isFinite(n) && n >= 50);
  const medThreshold = median(thresholds);

  const activeSnap = snapshots.find((s) => s.source === 'active');
  const radarOn = activeSnap?.params.pushNotifications === true;

  const amenityCounts = new Map<string, number>();
  for (const s of snapshots) {
    const raw = s.raw as Record<string, unknown> | undefined;
    if (raw) {
      for (const a of amenityLabels(raw)) amenityCounts.set(a, (amenityCounts.get(a) || 0) + 1);
    }
  }
  const topAmenities = [...amenityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const txPhrase = TX_LABEL[dominantTx] || 'zakupu';
  let headline = `Najprawdopodobniej szuka ${propPhrase} na ${txPhrase} w ${cityPhrase}`;
  if (medPrice) headline += `, budżet ${pricePhrase}`;
  if (medArea) headline += `, min. ok. ${Math.round(medArea)} m²`;
  if (topAmenities.length) headline += `, z preferencją: ${topAmenities.join(', ')}`;
  headline += '.';

  const bullets: string[] = [];
  if (analytics.historyEvents > 0) {
    bullets.push(
      `Łącznie ${analytics.historyEvents} zapisanych wyszukiwań w historii` +
        (analytics.patternGroups[0]
          ? ` — najczęściej: „${analytics.patternGroups[0].title}” (${analytics.patternGroups[0].count}×, ${analytics.patternGroups[0].sharePercent}%).`
          : '.'),
    );
    for (const dim of analytics.dimensionFrequencies.slice(0, 4)) {
      bullets.push(`${dim.dimension}: ${dim.value} — ${dim.count}× (${dim.sharePercent}% wyszukiwań).`);
    }
  } else {
    bullets.push(
      `Na podstawie bieżących ustawień radaru (brak pełnej historii na serwerze — wymaga POST /api/radar/search-history).`,
    );
  }
  bullets.push(
    `Prawdopodobieństwo profilu kupującego: ${analytics.probabilityPercent}% (${analytics.probabilityLabel}).`,
  );
  if (radarOn) bullets.push('Radar z powiadomieniami jest włączony — klient aktywnie śledzi rynek.');
  else if (activeSnap) bullets.push('Radar skonfigurowany, ale powiadomienia push są wyłączone.');
  if (medThreshold) bullets.push(`Typowy próg dopasowania ofert: ok. ${Math.round(medThreshold)}%.`);

  const confidence: BuyerIntentSummary['confidence'] =
    analytics.probabilityPercent >= 70 ? 'high' : analytics.probabilityPercent >= 45 ? 'medium' : 'low';
  const confidenceLabel = analytics.probabilityLabel;

  return {
    headline,
    bullets,
    confidence,
    confidenceLabel,
    snapshotCount: count,
    historyEventCount: analytics.historyEvents,
    dominantTransaction: dominantTx,
    dominantCities,
    probabilityPercent: analytics.probabilityPercent,
    probabilityLabel: analytics.probabilityLabel,
  };
}

export function radarPreferenceDetailRows(pref: unknown): { label: string; value: string }[] {
  if (!pref || typeof pref !== 'object') return [];
  const p = pref as Record<string, unknown>;
  const tx = String(p.transactionType || p.transaction_type || '—').toUpperCase();
  const districts = asArray<string>(p.selectedDistricts || p.selected_districts || p.districts).filter(Boolean);
  const rows: { label: string; value: string }[] = [
    {
      label: 'Radar / push',
      value: p.pushNotifications === true || p.push_notifications === true ? 'Włączony' : 'Wyłączony',
    },
    { label: 'Transakcja', value: tx === 'RENT' ? 'Wynajem' : tx === 'SELL' ? 'Sprzedaż' : tx },
    { label: 'Miasto', value: pickString(p.city) || '—' },
    {
      label: 'Dzielnice',
      value: districts.length ? districts.join(', ') : 'Całe miasto',
    },
    {
      label: 'Typ nieruchomości',
      value: PROP_LABEL[String(p.propertyType || p.property_type || 'ALL').toUpperCase()] || '—',
    },
    {
      label: 'Cena max.',
      value: formatPriceCap(pickNumber(p.maxPrice, p.max_price), tx),
    },
    {
      label: 'Pow. min.',
      value: (() => {
        const a = pickNumber(p.minArea, p.min_area);
        return a != null && a > 0 ? `${a} m²` : '—';
      })(),
    },
    {
      label: 'Rok budowy min.',
      value: (() => {
        const y = pickNumber(p.minYear, p.min_year);
        return y != null && y > 1900 ? String(Math.round(y)) : '—';
      })(),
    },
    {
      label: 'Próg dopasowania',
      value: `${pickNumber(p.minMatchThreshold, p.matchThreshold, p.match_threshold) ?? '—'}%`,
    },
  ];

  const amenities = amenityLabels(p);
  rows.push({ label: 'Wymagania', value: amenities.length ? amenities.join(', ') : 'Brak' });

  const lat = pickNumber(p.lat, p.latitude);
  const lng = pickNumber(p.lng, p.longitude);
  const radius = pickNumber(p.radius, p.radiusKm, p.radius_km);
  if (lat != null && lng != null) {
    rows.push({
      label: 'Obszar mapy',
      value: radius != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)} · ${radius} km` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    });
  }

  return rows;
}

export function formatSnapshotDate(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
