"use client";
import { useLocale } from "@/contexts/LocaleContext";
import { getPasskeyLoginDictionary } from "@/i18n/passkeyLoginDictionary";


import { CheckCircle, Fingerprint, Loader2, Tv } from "lucide-react";

type TvPairingStatusProps = {
  pairCode: string;
  loading: boolean;
  error: string;
  success: boolean;
  onRetry?: () => void;
};

export function TvPairingStatusBanner({
  pairCode,
  loading,
  error,
  success,
  onRetry,
}: TvPairingStatusProps) {
  const { locale } = useLocale();
  const pd = getPasskeyLoginDictionary(locale);
  if (success) {
    return (
      <div className="p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-[1rem] space-y-3">
        <div className="flex items-center gap-3 text-emerald-500 text-sm font-bold uppercase tracking-widest">
          <CheckCircle size={18} />
          Połączono z Apple TV
        </div>
        <p className="text-sm text-[var(--eos-muted)] leading-relaxed">
          Możesz wrócić na ekran telewizora — logowanie zakończy się automatycznie.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-red-500/10 border border-red-500/25 rounded-[1rem] space-y-4">
        <p className="text-red-400 text-sm font-semibold">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
          >
            Spróbuj ponownie
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-5 bg-[var(--eos-input)] border border-[var(--eos-border)] rounded-[1rem] space-y-3">
      <div className="flex items-center gap-3 text-[var(--eos-text)] text-sm font-bold uppercase tracking-widest">
        {loading ? <Loader2 className="animate-spin text-emerald-500" size={18} /> : <Tv size={18} className="text-emerald-500" />}
        Parowanie Apple TV
      </div>
      <p className="text-sm text-[var(--eos-muted)] leading-relaxed">
        Kod na ekranie TV: <b className="text-[var(--eos-text)] tracking-[0.2em]">{pairCode || "—"}</b>
      </p>
      {loading ? (
        <p className="text-xs text-[var(--eos-muted)]">{pd.pairingLoading}</p>
      ) : null}
    </div>
  );
}

export function TvPasskeyHero() {
  const { locale } = useLocale();
  const pd = getPasskeyLoginDictionary(locale);
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="w-16 h-16 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-500">
        <Fingerprint size={32} />
      </div>
      <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--eos-text)]">
          Logowanie Passkey
        </h1>
        <p className="text-[var(--eos-muted)] mt-1">{pd.pairTitle}</p>
      </div>
    </div>
  );
}
