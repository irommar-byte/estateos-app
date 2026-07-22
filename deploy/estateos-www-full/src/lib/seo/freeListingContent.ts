import { ESTATEOS_PUBLIC_URLS, ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';

export type SeoFaqItem = { question: string; answer: string };

export const FREE_LISTING_KEYWORDS = [
  'wystaw za darmo',
  'sprzedaj za darmo',
  'wystaw nieruchomość za darmo',
  'wystaw mieszkanie za darmo',
  'wystaw dom za darmo',
  'sprzedaj mieszkanie za darmo',
  'sprzedaj dom za darmo',
  'wystaw auto za darmo',
  'sprzedaj samochód za darmo',
  'portal ogłoszeń za darmo',
  'ogłoszenia nieruchomości za darmo',
  'ogłoszenia samochodowe za darmo',
  'EstateOS',
  'EstateOS Car',
] as const;

export const FREE_LISTING_HUB_FAQ: SeoFaqItem[] = [
  {
    question: 'Czy mogę wystawić mieszkanie, dom lub działkę za darmo?',
    answer:
      'Tak. Na EstateOS™ możesz wystawić nieruchomość za darmo — mieszkanie, dom, działkę i inne typy ofert. Publikacja podstawowa nie wymaga prowizji portalowej. Zaczynasz od formularza „Dodaj ofertę”.',
  },
  {
    question: 'Czy mogę wystawić samochód na sprzedaż za darmo?',
    answer:
      'Tak. EstateOS™Car pozwala wystawić auto na sprzedaż za darmo. To samo konto co przy nieruchomościach — zdjęcia, opis, mapa i kontakt z kupującymi.',
  },
  {
    question: 'Czym EstateOS różni się od dużych portali ogłoszeniowych?',
    answer:
      'EstateOS łączy nieruchomości i samochody w jednym koncie, ma mapę 3D, weryfikację kontaktu oraz aplikację mobilną. Podstawowe wystawienie ogłoszenia jest za darmo — bez prowizji od sprzedaży.',
  },
  {
    question: 'Jak szybko mogę sprzedać lub wynająć przez EstateOS?',
    answer:
      'Po rejestracji i potwierdzeniu e-mail oraz telefonu ogłoszenie trafia do katalogu i na mapę. Kupujący piszą przez wiadomości EstateOS — Ty dostajesz powiadomienia w aplikacji i na stronie.',
  },
  {
    question: 'Czy wystawienie za darmo dotyczy też wynajmu?',
    answer:
      'Tak. Możesz wystawić mieszkanie lub dom na sprzedaż albo wynajem bez opłaty za podstawową publikację. Szczegóły limitów i pakietów znajdziesz w cenniku.',
  },
];

export const FREE_LISTING_HOME_FAQ: SeoFaqItem[] = [
  {
    question: 'Gdzie wystawić mieszkanie za darmo w Polsce?',
    answer:
      'Na estateos.pl — portal EstateOS™Home. Wystawisz mieszkanie, dom lub działkę za darmo, bez prowizji od transakcji za samą publikację.',
  },
  {
    question: 'Jak wystawić dom na sprzedaż za darmo?',
    answer:
      'Wejdź w „Dodaj ofertę”, uzupełnij adres, zdjęcia i cenę, potwierdź kontakt i opublikuj. Ogłoszenie pojawi się w katalogu i na mapie EstateOS.',
  },
  {
    question: 'Czy prywatny właściciel może wystawić nieruchomość bez agencji?',
    answer:
      'Tak. Osoby prywatne wystawiają oferty bezpośrednio. Agencje mają osobny tryb CRM — Ty jako właściciel nie musisz korzystać z pośrednika.',
  },
];

export const FREE_LISTING_CAR_FAQ: SeoFaqItem[] = [
  {
    question: 'Gdzie wystawić samochód na sprzedaż za darmo?',
    answer:
      'W EstateOS™Car na estateos.pl/cars/start. Wystawienie auta jest za darmo — to samo konto co przy nieruchomościach.',
  },
  {
    question: 'Czy mogę przenieść ogłoszenie z Otomoto?',
    answer:
      'Tak. Na stronie startowej Cars wklejasz link z Otomoto — zdjęcia i opis przenoszą się do formularza EstateOS™Car.',
  },
  {
    question: 'Czy VIN jest widoczny dla wszystkich?',
    answer:
      'Możesz zastrzec VIN i rejestrację. Kupujący i tak sprawdzi historię pojazdu i OC w bezpiecznym trybie, bez pełnego ujawniania danych wrażliwych w ogłoszeniu.',
  },
];

export function faqToJsonLd(faqs: SeoFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function howToListJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  steps: { name: string; text: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    step: opts.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function webPageJsonLd(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'EstateOS™',
      url: ESTATEOS_SITE_URL,
    },
    about: [
      { '@type': 'Thing', name: 'Ogłoszenia nieruchomości za darmo' },
      { '@type': 'Thing', name: 'Ogłoszenia samochodowe za darmo' },
    ],
  };
}

export const FREE_LISTING_PATHS = {
  hub: '/wystaw-za-darmo',
  sellAlias: '/sprzedaj-za-darmo',
  home: '/wystaw-nieruchomosc-za-darmo',
} as const;

export const FREE_LISTING_URLS = {
  hub: `${ESTATEOS_SITE_URL}${FREE_LISTING_PATHS.hub}`,
  sellAlias: `${ESTATEOS_SITE_URL}${FREE_LISTING_PATHS.sellAlias}`,
  home: `${ESTATEOS_SITE_URL}${FREE_LISTING_PATHS.home}`,
  cars: ESTATEOS_PUBLIC_URLS.carsStart,
  addHome: `${ESTATEOS_SITE_URL}/dodaj-oferte`,
  addCar: ESTATEOS_PUBLIC_URLS.carsAdd,
} as const;
