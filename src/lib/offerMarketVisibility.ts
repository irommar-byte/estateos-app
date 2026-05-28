/**
 * Jedna reguła widoczności oferty na mapie / rynku publicznym.
 * Oferta jest publiczna tylko gdy: status ACTIVE, nie wygasła, ma aktywną publikację.
 */
export function normalizeOfferStatus(status: unknown): string {
  return String(status || "").trim().toUpperCase();
}

export function isOfferStatusActive(status: unknown): boolean {
  return normalizeOfferStatus(status) === "ACTIVE";
}

export function offerExpiresAtMs(expiresAt: unknown): number {
  if (expiresAt == null || expiresAt === "") return Number.NaN;
  const ms = new Date(expiresAt as string | Date).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

export function isOfferExpired(expiresAt: unknown, nowMs = Date.now()): boolean {
  const ms = offerExpiresAtMs(expiresAt);
  return Number.isFinite(ms) && ms <= nowMs;
}

export function canShowOfferOnPublicMarket(
  offer: { id?: unknown; status?: unknown; expiresAt?: unknown },
  activePublicationIds: Set<number>,
): boolean {
  const id = Number(offer.id);
  if (!Number.isFinite(id) || id <= 0) return false;
  if (!isOfferStatusActive(offer.status)) return false;
  if (isOfferExpired(offer.expiresAt)) return false;
  return activePublicationIds.has(id);
}
