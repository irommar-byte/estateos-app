import type { Metadata } from 'next';
import Link from 'next/link';
import { GALLERYOS_PATHS, GALLERYOS_PHONE_DISPLAY } from '@/lib/galleryOsLegal';

export const metadata: Metadata = {
  title: 'GalleryOS™',
  description: 'Galeria zdjęć i filmów na iPhonie, iPadzie i Apple TV. Biblioteka zostaje na Twoim serwerze.',
  alternates: { canonical: 'https://estateos.pl/galleryos' },
};

export default function GalleryOsHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">GalleryOS™</h1>
      <p className="mt-4">
        Galeria zdjęć i filmów na iPhonie, iPadzie i Apple TV. Biblioteka zostaje na urządzeniu i na serwerze, który sam wskażesz.
      </p>
      <ul className="mt-8 space-y-3">
        <li>
          <Link className="underline" href={GALLERYOS_PATHS.privacyPl}>
            Polityka prywatności
          </Link>
        </li>
        <li>
          <Link className="underline" href={GALLERYOS_PATHS.termsPl}>
            Regulamin
          </Link>
        </li>
        <li>
          <Link className="underline" href={GALLERYOS_PATHS.supportPl}>
            Wsparcie
          </Link>
          <span className="text-neutral-500"> · {GALLERYOS_PHONE_DISPLAY}</span>
        </li>
      </ul>
    </main>
  );
}
