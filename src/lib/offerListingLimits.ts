export const FREE_BASE_LISTING_SLOTS = 1;
/** @deprecated PRO używa kredytów publikacji (`extraListings`), nie stałych slotów. */
export const PRO_BASE_LISTING_SLOTS = 0;

export type ListingLimitsUser = {
  isPro?: boolean | string | null;
  planType?: string | null;
  extraListings?: number | null;
  plusExpiresAt?: Date | string | null;
  proExpiresAt?: Date | string | null;
};

export function isPlusCreditActive(user: ListingLimitsUser): boolean {
  const credits = Number(user.extraListings || 0);
  if (!Number.isFinite(credits) || credits <= 0) return false;
  const expiry = user.plusExpiresAt || user.proExpiresAt;
  if (!expiry) return false;
  return new Date(expiry).getTime() > Date.now();
}

export function computeListingLimits(user: ListingLimitsUser | null | undefined) {
  const plan = String(user?.planType || '').toUpperCase();
  const isAgency = plan === 'AGENCY';
  const isPro = Boolean(
    user?.isPro === true ||
      user?.isPro === 'true' ||
      plan === 'INVESTOR' ||
      plan === 'PRO',
  );

  const publishCredits = isPlusCreditActive(user || {}) ? Number(user?.extraListings || 0) : 0;
  const basicSlots = !isPro && !isAgency ? FREE_BASE_LISTING_SLOTS : 0;
  const totalSlots = isAgency ? Number.POSITIVE_INFINITY : basicSlots + publishCredits;

  return {
    isAgency,
    isPro,
    baseSlots: isAgency ? null : basicSlots,
    plusCredits: publishCredits,
    publishCredits,
    totalSlots,
    proGoldSlots: 0,
    basicSlots,
  };
}
