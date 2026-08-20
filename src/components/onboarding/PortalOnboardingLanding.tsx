'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { ImportDraftIssue } from '@/lib/importDraftValidate';
import { isNonCityLabel } from '@/lib/location/locationCatalog';

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

type ProgressStep = { id: string; label: string; done: boolean; active: boolean };

const PO_FIELD =
  'po-field w-full rounded-2xl text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50';

type ImportPatchForm = {
  city: string;
  district: string;
  price: string;
  area: string;
};

function issueNeedsField(issues: ImportDraftIssue[], field: string): boolean {
  return issues.some((issue) => issue.field === field);
}

function importPatchSatisfiesIssues(issues: ImportDraftIssue[], patch: ImportPatchForm): boolean {
  for (const issue of issues) {
    if (issue.field === 'city') {
      if (issue.kind === 'invalid' && !patch.city.trim()) return false;
      if (!patch.city.trim() && !patch.district.trim()) return false;
      continue;
    }
    if (issue.field === 'price') {
      if (!(Number(patch.price) > 0)) return false;
      continue;
    }
    if (issue.field === 'area') {
      if (!(Number(patch.area) > 0)) return false;
      continue;
    }
    if (issue.field === 'coords') continue;
  }
  return true;
}

function PortalCheckbox({
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 text-sm leading-relaxed text-[var(--po-muted)] ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`estate-checkbox eos-form-checkbox mt-0.5 shrink-0 ${checked ? 'checked' : ''}`}
        aria-hidden
      >
        <Check size={16} strokeWidth={4} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="sr-only"
      />
      <span>{children}</span>
    </label>
  );
}

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
  const [previewIssues, setPreviewIssues] = useState<ImportDraftIssue[]>([]);
  const [importPatch, setImportPatch] = useState<ImportPatchForm>({
    city: '',
    district: '',
    price: '',
    area: '',
  });
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

  const showLocationPatch =
    previewIssues.some((issue) => issue.field === 'city') ||
    Boolean(preview?.city && isNonCityLabel(preview.city));

  const locationPatchReady =
    !showLocationPatch ||
    (importPatch.city.trim().length > 0 && !isNonCityLabel(importPatch.city));

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
    phoneStatus !== 'taken' &&
    locationPatchReady &&
    importPatchSatisfiesIssues(previewIssues, importPatch);

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
    setPreviewIssues([]);
    setImportPatch({ city: '', district: '', price: '', area: '' });
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/portal-onboarding/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite: inviteToken, url: portalUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Preview failed.');
      const nextPreview = data.preview as PortalListingPreview;
      const issues = Array.isArray(data.issues) ? (data.issues as ImportDraftIssue[]) : [];
      setPreview(nextPreview);
      setPreviewIssues(issues);
      setImportPatch({
        city: nextPreview.city || '',
        district: nextPreview.district || '',
        price: nextPreview.price != null ? String(nextPreview.price) : '',
        area: nextPreview.area != null ? String(nextPreview.area) : '',
      });
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
          city: importPatch.city.trim() || undefined,
          district: importPatch.district.trim() || undefined,
          price: importPatch.price.trim() ? Number(importPatch.price) : undefined,
          area: importPatch.area.trim() ? Number(importPatch.area) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      await progressPromise;

      if (!res.ok) {
        if (Array.isArray(data?.issues)) {
          setPreviewIssues(data.issues as ImportDraftIssue[]);
        } else if (data?.code === 'LOCATION_MISMATCH' || /pinezk/i.test(String(data?.error || ''))) {
          setPreviewIssues([
            {
              field: 'city',
              kind: 'invalid',
              message: String(data?.error || 'Popraw miejscowość.'),
            },
          ]);
        }
        throw new Error(data?.error || 'Registration failed.');
      }

      setSuccess({
        profileUrl: data.profileUrl,
        offerId: data.offerId,
        imagesUploaded: data.imagesUploaded ?? 0,
      });

      window.setTimeout(() => {
        window.location.href = `${data.profileUrl}?welcome=import&offer=${data.offerId}`;
      }, 3800);
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
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-[2rem] border border-emerald-500/25 bg-[var(--po-card)] p-10 text-center shadow-[var(--po-shadow)]"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--po-text)]">{dict.successTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--po-muted)]">
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
    <main className="min-h-[100dvh]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_520px_at_50%_-8%,rgba(16,185,129,0.1),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(640px_380px_at_100%_100%,rgba(184,146,46,0.08),transparent_55%)]" />

      <div className="relative mx-auto max-w-2xl px-4 pb-20 pt-[calc(env(safe-area-inset-top)+6.5rem)] md:pt-40">
        <header className="mb-12 text-center">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--po-muted)] transition hover:text-[var(--po-text)]"
            >
              <Building2 size={14} className="text-emerald-600" />
              {dict.brand}
            </Link>
            <LanguageSwitcher />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[clamp(1.75rem,5vw,3rem)] font-black leading-[1.12] tracking-tight text-[var(--po-text)]"
          >
            {dict.heroTitle}
            <span className="mt-1 block text-emerald-500">{dict.heroTitleAccent}</span>
          </motion.h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[var(--po-muted)] md:text-base">
            {dict.heroSubtitle}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {heroStats.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-[var(--po-border)] bg-[var(--po-card)] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--po-muted)] shadow-sm"
              >
                {item.label}: <span className="text-[var(--po-text)]">{item.value}</span>
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[1.75rem] border border-[var(--po-border)] bg-[var(--po-card)] shadow-[var(--po-shadow)]">
            <div className="border-b border-[var(--po-border-soft)] bg-[var(--po-card-alt)] px-5 py-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-600 dark:text-emerald-400">
                  1
                </span>
                {dict.step1}
              </p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-semibold text-[var(--po-muted)]">{dict.step1Label}</label>
              <div className="relative min-w-0">
                <Link2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--po-subtle)]" />
                <input
                  type="url"
                  value={portalUrl}
                  onChange={(e) => {
                    setPortalUrl(e.target.value);
                    setPreview(null);
                    setPreviewIssues([]);
                    setImportPatch({ city: '', district: '', price: '', area: '' });
                    setPreviewError('');
                  }}
                  placeholder={dict.step1Placeholder}
                  className={`${PO_FIELD} py-4 pl-11 pr-4`}
                />
              </div>
              <button
                type="button"
                disabled={!canPreview || previewLoading}
                onClick={() => void runPreview()}
                className="eos-btn eos-btn--home eos-btn--block"
              >
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {dict.previewCta}
              </button>
              {previewError ? (
                <p className="rounded-xl border border-[var(--po-error-border)] bg-[var(--po-error-bg)] px-3 py-2 text-xs text-[var(--po-error-text)]">
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
                    <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-[var(--po-card)]">
                      <div className="flex gap-4 p-4">
                        {preview.imageUrl ? (
                          <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--po-thumb)]">
                            <Image src={preview.imageUrl} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-[var(--po-thumb)] text-[var(--po-subtle)]">
                            <Home size={28} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            {sourceLabel(preview.source)} · {dict.previewReady}
                          </p>
                          <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[var(--po-text)]">
                            {preview.title}
                          </h3>
                          <p className="mt-2 text-lg font-black text-[var(--po-text)]">{preview.priceLabel}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--po-muted)]">
                            <MapPin size={12} />
                            {[preview.city, preview.district].filter(Boolean).join(' · ')}
                            {preview.area ? ` · ${preview.area} m²` : ''}
                            {preview.rooms ? ` · ${preview.rooms}` : ''}
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--po-subtle)]">{dict.photosToCopy(preview.imageCount)}</p>
                        </div>
                      </div>
                    </div>

                    {(previewIssues.length > 0 || showLocationPatch) ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-sm font-bold text-[var(--po-text)]">{dict.patchSectionTitle}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--po-muted)]">
                          {previewIssues.find((issue) => issue.field === 'city')?.message || dict.patchSectionHint}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {showLocationPatch ? (
                            <>
                              <label className="block sm:col-span-1">
                                <span className="mb-1.5 block text-xs font-semibold text-[var(--po-muted)]">
                                  {dict.patchCity}
                                </span>
                                <input
                                  value={importPatch.city}
                                  onChange={(e) =>
                                    setImportPatch((p) => ({ ...p, city: e.target.value }))
                                  }
                                  className={`${PO_FIELD} px-4 py-3.5`}
                                  placeholder="np. Warszawa"
                                />
                              </label>
                              <label className="block sm:col-span-1">
                                <span className="mb-1.5 block text-xs font-semibold text-[var(--po-muted)]">
                                  {dict.patchDistrict}
                                </span>
                                <input
                                  value={importPatch.district}
                                  onChange={(e) =>
                                    setImportPatch((p) => ({ ...p, district: e.target.value }))
                                  }
                                  className={`${PO_FIELD} px-4 py-3.5`}
                                  placeholder="np. Służew"
                                />
                              </label>
                            </>
                          ) : null}
                          {issueNeedsField(previewIssues, 'price') ? (
                            <label className="block sm:col-span-1">
                              <span className="mb-1.5 block text-xs font-semibold text-[var(--po-muted)]">
                                {dict.patchPrice}
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={importPatch.price}
                                onChange={(e) =>
                                  setImportPatch((p) => ({ ...p, price: e.target.value }))
                                }
                                className={`${PO_FIELD} px-4 py-3.5`}
                              />
                            </label>
                          ) : null}
                          {issueNeedsField(previewIssues, 'area') ? (
                            <label className="block sm:col-span-1">
                              <span className="mb-1.5 block text-xs font-semibold text-[var(--po-muted)]">
                                {dict.patchArea}
                              </span>
                              <input
                                type="number"
                                min={1}
                                step="0.01"
                                value={importPatch.area}
                                onChange={(e) =>
                                  setImportPatch((p) => ({ ...p, area: e.target.value }))
                                }
                                className={`${PO_FIELD} px-4 py-3.5`}
                              />
                            </label>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

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
            className={`overflow-hidden rounded-[1.75rem] border bg-[var(--po-card)] shadow-[var(--po-shadow)] transition ${
              preview ? 'border-[var(--po-border)]' : 'border-[var(--po-border-soft)] opacity-55'
            }`}
          >
            <div className="border-b border-[var(--po-border-soft)] bg-[var(--po-card-alt)] px-5 py-4">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-600 dark:text-emerald-400">
                  2
                </span>
                {dict.step2}
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--po-muted)]">
                  <User size={12} /> {dict.firstName}
                </span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={!preview}
                  className={`${PO_FIELD} px-4 py-3.5`}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1.5 text-xs font-semibold text-[var(--po-muted)]">{dict.lastName}</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={!preview}
                  className={`${PO_FIELD} px-4 py-3.5`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--po-muted)]">
                  <Mail size={12} /> {dict.email}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!preview}
                  className={`${PO_FIELD} px-4 py-3.5`}
                />
                {emailStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-[var(--po-error-text)]">{dict.emailTaken}</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--po-muted)]">
                  <Phone size={12} /> {dict.phone}
                </span>
                <div className="portal-onboarding-phone">
                  <PhoneCountryInput
                    valueE164={phoneE164}
                    onChangeE164={setPhoneE164}
                    disabled={!preview}
                    status={phoneStatus}
                    hideLabel
                  />
                </div>
                {phoneStatus === 'taken' ? (
                  <p className="mt-1 text-xs text-[var(--po-error-text)]">{dict.phoneTaken}</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--po-muted)]">
                  <Lock size={12} /> {dict.password}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!preview}
                  className={`${PO_FIELD} px-4 py-3.5`}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--po-border)] bg-[var(--po-card)] p-5 shadow-[var(--po-shadow)]">
            <PortalCheckbox
              checked={rightsConfirmed}
              onCheckedChange={setRightsConfirmed}
              disabled={!preview}
            >
              {dict.rightsLabel}
            </PortalCheckbox>
            <div className="mt-4">
              <PortalCheckbox
                checked={acceptTerms}
                onCheckedChange={setAcceptTerms}
                disabled={!preview}
              >
                {dict.termsLabel}{' '}
                <Link
                  href="/regulamin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  {dict.termsLink}
                </Link>{' '}
                ·{' '}
                <Link
                  href="/polityka-prywatnosci"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  {dict.privacyLink}
                </Link>
              </PortalCheckbox>
            </div>

            {submitError ? (
              <p className="mt-4 rounded-xl border border-[var(--po-error-border)] bg-[var(--po-error-bg)] px-3 py-2 text-xs text-[var(--po-error-text)]">
                {submitError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!formReady || submitting}
              onClick={() => void handleSubmit()}
              className="eos-dark-cta mt-6 flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#141416] py-5 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_40px_rgba(20,20,22,0.2)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {dict.submitCta}
            </button>
          </section>
        </div>

        <p className="mt-10 text-center text-[11px] leading-relaxed text-[var(--po-subtle)]">{dict.footerNote}</p>
      </div>

      <AnimatePresence>
        {submitting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--po-overlay)] p-6 backdrop-blur-md"
          >
            <div className="w-full max-w-sm rounded-[2rem] border border-[var(--po-border)] bg-[var(--po-card)] p-8 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-500">{dict.publishing}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--po-text)]">{dict.publishingTitle}</h2>
              <ul className="mt-6 space-y-3">
                {progress.map((step) => (
                  <li key={step.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        step.done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : step.active
                            ? 'border-emerald-500/50 text-emerald-500'
                            : 'border-[var(--po-border)] text-[var(--po-subtle)]'
                      }`}
                    >
                      {step.done ? (
                        <Check size={14} />
                      ) : step.active ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                    </span>
                    <span className={step.done || step.active ? 'font-medium text-[var(--po-text)]' : 'text-[var(--po-subtle)]'}>
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
