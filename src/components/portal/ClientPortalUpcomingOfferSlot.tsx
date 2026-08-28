'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

const STEPS = [
  'Przeszukujemy bazy ogłoszeń…',
  'Porównujemy z Twoją reakcją…',
  'Dobieramy kolejne dopasowanie…',
  'Przygotowujemy kartę oferty…',
] as const;

type Props = {
  unscoredCount?: number;
  live?: boolean;
};

export default function ClientPortalUpcomingOfferSlot({ unscoredCount = 0, live }: Props) {
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STEPS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const stepLabel = useMemo(() => STEPS[stepIndex], [stepIndex]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="portal-upcoming-offer eos-inset-frame relative overflow-hidden rounded-[1.6rem] border border-dashed border-emerald-500/30"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="portal-offer-search__glow pointer-events-none absolute inset-0 opacity-80" aria-hidden />

      <div className="relative flex gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="portal-upcoming-offer__thumb eos-inset-well relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-28">
          {!reduceMotion ? (
            <>
              <motion.span
                className="portal-upcoming-offer__shimmer absolute inset-0"
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.span
                className="absolute inset-3 rounded-xl border border-emerald-500/25"
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center text-emerald-500/80">
            {reduceMotion ? (
              <Sparkles className="size-6" aria-hidden />
            ) : (
              <Loader2 className="size-7 animate-spin" aria-hidden />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="portal-upcoming-offer__badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]">
              <span className="eos-live-dot shrink-0" aria-hidden />
              W przygotowaniu
            </span>
            {live ? (
              <span className="text-[10px] font-semibold text-emerald-600/90">Panel odświeża się sam</span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-black leading-snug text-[var(--eos-text)] sm:text-base">
            Ciężko pracujemy nad kolejną propozycją
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">
            {unscoredCount > 0
              ? `Mamy już ${unscoredCount} dopasowań w tle — następna karta pojawi się tutaj bez odświeżania strony.`
              : 'Intelligence dobiera następną ofertę — zostaw panel otwarty, za chwilę zobaczysz ją tutaj.'}
          </p>

          <motion.p
            key={stepLabel}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2.5 text-[10px] font-semibold tracking-wide text-emerald-600/90"
          >
            {stepLabel}
          </motion.p>
        </div>
      </div>

      {!reduceMotion ? (
        <div className="portal-offer-search__scan relative mx-4 mb-4 h-1 overflow-hidden rounded-full bg-emerald-500/10 sm:mx-5">
          <motion.span
            className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
            animate={{ x: ['-30%', '420%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      ) : null}
    </motion.article>
  );
}
