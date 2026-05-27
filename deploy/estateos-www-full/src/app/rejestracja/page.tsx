'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RegisterForm from '@/components/auth/RegisterForm';
import { useLocale } from '@/contexts/LocaleContext';

function RejestracjaPageInner() {
  const { dict, locale } = useLocale();
  const t = dict.auth;
  const searchParams = useSearchParams();
  const afterRegisterPath = searchParams.get('next') || undefined;
  const [bannerError] = useState('');
  const [bannerSuccess] = useState('');

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] p-6 pb-24 pt-40 text-[var(--eos-text)]">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="mb-10 inline-block text-sm font-semibold uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          {t.backToMap}
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)]">
              <UserPlus size={32} />
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tighter md:text-7xl">
              {t.registerPageTitle}
              <br />
              <span className="italic text-emerald-500">{t.registerPageTitleHighlight}</span>
            </h1>
          </div>

          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
            {t.registerPageIntro}{' '}
            <strong className="text-[var(--eos-text)]">{t.registerPageIntroPrivate}</strong>{' '}
            {locale === 'pl' ? 'lub' : 'or'}{' '}
            <strong className="text-[var(--eos-text)]">{t.registerPageIntroAgent}</strong>.{' '}
            <Link href="/cennik" className="text-emerald-500 hover:underline">
              {t.registerPagePricing}
            </Link>
            .
          </p>

          <RegisterForm afterRegisterPath={afterRegisterPath} />
        </motion.div>
      </div>
    </main>
  );
}

export default function RejestracjaPage() {
  return (
    <Suspense fallback={null}>
      <RejestracjaPageInner />
    </Suspense>
  );
}
