"use client";

import { isOfferNew } from "@/lib/offerNewBadge";
import { useLocale } from "@/contexts/LocaleContext";

export default function OfferNewBadge({
  createdAt,
  className = "",
  size = "md",
}: {
  createdAt?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const { dict } = useLocale();
  if (!isOfferNew(createdAt)) return null;

  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[8px] tracking-[0.14em]"
      : "px-2.5 py-1 text-[9px] tracking-widest";

  return (
    <span
      className={`offer-new-badge pointer-events-none inline-flex items-center rounded-full border border-sky-400/60 bg-sky-500 font-black uppercase text-white shadow-[0_0_16px_rgba(59,130,246,0.45)] backdrop-blur-md ${sizeClass} ${className}`}
    >
      {dict.offerNewBadge}
    </span>
  );
}
