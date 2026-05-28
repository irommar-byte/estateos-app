"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ContactVerificationPanel from "@/components/ContactVerificationPanel";

export default function WeryfikacjaKontaPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-8 md:pt-12">
        <Link
          href="/moje-konto/crm"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-emerald-400 mb-8 transition-colors"
        >
          <ChevronLeft size={16} /> Panel CRM
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500/80 mb-2">EstateOS™</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Weryfikacja konta</h1>
        <p className="text-white/45 text-sm mb-10 max-w-xl">
          Ten sam standard co w aplikacji: zweryfikowany kontakt buduje zaufanie kupujących i sprzedających.
        </p>
        <ContactVerificationPanel />
      </div>
    </main>
  );
}
