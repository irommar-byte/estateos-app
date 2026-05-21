'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';
import RegisterForm from '@/components/auth/RegisterForm';

export default function RejestracjaPage() {
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
            Ten sam proces co w aplikacji mobilnej EstateOS: imię, nazwisko, e-mail, telefon z kodem kraju,
            hasło i opcjonalnie konto Partner lub biura.
          </p>

          <RegisterForm />
        </motion.div>
      </div>
    </main>
  );
}
