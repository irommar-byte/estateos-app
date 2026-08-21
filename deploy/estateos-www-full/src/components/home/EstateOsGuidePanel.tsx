"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Bookmark, Sparkles, ArrowRight } from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

type GuidePayload = {
  confidence?: number;
  intentStage?: string;
  intentLabel?: string;
  body?: string;
  summaryLine?: string;
  stageProgress?: number;
  nextStep?: { title?: string; action?: string; offerId?: number | null };
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

const FALLBACK: GuidePayload = {
  intentLabel: "Odkrywanie",
  intentStage: "EXPLORE",
  nextStep: { title: "Zacznijmy od tego, co jest dla Ciebie ważne." },
  body: "Guide uczy się z cichych decyzji na ofertach — bez formularza i presji.",
  primaryCta: { label: "Oceń oferty", href: "/oferty" },
  secondaryCta: { label: "Mój kierunek", href: "/moj-kierunek" },
  stageProgress: 0.08,
};

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };

export default function EstateOsGuidePanel() {
  const reduceMotion = useReducedMotion();
  const [guide, setGuide] = useState<GuidePayload | null>(null);

  const refreshGuide = useCallback(() => {
    void fetch("/api/guide/context", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setGuide(payload?.guide || null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshGuide();
    return subscribeDiscoveryUpdated(refreshGuide);
  }, [refreshGuide]);

  const g = guide || FALLBACK;
  const title = g.nextStep?.title || FALLBACK.nextStep!.title!;
  const body = g.body || FALLBACK.body!;
  const stageLabel = g.intentLabel || FALLBACK.intentLabel!;
  const progress = Math.round(Math.min(1, Math.max(0, g.stageProgress ?? 0.08)) * 100);
  const primary = g.primaryCta || FALLBACK.primaryCta!;
  const secondary = g.secondaryCta || FALLBACK.secondaryCta!;
  const thirdHref = "/moj-kierunek";
  const thirdLabel = "Mój kierunek";
  const showThird = primary.href !== thirdHref && secondary.href !== thirdHref;
  const hasPersonalized = Boolean(guide);

  return (
    <section className="relative z-10 mx-auto mt-6 mb-10 w-[calc(100%-2rem)] max-w-6xl sm:mt-8 sm:mb-12 sm:w-[calc(100%-3rem)]">
      <motion.div
        className="eos-lux-panel overflow-hidden rounded-[2rem] p-5 sm:p-7"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={spring}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,163,90,0.4)] bg-[rgba(196,163,90,0.12)] text-[#9a7b3c]">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-sm font-black text-[var(--eos-text)]">EstateOS Guide</p>
                <p className="text-xs text-[var(--eos-muted)]">
                  {hasPersonalized
                    ? "EstateOS™ Intelligence · Twój następny krok"
                    : "EstateOS™ Intelligence · spokojny następny krok"}
                </p>
              </div>
              <span className="rounded-full border border-[rgba(196,163,90,0.35)] bg-[rgba(196,163,90,0.1)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7a6230]">
                {stageLabel}
              </span>
            </div>
            <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight text-[var(--eos-text)] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--eos-muted)]">{body}</p>
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--eos-subtle)]">
                <span>Postęp kierunku</span>
                <span className="tabular-nums text-[#9a7b3c]">{progress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[rgba(26,27,30,0.08)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#c4a35a] to-emerald-500"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[34rem] lg:grid-cols-1">
            <Link
              href={primary.href}
              className="eos-lux-row group flex min-h-12 items-center gap-3 rounded-2xl border border-[rgba(196,163,90,0.35)] bg-[rgba(196,163,90,0.1)] p-3 active:scale-[0.99]"
            >
              <Compass size={17} className="text-[#9a7b3c]" />
              <span className="flex-1 text-sm font-semibold text-[var(--eos-text)]">{primary.label}</span>
              <ArrowRight size={15} className="text-[#9a7b3c] transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={secondary.href}
              className="eos-lux-row group flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-white/60 p-3 active:scale-[0.99]"
            >
              <Bookmark size={17} className="text-[#9a7b3c]" />
              <span className="flex-1 text-sm font-semibold text-[var(--eos-text)]">{secondary.label}</span>
              <ArrowRight size={15} className="text-[#9a7b3c] transition group-hover:translate-x-0.5" />
            </Link>
            {showThird ? (
              <Link
                href={thirdHref}
                className="eos-lux-row group flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-white/60 p-3 active:scale-[0.99]"
              >
                <Sparkles size={17} className="text-[#9a7b3c]" />
                <span className="flex-1 text-sm font-semibold text-[var(--eos-text)]">{thirdLabel}</span>
                <ArrowRight size={15} className="text-[#9a7b3c] transition group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
