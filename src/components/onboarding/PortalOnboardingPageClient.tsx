'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import PortalOnboardingLanding from '@/components/onboarding/PortalOnboardingLanding';
import { useLocale } from '@/contexts/LocaleContext';
import { getPortalOnboardingDict } from '@/i18n/portalOnboardingDictionary';

export default function PortalOnboardingPageClient() {
  const searchParams = useSearchParams();
  const invite = String(searchParams.get('invite') || '').trim();
  const { locale } = useLocale();
  const dict = getPortalOnboardingDict(locale);

  if (!invite) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f3f0] p-6">
        <div className="max-w-md rounded-[2rem] border border-amber-500/30 bg-white p-10 text-center shadow-xl">
          <div className="mb-6 flex justify-end">
            <LanguageSwitcher />
          </div>
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={40} />
          <h1 className="text-xl font-black text-[#141416]">{dict.inviteMissingTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">{dict.inviteMissingBody}</p>
          <Link href="/" className="mt-6 inline-block text-sm font-bold text-emerald-700 hover:underline">
            {dict.backHome}
          </Link>
        </div>
      </main>
    );
  }

  return <PortalOnboardingLanding inviteToken={invite} />;
}
