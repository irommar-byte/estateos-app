"use client";

import DisplayCurrencySwitcher from "@/components/preferences/DisplayCurrencySwitcher";
import CompactThemeSwitcher from "@/components/layout/CompactThemeSwitcher";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";
import { Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const INTRO_SEEN_KEY = "estateos_prefs_dock_intro_seen";
const AUTO_HIDE_MS = 3000;
const INTRO_AUTO_CLOSE_MS = 7000;

export default function FloatingPreferencesDock() {
  const { dict } = useLocale();
  const [open, setOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const introTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearIntroTimer = useCallback(() => {
    if (introTimerRef.current != null) {
      window.clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  }, []);

  const closePanel = useCallback(() => {
    clearHideTimer();
    clearIntroTimer();
    setOpen(false);
    setShowIntro(false);
  }, [clearHideTimer, clearIntroTimer]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      closePanel();
    }, AUTO_HIDE_MS);
  }, [clearHideTimer, closePanel]);

  useEffect(() => {
    try {
      const introSeen = window.localStorage.getItem(INTRO_SEEN_KEY) === "1";
      if (!introSeen) {
        window.localStorage.setItem(INTRO_SEEN_KEY, "1");
        setOpen(true);
        setShowIntro(true);
        introTimerRef.current = window.setTimeout(() => {
          closePanel();
        }, INTRO_AUTO_CLOSE_MS);
      }
    } catch {
      /* noop */
    }

    void fetch("/api/user/profile", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setIsLoggedIn(Boolean(res.ok && (data?.id || data?.user?.id)));
      })
      .catch(() => setIsLoggedIn(false));

    return () => {
      clearHideTimer();
      clearIntroTimer();
    };
  }, [clearHideTimer, clearIntroTimer, closePanel]);

  const handleMouseEnter = () => {
    clearHideTimer();
    if (showIntro) clearIntroTimer();
  };

  const handleMouseLeave = () => {
    if (!open) return;
    scheduleHide();
  };

  const toggle = () => {
    if (open) {
      closePanel();
      return;
    }
    clearHideTimer();
    clearIntroTimer();
    setShowIntro(false);
    setOpen(true);
  };

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[min(100vw-2rem,22rem)]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
              {showIntro ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
                    {dict.prefsDock.introTitle}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--eos-muted)]">
                    {dict.prefsDock.introBody}
                  </p>
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                  {dict.theme.label}
                </p>
                <CompactThemeSwitcher showMessages={isLoggedIn} />
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
          aria-label={open ? dict.prefsDock.hideSettings : dict.prefsDock.showSettings}
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
