"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Sparkles, TrendingUp } from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

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

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function confidenceLabel(c: number) {
  if (c < 0.12) return "Cold start";
  if (c < 0.35) return "Zarys";
  if (c < 0.6) return "Wyraźny kierunek";
  return "Silny sygnał";
}

export default function DiscoveryPulse() {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState<PulsePayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");
  const [spectacle, setSpectacle] = useState(false);
  const prevProgressRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimerRef.current = setTimeout(() => {
      setExpanded(false);
      setSpectacle(false);
    }, 7000);
  }, [clearHide]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch("/api/discovery/pulse", { credentials: "include", cache: "no-store" });
        if (res.status === 401) {
          setAuth("guest");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const next = data?.pulse as PulsePayload | undefined;
        if (!next) return;

        const prev = prevProgressRef.current;
        const increased = typeof prev === "number" && next.progress > prev;
        if (increased) {
          setSpectacle(true);
          setExpanded(true);
          scheduleHide();
          window.setTimeout(() => setSpectacle(false), 2200);
        }
        prevProgressRef.current = next.progress;

        setPulse(next);
        setAuth("user");
      } catch {
        // no-op
      } finally {
        setLoading(false);
      }
    },
    [scheduleHide],
  );

  useEffect(() => {
    void load();
    return () => clearHide();
  }, [load, clearHide]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load(true)), [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (auth === "guest" || !pulse) return null;

  const progress = Math.max(0, Math.min(100, pulse.progress || 0));
  const contradiction = pulse.contradictionIndex >= 0.55;

  return (
    <div className="pointer-events-none fixed bottom-6 left-4 z-[56] sm:bottom-8 sm:left-6" aria-live="polite">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="pointer-events-auto"
      >
        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.div
              key="expanded"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.97 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.3 }}
              className="max-w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-emerald-500/25 bg-black/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(16,185,129,0.12)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute right-3 top-3 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white/80"
                aria-label="Zwiń pulse"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="mb-2 flex items-center gap-2 pr-6">
                <Sparkles size={14} className="text-emerald-400" aria-hidden />
                <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-300/90">
                  EstateOS™ Inteligence Pulse
                </span>
                {spectacle ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="ml-auto rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-100"
                  >
                    +postęp
                  </motion.span>
                ) : null}
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200/90">
                {pulse.stageLabel} · {progress}%
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{pulse.directionLine}</p>
              <p className="mt-2 text-xs leading-5 text-white/70">{pulse.suggestion}</p>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-white/60">
                  <span>{confidenceLabel(pulse.confidence)}</span>
                  <span>{contradiction ? "Wymaga korekty" : "Stabilnie"}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/12">
                  <motion.div
                    className={`h-full rounded-full ${
                      contradiction
                        ? "bg-gradient-to-r from-amber-300 to-rose-400"
                        : "bg-gradient-to-r from-emerald-300 to-sky-400"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={pulse.primaryCta.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-400"
                >
                  {pulse.primaryCta.label}
                </Link>
                <Link
                  href={pulse.secondaryCta.href}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/10"
                >
                  {pulse.secondaryCta.label}
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed"
              type="button"
              onClick={() => {
                setExpanded(true);
                scheduleHide();
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.28 }}
              className="group flex items-center gap-2 rounded-full border border-emerald-500/25 bg-black/75 px-3 py-2 text-white shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <Sparkles size={13} className="text-emerald-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-white/90">
                {pulse.stageLabel}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-white">
                {progress}%
              </span>
              {loading ? <TrendingUp size={12} className="animate-pulse text-emerald-300" /> : null}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
