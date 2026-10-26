export const KEI_AUTO_INTERVALS_MIN = [15, 30, 60, 180, 360, 720, 1440] as const;
export const KEI_AUTO_MAX_COUNT = 25;
/** Worker zapisuje heartbeat co minutę — po tylu sekundach ciszy uznajemy go za niedziałający. */
export const KEI_WORKER_STALE_SECONDS = 180;
/** Przerwy po kolejnych błędach cyklu (min). */
export const KEI_AUTO_ERROR_BACKOFF_MIN = [2, 5, 15, 30, 60] as const;

export type KeiAutoPropertyKind = 'apartment' | 'house';
export type KeiAutoTransactionKind = 'sale' | 'rent';
export type KeiAutoPublishMode = 'publish' | 'review';
export type KeiAutoPortal = 'otodom' | 'olx' | 'nieruchomosci-online';

export const KEI_AUTO_PORTALS: Array<{ id: KeiAutoPortal; label: string }> = [
  { id: 'otodom', label: 'Otodom' },
  { id: 'olx', label: 'OLX' },
  { id: 'nieruchomosci-online', label: 'Nieruchomosci-Online' },
];

/** Filtry i reguły jakości cyklu — wszystko opcjonalne, puste = bez ograniczenia. */
export type KeiAutoImportSettings = {
  districts: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  minRooms: number | null;
  maxRooms: number | null;
  /** Tylko ogłoszenia młodsze niż tyle godzin (np. 48). */
  maxAgeHours: number | null;
  directOwnerOnly: boolean;
  requirePhone: boolean;
  /** Poniżej tej liczby zdjęć oferta zostaje szkicem zamiast iść na rynek. */
  minImages: number;
  publishMode: KeiAutoPublishMode;
  /** Godziny pracy (czas warszawski), np. 8–21. Równe wartości = całą dobę. */
  activeFromHour: number;
  activeToHour: number;
  /** Maks. nowych ofert na dobę (0 = bez limitu). */
  dailyLimit: number;
  portals: KeiAutoPortal[];
};

export const DEFAULT_KEI_AUTO_SETTINGS: KeiAutoImportSettings = {
  districts: [],
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  minRooms: null,
  maxRooms: null,
  maxAgeHours: 72,
  directOwnerOnly: false,
  requirePhone: true,
  minImages: 3,
  publishMode: 'publish',
  activeFromHour: 7,
  activeToHour: 22,
  dailyLimit: 30,
  portals: ['otodom', 'olx', 'nieruchomosci-online'],
};

export type KeiAutoTargetUser = { id: number; name: string | null; email: string; role: string } | null;

export type KeiAutoImportConfig = {
  enabled: boolean;
  intervalMinutes: number;
  count: number;
  targetUserId: number;
  agentCommissionPercent: number;
  propertyKind: KeiAutoPropertyKind;
  transactionKind: KeiAutoTransactionKind;
  adminUserId: number;
  lastRunAt: string | null;
  lastStartedAt: string | null;
  lastJobId: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveErrors: number;
  updatedAt: string | null;
  sessionStartedAt: string | null;
  sessionImportedCount: number;
  sessionSkippedCount: number;
  sessionCycles: number;
  dayImportedCount: number;
  workerHeartbeatAt: string | null;
  workerAlive: boolean;
  settings: KeiAutoImportSettings;
  targetUser: KeiAutoTargetUser;
  /** ISO — null gdy wyłączony albo cykl ma ruszyć od razu. */
  nextRunAt: string | null;
  /** Dlaczego cykl teraz czeka (poza godzinami, limit dzienny, przerwa po błędzie). */
  waitingReason: string | null;
};

export function keiAutoIntervalLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours === 1) return '1 godz.';
  if (hours === 24) return '24 godz.';
  return `${hours} godz.`;
}

export function keiAutoErrorBackoffMinutes(consecutiveErrors: number): number {
  if (consecutiveErrors <= 0) return 0;
  const idx = Math.min(consecutiveErrors, KEI_AUTO_ERROR_BACKOFF_MIN.length) - 1;
  return KEI_AUTO_ERROR_BACKOFF_MIN[idx];
}

export function warsawHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('pl-PL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Warsaw' }).format(date);
  return Number(hour) % 24;
}

export function warsawDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(date);
}

export function isWithinActiveHours(settings: Pick<KeiAutoImportSettings, 'activeFromHour' | 'activeToHour'>, date = new Date()) {
  const from = settings.activeFromHour;
  const to = settings.activeToHour;
  if (from === to) return true;
  const hour = warsawHour(date);
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function keiAutoNextRunAt(
  config: Pick<KeiAutoImportConfig, 'enabled' | 'lastRunAt' | 'intervalMinutes'> &
    Partial<Pick<KeiAutoImportConfig, 'lastStartedAt' | 'consecutiveErrors' | 'lastErrorAt'>>,
): string | null {
  if (!config.enabled) return null;
  const anchor = config.lastStartedAt || config.lastRunAt;
  const candidates: number[] = [];
  if (anchor) candidates.push(new Date(anchor).getTime() + config.intervalMinutes * 60_000);
  if (config.consecutiveErrors && config.lastErrorAt) {
    candidates.push(new Date(config.lastErrorAt).getTime() + keiAutoErrorBackoffMinutes(config.consecutiveErrors) * 60_000);
  }
  if (candidates.length === 0) return new Date().toISOString();
  return new Date(Math.max(...candidates)).toISOString();
}

export function describeKeiAutoSettings(settings: KeiAutoImportSettings): string[] {
  const parts: string[] = [];
  if (settings.districts.length) parts.push(settings.districts.join(', '));
  const fmt = (n: number) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(n);
  const range = (min: number | null, max: number | null, unit: string) =>
    min != null && max != null
      ? `${fmt(min)}–${fmt(max)} ${unit}`
      : min != null
        ? `od ${fmt(min)} ${unit}`
        : max != null
          ? `do ${fmt(max)} ${unit}`
          : null;
  const price = range(settings.minPrice, settings.maxPrice, 'zł');
  if (price) parts.push(price);
  const area = range(settings.minArea, settings.maxArea, 'm²');
  if (area) parts.push(area);
  const rooms = range(settings.minRooms, settings.maxRooms, 'pok.');
  if (rooms) parts.push(rooms);
  if (settings.maxAgeHours) parts.push(`do ${settings.maxAgeHours} h od wystawienia`);
  if (settings.directOwnerOnly) parts.push('tylko bez pośredników');
  if (settings.requirePhone) parts.push('z telefonem');
  return parts;
}

/** „dziś 14:20”, „jutro 07:00”, „28.10, 09:15” — czas warszawski, bez sekund. */
export function formatKeiWhen(isoValue: string | null | undefined, now = new Date()): string {
  if (!isoValue) return '—';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '—';
  const time = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(date);
  const day = warsawDayKey(date);
  if (day === warsawDayKey(now)) return `dziś ${time}`;
  if (day === warsawDayKey(new Date(now.getTime() + 86_400_000))) return `jutro ${time}`;
  if (day === warsawDayKey(new Date(now.getTime() - 86_400_000))) return `wczoraj ${time}`;
  const dm = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' }).format(date);
  return `${dm}, ${time}`;
}
