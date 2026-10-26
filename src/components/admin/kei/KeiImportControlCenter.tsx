"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Loader2, Play, RefreshCw, Sparkles, Table2 } from "lucide-react";
import type { KeiImportAnalytics } from "@/lib/keiImportAnalytics";
import { formatKeiWhen } from "@/lib/keiAutoImportShared";
import { useKeiAmerExportStore } from "@/store/useKeiAmerExportStore";
import KeiAutoImportPanel from "@/components/admin/kei/KeiAutoImportPanel";

type Range = "7" | "30" | "90" | "all";
const RANGES: Array<{ id: Range; label: string }> = [
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "90 dni" },
  { id: "all", label: "Od początku" },
];

const EASE = [0.22, 1, 0.36, 1] as const;
/** Kolory sprawdzone walidatorem (jasny/ciemny): zieleń = opublikowane, bursztyn = szkice, neutralny = już w bazie. */
const SERIES = {
  published: "var(--k-series-published)",
  review: "var(--k-series-review)",
  duplicates: "var(--k-series-neutral)",
  errors: "var(--k-series-error)",
  single: "var(--k-series-single)",
};

const nf = new Intl.NumberFormat("pl-PL");
/** Polska odmiana: 1 szkic, 2 szkice, 5 szkiców. */
function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = n === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${nf.format(n)} ${word}`;
}

const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${m}`;
};

