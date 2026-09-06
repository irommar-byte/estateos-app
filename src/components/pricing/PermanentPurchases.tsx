"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, Mail, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type CheckState = "idle" | "invalid" | "checking" | "available" | "taken" | "reserved";

type OwnedAlias = {
  alias: string;
  address: string;
  forwardTo: string;
};

type WalletState = {
  loggedIn: boolean;
  plusCredits: number;
  hasPlusCredit: boolean;
  aliases: OwnedAlias[];
};

function statusFromReason(reason?: string): CheckState {
  if (reason === "invalid") return "invalid";
  if (reason === "reserved") return "reserved";
  if (reason === "taken") return "taken";
  return "idle";
}

export default function PermanentPurchases() {
  const { dict } = useLocale();
  const p = dict.pricing;
  const [login, setLogin] = useState("");
  const [check, setCheck] = useState<CheckState>("idle");
  const [wallet, setWallet] = useState<WalletState>({
    loggedIn: false,
    plusCredits: 0,
    hasPlusCredit: false,
    aliases: [],
  });
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addressPreview = useMemo(() => {
    const local = login.trim().toLowerCase();
    return local ? `${local}@estateos.pl` : `login@estateos.pl`;
  }, [login]);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/mail-alias", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        setWallet({ loggedIn: false, plusCredits: 0, hasPlusCredit: false, aliases: [] });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) return;
      setWallet({
        loggedIn: true,
        plusCredits: Number(data.plusCredits || 0),
        hasPlusCredit: Boolean(data.hasPlusCredit),
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const local = login.trim().toLowerCase();
    setMessage(null);
    setError(null);
    if (!local) {
      setCheck("idle");
      return;
    }
    setCheck("checking");
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/mail-alias/check?alias=${encodeURIComponent(local)}`, {
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (data?.available) {
            setCheck("available");
            return;
          }
          setCheck(statusFromReason(data?.reason));
        } catch {
          setCheck("idle");
        }
      })();
    }, 320);
    return () => window.clearTimeout(handle);
  }, [login]);

  const startPlusCheckout = async () => {
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan: "pakiet_plus",
          returnUrl: `${window.location.origin}/cennik?tab=permanent&plus=success`,
          cancelUrl: `${window.location.origin}/cennik?tab=permanent&plus=cancel`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        throw new Error(String(body?.error || p.mailError));
      }
      window.location.href = String(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : p.mailError);
    }
  };

  const buy = async () => {
    setError(null);
    setMessage(null);
    if (!wallet.loggedIn) {
      window.location.href = `/login?next=${encodeURIComponent("/cennik?tab=permanent")}`;
      return;
    }
    if (!wallet.hasPlusCredit || wallet.plusCredits < 1) {
      await startPlusCheckout();
      return;
    }
    setBuying(true);
    try {
      const res = await fetch("/api/mail-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alias: login }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data?.error === "NO_PLUS_CREDIT") {
        await startPlusCheckout();
        return;
      }
      if (!res.ok || !data?.success) {
        setError(String(data?.message || p.mailError));
        if (data?.error === "TAKEN") setCheck("taken");
        return;
      }
      setMessage(p.mailSuccess.replace("{address}", String(data.address || addressPreview)));
      setLogin("");
      setCheck("idle");
      window.dispatchEvent(new Event("publicationWalletRefresh"));
      await loadWallet();
    } catch {
      setError(p.mailError);
    } finally {
      setBuying(false);
    }
  };

  const ctaLabel = !wallet.loggedIn
    ? p.mailCtaLogin
    : !wallet.hasPlusCredit || wallet.plusCredits < 1
      ? p.mailCtaBuyPlus
      : buying
        ? p.mailCtaBuying
        : p.mailCta;

  return (
    <div className="animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <article className="bg-[var(--eos-card)] border border-amber-400/35 dark:border-[#D4AF37]/30 rounded-[2.5rem] p-8 sm:p-10 flex flex-col relative overflow-hidden shadow-[var(--eos-shadow-soft)]">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8A6E2F] via-[#F9E498] to-[#8A6E2F]" />
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-700 dark:text-[#D4AF37] mb-3">
            {p.tabPermanent}
          </p>
          <h4 className="text-2xl font-black text-[var(--eos-text)] mb-2">{p.mailName}</h4>
          <p className="text-[var(--eos-muted)] text-sm leading-relaxed mb-8">{p.mailDesc}</p>

          <div className="mb-8">
            <span className="text-5xl font-black text-[var(--eos-text)] tracking-tight">
              {p.mailPrice}{" "}
              <span className="text-lg text-[var(--eos-muted)] font-medium">{p.mailPeriod}</span>
            </span>
          </div>

          <ul className="flex flex-col gap-4 mb-8">
            {[p.mailF1, p.mailF2, p.mailF3].map((text) => (
              <li key={text} className="flex items-start gap-3 text-[var(--eos-text)] text-sm leading-relaxed">
                <Check className="text-amber-600 dark:text-[#D4AF37] shrink-0 mt-0.5" size={18} />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-subtle)] mb-2">
            {p.mailPlaceholder}
          </label>
          <div className="mb-3 flex items-stretch gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                value={login}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setLogin(e.target.value.replace(/\s+/g, ""))}
                placeholder="jan.kowalski"
                className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4 pr-12 text-[var(--eos-text)] font-semibold outline-none focus:border-amber-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-live="polite">
                {check === "checking" ? <Loader2 size={18} className="animate-spin text-[var(--eos-muted)]" /> : null}
                {check === "available" ? <Check size={20} className="text-emerald-500" /> : null}
                {check === "taken" || check === "reserved" || check === "invalid" ? (
                  <X size={20} className="text-red-500" />
                ) : null}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 text-xs font-bold text-[var(--eos-subtle)]">
              {p.mailDomain}
            </span>
          </div>
          <p
            className={[
              "text-xs mb-6 min-h-[1.25rem]",
              check === "available"
                ? "text-emerald-600 dark:text-emerald-400"
                : check === "taken" || check === "reserved" || check === "invalid"
                  ? "text-red-500"
                  : "text-[var(--eos-muted)]",
            ].join(" ")}
          >
            {check === "checking" ? p.mailChecking : null}
            {check === "available" ? p.mailAvailable.replace("{address}", addressPreview) : null}
            {check === "taken" || check === "reserved" ? p.mailTaken : null}
            {check === "invalid" && login.trim() ? p.mailInvalid : null}
            {check === "idle" ? p.mailHint : null}
          </p>

          <button
            type="button"
            onClick={() => void buy()}
            disabled={buying || check !== "available"}
            className="w-full py-4 rounded-2xl font-bold transition-colors flex justify-center items-center gap-2 text-sm bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 shadow-[0_10px_30px_rgba(245,158,11,0.25)]"
          >
            <Mail size={16} />
            {ctaLabel}
            {!buying ? <ArrowRight size={16} /> : <Loader2 size={16} className="animate-spin" />}
          </button>
          {!wallet.loggedIn ? (
            <p className="mt-3 text-[11px] text-center text-[var(--eos-subtle)]">{p.mailNeedLogin}</p>
          ) : !wallet.hasPlusCredit ? (
            <p className="mt-3 text-[11px] text-center text-[var(--eos-subtle)]">{p.mailNeedPlus}</p>
          ) : (
            <p className="mt-3 text-[11px] text-center text-[var(--eos-subtle)]">
              {p.mailBalance.replace("{n}", String(wallet.plusCredits))}
            </p>
          )}
          {error ? <p className="mt-3 text-center text-sm text-red-500">{error}</p> : null}
          {message ? <p className="mt-3 text-center text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
        </article>

        <article className="bg-[var(--eos-card)] border border-[var(--eos-border)] rounded-[2.5rem] p-8 sm:p-10 flex flex-col shadow-[var(--eos-shadow-soft)]">
          <h4 className="text-2xl font-black text-[var(--eos-text)] mb-2">{p.mailOwnedTitle}</h4>
          <p className="text-[var(--eos-muted)] text-sm leading-relaxed mb-8">{p.mailOwnedDesc}</p>
          {wallet.aliases.length === 0 ? (
            <p className="text-sm text-[var(--eos-subtle)]">{p.mailOwnedEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {wallet.aliases.map((item) => (
                <li
                  key={item.address}
                  className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4"
                >
                  <p className="font-black text-[var(--eos-text)]">{item.address}</p>
                  <p className="text-xs text-[var(--eos-muted)] mt-1">
                    {p.mailForward.replace("{email}", item.forwardTo)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
