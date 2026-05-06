/**
 * Non‑PRO viewers see limited details until this many hours have passed since
 * publication; then the offer behaves like „on the wide market”.
 * PRO bypasses immediately.
 */
export const OFFER_PREMARKET_EMBARGO_HOURS = 24 as const;

export function offerPremarketUnlockMs(
  createdAt: string | Date | null | undefined
): number {
  const created = createdAt ? new Date(createdAt).getTime() : Date.now();
  return created + OFFER_PREMARKET_EMBARGO_HOURS * 3600 * 1000;
}
