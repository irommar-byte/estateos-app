"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, X } from "lucide-react";
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

function StageStepper({
  activeIndex,
  labels,
}: {
  activeIndex: number;
  labels: Record<StageKey, string>;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="list"
      aria-label={STAGE_ORDER.map((k) => labels[k]).join(" · ")}
    >
      {STAGE_ORDER.map((key, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;
        return (
          <span
            key={key}
            role="listitem"
            title={labels[key]}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              current
                ? "w-5 bg-white/90"
                : done
                  ? "w-1.5 bg-white/45"
                  : "w-1.5 bg-white/15"
            }`}
          />
        );
      })}
    </div>
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
  const presentReasonRef = useRef<PresentReason | null>(null);
  const hidePausedRef = useRef(false);
  const hideRemainingRef = useRef(0);
  const hideDeadlineRef = useRef(0);

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
    hidePausedRef.current = false;
    hideRemainingRef.current = 0;
    hideDeadlineRef.current = 0;
  }, []);

  const collapseToOrb = useCallback(() => {
    clearHide();
    setExpanded(false);
    expandedRef.current = false;
    presentReasonRef.current = null;
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
      if (ms <= 0) return;
      hideRemainingRef.current = ms;
      hideDeadlineRef.current = Date.now() + ms;
      hideTimerRef.current = setTimeout(() => {
        collapseToOrb();
      }, ms);
    },
    [clearHide, collapseToOrb],
  );

  const pauseHide = useCallback(() => {
    if (!hideTimerRef.current || hidePausedRef.current) return;
    const remaining = Math.max(0, hideDeadlineRef.current - Date.now());
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
    hidePausedRef.current = true;
    hideRemainingRef.current = remaining;
  }, []);

  const resumeHide = useCallback(() => {
    if (!hidePausedRef.current || hideRemainingRef.current <= 0) return;
    hidePausedRef.current = false;
    const ms = hideRemainingRef.current;
    hideDeadlineRef.current = Date.now() + ms;
    hideTimerRef.current = setTimeout(() => {
      collapseToOrb();
    }, ms);
  }, [collapseToOrb]);

  const presentGently = useCallback(
    async (kind: PresentReason) => {
      if (!intelligenceEnabled) return;
      wakeOil();

      if (kind === "manual") {
        setPresentReason(null);
        presentReasonRef.current = "manual";
        setExpanded(true);
        expandedRef.current = true;
        dispatchIntelligenceSheetOpen(true);
        clearHide();
        return;
      }

      const allowed = await consumeAutoBudget(webStore);
      if (!allowed) return;

      setPresentReason(kind);
      presentReasonRef.current = kind;
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
    [clearHide, intelligenceEnabled, scheduleHide, wakeOil],
  );

  const toggleOrb = useCallback(() => {
    wakeOil();
    if (expandedRef.current) {
      collapseToOrb();
      return;
    }
    void presentGently("manual");
  }, [collapseToOrb, presentGently, wakeOil]);

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
        if (!intelligenceEnabled) return;
        if (!detail?.kind || detail.kind === "open" || detail.kind === "other") return;
        wakeOil();
        setSplashKey((k) => k + 1);
        void playIntelligenceChime("learn");
      }),
    [intelligenceEnabled, wakeOil],
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        collapseToOrb();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, collapseToOrb]);

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
  const stageLabels: Record<StageKey, string> = {
    EXPLORE: dict.intelligence.stageExplore,
    FOCUS: dict.intelligence.stageFocus,
    READY: dict.intelligence.stageReady,
    COMPLETE: dict.intelligence.stageComplete,
  };
  const currentStageLabel = stageLabels[activeStage] || pulse.stageLabel;

  const reasonLead =
    presentReason && presentReason !== "manual"
      ? {
          progress: dict.intelligence.progressLead,
          milestone: dict.intelligence.milestoneLead,
          contradiction: dict.intelligence.contradictionLead,
          ready_peek: dict.intelligence.readyPeekLead,
        }[presentReason]
      : null;

  const circumference = 2 * Math.PI * 17;

  const onSheetEnter = () => {
    wakeOil();
    pauseHide();
  };
  const onSheetLeave = () => {
    resumeHide();
  };

  const onCtaClick = () => {
    wakeOil();
    collapseToOrb();
  };

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-3 z-[56] flex flex-col items-start gap-2.5 sm:bottom-8 sm:left-6"
      aria-live="polite"
    >
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="expanded"
            role="dialog"
            aria-modal="false"
            aria-labelledby="eos-intel-pulse-title"
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
            className="pointer-events-auto relative w-[min(90vw,320px)] overflow-hidden rounded-[28px] border border-white/[0.14] bg-[rgba(10,12,16,0.78)] px-5 pb-5 pt-4 shadow-[0_28px_90px_rgba(0,0,0,0.55),0_0_1px_rgba(255,255,255,0.1)_inset] backdrop-blur-[40px]"
            onMouseEnter={onSheetEnter}
            onMouseLeave={onSheetLeave}
            onFocusCapture={onSheetEnter}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                onSheetLeave();
              }
            }}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-12 -top-14 h-36 w-36 rounded-full blur-3xl"
              style={{ background: colors.glow }}
              animate={
                reduceMotion
                  ? { opacity: 0.22 }
                  : { opacity: [0.14, 0.32, 0.14], scale: [1, 1.06, 1] }
              }
              transition={{ duration: colors.speed + 1.4, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={collapseToOrb}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/45 transition hover:bg-white/[0.12] hover:text-white/85"
              aria-label={dict.intelligence.collapseA11y}
            >
              <X size={13} strokeWidth={2.25} />
            </button>

            <div className="relative mb-3.5 flex items-center gap-2.5 pr-8">
              <IntelligenceBrain
                mood={mood}
                reduceMotion={reduceMotion}
                absorbing={false}
                size={13}
                oilActive={oilActive}
              />
              <span className="text-[10px] font-semibold tracking-[0.04em] text-white/55">
                {dict.intelligence.brandEyebrow}
              </span>
            </div>

            {reasonLead ? (
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-2.5 text-[12px] font-medium leading-snug tracking-tight text-white/70"
              >
                {reasonLead}
              </motion.p>
            ) : null}

            <h2
              id="eos-intel-pulse-title"
              className="relative text-[17px] font-semibold leading-[1.25] tracking-[-0.02em] text-white"
            >
              {pulse.directionLine}
            </h2>
            <p className="relative mt-2 text-[13px] leading-relaxed text-white/55">
              {pulse.suggestion}
            </p>

            <div className="relative mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium tracking-wide text-white/50">
                  {currentStageLabel}
                  <span className="mx-1.5 text-white/20">·</span>
                  <span className="tabular-nums text-white/75">{progress}%</span>
                </p>
                <StageStepper activeIndex={activeStageIndex} labels={stageLabels} />
              </div>
              <div className="h-[2.5px] overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-white/35 via-white/80 to-white/55"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: msToSec(INTEL_MOTION.progressBarMs), ease: INTEL_EASE.out }}
                />
              </div>
            </div>

            <div className="relative mt-5 flex flex-col items-stretch gap-2.5">
              <Link
                href={pulse.primaryCta.href}
                className="eos-btn eos-btn--primary eos-btn--block !normal-case !tracking-wide !text-[13px] !font-semibold"
                onClick={onCtaClick}
              >
                {pulse.primaryCta.label}
              </Link>
              {pulse.secondaryCta?.href ? (
                <Link
                  href={pulse.secondaryCta.href}
                  className="rounded-full px-3 py-2 text-center text-[12px] font-medium tracking-wide text-white/55 transition hover:text-white/90"
                  onClick={onCtaClick}
                >
                  {pulse.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={toggleOrb}
        onMouseEnter={wakeOil}
        onFocus={wakeOil}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
        animate={{
          opacity: 1,
          scale: absorbing ? [1, 1.14, 1] : 1,
        }}
        transition={reduceMotion ? { duration: 0.12 } : INTEL_ORB_SPRING}
        className={`pointer-events-auto group relative flex h-12 w-12 items-center justify-center rounded-full border ${ringClass} bg-transparent shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-all duration-300 hover:scale-[1.1] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_28px_rgba(255,255,255,0.28),0_16px_40px_rgba(0,0,0,0.5)] active:scale-[0.96]`}
        aria-label={`EstateOS Intelligence · ${currentStageLabel} ${progress}%`}
        aria-expanded={expanded}
        title={`${currentStageLabel} · ${progress}%`}
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
