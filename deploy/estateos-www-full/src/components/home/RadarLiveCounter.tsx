"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Radar, Sparkles, Users } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  getTotalRadarCount,
  msUntilNextRadarCountChange,
  RADAR_COUNTER_BASE,
} from "@/lib/radarLiveCounter";

type ConfettiPiece = {
  id: number;
  x: number;
  y: number;
  color: string;
  rotate: number;
  drift: number;
};

const CONFETTI_COLORS = ["#10b981", "#34d399", "#D4AF37", "#F9E498", "#ffffff", "#6ee7b7"];

function spawnConfetti(originX: number, originY: number): ConfettiPiece[] {
  return Array.from({ length: 36 }, (_, i) => ({
    id: i,
    x: originX + (Math.random() - 0.5) * 40,
    y: originY + (Math.random() - 0.5) * 20,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 120,
  }));
}

export default function RadarLiveCounter() {
  const { dict, locale } = useLocale();
  const copy = dict.radarLive;
  const reduceMotion = useReducedMotion();

  const [displayCount, setDisplayCount] = useState(RADAR_COUNTER_BASE);
  const [expanded, setExpanded] = useState(false);
  const [spectacle, setSpectacle] = useState(false);
  const [delta, setDelta] = useState(0);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [pinned, setPinned] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(RADAR_COUNTER_BASE);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    if (pinned) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setExpanded(false);
      setSpectacle(false);
    }, 7000);
  }, [pinned, clearHideTimer]);

  const fireSpectacle = useCallback(
    (increase: number) => {
      if (increase <= 0) return;
      setDelta(increase);
      setSpectacle(true);
      setExpanded(true);

      if (!reduceMotion && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setConfetti(spawnConfetti(rect.left + rect.width / 2, rect.top + 24));
        setTimeout(() => setConfetti([]), 2200);
      }

      scheduleAutoHide();
      setTimeout(() => {
        setSpectacle(false);
        setDelta(0);
      }, 2800);
    },
    [reduceMotion, scheduleAutoHide],
  );

  const syncCount = useCallback(() => {
    const target = getTotalRadarCount();
    const prev = prevCountRef.current;
    if (target > prev) {
      fireSpectacle(target - prev);
      setDisplayCount(target);
      prevCountRef.current = target;
    } else if (target !== prev) {
      setDisplayCount(target);
      prevCountRef.current = target;
    }
  }, [fireSpectacle]);

  useEffect(() => {
    syncCount();

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const wait = msUntilNextRadarCountChange();
      if (wait == null) return;
      timeoutId = setTimeout(
        () => {
          syncCount();
          scheduleNext();
        },
        Math.max(800, wait + 120),
      );
    };
    scheduleNext();

    const pollId = setInterval(syncCount, 30_000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(pollId);
      clearHideTimer();
    };
  }, [syncCount, clearHideTimer]);

  useEffect(() => {
    const intro = setTimeout(() => {
      setExpanded(true);
      scheduleAutoHide();
    }, 4200);
    return () => clearTimeout(intro);
  }, [scheduleAutoHide]);

  const toggleExpanded = () => {
    setExpanded((v) => !v);
    if (!expanded) {
      setPinned(true);
      clearHideTimer();
    } else {
      setPinned(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {confetti.map((piece) => (
          <motion.span
            key={piece.id}
            initial={{ opacity: 1, x: piece.x, y: piece.y, rotate: piece.rotate, scale: 1 }}
            animate={{
              opacity: 0,
              x: piece.x + piece.drift,
              y: piece.y + 140 + Math.random() * 80,
              rotate: piece.rotate + 180,
              scale: 0.2,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="pointer-events-none fixed z-[60] h-2 w-2 rounded-sm"
            style={{ backgroundColor: piece.color, boxShadow: `0 0 8px ${piece.color}` }}
            aria-hidden
          />
        ))}
      </AnimatePresence>

      <div
        className="pointer-events-none fixed bottom-6 left-4 z-[55] sm:bottom-8 sm:left-6"
        aria-live="polite"
      >
        <motion.div
          ref={cardRef}
          layout
          initial={{ opacity: 0, x: -80 }}
          animate={{
            opacity: 1,
            x: expanded ? 0 : -12,
            width: expanded ? "auto" : 52,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="pointer-events-auto overflow-hidden rounded-2xl border border-emerald-500/25 bg-black/75 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(16,185,129,0.12)] backdrop-blur-2xl"
        >
          <div className="relative flex items-stretch">
            <button
              type="button"
              onClick={toggleExpanded}
              className="flex shrink-0 flex-col items-center justify-center gap-1 px-3 py-3 text-emerald-400 transition-colors hover:bg-white/5 sm:px-3.5"
              aria-expanded={expanded}
              aria-label={expanded ? copy.collapse : copy.expand}
            >
              {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              {!expanded && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </button>

            <AnimatePresence mode="wait">
              {expanded && (
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="min-w-[220px] max-w-[min(88vw,320px)] border-l border-white/10 py-3.5 pl-3 pr-4 sm:min-w-[260px]">
                    <div className="mb-2 flex items-center gap-2">
                      <Radar size={14} className="text-emerald-400" aria-hidden />
                      <span className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-400/90">
                        {copy.eyebrow}
                      </span>
                      <span className="relative ml-auto flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      </span>
                    </div>

                    <div className="flex items-end gap-2">
                      <motion.span
                        key={displayCount}
                        initial={spectacle ? { scale: 1.35, color: "#F9E498" } : false}
                        animate={{ scale: 1, color: "#ffffff" }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        className="text-4xl font-black tabular-nums leading-none tracking-tight text-white"
                      >
                        {displayCount.toLocaleString(locale === "pl" ? "pl-PL" : "en-US")}
                      </motion.span>
                      <Users size={18} className="mb-1 text-[#D4AF37]/80" aria-hidden />

                      <AnimatePresence>
                        {spectacle && delta > 0 && (
                          <motion.span
                            initial={{ opacity: 0, y: 12, scale: 0.6 }}
                            animate={{ opacity: 1, y: -8, scale: 1 }}
                            exit={{ opacity: 0, y: -28 }}
                            transition={{ duration: 0.55, ease: "easeOut" }}
                            className="mb-1 ml-1 text-lg font-black text-[#F9E498] drop-shadow-[0_0_12px_rgba(249,228,152,0.6)]"
                          >
                            +{delta}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <p className="mt-1.5 text-[11px] font-bold leading-snug text-white/75">
                      {spectacle ? copy.newJoin : copy.joinSuffix}
                    </p>

                    {spectacle && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300/90"
                      >
                        <Sparkles size={12} className="text-[#D4AF37]" aria-hidden />
                        {copy.subtitle}
                      </motion.p>
                    )}

                    {!spectacle && (
                      <p className="mt-2 text-[10px] leading-relaxed text-white/45">{copy.hint}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!expanded && (
              <div className="flex flex-col items-center justify-center gap-0.5 pr-3 py-3">
                <Radar size={18} className="text-emerald-400" aria-hidden />
                <span className="text-sm font-black tabular-nums text-white">{displayCount}</span>
              </div>
            )}
          </div>

          <motion.div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
            animate={spectacle ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.35 }}
            transition={{ duration: spectacle ? 0.8 : 0, repeat: spectacle ? 2 : 0 }}
            aria-hidden
          />
        </motion.div>
      </div>
    </>
  );
}
