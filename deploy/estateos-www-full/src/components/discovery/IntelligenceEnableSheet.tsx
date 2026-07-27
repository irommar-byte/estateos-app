"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, Sparkles, Compass, Shield } from "lucide-react";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { useLocale } from "@/contexts/LocaleContext";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";

/**
 * iOS-style first-login proposal to turn on EstateOS™ Inteligence.
 */
export default function IntelligenceEnableSheet() {
  const reduceMotion = useReducedMotion();
  const { dict } = useLocale();
  const { enabled, decided, hydrated, decide } = useIntelligencePreference();
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

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
    if (!hydrated || !loggedIn || decided || enabled) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => {
      setVisible(true);
      void playIntelligenceChime("suggest");
    }, 1600);
    return () => window.clearTimeout(t);
  }, [hydrated, loggedIn, decided, enabled]);

  if (!mounted) return null;

  const handleEnable = () => {
    decide(true);
    setVisible(false);
  };

  const handleLater = () => {
    decide(false);
    setVisible(false);
  };

  const features = [
    { icon: Compass, text: dict.intelligence.sheetFeature1 },
    { icon: Sparkles, text: dict.intelligence.sheetFeature2 },
    { icon: Shield, text: dict.intelligence.sheetFeature3 },
  ];

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <div className="fixed inset-0 z-[10050] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label={dict.intelligence.sheetLater}
            className="absolute inset-0 bg-black/45 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleLater}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="eos-intel-sheet-title"
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 56, scale: 0.94, filter: "blur(8px)" }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 40, scale: 0.96, filter: "blur(6px)" }
            }
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.85 }}
            className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-[1.75rem] border border-white/12 bg-[rgba(12,14,18,0.88)] p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-3xl sm:p-7"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-sky-400/25 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl"
            />

            <div className="group relative mx-auto flex h-20 w-20 cursor-default items-center justify-center">
              {!reduceMotion ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-[1.6rem] border border-white/15 bg-white/[0.06]"
                  animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span className="absolute inset-0 rounded-[1.6rem] border border-white/15 bg-white/[0.06]" />
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[-12px] rounded-[1.8rem] bg-[radial-gradient(circle,rgba(125,211,252,0.45),transparent_70%)] opacity-40 blur-md transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-sky-400/30 via-emerald-400/20 to-white/10 text-sky-100 shadow-[0_0_40px_rgba(56,189,248,0.35)] transition-all duration-300 group-hover:scale-105 group-hover:brightness-125 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_48px_rgba(125,211,252,0.65),0_0_80px_rgba(52,211,153,0.35)]">
                {!reduceMotion ? (
                  <span
                    aria-hidden
                    className="eos-brain-flare absolute inset-y-[-30%] left-[-55%] w-[40%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/85 to-transparent opacity-70"
                  />
                ) : null}
                <Brain
                  size={34}
                  strokeWidth={1.6}
                  aria-hidden
                  className="relative z-[1] drop-shadow-[0_0_12px_rgba(186,230,253,0.85)] transition duration-300 group-hover:drop-shadow-[0_0_22px_rgba(255,255,255,0.95)]"
                />
              </span>
            </div>

            <p className="relative mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-white/50">
              EstateOS™ Inteligence
            </p>
            <h2
              id="eos-intel-sheet-title"
              className="relative mt-2 text-center text-[1.55rem] font-semibold tracking-tight text-white"
            >
              {dict.intelligence.sheetTitle}
            </h2>
            <p className="relative mt-2.5 text-center text-[13px] leading-relaxed text-white/60">
              {dict.intelligence.sheetBody}
            </p>

            <ul className="relative mt-5 space-y-2.5">
              {features.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3.5 py-3"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-sky-200">
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="text-[12px] leading-snug text-white/75">{text}</span>
                </li>
              ))}
            </ul>

            <div className="relative mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleEnable}
                className="eos-btn eos-btn--primary eos-btn--block !normal-case !tracking-wide !text-[14px] !font-semibold"
              >
                {dict.intelligence.sheetEnable}
              </button>
              <button
                type="button"
                onClick={handleLater}
                className="eos-btn eos-btn--ghost eos-btn--block !normal-case !tracking-normal !text-[13px] !font-medium !min-h-0 !py-2.5"
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
