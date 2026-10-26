import { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** Paleta importu — ta sama co na www (kość słoniowa / grafit, złoto dla postępu). */
export function useKeiPalette() {
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  return useMemo(
    () => ({
      isDark,
      bg: isDark ? '#0D0C0B' : '#F7F4EE',
      card: isDark ? '#171513' : '#FFFFFF',
      well: isDark ? '#221F1B' : '#F2EDE4',
      line: isDark ? 'rgba(216,195,160,0.14)' : '#E7E0D4',
      lineStrong: isDark ? 'rgba(216,195,160,0.28)' : '#D6CCBC',
      ink: isDark ? '#F3EEE6' : '#16171A',
      ink2: isDark ? '#C8C0B3' : '#5D584F',
      ink3: isDark ? '#8F877B' : '#8F887C',
      gold: isDark ? '#D8C3A0' : '#B8955A',
      goldInk: isDark ? '#E3CFA9' : '#7A5F33',
      goldSoft: isDark ? 'rgba(216,195,160,0.12)' : '#F4EBDA',
      good: isDark ? '#63CF99' : '#23855A',
      goodSoft: isDark ? 'rgba(99,207,153,0.12)' : '#E6F3EC',
      warn: isDark ? '#E6B85C' : '#A66D12',
      danger: isDark ? '#F08A73' : '#B93A26',
      dangerSoft: isDark ? 'rgba(240,138,115,0.10)' : '#FDF1EE',
      neutralSoft: isDark ? 'rgba(243,238,230,0.06)' : '#F0EDE7',
    }),
    [isDark],
  );
}
export type KeiPalette = ReturnType<typeof useKeiPalette>;
