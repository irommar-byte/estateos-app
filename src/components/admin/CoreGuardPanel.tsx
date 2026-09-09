"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Check, Loader2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";

type GuardRange = "1h" | "24h" | "7d";

type HistoryRow = {
  id: number;
  collectedAt: string;
  level: string;
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  requestsPerMin: number;
  latencyP95Ms: number | null;
  status5xx: number;
  webRssBytes: number;
};

type Incident = {
  id: string;
  severity: "info" | "warning" | "critical";
  status: "pending" | "open" | "resolved";
  title: string;
  detail: string;
  recommendedAction?: string | null;
  autoFixable?: boolean;
  occurrences: number;
  lastSeenAt: string;
};

type GuardPayload = {
  score: number;
  level: "ok" | "warning" | "critical";
  collectedAt: string;
  latest: HistoryRow | null;
  latestDetails?: {
    processes?: Array<{
      id: number;
      name: string;
      status: string;
      cpu: number;
      memoryBytes: number;
      restarts: number;
      kind: "daemon" | "cron";
      cronRestart?: string | null;
    }>;
    kei?: { queued: number; running: number; expired: number };
    runtimeWorkers?: Array<{
      pid: number;
      rssBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      eventLoopP95Ms: number;
    }>;
    full?: {
      systemdFailed?: string[];
      timers?: string[];
      docker?: string[];
      kernelWarnings?: string[];
      backupAgeHours?: number | null;
    };
  } | null;
  history: HistoryRow[];
  incidents: Incident[];
  audits: Array<{
    id: number;
    actionId: string;
    status: string;
    detail?: string | null;
    createdAt: string;
  }>;
};

