"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { numberFormatLocale } from "@/i18n/config";
import type { Locale } from "@/i18n/config";

type LiveStats = {
  metrics?: {
    activeOffers: number;
    newOffers24h: number;
    activeCars: number;
    newCars24h: number;
    marketCities: number;
    registeredMembers: number;
  };
};

function compact(value: number, locale: Locale) {
  return new Intl.NumberFormat(numberFormatLocale(locale), {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function GlobalStats() {
  const { dict, locale } = useLocale();
  const [data, setData] = useState<LiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/home/live-stats", { cache: "no-store" })
      .then((res) => res.json())
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

  const stats = useMemo(() => {
    const metrics = data?.metrics;
    if (!metrics) return [];
    return [
      {
        value: compact(metrics.activeOffers, locale),
        label: dict.homePremium.statsActiveOffers,
        accent: "text-emerald-600 dark:text-emerald-400",
      },
      {
        value: compact(metrics.activeCars ?? 0, locale),
        label: dict.homePremium.statsActiveCars,
        accent: "text-sky-600 dark:text-sky-400",
      },
      {
        value: `+${compact(metrics.newOffers24h, locale)}`,
        label: dict.homePremium.statsNewOffers24h,
        accent: "text-emerald-600 dark:text-emerald-400",
      },
      {
        value: `+${compact(metrics.newCars24h ?? 0, locale)}`,
        label: dict.homePremium.statsNewCars24h,
        accent: "text-sky-600 dark:text-sky-400",
      },
    ];
  }, [data, dict.homePremium, locale]);

  if (!stats.length) return null;

  return (
    <section className="relative z-10 border-y border-[var(--eos-border)] bg-[var(--eos-surface)] py-16 backdrop-blur-3xl sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.05),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(14,165,233,0.06),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-12 sm:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--eos-muted)]">
            EstateOS™ Home · Car
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-[var(--eos-text)] sm:text-3xl">
            {dict.homePremium.statsSectionTitle}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
              className="text-center sm:text-left"
            >
              <h4 className="text-4xl font-light tracking-tighter text-[var(--eos-text)] sm:text-5xl lg:text-6xl">
                {stat.value}
              </h4>
              <p className={`mt-3 text-[11px] font-black uppercase tracking-[0.25em] ${stat.accent}`}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
