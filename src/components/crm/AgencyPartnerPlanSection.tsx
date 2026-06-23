'use client';

import { useMemo, useState } from 'react';
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
import {
  PARTNER_PLANS,
  type PartnerPlanId,
  describePartnerPlanChange,
  partnerCreditUnitPrice,
  partnerStripePlanCodeFromId,
  formatAgentsLimit,
} from '@/lib/partnerPricing';

export type AgencyPartnerPlanPayload = {
  currentPlanId: PartnerPlanId | null;
  isSubscriptionActive: boolean;
  plusExpiresAt: string | null;
  poolCredits: number;
  activeAgents: number;
  agentsLimit: number | null;
  daysRemaining: number | null;
  lastPurchaseAt: string | null;
  proTrialEligible?: boolean;
  isTrialing?: boolean;
};

const PLAN_LABELS: Record<PartnerPlanId, string> = {
  start: 'Partner Start',
  pro: 'Partner Pro',
  enterprise: 'Partner Enterprise',
};

const PLAN_RANK: Record<PartnerPlanId, number> = {
  start: 1,
  pro: 2,
  enterprise: 3,
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pl-PL', { dateStyle: 'long' });
}

export default function AgencyPartnerPlanSection({
  partnerPlan,
  onCheckout,
  checkoutLoading,
  checkoutError,
}: {
  partnerPlan: AgencyPartnerPlanPayload;
  onCheckout: (stripePlanCode: string) => void;
  checkoutLoading: string | null;
  checkoutError: string | null;
}) {
  const { dict } = useLocale();
  const p = dict.pricing;
  const partnerAgentsUnlimited = p?.partnerAgentsUnlimited ?? 'bez limitu';
  const partnerActivationNote =
    p?.partnerActivationNote ??
    'Wymaga konta administratora biura. Nie masz biura? Załóż je bezpłatnie przed aktywacją.';

  const hasActive = partnerPlan.isSubscriptionActive;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedId, setSelectedId] = useState<PartnerPlanId>(
    partnerPlan.currentPlanId ?? 'pro',
  );

  const currentPlan = PARTNER_PLANS.find((pl) => pl.id === partnerPlan.currentPlanId) ?? null;
  const selectedPlan = PARTNER_PLANS.find((pl) => pl.id === selectedId) ?? PARTNER_PLANS[1];

  const upgradePlans = useMemo(() => {
    if (!hasActive || !partnerPlan.currentPlanId) return PARTNER_PLANS;
    const rank = PLAN_RANK[partnerPlan.currentPlanId];
    return PARTNER_PLANS.filter((pl) => PLAN_RANK[pl.id] > rank);
  }, [hasActive, partnerPlan.currentPlanId]);

  const changeLines = useMemo(
    () => describePartnerPlanChange({ from: currentPlan, to: selectedPlan }),
    [currentPlan, selectedPlan],
  );

  const agentsLimitLabel =
    partnerPlan.agentsLimit == null
      ? partnerAgentsUnlimited
      : `${partnerPlan.activeAgents} / ${partnerPlan.agentsLimit}`;

  const statusLabel =
    partnerPlan.currentPlanId && PLAN_LABELS[partnerPlan.currentPlanId]
      ? PLAN_LABELS[partnerPlan.currentPlanId]
      : 'Aktywna pula Partner';

  const showProTrial =
    Boolean(partnerPlan.proTrialEligible) &&
    selectedId === 'pro' &&
    !hasActive;

  if (hasActive && !showUpgrade) {
    return (
      <section className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-[var(--eos-card)]">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                <Check size={12} /> Aktywny pakiet
              </span>
              {partnerPlan.isTrialing ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                  Okres próbny
                </span>
              ) : null}
            </div>
            <h2 className="text-2xl font-black text-[var(--eos-text)]">{statusLabel}</h2>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              {partnerPlan.plusExpiresAt
                ? `Ważne do ${fmtDate(partnerPlan.plusExpiresAt)}${
                    partnerPlan.daysRemaining != null ? ` · pozostało ${partnerPlan.daysRemaining} dni` : ''
                  }`
                : 'Aktywna pula kredytów firmy.'}
              {partnerPlan.isTrialing
                ? ' Po okresie próbnym pobierzemy 999 zł za kolejne 30 dni — anulujesz w dowolnym momencie przed końcem trialu.'
                : null}
            </p>
          </div>

          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/80 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">Pula kredytów</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-black text-[var(--eos-text)]">
                <Wallet size={16} className="text-emerald-500" />
                {partnerPlan.poolCredits}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/80 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">Zespół</p>
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
              <Zap size={14} /> Ulepsz pakiet
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const plansToShow = hasActive && showUpgrade ? upgradePlans : PARTNER_PLANS;

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
      <div className="border-b border-[var(--eos-border)] bg-gradient-to-r from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            {hasActive && showUpgrade ? (
              <button
                type="button"
                onClick={() => setShowUpgrade(false)}
                className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
              >
                ← Wróć do aktywnego pakietu
              </button>
            ) : null}
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">
              <Sparkles size={14} /> Pakiet agencji
            </p>
            <h2 className="text-2xl font-black text-[var(--eos-text)] md:text-3xl">
              {hasActive && showUpgrade ? 'Ulepsz abonament biura' : 'EstateOS™ Partner — wybierz pakiet'}
            </h2>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              {hasActive && showUpgrade
                ? 'Dopłać różnicę i od razu zyskujesz wyższy limit agentów oraz większą pulę kredytów.'
                : 'Kredyty publikacji, limit zespołu i CRM w jednym miejscu.'}
            </p>
          </div>

          {!hasActive ? (
            <div className="grid min-w-[min(100%,18rem)] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600">Status</p>
                <p className="mt-1 text-lg font-black text-amber-600">Brak aktywnego pakietu</p>
                <p className="eos-muted-copy mt-1 text-xs">Aktywuj pakiet, aby korzystać z puli kredytów firmy.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {plansToShow.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--eos-muted)]">
          Masz już najwyższy pakiet Partner Enterprise.
        </p>
      ) : (
        <>
          <div className={`grid gap-4 p-6 md:p-8 ${plansToShow.length === 1 ? 'max-w-md' : plansToShow.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
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
                      <Crown size={10} /> Polecany
                    </span>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {PLAN_LABELS[plan.id]}
                  </p>
                  <p className="mt-2 text-3xl font-black text-[var(--eos-text)]">
                    {plan.pricePln}
                    <span className="ml-1 text-sm font-medium text-[var(--eos-muted)]">zł / 30 dni</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-[var(--eos-muted)]">
                    <li className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {plan.creditsPerMonth} kredytów na pulę
                    </li>
                    <li className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {agents} w zespole
                    </li>
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--eos-border)] bg-[var(--eos-surface)]/30 p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">
                  Co się zmieni — {PLAN_LABELS[selectedPlan.id]}
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
                {showProTrial ? (
                  <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-semibold leading-relaxed text-emerald-600">
                    Pierwszy miesiąc <strong>0 zł</strong> — wymagana karta. Po 30 dniach automatycznie
                    pobierzemy <strong>999 zł</strong> za kolejne 30 dni.
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
                  {showProTrial
                    ? 'Dodaj kartę — start trialu (0 zł)'
                    : hasActive
                      ? 'Ulepsz pakiet'
                      : 'Aktywuj pakiet'}
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
