import type { Metadata } from 'next';
import CarsPressKitClient from './CarsPressKitClient';
import { carsOpenGraph, carsTwitter } from '@/lib/carsOgMetadata';
import { ESTATEOS_PUBLIC_URLS } from '@/lib/estateOsPublicFacts';

export const metadata: Metadata = {
  title: 'Materiały promocyjne Cars',
  description:
    'Gotowe posty, linki UTM i materiały do promocji sprzedaży samochodów za darmo w EstateOS™Car — kopiuj i udostępniaj.',
  openGraph: carsOpenGraph({
    title: 'EstateOS™Car — wystaw auto za darmo',
    description:
      'Zastrzeż VIN i rejestrację — kupujący sprawdzi historię i OC bez ujawniania pełnych danych. Materiały kampanii Cars.',
    url: ESTATEOS_PUBLIC_URLS.carsPress,
    siteName: 'EstateOS™Car',
    locale: 'pl_PL',
    type: 'website',
  }),
  twitter: carsTwitter({
    title: 'EstateOS™Car — wystaw auto za darmo',
    description:
      'Zastrzeż VIN — kupujący sprawdzi historię i OC. Materiały kampanii EstateOS™Car.',
  }),
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsPress },
};

export default function CarsPressKitPage() {
  return <CarsPressKitClient />;
}
