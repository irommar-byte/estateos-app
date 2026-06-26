/** Baza licznika „Radar na żywo” — od 02.06.2026. */
export const RADAR_COUNTER_EPOCH_MS = Date.parse('2026-06-02T00:00:00Z');
export const RADAR_COUNTER_BASE = 570;
export const RADAR_DAILY_NET = 10;

/** Stała liczba profili w ekosystemie na podglądzie /dolacz (nie trend na żywo). */
export const PORTAL_ONBOARDING_RADAR_ECOSYSTEM = 610;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Płynny trend: ~+10 inwestorów na dobę od bazy 570. */
export function getTrendRadarCount(nowMs = Date.now()): number {
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  return RADAR_COUNTER_BASE + (elapsed / DAY_MS) * RADAR_DAILY_NET;
}

/** 3–6 deterministycznych zdarzeń ±1 w danej godzinie (wizualna „żywość”). */
export function getHourlyFluctuationEvents(hourIndex: number): { offsetMs: number; delta: number }[] {
  const rand = mulberry32(hourIndex * 9043 + RADAR_COUNTER_BASE);
  const eventCount = 3 + Math.floor(rand() * 4);
  const events: { offsetMs: number; delta: number }[] = [];
  let balance = 0;

  for (let i = 0; i < eventCount; i++) {
    let delta: number;
    if (balance >= 2) delta = -1;
    else if (balance <= -2) delta = 1;
    else delta = rand() > 0.52 ? 1 : -1;
    balance += delta;
    events.push({
      offsetMs: 90_000 + Math.floor(rand() * 3_200_000),
      delta,
    });
  }

  return events.sort((a, b) => a.offsetMs - b.offsetMs);
}

export function getTotalRadarCount(nowMs = Date.now()): number {
  const trend = getTrendRadarCount(nowMs);
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  const hours = Math.floor(elapsed / HOUR_MS);
  const msIntoHour = elapsed % HOUR_MS;

  let jitter = 0;
  for (const e of getHourlyFluctuationEvents(hours)) {
    if (msIntoHour >= e.offsetMs) jitter += e.delta;
  }

  const raw = Math.round(trend) + jitter;
  const floor = Math.max(RADAR_COUNTER_BASE - 5, Math.floor(trend) - 4);
  return Math.max(floor, raw);
}

export function msUntilNextRadarCountChange(nowMs = Date.now()): number | null {
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  const hours = Math.floor(elapsed / HOUR_MS);
  const msIntoHour = elapsed % HOUR_MS;

  for (const e of getHourlyFluctuationEvents(hours)) {
    if (msIntoHour < e.offsetMs) return e.offsetMs - msIntoHour;
  }

  return HOUR_MS - msIntoHour;
}
