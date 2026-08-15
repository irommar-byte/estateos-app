"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  File,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Cpu,
  MemoryStick,
  Database,
  Play,
  RotateCw,
  Square,
  AlertTriangle,
  Shield,
} from "lucide-react";

type HealthLevel = "ok" | "warning" | "critical";

type StatusPayload = {
  level: HealthLevel;
  cpu: { percent: number; cores: number; load1: number };
  memory: { usedBytes: number; totalBytes: number; freeBytes: number; percent: number };
  disk: { usedBytes: number; totalBytes: number; freeBytes: number; percent: number };
  database: { name: string; status: string; up: boolean };
  host: string;
  uptimeSec: number;
};

type Bucket = {
  id: string;
  label: string;
  service: string;
  root: string;
  deletable: boolean;
  exists: boolean;
  bytes: number;
  children: Array<{ name: string; path: string; bytes: number; isDir: boolean }>;
};

type FileEntry = {
  name: string;
  relativePath: string;
  isDir: boolean;
  bytes: number;
  mtimeMs: number | null;
  deletable: boolean;
};

type ProcessRow = {
  name: string;
  status: string;
  cpu: number;
  memoryBytes: number;
  uptimeMs: number;
  restarts: number;
  pid: number | null;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

function formatUptime(ms: number) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

function levelLabel(level: HealthLevel) {
  if (level === "critical") return { text: "Krytycznie", className: "text-red-400 bg-red-500/10 border-red-500/25" };
  if (level === "warning") return { text: "Uwaga", className: "text-amber-400 bg-amber-500/10 border-amber-500/25" };
  return { text: "Stabilnie", className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
}

export default function ServerMemoryPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [mariadb, setMariadb] = useState<{ up: boolean; status: string } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listing, setListing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/server/status", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Status");
    setStatus(data);
    setLoadingStatus(false);
  }, []);

  const loadStorage = useCallback(async () => {
    setLoadingStorage(true);
    const res = await fetch("/api/admin/server/storage", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Pamięć");
    setBuckets(data.buckets || []);
    setLoadingStorage(false);
  }, []);

  const loadProcesses = useCallback(async () => {
    const res = await fetch("/api/admin/server/processes", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Procesy");
    setProcesses(data.processes || []);
    setMariadb(data.mariadb || null);
  }, []);

  const loadFiles = useCallback(async (bucket: string, path = "", sizes = true) => {
    setListing(true);
    setSelected(new Set());
    try {
      const qs = new URLSearchParams({ bucket, path, sizes: sizes ? "1" : "0" });
      const res = await fetch(`/api/admin/server/files?${qs}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pliki");
      setEntries(data.entries || []);
      setCwd(path);
      setActiveBucket(bucket);
    } finally {
      setListing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([loadStatus(), loadProcesses(), loadStorage()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Błąd");
      }
    })();
    const timer = window.setInterval(() => {
      void loadStatus().catch(() => undefined);
      void loadProcesses().catch(() => undefined);
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadStatus, loadProcesses, loadStorage]);

  const bucket = buckets.find((b) => b.id === activeBucket) || null;
  const crumbs = useMemo(() => {
    if (!cwd) return [];
    const parts = cwd.split("/").filter(Boolean);
    return parts.map((part, i) => ({ name: part, path: parts.slice(0, i + 1).join("/") }));
  }, [cwd]);

  const selectedEntries = entries.filter((e) => selected.has(e.relativePath));
  const selectedBytes = selectedEntries.reduce((sum, e) => sum + (e.bytes || 0), 0);

  const toggle = (rel: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  };

  const toggleAll = () => {
    const deletable = entries.filter((e) => e.deletable);
    if (selected.size === deletable.length) setSelected(new Set());
    else setSelected(new Set(deletable.map((e) => e.relativePath)));
  };

  const runDelete = async () => {
    if (!activeBucket || selected.size === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/server/files", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: activeBucket, paths: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Usuwanie nie powiodło się.");
      setConfirmDelete(false);
      setNotice(`Usunięto ${data.deleted?.length || 0} pozycji.`);
      await loadFiles(activeBucket, cwd);
      void loadStorage();
      void loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd usuwania.");
    } finally {
      setBusy(false);
    }
  };

  const runProcess = async (name: string, action: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/server/processes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, action }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || "Akcja nie powiodła się.");
      setNotice(`${action} · ${name}`);
      await new Promise((r) => setTimeout(r, 900));
      await loadProcesses();
      await loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd procesu.");
    } finally {
      setBusy(false);
    }
  };

  const level = status?.level || "ok";
  const pill = levelLabel(level);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.bytes));

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-32 text-[var(--eos-text)] sm:px-6 md:px-12 md:pt-36">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/centrala"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          <ArrowLeft size={14} /> Powrót do centrali
        </Link>

        <header className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--eos-border)] pb-8">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Centrala · infrastruktura</p>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">Pamięć i serwer</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--eos-muted)]">
              Jeden dysk VPS współdzielą nieruchomości, filmy i muzyka. Tu widać, co zajmuje miejsce i co można bezpiecznie skasować.
            </p>
          </div>
          <div className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest ${pill.className}`}>
            {loadingStatus ? "Odczyt…" : pill.text}
          </div>
        </header>

        {error && (
          <div className="mb-8 flex items-center gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            <AlertTriangle size={18} /> {error}
          </div>
        )}
        {notice && (
          <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--eos-muted)]">
            {notice}
          </div>
        )}

        <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            icon={<HardDrive size={18} />}
            label="Dysk"
            value={status ? `${Math.round(status.disk.percent)}%` : "—"}
            detail={status ? `${formatBytes(status.disk.freeBytes)} wolne z ${formatBytes(status.disk.totalBytes)}` : ""}
            percent={status?.disk.percent || 0}
            tone={level}
          />
          <MetricCard
            icon={<Cpu size={18} />}
            label="Procesor"
            value={status ? `${Math.round(status.cpu.percent)}%` : "—"}
            detail={status ? `${status.cpu.cores} rdzeni · load ${status.cpu.load1}` : ""}
            percent={status?.cpu.percent || 0}
            tone={status && status.cpu.percent >= 90 ? "critical" : status && status.cpu.percent >= 75 ? "warning" : "ok"}
          />
          <MetricCard
            icon={<MemoryStick size={18} />}
            label="Pamięć RAM"
            value={status ? `${Math.round(status.memory.percent)}%` : "—"}
            detail={status ? `${formatBytes(status.memory.usedBytes)} / ${formatBytes(status.memory.totalBytes)}` : ""}
            percent={status?.memory.percent || 0}
            tone={status && status.memory.percent >= 92 ? "warning" : "ok"}
          />
        </section>

        <section className="mb-14">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">Procesy</h2>
            <button
              type="button"
              onClick={() => void loadProcesses()}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
            >
              <RefreshCw size={12} /> Odśwież
            </button>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-white/5 bg-[#0a0a0a]">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3">Usługa</th>
                  <th className="px-5 py-3">Stan</th>
                  <th className="px-5 py-3">CPU</th>
                  <th className="px-5 py-3">RAM</th>
                  <th className="px-5 py-3">Czas</th>
                  <th className="px-5 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-5 py-4 font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <Database size={14} className="text-amber-400" /> MariaDB
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusDot up={mariadb?.up === true} label={mariadb?.status || "?"} />
                  </td>
                  <td className="px-5 py-4 text-gray-500">—</td>
                  <td className="px-5 py-4 text-gray-500">—</td>
                  <td className="px-5 py-4 text-gray-500">baza ofert</td>
                  <td className="px-5 py-4 text-right">
                    {!mariadb?.up && (
                      <ActionBtn disabled={busy} onClick={() => void runProcess("mariadb", "start")} icon={<Play size={12} />}>
                        Start
                      </ActionBtn>
                    )}
                  </td>
                </tr>
                {processes.map((proc) => (
                  <tr key={proc.name} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-4 font-semibold">{proc.name}</td>
                    <td className="px-5 py-4">
                      <StatusDot up={proc.status === "online"} label={proc.status} />
                    </td>
                    <td className="px-5 py-4 tabular-nums">{Math.round(proc.cpu)}%</td>
                    <td className="px-5 py-4 tabular-nums">{formatBytes(proc.memoryBytes)}</td>
                    <td className="px-5 py-4 text-gray-500">{formatUptime(proc.uptimeMs)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionBtn disabled={busy} onClick={() => void runProcess(proc.name, "restart")} icon={<RotateCw size={12} />}>
                          Restart
                        </ActionBtn>
                        {proc.status === "online" ? (
                          <ActionBtn disabled={busy} onClick={() => void runProcess(proc.name, "stop")} icon={<Square size={12} />}>
                            Stop
                          </ActionBtn>
                        ) : (
                          <ActionBtn disabled={busy} onClick={() => void runProcess(proc.name, "start")} icon={<Play size={12} />}>
                            Start
                          </ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                      Brak danych PM2
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Pamięć według serwisu</h2>
              <p className="mt-1 text-sm text-gray-500">
                Posortowane od największych. Filmy i muzyka można kasować. Aplikacja www i baza — tylko podgląd.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadStorage()}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white"
            >
              {loadingStorage ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Przelicz
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loadingStorage && buckets.length === 0 && (
              <div className="flex items-center gap-3 rounded-[28px] border border-white/5 bg-[#0a0a0a] px-6 py-10 text-gray-500">
                <Loader2 className="animate-spin" size={18} /> Zliczam katalogi na dysku…
              </div>
            )}
            {buckets.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void loadFiles(item.id, "")}
                className={`rounded-[28px] border bg-[#0a0a0a] p-6 text-left transition-all ${
                  activeBucket === item.id ? "border-cyan-400/40" : "border-white/5 hover:border-white/15"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400/80">{item.service}</p>
                    <h3 className="mt-1 text-lg font-black">{item.label}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black tabular-nums">{formatBytes(item.bytes)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {item.deletable ? "Można czyścić" : "Chronione"}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${item.deletable ? "bg-cyan-400" : "bg-white/30"}`}
                    style={{ width: `${Math.max(3, (item.bytes / maxBucket) * 100)}%` }}
                  />
                </div>
                {!item.exists && <p className="mt-3 text-xs text-gray-500">Katalog nie istnieje na tym hoście.</p>}
              </button>
            ))}
          </div>
        </section>

        <AnimatePresence>
          {activeBucket && bucket && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-10 overflow-hidden rounded-[32px] border border-white/10 bg-[#080808]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Przeglądarka plików</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
                    <button type="button" className="font-semibold hover:text-cyan-400" onClick={() => void loadFiles(bucket.id, "")}>
                      {bucket.label}
                    </button>
                    {crumbs.map((c) => (
                      <span key={c.path} className="inline-flex items-center gap-1 text-gray-500">
                        <ChevronRight size={12} />
                        <button type="button" className="hover:text-white" onClick={() => void loadFiles(bucket.id, c.path)}>
                          {c.name}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bucket.deletable && selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white"
                    >
                      <Trash2 size={13} /> Usuń ({selected.size})
                    </button>
                  )}
                  {!bucket.deletable && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      <Shield size={12} /> Tylko podgląd
                    </span>
                  )}
                </div>
              </div>

              {listing ? (
                <div className="flex items-center gap-3 px-6 py-12 text-gray-500">
                  <Loader2 className="animate-spin" size={16} /> Wczytuję zawartość…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <tr className="border-b border-white/5">
                        <th className="w-10 px-4 py-3">
                          {bucket.deletable && (
                            <input type="checkbox" checked={selected.size > 0 && selected.size === entries.filter((e) => e.deletable).length} onChange={toggleAll} />
                          )}
                        </th>
                        <th className="px-3 py-3">Nazwa</th>
                        <th className="px-3 py-3">Rozmiar</th>
                        <th className="px-3 py-3">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.relativePath} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                          <td className="px-4 py-3">
                            {entry.deletable && (
                              <input
                                type="checkbox"
                                checked={selected.has(entry.relativePath)}
                                onChange={() => toggle(entry.relativePath)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-left"
                              onClick={() => {
                                if (entry.isDir) void loadFiles(bucket.id, entry.relativePath);
                              }}
                            >
                              {entry.isDir ? <Folder size={15} className="text-cyan-400" /> : <File size={15} className="text-gray-500" />}
                              <span className={entry.isDir ? "font-semibold" : ""}>{entry.name}</span>
                            </button>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-gray-400">{formatBytes(entry.bytes)}</td>
                          <td className="px-3 py-3 text-gray-500">
                            {entry.mtimeMs ? new Date(entry.mtimeMs).toLocaleString("pl-PL") : "—"}
                          </td>
                        </tr>
                      ))}
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                            Pusty katalog
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111] p-6">
            <h3 className="text-xl font-black">Usunąć zaznaczone?</h3>
            <p className="mt-3 text-sm text-gray-400">
              {selected.size} pozycji · ok. {formatBytes(selectedBytes)}. Tej operacji nie cofniesz.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-full px-4 py-2 text-sm text-gray-400" onClick={() => setConfirmDelete(false)}>
                Anuluj
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runDelete()}
                className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Kasuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  percent,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  percent: number;
  tone: HealthLevel;
}) {
  const bar = tone === "critical" ? "bg-red-500" : tone === "warning" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="rounded-[28px] border border-white/5 bg-[#0a0a0a] p-6">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
        {icon} {label}
      </div>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

function StatusDot({ up, label }: { up: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-emerald-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-white/25 hover:text-white disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}
