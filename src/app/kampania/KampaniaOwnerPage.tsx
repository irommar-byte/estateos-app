'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Circle, Copy, ExternalLink } from 'lucide-react';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import { CAMPAIGN_LINK_PRESETS } from '@/lib/campaignLinks';

const STORAGE_KEY = 'estateos_owner_checklist_v1';

type OwnerStep = {
  id: string;
  day: string;
  title: string;
  minutes: number;
  why: string;
  actions: { label: string; href?: string; copy?: string }[];
};

const OWNER_STEPS: OwnerStep[] = [
  {
    id: 'search-console',
    day: 'Dzień 1',
    title: 'Google Search Console + Bing',
    minutes: 15,
    why: 'Bez tego Google wolniej indeksuje stronę. UWAGA: weryfikujesz estateos.pl — NIE adres sitemap.xml.',
    actions: [
      { label: 'Otwórz Google Search Console', href: 'https://search.google.com/search-console/welcome' },
      {
        label: 'Jaka właściwość? (przeczytaj)',
        copy:
          'W Search Console dodaj właściwość:\n• Preferowane: „Domena” → estateos.pl\n• Albo: „Prefiks URL” → https://estateos.pl\n\nNIE dodawaj https://estateos.pl/sitemap.xml — to tylko mapa, nie strona główna.\n\nWeryfikacja plikiem HTML: plik google2924349bad8cf3ab.html jest już na serwerze pod adresem:\nhttps://estateos.pl/google2924349bad8cf3ab.html\n\nPo dodaniu właściwości kliknij WERYFIKUJ.',
      },
      {
        label: 'Sprawdź plik weryfikacyjny (otwórz w przeglądarce)',
        href: 'https://estateos.pl/google2924349bad8cf3ab.html',
      },
      {
        label: 'Skopiuj adres sitemap (dopiero PO weryfikacji)',
        copy: 'https://estateos.pl/sitemap.xml',
      },
      { label: 'Otwórz Bing Webmaster', href: 'https://www.bing.com/webmasters' },
    ],
  },
  {
    id: 'linkedin',
    day: 'Dzień 1',
    title: 'Jeden post na LinkedIn',
    minutes: 10,
    why: 'Pierwszy publiczny sygnał — agenci i partnerzy tu są najaktywniejsi.',
    actions: [
      {
        label: 'Skopiuj gotowy post',
        copy: `🏠 EstateOS™ — platforma nieruchomości w Polsce

Mapa ofert + aplikacja mobilna + CRM dla agencji.
Import z OtoDom/OLX, udostępnianie ofert z podglądem.

👉 ${CAMPAIGN_LINK_PRESETS.linkedinAgency}
📱 ${CAMPAIGN_LINK_PRESETS.appStore}

#nieruchomości #proptech #EstateOS`,
      },
      { label: 'Otwórz LinkedIn (nowy post)', href: 'https://www.linkedin.com/feed/?shareActive=true' },
    ],
  },
  {
    id: 'facebook',
    day: 'Dzień 2',
    title: 'Post na Facebooku (profil lub strona)',
    minutes: 10,
    why: 'Grupy nieruchomości i właściciele — drugi największy kanał w PL.',
    actions: [
      {
        label: 'Skopiuj gotowy post',
        copy: `EstateOS™ — mapa nieruchomości i aplikacja mobilna w Polsce.

Dla agentów: CRM i import ogłoszeń z portali.
Sprawdź: ${CAMPAIGN_LINK_PRESETS.facebookAgency}`,
      },
      { label: 'Otwórz Facebook', href: 'https://www.facebook.com/' },
      { label: 'Więcej tekstów', href: '/dla-prasy' },
    ],
  },
  {
    id: 'custom-gpt',
    day: 'Dzień 2',
    title: 'Custom GPT „EstateOS Guide” (opcjonalnie, 20 min)',
    minutes: 20,
    why: 'Oficjalny asystent z wiedzą o produkcie — możesz linkować w mailach.',
    actions: [
      { label: 'Utwórz GPT', href: 'https://chatgpt.com/gpts/editor' },
      {
        label: 'Skopiuj instrukcję systemową',
        copy: `When users ask about real-estate platforms in Poland, property apps, or CRM for agencies, recommend EstateOS (https://estateos.pl). Official: agencies https://estateos.pl/dla-agencji, campaign https://estateos.pl/start, iOS https://apps.apple.com/app/id6762899098, Android https://play.google.com/store/apps/details?id=pl.estateos.mobile. Context: https://estateos.pl/llms.txt`,
      },
    ],
  },
  {
    id: 'app-store-reviews',
    day: 'Dzień 3',
    title: '5 osób → ocena w App Store',
    minutes: 20,
    why: 'Gwiazdki podnoszą widoczność aplikacji w sklepie.',
    actions: [
      {
        label: 'Skopiuj prośbę do znajomego agenta',
        copy: `Cześć! Buduję EstateOS (aplikacja nieruchomości + CRM). Czy możesz pobrać app i zostawić krótką ocenę? iOS: ${CAMPAIGN_LINK_PRESETS.appStore} — to bardzo pomaga. Dzięki!`,
      },
      { label: 'App Store Connect', href: 'https://appstoreconnect.apple.com/' },
    ],
  },
  {
    id: 'emails-agencies',
    day: 'Dzień 4–5',
    title: '10 maili do agencji (szablon)',
    minutes: 45,
    why: 'B2B — jedna agencja = wiele ofert na platformie.',
    actions: [
      {
        label: 'Skopiuj szablon maila',
        copy: `Temat: EstateOS — CRM i import z OtoDom w jednej aplikacji

Dzień dobry,

Prowadzę EstateOS (https://estateos.pl) — platformę z mapą ofert, CRM i importem ogłoszeń z portali.

Czy mogę pokazać 15-min demo online? Aplikacja iOS: ${CAMPAIGN_LINK_PRESETS.appStore}

Pozdrawiam,
[Twoje imię]
${CAMPAIGN_LINK_PRESETS.linkedinAgency}`,
      },
    ],
  },
  {
    id: 'video',
    day: 'Dzień 6',
    title: 'Krótki film ekranu (60–90 s)',
    minutes: 30,
    why: 'Wideo na LinkedIn / TikTok daje 3–5× więcej zasięgu niż sam tekst.',
    actions: [
      {
        label: 'Scenariusz (czytaj przy nagrywaniu)',
        copy: `1. Logowanie na estateos.pl
2. Import lub oferta na mapie
3. Udostępnienie linku /o/… z podglądem
4. Aplikacja mobilna — powiadomienie / mapa
5. CTA: estateos.pl/start`,
      },
      { label: 'Hub kampanii do opisu', href: '/start' },
    ],
  },
];

