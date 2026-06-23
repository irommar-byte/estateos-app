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
};

const PLAN_LABELS: Record<PartnerPlanId, string> = {
  start: 'Partner Start',
  pro: 'Partner Pro',
  enterprise: 'Partner Enterprise',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pl-PL', { dateStyle: 'long' });
}

export default function AgencyPartnerPlanSection({
  partnerPlan,
  onCheckout,
  onTrialActivate,
  checkoutLoading,
  checkoutError,
  trialLoading,
}: {
  partnerPlan: AgencyPartnerPlanPayload;
  onCheckout: (stripePlanCode: string) => void;
  onTrialActivate?: () => void;
  trialLoading?: boolean;
  checkoutLoading: string | null;
  checkoutError: string | null;
}) {
  const { dict } = useLocale();
  const p = dict.pricing;
  const partnerAgentsUnlimited = p?.partnerAgentsUnlimited ?? 'bez limitu';
  const partnerActivationNote =
    p?.partnerActivationNote ??
    'Wymaga konta administratora biura. Nie masz biura? Załóż je bezpłatnie przed aktywacją.';
  const [selectedId, setSelectedId] = useState<PartnerPlanId>(
    partnerPlan.currentPlanId ?? 'pro',
  );

  const currentPlan = PARTNER_PLANS.find((pl) => pl.id === partnerPlan.currentPlanId) ?? null;
  const selectedPlan = PARTNER_PLANS.find((pl) => pl.id === selectedId) ?? PARTNER_PLANS[1];
  const changeLines = useMemo(
    () => describePartnerPlanChange({ from: currentPlan, to: selectedPlan }),
    [currentPlan, selectedPlan],
  );

  const agentsLimitLabel =
    partnerPlan.agentsLimit == null
      ? partnerAgentsUnlimited
      : `${partnerPlan.activeAgents} / ${partnerPlan.agentsLimit}`;

  const statusLabel = partnerPlan.isSubscriptionActive
    ? partnerPlan.currentPlanId && PLAN_LABELS[partnerPlan.currentPlanId]
      ? PLAN_LABELS[partnerPlan.currentPlanId]
      : 'Aktywna pula Partner'
    : 'Brak aktywnego pakietu';

  const statusTone = partnerPlan.isSubscriptionActive ? 'text-emerald-500' : 'text-amber-500';
  const showProTrial =
    Boolean(partnerPlan.proTrialEligible) && selectedId === 'pro' && !partnerPlan.isSubscriptionActive;

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
      <div className="border-b border-[var(--eos-border)] bg-gradient-to-r from-emerald-500/[0.06] to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">
              <Sparkles size={14} /> Pakiet agencji
            </p>
            <h2 className="text-2xl font-black text-[var(--eos-text)] md:text-3xl">
              EstateOS™ Partner — Twój abonament biura
            </h2>
            <p className="eos-muted-copy mt-2 text-sm leading-relaxed">
              Kredyty publikacji, limit zespołu i CRM w jednym miejscu. Wybierz pakiet — od razu
              widzisz, co się zmieni po aktywacji.
            </p>
          </div>

          <div className="grid min-w-[min(100%,18rem)] gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/70 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                Teraz masz
              </p>
              <p className={`mt-1 text-lg font-black ${statusTone}`}>{statusLabel}</p>
              <p className="eos-muted-copy mt-1 text-xs">
                {partnerPlan.isSubscriptionActive && partnerPlan.plusExpiresAt
                  ? `Ważne do ${fmtDate(partnerPlan.plusExpiresAt)}${
                      partnerPlan.daysRemaining != null ? ` · ${partnerPlan.daysRemaining} dni` : ''
                    }`
                  : 'Aktywuj pakiet, aby korzystać z puli kredytów firmy.'}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/70 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                Pula i zespół
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-black text-[var(--eos-text)]">
                <Wallet size={16} className="text-emerald-500" />
                {partnerPlan.poolCredits} kredytów
              </p>
              <p className="eos-muted-copy mt-1 flex items-center gap-1.5 text-xs">
                <Users size={12} />
                {agentsLimitLabel} agentów aktywnych
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
        {PARTNER_PLANS.map((plan) => {
          const isCurrent = partnerPlan.currentPlanId === plan.id;
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
              {isCurrent ? (
                <span className="mb-2 inline-block rounded-full bg-[var(--eos-input)] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--eos-muted)]">
                  Obecny pakiet
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
                <li className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                  {partnerCreditUnitPrice(plan)} zł / kredyt
                </li>
              </ul>
              {isSelected ? (
                <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                  Wybrany <ChevronRight size={12} />
                </span>
              ) : null}
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
            {partnerPlan.lastPurchaseAt ? (
              <p className="eos-muted-copy mt-4 text-xs">
                Ostatnia aktywacja pakietu: {fmtDate(partnerPlan.lastPurchaseAt)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[16rem]">
            {showProTrial ? (
              <p className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-semibold text-emerald-600">
                Pierwszy miesiąc Partner Pro (999 zł) — <strong>0 zł</strong>, 50 kredytów na pulę na 30 dni.
              </p>
            ) : null}
            <button
              type="button"
              disabled={Boolean(checkoutLoading) || Boolean(trialLoading)}
              onClick={() => {
                if (showProTrial && onTrialActivate) {
                  onTrialActivate();
                  return;
                }
                onCheckout(partnerStripePlanCodeFromId(selectedPlan.id));
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-black shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {(checkoutLoading === partnerStripePlanCodeFromId(selectedPlan.id) || trialLoading) ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Building2 size={18} />
              )}
              {showProTrial
                ? 'Aktywuj okres próbny (0 zł)'
                : partnerPlan.currentPlanId === selectedPlan.id
                  ? 'Odnów pakiet'
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
    </section>
  );
}
