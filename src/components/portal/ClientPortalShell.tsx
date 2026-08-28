'use client';

import Link from 'next/link';
import { ShieldCheck, Sparkles } from 'lucide-react';

/** Minimalny pasek panelu klienta — bez navbara agenta, HOME/CAR itd. */
export default function ClientPortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="client-portal-shell min-h-[100dvh] bg-[var(--eos-bg)] text-[var(--eos-text)]">
      <header className="client-portal-shell__header sticky top-0 z-40 border-b border-[var(--eos-border)]/70 bg-[var(--eos-bg)]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="client-portal-shell__brand inline-flex min-w-0 items-center gap-2.5 rounded-xl transition hover:opacity-90"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
              <Sparkles className="size-4 text-emerald-500" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
                EstateOS™
              </span>
              <span className="block truncate text-[13px] font-bold text-[var(--eos-text)]">Twój panel wyszukiwania</span>
            </span>
          </Link>
          <span className="client-portal-shell__badge hidden shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 sm:inline-flex">
            <ShieldCheck className="size-3" aria-hidden />
            Bezpłatnie dla Ciebie
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
