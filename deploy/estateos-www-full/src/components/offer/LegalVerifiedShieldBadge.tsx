"use client";

import { ShieldCheck } from "lucide-react";

type Props = {
  label?: string;
  compact?: boolean;
  /** true = zielony znaczek KW; false = szary, bez połysku */
  active?: boolean;
};

export default function LegalVerifiedShieldBadge({
  label,
  compact = false,
  active = true,
}: Props) {
  const displayLabel = String(
    label || (active ? "ZWERYFIKOWANE" : "NIEZWERYFIKOWANE"),
  ).toUpperCase();

  if (!active) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] ${
          compact ? "px-2.5 py-1" : "px-3 py-1.5"
        }`}
        aria-label={displayLabel}
      >
        <ShieldCheck
          size={compact ? 13 : 15}
          className="shrink-0 text-zinc-500"
          strokeWidth={2.2}
        />
        <span
          className={`font-semibold uppercase tracking-[0.12em] text-zinc-400 ${
            compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]"
          }`}
        >
          {displayLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 ${
        compact ? "px-2.5 py-1" : "px-3 py-1.5"
      }`}
      aria-label={displayLabel}
    >
      <ShieldCheck
        size={compact ? 13 : 15}
        className="shrink-0 text-emerald-400"
        strokeWidth={2.2}
      />
      <span
        className={`font-semibold uppercase tracking-[0.12em] text-emerald-300/95 ${
          compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]"
        }`}
      >
        {displayLabel}
      </span>
    </div>
  );
}
