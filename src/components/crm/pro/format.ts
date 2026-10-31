/** Wspólne formatowanie CRM Pro. */
export function pln(value: unknown, currency?: string | null): string {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '—';
  const cur = currency && currency !== 'PLN' ? currency : 'zł';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} mln ${cur}`;
  return `${Math.round(n).toLocaleString('pl-PL')} ${cur}`;
}

export function plnPerSqm(price: unknown, area: unknown): string | null {
  const p = Number(price);
  const a = Number(area);
  if (!(p > 0) || !(a > 0)) return null;
  return `${Math.round(p / a).toLocaleString('pl-PL')} zł/m²`;
}

export function daysSince(iso: unknown): number | null {
  const t = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function timeHM(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Dziś';
  if (d.toDateString() === tomorrow.toDateString()) return 'Jutro';
  return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Data i godzina zdarzenia — zawsze z minutami, np. „31.10.2026, 00:56”. */
export function stamp(iso: unknown): string {
  const t = new Date(String(iso || ''));
  if (!Number.isFinite(t.getTime())) return '';
  const date = t.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

/** Kiedy coś się wydarzyło — w CRM zawsze konkretna data z godziną i minutą. */
export function relative(iso: unknown): string {
  return stamp(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export const PROPERTY_LABEL: Record<string, string> = {
  FLAT: 'Mieszkanie',
  HOUSE: 'Dom',
  PLOT: 'Działka',
  COMMERCIAL: 'Lokal',
  PREMISES: 'Lokal',
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Dobry wieczór';
  if (h < 18) return 'Dzień dobry';
  return 'Dobry wieczór';
}
