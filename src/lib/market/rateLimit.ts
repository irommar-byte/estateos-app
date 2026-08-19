const buckets = new Map<string, number[]>();

export function hitRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const prev = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    return true;
  }
  prev.push(now);
  buckets.set(key, prev);
  return false;
}
