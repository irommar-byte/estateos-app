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

export function relative(iso: unknown): string {
  const d = daysSince(iso);
  if (d == null) return '';
  if (d === 0) return 'dziś';
  if (d === 1) return 'wczoraj';
  if (d < 7) return `${d} dni temu`;
  if (d < 30) return `${Math.floor(d / 7)} tyg. temu`;
  return `${Math.floor(d / 30)} mies. temu`;
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
