'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle,
  Loader2,
  Lock,
  Mail,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';
import ProfileMediaAvatar from '@/components/profile/ProfileMediaAvatar';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import { useLocale } from '@/contexts/LocaleContext';
import { resolvePostAuthDestination } from '@/lib/offerShareIntent';

/** Zgodne z aplikacją mobilną: PRIVATE | AGENT (bez PARTNER — partner/Pro tylko przez /cennik). */
type AccountKind = 'private' | 'agent';
type AgencySetupMode = 'create' | 'join';

type CompanyOption = {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  activeAgents: number;
};

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

function resolveSafeNextPath(raw: string | undefined): string {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/moje-konto";
  if (next.startsWith("/login")) return "/moje-konto";
  return next;
}

export default function RegisterForm({
  afterRegisterPath,
  initialAccountKind = 'private',
}: {
  afterRegisterPath?: string;
  initialAccountKind?: AccountKind;
}) {
  const { dict } = useLocale();
  const t = dict.auth;
  const router = useRouter();
  const postRegisterPath = resolveSafeNextPath(afterRegisterPath);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind>(initialAccountKind);
  const [agencySetupMode, setAgencySetupMode] = useState<AgencySetupMode>('create');
  const [joinCompanyId, setJoinCompanyId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [officeEmail, setOfficeEmail] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const [phoneStatus, setPhoneStatus] = useState<FieldStatus>('idle');
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkExists = useCallback(async (field: 'email' | 'phone', value: string) => {
    if (!value.trim()) return false;
    const body =
      field === 'email' ? { field: 'email', value } : { field: 'phone', phone: value, contactPhone: value };
    const res = await fetch('/api/auth/check-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return !!data.exists;
  }, []);

  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (emailFocused) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    emailTimer.current = setTimeout(async () => {
      try {
        const exists = await checkExists('email', trimmed);
        setEmailStatus(exists ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    }, 450);
    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [email, emailFocused, checkExists]);

  useEffect(() => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (phoneFocused) return;
    const e164 = normalizePhoneE164(phoneE164);
    if (!e164) {
      setPhoneStatus('idle');
      return;
    }
    setPhoneStatus('checking');
    phoneTimer.current = setTimeout(async () => {
      try {
        const exists = await checkExists('phone', e164);
        setPhoneStatus(exists ? 'taken' : 'available');
      } catch {
        setPhoneStatus('idle');
      }
    }, 450);
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    };
  }, [phoneE164, phoneFocused, checkExists]);

  const handlePhoneChange = useCallback((v: string) => setPhoneE164(v), []);

  useEffect(() => {
    if (accountKind !== 'agent') return;
    let cancelled = false;
    setCompaniesLoading(true);
    fetch('/api/agency-company/list')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setCompanyOptions(data.companies || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountKind]);

  const selectedCompany = useMemo(
    () => companyOptions.find((c) => c.id === joinCompanyId) ?? null,
    [companyOptions, joinCompanyId],
  );

  const companyFieldsLocked = accountKind === 'agent' && agencySetupMode === 'join' && !!selectedCompany;

  useEffect(() => {
    if (!companyFieldsLocked || !selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setCompanyAddress(selectedCompany.address || '');
    setCompanyWebsite(selectedCompany.website || '');
    setCompanyLogoUrl(selectedCompany.logoUrl || '');
    setOfficePhone(selectedCompany.officePhone || '');
    setOfficeEmail(selectedCompany.officeEmail || '');
  }, [companyFieldsLocked, selectedCompany]);

  const handleLogoFile = async (file: File | null) => {
    if (!file || companyFieldsLocked) return;
    setLogoUploadError('');
    setLogoUploading(true);
    setLogoFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/agency-branding', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        setLogoUploadError(data.error || 'Nie udało się wgrać pliku.');
        setCompanyLogoUrl('');
        return;
      }
      setCompanyLogoUrl(String(data.url));
    } catch {
      setLogoUploadError('Błąd połączenia podczas uploadu.');
      setCompanyLogoUrl('');
    } finally {
      setLogoUploading(false);
    }
  };

  const rolePayload = (): {
    role: 'PRIVATE' | 'AGENT';
    companyName?: string;
    agencyMode?: AgencySetupMode;
    joinCompanyId?: number;
  } => {
    if (accountKind === 'agent') {
      return {
        role: 'AGENT',
        companyName: companyName.trim(),
        agencyMode: agencySetupMode,
        joinCompanyId: agencySetupMode === 'join' && joinCompanyId ? joinCompanyId : undefined,
      };
    }
    return { role: 'PRIVATE' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const e164 = normalizePhoneE164(phoneE164);

    if (!firstName.trim() || !lastName.trim()) {
      setError(t.errNameRequired);
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError(t.errEmailInvalid);
      return;
    }
    if (!e164) {
      setError(t.errPhoneInvalid);
      return;
    }
    if (password.length < 6) {
      setError(t.errPasswordShort);
      return;
    }
    if (password !== passwordConfirm) {
      setError(t.errPasswordMismatch);
      return;
    }
    if (accountKind === 'agent' && agencySetupMode === 'create' && companyName.trim().length < 2) {
      setError(t.errAgencyShort);
      return;
    }
    if (accountKind === 'agent' && agencySetupMode === 'join' && !joinCompanyId) {
      setError('Wybierz biuro, do którego chcesz dołączyć.');
      return;
    }
    if (accountKind === 'agent' && officeEmail.trim() && !officeEmail.includes('@')) {
      setError('Podaj poprawny e-mail biura.');
      return;
    }
    if (accountKind === 'agent' && companyWebsite.trim() && !/^https?:\/\//i.test(companyWebsite.trim())) {
      setError('Strona www musi zaczynać się od http:// lub https://');
      return;
    }
    if (!acceptTerms) {
      setError(t.errTerms);
      return;
    }
    if (emailStatus === 'taken') {
      setError(t.errEmailTaken);
      return;
    }
    if (phoneStatus === 'taken') {
      setError(t.errPhoneTaken);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: trimmedEmail,
          password,
          phone: e164,
          contactPhone: e164,
          ...rolePayload(),
          companyAddress: accountKind === 'agent' ? companyAddress.trim() : undefined,
          companyWebsite: accountKind === 'agent' ? companyWebsite.trim() : undefined,
          companyLogoUrl: accountKind === 'agent' ? companyLogoUrl.trim() : undefined,
          officePhone: accountKind === 'agent' ? officePhone.trim() : undefined,
          officeEmail: accountKind === 'agent' ? officeEmail.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || t.errRegisterFailed);
        setLoading(false);
        return;
      }

      setSuccessMsg(
        data.partnerWelcome?.message
          ? data.partnerWelcome.message
          : data.agencyMembership?.pendingApproval
            ? 'Konto utworzone. Administrator firmy musi zatwierdzić Twoje zgłoszenie.'
            : t.successRegister,
      );
      const role = data.role || data.user?.role || 'USER';
      window.setTimeout(() => {
        void (async () => {
          if (role === 'ADMIN') {
            window.location.href = '/centrala';
            return;
          }
          if (data.agencyMembership?.pendingApproval) {
            window.location.href = '/moje-konto/firma?pending=1';
            return;
          }
          if (data.agencyMembership?.role === 'ADMIN') {
            window.location.href = '/moje-konto/firma';
            return;
          }
          const destination = await resolvePostAuthDestination(postRegisterPath, role);
          window.location.href = destination;
        })();
      }, 400);
    } catch {
      setError(t.errConnection);
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="eos-auth-card space-y-6 rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 shadow-2xl"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="eos-label mb-2 flex items-center gap-2">
            <User size={14} /> {t.firstName}
          </label>
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="eos-field"
            placeholder="Jan"
          />
        </div>
        <div>
          <label className="eos-label mb-2 flex items-center gap-2">
            <User size={14} /> Nazwisko
          </label>
          <input
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="eos-field"
            placeholder="Kowalski"
          />
        </div>
      </div>

      <div>
        <label className="eos-label mb-2 flex items-center gap-2">
          <Mail size={14} /> {t.email}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          className={`eos-field ${
            !emailFocused && emailStatus === 'taken'
              ? 'border-red-500/50'
              : !emailFocused && emailStatus === 'available'
                ? 'border-emerald-500/50'
                : ''
          }`}
          placeholder="jan@example.com"
        />
        {!emailFocused && emailStatus === 'checking' && (
          <p className="eos-muted-copy mt-2 text-[10px] font-bold uppercase tracking-widest">{t.checkingEmail}</p>
        )}
        {!emailFocused && emailStatus === 'taken' && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">{t.emailTaken}</p>
        )}
      </div>

      <PhoneCountryInput
        valueE164={phoneE164}
        onChangeE164={handlePhoneChange}
        disabled={loading}
        status={phoneFocused ? 'idle' : phoneStatus}
        onFocusChange={setPhoneFocused}
      />

      <div>
        <label className="eos-label mb-2 flex items-center gap-2">
          <Lock size={14} /> {t.passwordMin}
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="eos-field"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="eos-label mb-2 flex items-center gap-2">
          <Lock size={14} /> {t.passwordRepeat}
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="eos-field"
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-3">
        <p className="eos-label">{t.accountTypeLabel}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                id: 'private' as const,
                label: t.accountPrivate,
                desc: t.accountPrivateDesc,
              },
              {
                id: 'agent' as const,
                label: t.accountAgent,
                desc: t.accountAgentDesc,
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAccountKind(opt.id)}
              className={`eos-choice-card rounded-2xl px-4 py-3 text-left ${
                accountKind === opt.id ? 'eos-choice-card--active' : ''
              }`}
            >
              <span className="block text-sm font-black text-[var(--eos-text)]">{opt.label}</span>
              <span className="eos-muted-copy text-[10px] leading-relaxed">{opt.desc}</span>
            </button>
          ))}
        </div>
        <p className="eos-subtle-copy text-[10px] leading-relaxed">
          {t.proPricingNote}{' '}
          <Link href="/cennik" className="text-emerald-500 hover:underline">
            /cennik
          </Link>
        </p>
      </div>

      {accountKind === 'agent' && (
        <div className="space-y-4">
          <div>
            <p className="eos-label mb-2">Typ rejestracji agenta</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: 'create' as const,
                    label: 'Zakładam nowe biuro',
                    desc: 'Pierwsza osoba zostaje administratorem firmy.',
                  },
                  {
                    id: 'join' as const,
                    label: 'Dołączam do istniejącego biura',
                    desc: 'Wybierz firmę — administrator zatwierdzi zgłoszenie.',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAgencySetupMode(opt.id);
                    if (opt.id === 'create') setJoinCompanyId(null);
                  }}
                  className={`eos-choice-card rounded-2xl px-4 py-3 text-left ${
                    agencySetupMode === opt.id ? 'eos-choice-card--active' : ''
                  }`}
                >
                  <span className="block text-sm font-black text-[var(--eos-text)]">{opt.label}</span>
                  <span className="eos-muted-copy text-[10px] leading-relaxed">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {agencySetupMode === 'join' && (
            <div>
              <label className="eos-label mb-2 flex items-center gap-2">
                <Building2 size={14} /> Wybierz biuro
              </label>
              {companiesLoading ? (
                <p className="eos-muted-copy text-xs">Ładowanie listy biur…</p>
              ) : companyOptions.length === 0 ? (
                <p className="text-xs text-amber-600">
                  Brak zarejestrowanych biur. Załóż nowe biuro lub poproś administratora o utworzenie firmy.
                </p>
              ) : (
                <select
                  value={joinCompanyId ?? ''}
                  onChange={(e) => setJoinCompanyId(e.target.value ? Number(e.target.value) : null)}
                  className="eos-field w-full"
                  required
                >
                  <option value="">— wybierz biuro —</option>
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.activeAgents > 0 ? ` (${c.activeAgents} agentów)` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="eos-label mb-2 flex items-center gap-2">
              <Building2 size={14} /> {t.agencyName}
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              readOnly={companyFieldsLocked}
              className={`eos-field ${companyFieldsLocked ? 'opacity-80' : ''}`}
              placeholder={t.agencyPlaceholder}
            />
          </div>
          <div>
            <label className="eos-label mb-2">Adres biura (ulica, nr, kod, miasto)</label>
            <input
              type="text"
              maxLength={255}
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              readOnly={companyFieldsLocked}
              className={`eos-field ${companyFieldsLocked ? 'opacity-80' : ''}`}
              placeholder="np. ul. Marszałkowska 10/4, 00-590 Warszawa"
            />
          </div>
          <div>
            <label className="eos-label mb-2">Strona internetowa agencji</label>
            <input
              type="url"
              maxLength={255}
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              readOnly={companyFieldsLocked}
              className={`eos-field ${companyFieldsLocked ? 'opacity-80' : ''}`}
              placeholder="https://twoja-agencja.pl"
            />
          </div>
          <div>
            <label className="eos-label mb-2">Logo lub dokument biura</label>
            {companyFieldsLocked ? (
              companyLogoUrl ? (
                <div className="flex items-center gap-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                  <div className="size-16 overflow-hidden rounded-xl">
                    <ProfileMediaAvatar src={companyLogoUrl} alt="" iconSize={24} className="size-full object-cover" />
                  </div>
                  <p className="eos-muted-copy text-xs">Logo pobrane z profilu wybranego biura.</p>
                </div>
              ) : (
                <p className="eos-muted-copy text-xs">Wybrane biuro nie ma wgranego logo.</p>
              )
            ) : (
              <div className="space-y-3">
                <label className="eos-choice-card flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed px-4 py-8 text-center">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="sr-only"
                    disabled={loading || logoUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void handleLogoFile(f);
                    }}
                  />
                  {logoUploading ? (
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                  ) : (
                    <Upload className="text-emerald-500" size={24} />
                  )}
                  <span className="text-sm font-bold text-[var(--eos-text)]">
                    {logoFileName || 'Kliknij, aby wgrać logo lub PDF'}
                  </span>
                  <span className="eos-muted-copy text-[10px]">JPG, PNG, WEBP, GIF lub PDF · max 5 MB</span>
                </label>
                {companyLogoUrl && !logoUploading ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="size-14 overflow-hidden rounded-xl">
                      <ProfileMediaAvatar src={companyLogoUrl} alt="" iconSize={22} className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-600">Plik wgrany</p>
                      <p className="eos-muted-copy truncate text-[10px]">{companyLogoUrl}</p>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-bold uppercase tracking-widest text-red-500"
                      onClick={() => {
                        setCompanyLogoUrl('');
                        setLogoFileName('');
                      }}
                    >
                      Usuń
                    </button>
                  </div>
                ) : null}
                {logoUploadError ? <p className="text-xs font-semibold text-red-500">{logoUploadError}</p> : null}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="eos-label mb-2">Numer kontaktowy biura</label>
              <input
                type="text"
                maxLength={64}
                value={officePhone}
                onChange={(e) => setOfficePhone(e.target.value)}
                readOnly={companyFieldsLocked}
                className={`eos-field ${companyFieldsLocked ? 'opacity-80' : ''}`}
                placeholder="+48 500 600 700"
              />
            </div>
            <div>
              <label className="eos-label mb-2">E-mail biura</label>
              <input
                type="email"
                maxLength={191}
                value={officeEmail}
                onChange={(e) => setOfficeEmail(e.target.value)}
                readOnly={companyFieldsLocked}
                className={`eos-field ${companyFieldsLocked ? 'opacity-80' : ''}`}
                placeholder="biuro@agencja.pl"
              />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-[1rem] border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold uppercase tracking-widest text-red-500"
          >
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-[1rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-bold uppercase tracking-widest text-emerald-500"
          >
            <CheckCircle size={16} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="eos-choice-card flex cursor-pointer items-start gap-4 rounded-2xl p-4"
        role="checkbox"
        aria-checked={acceptTerms}
        tabIndex={0}
        onClick={() => setAcceptTerms((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setAcceptTerms((v) => !v);
          }
        }}
      >
        <span className={`estate-checkbox shrink-0 ${acceptTerms ? 'checked' : ''}`} aria-hidden>
          <Check size={16} strokeWidth={4} />
        </span>
        <span className="eos-muted-copy text-xs leading-relaxed">
          {t.acceptTermsPrefix}{' '}
          <Link
            href="/regulamin"
            className="text-emerald-500 hover:underline"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            {t.termsLink}
          </Link>{' '}
          {t.acceptTermsMiddle}{' '}
          <Link
            href="/polityka-prywatnosci"
            className="text-emerald-500 hover:underline"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            {t.privacyLink}
          </Link>
          .
        </span>
      </div>

      <button
        type="submit"
        disabled={loading || logoUploading || emailStatus === 'taken' || phoneStatus === 'taken' || !acceptTerms}
        style={{ backgroundColor: '#10b981', color: '#000000' }}
        className="mt-2 flex w-full items-center justify-center gap-3 rounded-full py-6 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={22} /> : <UserPlus size={20} />}
        {loading ? t.submittingRegister : t.submitRegister}
      </button>

      <p className="eos-muted-copy text-center text-[10px] font-bold uppercase tracking-widest">
        {t.hasAccount}{' '}
        <Link href="/login" className="text-emerald-500 hover:text-emerald-400">
          {t.signInLink}
        </Link>
      </p>
    </motion.form>
  );
}
