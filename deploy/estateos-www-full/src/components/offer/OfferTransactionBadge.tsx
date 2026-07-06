"use client";

import { normalizeTransactionType } from "@/lib/transactionType";
import { useLocale } from "@/contexts/LocaleContext";

export default function OfferTransactionBadge({
  transactionType,
  className = "",
  size = "md",
}: {
  transactionType?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const { dict } = useLocale();
  const tx = normalizeTransactionType(transactionType);
  const isRent = tx === "rent";
  const label = isRent ? dict.map.forRent : dict.map.forSale;

  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[8px] tracking-[0.12em]"
      : "px-2.5 py-1 text-[9px] tracking-widest";

  return (
    <span
      className={`pointer-events-none inline-flex items-center rounded-full border font-black uppercase backdrop-blur-md ${sizeClass} ${
        isRent
          ? "border-sky-400/55 bg-sky-500/95 text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]"
          : "border-emerald-400/55 bg-emerald-500/95 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]"
      } ${className}`}
    >
      {label}
    </span>
  );
}
