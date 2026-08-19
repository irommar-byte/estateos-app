"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Zap,
  Radar,
  Crown,
  Building2,
  User,
  ArrowRight,
  Eye,
  X,
  Key,
  Home,
  Users,
  Wallet,
  Scale,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  PARTNER_FREE_PLAN,
  PARTNER_PAID_PLANS,
  PAKIET_PLUS_PRICE_PLN,
  type PartnerPlanConfig,
  formatAgentsLimit,
  partnerBreakEvenCreditsPerMonth,
  partnerCreditUnitPrice,
  partnerSavingsPercentVsRetail,
  partnerStripePlanCodeFromId,
} from "@/lib/partnerPricing";

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

type PartnerCopy = {
  name: string;
  desc: string;
  features: string[];
};

function partnerCopyForPlan(
  plan: PartnerPlanConfig,
  p: ReturnType<typeof useLocale>["dict"]["pricing"],
): PartnerCopy {
  const agents = formatAgentsLimit(plan.maxAgents, p.partnerAgentsUnlimited);
  const vars = {
    credits: plan.creditsPerMonth,
    agents,
    unitPrice: partnerCreditUnitPrice(plan),
    retail: PAKIET_PLUS_PRICE_PLN,
    savings: partnerSavingsPercentVsRetail(plan),
    breakEven: partnerBreakEvenCreditsPerMonth(plan),
  };

  if (plan.id === "free") {
    return {
      name: p.partnerFreeName,
      desc: p.partnerFreeDesc,
      features: [
        p.partnerFreeF1,
        p.partnerFreeF2,
        p.partnerFreeF3,
        p.partnerFreeF4,
        p.partnerFreeF5,
      ].map((line) => fillTemplate(line, vars)),
    };
  }

  if (plan.id === "start") {
    return {
      name: p.partnerStartName,
      desc: p.partnerStartDesc,
      features: [
        p.partnerStartF1,
        p.partnerStartF2,
        p.partnerStartF3,
        p.partnerStartF4,
        p.partnerStartF5,
        p.partnerStartF6,
      ].map((line) => fillTemplate(line, vars)),
    };
  }

  if (plan.id === "pro") {
    return {
      name: p.partnerProName,
      desc: p.partnerProDesc,
      features: [
        p.partnerProF1,
        p.partnerProF2,
        p.partnerProF3,
        p.partnerProF4,
        p.partnerProF5,
        p.partnerProF6,
        p.partnerProF7,
        p.partnerProF8,
        p.partnerProF9,
      ].map((line) => fillTemplate(line, vars)),
    };
  }

  return {
    name: p.partnerEnterpriseName,
    desc: p.partnerEnterpriseDesc,
    features: [
      p.partnerEnterpriseF1,
      p.partnerEnterpriseF2,
      p.partnerEnterpriseF3,
      p.partnerEnterpriseF4,
      p.partnerEnterpriseF5,
      p.partnerEnterpriseF6,
      p.partnerEnterpriseF7,
    ].map((line) => fillTemplate(line, vars)),
  };
}

