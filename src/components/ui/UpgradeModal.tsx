'use client';
import { useUserMode } from '@/contexts/UserModeContext';
import { Crown, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { eosBtn } from '@/components/ui/eosButtonStyles';
import EosModal from '@/components/ui/EosModal';

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

  const isAgency = upgradeModalType === 'AGENCY';
  const planName = isAgency ? 'Agencja' : 'Investor Pro';

  return (
    <EosModal
      open={isUpgradeModalOpen}
      onClose={() => setIsUpgradeModalOpen(false)}
      variant="centered"
      maxWidth="max-w-lg"
      hideHeader
      hideBodyPadding
    >
      <div className="flex flex-col items-center p-8 text-center">
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
    </EosModal>
  );
}
