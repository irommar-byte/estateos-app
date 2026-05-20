export const PAKIET_PLUS_PRODUCT_IDS = new Set([
  'pl.estateos.app.pakiet_plus_30d',
]);

export const PLUS_CREDIT_DAYS = 30;

export function isPakietPlusProductId(productId: string) {
  return PAKIET_PLUS_PRODUCT_IDS.has(String(productId || '').trim());
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
