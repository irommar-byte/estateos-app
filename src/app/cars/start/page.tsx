import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Car, ScanLine, Upload } from 'lucide-react';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import CatalogBrandHero from '@/components/catalog/CatalogBrandHero';
import { CAMPAIGN_LINK_PRESETS } from '@/lib/campaignLinks';
import { ESTATEOS_PUBLIC_URLS } from '@/lib/estateOsPublicFacts';

export const metadata: Metadata = {
  title: 'Wystaw auto na sprzedaż | EstateOS™Car',
  description:
    'Dodaj ogłoszenie samochodu w EstateOS™Car — skan dowodu, galeria zdjęć, mapa i powiadomienia o zapytaniach. Jedno konto EstateOS.',
  openGraph: {
    title: 'EstateOS™Car — sprzedaj auto szybciej',
    description: 'Profesjonalny katalog samochodów i prosty formularz publikacji ogłoszenia.',
    url: ESTATEOS_PUBLIC_URLS.carsStart,
  },
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
          <Link
            href="/cars/dodaj"
            className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300 transition hover:bg-sky-500/25"
          >
            Dodaj ogłoszenie auta
          </Link>
          <Link
            href="/cars"
            className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2 text-xs font-black uppercase tracking-[0.14em] transition hover:border-sky-400/30"
          >
            Przeglądaj katalog
          </Link>
          <Link
            href="/dla-prasy/samochody"
            className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2 text-xs font-black uppercase tracking-[0.14em] transition hover:border-sky-400/30"
          >
            Materiały do promocji
          </Link>
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
            <Link
              href="/dla-prasy/samochody"
              className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/10 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-sky-300"
            >
              Kopiuj gotowe posty
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/kampania"
              className="inline-flex rounded-full border border-[var(--eos-border)] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em]"
            >
              Plan kampanii właściciela
            </Link>
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
