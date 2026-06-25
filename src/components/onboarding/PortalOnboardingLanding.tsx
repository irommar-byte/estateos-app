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
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import PortalRadarInvestorPreview from '@/components/onboarding/PortalRadarInvestorPreview';
import { useLocale } from '@/contexts/LocaleContext';
import { getPortalOnboardingDict } from '@/i18n/portalOnboardingDictionary';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import type { PortalListingPreview } from '@/lib/portalOnboarding';

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

type ProgressStep = { id: string; label: string; done: boolean; active: boolean };

export default function PortalOnboardingLanding({ inviteToken }: { inviteToken: string }) {
  const { locale } = useLocale();
  const dict = getPortalOnboardingDict(locale);

  const importStepLabels = useMemo(
    () => [
      dict.progressAccount,
      dict.progressFetch,
      dict.progressRewrite,
      dict.progressPhotos,
      dict.progressPublish,
    ],
    [dict],
  );

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
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [success, setSuccess] = useState<{
    profileUrl: string;
    offerId: number;
    imagesUploaded: number;
  } | null>(null);

  useEffect(() => {
    setProgress(
      importStepLabels.map((label, i) => ({
        id: `step-${i}`,
        label,
        done: false,
        active: false,
      })),
    );
  }, [importStepLabels]);

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

  const sourceLabel = (source: string) => {
    if (source === 'OTODOM') return dict.sourceOtodom;
    if (source === 'OLX') return dict.sourceOlx;
    if (source === 'NIERUCHOMOSCI_ONLINE') return dict.sourceNieruchomosci;
    return source;
  };

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
      if (!res.ok) throw new Error(data?.error || 'Preview failed.');
      setPreview(data.preview as PortalListingPreview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Preview error.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const animateProgress = async () => {
    const total = importStepLabels.length;
    for (let i = 0; i < total; i += 1) {
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
    setProgress(importStepLabels.map((label, i) => ({ id: `step-${i}`, label, done: false, active: false })));

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

      if (!res.ok) throw new Error(data?.error || 'Registration failed.');

      setSuccess({
        profileUrl: data.profileUrl,
        offerId: data.offerId,
        imagesUploaded: data.imagesUploaded ?? 0,
      });

      window.setTimeout(() => {
        window.location.href = `${data.profileUrl}?welcome=import`;
      }, 3200);
    } catch (error) {
      await progressPromise.catch(() => null);
      setSubmitError(error instanceof Error ? error.message : 'Operation failed.');
      setProgress(importStepLabels.map((label, i) => ({ id: `step-${i}`, label, done: false, active: false })));
    } finally {
      setSubmitting(false);
    }
  };

  const heroStats = [
    { label: dict.statImport, value: dict.statImportValue },
    { label: dict.statTime, value: dict.statTimeValue },
    { label: dict.statCost, value: dict.statCostValue },
  ];

  if (success) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f3f0] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-[2rem] border border-emerald-500/25 bg-white p-10 text-center shadow-[0_24px_80px_rgba(20,20,22,0.1)]"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#141416]">{dict.successTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5c5c66]">
            {dict.successBody(success.offerId, success.imagesUploaded)}
          </p>
          <Link
            href={success.profileUrl}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-black"
          >
            {dict.successCta} <ArrowRight size={16} />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f4f3f0] text-[#141416]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_520px_at_50%_-8%,rgba(16,185,129,0.1),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(640px_380px_at_100%_100%,rgba(184,146,46,0.08),transparent_55%)]" />

      <div className="relative mx-auto max-w-2xl px-4 pb-20 pt-[calc(env(safe-area-inset-top)+6.5rem)] md:pt-40">
        <header className="mb-12 text-center">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c66] transition hover:text-[#141416]"
            >
              <Building2 size={14} className="text-emerald-600" />
              {dict.brand}
            </Link>
            <LanguageSwitcher />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[clamp(1.75rem,5vw,3rem)] font-black leading-[1.12] tracking-tight text-[#141416]"
          >
            {dict.heroTitle}
            <span className="mt-1 block text-emerald-600">{dict.heroTitleAccent}</span>
          </motion.h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#5c5c66] md:text-base">
            {dict.heroSubtitle}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {heroStats.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5c5c66] shadow-sm"
              >
                {item.label}: <span className="text-[#141416]">{item.value}</span>
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white shadow-[0_20px_50px_rgba(20,20,22,0.07)]">
            <div className="border-b border-black/[0.06] bg-[#fafaf8] px-5 py-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700">
                  1
                </span>
                {dict.step1}
              </p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-semibold text-[#5c5c66]">{dict.step1Label}</label>
              <div className="relative min-w-0">
                <Link2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a94]" />
                <input
                  type="url"
                  value={portalUrl}
                  onChange={(e) => {
                    setPortalUrl(e.target.value);
                    setPreview(null);
                    setPreviewError('');
                  }}
                  placeholder={dict.step1Placeholder}
                  className="w-full rounded-2xl border border-black/[0.1] bg-[#fafaf8] py-4 pl-11 pr-4 text-sm text-[#141416] outline-none transition focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="button"
                disabled={!canPreview || previewLoading}
                onClick={() => void runPreview()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3.5 text-[11px] font-black uppercase tracking-widest text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {dict.previewCta}
              </button>
              {previewError ? (
                <p className="rounded-xl border border-red-500/25 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {previewError}
                </p>
              ) : null}

              <AnimatePresence>
                {preview ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 to-white">
                      <div className="flex gap-4 p-4">
                        {preview.imageUrl ? (
                          <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[#ececea]">
                            <Image src={preview.imageUrl} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-[#ececea] text-[#8a8a94]">
                            <Home size={28} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">
                            {sourceLabel(preview.source)} · {dict.previewReady}
                          </p>
                          <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[#141416]">
                            {preview.title}
                          </h3>
                          <p className="mt-2 text-lg font-black text-[#141416]">{preview.priceLabel}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#5c5c66]">
                            <MapPin size={12} />
                            {[preview.city, preview.district].filter(Boolean).join(' · ')}
                            {preview.area ? ` · ${preview.area} m²` : ''}
                            {preview.rooms ? ` · ${preview.rooms}` : ''}
                          </p>
                          <p className="mt-1 text-[10px] text-[#8a8a94]">{dict.photosToCopy(preview.imageCount)}</p>
                        </div>
                      </div>
                    </div>

                    <PortalRadarInvestorPreview
                      inviteToken={inviteToken}
                      preview={preview}
                      dict={dict}
                      locale={locale}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </section>

          <section
            className={`overflow-hidden rounded-[1.75rem] border bg-white shadow-[0_20px_50px_rgba(20,20,22,0.07)] transition ${
              preview ? 'border-black/[0.08]' : 'border-black/[0.05] opacity-55'
            }`}
          >
            <div className="border-b border-black/[0.06] bg-[#fafaf8] px-5 py-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-700">
                  2
                </span>
                {dict.step2}
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <User size={12} /> {dict.firstName}
                </span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/[0.1] bg-[#fafaf8] px-4 py-3.5 text-sm text-[#141416] outline-none focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1.5 text-xs font-semibold text-[#5c5c66]">{dict.lastName}</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/[0.1] bg-[#fafaf8] px-4 py-3.5 text-sm text-[#141416] outline-none focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Mail size={12} /> {dict.email}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/[0.1] bg-[#fafaf8] px-4 py-3.5 text-sm text-[#141416] outline-none focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                />
                {emailStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-red-600">{dict.emailTaken}</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Phone size={12} /> {dict.phone}
                </span>
                <PhoneCountryInput
                  valueE164={phoneE164}
                  onChangeE164={setPhoneE164}
                  disabled={!preview}
                  status={phoneStatus}
                />
                {phoneStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-red-600">{dict.phoneTaken}</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5c5c66]">
                  <Lock size={12} /> {dict.password}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!preview}
                  className="w-full rounded-2xl border border-black/[0.1] bg-[#fafaf8] px-4 py-3.5 text-sm text-[#141416] outline-none focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-black/[0.08] bg-white p-5 shadow-[0_20px_50px_rgba(20,20,22,0.07)]">
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-[#5c5c66]">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                disabled={!preview}
                className="mt-1 shrink-0 accent-emerald-600"
              />
              <span>{dict.rightsLabel}</span>
            </label>
            <label className="mt-4 flex cursor-pointer gap-3 text-sm leading-relaxed text-[#5c5c66]">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={!preview}
                className="mt-1 shrink-0 accent-emerald-600"
              />
              <span>
                {dict.termsLabel}{' '}
                <Link href="/regulamin" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                  {dict.termsLink}
                </Link>{' '}
                ·{' '}
                <Link
                  href="/polityka-prywatnosci"
                  className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
                >
                  {dict.privacyLink}
                </Link>
              </span>
            </label>

            {submitError ? (
              <p className="mt-4 rounded-xl border border-red-500/25 bg-red-50 px-3 py-2 text-xs text-red-600">
                {submitError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!formReady || submitting}
              onClick={() => void handleSubmit()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#141416] py-5 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_40px_rgba(20,20,22,0.2)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {dict.submitCta}
            </button>
          </section>
        </div>

        <p className="mt-10 text-center text-[11px] leading-relaxed text-[#8a8a94]">{dict.footerNote}</p>
      </div>

      <AnimatePresence>
        {submitting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[#141416]/50 p-6 backdrop-blur-md"
          >
            <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-600">{dict.publishing}</p>
              <h2 className="mt-2 text-xl font-black text-[#141416]">{dict.publishingTitle}</h2>
              <ul className="mt-6 space-y-3">
                {progress.map((step) => (
                  <li key={step.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        step.done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : step.active
                            ? 'border-emerald-500/50 text-emerald-600'
                            : 'border-black/10 text-[#c4c4cc]'
                      }`}
                    >
                      {step.done ? (
                        <Check size={14} />
                      ) : step.active ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                    </span>
                    <span className={step.done || step.active ? 'font-medium text-[#141416]' : 'text-[#8a8a94]'}>
                      {step.label}
                    </span>
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
