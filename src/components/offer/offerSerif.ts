import { Fraunces } from 'next/font/google';

/** Szeryfowy krój wizytówki i ofertówki — zmienna `--ofb-serif`. */
export const offerSerif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--ofb-serif',
  display: 'swap',
});
