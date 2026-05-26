import { PlanType } from '@prisma/client';

const DEFAULT_PRO_DAYS = 30;

/** Jednolite nadanie Investor Pro — admin, Stripe webhook, force-sync. */
export function buildInvestorProGrantData(days = DEFAULT_PRO_DAYS) {
  const proExpiresAt = new Date();
  proExpiresAt.setDate(proExpiresAt.getDate() + days);
  return {
    isPro: true,
    planType: PlanType.PRO,
    proExpiresAt,
  } as const;
}

export function buildInvestorProRevokeData() {
  return {
    isPro: false,
    planType: PlanType.INVESTOR,
    proExpiresAt: null,
  } as const;
}

export function isStripeInvestorProPlan(raw: unknown): boolean {
  const p = String(raw || '')
    .trim()
    .toLowerCase();
  return p === 'investor' || p === 'pro' || p === 'investor_pro' || p === 'investor-pro';
}
