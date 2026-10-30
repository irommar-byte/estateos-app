import { prisma } from '@/lib/prisma';

/**
 * Sterowanie bazą cen transakcyjnych (RCN): harmonogram automatycznej aktualizacji,
 * postęp trwającego importu i historia przyrostu danych. Jeden wiersz w tabeli MarketIngestControl.
 */
export type IngestScheduleMode = 'off' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type IngestSchedule = { mode: IngestScheduleMode; weekday: number; hour: number; minute: number };
export type IngestProgress = {
  runId: number | null;
  percent: number;
  phase: string;
  detail: string;
  kind: string | null;
  upserted: number;
  startedAt: string | null;
  updatedAt: string;
  done: boolean;
};
export type IngestHistoryEntry = { runId: number; finishedAt: string; added: number; total: number; durationSec: number; status: string };

export const DEFAULT_SCHEDULE: IngestSchedule = { mode: 'weekly', weekday: 0, hour: 3, minute: 20 };

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ||= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS \`MarketIngestControl\` (
        \`id\` INT NOT NULL PRIMARY KEY,
        \`schedule\` TEXT NULL,
        \`progress\` TEXT NULL,
        \`history\` MEDIUMTEXT NULL,
        \`lastScheduledAt\` DATETIME(3) NULL,
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) DEFAULT CHARSET=utf8mb4`,
    )
    .then(() => prisma.$executeRawUnsafe('INSERT IGNORE INTO `MarketIngestControl` (`id`) VALUES (1)'))
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      throw err;
    });
  return ensured;
}

type Row = { schedule: string | null; progress: string | null; history: string | null; lastScheduledAt: Date | null };

async function readRow(): Promise<Row> {
  await ensureTable();
  const rows = (await prisma.$queryRawUnsafe(
    'SELECT `schedule`, `progress`, `history`, `lastScheduledAt` FROM `MarketIngestControl` WHERE `id` = 1',
  )) as Row[];
  return rows[0] || { schedule: null, progress: null, history: null, lastScheduledAt: null };
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function sanitizeSchedule(input: Partial<IngestSchedule> | null | undefined): IngestSchedule {
  const modes: IngestScheduleMode[] = ['off', 'daily', 'weekly', 'biweekly', 'monthly'];
  const mode = modes.includes(input?.mode as IngestScheduleMode) ? (input!.mode as IngestScheduleMode) : DEFAULT_SCHEDULE.mode;
  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  return {
    mode,
    weekday: clamp(input?.weekday, 0, 6, DEFAULT_SCHEDULE.weekday),
    hour: clamp(input?.hour, 0, 23, DEFAULT_SCHEDULE.hour),
    minute: clamp(input?.minute, 0, 59, DEFAULT_SCHEDULE.minute),
  };
}

export async function getIngestSchedule(): Promise<IngestSchedule> {
  return sanitizeSchedule(parse((await readRow()).schedule, DEFAULT_SCHEDULE));
}

export async function saveIngestSchedule(schedule: Partial<IngestSchedule>): Promise<IngestSchedule> {
  const clean = sanitizeSchedule(schedule);
  await ensureTable();
  await prisma.$executeRawUnsafe('UPDATE `MarketIngestControl` SET `schedule` = ? WHERE `id` = 1', JSON.stringify(clean));
  return clean;
}

/** Czas w Warszawie jako „ściana” (rok, miesiąc, dzień, dzień tygodnia, godzina, minuta). */
function warsawParts(date: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), wd: weekdays[p.weekday] ?? 0, h: Number(p.hour), mi: Number(p.minute) };
}

/** Data z czasu warszawskiego (uwzględnia zmianę czasu letniego). */
function fromWarsaw(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = warsawParts(new Date(guess));
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset);
}

/** Najbliższy termin według harmonogramu, liczony od chwili `from`. */
export function nextScheduledRun(schedule: IngestSchedule, from: Date, lastScheduledAt?: Date | null): Date | null {
  if (schedule.mode === 'off') return null;
  const now = warsawParts(from);
  for (let add = 0; add < 70; add += 1) {
    const day = new Date(Date.UTC(now.y, now.mo - 1, now.d + add));
    const y = day.getUTCFullYear();
    const mo = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const wd = day.getUTCDay();
    if ((schedule.mode === 'weekly' || schedule.mode === 'biweekly') && wd !== schedule.weekday) continue;
    if (schedule.mode === 'monthly' && d !== 1) continue;
    const at = fromWarsaw(y, mo, d, schedule.hour, schedule.minute);
    if (at.getTime() <= from.getTime()) continue;
    if (schedule.mode === 'biweekly' && lastScheduledAt && at.getTime() - lastScheduledAt.getTime() < 13 * 86_400_000) continue;
    return at;
  }
  return null;
}

