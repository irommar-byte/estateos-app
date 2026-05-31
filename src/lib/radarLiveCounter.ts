/** Start licznika — 29.05.2026, baza 14 inwestorów z Radarem. */
export const RADAR_COUNTER_EPOCH_MS = Date.parse("2026-05-29T00:00:00Z");
export const RADAR_COUNTER_BASE = 14;

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zaplanowany wzrost: +2/h, dodatkowo +4 co pełne 2 h (bez losowych joinów). */
export function getScheduledRadarCount(nowMs = Date.now()): number {
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  const hours = Math.floor(elapsed / 3_600_000);
  return RADAR_COUNTER_BASE + hours * 2 + Math.floor(hours / 2) * 4;
}

/** 1–3 deterministyczne „dołączenia na żywo” w danej godzinie (offset ms od początku godziny). */
export function getHourlyJoinOffsetsMs(hourIndex: number): number[] {
  const rand = mulberry32(hourIndex * 7919 + 14);
  const eventCount = 1 + Math.floor(rand() * 3);
  const offsets: number[] = [];
  for (let i = 0; i < eventCount; i++) {
    offsets.push(300_000 + Math.floor(rand() * 3_000_000));
  }
  return offsets.sort((a, b) => a - b);
}

export function getTotalRadarCount(nowMs = Date.now()): number {
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  const hours = Math.floor(elapsed / 3_600_000);
  const msIntoHour = elapsed % 3_600_000;
  let count = getScheduledRadarCount(nowMs);

  for (const offset of getHourlyJoinOffsetsMs(hours)) {
    if (msIntoHour >= offset) count += 1;
  }
  return count;
}

export function msUntilNextRadarCountChange(nowMs = Date.now()): number | null {
  const elapsed = Math.max(0, nowMs - RADAR_COUNTER_EPOCH_MS);
  const hours = Math.floor(elapsed / 3_600_000);
  const msIntoHour = elapsed % 3_600_000;
  const hourStart = RADAR_COUNTER_EPOCH_MS + hours * 3_600_000;

  for (const offset of getHourlyJoinOffsetsMs(hours)) {
    if (msIntoHour < offset) {
      return offset - msIntoHour;
    }
  }

  const nextHourJoins = getHourlyJoinOffsetsMs(hours + 1);
  if (nextHourJoins.length > 0) {
    return 3_600_000 - msIntoHour + nextHourJoins[0];
  }

  return 3_600_000 - msIntoHour;
}
