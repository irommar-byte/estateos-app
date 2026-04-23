"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Briefcase, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";

export default function BiddingModal({ offerId, currentPrice, onClose }: { offerId: string, currentPrice: number, onClose: () => void }) {
  const [bidAmount, setBidAmount] = useState(currentPrice.toString());
  const [financing, setFinancing] = useState<'CASH' | 'CREDIT'>('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setBidAmount(rawValue);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, amount: bidAmount, financing })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => { onClose(); window.dispatchEvent(new Event('refreshNotifications')); }, 3000);
      } else {
        const d = await res.json();
        alert(d.error || "Zaloguj się, aby licytować.");
      }
    } catch (e) { alert("Błąd połączenia."); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex justify-between items-center border-b border-white/5 bg-[#050505]">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Oferta Zakupu</h3>
          <button onClick={onClose} className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50"><X size={16} /></button>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center flex flex-col items-center">
                <ShieldCheck size={60} className="text-emerald-500 mb-4 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                <h4 className="text-2xl font-black text-white mb-2">Oferta Złożona</h4>
                <p className="text-xs text-white/40">Właściciel otrzymał Twoją oficjalną propozycję finansową. Status znajdziesz w swoim CRM.</p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 block">Proponowana Kwota</label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 text-xl font-black transition-colors group-focus-within:text-emerald-500">PLN</span>
                    <input 
                      type="text" 
                      value={bidAmount ? new Intl.NumberFormat('pl-PL').format(Number(bidAmount)) : ''} 
                      onChange={handleAmountChange} 
                      placeholder="0"
                      className="w-full bg-[#111] border-2 border-white/5 rounded-2xl py-5 pl-[4.5rem] pr-6 text-3xl font-black text-white outline-none focus:bg-[#0a0a0a] focus:border-emerald-500/50 transition-all shadow-inner hover:border-white/20" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 block">Źródło Finansowania</label>
                  <div className="relative flex w-full bg-[#111] border border-white/5 rounded-2xl p-1.5 shadow-inner">
                    
                    {/* PŁYNNIE PRZESUWAJĄCY SIĘ BLASK (SLIDER) */}
                    <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-[#0a0a0a] border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${financing === 'CREDIT' ? 'translate-x-full' : 'translate-x-0'}`}></div>
                    
                    {/* OPCJE */}
                    <button 
                      onClick={() => setFinancing('CASH')} 
                      className={`relative z-10 flex-1 py-4 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 ${financing === 'CASH' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}
                    >
                      Gotówka
                    </button>
                    <button 
                      onClick={() => setFinancing('CREDIT')} 
                      className={`relative z-10 flex-1 py-4 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 ${financing === 'CREDIT' ? 'text-emerald-400' : 'text-white/40 hover:text-white/80'}`}
                    >
                      Kredyt
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  {/* GŁÓWNY PRZYCISK: BIAŁY MONOLIT */}
                  <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !bidAmount} 
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    className="relative overflow-hidden w-full flex items-center justify-center gap-3 rounded-[2rem] px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_50px_rgba(255,255,255,0.2)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                    {isSubmitting ? (
                       <Loader2 className="relative z-10 animate-spin text-black" size={22}/>
                    ) : (
                       <>
                         <Briefcase size={22} className="relative z-10 text-black group-hover:scale-110 transition-transform" /> 
                         <span className="relative z-10 text-sm sm:text-base font-black uppercase tracking-[0.2em] text-black">Złóż Wiążącą Ofertę</span>
                       </>
                    )}
                  </button>
                  <div className="flex items-center justify-center gap-1.5 mt-5 opacity-40 select-none">
                    <ShieldCheck size={10} className="text-white" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Transakcja Zabezpieczona przez EstateOS™</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
