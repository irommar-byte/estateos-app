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

const fieldClass =
  "w-full rounded-xl border-2 border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-4 text-center text-2xl font-black tracking-[0.35em] text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-emerald-400/55 focus:ring-2 focus:ring-emerald-400/20 placeholder:text-[var(--eos-muted)]";

const ghostBtnClass =
  "w-full rounded-xl border-2 border-[var(--eos-border)] bg-[var(--eos-surface)] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-text)] transition hover:border-emerald-400/35 hover:bg-emerald-500/[0.06] disabled:cursor-not-allowed disabled:opacity-45";

const primaryBtnClass =
  "w-full rounded-xl border border-emerald-400/45 bg-gradient-to-b from-emerald-400 to-emerald-600 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black shadow-[0_10px_28px_rgba(16,185,129,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45";

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
      <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 text-center text-[var(--eos-muted)] shadow-[var(--eos-shadow-soft)]">
        <Loader2 className="mx-auto mb-3 animate-spin text-emerald-500" size={24} />
        Ładowanie statusu konta…
      </div>
    );
  }

  if (emailOk && phoneOk) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-[1.75rem] border border-emerald-400/30 bg-emerald-500/[0.08] shadow-[0_18px_50px_rgba(16,185,129,0.1)] ${compact ? "p-6" : "p-8"}`}
      >
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={28} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em]">Konto zweryfikowane</p>
            <p className="mt-1 text-xs text-[var(--eos-muted)]">Możesz publikować ogłoszenia i negocjować jak w aplikacji.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`space-y-5 ${compact ? "" : "max-w-2xl"}`}>
      <div className="overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)]">
        <div className="border-b border-[var(--eos-border)] bg-gradient-to-r from-emerald-500/[0.08] via-transparent to-emerald-500/[0.04] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12">
              <ShieldCheck className="size-5 text-emerald-500" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--eos-text)]">Potwierdź dane kontaktowe</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--eos-muted)]">
                Tak jak w aplikacji mobilnej: <strong className="font-semibold text-[var(--eos-text)]">SMS</strong> do negocjacji i wizyt,{" "}
                <strong className="font-semibold text-[var(--eos-text)]">SMS + e-mail</strong> do publikacji ogłoszeń.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {message ? (
            <p
              className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] ${
                message.type === "ok"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <div
            className={`rounded-2xl border-2 p-5 ${
              emailOk ? "border-emerald-400/35 bg-emerald-500/[0.06]" : "border-[var(--eos-border)] bg-[var(--eos-bg)]/40"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mail size={18} className={emailOk ? "text-emerald-500" : "text-[var(--eos-muted)]"} />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--eos-text)]">E-mail</span>
              </div>
              {emailOk ? <CheckCircle size={18} className="text-emerald-500" /> : null}
            </div>
            <p className="mb-4 truncate text-sm text-[var(--eos-muted)]">{profile.email}</p>
            {!emailOk ? (
              <div className="space-y-3">
                <button type="button" onClick={sendEmailCode} disabled={busy !== null} className={ghostBtnClass}>
                  {busy === "email-send" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Wyślij kod (6 cyfr)"}
                </button>
                <input
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={confirmEmail}
                  disabled={busy !== null || emailCode.length !== 6}
                  className={primaryBtnClass}
                >
                  {busy === "email-confirm" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Potwierdź e-mail"}
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`rounded-2xl border-2 p-5 ${
              phoneOk ? "border-emerald-400/35 bg-emerald-500/[0.06]" : "border-[var(--eos-border)] bg-[var(--eos-bg)]/40"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Phone size={18} className={phoneOk ? "text-emerald-500" : "text-[var(--eos-muted)]"} />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--eos-text)]">Telefon</span>
              </div>
              {phoneOk ? <CheckCircle size={18} className="text-emerald-500" /> : null}
            </div>
            <p className="mb-4 text-sm text-[var(--eos-muted)]">{profile.phone || "Brak numeru — uzupełnij w CRM (profil)."}</p>
            {!phoneOk && profile.phone ? (
              <div className="space-y-3">
                <button type="button" onClick={sendSms} disabled={busy !== null} className={ghostBtnClass}>
                  {busy === "sms-send" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Wyślij kod SMS (6 cyfr)"}
                </button>
                <input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`${fieldClass} tracking-[0.5em]`}
                />
                <button
                  type="button"
                  onClick={confirmSms}
                  disabled={busy !== null || smsCode.length !== 6}
                  className={primaryBtnClass}
                >
                  {busy === "sms-confirm" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Potwierdź telefon"}
                </button>
              </div>
            ) : !phoneOk ? (
              <Link
                href="/moje-konto/crm"
                className="inline-block text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400"
              >
                → Uzupełnij numer w panelu
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
