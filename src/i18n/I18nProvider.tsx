import React, { useEffect } from 'react';
import { AppState } from 'react-native';

import { resolveAppLocale } from './resolveLocale';
import { setAppLocale } from './translate';
import { useAppLocaleStore } from '../store/useAppLocaleStore';

type Props = {
  children: React.ReactNode;
};

/** Inicjalizacja języka (zapis użytkownika lub system) + odświeżenie po powrocie z tła. */
export default function I18nProvider({ children }: Props) {
  const hydrated = useAppLocaleStore((s) => s.hydrated);
  const preference = useAppLocaleStore((s) => s.preference);

  useEffect(() => {
    void useAppLocaleStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const pref = useAppLocaleStore.getState().preference;
      if (pref === 'system') {
        setAppLocale(resolveAppLocale());
      }
    });
    return () => sub.remove();
  }, [hydrated, preference]);

  return <>{children}</>;
}
