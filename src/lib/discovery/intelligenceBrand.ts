/**
 * EstateOS™ Intelligence — visual brand tokens.
 * Source of truth for the gasoline-on-water brain face (mobile + www mirror).
 */

export type IntelligenceMood = 'calm' | 'active' | 'alert' | 'celebrate';

/**
 * Why the genie card auto-opened (or manual tap).
 *
 * Sparse Apple-style rules:
 * - `manual` — user tapped the orb / Guide open. No chime.
 * - `milestone` — first cross of 25/50/75/90 in this session. High priority.
 * - `contradiction` — contradictionIndex rose past 0.55. High priority.
 * - `progress` — meaningful progress delta (≥8%) without a new milestone. Medium.
 * - `ready_peek` — one-time boot peek when direction is already meaningful. Low.
 *
 * Session budget: max 2 auto-presents (peek + milestone|contradiction|progress).
 * Chime debounce: 12s. Never auto-present while sheet is open.
 */
export type PresentReason = 'progress' | 'milestone' | 'contradiction' | 'ready_peek' | 'manual';

export type StageKey = 'EXPLORE' | 'FOCUS' | 'READY' | 'COMPLETE';

export const STAGE_ORDER: StageKey[] = ['EXPLORE', 'FOCUS', 'READY', 'COMPLETE'];

/** Bright Siri / oil-on-water iridescence — not a flat blend. */
export const OIL_BASE = [
  '#FF2D55',
  '#BF5AF2',
  '#5E5CE6',
  '#64D2FF',
  '#30D158',
  '#FFD60A',
  '#FF9F0A',
  '#FF2D55',
] as const;

export const OIL_HOT = ['#FF375F', '#FFD60A', '#64D2FF', '#BF5AF2', '#FF375F'] as const;
export const OIL_COOL = ['#64D2FF', '#5E5CE6', '#30D158', '#BF5AF2', '#64D2FF'] as const;
export const OIL_EDGE = [
  'transparent',
  '#FF2D55',
  'transparent',
  '#64D2FF',
  'transparent',
  '#FFD60A',
  'transparent',
] as const;

/** Orb face diameters (px). */
export const INTEL_ORB = {
  /** Floating launcher core */
  lg: 58,
  /** Sheet header */
  md: 32,
  /** Rail / whisper badge */
  sm: 20,
  /** Preference toggle */
  xs: 16,
} as const;

export const INTEL_MILESTONES = [25, 50, 75, 90] as const;

export const SESSION_MILESTONE_KEY = 'eos_intel_milestones_v1';
export const SESSION_PEEK_KEY = 'eos_intel_peek_v1';
export const SESSION_AUTO_BUDGET_KEY = 'eos_intel_auto_budget_v1';

/** Max auto-presents per browser/app session (peek counts). */
export const INTEL_AUTO_PRESENT_BUDGET = 2;

/** Progress must rise by at least this much to fire `progress` present. */
export const INTEL_PROGRESS_DELTA = 8;

export const INTEL_THRESHOLDS = {
  contradiction: 0.55,
  activeProgress: 35,
  activeConfidence: 0.35,
  peekProgress: 40,
  peekConfidence: 0.32,
} as const;

export type MoodPalette = {
  accent: string;
  soft: string;
  ring: string;
  /** WWW: Tailwind-ish border class fragment or raw rgba for stroke */
  glow: string;
  stroke: string;
  /** Aura / pulse loop duration (seconds on www, ms base on mobile via motion) */
  speed: number;
};

export const MOOD_PALETTE: Record<IntelligenceMood, MoodPalette> = {
  calm: {
    accent: '#34D399',
    soft: 'rgba(52,211,153,0.35)',
    ring: 'rgba(52,211,153,0.55)',
    glow: 'rgba(52,211,153,0.55)',
    stroke: '#34d399',
    speed: 3.6,
  },
  active: {
    accent: '#5AC8FA',
    soft: 'rgba(90,200,250,0.45)',
    ring: 'rgba(90,200,250,0.65)',
    glow: 'rgba(56,189,248,0.55)',
    stroke: '#38bdf8',
    speed: 2.2,
  },
  alert: {
    accent: '#FBBF24',
    soft: 'rgba(251,191,36,0.4)',
    ring: 'rgba(251,191,36,0.65)',
    glow: 'rgba(251,191,36,0.6)',
    stroke: '#fbbf24',
    speed: 1.35,
  },
  celebrate: {
    accent: '#A78BFA',
    soft: 'rgba(167,139,250,0.45)',
    ring: 'rgba(167,139,250,0.7)',
    glow: 'rgba(167,139,250,0.7)',
    stroke: '#A78BFA',
    speed: 0.9,
  },
};

/** WWW button ring classes keyed by mood (Tailwind). */
export const MOOD_RING_CLASS: Record<IntelligenceMood, string> = {
  calm: 'border-emerald-400/35',
  active: 'border-sky-400/40',
  alert: 'border-amber-400/45',
  celebrate: 'border-violet-400/50',
};

export function resolveIntelligenceMood(input: {
  progress: number;
  confidence: number;
  contradictionIndex: number;
  spectacle?: boolean;
}): IntelligenceMood {
  if (input.spectacle) return 'celebrate';
  if (input.contradictionIndex >= INTEL_THRESHOLDS.contradiction) return 'alert';
  if (
    input.progress >= INTEL_THRESHOLDS.activeProgress ||
    input.confidence >= INTEL_THRESHOLDS.activeConfidence
  ) {
    return 'active';
  }
  return 'calm';
}

export function resolveStageKey(stage: string | undefined, progress: number): StageKey {
  const raw = String(stage || '').toUpperCase();
  if (raw === 'EXPLORE' || raw === 'FOCUS' || raw === 'READY' || raw === 'COMPLETE') {
    return raw;
  }
  if (progress >= 100) return 'COMPLETE';
  if (progress >= 75) return 'READY';
  if (progress >= 28) return 'FOCUS';
  return 'EXPLORE';
}

export function crossedMilestone(prev: number | null, next: number): number | null {
  if (typeof prev !== 'number') return null;
  for (const gate of INTEL_MILESTONES) {
    if (prev < gate && next >= gate) return gate;
  }
  return null;
}

export function confidenceLabel(c: number): 'start' | 'outline' | 'clear' | 'strong' {
  if (c < 0.12) return 'start';
  if (c < 0.35) return 'outline';
  if (c < 0.6) return 'clear';
  return 'strong';
}

export function oilConicCss(fromDeg: number, colors: readonly string[]): string {
  return `conic-gradient(from ${fromDeg}deg, ${colors.join(',')})`;
}
