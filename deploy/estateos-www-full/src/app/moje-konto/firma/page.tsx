'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { getAgencyFirm } from '@/i18n/agencyFirmDictionary';
import AgencyCompanyWorkspace from '@/components/crm/AgencyCompanyWorkspace';
import AgencyWorkspaceErrorBoundary from '@/components/crm/AgencyWorkspaceErrorBoundary';

function FirmaPageInner() {
  const searchParams = useSearchParams();
  const pendingOnly = searchParams.get('pending') === '1';
  const { locale } = useLocale();
  const t = getAgencyFirm(locale);

  return (
    <div className="min-h-screen bg-[var(--eos-bg)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/moje-konto/crm"
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
        >
          <ChevronLeft size={14} /> {t.backToCrm}
        </Link>
        <AgencyWorkspaceErrorBoundary>
          <AgencyCompanyWorkspace pendingOnly={pendingOnly} />
        </AgencyWorkspaceErrorBoundary>
      </div>
    </div>
  );
}

export default function FirmaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      }
    >
      <FirmaPageInner />
    </Suspense>
  );
}
