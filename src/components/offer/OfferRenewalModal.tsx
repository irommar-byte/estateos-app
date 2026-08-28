"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import PublicationWalletPanel from "@/components/profile/PublicationWalletPanel";
import type { PublicationCouponOption } from "@/components/publication/PublicationChoiceModal";
import {
  defaultPublicationSelection,
  publicationSelectionLabel,
  publicationSelectionToRedemption,
  type PublicationSelection,
} from "@/lib/publicationSelection";
import { PUBLICATION_RENEWAL_PRICE_LABEL } from "@/lib/publicationConstants";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import EosModal from "@/components/ui/EosModal";

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

  if (!offerId) return null;

  const confirmLabel =
    selection && publicationSelectionLabel(selection, locale) === "Opłać odnowienie"
      ? `Opłać odnowienie · ${PUBLICATION_RENEWAL_PRICE_LABEL}`
      : selection
        ? publicationSelectionLabel(selection, locale)
        : "Wybierz metodę";

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <EosModal
      open={isOpen}
      onClose={handleClose}
      variant="centered"
      maxWidth="max-w-xl"
      hideHeader
      hideBodyPadding
      closeOnBackdrop={!submitting}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className={eosBtn("secondary", { className: "flex-1" })}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || loading || !selection}
            className={eosBtn("home", { className: "flex-[1.4]" })}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {submitting ? "Przetwarzam…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="relative shrink-0 overflow-hidden border-b border-[var(--eos-border)] p-6">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-600">
              Odnowienie oferty
            </p>
            <h3 className="mt-1 text-xl font-black text-[var(--eos-text)]">Wróć na rynek na 30 dni</h3>
            {offerTitle ? (
              <p className="mt-2 truncate text-sm text-[var(--eos-muted)]">{offerTitle}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--eos-muted)]">
            <Loader2 className="mb-3 animate-spin text-emerald-500" size={28} />
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
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </EosModal>
  );
}
