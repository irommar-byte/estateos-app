"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { numberFormatLocale } from "@/i18n/config";

type LiveStats = {
  metrics?: {
    activeOffers?: number;
    activeCars?: number;
  };
};

export default function MarketPulseBar() {
  const reduceMotion = useReducedMotion();
  const { dict, locale } = useLocale();
  const [activeOffers, setActiveOffers] = useState<number | null>(null);
  const [activeCars, setActiveCars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/home/live-stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LiveStats | null) => {
        if (cancelled) return;
        const offers = data?.metrics?.activeOffers;
        const cars = data?.metrics?.activeCars;
        if (typeof offers === "number") setActiveOffers(offers);
        if (typeof cars === "number") setActiveCars(cars);
      })
      .catch(() => {
        if (!cancelled) {
          setActiveOffers(null);
          setActiveCars(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!activeOffers && !activeCars) return null;

  const fmt = (n: number) => n.toLocaleString(numberFormatLocale(locale));

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-20 -mt-10 flex justify-center px-4 pb-6 sm:-mt-12 sm:pb-8"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-black/50 px-5 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]" />
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/85">
          {dict.pulse.liveFrom}:{" "}
          {activeOffers != null ? (
            <span className="text-emerald-400/95">
              {fmt(activeOffers)} {dict.homePremium.livePulseActiveHome}
            </span>
          ) : null}
          {activeOffers != null && activeCars != null ? (
            <span className="mx-2 text-white/35">·</span>
          ) : null}
          {activeCars != null ? (
            <span className="text-sky-400/95">
              {fmt(activeCars)} {dict.homePremium.livePulseActiveCars}
            </span>
          ) : null}
        </span>
      </div>
    </motion.div>
  );
}
