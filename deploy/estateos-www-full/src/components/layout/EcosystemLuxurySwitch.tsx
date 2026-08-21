"use client";

import { useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from "react";
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
  const active: "home" | "car" | null = highlightHome ? "home" : highlightCar ? "car" : null;
  const shellPad = density === "mini" ? "p-0.5" : "p-0.5 sm:p-1";
  const homeRef = useRef<HTMLButtonElement>(null);
  const carRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const target = active === "home" ? homeRef.current : active === "car" ? carRef.current : null;
    if (!shell || !target) {
      setPill(null);
      return;
    }
    const shellBox = shell.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    setPill({ left: targetBox.left - shellBox.left, width: targetBox.width });
  }, [active, density, highlightHome, highlightCar]);

  return (
    <motion.div
      ref={shellRef}
      role="group"
      aria-label="EstateOS Home or Car"
      className={`eos-lux-switch relative shrink-0 ${shellPad}`}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={spring}
    >
      {!reduceMotion ? <span className="eos-lux-switch__shimmer" aria-hidden /> : null}
      <span className="eos-lux-switch__rim" aria-hidden />
      <span className="eos-lux-switch__well" aria-hidden />

      {pill ? (
        <motion.span
          className={`eos-lux-switch__pill ${
            active === "car" ? "eos-lux-switch__pill--car" : "eos-lux-switch__pill--home"
          }`}
          initial={false}
          animate={{
            left: pill.left,
            width: pill.width,
            opacity: 1,
            scale: 1,
          }}
          transition={reduceMotion ? { duration: 0.12 } : spring}
          style={{ top: "0.22rem", bottom: "0.22rem" }}
        >
          <span className="eos-lux-switch__pill-glow" />
        </motion.span>
      ) : (
        <span className="eos-lux-switch__idle-hint" aria-hidden />
      )}

      <SegButton
        refEl={homeRef}
        pressed={highlightHome}
        onClick={onHome}
        className={`eos-lux-switch__seg eos-lux-switch__seg--home ${PAD[density]} ${TEXT[density]}`}
        reduceMotion={!!reduceMotion}
      >
        <motion.span
          className="inline-flex"
          animate={
            reduceMotion
              ? undefined
              : highlightHome
                ? { scale: 1.08, y: -0.5 }
                : { scale: 1, y: 0 }
          }
          transition={spring}
        >
          <Home
            className={`${ICON[density]} ${highlightHome ? "eos-lux-switch__icon--on" : "opacity-65"}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </motion.span>
        Home
      </SegButton>

      <SegButton
        refEl={carRef}
        pressed={highlightCar}
        onClick={onCar}
        className={`eos-lux-switch__seg eos-lux-switch__seg--car ${PAD[density]} ${TEXT[density]}`}
        reduceMotion={!!reduceMotion}
      >
        <motion.span
          className="inline-flex"
          animate={
            reduceMotion
              ? undefined
              : highlightCar
                ? { scale: 1.08, y: -0.5 }
                : { scale: 1, y: 0 }
          }
          transition={spring}
        >
          <Car
            className={`${ICON[density]} ${highlightCar ? "eos-lux-switch__icon--on" : "opacity-65"}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </motion.span>
        Car
      </SegButton>
    </motion.div>
  );
}

function SegButton({
  refEl,
  pressed,
  onClick,
  className,
  reduceMotion,
  children,
}: {
  refEl: RefObject<HTMLButtonElement | null>;
  pressed: boolean;
  onClick: () => void;
  className: string;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return (
    <motion.button
      ref={refEl}
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={className}
      whileHover={reduceMotion ? undefined : { y: -0.5 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={spring}
    >
      {children}
    </motion.button>
  );
}
