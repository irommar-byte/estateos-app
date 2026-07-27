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
  const thirdHref =
    secondary.href === "/lustro" || primary.href === "/lustro" ? "/moj-kierunek" : "/lustro";
  const thirdLabel = thirdHref === "/lustro" ? "Lustro preferencji" : "Mój kierunek";

  return (
    <section className="relative z-10 mx-auto mt-4 mb-12 w-[calc(100%-2rem)] max-w-6xl sm:mt-5 sm:w-[calc(100%-3rem)]">
      <motion.div
        className="overflow-hidden rounded-[2rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl sm:p-7"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={spring}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-sm font-black text-white">EstateOS Guide</p>
                <p className="text-xs text-white/55">EstateOS™ Inteligence · spokojny następny krok</p>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                {stageLabel}
              </span>
            </div>
            <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{body}</p>
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                <span>Postęp kierunku</span>
                <span className="tabular-nums text-amber-200/90">{progress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400"
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
              className="group flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 transition hover:bg-amber-300/15 active:scale-[0.99]"
            >
              <Compass size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">{primary.label}</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={secondary.href}
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1] active:scale-[0.99]"
            >
              <Bookmark size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">{secondary.label}</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={thirdHref}
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1] active:scale-[0.99]"
            >
              <Sparkles size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">{thirdLabel}</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
