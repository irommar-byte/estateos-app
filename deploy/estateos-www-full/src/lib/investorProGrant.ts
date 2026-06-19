import { PlanType } from '@prisma/client';

export const INVESTOR_PRO_PUBLICATION_CREDITS = 5;
const DEFAULT_PRO_DAYS = 30;

/** Jednolite nadanie Investor Pro — admin, Stripe webhook, force-sync. */
export function buildInvestorProGrantData(days = DEFAULT_PRO_DAYS) {
  const proExpiresAt = new Date();
  proExpiresAt.setDate(proExpiresAt.getDate() + days);
  return {
    isPro: true,
    planType: PlanType.PRO,
    proExpiresAt,
    extraListings: INVESTOR_PRO_PUBLICATION_CREDITS,
    plusExpiresAt: proExpiresAt,
  } as const;
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

/** Użytkownicy PRO sprzed migracji slotów → kredytów (jednorazowo, bez nadpisywania zużytych pul). */
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

export function buildInvestorProCreditsBackfillData(user: {
  proExpiresAt: Date | string;
}) {
  const proExpiresAt = new Date(user.proExpiresAt);
  return {
    extraListings: INVESTOR_PRO_PUBLICATION_CREDITS,
    plusExpiresAt: proExpiresAt,
  } as const;
}