function PartnerPlanCard({
  plan,
  copy,
  highlighted,
  badgeLabel,
  periodLabel,
  ctaActivateLabel,
  ctaRegisterLabel,
  activationNote,
  stripePlanCode,
  loading,
  disabled,
  isFree,
  freeCtaLabel,
  wasPricePln,
  savingsLabel,
  breakEvenLabel,
  onActivate,
  onRegister,
}: {
  plan: PartnerPlanConfig;
  copy: PartnerCopy;
  highlighted?: boolean;
  badgeLabel: string;
  periodLabel: string;
  ctaActivateLabel: string;
  ctaRegisterLabel: string;
  activationNote: string;
  stripePlanCode: string;
  loading: boolean;
  disabled: boolean;
  isFree?: boolean;
  freeCtaLabel?: string;
  wasPricePln?: number;
  savingsLabel?: string;
  breakEvenLabel?: string;
  onActivate: (stripePlanCode: string) => void;
  onRegister: () => void;
}) {
  return (
    <article
      className={[
        "flex flex-col rounded-[2rem] border p-6 sm:p-8 md:p-9 relative overflow-hidden transition-colors min-w-0",
        highlighted
          ? "border-emerald-500/35 bg-gradient-to-b from-emerald-500/[0.08] to-[var(--eos-card)] shadow-[0_0_50px_rgba(16,185,129,0.08)] dark:from-emerald-500/10"
          : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-emerald-500/25",
      ].join(" ")}
    >
      {highlighted ? (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600" />
      ) : null}

      {highlighted ? (
        <div className="mb-4 flex justify-start sm:justify-end">
          <span className="eos-pricing-badge">
            <Crown size={12} /> {badgeLabel}
          </span>
        </div>
      ) : null}

      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400 mb-2">
          EstateOS™ Partner
        </p>
        <h4
          className={[
            "text-2xl font-black mb-2",
            highlighted ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--eos-text)]",
          ].join(" ")}
        >
          {copy.name}
        </h4>
        <p className="text-[var(--eos-muted)] text-sm leading-relaxed">{copy.desc}</p>
      </div>

      <div className="mb-8">
        {wasPricePln && wasPricePln > plan.pricePln ? (
          <p className="text-xl font-black text-[var(--eos-subtle)] line-through decoration-red-500/50 decoration-2 mb-1">
            {wasPricePln} {periodLabel}
          </p>
        ) : null}
        <span className="text-5xl font-black text-[var(--eos-text)] tracking-tight">
          {plan.pricePln}{" "}
          <span className="text-lg text-[var(--eos-muted)] font-medium">{periodLabel}</span>
        </span>
        {!isFree && savingsLabel ? (
          <p className="mt-3 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            {savingsLabel}
          </p>
        ) : null}
        {!isFree && breakEvenLabel ? (
          <p className="mt-2 text-xs text-[var(--eos-muted)]">{breakEvenLabel}</p>
        ) : null}
      </div>

      <ul className="flex flex-col gap-4 mb-8 flex-1">
        {copy.features.map((text, i) => (
          <li key={i} className="flex items-start gap-3 text-[var(--eos-text)] text-sm leading-relaxed">
            <Check className="text-emerald-500 shrink-0 mt-0.5" size={18} />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3">
        {isFree ? (
          <button
            type="button"
            onClick={onRegister}
            className="w-full py-4 rounded-2xl font-bold transition-colors flex justify-center items-center gap-2 text-sm bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
          >
            <Building2 size={16} />
            {freeCtaLabel ?? ctaRegisterLabel}
            <ArrowRight size={16} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onActivate(stripePlanCode)}
              disabled={disabled || loading}
              className={[
                "w-full py-4 rounded-2xl font-bold transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-70",
                highlighted
                  ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
                  : "bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-text)] hover:border-emerald-500/40 hover:bg-emerald-500/5",
              ].join(" ")}
            >
              <Building2 size={16} />
              {loading ? "…" : ctaActivateLabel}
              {!loading ? <ArrowRight size={16} /> : null}
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="w-full text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {ctaRegisterLabel}
            </button>
          </>
        )}
        <p className="text-[11px] text-center leading-relaxed text-[var(--eos-subtle)] px-1">{activationNote}</p>
      </div>
    </article>
  );
}

