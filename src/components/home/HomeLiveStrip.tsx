"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { numberFormatLocale } from "@/i18n/config";
import type { Locale } from "@/i18n/config";

type LiveStats = {
  metrics?: {
    activeOffers?: number;
    newOffers24h?: number;
    activeCars?: number;
    newCars24h?: number;
  };
};

function compact(value: number, locale: Locale) {
  return new Intl.NumberFormat(numberFormatLocale(locale), {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function HomeLiveStrip() {
  const reduceMotion = useReducedMotion();
  const { dict, locale } = useLocale();
  const [data, setData] = useState<LiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home/live-stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = data?.metrics;
  const stats = useMemo(() => {
    if (!metrics) return [];
    const offers = metrics.activeOffers;
    const cars = metrics.activeCars;
    if (typeof offers !== "number" && typeof cars !== "number") return [];
    return [
      {
        value: compact(offers ?? 0, locale),
        label: dict.homePremium.statsActiveOffers,
        accent: "text-emerald-700 dark:text-emerald-400",
      },
      {
        value: compact(cars ?? 0, locale),
        label: dict.homePremium.statsActiveCars,
        accent: "text-sky-700 dark:text-sky-400",
      },
      {
        value: `+${compact(metrics.newOffers24h ?? 0, locale)}`,
        label: dict.homePremium.statsNewOffers24h,
        accent: "text-emerald-700 dark:text-emerald-400",
      },
      {
        value: `+${compact(metrics.newCars24h ?? 0, locale)}`,
        label: dict.homePremium.statsNewCars24h,
        accent: "text-sky-700 dark:text-sky-400",
      },
    ];
  }, [metrics, dict.homePremium, locale]);

  if (!stats.length) return null;

  const fmt = (n: number) => n.toLocaleString(numberFormatLocale(locale));

  return (
    <section className="relative z-10 mt-2 px-4 pb-2 sm:mt-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.2 : 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="eos-lux-panel mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(26,27,30,0.06)] px-5 py-3.5 sm:px-7">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.55)]" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(26,27,30,0.62)] dark:text-[var(--eos-muted)]">
              {dict.pulse.liveFrom}
              {typeof metrics?.activeOffers === "number" ? (
                <>
                  {": "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {fmt(metrics.activeOffers)} {dict.homePremium.livePulseActiveHome}
                  </span>
                </>
              ) : null}
              {typeof metrics?.activeOffers === "number" && typeof metrics?.activeCars === "number" ? (
                <span className="mx-2 text-[var(--eos-subtle)]">·</span>
              ) : null}
              {typeof metrics?.activeCars === "number" ? (
                <span className="text-sky-700 dark:text-sky-400">
                  {fmt(metrics.activeCars)} {dict.homePremium.livePulseActiveCars}
                </span>
              ) : null}
            </p>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-subtle)]">
            EstateOS™ Home · Car
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 px-5 py-8 sm:gap-8 sm:px-7 md:grid-cols-4 md:py-10">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="text-left"
            >
              <h3 className="text-3xl font-light tracking-tighter text-[#141516] dark:text-[var(--eos-text)] sm:text-4xl lg:text-5xl">
                {stat.value}
              </h3>
              <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.2em] ${stat.accent}`}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
