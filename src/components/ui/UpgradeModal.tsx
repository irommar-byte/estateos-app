
'use client';
import { useUserMode } from '@/contexts/UserModeContext';
import { X, Crown, Shield, Zap } from 'lucide-react';

import { useState } from 'react';

export default function UpgradeModal() {
  const [isLoading, setIsLoading] = useState(false);

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
  const { isUpgradeModalOpen, setIsUpgradeModalOpen, upgradeModalType } = useUserMode();

  if (!isUpgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
        {/* Dekoracja tła */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px]" />
        
        <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
            {upgradeModalType === 'AGENCY' ? <Shield className="text-black" size={32} /> : <Crown className="text-black" size={32} />}
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">
            Wymagana Subskrypcja {upgradeModalType === 'AGENCY' ? 'AGENCJA' : 'INWESTOR PRO'}
          </h2>
          
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            Tryb {upgradeModalType === 'AGENCY' ? 'Partnera' : 'Właściciela'} jest dostępny wyłącznie dla zweryfikowanych użytkowników z aktywnym planem premium.
          </p>

          <div className="w-full space-y-3">
            <button 
              onClick={handlePayment} 
              disabled={isLoading}
              className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:shadow-[0_0_30px_rgba(52,211,153,0.8)] disabled:opacity-50"
            >
              <Zap size={18} className="fill-black" /> 
              {isLoading ? 'Łączenie z bramką...' : 'Opłać pakiet teraz'}
            </button>
            <button onClick={() => setIsUpgradeModalOpen(false)} className="w-full py-4 bg-white/5 text-white/40 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
              Może później
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
