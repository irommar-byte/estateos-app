const NEW_OFFER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isOfferNew(createdAt?: string | null, nowMs = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return nowMs - created < NEW_OFFER_WINDOW_MS;
}

export function sortOffersByNewest<T extends { createdAt?: string | null; id?: number }>(offers: T[]): T[] {
  return [...offers].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number(a.id ?? 0) * 1000;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number(b.id ?? 0) * 1000;
    return tb - ta;
  });
}
