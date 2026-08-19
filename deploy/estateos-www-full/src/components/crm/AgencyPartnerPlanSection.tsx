'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { formatAgencyDate, getAgencyFirm } from '@/i18n/agencyFirmDictionary';
import {
  PARTNER_FREE_PERIOD_DAYS,
  PARTNER_PAID_PERIOD_DAYS,
  PARTNER_PAID_PLANS,
  PARTNER_PLANS,
  getPartnerPlanById,
  type PartnerPlanId,
  describePartnerPlanChange,
  partnerStripePlanCodeFromId,
  formatAgentsLimit,
} from '@/lib/partnerPricing';

export type AgencyPartnerPlanPayload = {
  currentPlanId: PartnerPlanId | null;
  displayPlanId?: PartnerPlanId | null;
  isSubscriptionActive: boolean;
  plusExpiresAt: string | null;
  poolCredits: number;
  activeAgents: number;
  agentsLimit: number | null;
  daysRemaining: number | null;
  periodDays?: number | null;
  hasFreeSignup?: boolean;
  proTrialEligible?: boolean;
  isTrialing?: boolean;
};

const PLAN_RANK: Record<PartnerPlanId, number> = {
  free: 0,
  start: 1,
  pro: 2,
  enterprise: 3,
};

export default function AgencyPartnerPlanSection({
  id,
  partnerPlan,
  onCheckout,
  checkoutLoading,
  checkoutError,
}: {
  id?: string;
  partnerPlan: AgencyPartnerPlanPayload;
  onCheckout: (stripePlanCode: string) => void;
  checkoutLoading: string | null;
  checkoutError: string | null;
}) {
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get('upgrade') as PartnerPlanId | null;
  const { dict, locale } = useLocale();
  const t = getAgencyFirm(locale);
  const pp = t.partnerPlan;
  const p = dict.pricing;
  const partnerAgentsUnlimited = p?.partnerAgentsUnlimited ?? 'bez limitu';
  const partnerActivationNote =
    p?.partnerActivationNote ??
    'Wymaga konta administratora biura. Nie masz biura? Załóż je bezpłatnie przed aktywacją.';

  const proPlanPrice = getPartnerPlanById('pro')?.pricePln ?? 599;
  const hasActive = partnerPlan.isSubscriptionActive;
  const displayPlanId = partnerPlan.displayPlanId ?? partnerPlan.currentPlanId;
  const isFreeDisplay = displayPlanId === 'free';
  const periodDays =
    partnerPlan.periodDays ??
    (isFreeDisplay ? PARTNER_FREE_PERIOD_DAYS : PARTNER_PAID_PERIOD_DAYS);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedId, setSelectedId] = useState<PartnerPlanId>(
    displayPlanId && displayPlanId !== 'free' ? displayPlanId : 'pro',
  );

  useEffect(() => {
    if (!upgradeParam) return;
    if (!PARTNER_PAID_PLANS.some((plan) => plan.id === upgradeParam)) return;
    setSelectedId(upgradeParam);
    setShowUpgrade(true);
  }, [upgradeParam]);

  const currentPlan = PARTNER_PLANS.find((pl) => pl.id === displayPlanId) ?? null;
  const selectedPlan =
    PARTNER_PAID_PLANS.find((pl) => pl.id === selectedId) ?? PARTNER_PAID_PLANS[1];

  const upgradePlans = useMemo(() => {
    if (!hasActive || !partnerPlan.currentPlanId) return PARTNER_PAID_PLANS;
    const rank = PLAN_RANK[partnerPlan.currentPlanId];
    return PARTNER_PAID_PLANS.filter((pl) => PLAN_RANK[pl.id] > rank);
  }, [hasActive, partnerPlan.currentPlanId]);

  const changeLines = useMemo(
    () => describePartnerPlanChange({ from: currentPlan, to: selectedPlan }),
    [currentPlan, selectedPlan],
  );

  const agentsLimitLabel =
    partnerPlan.agentsLimit == null
      ? partnerAgentsUnlimited
      : `${partnerPlan.activeAgents} / ${partnerPlan.agentsLimit}`;

  const planLabel = (planId: PartnerPlanId | null) =>
    planId && pp.planLabels[planId] ? pp.planLabels[planId] : pp.activePartnerPool;

  const statusLabel = planLabel(displayPlanId);

  const showProTrialCheckoutOffer =
    Boolean(partnerPlan.proTrialEligible) &&
    selectedId === 'pro' &&
    !partnerPlan.isTrialing &&
    !(isFreeDisplay && (partnerPlan.daysRemaining ?? 0) > PARTNER_PAID_PERIOD_DAYS);

  const daysSuffix =
    partnerPlan.daysRemaining != null
      ? locale === 'pl'
        ? ` · pozostało ${partnerPlan.daysRemaining} dni`
        : locale === 'uk'
          ? ` · залишилось ${partnerPlan.daysRemaining} дн.`
          : ` · ${partnerPlan.daysRemaining} days left`
      : '';

  if (hasActive && !showUpgrade) {
    return (
      <section
        id={id}
        className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-[var(--eos-card)]"
      >
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                <Check size={12} /> {pp.activePackage}
              </span>
              {isFreeDisplay ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#b8922e]/35 bg-[#b8922e]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#8a6e2f]">
                  {pp.freePeriodBadge}
                </span>
              ) : null}
              {partnerPlan.isTrialing && !isFreeDisplay ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                  {pp.proTrialBadge}
                </span>
              ) : null}
            </div>
            <h2 className="text-2xl font-black text-[var(--eos-text)]">{statusLabel}</h2>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              {partnerPlan.plusExpiresAt
                ? pp.validUntil(formatAgencyDate(partnerPlan.plusExpiresAt, locale), daysSuffix)
                : pp.activePool}
              {isFreeDisplay ? pp.freePeriodNote(periodDays) : null}
              {isFreeDisplay ? pp.freePlanNote : null}
              {partnerPlan.isTrialing && !isFreeDisplay
                ? pp.proTrialNote(proPlanPrice, PARTNER_PAID_PERIOD_DAYS)
                : null}
              {!isFreeDisplay && !partnerPlan.isTrialing && displayPlanId
                ? pp.paidRenewalNote(
                    getPartnerPlanById(displayPlanId)?.pricePln ?? proPlanPrice,
                    PARTNER_PAID_PERIOD_DAYS,
                  )
                : null}
            </p>
          </div>

          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/80 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                {pp.creditsPoolLabel}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xl font-black text-[var(--eos-text)]">
                <Wallet size={16} className="text-emerald-500" />
                {partnerPlan.poolCredits}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/80 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                {pp.teamLabel}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xl font-black text-[var(--eos-text)]">
                <Users size={16} className="text-emerald-500" />
                {agentsLimitLabel}
              </p>
            </div>
          </div>
        </div>

        {upgradePlans.length > 0 ? (
          <div className="border-t border-emerald-500/15 px-6 py-4 md:px-8">
            <button
              type="button"
              onClick={() => {
                setShowUpgrade(true);
                setSelectedId(upgradePlans[0]?.id ?? 'enterprise');
              }}
              className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
            >
              <Zap size={14} /> {pp.upgradePackage}
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const plansToShow = hasActive && showUpgrade ? upgradePlans : PARTNER_PAID_PLANS;

  return (
    <section
      id={id}
      className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]"
    >
      <div className="border-b border-[var(--eos-border)] bg-gradient-to-r from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            {hasActive && showUpgrade ? (
              <button
                type="button"
                onClick={() => setShowUpgrade(false)}
                className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
              >
                {pp.backToActive}
              </button>
            ) : null}
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">
              <Sparkles size={14} /> {pp.agencyPackage}
            </p>
            <h2 className="text-2xl font-black text-[var(--eos-text)] md:text-3xl">
              {hasActive && showUpgrade
                ? pp.upgradeSubscription
                : hasActive
                  ? pp.upgradePackage
                  : pp.choosePaidPackage}
            </h2>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              {hasActive && showUpgrade
                ? pp.upgradeDiffNote
                : hasActive && isFreeDisplay
                  ? pp.freeUpgradeNote
                  : pp.ecosystemNote}
            </p>
          </div>

          {!hasActive ? (
            <div className="grid min-w-[min(100%,18rem)] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600">{pp.noActivePool}</p>
                <p className="mt-1 text-lg font-black text-amber-600">—</p>
                <p className="eos-muted-copy mt-1 text-xs">{pp.noActivePoolHint}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {plansToShow.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--eos-muted)]">{pp.highestPackage}</p>
      ) : (
        <>
          <div
            className={`grid gap-4 p-6 md:p-8 ${plansToShow.length === 1 ? 'max-w-md' : plansToShow.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
          >
            {plansToShow.map((plan) => {
              const isSelected = selectedId === plan.id;
              const agents = formatAgentsLimit(plan.maxAgents, partnerAgentsUnlimited);
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  className={[
                    'relative rounded-2xl border p-5 text-left transition-all',
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/[0.06] shadow-[0_0_0_1px_rgba(16,185,129,0.15)]'
                      : 'border-[var(--eos-border)] bg-[var(--eos-surface)]/40 hover:border-emerald-500/25',
                  ].join(' ')}
                >
                  {plan.highlighted ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-500">
                      <Crown size={10} /> {pp.recommended}
                    </span>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {pp.planLabels[plan.id]}
                  </p>
                  <p className="mt-2 text-3xl font-black text-[var(--eos-text)]">
                    {plan.pricePln}
                    <span className="ml-1 text-sm font-medium text-[var(--eos-muted)]">{pp.per30Days}</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[var(--eos-muted)]">
                    <li className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {pp.creditsOnPool(plan.creditsPerMonth)}
                    </li>
                    <li className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {pp.agentsInTeam(agents)}
                    </li>
                    {plan.id === 'start' ? (
                      <li className="flex gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-500/50" />
                        {pp.perkStartGap}
                      </li>
                    ) : (
                      <>
                        <li className="flex gap-2">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          {pp.perkOfficePro}
                        </li>
                        <li className="flex gap-2">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          {pp.perkReports}
                        </li>
                        <li className="flex gap-2">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          {pp.perkMarket}
                        </li>
                      </>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--eos-border)] bg-[var(--eos-surface)]/30 p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">
                  {pp.whatChanges(pp.planLabels[selectedPlan.id])}
                </h3>
                <ul className="mt-3 space-y-2">
                  {changeLines.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-[var(--eos-muted)]">
                      <ArrowRight size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 lg:min-w-[16rem]">
                {showProTrialCheckoutOffer ? (
                  <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-semibold leading-relaxed text-emerald-600">
                    {pp.trialCheckoutNote(proPlanPrice, PARTNER_PAID_PERIOD_DAYS)}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={Boolean(checkoutLoading)}
                  onClick={() => onCheckout(partnerStripePlanCodeFromId(selectedPlan.id))}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-black shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {checkoutLoading === partnerStripePlanCodeFromId(selectedPlan.id) ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Building2 size={18} />
                  )}
                  {showProTrialCheckoutOffer ? pp.trialCta : hasActive ? pp.upgradeCta : pp.activateCta}
                </button>
                <p className="text-center text-[10px] leading-relaxed text-[var(--eos-muted)]">
                  {partnerActivationNote}
                </p>
                {checkoutError ? (
                  <p className="text-center text-xs font-semibold text-red-500">{checkoutError}</p>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
