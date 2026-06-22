"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Sparkles, ShoppingBag, CheckCircle2 } from "lucide-react";
import { PAKIET_PLUS_PRICE_LABEL } from "@/lib/publicationConstants";
import EosModal from "@/components/ui/EosModal";

export type PublicationRedemption =
  | { kind: "FREE_FIRST"; bonusCouponId: string }
  | { kind: "PLUS_CREDIT"; consumePlusPublication: true }
  | { kind: "PLUS_PAID"; iapTransactionId?: string };

export type PublicationCouponOption = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  pillLabel?: string;
  meta?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  coupons: PublicationCouponOption[];
  hasPlusCredit: boolean;
  plusCredits: number;
  onConfirm: (result: { action: "publish"; redemption: PublicationRedemption } | { action: "buy_plus" } | { action: "cancel" }) => void;
};

type Selection = `coupon:${string}` | "plus_credit" | "buy_plus";

export default function PublicationChoiceModal({
  isOpen,
  onClose,
  title,
  subtitle,
  coupons,
  hasPlusCredit,
  plusCredits,
  onConfirm,
}: Props) {
  const defaultSelection = useMemo((): Selection => {
    if (coupons.length > 0) return `coupon:${coupons[0].id}`;
    if (hasPlusCredit) return "plus_credit";
    return "buy_plus";
  }, [coupons, hasPlusCredit]);

  const [selection, setSelection] = useState<Selection>(defaultSelection);

  useEffect(() => {
    if (isOpen) setSelection(defaultSelection);
  }, [isOpen, defaultSelection]);

  const handlePublish = () => {
    if (selection.startsWith("coupon:")) {
      const id = selection.replace("coupon:", "");
      onConfirm({ action: "publish", redemption: { kind: "FREE_FIRST", bonusCouponId: id } });
      return;
    }
    if (selection === "plus_credit") {
      onConfirm({ action: "publish", redemption: { kind: "PLUS_CREDIT", consumePlusPublication: true } });
      return;
    }
    onConfirm({ action: "buy_plus" });
  };

  return (
    <EosModal
      open={isOpen}
      onClose={() => onConfirm({ action: "cancel" })}
      title={title}
      subtitle={subtitle}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onConfirm({ action: "cancel" })}
            className="flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] py-3 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)]"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handlePublish}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_12px_28px_rgba(16,185,129,0.28)] hover:bg-emerald-500"
          >
            <CheckCircle2 size={16} />
            {selection === "buy_plus" ? "Przejdź do płatności" : "Opublikuj"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {coupons.length > 0 && (
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Kupony bonusowe</p>
            <div className="space-y-2">
              {coupons.map((c) => {
                const sel = selection === `coupon:${c.id}`;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelection(`coupon:${c.id}`)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                      sel
                        ? "border-blue-500/45 bg-blue-500/10 shadow-[0_8px_24px_rgba(59,130,246,0.12)]"
                        : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-[var(--eos-accent)]/25"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                      <Gift size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--eos-text)]">{c.title}</p>
                      <p className="text-xs text-[var(--eos-muted)]">{c.subtitle}</p>
                      {c.pillLabel ? (
                        <span className="mt-1 inline-block rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                          {c.pillLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className={`h-4 w-4 rounded-full border-2 ${sel ? "border-blue-500 bg-blue-500" : "border-[var(--eos-border)]"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Pakiet Plus</p>
          {hasPlusCredit ? (
            <button
              type="button"
              onClick={() => setSelection("plus_credit")}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                selection === "plus_credit"
                  ? "border-emerald-500/45 bg-emerald-500/10 shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
                  : "border-[var(--eos-border)] bg-[var(--eos-input)]"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <Sparkles size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--eos-text)]">Użyj kredytu Plus</p>
                <p className="text-xs text-[var(--eos-muted)]">
                  {plusCredits} publikacja do wykorzystania · 30 dni na rynku
                </p>
              </div>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setSelection("buy_plus")}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
              selection === "buy_plus"
                ? "border-emerald-500/45 bg-emerald-500/10 shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
                : "border-[var(--eos-border)] bg-[var(--eos-input)]"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <ShoppingBag size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--eos-text)]">Kup Pakiet Plus</p>
              <p className="text-xs text-[var(--eos-muted)]">1 dodatkowa publikacja · {PAKIET_PLUS_PRICE_LABEL} · 30 dni</p>
            </div>
          </button>
        </div>
      </div>
    </EosModal>
  );
}
