"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Server,
  LayoutGrid,
  List,
} from "lucide-react";
import { ESTATEOS_TIMEZONE, formatWarsawDateTime } from "@/lib/warsawDateTime";
import OfferPrivateCommentModal from "@/components/crm/OfferPrivateCommentModal";
import AutomationKeiPanel from "@/components/admin/AutomationKeiPanel";
import type { KeiAutoImportConfig } from "@/lib/keiAutoImportShared";
import type { ImportRegistryRow } from "@/lib/adminImportRegistry";
import type { ScheduledJobView } from "@/lib/adminAutomationOverview";
import type { KeiImportJobSnapshot, KeiImportJobItem } from "@/lib/keiAmerImportJobs";

const SOURCE_FILTERS = ["", "KEI", "OTODOM", "NERYCHOMOSCI", "MANUAL"] as const;
type TabId = "panel" | "harmonogram" | "rejestr";

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "panel", label: "Panel", icon: <LayoutGrid size={14} /> },
  { id: "harmonogram", label: "Harmonogram", icon: <CalendarClock size={14} /> },
  { id: "rejestr", label: "Rejestr importów", icon: <List size={14} /> },
];

function statusTone(status: string | null | undefined): string {
  const s = String(status || "").toLowerCase();
  if (s === "online" || s === "running" || s === "done" || s === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (s === "queued" || s === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (s === "error" || s === "cancelled" || s === "stopped") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-[var(--eos-border)] bg-[var(--eos-bg)] text-[var(--eos-muted)]";
}

function sourceLabel(source: string): string {
  const s = source.toUpperCase();
  if (s === "KEI") return "KEI";
  if (s === "OTODOM") return "Otodom";
  if (s === "NERYCHOMOSCI" || s === "N-O") return "N-O";
  return source || "—";
}

function formatTs(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return formatWarsawDateTime(value);
  } catch {
    return value;
  }
}

type ImportModalOffer = { id: number; title?: string };

function ImportSnapshotLink({
  offerId,
  offerTitle,
  onOpen,
}: {
  offerId: number;
  offerTitle?: string;
  onOpen: (offer: ImportModalOffer) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen({ id: offerId, title: offerTitle })}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 hover:underline dark:text-sky-300"
    >
      <MessageSquare size={11} />
      Dane importu
    </button>
  );
}

function OfferLink({
  offerId,
  href,
  label,
}: {
  offerId: number;
  href?: string | null;
  label?: string;
}) {
  const url = href || `/oferta/${offerId}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 hover:underline dark:text-violet-200"
    >
      {label || `#${offerId}`}
      <ExternalLink size={10} />
    </a>
  );
}

