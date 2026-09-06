"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Loader2, ScanSearch, Sparkles } from "lucide-react";

type Severity = "critical" | "warning" | "info";

type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  fixable: boolean;
};

type Report = {
  healthy: boolean;
  level: "ok" | "warning" | "critical";
  summary: string;
  findings: Finding[];
  collectedAt: string;
};

type Action = {
  id: string;
  label: string;
  detail: string;
  freedBytes?: number;
};

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const tone: Record<string, string> = {
  ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  critical: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
};

export default function ServerHealthOptimizer({ compact = false }: { compact?: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/server/diagnose", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skan nie powiódł się.");
      setReport(data);
      setActions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd skanu.");
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  const optimize = async () => {
    setOptimizing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/server/optimize", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Optymalizacja nie powiodła się.");
      setActions(Array.isArray(data.actions) ? data.actions : []);
      setReport(data.after || data.status || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd optymalizacji.");
    } finally {
      setOptimizing(false);
    }
  };

  const fixable = report?.findings.filter((item) => item.fixable) || [];
  const level = report?.level || "ok";
  const badge =
    !report && scanning
      ? "Skanuję…"
      : report?.healthy
        ? "Zdrowy stan"
        : level === "critical"
          ? "Krytycznie"
          : level === "warning"
            ? "Wymaga optymalizacji"
            : "Drobne uwagi";

  return (
    <section
      className={`overflow-hidden rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-soft)] ${
        compact ? "p-6" : "p-7 md:p-8"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[var(--eos-accent)]">
            Diagnostyka serwera
          </p>
          <h2 className={`${compact ? "text-2xl" : "text-3xl"} font-black tracking-tight`}>
            Śmieci, błędy i zdrowy stan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
            Skanuję dysk, logi, PM2, bazę i zacięte procesy. Optymalizacja sprząta to, co bezpieczne, i przywraca
            zdrowy stan bez wyłączania strony.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest ${tone[level]}`}>
            {badge}
          </span>
          <button
            type="button"
            disabled={scanning || optimizing}
            onClick={() => void scan()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[var(--eos-text)] disabled:opacity-40"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            Skanuj serwer
          </button>
          <button
            type="button"
            disabled={optimizing || scanning || fixable.length === 0}
            onClick={() => void optimize()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--eos-accent)] px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-40"
          >
            {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Optymalizacja
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            Wykonane
          </p>
          <ul className="space-y-1 text-sm text-[var(--eos-text)]">
            {actions.map((action) => (
              <li key={action.id}>
                <span className="font-semibold">{action.label}</span>
                <span className="text-[var(--eos-muted)]">
                  {" "}
                  — {action.detail}
                  {action.freedBytes ? ` · ${formatBytes(action.freedBytes)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        {!report && scanning ? (
          <p className="flex items-center gap-2 text-sm text-[var(--eos-muted)]">
            <Loader2 size={14} className="animate-spin" /> Przeszukuję serwer…
          </p>
        ) : report?.healthy ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-4">
            <CheckCircle2 className="mt-0.5 text-emerald-600 dark:text-emerald-400" size={20} />
            <div>
              <p className="font-black">Zdrowy stan</p>
              <p className="mt-1 text-sm text-[var(--eos-muted)]">{report.summary}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-[var(--eos-muted)]">
              <Activity size={14} /> {report?.summary || "Brak raportu."}
            </p>
            {(report?.findings || []).map((finding) => (
              <div
                key={finding.id}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black">{finding.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      finding.severity === "critical"
                        ? "bg-red-500/15 text-red-700 dark:text-red-300"
                        : finding.severity === "warning"
                          ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          : "bg-[var(--eos-input)] text-[var(--eos-subtle)]"
                    }`}
                  >
                    {finding.fixable ? "Do optymalizacji" : "Tylko podgląd"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{finding.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
