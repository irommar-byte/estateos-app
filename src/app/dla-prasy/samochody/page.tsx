import type { Metadata } from 'next';
import CarsPressKitClient from './CarsPressKitClient';
import { ESTATEOS_PUBLIC_URLS } from '@/lib/estateOsPublicFacts';

export const metadata: Metadata = {
  title: 'Materiały promocyjne Cars | EstateOS™Car',
  description:
    'Gotowe posty, linki UTM i materiały do promocji sprzedaży samochodów w EstateOS™Car — kopiuj i udostępniaj.',
  openGraph: {
    title: 'EstateOS™Car — kampania sprzedaży aut',
    description: 'Materiały do promocji dodawania pojazdów na sprzedaż w EstateOS™Car.',
    url: ESTATEOS_PUBLIC_URLS.carsPress,
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsPress },
};

export default function CarsPressKitPage() {
  return <CarsPressKitClient />;
}
