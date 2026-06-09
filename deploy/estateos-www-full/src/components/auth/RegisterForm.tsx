'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  User,
  UserPlus,
} from 'lucide-react';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import { useLocale } from '@/contexts/LocaleContext';

/** Zgodne z aplikacją mobilną: PRIVATE | AGENT (bez PARTNER — partner/Pro tylko przez /cennik). */
type AccountKind = 'private' | 'agent';

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

function resolveSafeNextPath(raw: string | undefined): string {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/moje-konto";
  if (next.startsWith("/login")) return "/moje-konto";
  return next;
}

export default function RegisterForm({ afterRegisterPath }: { afterRegisterPath?: string }) {
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
  const [accountKind, setAccountKind] = useState<AccountKind>('private');
  const [companyName, setCompanyName] = useState('');
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

  const rolePayload = (): { role: 'PRIVATE' | 'AGENT'; companyName?: string } => {
    if (accountKind === 'agent') {
      return { role: 'AGENT', companyName: companyName.trim() };
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
    if (accountKind === 'agent' && companyName.trim().length < 2) {
      setError(t.errAgencyShort);
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
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || t.errRegisterFailed);
        setLoading(false);
        return;
      }

      setSuccessMsg(t.successRegister);
      const role = data.role || data.user?.role || 'USER';
      window.setTimeout(() => {
        window.location.href =
          role === 'ADMIN' ? '/centrala' : postRegisterPath;
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
            className="eos-field"
            placeholder={t.agencyPlaceholder}
          />
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
        disabled={loading || emailStatus === 'taken' || phoneStatus === 'taken' || !acceptTerms}
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
