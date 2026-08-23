"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type LuxSegAccent = "home" | "car" | "rent" | "platinum";

export type LuxSegOption<T extends string> = {
  value: T;
  label: ReactNode;
  accent?: LuxSegAccent;
};

type Props<T extends string> = {
  value: T;
  options: LuxSegOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Fallback accent when option has none */
  accent?: LuxSegAccent;
  size?: "md" | "sm";
  className?: string;
};

const spring = { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 };

/**
 * Shared luxury metal segment control (same language as navbar HOME/CAR).
 */
export default function LuxurySegmentSwitch<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  accent = "home",
  size = "md",
  className = "",
}: Props<T>) {
  const reduceMotion = useReducedMotion();
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const activeAccent = options[activeIndex]?.accent ?? accent;
  const pad = size === "sm" ? "p-0.5" : "p-1";
  const segPad =
    size === "sm" ? "px-3 py-2 text-[9px]" : "px-5 py-2.5 text-[10px] sm:px-6 sm:py-3";

  return (
    <motion.div
      role="group"
      aria-label={ariaLabel}
      className={`eos-lux-switch relative shrink-0 ${
        options.length === 2 ? "eos-lux-switch--pair" : ""
      } ${pad} ${className}`}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={spring}
    >
      {!reduceMotion ? <span className="eos-lux-switch__shimmer" aria-hidden /> : null}
      <span className="eos-lux-switch__rim" aria-hidden />
      <span className="eos-lux-switch__well" aria-hidden />

      {options.length ? (
        <span
          className={`eos-lux-switch__pill eos-lux-switch__pill--${activeAccent} ${
            activeIndex > 0 ? "is-end" : ""
          }`}
          aria-hidden
        >
          <span className="eos-lux-switch__pill-glow" />
        </span>
      ) : (
        <span className="eos-lux-switch__idle-hint" aria-hidden />
      )}

      {options.map((opt) => {
        const pressed = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={pressed}
            className={`eos-lux-switch__seg eos-lux-switch__seg--${opt.accent ?? accent} ${segPad}`}
          >
            {opt.label}
          </button>
        );
      })}
    </motion.div>
  );
}
