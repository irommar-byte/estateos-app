import { useCallback, useSyncExternalStore } from 'react';

import { getAppLocale, setAppLocale, subscribeAppLocale, t } from './translate';
import type { AppLocale, TranslationParams } from './types';

export function useI18n() {
  const locale = useSyncExternalStore(subscribeAppLocale, getAppLocale, getAppLocale);

  const translate = useCallback((key: string, params?: TranslationParams) => t(key, params), [locale]);

  return {
    locale,
    t: translate,
    setLocale: setAppLocale,
  };
}

export type { AppLocale, TranslationParams };
