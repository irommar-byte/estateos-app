"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, X } from "lucide-react";
import { formatPpsm, formatSignedPct } from "@/lib/market/format";
import type {
  PricePulsePayload,
  PricePulseTone,
  PricePulseTrendKey,
  PricePulseWindow,
} from "@/lib/market/types";

type Locale = string;
type WindowKey = "d7" | "d30" | "d90";
type TrendKey = PricePulseTrendKey;

const COPY = {
  pl: {
    title: "Puls cenowy",
    hint: "Ceny z aktów notarialnych",
    live: "Live",
    empty: "Za mało transakcji, żeby narysować puls.",
    days7: "7 dni",
    days30: "1 miesiąc",
    days90: "3 miesiące",
    day: "Dzień",
    week: "Tydzień",
    month: "Miesiąc",
    year: "Rok",
    vsDeeds: "Oferty vs akty",
    listings: "Ceny ofertowe",
    deeds: "Ceny z aktów",
    listingChange: "Zmiana ofert",
    deedChange: "Zmiana aktów",
    districts: "Dzielnice — ile oferty odbiegają od aktów",
    close: "Zamknij",
    city: "Warszawa · mieszkania na sprzedaż",
    tap: "Dotknij, aby zobaczyć szczegóły",
    heroListing: "Zmiana ofert · 30 dni",
    heroVsDeeds: "Oferty vs akty",
    heroDeed: "Zmiana cen transakcyjnych",
    boughtUp: "Nieruchomości kupowane drożej",
    boughtDown: "Nieruchomości kupowane taniej",
    boughtFlat: "Ceny transakcyjne stabilne",
  },
  en: {
    title: "Price pulse",
    hint: "Notarized deed prices",
    live: "Live",
    empty: "Not enough deals to draw the pulse yet.",
    days7: "7 days",
    days30: "1 month",
    days90: "3 months",
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year",
    vsDeeds: "Listings vs deeds",
    listings: "Asking prices",
    deeds: "Deed prices",
    listingChange: "Listing change",
    deedChange: "Deed change",
    districts: "Districts — listings vs deeds",
    close: "Close",
    city: "Warsaw · flats for sale",
    tap: "Tap for details",
    heroListing: "Listing change · 30 days",
    heroVsDeeds: "Listings vs deeds",
    heroDeed: "Transaction price change",
    boughtUp: "Homes are selling for more",
    boughtDown: "Homes are selling for less",
    boughtFlat: "Transaction prices are stable",
  },
  uk: {
    title: "Пульс цін",
    hint: "Ціни з актів",
    live: "Live",
    empty: "Замало угод, щоб намалювати пульс.",
    days7: "7 днів",
    days30: "1 місяць",
    days90: "3 місяці",
    day: "День",
    week: "Тиждень",
    month: "Місяць",
    year: "Рік",
    vsDeeds: "Оголошення vs акти",
    listings: "Ціни оголошень",
    deeds: "Ціни з актів",
    listingChange: "Зміна оголошень",
    deedChange: "Зміна актів",
    districts: "Райони — наскільки оголошення відхиляють від актів",
    close: "Закрити",
    city: "Варшава · квартири на продаж",
    tap: "Натисніть, щоб побачити деталі",
    heroListing: "Зміна оголошень · 30 днів",
    heroVsDeeds: "Оголошення vs акти",
    heroDeed: "Зміна цін угод",
    boughtUp: "Нерухомість купують дорожче",
    boughtDown: "Нерухомість купують дешевше",
    boughtFlat: "Ціни угод стабільні",
  },
} as const;

function dictFor(locale: Locale) {
  if (locale === "en") return COPY.en;
  if (locale === "uk" || locale === "ru") return COPY.uk;
  return COPY.pl;
}

