'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import PortalOnboardingLanding from '@/components/onboarding/PortalOnboardingLanding';

export default function PortalOnboardingPageClient() {
  const searchParams = useSearchParams();
  const invite = String(searchParams.get('invite') || '').trim();

  if (!invite) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#ececea] p-6 dark:bg-[#060608]">
        <div className="max-w-md rounded-[2rem] border border-amber-500/30 bg-white p-10 text-center dark:bg-[#101014]">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={40} />
          <h1 className="text-xl font-black">Link zaproszenia jest niekompletny</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">
            Poproś zespół EstateOS o pełny link do formularza — powinien zawierać parametr zaproszenia.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-bold text-emerald-600 hover:underline"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </main>
    );
  }

  return <PortalOnboardingLanding inviteToken={invite} />;
}
