"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, Check, ChevronDown, Compass, Navigation, Sparkles } from "lucide-react";
import {
  dispatchIntelligenceSheetOpen,
  subscribeDiscoveryUpdated,
  subscribeIntelligenceLearn,
} from "@/lib/discovery/clientEvents";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";
import {
  INTEL_THRESHOLDS,
  MOOD_PALETTE,
  MOOD_RING_CLASS,
  OIL_BASE,
  OIL_COOL,
  OIL_HOT,
  STAGE_ORDER,
  confidenceLabel,
  crossedMilestone,
  oilConicCss,
  resolveIntelligenceMood,
  resolveStageKey,
  type IntelligenceMood,
  type PresentReason,
  type StageKey,
} from "@/lib/discovery/intelligenceBrand";
import {
  INTEL_EASE,
  INTEL_GENIE_EXIT,
  INTEL_GENIE_SPRING,
  INTEL_MOTION,
  INTEL_ORB_SPRING,
  hideDurationForReason,
  msToSec,
} from "@/lib/discovery/intelligenceMotion";
import {
  consumeAutoBudget,
  hasDonePeek,
  markPeekDone,
  pickAutoPresent,
  readMilestones,
  writeMilestones,
  type SessionStorageLike,
} from "@/lib/discovery/intelligenceSession";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { useLocale } from "@/contexts/LocaleContext";

type PulsePayload = {
  stage?: string;
  stageLabel: string;
  progress: number;
  confidence: number;
  contradictionIndex: number;
  directionLine: string;
  suggestion: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
};

const webStore: SessionStorageLike = {
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* quiet */
    }
  },
};

/**
 * Living gasoline-on-water face — idle uses one oil layer; active uses three counter-spins.
 */
