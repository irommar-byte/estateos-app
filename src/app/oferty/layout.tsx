import type { Metadata } from 'next';
import { FREE_LISTING_KEYWORDS } from '@/lib/seo/freeListingContent';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';

export const metadata: Metadata = {
  title: 'Oferty nieruchomości — katalog i mapa',
  description:
    'Przeglądaj mieszkania, domy i działki na EstateOS™. Kupuj lub wynajmuj — a jeśli sprzedajesz, wystaw nieruchomość za darmo.',
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: {
    title: 'Oferty nieruchomości | EstateOS™',
    description: 'Katalog i mapa ofert. Wystaw mieszkanie lub dom za darmo.',
    url: `${ESTATEOS_SITE_URL}/oferty`,
    locale: 'pl_PL',
    type: 'website',
  },
  alternates: { canonical: `${ESTATEOS_SITE_URL}/oferty` },
};

export default function OfertyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
