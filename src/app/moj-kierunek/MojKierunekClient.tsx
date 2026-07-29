"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Brain, Check, Loader2 } from "lucide-react";
import { useDiscoveryProfile } from "@/hooks/useDiscoveryProfile";
import { discoveryDisplayLabel, discoveryPropertyTypeLabel } from "@/lib/discovery/displayLabels";

const STAGES = [
  {
    key: "EXPLORE",
    label: "Odkrywanie",
    meaning: "Oceń oferty (pasuje / nie dla mnie). Intelligence dopiero poznaje Twój gust.",
    youAreHere: "Zbieramy pierwsze sygnały — bez formularza, tylko z Twoich ocen.",
  },
  {
    key: "FOCUS",
    label: "Fokus",
    meaning: "Kierunek się zarysowuje. Kolejne oceny coraz wyraźniej ostrzą profil.",
    youAreHere: "Już widać preferencje. Kilka spokojnych decyzji jeszcze bardziej je wyostrzy.",
  },
  {
    key: "READY",
    label: "Gotowość",
    meaning: "Profil jest wystarczająco wyraźny, by doprecyzować wybór albo iść „na poważnie”.",
    youAreHere: "Intelligence dobrze Cię czyta — czas zawęzić oferty albo oznaczyć trop.",
  },
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

function confidencePlain(c: number) {
  if (c < 0.12) return "Dopiero zaczynamy";
  if (c < 0.35) return "Pierwszy zarys";
  if (c < 0.6) return "Wyraźny kierunek";
  return "Dobrze Cię rozumiemy";
}

function formatPln(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return `~${Math.round(n).toLocaleString("pl-PL")} zł`;
}

function transactionLabel(tx: string | null | undefined) {
  const t = String(tx || "").toUpperCase();
  if (t === "SELL" || t === "SALE") return "Sprzedaż";
  if (t === "RENT") return "Wynajem";
  if (t === "MIXED") return "Sprzedaż i wynajem";
  return null;
}

function humanTip(body: string | undefined) {
  const raw = String(body || "").trim();
  return raw || "Oceń kilka ofert — kierunek ułoży się sam.";
}

export default function MojKierunekClient() {
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    setToast(`Zapisano: ${eventToastLabel(eventType)}`);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, guide, refreshing, error } = useDiscoveryProfile({ onNewDecision });

  const activeStage = String(guide?.intentStage || "EXPLORE").toUpperCase();
  const stageIndex =
    activeStage === "COMPLETE"
      ? 2
      : Math.max(
          0,
          STAGES.findIndex((s) => s.key === activeStage),
        );
  const activeMeta = STAGES[Math.min(stageIndex, STAGES.length - 1)];
  const confPct = Math.round(Math.min(1, Math.max(0, profile?.confidence ?? 0)) * 100);
  const title =
    activeStage === "COMPLETE"
      ? "Ta faza poszukiwania jest domknięta."
      : guide?.nextStep?.title || "Zacznijmy od tego, co jest dla Ciebie ważne.";
  const tip = humanTip(guide?.body);
  const primary = guide?.primaryCta || { label: "Oceń oferty", href: "/oferty" };

  const knownChips = useMemo(() => {
    const chips: Array<{ label: string; value: string }> = [];
    const city = profile?.topCities?.[0]?.key;
    if (city) chips.push({ label: "Miasto", value: city });
    const district = profile?.topDistricts?.[0]?.key;
    if (district) chips.push({ label: "Okolica", value: district });
    const propRaw = profile?.topPropertyTypes?.[0]?.key;
    if (propRaw) {
      const prop =
        discoveryPropertyTypeLabel(propRaw) || discoveryDisplayLabel(propRaw) || String(propRaw);
      chips.push({ label: "Typ", value: prop });
    }
    const budget = formatPln(profile?.preferredBudgetPln ?? null);
    if (budget) chips.push({ label: "Budżet", value: budget });
    if (profile?.preferredAreaM2 && profile.preferredAreaM2 > 0) {
      chips.push({ label: "Metraż", value: `~${Math.round(profile.preferredAreaM2)} m²` });
    }
    const tx = transactionLabel(profile?.preferredTransaction ?? null);
    if (tx) chips.push({ label: "Transakcja", value: tx });
    return chips;
  }, [profile]);

  const decisions =
    (profile?.likesCount || 0) + (profile?.dislikesCount || 0) + (profile?.fastTrackCount || 0);

  if (auth === "loading") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <Loader2 className="size-6 animate-spin text-sky-300" />
      </main>
    );
  }

  if (auth === "guest") {
    return (
      <main className="relative min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.12),_transparent_55%)]" />
        <div
          className="relative mx-auto flex max-w-2xl flex-col justify-center px-6 pb-20"
          style={{ paddingTop: "calc(var(--eos-nav-height) + 3rem)" }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-300/90">
            EstateOS™ Intelligence
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Mój kierunek</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--eos-muted)]">
            Tu zobaczysz, na jakim etapie jesteś i co Intelligence już o Tobie wie — po zalogowaniu.
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

  return (
    <main className="relative min-h-screen bg-[var(--eos-bg)] pb-24 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,_rgba(56,189,248,0.14),_transparent_50%),radial-gradient(ellipse_at_88%_8%,_rgba(16,185,129,0.08),_transparent_42%)]" />

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
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-[conic-gradient(from_210deg,#FF2D55,#BF5AF2,#5E5CE6,#64D2FF,#30D158,#FFD60A,#FF9F0A,#FF2D55)] text-white">
              <span className="flex h-full w-full items-center justify-center bg-[#0B0B0F]/55">
                <Brain size={16} strokeWidth={2.1} />
              </span>
            </span>
              <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/70">
                EstateOS™ Intelligence
              </p>
              <p className="text-xs text-[var(--eos-muted)]">
                {refreshing ? "Aktualizacja…" : "Twój spokojny przewodnik po decyzji"}
              </p>
            </div>
          </div>

          <h1 className="mt-8 text-[2.35rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Mój kierunek
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[var(--eos-muted)]">
            Trzy etapy od pierwszych ocen do gotowości. Tu zawsze widać, gdzie jesteś i co robić dalej.
          </p>
        </motion.header>

        <motion.section
          className="mt-7 rounded-[1.75rem] border border-sky-400/20 bg-[rgba(8,14,24,0.85)] p-5 backdrop-blur-xl sm:p-6"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.04 }}
          aria-label="Etapy kierunku"
        >
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
            Jak to działa
          </p>
          <div className="space-y-1">
            {STAGES.map((stage, idx) => {
              const done = idx < stageIndex || activeStage === "COMPLETE";
              const current = idx === stageIndex && activeStage !== "COMPLETE";
              return (
                <div
                  key={stage.key}
                  className={`flex gap-3 rounded-2xl px-3 py-3 ${
                    current ? "border border-sky-400/30 bg-sky-400/10" : ""
                  } ${idx < STAGES.length - 1 && !current ? "border-b border-white/8" : ""}`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold ${
                      done
                        ? "border-emerald-400 bg-emerald-400 text-[#041016]"
                        : current
                          ? "border-sky-300/55 bg-sky-400/20 text-sky-50"
                          : "border-white/12 bg-white/5 text-white/45"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-[15px] font-extrabold ${current ? "text-white" : "text-white/70"}`}>
                        {stage.label}
                      </p>
                      {current ? (
                        <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-sky-100">
                          Tu jesteś
                        </span>
                      ) : null}
                      {done ? <span className="text-[11px] font-bold text-emerald-300/80">za Tobą</span> : null}
                    </div>
                    <p className={`mt-1 text-[13px] leading-5 ${current ? "text-slate-200/80" : "text-white/42"}`}>
                      {stage.meaning}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <motion.section
          className="mt-6 overflow-hidden rounded-[2rem] border border-white/12 bg-black/50 p-6 backdrop-blur-2xl sm:p-8"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.08 }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
            Twój następny krok
          </p>
          <p className="mt-3 text-[13px] font-semibold leading-5 text-sky-300/90">{activeMeta.youAreHere}</p>
          <h2 className="mt-3 max-w-xl text-[1.55rem] font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-white/60">{tip}</p>

          <div className="mt-6">
            <p className="mb-3 text-[13px] font-extrabold text-white/80">Co Intelligence już wie</p>
            {knownChips.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {knownChips.map((chip) => (
                  <div
                    key={`${chip.label}-${chip.value}`}
                    className="rounded-2xl border border-sky-400/20 bg-sky-400/8 px-3 py-2.5"
                  >
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-sky-100/55">
                      {chip.label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-50">{chip.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] leading-5 text-white/45">
                Jeszcze za mało ocen — po kilku „pasuje / nie dla mnie” pojawią się tu miasto, typ i budżet.
              </p>
            )}
          </div>

          <div className="mt-7">
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-white/80">Na ile Cię rozumiemy</p>
                <p className="mt-0.5 text-xs font-semibold text-white/50">
                  {confidencePlain(profile?.confidence ?? 0)}
                </p>
              </div>
              <span className="text-lg font-extrabold tabular-nums text-sky-200">{confPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-400 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(4, confPct)}%` }}
              />
            </div>
            {decisions > 0 ? (
              <p className="mt-2 text-xs font-semibold text-white/40">
                {decisions} {decisions === 1 ? "decyzja" : decisions < 5 ? "decyzje" : "decyzji"}
                {profile?.likesCount ? ` · ${profile.likesCount} pasuje` : ""}
                {profile?.dislikesCount ? ` · ${profile.dislikesCount} nie dla mnie` : ""}
              </p>
            ) : null}
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
              Lustro preferencji — pełny podgląd gustu
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
