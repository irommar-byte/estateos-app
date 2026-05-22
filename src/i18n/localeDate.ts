import type { AppLocale } from './types';

/** Locale BCP-47 dla `toLocaleDateString` / `toLocaleString`. */
export function localeToDateFormat(locale: AppLocale): string {
  if (locale === 'pl') return 'pl-PL';
  if (locale === 'ru') return 'ru-RU';
  return 'en-US';
}