function RollingPct({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`eos-price-pulse-num inline-flex items-end ${className || ""}`}>
      {value.split("").map((char, index) => {
        if (!/[0-9]/.test(char)) {
          return (
            <span key={`${index}-${char}`} className="inline-block">
              {char}
            </span>
          );
        }
        const digit = Number(char);
        return (
          <span key={`d-${index}`} className="eos-price-pulse-digit">
            <motion.span
              className="eos-price-pulse-digit__stack"
              initial={false}
              animate={{ y: `${-digit}em` }}
              transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

function toneClass(tone: PricePulseTone) {
  if (tone === "up") return "text-rose-400";
  if (tone === "down") return "text-emerald-400";
  return "text-[var(--eos-text)]";
}

function narrative(locale: Locale, data: PricePulsePayload, win: PricePulseWindow) {
  const gap = formatSignedPct(win.vsDeedsPct ?? data.vsDeedsPct);
  const listingMove = formatSignedPct(win.listingChangePct);
  const dir = win.listingChangePct ?? (data.direction === "falling" ? -2 : data.direction === "rising" ? 2 : 0);
  if (locale === "en") {
    const trend =
      dir <= -1 ? "Asking prices are cooling." : dir >= 1 ? "Asking prices are climbing." : "Asking prices are stable.";
    return `New Warsaw listings sit ${gap} versus notarized deed prices. ${trend} Change in this window: ${listingMove}.`;
  }
  if (locale === "uk" || locale === "ru") {
    const trend =
      dir <= -1 ? "Ціни оголошень знижуються." : dir >= 1 ? "Ціни оголошень зростають." : "Ціни оголошень стабільні.";
    return `Нові оголошення у Варшаві ${gap} щодо цін з актів. ${trend} Зміна за вікно: ${listingMove}.`;
  }
  const trend =
    dir <= -1
      ? "Ceny ofertowe schodzą."
      : dir >= 1
        ? "Ceny ofertowe idą w górę."
        : "Ceny ofertowe stoją w miejscu.";
  return `Oferty mieszkań, które wchodzą na rynek w Warszawie, są ${gap} względem cen z aktów notarialnych. ${trend} Zmiana w tym oknie: ${listingMove}.`;
}

function trendPath(values: Array<number | null>, width: number, height: number, pad = 6) {
  const pts = values
    .map((value, index) => ({ index, value }))
    .filter((row): row is { index: number; value: number } => row.value != null && Number.isFinite(row.value));
  if (pts.length < 2) return { line: "", area: "", last: null as { x: number; y: number } | null };
  const ys = pts.map((p) => p.value);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const n = Math.max(values.length - 1, 1);
  const xy = values.map((value, index) => {
    const x = pad + (index / n) * (width - pad * 2);
    if (value == null || !Number.isFinite(value)) return null;
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const drawn = xy.filter(Boolean) as Array<{ x: number; y: number }>;
  const line = drawn.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${drawn[drawn.length - 1].x.toFixed(1)},${height - pad} L${drawn[0].x.toFixed(1)},${height - pad} Z`;
  return { line, area, last: drawn[drawn.length - 1] };
}

function dualPaths(a: Array<number | null>, b: Array<number | null>, width: number, height: number, pad = 8) {
  const nums = [...a, ...b].filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return { a: "", b: "" };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const n = Math.max(Math.max(a.length, b.length) - 1, 1);
  const pathOf = (values: Array<number | null>) => {
    const drawn: Array<{ x: number; y: number }> = [];
    values.forEach((value, index) => {
      if (value == null || !Number.isFinite(value)) return;
      drawn.push({
        x: pad + (index / n) * (width - pad * 2),
        y: pad + (1 - (value - min) / span) * (height - pad * 2),
      });
    });
    if (drawn.length < 2) return "";
    return drawn.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  };
  return { a: pathOf(a), b: pathOf(b) };
}

function WindowChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
        active
          ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
          : "border border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
      }`}
    >
      {label}
    </button>
  );
}

export default function PricePulseWidget({ locale = "pl" }: { locale?: Locale }) {
  const copy = dictFor(locale);
  const [data, setData] = useState<PricePulsePayload | null>(null);
  const [open, setOpen] = useState(false);
  const [windowKey, setWindowKey] = useState<WindowKey>("d30");
  const [trendKey, setTrendKey] = useState<TrendKey>("month");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market/price-pulse", { cache: "no-store", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (json?.ok) setData(json as PricePulsePayload);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const win = data?.windows[windowKey] ?? null;
  const trend = data?.trends?.[trendKey] ?? null;
  const chart = useMemo(
    () => trendPath((trend?.points || []).map((p) => p.ppsm), 320, 78),
    [trend],
  );
  const dual = useMemo(() => {
    const series = data?.series || [];
    const take = windowKey === "d7" ? 14 : windowKey === "d30" ? 30 : 90;
    const slice = series.slice(-take);
    return dualPaths(
      slice.map((p) => p.listingPpsm),
      slice.map((p) => p.deedPpsm),
      640,
      160,
    );
  }, [data, windowKey]);

  const heroPct = trend?.changePct ?? data?.windows.d30.deedChangePct ?? data?.vsDeedsPct ?? 0;
  const pct = formatSignedPct(heroPct);
  const trendTone = toneOfChange(trend?.changePct ?? null);
  const waveColor = trendTone === "up" ? "#fb7185" : trendTone === "down" ? "#34d399" : "#94a3b8";
  const boughtLabel =
    trendTone === "up" ? copy.boughtUp : trendTone === "down" ? copy.boughtDown : copy.boughtFlat;
  const periodCaption =
    trendKey === "day" ? copy.day : trendKey === "week" ? copy.week : trendKey === "year" ? copy.year : copy.month;

  return (
    <>
      <div className="eos-pro-panel eos-pro-panel-inset eos-price-pulse-well group relative w-full overflow-hidden rounded-3xl p-4 text-left">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <button type="button" onClick={() => setOpen(true)} className="relative z-10 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Activity size={15} className="eos-ecg-icon shrink-0" strokeWidth={2.2} />
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--eos-muted)]">
                  {copy.title}
                </p>
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5">
                  <span className="eos-ecg-icon h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[7px] font-black uppercase tracking-widest text-emerald-500">{copy.live}</span>
                </span>
              </div>
              <p className="truncate text-[10px] font-semibold text-[var(--eos-subtle)]">
                {copy.heroDeed} · {periodCaption}
              </p>
            </div>
            <RollingPct className={`text-2xl font-black tracking-tight md:text-3xl ${toneClass(trendTone)}`} value={data ? pct : "0,0%"} />
          </div>

          <div className="relative mt-2 h-[78px]">
            {chart.area ? (
              <svg viewBox="0 0 320 78" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="eos-deed-trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={waveColor} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={waveColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={chart.area} fill="url(#eos-deed-trend-fill)" />
                <path d={chart.line} fill="none" stroke={waveColor} strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
                {chart.last ? (
                  <circle cx={chart.last.x} cy={chart.last.y} r="3.2" fill={waveColor} />
                ) : null}
              </svg>
            ) : (
              <p className="flex h-full items-center text-[11px] font-semibold text-[var(--eos-muted)]">{copy.empty}</p>
            )}
          </div>
        </button>

        <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
          {(["day", "week", "month", "year"] as TrendKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTrendKey(key)}
              className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] transition ${
                trendKey === key
                  ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              {copy[key]}
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-2 flex items-center justify-between gap-2">
          <p className={`text-[10px] font-bold ${toneClass(trendTone)}`}>
            {data ? boughtLabel : copy.tap}
          </p>
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--eos-subtle)]">
            {trend?.currentPpsm ? formatPpsm(trend.currentPpsm) : copy.tap}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eos-modal-backdrop fixed inset-0 eos-z-modal flex items-start justify-center overflow-y-auto p-4 pt-10 pb-10 sm:pt-16"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 18 }}
              onClick={(event) => event.stopPropagation()}
              className="eos-modal-surface eos-modal-shell eos-themed-modal my-auto w-full max-w-xl rounded-[2rem] border p-5 md:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{copy.title}</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-[var(--eos-text)]">{copy.city}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] p-2 text-[var(--eos-muted)]"
                  aria-label={copy.close}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="eos-price-pulse-well rounded-[1.6rem] border border-[var(--eos-border)] bg-[var(--eos-input)] p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                      {copy.heroDeed} · {periodCaption}
                    </p>
                    <RollingPct className={`mt-1 text-4xl font-black ${toneClass(trendTone)}`} value={pct} />
                  </div>
                  <p className="max-w-[58%] text-right text-[11px] font-semibold leading-snug text-[var(--eos-muted)]">
                    {data && win ? narrative(locale, data, win) : copy.empty}
                  </p>
                </div>
                <svg viewBox="0 0 640 160" className="mt-4 h-36 w-full">
                  <path d={dual.b} fill="none" stroke="rgba(212,175,106,0.9)" strokeWidth="2.2" />
                  <path d={dual.a} fill="none" stroke={waveColor} strokeWidth="2.4" />
                </svg>
                <div className="mt-2 flex gap-4 text-[10px] font-bold text-[var(--eos-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-4 rounded-full"
                      style={{ background: waveColor }}
                    />
                    {copy.listings}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-[#d4af6a]" />
                    {copy.deeds}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <WindowChip active={windowKey === "d7"} label={copy.days7} onClick={() => setWindowKey("d7")} />
                <WindowChip active={windowKey === "d30"} label={copy.days30} onClick={() => setWindowKey("d30")} />
                <WindowChip active={windowKey === "d90"} label={copy.days90} onClick={() => setWindowKey("d90")} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile label={copy.listings} value={win?.listingPpsm ? formatPpsm(win.listingPpsm) : "—"} hint={formatSignedPct(win?.listingChangePct ?? null)} tone={toneOfChange(win?.listingChangePct ?? null)} />
                <StatTile label={copy.deeds} value={win?.deedPpsm ? formatPpsm(win.deedPpsm) : "—"} hint={formatSignedPct(win?.deedChangePct ?? null)} tone={toneOfChange(win?.deedChangePct ?? null)} />
                <StatTile label={copy.listingChange} value={formatSignedPct(win?.listingChangePct ?? null)} hint={`${win?.listingCount ?? 0} ofert`} tone={toneOfChange(win?.listingChangePct ?? null)} />
                <StatTile label={copy.deedChange} value={formatSignedPct(win?.deedChangePct ?? null)} hint={`${win?.deedCount ?? 0} aktów`} tone={toneOfChange(win?.deedChangePct ?? null)} />
              </div>

              {data?.districts?.length ? (
                <div className="mt-5">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                    {copy.districts}
                  </p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {data.districts.map((row) => (
                      <div key={row.district} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
                        <span className="truncate text-[12px] font-semibold text-[var(--eos-text)]">{row.district}</span>
                        <span className={`text-[12px] font-black tabular-nums ${row.vsDeedsPct > 1.5 ? "text-rose-400" : row.vsDeedsPct < -1.5 ? "text-emerald-400" : "text-[var(--eos-muted)]"}`}>
                          {formatSignedPct(row.vsDeedsPct)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mt-5 text-[10px] leading-relaxed text-[var(--eos-subtle)]">{data?.disclaimer}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function toneOfChange(value: number | null): PricePulseTone {
  if (value == null) return "flat";
  if (value > 1) return "up";
  if (value < -1) return "down";
  return "flat";
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: PricePulseTone;
}) {
  return (
    <div className="eos-pro-panel eos-pro-panel-inset rounded-2xl p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-black tabular-nums ${toneClass(tone)}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-[var(--eos-subtle)]">{hint}</p>
    </div>
  );
}
