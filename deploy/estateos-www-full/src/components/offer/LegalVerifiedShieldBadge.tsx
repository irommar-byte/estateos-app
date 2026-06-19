"use client";

import { ShieldCheck } from "lucide-react";
import EstateOS3DVerifiedShield from "@/components/offer/EstateOS3DVerifiedShield";

const DEFAULT_SUBLABEL = "EstateOS™ Quality Shield";

type Props = {
  label?: string;
  sublabel?: string;
  /** bar = pasek oferty; card = kafel na zdjęciu */
  variant?: "bar" | "card";
  /** true = zielony znaczek KW; false = szary, bez połysku */
  active?: boolean;
  className?: string;
};

/** Znaczek weryfikacji KW — tarcza + „Zweryfikowany” + sublabel EstateOS™ Quality Shield. */
export default function LegalVerifiedShieldBadge({
  label,
  sublabel = DEFAULT_SUBLABEL,
  variant = "bar",
  active = true,
  className = "",
}: Props) {
  const displayLabel = String(label || (active ? "BEZPIECZNA NIERUCHOMOŚĆ" : "Niezweryfikowany"));
  const isCard = variant === "card";

  const shellClass = active
    ? isCard
      ? "border-emerald-400/35 bg-black/55 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      : "border-emerald-500/30 bg-emerald-500/[0.08]"
    : isCard
      ? "border-white/12 bg-black/45 backdrop-blur-xl"
      : "border-white/12 bg-white/[0.04]";

  const titleClass = active
    ? isCard
      ? "text-[9px] font-black uppercase tracking-[0.14em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
      : "text-[9px] font-black uppercase tracking-[0.14em] text-emerald-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] sm:text-[10px]"
    : isCard
      ? "text-[10px] font-semibold tracking-tight text-zinc-300"
      : "text-[10px] font-semibold tracking-tight text-zinc-400";

  const subClass = active
    ? isCard
      ? "text-[7px] font-medium tracking-[0.08em] text-emerald-300/80"
      : "text-[7px] font-medium tracking-[0.1em] text-emerald-400/75 sm:text-[8px]"
    : "text-[7px] font-medium tracking-[0.1em] text-zinc-500 sm:text-[8px]";

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2.5 rounded-2xl border px-2.5 py-1.5 overflow-visible ${shellClass} ${className}`}
      aria-label={`${displayLabel} — ${sublabel}`}
    >
      {active ? (
        <div className="-my-1 shrink-0">
          <EstateOS3DVerifiedShield
            size={isCard ? "sm" : "sm"}
            showLabel={false}
            tilt
            active
          />
        </div>
      ) : (
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] ${
            isCard ? "h-8 w-8" : "h-8 w-8"
          }`}
        >
          <ShieldCheck size={14} className="text-zinc-500" strokeWidth={2.2} />
        </div>
      )}
      <div className="min-w-0 flex flex-col leading-tight">
        <span className={titleClass}>{displayLabel}</span>
        <span className={`mt-0.5 ${subClass}`}>{sublabel}</span>
      </div>
    </div>
  );
}
