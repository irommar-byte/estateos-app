const OFFER_NEW_LISTING_WINDOW_MS = 48 * 60 * 60 * 1000;

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function resolveOfferActivationMs(offer: Record<string, unknown>): number | null {
  const raw =
    offer.publishedAt ??
    offer.activatedAt ??
    offer.approvedAt ??
    offer.listedAt ??
    offer.createdAt;
  if (!raw) return null;
  const ms = new Date(String(raw)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isOfferNewListing(
  offer: Record<string, unknown> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!offer) return false;
  const status = normalize(offer.status ?? offer.state ?? '');
  if (status && status !== 'ACTIVE') return false;
  const activatedMs = resolveOfferActivationMs(offer);
  if (!activatedMs) return false;
  return now - activatedMs <= OFFER_NEW_LISTING_WINDOW_MS;
}
