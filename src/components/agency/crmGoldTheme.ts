import type { CrmScheduleKind } from '../../hooks/useCrmSchedule';

/**
 * Readable colour system for the gold CRM panel. Every accent is picked to keep
 * contrast on the warm alloy background instead of the stock iOS system colours,
 * which wash out on gold.
 */
export type CrmPalette = {
  isDark: boolean;
  /** Headlines and values. */
  text: string;
  /** Supporting copy. */
  secondary: string;
  /** Labels and faint metadata. */
  muted: string;
  hairline: string;
  /** Frosted surface for rows sitting inside a metal recess. */
  surface: string;
  surfaceStrong: string;
  /** Neutral gold accent for informative details. */
  accent: string;
  /** Needs action right now. */
  attention: string;
  /** Going to plan. */
  onTrack: string;
  /** Waiting on the agent, not urgent. */
  pending: string;
  buyer: string;
  seller: string;
  presentation: string;
  openHouse: string;
  acquisition: string;
  /** Copy drawn on top of an accent fill. */
  onAccent: string;
};

export function crmGoldPalette(isDark: boolean): CrmPalette {
  if (isDark) {
    return {
      isDark,
      text: '#FFF6DE',
      secondary: 'rgba(255,246,222,0.74)',
      muted: 'rgba(255,246,222,0.5)',
      hairline: 'rgba(255,226,163,0.18)',
      surface: 'rgba(255,226,163,0.1)',
      surfaceStrong: 'rgba(255,226,163,0.17)',
      accent: '#F0D693',
      attention: '#FFA372',
      onTrack: '#7BE49C',
      pending: '#C9A6F7',
      buyer: '#FFBB74',
      seller: '#7BE49C',
      presentation: '#C9A6F7',
      openHouse: '#7BE49C',
      acquisition: '#93C5FF',
      onAccent: '#241A05',
    };
  }

  return {
    isDark,
    text: '#2A1D02',
    secondary: 'rgba(42,29,2,0.76)',
    muted: 'rgba(42,29,2,0.55)',
    hairline: 'rgba(74,52,6,0.22)',
    surface: 'rgba(255,251,236,0.44)',
    surfaceStrong: 'rgba(255,251,236,0.7)',
    accent: '#6B4A08',
    attention: '#9E2A0B',
    onTrack: '#1C5A2C',
    pending: '#54258A',
    buyer: '#8A4400',
    seller: '#1C5A2C',
    presentation: '#54258A',
    openHouse: '#1C5A2C',
    acquisition: '#17457F',
    onAccent: '#FFF8E4',
  };
}

export function crmKindTone(palette: CrmPalette, kind: CrmScheduleKind) {
  if (kind === 'acquisition') return palette.acquisition;
  if (kind === 'presentation') return palette.presentation;
  return palette.openHouse;
}
