import { useMemo } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

export type CarScreenColors = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentSoft: string;
  primaryButtonBg: string;
  primaryButtonText: string;
  primaryButtonBorder: string;
  success: string;
  successButtonBg: string;
  successButtonText: string;
  successButtonBorder: string;
  successSurfaceBg: string;
  successSurfaceBorder: string;
  danger: string;
  dangerButtonBg: string;
  dangerButtonText: string;
  dangerButtonBorder: string;
  homeSwitchBg: string;
  homeSwitchBorder: string;
  homeSwitchText: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  modalBg: string;
  modalCard: string;
  overlay: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  chipActiveBg: string;
  chipActiveBorder: string;
  chipActiveText: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
  favButtonBg: string;
  favButtonBorder: string;
  shadow: string;
};

export function carCardElevation(isDark: boolean, size: 'sm' | 'md' = 'md'): ViewStyle {
  if (isDark) return {};
  const spec =
    size === 'md'
      ? { shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } as const, elevation: 4 }
      : { shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } as const, elevation: 2 };
  return {
    shadowColor: '#0F172A',
    ...spec,
    ...(Platform.OS === 'android' ? { elevation: spec.elevation } : {}),
  };
}

export function getCarScreenColors(isDark: boolean): CarScreenColors {
  if (isDark) {
    return {
      bg: '#05070A',
      surface: 'rgba(15,23,42,0.92)',
      surfaceMuted: 'rgba(15,23,42,0.72)',
      card: 'rgba(14,116,144,0.10)',
      cardBorder: 'rgba(125,211,252,0.22)',
      text: '#F8FAFC',
      textSecondary: '#E2E8F0',
      muted: '#94A3B8',
      accent: '#BAE6FD',
      accentSoft: '#7DD3FC',
      primaryButtonBg: 'rgba(14,116,144,0.32)',
      primaryButtonText: '#E0F2FE',
      primaryButtonBorder: 'rgba(125,211,252,0.45)',
      success: '#6EE7B7',
      successButtonBg: 'rgba(16,185,129,0.18)',
      successButtonText: '#A7F3D0',
      successButtonBorder: 'rgba(52,211,153,0.42)',
      successSurfaceBg: 'rgba(16,185,129,0.12)',
      successSurfaceBorder: 'rgba(52,211,153,0.35)',
      danger: '#FCA5A5',
      dangerButtonBg: 'rgba(127,29,29,0.28)',
      dangerButtonText: '#FECACA',
      dangerButtonBorder: 'rgba(248,113,113,0.38)',
      homeSwitchBg: 'rgba(16,185,129,0.16)',
      homeSwitchBorder: 'rgba(52,211,153,0.38)',
      homeSwitchText: '#6EE7B7',
      inputBg: 'rgba(15,23,42,0.88)',
      inputBorder: 'rgba(148,163,184,0.28)',
      placeholder: '#64748B',
      modalBg: 'rgba(0,0,0,0.72)',
      modalCard: '#0B1220',
      overlay: 'rgba(0,0,0,0.52)',
      buttonBg: 'rgba(14,116,144,0.22)',
      buttonBorder: 'rgba(125,211,252,0.38)',
      buttonText: '#BAE6FD',
      chipBg: 'transparent',
      chipBorder: 'rgba(148,163,184,0.28)',
      chipText: '#94A3B8',
      chipActiveBg: 'rgba(14,116,144,0.24)',
      chipActiveBorder: 'rgba(125,211,252,0.45)',
      chipActiveText: '#BAE6FD',
      warningBg: 'rgba(245,158,11,0.12)',
      warningBorder: 'rgba(251,191,36,0.35)',
      warningText: '#FDE68A',
      favButtonBg: 'rgba(15,23,42,0.78)',
      favButtonBorder: 'rgba(148,163,184,0.24)',
      shadow: '#000000',
    };
  }

  return {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: 'rgba(15,23,42,0.08)',
    text: '#0F172A',
    textSecondary: '#334155',
    muted: '#64748B',
    accent: '#0369A1',
    accentSoft: '#0284C7',
    primaryButtonBg: '#0284C7',
    primaryButtonText: '#FFFFFF',
    primaryButtonBorder: '#0369A1',
    success: '#047857',
    successButtonBg: '#059669',
    successButtonText: '#FFFFFF',
    successButtonBorder: '#047857',
    successSurfaceBg: '#ECFDF5',
    successSurfaceBorder: '#A7F3D0',
    danger: '#B91C1C',
    dangerButtonBg: '#FEF2F2',
    dangerButtonText: '#B91C1C',
    dangerButtonBorder: '#FECACA',
    homeSwitchBg: '#ECFDF5',
    homeSwitchBorder: '#6EE7B7',
    homeSwitchText: '#047857',
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(15,23,42,0.12)',
    placeholder: '#94A3B8',
    modalBg: 'rgba(15,23,42,0.32)',
    modalCard: '#FFFFFF',
    overlay: 'rgba(15,23,42,0.28)',
    buttonBg: '#F0F9FF',
    buttonBorder: '#BAE6FD',
    buttonText: '#0369A1',
    chipBg: '#FFFFFF',
    chipBorder: 'rgba(15,23,42,0.10)',
    chipText: '#64748B',
    chipActiveBg: '#E0F2FE',
    chipActiveBorder: '#7DD3FC',
    chipActiveText: '#0369A1',
    warningBg: '#FFFBEB',
    warningBorder: '#FCD34D',
    warningText: '#92400E',
    favButtonBg: 'rgba(255,255,255,0.94)',
    favButtonBorder: 'rgba(15,23,42,0.10)',
    shadow: '#0F172A',
  };
}

export function useCarScreenColors() {
  const isDark = useThemeStore((state) => state.getResolvedTheme() === 'dark');
  return useMemo(() => getCarScreenColors(isDark), [isDark]);
}

export function useCarScreenTheme() {
  const isDark = useThemeStore((state) => state.getResolvedTheme() === 'dark');
  const colors = useMemo(() => getCarScreenColors(isDark), [isDark]);
  const elevation = useMemo(
    () => ({
      card: carCardElevation(isDark, 'md'),
      cardSm: carCardElevation(isDark, 'sm'),
    }),
    [isDark],
  );
  return { colors, isDark, elevation };
}
