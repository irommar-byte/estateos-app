import { PlanType } from '@prisma/client';
import {
  INVESTOR_PRO_MONTHLY_CREDITS,
  INVESTOR_PRO_SUBSCRIPTION_FALLBACK_DAYS,
} from '@/lib/mobileIapEntitlements';

/** Kredyty publikacji w pakiecie Investor Pro (zgodne z IAP). */
export const INVESTOR_PRO_PUBLICATION_CREDITS = INVESTOR_PRO_MONTHLY_CREDITS;

/** Jednolite nadanie Investor Pro — admin, Stripe webhook, force-sync. */
export function buildInvestorProGrantData(
  days = INVESTOR_PRO_SUBSCRIPTION_FALLBACK_DAYS,
  options?: { grantPublicationCredits?: boolean },
) {
  const now = new Date();
  const proExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const base = {
    isPro: true,
    planType: PlanType.PRO,
    proExpiresAt,
  } as const;

  if (options?.grantPublicationCredits === false) {
    return base;
  }

  return {
    ...base,
    extraListings: { increment: INVESTOR_PRO_MONTHLY_CREDITS },
    plusExpiresAt: proExpiresAt,
  };
}

export function buildInvestorProRevokeData() {
  return {
    isPro: false,
    planType: PlanType.INVESTOR,
    proExpiresAt: null,
    extraListings: 0,
    plusExpiresAt: null,
  } as const;
}

export function isStripeInvestorProPlan(raw: unknown): boolean {
  const p = String(raw || '')
    .trim()
    .toLowerCase();
  return p === 'investor' || p === 'pro' || p === 'investor_pro' || p === 'investor-pro';
}

/** Aktywni PRO bez puli kredytów (np. grant sprzed migracji) — uzupełnij przy odczycie portfela. */
export function shouldBackfillInvestorProCredits(user: {
  isPro?: boolean | null;
  proExpiresAt?: Date | string | null;
  extraListings?: number | null;
  plusExpiresAt?: Date | string | null;
}): boolean {
  if (!user?.isPro || !user.proExpiresAt) return false;
  if (new Date(user.proExpiresAt).getTime() <= Date.now()) return false;
  const credits = Number(user.extraListings ?? 0);
  if (credits > 0) return false;
  if (!user.plusExpiresAt) return true;
  return new Date(user.plusExpiresAt).getTime() <= Date.now();
}

export function buildInvestorProCreditsBackfillData(user: { proExpiresAt: Date | string }) {
  const proExpiresAt = new Date(user.proExpiresAt);
  return {
    extraListings: INVESTOR_PRO_MONTHLY_CREDITS,
    plusExpiresAt: proExpiresAt,
  } as const;
}
