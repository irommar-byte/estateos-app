"use client";

import { Building2, Home, LandPlot, Store } from "lucide-react";
import {
  SELLER_PROPERTY_TYPES,
  type SellerPropertyTypeId,
} from "@/lib/crm/sellerProperty";

const ICONS = {
  FLAT: Building2,
  HOUSE: Home,
  PLOT: LandPlot,
  COMMERCIAL: Store,
} as const;

export default function SellerPropertyTypeOptions({
  value,
  onChange,
  disabled,
}: {
  value: SellerPropertyTypeId;
  onChange: (id: SellerPropertyTypeId) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
        Typ nieruchomości
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SELLER_PROPERTY_TYPES.map((option) => {
          const Icon = ICONS[option.id];
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`eos-raised-chip flex min-h-[4.6rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-[11px] ${
                selected ? "eos-raised-chip--on" : ""
              }`}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="font-black uppercase tracking-[0.14em]">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
