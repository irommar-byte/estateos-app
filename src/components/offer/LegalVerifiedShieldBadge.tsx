"use client";

import EstateOS3DVerifiedShield from "@/components/offer/EstateOS3DVerifiedShield";

type Props = {
  label?: string;
  compact?: boolean;
};

/** Kompaktowy znaczek KW na stronie oferty — oparty o tarczę 3D EstateOS. */
export default function LegalVerifiedShieldBadge({
  label = "zweryfikowane",
  compact = false,
}: Props) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      }`}
    >
      <EstateOS3DVerifiedShield
        size={compact ? "xs" : "sm"}
        showLabel={false}
        tilt={false}
      />
      <span
        className={`font-black lowercase tracking-wide text-emerald-300/95 ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
