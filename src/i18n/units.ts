import { getAppLocale, t } from './translate';

export type MeterUnitKey = 'chars' | 'photos' | 'sqm' | 'pln';

export function meterUnitLabel(unit: MeterUnitKey): string {
  switch (unit) {
    case 'chars':
      return t('common.units.chars');
    case 'photos':
      return t('common.units.photos');
    case 'sqm':
      return t('common.units.sqm');
    case 'pln':
      return t('common.units.pln');
    default:
      return unit;
  }
}

/** PL: 1 znak / 2–4 znaki / 5+ znaków; EN: character(s). */
export function charsRemainingLabel(count: number): string {
  const locale = getAppLocale();
  if (locale === 'en') {
    return count === 1 ? t('common.units.char') : t('common.units.charsFew');
  }
  if (count === 1) return t('common.units.char');
  if (count >= 2 && count <= 4) return t('common.units.charsFew');
  return t('common.units.chars');
}
