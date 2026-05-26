"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ticket, ShoppingBag, Sparkles, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { PAKIET_PLUS_PRICE_LABEL, PUBLICATION_DURATION_DAYS } from "@/lib/publicationConstants";

type WalletCoupon = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  pillLabel?: string;
  meta?: string;
};

type WalletData = {
  plusCredits: number;
  plusExpiresAt: string | null;
  hasPlusCredit: boolean;
  coupons: WalletCoupon[];
  couponCount: number;
};

type Props = {
  onBuyPlus?: () => void;
  buyingPlus?: boolean;
};

export default function PublicationWalletPanel({ onBuyPlus, buyingPlus }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [couponIndex, setCouponIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
        setCouponIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const coupons = wallet?.coupons ?? [];
  const activeCoupon = coupons[couponIndex];

  const expiryLabel =
    wallet?.plusExpiresAt && wallet.hasPlusCredit
      ? new Date(wallet.plusExpiresAt).toLocaleDateString("pl-PL")
      : null;

  return (
    <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Kupony */}
      <div className="rounded-[2rem] border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <Ticket className="text-orange-400" size={20} />
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Kupony bonusowe</h3>
            <p className="text-[10px] text-white/40 mt-1">
              {loading ? "…" : `${wallet?.couponCount ?? 0} aktywnych kuponów`}
            </p>
          </div>
        </div>

        {coupons.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-6 text-center text-xs text-white/35">
            Brak aktywnych kuponów. Kupon powitalny pojawi się po rejestracji, jeśli nie został jeszcze wykorzystany.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <Gift size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{activeCoupon?.title}</p>
                    {activeCoupon?.pillLabel && (
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-300">
                        {activeCoupon.pillLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/50">{activeCoupon?.subtitle}</p>
                  {activeCoupon?.meta && (
                    <p className="mt-2 text-[10px] font-medium text-emerald-400/80">{activeCoupon.meta}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-emerald-500/10 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                Publikacja
              </div>
            </div>
            {coupons.length > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCouponIndex((i) => (i === 0 ? coupons.length - 1 : i - 1))}
                  className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[10px] font-bold text-white/40">
                  {couponIndex + 1} / {coupons.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCouponIndex((i) => (i + 1) % coupons.length)}
                  className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pakiet Plus */}
      <div className="rounded-[2rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 shadow-xl">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Pakiet Plus</p>
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <span className="text-2xl font-black text-emerald-400 tabular-nums">
              {wallet?.hasPlusCredit ? wallet.plusCredits : 0}
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70">Plus</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-400">
              {wallet?.hasPlusCredit
                ? `${wallet.plusCredits} publikacja Plus do wykorzystania`
                : "Brak aktywnego kredytu Plus"}
            </p>
            {expiryLabel && (
              <p className="mt-1 text-xs text-white/45">Ważne do {expiryLabel}</p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Pakiet Plus ({PAKIET_PLUS_PRICE_LABEL}) opłaca jedną publikację na {PUBLICATION_DURATION_DAYS} dni na
              szerokim rynku. Nie jest to abonament ani „slot”.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={buyingPlus}
          onClick={onBuyPlus}
          className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-left transition-all hover:border-emerald-400/50 hover:bg-emerald-500/15 disabled:opacity-60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <ShoppingBag size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Kup Pakiet Plus</p>
            <p className="text-xs text-white/45">
              Opłać 1 dodatkowe wystawienie ({PAKIET_PLUS_PRICE_LABEL}) — kredyt pojawi się na koncie po płatności
            </p>
          </div>
          <Sparkles size={18} className="text-emerald-400" />
        </button>
      </div>
    </div>
  );
}
