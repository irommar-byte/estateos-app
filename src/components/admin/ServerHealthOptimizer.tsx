"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";

type Severity = "critical" | "warning" | "info";

type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  evidence?: Array<{ label: string; value: string }>;
  action?: string;
  fixable: boolean;
};

type Report = {
  healthy: boolean;
  level: "ok" | "warning" | "critical";
  score?: number;
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

function formatTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ScoreRing({ score, level }: { score: number; level: string }) {
  const size = 112;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = level === "critical" ? "#dc2626" : level === "warning" ? "#d97706" : "#059669";
  return (
    <div className="relative h-[112px] w-[112px] shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--eos-input)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--eos-subtle)]">/ 100</span>
      </div>
    </div>
  );
}

function severityLabel(severity: Severity) {
  if (severity === "critical") return "Krytyczne";
  if (severity === "warning") return "Ostrzeżenie";
  return "Informacja";
}

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
      const previewRes = await fetch("/api/admin/server/optimize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const preview = await previewRes.json();
      if (!previewRes.ok && previewRes.status !== 409) {
        throw new Error(preview.error || "Optymalizacja nie powiodła się.");
      }
      const planned = Array.isArray(preview.plan?.actions) ? preview.plan.actions : [];
      if (planned.length === 0) {
        setActions([{ id: "noop", label: "Brak bezpiecznych napraw", detail: "Stan pozostawiono bez zmian." }]);
        await scan();
        return;
      }
      const accepted = window.confirm(
        `CORE Guard wykona ${planned.length} bezpiecznych napraw:\n\n${planned
          .map((item: { label?: string; impact?: string }) => `• ${item.label || "Naprawa"} — ${item.impact || ""}`)
          .join("\n")}`,
      );
      if (!accepted) return;
      const res = await fetch("/api/admin/server/optimize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "CONFIRM:SAFE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Optymalizacja nie powiodła się.");
      setActions(Array.isArray(data.actions) ? data.actions : []);
      setReport(data.after || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd optymalizacji.");
    } finally {
      setOptimizing(false);
    }
  };

  const findings = report?.findings || [];
  const fixable = findings.filter((item) => item.fixable);
  const score = report?.score ?? (report?.healthy ? 100 : 90);
  const level = report?.level || "ok";
  const headline = useMemo(() => {
    if (!report && scanning) return "Trwa kontrola serwera";
    if (optimizing) return "Przywracam zdrowy stan";
    if (report?.healthy) return "Serwer jest w zdrowym stanie";
    if (level === "critical") return "Wymagana interwencja";
    if (fixable.length === 1) return "1 odchylenie do naprawy";
    if (fixable.length > 1) return `${fixable.length} odchylenia do naprawy`;
    return report?.summary || "Kontrola zakończona";
  }, [fixable.length, level, optimizing, report, scanning]);

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-soft)]">
      <div className={`grid gap-8 ${compact ? "p-6 md:p-7" : "p-7 md:p-9"} lg:grid-cols-[140px_minmax(0,1fr)]`}>
        <div className="flex flex-col items-start gap-4">
          <ScoreRing score={scanning && !report ? 0 : score} level={level} />
          <p className="text-[11px] leading-relaxed text-[var(--eos-subtle)]">
            {report?.collectedAt ? `Ostatni skan ${formatTime(report.collectedAt)}` : "Czekam na pierwszy skan"}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--eos-subtle)] uppercase">
                Optymalizator serwera
              </p>
              <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-[var(--eos-text)] md:text-[32px]">
                {headline}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--eos-muted)]">
                {optimizing
                  ? "Wykonuję zatwierdzony, bezpieczny podzbiór napraw."
                  : report?.summary || "Sprawdzam dysk, logi, PM2, bazę i zacięte procesy."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={scanning || optimizing}
                onClick={() => void scan()}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 text-sm font-medium text-[var(--eos-text)] transition-colors hover:border-[var(--eos-border-strong)] disabled:opacity-40"
              >
                {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Skanuj ponownie
              </button>
              <button
                type="button"
                disabled={optimizing || scanning || fixable.length === 0}
                onClick={() => void optimize()}
                className="inline-flex h-11 items-center rounded-full bg-[var(--eos-text)] px-5 text-sm font-semibold text-[var(--eos-contrast)] disabled:opacity-35"
              >
                {optimizing ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
                Przywróć zdrowy stan
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {actions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/6 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Wykonane naprawy</p>
              <ul className="mt-2 space-y-1.5">
                {actions.map((action) => (
                  <li key={action.id} className="flex items-start gap-2 text-sm text-[var(--eos-text)]">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>
                      {action.label}
                      <span className="text-[var(--eos-muted)]">
                        {" "}
                        — {action.detail}
                        {action.freedBytes ? ` · ${formatBytes(action.freedBytes)}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--eos-border)]">
            {!report && scanning ? (
              <div className="flex items-center gap-3 px-5 py-8 text-sm text-[var(--eos-muted)]">
                <Loader2 size={16} className="animate-spin" />
                Czytam PM2, dysk, logi i health…
              </div>
            ) : report?.healthy && findings.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-7 text-[15px] text-[var(--eos-muted)]">
                <Check size={18} className="text-emerald-600" />
                Brak śmieci, zaciętych procesów i rozjazdów wersji.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--eos-border)] bg-[var(--eos-input)] text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--eos-subtle)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Problem</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">Stan</th>
                    <th className="px-5 py-3 font-medium">Naprawa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--eos-border)]">
                  {findings.map((finding) => (
                    <tr key={finding.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              finding.severity === "critical"
                                ? "bg-red-500"
                                : finding.severity === "warning"
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                            }`}
                          />
                          <div>
                            <p className="font-semibold text-[var(--eos-text)]">{finding.title}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-[var(--eos-muted)]">{finding.detail}</p>
                            <p className="mt-2 text-[11px] text-[var(--eos-subtle)] md:hidden">
                              {severityLabel(finding.severity)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        {finding.evidence?.length ? (
                          <dl className="space-y-1.5">
                            {finding.evidence.map((row) => (
                              <div key={`${finding.id}-${row.label}`} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                                <dt className="text-[12px] text-[var(--eos-subtle)]">{row.label}</dt>
                                <dd className="font-mono text-[12px] text-[var(--eos-text)]">{row.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <span className="text-[12px] text-[var(--eos-subtle)]">{severityLabel(finding.severity)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[var(--eos-muted)]">
                        {finding.action || (finding.fixable ? "Automatyczna" : "Tylko podgląd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
