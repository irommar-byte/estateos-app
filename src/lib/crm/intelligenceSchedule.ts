/**
 * Harmonogram i tryb pracy asystenta EstateOS™ Intelligence.
 * Czas liczony zawsze w Europe/Warsaw — niezależnie od strefy serwera.
 */

export const INTELLIGENCE_TIMEZONE = 'Europe/Warsaw';
/** Wysyłka do klienta tylko w dni robocze, od 8:00 do 20:00 czasu polskiego. */
export const SEND_WINDOW = { fromHour: 8, toHour: 20, weekdays: [1, 2, 3, 4, 5] } as const;
/** Nowy klient: przez pierwsze dni agent akceptuje każdą propozycję. */
export const TRIAL_APPROVAL_DAYS = 7;

export type IntelligenceModeSetting = 'TRIAL' | 'APPROVAL' | 'AUTOPILOT';
export type IntelligenceEffectiveMode = 'APPROVAL' | 'AUTOPILOT';
export type IntelligenceTempo = 'CALM' | 'STANDARD' | 'INTENSIVE' | 'CUSTOM';

export const INTELLIGENCE_TEMPO_PRESETS: Record<Exclude<IntelligenceTempo, 'CUSTOM'>, { intervalHours: number; dailyLimit: number; label: string }> = {
  CALM: { intervalHours: 72, dailyLimit: 1, label: 'Spokojne · co 3 dni' },
  STANDARD: { intervalHours: 24, dailyLimit: 1, label: 'Standard · raz dziennie' },
  INTENSIVE: { intervalHours: 12, dailyLimit: 2, label: 'Intensywne · do 2 dziennie' },
};

type WarsawParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function warsawParts(date: Date = new Date()): WarsawParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTELLIGENCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[String(parts.weekday)] ?? 0,
  };
}

/** Przesunięcie Warszawy względem UTC (w minutach) dla danej chwili. */
function warsawOffsetMinutes(date: Date): number {
  const p = warsawParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** Północ (00:00) bieżącego dnia w Warszawie, jako chwila UTC. */
export function warsawDayStart(date: Date = new Date()): Date {
  const p = warsawParts(date);
  const midnightGuess = new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0));
  return new Date(midnightGuess.getTime() - warsawOffsetMinutes(midnightGuess) * 60000);
}

export function isWithinSendWindow(date: Date = new Date()): boolean {
  const p = warsawParts(date);
  return (
    (SEND_WINDOW.weekdays as readonly number[]).includes(p.weekday) &&
    p.hour >= SEND_WINDOW.fromHour &&
    p.hour < SEND_WINDOW.toHour
  );
}

export function parseIntelligenceModeSetting(raw: unknown): IntelligenceModeSetting | null {
  const value = String(raw ?? '').trim().toUpperCase();
  return value === 'TRIAL' || value === 'APPROVAL' || value === 'AUTOPILOT' ? value : null;
}

export function trialApprovalUntil(createdAt: Date | string | null | undefined): Date | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + TRIAL_APPROVAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Zasada agenta: nic nie wychodzi do klienta bez jego weryfikacji.
 * APPROVAL (domyślnie) → każda propozycja czeka na „Wyślij”.
 * AUTOPILOT → agent po weryfikacji zaznaczył „od teraz wysyłaj automatycznie”.
 * TRIAL / brak / nieznana wartość → traktujemy jak APPROVAL.
 */
export function resolveIntelligenceMode(
  client: { intelligenceMode?: string | null; createdAt?: Date | string | null },
  _now: Date = new Date(),
): { setting: IntelligenceModeSetting; effective: IntelligenceEffectiveMode; approvalUntil: string | null } {
  const parsed = parseIntelligenceModeSetting(client.intelligenceMode);
  if (parsed === 'AUTOPILOT') return { setting: 'AUTOPILOT', effective: 'AUTOPILOT', approvalUntil: null };
  return { setting: 'APPROVAL', effective: 'APPROVAL', approvalUntil: null };
}

export function tempoFromSettings(intervalHours: number, dailyLimit: number): IntelligenceTempo {
  for (const [key, preset] of Object.entries(INTELLIGENCE_TEMPO_PRESETS)) {
    if (preset.intervalHours === intervalHours && preset.dailyLimit === dailyLimit) return key as IntelligenceTempo;
  }
  return 'CUSTOM';
}

export function parseIntelligenceTempo(raw: unknown): Exclude<IntelligenceTempo, 'CUSTOM'> | null {
  const value = String(raw ?? '').trim().toUpperCase();
  return value === 'CALM' || value === 'STANDARD' || value === 'INTENSIVE' ? value : null;
}

/** Forma grzecznościowa w wiadomościach do klienta. */
export type ClientSalutation = 'PAN' | 'PANI';

export function parseSalutation(raw: unknown): ClientSalutation | null {
  const value = String(raw ?? '').trim().toUpperCase();
  return value === 'PAN' || value === 'PANI' ? value : null;
}

/** Następna próba telefonu: za 3 godziny w ciągu dnia, a po 17:00 — jutro o 9:00 (czas polski). */
export function nextOwnerCallAttempt(now: Date = new Date()): Date {
  const parts = warsawParts(now);
  if (parts.hour < 17) return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const tomorrowStart = warsawDayStart(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return new Date(tomorrowStart.getTime() + 9 * 60 * 60 * 1000);
}
