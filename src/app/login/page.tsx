"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Fingerprint, Lock, Loader2, AlertCircle, Mail, Key, ArrowLeft, CheckCircle } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

function resolveSafeNextPath(raw: string | null): string {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/moje-konto";
  if (next.startsWith("/login")) return "/moje-konto";
  return next;
}

function LoginPageInner() {
  const { dict } = useLocale();
  const t = dict.auth;
  const searchParams = useSearchParams();
  const afterLoginPath = resolveSafeNextPath(searchParams.get("next"));
  const registerHref = afterLoginPath.startsWith("/dodaj-oferte")
    ? "/rejestracja?next=/dodaj-oferte"
    : "/rejestracja";

  const [view, setView] = useState<'login' | 'forgot' | 'reset' | 'verify_otp'>('login');
  
  // Stany logowania
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Stany odzyskiwania hasła
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [verifyOtp, setVerifyOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  
  const handlePasskeyLogin = async () => {
    setLoading(true); setError(""); setSuccessMsg("");
    try {
      const resp = await fetch('/api/passkeys/auth-options');
      const options = await resp.json();
      if (options.error) throw new Error(options.error);

      const asseResp = await startAuthentication(options);

      const verifyResp = await fetch('/api/passkeys/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      const data = await verifyResp.json();
      if (verifyResp.ok && data.success) {
        window.location.href =
          data.role === "ADMIN" ? "/centrala" : resolveSafeNextPath(afterLoginPath);
      } else {
        setError(data.error || t.passkeyFailed);
      }
    } catch (err) {
      setError(t.passkeyCancelled);
    } finally {
      setLoading(false);
    }
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href =
          data.role === "ADMIN" ? "/centrala" : resolveSafeNextPath(afterLoginPath);
      } else if (data.needs_otp) {
        setPendingPhone(data.phone || email);
        setView("verify_otp");
        setSuccessMsg(data.message || t.otpRequired);
        setLoading(false);
      } else {
        setError(data.message || t.invalidCredentials);
        setLoading(false);
      }

    } catch (err) {
      setError(t.connectionError);
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: resetEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setView('reset');
        setSuccessMsg(t.resetCodeSent);
      } else {
        setError(data.error || t.connectionError);
      }
    } catch (err) { setError(t.errConnection); } 
    finally { setLoading(false); }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccessMsg("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: resetEmail, otp: resetOtp, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(t.passwordChanged);
        setEmail(resetEmail);
        setPassword(newPassword);
        setView('login');
      } else {
        setError(data.error || t.resetInvalidCode);
      }
    } catch (err) { setError(t.errConnection); } 
    finally { setLoading(false); }
  };

  // Formularze rozbite na komponenty dla płynnej animacji
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccessMsg("");

    try {
      const resVerify = await fetch("/api/szukaj/weryfikacja", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otpCode: verifyOtp }),
      });
      const dataVerify = await resVerify.json();
      
      if (resVerify.ok) {
        // po weryfikacji logujemy użytkownika
        const resLogin = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const dataLogin = await resLogin.json();

        if (dataLogin.success) {
          localStorage.setItem("token", dataLogin.token);
          window.location.replace(
            dataLogin.role === "ADMIN" ? "/centrala" : resolveSafeNextPath(afterLoginPath)
          );
        } else {
          setError(dataLogin.message || t.invalidCredentials);
        }
      } else {
        setError(dataVerify.error || "Błąd kodu weryfikacyjnego.");
      }
    } catch (err) {
      setError(t.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (view === 'verify_otp') {
      return (
        <motion.form key="verify_otp" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onSubmit={handleVerifyOtp} className="eos-auth-card relative overflow-hidden space-y-6 border-emerald-500/30 p-8 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600"></div>
          <div className="mb-4">
             <h3 className="mb-3 text-3xl font-black text-[var(--eos-text)]">{t.smsAuthTitle}</h3>
             <div className="mb-4 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4">
                <p className="eos-muted-copy mb-2 text-sm leading-relaxed">{t.smsAuthSent} <b className="text-[var(--eos-text)]">{pendingPhone}</b>.</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-500 font-bold">
                   <Lock size={12} /> {t.smsAuthValidity}
                </div>
             </div>
             <p className="eos-subtle-copy text-[11px] leading-relaxed">{t.smsAuthHint}</p>
          </div>
          <div>
            <label className="eos-label mb-2 flex items-center gap-2 text-emerald-500"><Key size={14}/> {t.smsCodeLabel}</label>
            <input type="text" required maxLength={6} placeholder={t.smsCodePlaceholder} className="eos-field p-4 text-center text-4xl font-black tracking-[0.4em] text-emerald-500 shadow-inner" onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))} value={verifyOtp} />
          </div>
          <button type="submit" disabled={loading || verifyOtp.length !== 6} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-lg hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={24} /> : t.verifyPhone}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); setSuccessMsg(""); }} className="eos-muted-copy flex w-full items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--eos-text)]">
            <ArrowLeft size={14}/> {t.backToLogin}
          </button>
        </motion.form>
      );
    }

    if (view === 'login') {
      return (
        <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="eos-auth-card space-y-6 p-8 shadow-2xl">
          <div>
            <label className="eos-label mb-2 block">{t.emailOrPhone}</label>
            <input type="text" required placeholder={t.emailOrPhonePlaceholder} className="eos-field border-0 border-b border-[var(--eos-border)] bg-transparent pb-2 text-2xl shadow-none focus:border-emerald-500" onChange={(e) => setEmail(e.target.value)} value={email} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
               <label className="eos-label">{t.password}</label>
               <button type="button" onClick={() => { setView('forgot'); setError(""); setSuccessMsg(""); }} className="text-[9px] font-bold text-emerald-500/70 hover:text-emerald-500 uppercase tracking-widest transition-colors">{t.forgotPassword}</button>
            </div>
            <input type="password" required placeholder={t.passwordPlaceholder} className="eos-field border-0 border-b border-[var(--eos-border)] bg-transparent pb-2 text-2xl shadow-none focus:border-emerald-500" onChange={(e) => setPassword(e.target.value)} value={password} />
          </div>
          <button type="submit" disabled={loading} className="btn-action mt-8 flex w-full cursor-pointer items-center justify-center gap-3 rounded-full py-6 text-xl font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={24} /> : t.submitLogin}
          </button>

          <p className="eos-muted-copy text-center text-[10px] font-bold uppercase tracking-widest">
            {t.noAccount}{" "}
            <Link href={registerHref} className="text-emerald-500 hover:text-emerald-400">
              {t.registerLink}
            </Link>
          </p>

          <div className="relative flex items-center py-6 mt-4">
            <div className="flex-grow border-t border-[var(--eos-border)]"></div>
            <span className="eos-subtle-copy mx-4 flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.3em]">{t.passkeyDivider}</span>
            <div className="flex-grow border-t border-[var(--eos-border)]"></div>
          </div>

          <button 
            type="button" 
            onClick={handlePasskeyLogin} 
            disabled={loading} 
            className="flex w-full items-center justify-center gap-4 overflow-hidden rounded-[20px] border border-[var(--eos-border)] bg-[var(--eos-input)] py-5 text-[15px] font-semibold tracking-wide text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-all duration-500 hover:border-emerald-500/30 hover:bg-[var(--eos-surface-strong)] group relative"
          >
            {/* Delikatny hover glow w tle przycisku */}
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors duration-500"></div>

            {loading ? (
              <Loader2 className="animate-spin text-emerald-500" size={22} />
            ) : (
              <>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--eos-input)] transition-colors duration-500 group-hover:bg-emerald-500/10">
                   <Fingerprint size={18} className="text-[var(--eos-muted)] transition-colors duration-500 group-hover:text-emerald-500 drop-shadow-[0_0_8px_rgba(52,211,153,0)] group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <span className="z-10 transition-colors duration-500 group-hover:text-[var(--eos-text)]">{t.passkeyButton}</span>
              </>
            )}
          </button>
        </motion.form>
      );
    }

    if (view === 'forgot') {
      return (
        <motion.form key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleRequestReset} className="eos-auth-card space-y-6 p-8 shadow-2xl">
          <div className="mb-2">
             <h3 className="mb-2 text-2xl font-black text-[var(--eos-text)]">{t.resetTitle}</h3>
             <p className="eos-muted-copy text-xs leading-relaxed">{t.resetDesc}</p>
          </div>
          <div>
            <label className="eos-label mb-2 flex items-center gap-2"><Mail size={14}/> {t.emailOrPhone}</label>
            <input type="text" required placeholder={t.emailOrPhonePlaceholder} className="eos-field border-0 border-b border-[var(--eos-border)] bg-transparent pb-2 text-2xl shadow-none focus:border-emerald-500" onChange={(e) => setResetEmail(e.target.value)} value={resetEmail} />
          </div>
          <button type="submit" disabled={loading || resetEmail.length < 5} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-sm md:text-base hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={20} /> : t.sendCode}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); }} className="eos-muted-copy flex w-full items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--eos-text)]">
            <ArrowLeft size={14}/> {t.backToLogin}
          </button>
        </motion.form>
      );
    }

    if (view === 'reset') {
      return (
        <motion.form key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleConfirmReset} className="eos-auth-card space-y-6 border-emerald-500/30 p-8 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
          <div className="mb-2">
             <h3 className="mb-2 text-2xl font-black text-emerald-500">{t.resetAuthTitle}</h3>
             <p className="eos-muted-copy text-xs leading-relaxed">{t.resetAuthDesc} <b className="text-[var(--eos-text)]">{resetEmail}</b>.</p>
          </div>
          <div>
            <label className="eos-label mb-2 flex items-center gap-2"><Key size={14}/> {t.verificationCode}</label>
            <input type="text" required maxLength={6} placeholder={t.smsCodePlaceholder} className="eos-field border-0 border-b border-[var(--eos-border)] bg-transparent pb-2 text-center text-3xl font-black tracking-[0.3em] text-emerald-500 shadow-none focus:border-emerald-500" onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))} value={resetOtp} />
          </div>
          <div>
            <label className="eos-label mb-2 flex items-center gap-2"><Lock size={14}/> {t.newPasswordMin}</label>
            <input type="password" required minLength={6} placeholder={t.passwordPlaceholder} className="eos-field border-0 border-b border-[var(--eos-border)] bg-transparent pb-2 text-2xl shadow-none focus:border-emerald-500" onChange={(e) => setNewPassword(e.target.value)} value={newPassword} />
          </div>
          <button type="submit" disabled={loading || resetOtp.length !== 6 || newPassword.length < 6} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-sm md:text-base hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={20} /> : t.confirmNewPassword}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); }} className="eos-muted-copy flex w-full items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--eos-text)]">
            {t.cancel}
          </button>
        </motion.form>
      );
    }
  };

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] p-6 pt-40 pb-24 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-10 inline-block text-sm uppercase tracking-widest font-semibold text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]">
          {t.backToMap}
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] flex items-center justify-center text-[var(--eos-text)]">
              <Lock size={32} />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-tight text-[var(--eos-text)]">
              {view === 'login' ? <>{t.loginTitle} <br/><span className="text-[var(--eos-muted)] italic">{t.loginTitleMuted}</span></> : <>{t.recoverTitle} <br/><span className="text-emerald-500 italic">{t.recoverTitleHighlight}</span></>}
            </h1>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-[1rem] flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-widest">
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[1rem] flex items-center gap-3 text-emerald-500 text-xs font-bold uppercase tracking-widest">
                <CheckCircle size={16} /> {successMsg}
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            {renderForm()}
          </AnimatePresence>

        </motion.div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
