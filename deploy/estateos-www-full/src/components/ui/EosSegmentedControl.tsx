"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  title?: string;
};

export default function EosSegmentedControl<T extends string>({
  layoutId,
  value,
  onChange,
  options,
  ariaLabel,
  compact = false,
}: {
  layoutId: string;
  value: T;
  onChange: (next: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="eos-segmented-control relative w-full min-w-0"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.title ?? opt.label}
            title={opt.title ?? opt.label}
            onClick={() => {
              if (!selected) onChange(opt.value);
            }}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full transition-colors ${
              compact ? "min-h-9 px-2 py-1.5" : "min-h-10 px-2.5 py-2"
            } ${selected ? "text-[var(--eos-text)]" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"}`}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-full border border-[var(--eos-border-strong)] bg-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            {opt.icon ? (
              <span
                className={`flex shrink-0 items-center justify-center ${
                  selected ? "text-[var(--eos-contrast)]" : ""
                }`}
              >
                {opt.icon}
              </span>
            ) : null}
            <span
              className={`truncate text-[10px] font-black uppercase tracking-[0.12em] ${
                selected ? "text-[var(--eos-contrast)]" : ""
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
