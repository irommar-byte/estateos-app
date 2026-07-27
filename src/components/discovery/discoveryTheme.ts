import type { TextStyle, ViewStyle } from 'react-native';

export type DiscoveryTheme = {
  isDark: boolean;
  bg: string;
  card: string;
  cardBorder: string;
  cardAccent: string;
  cardAccentBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  eyebrow: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successSoft: string;
  dangerBorder: string;
  dangerBg: string;
  dangerText: string;
  track: string;
  chipBg: string;
  chipBorder: string;
  chipLabel: string;
  chipValue: string;
  pillBg: string;
  pillBorder: string;
  stageCurrentBg: string;
  stageCurrentBorder: string;
  stageIndexBg: string;
  stageIndexBorder: string;
  stageIndexText: string;
  brainOrbBg: string;
  brainOrbBorder: string;
  brainOrbIcon: string;
  hairline: string;
  primaryBtn: string;
  primaryBtnText: string;
  secondaryText: string;
  toastBg: string;
  toastBorder: string;
  toastText: string;
  navBtnBg: string;
  navBtnBorder: string;
  navBtnIcon: string;
};

export function discoveryTheme(isDark: boolean): DiscoveryTheme {
  if (isDark) {
    return {
      isDark: true,
      bg: '#040405',
      card: 'rgba(12,16,24,0.92)',
      cardBorder: 'rgba(255,255,255,0.12)',
      cardAccent: 'rgba(8,14,24,0.92)',
      cardAccentBorder: 'rgba(56,189,248,0.28)',
      text: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.78)',
      textMuted: 'rgba(255,255,255,0.55)',
      eyebrow: 'rgba(125,211,252,0.95)',
      accent: '#38BDF8',
      accentSoft: 'rgba(56,189,248,0.16)',
      accentText: '#BAE6FD',
      success: '#34D399',
      successSoft: 'rgba(52,211,153,0.16)',
      dangerBorder: 'rgba(251,113,133,0.35)',
      dangerBg: 'rgba(244,63,94,0.14)',
      dangerText: '#FECDD3',
      track: 'rgba(255,255,255,0.12)',
      chipBg: 'rgba(56,189,248,0.1)',
      chipBorder: 'rgba(56,189,248,0.28)',
      chipLabel: 'rgba(186,230,253,0.7)',
      chipValue: '#F8FAFC',
      pillBg: 'rgba(255,255,255,0.06)',
      pillBorder: 'rgba(255,255,255,0.14)',
      stageCurrentBg: 'rgba(56,189,248,0.12)',
      stageCurrentBorder: 'rgba(56,189,248,0.32)',
      stageIndexBg: 'rgba(255,255,255,0.08)',
      stageIndexBorder: 'rgba(255,255,255,0.14)',
      stageIndexText: 'rgba(255,255,255,0.55)',
      brainOrbBg: 'rgba(56,189,248,0.14)',
      brainOrbBorder: 'rgba(56,189,248,0.4)',
      brainOrbIcon: '#7DD3FC',
      hairline: 'rgba(255,255,255,0.1)',
      primaryBtn: '#10B981',
      primaryBtnText: '#FFFFFF',
      secondaryText: 'rgba(255,255,255,0.72)',
      toastBg: 'rgba(16,185,129,0.2)',
      toastBorder: 'rgba(52,211,153,0.35)',
      toastText: '#D1FAE5',
      navBtnBg: 'rgba(255,255,255,0.08)',
      navBtnBorder: 'rgba(255,255,255,0.16)',
      navBtnIcon: '#F5F5F7',
    };
  }

  return {
    isDark: false,
    bg: '#F2F2F7',
    card: '#FFFFFF',
    cardBorder: 'rgba(15,23,42,0.08)',
    cardAccent: '#FFFFFF',
    cardAccentBorder: 'rgba(2,132,199,0.22)',
    text: '#0F172A',
    textSecondary: 'rgba(15,23,42,0.78)',
    textMuted: 'rgba(15,23,42,0.52)',
    eyebrow: '#0284C7',
    accent: '#0284C7',
    accentSoft: 'rgba(14,165,233,0.12)',
    accentText: '#0369A1',
    success: '#059669',
    successSoft: 'rgba(16,185,129,0.12)',
    dangerBorder: 'rgba(225,29,72,0.28)',
    dangerBg: 'rgba(255,241,242,1)',
    dangerText: '#9F1239',
    track: 'rgba(15,23,42,0.1)',
    chipBg: 'rgba(14,165,233,0.08)',
    chipBorder: 'rgba(2,132,199,0.2)',
    chipLabel: 'rgba(3,105,161,0.7)',
    chipValue: '#0F172A',
    pillBg: 'rgba(15,23,42,0.04)',
    pillBorder: 'rgba(15,23,42,0.1)',
    stageCurrentBg: 'rgba(14,165,233,0.1)',
    stageCurrentBorder: 'rgba(2,132,199,0.28)',
    stageIndexBg: 'rgba(15,23,42,0.05)',
    stageIndexBorder: 'rgba(15,23,42,0.12)',
    stageIndexText: 'rgba(15,23,42,0.45)',
    brainOrbBg: 'rgba(14,165,233,0.12)',
    brainOrbBorder: 'rgba(2,132,199,0.28)',
    brainOrbIcon: '#0284C7',
    hairline: 'rgba(15,23,42,0.08)',
    primaryBtn: '#059669',
    primaryBtnText: '#FFFFFF',
    secondaryText: 'rgba(15,23,42,0.68)',
    toastBg: 'rgba(16,185,129,0.14)',
    toastBorder: 'rgba(5,150,105,0.28)',
    toastText: '#065F46',
    navBtnBg: '#FFFFFF',
    navBtnBorder: 'rgba(15,23,42,0.1)',
    navBtnIcon: '#0F172A',
  };
}

export function discoveryText(
  theme: DiscoveryTheme,
  role: 'title' | 'body' | 'muted' | 'eyebrow' | 'accent' = 'body',
): TextStyle {
  switch (role) {
    case 'title':
      return { color: theme.text };
    case 'muted':
      return { color: theme.textMuted };
    case 'eyebrow':
      return { color: theme.eyebrow };
    case 'accent':
      return { color: theme.accentText };
    default:
      return { color: theme.textSecondary };
  }
}

export function discoveryCard(theme: DiscoveryTheme, accent = false): ViewStyle {
  return {
    backgroundColor: accent ? theme.cardAccent : theme.card,
    borderColor: accent ? theme.cardAccentBorder : theme.cardBorder,
  };
}
