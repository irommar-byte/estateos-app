import type { CrmPalette } from './crmGoldTheme';

/** Readable colour system for the red-metal admin CORE panel. */
export function crmRedPalette(isDark: boolean): CrmPalette {
  if (isDark) {
    return {
      isDark,
      text: '#FFE8E4',
      secondary: 'rgba(255,232,228,0.74)',
      muted: 'rgba(255,232,228,0.5)',
      hairline: 'rgba(255,176,166,0.2)',
      surface: 'rgba(255,160,148,0.1)',
      surfaceStrong: 'rgba(255,160,148,0.18)',
      accent: '#FFB4A8',
      attention: '#FF9F0A',
      onTrack: '#7BE49C',
      pending: '#FFD60A',
      buyer: '#FFBB74',
      seller: '#7BE49C',
      presentation: '#C9A6F7',
      openHouse: '#7BE49C',
      acquisition: '#93C5FF',
      onAccent: '#2A0C0C',
    };
  }

  return {
    isDark,
    text: '#2C0A0A',
    secondary: 'rgba(44,10,10,0.76)',
    muted: 'rgba(44,10,10,0.55)',
    hairline: 'rgba(90,18,16,0.24)',
    surface: 'rgba(255,236,230,0.44)',
    surfaceStrong: 'rgba(255,236,230,0.72)',
    accent: '#6B1614',
    attention: '#9E2A0B',
    onTrack: '#1C5A2C',
    pending: '#7A5A00',
    buyer: '#8A4400',
    seller: '#1C5A2C',
    presentation: '#54258A',
    openHouse: '#1C5A2C',
    acquisition: '#17457F',
    onAccent: '#FFF1EE',
  };
}
