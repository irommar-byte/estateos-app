/** Ceny i limity planów EstateOS™ Partner — jedno źródło prawdy (UI + Stripe). */

export const INVESTOR_PRO_PRICE_PLN = 249;
export const INVESTOR_PRO_WAS_PRICE_PLN = 299;
export const PAKIET_PLUS_PRICE_PLN = 49;

export type PartnerPlanId = 'free' | 'start' | 'pro' | 'enterprise';

export type PartnerPlanConfig = {
  id: PartnerPlanId;
  pricePln: number;
  /** Kotwica marketingowa (przekreślona cena na /cennik). */
  wasPricePln?: number;
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
/** Okres startowy Partner Free przy rejestracji biura — zgodny z /cennik. */
export const PARTNER_FREE_PERIOD_DAYS = 90;
/** Okres rozliczeniowy płatnych pakietów Partner i trialu Pro. */
export const PARTNER_PAID_PERIOD_DAYS = 30;

/**
 * Płatne pakiety — drabinka zaprojektowana pod upsell:
 * - Start: próg <300 zł, ~20 zł/kredyt (−59% vs detal 49 zł)
 * - Pro: 2× cena Start, 3× kredyty — oczywisty sweet spot
 * - Enterprise: 100 kredytów po 10 zł — dla sieci i wolumenu
 */
export const PARTNER_PAID_PLANS: readonly PartnerPlanConfig[] = [
  {
    id: 'start',
    pricePln: 299,
    wasPricePln: 449,
    creditsPerMonth: 15,
    maxAgents: 5,
  },
  {
    id: 'pro',
    pricePln: 599,
    wasPricePln: 999,
    creditsPerMonth: 45,
    maxAgents: 15,
    highlighted: true,
  },
  {
    id: 'enterprise',
    pricePln: 999,
    wasPricePln: 1499,
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

/** Oszczędność vs detal (Pakiet + 49 zł / kredyt). */
export function partnerSavingsPercentVsRetail(plan: PartnerPlanConfig): number {
  const unit = partnerCreditUnitPrice(plan);
  if (unit <= 0) return 0;
  return Math.max(0, Math.round((1 - unit / PAKIET_PLUS_PRICE_PLN) * 100));
}

/** Od ilu publikacji/mies. abonament wygrywa z kupowaniem pojedynczych kredytów. */
export function partnerBreakEvenCreditsPerMonth(plan: PartnerPlanConfig): number {
  if (plan.pricePln <= 0) return 0;
  return Math.ceil(plan.pricePln / PAKIET_PLUS_PRICE_PLN);
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
      const savings = partnerSavingsPercentVsRetail(to);
      lines.push(
        `Abonament: ${to.pricePln} zł / 30 dni (${partnerCreditUnitPrice(to)} zł za kredyt — ${savings}% taniej niż Pakiet +).`,
      );
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

  if (to.id === 'pro' || to.id === 'enterprise') {
    lines.push(
      'Cały zespół (aktywni agenci i kierownik) dostaje status Pro: Off Market, Market na każdej ofercie, taśmy „Przy aktach” i tytanowe okienko w aplikacji.',
    );
    lines.push('5 raportów wyceny na e-mail do klientów — na osobę, w okresie 30 dni. Bez kredytów publikacji Investor Pro.');
  } else if (to.id === 'start') {
    lines.push(
      'Partner Start nie odblokowuje Off Market, Market przy aktach, taśm w katalogu ani raportów e-mail — to zalety Partner Pro, najchętniej wybieranego pakietu.',
    );
  }

  return lines;
}
