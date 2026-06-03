import { PlanType } from '@prisma/client';

export const PAKIET_PLUS_PRODUCT_IDS = new Set([
  'pl.estateos.app.pakiet_plus_30d',
]);

export const INVESTOR_PRO_IAP_PRODUCT_IDS = new Set([
  'pl.estateos.app.investor_pro_monthly',
  /** Legacy consumable / wcześniejszy ID — restore starych zakupów. */
  'pl.estateos.app.pakiet_investor_pro',
]);

export const PLUS_CREDIT_DAYS = 30;
/** Fallback gdy JWS nie zawiera expiresDate (tylko awaryjnie). */
export const INVESTOR_PRO_SUBSCRIPTION_FALLBACK_DAYS = 30;
/** Kredyty publikacji dołączane przy aktywacji / odnowieniu Investor Pro. */
export const INVESTOR_PRO_MONTHLY_CREDITS = 10;
/** Apple w trialu zwraca koniec triala (~3 dni), nie całego okresu rozliczeniowego. */
export const INVESTOR_PRO_TRIAL_WINDOW_DAYS = 8;

export function resolveInvestorProSubscriptionExpiry(
  subscriptionExpiresAt: Date | string | null | undefined,
  now = new Date(),
): Date {
  const fallback = new Date(
    now.getTime() + INVESTOR_PRO_SUBSCRIPTION_FALLBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const parsed =
    subscriptionExpiresAt != null ? new Date(subscriptionExpiresAt) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    return fallback;
  }
  const remainingDays = (parsed.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (remainingDays <= INVESTOR_PRO_TRIAL_WINDOW_DAYS) {
    return new Date(Math.max(parsed.getTime(), fallback.getTime()));
  }
  return parsed;
}

export function isPakietPlusProductId(productId: string) {
  return PAKIET_PLUS_PRODUCT_IDS.has(String(productId || '').trim());
}

export function isInvestorProProductId(productId: string) {
  return INVESTOR_PRO_IAP_PRODUCT_IDS.has(String(productId || '').trim());
}

export function isInvestorProSubscriptionProductId(productId: string) {
  return isInvestorProProductId(productId);
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

/** Dekoduje payload StoreKit 2 JWS (bez pełnej weryfikacji certyfikatu — jak reszta IAP). */
export function decodeAppleStoreKitJwsPayload(jws: string | null | undefined): Record<string, unknown> | null {
  const token = String(jws || '').trim();
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readAppleTimestampMs(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

/** Data końca bieżącego okresu subskrypcji z JWS Apple (trial lub renewal). */
export function extractSubscriptionExpiresAtFromJws(
  jws: string | null | undefined,
  now = new Date(),
): Date | null {
  const payload = decodeAppleStoreKitJwsPayload(jws);
  if (!payload) return null;
  const expiresMs =
    readAppleTimestampMs(payload.expiresDate) ??
    readAppleTimestampMs(payload.expiresDateMs) ??
    readAppleTimestampMs(payload.expirationDate);
  if (expiresMs == null) return null;
  const expiresAt = new Date(expiresMs);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime() ? expiresAt : null;
}

/** Subskrypcja Investor Pro — ustaw proExpiresAt wg Apple (trial 3 dni lub renewal). */
export function buildInvestorProSubscriptionUserUpdate(
  subscriptionExpiresAt: Date | string | null | undefined,
  currentProExpiresAt: Date | string | null | undefined,
  currentPlusExpiresAt: Date | string | null | undefined = null,
  now = new Date(),
  options?: { grantMonthlyCredits?: boolean },
) {
  const fromApple = resolveInvestorProSubscriptionExpiry(subscriptionExpiresAt, now);
  const currentMs = currentProExpiresAt ? new Date(currentProExpiresAt).getTime() : 0;
  const proExpiresAt =
    Number.isFinite(currentMs) && currentMs > fromApple.getTime()
      ? new Date(currentMs)
      : fromApple;

  const update: {
    isPro: true;
    planType: PlanType;
    proExpiresAt: Date;
    extraListings?: { increment: number };
    plusExpiresAt?: Date;
  } = {
    isPro: true,
    planType: PlanType.PRO,
    proExpiresAt,
  };

  if (options?.grantMonthlyCredits) {
    update.extraListings = { increment: INVESTOR_PRO_MONTHLY_CREDITS };
    const currentPlusMs = currentPlusExpiresAt ? new Date(currentPlusExpiresAt).getTime() : 0;
    update.plusExpiresAt = new Date(Math.max(currentPlusMs, proExpiresAt.getTime()));
  }

  return update;
}

/** @deprecated Consumable — używaj buildInvestorProSubscriptionUserUpdate dla subskrypcji. */
export function buildInvestorProIapUserUpdate(
  currentProExpiresAt: Date | string | null | undefined,
  days = INVESTOR_PRO_SUBSCRIPTION_FALLBACK_DAYS,
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
