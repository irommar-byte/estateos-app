"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";
import HelpModal from "@/components/layout/HelpModal";
import ContactModal from "@/components/layout/ContactModal";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";

export default function Footer() {
  const { dict } = useLocale();
  const pathname = usePathname() || "";
  const isHome = pathname === "/" || pathname === "";
  const [helpOpen, setHelpOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <footer
        className={
          isHome
            ? "mt-auto border-t border-[rgba(26,27,30,0.08)] bg-gradient-to-b from-[#f3f1ec] to-[#eae7e1] pb-8 pt-12 text-[var(--eos-text)]"
            : "mt-auto border-t border-white/5 bg-[#050505] pb-8 pt-12"
        }
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row md:items-end">
          <div className="text-center md:text-left">
            <p
              className={
                isHome
                  ? "text-xs font-medium tracking-wide text-[var(--eos-muted)]"
                  : "text-xs font-medium tracking-wide text-white/30"
              }
            >
              {dict.footer.rights}
            </p>
            <p
              className={
                isHome
                  ? "mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--eos-subtle)]"
                  : "mt-1 text-[10px] uppercase tracking-[0.2em] text-white/25"
              }
            >
              {dict.footer.tagline}
            </p>
            <div className="mt-4 flex justify-center md:justify-start">
              <AppStoreBadgeLink
                compact
                label={dict.footer.appStore}
                androidComingSoon
                androidSoonLabel={dict.homeAppPitch.androidSoon}
              />
            </div>
          </div>
          <div
            className={
              isHome
                ? "flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)] sm:gap-x-8"
                : "flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 sm:gap-x-8"
            }
          >
            <Link href="/wystaw-za-darmo" className="transition-all duration-300 hover:text-emerald-700 hover:drop-shadow-[0_0_10px_rgba(5,150,105,0.25)]">
              Wystaw za darmo
            </Link>
            <Link href="/wystaw-nieruchomosc-za-darmo" className="transition-all duration-300 hover:text-emerald-700 hover:drop-shadow-[0_0_10px_rgba(5,150,105,0.25)]">
              Nieruchomość
            </Link>
            <Link href="/cars/start" className="transition-all duration-300 hover:text-sky-700 hover:drop-shadow-[0_0_10px_rgba(2,132,199,0.25)]">
              Samochód
            </Link>
            <Link
              href="/cennik"
              className={isHome ? "transition-colors hover:text-[var(--eos-text)]" : "transition-colors hover:text-white"}
            >
              Cennik
            </Link>
            <Link
              href="/regulamin"
              className={isHome ? "transition-colors hover:text-[var(--eos-text)]" : "transition-colors hover:text-white"}
            >
              {dict.footer.terms}
            </Link>
            <Link
              href="/polityka-prywatnosci"
              className={isHome ? "transition-colors hover:text-[var(--eos-text)]" : "transition-colors hover:text-white"}
            >
              {dict.footer.privacy}
            </Link>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className={isHome ? "transition-colors hover:text-[var(--eos-text)]" : "transition-colors hover:text-white"}
            >
              {dict.footer.help}
            </button>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="transition-all duration-300 hover:text-emerald-700 hover:drop-shadow-[0_0_10px_rgba(5,150,105,0.25)]"
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
