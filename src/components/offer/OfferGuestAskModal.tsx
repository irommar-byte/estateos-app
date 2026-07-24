'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageCircleQuestion, Phone, Send, X } from 'lucide-react';

export type OfferGuestAskCopy = {
  title: string;
  subtitle: string;
  questionsLabel: string;
  questions: { key: string; label: string }[];
  phoneLabel: string;
  phonePlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  nameLabel: string;
  nameOptional: string;
  namePlaceholder: string;
  send: string;
  sending: string;
  successTitle: string;
  successBody: string;
  close: string;
  errorGeneric: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  offerId: number;
  offerTitle: string;
  copy: OfferGuestAskCopy;
  defaultPhone?: string;
  defaultName?: string;
};

export default function OfferGuestAskModal({
  isOpen,
  onClose,
  offerId,
  offerTitle,
  copy,
  defaultPhone = '',
  defaultName = '',
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [questionKey, setQuestionKey] = useState(copy.questions[0]?.key || 'moreInfo');
  const [phone, setPhone] = useState(defaultPhone);
  const [guestName, setGuestName] = useState(defaultName);
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setQuestionKey(copy.questions[0]?.key || 'moreInfo');
    setPhone(defaultPhone || '');
    setGuestName(defaultName || '');
    setMessage('');
    setHoneypot('');
    setBusy(false);
    setSent(false);
    setError('');
  }, [isOpen, copy.questions, defaultPhone, defaultName]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const selectedLabel = useMemo(
    () => copy.questions.find((q) => q.key === questionKey)?.label || '',
    [copy.questions, questionKey],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || sent) return;
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/offers/${offerId}/guest-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionKey,
          phone,
          message,
          guestName,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : copy.errorGeneric);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-guest-ask-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0c0c0e] text-white shadow-2xl sm:rounded-[28px]"
            initial={{ y: 40, opacity: 0.85 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0c0c0e]/95 px-5 py-4 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400/90">
                  EstateOS™
                </p>
                <h2 id="offer-guest-ask-title" className="mt-1 text-lg font-semibold tracking-tight">
                  {copy.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-white/55">{offerTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label={copy.close}
              >
                <X className="size-4" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-3 px-5 py-8 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <Send className="size-6" />
                </div>
                <p className="text-lg font-semibold">{copy.successTitle}</p>
                <p className="text-sm leading-relaxed text-white/60">{copy.successBody}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-[12px] font-black uppercase tracking-wider text-black"
                >
                  {copy.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
                <p className="text-sm leading-relaxed text-white/55">{copy.subtitle}</p>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    {copy.questionsLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {copy.questions.map((q) => {
                      const active = q.key === questionKey;
                      return (
                        <button
                          key={q.key}
                          type="button"
                          onClick={() => setQuestionKey(q.key)}
                          className={`rounded-full border px-3 py-2 text-left text-[12px] font-semibold transition ${
                            active
                              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                              : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.07]'
                          }`}
                        >
                          {q.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedLabel ? (
                    <p className="mt-2 text-[11px] text-white/40">{selectedLabel}</p>
                  ) : null}
                </div>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    {copy.nameLabel}{' '}
                    <span className="font-semibold normal-case tracking-normal text-white/30">
                      ({copy.nameOptional})
                    </span>
                  </span>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={copy.namePlaceholder}
                    maxLength={80}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    <Phone className="size-3.5 text-emerald-400" />
                    {copy.phoneLabel}
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={copy.phonePlaceholder}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    <MessageCircleQuestion className="size-3.5 text-emerald-400" />
                    {copy.messageLabel}
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    minLength={8}
                    maxLength={1200}
                    placeholder={copy.messagePlaceholder}
                    className="resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </label>

                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                  aria-hidden
                />

                {error ? (
                  <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-[12px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {busy ? copy.sending : copy.send}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
