"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/contexts/LocaleContext";
import HelpModal from "@/components/layout/HelpModal";
import ContactModal from "@/components/layout/ContactModal";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";

export default function Footer() {
  const { dict } = useLocale();
  const [helpOpen, setHelpOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const linkClass =
    "transition-colors duration-300 hover:text-[var(--eos-text)] hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.25)]";

  return (
    <>
      <footer className="mt-auto border-t border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] pb-8 pt-12 text-[var(--eos-text)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row md:items-end">
          <div className="text-center md:text-left">
            <p className="text-xs font-medium tracking-wide text-[var(--eos-muted)]">{dict.footer.rights}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--eos-subtle)]">{dict.footer.tagline}</p>
            <div className="mt-4 flex justify-center md:justify-start">
              <AppStoreBadgeLink
                compact
                label={dict.footer.appStore}
                androidComingSoon
                androidSoonLabel={dict.homeAppPitch.androidSoon}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)] sm:gap-x-8">
            <Link href="/wystaw-za-darmo" className={linkClass}>
              Wystaw za darmo
            </Link>
            <Link href="/wystaw-nieruchomosc-za-darmo" className={linkClass}>
              Nieruchomość
            </Link>
            <Link href="/cars/start" className={linkClass}>
              Samochód
            </Link>
            <Link href="/cennik" className={linkClass}>
              Cennik
            </Link>
            <Link href="/regulamin" className={linkClass}>
              {dict.footer.terms}
            </Link>
            <Link href="/polityka-prywatnosci" className={linkClass}>
              {dict.footer.privacy}
            </Link>
            <button type="button" onClick={() => setHelpOpen(true)} className={linkClass}>
              {dict.footer.help}
            </button>
            <button type="button" onClick={() => setContactOpen(true)} className={linkClass}>
              {dict.footer.contact}
            </button>
          </div>
        </div>
      </footer>

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
