import {
  ESTATEOS_APP_STORE_URL,
  ESTATEOS_PLAY_STORE_URL,
} from '@/lib/estateosAppLinks';
import {
  ESTATEOS_LEGAL_NAME,
  ESTATEOS_PUBLIC_URLS,
  ESTATEOS_SITE_URL,
  ESTATEOS_TAGLINE_EN,
} from '@/lib/estateOsPublicFacts';

export default function EstateOsStructuredData() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ESTATEOS_LEGAL_NAME,
    legalName: ESTATEOS_LEGAL_NAME,
    url: ESTATEOS_SITE_URL,
    logo: `${ESTATEOS_SITE_URL}/icon.svg`,
    description: ESTATEOS_TAGLINE_EN,
    sameAs: [ESTATEOS_PUBLIC_URLS.appStore, ESTATEOS_PUBLIC_URLS.playStore],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EstateOS™',
    url: ESTATEOS_SITE_URL,
    description: ESTATEOS_TAGLINE_EN,
    inLanguage: ['pl', 'en', 'uk'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${ESTATEOS_SITE_URL}/oferty?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
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

  const payload = [organization, website, iosApp, androidApp];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
