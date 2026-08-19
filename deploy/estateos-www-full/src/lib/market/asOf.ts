import { prisma } from '@/lib/prisma';
import { WARSAW_CITY } from '@/lib/market/constants';

/** Miesiąc z przynajmniej tyloma aktami uznajemy za „domknięty” w RCN. */
const MIN_COMPLETE_MONTH = 400;
const CACHE_MS = 5 * 60 * 1000;

let cache: { at: number; city: string; asOf: Date } | null = null;

function lastDayOfMonthUtc(year: number, month1to12: number) {
  // Noon UTC so Europe/Warsaw still shows that calendar day.
  return new Date(Date.UTC(year, month1to12, 0, 12, 0, 0, 0));
}

export function formatPlDate(date: Date) {
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  });
}

/**
 * RCN spływa z opóźnieniem (często 3–6 mies.). Okna „3 miesiące” liczymy
 * wstecz od ostatniego kompletnego miesiąca aktów, nie od daty kalendarzowej.
 */
export async function resolveRcnAsOfDate(city = WARSAW_CITY): Promise<Date> {
  const now = Date.now();
  if (cache && cache.city === city && now - cache.at < CACHE_MS) return cache.asOf;

  const rows = await prisma.$queryRawUnsafe<Array<{ ym: string; c: number | bigint }>>(
    `SELECT DATE_FORMAT(deedAt, '%Y-%m') AS ym, COUNT(*) AS c
     FROM MarketTransaction
     WHERE qualityOk = 1 AND city = ? AND deedAt IS NOT NULL
     GROUP BY ym
     ORDER BY ym DESC`,
    city,
  );

  for (const row of rows) {
    if (Number(row.c) >= MIN_COMPLETE_MONTH) {
      const [year, month] = String(row.ym).split('-').map(Number);
      if (year && month) {
        const asOf = lastDayOfMonthUtc(year, month);
        cache = { at: now, city, asOf };
        return asOf;
      }
    }
  }

  const latest = await prisma.marketTransaction.findFirst({
    where: { qualityOk: true, city, deedAt: { not: null } },
    orderBy: { deedAt: 'desc' },
    select: { deedAt: true },
  });
  const asOf = latest?.deedAt || new Date();
  cache = { at: now, city, asOf };
  return asOf;
}

export function rcnLagNote(asOf: Date, periodDays: number) {
  return `Rejestr Cen Nieruchomości publikuje akty z opóźnieniem. „${periodLabel(periodDays)}” to ostatnie ${periodDays} dni kompletnych aktów (do ${formatPlDate(asOf)}), nie kalendarz od dziś.`;
}

function periodLabel(periodDays: number) {
  if (periodDays <= 31) return '1 miesiąc';
  if (periodDays <= 100) return '3 miesiące';
  if (periodDays <= 200) return '6 miesięcy';
  if (periodDays <= 400) return '12 miesięcy';
  return '24 miesiące';
}

export function windowStart(asOf: Date, periodDays: number) {
  return new Date(asOf.getTime() - periodDays * 86400000);
}
