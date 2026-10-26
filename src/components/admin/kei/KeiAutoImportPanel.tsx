"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  DEFAULT_KEI_AUTO_SETTINGS,
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  KEI_AUTO_PORTALS,
  describeKeiAutoSettings,
  formatKeiWhen,
  keiAutoIntervalLabel,
  type KeiAutoImportConfig,
  type KeiAutoImportSettings,
  type KeiAutoPortal,
} from "@/lib/keiAutoImportShared";
import { getDistrictsForCity } from "@/lib/location/locationCatalog";
import { useKeiAmerExportStore } from "@/store/useKeiAmerExportStore";
import KeiTargetUserPicker from "@/components/admin/kei/KeiTargetUserPicker";

type Draft = {
  intervalMinutes: number;
  count: number;
  targetUserId: number;
  targetUserLabel: { id: number; name: string | null; email: string; role?: string } | null;
  agentCommissionPercent: number;
  propertyKind: "apartment" | "house";
  transactionKind: "sale" | "rent";
  settings: KeiAutoImportSettings;
};

type HistoryRow = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  finishedAt: string | null;
  exported: number;
  skipped: number;
  review: number;
  aiRewritten: number;
  thumbs: string[];
};

type AiUsage = { today: { calls: number; failures: number; costUsd: number }; defaultModel: string; configured: boolean };

const WARSAW_DISTRICTS = getDistrictsForCity("Warszawa");
const AGE_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: 24, label: "do 24 godzin" },
  { value: 48, label: "do 2 dni" },
  { value: 72, label: "do 3 dni" },
  { value: 168, label: "do tygodnia" },
  { value: 720, label: "do 30 dni" },
  { value: null, label: "bez limitu" },
];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function draftFrom(config: KeiAutoImportConfig): Draft {
  return {
    intervalMinutes: config.intervalMinutes,
    count: config.count,
    targetUserId: config.targetUserId,
    targetUserLabel: config.targetUser,
    agentCommissionPercent: config.agentCommissionPercent,
    propertyKind: config.propertyKind,
    transactionKind: config.transactionKind,
    settings: { ...DEFAULT_KEI_AUTO_SETTINGS, ...config.settings },
  };
}

