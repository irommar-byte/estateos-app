"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Handshake, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

      const res = await fetch('/api/deals/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, buyerId: currentUserId, ...payload })
      });

      const data = await res.json();
      if (data.success && data.dealId) {
        // Przenosimy prosto do Deal Roomu
        router.push(`/moje-konto/crm/dealroom?dealId=${data.dealId}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setActiveModal('none');
    }
  };

  return (
    <>
      {/* GŁÓWNE PRZYCISKI NA STRONIE OFERTY */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <button 
          onClick={() => setActiveModal('visit')}
          className="flex-1 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-black uppercase tracking-widest rounded-2xl flex justify-center items-center gap-3 transition-all"
        >
          <CalendarDays size={20} className="text-emerald-500" /> Umów wizytę
        </button>
        <button 
          onClick={() => setActiveModal('bid')}
          className="flex-1 py-4 bg-gradient-to-r from-[#D4AF37] to-[#B5952F] hover:opacity-90 text-black font-black uppercase tracking-widest rounded-2xl flex justify-center items-center gap-3 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          <Handshake size={20} /> Zaproponuj Cenę
        </button>
      </div>

      {/* MODAL (WIZYTA LUB OFERTA) */}
      <AnimatePresence>
        {activeModal !== 'none' && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative"
            >
              <button onClick={() => setActiveModal('none')} className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors">
                <X size={20} />
              </button>

              <h3 className="text-xl font-black text-white mb-2">
                {activeModal === 'visit' ? 'Wybierz termin' : 'Twoja propozycja'}
              </h3>
              <p className="text-white/50 text-xs font-medium mb-6">
                {activeModal === 'visit' 
                  ? 'Właściciel otrzyma prośbę o spotkanie w Deal Roomie.' 
                  : 'Właściciel natychmiast zobaczy Twoją ofertę i będzie mógł ją zaakceptować.'}
              </p>

              {activeModal === 'visit' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Data</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Godzina</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-[#D4AF37]/60 uppercase tracking-widest block mb-2">Kwota (PLN)</label>
                  <input type="number" placeholder="np. 850000" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 text-white text-xl font-black focus:outline-none focus:border-[#D4AF37] transition-colors" />
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={loading || (activeModal === 'visit' ? (!date || !time) : !amount)}
                className="w-full py-4 mt-8 bg-emerald-500 disabled:bg-white/5 disabled:text-white/20 text-black font-black uppercase tracking-widest rounded-xl flex justify-center items-center gap-2 transition-all"
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
