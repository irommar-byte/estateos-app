import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import type { TranslateFn } from '../i18n/types';

export type BirthdayYearPalette = {
  accentColor: string;
  iconBg: string;
  pillColor: string;
  pillBg: string;
  pillBorder: string;
  borderColor: string;
};

/** Rotacja palet — każdy rok inna kolorystyka (2025→pomarańcz, 2026→fiolet, …). */
const BIRTHDAY_YEAR_PALETTES: BirthdayYearPalette[] = [
  {
    accentColor: '#FF9F0A',
    iconBg: '#FF9F0A',
    pillColor: '#FF9F0A',
    pillBg: 'rgba(255,159,10,0.14)',
    pillBorder: 'rgba(255,159,10,0.38)',
    borderColor: 'rgba(255,159,10,0.42)',
  },
  {
    accentColor: '#AF52DE',
    iconBg: '#AF52DE',
    pillColor: '#AF52DE',
    pillBg: 'rgba(175,82,222,0.14)',
    pillBorder: 'rgba(175,82,222,0.38)',
    borderColor: 'rgba(175,82,222,0.4)',
  },
  {
    accentColor: '#34C759',
    iconBg: '#34C759',
    pillColor: '#34C759',
    pillBg: 'rgba(52,199,89,0.14)',
    pillBorder: 'rgba(52,199,89,0.38)',
    borderColor: 'rgba(52,199,89,0.4)',
  },
  {
    accentColor: '#0A84FF',
    iconBg: '#0A84FF',
    pillColor: '#0A84FF',
    pillBg: 'rgba(10,132,255,0.14)',
    pillBorder: 'rgba(10,132,255,0.32)',
    borderColor: 'rgba(10,132,255,0.38)',
  },
  {
    accentColor: '#FF6B9D',
    iconBg: '#FF6B9D',
    pillColor: '#FF6B9D',
    pillBg: 'rgba(255,107,157,0.14)',
    pillBorder: 'rgba(255,107,157,0.36)',
    borderColor: 'rgba(255,107,157,0.4)',
  },
];

const PALETTE_BASE_YEAR = 2025;

export function getBirthdayCouponYear(card: {
  createdAt?: string;
  birthdayYear?: number;
}): number {
  const explicit = Number(card.birthdayYear);
  if (Number.isFinite(explicit) && explicit >= 2020 && explicit <= 2100) {
    return Math.floor(explicit);
  }
  if (card.createdAt) {
    const y = new Date(card.createdAt).getFullYear();
    if (Number.isFinite(y) && y >= 2020) return y;
  }
  return new Date().getFullYear();
}

export function getBirthdayYearPalette(year: number): BirthdayYearPalette {
  const idx =
    (((Math.floor(year) - PALETTE_BASE_YEAR) % BIRTHDAY_YEAR_PALETTES.length) +
      BIRTHDAY_YEAR_PALETTES.length) %
    BIRTHDAY_YEAR_PALETTES.length;
  return BIRTHDAY_YEAR_PALETTES[idx];
}

export function buildBirthdayCouponTitle(t: TranslateFn, year: number): string {
  return t('profile.shop.birthdayCouponTitleYear', { year });
}

export function applyBirthdayYearPalette(
  card: ProfilePromoCardRecord,
  year: number,
): ProfilePromoCardRecord {
  const palette = getBirthdayYearPalette(year);
  return {
    ...card,
    birthdayYear: year,
    pillColor: palette.pillColor,
    pillBg: palette.pillBg,
    pillBorder: palette.pillBorder,
    iconBg: palette.iconBg,
    borderColor: palette.borderColor,
  };
}
