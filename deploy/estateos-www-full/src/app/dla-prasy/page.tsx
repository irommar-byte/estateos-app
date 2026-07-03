import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Materiały prasowe i promocja',
  description:
    'Press kit EstateOS™ — opisy produktu, linki do App Store i Google Play, gotowe posty na social media i instrukcje dla asystentów AI.',
  openGraph: {
    title: 'EstateOS™ Press Kit',
    description: 'Oficjalne materiały promocyjne EstateOS — platforma nieruchomości z mapą, CRM i aplikacją mobilną.',
    url: 'https://estateos.pl/dla-prasy',
  },
  alternates: { canonical: 'https://estateos.pl/dla-prasy' },
};

export { default } from './PressKitClient';
