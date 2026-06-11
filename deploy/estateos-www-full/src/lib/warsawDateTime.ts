/**
 * Kompatybilność wsteczna — logika w `datetime/warsaw.ts`.
 * MySQL DATETIME na VPS = czas ścienny Europe/Warsaw (SYSTEM), nie UTC.
 */
export { ESTATEOS_TIMEZONE } from './datetime/warsaw';
import {
  ESTATEOS_TIMEZONE,
  formatDateTimePl,
  getWarsawDay,
  getWarsawHour,
  getWarsawYmd,
  getWarsawYm,
  parseMysqlAsWarsawWall,
} from './datetime/warsaw';

export function parseEventDate(value: string | Date | null | undefined): Date {
  const d = parseMysqlAsWarsawWall(value);
  return d ?? new Date(NaN);
}

export const formatWarsawDateTime = formatDateTimePl;
export const getWarsawDateKey = getWarsawYmd;
export const getWarsawMonthKey = getWarsawYm;
export const getWarsawWeekday = getWarsawDay;
export { getWarsawHour };
