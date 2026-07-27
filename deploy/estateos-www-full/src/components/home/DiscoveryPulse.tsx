"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";

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

const spring = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.85 };

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

const MOOD_COLORS: Record<OrbMood, { core: string; glow: string; ring: string; speed: number }> = {
  calm: {
    core: "bg-emerald-400",
    glow: "rgba(52,211,153,0.55)",
    ring: "border-emerald-400/35",
    speed: 3.6,
  },
  active: {
    core: "bg-sky-400",
    glow: "rgba(56,189,248,0.55)",
    ring: "border-sky-400/40",
    speed: 2.2,
  },
  alert: {
    core: "bg-amber-400",
    glow: "rgba(251,191,36,0.6)",
    ring: "border-amber-400/45",
    speed: 1.35,
  },
  celebrate: {
    core: "bg-[#F9E498]",
    glow: "rgba(249,228,152,0.75)",
    ring: "border-[#F9E498]/50",
    speed: 0.9,
  },
};

export default function DiscoveryPulse() {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState<PulsePayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");
  const [spectacle, setSpectacle] = useState(false);
  const [hintFlash, setHintFlash] = useState(false);
  const prevProgressRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (ms = 7800) => {
      clearHide();
      hideTimerRef.current = setTimeout(() => {
        setExpanded(false);
        setSpectacle(false);
        setHintFlash(false);
      }, ms);
    },
    [clearHide],
  );

  const presentGently = useCallback(
    (kind: "suggest" | "progress") => {
      setExpanded(true);
      setSpectacle(kind === "progress");
      setHintFlash(true);
      void playIntelligenceChime(kind);
      scheduleHide(kind === "progress" ? 8200 : 7000);
      window.setTimeout(() => setSpectacle(false), 2400);
      window.setTimeout(() => setHintFlash(false), 3200);
    },
    [scheduleHide],
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
        const increased = typeof prev === "number" && next.progress > prev;
        if (increased && !silent) {
          presentGently("progress");
        } else if (increased && silent) {
          // Cross-tab / discovery event — still celebrate softly
          presentGently("progress");
        }
        prevProgressRef.current = next.progress;

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
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
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

  // Occasional calm whisper — only when collapsed and user is idle with the page
  useEffect(() => {
    if (auth !== "user" || !pulse || expanded || reduceMotion) return;

    const scheduleWhisper = () => {
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
      // 45–90s of quiet life, then a soft suggestion peek
      const wait = 45_000 + Math.random() * 45_000;
      whisperTimerRef.current = setTimeout(() => {
        if (document.visibilityState !== "visible") {
          scheduleWhisper();
          return;
        }
        presentGently("suggest");
        scheduleWhisper();
      }, wait);
    };

    scheduleWhisper();
    return () => {
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
    };
  }, [auth, pulse, expanded, reduceMotion, presentGently]);

  if (auth === "guest" || auth === "unknown" || !pulse) return null;

  const progress = Math.max(0, Math.min(100, pulse.progress || 0));
  const contradiction = pulse.contradictionIndex >= 0.55;
  const mood = resolveMood(pulse, spectacle);
  const colors = MOOD_COLORS[mood];

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-4 z-[56] sm:bottom-8 sm:left-6"
      aria-live="polite"
    >
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="pointer-events-auto"
      >
        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.div
              key="expanded"
              layout
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
              transition={reduceMotion ? { duration: 0.15 } : spring}
              className="relative max-w-[min(90vw,340px)] overflow-hidden rounded-[1.35rem] border border-white/12 bg-[rgba(8,10,14,0.82)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-[28px]"
            >
              {/* soft living aura */}
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
                onClick={() => {
                  clearHide();
                  setExpanded(false);
                  setSpectacle(false);
                }}
                className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/75"
                aria-label="Zwiń EstateOS Inteligence"
              >
                <ChevronDown size={14} />
              </button>

              <div className="relative mb-2.5 flex items-center gap-2 pr-7">
                <span className="relative flex h-2 w-2">
                  {!reduceMotion ? (
                    <motion.span
                      className={`absolute inline-flex h-full w-full rounded-full ${colors.core} opacity-50`}
                      animate={{ scale: [1, 1.85, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: colors.speed, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${colors.core}`}
                    style={{ boxShadow: `0 0 10px ${colors.glow}` }}
                  />
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">
                  EstateOS™ Inteligence
                </span>
                {hintFlash ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ml-auto rounded-full border border-white/12 bg-white/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70"
                  >
                    {spectacle ? "Postęp" : "Szept"}
                  </motion.span>
                ) : null}
              </div>

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
                  className="inline-flex items-center rounded-full bg-white px-3.5 py-2 text-[11px] font-semibold tracking-wide text-black transition hover:bg-white/90"
                >
                  {pulse.primaryCta.label}
                </Link>
                <Link
                  href={pulse.secondaryCta.href}
                  className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-white/75 transition hover:bg-white/[0.08]"
                >
                  {pulse.secondaryCta.label}
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="orb"
              type="button"
              layout
              onClick={() => {
                setExpanded(true);
                scheduleHide(9000);
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={reduceMotion ? { duration: 0.12 } : spring}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-full border ${colors.ring} bg-[rgba(8,10,14,0.72)] shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_1px_rgba(255,255,255,0.12)_inset] backdrop-blur-2xl transition-transform hover:scale-[1.06] active:scale-[0.96]`}
              aria-label={`EstateOS Inteligence · ${pulse.stageLabel} ${progress}%`}
              title={`${pulse.stageLabel} · ${progress}%`}
            >
              {/* outer breath ring */}
              {!reduceMotion ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 1px ${colors.glow}` }}
                  animate={{ scale: [1, 1.28, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: colors.speed, repeat: Infinity, ease: "easeOut" }}
                />
              ) : null}

              <span className="relative z-[1] flex h-2.5 w-2.5 items-center justify-center">
                {!reduceMotion ? (
                  <motion.span
                    className={`absolute inline-flex h-full w-full rounded-full ${colors.core}`}
                    animate={{ scale: [1, 2.1, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: colors.speed, repeat: Infinity, ease: "easeOut" }}
                  />
                ) : null}
                <motion.span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors.core}`}
                  style={{ boxShadow: `0 0 14px ${colors.glow}` }}
                  animate={
                    reduceMotion
                      ? undefined
                      : { scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }
                  }
                  transition={{ duration: colors.speed * 0.85, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>

              {/* Progress ring — perfectly centered in the orb */}
              <svg
                className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 -rotate-90"
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
                  stroke={mood === "alert" ? "#fbbf24" : mood === "celebrate" ? "#F9E498" : "#34d399"}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 106.76} 106.76`}
                  initial={false}
                  animate={{ strokeDasharray: `${(progress / 100) * 106.76} 106.76` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>

              <span className="sr-only">
                <Sparkles size={12} />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
