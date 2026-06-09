"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DoorOpen, Sparkles } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getDictionary } from "@/i18n/dictionaries";
import ProOpenHouseManageModal from "@/components/crm/ProOpenHouseManageModal";

type OfferRow = { id: number; title: string; city?: string; district?: string };

type Props = {
  activeOffers: OfferRow[];
  onChanged?: () => void;
};

export default function OpenHouseProCard({ activeOffers, onChanged }: Props) {
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setPanelOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#1a1508] via-[#0a0a0a] to-[#050505] p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(212,175,55,0.15)]"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#D4AF37]/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
            <DoorOpen size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#D4AF37]/90">
              Ekskluzywne narzędzie Pro
            </p>
            <h3 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white/95">
              Dzień otwartych drzwi
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Zaplanuj terminy wizyt i rezerwacje gości przy swojej ofercie.
            </p>
          </div>
          <Sparkles size={16} className="shrink-0 text-emerald-500/80 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </motion.button>

      <ProOpenHouseManageModal
        isOpen={panelOpen}
        copy={copy}
        activeOffers={activeOffers}
        onClose={() => setPanelOpen(false)}
        onChanged={() => {
          onChanged?.();
        }}
      />
    </>
  );
}
