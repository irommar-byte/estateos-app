"use client";

import { useEffect, useState } from "react";
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

export default function ServerMemoryTile() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState(false);

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
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const level = error ? "critical" : status?.level || "ok";
  const pill =
    level === "critical"
      ? { label: "Krytycznie", className: "bg-red-500/15 text-red-400 border-red-500/30" }
      : level === "warning"
        ? { label: "Uwaga", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
        : { label: "Stabilnie", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };

  const diskPct = status?.disk.percent ?? 0;
  const barColor = level === "critical" ? "bg-red-500" : level === "warning" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div
      onClick={() => {
        window.location.href = "/centrala/pamiec-i-serwer";
      }}
      className="group relative cursor-pointer overflow-hidden rounded-[40px] border border-white/5 bg-[#0a0a0a] p-10 shadow-xl transition-all hover:border-white/20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between gap-3">
          <HardDrive size={32} className="text-gray-400 transition-colors duration-500 group-hover:text-white" />
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${pill.className}`}>
            {status || error ? pill.label : "…"}
          </span>
        </div>
        <h3 className="mb-3 text-2xl font-black">Pamięć i serwer</h3>
        {!status && !error ? (
          <p className="mb-8 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Odczytuję stan…
          </p>
        ) : error ? (
          <p className="mb-8 text-sm leading-relaxed text-red-400">Nie udało się odczytać stanu serwera.</p>
        ) : (
          <div className="mb-8 space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <span>Dysk</span>
                <span className="text-gray-300">
                  {formatGb(status!.disk.freeBytes)} wolne · {Math.round(diskPct)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, diskPct)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">CPU</p>
                <p className="mt-0.5 text-lg font-black tabular-nums">{Math.round(status!.cpu.percent)}%</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">RAM</p>
                <p className="mt-0.5 text-lg font-black tabular-nums">{Math.round(status!.memory.percent)}%</p>
              </div>
            </div>
            {!status!.database.up && (
              <p className="text-xs font-semibold text-red-400">MariaDB nie odpowiada — oferty mogą nie działać.</p>
            )}
          </div>
        )}
        <div className="flex translate-x-[-10px] items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          Wejdź <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
