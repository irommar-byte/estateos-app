"use client";
import { useLocale } from "@/contexts/LocaleContext";
import { getAdminCentralDictionary } from "@/i18n/adminCentralDictionary";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Loader2, Search, Ticket, Wallet } from "lucide-react";
import type { WalletSnapshot } from "@/lib/walletLedger";
import AdminWalletSection from "@/components/admin/AdminWalletSection";

type WalletRow = {
  id: number;
  email: string;
  name: string | null;
  planType: string | null;
  isPro: boolean;
  proExpiresAt: string | null;
  wallet: WalletSnapshot;
};

export default function AdminWalletPage() {
  const { locale } = useLocale();
  const ad = getAdminCentralDictionary(locale);
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [totals, setTotals] = useState({ credits: 0, activeCoupons: 0, usedCoupons: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/admin/wallet", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setRows(data.rows || []);
        setTotals(data.totals || { credits: 0, activeCoupons: 0, usedCoupons: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWallet();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qId = Number(q);
    return rows.filter((row) => {
      if (!q) return true;
      if (Number.isFinite(qId) && qId > 0 && row.id === qId) return true;
      return (
        String(row.id).includes(q) ||
        String(row.email || "").toLowerCase().includes(q) ||
        String(row.name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] px-4 pb-16 pt-32 text-[var(--eos-text)] sm:px-6 md:px-12 md:pt-36">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/centrala"
          className="mb-8 inline-block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          ← Powrót do centrali
        </Link>

        <header className="mb-10 border-b border-[var(--eos-border)] pb-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
            Centrala · portfel
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Kredyty i kupony
            <span className="mt-1 block text-lg font-normal text-[var(--eos-muted)] md:text-xl">
              Bieżące salda i pełna historia nadawania oraz wykorzystania
            </span>
          </h1>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Coins size={12} />
                Aktywne kredyty PLUS
              </p>
              <p className="text-3xl font-black tabular-nums">{totals.credits}</p>
            </div>
            <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                <Ticket size={12} />
                Aktywne kupony
              </p>
              <p className="text-3xl font-black tabular-nums">{totals.activeCoupons}</p>
            </div>
            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Zużyte kupony (łącznie)</p>
              <p className="text-3xl font-black tabular-nums">{totals.usedCoupons}</p>
            </div>
          </div>

          <div className="group relative mt-8 w-full lg:max-w-md">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--eos-subtle)] transition-colors group-focus-within:text-emerald-500"
              size={18}
            />
            <input
              type="search"
              placeholder="Szukaj: ID, e-mail, imię…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-[var(--eos-muted)] focus:border-emerald-500/50"
            />
          </div>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-2">
            {loading ? (
              <div className="flex items-center gap-3 py-16 text-[var(--eos-muted)]">
                <Loader2 className="animate-spin text-emerald-500" size={20} />
                <span className="text-sm font-medium">Wczytywanie portfeli…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-12 text-center text-sm text-[var(--eos-muted)]">
                Brak wyników dla podanego filtra.
              </div>
            ) : (
              filtered.map((row) => {
                const active = selectedId === row.id;
                return (
                  <motion.button
                    type="button"
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedId(row.id)}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all md:p-5 ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                        : "border-[var(--eos-border)] bg-[var(--eos-card)] hover:border-[var(--eos-border-strong)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-bold">{row.name || "Bez nazwy"}</span>
                        <span className="rounded-md bg-[var(--eos-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--eos-subtle)]">
                          #{row.id}
                        </span>
                        {row.isPro ? (
                          <span className="rounded-md border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                            PRO
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-[var(--eos-muted)]">{row.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-right">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Kredyty</p>
                        <p className="text-sm font-black tabular-nums">{row.wallet.credits}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Kupony</p>
                        <p className="text-sm font-black tabular-nums">{row.wallet.activeCoupons}</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {selected ? (
              <motion.aside
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="w-full shrink-0 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-xl lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:w-[480px] lg:overflow-y-auto lg:p-7"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                      <Wallet size={12} className="text-emerald-500" />
                      Portfel użytkownika
                    </p>
                    <h2 className="mt-1 text-lg font-black">{selected.name || selected.email}</h2>
                    <p className="text-xs text-[var(--eos-muted)]">ID {selected.id}</p>
                  </div>
                  <Link
                    href={`/centrala/uzytkownicy`}
                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Profil →
                  </Link>
                </div>
                <AdminWalletSection userId={selected.id} initialSnapshot={selected.wallet} />
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