type RemediationPlan = {
  requiresConfirmation: boolean;
  confirmation: string | null;
  actions: Array<{
    id: string;
    label: string;
    risk: string;
    automatic: boolean;
    impact: string;
    rollback: string;
  }>;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function MiniChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-12 rounded-xl bg-[var(--eos-input)]" />;
  const width = 320;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 3 - ((value - min) / span) * (height - 6);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function CoreGuardPanel() {
  const [range, setRange] = useState<GuardRange>("24h");
  const [data, setData] = useState<GuardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/admin/server/guard?range=${range}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Nie udało się odczytać CORE Guard.");
      setData(body);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Błąd CORE Guard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/server/guard", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok && response.status !== 409) {
      throw new Error(result.error || "Operacja CORE Guard nie powiodła się.");
    }
    return result;
  };

  const executeAction = async (actionId: string, incidentId?: string) => {
    setBusyAction(actionId);
    setNotice(null);
    setError(null);
    try {
      const preview = await post({ operation: "plan", actionId }) as { plan: RemediationPlan };
      const action = preview.plan.actions[0];
      if (!action) throw new Error("Brak dozwolonego runbooka.");
      let confirmation: string | null = null;
      if (preview.plan.requiresConfirmation) {
        const accepted = window.confirm(
          `${action.label}\n\nSkutek: ${action.impact}\n\nWycofanie: ${action.rollback}`,
        );
        if (!accepted) return;
        confirmation = preview.plan.confirmation;
      }
      const result = await post({
        operation: "execute",
        actionId,
        incidentId,
        confirmation,
      });
      if (result.ok === false && result.requiresConfirmation) {
        throw new Error("Operacja wymaga ponownego potwierdzenia.");
      }
      setNotice(`Wykonano: ${action.label}`);
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Naprawa nie powiodła się.");
    } finally {
      setBusyAction(null);
    }
  };

  const runSafeSet = async () => {
    setBusyAction("safe-set");
    setNotice(null);
    setError(null);
    try {
      const preview = await post({ operation: "plan" }) as { plan: RemediationPlan };
      if (!preview.plan.actions.length) {
        setNotice("Brak bezpiecznych napraw do wykonania.");
        return;
      }
      for (const action of preview.plan.actions) {
        await post({ operation: "execute", actionId: action.id });
      }
      setNotice(`Wykonano ${preview.plan.actions.length} bezpiecznych napraw.`);
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Naprawa nie powiodła się.");
    } finally {
      setBusyAction(null);
    }
  };

  const acknowledge = async (incidentId: string) => {
    try {
      await post({ operation: "acknowledge", incidentId });
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się potwierdzić incydentu.");
    }
  };

  const activeIncidents = useMemo(
    () => data?.incidents.filter((incident) => incident.status === "open") || [],
    [data],
  );
  const history = data?.history || [];
  const latest = data?.latest;
  const processes = data?.latestDetails?.processes || [];

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-soft)]">
      <div className="border-b border-[var(--eos-border)] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`grid h-14 w-14 place-items-center rounded-2xl ${
              data?.level === "critical"
                ? "bg-red-500/10 text-red-600"
                : data?.level === "warning"
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-emerald-500/10 text-emerald-600"
            }`}>
              <ShieldCheck size={27} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                EstateOS CORE Guard
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--eos-text)]">
                {loading && !data ? "Ładowanie monitoringu…" : `Stan ${data?.score ?? 0}/100`}
              </h2>
              <p className="mt-1 text-sm text-[var(--eos-muted)]">
                Niezależny proces mierzy serwer co minutę i zapisuje historię w MariaDB.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["1h", "24h", "7d"] as GuardRange[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`h-10 rounded-full px-4 text-sm font-medium ${
                  range === option
                    ? "bg-[var(--eos-text)] text-[var(--eos-contrast)]"
                    : "border border-[var(--eos-border)] text-[var(--eos-muted)]"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--eos-border)] text-[var(--eos-muted)] disabled:opacity-40"
              aria-label="Odśwież CORE Guard"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => void runSafeSet()}
              disabled={busyAction != null}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--eos-text)] px-4 text-sm font-semibold text-[var(--eos-contrast)] disabled:opacity-40"
            >
              {busyAction === "safe-set" ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
              Bezpieczne naprawy
            </button>
          </div>
        </div>

        {(error || notice) && (
          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
            error ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}>
            {error || notice}
          </div>
        )}
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8 xl:grid-cols-4">
        {[
          {
            label: "CPU",
            value: `${Number(latest?.cpuPercent || 0).toFixed(1)}%`,
            chart: history.map((row) => Number(row.cpuPercent || 0)),
            color: "#0a84ff",
          },
          {
            label: "RAM",
            value: `${latest ? ((latest.memoryUsedBytes / Math.max(1, latest.memoryTotalBytes)) * 100).toFixed(1) : "0"}%`,
            chart: history.map((row) => (row.memoryUsedBytes / Math.max(1, row.memoryTotalBytes)) * 100),
            color: "#bf5af2",
          },
          {
            label: "p95 żądań",
            value: latest?.latencyP95Ms == null ? "brak próbek" : `${Math.round(latest.latencyP95Ms)} ms`,
            chart: history.map((row) => Number(row.latencyP95Ms || 0)),
            color: "#ff9f0a",
          },
          {
            label: "Ruch / min",
            value: `${Number(latest?.requestsPerMin || 0)}`,
            chart: history.map((row) => Number(row.requestsPerMin || 0)),
            color: "#30d158",
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-[var(--eos-border)] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--eos-subtle)]">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold text-[var(--eos-text)]">{metric.value}</p>
            <div className="mt-3"><MiniChart values={metric.chart} color={metric.color} /></div>
          </div>
        ))}
      </div>

      <div className="grid border-t border-[var(--eos-border)] lg:grid-cols-2">
        <div className="border-b border-[var(--eos-border)] p-6 md:p-8 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--eos-text)]">
              <AlertTriangle size={17} /> Aktywne incydenty
            </h3>
            <span className="rounded-full bg-[var(--eos-input)] px-2.5 py-1 text-xs text-[var(--eos-muted)]">
              {activeIncidents.length}
            </span>
          </div>
          <div className="space-y-3">
            {!activeIncidents.length ? (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/8 px-4 py-5 text-sm text-emerald-700 dark:text-emerald-300">
                <Check size={17} /> Brak aktywnych incydentów.
              </div>
            ) : activeIncidents.map((incident) => (
              <article key={incident.id} className="rounded-2xl border border-[var(--eos-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                      incident.severity === "critical" ? "text-red-600" : incident.severity === "warning" ? "text-amber-600" : "text-[var(--eos-subtle)]"
                    }`}>
                      {incident.severity} · {incident.occurrences}×
                    </p>
                    <h4 className="mt-1 font-semibold text-[var(--eos-text)]">{incident.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--eos-muted)]">{incident.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void acknowledge(incident.id)}
                    className="shrink-0 text-xs text-[var(--eos-subtle)] hover:text-[var(--eos-text)]"
                  >
                    Potwierdź
                  </button>
                </div>
                {incident.recommendedAction && (
                  <button
                    type="button"
                    onClick={() => void executeAction(incident.recommendedAction!, incident.id)}
                    disabled={busyAction != null}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-[var(--eos-border)] px-3 text-xs font-semibold text-[var(--eos-text)] disabled:opacity-40"
                  >
                    {busyAction === incident.recommendedAction ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />}
                    Podgląd i naprawa
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--eos-text)]">
            <Activity size={17} /> Flota procesów
          </h3>
          <div className="overflow-hidden rounded-2xl border border-[var(--eos-border)]">
            {processes.map((process) => (
              <div key={`${process.name}-${process.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[var(--eos-border)] px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--eos-text)]">{process.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--eos-subtle)]">
                    {process.kind === "cron" ? process.cronRestart || "harmonogram" : `RSS ${formatBytes(process.memoryBytes)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${process.status === "online" ? "text-emerald-600" : "text-red-600"}`}>
                    {process.status}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--eos-subtle)]">{process.restarts} restartów</p>
                </div>
              </div>
            ))}
            {!processes.length && (
              <div className="px-4 py-6 text-sm text-[var(--eos-muted)]">Czekam na pierwszą pełną próbkę Guard.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
