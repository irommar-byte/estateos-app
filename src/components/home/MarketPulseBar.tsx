"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";

type LiveStats = {
  metrics?: {
    activeOffers?: number;
  };
};

export default function MarketPulseBar() {
  const reduceMotion = useReducedMotion();
  const { dict } = useLocale();
  const [activeOffers, setActiveOffers] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/home/live-stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LiveStats | null) => {
        const value = data?.metrics?.activeOffers;
        if (!cancelled && typeof value === "number") setActiveOffers(value);
      })
      .catch(() => {
        if (!cancelled) setActiveOffers(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!activeOffers) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+6.25rem)] z-[60] flex justify-center px-4 sm:top-[calc(env(safe-area-inset-top)+5.25rem)]"
    >
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/50 px-5 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]" />
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-400/90">
          Live Market Pulse: {activeOffers.toLocaleString("en-US")} {dict.homePremium.livePulseActive}
        </span>
      </div>
    </motion.div>
  );
}
