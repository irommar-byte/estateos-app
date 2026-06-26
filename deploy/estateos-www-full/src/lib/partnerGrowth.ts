import type { CompanyPartnerPlanSnapshot } from '@/lib/partnerPlanStatus';
import {
  getPartnerPlanById,
  PARTNER_PAID_PLANS,
  PAKIET_PLUS_PRICE_PLN,
  partnerCreditUnitPrice,
  partnerSavingsPercentVsRetail,
  type PartnerPlanId,
} from '@/lib/partnerPricing';

export type PartnerGrowthSeverity = 'info' | 'warning' | 'urgent';

export type PartnerGrowthKind =
  | 'free_activate'
  | 'free_low_credits'
  | 'free_expiring'
  | 'pool_expired'
  | 'paid_low_credits'
  | 'agent_limit'
  | 'upgrade_value';

export type PartnerGrowthInsight = {
  kind: PartnerGrowthKind;
  severity: PartnerGrowthSeverity;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  recommendedPlanId: PartnerPlanId;
  savingsPln?: number;
  savingsPercent?: number;
  emailSubject?: string;
};

export function recommendPaidPlanForOffice(params: {
  poolCredits: number;
  activeAgents: number;
  currentPlanId: PartnerPlanId | null;
}): PartnerPlanId {
  if (params.activeAgents >= 6) return 'enterprise';
  if (params.activeAgents >= 4 || params.poolCredits <= 3) return 'pro';
  return 'start';
}

export function computeMonthlySavingsVsRetail(planId: PartnerPlanId): number {
  const plan = getPartnerPlanById(planId);
  if (!plan || plan.pricePln <= 0) return 0;
  return Math.max(0, plan.creditsPerMonth * PAKIET_PLUS_PRICE_PLN - plan.pricePln);
}

function planLabel(id: PartnerPlanId): string {
  if (id === 'start') return 'Start';
  if (id === 'pro') return 'Pro';
  if (id === 'enterprise') return 'Enterprise';
  return 'Free';
}

