"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, Ticket, Wallet } from "lucide-react";
import type { WalletSnapshot, WalletTimelineEntry } from "@/lib/walletLedger";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pl-PL");
}

function directionLabel(direction: WalletTimelineEntry["direction"]) {
  return direction === "GRANT" ? "Nadanie" : "Wykorzystanie";
}

function directionClass(direction: WalletTimelineEntry["direction"]) {
  return direction === "GRANT"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function assetLabel(assetType: string) {
  if (assetType === "CREDIT") return "Kredyt PLUS";
  if (assetType === "COUPON" || assetType === "FREE_FIRST") return "Kupon";
  if (assetType === "IAP_PAKIET_PLUS") return "IAP Pakiet PLUS";
  if (assetType === "IAP_INVESTOR_PRO") return "IAP Investor Pro";
  return assetType;
}

export default function AdminWalletSection({
  userId,
  initialSnapshot,
  compact = false,
}: {
  userId: number;
  initialSnapshot?: WalletSnapshot;
  compact?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(initialSnapshot ?? null);
  const [timeline, setTimeline] = useState<WalletTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallet`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error || "Nie udało się pobrać portfela.");
        return;
      }
      setSnapshot(data.snapshot);
      setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
    } catch {
      setError("Błąd sieci przy pobieraniu portfela.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  if (loading && !snapshot) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--eos-muted)]">
        <Loader2 size={16} className="animate-spin text-emerald-500" />
        Wczytywanie kredytów i kuponów…
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="px-4 py-4 text-sm text-red-500">
        {error}
        <button type="button" onClick={() => void loadWallet()} className="ml-2 underline">
          Ponów
        </button>
      </div>
    );
  }

  const snap = snapshot ?? {
    credits: 0,
    plusExpiresAt: null,
    creditsActive: false,
    activeCoupons: 0,
    usedCoupons: 0,
    totalCoupons: 0,
    firstFreeUsed: false,
  };

  return (
    <div className={compact ? "" : "space-y-4"}>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5">
          <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            <Coins size={10} className="text-amber-500" />
            Kredyty PLUS
          </p>
          <p className="mt-1 text-xl font-black tabular-nums">{snap.credits}</p>
          <p className="text-[10px] text-[var(--eos-muted)]">
            {snap.creditsActive ? `ważne do ${formatDate(snap.plusExpiresAt)}` : "brak aktywnych"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5">
          <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            <Ticket size={10} className="text-sky-500" />
            Kupony aktywne
          </p>
          <p className="mt-1 text-xl font-black tabular-nums">{snap.activeCoupons}</p>
          <p className="text-[10px] text-[var(--eos-muted)]">łącznie {snap.totalCoupons}</p>
        </div>
        {!compact ? (
          <>
            <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Zużyte kupony</p>
              <p className="mt-1 text-xl font-black tabular-nums">{snap.usedCoupons}</p>
            </div>
            <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">Kupon powitalny</p>
              <p className="mt-1 text-sm font-bold">{snap.firstFreeUsed ? "Wykorzystany" : "Dostępny"}</p>
            </div>
          </>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            <Wallet size={11} />
            Historia ({timeline.length})
          </p>
          <button
            type="button"
            onClick={() => void loadWallet()}
            disabled={loading}
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)] hover:text-emerald-500 disabled:opacity-50"
          >
            {loading ? "…" : "Odśwież"}
          </button>
        </div>

        {timeline.length === 0 ? (
          <p className="px-1 text-xs text-[var(--eos-muted)]">Brak zdarzeń w historii portfela.</p>
        ) : (
          <ul className={`custom-scrollbar space-y-2 overflow-y-auto pr-1 ${compact ? "max-h-56" : "max-h-72"}`}>
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--eos-text)]">{entry.label}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--eos-muted)]">
                      {formatDate(entry.occurredAt)}
                      {entry.referenceId ? ` · ref ${entry.referenceType || "?"}:${entry.referenceId}` : ""}
                      {entry.source === "reconstructed" ? " · rekonstrukcja" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${directionClass(entry.direction)}`}>
                      {directionLabel(entry.direction)}
                    </span>
                    <span className="rounded-full border border-[var(--eos-border)] px-2 py-0.5 text-[9px] font-bold text-[var(--eos-subtle)]">
                      {assetLabel(entry.assetType)}
                    </span>
                    {entry.balanceAfter != null && entry.assetType === "CREDIT" ? (
                      <span className="font-mono text-[10px] text-[var(--eos-muted)]">saldo {entry.balanceAfter}</span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
