/** Czas wyświetlania i buckety wykresów — strefa Europe/Warsaw. */

export const ESTATEOS_TIMEZONE = "Europe/Warsaw";

/** Parsuje ISO (UTC) lub MySQL DATETIME traktowany jako UTC (serwer produkcyjny). */
export function parseIsoOrDbUtc(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ),
    );
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dane sprzed UTC_TIMESTAMP: DATETIME zapisywany jako czas warszawski (NOW() na serwerze PL).
 * Używane tylko przy normalizacji starych wierszy.
 */
export function parseMysqlAsWarsawWall(value: unknown): Date | null {
  if (value == null || value === "") return null;

  const pick = (y: number, mo: number, d: number, h: number, mi: number, s: number) =>
    instantFromWarsawWall(y, mo, d, h, mi, s);

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return pick(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    );
  }

  const raw = String(value).trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return parseIsoOrDbUtc(raw);
  }

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return pick(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }

  return parseIsoOrDbUtc(value);
}

function instantFromWarsawWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ESTATEOS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  let t = target - 2 * 3_600_000;
  for (let i = 0; i < 5; i++) {
    const parts = fmt.formatToParts(new Date(t));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value || 0);
    const actual = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const delta = target - actual;
    if (delta === 0) break;
    t += delta;
  }
  return new Date(t);
}

/** ISO UTC z surowego MySQL DATETIME / Prisma Date (cyfry = czas warszawski). */
export function serializeDbDateTime(value: unknown): string | null {
  const d = parseMysqlAsWarsawWall(value);
  return d ? d.toISOString() : null;
}

/** ISO UTC z już poprawnego obiektu Date (np. po aggregateVisitors). */
export function serializeInstant(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

/** Domyślne parsowanie zdarzeń z bazy (wizyty, oferty, użytkownicy). */
export function parseDbDateTime(value: unknown): Date | null {
  return parseMysqlAsWarsawWall(value);
}

function parseForDisplay(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return parseIsoOrDbUtc(raw);
  }
  return parseMysqlAsWarsawWall(raw);
}

export function formatDateTimePl(
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value == null ? null : parseForDisplay(value instanceof Date ? value : String(value));
  if (!d || Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: ESTATEOS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...options,
  }).format(d);
}

export function formatMeetingWhenPl(value: Date | string | null | undefined): string {
  const d = value == null ? null : parseForDisplay(value instanceof Date ? value : String(value));
  if (!d || Number.isNaN(d.getTime())) return "—";
  const label = new Intl.DateTimeFormat("pl-PL", {
    timeZone: ESTATEOS_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("pl-PL") + trimmed.slice(1);
}

export function getWarsawYmd(value: Date | string): string {
  const d = value instanceof Date ? value : parseForDisplay(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ESTATEOS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getWarsawYm(value: Date | string): string {
  const d = value instanceof Date ? value : parseForDisplay(value);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ESTATEOS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  return `${y}-${mo}`;
}

export function getWarsawHour(value: Date | string): number {
  const d = value instanceof Date ? value : parseForDisplay(value);
  if (!d) return 0;
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ESTATEOS_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(d),
  );
}

export function getWarsawDay(value: Date | string): number {
  const d = value instanceof Date ? value : parseForDisplay(value);
  if (!d) return 0;
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: ESTATEOS_TIMEZONE,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? d.getUTCDay();
}
