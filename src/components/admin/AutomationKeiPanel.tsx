"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Power, Save } from "lucide-react";
import {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  keiAutoIntervalLabel,
  type KeiAutoImportConfig,
} from "@/lib/keiAutoImportShared";
import { formatWarsawDateTime } from "@/lib/warsawDateTime";

type Draft = {
  enabled: boolean;
  intervalMinutes: number;
  count: string;
  targetUserId: string;
  agentCommissionPercent: string;
  propertyKind: "apartment" | "house";
  transactionKind: "sale" | "rent";
};

function draftFromConfig(config: KeiAutoImportConfig): Draft {
  return {
    enabled: config.enabled,
    intervalMinutes: config.intervalMinutes,
    count: String(config.count),
    targetUserId: String(config.targetUserId),
    agentCommissionPercent: String(config.agentCommissionPercent),
    propertyKind: config.propertyKind,
    transactionKind: config.transactionKind,
  };
}

type Props = {
  initialConfig?: KeiAutoImportConfig | null;
  onSaved?: (config: KeiAutoImportConfig) => void;
};

export default function AutomationKeiPanel({ initialConfig, onSaved }: Props) {
  const [config, setConfig] = useState<KeiAutoImportConfig | null>(initialConfig ?? null);
  const [draft, setDraft] = useState<Draft | null>(initialConfig ? draftFromConfig(initialConfig) : null);
  const [loading, setLoading] = useState(!initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const applyConfig = useCallback((next: KeiAutoImportConfig) => {
    setConfig(next);
    setDraft(draftFromConfig(next));
    onSaved?.(next);
  }, [onSaved]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kei-amer/auto-import", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.config) applyConfig(data.config as KeiAutoImportConfig);
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    if (initialConfig) {
      applyConfig(initialConfig);
      return;
    }
    void load();
  }, [initialConfig, load, applyConfig]);

  const save = async (patch?: Partial<KeiAutoImportConfig>) => {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/kei-amer/auto-import", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: patch?.enabled ?? draft.enabled,
          intervalMinutes: patch?.intervalMinutes ?? draft.intervalMinutes,
          count: patch?.count ?? Number(draft.count),
          targetUserId: patch?.targetUserId ?? Number(draft.targetUserId),
          agentCommissionPercent: patch?.agentCommissionPercent ?? Number(draft.agentCommissionPercent),
          propertyKind: patch?.propertyKind ?? draft.propertyKind,
          transactionKind: patch?.transactionKind ?? draft.transactionKind,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.config) {
        setMessage(String(data?.error || "Nie udało się zapisać."));
        return;
      }
      applyConfig(data.config as KeiAutoImportConfig);
      setMessage(data.config.enabled ? "Auto-import włączony na serwerze." : "Auto-import wyłączony.");
    } catch {
      setMessage("Błąd sieci przy zapisie.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-10 text-xs text-[var(--eos-muted)]">
        <Loader2 className="size-5 animate-spin text-violet-500" />
        Ładowanie harmonogramu KEI…
      </div>
    );
  }

  if (!draft || !config) return null;

  const nextRun = config.nextRunAt ? formatWarsawDateTime(config.nextRunAt) : "—";

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-[var(--eos-card)] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">
            Sterowanie KEI
          </p>
          <h3 className="text-xl font-black tracking-tight">Auto-import ofert</h3>
          <p className="mt-1 text-xs text-[var(--eos-muted)]">
            Cron co 5 min na serwerze · harmonogram poniżej steruje cyklem importu
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ enabled: !draft.enabled })}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
              draft.enabled
                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "border-[var(--eos-border)] bg-[var(--eos-bg)] text-[var(--eos-muted)]"
            }`}
          >
            <Power size={14} />
            {draft.enabled ? "Włączony" : "Wyłączony"}
          </button>
          <button
            type="button"
            disabled={saving || !draft.enabled}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Zapisz
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Następny cykl", value: draft.enabled ? nextRun : "Wyłączony" },
          { label: "Sesja — import", value: String(config.sessionImportedCount) },
          { label: "Sesja — pominięte", value: String(config.sessionSkippedCount) },
          { label: "Cykle sesji", value: String(config.sessionCycles) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/80 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{kpi.label}</p>
            <p className="text-sm font-black tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Interwał</span>
          <select
            value={draft.intervalMinutes}
            onChange={(e) => setDraft((p) => (p ? { ...p, intervalMinutes: Number(e.target.value) } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          >
            {KEI_AUTO_INTERVALS_MIN.map((min) => (
              <option key={min} value={min}>
                {keiAutoIntervalLabel(min)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Ilość / cykl</span>
          <input
            type="number"
            min={1}
            max={KEI_AUTO_MAX_COUNT}
            value={draft.count}
            onChange={(e) => setDraft((p) => (p ? { ...p, count: e.target.value } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">User ID</span>
          <input
            type="number"
            min={1}
            value={draft.targetUserId}
            onChange={(e) => setDraft((p) => (p ? { ...p, targetUserId: e.target.value } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Prowizja %</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={draft.agentCommissionPercent}
            onChange={(e) => setDraft((p) => (p ? { ...p, agentCommissionPercent: e.target.value } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Typ</span>
          <select
            value={draft.propertyKind}
            onChange={(e) => setDraft((p) => (p ? { ...p, propertyKind: e.target.value as Draft["propertyKind"] } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          >
            <option value="apartment">Mieszkanie</option>
            <option value="house">Dom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Transakcja</span>
          <select
            value={draft.transactionKind}
            onChange={(e) => setDraft((p) => (p ? { ...p, transactionKind: e.target.value as Draft["transactionKind"] } : p))}
            className="rounded-lg border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2.5 py-2 text-xs"
          >
            <option value="sale">Sprzedaż</option>
            <option value="rent">Najem</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--eos-subtle)]">
        {config.lastRunAt ? <span>Ostatni start: {formatWarsawDateTime(config.lastRunAt)}</span> : null}
        {config.lastJobId ? <span className="font-mono">job {config.lastJobId.slice(0, 8)}</span> : null}
        {config.lastError ? <span className="text-amber-600 dark:text-amber-300">{config.lastError}</span> : null}
        {message ? <span className="font-semibold text-emerald-600 dark:text-emerald-300">{message}</span> : null}
        <a
          href="/centrala"
          className="ml-auto inline-flex items-center gap-1 font-bold uppercase tracking-wide text-violet-600 hover:underline dark:text-violet-300"
        >
          <Play size={11} /> Ręczny import KEI
        </a>
      </div>
    </div>
  );
}
