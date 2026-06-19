"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Briefcase, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getOfferModalsDictionary } from "@/i18n/offerModalsDictionary";

export default function BiddingModal({ offerId, currentPrice, onClose }: { offerId: string, currentPrice: number, onClose: () => void }) {
  const { locale } = useLocale();
  const m = getOfferModalsDictionary(locale);
  const numberTag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
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
        const d = await res.json().catch(() => ({}));
        if (d.errorCode === 'PHONE_VERIFICATION_REQUIRED') {
          window.location.href = '/moje-konto/weryfikacja';
          return;
        }
        alert(d.error || d.message || m.bidding.loginRequired);
      }
    } catch (e) { alert(m.bidding.connectionError); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto p-4 pt-10 pb-10 sm:pt-20 sm:pb-20">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="eos-modal-backdrop absolute inset-0" />
      
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="eos-modal-surface eos-modal-shell eos-themed-modal relative my-auto w-full max-w-md shrink-0 overflow-hidden rounded-[2.5rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--eos-border)] p-6">
          <h3 className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">{m.bidding.title}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] hover:bg-[var(--eos-border)]"><X size={16} /></button>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 text-center">
                <ShieldCheck size={60} className="mb-4 text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                <h4 className="mb-2 text-2xl font-black text-[var(--eos-text)]">{m.bidding.successTitle}</h4>
                <p className="text-xs text-[var(--eos-muted)]">{m.bidding.successBody}</p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-6">
                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">{m.bidding.amountLabel}</label>
                  <div className="group relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-[var(--eos-muted)] transition-colors group-focus-within:text-emerald-500">PLN</span>
                    <input 
                      type="text" 
                      value={bidAmount ? new Intl.NumberFormat(numberTag).format(Number(bidAmount)) : ''} 
                      onChange={handleAmountChange} 
                      placeholder="0"
                      className="w-full rounded-2xl border-2 border-[var(--eos-border)] bg-[var(--eos-input)] py-5 pl-[4.5rem] pr-6 text-3xl font-black text-[var(--eos-text)] shadow-inner outline-none transition-all hover:border-[var(--eos-border-strong)] focus:border-emerald-500/50" 
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">{m.bidding.financingLabel}</label>
                  <div className="relative flex w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-1.5 shadow-inner">
                    <div className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] rounded-xl border border-emerald-500/40 bg-[var(--eos-bg-elevated)] shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${financing === 'CREDIT' ? 'translate-x-full' : 'translate-x-0'}`}></div>
                    <button 
                      type="button"
                      onClick={() => setFinancing('CASH')} 
                      className={`relative z-10 flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 sm:text-xs ${financing === 'CASH' ? 'text-emerald-500' : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'}`}
                    >
                      {m.bidding.cash}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFinancing('CREDIT')} 
                      className={`relative z-10 flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors duration-500 sm:text-xs ${financing === 'CREDIT' ? 'text-emerald-500' : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'}`}
                    >
                      {m.bidding.credit}
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="button"
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !bidAmount} 
                    className="group relative flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-[2rem] bg-white px-4 py-5 text-black shadow-[0_20px_50px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
                  >
                    {isSubmitting ? (
                       <Loader2 className="relative z-10 animate-spin text-black" size={22}/>
                    ) : (
                       <>
                         <Briefcase size={22} className="relative z-10 transition-transform group-hover:scale-110" /> 
                         <span className="relative z-10 text-sm font-black uppercase tracking-[0.2em] sm:text-base">{m.bidding.submitCta}</span>
                       </>
                    )}
                  </button>
                  <div className="mt-5 flex select-none items-center justify-center gap-1.5 opacity-40">
                    <ShieldCheck size={10} className="text-[var(--eos-muted)]" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">{m.bidding.securedBy}</span>
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
