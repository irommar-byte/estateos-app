/** Ceny i limity planów EstateOS™ Partner — jedno źródło prawdy (Krok 1: UI + copy). */

export const INVESTOR_PRO_PRICE_PLN = 249;
export const INVESTOR_PRO_WAS_PRICE_PLN = 299;
export const PAKIET_PLUS_PRICE_PLN = 49;

export type PartnerPlanId = 'start' | 'pro' | 'enterprise';

export type PartnerPlanConfig = {
  id: PartnerPlanId;
  pricePln: number;
  creditsPerMonth: number;
  maxAgents: number | null;
  highlighted?: boolean;
};

export const PARTNER_PLANS: readonly PartnerPlanConfig[] = [
  {
    id: 'start',
    pricePln: 449,
    creditsPerMonth: 15,
    maxAgents: 5,
  },
  {
    id: 'pro',
    pricePln: 999,
    creditsPerMonth: 50,
    maxAgents: 20,
    highlighted: true,
  },
  {
    id: 'enterprise',
    pricePln: 1499,
    creditsPerMonth: 80,
    maxAgents: null,
  },
] as const;

export function partnerCreditUnitPrice(plan: PartnerPlanConfig): number {
  return Math.round(plan.pricePln / plan.creditsPerMonth);
}

export function formatAgentsLimit(maxAgents: number | null, unlimitedLabel: string): string {
  if (maxAgents == null) return unlimitedLabel;
  return String(maxAgents);
}

export function partnerStripePlanCodeFromId(id: PartnerPlanId): string {
  if (id === 'start') return 'partner_start';
  if (id === 'pro') return 'partner_pro';
  return 'partner_enterprise';
}

export function partnerStripeAmountGrosze(plan: PartnerPlanConfig): number {
  return plan.pricePln * 100;
}

export function getPartnerPlanById(id: PartnerPlanId): PartnerPlanConfig | undefined {
  return PARTNER_PLANS.find((p) => p.id === id);
}
