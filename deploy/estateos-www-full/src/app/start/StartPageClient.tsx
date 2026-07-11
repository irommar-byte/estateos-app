"use client";

import Link from "next/link";
import { ArrowRight, Building2, Home, Smartphone, Sparkles } from "lucide-react";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import { CAMPAIGN_LINK_PRESETS } from "@/lib/campaignLinks";
import { useLocale } from "@/contexts/LocaleContext";
import { getStartPageDictionary } from "@/i18n/startPageDictionary";

const CARD_ICONS = [Building2, Home, Sparkles] as const;

export default function StartPageClient() {
  const { locale } = useLocale();
  const d = getStartPageDictionary(locale);

  return (
    <main className="min-h-screen bg-[#050505] pt-[calc(5rem+env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(16,185,129,0.18),transparent_45%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-400">{d.heroBadge}</p>
        <h1 className="mt-4 text-4xl font-light tracking-tight sm:text-5xl lg:text-6xl">
          {d.heroTitle}
          <span className="block font-semibold text-emerald-400">{d.heroTitleAccent}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{d.heroSubtitle}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {d.cards.map((card, index) => {
            const Icon = CARD_ICONS[index] ?? Sparkles;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-500/40 hover:bg-white/[0.07]"
              >
                <Icon className="size-6 text-emerald-400" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{card.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {card.cta}
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <section className="mt-14 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Smartphone className="size-5" aria-hidden />
                <span className="text-[10px] font-black uppercase tracking-[0.28em]">{d.appSectionLabel}</span>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{d.appSectionBody}</p>
            </div>
            <AppStoreBadgeLink />
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-white/40">
          {d.campaignFooter}{" "}
          <Link href="/dla-prasy" className="text-emerald-400/90 underline-offset-2 hover:underline">
            {d.pressLink}
          </Link>
        </p>
        <p className="sr-only" aria-hidden>
          {Object.values(CAMPAIGN_LINK_PRESETS).join(" ")}
        </p>
      </div>
    </main>
  );
}
