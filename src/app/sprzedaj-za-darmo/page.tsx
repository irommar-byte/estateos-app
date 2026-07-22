import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { FREE_LISTING_KEYWORDS, FREE_LISTING_PATHS, FREE_LISTING_URLS } from '@/lib/seo/freeListingContent';

const TITLE = 'Sprzedaj za darmo mieszkanie, dom lub samochód';
const DESCRIPTION =
  'Sprzedaj za darmo nieruchomość lub auto na EstateOS™. Wystaw mieszkanie, dom albo samochód bez prowizji portalowej za publikację.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: {
    title: `${TITLE} | EstateOS™`,
    description: DESCRIPTION,
    url: FREE_LISTING_URLS.sellAlias,
    locale: 'pl_PL',
    type: 'website',
  },
  alternates: { canonical: FREE_LISTING_URLS.hub },
  robots: { index: true, follow: true },
};

/** Alias SEO dla frazy „sprzedaj za darmo” → kanoniczny hub „wystaw za darmo”. */
export default function SprzedajZaDarmoPage() {
  permanentRedirect(FREE_LISTING_PATHS.hub);
}
