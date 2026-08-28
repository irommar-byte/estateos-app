"use client";

import { Lock, CreditCard, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import EosModal from "@/components/ui/EosModal";

export default function LimitModal({
  isOpen,
  onClose,
  onPay,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPay: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    await onPay();
    setLoading(false);
  };

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-md"
      hideHeader
      hideBodyPadding
    >
      <div className="relative overflow-hidden bg-[#0a0a0a] p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-white/30 transition-colors hover:text-white"
        >
          <X size={20} />
        </button>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <Lock size={28} className="text-emerald-500" />
        </div>

        <h3 className="mb-2 text-center text-2xl font-black tracking-tight text-white">Osiągnąłeś Limit</h3>
        <p className="mb-8 text-center text-sm leading-relaxed text-white/50">
          Twój darmowy plan pozwala na posiadanie 1 aktywnego ogłoszenia. Nie trać swojej pracy – odblokuj ten slot
          i wystaw ofertę natychmiast.
        </p>

        <div className="mb-8 rounded-2xl border border-white/5 bg-[#111] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold text-white/80">Dodatkowe Ogłoszenie</span>
            <span className="text-xl font-black text-emerald-500">
              29 PLN <span className="text-[10px] uppercase tracking-widest text-white/30">/ m-c</span>
            </span>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-2 text-xs text-white/60">
              <CheckCircle2 size={14} className="text-emerald-500" /> Zwiększa limit konta o 1
            </li>
            <li className="flex items-center gap-2 text-xs text-white/60">
              <CheckCircle2 size={14} className="text-emerald-500" /> Oferta widoczna od razu na mapie
            </li>
            <li className="flex items-center gap-2 text-xs text-white/60">
              <CheckCircle2 size={14} className="text-emerald-500" /> Anuluj subskrypcję w każdej chwili
            </li>
          </ul>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-widest text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? (
            "Przetwarzanie..."
          ) : (
            <>
              <CreditCard size={18} /> Zapłać 29 PLN i Opublikuj
            </>
          )}
        </button>
      </div>
    </EosModal>
  );
}
