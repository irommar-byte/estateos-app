'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Kaskada formularza: kolejny parametr wyłania się dopiero, gdy poprzedni jest wybrany.
 * Płynne rozwinięcie + delikatne wyostrzenie, a potem łagodne przewinięcie do nowej sekcji.
 * Przy powrocie do zapisanych kryteriów wszystko jest od razu widoczne (bez animacji i przewijania).
 */
export default function BuyerReveal({
  show,
  children,
  delay = 0,
}: {
  show: boolean;
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(show);
  const [settled, setSettled] = useState(show);

  useEffect(() => {
    const appeared = show && !prev.current;
    prev.current = show;
    if (!appeared) return;
    setSettled(false);
    const timer = window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }, 320 + delay * 1000);
    return () => window.clearTimeout(timer);
  }, [show, delay, reduce]);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          ref={ref}
          key="reveal"
          className="bi-reveal"
          style={{ overflow: settled ? 'visible' : 'hidden', scrollMarginBottom: 150, scrollMarginTop: 24 }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, height: 'auto', y: 0, filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6, filter: 'blur(4px)' }}
          transition={{
            height: { duration: 0.46, ease: EASE, delay },
            y: { duration: 0.6, ease: EASE, delay },
            opacity: { duration: 0.55, ease: EASE, delay: delay + 0.06 },
            filter: { duration: 0.55, ease: EASE, delay: delay + 0.04 },
          }}
          onAnimationStart={() => setSettled(false)}
          onAnimationComplete={() => setSettled(true)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Dyskretny przycisk „pomiń ten parametr” — prowadzi dalej bez wyboru opcjonalnego pola. */
export function BuyerRevealSkip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="bi-expand-btn mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold"
    >
      {label} →
    </button>
  );
}
