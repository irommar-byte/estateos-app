"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";

type ProfileFlags = {
  email?: string;
  phone?: string | null;
  isEmailVerified?: boolean;
  isVerifiedPhone?: boolean;
};

type Props = {
  initial?: ProfileFlags | null;
  compact?: boolean;
  onUpdated?: () => void;
};

export default function ContactVerificationPanel({ initial, compact = false, onUpdated }: Props) {
  const [profile, setProfile] = useState<ProfileFlags | null>(initial || null);
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [busy, setBusy] = useState<"email-send" | "email-confirm" | "sms-send" | "sms-confirm" | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const u = data.user || data;
      setProfile({
        email: u.email,
        phone: u.phone,
        isEmailVerified: Boolean(u.isEmailVerified ?? u.emailVerified),
        isVerifiedPhone: Boolean(u.isVerifiedPhone ?? u.phoneVerified),
      });
      onUpdated?.();
    } catch {
      /* ignore */
    }
  }, [onUpdated]);

  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  const emailOk = Boolean(profile?.isEmailVerified);
  const phoneOk = Boolean(profile?.isVerifiedPhone);

  const sendEmailCode = async () => {
    setBusy("email-send");
    setMessage(null);
    try {
      const res = await fetch("/api/user/me/email-verify/send", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nie udało się wysłać kodu.");
      setMessage({ type: "ok", text: "Kod wysłany na Twój e-mail." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Błąd wysyłki." });
    } finally {
      setBusy(null);
    }
  };

  const confirmEmail = async () => {
    setBusy("email-confirm");
    setMessage(null);
    try {
      const res = await fetch("/api/user/me/email-verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nieprawidłowy kod.");
      setEmailCode("");
      setMessage({ type: "ok", text: "E-mail potwierdzony." });
      await refresh();
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Błąd weryfikacji." });
    } finally {
      setBusy(null);
    }
  };

  const sendSms = async () => {
    setBusy("sms-send");
    setMessage(null);
    try {
      const res = await fetch("/api/user/me/sms/send", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nie udało się wysłać SMS.");
      setMessage({ type: "ok", text: "Kod SMS wysłany." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Błąd SMS." });
    } finally {
      setBusy(null);
    }
  };

  const confirmSms = async () => {
    setBusy("sms-confirm");
    setMessage(null);
    try {
      const res = await fetch("/api/user/me/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: smsCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nieprawidłowy kod.");
      setSmsCode("");
      setMessage({ type: "ok", text: "Telefon potwierdzony." });
      await refresh();
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Błąd weryfikacji." });
    } finally {
      setBusy(null);
    }
  };

  if (!profile) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
        <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
        Ładowanie statusu konta…
      </div>
    );
  }

  if (emailOk && phoneOk) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 ${compact ? "p-6" : "p-8"}`}
      >
        <div className="flex items-center gap-3 text-emerald-400">
          <ShieldCheck size={28} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em]">Konto zweryfikowane</p>
            <p className="text-xs text-white/60 mt-1">Możesz publikować ogłoszenia i negocjować jak w aplikacji.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`space-y-6 ${compact ? "" : "max-w-2xl"}`}>
      <div className="rounded-[2rem] border border-white/10 bg-[#0a0a0a]/80 p-6 md:p-8 backdrop-blur-xl">
        <h2 className="text-xl font-black text-white mb-2 tracking-tight">Potwierdź dane kontaktowe</h2>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Tak jak w aplikacji mobilnej: <strong className="text-white/80">SMS</strong> do negocjacji i wizyt,{" "}
          <strong className="text-white/80">SMS + e-mail</strong> do publikacji ogłoszeń.
        </p>

        {message ? (
          <p
            className={`mb-4 text-[11px] font-bold uppercase tracking-widest ${
              message.type === "ok" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        {/* E-mail */}
        <div className={`rounded-2xl border p-5 mb-4 ${emailOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className={emailOk ? "text-emerald-400" : "text-white/40"} />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white/80">E-mail</span>
            </div>
            {emailOk ? <CheckCircle size={18} className="text-emerald-400" /> : null}
          </div>
          <p className="text-sm text-white/50 mb-4 truncate">{profile.email}</p>
          {!emailOk ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={sendEmailCode}
                disabled={busy !== null}
                className="w-full py-3 rounded-xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/15 disabled:opacity-40"
              >
                {busy === "email-send" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Wyślij kod (6 cyfr)"}
              </button>
              <input
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl font-black tracking-[0.4em] py-4 rounded-xl bg-black/50 border border-white/10 text-white outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={confirmEmail}
                disabled={busy !== null || emailCode.length !== 6}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
              >
                {busy === "email-confirm" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Potwierdź e-mail"}
              </button>
            </div>
          ) : null}
        </div>

        {/* Telefon */}
        <div className={`rounded-2xl border p-5 ${phoneOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Phone size={18} className={phoneOk ? "text-emerald-400" : "text-white/40"} />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white/80">Telefon</span>
            </div>
            {phoneOk ? <CheckCircle size={18} className="text-emerald-400" /> : null}
          </div>
          <p className="text-sm text-white/50 mb-4">{profile.phone || "Brak numeru — uzupełnij w CRM (profil)."}</p>
          {!phoneOk && profile.phone ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={sendSms}
                disabled={busy !== null}
                className="w-full py-3 rounded-xl bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/15 disabled:opacity-40"
              >
                {busy === "sms-send" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Wyślij kod SMS (4 cyfry)"}
              </button>
              <input
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="0000"
                className="w-full text-center text-2xl font-black tracking-[0.5em] py-4 rounded-xl bg-black/50 border border-white/10 text-white outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={confirmSms}
                disabled={busy !== null || smsCode.length !== 4}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40"
              >
                {busy === "sms-confirm" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Potwierdź telefon"}
              </button>
            </div>
          ) : !phoneOk ? (
            <Link
              href="/moje-konto/crm"
              className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
            >
              → Uzupełnij numer w panelu
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
