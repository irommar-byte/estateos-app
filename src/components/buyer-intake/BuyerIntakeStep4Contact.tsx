'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BrainCircuit, CheckCircle2, Loader2, Mail, UserRound } from 'lucide-react';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';

export type BuyerContactFieldStatus = 'idle' | 'checking' | 'valid' | 'known' | 'invalid';

type Props = {
  agentFirstName: string;
  agentDisplayName: string;
  isRent: boolean;
  transactionLabel: string;
  propertyLabel: string | undefined;
  summaryLine: string;
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string;
  consentContact: boolean;
  submitting: boolean;
  saved: boolean;
  phoneStatus: BuyerContactFieldStatus;
  emailStatus: BuyerContactFieldStatus;
  contactKnownHint: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneE164Change: (value: string) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onConsentChange: (value: boolean) => void;
};

function phoneInputStatus(status: BuyerContactFieldStatus): 'idle' | 'checking' | 'available' | 'taken' | 'invalid' {
  if (status === 'checking') return 'checking';
  if (status === 'valid') return 'available';
  if (status === 'known') return 'taken';
  if (status === 'invalid') return 'invalid';
  return 'idle';
}

function emailBorderClass(status: BuyerContactFieldStatus): string {
  if (status === 'invalid') return 'border-red-500/45 focus:border-red-500/45';
  if (status === 'valid' || status === 'known') return 'border-emerald-500/45';
  return '';
}

