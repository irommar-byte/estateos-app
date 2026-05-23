"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/LocaleContext";

export default function Footer() {
  const { dict } = useLocale();
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#050505] pb-8 pt-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="text-center md:text-left">
          <p className="text-xs font-medium tracking-wide text-white/30">{dict.footer.rights}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/25">{dict.footer.tagline}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 sm:gap-8">
          <Link href="/regulamin" className="transition-colors hover:text-white">{dict.footer.terms}</Link>
          <Link href="/polityka-prywatnosci" className="transition-colors hover:text-white">{dict.footer.privacy}</Link>
          <Link href="/oferty" className="transition-colors hover:text-white">{dict.footer.listings}</Link>
          <Link href="/admin" className="transition-colors hover:text-white/60">{dict.footer.central}</Link>
        </div>
      </div>
    </footer>
  );
}
