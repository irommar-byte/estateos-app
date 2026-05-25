'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RegisterForm from '@/components/auth/RegisterForm';

function RejestracjaPageInner() {
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
          ← Wróć na mapę
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)]">
              <UserPlus size={32} />
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tighter md:text-7xl">
              Załóż
              <br />
              <span className="italic text-emerald-500">konto.</span>
            </h1>
          </div>

          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
            Ten sam proces co w aplikacji mobilnej EstateOS™: imię, nazwisko, e-mail, telefon z kodem kraju,
            hasło oraz wybór <strong className="text-[var(--eos-text)]">osoby prywatnej</strong> lub{' '}
            <strong className="text-[var(--eos-text)]">agenta / biura</strong>. Bez podziału na kupującego i sprzedającego.
            Pakiety Pro i partner — w{' '}
            <Link href="/cennik" className="text-emerald-500 hover:underline">
              cenniku
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
