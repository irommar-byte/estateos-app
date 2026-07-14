"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ContactVerificationPanel from "@/components/ContactVerificationPanel";

export default function WeryfikacjaKontaPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pb-24 pt-36 text-[var(--eos-text)]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link
          href="/moje-konto/crm"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)] transition-colors hover:text-emerald-500"
        >
          <ChevronLeft size={16} /> Panel CRM
        </Link>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500">EstateOS™</p>
        <h1 className="mb-2 text-3xl font-black tracking-tight md:text-4xl">Weryfikacja konta</h1>
        <p className="mb-10 max-w-xl text-sm text-[var(--eos-muted)]">
          Ten sam standard co w aplikacji: zweryfikowany kontakt buduje zaufanie kupujących i sprzedających.
        </p>
        <ContactVerificationPanel />
      </div>
    </main>
  );
}
