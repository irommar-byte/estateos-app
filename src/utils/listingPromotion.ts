export function isOfferPromotionActive(until: Date | string | null | undefined): boolean {
  if (!until) return false;
  const date = until instanceof Date ? until : new Date(String(until));
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function isOfferFeatured(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw) return false;
  if (raw.featured === true) return true;
  return isOfferPromotionActive(raw.promotedUntil as Date | string | null | undefined);
}
