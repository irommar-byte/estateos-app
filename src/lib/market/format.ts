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

/** Krótka etykieta na taśmie katalogu: jak daleko cena oferty jest od mediany aktów RCN. */
export function formatTapeDelta(vsMedianPct: number, locale: string): string {
  if (!Number.isFinite(vsMedianPct)) return '';
  if (Math.abs(vsMedianPct) < 3) {
    if (locale === 'en') return 'at deed prices';
    if (locale === 'uk' || locale === 'ru') return 'біля актів';
    return 'przy aktach';
  }
  const n = Math.abs(Math.round(vsMedianPct));
  const sign = vsMedianPct > 0 ? '+' : '−';
  if (locale === 'en') return `${sign}${n}% vs deeds`;
  if (locale === 'uk' || locale === 'ru') return `${sign}${n}% vs акти`;
  return `${sign}${n}% vs akty`;
}
