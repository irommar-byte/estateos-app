'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { CalendarIcon, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import { buildAuthHref, type OfferShareIntentKind } from '@/lib/offerShareIntent';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  kind: OfferShareIntentKind;
  returnPath: string;
  publisherName?: string;
  slotLabel?: string;
  messagePreview?: string;
};

export default function OfferShareAuthPrompt({
  isOpen,
  onClose,
  kind,
  returnPath,
  publisherName,
  slotLabel,
  messagePreview,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isAppointment = kind === 'appointment';
  const loginHref = buildAuthHref('login', returnPath, kind);
  const registerHref = buildAuthHref('register', returnPath, kind);

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-end justify-center p-4 sm:items-center">
          <motion.button
            type="button"
            aria-label="Zamknij"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="eos-modal-backdrop absolute inset-0"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-black/10 bg-[#fafaf8] shadow-[0_32px_80px_rgba(0,0,0,0.22)] dark:border-white/10 dark:bg-[#101014]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black/8 px-6 py-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {isAppointment ? <CalendarIcon size={22} /> : <MessageCircle size={22} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b8922e]">
                      Krok ostatni
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-[#141416] dark:text-white">
                      {isAppointment ? 'Potwierdź termin wizyty' : 'Wyślij wiadomość'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-9 items-center justify-center rounded-full bg-black/5 text-[#5c5c66] transition hover:bg-black/10 dark:bg-white/10 dark:text-white/70"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
                {isAppointment ? (
                  <>
                    Twój wybrany termin jest zapisany. Załóż bezpłatne konto lub zaloguj się, aby wysłać
                    prośbę do{' '}
                    <strong className="text-[#141416] dark:text-white">{publisherName || 'wystawcy'}</strong>{' '}
                    w Deal Room.
                  </>
                ) : (
                  <>
                    Twoja wiadomość jest gotowa. Zaloguj się lub załóż konto, aby bezpiecznie wysłać ją do{' '}
                    <strong className="text-[#141416] dark:text-white">{publisherName || 'wystawcy'}</strong>.
                  </>
                )}
              </p>

              {slotLabel ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  <CalendarIcon size={16} className="shrink-0" />
                  {slotLabel}
                </div>
              ) : null}

              {messagePreview ? (
                <blockquote className="rounded-2xl border border-black/8 bg-white/70 px-4 py-3 text-sm italic text-[#5c5c66] dark:border-white/10 dark:bg-white/5 dark:text-[#9a9aa8]">
                  „{messagePreview.length > 140 ? `${messagePreview.slice(0, 140)}…` : messagePreview}”
                </blockquote>
              ) : null}

              <div className="flex items-start gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
                  Weryfikacja użytkowników, Deal Room i bezpieczny kontakt — bez opłat za rejestrację.
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-black/8 px-6 py-5 dark:border-white/10">
              <Link
                href={registerHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#141416] px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-black dark:bg-white dark:text-black"
              >
                <Sparkles size={15} />
                Załóż bezpłatne konto
              </Link>
              <Link
                href={loginHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#141416] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Mam już konto — zaloguj się
              </Link>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
