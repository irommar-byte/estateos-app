import type { LegalDocumentContent } from '@/content/legal/types';
import { GALLERYOS_CONTACT_EMAIL, GALLERYOS_PATHS, GALLERYOS_PHONE_DISPLAY, GALLERYOS_URLS } from '@/lib/galleryOsLegal';

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Wsparcie GalleryOS™',
  metaDescription: 'Pomoc dla aplikacji GalleryOS™ na iPhone’a, iPada i Apple TV.',
  canonical: GALLERYOS_URLS.supportPl,
  title: 'Wsparcie GalleryOS™',
  updatedLabel: 'Aktualizacja:',
  updated: '20 października 2026 r.',
  intro:
    'Ta strona dotyczy wyłącznie **GalleryOS™** — galerii zdjęć i filmów na iPhonie, iPadzie i Apple TV. To nie jest pomoc portalu nieruchomości EstateOS™.',
  sections: [
    {
      title: 'Kontakt',
      paragraphs: [
        `E-mail: ${GALLERYOS_CONTACT_EMAIL} — w tytule wpisz **GalleryOS**.`,
        `Telefon: ${GALLERYOS_PHONE_DISPLAY}.`,
        'Napisz, co się dzieje, i podaj model urządzenia, wersję systemu oraz wersję Aplikacji.',
      ],
    },
    {
      title: 'Zanim napiszesz',
      paragraphs: [
        'Biblioteka na iPhonie działa bez serwera. Kopia i Apple TV wymagają miejsca, które sam wskazujesz (NAS albo WebDAV). Hasło do serwera jest w pęku kluczy iCloud, nie u operatora aplikacji.',
        'Po trzech dniach od pierwszego uruchomienia na danym Apple ID aplikacja i telewizor czekają na plan: rok, miesiąc albo zakup na stałe. Pliki już wysłane na serwer zostają na serwerze.',
      ],
    },
    {
      title: 'Dokumenty',
      paragraphs: [
        'W App Store obowiązują [Polityka prywatności](/galleryos/polityka-prywatnosci) oraz [Regulamin](/galleryos/regulamin).',
      ],
    },
  ],
  relatedLinks: [
    { label: 'Polityka prywatności', href: GALLERYOS_PATHS.privacyPl },
    { label: 'Regulamin', href: GALLERYOS_PATHS.termsPl },
  ],
  localeLinks: [{ label: 'English', href: GALLERYOS_PATHS.supportEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'GalleryOS™ Support',
  metaDescription: 'Help for the GalleryOS™ app on iPhone, iPad and Apple TV.',
  canonical: GALLERYOS_URLS.supportEn,
  title: 'GalleryOS™ Support',
  updatedLabel: 'Updated:',
  updated: '20 October 2026',
  intro:
    'This page is only for **GalleryOS™**, the photo and video gallery on iPhone, iPad and Apple TV. It is not support for the EstateOS™ property portal.',
  sections: [
    {
      title: 'Contact',
      paragraphs: [
        `Email: ${GALLERYOS_CONTACT_EMAIL} — put **GalleryOS** in the subject.`,
        `Phone: ${GALLERYOS_PHONE_DISPLAY}.`,
        'Describe what happens and include the device model, the system version and the App version.',
      ],
    },
    {
      title: 'Before you write',
      paragraphs: [
        'The library on the iPhone works without a server. Backup and Apple TV need a place you name yourself (a NAS or WebDAV). The server password stays in iCloud Keychain, not with the app operator.',
        'Three days after the first launch on an Apple ID, the app and the television wait for a plan: a year, a month, or a one-time purchase. Files already sent to the server stay on the server.',
      ],
    },
    {
      title: 'Documents',
      paragraphs: [
        'The App Store listing uses the [Privacy Policy](/galleryos/privacy) and the [Terms of Use](/galleryos/terms).',
      ],
    },
  ],
  relatedLinks: [
    { label: 'Privacy Policy', href: GALLERYOS_PATHS.privacyEn },
    { label: 'Terms of Use', href: GALLERYOS_PATHS.termsEn },
  ],
  localeLinks: [{ label: 'Polski', href: GALLERYOS_PATHS.supportPl }],
};

export function getGalleryOsSupportContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
