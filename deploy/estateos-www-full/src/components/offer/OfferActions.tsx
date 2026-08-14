"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Handshake, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { eosBtn } from '@/components/ui/eosButtonStyles';

type OfferActionsProps = {
  offerId: number;
  currentUserId?: number | null;
};

export default function OfferActions({ offerId, currentUserId }: OfferActionsProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'none' | 'visit' | 'bid'>('none');
  const [loading, setLoading] = useState(false);
  
  // Stany formularzy
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async () => {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    
    setLoading(true);
    try {
      const payload = activeModal === 'visit' 
        ? { type: 'APPOINTMENT', date: `${date}T${time}:00Z` }
        : { type: 'BID', amount: parseFloat(amount) };

      const res = await fetch('/api/deals/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ offerId }),
      });

      const data = await res.json();
      if (data.errorCode === 'PHONE_VERIFICATION_REQUIRED') {
        router.push('/moje-konto/weryfikacja');
        return;
      }
      if (data.success && data.deal?.id) {
        router.push(`/moje-konto/crm?tab=transakcje&dealId=${data.deal.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setActiveModal('none');
    }
  };

  const fieldClass =
    'eos-modal-field w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-[var(--eos-text)] outline-none transition-colors focus:border-emerald-500';

  return (
    <>
      {/* GŁÓWNE PRZYCISKI NA STRONIE OFERTY */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <button 
          onClick={() => setActiveModal('visit')}
          className={eosBtn('secondary', { className: 'flex-1 justify-center gap-3' })}
        >
          <CalendarDays size={20} className="text-emerald-500" /> Umów wizytę
        </button>
        <button 
          onClick={() => setActiveModal('bid')}
          className={eosBtn('promote', { className: 'flex-1 justify-center gap-3' })}
        >
          <Handshake size={20} /> Zaproponuj Cenę
        </button>
      </div>

      {/* MODAL (WIZYTA LUB OFERTA) */}
      <AnimatePresence>
        {activeModal !== 'none' && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="eos-modal-backdrop absolute inset-0" onClick={() => setActiveModal('none')} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="eos-themed-modal relative w-full max-w-sm rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 shadow-[var(--eos-shadow-strong)]"
            >
              <button
                onClick={() => setActiveModal('none')}
                className="absolute top-6 right-6 text-[var(--eos-subtle)] transition-colors hover:text-[var(--eos-text)]"
              >
                <X size={20} />
              </button>

              <h3 className="mb-2 text-xl font-black text-[var(--eos-text)]">
                {activeModal === 'visit' ? 'Wybierz termin' : 'Twoja propozycja'}
              </h3>
              <p className="mb-6 text-xs font-medium text-[var(--eos-muted)]">
                {activeModal === 'visit' 
                  ? 'Właściciel otrzyma prośbę o spotkanie w Deal Roomie.' 
                  : 'Właściciel natychmiast zobaczy Twoją ofertę i będzie mógł ją zaakceptować.'}
              </p>

              {activeModal === 'visit' ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Data</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">Godzina</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className={fieldClass} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-amber-600">Kwota (PLN)</label>
                  <input
                    type="number"
                    placeholder="np. 850000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className={`${fieldClass} border-amber-500/30 bg-amber-500/5 text-xl font-black focus:border-amber-500`}
                  />
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={loading || (activeModal === 'visit' ? (!date || !time) : !amount)}
                className={eosBtn('home', { block: true, className: 'mt-8' })}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Wyślij do właściciela'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
