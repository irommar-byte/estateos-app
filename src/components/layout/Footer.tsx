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

  return (
    <>
      <footer className="mt-auto border-t border-[var(--eos-border)] bg-[var(--eos-bg)] pb-8 pt-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row md:items-end">
          <div className="text-center md:text-left">
            <p className="text-xs font-medium tracking-wide text-[var(--eos-muted)]">{dict.footer.rights}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--eos-subtle)]">{dict.footer.tagline}</p>
            <div className="mt-4 flex justify-center md:justify-start">
              <AppStoreBadgeLink compact label={dict.footer.appStore} />
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)] sm:gap-8">
            <Link href="/regulamin" className="transition-colors hover:text-[var(--eos-text)]">
              {dict.footer.terms}
            </Link>
            <Link href="/polityka-prywatnosci" className="transition-colors hover:text-[var(--eos-text)]">
              {dict.footer.privacy}
            </Link>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="transition-colors hover:text-[var(--eos-text)]"
            >
              {dict.footer.help}
            </button>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="transition-colors hover:text-[var(--eos-accent)]"
            >
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
