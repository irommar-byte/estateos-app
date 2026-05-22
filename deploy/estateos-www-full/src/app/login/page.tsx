"use client";
import { useState, useEffect } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Fingerprint, Lock, Loader2, AlertCircle, Mail, Key, ArrowLeft, CheckCircle } from "lucide-react";

export default function LoginPage() {
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
        window.location.href = data.role === 'ADMIN' ? "/centrala" : "/moje-konto";
      } else {
        setError(data.error || "Weryfikacja biometryczna nieudana.");
      }
    } catch (err) {
      setError("Anulowano lub błąd skanera Face ID / Touch ID.");
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
        window.location.href = data.role === "ADMIN" ? "/centrala" : "/moje-konto";
      } else if (data.needs_otp) {
        setPendingPhone(data.phone || email);
        setView("verify_otp");
        setSuccessMsg(data.message || "Wpisz kod SMS wysłany podczas rejestracji.");
        setLoading(false);
      } else {
        setError(data.message || "Nieprawidłowy e-mail lub hasło.");
        setLoading(false);
      }

    } catch (err) {
      setError("Błąd połączenia.");
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
        setSuccessMsg("Verification code has been sent to your email address.");
      } else {
        setError(data.error || "An error occurred.");
      }
    } catch (err) { setError("Server connection error."); } 
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
        setSuccessMsg("Password has been changed. You can now sign in.");
        setEmail(resetEmail);
        setPassword(newPassword);
        setView('login');
      } else {
        setError(data.error || "Invalid code or verification failed.");
      }
    } catch (err) { setError("Server connection error."); } 
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
          window.location.replace("/moje-konto/crm");
        } else {
          setError(dataLogin.message || "Login error");
        }
      } else {
        setError(dataVerify.error || "Verification code error");
      }
    } catch (err) {
      setError("Błąd połączenia.");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (view === 'verify_otp') {
      return (
        <motion.form key="verify_otp" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onSubmit={handleVerifyOtp} className="bg-[#0a0a0a] border border-emerald-500/30 rounded-[2rem] p-8 space-y-6 shadow-[0_0_40px_rgba(16,185,129,0.1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600"></div>
          <div className="mb-4">
             <h3 className="text-3xl font-black text-white mb-3">Autoryzacja SMS</h3>
             <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4">
                <p className="text-sm text-white/70 leading-relaxed mb-2">Kod autoryzacyjny został wysłany na <b>{pendingPhone}</b> podczas rejestracji.</p>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-500 font-bold">
                   <Lock size={12} /> Ważność kodu: 24 godziny
                </div>
             </div>
             <p className="text-[11px] text-white/40 leading-relaxed">Ze względów bezpieczeństwa nie generujemy nowego kodu. Znajdź SMS EstateOS i wpisz 6-cyfrowy PIN.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] block mb-2 flex items-center gap-2"><Key size={14}/> Twój 6-cyfrowy kod SMS</label>
            <input type="text" required maxLength={6} placeholder="000000" className="w-full bg-black/40 p-4 rounded-xl text-4xl font-black tracking-[0.4em] text-center border border-white/10 focus:border-emerald-500 transition-colors outline-none text-emerald-400 shadow-inner" onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))} value={verifyOtp} />
          </div>
          <button type="submit" disabled={loading || verifyOtp.length !== 6} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-lg hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={24} /> : "Zweryfikuj telefon"}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); setSuccessMsg(""); }} className="w-full py-4 text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={14}/> Wróć do logowania
          </button>
        </motion.form>
      );
    }

    if (view === 'login') {
      return (
        <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 space-y-6 shadow-2xl">
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">E-mail lub telefon</label>
            <input type="text" required placeholder="jan@example.com lub 500 600 700" className="w-full bg-transparent text-2xl border-b border-white/10 pb-2 focus:border-emerald-500 transition-colors outline-none" onChange={(e) => setEmail(e.target.value)} value={email} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
               <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Hasło</label>
               <button type="button" onClick={() => { setView('forgot'); setError(""); setSuccessMsg(""); }} className="text-[9px] font-bold text-emerald-500/70 hover:text-emerald-500 uppercase tracking-widest transition-colors">Zapomniałem hasła</button>
            </div>
            <input type="password" required placeholder="••••••••" className="w-full bg-transparent text-2xl border-b border-white/10 pb-2 focus:border-emerald-500 transition-colors outline-none" onChange={(e) => setPassword(e.target.value)} value={password} />
          </div>
          <button type="submit" disabled={loading} style={{ backgroundColor: '#ffffff', color: '#000000' }} className="w-full py-6 rounded-full font-black text-xl hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={24} /> : "Zaloguj się ➔"}
          </button>

          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
            Nie masz konta?{" "}
            <Link href="/rejestracja" className="text-emerald-500 hover:text-emerald-400">
              Załóż konto
            </Link>
          </p>

          <div className="relative flex items-center py-6 mt-4">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink-0 mx-4 text-white/20 text-[10px] font-bold uppercase tracking-[0.3em]">Logowanie biometryczne</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <button 
            type="button" 
            onClick={handlePasskeyLogin} 
            disabled={loading} 
            className="w-full py-5 rounded-[20px] font-semibold text-[15px] bg-[#111112] border border-white/5 hover:bg-[#1a1a1c] hover:border-emerald-500/30 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-500 flex justify-center items-center gap-4 text-white tracking-wide group relative overflow-hidden"
          >
            {/* Delikatny hover glow w tle przycisku */}
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors duration-500"></div>

            {loading ? (
              <Loader2 className="animate-spin text-emerald-500" size={22} />
            ) : (
              <>
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-emerald-500/10 transition-colors duration-500">
                   <Fingerprint size={18} className="text-neutral-400 group-hover:text-emerald-400 transition-colors duration-500 drop-shadow-[0_0_8px_rgba(52,211,153,0)] group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <span className="group-hover:text-white transition-colors duration-500 z-10">Passkey / Face ID</span>
              </>
            )}
          </button>
        </motion.form>
      );
    }

    if (view === 'forgot') {
      return (
        <motion.form key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleRequestReset} className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 space-y-6 shadow-2xl">
          <div className="mb-2">
             <h3 className="text-2xl font-black text-white mb-2">Reset hasła</h3>
             <p className="text-xs text-white/50 leading-relaxed">Podaj e-mail lub telefon. Wyślemy kod autoryzacyjny (SMS lub e-mail).</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2 flex items-center gap-2"><Mail size={14}/> E-mail lub telefon</label>
            <input type="text" required placeholder="email or 123456789" className="w-full bg-transparent text-2xl border-b border-white/10 pb-2 focus:border-emerald-500 transition-colors outline-none" onChange={(e) => setResetEmail(e.target.value)} value={resetEmail} />
          </div>
          <button type="submit" disabled={loading || resetEmail.length < 5} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-sm md:text-base hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Wyślij kod"}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); }} className="w-full py-4 text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={14}/> Wróć do logowania
          </button>
        </motion.form>
      );
    }

    if (view === 'reset') {
      return (
        <motion.form key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleConfirmReset} className="bg-[#0a0a0a] border border-emerald-500/30 rounded-[2rem] p-8 space-y-6 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
          <div className="mb-2">
             <h3 className="text-2xl font-black text-emerald-500 mb-2">Autoryzacja</h3>
             <p className="text-xs text-white/50 leading-relaxed">Kod został wysłany na <b>{resetEmail}</b>. Wpisz go poniżej wraz z nowym hasłem.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2 flex items-center gap-2"><Key size={14}/> Kod weryfikacyjny</label>
            <input type="text" required maxLength={6} placeholder="000000" className="w-full bg-transparent text-3xl font-black tracking-[0.3em] border-b border-white/10 pb-2 focus:border-emerald-500 transition-colors outline-none text-emerald-500" onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))} value={resetOtp} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2 flex items-center gap-2"><Lock size={14}/> Nowe hasło (min. 6 znaków)</label>
            <input type="password" required minLength={6} placeholder="••••••••" className="w-full bg-transparent text-2xl border-b border-white/10 pb-2 focus:border-emerald-500 transition-colors outline-none" onChange={(e) => setNewPassword(e.target.value)} value={newPassword} />
          </div>
          <button type="submit" disabled={loading || resetOtp.length !== 6 || newPassword.length < 6} style={{ backgroundColor: '#10b981', color: '#000000' }} className="w-full py-6 rounded-full font-black text-sm md:text-base hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer mt-8 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Potwierdź nowe hasło"}
          </button>
          <button type="button" onClick={() => { setView('login'); setError(""); }} className="w-full py-4 text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
            Anuluj
          </button>
        </motion.form>
      );
    }
  };

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] p-6 pt-40 pb-24 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-10 inline-block text-sm uppercase tracking-widest font-semibold text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]">
          ← Wróć na mapę
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] flex items-center justify-center text-[var(--eos-text)]">
              <Lock size={32} />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-tight text-[var(--eos-text)]">
              {view === 'login' ? <>Zaloguj <br/><span className="text-[var(--eos-muted)] italic">się.</span></> : <>Odzyskaj <br/><span className="text-emerald-500 italic">dostęp.</span></>}
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