function IntelligenceBrain({
  mood,
  reduceMotion,
  absorbing,
  size = 18,
  oilActive = true,
}: {
  mood: IntelligenceMood;
  reduceMotion: boolean | null;
  absorbing: boolean;
  size?: number;
  oilActive?: boolean;
}) {
  const colors = MOOD_PALETTE[mood];
  const facePx = Math.round(size * 2.35);
  const fullMotion = Boolean(oilActive && !reduceMotion);

  return (
    <span
      className="relative flex items-center justify-center overflow-hidden rounded-full"
      style={{ width: facePx, height: facePx }}
    >
      {fullMotion ? (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-[-35%] rounded-full"
            style={{ background: oilConicCss(0, OIL_BASE) }}
            animate={{ rotate: 360 }}
            transition={{ duration: msToSec(INTEL_MOTION.oilSpinAMs), repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-[-20%] rounded-full opacity-90 mix-blend-screen"
            style={{ background: oilConicCss(90, OIL_HOT) }}
            animate={{ rotate: -360 }}
            transition={{ duration: msToSec(INTEL_MOTION.oilSpinBMs), repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-[-10%] rounded-full opacity-75 mix-blend-screen"
            style={{ background: oilConicCss(180, OIL_COOL) }}
            animate={{ rotate: 360 }}
            transition={{ duration: msToSec(INTEL_MOTION.oilSpinCMs), repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 1px ${colors.glow}` }}
            animate={
              absorbing
                ? { scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }
                : { scale: [1, 1.28, 1], opacity: [0.35, 0, 0.35] }
            }
            transition={{
              duration: absorbing ? 0.55 : colors.speed,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        </>
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: oilConicCss(210, OIL_BASE) }}
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 42%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.28), transparent 50%)",
        }}
      />
      <motion.span
        className="relative z-[1] text-white transition-[filter,transform] duration-300 group-hover:scale-110"
        style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.55))" }}
        animate={
          reduceMotion
            ? undefined
            : absorbing
              ? { scale: [1, 1.18, 1], rotate: [0, -4, 3, 0] }
              : { scale: [1, 1.05, 1] }
        }
        transition={
          absorbing
            ? { duration: msToSec(INTEL_MOTION.celebratePulseMs), ease: INTEL_EASE.out }
            : {
                duration: msToSec(INTEL_MOTION.brainBreatheMs),
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      >
        <Brain size={size} strokeWidth={2} aria-hidden />
      </motion.span>
    </span>
  );
}

function LearnSplash({ color, reduceMotion }: { color: string; reduceMotion: boolean | null }) {
  if (reduceMotion) return null;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-[-2px] rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: [0, 0.75, 0], scale: [0.85, 1.55 + i * 0.3, 2.15 + i * 0.1] }}
          transition={{
            duration: msToSec(INTEL_MOTION.splashMs),
            delay: msToSec(INTEL_MOTION.splashStaggerMs * i),
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
}

export default function DiscoveryPulse() {
  const reduceMotion = useReducedMotion();
  const { dict } = useLocale();
  const { enabled: intelligenceEnabled, hydrated: intelligenceHydrated } =
    useIntelligencePreference();
  const [pulse, setPulse] = useState<PulsePayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");
  const [spectacle, setSpectacle] = useState(false);
  const [presentReason, setPresentReason] = useState<PresentReason | null>(null);
  const [absorbing, setAbsorbing] = useState(false);
  const [fillBoost, setFillBoost] = useState(0);
  const [oilActive, setOilActive] = useState(true);
  const [splashKey, setSplashKey] = useState(0);
  const prevProgressRef = useRef<number | null>(null);
  const prevContradictionRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absorbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootPeekDoneRef = useRef(false);
  const expandedRef = useRef(false);

  const wakeOil = useCallback(() => {
    setOilActive(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (reduceMotion) return;
    idleTimerRef.current = setTimeout(() => {
      if (!expandedRef.current) setOilActive(false);
    }, INTEL_MOTION.idleAfterMs);
  }, [reduceMotion]);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const collapseToOrb = useCallback(() => {
    clearHide();
    setExpanded(false);
    expandedRef.current = false;
    dispatchIntelligenceSheetOpen(false);
    setSpectacle(false);
    wakeOil();
    if (reduceMotion) {
      setPresentReason(null);
      return;
    }
    setAbsorbing(true);
    setFillBoost(1);
    if (absorbTimerRef.current) clearTimeout(absorbTimerRef.current);
    absorbTimerRef.current = setTimeout(() => {
      setAbsorbing(false);
      setFillBoost(0);
      setPresentReason(null);
    }, INTEL_MOTION.absorbMs);
  }, [clearHide, reduceMotion, wakeOil]);

  const scheduleHide = useCallback(
    (ms: number) => {
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        collapseToOrb();
      }, ms);
    },
    [clearHide, collapseToOrb],
  );

  const presentGently = useCallback(
    async (kind: PresentReason) => {
      if (!intelligenceEnabled) return;
      wakeOil();

      if (kind === "manual") {
        setPresentReason(null);
        setExpanded(true);
        expandedRef.current = true;
        dispatchIntelligenceSheetOpen(true);
        scheduleHide(hideDurationForReason("manual"));
        return;
      }

      const allowed = await consumeAutoBudget(webStore);
      if (!allowed) return;

      setPresentReason(kind);
      setExpanded(true);
      expandedRef.current = true;
      dispatchIntelligenceSheetOpen(true);
      setSpectacle(kind === "progress" || kind === "milestone");

      const chimeKind =
        kind === "milestone" ? "celebrate" : kind === "progress" ? "progress" : "suggest";
      void playIntelligenceChime(chimeKind);

      scheduleHide(hideDurationForReason(kind));
      window.setTimeout(() => setSpectacle(false), INTEL_MOTION.spectacleHoldMs);
    },
    [intelligenceEnabled, scheduleHide, wakeOil],
  );

  const load = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch("/api/discovery/pulse", { credentials: "include", cache: "no-store" });
        if (res.status === 401) {
          setAuth("guest");
          setPulse(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const next = data?.pulse as PulsePayload | undefined;
        if (!next) return;

        const prev = prevProgressRef.current;
        const prevContra = prevContradictionRef.current;
        const milestone = crossedMilestone(prev, next.progress);
        const seen = await readMilestones(webStore);
        const milestoneAlreadySeen = milestone != null && seen.includes(milestone);

        if (!expandedRef.current && silent) {
          const pick = pickAutoPresent({
            prevProgress: prev,
            nextProgress: next.progress,
            prevContradiction: prevContra,
            nextContradiction: next.contradictionIndex,
            milestoneGate: milestone,
            milestoneAlreadySeen,
          });

          if (pick) {
            if (pick === "milestone" && milestone != null) {
              await writeMilestones(webStore, [...seen, milestone]);
            }
            void presentGently(pick);
          }
        }

        prevProgressRef.current = next.progress;
        prevContradictionRef.current = next.contradictionIndex;
        setPulse(next);
        setAuth("user");
      } catch {
        // no-op
      }
    },
    [presentGently],
  );

  useEffect(() => {
    void load();
    wakeOil();
    return () => {
      clearHide();
      if (absorbTimerRef.current) clearTimeout(absorbTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [load, clearHide, wakeOil]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load(true)), [load]);

  useEffect(
    () =>
      subscribeIntelligenceLearn((detail) => {
        if (!detail?.kind || detail.kind === "open" || detail.kind === "other") return;
        wakeOil();
        setSplashKey((k) => k + 1);
      }),
    [wakeOil],
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // One motivated session peek — only when direction is already meaningful
  useEffect(() => {
    if (!intelligenceEnabled) return;
    if (auth !== "user" || !pulse || bootPeekDoneRef.current || expanded) return;
    const meaningful =
      pulse.progress >= INTEL_THRESHOLDS.peekProgress ||
      pulse.confidence >= INTEL_THRESHOLDS.peekConfidence;
    if (!meaningful) return;

    let cancelled = false;
    void (async () => {
      if (await hasDonePeek(webStore)) {
        bootPeekDoneRef.current = true;
        return;
      }
      bootPeekDoneRef.current = true;
      await new Promise((r) => setTimeout(r, INTEL_MOTION.bootPeekDelayMs));
      if (cancelled || expandedRef.current) return;
      await markPeekDone(webStore);
      void presentGently(
        pulse.contradictionIndex >= INTEL_THRESHOLDS.contradiction
          ? "contradiction"
          : "ready_peek",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, pulse, expanded, intelligenceEnabled, presentGently]);

  if (
    !intelligenceHydrated ||
    !intelligenceEnabled ||
    auth === "guest" ||
    auth === "unknown" ||
    !pulse
  ) {
    return null;
  }

  const progress = Math.max(0, Math.min(100, pulse.progress || 0));
  const displayProgress = Math.max(0, Math.min(100, progress + fillBoost * 8));
  const contradiction = pulse.contradictionIndex >= INTEL_THRESHOLDS.contradiction;
  const mood = resolveIntelligenceMood({
    progress: pulse.progress,
    confidence: pulse.confidence,
    contradictionIndex: pulse.contradictionIndex,
    spectacle,
  });
  const colors = MOOD_PALETTE[mood];
  const ringClass = MOOD_RING_CLASS[mood];
  const activeStage = resolveStageKey(pulse.stage, progress);
  const activeStageIndex = STAGE_ORDER.indexOf(activeStage);
  const confKey = confidenceLabel(pulse.confidence);
  const confCopy = {
    start: dict.intelligence.confidenceStart,
    outline: dict.intelligence.confidenceOutline,
    clear: dict.intelligence.confidenceClear,
    strong: dict.intelligence.confidenceStrong,
  }[confKey];
  const stageLabel = (key: StageKey) =>
    ({
      EXPLORE: dict.intelligence.stageExplore,
      FOCUS: dict.intelligence.stageFocus,
      READY: dict.intelligence.stageReady,
      COMPLETE: dict.intelligence.stageComplete,
    })[key];

  const reasonMeta =
    presentReason && presentReason !== "manual"
      ? {
          progress: {
            badge: dict.intelligence.progressBadge,
            lead: dict.intelligence.progressLead,
          },
          milestone: {
            badge: dict.intelligence.milestoneBadge,
            lead: dict.intelligence.milestoneLead,
          },
          contradiction: {
            badge: dict.intelligence.contradictionBadge,
            lead: dict.intelligence.contradictionLead,
          },
          ready_peek: {
            badge: dict.intelligence.readyPeekBadge,
            lead: dict.intelligence.readyPeekLead,
          },
        }[presentReason]
      : null;

  const circumference = 2 * Math.PI * 17;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-3 z-[56] flex flex-col items-start gap-2.5 sm:bottom-8 sm:left-6"
      aria-live="polite"
    >
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="expanded"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 28, scaleX: 0.72, scaleY: 0.55, filter: "blur(10px)" }
            }
            animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: INTEL_GENIE_EXIT.y,
                    scaleX: INTEL_GENIE_EXIT.scaleX,
                    scaleY: INTEL_GENIE_EXIT.scaleY,
                    filter: `blur(${INTEL_GENIE_EXIT.blurPx}px)`,
                    borderRadius: "999px",
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : {
                    ...INTEL_GENIE_SPRING,
                    opacity: { duration: 0.28 },
                    filter: { duration: 0.28 },
                  }
            }
            style={{ transformOrigin: "24px 100%" }}
            className="pointer-events-auto relative max-w-[min(90vw,340px)] overflow-hidden rounded-[22px] border border-white/12 bg-[rgba(8,10,14,0.82)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-[28px]"
            onMouseEnter={wakeOil}
            onFocus={wakeOil}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full blur-3xl"
              style={{ background: colors.glow }}
              animate={
                reduceMotion
                  ? { opacity: 0.25 }
                  : { opacity: [0.18, 0.38, 0.18], scale: [1, 1.08, 1] }
              }
              transition={{ duration: colors.speed + 1.2, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={collapseToOrb}
              className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/75"
              aria-label={dict.intelligence.collapseA11y}
            >
              <ChevronDown size={14} />
            </button>

            <div className="relative mb-2.5 flex items-center gap-2 pr-7">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <IntelligenceBrain
                  mood={mood}
                  reduceMotion={reduceMotion}
                  absorbing={false}
                  size={14}
                  oilActive={oilActive}
                />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">
                {dict.intelligence.brandEyebrow}
              </span>
              {reasonMeta ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto rounded-full border border-white/12 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70"
                >
                  {reasonMeta.badge}
                </motion.span>
              ) : null}
            </div>

            {reasonMeta ? (
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-2 text-[11px] font-medium leading-snug text-sky-200/85"
              >
                {reasonMeta.lead}
              </motion.p>
            ) : null}

            <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {pulse.stageLabel}
              <span className="mx-1.5 text-white/25">·</span>
              <span className="tabular-nums text-white/70">{progress}%</span>
            </p>
            <p className="relative mt-1.5 text-[15px] font-medium leading-snug tracking-tight text-white">
              {pulse.directionLine}
            </p>
            <p className="relative mt-2 text-[12px] leading-relaxed text-white/58">{pulse.suggestion}</p>

            <div className="relative mt-3 flex flex-wrap gap-1.5">
              {STAGE_ORDER.map((key, index) => {
                const done = index < activeStageIndex;
                const current = index === activeStageIndex;
                return (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${
                      current
                        ? "border-sky-300/45 bg-sky-400/20 text-white"
                        : done
                          ? "border-white/10 bg-sky-400/10 text-white/80"
                          : "border-white/8 bg-white/[0.04] text-white/45"
                    }`}
                  >
                    {done ? <Check size={9} strokeWidth={2.5} /> : null}
                    {current ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
                    ) : null}
                    {stageLabel(key)}
                  </span>
                );
              })}
            </div>

            <div className="relative mt-3.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-white/45">
                <span>{confCopy}</span>
                <span>{contradiction ? dict.intelligence.needsCorrection : dict.intelligence.stable}</span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${
                    contradiction
                      ? "bg-gradient-to-r from-amber-300 to-rose-400"
                      : "bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-400"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: msToSec(INTEL_MOTION.progressBarMs), ease: INTEL_EASE.out }}
                />
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              <Link
                href={pulse.primaryCta.href}
                className="eos-btn eos-btn--primary eos-btn--sm !normal-case !tracking-wide !text-[11px] !font-semibold"
                onClick={wakeOil}
              >
                {pulse.primaryCta.label}
              </Link>
              <Link
                href={pulse.secondaryCta.href}
                className="eos-btn eos-btn--secondary eos-btn--sm !normal-case !tracking-wide !text-[11px] !font-semibold"
                onClick={wakeOil}
              >
                {pulse.secondaryCta.label}
              </Link>
            </div>

            <div className="relative mt-4 border-t border-white/8 pt-3">
              <p className="mb-2 text-[10px] font-medium text-white/40">{dict.intelligence.guideSupport}</p>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    { href: "/oferty", icon: Compass, label: dict.intelligence.guideFind },
                    { href: "/moj-kierunek", icon: Navigation, label: dict.intelligence.guideDirection },
                    { href: "/lustro", icon: Sparkles, label: dict.intelligence.guideLustro },
                  ] as const
                ).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-2 text-[11px] font-medium text-white/75 transition hover:bg-white/[0.07]"
                    onClick={wakeOil}
                  >
                    <item.icon size={14} className="shrink-0 text-sky-300/90" aria-hidden />
                    <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => {
          wakeOil();
          void presentGently("manual");
        }}
        onMouseEnter={wakeOil}
        onFocus={wakeOil}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
        animate={{
          opacity: 1,
          scale: absorbing ? [1, 1.14, 1] : 1,
        }}
        transition={reduceMotion ? { duration: 0.12 } : INTEL_ORB_SPRING}
        className={`pointer-events-auto group relative flex h-12 w-12 items-center justify-center rounded-full border ${ringClass} bg-transparent shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-all duration-300 hover:scale-[1.1] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_28px_rgba(255,255,255,0.28),0_16px_40px_rgba(0,0,0,0.5)] active:scale-[0.96]`}
        aria-label={`EstateOS Intelligence · ${pulse.stageLabel} ${progress}%`}
        aria-expanded={expanded}
        title={`${pulse.stageLabel} · ${progress}%`}
      >
        {splashKey > 0 ? (
          <LearnSplash key={splashKey} color={colors.accent} reduceMotion={reduceMotion} />
        ) : null}

        <IntelligenceBrain
          mood={mood}
          reduceMotion={reduceMotion}
          absorbing={absorbing}
          size={18}
          oilActive={oilActive || expanded || absorbing}
        />

        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 size-[2.65rem] -translate-x-1/2 -translate-y-1/2 -rotate-90"
          viewBox="0 0 40 40"
          aria-hidden
        >
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.5"
          />
          <motion.circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeDasharray={`${(displayProgress / 100) * circumference} ${circumference}`}
            initial={false}
            animate={{
              strokeDasharray: `${(displayProgress / 100) * circumference} ${circumference}`,
              opacity: absorbing ? [0.7, 1, 0.85] : 1,
            }}
            transition={{
              duration: absorbing
                ? msToSec(INTEL_MOTION.celebratePulseMs)
                : msToSec(INTEL_MOTION.progressRingMs),
              ease: INTEL_EASE.out,
            }}
          />
        </svg>
      </motion.button>
    </div>
  );
}
