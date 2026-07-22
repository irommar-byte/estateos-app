'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink } from 'lucide-react';
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

const FACEBOOK_HUB = `Szukasz gdzie wystawić za darmo mieszkanie, dom albo samochód?

Na EstateOS™ publikujesz ogłoszenie bez prowizji portalowej — jedno konto Home + Car, mapa i kontakt z kupującymi.

👉 Wystaw za darmo: ${CAMPAIGN_LINK_PRESETS.freeListingFacebook}`;

const FACEBOOK_HOME = `Sprzedajesz mieszkanie lub dom? Wystaw nieruchomość za darmo na EstateOS™Home.

Bez prowizji za podstawową publikację. Ogłoszenie w katalogu i na mapie.

👉 ${CAMPAIGN_LINK_PRESETS.freeHomeFacebook}`;

const FACEBOOK_CAR = `Sprzedajesz auto? Wystaw samochód za darmo w EstateOS™Car.

Zdjęcia, opis, mapa — to samo konto co przy nieruchomościach.

👉 ${CAMPAIGN_LINK_PRESETS.freeCarFacebook}`;

const LINKEDIN_HUB = `EstateOS™ — portal, na którym wystawisz mieszkanie, dom lub samochód za darmo.

Jedno konto, mapa, weryfikacja kontaktu i aplikacja mobilna. Bez prowizji portalowej za podstawową publikację.

Landing: ${CAMPAIGN_LINK_PRESETS.freeListingLinkedIn}

#nieruchomości #samochody #EstateOS #sprzedaż`;

const INSTAGRAM_HUB = `Wystaw za darmo 🏠🚗

Mieszkanie, dom albo auto — EstateOS™ bez prowizji portalowej za publikację.

Link w bio: ${CAMPAIGN_LINK_PRESETS.freeListingInstagram}

#wystawzadarmo #sprzedajzadarmo #nieruchomosci #auta`;

const ADS_HEADLINES = `Wystaw mieszkanie za darmo
Sprzedaj dom bez prowizji
Wystaw auto za darmo
Portal ogłoszeń za darmo
EstateOS — wystaw za 0 zł
Sprzedaj samochód za darmo
Wystaw nieruchomość online`;

const ADS_DESCRIPTIONS = `Mieszkanie, dom lub auto — publikacja podstawowa za darmo. Mapa i aplikacja.
Jedno konto Home + Car. Wystaw ogłoszenie w kilka minut na estateos.pl.
Bez prowizji portalowej za wystawienie. Kupujący piszą bezpośrednio do Ciebie.`;

const ADS_KEYWORDS = `wystaw za darmo
sprzedaj za darmo
wystaw mieszkanie za darmo
wystaw dom za darmo
wystaw nieruchomość za darmo
sprzedaj mieszkanie za darmo
sprzedaj dom za darmo
portal ogłoszeń za darmo
ogłoszenia nieruchomości za darmo
wystaw auto za darmo
sprzedaj samochód za darmo
wystaw samochód na sprzedaż za darmo
ogłoszenia samochodowe za darmo
gdzie wystawić mieszkanie za darmo
gdzie sprzedać auto za darmo
portal samochodowy za darmo`;

const ADS_NEGATIVES = `otomoto
olx
otodom
praca
wynajem auta
carsharing
kredyt
ubezpieczenie oc
komis
dealer`;

export default function FreeListingPressKitClient() {
  return (
    <main className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">Kampania free listing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Wystaw / sprzedaj za darmo — posty i Google Ads
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
          Gotowe teksty z linkami UTM oraz lista fraz do kampanii Search. Landingi:{' '}
          <Link href="/wystaw-za-darmo" className="text-emerald-600 hover:underline dark:text-emerald-400">
            /wystaw-za-darmo
          </Link>
          , nieruchomości, Cars.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">Linki docelowe (UTM)</h2>
          <ul className="space-y-2 text-sm break-all">
            <li>
              <a href={CAMPAIGN_LINK_PRESETS.freeListingGoogle} className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400">
                Google → hub {CAMPAIGN_LINK_PRESETS.freeListingGoogle}
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href={CAMPAIGN_LINK_PRESETS.freeHomeGoogle} className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400">
                Google → nieruchomość {CAMPAIGN_LINK_PRESETS.freeHomeGoogle}
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href={CAMPAIGN_LINK_PRESETS.freeCarGoogle} className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400">
                Google → auto {CAMPAIGN_LINK_PRESETS.freeCarGoogle}
                <ExternalLink size={12} />
              </a>
            </li>
            <li className="text-[var(--eos-muted)]">
              Hub bez UTM:{' '}
              <a href={ESTATEOS_PUBLIC_URLS.freeListing} className="hover:underline">
                {ESTATEOS_PUBLIC_URLS.freeListing}
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Posty social</h2>
          <CopyBlock label="Facebook / grupy — hub" text={FACEBOOK_HUB} />
          <CopyBlock label="Facebook — nieruchomość" text={FACEBOOK_HOME} />
          <CopyBlock label="Facebook — samochód" text={FACEBOOK_CAR} />
          <CopyBlock label="LinkedIn" text={LINKEDIN_HUB} />
          <CopyBlock label="Instagram" text={INSTAGRAM_HUB} />
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">Google Ads — gotowiec</h2>
          <p className="text-sm text-[var(--eos-muted)]">
            Kampania Search, 2–3 grupy reklam: (1) nieruchomość, (2) samochód, (3) ogólne „wystaw/sprzedaj za darmo”.
            Landing odpowiadający intencji grupy.
          </p>
          <CopyBlock label="Nagłówki (RSA)" text={ADS_HEADLINES} />
          <CopyBlock label="Opisy (RSA)" text={ADS_DESCRIPTIONS} />
          <CopyBlock label="Słowa kluczowe (exact / phrase)" text={ADS_KEYWORDS} />
          <CopyBlock label="Negatywy (na start)" text={ADS_NEGATIVES} />
        </section>

        <p className="mt-10 text-center text-sm text-[var(--eos-muted)]">
          <Link href="/dla-prasy" className="hover:underline">
            ← Press kit główny
          </Link>
          {' · '}
          <Link href="/dla-prasy/samochody" className="hover:underline">
            Materiały Cars
          </Link>
        </p>
      </div>
    </main>
  );
}
