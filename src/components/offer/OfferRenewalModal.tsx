"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, X } from "lucide-react";
import PublicationWalletPanel from "@/components/profile/PublicationWalletPanel";
import type { PublicationCouponOption } from "@/components/publication/PublicationChoiceModal";
import {
  defaultPublicationSelection,
  publicationSelectionLabel,
  publicationSelectionToRedemption,
  type PublicationSelection,
} from "@/lib/publicationSelection";
import { PUBLICATION_RENEWAL_PRICE_LABEL } from "@/lib/publicationConstants";

type Props = {
  offerId: string | null;
  offerTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onRenewed: () => void;
  locale?: "pl" | "en";
};

export default function OfferRenewalModal({
  offerId,
  offerTitle,
  isOpen,
  onClose,
  onRenewed,
  locale = "pl",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<PublicationSelection | null>(null);
  const [wallet, setWallet] = useState<{
    coupons: PublicationCouponOption[];
    plusCredits: number;
    hasPlusCredit: boolean;
    plusExpiresAt: string | null;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/publication-wallet?locale=pl", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || data?.message || "Nie udało się załadować portfela."));
      }
      const coupons = Array.isArray(data.publicationCoupons)
        ? data.publicationCoupons
        : Array.isArray(data.coupons)
          ? data.coupons
          : [];
      const hasPlusCredit = Boolean(data.hasPlusCredit);
      setWallet({
        coupons,
        plusCredits: Number(data.plusCredits || 0),
        hasPlusCredit,
        plusExpiresAt: data.plusExpiresAt ? String(data.plusExpiresAt) : null,
      });
      setSelection((prev) =>
        prev ??
        defaultPublicationSelection(
          { couponIds: coupons.map((c: PublicationCouponOption) => c.id), hasPlusCredit },
          "renew",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania portfela.");
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadWallet();
  }, [isOpen, loadWallet]);

  useEffect(() => {
    if (!isOpen) {
      setSelection(null);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose, submitting]);

  const handleConfirm = async () => {
    if (!offerId || !selection || submitting) return;
    setSubmitting(true);
    setError(null);

    const resolved = publicationSelectionToRedemption(selection);

    try {
      if ("action" in resolved) {
        if (resolved.action === "pay_renewal") {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              returnUrl: `${window.location.origin}/moje-konto/crm?tab=my_offers&renewalOfferId=${offerId}`,
              cancelUrl: `${window.location.origin}/moje-konto/crm?tab=my_offers`,
              plan: "renewal",
              offerId,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body?.url) {
            throw new Error(String(body?.error || "Nie udało się uruchomić płatności."));
          }
          window.location.href = String(body.url);
          return;
        }

        if (resolved.action === "buy_plus") {
          const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: "pakiet_plus",
              returnUrl: `${window.location.origin}/moje-konto/crm?tab=my_offers&renewalOfferId=${offerId}&plus=success`,
              cancelUrl: `${window.location.origin}/moje-konto/crm?tab=my_offers`,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body?.url) {
            throw new Error(String(body?.error || "Nie udało się uruchomić płatności Pakiet Plus."));
          }
          window.location.href = String(body.url);
          return;
        }
      }

      const res = await fetch(`/api/offers/${offerId}/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication: resolved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error || data?.errorCode) {
        throw new Error(String(data?.message || data?.error || "Nie udało się odnowić oferty."));
      }

      onClose();
      onRenewed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd odnowienia oferty.");
      setSubmitting(false);
    }
  };

  if (!mounted || !isOpen || !offerId) return null;

  const confirmLabel =
    selection && publicationSelectionLabel(selection, locale) === "Opłać odnowienie"
      ? `Opłać odnowienie · ${PUBLICATION_RENEWAL_PRICE_LABEL}`
      : selection
        ? publicationSelectionLabel(selection, locale)
        : "Wybierz metodę";

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] overflow-y-auto overscroll-contain bg-black/75 backdrop-blur-xl"
        onClick={() => !submitting && onClose()}
      >
        <div
          className="flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => !submitting && onClose()}
        >
          <motion.div
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[min(92dvh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
          >
            <div className="relative shrink-0 overflow-hidden border-b border-white/5 p-6">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400/90">
                    Odnowienie oferty
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">Wróć na rynek na 30 dni</h3>
                  {offerTitle ? (
                    <p className="mt-2 truncate text-sm text-white/50">{offerTitle}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="shrink-0 rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                  aria-label="Zamknij"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/50">
                  <Loader2 className="mb-3 animate-spin text-emerald-400" size={28} />
                  <p className="text-xs font-bold uppercase tracking-widest">Ładowanie portfela…</p>
                </div>
              ) : wallet ? (
                <PublicationWalletPanel
                  selectable
                  variant="renew"
                  selection={selection ?? undefined}
                  onSelectionChange={setSelection}
                  walletOverride={{
                    coupons: wallet.coupons,
                    plusCredits: wallet.plusCredits,
                    hasPlusCredit: wallet.hasPlusCredit,
                    plusExpiresAt: wallet.plusExpiresAt,
                  }}
                />
              ) : null}

              {error ? (
                <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-xs text-red-200/90">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 flex gap-3 border-t border-white/5 p-6">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-white/10 py-3.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5 disabled:opacity-40"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting || loading || !selection}
                className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {submitting ? "Przetwarzam…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
