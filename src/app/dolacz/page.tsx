import type { Metadata } from 'next';
import { Suspense } from 'react';
import PortalOnboardingPageClient from '@/components/onboarding/PortalOnboardingPageClient';

export const metadata: Metadata = {
  title: 'Dołącz do EstateOS™ — import ogłoszenia',
  description:
    'Przenieś ogłoszenie z OtoDom lub OLX na mapę EstateOS™. Załóż konto, wklej link — resztą zajmiemy się my.',
  robots: { index: false, follow: false },
};

export default function DolaczPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#ececea] dark:bg-[#060608]">
          <p className="text-sm font-semibold text-[#5c5c66]">Ładowanie…</p>
        </main>
      }
    >
      <PortalOnboardingPageClient />
    </Suspense>
  );
}
