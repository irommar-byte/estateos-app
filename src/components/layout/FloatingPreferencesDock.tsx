"use client";

import DisplayCurrencySwitcher from "@/components/preferences/DisplayCurrencySwitcher";
import CompactThemeSwitcher from "@/components/layout/CompactThemeSwitcher";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";
import { Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function FloatingPreferencesDock() {
  const { dict } = useLocale();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("estateos_prefs_dock_open");
      if (saved === "0") setOpen(false);
    } catch {
      /* noop */
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("estateos_prefs_dock_open", next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[min(100vw-2rem,22rem)]">
      <div className="pointer-events-auto flex items-end justify-end gap-2">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="prefs-panel"
              initial={{ opacity: 0, x: 16, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-glass)] p-2 shadow-[var(--eos-shadow-strong)] backdrop-blur-xl"
            >
              <div className="space-y-1">
                <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {dict.theme.label}
                </p>
                <CompactThemeSwitcher />
              </div>
              <div className="space-y-1">
                <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {dict.nav.language}
                </p>
                <LanguageSwitcher />
              </div>
              <div className="space-y-1">
                <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {dict.currency.sectionTitle}
                </p>
                <DisplayCurrencySwitcher />
                <p className="px-1 text-[9px] leading-snug text-[var(--eos-subtle)]">{dict.currency.footer}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={toggle}
          className="group rounded-full border border-[var(--eos-border)] bg-[var(--eos-glass)] px-2.5 py-2 text-[var(--eos-muted)] shadow-[var(--eos-shadow-soft)] backdrop-blur-xl transition hover:text-[var(--eos-text)]"
          aria-label={open ? "Schowaj ustawienia" : "Pokaż ustawienia"}
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </span>
        </button>
      </div>
    </div>
  );
}
