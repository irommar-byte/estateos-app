/**
 * EstateOS™ Intelligence — shared motion spec (Apple-quality genie + oil face).
 * Mobile uses RN Animated numbers; WWW maps the same values into framer-motion / CSS.
 */

/** Cubic-bezier control points — iOS spring feel without overshoot. */
export const INTEL_EASE = {
  /** Enter / progress fill */
  out: [0.16, 1, 0.3, 1] as const,
  /** Soft settle */
  inOut: [0.4, 0, 0.2, 1] as const,
  /** Genie collapse into orb */
  in: [0.55, 0.06, 0.68, 0.19] as const,
};

export const INTEL_MOTION = {
  /** Oil swirl layer A */
  oilSpinAMs: 7200,
  /** Oil swirl layer B (counter) */
  oilSpinBMs: 9800,
  /** Oil swirl layer C */
  oilSpinCMs: 5400,
  /** Core breathe (swirl scale) half-cycle */
  oilBreatheMs: 2100,
  /** Blob drift half-cycle */
  oilDriftMs: 3400,
  /** Brain glyph micro-breathe half-cycle */
  brainBreatheMs: 2100,
  /** Neuron orbit */
  neuronOrbitMs: 5200,
  /** Neuron pulse half-cycle */
  neuronPulseMs: 1300,
  /** Aura glow loop half-cycle */
  auraMs: 2400,
  /** Idle: stop full oil after this quiet period */
  idleAfterMs: 8000,
  /** Mood crossfade */
  moodCrossfadeMs: 400,
  /** Genie enter spring (RN friction/tension; WWW spring below) */
  genieInFriction: 7,
  genieInTension: 68,
  /** Genie exit — absorb into orb */
  genieOutMs: 420,
  /** Absorb choreography after card collapse (www fillBoost window) */
  absorbMs: 900,
  /** Learn splash ring expand */
  splashMs: 780,
  splashStaggerMs: 90,
  /** Progress bar width animation */
  progressBarMs: 700,
  /** Progress ring stroke animation */
  progressRingMs: 600,
  /** Spectacle mood hold after present */
  spectacleHoldMs: 2400,
  /** Auto-hide durations by present reason */
  hideManualMs: 9000,
  hideContradictionMs: 9000,
  hideReadyPeekMs: 7500,
  hideDefaultMs: 8200,
  /** Boot peek delay after pulse ready */
  bootPeekDelayMs: 2200,
  /** Celebrate scale pulse on orb */
  celebratePulseMs: 700,
} as const;

/** Framer-motion spring for genie card enter (matches RN friction≈7 / tension≈68). */
export const INTEL_GENIE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

/** Framer-motion spring for orb appear / absorb scale. */
export const INTEL_ORB_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

/** Genie enter keyframes (asymmetric scale from orb). */
export const INTEL_GENIE_ENTER = {
  opacity: [0, 0.85, 1] as const,
  scaleX: [0.12, 0.72, 1] as const,
  scaleY: [0.04, 0.88, 1] as const,
  /** Mid keyframe at ~55% of spring settle */
  midAt: 0.55,
};

/** Genie exit — collapse toward orb. */
export const INTEL_GENIE_EXIT = {
  scaleX: 0.22,
  scaleY: 0.12,
  blurPx: 12,
  y: 36,
};

export function hideDurationForReason(
  kind: 'progress' | 'milestone' | 'contradiction' | 'ready_peek' | 'manual',
): number {
  if (kind === 'manual') return INTEL_MOTION.hideManualMs;
  if (kind === 'contradiction') return INTEL_MOTION.hideContradictionMs;
  if (kind === 'ready_peek') return INTEL_MOTION.hideReadyPeekMs;
  return INTEL_MOTION.hideDefaultMs;
}

/** Seconds for CSS / framer duration props. */
export function msToSec(ms: number): number {
  return ms / 1000;
}
