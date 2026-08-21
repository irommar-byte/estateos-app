"use client";

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

export default function CatalogPropertyTypeToggle({ value, onChange, counts, accent: _accent = "sale" }: Props) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.key;
        const count = counts[option.key] ?? 0;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`eos-raised-chip inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] ${
              active ? "eos-raised-chip--on" : ""
            }`}
          >
            <Icon className="size-3.5" />
            <span>
              {option.label} <span className="tabular-nums opacity-80">({count})</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
