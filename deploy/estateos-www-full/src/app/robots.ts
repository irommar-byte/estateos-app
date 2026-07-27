import type { MetadataRoute } from 'next';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/centrala',
          '/admin',
          '/api/',
          '/moje-konto',
          '/moj-kierunek',
          '/dealroom/',
          '/klient/',
          '/edytuj-oferte/',
        ],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'anthropic-ai', 'ClaudeBot', 'PerplexityBot'],
        allow: [
          '/',
          '/llms.txt',
          '/wystaw-za-darmo',
          '/sprzedaj-za-darmo',
          '/wystaw-nieruchomosc-za-darmo',
          '/cars',
          '/cars/start',
          '/cars/dodaj',
          '/dodaj-oferte',
          '/dla-prasy',
          '/dla-agencji',
          '/dla-prywatnych',
          '/oferty',
          '/cennik',
          '/start',
        ],
        disallow: ['/centrala', '/api/', '/moje-konto'],
      },
    ],
    sitemap: `${ESTATEOS_SITE_URL}/sitemap.xml`,
    host: ESTATEOS_SITE_URL,
  };
}
