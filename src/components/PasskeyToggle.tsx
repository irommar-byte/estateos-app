'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Loader2, Fingerprint } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type PasskeyToggleProps = {
  onProfileRefresh?: () => Promise<void> | void;
};

export default function PasskeyToggle({ onProfileRefresh }: PasskeyToggleProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const [hasPasskey, setHasPasskey] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkPasskey = async () => {
      try {
        const res = await fetch('/api/passkeys/check', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHasPasskey(Boolean(data.hasPasskey));
        }
      } catch {
        console.error('Passkey check error');
      } finally {
        setIsCheckingPasskey(false);
      }
    };
    void checkPasskey();
  }, []);

  const refreshPasskeyState = async () => {
    try {
      const res = await fetch('/api/passkeys/check', { cache: 'no-store', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHasPasskey(Boolean(data?.hasPasskey));
      }
    } catch {
      // no-op
    }
  };

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    setIsScanning(true);
    setErrorMessage('');

    try {
      const resp = await fetch('/api/passkeys/register-options', { credentials: 'include' });
      const options = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(options?.error || 'Nie udało się przygotować rejestracji Passkey.');
      }

      const attResp = await startRegistration(options);

      const verifyResp = await fetch('/api/passkeys/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(attResp),
      });

      const verifyData = await verifyResp.json().catch(() => ({}));
      if (!verifyResp.ok || !verifyData?.success) {
        throw new Error(verifyData?.error || 'Weryfikacja Passkey nie powiodła się.');
      }

      setHasPasskey(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Błąd rejestracji Passkey.';
      if (/not allowed|cancel|abort/i.test(message)) {
        setErrorMessage('Anulowano skan biometrii. Spróbuj ponownie.');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setIsRegistering(false);
      }, 1200);
      void refreshPasskeyState();
      void onProfileRefresh?.();
    }
  };

  const handleDeletePasskey = async () => {
    setIsRegistering(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/passkeys/delete', { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Nie udało się usunąć Passkey.');
      }
      setHasPasskey(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Błąd usuwania Passkey.');
    } finally {
      setIsRegistering(false);
      void refreshPasskeyState();
      void onProfileRefresh?.();
    }
  };

  if (isCheckingPasskey) {
    return (
      <div
        className={`eos-passkey-toggle w-full md:w-[480px] rounded-[2.5rem] p-6 flex items-center justify-center h-[100px] border ${
          isLight
            ? 'border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)]'
            : 'border-[#222] bg-gradient-to-b from-[#151515] to-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.9)]'
        }`}
      >
        <Loader2 className={`animate-spin ${isLight ? 'text-[var(--eos-muted)]' : 'text-white/20'}`} size={24} />
      </div>
    );
  }

  const frameClass = hasPasskey
    ? isLight
      ? 'from-emerald-500/25 via-[var(--eos-border)] to-[var(--eos-card)]'
      : 'from-[#10b981]/30 via-[#222] to-[#000]'
    : isLight
      ? 'from-slate-300/40 via-[var(--eos-border)] to-[var(--eos-card)]'
      : 'from-[#333] via-[#111] to-[#000]';

  const cardClass = isLight
    ? 'bg-[var(--eos-card)] text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]'
    : 'bg-gradient-to-b from-[#161616] to-[#080808] text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]';

  const titleClass = isLight
    ? 'text-[var(--eos-text)] font-extrabold'
    : 'text-white/95 font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,1)]';

  const statusClass = hasPasskey
    ? isLight
      ? 'text-emerald-700'
      : 'text-[#10b981]'
    : isLight
      ? 'text-red-600'
      : 'text-[#ef4444]/70';

  const iconWellClass = hasPasskey
    ? isLight
      ? 'border-[var(--eos-border)] bg-emerald-50 shadow-[inset_0_2px_8px_rgba(15,23,42,0.06)]'
      : 'border-t border-[#000] border-b border-white/10 bg-[#031208] shadow-[inset_0_4px_12px_rgba(0,0,0,1)]'
    : isLight
      ? 'border-[var(--eos-border)] bg-[var(--eos-surface)] shadow-[inset_0_2px_8px_rgba(15,23,42,0.08)]'
      : 'border-t border-[#000] border-b border-white/10 bg-[#090909] shadow-[inset_0_4px_12px_rgba(0,0,0,1)]';

  const glowClass = hasPasskey
    ? isLight
      ? 'bg-emerald-500/10'
      : 'bg-[#10b981]/10'
    : isLight
      ? 'bg-red-500/5'
      : 'bg-[#ef4444]/5';

  return (
    <div className="eos-passkey-toggle relative w-full md:w-[480px] group cursor-default mt-4">
      {hasPasskey ? (
        <div className={`absolute -inset-3 rounded-[3rem] blur-[25px] animate-[pulse_4s_ease-in-out_infinite] pointer-events-none ${glowClass}`} />
      ) : (
        <div className={`absolute -inset-3 rounded-[3rem] blur-[20px] pointer-events-none ${glowClass}`} />
      )}

      <div
        className={`relative p-[1px] rounded-[2.5rem] bg-gradient-to-b transition-colors duration-1000 ${
          isLight ? 'shadow-[var(--eos-shadow-soft)]' : 'shadow-[0_30px_60px_rgba(0,0,0,0.8)]'
        } ${frameClass}`}
      >
        <div
          className={`relative overflow-hidden rounded-[calc(2.5rem-1px)] p-5 px-6 flex items-center justify-between ${cardClass}`}
        >
          {!isLight ? (
            <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
          ) : null}

          <div className="flex items-center gap-5 relative z-10 min-w-0">
            <div
              className={`relative w-[52px] h-[52px] rounded-[1.1rem] flex items-center justify-center transition-all duration-1000 shrink-0 overflow-hidden ${iconWellClass}`}
            >
              {hasPasskey && !isScanning ? (
                <div
                  className={`absolute inset-0 ${
                    isLight
                      ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.2)_0%,transparent_70%)]'
                      : 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.3)_0%,transparent_70%)]'
                  } animate-[pulse_4s_ease-in-out_infinite]`}
                />
              ) : null}

              {isScanning ? (
                <Fingerprint
                  size={26}
                  className="text-emerald-500 relative z-10 drop-shadow-[0_0_12px_rgba(16,185,129,0.65)] animate-pulse"
                />
              ) : hasPasskey ? (
                <Fingerprint
                  size={26}
                  className="text-emerald-500 relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.55)]"
                />
              ) : (
                <Fingerprint
                  size={26}
                  className={`relative z-10 ${isLight ? 'text-[var(--eos-muted)]' : 'text-[#333]'}`}
                />
              )}
            </div>

            <div className="flex flex-col justify-center gap-1 min-w-0">
              <h3 className={`tracking-tight text-[16px] leading-none ${titleClass}`}>
                Face ID / Touch ID
              </h3>

              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className={`relative w-2 h-2 rounded-full flex items-center justify-center ${
                    isLight ? 'bg-[var(--eos-surface)]' : 'bg-[#000] shadow-[inset_0_1px_2px_rgba(0,0,0,1)]'
                  }`}
                >
                  <span
                    className={`block w-1.5 h-1.5 rounded-full transition-all duration-1000 ${
                      hasPasskey
                        ? 'bg-emerald-500 shadow-[0_0_8px_1px_rgba(16,185,129,0.65)] animate-[pulse_4s_ease-in-out_infinite]'
                        : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.45)]'
                    }`}
                  />
                </div>

                <p className={`text-[10px] font-black tracking-[0.12em] uppercase transition-colors duration-1000 truncate ${statusClass}`}>
                  {hasPasskey ? 'Aktywne • Secure Enclave' : 'Nieaktywne'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={hasPasskey ? handleDeletePasskey : handleRegisterPasskey}
            disabled={isRegistering}
            aria-pressed={hasPasskey}
            aria-label={hasPasskey ? 'Wyłącz logowanie Face ID' : 'Włącz logowanie Face ID'}
            className={`relative w-[64px] h-[34px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 shrink-0 z-10 ${
              hasPasskey
                ? 'bg-[#34c759] shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)] border border-[#2db14e]'
                : isLight
                  ? 'bg-[var(--eos-surface)] shadow-[inset_0_3px_6px_rgba(15,23,42,0.12)] border border-[var(--eos-border)] hover:bg-[var(--eos-bg-elevated)]'
                  : 'bg-[#111111] shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] border border-[#000] hover:bg-[#151515]'
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-gradient-to-b from-[#ffffff] to-[#e0e0e0] shadow-[0_3px_6px_rgba(0,0,0,0.35),inset_0_2px_3px_rgba(255,255,255,1)] ${
                hasPasskey ? 'translate-x-[30px]' : 'translate-x-0'
              }`}
            >
              {isRegistering ? (
                <Loader2 className="text-[#666] animate-spin" size={14} strokeWidth={3} />
              ) : null}
            </span>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p
          className={`mt-3 text-[11px] font-semibold tracking-wide ${
            isLight ? 'text-red-600' : 'text-red-300'
          }`}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
