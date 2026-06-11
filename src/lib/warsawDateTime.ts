export const ESTATEOS_TIMEZONE = 'Europe/Warsaw';

/** MySQL DATETIME z VPS traktujemy jako UTC (bez strefy w kolumnie). */
export function parseEventDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return new Date(NaN);
  if (s.includes('T') && (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s))) {
    return new Date(s);
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(`${normalized}Z`);
}

export function formatWarsawDateTime(value: string | Date | null | undefined): string {
  const d = parseEventDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pl-PL', {
    timeZone: ESTATEOS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getWarsawHour(value: string | Date): number {
  const d = parseEventDate(value);
  if (Number.isNaN(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ESTATEOS_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

export function getWarsawWeekday(value: string | Date): number {
  const d = parseEventDate(value);
  if (Number.isNaN(d.getTime())) return 0;
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: ESTATEOS_TIMEZONE, weekday: 'short' }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

export function getWarsawDateKey(value: string | Date): string {
  const d = parseEventDate(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ESTATEOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getWarsawMonthKey(value: string | Date): string {
  const d = parseEventDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ESTATEOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${y}-${m}`;
}
