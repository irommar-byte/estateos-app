export type ListingSection = 'ACTIVE' | 'PENDING' | 'COMPLETED';

export const LISTING_SECTION_ORDER: ListingSection[] = ['ACTIVE', 'PENDING', 'COMPLETED'];

export const LISTING_SECTION_LABELS: Record<ListingSection, string> = {
  ACTIVE: 'Aktywne',
  PENDING: 'Oczekujące',
  COMPLETED: 'Zakończone',
};

export function isOfferAwaitingReview(offer: {
  status?: string | null;
  awaitingModeration?: boolean | null;
  pendingPublicationKind?: string | null;
  legalCheckStatus?: string | null;
}): boolean {
  const status = String(offer?.status || '').toUpperCase();
  if (['PENDING', 'PENDING_APPROVAL', 'IN_REVIEW'].includes(status)) return true;
  if (offer?.awaitingModeration || offer?.pendingPublicationKind) return true;
  if (String(offer?.legalCheckStatus || '').toUpperCase() === 'PENDING') return true;
  return false;
}

export function classifyListingSection(offer: {
  status?: string | null;
  expiresAt?: string | null;
  awaitingModeration?: boolean | null;
  pendingPublicationKind?: string | null;
  legalCheckStatus?: string | null;
}): ListingSection {
  const now = Date.now();
  const status = String(offer?.status || '').toUpperCase();
  const expiresAtMs = offer?.expiresAt ? new Date(offer.expiresAt).getTime() : Number.NaN;
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < now;
  const isCompleted =
    isExpired ||
    ['ARCHIVED', 'SOLD', 'REJECTED', 'EXPIRED', 'INACTIVE', 'PAUSED', 'CANCELLED'].includes(status);
  if (isOfferAwaitingReview(offer)) return 'PENDING';
  if (isCompleted) return 'COMPLETED';
  return 'ACTIVE';
}

export function sortListingsInSection<T extends { createdAt?: string | null; expiresAt?: string | null }>(
  offers: T[],
  section: ListingSection,
): T[] {
  const withTs = (offer: T) => ({
    createdAtMs: offer?.createdAt ? new Date(offer.createdAt).getTime() : 0,
    expiresAtMs: offer?.expiresAt ? new Date(offer.expiresAt).getTime() : 0,
  });

  return [...offers].sort((a, b) => {
    const tsA = withTs(a);
    const tsB = withTs(b);
    if (section === 'COMPLETED') return tsB.expiresAtMs - tsA.expiresAtMs;
    return tsB.createdAtMs - tsA.createdAtMs;
  });
}

export function groupListingsBySection<T extends { createdAt?: string | null; expiresAt?: string | null }>(
  offers: T[],
  classify: (offer: T) => ListingSection = classifyListingSection as (offer: T) => ListingSection,
): Record<ListingSection, T[]> {
  const buckets: Record<ListingSection, T[]> = { ACTIVE: [], PENDING: [], COMPLETED: [] };
  for (const offer of offers) {
    buckets[classify(offer)].push(offer);
  }
  for (const key of LISTING_SECTION_ORDER) {
    buckets[key] = sortListingsInSection(buckets[key], key);
  }
  return buckets;
}

export function listingSectionCounts(offers: unknown[]): Record<ListingSection, number> {
  const grouped = groupListingsBySection(offers as never[]);
  return {
    ACTIVE: grouped.ACTIVE.length,
    PENDING: grouped.PENDING.length,
    COMPLETED: grouped.COMPLETED.length,
  };
}
