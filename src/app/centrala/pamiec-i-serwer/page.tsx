"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Car,
  ChevronRight,
  Cpu,
  Database,
  Film,
  Folder,
  File,
  HardDrive,
  Home,
  Loader2,
  MemoryStick,
  Music2,
  Play,
  RefreshCw,
  RotateCw,
  Shield,
  Sparkles,
  Square,
  Trash2,
  Download,
  Pencil,
  FilePenLine,
  AlertTriangle,
} from "lucide-react";

type HealthLevel = "ok" | "warning" | "critical";

type HistoryPoint = { at: number; cpu: number; ram: number; disk: number };

type StatusPayload = {
  level: HealthLevel;
  cpu: { percent: number; cores: number; load1: number };
  memory: { usedBytes: number; totalBytes: number; freeBytes: number; percent: number };
  disk: { usedBytes: number; totalBytes: number; freeBytes: number; percent: number };
  database: { name: string; status: string; up: boolean };
  host: string;
  uptimeSec: number;
  history?: HistoryPoint[];
};

type Area = {
  id: string;
  label: string;
  root: string;
  deletable: boolean;
  exists: boolean;
  bytes: number;
};

type Category = {
  id: string;
  label: string;
  description: string;
  accent: string;
  bytes: number;
  percentOfUsed: number;
  deletable: boolean;
  areas: Area[];
};

type FileEntry = {
  name: string;
  relativePath: string;
  isDir: boolean;
  bytes: number;
  mtimeMs: number | null;
  deletable: boolean;
  downloadable?: boolean;
  editableText?: boolean;
  renamable?: boolean;
};

type ProcessRow = {
  name: string;
  status: string;
  cpu: number;
  memoryBytes: number;
  uptimeMs: number;
};

