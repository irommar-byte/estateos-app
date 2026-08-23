"use client";

import { Car, Home } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export type LuxSwitchDensity = "full" | "compact" | "mini";

type Props = {
  density: LuxSwitchDensity;
  highlightHome: boolean;
  highlightCar: boolean;
  onHome: () => void;
  onCar: () => void;
};

const PAD: Record<LuxSwitchDensity, string> = {
  full: "px-2.5 py-1.5 sm:px-3.5 sm:py-2",
  compact: "px-2 py-1.5",
  mini: "px-1.5 py-1",
};

const TEXT: Record<LuxSwitchDensity, string> = {
  full: "text-[9px] sm:text-[10px]",
  compact: "text-[9px]",
  mini: "text-[8px]",
};

const ICON: Record<LuxSwitchDensity, string> = {
  full: "size-3.5",
  compact: "size-3.5",
  mini: "size-3",
};

const spring = { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 };

export default function EcosystemLuxurySwitch({
  density,
  highlightHome,
  highlightCar,
  onHome,
  onCar,
}: Props) {
  const reduceMotion = useReducedMotion();
  const shellPad = density === "mini" ? "p-0.5" : "p-0.5 sm:p-1";

  return (
    <motion.div
      role="group"
      aria-label="EstateOS Home or Car"
      className={`eos-lux-switch eos-lux-switch--pair ${shellPad}`}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={spring}
    >
      {!reduceMotion ? <span className="eos-lux-switch__shimmer" aria-hidden /> : null}
      <span className="eos-lux-switch__rim" aria-hidden />
      <span className="eos-lux-switch__well" aria-hidden />

      {highlightHome || highlightCar ? (
        <span
          className={`eos-lux-switch__pill ${
            highlightCar ? "eos-lux-switch__pill--car is-end" : "eos-lux-switch__pill--home"
          }`}
          aria-hidden
        >
          <span className="eos-lux-switch__pill-glow" />
        </span>
      ) : (
        <span className="eos-lux-switch__idle-hint" aria-hidden />
      )}

      <button
        type="button"
        onClick={onHome}
        aria-pressed={highlightHome}
        className={`eos-lux-switch__seg eos-lux-switch__seg--home ${PAD[density]} ${TEXT[density]}`}
      >
        <Home
          className={`${ICON[density]} ${highlightHome ? "eos-lux-switch__icon--on" : "opacity-65"}`}
          strokeWidth={2.25}
          aria-hidden
        />
        Home
      </button>

      <button
        type="button"
        onClick={onCar}
        aria-pressed={highlightCar}
        className={`eos-lux-switch__seg eos-lux-switch__seg--car ${PAD[density]} ${TEXT[density]}`}
      >
        <Car
          className={`${ICON[density]} ${highlightCar ? "eos-lux-switch__icon--on" : "opacity-65"}`}
          strokeWidth={2.25}
          aria-hidden
        />
        Car
      </button>
    </motion.div>
  );
}
