import {
  ESTATEOS_APP_STORE_URL,
  ESTATEOS_PLAY_STORE_URL,
} from '@/lib/estateosAppLinks';
import {
  ESTATEOS_LEGAL_NAME,
  ESTATEOS_PUBLIC_URLS,
  ESTATEOS_SITE_URL,
  ESTATEOS_TAGLINE_PL,
} from '@/lib/estateOsPublicFacts';
import { FREE_LISTING_URLS } from '@/lib/seo/freeListingContent';

export default function EstateOsStructuredData() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ESTATEOS_LEGAL_NAME,
    legalName: ESTATEOS_LEGAL_NAME,
    url: ESTATEOS_SITE_URL,
    logo: `${ESTATEOS_SITE_URL}/icon.svg`,
    description: ESTATEOS_TAGLINE_PL,
    sameAs: [ESTATEOS_PUBLIC_URLS.appStore, ESTATEOS_PUBLIC_URLS.playStore],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EstateOS™',
    url: ESTATEOS_SITE_URL,
    description:
      'Wystaw mieszkanie, dom lub samochód za darmo. Portal ogłoszeń EstateOS™ — mapa, katalog i aplikacja.',
    inLanguage: ['pl', 'en', 'uk'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${ESTATEOS_SITE_URL}/oferty?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const freeListingService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Wystaw ogłoszenie za darmo',
    serviceType: 'Portal ogłoszeń nieruchomości i samochodów',
    provider: { '@type': 'Organization', name: ESTATEOS_LEGAL_NAME, url: ESTATEOS_SITE_URL },
    areaServed: { '@type': 'Country', name: 'Poland' },
    url: FREE_LISTING_URLS.hub,
    description:
      'Bezpłatna publikacja ogłoszeń: mieszkanie, dom, działka i samochód na sprzedaż lub wynajem.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'PLN',
      description: 'Podstawowa publikacja ogłoszenia za darmo',
    },
  };

  const iosApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'EstateOS',
    operatingSystem: 'iOS',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    url: ESTATEOS_APP_STORE_URL,
  };

  const androidApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'EstateOS',
    operatingSystem: 'Android',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    url: ESTATEOS_PLAY_STORE_URL,
  };

  const payload = {
    '@context': 'https://schema.org',
    '@graph': [organization, website, freeListingService, iosApp, androidApp].map((node) => {
      const { ['@context']: _context, ...rest } = node as Record<string, unknown> & { '@context'?: string };
      void _context;
      return rest;
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
