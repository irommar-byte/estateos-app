export function formatPln(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

export function formatPpsm(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł/m²`;
}

export function parseLooseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Zgodność ceny oferty z medianą aktów.
 * 0% → 98; ~8% → 85; 25% → 52; 32% → 39. Dawniej `max(15, 100-3.5×%)`
 * spłaszczało wszystko powyżej ~24% do 15/100.
 */
export function marketPriceScore(vsMedianPct: number): number {
  if (!Number.isFinite(vsMedianPct)) return 8;
  const raw = 100 - Math.abs(vsMedianPct) * 1.9;
  return Math.round(Math.min(98, Math.max(8, raw)));
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.05) return '0,0%';
  const shown = Math.abs(value).toFixed(digits).replace('.', ',');
  return `${value > 0 ? '+' : '-'}${shown}%`;
}

/** Krótka etykieta na taśmie katalogu: jak daleko cena oferty jest od mediany aktów RCN. */
export function formatTapeDelta(vsMedianPct: number, locale: string): string {
  if (!Number.isFinite(vsMedianPct)) return '';
  if (Math.abs(vsMedianPct) < 3) {
    if (locale === 'en') return 'at deed prices';
    if (locale === 'uk' || locale === 'ru') return 'біля актів';
    return 'przy aktach';
  }
  const n = Math.abs(Math.round(vsMedianPct));
  if (vsMedianPct > 0) {
    if (locale === 'en') return `+${n}% above deeds`;
    if (locale === 'uk' || locale === 'ru') return `+${n}% над актами`;
    return `+${n}% powyżej aktów`;
  }
  if (locale === 'en') return `-${n}% below deeds`;
  if (locale === 'uk' || locale === 'ru') return `-${n}% під актами`;
  return `-${n}% poniżej aktów`;
}

export function formatTapeBadge(vsMedianPct: number): string {
  if (!Number.isFinite(vsMedianPct) || Math.abs(vsMedianPct) < 3) return '0%';
  const n = Math.abs(Math.round(vsMedianPct));
  return `${vsMedianPct > 0 ? '+' : '-'}${n}%`;
}