function extractSkippedOfferId(reason: string | undefined, existingOfferId?: number): number | null {
  if (existingOfferId && Number.isFinite(existingOfferId)) return existingOfferId;
  const match = String(reason || "").match(/#(\d+)/);
  return match ? Number(match[1]) : null;
}

function KeiJobResults({
  job,
  onOpenImport,
}: {
  job: KeiImportJobSnapshot;
  onOpenImport: (offer: ImportModalOffer) => void;
}) {
  const exportedIds = new Set(job.exported.map((row) => row.offerId));
  const itemOffers = job.items.filter((item) => item.offerId && !exportedIds.has(item.offerId));

  return (
    <div className="space-y-2">
      <p className="text-[var(--eos-muted)]">
        {job.exported.length} zaimport., {job.skipped.length} pominięte
        {job.message ? ` — ${job.message}` : ""}
      </p>

      {job.exported.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Oferty</p>
          <div className="space-y-1">
            {job.exported.map((row) => (
              <div key={`exp-${row.offerId}`} className="flex flex-wrap items-center gap-2">
                <OfferLink offerId={row.offerId} href={row.publicUrl || row.editUrl} />
                <ImportSnapshotLink offerId={row.offerId} onOpen={onOpenImport} />
                {row.portalUrl ? (
                  <a
                    href={row.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-sky-600 hover:underline dark:text-sky-300"
                  >
                    portal
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {itemOffers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {itemOffers.map((item) => (
            <div key={`item-${item.index}-${item.offerId}`} className="flex items-center gap-2">
              <OfferLink offerId={item.offerId!} href={item.publicUrl || item.editUrl} />
              <ImportSnapshotLink offerId={item.offerId!} onOpen={onOpenImport} />
            </div>
          ))}
        </div>
      ) : null}

      {job.skipped.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">Pominięte</p>
          {job.skipped.map((row, index) => {
            const offerId = extractSkippedOfferId(row.reason, row.existingOfferId);
            return (
              <p key={`skip-${index}`} className="text-[10px] leading-relaxed text-[var(--eos-muted)]">
                {offerId ? (
                  <>
                    <OfferLink offerId={offerId} />
                    <span className="mx-1">·</span>
                    <ImportSnapshotLink offerId={offerId} onOpen={onOpenImport} />
                    <span className="mx-1">·</span>
                  </>
                ) : null}
                {row.reason}
                {row.portalUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={row.portalUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-300">
                      portal
                    </a>
                  </>
                ) : null}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ActiveKeiJobCard({
  job,
  onOpenImport,
}: {
  job: KeiImportJobSnapshot;
  onOpenImport: (offer: ImportModalOffer) => void;
}) {
  const activeItems = job.items.filter((item) => item.status === "active" || item.status === "done");
  return (
    <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[var(--eos-subtle)]">{job.id.slice(0, 8)}…</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(job.status)}`}>
          {job.status}
        </span>
      </div>
      <p className="mt-1 text-[var(--eos-muted)]">{job.message || "—"}</p>
      <p className="mt-1 text-[10px] text-[var(--eos-subtle)]">
        Start: {formatTs(job.createdAt)} · aktualizacja: {formatTs(job.updatedAt)}
      </p>
      {activeItems.length > 0 ? (
        <div className="mt-2 space-y-1">
          {activeItems.map((item: KeiImportJobItem) => (
            <p key={item.index} className="text-[10px] text-[var(--eos-muted)]">
              {item.offerId ? (
                <>
                  <OfferLink offerId={item.offerId} href={item.publicUrl || item.editUrl} />
                  <span className="mx-1">·</span>
                  <ImportSnapshotLink offerId={item.offerId} onOpen={onOpenImport} />
                  <span className="mx-1">·</span>
                </>
              ) : (
                `Pozycja ${item.index + 1} · `
              )}
              {item.stepLabel}
              {item.stepDetail ? ` — ${item.stepDetail}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AutomationWorkspace() {
  const router = useRouter();
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [importsLoading, setImportsLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [importsError, setImportsError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledJobView[]>([]);
  const [activeJobs, setActiveJobs] = useState<KeiImportJobSnapshot[]>([]);
  const [recentJobs, setRecentJobs] = useState<KeiImportJobSnapshot[]>([]);
  const [imports, setImports] = useState<ImportRegistryRow[]>([]);
  const [importsTotal, setImportsTotal] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [importModalOffer, setImportModalOffer] = useState<ImportModalOffer | null>(null);
  const [keiAuto, setKeiAuto] = useState<KeiAutoImportConfig | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("panel");
  const [recentJobsTotal, setRecentJobsTotal] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 40;

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/admin/automation/overview", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
      setScheduled(Array.isArray(data.scheduled) ? data.scheduled : []);
      setActiveJobs(Array.isArray(data.activeJobs) ? data.activeJobs : []);
      setRecentJobs(Array.isArray(data.recentJobs) ? data.recentJobs : []);
      setRecentJobsTotal(Number(data.recentJobsTotal || 0));
      setKeiAuto(data.keiAuto ?? null);
      setGeneratedAt(data.generatedAt || null);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Błąd ładowania");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadImports = useCallback(async () => {
    setImportsLoading(true);
    setImportsError(null);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (sourceFilter) params.set("source", sourceFilter);
      const res = await fetch(`/api/admin/automation/imports?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
      setImports(Array.isArray(data.rows) ? data.rows : []);
      setImportsTotal(Number(data.total || 0));
    } catch (err) {
      setImportsError(err instanceof Error ? err.message : "Błąd ładowania rejestru");
    } finally {
      setImportsLoading(false);
    }
  }, [page, pageSize, sourceFilter]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadOverview();
      if (activeTab === "rejestr") void loadImports();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [loadOverview, loadImports, activeTab]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(importsTotal / pageSize)), [importsTotal, pageSize]);

  const kpis = useMemo(() => {
    const cronOnline = scheduled.filter((j) => String(j.pm2Status).toLowerCase() === "online").length;
    const cronStopped = scheduled.length - cronOnline;
    return {
      importsTotal,
      activeJobs: activeJobs.length,
      recentJobs: recentJobsTotal,
      cronOnline,
      cronStopped,
      nextKei: keiAuto?.enabled && keiAuto.nextRunAt ? formatTs(keiAuto.nextRunAt) : keiAuto?.enabled ? "Wkrótce" : "Wyłączony",
    };
  }, [scheduled, importsTotal, activeJobs.length, recentJobsTotal, keiAuto]);

  const refreshAll = () => {
    void loadOverview();
    void loadImports();
  };

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] px-4 pb-16 pt-28 text-[var(--eos-text)] sm:px-6 md:px-10 md:pt-32">
      <div className="mx-auto max-w-[1400px]">
        <button
          type="button"
          onClick={() => router.push("/centrala")}
          className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          <ArrowLeft size={14} /> Centrala
        </button>

        <header className="mb-6 flex flex-col gap-4 border-b border-[var(--eos-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Automatyzacja<span className="text-violet-500">.</span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
              <Bot size={12} className="text-violet-500" />
              Harmonogram procesów i rejestr importów · {ESTATEOS_TIMEZONE.replace("_", " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/centrala/pamiec-i-serwer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
            >
              <Server size={14} /> PM2 / serwer
            </a>
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
            >
              <RefreshCw size={14} className={overviewLoading || importsLoading ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Rejestr importów", value: kpis.importsTotal },
            { label: "Aktywne joby", value: kpis.activeJobs },
            { label: "Ostatnie joby KEI", value: kpis.recentJobs },
            { label: "Cron online", value: kpis.cronOnline },
            { label: "Cron stopped", value: kpis.cronStopped },
            { label: "Następny KEI", value: kpis.nextKei, small: true },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">{kpi.label}</p>
              <p className={`font-black tabular-nums ${kpi.small ? "text-xs leading-snug" : "text-xl"}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-200"
                  : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {generatedAt ? (
          <p className="mb-4 text-[10px] text-[var(--eos-subtle)]">
            Ostatnia aktualizacja: {formatTs(generatedAt)} · auto-odświeżanie co 45 s
          </p>
        ) : null}

        {activeTab === "panel" ? (
          <div className="space-y-8">
            <AutomationKeiPanel initialConfig={keiAuto} onSaved={setKeiAuto} />

            {activeJobs.length > 0 ? (
              <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  Aktywne importy KEI ({activeJobs.length})
                </h2>
                <div className="space-y-2">
                  {activeJobs.map((job) => (
                    <ActiveKeiJobCard key={job.id} job={job} onOpenImport={setImportModalOffer} />
                  ))}
                </div>
              </section>
            ) : null}

            {recentJobs.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                  Ostatnie zadania importu KEI
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--eos-border)] bg-[var(--eos-bg)] text-[10px] uppercase tracking-widest text-[var(--eos-subtle)]">
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Źródło</th>
                        <th className="px-3 py-2.5">Wynik / oferty</th>
                        <th className="px-3 py-2.5">Czas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentJobs.map((job) => (
                        <tr key={job.id} className="border-b border-[var(--eos-border)] align-top">
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 capitalize">{job.source}</td>
                          <td className="px-3 py-2.5">
                            <KeiJobResults job={job} onOpenImport={setImportModalOffer} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--eos-muted)]">
                            {formatTs(job.finishedAt || job.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {activeTab === "harmonogram" ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={16} className="text-violet-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">Zaplanowane procesy</h2>
          </div>

          {overviewError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-700 dark:text-red-200">
              {overviewError}
            </div>
          ) : overviewLoading && scheduled.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-12 text-xs text-[var(--eos-muted)]">
              <Loader2 className="size-5 animate-spin text-violet-500" />
              Ładowanie harmonogramu…
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {scheduled.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:p-5"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black">{job.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                        {job.scheduleLabel} · <span className="font-mono">{job.schedule}</span>
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusTone(job.pm2Status)}`}>
                      {job.pm2Status || "—"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--eos-muted)]">{job.description}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--eos-subtle)]">
                    {job.pm2Uptime ? <span>Uptime: {job.pm2Uptime}</span> : null}
                    {job.pm2Restarts != null ? <span>Restarty: {job.pm2Restarts}</span> : null}
                    {job.nextHint ? (
                      <span className="font-semibold text-violet-600 dark:text-violet-300">{job.nextHint}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        ) : null}

        {activeTab === "rejestr" ? (
        <section>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-pink-500" />
              <h2 className="text-sm font-black uppercase tracking-widest">Rejestr importów</h2>
              <span className="rounded-full border border-[var(--eos-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--eos-muted)]">
                {importsTotal}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_FILTERS.map((filter) => {
                const label = filter ? sourceLabel(filter) : "Wszystkie";
                const active = sourceFilter === filter;
                return (
                  <button
                    key={filter || "all"}
                    type="button"
                    onClick={() => {
                      setPage(0);
                      setSourceFilter(filter);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      active
                        ? "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {importsError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-700 dark:text-red-200">
              {importsError}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
              {importsLoading && imports.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--eos-muted)]">
                  <Loader2 className="size-5 animate-spin text-violet-500" />
                  Ładowanie rejestru…
                </div>
              ) : (
                <table className="w-full min-w-[1200px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--eos-border)] bg-[var(--eos-bg)] text-[10px] uppercase tracking-widest text-[var(--eos-subtle)]">
                      <th className="px-3 py-2.5">Kiedy</th>
                      <th className="px-3 py-2.5">Oferta</th>
                      <th className="px-3 py-2.5">Źródło</th>
                      <th className="px-3 py-2.5">Agent</th>
                      <th className="px-3 py-2.5">Dane importu</th>
                      <th className="px-3 py-2.5">Smart Add (AI)</th>
                      <th className="px-3 py-2.5">Link źródłowy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-[var(--eos-muted)]">
                          Brak wpisów w rejestrze importów.
                        </td>
                      </tr>
                    ) : (
                      imports.map((row) => (
                        <tr key={`${row.offerId}-${row.userId}`} className="border-b border-[var(--eos-border)] hover:bg-[var(--eos-bg)]">
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--eos-muted)]">
                            {formatTs(row.importedAt)}
                            <p className="text-[10px] text-[var(--eos-subtle)]">utworzono: {formatTs(row.offerCreatedAt)}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <a
                              href={`/oferta/${row.offerId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-violet-600 hover:underline dark:text-violet-300"
                            >
                              #{row.offerId}
                              <ExternalLink size={12} />
                            </a>
                            <p className="max-w-[220px] truncate text-[var(--eos-muted)]" title={row.offerTitle}>
                              {row.offerTitle}
                            </p>
                            <p className="text-[10px] uppercase text-[var(--eos-subtle)]">{row.offerStatus}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-2 py-0.5 text-[10px] font-bold uppercase">
                              {sourceLabel(row.importSource)}
                            </span>
                            {row.keiId ? <p className="mt-1 font-mono text-[10px] text-[var(--eos-subtle)]">KEI {row.keiId}</p> : null}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--eos-muted)]">
                            <p className="font-semibold text-[var(--eos-text)]">{row.userName || `User #${row.userId}`}</p>
                            <p className="text-[10px]">{row.userEmail || "—"}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <ImportSnapshotLink
                              offerId={row.offerId}
                              offerTitle={row.offerTitle}
                              onOpen={setImportModalOffer}
                            />
                            <p className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-[var(--eos-subtle)]">
                              Oryginalny opis, kontakt KEI/portalu, źródło
                            </p>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.smartAddFields.length ? (
                              <div className="flex max-w-[260px] flex-wrap gap-1">
                                {row.smartAddFields.map((field) => (
                                  <span
                                    key={field}
                                    className="rounded-full border border-pink-500/25 bg-pink-500/10 px-2 py-0.5 text-[10px] font-semibold text-pink-700 dark:text-pink-200"
                                  >
                                    {field}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[var(--eos-subtle)]">—</span>
                            )}
                          </td>
                          <td className="max-w-[200px] px-3 py-2.5">
                            {row.importExternalUrl ? (
                              <a
                                href={row.importExternalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 truncate text-[11px] text-sky-600 hover:underline dark:text-sky-300"
                                title={row.importExternalUrl}
                              >
                                Portal <ExternalLink size={11} />
                              </a>
                            ) : (
                              <span className="text-[var(--eos-subtle)]">—</span>
                            )}
                            {row.sourceLastCheckAt ? (
                              <p className="text-[10px] text-[var(--eos-subtle)]">
                                sprawdzono: {formatTs(row.sourceLastCheckAt)}
                                {row.sourceIsActive === false ? " · nieaktywny" : ""}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {importsTotal > pageSize ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[10px] text-[var(--eos-subtle)]">
                Strona {page + 1} / {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 0 || importsLoading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-bold uppercase disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Wstecz
                </button>
                <button
                  type="button"
                  disabled={page + 1 >= pageCount || importsLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-3 py-1.5 text-[10px] font-bold uppercase disabled:opacity-40"
                >
                  Dalej <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </section>
        ) : null}

        <OfferPrivateCommentModal
          open={Boolean(importModalOffer)}
          offerId={importModalOffer?.id ?? null}
          offerTitle={importModalOffer?.title}
          onClose={() => setImportModalOffer(null)}
        />
      </div>
    </div>
  );
}
