"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, Minus, Plus, Ticket, Wallet } from "lucide-react";
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
  onSnapshotChange,
}: {
  userId: number;
  initialSnapshot?: WalletSnapshot;
  compact?: boolean;
  onSnapshotChange?: (snapshot: WalletSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(initialSnapshot ?? null);
  const [timeline, setTimeline] = useState<WalletTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
      if (data.snapshot) onSnapshotChange?.(data.snapshot);
    } catch {
      setError("Błąd sieci przy pobieraniu portfela.");
    } finally {
      setLoading(false);
    }
  }, [userId, onSnapshotChange]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const adjustCredits = async (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      setActionMsg("Podaj dodatnią liczbę całkowitą.");
      return;
    }
    const delta = sign * n;
    const label =
      sign > 0
        ? `Dodać ${n} kredyt(ów) PLUS temu użytkownikowi?`
        : `Odebrać ${n} kredyt(ów) PLUS temu użytkownikowi?`;
    if (!confirm(label)) return;

    setBusy(true);
    setActionMsg(null);
    try {
      const body: Record<string, unknown> = {
        delta,
        reason: reason.trim() || (sign > 0 ? "Nadanie kredytów przez admina" : "Odjęcie kredytów przez admina"),
      };
      if (sign > 0) {
        const days = Math.floor(Number(extendDays));
        if (Number.isFinite(days) && days > 0) body.setExpiresDays = days;
      }
      const res = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setActionMsg(data?.error || "Nie udało się zmienić kredytów.");
        return;
      }
      if (data.snapshot) {
        setSnapshot(data.snapshot);
        onSnapshotChange?.(data.snapshot);
      }
      if (Array.isArray(data.timeline)) setTimeline(data.timeline);
      setActionMsg(
        data.unchanged
          ? data.message || "Bez zmian."
          : `Saldo: ${data.previous} → ${data.next} (${data.applied > 0 ? "+" : ""}${data.applied})`,
      );
      setReason("");
    } catch {
      setActionMsg("Błąd sieci przy zmianie kredytów.");
    } finally {
      setBusy(false);
    }
  };

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

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
          Korekta kredytów PLUS
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
            Liczba
            <input
              type="number"
              min={1}
              max={500}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2.5 py-2 text-sm font-semibold outline-none focus:border-emerald-500/45"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)] sm:col-span-2">
            Powód (opcjonalnie)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="np. rekompensata / korekta błędu"
              className="mt-1 w-full rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2.5 py-2 text-sm outline-none focus:border-emerald-500/45"
            />
          </label>
        </div>
        <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-[var(--eos-subtle)]">
          Przy dodaniu — ważność (dni)
          <input
            type="number"
            min={1}
            max={730}
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            className="mt-1 w-full max-w-[8rem] rounded-lg border border-[var(--eos-border)] bg-[var(--eos-card)] px-2.5 py-2 text-sm outline-none focus:border-emerald-500/45"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void adjustCredits(1)}
            className="eos-btn eos-btn--home eos-btn--sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Dodaj
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void adjustCredits(-1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-600 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-400"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Minus size={14} />}
            Odbierz
          </button>
        </div>
        {actionMsg ? <p className="mt-2 text-[11px] font-semibold text-[var(--eos-muted)]">{actionMsg}</p> : null}
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
