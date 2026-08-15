"use client";

import { useEffect, useRef, useState } from "react";
import { HardDrive, ArrowRight, Loader2 } from "lucide-react";

type ServerStatus = {
  level: "ok" | "warning" | "critical";
  cpu: { percent: number };
  memory: { percent: number };
  disk: { percent: number; freeBytes: number; totalBytes: number };
  database: { up: boolean };
};

function formatGb(bytes: number) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 10) return `${gb.toFixed(0)} GB`;
  return `${gb.toFixed(1)} GB`;
}

function useSmooth(value: number, speed = 0.12) {
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
      if (Math.abs(target.current - current.current) < 0.05) current.current = target.current;
      setShown(current.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return shown;
}

export default function ServerMemoryTile() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState(false);
  const diskSmooth = useSmooth(status?.disk.percent ?? 0);
  const cpuSmooth = useSmooth(status?.cpu.percent ?? 0);
  const ramSmooth = useSmooth(status?.memory.percent ?? 0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/server/status", { cache: "no-store", credentials: "include" });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error("fail");
        if (!cancelled) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const level = error ? "critical" : status?.level || "ok";
  const pill =
    level === "critical"
      ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
      : level === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25";
  const bar =
    level === "critical" ? "bg-red-500" : level === "warning" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div
      onClick={() => {
        window.location.href = "/centrala/pamiec-i-serwer";
      }}
      className="group relative cursor-pointer overflow-hidden rounded-[40px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-10 shadow-[var(--eos-shadow-soft)] transition-all hover:border-[var(--eos-border-strong)] hover:shadow-[var(--eos-shadow-lift)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-3">
          <HardDrive size={32} className="text-[var(--eos-muted)] transition-colors duration-500 group-hover:text-[var(--eos-text)]" />
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${pill}`}>
            {status || error ? (level === "critical" ? "Krytycznie" : level === "warning" ? "Uwaga" : "Stabilnie") : "…"}
          </span>
        </div>
        <h3 className="mb-3 text-2xl font-black text-[var(--eos-text)]">Pamięć i serwer</h3>
        {!status && !error ? (
          <p className="mb-8 flex items-center gap-2 text-sm text-[var(--eos-muted)]">
            <Loader2 size={14} className="animate-spin" /> Odczytuję stan…
          </p>
        ) : error ? (
          <p className="mb-8 text-sm leading-relaxed text-red-600 dark:text-red-400">Nie udało się odczytać stanu serwera.</p>
        ) : (
          <div className="mb-8 space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--eos-subtle)]">
                <span>Dysk</span>
                <span className="text-[var(--eos-text)]">
                  {formatGb(status!.disk.freeBytes)} wolne · {Math.round(diskSmooth)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--eos-input)]">
                <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${bar}`} style={{ width: `${Math.min(100, diskSmooth)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">CPU</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-[var(--eos-text)]">{Math.round(cpuSmooth)}%</p>
              </div>
              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">RAM</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-[var(--eos-text)]">{Math.round(ramSmooth)}%</p>
              </div>
            </div>
            {!status!.database.up && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">MariaDB nie odpowiada — oferty mogą nie działać.</p>
            )}
          </div>
        )}
        <div className="flex translate-x-[-10px] items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-accent)] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          Wejdź <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
