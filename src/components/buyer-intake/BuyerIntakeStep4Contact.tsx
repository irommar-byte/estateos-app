'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarCheck2, CheckCircle2, Handshake, LayoutDashboard, Loader2, Mail, UserRound } from 'lucide-react';
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
              <CheckCircle2 className="bi-accent-ink size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold bi-ink">Twój panel klienta jest gotowy</p>
              <p className="mt-1.5 text-[13px] leading-relaxed bi-ink-2">
                <span className="font-semibold bi-ink">{agentFirstName}</span> ma już Twoje kryteria i przygotuje
                dla Ciebie pierwsze propozycje — znajdziesz je w panelu.
              </p>
              {summaryLine ? (
                <p className="bi-success-card__summary mt-2.5 rounded-xl px-3 py-2 text-[11px] leading-relaxed sm:text-[12px]">
                  Szukamy: <span className="font-semibold">{summaryLine}</span>
                </p>
              ) : null}
              <p className="mt-2.5 text-[12px] leading-relaxed bi-ink-3">
                Otwieramy Twój panel — tam oceniasz oferty, umawiasz oglądania i piszesz z agentem.
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
        <h1 className="text-[1.35rem] font-semibold leading-[1.08] tracking-[-0.03em] bi-ink sm:text-[1.75rem]">
          Ostatni krok —{' '}
          <span className="bi-accent">Twój panel klienta</span>
        </h1>
        <p className="mt-1 text-[13px] leading-snug bi-ink-2">
          {agentDisplayName} skontaktuje się z Tobą tylko w tej sprawie
          {isRent ? '.' : ' — bez rozmów ze sprzedającymi.'}
        </p>
      </section>

      <div className="mt-2 shrink-0 space-y-2 pb-1 sm:mt-2.5 sm:space-y-2.5">
        <div className="bi-form-block">
          <div className="bi-field-grid grid grid-cols-2 gap-2">
            <label className="bi-field block">
              <span className="bi-form-block__title mb-1.5 flex items-center gap-1.5">
                <UserRound className="bi-accent-ink size-3.5" aria-hidden />
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
              <span className="bi-form-block__title mb-1.5 flex items-center gap-1.5">Nazwisko</span>
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
            <p className="bi-field-hint mt-1.5 text-[10px] font-medium bi-ink-3">Sprawdzam numer w bazie…</p>
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
              <Mail className="bi-accent-ink size-3.5" aria-hidden />
              E-mail
            </span>
            <span className="font-normal normal-case tracking-normal bi-ink-3">(zalecane — wyślemy link do panelu)</span>
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
            <p className="bi-field-hint mt-1.5 text-[10px] font-medium bi-ink-3">Sprawdzam e-mail…</p>
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

        <div className="bi-next-card rounded-2xl px-3.5 py-3">
          <p className="bi-kicker text-[10px] font-bold uppercase tracking-[0.16em]">Co dalej</p>
          <ul className="mt-2 space-y-2">
            {[
              { icon: LayoutDashboard, text: 'Otwieramy Twój panel klienta — link dostaniesz też e-mailem.' },
              { icon: CheckCircle2, text: `${agentFirstName} wysyła tam oferty dopasowane do Twoich kryteriów — oceniasz je jednym dotknięciem.` },
              { icon: CalendarCheck2, text: 'Oglądania potwierdzasz w panelu, przypomnienia przychodzą same.' },
              { icon: Handshake, text: 'Negocjacje, dokumenty i czat z agentem — wszystko w jednym miejscu.' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-2.5 text-[12px] leading-snug bi-ink-2">
                <Icon className="bi-accent-ink mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="bi-consent-row flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5">
          <input
            type="checkbox"
            checked={consentContact}
            disabled={submitting}
            onChange={(event) => onConsentChange(event.target.checked)}
            className="bi-consent-row__check mt-0.5 size-4 shrink-0 rounded"
          />
          <span className="text-[11px] leading-snug bi-ink-2">
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
      ? 'Tworzymy panel i wysyłamy link na e-mail…'
      : 'Tworzymy Twój panel…'
    : ready
      ? 'Wszystko gotowe'
      : 'Uzupełnij imię, nazwisko, telefon i zgodę';

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
        {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
        {submitting ? 'Tworzę panel…' : 'Otwórz mój panel klienta'}
        {!submitting ? <ArrowRight className="bi-primary-cta__arrow size-5" /> : null}
      </motion.button>
    </>
  );
}
