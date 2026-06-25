'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  Home,
  Link2,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import type { PortalListingPreview } from '@/lib/portalOnboarding';

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

type ProgressStep = {
  id: string;
  label: string;
  done: boolean;
  active: boolean;
};

const IMPORT_STEPS: ProgressStep[] = [
  { id: 'account', label: 'Tworzenie konta', done: false, active: false },
  { id: 'fetch', label: 'Pobieranie ogłoszenia', done: false, active: false },
  { id: 'rewrite', label: 'Przepisywanie opisu', done: false, active: false },
  { id: 'photos', label: 'Kopiowanie zdjęć', done: false, active: false },
  { id: 'publish', label: 'Publikacja na profilu', done: false, active: false },
];

function sourceLabel(source: string): string {
  if (source === 'OTODOM') return 'OtoDom';
  if (source === 'OLX') return 'OLX';
  if (source === 'NIERUCHOMOSCI_ONLINE') return 'Nieruchomosci-Online';
  return source;
}

export default function PortalOnboardingLanding({ inviteToken }: { inviteToken: string }) {
  const [portalUrl, setPortalUrl] = useState('');
  const [preview, setPreview] = useState<PortalListingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const [phoneStatus, setPhoneStatus] = useState<FieldStatus>('idle');
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [progress, setProgress] = useState<ProgressStep[]>(IMPORT_STEPS);
  const [success, setSuccess] = useState<{
    profileUrl: string;
    publicUrl: string;
    offerId: number;
    imagesUploaded: number;
  } | null>(null);

  const canPreview = portalUrl.trim().length > 12;
  const formReady =
    Boolean(preview) &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes('@') &&
    password.length >= 6 &&
    normalizePhoneE164(phoneE164) &&
    rightsConfirmed &&
    acceptTerms &&
    emailStatus !== 'taken' &&
    phoneStatus !== 'taken';

  const checkExists = useCallback(async (field: 'email' | 'phone', value: string) => {
    if (!value.trim()) return false;
    const body =
      field === 'email' ? { field: 'email', value } : { field: 'phone', phone: value, contactPhone: value };
    const res = await fetch('/api/auth/check-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(data?.exists);
  }, []);

  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!email.includes('@')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    emailTimer.current = setTimeout(() => {
      void (async () => {
        const exists = await checkExists('email', email);
        setEmailStatus(exists ? 'taken' : 'available');
      })();
    }, 450);
    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [email, checkExists]);

  useEffect(() => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    const normalized = normalizePhoneE164(phoneE164);
    if (!normalized) {
      setPhoneStatus('idle');
      return;
    }
    setPhoneStatus('checking');
    phoneTimer.current = setTimeout(() => {
      void (async () => {
        const exists = await checkExists('phone', normalized);
        setPhoneStatus(exists ? 'taken' : 'available');
      })();
    }, 450);
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    };
  }, [phoneE164, checkExists]);

  const runPreview = async () => {
    setPreviewError('');
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/portal-onboarding/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite: inviteToken, url: portalUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Nie udało się odczytać ogłoszenia.');
      setPreview(data.preview as PortalListingPreview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Błąd podglądu.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const animateProgress = async () => {
    const ids = IMPORT_STEPS.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 1) {
      setProgress((prev) =>
        prev.map((step, idx) => ({
          ...step,
          active: idx === i,
          done: idx < i,
        })),
      );
      await new Promise((r) => setTimeout(r, i === 2 ? 1400 : 900));
    }
    setProgress((prev) => prev.map((step) => ({ ...step, active: false, done: true })));
  };

  const handleSubmit = async () => {
    if (!formReady || submitting) return;
    setSubmitError('');
    setSubmitting(true);
    setProgress(IMPORT_STEPS.map((s) => ({ ...s, done: false, active: false })));

    const progressPromise = animateProgress();

    try {
      const res = await fetch('/api/portal-onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          invite: inviteToken,
          url: portalUrl.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phone: phoneE164,
          rightsConfirmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      await progressPromise;

      if (!res.ok) throw new Error(data?.error || 'Rejestracja nie powiodła się.');

      setSuccess({
        profileUrl: data.profileUrl,
        publicUrl: data.publicUrl,
        offerId: data.offerId,
        imagesUploaded: data.imagesUploaded ?? 0,
      });

      window.setTimeout(() => {
        window.location.href = `${data.profileUrl}?welcome=import`;
      }, 3200);
    } catch (error) {
      await progressPromise.catch(() => null);
      setSubmitError(error instanceof Error ? error.message : 'Operacja nie powiodła się.');
      setProgress(IMPORT_STEPS.map((s) => ({ ...s, done: false, active: false })));
    } finally {
      setSubmitting(false);
    }
  };

  const heroStats = useMemo(
    () => [
      { label: 'Import z portali', value: 'OtoDom · OLX' },
      { label: 'Czas', value: '~2 minuty' },
      { label: 'Koszt startu', value: '0 zł' },
    ],
    [],
  );

  if (success) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#ececea] p-6 dark:bg-[#060608]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-[2rem] border border-emerald-500/30 bg-white p-10 text-center shadow-2xl dark:bg-[#101014]"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#141416] dark:text-white">
            Gotowe — Twoja nieruchomość jest na profilu
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">
            Oferta #{success.offerId} została opublikowana
            {success.imagesUploaded > 0 ? ` wraz z ${success.imagesUploaded} zdjęciami` : ''}. Za chwilę
            przeniesiemy Cię na profil EstateOS™.
          </p>
          <Link
            href={success.profileUrl}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-black"
          >
            Zobacz profil <ArrowRight size={16} />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#ececea] text-[#141416] dark:bg-[#060608] dark:text-[#f5f5f7]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_520px_at_50%_-10%,rgba(16,185,129,0.14),transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(700px_400px_at_100%_100%,rgba(184,146,46,0.1),transparent_55%)]" />

      <div className="relative mx-auto max-w-2xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <header className="mb-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c66]">
            <Building2 size={14} className="text-emerald-500" />
            EstateOS™
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-3xl font-black leading-tight tracking-tight md:text-5xl"
          >
            Przenieś ogłoszenie
            <span className="block text-emerald-500">na mapę EstateOS™</span>
          </motion.h1>
          <p className="eos-muted-copy mx-auto mt-4 max-w-lg text-sm leading-relaxed md:text-base">
            Wklej link z OtoDom lub innego portalu, załóż konto — a my przepiszemy treść, skopiujemy zdjęcia i
            opublikujemy ofertę na Twoim profilu. Bez ręcznego przepisywania.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {heroStats.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5c5c66] dark:border-white/10 dark:bg-white/5"
              >
                {item.label}: <span className="text-[#141416] dark:text-white">{item.value}</span>
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-5">
          {/* Step 1 — link */}
          <section className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#fafaf8] shadow-[0_24px_60px_rgba(20,20,22,0.08)] dark:border-white/10 dark:bg-[#101014]">
            <div className="border-b border-black/8 px-5 py-4 dark:border-white/10">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px]">1</span>
                Link do ogłoszenia
              </p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-semibold text-[#5c5c66]">
                Adres URL z OtoDom, OLX lub Nieruchomosci-Online
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Link2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5c5c66]" />
                  <input
                    type="url"
                    value={portalUrl}
                    onChange={(e) => {
                      setPortalUrl(e.target.value);
                      setPreview(null);
                      setPreviewError('');
                    }}
                    placeholder="https://www.otodom.pl/pl/oferta/..."
                    className="w-full rounded-2xl border border-black/10 bg-white py-4 pl-11 pr-4 text-sm outline-none ring-emerald-500/30 transition focus:ring-2 dark:border-white/10 dark:bg-[#0c0c10]"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!canPreview || previewLoading}
                onClick={() => void runPreview()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3.5 text-[11px] font-black uppercase tracking-widest text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Podgląd ogłoszenia
              </button>
              {previewError ? (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-600">{previewError}</p>
              ) : null}

              <AnimatePresence>
                {preview ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] to-transparent"
                  >
                    <div className="flex gap-4 p-4">
                      {preview.imageUrl ? (
                        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-black/5">
                          <Image src={preview.imageUrl} alt="" fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-black/5 text-[#5c5c66]">
                          <Home size={28} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                          {sourceLabel(preview.source)} · gotowe do importu
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug">{preview.title}</h3>
                        <p className="mt-2 text-lg font-black">{preview.priceLabel}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#5c5c66]">
                          <MapPin size={12} />
                          {[preview.city, preview.district].filter(Boolean).join(' · ')}
                          {preview.area ? ` · ${preview.area} m²` : ''}
                          {preview.rooms ? ` · ${preview.rooms} pok.` : ''}
                        </p>
                        <p className="mt-1 text-[10px] text-[#5c5c66]">{preview.imageCount} zdjęć do skopiowania</p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </section>

          {/* Step 2 — account */}
          <section
            className={`overflow-hidden rounded-[1.75rem] border bg-[#fafaf8] shadow-[0_24px_60px_rgba(20,20,22,0.08)] transition dark:bg-[#101014] ${
              preview ? 'border-black/10 dark:border-white/10' : 'border-black/5 opacity-60 dark:border-white/5'
            }`}
          >
            <div className="border-b border-black/8 px-5 py-4 dark:border-white/10">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px]">2</span>
                Twoje dane — profil właściciela
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <User size={12} /> Imię
                </span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c10]"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1.5 text-xs font-semibold text-[#5c5c66]">Nazwisko</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c10]"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Mail size={12} /> E-mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c10]"
                />
                {emailStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-red-500">Ten e-mail jest już zajęty.</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Phone size={12} /> Telefon
                </span>
                <PhoneCountryInput
                  valueE164={phoneE164}
                  onChangeE164={setPhoneE164}
                  disabled={!preview}
                  status={phoneStatus}
                />
                {phoneStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-red-500">Ten numer jest już w użyciu.</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Lock size={12} /> Hasło (min. 6 znaków)
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c10]"
                />
              </label>
            </div>
          </section>

          {/* Legal + CTA */}
          <section className="rounded-[1.75rem] border border-black/10 bg-[#fafaf8] p-5 dark:border-white/10 dark:bg-[#101014]">
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-[#5c5c66]">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                disabled={!preview}
                className="mt-1 shrink-0 accent-emerald-500"
              />
              <span>
                Oświadczam, że jestem właścicielem lub upoważnionym przedstawicielem tej nieruchomości i mam prawo
                publikować dane oraz zdjęcia z wklejonego ogłoszenia w EstateOS™.
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer gap-3 text-sm leading-relaxed text-[#5c5c66]">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={!preview}
                className="mt-1 shrink-0 accent-emerald-500"
              />
              <span>
                Akceptuję{' '}
                <Link href="/regulamin" className="font-semibold text-emerald-600 underline-offset-2 hover:underline">
                  Regulamin
                </Link>{' '}
                i{' '}
                <Link href="/polityka-prywatnosci" className="font-semibold text-emerald-600 underline-offset-2 hover:underline">
                  Politykę prywatności
                </Link>
                .
              </span>
            </label>

            {submitError ? (
              <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {submitError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!formReady || submitting}
              onClick={() => void handleSubmit()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#141416] py-5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_16px_40px_rgba(20,20,22,0.25)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Zarejestruj się i opublikuj moje ogłoszenie
            </button>
          </section>
        </div>

        <p className="eos-muted-copy mt-8 text-center text-[11px] leading-relaxed">
          Import działa tak samo jak w narzędziu KEI AMER — przepisujemy opis, kopiujemy zdjęcia i publikujemy ofertę na
          Twoim profilu. Kupujący z Radaru i mapy zobaczą Cię w ekosystemie EstateOS™.
        </p>
      </div>

      {/* Progress overlay */}
      <AnimatePresence>
        {submitting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-6 backdrop-blur-md"
          >
            <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#101014] p-8 text-white shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">Publikujemy…</p>
              <h2 className="mt-2 text-xl font-black">Twój dom na mapie EstateOS™</h2>
              <ul className="mt-6 space-y-3">
                {progress.map((step) => (
                  <li key={step.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        step.done
                          ? 'border-emerald-500 bg-emerald-500 text-black'
                          : step.active
                            ? 'border-emerald-500/50 text-emerald-400'
                            : 'border-white/15 text-white/30'
                      }`}
                    >
                      {step.done ? <Check size={14} /> : step.active ? <Loader2 size={14} className="animate-spin" /> : null}
                    </span>
                    <span className={step.done || step.active ? 'text-white' : 'text-white/40'}>{step.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
