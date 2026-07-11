"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fingerprint, Loader2 } from "lucide-react";
import { TvPairingStatusBanner, TvPasskeyHero } from "@/components/TvPairingUi";
import { useLocale } from "@/contexts/LocaleContext";
import { getPasskeyLoginDictionary } from "@/i18n/passkeyLoginDictionary";

import {
  isTvosPairingRequest,
  pairTvAfterMobilePasskey,
  readTvPairCode,
} from "@/lib/tvPairingClient";

function PasskeyLoginPageInner() {
  const { locale } = useLocale();
  const pd = getPasskeyLoginDictionary(locale);
  const searchParams = useSearchParams();
  const pairCode = readTvPairCode(searchParams);
  const emailHint = String(searchParams.get("email") || "").trim().toLowerCase();
  const isTvPairing = isTvosPairingRequest(searchParams);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const autoStarted = useRef(false);

  const runPasskeyPairing = useCallback(async () => {
    if (!isTvPairing || !pairCode) {
      setError(pd.noPairCode);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    const result = await pairTvAfterMobilePasskey(pairCode, emailHint || null);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || pd.pairFail);
    }
    setLoading(false);
  }, [emailHint, isTvPairing, pairCode]);

  useEffect(() => {
    if (autoStarted.current) return;
    if (!isTvPairing || !pairCode) return;
    autoStarted.current = true;
    void runPasskeyPairing();
  }, [isTvPairing, pairCode, runPasskeyPairing]);

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] p-6 pt-40 pb-24 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <Link
          href="/"
          className="mb-10 inline-block text-sm uppercase tracking-widest font-semibold text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          {pd.home}
        </Link>

        <div className="space-y-8">
          <TvPasskeyHero />

          <TvPairingStatusBanner
            pairCode={pairCode}
            loading={loading}
            error={error}
            success={success}
            onRetry={runPasskeyPairing}
          />

          {!success ? (
            <button
              type="button"
              onClick={() => void runPasskeyPairing()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-4 rounded-[20px] border border-[var(--eos-border)] bg-[var(--eos-input)] py-5 text-[15px] font-semibold text-[var(--eos-text)] transition-all hover:border-emerald-500/30 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin text-emerald-500" size={22} />
              ) : (
                <>
                  <Fingerprint size={20} className="text-emerald-500" />
                  {pd.usePasskey}
                </>
              )}
            </button>
          ) : null}

          {!isTvPairing ? (
            <p className="text-sm text-[var(--eos-muted)]">
              {pd.tvHint}
            </p>
          ) : null}

          <p className="text-center text-[11px] text-[var(--eos-muted)]">
            {pd.preferPassword}{" "}
            <Link
              href={`/login?source=tvos&pair=${encodeURIComponent(pairCode)}&authIntent=login`}
              className="text-emerald-500 hover:text-emerald-400"
            >
              {pd.loginWithPassword}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function PasskeyLoginPage() {
  return (
    <Suspense fallback={null}>
      <PasskeyLoginPageInner />
    </Suspense>
  );
}
