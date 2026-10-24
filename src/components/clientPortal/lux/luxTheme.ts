import { Platform } from 'react-native';

/** Paleta panelu klienta „lux” — ta sama co na www (czerń, krem, złoto). */
export function luxPalette(isDark: boolean) {
  return {
    isDark,
    bg: isDark ? '#0B0B0C' : '#F6F3EE',
    card: isDark ? '#161617' : '#FFFFFF',
    cardAlt: isDark ? '#1F1F21' : '#F6F3EE',
    ink: isDark ? '#F6F3EE' : '#15171A',
    muted: isDark ? '#A7A196' : '#5B574F',
    border: isDark ? 'rgba(216,195,160,0.16)' : '#E6E0D6',
    gold: '#D8C3A0',
    accent: isDark ? '#D8C3A0' : '#7A5F33',
    green: '#0E4D3F',
    good: '#2F9E6A',
    warn: '#C98A1B',
    bad: '#C2412D',
    black: '#000000',
    cream: '#F6F3EE',
  };
}

export type LuxPalette = ReturnType<typeof luxPalette>;

export const LUX_SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

export const plnFormat = (value: number | string | null | undefined) => {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
};

export const SENTIMENT_LABEL: Record<string, string> = {
  like: 'Chcę obejrzeć',
  maybe: 'Do przemyślenia',
  dislike: 'Nie pasuje',
};

export function sentimentOf(raw: string | null | undefined): 'like' | 'maybe' | 'dislike' | null {
  if (!raw) return null;
  try {
    const s = String((JSON.parse(raw) as { sentiment?: string }).sentiment || '');
    return s === 'like' || s === 'maybe' || s === 'dislike' ? s : null;
  } catch {
    return null;
  }
}
