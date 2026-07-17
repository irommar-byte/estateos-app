"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, ChevronLeft, ChevronRight, MapPin, PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import {
  MARKET_CHART_COLORS,
  MARKET_PROPERTY_TYPES,
  buildMarketView,
  countOffersByPropertyType,
  type MarketDrillPath,
  type MarketOfferRow,
  type MarketPropertyFilter,
} from "@/lib/adminMarketAnalytics";

function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: Array<{ name: string; value: number; fill: string }>;
  centerLabel: string;
  centerValue: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[var(--eos-muted)]">
        Brak danych do wykresu
      </div>
    );
  }
  return (
    <div className="relative h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={68}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as { name: string; value: number };
              return (
                <div className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2 text-xs shadow-lg">
                  <p className="font-bold text-[var(--eos-text)]">{p.name}</p>
                  <p className="text-[var(--eos-muted)]">{p.value} ofert</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">{centerLabel}</p>
        <p className="text-lg font-black tabular-nums text-[var(--eos-text)]">{centerValue}</p>
      </div>
    </div>
  );
}

function PriceBars({
  data,
  maxValue,
}: {
  data: Array<{ name: string; value: number; fill: string; count: number }>;
  maxValue: number;
}) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[var(--eos-muted)]">
        Brak wiarygodnych cen m²
      </div>
    );
  }
  return (
    <ul className="flex h-44 flex-col justify-center gap-2">
      {data.map((row) => {
        const width = Math.max((row.value / Math.max(maxValue, 1)) * 100, 6);
        return (
          <li key={row.name} className="min-w-0">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-semibold text-[var(--eos-text)]">{row.name}</span>
              <span className="shrink-0 text-[11px] font-black tabular-nums text-[var(--eos-text)]">
                {row.value.toLocaleString("pl-PL")}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--eos-border)]">
              <div className="h-full rounded-full" style={{ width: `${width}%`, background: row.fill }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminMarketAnalyticsPanel({ offers }: { offers: MarketOfferRow[] }) {
  const [propertyFilter, setPropertyFilter] = useState<MarketPropertyFilter>("FLAT");
  const [drill, setDrill] = useState<MarketDrillPath>({});

  const typeCounts = useMemo(() => countOffersByPropertyType(offers), [offers]);
  const view = useMemo(() => buildMarketView(offers, propertyFilter, drill), [offers, propertyFilter, drill]);

  const displayPrice = (bucket: { medianSqm: number; avgSqm: number }) =>
    bucket.medianSqm > 0 ? bucket.medianSqm : bucket.avgSqm;

  const maxPrice = Math.max(...view.buckets.map((b) => displayPrice(b)), 1);

  const shareChartData = useMemo(
    () =>
      view.buckets.slice(0, 8).map((b, i) => ({
        name: b.label,
        value: b.count,
        fill: MARKET_CHART_COLORS[i % MARKET_CHART_COLORS.length],
      })),
    [view.buckets],
  );

  const priceChartData = useMemo(
    () =>
      view.buckets.slice(0, 6).map((b, i) => ({
        name: b.label,
        value: displayPrice(b),
        count: b.count,
        fill: MARKET_CHART_COLORS[i % MARKET_CHART_COLORS.length],
      })),
    [view.buckets],
  );

  const levelTitle =
    view.level === "country"
      ? "Kraje"
      : view.level === "city"
        ? `Miasta · ${drill.countryName || drill.countryCode}`
        : `Dzielnice · ${drill.city}`;

  const drillInto = (bucket: { key: string; label: string }) => {
    if (view.level === "country") {
      setDrill({ countryCode: bucket.key, countryName: bucket.label });
    } else if (view.level === "city") {
      setDrill((prev) => ({ ...prev, city: bucket.label }));
    }
  };

  const drillBack = () => {
    if (drill.city) {
      setDrill({ countryCode: drill.countryCode, countryName: drill.countryName });
    } else if (drill.countryCode) {
      setDrill({});
    }
  };

  const propertyLabel = MARKET_PROPERTY_TYPES.find((t) => t.id === propertyFilter)?.label ?? "—";
  const headlinePrice = view.summary.medianSqm || view.summary.avgSqm;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
      <div className="border-b border-[var(--eos-border)] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Analiza rynku
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--eos-text)] sm:text-2xl">
              {propertyLabel}
              {drill.countryName ? ` · ${drill.countryName}` : ""}
              {drill.city ? ` · ${drill.city}` : ""}
            </h3>
            <p className="mt-1 text-xs text-[var(--eos-muted)]">
              Tylko aktywne oferty sprzedaży · mediana PLN/m² (odrzuca błędne metraże)
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Mediana ceny</p>
            <p className="text-2xl font-black tabular-nums text-[var(--eos-text)] sm:text-3xl">
              {headlinePrice > 0 ? headlinePrice.toLocaleString("pl-PL") : "—"}
              <span className="ml-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">PLN/m²</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--eos-muted)]">
              {view.summary.count} ofert
              {view.summary.excludedOutliers > 0
                ? ` · pominięto ${view.summary.excludedOutliers} outlierów`
                : ""}
            </p>
          </div>
        </div>

        {(drill.countryCode || drill.city) && (
          <button
            type="button"
            onClick={drillBack}
            className="mt-3 inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:text-emerald-300"
          >
            <ChevronLeft size={14} /> Wróć poziom wyżej
          </button>
        )}
      </div>

      <div className="grid gap-0 lg:grid-cols-[200px_1fr]">
        <aside className="border-b border-[var(--eos-border)] p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            Typ nieruchomości
          </p>
          <div className="flex flex-col gap-1">
            {MARKET_PROPERTY_TYPES.map((type) => {
              const active = propertyFilter === type.id;
              const count = typeCounts[type.id];
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setPropertyFilter(type.id);
                    setDrill({});
                  }}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    active
                      ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300"
                      : "text-[var(--eos-muted)] hover:bg-[var(--eos-bg)] hover:text-[var(--eos-text)]"
                  }`}
                >
                  <span>{type.label}</span>
                  <span className="font-mono text-[10px] tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="p-4 sm:p-6">
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                <PieChartIcon size={12} /> Udział ofert (top 8)
              </p>
              <DonutChart
                data={shareChartData}
                centerLabel="Ofert"
                centerValue={String(view.summary.count)}
              />
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                <BarChart3 size={12} /> Mediana PLN/m² (top 6)
              </p>
              <PriceBars data={priceChartData} maxValue={Math.max(...priceChartData.map((d) => d.value), 1)} />
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
              <MapPin size={12} className="text-emerald-500" />
              {levelTitle}
            </p>
            <p className="text-[10px] text-[var(--eos-muted)]">
              {view.level !== "district" ? "Kliknij wiersz, aby zejść niżej" : "Poziom dzielnic"}
            </p>
          </div>

          {view.buckets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--eos-border)] py-10 text-center text-sm text-[var(--eos-muted)]">
              Brak wiarygodnych danych dla wybranego filtru.
            </p>
          ) : (
            <ul className="custom-scrollbar max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {view.buckets.map((bucket, index) => {
                const price = displayPrice(bucket);
                const pct = Math.max((price / maxPrice) * 100, 4);
                const canDrill = view.level !== "district";
                return (
                  <li key={bucket.key}>
                    <button
                      type="button"
                      disabled={!canDrill}
                      onClick={() => canDrill && drillInto(bucket)}
                      className={`w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3.5 py-3 text-left transition ${
                        canDrill
                          ? "hover:border-emerald-500/40 hover:bg-emerald-500/[0.04]"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-bold text-[var(--eos-text)]">
                            <span className="w-5 text-[10px] font-mono text-[var(--eos-subtle)]">{index + 1}.</span>
                            <span className="truncate">{bucket.label}</span>
                            {canDrill ? (
                              <ChevronRight size={14} className="shrink-0 text-[var(--eos-subtle)]" />
                            ) : null}
                          </p>
                          <p className="mt-0.5 pl-7 text-[11px] text-[var(--eos-muted)]">
                            {bucket.count} ofert · udział {bucket.sharePct}%
                            {bucket.excludedOutliers > 0 ? ` · −${bucket.excludedOutliers} błędnych` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="text-base font-black tabular-nums text-[var(--eos-text)]">
                            {price.toLocaleString("pl-PL")}
                          </span>
                          <span className="ml-1 text-[10px] text-[var(--eos-subtle)]">PLN/m²</span>
                        </p>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--eos-border)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.45, ease: "easeOut", delay: Math.min(index, 12) * 0.02 }}
                          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
