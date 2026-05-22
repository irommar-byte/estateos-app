export type SearchSnapshotLike = {
  id: string;
  savedAtIso: string | null;
  source: 'active' | 'history' | 'advanced';
  title: string;
  subtitle: string;
  params: Record<string, string | number | boolean | string[]>;
  raw: unknown;
};

export type SearchPatternGroup = {
  fingerprint: string;
  count: number;
  sharePercent: number;
  title: string;
  subtitle: string;
  lastSavedAtIso: string | null;
  source: SearchSnapshotLike['source'];
};

export type DimensionFrequency = {
  dimension: string;
  value: string;
  count: number;
  sharePercent: number;
};

export type BuyerSearchAnalytics = {
  totalEvents: number;
  historyEvents: number;
  patternGroups: SearchPatternGroup[];
  dimensionFrequencies: DimensionFrequency[];
  probabilityPercent: number;
  probabilityLabel: string;
};

export function searchSnapshotFingerprint(snap: SearchSnapshotLike): string {
  const d = snap.params;
  const districts = String(d.selectedDistricts || '').split(',').map((x) => x.trim()).filter(Boolean).sort();
  return JSON.stringify({
    t: d.transactionType,
    c: d.city,
    d: districts,
    p: d.propertyType,
    x: d.maxPrice,
    a: d.minArea,
    y: d.minYear,
    th: d.minMatchThreshold,
  });
}

function countBy<T>(items: T[], keyFn: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = keyFn(x);
    if (!k || k === '—') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function topDimensionRows(
  history: SearchSnapshotLike[],
  dimension: string,
  keyFn: (s: SearchSnapshotLike) => string,
  total: number,
  limit = 5,
): DimensionFrequency[] {
  const counts = countBy(history, keyFn);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({
      dimension,
      value,
      count,
      sharePercent: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

export function computeBuyerSearchAnalytics(snapshots: SearchSnapshotLike[]): BuyerSearchAnalytics {
  const history = snapshots.filter((s) => s.source !== 'active');
  const historyEvents = history.length;
  const totalEvents = snapshots.length;

  const groupMap = new Map<string, SearchPatternGroup>();
  for (const snap of history) {
    const fp = searchSnapshotFingerprint(snap);
    const prev = groupMap.get(fp);
    if (!prev) {
      groupMap.set(fp, {
        fingerprint: fp,
        count: 1,
        sharePercent: 0,
        title: snap.title,
        subtitle: snap.subtitle,
        lastSavedAtIso: snap.savedAtIso,
        source: snap.source,
      });
      continue;
    }
    prev.count += 1;
    if (snap.savedAtIso && (!prev.lastSavedAtIso || snap.savedAtIso > prev.lastSavedAtIso)) {
      prev.lastSavedAtIso = snap.savedAtIso;
    }
  }

  const patternGroups = [...groupMap.values()]
    .map((g) => ({
      ...g,
      sharePercent: historyEvents > 0 ? Math.round((g.count / historyEvents) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || String(b.lastSavedAtIso).localeCompare(String(a.lastSavedAtIso)));

  const dimensionFrequencies: DimensionFrequency[] = [
    ...topDimensionRows(history, 'Miasto', (s) => String(s.params.city || ''), historyEvents),
    ...topDimensionRows(
      history,
      'Transakcja',
      (s) => (String(s.params.transactionType) === 'RENT' ? 'Wynajem' : 'Sprzedaż'),
      historyEvents,
      2,
    ),
    ...topDimensionRows(
      history,
      'Typ',
      (s) => String(s.params.propertyType || 'ALL'),
      historyEvents,
      3,
    ),
  ].slice(0, 8);

  const topShare = patternGroups[0]?.sharePercent ?? 0;
  let probabilityPercent = 12;
  let probabilityLabel = 'Bardzo niska';

  if (historyEvents === 0 && totalEvents > 0) {
    probabilityPercent = 28;
    probabilityLabel = 'Niska (tylko bieżące ustawienia)';
  } else if (historyEvents > 0) {
    const concentration = topShare / 100;
    probabilityPercent = Math.round(
      Math.min(
        92,
        22 +
          Math.min(35, historyEvents * 6) +
          concentration * 28 +
          (topDimensionRows(history, 'Miasto', (s) => String(s.params.city || ''), historyEvents)[0]?.sharePercent >=
          60
            ? 12
            : 0),
      ),
    );
    if (probabilityPercent >= 75) probabilityLabel = 'Wysoka';
    else if (probabilityPercent >= 50) probabilityLabel = 'Średnia';
    else probabilityLabel = 'Niska';
  }

  return {
    totalEvents,
    historyEvents,
    patternGroups,
    dimensionFrequencies,
    probabilityPercent,
    probabilityLabel,
  };
}
