'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

export type OfferSheetStyle = 'galeria' | 'architekt' | 'pelna';

export const OFFER_SHEET_STYLES: Array<{ id: OfferSheetStyle; label: string; hint: string }> = [
  { id: 'galeria', label: 'Galeria', hint: 'Duże zdjęcie, cena i najważniejsze liczby' },
  { id: 'architekt', label: 'Architekt', hint: 'Techniczna siatka, tabela parametrów, rzut i mapa' },
  { id: 'pelna', label: 'Pełna karta', hint: 'Zdjęcie, opis, 8 parametrów, rzut i galeria' },
];

export function isOfferSheetStyle(value: unknown): value is OfferSheetStyle {
  return value === 'galeria' || value === 'architekt' || value === 'pelna';
}

const STORAGE_KEY = 'eos_offer_sheet_style';
const DEFAULT_STYLE: OfferSheetStyle = 'pelna';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStored(): OfferSheetStyle {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isOfferSheetStyle(saved) ? saved : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

/** Styl ofertówki zapamiętany w przeglądarce agenta (WWW i WebView aplikacji). */
export function useOfferSheetStyle(override?: string | null): [OfferSheetStyle, (next: OfferSheetStyle) => void] {
  const stored = useSyncExternalStore(subscribe, readStored, () => DEFAULT_STYLE);
  const [picked, setPicked] = useState<OfferSheetStyle | null>(isOfferSheetStyle(override) ? override : null);
  const pick = useCallback((next: OfferSheetStyle) => {
    setPicked(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* tryb prywatny — wybór działa do zamknięcia strony */
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [picked ?? stored, pick];
}
