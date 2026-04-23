"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, CreditCard, CheckCircle2, X } from "lucide-react";
import { useState } from "react";

export default function LimitModal({ isOpen, onClose, onPay }: { isOpen: boolean, onClose: () => void, onPay: () => void }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    // Tutaj zaraz podepniemy Stripe
    await onPay();
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            
            <button onClick={onClose} className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 mx-auto">
              <Lock size={28} className="text-emerald-500" />
            </div>

            <h3 className="text-2xl font-black text-center mb-2 tracking-tight">Osiągnąłeś Limit</h3>
            <p className="text-white/50 text-center text-sm mb-8 leading-relaxed">
              Twój darmowy plan pozwala na posiadanie 1 aktywnego ogłoszenia. Nie trać swojej pracy – odblokuj ten slot i wystaw ofertę natychmiast.
            </p>

            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-white/80">Dodatkowe Ogłoszenie</span>
                <span className="text-xl font-black text-emerald-500">29 PLN <span className="text-[10px] text-white/30 uppercase tracking-widest">/ m-c</span></span>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-xs text-white/60"><CheckCircle2 size={14} className="text-emerald-500"/> Zwiększa limit konta o 1</li>
                <li className="flex items-center gap-2 text-xs text-white/60"><CheckCircle2 size={14} className="text-emerald-500"/> Oferta widoczna od razu na mapie</li>
                <li className="flex items-center gap-2 text-xs text-white/60"><CheckCircle2 size={14} className="text-emerald-500"/> Anuluj subskrypcję w każdej chwili</li>
              </ul>
            </div>

            <button 
              onClick={handlePayment} 
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? "Przetwarzanie..." : <><CreditCard size={18} /> Zapłać 29 PLN i Opublikuj</>}
            </button>
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