export default function Pricing() {
  const { dict } = useLocale();
  const p = dict.pricing;
  const [isAgency, setIsAgency] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isBasicModalOpen, setIsBasicModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setIsLoggedIn(d.loggedIn))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "partner") {
      setIsAgency(true);
    }
  }, []);

  const handleCheckout = async (planName: string) => {
    setCheckoutError(null);
    if (planName === "partner_free") {
      window.location.href = "/rejestracja?kind=agent";
      return;
    }
    const isPartnerPlan = planName.startsWith("partner_");
    if (!isLoggedIn) {
      if (isPartnerPlan) {
        window.location.href = "/dla-agencji";
        return;
      }
      setIsBasicModalOpen(true);
      return;
    }
    try {
      setLoadingPlan(planName);
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.origin + "/moje-konto/crm",
          cancelUrl: window.location.origin + "/cennik?tab=partner",
          plan: planName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data?.error || "Nie udało się rozpocząć płatności.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Błąd płatności:", error);
      setCheckoutError("Nie udało się połączyć z płatnością. Spróbuj ponownie.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const proFeatures = [
    { Icon: Eye, text: p.proF1 },
    { Icon: Check, text: p.proF2 },
    { Icon: Radar, text: p.proF3 },
    { Icon: Crown, text: p.proF4 },
    { Icon: Zap, text: p.proF5 },
    { Icon: Scale, text: p.proF6 },
  ];

  const goRegisterOffice = () => {
    window.location.href = "/rejestracja?kind=agent";
  };

  const activeSubtitle = isAgency ? p.subtitleAgency : p.subtitlePrivate;

  return (
    <section className="theme-aware-dashboard relative bg-[var(--eos-bg)] text-[var(--eos-text)] overflow-hidden font-sans min-h-[calc(100dvh-var(--eos-nav-height))] py-10 sm:py-14 lg:py-20">
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#D4AF37]/5 dark:bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none"
        aria-hidden
      />
      {!isAgency ? (
        <motion.div
          className="absolute top-1/4 right-0 w-[420px] h-[420px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"
          aria-hidden
        />
      ) : (
        <motion.div
          className="absolute top-1/4 left-0 w-[480px] h-[480px] bg-emerald-500/8 rounded-full blur-[110px] pointer-events-none"
          aria-hidden
        />
      )}

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <motion.div className="text-center mb-10 sm:mb-14 px-2">
          <h2 className="text-sm font-black text-[#D4AF37] tracking-[0.2em] uppercase mb-4">{p.eyebrow}</h2>
          <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[var(--eos-text)] tracking-tighter mb-4 sm:mb-6 leading-tight">
            {p.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F9E498]">
              {p.titleHighlight}
            </span>
            {p.titleSuffix}
          </h3>
          <p className="text-[var(--eos-muted)] text-lg max-w-2xl mx-auto leading-relaxed">{activeSubtitle}</p>
        </motion.div>

        <div className="flex justify-center mb-10 sm:mb-14 px-2">
          <div className="eos-pricing-toggle bg-[var(--eos-card)] p-1.5 rounded-full border border-[var(--eos-border)] flex items-center relative w-full max-w-md shadow-[var(--eos-shadow-soft)]">
            <div
              className="eos-pricing-toggle-pill absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[var(--eos-bg-elevated)] border border-[var(--eos-border)] rounded-full transition-transform duration-500 ease-out shadow-sm hidden sm:block"
              style={{ transform: isAgency ? "translateX(100%)" : "translateX(0)" }}
            />
            <button
              type="button"
              onClick={() => setIsAgency(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-full relative z-10 font-bold text-xs sm:text-sm transition-colors duration-300 min-w-0 ${
                !isAgency ? "text-[var(--eos-text)] sm:bg-transparent bg-[var(--eos-bg-elevated)] shadow-sm sm:shadow-none" : "text-[var(--eos-subtle)] hover:text-[var(--eos-muted)]"
              }`}
            >
              <User size={16} className="shrink-0" /> <span className="truncate">{p.tabPrivate}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAgency(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-full relative z-10 font-bold text-xs sm:text-sm transition-colors duration-300 min-w-0 ${
                isAgency ? "text-[var(--eos-text)] sm:bg-transparent bg-[var(--eos-bg-elevated)] shadow-sm sm:shadow-none" : "text-[var(--eos-subtle)] hover:text-[var(--eos-muted)]"
              }`}
            >
              <Building2 size={16} className="shrink-0" /> <span className="truncate">{p.tabAgency}</span>
            </button>
          </div>
        </div>

        {!isAgency && (
          <div className="animate-in fade-in duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-[var(--eos-card)] border border-[var(--eos-border)] rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden group hover:border-[var(--eos-border-strong)] transition-colors shadow-[var(--eos-shadow-soft)]">
                <div className="mb-8">
                  <h4 className="text-2xl font-black text-[var(--eos-text)] mb-2">{p.basicName}</h4>
                  <p className="text-[var(--eos-muted)] text-sm leading-relaxed">{p.basicDesc}</p>
                </div>
                <div className="mb-8 flex flex-col">
                  <span className="text-xl text-transparent font-black mb-1 select-none pointer-events-none">-</span>
                  <span className="text-5xl font-black text-[var(--eos-text)]">
                    {p.basicPrice.split(" ")[0]}{" "}
                    <span className="text-lg text-[var(--eos-muted)] font-medium">
                      {p.basicPrice.split(" ").slice(1).join(" ") || "PLN"}
                    </span>
                  </span>
                </div>

                <ul className="flex flex-col gap-5 mb-10 flex-1">
                  <li className="flex items-start gap-3 text-[var(--eos-text)] text-sm">
                    <Check className="text-[var(--eos-subtle)] shrink-0" size={20} />
                    <span>{p.basicF1}</span>
                  </li>
                  <li className="flex items-start gap-3 text-[var(--eos-text)] text-sm">
                    <Radar className="text-emerald-500 shrink-0" size={20} />
                    <span>{p.basicF2}</span>
                  </li>
                  <li className="flex items-start gap-3 text-[var(--eos-text)] text-sm">
                    <Check className="text-[var(--eos-subtle)] shrink-0" size={20} />
                    <span>{p.basicF3}</span>
                  </li>
                  <li className="flex items-start gap-3 text-[var(--eos-muted)] text-sm italic">
                    <Zap className="text-[var(--eos-subtle)] shrink-0" size={20} />
                    <span>{p.basicF4}</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={() => setIsBasicModalOpen(true)}
                  className="w-full py-5 rounded-2xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-text)] font-bold hover:border-[var(--eos-border-strong)] transition-colors flex justify-center items-center gap-2"
                >
                  {p.basicCta} <ArrowRight size={16} />
                </button>
              </div>

              <div className="bg-gradient-to-b from-amber-50 to-[var(--eos-card)] dark:from-[#1a150b] dark:to-[var(--eos-card)] border border-amber-400/35 dark:border-[#D4AF37]/30 rounded-[2.5rem] p-8 sm:p-10 flex flex-col relative overflow-hidden group shadow-[var(--eos-shadow-soft)] dark:shadow-[0_0_50px_rgba(212,175,55,0.05)]">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8A6E2F] via-[#F9E498] to-[#8A6E2F]" />
                <div className="mb-4 flex justify-start sm:justify-end">
                  <span className="eos-pricing-badge border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#B8860B] dark:text-[#D4AF37]">
                    <Crown size={12} /> {p.proBadge}
                  </span>
                </div>

                <div className="mb-8">
                  <h4 className="text-2xl font-black text-[#B8860B] dark:text-[#D4AF37] mb-2">{p.proName}</h4>
                  <p className="text-[var(--eos-muted)] text-sm leading-relaxed">{p.proDesc}</p>
                </div>
                <div className="mb-8 flex flex-col">
                  <span className="text-xl text-[var(--eos-subtle)] line-through decoration-red-500/50 decoration-2 font-black mb-1">
                    {p.proWas}
                  </span>
                  <span className="text-5xl font-black text-[var(--eos-text)]">
                    {p.proPrice}{" "}
                    <span className="text-lg text-[var(--eos-muted)] font-medium">{p.proPeriod}</span>
                  </span>
                </div>

                <ul className="flex flex-col gap-5 mb-10 flex-1">
                  {proFeatures.map(({ Icon, text }, i) => (
                    <li key={i} className="flex items-start gap-3 text-[var(--eos-text)] text-sm">
                      <Icon className="text-[#B8860B] dark:text-[#D4AF37] shrink-0" size={20} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleCheckout("investor")}
                  disabled={loadingPlan === "investor"}
                  className="pricing-pro-cta group relative py-5 rounded-[1.25rem] overflow-visible transition-all duration-500 w-full flex items-center justify-center gap-3 border border-[#FFF0AA]/50 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:scale-[1.02] z-10 disabled:opacity-70 disabled:hover:scale-100"
                >
                  <div
                    className="absolute inset-0 w-full h-full rounded-[1.25rem] overflow-hidden pointer-events-none"
                    style={{ background: "linear-gradient(135deg, #FFE066 0%, #FDB931 50%, #CC8400 100%)" }}
                  >
                    <motion.div
                      className="pricing-pro-cta-sheen absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-30deg] pointer-events-none"
                      style={{ left: "-100%" }}
                    />
                  </div>
                  <Crown
                    className={`text-black relative z-10 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${loadingPlan === "investor" ? "animate-bounce" : "group-hover:-translate-y-0.5"}`}
                    size={22}
                  />
                  <span className="text-[14px] font-black uppercase tracking-[0.25em] text-black whitespace-nowrap relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                    {loadingPlan === "investor" ? p.proCtaLoading : p.proCta}
                  </span>
                </button>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-[var(--eos-muted)] max-w-2xl mx-auto leading-relaxed">
              {p.pakietPlusFootnote}
            </p>
          </div>
        )}

        {isAgency && (
          <div className="animate-in fade-in duration-700 space-y-10">
            <div className="max-w-4xl mx-auto rounded-[2rem] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.1] via-[var(--eos-card)] to-[var(--eos-card)] p-8 md:p-10 text-center shadow-[0_0_60px_rgba(16,185,129,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400 mb-3">
                {p.partnerFreeBadge}
              </p>
              <h4 className="text-2xl md:text-3xl font-black text-[var(--eos-text)] mb-3">{p.partnerFreeHeroTitle}</h4>
              <p className="text-[var(--eos-muted)] text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-6">
                {p.partnerFreeHeroSubtitle}
              </p>
              <button
                type="button"
                onClick={goRegisterOffice}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-black uppercase tracking-widest text-black shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400"
              >
                <Building2 size={18} />
                {p.partnerFreeCta}
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="max-w-2xl mx-auto">
              <PartnerPlanCard
                plan={PARTNER_FREE_PLAN}
                copy={partnerCopyForPlan(PARTNER_FREE_PLAN, p)}
                highlighted
                isFree
                badgeLabel={p.partnerFreeBadge}
                periodLabel={p.partnerFreePeriod}
                ctaActivateLabel={p.partnerFreeCta}
                ctaRegisterLabel={p.partnerCta}
                freeCtaLabel={p.partnerFreeCta}
                activationNote={p.partnerFreeNote}
                stripePlanCode="partner_free"
                loading={false}
                disabled={false}
                onActivate={handleCheckout}
                onRegister={goRegisterOffice}
              />
            </div>

            <p className="text-center text-sm font-semibold text-[var(--eos-muted)] max-w-2xl mx-auto">
              {p.partnerPaidIntro}
            </p>

            <div className="grid eos-pricing-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
              {PARTNER_PAID_PLANS.map((plan) => {
                const copy = partnerCopyForPlan(plan, p);
                const stripePlanCode = partnerStripePlanCodeFromId(plan.id);
                const savings = partnerSavingsPercentVsRetail(plan);
                const breakEven = partnerBreakEvenCreditsPerMonth(plan);
                return (
                  <PartnerPlanCard
                    key={plan.id}
                    plan={plan}
                    copy={copy}
                    highlighted={plan.highlighted}
                    badgeLabel={plan.highlighted ? p.partnerValueBadge : p.proBadge}
                    periodLabel={p.partnerPeriod}
                    wasPricePln={plan.wasPricePln}
                    savingsLabel={fillTemplate(p.partnerSavingsVsRetail, {
                      savings,
                      retail: PAKIET_PLUS_PRICE_PLN,
                    })}
                    breakEvenLabel={fillTemplate(p.partnerBreakEvenCredits, { count: breakEven })}
                    ctaActivateLabel={p.partnerCtaActivate}
                    ctaRegisterLabel={p.partnerCta}
                    activationNote={p.partnerActivationNote}
                    stripePlanCode={stripePlanCode}
                    loading={loadingPlan === stripePlanCode}
                    disabled={loadingPlan !== null && loadingPlan !== stripePlanCode}
                    onActivate={handleCheckout}
                    onRegister={goRegisterOffice}
                  />
                );
              })}
            </div>

            {checkoutError ? (
              <p className="text-center text-sm text-red-500 dark:text-red-400 max-w-2xl mx-auto">{checkoutError}</p>
            ) : null}

            <div className="max-w-3xl mx-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-[var(--eos-shadow-soft)]">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users size={22} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--eos-text)] mb-1">EstateOS™ Partner</p>
                <p className="text-sm text-[var(--eos-muted)] leading-relaxed">{p.subtitleAgency}</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Wallet size={18} />
                <span className="text-xs font-black uppercase tracking-widest">{p.partnerPoolBadge}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isBasicModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-6"
            onClick={() => setIsBasicModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--eos-bg-elevated)] border border-[var(--eos-border)] rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-[var(--eos-shadow-strong)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none z-0" />

              <button
                type="button"
                onClick={() => setIsBasicModalOpen(false)}
                className="absolute top-6 right-6 p-3 bg-[var(--eos-input)] hover:bg-[var(--eos-border)] rounded-full transition-colors text-[var(--eos-muted)] z-20"
              >
                <X size={20} />
              </button>

              <div className="relative z-10 text-center mb-10">
                <h3 className="text-4xl md:text-5xl font-black text-[var(--eos-text)] tracking-tighter mb-4">
                  {p.modalTitle.replace(/(Cel|Goal|мета)/i, (m) => `__${m}__`)
                    .split("__")
                    .map((part, i) =>
                      part === "Cel" || part === "Goal" || part === "мета" ? (
                        <span key={i} className="text-emerald-500">
                          {part}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      ),
                    )}
                </h3>
                <p className="text-[var(--eos-muted)] text-sm md:text-base">{p.modalSubtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/szukaj";
                  }}
                  className="flex flex-col items-center text-center gap-4 p-8 bg-[var(--eos-card)] border border-[var(--eos-border)] hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-[2rem] transition-all group"
                >
                  <motion.div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Key size={36} />
                  </motion.div>
                  <div>
                    <div className="font-black text-2xl text-[var(--eos-text)] mb-2 group-hover:text-emerald-500 transition-colors">
                      {p.modalBuy}
                    </div>
                    <p className="text-xs text-[var(--eos-muted)] leading-relaxed">{p.modalBuyDesc}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/dodaj-oferte";
                  }}
                  className="flex flex-col items-center text-center gap-4 p-8 bg-[var(--eos-card)] border border-[var(--eos-border)] hover:border-orange-500/50 hover:bg-orange-500/5 rounded-[2rem] transition-all group"
                >
                  <motion.div className="w-20 h-20 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Home size={36} />
                  </motion.div>
                  <div>
                    <div className="font-black text-2xl text-[var(--eos-text)] mb-2 group-hover:text-orange-500 transition-colors">
                      {p.modalSell}
                    </div>
                    <p className="text-xs text-[var(--eos-muted)] leading-relaxed">{p.modalSellDesc}</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
