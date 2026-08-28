'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Radar, Sparkles } from 'lucide-react';

const STEPS = [
  'Skanuję aktywne ogłoszenia…',
  'Porównuję z Twoimi kryteriami…',
  'Liczy dopasowanie Intelligence…',
  'Przygotowuję pierwszą propozycję…',
] as const;

type Props = {
  unscoredCount?: number;
  compact?: boolean;
  live?: boolean;
};

export default function ClientPortalOfferSearchPanel({ unscoredCount = 0, compact, live }: Props) {
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STEPS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const stepLabel = useMemo(() => STEPS[stepIndex], [stepIndex]);

  return (
    <div
      className={`portal-offer-search eos-inset-well relative overflow-hidden rounded-2xl border border-dashed border-emerald-500/25 ${
        compact ? 'px-4 py-6' : 'px-6 py-10'
      } text-center`}
    >
      <div className="portal-offer-search__glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto flex size-20 items-center justify-center">
        {!reduceMotion ? (
          <>
            <motion.span
              className="portal-offer-search__ring absolute inset-0 rounded-full border border-emerald-500/30"
              animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.span
              className="portal-offer-search__ring absolute inset-2 rounded-full border border-emerald-400/20"
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.08, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.35 }}
            />
          </>
        ) : null}
        <motion.div
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'linear' }}
          className="relative flex size-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500 shadow-[0_0_32px_rgba(16,185,129,0.2)]"
        >
          <Radar className="size-7" strokeWidth={2.25} />
        </motion.div>
      </div>

      <p className="relative mt-5 text-sm font-semibold text-[var(--eos-text)]">
        Intelligence przeszukuje rynek pod Twoje kryteria
      </p>
      <p className="relative mt-2 min-h-[2.5rem] text-sm leading-relaxed text-[var(--eos-muted)]">
        {unscoredCount > 0
          ? `Mamy już ${unscoredCount} dopasowań w tle — pierwsza propozycja pojawi się tutaj automatycznie.`
          : 'Pierwsza propozycja pojawi się tutaj bez odświeżania strony.'}
        {live ? ' Zostaw panel otwarty — odświeżamy go co kilka sekund.' : ''}
      </p>

      <div className="relative mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="portal-offer-search__chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold">
          <MapPin className="size-3 text-emerald-500" aria-hidden />
          Lokalizacja
        </span>
        <span className="portal-offer-search__chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold">
          <Sparkles className="size-3 text-emerald-500" aria-hidden />
          Metraż · budżet
        </span>
      </div>

      <motion.p
        key={stepLabel}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-4 text-[11px] font-medium tracking-wide text-emerald-600/90"
      >
        {stepLabel}
      </motion.p>

      {!reduceMotion ? (
        <div className="portal-offer-search__scan relative mx-auto mt-5 h-1 max-w-xs overflow-hidden rounded-full bg-emerald-500/10">
          <motion.span
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
            animate={{ x: ['-40%', '320%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      ) : null}
    </div>
  );
}
