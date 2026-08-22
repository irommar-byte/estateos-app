'use client';

import { useEffect, useState } from 'react';

export type HdrDisplayCapability = {
  hdrCapable: boolean;
  wideGamut: boolean;
  heicInPicture: boolean;
  ready: boolean;
};

/**
 * Wykrywa możliwość wyświetlenia HDR w przeglądarce (dynamic-range, color-gamut).
 * Nie używa filtrów CSS — tylko decyzja o źródle obrazu.
 */
export function useHdrDisplayCapability(): HdrDisplayCapability {
  const [state, setState] = useState<HdrDisplayCapability>({
    hdrCapable: false,
    wideGamut: false,
    heicInPicture: false,
    ready: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hdrCapable =
      window.matchMedia('(dynamic-range: high)').matches ||
      window.matchMedia('(dynamic-range: standard) and (color-gamut: rec2020)').matches;
    const wideGamut =
      window.matchMedia('(color-gamut: rec2020)').matches ||
      window.matchMedia('(color-gamut: p3)').matches;

    const ua = navigator.userAgent;
    const isSafari = /safari/i.test(ua) && !/chrome|chromium|android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    setState({
      hdrCapable: hdrCapable || wideGamut,
      wideGamut,
      heicInPicture: isSafari || isIOS,
      ready: true,
    });
  }, []);

  return state;
}
