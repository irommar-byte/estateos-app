"use client";
import React, { useState, useEffect } from 'react';
import { Lock, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OFFER_PREMARKET_EMBARGO_HOURS } from '@/lib/offerPremarket';
import EosModal from '@/components/ui/EosModal';

type OffMarketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  offerCreatedAt?: string | Date | null;
};

export default function OffMarketModal({ isOpen, onClose, offerCreatedAt }: OffMarketModalProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!isOpen || !offerCreatedAt) return;

    const targetDate = new Date(offerCreatedAt).getTime() + (24 * 60 * 60 * 1000);

    const interval = setInterval(() => {
      const diff = targetDate - new Date().getTime();

      if (diff <= 0) {
        clearInterval(interval);
        onClose();
      } else {
        setTimeLeft({
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, offerCreatedAt, onClose]);

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-md"
      hideHeader
      hideBodyPadding
      showCloseButton={false}
    >
      <div className="relative overflow-hidden p-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] to-[#FFF0AA]" />

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <Lock className="text-[#D4AF37]" size={32} />
          </div>
        </div>

        <h2 className="text-2xl font-black text-center text-[var(--eos-text)] mb-2 tracking-tight">Before full market launch</h2>
        <p className="text-[var(--eos-muted)] text-center text-sm mb-8 leading-relaxed">
          This listing is already in the system, but the first {OFFER_PREMARKET_EMBARGO_HOURS} hours are a launch window — full details become public only after that. PRO unlocks them immediately.
        </p>

        <div className="flex justify-center gap-5 mb-10">
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-[var(--eos-text)]">{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-[var(--eos-subtle)] uppercase font-bold tracking-widest mt-1">Hrs</span>
          </div>
          <span className="text-3xl font-black text-[var(--eos-subtle)] mt-1">:</span>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-[var(--eos-text)]">{timeLeft.minutes.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-[var(--eos-subtle)] uppercase font-bold tracking-widest mt-1">Min</span>
          </div>
          <span className="text-3xl font-black text-[var(--eos-subtle)] mt-1">:</span>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-[#D4AF37] animate-pulse">{timeLeft.seconds.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-[#D4AF37]/50 uppercase font-bold tracking-widest mt-1">Sec</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { router.push('/cennik'); onClose(); }}
            className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B5952F] text-black font-black uppercase tracking-widest rounded-2xl flex justify-center items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            <Crown size={18} /> Upgrade to PRO
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-[var(--eos-input)] text-[var(--eos-muted)] font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-[var(--eos-border)] hover:text-[var(--eos-text)] transition-all"
          >
            I will wait
          </button>
        </div>
      </div>
    </EosModal>
  );
}
