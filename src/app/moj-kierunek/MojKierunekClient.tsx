"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useDiscoveryProfile } from "@/hooks/useDiscoveryProfile";

const STAGES = [
  { key: "EXPLORE", label: "Odkrywanie" },
  { key: "FOCUS", label: "Fokus" },
  { key: "READY", label: "Gotowość" },
] as const;

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };

function eventToastLabel(type: string) {
  switch (type) {
    case "DISCOVERY_LIKE":
      return "Pasuje";
    case "DISCOVERY_DISLIKE":
      return "Nie dla mnie";
    case "DISCOVERY_PRIORITY":
      return "Na poważnie";
    default:
      return "Zapisano";
  }
}

function confidenceLabel(c: number) {
  if (c < 0.12) return "Cold start";
  if (c < 0.35) return "Zarys";
  if (c < 0.6) return "Wyraźny kierunek";
  return "Silny sygnał";
}

/** Apple Intelligence “For You” — one calm composition, next step only. */
export default function MojKierunekClient() {
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    setToast(`Zapisano: ${eventToastLabel(eventType)}`);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, guide, refreshing, error } = useDiscoveryProfile({ onNewDecision });

  if (auth === "loading") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <Loader2 className="size-6 animate-spin text-amber-400" />
      </main>
    );
  }

  if (auth === "guest") {
    return (
      <main className="relative min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12),_transparent_55%)]" />
        <div
          className="relative mx-auto flex max-w-2xl flex-col justify-center px-6 pb-20"
          style={{ paddingTop: "calc(var(--eos-nav-height) + 3rem)" }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-400/90">EstateOS™</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Mój kierunek</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--eos-muted)]">
            Spokojny przewodnik po Twojej decyzji — jak Apple Intelligence, bez formularza.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent("/moj-kierunek")}`}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] transition active:scale-[0.98] hover:bg-emerald-400"
          >
            Zaloguj się
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  const activeStage = guide?.intentStage || "EXPLORE";
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === activeStage));
  const confPct = Math.round(Math.min(1, Math.max(0, profile?.confidence ?? 0)) * 100);
  const title = guide?.nextStep?.title || "Zacznijmy od tego, co jest dla Ciebie ważne.";
  const body =
    guide?.body || "Oceń kilka ofert — kierunek pojawi się tu sam, bez hałasu.";
  const primary = guide?.primaryCta || { label: "Oceń oferty", href: "/oferty" };

  return (
    <main className="relative min-h-screen bg-[var(--eos-bg)] pb-24 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,_rgba(251,191,36,0.14),_transparent_50%),radial-gradient(ellipse_at_88%_8%,_rgba(16,185,129,0.08),_transparent_42%)]" />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={spring}
            className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg backdrop-blur-xl"
            style={{ top: "calc(var(--eos-nav-height) + 0.75rem)" }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="relative mx-auto max-w-3xl px-4 sm:px-6"
        style={{ paddingTop: "calc(var(--eos-nav-height) + 2.25rem)" }}
      >
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-amber-200">
              <Sparkles size={16} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-400/90">
                EstateOS™ Intelligence
              </p>
              <p className="text-xs text-[var(--eos-muted)]">
                {refreshing ? "Aktualizacja…" : "Twój spokojny następny krok"}
              </p>
            </div>
          </div>

          <h1 className="mt-8 text-[2.35rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Mój kierunek
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-6 text-[var(--eos-muted)]">
            Jedna myśl. Jedna sugestia. Reszta w lustrze preferencji.
          </p>
        </motion.header>

        <motion.div
          className="mt-7 inline-flex w-full rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/75 p-1 backdrop-blur-xl"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.04 }}
          role="list"
          aria-label="Faza kierunku"
        >
          {STAGES.map((stage, idx) => {
            const active = idx === stageIndex || (activeStage === "COMPLETE" && idx === 2);
            return (
              <div
                key={stage.key}
                role="listitem"
                className={`flex-1 rounded-full px-2 py-2.5 text-center text-[11px] font-semibold transition-colors duration-300 ${
                  active
                    ? "bg-amber-400/15 text-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]"
                    : "text-[var(--eos-muted)]"
                }`}
              >
                {stage.label}
              </div>
            );
          })}
        </motion.div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <motion.section
          className="mt-8 overflow-hidden rounded-[2rem] border border-white/12 bg-black/50 p-6 backdrop-blur-2xl sm:p-8"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.08 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Guide</p>
            {guide?.intentLabel ? (
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                {guide.intentLabel}
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 max-w-xl text-[1.65rem] font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-white/60">{body}</p>

          <div className="mt-6">
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <span className="text-xs font-semibold text-white/60">
                Pewność · {confidenceLabel(profile?.confidence ?? 0)}
              </span>
              <span className="text-sm font-bold tabular-nums text-amber-200">{confPct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-[width] duration-500 ease-out"
                style={{ width: `${confPct}%` }}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(16,185,129,0.32)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-400 active:translate-y-0 active:scale-[0.98]"
            >
              {primary.label}
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/lustro"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white/70 transition hover:text-white"
            >
              Lustro preferencji
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
