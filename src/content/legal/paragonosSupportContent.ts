import type { LegalDocumentContent } from '@/content/legal/types';
import { PARAGONOS_PATHS, PARAGONOS_URLS } from '@/lib/paragonOsLegal';

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Wsparcie ParagonOS™',
  metaDescription: 'Pomoc i kontakt dla aplikacji iOS ParagonOS™. Napisz na kontakt@estateos.pl.',
  canonical: PARAGONOS_URLS.supportPl,
  title: 'Wsparcie ParagonOS™',
  updatedLabel: 'Aktualizacja:',
  updated: '12 września 2026 r.',
  intro:
    'Ta strona dotyczy wyłącznie **aplikacji iOS ParagonOS™** (kaucje, paragony, karty lojalnościowe). To nie jest pomoc portalu nieruchomości EstateOS™.',
  sections: [
    {
      title: 'Kontakt',
      paragraphs: [
        'E-mail: kontakt@estateos.pl — w tytule wpisz **ParagonOS**.',
        'Opisz, co się dzieje, i — jeśli możesz — podaj model iPhone’a, wersję iOS oraz wersję Aplikacji (Ustawienia w ParagonOS™).',
      ],
    },
    {
      title: 'Czego nie obejmuje ta skrzynka',
      paragraphs: [
        'Ogłoszenia, konta i płatności portalu nieruchomości zgłaszaj zgodnie z dokumentami EstateOS™, nie tą stroną. Tutaj obsługujemy tylko Aplikację ParagonOS™.',
      ],
    },
    {
      title: 'Dokumenty',
      paragraphs: [
        'Przed instalacją i w App Store obowiązują [Polityka prywatności](/paragonos/polityka-prywatnosci) oraz [Regulamin](/paragonos/regulamin).',
      ],
    },
  ],
  relatedLinks: [
    { label: 'Polityka prywatności', href: PARAGONOS_PATHS.privacyPl },
    { label: 'Regulamin', href: PARAGONOS_PATHS.termsPl },
  ],
  localeLinks: [{ label: 'English', href: PARAGONOS_PATHS.supportEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'ParagonOS™ Support',
  metaDescription: 'Help and contact for the ParagonOS™ iOS app. Email kontakt@estateos.pl.',
  canonical: PARAGONOS_URLS.supportEn,
  title: 'ParagonOS™ Support',
  updatedLabel: 'Updated:',
  updated: '12 September 2026',
  intro:
    'This page is only for the **ParagonOS™ iOS app** (bottle-return tickets, receipts, loyalty cards). It is not support for the EstateOS™ property portal.',
  sections: [
    {
      title: 'Contact',
      paragraphs: [
        'Email: kontakt@estateos.pl — put **ParagonOS** in the subject line.',
        'Describe what happens and, if you can, include iPhone model, iOS version and the App version (Settings inside ParagonOS™).',
      ],
    },
    {
      title: 'What this inbox is not for',
      paragraphs: [
        'Listings, portal accounts and EstateOS™ payments should follow EstateOS™ documents, not this page. We handle only the ParagonOS™ App here.',
      ],
    },
    {
      title: 'Legal',
      paragraphs: [
        'The App is governed by the [Privacy Policy](/paragonos/privacy) and [Terms of Use](/paragonos/terms).',
      ],
    },
  ],
  relatedLinks: [
    { label: 'Privacy Policy', href: PARAGONOS_PATHS.privacyEn },
    { label: 'Terms of Use', href: PARAGONOS_PATHS.termsEn },
  ],
  localeLinks: [{ label: 'Polski', href: PARAGONOS_PATHS.supportPl }],
};

export function getParagonOsSupportContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
