"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  displayValue: string;
  accentClass?: string;
  trailing?: ReactNode;
  onChange: (value: number) => void;
};

export default function CrmRadarScrubber({
  label,
  min,
  max,
  step = 1,
  value,
  displayValue,
  accentClass = "accent-[#a8844c]",
  trailing,
  onChange,
}: Props) {
  const safeValue = Math.min(max, Math.max(min, value || min));
  return (
    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-muted)]">
          {label}
        </span>
        <span className="flex items-center gap-2">
          {trailing}
          <span className="text-sm font-black tabular-nums text-[#7a5a26]">{displayValue}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accentClass}`}
      />
      <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-[var(--eos-subtle)]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
