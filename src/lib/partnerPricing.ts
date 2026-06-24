/** Ceny i limity planów EstateOS™ Partner — jedno źródło prawdy (Krok 1: UI + copy). */

export const INVESTOR_PRO_PRICE_PLN = 249;
export const INVESTOR_PRO_WAS_PRICE_PLN = 299;
export const PAKIET_PLUS_PRICE_PLN = 49;

export type PartnerPlanId = 'free' | 'start' | 'pro' | 'enterprise';

export type PartnerPlanConfig = {
  id: PartnerPlanId;
  pricePln: number;
  creditsPerMonth: number;
  maxAgents: number | null;
  highlighted?: boolean;
};

/** Przy rejestracji biura — bez karty, bez Stripe. */
export const PARTNER_FREE_PLAN: PartnerPlanConfig = {
  id: 'free',
  pricePln: 0,
  creditsPerMonth: 5,
  maxAgents: 2,
  highlighted: true,
};

export const PARTNER_FREE_SIGNUP_PRODUCT = 'pl.estateos.partner.free_signup';
export const PARTNER_FREE_PERIOD_DAYS = 90;

export const PARTNER_PAID_PLANS: readonly PartnerPlanConfig[] = [
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
    creditsPerMonth: 100,
    maxAgents: null,
  },
] as const;

export const PARTNER_PLANS: readonly PartnerPlanConfig[] = [PARTNER_FREE_PLAN, ...PARTNER_PAID_PLANS];

export function isPaidPartnerPlanId(id: PartnerPlanId): boolean {
  return id !== 'free';
}

export function partnerCreditUnitPrice(plan: PartnerPlanConfig): number {
  if (plan.pricePln <= 0 || plan.creditsPerMonth <= 0) return 0;
  return Math.round(plan.pricePln / plan.creditsPerMonth);
}

export function formatAgentsLimit(maxAgents: number | null, unlimitedLabel: string): string {
  if (maxAgents == null) return unlimitedLabel;
  return String(maxAgents);
}

export function partnerStripePlanCodeFromId(id: PartnerPlanId): string {
  if (id === 'free') return 'partner_free';
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

/** Pure UI copy — safe for client components (no Prisma). */
export function describePartnerPlanChange(params: {
  from: PartnerPlanConfig | null;
  to: PartnerPlanConfig;
}): string[] {
  const { from, to } = params;
  const lines: string[] = [];

  lines.push(`+${to.creditsPerMonth} kredytów trafi na pulę firmy (okres 30 dni).`);

  const fromAgents = from?.maxAgents ?? null;
  const toAgents = to.maxAgents;
  if (fromAgents !== toAgents) {
    const fmt = (n: number | null) => (n == null ? 'bez limitu' : `do ${n}`);
    lines.push(`Limit agentów: ${fmt(fromAgents)} → ${fmt(toAgents)}.`);
  }

  if (!from || from.pricePln !== to.pricePln) {
    if (to.pricePln > 0) {
      lines.push(`Abonament: ${to.pricePln} zł / 30 dni (${Math.round(to.pricePln / to.creditsPerMonth)} zł za kredyt).`);
    }
  }

  if (from && from.id === to.id) {
    return [`Odnowienie tego samego pakietu — kolejna porcja ${to.creditsPerMonth} kredytów i przedłużenie ważności puli.`];
  }

  if (from && to.pricePln > from.pricePln) {
    lines.push('Wyższy pakiet — więcej kredytów i szerszy zespół w jednym panelu.');
  } else if (from && to.pricePln < from.pricePln) {
    lines.push('Niższy pakiet — sprawdź limit agentów przed zmianą.');
  } else if (!from) {
    lines.push('Aktywacja Partner — CRM, zespół, pula kredytów i Concierge w jednym miejscu.');
  }

  return lines;
}
