/**
 * Canonical EstateOS™ Intelligence visual identity.
 * Match the living brain launcher: white glyph on Siri oil-on-water iridescence.
 */

/** Brain stroke on iridescent faces (launcher, toggle ON, enable hero). */
export const INTELLIGENCE_BRAIN_GLYPH = '#FFFFFF';

/** Soft white on light surfaces. */
export const INTELLIGENCE_BRAIN_GLYPH_SOFT = '#F5F5F7';

/** Quiet off-state (profile toggle). */
export const INTELLIGENCE_BRAIN_OFF = '#8E8E93';

/** Siri / oil-on-water — shared across pulse, toggle, rails, sheets. */
export const INTELLIGENCE_OIL = [
  '#FF2D55',
  '#BF5AF2',
  '#5E5CE6',
  '#64D2FF',
  '#30D158',
  '#FFD60A',
  '#FF9F0A',
  '#FF2D55',
] as const;

export const INTELLIGENCE_OIL_HOT = ['#FF375F', '#FFD60A', '#64D2FF', '#BF5AF2', '#FF375F'] as const;
export const INTELLIGENCE_OIL_COOL = ['#64D2FF', '#5E5CE6', '#30D158', '#BF5AF2', '#64D2FF'] as const;

/** Mood accents — state only, never the product brand. */
export const INTELLIGENCE_MOOD = {
  calm: { accent: '#34D399', glow: 'rgba(52,211,153,0.55)', ring: '#34D399' },
  active: { accent: '#5AC8FA', glow: 'rgba(90,200,250,0.55)', ring: '#5AC8FA' },
  alert: { accent: '#FBBF24', glow: 'rgba(251,191,36,0.6)', ring: '#FBBF24' },
  celebrate: { accent: '#A78BFA', glow: 'rgba(167,139,250,0.7)', ring: '#A78BFA' },
} as const;

export type IntelligenceMood = keyof typeof INTELLIGENCE_MOOD;

export const INTELLIGENCE_BRAND_LABEL = 'EstateOS™ Intelligence';
export const INTELLIGENCE_BRAND_A11Y = 'EstateOS Intelligence';