function sameDraft(a: Draft | null, b: Draft | null) {
  if (!a || !b) return true;
  const strip = (d: Draft) => ({ ...d, targetUserLabel: null });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

function numberOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function Section(props: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--k-line)] pt-5">
      <h4 className="text-[13px] font-semibold text-[color:var(--k-ink)]">{props.title}</h4>
      {props.hint ? <p className="k-hint mt-0.5">{props.hint}</p> : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function Toggle(props: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[13px] font-medium text-[color:var(--k-ink)]">{props.label}</span>
        {props.hint ? <span className="k-hint block">{props.hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
        disabled={props.disabled}
        className="k-toggle mt-0.5"
        onClick={() => props.onChange(!props.checked)}
      />
    </label>
  );
}

function Seg<T extends string>(props: { value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="k-seg" role="group">
      {props.options.map((option) => (
        <button key={option.id} type="button" aria-pressed={props.value === option.id} onClick={() => props.onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RangeInputs(props: {
  label: string;
  unit: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <div>
      <span className="k-label">{props.label}</span>
      <div className="flex items-center gap-2">
        <input
          className="k-field"
          inputMode="decimal"
          placeholder="od"
          value={props.min ?? ""}
          onChange={(event) => props.onChange(numberOrNull(event.target.value), props.max)}
          aria-label={`${props.label} od`}
        />
        <span className="text-[color:var(--k-ink-3)]">–</span>
        <input
          className="k-field"
          inputMode="decimal"
          placeholder="do"
          value={props.max ?? ""}
          onChange={(event) => props.onChange(props.min, numberOrNull(event.target.value))}
          aria-label={`${props.label} do`}
        />
        <span className="w-8 shrink-0 text-[12px] text-[color:var(--k-ink-3)]">{props.unit}</span>
      </div>
    </div>
  );
}

function statusTone(config: KeiAutoImportConfig): { color: string; label: string } {
  if (!config.enabled) return { color: "var(--k-ink-3)", label: "Wyłączony" };
  if (!config.workerAlive) return { color: "var(--k-danger)", label: "Worker nie odpowiada" };
  if (config.consecutiveErrors > 0) return { color: "var(--k-danger)", label: "Przerwa po błędzie" };
  if (config.waitingReason) return { color: "var(--k-warn)", label: "Czeka" };
  return { color: "var(--k-good)", label: "Działa" };
}

export default function KeiAutoImportPanel(props: {
  compact?: boolean;
  initialConfig?: KeiAutoImportConfig | null;
  onSaved?: (config: KeiAutoImportConfig) => void;
}) {
  const [config, setConfig] = useState<KeiAutoImportConfig | null>(props.initialConfig ?? null);
  const [draft, setDraft] = useState<Draft | null>(props.initialConfig ? draftFrom(props.initialConfig) : null);
  const [saved, setSaved] = useState<Draft | null>(props.initialConfig ? draftFrom(props.initialConfig) : null);
  const [expanded, setExpanded] = useState(!props.compact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [ai, setAi] = useState<AiUsage | null>(null);
  const openJob = useKeiAmerExportStore((s) => s.openJob);
  const onSaved = props.onSaved;

  const apply = useCallback(
    (next: KeiAutoImportConfig) => {
      setConfig(next);
      const d = draftFrom(next);
      setDraft(d);
      setSaved(d);
      onSaved?.(next);
    },
    [onSaved],
  );

  const load = useCallback(async () => {
    const [cfgRes, histRes, aiRes] = await Promise.all([
      fetch("/api/admin/kei-amer/auto-import", { credentials: "include", cache: "no-store" }).catch(() => null),
      fetch("/api/admin/kei-amer/export-jobs?source=auto&limit=6", { credentials: "include", cache: "no-store" }).catch(() => null),
      fetch("/api/admin/automation/ai-usage", { credentials: "include", cache: "no-store" }).catch(() => null),
    ]);
    const cfg = await cfgRes?.json().catch(() => null);
    if (cfg?.config) {
      setConfig(cfg.config);
      setSaved(draftFrom(cfg.config));
      setDraft((current) => current ?? draftFrom(cfg.config));
    }
    const hist = await histRes?.json().catch(() => null);
    if (Array.isArray(hist?.jobs)) setHistory(hist.jobs);
    const usage = await aiRes?.json().catch(() => null);
    if (usage?.ok) setAi(usage);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const dirty = !sameDraft(draft, saved);

  const save = async (enabledOverride?: boolean) => {
    if (!draft || !config) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/kei-amer/auto-import", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: enabledOverride ?? config.enabled,
          intervalMinutes: draft.intervalMinutes,
          count: draft.count,
          targetUserId: draft.targetUserId,
          agentCommissionPercent: draft.agentCommissionPercent,
          propertyKind: draft.propertyKind,
          transactionKind: draft.transactionKind,
          settings: draft.settings,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.config) {
        setError(String(data?.error || "Nie udało się zapisać ustawień."));
        return;
      }
      apply(data.config as KeiAutoImportConfig);
      setNotice(
        enabledOverride === true
          ? "Włączony — pierwszy cykl ruszy w ciągu minuty."
          : enabledOverride === false
            ? "Automatyczny import wyłączony."
            : "Ustawienia zapisane.",
      );
    } catch {
      setError("Brak połączenia z serwerem — ustawienia nie zostały zapisane.");
    } finally {
      setSaving(false);
    }
  };

  const setSetting = <K extends keyof KeiAutoImportSettings>(key: K, value: KeiAutoImportSettings[K]) =>
    setDraft((current) => (current ? { ...current, settings: { ...current.settings, [key]: value } } : current));

  const summaryLine = useMemo(() => {
    if (!draft) return "";
    const parts = [
      draft.propertyKind === "house" ? "Domy" : "Mieszkania",
      draft.transactionKind === "rent" ? "najem" : "sprzedaż",
      `co ${keiAutoIntervalLabel(draft.intervalMinutes)}`,
      `${draft.count} na cykl`,
      ...describeKeiAutoSettings(draft.settings),
    ];
    return parts.join(" · ");
  }, [draft]);

  if (!config || !draft) {
    return (
      <div className="kei-lux k-card flex items-center gap-3 p-6 text-[13px] text-[color:var(--k-ink-3)]">
        <Loader2 size={16} className="animate-spin" /> Wczytuję harmonogram importu…
      </div>
    );
  }

  const tone = statusTone(config);
  const nextRun = config.enabled && config.nextRunAt ? formatKeiWhen(config.nextRunAt) : null;
  const statusText = !config.enabled
    ? "Import tylko ręcznie, z listy powyżej."
    : config.waitingReason || (nextRun ? `Następny cykl ${nextRun}` : "Cykl rusza za chwilę.");

  return (
    <div className="kei-lux k-card overflow-hidden">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="k-kicker">Automatyczny import KEI</p>
          <h3 className="k-serif mt-1.5 text-[24px] leading-tight text-[color:var(--k-ink)]">Harmonogram ofert</h3>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[color:var(--k-ink-2)]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.color }} aria-hidden />
            <span>
              <span className="font-semibold" style={{ color: tone.color }}>
                {tone.label}
              </span>{" "}
              · {statusText}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[12.5px] text-[color:var(--k-ink-2)]">{config.enabled ? "Włączony" : "Wyłączony"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="Automatyczny import"
            className="k-toggle"
            disabled={saving}
            onClick={() => void save(!config.enabled)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-[color:var(--k-line)] bg-[color:var(--k-line)] sm:grid-cols-4">
        {[
          {
            label: "Dziś",
            value: `${config.dayImportedCount}${draft.settings.dailyLimit ? ` / ${draft.settings.dailyLimit}` : ""}`,
            hint: "nowych ofert",
          },
          { label: "Od włączenia", value: String(config.sessionImportedCount), hint: `${config.sessionSkippedCount} pominiętych` },
          { label: "Cykle", value: String(config.sessionCycles), hint: config.lastRunAt ? `ostatni ${formatKeiWhen(config.lastRunAt)}` : "jeszcze żaden" },
          {
            label: "AI dziś",
            value: ai ? `${ai.today.calls} opisów` : "—",
            hint: ai ? `${ai.today.costUsd.toFixed(3)} $ · ${ai.defaultModel}` : "",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[color:var(--k-card)] px-5 py-4">
            <p className="text-[11px] font-medium text-[color:var(--k-ink-3)]">{kpi.label}</p>
            <p className="mt-1 text-[19px] font-semibold tabular-nums text-[color:var(--k-ink)]">{kpi.value}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-[color:var(--k-ink-3)]">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {config.lastError ? (
        <div className="mx-6 mt-5 flex gap-3 rounded-[14px] bg-[color:var(--k-danger-soft)] px-4 py-3 text-[12.5px] text-[color:var(--k-danger)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              Ostatni błąd{config.lastErrorAt ? ` · ${formatKeiWhen(config.lastErrorAt)}` : ""}
              {config.consecutiveErrors > 1 ? ` · ${config.consecutiveErrors}× z rzędu` : ""}
            </p>
            <p className="mt-0.5 opacity-90">{config.lastError}</p>
          </div>
        </div>
      ) : null}
      {ai && !ai.configured ? (
        <p className="mx-6 mt-4 rounded-[14px] bg-[color:var(--k-warn-soft)] px-4 py-3 text-[12.5px] text-[color:var(--k-warn)]">
          Brak klucza OpenAI na serwerze — opisy powstaną z szablonu.
        </p>
      ) : null}

      <div className="px-6 py-5">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 text-left"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-[color:var(--k-ink)]">Co i jak importujemy</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-[color:var(--k-ink-3)]">
              {summaryLine}
              {draft.targetUserLabel ? ` → ${draft.targetUserLabel.name || draft.targetUserLabel.email}` : ""}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-[color:var(--k-ink-3)] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-6 pt-6">
                <Section title="Co importować" hint="Puste pola oznaczają brak ograniczenia.">
                  <div className="flex flex-wrap gap-3">
                    <Seg
                      value={draft.propertyKind}
                      onChange={(propertyKind) => setDraft({ ...draft, propertyKind })}
                      options={[
                        { id: "apartment", label: "Mieszkania" },
                        { id: "house", label: "Domy" },
                      ]}
                    />
                    <Seg
                      value={draft.transactionKind}
                      onChange={(transactionKind) => setDraft({ ...draft, transactionKind })}
                      options={[
                        { id: "sale", label: "Sprzedaż" },
                        { id: "rent", label: "Najem" },
                      ]}
                    />
                  </div>
                  <div className="mt-5">
                    <span className="k-label">Dzielnice Warszawy</span>
                    <div className="flex flex-wrap gap-2">
                      {WARSAW_DISTRICTS.map((district) => {
                        const on = draft.settings.districts.includes(district);
                        return (
                          <button
                            key={district}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setSetting(
                                "districts",
                                on
                                  ? draft.settings.districts.filter((d) => d !== district)
                                  : [...draft.settings.districts, district],
                              )
                            }
                            className={`k-chip cursor-pointer transition-colors ${on ? "k-chip--gold" : "k-chip--neutral hover:border-[color:var(--k-line-strong)]"}`}
                          >
                            {district}
                          </button>
                        );
                      })}
                    </div>
                    <p className="k-hint mt-2">
                      {draft.settings.districts.length ? `${draft.settings.districts.length} wybranych` : "Cała Warszawa"}
                    </p>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <RangeInputs
                      label="Cena"
                      unit="zł"
                      min={draft.settings.minPrice}
                      max={draft.settings.maxPrice}
                      onChange={(min, max) => setDraft({ ...draft, settings: { ...draft.settings, minPrice: min, maxPrice: max } })}
                    />
                    <RangeInputs
                      label="Metraż"
                      unit="m²"
                      min={draft.settings.minArea}
                      max={draft.settings.maxArea}
                      onChange={(min, max) => setDraft({ ...draft, settings: { ...draft.settings, minArea: min, maxArea: max } })}
                    />
                    <RangeInputs
                      label="Pokoje"
                      unit="pok."
                      min={draft.settings.minRooms}
                      max={draft.settings.maxRooms}
                      onChange={(min, max) => setDraft({ ...draft, settings: { ...draft.settings, minRooms: min, maxRooms: max } })}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="k-label">Wiek ogłoszenia</span>
                      <select
                        className="k-field"
                        value={draft.settings.maxAgeHours ?? ""}
                        onChange={(event) => setSetting("maxAgeHours", event.target.value ? Number(event.target.value) : null)}
                      >
                        {AGE_OPTIONS.map((option) => (
                          <option key={String(option.value)} value={option.value ?? ""}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="k-label">Portale</span>
                      <div className="flex flex-wrap gap-2">
                        {KEI_AUTO_PORTALS.map((portal) => {
                          const on = draft.settings.portals.includes(portal.id);
                          return (
                            <button
                              key={portal.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                const next: KeiAutoPortal[] = on
                                  ? draft.settings.portals.filter((p) => p !== portal.id)
                                  : [...draft.settings.portals, portal.id];
                                if (next.length) setSetting("portals", next);
                              }}
                              className={`k-chip h-9 cursor-pointer px-3.5 ${on ? "k-chip--gold" : "k-chip--neutral"}`}
                            >
                              {portal.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <Toggle
                      checked={draft.settings.directOwnerOnly}
                      onChange={(value) => setSetting("directOwnerOnly", value)}
                      label="Tylko bez pośredników"
                      hint="Ogłoszenia, które KEI oznacza jako prywatne."
                    />
                    <Toggle
                      checked={draft.settings.requirePhone}
                      onChange={(value) => setSetting("requirePhone", value)}
                      label="Wymagaj telefonu właściciela"
                      hint="Bez telefonu nie da się zadzwonić z ofertą współpracy."
                    />
                  </div>
                </Section>

                <Section title="Rytm" hint="Automat pracuje tylko w wybranych godzinach i nie przekroczy limitu dziennego.">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <label>
                      <span className="k-label">Co ile</span>
                      <select
                        className="k-field"
                        value={draft.intervalMinutes}
                        onChange={(event) => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })}
                      >
                        {KEI_AUTO_INTERVALS_MIN.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {keiAutoIntervalLabel(minutes)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="k-label">Ofert na cykl</span>
                      <input
                        className="k-field"
                        type="number"
                        min={1}
                        max={KEI_AUTO_MAX_COUNT}
                        value={draft.count}
                        onChange={(event) =>
                          setDraft({ ...draft, count: Math.min(KEI_AUTO_MAX_COUNT, Math.max(1, Number(event.target.value) || 1)) })
                        }
                      />
                    </label>
                    <label>
                      <span className="k-label">Godziny pracy</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="k-field px-2"
                          value={draft.settings.activeFromHour}
                          onChange={(event) => setSetting("activeFromHour", Number(event.target.value))}
                          aria-label="Od godziny"
                        >
                          {HOURS.map((h) => (
                            <option key={h} value={h}>{`${h}:00`}</option>
                          ))}
                        </select>
                        <span className="text-[color:var(--k-ink-3)]">–</span>
                        <select
                          className="k-field px-2"
                          value={draft.settings.activeToHour}
                          onChange={(event) => setSetting("activeToHour", Number(event.target.value))}
                          aria-label="Do godziny"
                        >
                          {HOURS.map((h) => (
                            <option key={h} value={h}>{`${h}:00`}</option>
                          ))}
                        </select>
                      </div>
                    </label>
                    <label>
                      <span className="k-label">Limit dzienny</span>
                      <input
                        className="k-field"
                        type="number"
                        min={0}
                        max={500}
                        value={draft.settings.dailyLimit}
                        onChange={(event) => setSetting("dailyLimit", Math.max(0, Number(event.target.value) || 0))}
                      />
                    </label>
                  </div>
                  <p className="k-hint mt-2">Takie same godziny „od” i „do” oznaczają pracę całą dobę. Limit 0 — bez limitu.</p>
                </Section>

                <Section title="Publikacja" hint="Kto dostaje oferty i kiedy trafiają na rynek.">
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <div>
                      <span className="k-label">Agent prowadzący</span>
                      <KeiTargetUserPicker
                        value={draft.targetUserId}
                        selected={draft.targetUserLabel}
                        onChange={(user) =>
                          setDraft({
                            ...draft,
                            targetUserId: user.id,
                            targetUserLabel: { id: user.id, name: user.name, email: user.email, role: user.role },
                          })
                        }
                      />
                    </div>
                    <label>
                      <span className="k-label">Prowizja</span>
                      <div className="relative">
                        <input
                          className="k-field pr-8"
                          inputMode="decimal"
                          value={draft.agentCommissionPercent}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              agentCommissionPercent: Math.min(10, Math.max(0, numberOrNull(event.target.value) ?? 0)),
                            })
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[color:var(--k-ink-3)]">%</span>
                      </div>
                    </label>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]">
                    <div>
                      <span className="k-label">Po imporcie</span>
                      <Seg
                        value={draft.settings.publishMode}
                        onChange={(publishMode) => setSetting("publishMode", publishMode)}
                        options={[
                          { id: "publish", label: "Od razu na rynek" },
                          { id: "review", label: "Szkic do przejrzenia" },
                        ]}
                      />
                    </div>
                    <label>
                      <span className="k-label">Min. zdjęć</span>
                      <input
                        className="k-field"
                        type="number"
                        min={0}
                        max={20}
                        value={draft.settings.minImages}
                        onChange={(event) => setSetting("minImages", Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
                      />
                    </label>
                  </div>
                  <p className="k-hint mt-2">
                    Oferta z mniejszą liczbą zdjęć niż minimum zostaje szkicem, nawet przy publikacji od razu.
                  </p>
                </Section>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dirty || error || notice ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="flex flex-col gap-3 border-t border-[color:var(--k-line)] bg-[color:var(--k-raised)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p
              className={`text-[12.5px] ${error ? "text-[color:var(--k-danger)]" : notice && !dirty ? "text-[color:var(--k-good)]" : "text-[color:var(--k-ink-2)]"}`}
              aria-live="polite"
            >
              {error || (dirty ? "Masz niezapisane zmiany." : notice)}
            </p>
            {dirty ? (
              <div className="flex items-center gap-2">
                <button type="button" className="k-btn k-btn--ghost" onClick={() => setDraft(saved)} disabled={saving}>
                  <RotateCcw size={14} /> Cofnij
                </button>
                <button type="button" className="k-btn k-btn--solid" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Zapisz ustawienia
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {history.length ? (
        <div className="border-t border-[color:var(--k-line)] px-6 py-5">
          <p className="text-[13px] font-semibold text-[color:var(--k-ink)]">Ostatnie cykle</p>
          <ul className="mt-3 divide-y divide-[color:var(--k-line)]">
            {history.map((row) => {
              const chip =
                row.status === "error"
                  ? { tone: "k-chip--danger", label: "Błąd" }
                  : row.status === "running" || row.status === "queued"
                    ? { tone: "k-chip--gold", label: "W toku" }
                    : row.status === "cancelled"
                      ? { tone: "k-chip--neutral", label: "Zatrzymany" }
                      : row.exported > 0
                        ? { tone: "k-chip--good", label: `${row.exported} nowych` }
                        : { tone: "k-chip--neutral", label: "Brak nowych" };
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openJob(row.id)}
                    className="flex w-full items-center gap-4 py-3 text-left transition-opacity hover:opacity-80"
                  >
                    <span className="w-[118px] shrink-0 text-[12.5px] tabular-nums text-[color:var(--k-ink-2)]">
                      {formatKeiWhen(row.createdAt)}
                    </span>
                    <span className={`k-chip ${chip.tone}`}>{chip.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[color:var(--k-ink-3)]">
                      {[
                        row.review ? `${row.review} szkic` : null,
                        row.skipped ? `${row.skipped} pominiętych` : null,
                        row.aiRewritten ? `AI ${row.aiRewritten}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || row.message}
                    </span>
                    <span className="hidden -space-x-2 sm:flex">
                      {row.thumbs.map((src, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatury ofert z cyklu
                        <img key={src + idx} src={src} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border-2 border-[color:var(--k-card)] object-cover" />
                      ))}
                    </span>
                    {row.aiRewritten ? <Sparkles size={13} className="shrink-0 text-[color:var(--k-gold-ink)]" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
