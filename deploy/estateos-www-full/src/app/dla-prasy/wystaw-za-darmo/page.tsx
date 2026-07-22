import type { Metadata } from 'next';
import FreeListingPressKitClient from './FreeListingPressKitClient';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';
import { freeListingOpenGraph, freeListingTwitter } from '@/lib/freeListingOgMetadata';

export const metadata: Metadata = {
  title: 'Kampania: wystaw za darmo — posty i Ads',
  description:
    'Gotowe posty social media i frazy Google Ads do kampanii „wystaw / sprzedaj za darmo” EstateOS™ (mieszkanie, dom, samochód).',
  openGraph: freeListingOpenGraph({
    title: 'EstateOS™ — materiały kampanii wystaw za darmo',
    description: 'Kopiuj posty i linki UTM. Lista fraz do Google Ads.',
    url: `${ESTATEOS_SITE_URL}/dla-prasy/wystaw-za-darmo`,
    locale: 'pl_PL',
    type: 'website',
  }),
  twitter: freeListingTwitter({
    title: 'EstateOS™ — materiały kampanii wystaw za darmo',
    description: 'Kopiuj posty i linki UTM. Lista fraz do Google Ads.',
  }),
  alternates: { canonical: `${ESTATEOS_SITE_URL}/dla-prasy/wystaw-za-darmo` },
  robots: { index: true, follow: true },
};

export default function FreeListingPressPage() {
  return <FreeListingPressKitClient />;
}
