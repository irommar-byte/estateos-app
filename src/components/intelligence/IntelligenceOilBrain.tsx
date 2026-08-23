"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";
import { INTEL_EASE, INTEL_MOTION, msToSec } from "@/lib/discovery/intelligenceMotion";
import { INTEL_ORB, MOOD_PALETTE, OIL_BASE, OIL_COOL, OIL_HOT, oilConicCss } from "@/lib/discovery/intelligenceBrand";

export default function IntelligenceOilBrain({
  size = INTEL_ORB.lg,
  celebrating = false,
  reduceMotion = false,
}: {
  size?: number;
  celebrating?: boolean;
  reduceMotion?: boolean;
}) {
  const colors = MOOD_PALETTE[celebrating ? "celebrate" : "active"];
  const facePx = Math.round(size * 2.15);
  const fullMotion = !reduceMotion;

  return (
    <span className="relative flex items-center justify-center" style={{ width: facePx, height: facePx }}>
      {celebrating
        ? [0, 1, 2].map((ring) => (
            <motion.span
              key={ring}
              aria-hidden
              className="absolute inset-[-8%] rounded-full"
              style={{
                border: "2px solid transparent",
                background: `linear-gradient(white, white) padding-box, ${oilConicCss(ring * 80, OIL_HOT)} border-box`,
              }}
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: [0.85, 1.85 + ring * 0.25], opacity: [0.55, 0] }}
              transition={{ duration: 0.95, delay: ring * 0.08, ease: "easeOut" }}
            />
          ))
        : null}
      <span className="relative flex items-center justify-center overflow-hidden rounded-full" style={{ width: size, height: size }}>
        {fullMotion ? (
          <>
            <motion.span
              aria-hidden
              className="absolute inset-[-40%] rounded-full"
              style={{ background: oilConicCss(0, OIL_BASE) }}
              animate={{ rotate: 360 }}
              transition={{ duration: msToSec(INTEL_MOTION.oilSpinAMs), repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-[-22%] rounded-full opacity-90 mix-blend-screen"
              style={{ background: oilConicCss(90, OIL_HOT) }}
              animate={{ rotate: -360 }}
              transition={{ duration: msToSec(INTEL_MOTION.oilSpinBMs), repeat: Infinity, ease: "linear" }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-[-12%] rounded-full opacity-75 mix-blend-screen"
              style={{ background: oilConicCss(180, OIL_COOL) }}
              animate={{ rotate: 360 }}
              transition={{ duration: msToSec(INTEL_MOTION.oilSpinCMs), repeat: Infinity, ease: "linear" }}
            />
          </>
        ) : (
          <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: oilConicCss(210, OIL_BASE) }} />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 42%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.28), transparent 50%)",
            boxShadow: `0 0 0 1px ${colors.glow}`,
          }}
        />
        <motion.span
          className="relative z-[1] text-white"
          style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.55))" }}
          animate={
            reduceMotion
              ? undefined
              : celebrating
                ? { scale: [1, 1.22, 1], rotate: [0, -6, 5, 0] }
                : { scale: [1, 1.06, 1] }
          }
          transition={
            celebrating
              ? { duration: msToSec(INTEL_MOTION.celebratePulseMs), ease: INTEL_EASE.out }
              : { duration: msToSec(INTEL_MOTION.brainBreatheMs), repeat: Infinity, ease: "easeInOut" }
          }
        >
          <Brain size={Math.round(size * 0.46)} strokeWidth={2} aria-hidden />
        </motion.span>
      </span>
    </span>
  );
}
