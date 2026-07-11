import { CAMPAIGN_LINK_PRESETS } from "@/lib/campaignLinks";
import type { Locale } from "./config";

export type KampaniaOwnerStep = {
  id: string;
  day: string;
  title: string;
  minutes: number;
  why: string;
  actions: { label: string; href?: string; copy?: string }[];
};

const PL_STEPS: KampaniaOwnerStep[] = [
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

const PL_DONE: string[] = [
  'Strona kampanii /start i press kit /dla-prasy',
  'llms.txt dla crawlerów AI',
  'sitemap.xml i robots.txt (w tym boty AI)',
  'JSON-LD Organization + aplikacje w Google',
  'Śledzenie UTM w statystykach odwiedzin',
  'Gotowe posty LinkedIn / Facebook w press kicie',
  'Linki kampanii z parametrami UTM',
  'Playbook 90 dni w repozytorium (deploy/CAMPAIGN_ESTATEOS_2026.md)',
];

const EN_DONE: string[] = [
  "Campaign page /start and press kit /dla-prasy",
  "llms.txt for AI crawlers",
  "sitemap.xml and robots.txt (including AI bots)",
  "JSON-LD Organization + apps in Google",
  "UTM tracking in visit statistics",
  "Ready LinkedIn / Facebook posts in press kit",
  "Campaign links with UTM parameters",
  "90-day playbook in repository (deploy/CAMPAIGN_ESTATEOS_2026.md)",
];

const UK_DONE: string[] = [
  "Сторінка кампанії /start і press kit /dla-prasy",
  "llms.txt для AI-краулерів",
  "sitemap.xml і robots.txt (включно з AI-ботами)",
  "JSON-LD Organization + застосунки в Google",
  "Відстеження UTM у статистиці відвідувань",
  "Готові пости LinkedIn / Facebook у press kit",
  "Посилання кампанії з UTM",
  "Плейбук 90 днів у репозиторії (deploy/CAMPAIGN_ESTATEOS_2026.md)",
];

export function getKampaniaOwnerSteps(locale: Locale): KampaniaOwnerStep[] {
  if (locale === "en" || locale === "uk") {
    return PL_STEPS.map((s) => ({
      ...s,
      day: locale === "en" ? s.day.replace("Dzień", "Day") : s.day.replace("Dzień", "День"),
    }));
  }
  return PL_STEPS;
}

export function getKampaniaDoneBySystem(locale: Locale): string[] {
  if (locale === "en") return EN_DONE;
  if (locale === "uk") return UK_DONE;
  return PL_DONE;
}
