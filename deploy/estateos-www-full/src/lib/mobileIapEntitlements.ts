export const PAKIET_PLUS_PRODUCT_IDS = new Set([
  'pl.estateos.app.pakiet_plus_30d',
]);

export const INVESTOR_PRO_IAP_PRODUCT_IDS = new Set([
  'pl.estateos.app.pakiet_investor_pro',
]);

export const PLUS_CREDIT_DAYS = 30;
export const INVESTOR_PRO_IAP_DAYS = 30;

export function isPakietPlusProductId(productId: string) {
  return PAKIET_PLUS_PRODUCT_IDS.has(String(productId || '').trim());
}

export function isInvestorProProductId(productId: string) {
  return INVESTOR_PRO_IAP_PRODUCT_IDS.has(String(productId || '').trim());
}

export function isSupportedIapProductId(productId: string) {
  return isPakietPlusProductId(productId) || isInvestorProProductId(productId);
}

export function calculatePlusCreditExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PLUS_CREDIT_DAYS * 24 * 60 * 60 * 1000);
}

export function buildPakietPlusUserUpdate(now = new Date()) {
  return {
    extraListings: { increment: 1 },
    plusExpiresAt: calculatePlusCreditExpiresAt(now),
  };
}

/** IAP Investor Pro — przedłużenie o 30 dni od max(teraz, bieżącego proExpiresAt). */
export function buildInvestorProIapUserUpdate(
  currentProExpiresAt: Date | string | null | undefined,
  days = INVESTOR_PRO_IAP_DAYS,
) {
  const now = Date.now();
  const currentMs = currentProExpiresAt ? new Date(currentProExpiresAt).getTime() : 0;
  const baseMs = Number.isFinite(currentMs) && currentMs > now ? currentMs : now;
  const proExpiresAt = new Date(baseMs + days * 24 * 60 * 60 * 1000);
  return {
    isPro: true,
    planType: 'PRO' as const,
    proExpiresAt,
  };
}
