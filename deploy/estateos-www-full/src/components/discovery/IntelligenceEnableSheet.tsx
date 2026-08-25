"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, Check } from "lucide-react";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { useLocale } from "@/contexts/LocaleContext";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";

const SESSION_SOFT_DISMISS_KEY = "eos_intel_enable_soft_dismiss_v1";
const SNOOZE_KEY = "eos_intel_enable_snooze_until_v1";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function readSoftDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SOFT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSoftDismissed() {
  try {
    sessionStorage.setItem(SESSION_SOFT_DISMISS_KEY, "1");
  } catch {
    /* quiet */
  }
}

function readSnoozed(now = Date.now()): boolean {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY) || "");
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

function writeSnooze(ms = SNOOZE_MS) {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    /* quiet */
  }
}

/**
 * iOS-style first-login proposal to turn on EstateOS™ Intelligence.
 */
export default function IntelligenceEnableSheet() {
  const reduceMotion = useReducedMotion();
  const { dict } = useLocale();
  const { enabled, decided, hydrated, synced, decide } = useIntelligencePreference();
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [visible, setVisible] = useState(false);
  const [softDismissed, setSoftDismissed] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const handleSoftDismiss = useCallback(() => {
    writeSoftDismissed();
    setSoftDismissed(true);
    setVisible(false);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setSoftDismissed(readSoftDismissed());
    setSnoozed(readSnoozed());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void fetch("/api/user/profile", { credentials: "include", cache: "no-store" })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          setLoggedIn(Boolean(res.ok && (data?.id || data?.user?.id)));
        })
        .catch(() => {
          if (!cancelled) setLoggedIn(false);
        });
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !synced || !loggedIn || decided || enabled || softDismissed || snoozed) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => {
      setVisible(true);
      void playIntelligenceChime("suggest");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [hydrated, synced, loggedIn, decided, enabled, softDismissed, snoozed]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => primaryRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSoftDismiss();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, handleSoftDismiss]);

  if (!mounted) return null;

  const handleEnable = () => {
    decide(true);
    setVisible(false);
  };

  const handleLater = () => {
    writeSnooze();
    setSnoozed(true);
    setVisible(false);
  };

  const features = [
    dict.intelligence.sheetFeature1,
    dict.intelligence.sheetFeature2,
    dict.intelligence.sheetFeature3,
  ];

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <div className="fixed inset-0 z-[10050] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label={dict.intelligence.sheetDismissA11y}
            className="absolute inset-0 bg-black/50 backdrop-blur-[8px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={handleSoftDismiss}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 48, scale: 0.96, filter: "blur(10px)" }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 28, scale: 0.97, filter: "blur(6px)" }
            }
            transition={{ type: "spring", stiffness: 400, damping: 36, mass: 0.82 }}
            className="relative z-10 w-full max-w-[380px] overflow-hidden rounded-[28px] border border-white/[0.14] bg-[rgba(12,14,18,0.86)] px-6 pb-6 pt-7 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55),0_0_1px_rgba(255,255,255,0.1)_inset] backdrop-blur-[40px] sm:px-7 sm:pb-7 sm:pt-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[#BF5AF2]/22 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-[#64D2FF]/16 blur-3xl"
            />

            <div className="relative mx-auto flex h-[4.75rem] w-[4.75rem] items-center justify-center overflow-hidden rounded-full border border-white/25 shadow-[0_0_48px_rgba(191,90,242,0.32)]">
              <span
                aria-hidden
                className="eos-oil-spin absolute inset-[-40%] rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg,#FF2D55,#BF5AF2,#5E5CE6,#64D2FF,#30D158,#FFD60A,#FF9F0A,#FF2D55)",
                }}
              />
              <span
                aria-hidden
                className="eos-oil-spin-rev absolute inset-[-20%] rounded-full opacity-90 mix-blend-screen"
                style={{
                  background: "conic-gradient(from 90deg,#FF375F,#FFD60A,#64D2FF,#BF5AF2,#FF375F)",
                }}
              />
              <span
                aria-hidden
                className="eos-oil-spin absolute inset-[-8%] rounded-full opacity-70 mix-blend-screen"
                style={{
                  background: "conic-gradient(from 180deg,#64D2FF,#5E5CE6,#30D158,#BF5AF2,#64D2FF)",
                  animationDuration: "5.4s",
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42), transparent 42%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.22), transparent 50%)",
                }}
              />
              <Brain
                size={32}
                strokeWidth={2}
                aria-hidden
                className="relative z-[1] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]"
              />
            </div>

            <p className="relative mt-5 text-center text-[11px] font-semibold tracking-[0.04em] text-white/50">
              EstateOS™ Intelligence
            </p>
            <h2
              id={titleId}
              className="relative mt-2 text-center text-[1.5rem] font-semibold tracking-[-0.02em] text-white"
            >
              {dict.intelligence.sheetTitle}
            </h2>
            <p
              id={bodyId}
              className="relative mt-2.5 text-center text-[13px] leading-relaxed text-white/58"
            >
              {dict.intelligence.sheetBody}
            </p>

            <ul className="relative mt-6 space-y-3">
              {features.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/85">
                    <Check size={11} strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="text-[13px] leading-snug text-white/72">{text}</span>
                </li>
              ))}
            </ul>

            <div className="relative mt-7 flex flex-col gap-2">
              <button
                ref={primaryRef}
                type="button"
                onClick={handleEnable}
                className="eos-btn eos-btn--primary eos-btn--block !normal-case !tracking-wide !text-[14px] !font-semibold"
              >
                {dict.intelligence.sheetEnable}
              </button>
              <button
                type="button"
                onClick={handleLater}
                className="w-full rounded-full px-4 py-3 text-[13px] font-medium tracking-wide text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
              >
                {dict.intelligence.sheetLater}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