export function computePartnerGrowthInsight(params: {
  partnerPlan: Pick<
    CompanyPartnerPlanSnapshot,
    | 'currentPlanId'
    | 'displayPlanId'
    | 'isSubscriptionActive'
    | 'poolCredits'
    | 'activeAgents'
    | 'agentsLimit'
    | 'daysRemaining'
    | 'isTrialing'
  >;
  companyName?: string;
}): PartnerGrowthInsight | null {
  const p = params.partnerPlan;
  const recommended = recommendPaidPlanForOffice({
    poolCredits: p.poolCredits,
    activeAgents: p.activeAgents,
    currentPlanId: p.currentPlanId,
  });
  const plan = getPartnerPlanById(recommended);
  if (!plan) return null;

  const savings = computeMonthlySavingsVsRetail(recommended);
  const savingsPct = partnerSavingsPercentVsRetail(plan);
  const unitPrice = partnerCreditUnitPrice(plan);
  const ctaHref = `/moje-konto/firma?upgrade=${recommended}#pakiet`;
  const isFree =
    (p.displayPlanId ?? p.currentPlanId) === 'free' && !p.isTrialing;
  const proPlan = getPartnerPlanById('pro');

  if (!p.isSubscriptionActive) {
    return {
      kind: 'pool_expired',
      severity: 'urgent',
      title: 'Pula kredytów wygasła',
      body: `Odnów pakiet Partner, aby zespół mógł dalej publikować oferty${params.companyName ? ` w ${params.companyName}` : ''}.`,
      ctaLabel: 'Wybierz pakiet',
      ctaHref: '/cennik?tab=partner',
      recommendedPlanId: recommended,
      savingsPln: savings,
      savingsPercent: savingsPct,
      emailSubject: 'Pula EstateOS wygasła — odnów publikacje biura',
    };
  }

  if (isFree && p.daysRemaining != null && p.daysRemaining <= 14) {
    return {
      kind: 'free_expiring',
      severity: p.daysRemaining <= 7 ? 'urgent' : 'warning',
      title: `Partner Free kończy się za ${p.daysRemaining} dni`,
      body: `Zachowaj Concierge i katalog — Partner ${planLabel(recommended)} (${plan.pricePln} zł) daje ${plan.creditsPerMonth} publikacji po ${unitPrice} zł. Oszczędzasz ok. ${savings} zł/mies. vs kupowanie pojedynczo.`,
      ctaLabel: `Ulepsz do ${planLabel(recommended)} — ${plan.pricePln} zł`,
      ctaHref,
      recommendedPlanId: recommended,
      savingsPln: savings,
      savingsPercent: savingsPct,
      emailSubject: `Partner Free — zostało ${p.daysRemaining} dni`,
    };
  }

  if (isFree && p.poolCredits <= 2 && p.poolCredits > 0) {
    const proPrice = proPlan?.pricePln ?? 599;
    const proCredits = proPlan?.creditsPerMonth ?? 45;
    return {
      kind: 'free_low_credits',
      severity: 'warning',
      title: 'Kończy się pula startowa',
      body: `Zostało ${p.poolCredits} kredyt${p.poolCredits === 1 ? '' : 'y'}. Partner Pro (${proPrice} zł) = ${proCredits} publikacji — jedna prowizja od transakcji pokrywa rok systemu.`,
      ctaLabel: 'Zobacz Partner Pro',
      ctaHref: '/moje-konto/firma?upgrade=pro#pakiet',
      recommendedPlanId: 'pro',
      savingsPln: computeMonthlySavingsVsRetail('pro'),
      savingsPercent: proPlan ? partnerSavingsPercentVsRetail(proPlan) : 73,
      emailSubject: 'Kończy się pula Partner Free',
    };
  }

  if (!isFree && p.poolCredits <= 2) {
    return {
      kind: 'paid_low_credits',
      severity: p.poolCredits === 0 ? 'urgent' : 'warning',
      title: p.poolCredits === 0 ? 'Brak kredytów w puli' : 'Mało kredytów w puli',
      body:
        p.poolCredits === 0
          ? `Zespół nie może publikować nowych ofert. Odnów lub ulepsz pakiet — ${plan.creditsPerMonth} kredytów za ${plan.pricePln} zł.`
          : `Pozostało ${p.poolCredits} kredytów. Ulepsz pakiet — ${plan.creditsPerMonth} publikacji za ${plan.pricePln} zł (${unitPrice} zł/szt.).`,
      ctaLabel: 'Ulepsz pakiet',
      ctaHref,
      recommendedPlanId: recommended,
      savingsPln: savings,
      savingsPercent: savingsPct,
      emailSubject: 'Pula publikacji biura się kończy',
    };
  }

  if (
    p.agentsLimit != null &&
    p.activeAgents >= p.agentsLimit - 1 &&
    p.agentsLimit > 1
  ) {
    const nextPlan = PARTNER_PAID_PLANS.find((pl) => (pl.maxAgents ?? 999) > (p.agentsLimit ?? 0));
    if (nextPlan) {
      return {
        kind: 'agent_limit',
        severity: 'warning',
        title: 'Limit agentów prawie osiągnięty',
        body: `Masz ${p.activeAgents}/${p.agentsLimit} miejsc w zespole. Partner ${planLabel(nextPlan.id)} rozszerza limit i obniża koszt publikacji.`,
        ctaLabel: `Ulepsz do ${planLabel(nextPlan.id)}`,
        ctaHref: `/moje-konto/firma?upgrade=${nextPlan.id}#pakiet`,
        recommendedPlanId: nextPlan.id,
        savingsPln: computeMonthlySavingsVsRetail(nextPlan.id),
        savingsPercent: partnerSavingsPercentVsRetail(nextPlan),
        emailSubject: 'Zbliżasz się do limitu agentów w biurze',
      };
    }
  }

  if (isFree && p.poolCredits >= 3 && (p.daysRemaining ?? 90) > 14) {
    return {
      kind: 'free_activate',
      severity: 'info',
      title: 'Masz Partner Free — wykorzystaj go',
      body: `${p.poolCredits} kredytów i Concierge czekają. Opublikuj pierwszą ofertę — kupujący z Radaru zobaczą Cię w katalogu agencji.`,
      ctaLabel: 'Dodaj ofertę',
      ctaHref: '/dodaj-oferte',
      recommendedPlanId: 'start',
    };
  }

  if (!isFree && p.currentPlanId === 'start' && (p.poolCredits < 8 || p.activeAgents >= 4) && proPlan) {
    return {
      kind: 'upgrade_value',
      severity: 'info',
      title: 'Pro opłaca się przy Twoim wolumenie',
      body: `${p.activeAgents} agentów i aktywna pula — Partner Pro (${proPlan.pricePln} zł) to ${proPlan.creditsPerMonth} publikacji po ${partnerCreditUnitPrice(proPlan)} zł (oszczędność ~${computeMonthlySavingsVsRetail('pro')} zł/mies.).`,
      ctaLabel: 'Przejdź na Pro',
      ctaHref: '/moje-konto/firma?upgrade=pro#pakiet',
      recommendedPlanId: 'pro',
      savingsPln: computeMonthlySavingsVsRetail('pro'),
      savingsPercent: partnerSavingsPercentVsRetail(proPlan),
      emailSubject: 'Partner Pro — lepsza matematyka dla Twojego biura',
    };
  }

  return null;
}

export function growthTouchKey(params: {
  kind: string;
  companyId: number;
  userId: number;
  bucket?: string;
}): string {
  return `partner-growth:${params.kind}:c${params.companyId}:u${params.userId}${params.bucket ? `:${params.bucket}` : ''}`;
}

/** Kiedy wysłać e-mail nurture (dni do końca Free lub bucket niskiej puli). */
export function growthEmailBuckets(insight: PartnerGrowthInsight, daysRemaining: number | null): string[] {
  const buckets: string[] = [];
  if (insight.kind === 'free_expiring' && daysRemaining != null) {
    if (daysRemaining <= 3) buckets.push('d3');
    else if (daysRemaining <= 7) buckets.push('d7');
    else if (daysRemaining <= 14) buckets.push('d14');
    else if (daysRemaining <= 30) buckets.push('d30');
    else if (daysRemaining <= 60) buckets.push('d60');
  }
  if (insight.kind === 'free_low_credits' || insight.kind === 'paid_low_credits') {
    buckets.push(`credits-${insight.severity}`);
  }
  if (insight.kind === 'pool_expired') buckets.push('expired');
  if (insight.kind === 'upgrade_value') buckets.push('upgrade-hint');
  if (insight.kind === 'agent_limit') buckets.push('agents');
  if (insight.kind === 'free_activate' && daysRemaining != null && daysRemaining <= 60 && daysRemaining > 30) {
    buckets.push('mid60');
  }
  return buckets;
}
