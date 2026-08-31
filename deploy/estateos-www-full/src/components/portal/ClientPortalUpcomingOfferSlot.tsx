"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, Pause, Radar, Sparkles } from "lucide-react";
import type { AssistantPulse } from "@/lib/crm/clientPortalOfferBoard";

const PREPARING_STEPS = [
  "Skanuję ogłoszenia…",
  "Porównuję z Twoimi ocenami…",
  "Czekam na pewne dopasowanie…",
] as const;

function PulseMark({ mode, reduceMotion }: { mode: AssistantPulse["mode"]; reduceMotion: boolean | null }) {
  const Icon = mode === "preparing" ? Radar : mode === "watching" ? Eye : Pause;
  return (
    <div className="portal-assistant-pulse__mark relative flex size-[4.25rem] shrink-0 items-center justify-center sm:size-[4.75rem]">
      {!reduceMotion ? (
        <>
          <span className="portal-assistant-pulse__ring" aria-hidden />
          <span className="portal-assistant-pulse__ring portal-assistant-pulse__ring--delayed" aria-hidden />
        </>
      ) : null}
      <span className="portal-assistant-pulse__core relative flex size-12 items-center justify-center rounded-2xl sm:size-14">
        {reduceMotion ? (
          <Sparkles className="size-6" aria-hidden />
        ) : (
          <motion.span
            animate={mode === "preparing" ? { rotate: 360 } : { scale: [1, 1.06, 1] }}
            transition={
              mode === "preparing"
                ? { duration: 8, repeat: Infinity, ease: "linear" }
                : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            }
            className="flex"
          >
            <Icon className="size-6" strokeWidth={2.2} />
          </motion.span>
        )}
      </span>
    </div>
  );
}

export default function ClientPortalUpcomingOfferSlot({
  pulse,
  live,
  onFocusNew,
}: {
  pulse: AssistantPulse;
  live?: boolean;
  onFocusNew?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const preparing = pulse.mode === "preparing";

  useEffect(() => {
    if (reduceMotion || !preparing) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % PREPARING_STEPS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [reduceMotion, preparing]);

  const stepLabel = useMemo(() => PREPARING_STEPS[stepIndex], [stepIndex]);
  const activity = preparing ? stepLabel : pulse.activity;

  return (
    <article
      className={`portal-assistant-pulse portal-assistant-pulse--${pulse.mode} relative overflow-hidden rounded-[1.6rem]`}
      aria-live="polite"
      aria-busy={pulse.busy}
    >
      <div className="portal-assistant-pulse__glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex gap-3 p-3.5 sm:gap-4 sm:p-4">
        <PulseMark mode={pulse.mode} reduceMotion={reduceMotion} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="portal-assistant-pulse__badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]">
              <span
                className={`eos-live-dot shrink-0 ${pulse.mode.startsWith("waiting") ? "eos-live-dot--amber" : ""}`}
                aria-hidden
              />
              {pulse.badge}
            </span>
            {live ? (
              <span className="text-[10px] font-semibold text-[var(--eos-muted)]">Panel na żywo</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-black leading-snug text-[var(--eos-text)] sm:text-base">{pulse.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)] sm:text-[13px]">{pulse.body}</p>
          {activity ? (
            <p className="mt-2 text-[10px] font-semibold tracking-wide text-emerald-700/90">{activity}</p>
          ) : null}
          {pulse.cta && onFocusNew ? (
            <button
              type="button"
              onClick={onFocusNew}
              className="portal-assistant-pulse__cta mt-3 inline-flex rounded-full px-3.5 py-1.5 text-[12px] font-bold"
            >
              {pulse.cta}
            </button>
          ) : null}
        </div>
      </div>
      {preparing && !reduceMotion ? (
        <div className="portal-offer-search__scan relative mx-4 mb-4 h-1 overflow-hidden rounded-full bg-emerald-500/10 sm:mx-5">
          <motion.span
            className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
            animate={{ x: ["-30%", "420%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      ) : (
        <div className="mx-4 mb-3 h-px bg-[rgba(15,23,42,0.06)] sm:mx-5" aria-hidden />
      )}
    </article>
  );
}
