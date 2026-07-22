import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Car, Home, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';
import SeoFaqSection from '@/components/seo/SeoFaqSection';
import {
  FREE_LISTING_HUB_FAQ,
  FREE_LISTING_KEYWORDS,
  FREE_LISTING_URLS,
  howToListJsonLd,
  webPageJsonLd,
} from '@/lib/seo/freeListingContent';
import { freeListingOpenGraph, freeListingTwitter } from '@/lib/freeListingOgMetadata';

const TITLE = 'Wystaw za darmo mieszkanie, dom lub samochód';
const DESCRIPTION =
  'Portal EstateOS™ — wystaw nieruchomość lub samochód na sprzedaż za darmo. Mieszkanie, dom, działka i auto w jednym koncie. Bez prowizji portalowej za publikację.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: freeListingOpenGraph({
    title: `${TITLE} | EstateOS™`,
    description: DESCRIPTION,
    url: FREE_LISTING_URLS.hub,
    siteName: 'EstateOS™',
    locale: 'pl_PL',
    type: 'website',
  }),
  twitter: freeListingTwitter({
    title: `${TITLE} | EstateOS™`,
    description: DESCRIPTION,
  }),
  alternates: { canonical: FREE_LISTING_URLS.hub },
  robots: { index: true, follow: true },
};

const PATHS = [
  {
    href: '/wystaw-nieruchomosc-za-darmo',
    icon: Home,
    title: 'Wystaw nieruchomość za darmo',
    body: 'Mieszkanie, dom, działka — sprzedaż lub wynajem. Publikacja podstawowa bez opłaty portalowej.',
    cta: 'Oferty Home',
    accent: 'text-emerald-500',
    border: 'border-emerald-400/20',
  },
  {
    href: '/cars/start',
    icon: Car,
    title: 'Wystaw samochód za darmo',
    body: 'EstateOS™Car — ogłoszenie auta za darmo, skan dowodu, zdjęcia i kontakt z kupującymi.',
    cta: 'Oferty Car',
    accent: 'text-sky-500',
    border: 'border-sky-400/20',
  },
] as const;

export default function WystawZaDarmoPage() {
  const howTo = howToListJsonLd({
    name: 'Jak wystawić ogłoszenie za darmo na EstateOS',
    description: DESCRIPTION,
    url: FREE_LISTING_URLS.hub,
    steps: [
      {
        name: 'Wybierz kategorię',
        text: 'Nieruchomość (mieszkanie, dom, działka) albo samochód w EstateOS™Car.',
      },
      {
        name: 'Uzupełnij ogłoszenie',
        text: 'Dodaj zdjęcia, opis, lokalizację i cenę w formularzu online.',
      },
      {
        name: 'Potwierdź kontakt i publikuj',
        text: 'Załóż konto, potwierdź e-mail oraz telefon — ogłoszenie trafia do katalogu i na mapę.',
      },
    ],
  });

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <JsonLd
        data={[
          webPageJsonLd({ name: TITLE, description: DESCRIPTION, url: FREE_LISTING_URLS.hub }),
          howTo,
        ]}
      />

      <div className="relative mx-auto max-w-5xl">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-gradient-to-br from-emerald-500/[0.10] via-[var(--eos-card)] to-sky-500/[0.08] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            Portal ogłoszeń za darmo
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Wystaw za darmo mieszkanie, dom lub samochód
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--eos-muted)] sm:text-lg">
            Szukasz gdzie <strong className="font-semibold text-[var(--eos-text)]">sprzedać za darmo</strong> nieruchomość
            albo auto? EstateOS™ to polski portal: jedno konto, mapa, weryfikacja kontaktu i aplikacja mobilna — bez
            prowizji od samej publikacji ogłoszenia.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dodaj-oferte"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_12px_32px_rgba(16,185,129,0.28)] transition hover:brightness-105"
            >
              Wystaw nieruchomość
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link
              href="/cars/dodaj"
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/45 bg-gradient-to-b from-sky-400 to-sky-600 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_12px_32px_rgba(14,165,233,0.28)] transition hover:brightness-105"
            >
              Wystaw samochód
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {PATHS.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className={`group rounded-[1.5rem] border bg-[var(--eos-card)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] transition hover:brightness-[1.02] ${path.border}`}
            >
              <path.icon className={`size-7 ${path.accent}`} aria-hidden />
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{path.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{path.body}</p>
              <span className={`mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${path.accent}`}>
                {path.cta}
                <ArrowRight size={12} className="transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Publikacja za 0 zł',
              body: 'Podstawowe ogłoszenie mieszkania, domu lub auta — bez opłaty portalowej za wystawienie.',
            },
            {
              icon: MapPin,
              title: 'Mapa i katalog',
              body: 'Oferty widać na mapie i w katalogu EstateOS — kupujący łatwiej Cię znajdują.',
            },
            {
              icon: Sparkles,
              title: 'Jedno konto Home + Car',
              body: 'Nieruchomości i samochody w tym samym profilu, z powiadomieniami i wiadomościami.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5"
            >
              <item.icon className="size-6 text-emerald-500" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{item.body}</p>
            </div>
          ))}
        </section>

        <SeoFaqSection
          title="Wystaw lub sprzedaj za darmo — pytania"
          intro="Odpowiedzi pod frazy, które ludzie wpisują w Google: wystaw mieszkanie za darmo, sprzedaj dom, wystaw auto."
          items={FREE_LISTING_HUB_FAQ}
        />

        <section className="mt-8 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Szybkie linki</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--eos-muted)] sm:grid-cols-2">
            <li>
              <Link href="/dodaj-oferte" className="text-emerald-600 hover:underline dark:text-emerald-400">
                Formularz: dodaj ofertę nieruchomości
              </Link>
            </li>
            <li>
              <Link href="/cars/dodaj" className="text-sky-600 hover:underline dark:text-sky-400">
                Formularz: dodaj ogłoszenie samochodu
              </Link>
            </li>
            <li>
              <Link href="/dla-prywatnych" className="hover:underline">
                Dla osób prywatnych
              </Link>
            </li>
            <li>
              <Link href="/cennik" className="hover:underline">
                Cennik — co jest za darmo
              </Link>
            </li>
            <li>
              <Link href="/oferty" className="hover:underline">
                Katalog nieruchomości
              </Link>
            </li>
            <li>
              <Link href="/cars" className="hover:underline">
                Katalog samochodów
              </Link>
            </li>
            <li>
              <Link href="/dla-prasy/wystaw-za-darmo" className="hover:underline">
                Gotowe posty i Google Ads
              </Link>
            </li>
            <li>
              <Link href="/sprzedaj-za-darmo" className="hover:underline">
                Sprzedaj za darmo
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
