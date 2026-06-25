'use client';

import { useLayoutEffect } from 'react';

/** Wymusza jasny motyw na stronie zaproszenia (bez ciemnego UI dla klientów z portali). */
export default function ForceLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    const hadDark = root.classList.contains('dark');
    const hadLight = root.classList.contains('light');
    const prevScheme = root.style.colorScheme;

    root.dataset.theme = 'light';
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';

    return () => {
      if (prevTheme) root.dataset.theme = prevTheme;
      else delete root.dataset.theme;
      root.classList.toggle('dark', hadDark);
      root.classList.toggle('light', hadLight);
      root.style.colorScheme = prevScheme || '';
    };
  }, []);

  return null;
}
