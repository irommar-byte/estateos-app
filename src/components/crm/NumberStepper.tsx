"use client";

import { Minus, Plus } from "lucide-react";

function parseNumber(value: string): number | null {
  const normalized = String(value || "").replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: number, decimals: number): string {
  if (decimals <= 0) return String(Math.round(value));
  return String(Number(value.toFixed(decimals))).replace(".", ",");
}

export default function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const decimals = step < 1 ? 1 : 0;
  const numeric = parseNumber(value);
  const adjust = (delta: number) => {
    const base = numeric ?? (delta > 0 ? min : 0);
    let next = Number((base + delta).toFixed(decimals));
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(formatValue(next, decimals));
  };

  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--eos-muted)]">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => adjust(-step)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            inputMode="decimal"
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/[^\d.,\s]/g, ""))}
            className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-3.5 py-3 text-center text-sm font-semibold tabular-nums text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
              {suffix}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => adjust(step)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </label>
  );
}