type LargeFile = {
  path: string;
  areaId: string;
  categoryId: string;
  name: string;
  bytes: number;
  deletable: boolean;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  movies: <Film size={20} />,
  music: <Music2 size={20} />,
  realestate: <Home size={20} />,
  cars: <Car size={20} />,
  system: <HardDrive size={20} />,
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

function useSmooth(value: number, speed = 0.1) {
  const [shown, setShown] = useState(value);
  const target = useRef(value);
  const current = useRef(value);
  useEffect(() => {
    target.current = value;
  }, [value]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      current.current += (target.current - current.current) * speed;
      if (Math.abs(target.current - current.current) < 0.04) current.current = target.current;
      setShown(current.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return shown;
}

function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const w = 160;
  const h = 44;
  if (points.length < 2) {
    return <div className="h-11 w-40 rounded-xl bg-[var(--eos-input)]" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  );
}

export default function ServerMemoryPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountedBytes, setAccountedBytes] = useState(0);
  const [otherBytes, setOtherBytes] = useState(0);
  const [largestFiles, setLargestFiles] = useState<LargeFile[]>([]);
  const [safeCleanup, setSafeCleanup] = useState({ count: 0, bytes: 0 });
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [mariadb, setMariadb] = useState<{ up: boolean; status: string } | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [cwd, setCwd] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listing, setListing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLarge, setSelectedLarge] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editTarget, setEditTarget] = useState<FileEntry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const diskSmooth = useSmooth(status?.disk.percent ?? 0);
  const cpuSmooth = useSmooth(status?.cpu.percent ?? 0);
  const ramSmooth = useSmooth(status?.memory.percent ?? 0);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/server/status", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Status");
    setStatus(data);
    if (Array.isArray(data.history)) setHistory(data.history);
  }, []);

  const loadStorage = useCallback(async () => {
    setLoadingStorage(true);
    const res = await fetch("/api/admin/server/storage", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Pamięć");
    setCategories(data.categories || []);
    setAccountedBytes(data.accountedBytes || 0);
    setOtherBytes(data.otherBytes || 0);
    setLargestFiles(data.largestFiles || []);
    setSafeCleanup(data.safeCleanup || { count: 0, bytes: 0 });
    setLoadingStorage(false);
  }, []);

  const loadProcesses = useCallback(async () => {
    const res = await fetch("/api/admin/server/processes", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Procesy");
    setProcesses(data.processes || []);
    setMariadb(data.mariadb || null);
  }, []);

  const loadFiles = useCallback(async (areaId: string, path = "") => {
    setListing(true);
    setSelected(new Set());
    try {
      const qs = new URLSearchParams({ area: areaId, path, sizes: "1" });
      const res = await fetch(`/api/admin/server/files?${qs}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pliki");
      setEntries(data.entries || []);
      setCwd(path);
      setActiveArea(areaId);
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
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadStatus, loadProcesses, loadStorage]);

  const category = categories.find((c) => c.id === activeCategory) || null;
  const area = category?.areas.find((a) => a.id === activeArea) || null;
  const crumbs = useMemo(() => {
    if (!cwd) return [];
    const parts = cwd.split("/").filter(Boolean);
    return parts.map((part, i) => ({ name: part, path: parts.slice(0, i + 1).join("/") }));
  }, [cwd]);

  const selectedEntries = entries.filter((e) => selected.has(e.relativePath));
  const selectedBytes = selectedEntries.reduce((sum, e) => sum + (e.bytes || 0), 0);
  const diskTotal = status?.disk.totalBytes || 1;

  const openCategory = (id: string) => {
    setActiveCategory(id);
    const cat = categories.find((c) => c.id === id);
    const first = cat?.areas.find((a) => a.exists) || cat?.areas[0];
    if (first) void loadFiles(first.id, "");
  };

  const runDelete = async () => {
    if (!activeArea || selected.size === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/server/files", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: activeArea, paths: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Usuwanie nie powiodło się.");
      setConfirmDelete(false);
      setNotice(`Usunięto ${data.deleted?.length || 0} pozycji.`);
      await loadFiles(activeArea, cwd);
      await loadStorage();
      await loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd usuwania.");
    } finally {
      setBusy(false);
    }
  };

  const runDeleteLarge = async () => {
    if (selectedLarge.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/server/files", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ absolutePaths: [...selectedLarge] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Usuwanie nie powiodło się.");
      setSelectedLarge(new Set());
      setNotice(`Usunięto ${data.deleted?.length || 0} dużych plików.`);
      await loadStorage();
      await loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd usuwania.");
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/server/cleanup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Oczyszczanie nie powiodło się.");
      setConfirmCleanup(false);
      setNotice(`Bezpieczne oczyszczanie: usunięto ${data.deleted?.length || 0} pozycji · ~${formatBytes(data.freedEstimate || 0)}.`);
      await loadStorage();
      await loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd oczyszczania.");
    } finally {
      setBusy(false);
    }
  };

  const runProcess = async (name: string, action: string) => {
    setBusy(true);
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
      await new Promise((r) => setTimeout(r, 800));
      await loadProcesses();
      await loadStatus();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd procesu.");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = (entry: FileEntry) => {
    if (!activeArea || entry.isDir) return;
    const qs = new URLSearchParams({ area: activeArea, path: entry.relativePath });
    window.open(`/api/admin/server/files/download?${qs.toString()}`, "_blank", "noopener,noreferrer");
  };

  const downloadSelected = () => {
    if (!activeArea) return;
    const files = entries.filter((e) => selected.has(e.relativePath) && e.downloadable && !e.isDir);
    if (files.length === 0) {
      setNotice("Zaznacz pliki do pobrania (nie foldery).");
      return;
    }
    files.forEach((file, index) => {
      window.setTimeout(() => downloadFile(file), index * 350);
    });
    setNotice(`Pobieranie ${files.length} plików…`);
  };

  const openRename = (entry: FileEntry) => {
    setRenameTarget(entry);
    setRenameValue(entry.name);
  };

  const submitRename = async () => {
    if (!activeArea || !renameTarget) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/server/files", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: activeArea,
          path: renameTarget.relativePath,
          action: "rename",
          newName: renameValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Zmiana nazwy nie powiodła się.");
      setRenameTarget(null);
      setNotice(`Zmieniono nazwę na „${data.name}”.`);
      await loadFiles(activeArea, cwd);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd zmiany nazwy.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (entry: FileEntry) => {
    if (!activeArea) return;
    setEditTarget(entry);
    setEditLoading(true);
    setEditContent("");
    try {
      const qs = new URLSearchParams({ area: activeArea, path: entry.relativePath, mode: "content" });
      const res = await fetch(`/api/admin/server/files?${qs}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nie udało się wczytać pliku.");
      setEditContent(String(data.content || ""));
    } catch (err) {
      setEditTarget(null);
      setNotice(err instanceof Error ? err.message : "Błąd odczytu.");
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!activeArea || !editTarget) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/server/files", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: activeArea,
          path: editTarget.relativePath,
          action: "save",
          content: editContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Zapis nie powiódł się.");
      setEditTarget(null);
      setNotice(`Zapisano „${editTarget.name}” (${formatBytes(data.bytes || 0)}).`);
      await loadFiles(activeArea, cwd);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd zapisu.");
    } finally {
      setBusy(false);
    }
  };

  const level = status?.level || "ok";
  const levelMeta =
    level === "critical"
      ? { text: "Krytycznie", cls: "text-red-700 bg-red-500/12 border-red-500/25 dark:text-red-300" }
      : level === "warning"
        ? { text: "Uwaga", cls: "text-amber-800 bg-amber-500/12 border-amber-500/25 dark:text-amber-300" }
        : { text: "Stabilnie", cls: "text-emerald-800 bg-emerald-500/12 border-emerald-500/25 dark:text-emerald-300" };

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] px-4 pb-28 pt-32 text-[var(--eos-text)] sm:px-6 md:px-12 md:pt-36">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/centrala"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          <ArrowLeft size={14} /> Powrót do centrali
        </Link>

        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[var(--eos-accent)]">
              Centrala · NAS
            </p>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">Pamięć i serwer</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
              Jeden dysk VPS. Filmy, muzyka, nieruchomości i samochody — osobno, czytelnie, z bezpiecznym czyszczeniem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest ${levelMeta.cls}`}>
              {levelMeta.text}
            </span>
            <button
              type="button"
              disabled={busy || safeCleanup.count === 0}
              onClick={() => setConfirmCleanup(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--eos-accent)] px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-[var(--eos-shadow-soft)] disabled:opacity-40"
            >
              <Sparkles size={14} /> Bezpieczne oczyszczanie
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={18} /> {error}
          </div>
        )}
        {notice && (
          <div className="mb-6 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-5 py-3 text-sm text-[var(--eos-muted)] shadow-[var(--eos-shadow-soft)]">
            {notice}
          </div>
        )}

        {/* Live vitals */}
        <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <VitalCard
            icon={<HardDrive size={16} />}
            label="Dysk"
            value={`${Math.round(diskSmooth)}%`}
            detail={status ? `${formatBytes(status.disk.freeBytes)} wolne z ${formatBytes(status.disk.totalBytes)}` : "—"}
            percent={diskSmooth}
            tone={level}
            spark={<Sparkline points={history.map((h) => h.disk)} color="#06b6d4" />}
          />
          <VitalCard
            icon={<Cpu size={16} />}
            label="Procesor"
            value={`${Math.round(cpuSmooth)}%`}
            detail={status ? `${status.cpu.cores} rdzeni · load ${status.cpu.load1}` : "—"}
            percent={cpuSmooth}
            tone={cpuSmooth >= 90 ? "critical" : cpuSmooth >= 75 ? "warning" : "ok"}
            spark={<Sparkline points={history.map((h) => h.cpu)} color="#8b5cf6" />}
          />
          <VitalCard
            icon={<MemoryStick size={16} />}
            label="Pamięć RAM"
            value={`${Math.round(ramSmooth)}%`}
            detail={status ? `${formatBytes(status.memory.usedBytes)} / ${formatBytes(status.memory.totalBytes)}` : "—"}
            percent={ramSmooth}
            tone={ramSmooth >= 92 ? "warning" : "ok"}
            spark={<Sparkline points={history.map((h) => h.ram)} color="#10b981" />}
          />
        </section>

        {/* Disk composition */}
        <section className="mb-10 overflow-hidden rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 shadow-[var(--eos-shadow-soft)] md:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Skład dysku</h2>
              <p className="mt-1 text-sm text-[var(--eos-muted)]">
                Zmapowane {formatBytes(accountedBytes)}
                {otherBytes > 0 ? ` · pozostałe systemowe ${formatBytes(otherBytes)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadStorage()}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            >
              {loadingStorage ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Przelicz
            </button>
          </div>

          <div className="mb-6 flex h-4 overflow-hidden rounded-full bg-[var(--eos-input)]">
            {categories.map((cat) => (
              <div
                key={cat.id}
                title={`${cat.label}: ${formatBytes(cat.bytes)}`}
                style={{
                  width: `${Math.max(cat.bytes > 0 ? 1.5 : 0, (cat.bytes / diskTotal) * 100)}%`,
                  background: cat.accent,
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => openCategory(cat.id)}
                className={`rounded-[28px] border p-5 text-left transition-all ${
                  activeCategory === cat.id
                    ? "border-[var(--eos-border-strong)] bg-[var(--eos-input)] shadow-[var(--eos-shadow-soft)]"
                    : "border-[var(--eos-border)] bg-[var(--eos-bg)] hover:border-[var(--eos-border-strong)]"
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ background: `${cat.accent}18`, color: cat.accent }}
                  >
                    {CATEGORY_ICONS[cat.id] || <HardDrive size={20} />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                    {cat.deletable ? "Można czyścić" : "Chronione"}
                  </span>
                </div>
                <h3 className="text-lg font-black">{cat.label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{cat.description}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-2xl font-black tabular-nums">{formatBytes(cat.bytes)}</p>
                  <p className="text-xs font-semibold text-[var(--eos-subtle)]">{cat.percentOfUsed}% zmapowanych</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--eos-input)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.min(100, (cat.bytes / diskTotal) * 100)}%`, background: cat.accent }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Safe cleanup + largest */}
        <section className="mb-10 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 shadow-[var(--eos-shadow-soft)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-lg font-black">Bezpieczne oczyszczanie</h2>
                <p className="text-xs text-[var(--eos-muted)]">Tylko .part, .tmp, cache — bez filmów i ofert</p>
              </div>
            </div>
            <p className="mb-5 text-3xl font-black tabular-nums">{formatBytes(safeCleanup.bytes)}</p>
            <p className="mb-5 text-sm text-[var(--eos-muted)]">{safeCleanup.count} pozycji gotowych do bezpiecznego usunięcia.</p>
            <button
              type="button"
              disabled={busy || safeCleanup.count === 0}
              onClick={() => setConfirmCleanup(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[var(--eos-text)] disabled:opacity-40"
            >
              Uruchom oczyszczanie
            </button>
          </div>

          <div className="rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 shadow-[var(--eos-shadow-soft)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Największe pliki</h2>
                <p className="text-xs text-[var(--eos-muted)]">Sugestie do ręcznego usunięcia</p>
              </div>
              {selectedLarge.size > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      [...selectedLarge].forEach((p, i) => {
                        window.setTimeout(() => {
                          const qs = new URLSearchParams({ absolute: p });
                          window.open(`/api/admin/server/files/download?${qs}`, "_blank", "noopener,noreferrer");
                        }, i * 350);
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-text)]"
                  >
                    <Download size={12} /> Pobierz
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runDeleteLarge()}
                    className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                  >
                    <Trash2 size={12} /> Usuń ({selectedLarge.size})
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {largestFiles.map((file) => (
                <label
                  key={file.path}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedLarge.has(file.path)}
                    onChange={() => {
                      setSelectedLarge((prev) => {
                        const next = new Set(prev);
                        if (next.has(file.path)) next.delete(file.path);
                        else next.add(file.path);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <p className="truncate text-[11px] text-[var(--eos-subtle)]">
                      {file.categoryId} · {file.path.replace(/^\/home\/[^/]+\//, "~/")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums">{formatBytes(file.bytes)}</span>
                </label>
              ))}
              {largestFiles.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--eos-muted)]">Brak dużych plików do sugestii.</p>
              )}
            </div>
          </div>
        </section>

        {/* File browser */}
        <AnimatePresence>
          {category && area && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 overflow-hidden rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-soft)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eos-border)] px-6 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Przeglądarka</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-black">{category.label}</span>
                    <span className="text-[var(--eos-subtle)]">/</span>
                    <div className="flex flex-wrap gap-1">
                      {category.areas.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => void loadFiles(a.id, "")}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            activeArea === a.id
                              ? "bg-[var(--eos-text)] text-[var(--eos-contrast)]"
                              : "bg-[var(--eos-input)] text-[var(--eos-muted)]"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-[var(--eos-muted)]">
                    <button type="button" className="font-semibold hover:text-[var(--eos-text)]" onClick={() => void loadFiles(area.id, "")}>
                      {area.label}
                    </button>
                    {crumbs.map((c) => (
                      <span key={c.path} className="inline-flex items-center gap-1">
                        <ChevronRight size={12} />
                        <button type="button" className="hover:text-[var(--eos-text)]" onClick={() => void loadFiles(area.id, c.path)}>
                          {c.name}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={downloadSelected}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-[var(--eos-text)]"
                    >
                      <Download size={13} /> Pobierz ({selected.size})
                    </button>
                  )}
                  {area.deletable && selected.size > 0 ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white"
                    >
                      <Trash2 size={13} /> Usuń ({selected.size}) · {formatBytes(selectedBytes)}
                    </button>
                  ) : !area.deletable ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                      <Shield size={12} /> Podgląd + pobieranie
                    </span>
                  ) : null}
                </div>
              </div>

              {listing ? (
                <div className="flex items-center gap-3 px-6 py-12 text-[var(--eos-muted)]">
                  <Loader2 className="animate-spin" size={16} /> Wczytuję zawartość…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                      <tr className="border-b border-[var(--eos-border)]">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={
                              selected.size > 0 &&
                              selected.size === entries.filter((e) => e.deletable || e.downloadable).length
                            }
                            onChange={() => {
                              const selectable = entries.filter((e) => e.deletable || e.downloadable);
                              if (selected.size === selectable.length) setSelected(new Set());
                              else setSelected(new Set(selectable.map((e) => e.relativePath)));
                            }}
                          />
                        </th>
                        <th className="px-3 py-3">Nazwa</th>
                        <th className="px-3 py-3">Rozmiar</th>
                        <th className="px-3 py-3">Data</th>
                        <th className="px-3 py-3 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.relativePath} className="border-b border-[var(--eos-border)] last:border-0 hover:bg-[var(--eos-input)]">
                          <td className="px-4 py-3">
                            {(entry.deletable || entry.downloadable) && (
                              <input
                                type="checkbox"
                                checked={selected.has(entry.relativePath)}
                                onChange={() => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(entry.relativePath)) next.delete(entry.relativePath);
                                    else next.add(entry.relativePath);
                                    return next;
                                  });
                                }}
                              />
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-left"
                              onClick={() => {
                                if (entry.isDir) void loadFiles(area.id, entry.relativePath);
                              }}
                            >
                              {entry.isDir ? (
                                <Folder size={15} className="text-[var(--eos-accent)]" />
                              ) : (
                                <File size={15} className="text-[var(--eos-subtle)]" />
                              )}
                              <span className={entry.isDir ? "font-semibold text-[var(--eos-text)]" : "text-[var(--eos-text)]"}>
                                {entry.name}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-[var(--eos-muted)]">{formatBytes(entry.bytes)}</td>
                          <td className="px-3 py-3 text-[var(--eos-subtle)]">
                            {entry.mtimeMs ? new Date(entry.mtimeMs).toLocaleString("pl-PL") : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {entry.downloadable && (
                                <button
                                  type="button"
                                  title="Pobierz"
                                  onClick={() => downloadFile(entry)}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                                >
                                  <Download size={11} /> Pobierz
                                </button>
                              )}
                              {entry.renamable && (
                                <button
                                  type="button"
                                  title="Zmień nazwę"
                                  onClick={() => openRename(entry)}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                                >
                                  <Pencil size={11} /> Nazwa
                                </button>
                              )}
                              {entry.editableText && (
                                <button
                                  type="button"
                                  title="Edytuj treść"
                                  onClick={() => void openEdit(entry)}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                                >
                                  <FilePenLine size={11} /> Edytuj
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-[var(--eos-muted)]">
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

        {/* Processes */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">Procesy serwera</h2>
            <button
              type="button"
              onClick={() => void loadProcesses()}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            >
              <RefreshCw size={12} /> Odśwież
            </button>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-[var(--eos-shadow-soft)]">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                <tr className="border-b border-[var(--eos-border)]">
                  <th className="px-5 py-3">Usługa</th>
                  <th className="px-5 py-3">Stan</th>
                  <th className="px-5 py-3">CPU</th>
                  <th className="px-5 py-3">RAM</th>
                  <th className="px-5 py-3">Czas</th>
                  <th className="px-5 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--eos-border)]">
                  <td className="px-5 py-4 font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <Database size={14} className="text-amber-600 dark:text-amber-400" /> MariaDB
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusDot up={mariadb?.up === true} label={mariadb?.status || "?"} />
                  </td>
                  <td className="px-5 py-4 text-[var(--eos-subtle)]">—</td>
                  <td className="px-5 py-4 text-[var(--eos-subtle)]">—</td>
                  <td className="px-5 py-4 text-[var(--eos-subtle)]">baza ofert</td>
                  <td className="px-5 py-4 text-right">
                    {!mariadb?.up && (
                      <ActionBtn disabled={busy} onClick={() => void runProcess("mariadb", "start")} icon={<Play size={12} />}>
                        Start
                      </ActionBtn>
                    )}
                  </td>
                </tr>
                {processes.map((proc) => (
                  <tr key={proc.name} className="border-b border-[var(--eos-border)] last:border-0">
                    <td className="px-5 py-4 font-semibold">{proc.name}</td>
                    <td className="px-5 py-4">
                      <StatusDot up={proc.status === "online"} label={proc.status} />
                    </td>
                    <td className="px-5 py-4 tabular-nums">{Math.round(proc.cpu)}%</td>
                    <td className="px-5 py-4 tabular-nums">{formatBytes(proc.memoryBytes)}</td>
                    <td className="px-5 py-4 text-[var(--eos-muted)]">{formatUptime(proc.uptimeMs)}</td>
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
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {confirmDelete && (
        <Modal
          title="Usunąć zaznaczone?"
          body={`${selected.size} pozycji · ok. ${formatBytes(selectedBytes)}. Tej operacji nie cofniesz.`}
          confirmLabel="Kasuj"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void runDelete()}
          danger
        />
      )}
      {confirmCleanup && (
        <Modal
          title="Bezpieczne oczyszczanie"
          body={`Usunie tylko pliki tymczasowe i niedokończone pobrania (~${formatBytes(safeCleanup.bytes)}). Filmy, muzyka i oferty zostaną nietknięte.`}
          confirmLabel="Oczyść"
          busy={busy}
          onCancel={() => setConfirmCleanup(false)}
          onConfirm={() => void runCleanup()}
        />
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 text-[var(--eos-text)] shadow-[var(--eos-shadow-strong)]">
            <h3 className="text-xl font-black">Zmień nazwę</h3>
            <p className="mt-2 text-sm text-[var(--eos-muted)]">Aktualnie: {renameTarget.name}</p>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-3 text-sm text-[var(--eos-text)] outline-none focus:border-[var(--eos-accent)]"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-full px-4 py-2 text-sm text-[var(--eos-muted)]" onClick={() => setRenameTarget(null)}>
                Anuluj
              </button>
              <button
                type="button"
                disabled={busy || !renameValue.trim()}
                onClick={() => void submitRename()}
                className="rounded-full bg-[var(--eos-accent)] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : "Zapisz nazwę"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] text-[var(--eos-text)] shadow-[var(--eos-shadow-strong)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--eos-border)] px-5 py-4">
              <div>
                <h3 className="text-lg font-black">Edycja · {editTarget.name}</h3>
                <p className="text-xs text-[var(--eos-muted)]">Pliki tekstowe do 1,5 MB</p>
              </div>
              <button type="button" className="text-sm text-[var(--eos-muted)]" onClick={() => setEditTarget(null)}>
                Zamknij
              </button>
            </div>
            {editLoading ? (
              <div className="flex items-center gap-2 px-5 py-10 text-[var(--eos-muted)]">
                <Loader2 className="animate-spin" size={16} /> Wczytuję…
              </div>
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
                className="min-h-[50vh] flex-1 resize-y bg-[var(--eos-bg)] px-5 py-4 font-mono text-xs leading-relaxed text-[var(--eos-text)] outline-none"
              />
            )}
            <div className="flex justify-end gap-3 border-t border-[var(--eos-border)] px-5 py-4">
              <button type="button" className="rounded-full px-4 py-2 text-sm text-[var(--eos-muted)]" onClick={() => setEditTarget(null)}>
                Anuluj
              </button>
              <button
                type="button"
                disabled={busy || editLoading}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--eos-accent)] px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <FilePenLine size={14} />}
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VitalCard({
  icon,
  label,
  value,
  detail,
  percent,
  tone,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  percent: number;
  tone: HealthLevel;
  spark: React.ReactNode;
}) {
  const bar = tone === "critical" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 shadow-[var(--eos-shadow-soft)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
          {icon} {label}
        </div>
        {spark}
      </div>
      <p className="text-3xl font-black tabular-nums text-[var(--eos-text)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--eos-muted)]">{detail}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--eos-input)]">
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${bar}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

function StatusDot({ up, label }: { up: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-emerald-500" : "bg-red-500"}`} />
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
      className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:border-[var(--eos-border-strong)] hover:text-[var(--eos-text)] disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

function Modal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
  danger,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-6 text-[var(--eos-text)] shadow-[var(--eos-shadow-strong)]">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-full px-4 py-2 text-sm text-[var(--eos-muted)]" onClick={onCancel}>
            Anuluj
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white ${
              danger ? "bg-red-500" : "bg-[var(--eos-accent)]"
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