function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fmt = (v: number) =>
      `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)}${suffix}`;
    if (reduce || !inView) {
      node.textContent = fmt(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.1, ease: EASE, onUpdate: (v) => (node.textContent = fmt(v)) });
    return () => controls.stop();
  }, [value, suffix, decimals, reduce, inView]);
  return (
    <span ref={ref} className="tabular-nums" suppressHydrationWarning>
      {new Intl.NumberFormat("pl-PL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}
      {suffix}
    </span>
  );
}

function Section(props: { kicker?: string; title: string; hint?: string; children: React.ReactNode; className?: string; delay?: number; action?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, ease: EASE, delay: props.delay ?? 0 }}
      className={`k-card p-6 ${props.className ?? ""}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {props.kicker ? <p className="k-kicker">{props.kicker}</p> : null}
          <h3 className="k-serif mt-1 text-[20px] leading-tight text-[color:var(--k-ink)]">{props.title}</h3>
          {props.hint ? <p className="k-hint mt-1">{props.hint}</p> : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </motion.section>
  );
}

function ChartTooltip({ active, payload, label, labels }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string; labels: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="kei-lux rounded-[12px] border border-[color:var(--k-line)] bg-[color:var(--k-card)] px-3.5 py-2.5 text-[12.5px] shadow-[var(--k-shadow-soft)]">
      <p className="mb-1.5 font-semibold text-[color:var(--k-ink)]">{label && /^\d{4}-/.test(label) ? shortDay(label) : label}</p>
      {payload.map((row) => (
        <p key={row.dataKey} className="flex items-center gap-2 text-[color:var(--k-ink-2)]">
          <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
          {labels[row.dataKey] || row.dataKey}
          <span className="ml-auto pl-4 font-semibold tabular-nums text-[color:var(--k-ink)]">{nf.format(row.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[color:var(--k-ink-2)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function BarList({ rows, total, emptyText }: { rows: Array<{ label: string; value: number }>; total?: number; emptyText: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="k-hint">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row, idx) => (
        <li key={row.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-[color:var(--k-ink)]">{row.label}</span>
            <span className="tabular-nums text-[color:var(--k-ink-2)]">
              {nf.format(row.value)}
              {total ? <span className="text-[color:var(--k-ink-3)]"> · {Math.round((row.value / Math.max(1, total)) * 100)}%</span> : null}
            </span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-[color:var(--k-well)]">
            <div
              className="k-bar-grow h-full rounded-full"
              style={{ background: SERIES.single, width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%`, animationDelay: `${idx * 50}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const STATUS_PL: Record<string, string> = {
  ACTIVE: "Na rynku",
  PENDING: "Szkic / weryfikacja",
  ARCHIVED: "Archiwum",
  SOLD: "Sprzedane",
  IN_DEAL: "W transakcji",
  REJECTED: "Odrzucone",
};

export default function KeiImportControlCenter({ initialData = null }: { initialData?: KeiImportAnalytics | null }) {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<KeiImportAnalytics | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const skipFirstLoad = useRef(Boolean(initialData));
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [showTable, setShowTable] = useState(false);
  const openJob = useKeiAmerExportStore((s) => s.openJob);
  const jobRunning = useKeiAmerExportStore((s) => s.running);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/kei-amer/analytics?range=${r}`, { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.analytics) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json.analytics as KeiImportAnalytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wczytać statystyk.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false;
      return;
    }
    const t = window.setTimeout(() => void load(range), 0);
    return () => window.clearTimeout(t);
  }, [range, load]);

  // Po zakończeniu importu odśwież wykresy.
  const wasRunning = useRef(jobRunning);
  useEffect(() => {
    if (wasRunning.current && !jobRunning) void load(range);
    wasRunning.current = jobRunning;
  }, [jobRunning, load, range]);

  const runNow = async () => {
    setRunning(true);
    setRunMessage("");
    try {
      const res = await fetch("/api/admin/kei-amer/auto-import/run", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setRunMessage(String(json?.message || (res.ok ? "Cykl uruchomiony." : "Nie udało się uruchomić cyklu.")));
      if (json?.tick?.jobId) openJob(String(json.tick.jobId));
    } catch {
      setRunMessage("Brak połączenia z serwerem.");
    } finally {
      setRunning(false);
    }
  };

  const t = data?.totals;
  const daily = data?.daily ?? [];
  const funnel = useMemo(() => {
    if (!t) return [];
    const checked = t.processed;
    const fresh = checked - t.duplicates;
    const attempted = fresh - t.inactive;
    const ready = t.published + t.review;
    return [
      { label: "Sprawdzone ogłoszenia", value: checked },
      { label: "Nowe (bez duplikatów)", value: Math.max(0, fresh) },
      { label: "Aktualne na portalu", value: Math.max(0, attempted) },
      { label: "Gotowe oferty", value: ready },
    ];
  }, [t]);

  return (
    <div className="kei-lux min-h-screen bg-[color:var(--k-bg)] px-4 pb-24 pt-28 sm:px-8 md:pt-36">
      <div className="mx-auto max-w-[1240px] space-y-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <Link href="/centrala" className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--k-ink-3)] hover:text-[color:var(--k-ink)]">
              <ArrowLeft size={14} /> Centrala
            </Link>
            <p className="k-kicker mt-4">Import KEI · centrum sterowania</p>
            <h1 className="k-serif mt-2 text-[40px] leading-[1.05] text-[color:var(--k-ink)] sm:text-[52px]">Maszyna importu</h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[color:var(--k-ink-2)]">
              Co automat pobrał z KEI, co z tego zostało ofertą, gdzie traci czas i ile kosztuje AI
              {data?.firstJobAt ? ` — dane od ${formatKeiWhen(data.firstJobAt)}` : ""}.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="k-seg" role="group" aria-label="Zakres statystyk">
              {RANGES.map((r) => (
                <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <a href="#sterowanie" className="k-btn k-btn--ghost">Parametry</a>
              <button type="button" className="k-btn" onClick={() => void load(range)} disabled={loading}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Odśwież
              </button>
              <button type="button" className="k-btn k-btn--solid" onClick={() => void runNow()} disabled={running || jobRunning}>
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Uruchom cykl teraz
              </button>
            </div>
            {runMessage ? <p className="text-[12.5px] text-[color:var(--k-ink-2)]" aria-live="polite">{runMessage}</p> : null}
          </div>
        </motion.header>

        {error ? (
          <p className="rounded-[14px] bg-[color:var(--k-danger-soft)] px-4 py-3 text-[13px] text-[color:var(--k-danger)]">{error}</p>
        ) : null}

        {!data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="k-card h-[112px] animate-pulse opacity-60" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-[color:var(--k-line)] bg-[color:var(--k-line)] sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Opublikowane", value: t!.published, hint: `${nf.format(t!.review)} szkiców` },
                { label: "Skuteczność", value: t!.successRate ?? 0, suffix: "%", hint: "nowych → gotowe oferty", empty: t!.successRate == null },
                { label: "Czas na ofertę", value: t!.avgItemSeconds ?? 0, suffix: " s", hint: "średnio, od portalu do publikacji", empty: t!.avgItemSeconds == null },
                { label: "Opisy AI", value: t!.aiShare ?? 0, suffix: "%", hint: `${nf.format(data.ai.calls)} wywołań`, empty: t!.aiShare == null },
                { label: "Zasięg", value: data.reach.totalVisitors, hint: `unikalnych odsłon ${nf.format(data.reach.offers)} ofert` },
                { label: "Koszt AI", value: data.ai.costUsd, suffix: " $", decimals: 2, hint: "szacunek z tokenów" },
              ].map((kpi, idx) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.05 * idx }}
                  className="bg-[color:var(--k-card)] px-5 py-5"
                >
                  <p className="text-[11.5px] font-medium text-[color:var(--k-ink-3)]">{kpi.label}</p>
                  <p className="k-serif mt-2 text-[30px] leading-none text-[color:var(--k-ink)]">
                    {kpi.empty ? "—" : <CountUp value={kpi.value} suffix={kpi.suffix} decimals={kpi.decimals} />}
                  </p>
                  <p className="mt-2 text-[11.5px] leading-snug text-[color:var(--k-ink-3)]">{kpi.hint}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Section
                kicker="Każdy dzień"
                title="Co wychodzi z importu"
                hint="Opublikowane oferty, szkice do przejrzenia i ogłoszenia, które już mieliśmy."
                action={
                  <button type="button" className="k-btn k-btn--ghost h-8 px-2.5 text-[12px]" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
                    <Table2 size={14} /> {showTable ? "Wykres" : "Tabela"}
                  </button>
                }
              >
                {showTable ? (
                  <div className="k-scroll max-h-[300px] overflow-auto">
                    <table className="w-full text-[12.5px]">
                      <thead className="text-left text-[color:var(--k-ink-3)]">
                        <tr>
                          <th className="py-2 font-medium">Dzień</th>
                          <th className="py-2 text-right font-medium">Opublikowane</th>
                          <th className="py-2 text-right font-medium">Szkice</th>
                          <th className="py-2 text-right font-medium">Już w bazie</th>
                          <th className="py-2 text-right font-medium">Błędy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--k-line)] text-[color:var(--k-ink)]">
                        {[...daily].reverse().map((row) => (
                          <tr key={row.day}>
                            <td className="py-2">{row.day}</td>
                            <td className="py-2 text-right tabular-nums">{row.published}</td>
                            <td className="py-2 text-right tabular-nums">{row.review}</td>
                            <td className="py-2 text-right tabular-nums">{row.duplicates}</td>
                            <td className="py-2 text-right tabular-nums">{row.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    <Legend
                      items={[
                        { color: SERIES.published, label: "Opublikowane" },
                        { color: SERIES.review, label: "Szkice" },
                        { color: SERIES.duplicates, label: "Już w bazie" },
                      ]}
                    />
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
                        <BarChart data={daily} margin={{ top: 4, right: 14, left: -18, bottom: 0 }} barCategoryGap="28%">
                          <CartesianGrid vertical={false} stroke="var(--k-line)" />
                          <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} minTickGap={18} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} width={44} />
                          <Tooltip cursor={{ fill: "var(--k-neutral-soft)" }} content={<ChartTooltip labels={{ published: "Opublikowane", review: "Szkice", duplicates: "Już w bazie" }} />} />
                          <Bar dataKey="published" stackId="a" fill={SERIES.published} maxBarSize={24} stroke="var(--k-card)" strokeWidth={2} animationDuration={900} />
                          <Bar dataKey="review" stackId="a" fill={SERIES.review} maxBarSize={24} stroke="var(--k-card)" strokeWidth={2} animationDuration={900} />
                          <Bar dataKey="duplicates" stackId="a" fill={SERIES.duplicates} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--k-card)" strokeWidth={2} animationDuration={900} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </Section>

              <Section kicker="Lejek" title="Od ogłoszenia do oferty" hint="Ile ogłoszeń odpada na każdym etapie." delay={0.05}>
                <BarList rows={funnel} emptyText="Brak danych w tym okresie." />
                <div className="mt-6 grid grid-cols-2 gap-3 text-[12.5px]">
                  {[
                    { label: "W bazie (z KEI)", value: data.pipeline.imported },
                    { label: "Wysłane zaproszenia", value: data.pipeline.outreach },
                    { label: "W przerwie po błędzie", value: data.pipeline.failing },
                    { label: "Pomijane ręcznie", value: data.pipeline.ignored },
                  ].map((row) => (
                    <div key={row.label} className="k-well px-3.5 py-3">
                      <p className="text-[color:var(--k-ink-3)]">{row.label}</p>
                      <p className="mt-1 text-[17px] font-semibold tabular-nums text-[color:var(--k-ink)]">{nf.format(row.value)}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Section kicker="Jakość" title="Wyniki przetwarzania" hint="Wszystkie sprawdzone pozycje w okresie.">
                <BarList
                  rows={data.outcomes.map((o) => ({ label: o.label, value: o.value }))}
                  total={data.outcomes.reduce((a, o) => a + o.value, 0)}
                  emptyText="Brak danych w tym okresie."
                />
              </Section>
              <Section kicker="Lokalizacja" title="Dzielnice nowych ofert" delay={0.05}>
                <BarList rows={data.districts.map((d) => ({ label: d.district, value: d.count }))} emptyText="Jeszcze brak opublikowanych ofert." />
              </Section>
              <Section kicker="Ceny" title="Przedziały cenowe" delay={0.1}>
                <BarList rows={data.prices.map((p) => ({ label: p.label, value: p.count }))} emptyText="Jeszcze brak opublikowanych ofert." />
              </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section kicker="Błędy" title="Nieudane próby dziennie" hint="Każdy błąd wraca do kolejki po przerwie (6 h → 24 h → 72 h).">
                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
                    <BarChart data={daily} margin={{ top: 4, right: 14, left: -18, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid vertical={false} stroke="var(--k-line)" />
                      <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} minTickGap={18} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} width={44} />
                      <Tooltip cursor={{ fill: "var(--k-neutral-soft)" }} content={<ChartTooltip labels={{ errors: "Błędy" }} />} />
                      <Bar dataKey="errors" fill={SERIES.errors} maxBarSize={18} radius={[4, 4, 0, 0]} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5">
                  <p className="mb-3 text-[12.5px] font-semibold text-[color:var(--k-ink)]">Najczęstsze przyczyny</p>
                  {data.topErrors.length ? (
                    <ul className="space-y-2">
                      {data.topErrors.map((e) => (
                        <li key={e.reason} className="flex items-start justify-between gap-4 text-[12.5px]">
                          <span className="text-[color:var(--k-ink-2)]">{e.reason}</span>
                          <span className="shrink-0 tabular-nums text-[color:var(--k-ink)]">{e.count}×</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="k-hint">Bez błędów w tym okresie.</p>
                  )}
                </div>
              </Section>

              <Section kicker="Rytm" title="Kiedy powstają oferty" hint="Godzina zakończenia (czas warszawski)." delay={0.05}>
                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
                    <BarChart data={data.hours} margin={{ top: 4, right: 14, left: -18, bottom: 0 }} barCategoryGap="18%">
                      <CartesianGrid vertical={false} stroke="var(--k-line)" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}`} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} interval={2} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} width={44} />
                      <Tooltip cursor={{ fill: "var(--k-neutral-soft)" }} content={<ChartTooltip labels={{ published: "Opublikowane" }} />} labelFormatter={(h) => `${h}:00`} />
                      <Bar dataKey="published" fill={SERIES.single} maxBarSize={14} radius={[4, 4, 0, 0]} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-[12.5px] font-semibold text-[color:var(--k-ink)]">Oferty z KEI dziś</p>
                  <div className="flex flex-wrap gap-2">
                    {data.offerStatus.length ? (
                      data.offerStatus.map((s) => (
                        <span key={s.status} className={`k-chip ${s.status === "ACTIVE" ? "k-chip--good" : s.status === "PENDING" ? "k-chip--gold" : "k-chip--neutral"}`}>
                          {STATUS_PL[s.status] || s.status} · {nf.format(s.count)}
                        </span>
                      ))
                    ) : (
                      <span className="k-hint">Brak ofert z KEI.</span>
                    )}
                  </div>
                </div>
              </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Section kicker="AI" title="Opisy pisane przez AI" hint={`Wywołania dziennie · łącznie ${nf.format(data.ai.calls)}, błędów ${nf.format(data.ai.failures)}.`}>
                {data.ai.daily.length ? (
                  <div className="h-[190px]">
                    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
                      <LineChart data={data.ai.daily} margin={{ top: 6, right: 26, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--k-line)" />
                        <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} minTickGap={18} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--k-ink-3)", fontSize: 11 }} width={44} />
                        <Tooltip cursor={{ stroke: "var(--k-line-strong)" }} content={<ChartTooltip labels={{ calls: "Wywołania" }} />} />
                        <Line type="monotone" dataKey="calls" stroke={SERIES.single} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--k-card)" }} animationDuration={1000} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="k-hint">Zużycie AI pojawi się po pierwszych importach z nowym licznikiem.</p>
                )}
              </Section>

              <Section kicker="Zasięg" title="Najczęściej oglądane oferty z KEI" hint="Unikalni odwiedzający na EstateOS." delay={0.05}>
                {data.reach.top.length ? (
                  <ul className="divide-y divide-[color:var(--k-line)]">
                    {data.reach.top.map((o, idx) => (
                      <li key={o.id} className="flex items-center gap-4 py-3">
                        <span className="k-serif w-6 text-[18px] text-[color:var(--k-ink-3)]">{idx + 1}</span>
                        <a href={`/oferta/${o.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[color:var(--k-ink)] hover:underline">
                          {o.title}
                        </a>
                        <span className="text-[12px] text-[color:var(--k-ink-3)]">{o.district}</span>
                        <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-[color:var(--k-ink)]">{nf.format(o.visitors)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="k-hint">Jeszcze brak odsłon.</p>
                )}
              </Section>
            </div>

            <motion.div
              id="sterowanie"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, ease: EASE }}
              className="scroll-mt-28"
            >
              <KeiAutoImportPanel hideHistory />
            </motion.div>

            <Section kicker="Historia" title="Ostatnie cykle" hint="Kliknij cykl, żeby zobaczyć każdą ofertę z osobna.">
              {data.recent.length ? (
                <ul className="divide-y divide-[color:var(--k-line)]">
                  {data.recent.map((job) => (
                    <li key={job.id}>
                      <button type="button" onClick={() => openJob(job.id)} className="flex w-full items-center gap-4 py-3 text-left transition-opacity hover:opacity-80">
                        <span className="w-[120px] shrink-0 text-[12.5px] tabular-nums text-[color:var(--k-ink-2)]">{formatKeiWhen(job.createdAt)}</span>
                        <span className="w-[112px] shrink-0">
                        <span className={`k-chip ${job.status === "error" ? "k-chip--danger" : job.status === "running" || job.status === "queued" ? "k-chip--gold" : job.published ? "k-chip--good" : "k-chip--neutral"}`}>
                          {job.status === "error" ? "Błąd" : job.status === "running" || job.status === "queued" ? "W toku" : job.status === "cancelled" ? "Zatrzymany" : job.published ? plural(job.published, "nowa", "nowe", "nowych") : "Brak nowych"}
                        </span>
                        </span>
                        <span className="hidden w-[64px] shrink-0 text-[12px] text-[color:var(--k-ink-3)] sm:inline">{job.source === "auto" ? "automat" : "ręcznie"}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[color:var(--k-ink-3)]">
                          {[job.review ? plural(job.review, "szkic", "szkice", "szkiców") : null, job.skipped ? plural(job.skipped, "pominięte", "pominięte", "pominiętych") : null, job.errors ? plural(job.errors, "błąd", "błędy", "błędów") : null, job.durationSeconds != null ? `${Math.max(1, Math.round(job.durationSeconds / 60))} min` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="hidden -space-x-2 sm:flex">
                          {job.thumbs.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element -- miniatury ofert z cyklu
                            <img key={src + i} src={src} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border-2 border-[color:var(--k-card)] object-cover" />
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-hint">Jeszcze nie było żadnego cyklu.</p>
              )}
            </Section>

            <p className="flex items-center justify-center gap-2 pt-2 text-[12px] text-[color:var(--k-ink-3)]">
              <Sparkles size={13} /> Dane z {formatKeiWhen(data.generatedAt)} · automatyczne odświeżenie po każdym imporcie
            </p>
          </>
        )}
      </div>
    </div>
  );
}
