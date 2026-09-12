import type { Metadata } from 'next';
import Link from 'next/link';
import { PARAGONOS_PATHS, PARAGONOS_URLS } from '@/lib/paragonOsLegal';

export const metadata: Metadata = {
  title: 'ParagonOS™',
  description:
    'Dokumenty prawne aplikacji iOS ParagonOS™ — polityka prywatności, regulamin i wsparcie. Osobny produkt od EstateOS™.',
  alternates: { canonical: PARAGONOS_URLS.home },
  robots: { index: true, follow: true },
};

export default function ParagonOsHubPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">ParagonOS™</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
        Aplikacja iOS do kaucji z butelkomatów, paragonów i kart lojalnościowych. Poniższe dokumenty
        dotyczą wyłącznie ParagonOS™ — nie portalu nieruchomości EstateOS™.
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Kontakt: <a className="text-emerald-700 underline" href="mailto:kontakt@estateos.pl">kontakt@estateos.pl</a>
        {' '}
        (tytuł wiadomości: ParagonOS).
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Polski</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.privacyPl}>
              Polityka prywatności
            </Link>
          </li>
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.termsPl}>
              Regulamin
            </Link>
          </li>
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.supportPl}>
              Wsparcie
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">English</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.privacyEn}>
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.termsEn}>
              Terms of Use
            </Link>
          </li>
          <li>
            <Link className="text-emerald-700 underline" href={PARAGONOS_PATHS.supportEn}>
              Support
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
