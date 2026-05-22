/** Godzina (Europe/Warsaw), od której obowiązuje „dzienny” kurs w aplikacji. */
export const FX_DAILY_REFRESH_HOUR_WARSAW = 8;

export type WarsawClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Aktualny czas kalendarzowy w strefie Warszawa (NBP). */
export function getWarsawClock(now: Date | number = Date.now()): WarsawClock {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(now)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Klucz sesji kursowej: zmienia się codziennie o 08:00 czasu warszawskiego. */
export function getFxSessionKey(
  now: Date | number = Date.now(),
  refreshHour = FX_DAILY_REFRESH_HOUR_WARSAW,
): string {
  const w = getWarsawClock(now);
  let y = w.year;
  let m = w.month;
  let d = w.day;
  if (w.hour < refreshHour) {
    const prev = getWarsawClock(Date.UTC(y, m - 1, d) - 36 * 60 * 60 * 1000);
    y = prev.year;
    m = prev.month;
    d = prev.day;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Czy cache kursu jest jeszcze ważny w bieżącej sesji (od ostatnich 08:00). */
export function isFxCacheValidForSession(
  cachedSessionKey: string | undefined,
  now: Date | number = Date.now(),
): boolean {
  if (!cachedSessionKey) return false;
  return cachedSessionKey === getFxSessionKey(now);
}

/** Ms do następnej granicy 08:00 (Warszawa) — do timera w aplikacji. */
export function msUntilNextFxRefresh(now: Date | number = Date.now()): number {
  const currentKey = getFxSessionKey(now);
  for (let stepMs = 30_000; stepMs <= 48 * 60 * 60 * 1000; stepMs += 30_000) {
    if (getFxSessionKey(Number(now) + stepMs) !== currentKey) {
      return Math.max(1000, stepMs);
    }
  }
  return 24 * 60 * 60 * 1000;
}
