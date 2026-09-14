/** Pure price-pulse math — no Prisma. Keep transaction % honest and flats-only. */

export const MIN_DAY_DEEDS = 12;
export const MIN_WEEK_DEEDS = 40;
export const MIN_MONTH_DEEDS = 80;
export const MIN_YEAR_DEEDS = 400;
export const MIN_WINDOW_LISTINGS = 8;
export const MIN_WINDOW_DEEDS = 80;
export const MAX_ABS_DAY_PCT = 12;
export const MAX_ABS_WEEK_PCT = 10;
export const MAX_ABS_MONTH_PCT = 8;
export const MAX_ABS_YEAR_PCT = 25;

const HOUSE_RE =
  /\bdom(?:u|em|y|ów|ami|ach|owi)?\b|jednorodzin|wolnostoj|will[aeiy]|bli[zź]niak|szereg|działk|dzialk|\bgrunt\b|budynek mieszkalny|house|detached|semi-detached/i;

export function isHouseLikeDeed(input: {
  functionCode?: string | null;
  transactionKind?: string | null;
}): boolean {
  return HOUSE_RE.test(`${input.functionCode || ''} ${input.transactionKind || ''}`);
}

export function isResidentialFlatDeed(input: {
  functionCode?: string | null;
  transactionKind?: string | null;
}): boolean {
  if (isHouseLikeDeed(input)) return false;
  return /mieszkal/i.test(String(input.functionCode || '').trim());
}

export function isResidentialFlatListing(propertyType: unknown): boolean {
  const t = String(propertyType || '')
    .trim()
    .toUpperCase();
  if (!t) return false;
  if (t.includes('HOUSE') || t.includes('DOM') || t.includes('PLOT') || t.includes('DZIAL') || t.includes('COMMERCIAL')) {
    return false;
  }
  return t.includes('FLAT') || t.includes('APART') || t.includes('MIESZKAN');
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pctChange(now: number | null, prev: number | null): number | null {
  if (now == null || prev == null || prev <= 0) return null;
  return ((now - prev) / prev) * 100;
}

export function roundOrNull(value: number | null, digits = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Drop impossible jumps instead of showing them as a market move. */
export function sanitizeChangePct(pct: number | null, maxAbs: number): number | null {
  const rounded = roundOrNull(pct);
  if (rounded == null) return null;
  if (Math.abs(rounded) > maxAbs) return null;
  return rounded;
}

export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function prevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d += 1) {
    out.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

export function collect(map: Map<string, number[]>, days: string[]): number[] {
  const out: number[] = [];
  for (const day of days) {
    const values = map.get(day);
    if (values) out.push(...values);
  }
  return out;
}

export function adjacentWindowChange(
  byDay: Map<string, number[]>,
  endDay: string,
  windowDays: number,
  minSamples: number,
  maxAbsPct: number,
): { changePct: number | null; currentPpsm: number | null; previousPpsm: number | null; count: number } {
  const currentDays: string[] = [];
  const previousDays: string[] = [];
  for (let i = 0; i < windowDays; i += 1) {
    currentDays.unshift(addDays(endDay, -i));
    previousDays.unshift(addDays(endDay, -windowDays - i));
  }
  const current = collect(byDay, currentDays);
  const previous = collect(byDay, previousDays);
  const nowMed = current.length >= minSamples ? median(current) : null;
  const prevMed = previous.length >= minSamples ? median(previous) : null;
  return {
    changePct: sanitizeChangePct(pctChange(nowMed, prevMed), maxAbsPct),
    currentPpsm: nowMed != null ? Math.round(nowMed) : null,
    previousPpsm: prevMed != null ? Math.round(prevMed) : null,
    count: current.length,
  };
}

/** Last calendar month that has fully elapsed relative to the RCN as-of day. */
export function lastCompleteYearMonth(asOfDay: string): string {
  const ym = asOfDay.slice(0, 7);
  const lastDay = daysInMonth(ym)[daysInMonth(ym).length - 1];
  if (asOfDay >= lastDay) return ym;
  return prevYearMonth(ym);
}

export function lastDayOfYearMonth(ym: string): string {
  const days = daysInMonth(ym);
  return days[days.length - 1];
}

export function pulseAsOfDay(asOfDay: string): string {
  return lastDayOfYearMonth(lastCompleteYearMonth(asOfDay));
}

export function calendarMonthChange(
  byDay: Map<string, number[]>,
  asOfDay: string,
  minSamples: number,
  maxAbsPct: number,
): { changePct: number | null; currentPpsm: number | null; previousPpsm: number | null; count: number } {
  const currentYm = lastCompleteYearMonth(asOfDay);
  const previousYm = prevYearMonth(currentYm);
  const current = collect(byDay, daysInMonth(currentYm));
  const previous = collect(byDay, daysInMonth(previousYm));
  const nowMed = current.length >= minSamples ? median(current) : null;
  const prevMed = previous.length >= minSamples ? median(previous) : null;
  return {
    changePct: sanitizeChangePct(pctChange(nowMed, prevMed), maxAbsPct),
    currentPpsm: nowMed != null ? Math.round(nowMed) : null,
    previousPpsm: prevMed != null ? Math.round(prevMed) : null,
    count: current.length,
  };
}

export function trailingMonthsChange(
  byDay: Map<string, number[]>,
  asOfDay: string,
  monthCount: number,
  minSamples: number,
  maxAbsPct: number,
): { changePct: number | null; currentPpsm: number | null; previousPpsm: number | null; count: number } {
  const endYm = lastCompleteYearMonth(asOfDay);
  const currentKeys: string[] = [];
  let ym = endYm;
  for (let i = 0; i < monthCount; i += 1) {
    currentKeys.unshift(ym);
    ym = prevYearMonth(ym);
  }
  const previousKeys: string[] = [];
  for (let i = 0; i < monthCount; i += 1) {
    previousKeys.unshift(ym);
    ym = prevYearMonth(ym);
  }
  const current = collect(
    byDay,
    currentKeys.flatMap((key) => daysInMonth(key)),
  );
  const previous = collect(
    byDay,
    previousKeys.flatMap((key) => daysInMonth(key)),
  );
  const nowMed = current.length >= minSamples ? median(current) : null;
  const prevMed = previous.length >= minSamples ? median(previous) : null;
  return {
    changePct: sanitizeChangePct(pctChange(nowMed, prevMed), maxAbsPct),
    currentPpsm: nowMed != null ? Math.round(nowMed) : null,
    previousPpsm: prevMed != null ? Math.round(prevMed) : null,
    count: current.length,
  };
}

export function lastNMonths(asOfDay: string, n: number): string[] {
  const keys: string[] = [];
  let ym = lastCompleteYearMonth(asOfDay);
  for (let i = 0; i < n; i += 1) {
    keys.unshift(ym);
    ym = prevYearMonth(ym);
  }
  return keys;
}
