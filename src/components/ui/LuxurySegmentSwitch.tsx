"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  const shellRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const activeAccent = options[activeIndex]?.accent ?? accent;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const target = btnRefs.current[activeIndex];
    if (!shell || !target) {
      setPill(null);
      return;
    }
    const shellBox = shell.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    setPill({ left: targetBox.left - shellBox.left, width: targetBox.width });
  }, [activeIndex, value, options, size]);

  const pad = size === "sm" ? "p-0.5" : "p-1";
  const segPad =
    size === "sm" ? "px-3 py-2 text-[9px]" : "px-5 py-2.5 text-[10px] sm:px-6 sm:py-3";

  return (
    <motion.div
      ref={shellRef}
      role="group"
      aria-label={ariaLabel}
      className={`eos-lux-switch relative inline-flex shrink-0 items-center gap-0.5 ${pad} ${className}`}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={spring}
    >
      {!reduceMotion ? <span className="eos-lux-switch__shimmer" aria-hidden /> : null}
      <span className="eos-lux-switch__rim" aria-hidden />
      <span className="eos-lux-switch__well" aria-hidden />

      {pill ? (
        <motion.span
          className={`eos-lux-switch__pill eos-lux-switch__pill--${activeAccent}`}
          initial={false}
          animate={{ left: pill.left, width: pill.width, opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0.12 } : spring}
          style={{
            top: size === "sm" ? "0.18rem" : "0.22rem",
            bottom: size === "sm" ? "0.18rem" : "0.22rem",
          }}
        >
          <span className="eos-lux-switch__pill-glow" />
        </motion.span>
      ) : (
        <span className="eos-lux-switch__idle-hint" aria-hidden />
      )}

      {options.map((opt, i) => {
        const pressed = opt.value === value;
        return (
          <motion.button
            key={String(opt.value)}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={pressed}
            className={`eos-lux-switch__seg eos-lux-switch__seg--${opt.accent ?? accent} ${segPad}`}
            whileHover={reduceMotion ? undefined : { y: -0.5 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={spring}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
