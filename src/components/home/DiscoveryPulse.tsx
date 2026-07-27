"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, ChevronDown } from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";

type PulsePayload = {
  stageLabel: string;
  progress: number;
  confidence: number;
  contradictionIndex: number;
  directionLine: string;
  suggestion: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
};

type PresentReason = "progress" | "milestone" | "contradiction" | "ready_peek" | "manual";

const spring = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.85 };
const SESSION_PEEK_KEY = "eos_intel_peek_v1";
const SESSION_MILESTONE_KEY = "eos_intel_milestones_v1";

const REASON_COPY: Record<
  Exclude<PresentReason, "manual">,
  { badge: string; lead: string }
> = {
  progress: { badge: "Postęp", lead: "Kierunek się właśnie wyostrzył." },
  milestone: { badge: "Gotowość", lead: "Twój profil przekroczył nowy próg." },
  contradiction: { badge: "Korekta", lead: "Sygnały się mieszają — warto spokojnie doprecyzować." },
  ready_peek: { badge: "Trop", lead: "Masz wystarczająco wyraźny kierunek, by na chwilę zajrzeć." },
};

function confidenceLabel(c: number) {
  if (c < 0.12) return "Start";
  if (c < 0.35) return "Zarys";
  if (c < 0.6) return "Wyraźny kierunek";
  return "Silny sygnał";
}

type OrbMood = "calm" | "active" | "alert" | "celebrate";

function resolveMood(pulse: PulsePayload, spectacle: boolean): OrbMood {
  if (spectacle) return "celebrate";
  if (pulse.contradictionIndex >= 0.55) return "alert";
  if (pulse.progress >= 35 || pulse.confidence >= 0.35) return "active";
  return "calm";
}

const MOOD_COLORS: Record<
  OrbMood,
  { core: string; glow: string; ring: string; stroke: string; speed: number }
> = {
  calm: {
    core: "text-emerald-300",
    glow: "rgba(52,211,153,0.55)",
    ring: "border-emerald-400/35",
    stroke: "#34d399",
    speed: 3.6,
  },
  active: {
    core: "text-sky-300",
    glow: "rgba(56,189,248,0.55)",
    ring: "border-sky-400/40",
    stroke: "#38bdf8",
    speed: 2.2,
  },
  alert: {
    core: "text-amber-300",
    glow: "rgba(251,191,36,0.6)",
    ring: "border-amber-400/45",
    stroke: "#fbbf24",
    speed: 1.35,
  },
  celebrate: {
    core: "text-[#F9E498]",
    glow: "rgba(249,228,152,0.75)",
    ring: "border-[#F9E498]/50",
    stroke: "#F9E498",
    speed: 0.9,
  },
};

