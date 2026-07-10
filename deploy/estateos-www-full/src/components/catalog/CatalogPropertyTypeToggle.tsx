"use client";

import { motion } from "framer-motion";
import { Building2, Home, LandPlot, Store } from "lucide-react";

export type CatalogPropertyTypeFilter = "ALL" | "FLAT" | "HOUSE" | "PLOT" | "COMMERCIAL";

type Option = {
  key: CatalogPropertyTypeFilter;
  label: string;
  icon: typeof Home;
};

const OPTIONS: Option[] = [
  { key: "ALL", label: "Wszystkie", icon: Building2 },
  { key: "FLAT", label: "Mieszkania", icon: Home },
  { key: "HOUSE", label: "Domy", icon: Building2 },
  { key: "PLOT", label: "Działki", icon: LandPlot },
  { key: "COMMERCIAL", label: "Lokale", icon: Store },
];

type Props = {
  value: CatalogPropertyTypeFilter;
  onChange: (value: CatalogPropertyTypeFilter) => void;
  counts: Record<CatalogPropertyTypeFilter, number>;
  accent?: "sale" | "rent";
};

export default function CatalogPropertyTypeToggle({ value, onChange, counts, accent = "sale" }: Props) {
  const activeClass =
    accent === "rent"
      ? "border-sky-500/40 bg-sky-500/12 text-sky-600 dark:text-sky-300"
      : "border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 flex flex-wrap gap-2"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.key;
        const count = counts[option.key] ?? 0;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition ${
              active
                ? activeClass
                : "border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            }`}
          >
            <Icon className="size-3.5" />
            <span>
              {option.label} <span className="tabular-nums opacity-80">({count})</span>
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
