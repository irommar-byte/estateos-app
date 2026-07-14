"use client";

import { useState } from "react";
import { AlertCircle, Camera, Loader2, Lock, Sparkles, UserPlus, X } from "lucide-react";
import PhoneCountryInput from "@/components/auth/PhoneCountryInput";
import { normalizePhoneE164 } from "@/lib/phoneE164";

type AuthTab = "register" | "login";
type PublishBrand = "home" | "car";
export type AuthGateContext = "publish" | "photo_session" | "ai_description";

type PublishAuthGateProps = {
  brand: PublishBrand;
  context?: AuthGateContext;
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void | Promise<void>;
};

const brandCopy = {
  home: {
    label: "EstateOS™Home",
    gradient: "from-emerald-500/[0.12] via-[var(--eos-card)] to-emerald-500/[0.04]",
    accent: "text-emerald-500",
    tabActive: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    button: "border-emerald-400/45 bg-gradient-to-b from-emerald-400 to-emerald-600 text-black shadow-[0_12px_32px_rgba(16,185,129,0.28)]",
    ring: "focus:border-emerald-400/60 focus:ring-emerald-400/25",
    iconBg: "bg-emerald-500/12",
  },
  car: {
    label: "EstateOS™Car",
    gradient: "from-sky-500/[0.12] via-[var(--eos-card)] to-cyan-500/[0.05]",
    accent: "text-sky-500",
    tabActive: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
    button: "border-sky-400/45 bg-gradient-to-b from-sky-400 to-sky-600 text-black shadow-[0_12px_32px_rgba(14,165,233,0.28)]",
    ring: "focus:border-sky-400/60 focus:ring-sky-400/25",
    iconBg: "bg-sky-500/12",
  },
} as const;

const contextCopy: Record<
  AuthGateContext,
  { title: string; subtitle: string; registerCta: string; loginCta: string; otpCta: string }
> = {
  publish: {
    title: "Ostatni krok — konto do publikacji",
    subtitle:
      "Szybka rejestracja lub logowanie. Wypełnione dane ogłoszenia zostają zapisane — po zalogowaniu od razu opublikujesz.",
    registerCta: "Zarejestruj i opublikuj ogłoszenie",
    loginCta: "Zaloguj i opublikuj ogłoszenie",
    otpCta: "Potwierdź i opublikuj",
  },
  photo_session: {
    title: "Sesja zdjęciowa EstateOS Studio",
    subtitle:
      "Profesjonalna sesja jest dostępna po zalogowaniu. Twoje dane formularza zostaną zachowane — po rejestracji wrócisz dokładnie tutaj.",
    registerCta: "Załóż konto i zamów sesję",
    loginCta: "Zaloguj się i zamów sesję",
    otpCta: "Potwierdź i kontynuuj",
  },
  ai_description: {
    title: "Asystent AI do opisu ogłoszenia",
    subtitle:
      "Generator opisów jest dostępny dla zalogowanych użytkowników. Postęp formularza zostanie zapisany — po logowaniu od razu wygenerujesz opis.",
    registerCta: "Załóż konto i generuj opis",
    loginCta: "Zaloguj się i generuj opis",
    otpCta: "Potwierdź i kontynuuj",
  },
};

function ContextIcon({ context, className }: { context: AuthGateContext; className?: string }) {
  if (context === "photo_session") return <Camera className={className} aria-hidden />;
  if (context === "ai_description") return <Sparkles className={className} aria-hidden />;
  return <UserPlus className={className} aria-hidden />;
}

export default function PublishAuthGate({
  brand,
  context = "publish",
  open,
  onClose,
  onAuthenticated,
}: PublishAuthGateProps) {
  const styles = brandCopy[brand];
  const copy = contextCopy[context];
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

  const fieldClass = `w-full rounded-xl border-2 border-[var(--eos-border)] bg-[var(--eos-surface)] px-3.5 py-3 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:ring-2 ${styles.ring}`;
  const labelClass = "text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]";

  const finishAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Nie udało się kontynuować.");
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
        credentials: "include",
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
    `flex-1 rounded-full px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
      active ? styles.tabActive : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
    }`;

  const submitLabel =
    tab === "register" ? copy.registerCta : otpPending ? copy.otpCta : copy.loginCta;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[var(--eos-bg)]/85 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="relative flex max-h-[min(100dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:max-h-[min(92dvh,760px)] sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 z-20 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2 text-[var(--eos-muted)] transition hover:text-[var(--eos-text)] disabled:opacity-50"
          aria-label="Zamknij"
        >
          <X size={16} />
        </button>

        <div className={`shrink-0 border-b border-[var(--eos-border)] bg-gradient-to-br px-5 pb-5 pt-6 sm:px-6 ${styles.gradient}`}>
          <div className="flex items-start gap-3 pr-10">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${styles.iconBg}`}>
              <ContextIcon context={context} className={`size-5 ${styles.accent}`} />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${styles.accent}`}>{styles.label}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{copy.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{copy.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="mb-4 inline-flex w-full rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1">
            <button type="button" onClick={() => { setTab("register"); setOtpPending(false); }} className={tabClass(tab === "register")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <UserPlus size={12} />
                Załóż konto
              </span>
            </button>
            <button type="button" onClick={() => { setTab("login"); setOtpPending(false); }} className={tabClass(tab === "login")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Lock size={12} />
                Mam konto
              </span>
            </button>
          </div>

          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertCircle size={14} />
              {error}
            </div>
          ) : null}

          {tab === "register" ? (
            <form id="auth-gate-form" onSubmit={handleRegister} className="grid gap-3.5 pb-2">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={labelClass}>Imię</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} required />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClass}>Nazwisko</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} required />
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className={labelClass}>E-mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} required />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClass}>Telefon</span>
                <PhoneCountryInput valueE164={phoneE164} onChangeE164={setPhoneE164} hideLabel />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClass}>Hasło</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} minLength={6} required />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClass}>Powtórz hasło</span>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className={fieldClass} minLength={6} required />
              </label>
              <label className="flex items-start gap-2.5 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/50 px-3 py-2.5 text-xs leading-relaxed text-[var(--eos-muted)]">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 size-4 rounded border-[var(--eos-border)]" />
                <span>Akceptuję regulamin EstateOS i wyrażam zgodę na powiadomienia o zapytaniach kupujących.</span>
              </label>
            </form>
          ) : otpPending ? (
            <form id="auth-gate-form" onSubmit={handleVerifyOtp} className="grid gap-3.5 pb-2">
              <p className="text-sm text-[var(--eos-muted)]">Wpisz kod SMS wysłany na numer powiązany z kontem.</p>
              <label className="grid gap-1.5">
                <span className={labelClass}>Kod SMS</span>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${fieldClass} text-center text-2xl font-black tracking-[0.3em]`}
                  maxLength={6}
                  required
                />
              </label>
            </form>
          ) : (
            <form id="auth-gate-form" onSubmit={handleLogin} className="grid gap-3.5 pb-2">
              <label className="grid gap-1.5">
                <span className={labelClass}>E-mail lub telefon</span>
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={fieldClass} required />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClass}>Hasło</span>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={fieldClass} required />
              </label>
            </form>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--eos-border)] bg-[var(--eos-card)]/95 px-5 py-4 backdrop-blur-md sm:px-6">
          <button
            type="submit"
            form="auth-gate-form"
            disabled={loading || (otpPending && otpCode.length !== 6)}
            className={`flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 ${styles.button}`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
