'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircleQuestion, Phone, Send } from 'lucide-react';
import EosModal from '@/components/ui/EosModal';
import { eosBtn } from '@/components/ui/eosButtonStyles';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';

export type OfferGuestAskCopy = {
  title: string;
  subtitle: string;
  questionsLabel: string;
  questions: { key: string; label: string }[];
  phoneLabel: string;
  phonePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
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
  defaultEmail?: string;
};

export default function OfferGuestAskModal({
  isOpen,
  onClose,
  offerId,
  offerTitle,
  copy,
  defaultPhone = '',
  defaultName = '',
  defaultEmail = '',
}: Props) {
  const firstQuestion = copy.questions[0];
  const [questionKey, setQuestionKey] = useState(firstQuestion?.key || 'moreInfo');
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [guestName, setGuestName] = useState(defaultName);
  const [message, setMessage] = useState(firstQuestion?.label || '');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const onChangeE164 = useCallback((next: string) => {
    setPhone(next);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const q = copy.questions[0];
    setQuestionKey(q?.key || 'moreInfo');
    setPhone(defaultPhone || '');
    setEmail(defaultEmail || '');
    setGuestName(defaultName || '');
    setMessage(q?.label || '');
    setHoneypot('');
    setBusy(false);
    setSent(false);
    setError('');
  }, [isOpen, copy.questions, defaultPhone, defaultName, defaultEmail]);

  const selectQuestion = (q: { key: string; label: string }) => {
    setQuestionKey(q.key);
    const known = copy.questions.some((item) => item.label === message.trim());
    if (!message.trim() || known) setMessage(q.label);
  };

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
          email,
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

  const fieldClass =
    'eos-modal-field rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-3 text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)] focus:border-emerald-500/45';

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
        <div className="space-y-4 py-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600">
            <Send className="size-6" />
          </div>
          <p className="text-lg font-semibold text-[var(--eos-text)]">{copy.successTitle}</p>
          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{copy.successBody}</p>
          <button type="button" onClick={onClose} className={eosBtn('home')}>
            {copy.close}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{copy.subtitle}</p>

          <div>
            <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              {copy.questionsLabel}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={copy.questionsLabel}>
              {copy.questions.map((q) => {
                const active = q.key === questionKey;
                return (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => selectQuestion(q)}
                    aria-pressed={active}
                    className={`eos-modal-chip eos-ask-chip ${active ? 'eos-modal-chip--selected eos-ask-chip--selected' : ''}`}
                  >
                    <span className="text-[12px] font-semibold leading-snug">{q.label}</span>
                  </button>
                );
              })}
            </div>
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
              className={fieldClass}
            />
          </label>

          <div className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              <Phone className="size-3.5 text-emerald-600" />
              {copy.phoneLabel}
            </span>
            <PhoneCountryInput
              key={`${isOpen}-${defaultPhone}`}
              valueE164={phone}
              onChangeE164={onChangeE164}
              hideLabel
              compact
              showStatusText={false}
              wrapperClassName="w-full"
            />
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              <Mail className="size-3.5 text-emerald-600" />
              {copy.emailLabel}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              required
              autoComplete="email"
              maxLength={160}
              className={fieldClass}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
              <MessageCircleQuestion className="size-3.5 text-emerald-600" />
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
              className={`${fieldClass} resize-y`}
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
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className={eosBtn('home', { block: true, size: 'lg' })}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? copy.sending : copy.send}
          </button>
        </form>
      )}
    </EosModal>
  );
}