function readMilestones(): number[] {
  try {
    const raw = sessionStorage.getItem(SESSION_MILESTONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function writeMilestones(values: number[]) {
  try {
    sessionStorage.setItem(SESSION_MILESTONE_KEY, JSON.stringify(values));
  } catch {
    /* quiet */
  }
}

function crossedMilestone(prev: number | null, next: number): number | null {
  const gates = [25, 50, 75, 90];
  for (const gate of gates) {
    if ((prev == null || prev < gate) && next >= gate) return gate;
  }
  return null;
}

function IntelligenceBrain({
  mood,
  reduceMotion,
  absorbing,
  size = 18,
}: {
  mood: OrbMood;
  reduceMotion: boolean | null;
  absorbing: boolean;
  size?: number;
}) {
  const colors = MOOD_COLORS[mood];
  return (
    <span className="relative flex items-center justify-center">
      {!reduceMotion ? (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-[-6px] rounded-full transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: `0 0 0 1px ${colors.glow}` }}
            animate={
              absorbing
                ? { scale: [1, 1.55, 1], opacity: [0.55, 0, 0.55] }
                : { scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }
            }
            transition={{
              duration: absorbing ? 0.55 : colors.speed,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          {/* Hover dazzle bloom */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-10px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
              filter: "blur(6px)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-2px] overflow-hidden rounded-full opacity-0 group-hover:opacity-100"
          >
            <span className="eos-brain-flare absolute inset-y-[-20%] left-[-60%] w-[45%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          </span>
          <motion.span
            aria-hidden
            className="absolute h-1 w-1 rounded-full bg-white/70"
            style={{ boxShadow: `0 0 8px ${colors.glow}` }}
            animate={{
              x: [0, 5, -4, 0],
              y: [-3, 2, 4, -3],
              opacity: [0.2, 0.85, 0.35, 0.2],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="absolute h-0.5 w-0.5 rounded-full bg-white/60"
            animate={{
              x: [0, -6, 3, 0],
              y: [2, -3, 1, 2],
              opacity: [0.15, 0.7, 0.25, 0.15],
            }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
        </>
      ) : null}
      <motion.span
        className={`relative z-[1] ${colors.core} transition-[filter,transform] duration-300 group-hover:scale-110 group-hover:brightness-125`}
        style={{ filter: `drop-shadow(0 0 10px ${colors.glow})` }}
        animate={
          reduceMotion
            ? undefined
            : absorbing
              ? { scale: [1, 1.22, 1], rotate: [0, -4, 3, 0] }
              : { scale: [1, 1.06, 1], opacity: [0.88, 1, 0.88] }
        }
        transition={
          absorbing
            ? { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
            : { duration: colors.speed * 0.9, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <Brain size={size} strokeWidth={1.75} aria-hidden />
      </motion.span>
    </span>
  );
}

export default function DiscoveryPulse() {
  const reduceMotion = useReducedMotion();
  const { enabled: intelligenceEnabled, hydrated: intelligenceHydrated } =
    useIntelligencePreference();
  const [pulse, setPulse] = useState<PulsePayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");
  const [spectacle, setSpectacle] = useState(false);
  const [presentReason, setPresentReason] = useState<PresentReason | null>(null);
  const [absorbing, setAbsorbing] = useState(false);
  const [fillBoost, setFillBoost] = useState(0);
  const prevProgressRef = useRef<number | null>(null);
  const prevContradictionRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absorbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootPeekDoneRef = useRef(false);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const collapseToOrb = useCallback(() => {
    clearHide();
    setExpanded(false);
    setSpectacle(false);
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
    }, 900);
  }, [clearHide, reduceMotion]);

  const scheduleHide = useCallback(
    (ms = 7800) => {
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        collapseToOrb();
      }, ms);
    },
    [clearHide, collapseToOrb],
  );

  const presentGently = useCallback(
    (kind: PresentReason) => {
      if (!intelligenceEnabled) return;
      if (kind === "manual") {
        setPresentReason(null);
        setExpanded(true);
        scheduleHide(9000);
        return;
      }
      setPresentReason(kind);
      setExpanded(true);
      setSpectacle(kind === "progress" || kind === "milestone");
      void playIntelligenceChime(kind === "progress" || kind === "milestone" ? "progress" : "suggest");
      scheduleHide(kind === "contradiction" ? 9000 : kind === "ready_peek" ? 7500 : 8200);
      window.setTimeout(() => setSpectacle(false), 2400);
    },
    [intelligenceEnabled, scheduleHide],
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
        const increased = typeof prev === "number" && next.progress > prev + 0.5;
        const milestone = crossedMilestone(prev, next.progress);
        const contraRising =
          typeof prevContra === "number" &&
          prevContra < 0.55 &&
          next.contradictionIndex >= 0.55;

        if (!silent || increased || milestone || contraRising) {
          if (contraRising) {
            presentGently("contradiction");
          } else if (milestone != null) {
            const seen = readMilestones();
            if (!seen.includes(milestone)) {
              writeMilestones([...seen, milestone]);
              presentGently("milestone");
            } else if (increased) {
              presentGently("progress");
            }
          } else if (increased) {
            presentGently("progress");
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
    return () => {
      clearHide();
      if (absorbTimerRef.current) clearTimeout(absorbTimerRef.current);
    };
  }, [load, clearHide]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load(true)), [load]);

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
    const meaningful = pulse.progress >= 40 || pulse.confidence >= 0.32;
    if (!meaningful) return;
    try {
      if (sessionStorage.getItem(SESSION_PEEK_KEY) === "1") {
        bootPeekDoneRef.current = true;
        return;
      }
    } catch {
      /* quiet */
    }

    bootPeekDoneRef.current = true;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_PEEK_KEY, "1");
      } catch {
        /* quiet */
      }
      presentGently(pulse.contradictionIndex >= 0.55 ? "contradiction" : "ready_peek");
    }, 2200);
    return () => window.clearTimeout(t);
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
  const contradiction = pulse.contradictionIndex >= 0.55;
  const mood = resolveMood(pulse, spectacle);
  const colors = MOOD_COLORS[mood];
  const reasonMeta =
    presentReason && presentReason !== "manual" ? REASON_COPY[presentReason] : null;

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
                : { opacity: 0, y: 28, scale: 0.72, filter: "blur(10px)" }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 36,
                    scaleX: 0.22,
                    scaleY: 0.12,
                    filter: "blur(12px)",
                    borderRadius: "999px",
                  }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : {
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                    opacity: { duration: 0.28 },
                    filter: { duration: 0.28 },
                  }
            }
            style={{ transformOrigin: "24px 100%" }}
            className="pointer-events-auto relative max-w-[min(90vw,340px)] overflow-hidden rounded-[1.35rem] border border-white/12 bg-[rgba(8,10,14,0.82)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-[28px]"
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
              aria-label="Zwiń EstateOS Inteligence"
            >
              <ChevronDown size={14} />
            </button>

            <div className="relative mb-2.5 flex items-center gap-2 pr-7">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <IntelligenceBrain mood={mood} reduceMotion={reduceMotion} absorbing={false} size={14} />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">
                EstateOS™ Inteligence
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

            <div className="relative mt-3.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-white/45">
                <span>{confidenceLabel(pulse.confidence)}</span>
                <span>{contradiction ? "Wymaga korekty" : "Stabilnie"}</span>
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
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

              <div className="relative mt-4 flex flex-wrap gap-2">
                <Link
                  href={pulse.primaryCta.href}
                  className="eos-btn eos-btn--primary eos-btn--sm !normal-case !tracking-wide !text-[11px] !font-semibold"
                >
                  {pulse.primaryCta.label}
                </Link>
                <Link
                  href={pulse.secondaryCta.href}
                  className="eos-btn eos-btn--secondary eos-btn--sm !normal-case !tracking-wide !text-[11px] !font-semibold"
                >
                  {pulse.secondaryCta.label}
                </Link>
              </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Lamp / orb — always the genie destination */}
      <motion.button
        type="button"
        onClick={() => presentGently("manual")}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
        animate={{
          opacity: 1,
          scale: absorbing ? [1, 1.14, 1] : 1,
        }}
        transition={reduceMotion ? { duration: 0.12 } : spring}
        className={`pointer-events-auto group relative flex h-12 w-12 items-center justify-center rounded-full border ${colors.ring} bg-[rgba(8,10,14,0.78)] shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_1px_rgba(255,255,255,0.12)_inset] backdrop-blur-2xl transition-all duration-300 hover:scale-[1.1] hover:brightness-125 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_28px_rgba(255,255,255,0.28),0_16px_40px_rgba(0,0,0,0.5)] active:scale-[0.96]`}
        aria-label={`EstateOS Inteligence · ${pulse.stageLabel} ${progress}%`}
        aria-expanded={expanded}
        title={`${pulse.stageLabel} · ${progress}%`}
      >
        {!reduceMotion ? (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 1px ${colors.glow}` }}
            animate={{
              scale: absorbing ? [1, 1.45, 1] : [1, 1.28, 1],
              opacity: absorbing ? [0.55, 0, 0.55] : [0.35, 0, 0.35],
            }}
            transition={{
              duration: absorbing ? 0.55 : colors.speed,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ) : null}

        {/* Absorb fill wash */}
        <AnimatePresence>
          {absorbing ? (
            <motion.span
              aria-hidden
              className="absolute inset-[3px] rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 70%, ${colors.glow}, transparent 70%)`,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0.2, 0.85, 0.15], scale: [0.55, 1.05, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : null}
        </AnimatePresence>

        <IntelligenceBrain mood={mood} reduceMotion={reduceMotion} absorbing={absorbing} size={18} />

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
            strokeDasharray={`${(displayProgress / 100) * 106.76} 106.76`}
            initial={false}
            animate={{
              strokeDasharray: `${(displayProgress / 100) * 106.76} 106.76`,
              opacity: absorbing ? [0.7, 1, 0.85] : 1,
            }}
            transition={{ duration: absorbing ? 0.7 : 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </motion.button>
    </div>
  );
}
