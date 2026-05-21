/** Limit ogłoszeń: konto standardowe ma 1 aktywną/oczekującą ofertę; Pakiet Plus dodaje prawo do jednej nowej oferty na 30 dni. */

export type MinimalUser = {
  id?: number;
  role?: string;
  planType?: string | null;
  isPro?: boolean;
  proExpiresAt?: string | null;
  /** Data ważności ostatniej dodatkowej publikacji Plus (nie jest planem ani przedłużeniem konta). */
  plusExpiresAt?: string | null;
  /** Liczba dostępnych dodatkowych publikacji kupionych przez IAP. */
  extraListings?: number | null;
};

/** Zgodnie z OfferDetail — pełny dostęp bez limitu prostych ogłoszeń */
export function hasUnlimitedListingAccess(user: MinimalUser | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const planType = String(user.planType || '').trim().toUpperCase();
  if (planType === 'PLUS') return false;
  const proExpiryMs = user.proExpiresAt ? new Date(user.proExpiresAt).getTime() : null;
  const proStillActive = Boolean(!proExpiryMs || proExpiryMs > Date.now());
  return Boolean(
    (user.isPro && proStillActive) ||
    planType === 'PRO' ||
    planType === 'AGENCY' ||
    user.role === 'AGENCY'
  );
}

/** Zgodne z backendem `hasPlusCreditOnUser` — slot + ważny termin kredytu. */
export function isPlusCreditActive(user: MinimalUser | null): boolean {
  const slots = getAdditionalListingSlots(user);
  if (slots <= 0) return false;
  const raw = user?.plusExpiresAt;
  if (!raw) return false;
  const exp = new Date(raw).getTime();
  return Number.isFinite(exp) && exp > Date.now();
}

/** Pakiet Plus nie jest planem konta. To liczba dodatkowych publikacji kupionych przez IAP. */
export function hasAdditionalPlusPublication(user: MinimalUser | null): boolean {
  return isPlusCreditActive(user);
}

export function allowsMultipleCountableListings(user: MinimalUser | null): boolean {
  return hasUnlimitedListingAccess(user);
}

export function getAdditionalListingSlots(user: MinimalUser | null): number {
  const n = Number(user?.extraListings ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Po udanym zakupie w sklepie, zanim backend zaktualizuje profil — lokalnie
 * przyznajemy jeden slot Pakietu Plus, żeby nie blokować publikacji na skróty.
 * `refreshUser` nadpisze to, gdy serwer zwróci `extraListings`.
 */
export function applyOptimisticPlusPublicationSlot(user: MinimalUser | null): MinimalUser | null {
  if (!user) return null;
  if (isPlusCreditActive(user)) return user;
  const plusExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { ...user, extraListings: getAdditionalListingSlots(user) + 1, plusExpiresAt };
}

/** Po zakupie IAP: slot z odpowiedzi verify, optymistyczny bump albo stan z API. */
export function userAfterPakietPlusPurchase(
  user: MinimalUser | null,
  opts: { backendRegistered: boolean; extraListings?: number; plusExpiresAt?: string | null },
): MinimalUser | null {
  if (!user) return null;
  if (opts.extraListings != null && opts.extraListings > 0) {
    return {
      ...user,
      extraListings: Math.floor(opts.extraListings),
      ...(opts.plusExpiresAt ? { plusExpiresAt: opts.plusExpiresAt } : {}),
    };
  }
  if (!opts.backendRegistered) {
    return applyOptimisticPlusPublicationSlot(user);
  }
  return user;
}

/**
 * Konto standardowe: 1 darmowa publikacja + dokupione dodatkowe publikacje.
 * PRO/AGENCY/ADMIN mają nielimitowany dostęp.
 */
export function canPublishCountableListing(user: MinimalUser | null, existingCount: number): boolean {
  if (allowsMultipleCountableListings(user)) return true;
  const totalAllowed = 1 + getAdditionalListingSlots(user);
  return existingCount < totalAllowed;
}

const COUNTABLE_STATUSES = new Set([
  'ACTIVE',
  'PENDING',
  'PENDING_APPROVAL',
  'WAITING',
  'AWAITING_REVIEW',
  'IN_REVIEW',
]);

function extractOffersArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.offers)) return data.data.offers;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function normalizeCountableStatus(status: unknown): string {
  return String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export async function fetchCountableUserOffers(
  apiUrl: string,
  token: string,
  userId: number
): Promise<number> {
  try {
    const res = await fetch(`${apiUrl}/api/mobile/v1/offers?includeAll=true&userId=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    const offers = extractOffersArray(data);
    return offers.filter((o: { status?: string }) => COUNTABLE_STATUSES.has(normalizeCountableStatus(o.status))).length;
  } catch {
    return 0;
  }
}

