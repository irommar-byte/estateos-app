import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Czcionka Inter z polskimi znakami dla obrazków podglądu linków (Facebook, Messenger, WhatsApp).
 * Domyślna czcionka `next/og` nie ma ą, ę, ł, ś, ć, ń, ź, ż — bez tego litery znikały
 * albo dociągały się w locie w innym kroju („krzaczki” w pogrubionych nagłówkach).
 * Pliki: public/fonts/og (podzbiór Latin + Latin Extended-A, licencja SIL OFL).
 */
type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: 'normal' };

let cached: Promise<OgFont[]> | null = null;

async function readFont(file: string): Promise<ArrayBuffer> {
  const buffer = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'og', file));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export function loadOgFonts(): Promise<OgFont[]> {
  if (!cached) {
    cached = Promise.all([
      readFont('Inter-regular.ttf'),
      readFont('Inter-semibold.ttf'),
      readFont('Inter-bold.ttf'),
    ])
      .then(([regular, semibold, bold]) => [
        { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
        { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
        { name: 'Inter', data: bold, weight: 800 as const, style: 'normal' as const },
      ])
      .catch((error) => {
        cached = null;
        console.error('[og] nie udało się wczytać czcionek', error);
        return [];
      });
  }
  return cached;
}
