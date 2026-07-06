"use client";

import { motion } from "framer-motion";
import { Building2, KeyRound } from "lucide-react";

export type CatalogTransactionMode = "sale" | "rent";

export type CatalogTransactionToggleLabels = {
  sale: string;
  rent: string;
};

type Props = {
  value: CatalogTransactionMode;
  onChange: (mode: CatalogTransactionMode) => void;
  labels: CatalogTransactionToggleLabels;
  saleCount: number;
  rentCount: number;
};

export default function CatalogTransactionToggle({
  value,
  onChange,
  labels,
  saleCount,
  rentCount,
}: Props) {
  const isSale = value === "sale";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div
        role="tablist"
        aria-label={labels.sale}
        className={`relative grid grid-cols-2 gap-1 rounded-[1.35rem] border p-1.5 shadow-[var(--eos-shadow-soft)] transition-colors duration-500 ${
          isSale
            ? "border-emerald-500/25 bg-emerald-500/[0.06]"
            : "border-sky-500/25 bg-sky-500/[0.06]"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className={`pointer-events-none absolute inset-y-1.5 w-[calc(50%-0.375rem)] rounded-[1.1rem] shadow-lg ${
            isSale
              ? "left-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600"
              : "left-[calc(50%+0.125rem)] bg-gradient-to-br from-sky-500 to-blue-600"
          }`}
        />

        <button
          type="button"
          role="tab"
          aria-selected={isSale}
          onClick={() => onChange("sale")}
          className={`relative z-10 flex items-center justify-center gap-2.5 rounded-[1.1rem] px-4 py-3.5 transition-colors ${
            isSale ? "text-white" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          }`}
        >
          <Building2 className="size-4 shrink-0" strokeWidth={2.25} />
          <span className="text-left">
            <span className="block text-[11px] font-black uppercase tracking-[0.14em] leading-tight">
              {labels.sale}
            </span>
            <span className={`mt-0.5 block text-[10px] font-bold tabular-nums ${isSale ? "text-white/85" : "text-[var(--eos-subtle)]"}`}>
              {saleCount}
            </span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={!isSale}
          onClick={() => onChange("rent")}
          className={`relative z-10 flex items-center justify-center gap-2.5 rounded-[1.1rem] px-4 py-3.5 transition-colors ${
            !isSale ? "text-white" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          }`}
        >
          <KeyRound className="size-4 shrink-0" strokeWidth={2.25} />
          <span className="text-left">
            <span className="block text-[11px] font-black uppercase tracking-[0.14em] leading-tight">
              {labels.rent}
            </span>
            <span className={`mt-0.5 block text-[10px] font-bold tabular-nums ${!isSale ? "text-white/85" : "text-[var(--eos-subtle)]"}`}>
              {rentCount}
            </span>
          </span>
        </button>
      </div>
    </motion.div>
  );
}
