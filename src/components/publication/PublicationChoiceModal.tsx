"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Gift, Sparkles, ShoppingBag, CheckCircle2 } from "lucide-react";
import { PAKIET_PLUS_PRICE_LABEL } from "@/lib/publicationConstants";

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

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onConfirm({ action: "cancel" });
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onConfirm]);

  if (!isOpen) return null;

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/80 p-4 backdrop-blur-xl sm:items-center"
        onClick={() => onConfirm({ action: "cancel" })}
      >
        <motion.div
          initial={{ y: 40, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 40, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-2xl"
        >
          <div className="flex items-start justify-between border-b border-white/5 p-6">
            <div>
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{subtitle}</p>
            </div>
            <button type="button" onClick={() => onConfirm({ action: "cancel" })} className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-6 space-y-6">
            {coupons.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Kupony bonusowe</p>
                <div className="space-y-2">
                  {coupons.map((c) => {
                    const sel = selection === `coupon:${c.id}`;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelection(`coupon:${c.id}`)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${sel ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                          <Gift size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white">{c.title}</p>
                          <p className="text-xs text-white/45">{c.subtitle}</p>
                          {c.pillLabel && (
                            <span className="mt-1 inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-300">
                              {c.pillLabel}
                            </span>
                          )}
                        </div>
                        <div className={`h-4 w-4 rounded-full border-2 ${sel ? "border-blue-400 bg-blue-400" : "border-white/30"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Pakiet Plus</p>
              {hasPlusCredit && (
                <button
                  type="button"
                  onClick={() => setSelection("plus_credit")}
                  className={`mb-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${selection === "plus_credit" ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Użyj kredytu Plus</p>
                    <p className="text-xs text-white/45">
                      {plusCredits} publikacja do wykorzystania · 30 dni na rynku
                    </p>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelection("buy_plus")}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${selection === "buy_plus" ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <ShoppingBag size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">Kup Pakiet Plus</p>
                  <p className="text-xs text-white/45">1 dodatkowa publikacja · {PAKIET_PLUS_PRICE_LABEL} · 30 dni</p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex gap-3 border-t border-white/5 p-6">
            <button
              type="button"
              onClick={() => onConfirm({ action: "cancel" })}
              className="flex-1 rounded-xl border border-white/10 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white/5"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handlePublish}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              {selection === "buy_plus" ? "Przejdź do płatności" : "Opublikuj"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
