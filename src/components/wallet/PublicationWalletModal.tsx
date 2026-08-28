"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, ShoppingBag, Sparkles, Ticket, X } from "lucide-react";
import { PAKIET_PLUS_PRICE_LABEL, PUBLICATION_DURATION_DAYS } from "@/lib/publicationConstants";
import { eosBtn } from "@/components/ui/eosButtonStyles";

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
  isOpen: boolean;
  onClose: () => void;
  onWalletChange?: () => void;
};

export default function PublicationWalletModal({ isOpen, onClose }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyingPlus, setBuyingPlus] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (!opts?.silent) setWallet(null);
        setLoadError(String(data?.error || data?.message || "Nie udało się załadować portfela."));
        return;
      }
      setWallet({
        plusCredits: Number(data.plusCredits || 0),
        plusExpiresAt: data.plusExpiresAt ? String(data.plusExpiresAt) : null,
        hasPlusCredit: Boolean(data.hasPlusCredit),
        coupons: Array.isArray(data.coupons) ? data.coupons : [],
        couponCount: Number(data.couponCount || 0),
      });
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose]);

  const startPakietPlusCheckout = async () => {
    setBuyingPlus(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?plus=success`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}?plus=cancel`;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: "pakiet_plus", returnUrl, cancelUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        throw new Error(String(body?.error || "Nie udało się uruchomić płatności Pakiet Plus."));
      }
      window.location.href = String(body.url);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Błąd płatności.");
      setBuyingPlus(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const coupons = wallet?.coupons ?? [];
  const plusCredits = Number(wallet?.plusCredits || 0);
  const hasPlusCredit = Boolean(wallet?.hasPlusCredit);
  const expiryLabel =
    wallet?.plusExpiresAt && hasPlusCredit
      ? new Date(wallet.plusExpiresAt).toLocaleDateString("pl-PL")
      : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 eos-z-modal overflow-y-auto overscroll-contain"
        onClick={onClose}
      >
        <div className="eos-modal-backdrop absolute inset-0" />
        <div
          className="relative flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={onClose}
        >
        <motion.div
          initial={{ y: 24, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 24, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className="eos-themed-modal flex max-h-[min(90dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)]"
        >
          <div className="relative shrink-0 overflow-hidden border-b border-[var(--eos-border)] p-6">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600">Portfel EOS</p>
                <h3 className="mt-1 text-xl font-black text-[var(--eos-text)]">Twoje kredyty publikacji</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
                  {loading
                    ? "Ładowanie salda…"
                    : `${plusCredits} kredytów Plus · ${coupons.length} ${coupons.length === 1 ? "kupon" : "kupony"} bonusowe`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
                aria-label="Zamknij"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {loadError ? (
              <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-xs text-red-700">{loadError}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Kredyty Plus</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-emerald-700">{loading ? "…" : plusCredits}</p>
                {expiryLabel ? <p className="mt-1 text-[10px] text-[var(--eos-muted)]">Ważne do {expiryLabel}</p> : null}
              </div>
              <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-700">Kupony</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-orange-700">{loading ? "…" : coupons.length}</p>
                <p className="mt-1 text-[10px] text-[var(--eos-muted)]">{PUBLICATION_DURATION_DAYS} dni / publikacja</p>
              </div>
            </div>

            {coupons.length > 0 ? (
              <div>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">
                  <Ticket size={14} /> Kupony bonusowe
                </p>
                <div className="space-y-2">
                  {coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
                        <Gift size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-[var(--eos-text)]">{coupon.title}</p>
                          {coupon.pillLabel ? (
                            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-700">
                              {coupon.pillLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--eos-muted)]">{coupon.subtitle}</p>
                        {coupon.meta ? <p className="mt-1 text-[10px] font-medium text-emerald-600">{coupon.meta}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-center text-xs text-[var(--eos-muted)]">
                Brak aktywnych kuponów bonusowych.
              </p>
            )}

            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                <Sparkles size={14} /> Pakiet Plus
              </p>
              {hasPlusCredit ? (
                <div className="mb-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-sm font-bold text-[var(--eos-text)]">Aktywny kredyt Plus</p>
                  <p className="mt-1 text-xs text-[var(--eos-muted)]">
                    {plusCredits} publikacja do wykorzystania · {PUBLICATION_DURATION_DAYS} dni na rynku
                    {expiryLabel ? ` · ważne do ${expiryLabel}` : ""}
                  </p>
                </div>
              ) : (
                <p className="mb-2 rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-xs text-[var(--eos-muted)]">
                  Brak aktywnego kredytu Plus — możesz dokupić poniżej.
                </p>
              )}
              <button
                type="button"
                disabled={buyingPlus}
                onClick={() => void startPakietPlusCheckout()}
                className={eosBtn("home", { block: true, size: "lg", className: "justify-start gap-3 !normal-case !tracking-normal" })}
              >
                <ShoppingBag size={18} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold">Kup Pakiet Plus</span>
                  <span className="mt-0.5 block text-[11px] font-semibold opacity-80">
                    1 dodatkowa publikacja · {PAKIET_PLUS_PRICE_LABEL} · {PUBLICATION_DURATION_DAYS} dni
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--eos-border)] p-6">
            <button type="button" onClick={onClose} className={eosBtn("secondary", { block: true })}>
              Zamknij
            </button>
          </div>
        </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
