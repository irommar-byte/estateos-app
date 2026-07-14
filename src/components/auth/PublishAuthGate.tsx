"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Lock, UserPlus, X } from "lucide-react";
import PhoneCountryInput from "@/components/auth/PhoneCountryInput";
import { normalizePhoneE164 } from "@/lib/phoneE164";

type AuthTab = "register" | "login";
type PublishBrand = "home" | "car";

type PublishAuthGateProps = {
  brand: PublishBrand;
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void | Promise<void>;
};

const brandCopy = {
  home: {
    label: "EstateOS™Home",
    gradient: "from-emerald-500/[0.08] via-transparent to-emerald-500/[0.04]",
    accent: "text-emerald-500",
    tabActive: "bg-emerald-500/20 text-emerald-300",
    button: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    focus: "focus:border-emerald-400/50",
  },
  car: {
    label: "EstateOS™Car",
    gradient: "from-sky-500/[0.08] via-transparent to-cyan-500/[0.05]",
    accent: "text-sky-500",
    tabActive: "bg-sky-500/20 text-sky-300",
    button: "border-sky-400/40 bg-sky-500/15 text-sky-300",
    focus: "focus:border-sky-400/50",
  },
} as const;

export default function PublishAuthGate({ brand, open, onClose, onAuthenticated }: PublishAuthGateProps) {
  const styles = brandCopy[brand];
  const [tab, setTab] = useState<AuthTab>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpPending, setOtpPending] = useState(false);

  if (!open) return null;

  const inputClass = `rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none ${styles.focus}`;

  const finishAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Nie udało się opublikować ogłoszenia.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const e164 = normalizePhoneE164(phoneE164);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Podaj imię i nazwisko.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Podaj poprawny adres e-mail.");
      return;
    }
    if (!e164) {
      setError("Podaj poprawny numer telefonu.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Hasła nie są identyczne.");
      return;
    }
    if (!acceptTerms) {
      setError("Zaakceptuj regulamin, aby kontynuować.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: trimmedEmail,
          password,
          phone: e164,
          contactPhone: e164,
          role: "PRIVATE",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(typeof data.message === "string" ? data.message : "Rejestracja nie powiodła się.");
        setLoading(false);
        return;
      }
      await finishAuth();
    } catch {
      setError("Błąd połączenia podczas rejestracji.");
      setLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await finishAuth();
        return;
      }

      if (data.needs_otp) {
        setOtpPending(true);
        setError(null);
        setLoading(false);
        return;
      }

      setError(typeof data.message === "string" ? data.message : "Nieprawidłowe dane logowania.");
      setLoading(false);
    } catch {
      setError("Błąd połączenia podczas logowania.");
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resVerify = await fetch("/api/szukaj/weryfikacja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, otpCode }),
      });
      const dataVerify = await resVerify.json();

      if (!resVerify.ok) {
        setError(typeof dataVerify.error === "string" ? dataVerify.error : "Nieprawidłowy kod SMS.");
        setLoading(false);
        return;
      }

      const resLogin = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const dataLogin = await resLogin.json();

      if (dataLogin.success) {
        await finishAuth();
        return;
      }

      setError(typeof dataLogin.message === "string" ? dataLogin.message : "Logowanie nie powiodło się.");
      setLoading(false);
    } catch {
      setError("Błąd połączenia podczas weryfikacji.");
      setLoading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
      active ? styles.tabActive : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
    }`;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div className="relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 z-10 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2 text-[var(--eos-muted)] transition hover:text-[var(--eos-text)] disabled:opacity-50"
          aria-label="Zamknij"
        >
          <X size={16} />
        </button>

        <div className={`shrink-0 border-b border-[var(--eos-border)] bg-gradient-to-r px-5 py-5 sm:px-6 ${styles.gradient}`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${styles.accent}`}>{styles.label}</p>
          <h2 className="mt-2 pr-8 text-xl font-semibold tracking-tight sm:text-2xl">Ostatni krok — konto do publikacji</h2>
          <p className="mt-2 text-sm text-[var(--eos-muted)]">
            Szybka rejestracja lub logowanie. Wypełnione dane ogłoszenia zostają zapisane — po zalogowaniu od razu
            opublikujesz.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="mb-4 inline-flex w-full rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1">
            <button type="button" onClick={() => setTab("register")} className={tabClass(tab === "register")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <UserPlus size={12} />
                Załóż konto
              </span>
            </button>
            <button type="button" onClick={() => setTab("login")} className={tabClass(tab === "login")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Lock size={12} />
                Mam konto
              </span>
            </button>
          </div>

          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          ) : null}

          {tab === "register" ? (
            <form onSubmit={handleRegister} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--eos-muted)]">Imię</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--eos-muted)]">Nazwisko</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} required />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">E-mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">Telefon</span>
                <PhoneCountryInput valueE164={phoneE164} onChangeE164={setPhoneE164} hideLabel />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">Hasło</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} minLength={6} required />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">Powtórz hasło</span>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className={inputClass} minLength={6} required />
              </label>
              <label className="flex items-start gap-2 text-xs text-[var(--eos-muted)]">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" />
                <span>Akceptuję regulamin EstateOS i wyrażam zgodę na powiadomienia o zapytaniach kupujących.</span>
              </label>
              <button type="submit" disabled={loading} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-xs font-black uppercase tracking-[0.14em] disabled:opacity-60 ${styles.button}`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Zarejestruj i opublikuj ogłoszenie
              </button>
            </form>
          ) : otpPending ? (
            <form onSubmit={handleVerifyOtp} className="grid gap-3">
              <p className="text-sm text-[var(--eos-muted)]">Wpisz kod SMS wysłany na numer powiązany z kontem.</p>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">Kod SMS</span>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${inputClass} text-center text-2xl font-black tracking-[0.3em]`}
                  maxLength={6}
                  required
                />
              </label>
              <button type="submit" disabled={loading || otpCode.length !== 6} className={`flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-xs font-black uppercase tracking-[0.14em] disabled:opacity-60 ${styles.button}`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Potwierdź i opublikuj
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">E-mail lub telefon</span>
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={inputClass} required />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-[var(--eos-muted)]">Hasło</span>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={inputClass} required />
              </label>
              <button type="submit" disabled={loading} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-xs font-black uppercase tracking-[0.14em] disabled:opacity-60 ${styles.button}`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Zaloguj i opublikuj ogłoszenie
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
