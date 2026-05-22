import { requireOptionalNativeModule } from 'expo-modules-core';

import type { AppLocale } from './types';

type ExpoLocalizationModule = {
  getLocales: () => Array<{ languageCode?: string | null; languageTag?: string }>;
};

/** Język urządzenia bez twardego importu `expo-localization` (stary dev client by crashował). */
function getDeviceLanguageCode(): string {
  const localization = requireOptionalNativeModule<ExpoLocalizationModule>('ExpoLocalization');
  const primary = localization?.getLocales?.()?.[0];
  const fromNative = (primary?.languageCode ?? primary?.languageTag?.split('-')[0] ?? '').toLowerCase();
  if (fromNative) return fromNative;

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) return intlLocale.split('-')[0].toLowerCase();
  } catch {
    // ignore
  }

  return 'pl';
}

/** PL, EN i RU — zgodnie z językiem systemu lub wyborem w profilu. */
export function resolveAppLocale(): AppLocale {
  const code = getDeviceLanguageCode();
  if (code === 'pl') return 'pl';
  if (code === 'ru') return 'ru';
  return 'en';
}

export type AppLocalePreference = 'system' | AppLocale;

/** Preferencja użytkownika lub język systemu. */
export function resolveEffectiveLocale(preference: AppLocalePreference): AppLocale {
  if (preference === 'pl' || preference === 'en' || preference === 'ru') return preference;
  return resolveAppLocale();
}
