const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfUtcDay(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Stable weekly counter for the "Inne portale" chip — numbers only, no portal names. */
export function otherPortalsPresenceCount(
  listingId: number,
  createdAt?: string | Date | null,
  nowMs = Date.now(),
): number {
  const id = Number(listingId) || 0;
  const seed = Math.abs(id * 2654435761) >>> 0;
  const start = 4 + (seed % 4);
  const createdMs = createdAt
    ? createdAt instanceof Date
      ? createdAt.getTime()
      : Date.parse(String(createdAt))
    : nowMs;
  const origin = Number.isFinite(createdMs) ? createdMs : nowMs;
  const firstTick = startOfUtcDay(origin) + (seed % 7) * 24 * 60 * 60 * 1000;
  if (nowMs < firstTick) return start;
  const weeks = Math.floor((nowMs - firstTick) / WEEK_MS);
  return start + Math.max(0, weeks);
}
