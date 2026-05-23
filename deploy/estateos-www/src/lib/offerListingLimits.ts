export const FREE_BASE_LISTING_SLOTS = 1;
export const PRO_BASE_LISTING_SLOTS = 3;

export type ListingLimitsUser = {
  isPro?: boolean | string | null;
  planType?: string | null;
  extraListings?: number | null;
  plusExpiresAt?: Date | string | null;
};

export function isPlusCreditActive(user: ListingLimitsUser): boolean {
  return Boolean(
    Number(user.extraListings || 0) > 0 &&
      user.plusExpiresAt &&
      new Date(user.plusExpiresAt).getTime() > Date.now()
  );
}

export function computeListingLimits(user: ListingLimitsUser | null | undefined) {
  const plan = String(user?.planType || '').toUpperCase();
  const isAgency = plan === 'AGENCY';
  const isPro = Boolean(
    user?.isPro === true ||
      user?.isPro === 'true' ||
      plan === 'INVESTOR' ||
      plan === 'PRO'
  );

  const plusCredits = isPlusCreditActive(user || {}) ? Number(user?.extraListings || 0) : 0;
  const baseSlots = isAgency
    ? Number.POSITIVE_INFINITY
    : isPro
      ? PRO_BASE_LISTING_SLOTS
      : FREE_BASE_LISTING_SLOTS;

  const totalSlots = isAgency ? Number.POSITIVE_INFINITY : baseSlots + plusCredits;

  return {
    isAgency,
    isPro,
    baseSlots: isAgency ? null : baseSlots,
    plusCredits,
    totalSlots,
    proGoldSlots: isPro && !isAgency ? PRO_BASE_LISTING_SLOTS : isAgency ? 0 : 0,
    basicSlots: !isPro && !isAgency ? FREE_BASE_LISTING_SLOTS : 0,
  };
}