/** Czy automat ma teraz ruszyć (proces sprawdzający uruchamia się co godzinę). */
export async function isScheduledRunDue(now = new Date()): Promise<boolean> {
  const row = await readRow();
  const schedule = sanitizeSchedule(parse(row.schedule, DEFAULT_SCHEDULE));
  if (schedule.mode === 'off') return false;
  const last = row.lastScheduledAt;
  // Termin, który „wypadł” od ostatniego automatycznego startu (albo w ostatniej godzinie, gdy startu nie było).
  const since = last ? new Date(last.getTime() + 60_000) : new Date(now.getTime() - 60 * 60_000);
  const due = nextScheduledRun(schedule, since, last);
  return Boolean(due && due.getTime() <= now.getTime());
}

export async function markScheduledRun(at = new Date()): Promise<void> {
  await ensureTable();
  await prisma.$executeRawUnsafe('UPDATE `MarketIngestControl` SET `lastScheduledAt` = ? WHERE `id` = 1', at);
}

let lastWrite = 0;
export async function writeIngestProgress(progress: Omit<IngestProgress, 'updatedAt'>, force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastWrite < 1500) return;
  lastWrite = now;
  try {
    await ensureTable();
    await prisma.$executeRawUnsafe(
      'UPDATE `MarketIngestControl` SET `progress` = ? WHERE `id` = 1',
      JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* postęp nie może zatrzymać importu */
  }
}

export async function appendIngestHistory(entry: IngestHistoryEntry): Promise<void> {
  try {
    const row = await readRow();
    const list = parse<IngestHistoryEntry[]>(row.history, []);
    list.push(entry);
    await prisma.$executeRawUnsafe('UPDATE `MarketIngestControl` SET `history` = ? WHERE `id` = 1', JSON.stringify(list.slice(-24)));
  } catch {
    /* historia pomocnicza */
  }
}

export async function readIngestState(): Promise<{
  schedule: IngestSchedule;
  progress: IngestProgress | null;
  history: IngestHistoryEntry[];
  lastScheduledAt: Date | null;
}> {
  const row = await readRow();
  return {
    schedule: sanitizeSchedule(parse(row.schedule, DEFAULT_SCHEDULE)),
    progress: parse<IngestProgress | null>(row.progress, null),
    history: parse<IngestHistoryEntry[]>(row.history, []),
    lastScheduledAt: row.lastScheduledAt,
  };
}

/**
 * Pamięć ukończonych okien miesięcznych importu RCN (warstwa × miesiąc → liczba aktów w GUGiK).
 * Dzięki niej kolejna aktualizacja pobiera tylko miesiące, w których coś przybyło.
 */
let windowsEnsured: Promise<void> | null = null;
function ensureWindowsTable(): Promise<void> {
  windowsEnsured ||= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS \`MarketIngestWindow\` (
        \`kind\` VARCHAR(16) NOT NULL,
        \`fromDate\` VARCHAR(10) NOT NULL,
        \`hits\` INT NOT NULL,
        \`doneAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`kind\`, \`fromDate\`)
      ) DEFAULT CHARSET=utf8mb4`,
    )
    .then(() => undefined)
    .catch((err) => {
      windowsEnsured = null;
      throw err;
    });
  return windowsEnsured;
}

export async function readDoneWindows(): Promise<Map<string, number>> {
  try {
    await ensureWindowsTable();
    const rows = (await prisma.$queryRawUnsafe('SELECT `kind`, `fromDate`, `hits` FROM `MarketIngestWindow`')) as Array<{
      kind: string;
      fromDate: string;
      hits: number;
    }>;
    return new Map(rows.map((r) => [`${r.kind}:${r.fromDate}`, Number(r.hits)]));
  } catch {
    return new Map();
  }
}

export async function markWindowDone(kind: string, fromDate: string, hits: number): Promise<void> {
  try {
    await ensureWindowsTable();
    await prisma.$executeRawUnsafe(
      'INSERT INTO `MarketIngestWindow` (`kind`, `fromDate`, `hits`, `doneAt`) VALUES (?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE `hits` = VALUES(`hits`), `doneAt` = NOW(3)',
      kind,
      fromDate,
      hits,
    );
  } catch {
    /* pamięć okien jest pomocnicza */
  }
}
