'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircleQuestion, Phone, Send } from 'lucide-react';
import EosModal from '@/components/ui/EosModal';

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
  const [questionKey, setQuestionKey] = useState(copy.questions[0]?.key || 'moreInfo');
  const [phone, setPhone] = useState(defaultPhone);
  const [guestName, setGuestName] = useState(defaultName);
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      zIndexClass="z-[220]"
      badge="EstateOS™"
      title={copy.title}
      subtitle={offerTitle}
      icon={<MessageCircleQuestion className="size-5" aria-hidden />}
      ariaLabelledBy="offer-guest-ask-title"
    >
      {sent ? (
        <div className="space-y-3 py-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Send className="size-6" />
          </div>
          <p className="text-lg font-semibold text-[var(--eos-text)]">{copy.successTitle}</p>
          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{copy.successBody}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-[12px] font-black uppercase tracking-wider text-white"
          >
            {copy.close}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{copy.subtitle}</p>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
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
                        ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                        : 'border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)] hover:border-[var(--eos-border-strong,var(--eos-border))] hover:text-[var(--eos-text)]'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            {selectedLabel ? (
              <p className="mt-2 text-[11px] text-[var(--eos-subtle)]">{selectedLabel}</p>
            ) : null}
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              {copy.nameLabel}{' '}
              <span className="font-semibold normal-case tracking-normal text-[var(--eos-muted)]">
                ({copy.nameOptional})
              </span>
            </span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={copy.namePlaceholder}
              maxLength={80}
              className="eos-modal-field rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-3 text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)] focus:border-emerald-500/45"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              <Phone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {copy.phoneLabel}
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={copy.phonePlaceholder}
              required
              inputMode="tel"
              autoComplete="tel"
              className="eos-modal-field rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-3 text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)] focus:border-emerald-500/45"
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              <MessageCircleQuestion className="size-3.5 text-emerald-600 dark:text-emerald-400" />
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
              className="eos-modal-field resize-y rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-3 text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)] focus:border-emerald-500/45"
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
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-[12px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? copy.sending : copy.send}
          </button>
        </form>
      )}
    </EosModal>
  );
}
