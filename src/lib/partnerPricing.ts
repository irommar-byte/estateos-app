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
    creditsPerMonth: 100,
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
    lines.push(`Abonament: ${to.pricePln} zł / 30 dni (${Math.round(to.pricePln / to.creditsPerMonth)} zł za kredyt).`);
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