export function BuyerIntakeStep4Contact({
  agentFirstName,
  agentDisplayName,
  isRent,
  transactionLabel,
  propertyLabel,
  summaryLine,
  firstName,
  lastName,
  phoneE164,
  email,
  consentContact,
  submitting,
  saved,
  phoneStatus,
  emailStatus,
  contactKnownHint,
  onFirstNameChange,
  onLastNameChange,
  onPhoneE164Change,
  onEmailChange,
  onEmailBlur,
  onConsentChange,
}: Props) {
  if (saved) {
    return (
      <div className="flex flex-1 flex-col justify-center py-2">
        <div className="bi-success-card rounded-[1.2rem] border px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="bi-success-card__icon flex size-10 shrink-0 items-center justify-center rounded-2xl">
              <CheckCircle2 className="size-5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Panel jest gotowy</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">{agentFirstName}</span> ma już Twoje
                kryteria. Intelligence szuka dopasowań — pierwsza propozycja pojawi się w panelu.
              </p>
              {summaryLine ? (
                <p className="bi-success-card__summary mt-2.5 rounded-xl px-3 py-2 text-[11px] leading-relaxed sm:text-[12px]">
                  Szukamy: <span className="font-semibold">{summaryLine}</span>
                </p>
              ) : null}
              <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {isRent
                  ? 'Usługa jest bezpłatna dla Ciebie. Otwieramy panel — tam reagujesz na oferty i piszesz z agentem.'
                  : 'Usługa jest bezpłatna dla kupujących. Otwieramy panel — tam reagujesz na oferty i piszesz z agentem.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="shrink-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="bi-transaction-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
            {transactionLabel}
          </span>
          {propertyLabel ? (
            <span className="bi-property-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              {propertyLabel}
            </span>
          ) : null}
        </div>
        <h1 className="text-[1.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[1.75rem]">
          Gdzie Cię{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-300 dark:to-emerald-500">
            złapać?
          </span>
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
          {agentDisplayName} skontaktuje się tylko w tej sprawie — bez spamu
          {isRent ? '.' : ' i bez rozmów ze sprzedającymi.'} Po wysłaniu otworzymy Twój panel z propozycjami
          {email.trim() ? ' i wyślemy link na e-mail.' : '.'}
        </p>
      </section>

      <div className="mt-2 shrink-0 space-y-2 pb-1 sm:mt-2.5 sm:space-y-2.5">
        <div className="bi-form-block">
          <div className="bi-field-grid grid grid-cols-2 gap-2">
            <label className="bi-field block">
              <span className="bi-form-block__title mb-1.5 flex items-center gap-1.5">
                <UserRound className="size-3.5 text-emerald-500" aria-hidden />
                Imię
              </span>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                disabled={submitting}
                onChange={(event) => onFirstNameChange(event.target.value)}
                className="bi-contact-input w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                placeholder="Jan"
                maxLength={96}
              />
            </label>
            <label className="bi-field block">
              <span className="bi-form-block__title mb-1.5">Nazwisko</span>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                disabled={submitting}
                onChange={(event) => onLastNameChange(event.target.value)}
                className="bi-contact-input w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                placeholder="Kowalski"
                maxLength={96}
              />
            </label>
          </div>
        </div>

        <div className="bi-form-block block">
          <span className="bi-form-block__title mb-1.5 block">Telefon</span>
          <PhoneCountryInput
            valueE164={phoneE164}
            onChangeE164={onPhoneE164Change}
            disabled={submitting}
            compact
            hideLabel
            showStatusText={false}
            status={phoneInputStatus(phoneStatus)}
            wrapperClassName="bi-phone-country"
          />
          {phoneStatus === 'checking' ? (
            <p className="bi-field-hint mt-1.5 text-[10px] font-medium text-slate-500">Sprawdzam numer w bazie…</p>
          ) : phoneStatus === 'invalid' ? (
            <p className="bi-field-hint bi-field-hint--error mt-1.5 text-[10px] font-medium">
              Wybierz kod kraju i wpisz pełny numer krajowy.
            </p>
          ) : phoneStatus === 'known' ? (
            <p className="bi-field-hint bi-field-hint--warn mt-1.5 text-[10px] font-medium">{contactKnownHint}</p>
          ) : phoneStatus === 'valid' && phoneE164 ? (
            <p className="bi-field-hint bi-field-hint--ok mt-1.5 text-[10px] font-medium">Numer OK — oddzwonimy na ten telefon.</p>
          ) : null}
        </div>

        <label className="bi-form-block block">
          <span className="bi-form-block__title mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-emerald-500" aria-hidden />
              E-mail
            </span>
            <span className="font-normal normal-case tracking-normal text-slate-500">(opcjonalnie — link do panelu)</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={submitting}
            onChange={(event) => onEmailChange(event.target.value)}
            onBlur={onEmailBlur}
            className={`bi-contact-input w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none ${emailBorderClass(emailStatus)}`}
            placeholder="jan@example.com"
            maxLength={191}
          />
          {emailStatus === 'checking' ? (
            <p className="bi-field-hint mt-1.5 text-[10px] font-medium text-slate-500">Sprawdzam e-mail…</p>
          ) : emailStatus === 'invalid' ? (
            <p className="bi-field-hint bi-field-hint--error mt-1.5 text-[10px] font-medium">
              Podaj poprawny adres, np. jan@example.com
            </p>
          ) : emailStatus === 'known' ? (
            <p className="bi-field-hint bi-field-hint--warn mt-1.5 text-[10px] font-medium">{contactKnownHint}</p>
          ) : emailStatus === 'valid' && email.trim() ? (
            <p className="bi-field-hint bi-field-hint--ok mt-1.5 text-[10px] font-medium">
              Wyślemy link do panelu na ten adres.
            </p>
          ) : null}
        </label>

        <label className="bi-consent-row flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5">
          <input
            type="checkbox"
            checked={consentContact}
            disabled={submitting}
            onChange={(event) => onConsentChange(event.target.checked)}
            className="bi-consent-row__check mt-0.5 size-4 shrink-0 rounded border-emerald-500/40 text-emerald-500 focus:ring-emerald-500/30"
          />
          <span className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
            Wyrażam zgodę na kontakt w sprawie wyszukiwania nieruchomości. Rozumiem, że jako{' '}
            {isRent ? 'szukający najmu' : 'kupujący'} nie ponoszę opłat za usługę agenta — wynagrodzenie po stronie{' '}
            {isRent ? 'wynajmującego' : 'sprzedającego'}.
          </span>
        </label>

        {summaryLine ? (
          <p className="bi-live-summary truncate text-center text-[11px] font-medium sm:text-xs">{summaryLine}</p>
        ) : null}
      </div>
    </>
  );
}

export function BuyerIntakeStep4Footer({
  ready,
  submitting,
  hasEmail,
  onSubmit,
}: {
  ready: boolean;
  submitting: boolean;
  hasEmail: boolean;
  onSubmit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const hint = submitting
    ? hasEmail
      ? 'Uruchamiamy panel i wysyłamy link na e-mail…'
      : 'Uruchamiamy Twój panel…'
    : ready
      ? hasEmail
        ? 'Panel + link na e-mail — jeden klik'
        : 'Gotowe — otwieramy panel'
      : 'Imię, nazwisko, telefon i zgoda';

  return (
    <>
      <p className={`bi-footer-hint mb-1.5 text-center text-[10px] font-medium ${ready ? 'bi-footer-hint--ready' : ''}`}>
        {hint}
      </p>
      <motion.button
        type="button"
        disabled={!ready || submitting}
        onClick={onSubmit}
        whileTap={reduceMotion || !ready || submitting ? undefined : { scale: 0.985 }}
        className="bi-primary-cta flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[14px] font-bold disabled:cursor-not-allowed sm:rounded-[1.1rem] sm:py-3.5 sm:text-[15px]"
      >
        {submitting ? <Loader2 className="size-5 animate-spin" /> : <BrainCircuit className="size-5 opacity-90" />}
        {submitting ? 'Uruchamiam panel…' : 'Otwórz mój panel'}
        {!submitting ? <ArrowRight className="bi-primary-cta__arrow size-5" /> : null}
      </motion.button>
    </>
  );
}
