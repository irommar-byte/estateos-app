'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink } from 'lucide-react';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import { CAMPAIGN_LINK_PRESETS } from '@/lib/campaignLinks';
import { ESTATEOS_PUBLIC_URLS } from '@/lib/estateOsPublicFacts';

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--eos-text)] hover:bg-[var(--eos-bg)]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--eos-text)]">{text}</pre>
    </div>
  );
}

const LINKEDIN_CARS = `🚗 EstateOS™Car — wystaw auto na sprzedaż w kilka minut

Skan dowodu rejestracyjnego, galeria zdjęć, mapa i kontakt z kupującymi — jedno konto EstateOS (Home + Car).

👉 Dodaj ogłoszenie: ${CAMPAIGN_LINK_PRESETS.carsAddListing}
📋 Katalog aut: ${CAMPAIGN_LINK_PRESETS.carsCatalog}

#samochody #auta #EstateOS #sprzedaż`;

const FACEBOOK_CARS = `Sprzedajesz auto? Na EstateOS™Car dodasz ogłoszenie bez prowizji portalowej — zdjęcia, opis, lokalizacja i powiadomienia o zapytaniach.

Wystaw auto: ${CAMPAIGN_LINK_PRESETS.carsAddListing}`;

const INSTAGRAM_CARS = `Auto na sprzedaż? 🚗

EstateOS™Car — szybkie ogłoszenie, skan dowodu, galeria zdjęć i kontakt z kupującymi w jednym miejscu.

Link w bio / stories: ${CAMPAIGN_LINK_PRESETS.carsInstagram}`;

const PRESS_BLURB_PL = `EstateOS™Car (estateos.pl/cars) to moduł sprzedaży pojazdów w ekosystemie EstateOS — wspólne konto z rynkiem nieruchomości, skan kodu Aztec z dowodu rejestracyjnego, galeria zdjęć, mapa lokalizacji i bezpośredni kontakt ze sprzedającym. Ogłoszenie można opublikować po szybkiej rejestracji konta.`;

export default function CarsPressKitClient() {
  return (
    <main className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-500">Kampania Cars</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          EstateOS™Car — materiały do promocji sprzedaży aut
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
          Gotowe teksty i linki UTM do LinkedIn, Facebooka, Instagrama i maili. Kopiuj i promuj możliwość dodania
          pojazdu na sprzedaż w EstateOS™Car.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">Oficjalne linki Cars</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={ESTATEOS_PUBLIC_URLS.carsStart} className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400">
                {ESTATEOS_PUBLIC_URLS.carsStart}
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href={ESTATEOS_PUBLIC_URLS.carsAdd} className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400">
                {ESTATEOS_PUBLIC_URLS.carsAdd}
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href={ESTATEOS_PUBLIC_URLS.carsCatalog} className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400">
                {ESTATEOS_PUBLIC_URLS.carsCatalog}
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href={ESTATEOS_PUBLIC_URLS.carsPress} className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400">
                {ESTATEOS_PUBLIC_URLS.carsPress}
                <ExternalLink size={12} />
              </a>
            </li>
          </ul>
          <div className="pt-2">
            <AppStoreBadgeLink />
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">Gotowe posty — sprzedaż aut</h2>
          <CopyBlock label="LinkedIn" text={LINKEDIN_CARS} />
          <CopyBlock label="Facebook / grupy motoryzacyjne" text={FACEBOOK_CARS} />
          <CopyBlock label="Instagram / stories" text={INSTAGRAM_CARS} />
          <CopyBlock label="Nota prasowa (PL)" text={PRESS_BLURB_PL} />
        </section>

        <section className="mt-10 rounded-2xl border border-sky-400/25 bg-sky-500/5 p-5">
          <h2 className="text-lg font-semibold">Linki kampanii Cars (UTM)</h2>
          <p className="mt-2 text-sm text-[var(--eos-muted)]">
            Wklej w reklamy i posty — ruch będzie oznaczony w statystykach odwiedzin.
          </p>
          <ul className="mt-4 space-y-2 break-all text-xs">
            {Object.entries(CAMPAIGN_LINK_PRESETS)
              .filter(([key]) => key.startsWith('cars'))
              .map(([key, url]) => (
                <li key={key}>
                  <span className="font-mono text-[var(--eos-muted)]">{key}:</span> {url}
                </li>
              ))}
          </ul>
        </section>

        <div className="mt-10 text-center">
          <Link
            href="/cars/start"
            className="mr-3 inline-flex rounded-full border border-sky-400/40 px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300"
          >
            Strona kampanii Cars
          </Link>
          <Link
            href="/cars/dodaj"
            className="inline-flex rounded-full bg-sky-500 px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white"
          >
            Dodaj ogłoszenie auta
          </Link>
        </div>
      </div>
    </main>
  );
}
