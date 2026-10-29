import { IBM_Plex_Mono, Inter_Tight } from 'next/font/google';

/** Kroje ofertówki i wizytówki: `--ofb-sans` (nagłówki, liczby) i `--ofb-mono` (etykiety). */
export const offerSans = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--ofb-sans',
  display: 'swap',
});

export const offerMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--ofb-mono',
  display: 'swap',
});

export const offerFontVars = `${offerSans.variable} ${offerMono.variable}`;