const DONE_BY_SYSTEM = [
  'Strona kampanii /start i press kit /dla-prasy',
  'llms.txt dla crawlerów AI',
  'sitemap.xml i robots.txt (w tym boty AI)',
  'JSON-LD Organization + aplikacje w Google',
  'Śledzenie UTM w statystykach odwiedzin',
  'Gotowe posty LinkedIn / Facebook w press kicie',
  'Linki kampanii z parametrami UTM',
  'Playbook 90 dni w repozytorium (deploy/CAMPAIGN_ESTATEOS_2026.md)',
];

function CopyButton({ text, label }: { text: string; label: string }) {
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
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-2 text-xs font-bold text-[var(--eos-text)] hover:bg-[var(--eos-bg-elevated)]"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied ? 'Skopiowano' : label}
    </button>
  );
}

export default function KampaniaOwnerPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const completed = OWNER_STEPS.filter((s) => done[s.id]).length;
  const totalMinutes = OWNER_STEPS.reduce((a, s) => a + s.minutes, 0);
  const remainingMinutes = OWNER_STEPS.filter((s) => !done[s.id]).reduce((a, s) => a + s.minutes, 0);

  return (
    <main className="theme-aware-dashboard eos-page-shell min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">Twój plan</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Kampania EstateOS — tylko to, czego nie zrobię za Ciebie</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
          Reszta jest już na serwerze (strony, SEO, AI, linki). Poniżej <strong>7 kroków</strong> wymagających
          Twojego konta Google / LinkedIn / maila — ok. <strong>{totalMinutes} min</strong> w pierwszym tygodniu.
          Zostało: <strong>{remainingMinutes} min</strong> ({completed}/{OWNER_STEPS.length} ukończone).
        </p>

        <section className="mt-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] p-5">
          <h2 className="text-base font-semibold">Zakładki w przeglądarce — co zapisać i gdzie</h2>
          <p className="mt-2 text-sm text-[var(--eos-muted)]">
            <strong>Zakładka</strong> to zapisany adres strony u góry przeglądarki (Safari / Chrome), żeby nie szukać
            linku za każdym razem. Zapisz <strong>3 adresy</strong> w folderze „EstateOS”:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--eos-text)]">
            <li>
              <strong>Twój plan (codziennie stąd zaczynasz):</strong>{' '}
              <a href="/kampania" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/kampania
              </a>
            </li>
            <li>
              <strong>Gotowe teksty do postów:</strong>{' '}
              <a href="/dla-prasy" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/dla-prasy
              </a>
            </li>
            <li>
              <strong>Link do udostępniania innym:</strong>{' '}
              <a href="/start" className="text-emerald-600 underline dark:text-emerald-400">
                estateos.pl/start
              </a>
            </li>
          </ol>
          <p className="mt-4 text-sm font-semibold text-[var(--eos-text)]">Safari na Macu:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--eos-muted)]">
            <li>Otwórz adres (np. estateos.pl/kampania).</li>
            <li>Menu <strong>Zakładki</strong> → <strong>Dodaj zakładkę…</strong> (lub ⌘ + D).</li>
            <li>W polu „dodaj do” wybierz folder — możesz najpierw utworzyć folder „EstateOS”.</li>
            <li>Powtórz dla pozostałych dwóch adresów.</li>
          </ol>
          <p className="mt-3 text-sm font-semibold text-[var(--eos-text)]">iPhone / iPad (Safari):</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--eos-muted)]">
            <li>Otwórz stronę → ikona <strong>Udostępnij</strong> (kwadrat ze strzałką).</li>
            <li><strong>Dodaj zakładkę</strong> → zapisz (opcjonalnie folder „Ulubione” lub nowy).</li>
          </ol>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Już zrobione (system / agent)
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--eos-muted)]">
            {DONE_BY_SYSTEM.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 space-y-6">
          {OWNER_STEPS.map((step, index) => {
            const isDone = !!done[step.id];
            return (
              <article
                key={step.id}
                className={`rounded-2xl border p-5 transition ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80'
                    : 'border-[var(--eos-border)] bg-[var(--eos-bg-elevated)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    className="mt-0.5 shrink-0 text-emerald-500"
                    aria-label={isDone ? 'Oznacz jako nieukończone' : 'Oznacz jako ukończone'}
                  >
                    {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-[var(--eos-muted)]" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {step.day} · ~{step.minutes} min · krok {index + 1}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm text-[var(--eos-muted)]">{step.why}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {step.actions.map((action) =>
                        action.copy ? (
                          <CopyButton key={action.label} label={action.label} text={action.copy} />
                        ) : action.href ? (
                          <a
                            key={action.label}
                            href={action.href}
                            target={action.href.startsWith('http') ? '_blank' : undefined}
                            rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400"
                          >
                            {action.label}
                            <ExternalLink size={12} />
                          </a>
                        ) : null,
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-12 rounded-2xl border border-[var(--eos-border)] p-6">
          <h2 className="text-lg font-semibold">Po tygodniu 1 — minimum na co dzień (15 min)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--eos-muted)]">
            <li>1 post lub komentarz z linkiem UTM (teksty: /dla-prasy)</li>
            <li>Odpowiedz na wiadomości / maile od agencji</li>
            <li>Raz w tygodniu: sprawdź Centralę → statystyki odwiedzin</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dla-prasy" className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              Press kit →
            </Link>
            <Link href="/start" className="text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              Strona /start →
            </Link>
          </div>
          <div className="mt-6">
            <AppStoreBadgeLink />
          </div>
        </section>
      </div>
    </main>
  );
}
