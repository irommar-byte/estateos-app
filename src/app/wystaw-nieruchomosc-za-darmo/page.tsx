import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Home, LandPlot } from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';
import SeoFaqSection from '@/components/seo/SeoFaqSection';
import {
  FREE_LISTING_HOME_FAQ,
  FREE_LISTING_KEYWORDS,
  FREE_LISTING_URLS,
  howToListJsonLd,
  webPageJsonLd,
} from '@/lib/seo/freeListingContent';
import { freeListingOpenGraph, freeListingTwitter } from '@/lib/freeListingOgMetadata';

const TITLE = 'Wystaw nieruchomość za darmo — mieszkanie, dom, działka';
const DESCRIPTION =
  'Wystaw mieszkanie, dom lub działkę na sprzedaż albo wynajem za darmo w EstateOS™Home. Portal ogłoszeń nieruchomości bez prowizji za publikację.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: freeListingOpenGraph(
    {
      title: `${TITLE} | EstateOS™Home`,
      description: DESCRIPTION,
      url: FREE_LISTING_URLS.home,
      siteName: 'EstateOS™Home',
      locale: 'pl_PL',
      type: 'website',
    },
    'home',
  ),
  twitter: freeListingTwitter(
    {
      title: `${TITLE} | EstateOS™Home`,
      description: DESCRIPTION,
    },
    'home',
  ),
  alternates: { canonical: FREE_LISTING_URLS.home },
  robots: { index: true, follow: true },
};

const TYPES = [
  {
    icon: Building2,
    title: 'Mieszkanie za darmo',
    body: 'Wystaw mieszkanie na sprzedaż lub wynajem — zdjęcia, mapa, kontakt z kupującymi.',
  },
  {
    icon: Home,
    title: 'Dom na sprzedaż za darmo',
    body: 'Opublikuj dom bez opłaty portalowej. Ogłoszenie w katalogu i na mapie EstateOS.',
  },
  {
    icon: LandPlot,
    title: 'Działka i inne',
    body: 'Działki, lokale i inne typy — ten sam darmowy start publikacji dla właścicieli.',
  },
] as const;

export default function WystawNieruchomoscZaDarmoPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <JsonLd
        data={[
          webPageJsonLd({ name: TITLE, description: DESCRIPTION, url: FREE_LISTING_URLS.home }),
          howToListJsonLd({
            name: 'Jak wystawić mieszkanie lub dom za darmo',
            description: DESCRIPTION,
            url: FREE_LISTING_URLS.home,
            steps: [
              { name: 'Otwórz formularz', text: 'Wejdź w Dodaj ofertę na estateos.pl.' },
              { name: 'Opisz nieruchomość', text: 'Adres, metraż, cena, zdjęcia i udogodnienia.' },
              { name: 'Opublikuj', text: 'Potwierdź e-mail i telefon — ogłoszenie idzie na żywo.' },
            ],
          }),
        ]}
      />

      <div className="relative mx-auto max-w-5xl">
        <header className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.12] via-[var(--eos-card)] to-emerald-500/[0.04] p-6 sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            EstateOS™Home
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Wystaw nieruchomość za darmo — mieszkanie, dom, działka
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--eos-muted)] sm:text-lg">
            Chcesz <strong className="font-semibold text-[var(--eos-text)]">sprzedać mieszkanie za darmo</strong> albo
            wystawić dom bez prowizji portalowej? EstateOS™Home to miejsce, w którym prywatni właściciele publikują
            oferty i docierają do kupujących na mapie.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dodaj-oferte"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_12px_32px_rgba(16,185,129,0.28)] transition hover:brightness-105"
            >
              Wystaw za darmo
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link
              href="/wystaw-za-darmo"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--eos-text)] transition hover:border-emerald-400/40"
            >
              Także samochody
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {TYPES.map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border border-emerald-400/15 bg-[var(--eos-card)] p-5 shadow-[0_18px_50px_rgba(16,185,129,0.06)]"
            >
              <item.icon className="size-6 text-emerald-500" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{item.body}</p>
            </div>
          ))}
        </section>

        <SeoFaqSection
          title="Nieruchomości za darmo — FAQ"
          intro="Gdzie wystawić mieszkanie lub dom za darmo w Polsce — krótkie odpowiedzi."
          items={FREE_LISTING_HOME_FAQ}
        />

        <p className="mt-8 text-center text-sm text-[var(--eos-muted)]">
          Szukasz auta?{' '}
          <Link href="/cars/start" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
            Wystaw samochód za darmo w EstateOS™Car
          </Link>
        </p>
      </div>
    </main>
  );
}
