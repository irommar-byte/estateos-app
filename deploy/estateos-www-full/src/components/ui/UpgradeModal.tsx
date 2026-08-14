'use client';
import { useUserMode } from '@/contexts/UserModeContext';
import { X, Crown, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { eosBtn } from '@/components/ui/eosButtonStyles';

export default function UpgradeModal() {
  const [isLoading, setIsLoading] = useState(false);
  const { isUpgradeModalOpen, setIsUpgradeModalOpen, upgradeModalType } = useUserMode();

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: upgradeModalType })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (!isUpgradeModalOpen) return null;

  const isAgency = upgradeModalType === 'AGENCY';
  const planName = isAgency ? 'Agencja' : 'Investor Pro';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        className="eos-modal-backdrop absolute inset-0"
        onClick={() => setIsUpgradeModalOpen(false)}
      />
      <div className="eos-themed-modal relative w-full max-w-lg overflow-hidden rounded-[32px] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 shadow-[var(--eos-shadow-strong)]">
        <button
          type="button"
          onClick={() => setIsUpgradeModalOpen(false)}
          className="absolute right-6 top-6 text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-black shadow-[0_0_30px_rgba(52,211,153,0.25)]">
            {isAgency ? <Shield size={32} /> : <Crown size={32} />}
          </div>

          <h2 className="mb-2 text-2xl font-black uppercase tracking-tighter text-[var(--eos-text)]">
            Wymagana subskrypcja {planName}
          </h2>

          <p className="mb-8 text-sm leading-relaxed text-[var(--eos-muted)]">
            Tryb {isAgency ? 'Agencja' : 'Właściciel / Investor Pro'} jest dostępny dla zweryfikowanych użytkowników
            z aktywnym planem premium.
          </p>

          <div className="w-full space-y-3">
            <button
              type="button"
              onClick={handlePayment}
              disabled={isLoading}
              className={eosBtn('home', { block: true, size: 'lg' })}
            >
              <Zap size={18} />
              {isLoading ? 'Łączenie z płatnością…' : 'Opłać plan teraz'}
            </button>
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(false)}
              className={eosBtn('secondary', { block: true })}
            >
              Może później
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
