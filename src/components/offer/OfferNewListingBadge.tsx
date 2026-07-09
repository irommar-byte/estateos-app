"use client";

import { motion } from "framer-motion";
import { isOfferNewListing } from "@/lib/offerLifecycle";

type OfferNewListingBadgeProps = {
  offer: Record<string, unknown> | null | undefined;
  label: string;
  className?: string;
  variant?: "card" | "overlay";
};

export default function OfferNewListingBadge({
  offer,
  label,
  className = "",
  variant = "card",
}: OfferNewListingBadgeProps) {
  if (!isOfferNewListing(offer)) return null;

  const base =
    variant === "overlay"
      ? "rounded-full border border-blue-400/50 bg-blue-500/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_18px_rgba(59,130,246,0.45)] backdrop-blur-md"
      : "rounded-full border border-blue-500/45 bg-blue-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.25)]";

  return (
    <motion.span
      className={`${base} ${className}`.trim()}
      animate={{ opacity: [1, 0.42, 1], scale: [1, 1.04, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {label}
    </motion.span>
  );
}
