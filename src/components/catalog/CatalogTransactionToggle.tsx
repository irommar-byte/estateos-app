"use client";

import { Building2, KeyRound } from "lucide-react";
import LuxurySegmentSwitch from "@/components/ui/LuxurySegmentSwitch";

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
  return (
    <LuxurySegmentSwitch
      ariaLabel={labels.sale}
      className="min-h-14 w-full flex-1"
      value={value}
      onChange={onChange}
      options={[
        {
          value: "sale",
          accent: "home",
          label: (
            <span className="flex items-center justify-center gap-2.5">
              <Building2 className="size-4 shrink-0" strokeWidth={2.25} />
              <span className="text-left">
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] leading-tight">
                  {labels.sale}
                </span>
                <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-[var(--eos-subtle)]">
                  {saleCount}
                </span>
              </span>
            </span>
          ),
        },
        {
          value: "rent",
          accent: "rent",
          label: (
            <span className="flex items-center justify-center gap-2.5">
              <KeyRound className="size-4 shrink-0" strokeWidth={2.25} />
              <span className="text-left">
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] leading-tight">
                  {labels.rent}
                </span>
                <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-[var(--eos-subtle)]">
                  {rentCount}
                </span>
              </span>
            </span>
          ),
        },
      ]}
    />
  );
}
