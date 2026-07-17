import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Car, ScanLine, Upload } from 'lucide-react';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import CatalogBrandHero from '@/components/catalog/CatalogBrandHero';
import {
  CatalogHeroActionRow,
  CatalogHeroPrimaryLink,
  CatalogHeroSecondaryLink,
} from '@/components/catalog/CatalogHeroActions';
import OtomotoImportHeroCard from '@/components/cars/OtomotoImportHeroCard';
import { CAMPAIGN_LINK_PRESETS } from '@/lib/campaignLinks';
import { carsOpenGraph, carsTwitter } from '@/lib/carsOgMetadata';
import { ESTATEOS_PUBLIC_URLS } from '@/lib/estateOsPublicFacts';

export const metadata: Metadata = {
  title: 'Wystaw auto na sprzedaż za darmo',
  description:
    'Zastrzeż VIN i rejestrację — kupujący i tak sprawdzi historię pojazdu i OC. Wystaw auto za darmo w EstateOS™Car.',
  openGraph: carsOpenGraph({
    title: 'EstateOS™Car — wystaw auto za darmo',
    description:
      'Zastrzeż dane wrażliwe — kupujący sprawdzi historię i OC bez ujawniania pełnego VIN. Wystawienie za darmo.',
    url: ESTATEOS_PUBLIC_URLS.carsStart,
    siteName: 'EstateOS™Car',
    locale: 'pl_PL',
    type: 'website',
  }),
  twitter: carsTwitter({
    title: 'EstateOS™Car — wystaw auto za darmo',
    description:
      'Zastrzeż dane wrażliwe — kupujący sprawdzi historię i OC bez ujawniania pełnego VIN. Wystawienie za darmo.',
  }),
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsStart },
};

const STEPS = [
  {
    icon: ScanLine,
    title: 'Skanuj dowód lub wypełnij ręcznie',
    body: 'Kod Aztec z dowodu rejestracyjnego uzupełnia markę, model i dane pojazdu.',
  },
  {
    icon: Upload,
    title: 'Dodaj zdjęcia od razu',
    body: 'Miniatury pojawiają się natychmiast — widać postęp wgrywania jak przy nieruchomościach.',
  },
  {
    icon: Car,
    title: 'Opublikuj i odbieraj zapytania',
    body: 'Po rejestracji ogłoszenie trafia do katalogu Cars, a Ty dostajesz powiadomienia.',
  },
] as const;

export default function CarsStartCampaignPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="relative mx-auto max-w-5xl">
        <CatalogBrandHero
          brand="car"
          title="Sprzedajesz auto? Wystaw ogłoszenie w EstateOS™Car"
          description="Profesjonalny katalog samochodów w tym samym koncie co nieruchomości. Bez prowizji portalowej — zdjęcia, mapa, skan dowodu i kontakt z kupującymi."
          stats="Kampania sprzedaży pojazdów — udostępnij link znajomym i w social media"
        >
          <CatalogHeroActionRow>
            <CatalogHeroPrimaryLink brand="car" href="/cars/dodaj">
              Dodaj ogłoszenie
            </CatalogHeroPrimaryLink>
            <CatalogHeroSecondaryLink href="/cars">Przeglądaj katalog</CatalogHeroSecondaryLink>
          </CatalogHeroActionRow>
          <div className="mt-4 max-w-2xl">
            <OtomotoImportHeroCard
              title="Masz ogłoszenie na Otomoto?"
              body="Wklej link — w jeden moment przeniesiesz zdjęcia, opis i całą specyfikację do formularza EstateOS™Car."
              placeholder="https://www.otomoto.pl/osobowe/oferta/…"
              cta="Przenieś"
              loadingLabel="Pobieram…"
            />
          </div>
        </CatalogBrandHero>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-[1.5rem] border border-sky-400/15 bg-[var(--eos-card)] p-5 shadow-[0_18px_50px_rgba(14,165,233,0.06)]"
            >
              <step.icon className="size-6 text-sky-400" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{step.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">Udostępnij kampanię</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Linki gotowe do reklamy</h2>
          <p className="mt-3 max-w-2xl text-sm text-[var(--eos-muted)]">
            Skopiuj adres z parametrami UTM i wklej na LinkedIn, Facebook, Instagram lub w mailu. Pełne teksty postów
            znajdziesz w materiałach prasowych Cars.
          </p>
          <ul className="mt-5 space-y-2 break-all text-xs text-[var(--eos-muted)]">
            <li>
              <span className="font-mono text-sky-600 dark:text-sky-400">carsAddListing:</span>{' '}
              {CAMPAIGN_LINK_PRESETS.carsAddListing}
            </li>
            <li>
              <span className="font-mono text-sky-600 dark:text-sky-400">carsLinkedIn:</span>{' '}
              {CAMPAIGN_LINK_PRESETS.carsLinkedIn}
            </li>
            <li>
              <span className="font-mono text-sky-600 dark:text-sky-400">carsFacebook:</span>{' '}
              {CAMPAIGN_LINK_PRESETS.carsFacebook}
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <CatalogHeroSecondaryLink href="/dla-prasy/samochody">
              Kopiuj gotowe posty
              <ArrowRight size={14} aria-hidden />
            </CatalogHeroSecondaryLink>
            <CatalogHeroSecondaryLink href="/kampania">Plan kampanii</CatalogHeroSecondaryLink>
          </div>
        </section>

        <section className="mt-10 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">Aplikacja mobilna</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--eos-muted)]">
                EstateOS na iPhone i Android — powiadomienia o zapytaniach kupujących i dostęp do ogłoszeń Home + Car.
              </p>
            </div>
            <AppStoreBadgeLink />
          </div>
        </section>
      </div>
    </main>
  );
}
