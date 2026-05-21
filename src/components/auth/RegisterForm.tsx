'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
} from 'lucide-react';
import PhoneCountryInput from '@/components/auth/PhoneCountryInput';
import { normalizePhoneE164 } from '@/lib/phoneE164';

type AccountKind = 'private' | 'partner' | 'agency';

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function RegisterForm() {
  const router = useRouter();
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
  }, [email, checkExists]);

  useEffect(() => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
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
  }, [phoneE164, checkExists]);

  const handlePhoneChange = useCallback((v: string) => setPhoneE164(v), []);

  const rolePayload = (): { role?: string; companyName?: string } => {
    if (accountKind === 'partner') return { role: 'PARTNER' };
    if (accountKind === 'agency') return { role: 'AGENT', companyName: companyName.trim() };
    return {};
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const e164 = normalizePhoneE164(phoneE164);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Podaj imię i nazwisko.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Podaj prawidłowy adres e-mail.');
      return;
    }
    if (!e164) {
      setError('Podaj prawidłowy numer telefonu (z kodem kraju).');
      return;
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Hasła nie są identyczne.');
      return;
    }
    if (accountKind === 'agency' && !companyName.trim()) {
      setError('Podaj nazwę biura nieruchomości.');
      return;
    }
    if (!acceptTerms) {
      setError('Zaakceptuj regulamin i politykę prywatności.');
      return;
    }
    if (emailStatus === 'taken') {
      setError('Ten adres e-mail jest już zarejestrowany.');
      return;
    }
    if (phoneStatus === 'taken') {
      setError('Ten numer telefonu jest już w użyciu.');
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
          email: trimmedEmail,
          password,
          phone: e164,
          contactPhone: e164,
          ...rolePayload(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Rejestracja nie powiodła się.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Konto utworzone. Przekierowuję…');
      const role = data.role || data.user?.role || 'USER';
      window.location.href = role === 'ADMIN' ? '/centrala' : '/moje-konto';
    } catch {
      setError('Błąd połączenia z serwerem.');
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6 rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            <User size={14} /> Imię
          </label>
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500"
            placeholder="Jan"
          />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            <User size={14} /> Nazwisko
          </label>
          <input
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500"
            placeholder="Kowalski"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          <Mail size={14} /> E-mail
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full rounded-2xl border bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500 ${
            emailStatus === 'taken'
              ? 'border-red-500/50'
              : emailStatus === 'available'
                ? 'border-emerald-500/50'
                : 'border-white/10'
          }`}
          placeholder="jan@example.com"
        />
        {emailStatus === 'checking' && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Sprawdzam e-mail…</p>
        )}
        {emailStatus === 'taken' && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">E-mail już zarejestrowany</p>
        )}
      </div>

      <PhoneCountryInput
        valueE164={phoneE164}
        onChangeE164={handlePhoneChange}
        disabled={loading}
        status={phoneStatus}
      />

      <div>
        <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          <Lock size={14} /> Hasło (min. 6 znaków)
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          <Lock size={14} /> Powtórz hasło
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500"
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Typ konta</p>
        <div className="grid gap-2">
          {(
            [
              { id: 'private' as const, label: 'Kupuję / szukam nieruchomości', desc: 'Konto prywatne' },
              { id: 'partner' as const, label: 'Partner EstateOS™', desc: 'Tryb biura partnerskiego (jak w aplikacji)' },
              { id: 'agency' as const, label: 'Biuro nieruchomości (agent)', desc: 'Wymaga nazwy firmy' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAccountKind(opt.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                accountKind === opt.id
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-white/10 bg-black/20 hover:border-white/20'
              }`}
            >
              <span className="block text-sm font-black text-white">{opt.label}</span>
              <span className="text-[10px] text-white/40">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {accountKind === 'agency' && (
        <div>
          <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            <Building2 size={14} /> Nazwa biura
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none focus:border-emerald-500"
            placeholder="Nazwa agencji"
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

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1 size-4 accent-emerald-500"
        />
        <span className="text-xs leading-relaxed text-white/60">
          Akceptuję{' '}
          <Link href="/regulamin" className="text-emerald-500 hover:underline" target="_blank">
            regulamin
          </Link>{' '}
          oraz{' '}
          <Link href="/polityka-prywatnosci" className="text-emerald-500 hover:underline" target="_blank">
            politykę prywatności
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={
          loading ||
          emailStatus === 'taken' ||
          phoneStatus === 'taken' ||
          !acceptTerms
        }
        style={{ backgroundColor: '#10b981', color: '#000000' }}
        className="mt-2 flex w-full items-center justify-center gap-3 rounded-full py-6 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={22} /> : <UserPlus size={20} />}
        {loading ? 'Tworzę konto…' : 'Załóż konto'}
      </button>

      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
        Masz konto?{' '}
        <Link href="/login" className="text-emerald-500 hover:text-emerald-400">
          Zaloguj się
        </Link>
      </p>
    </motion.form>
  );
}
