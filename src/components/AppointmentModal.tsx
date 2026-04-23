"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarIcon, ShieldCheck, Loader2, CheckCircle, ChevronLeft } from "lucide-react";

export default function AppointmentModal({ isOpen, onClose, offerId, sellerId }: any) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [shareContact, setShareContact] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => setMounted(true), []);

  const dates = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const hours: string[] = [];
  for (let h = 8; h <= 20; h++) { 
    hours.push(`${h.toString().padStart(2, '0')}:00`); 
    if (h !== 20) hours.push(`${h.toString().padStart(2, '0')}:30`); 
  }

  const handleSubmit = async () => {
    if (!selectedDate || !selectedHour) return;
    setIsSubmitting(true);
    const [hoursStr, minutesStr] = selectedHour.split(':');
    const finalDate = new Date(selectedDate);
    finalDate.setHours(parseInt(hoursStr, 10), parseInt(minutesStr, 10), 0, 0);
    let buyerId = "nieznany";
    try {
      const localUser = null;
      if (localUser) {
        const parsed = JSON.parse(localUser);
        buyerId = parsed.id || parsed.email || localUser;
      }
    } catch(e) {}

    try {
      const res = await fetch('/api/appointments/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, sellerId, buyerId, proposedDate: finalDate.toISOString(), message: message + (shareContact ? "\n\n[Zgoda na udostępnienie kontaktów]" : "") })
      });
      if (res.ok) { setIsSuccess(true); setTimeout(() => { onClose(); setIsSuccess(false); setStep(1); setSelectedDate(null); setSelectedHour(null); setMessage(""); }, 3000); } 
      else { const data = await res.json(); alert(data.error || "Błąd zapisu"); }
    } catch (e) { alert("Błąd połączenia."); } finally { setIsSubmitting(false); }
  };

  const slideVariants: any = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }, exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" } } };

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[650px] max-h-[90vh] my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-[#050505] shrink-0 relative z-10 shadow-sm">
              <div className="flex items-center gap-4">
                {step > 1 && !isSuccess && ( <button onClick={() => setStep(step - 1)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/80 transition-colors"><ChevronLeft size={20} /></button> )}
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">{isSuccess ? 'Sukces' : step === 1 ? 'Wybierz Dzień' : step === 2 ? 'Wybierz Godzinę' : 'Szczegóły'}</h3>
                  {!isSuccess && <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Krok {step} z 3</p>}
                </div>
              </div>
              <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 relative bg-[#0a0a0a]">
              <AnimatePresence mode="wait">
                {isSuccess && ( 
                  <motion.div key="success" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="py-12 flex flex-col items-center text-center h-full justify-center">
                    <CheckCircle className="text-emerald-500 w-24 h-24 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.4)] rounded-full" />
                    <h4 className="text-3xl font-black text-white mb-2 tracking-tighter">Wysłano!</h4>
                    <p className="text-white/40 text-sm mt-2">Oczekuj na potwierdzenie od właściciela.</p>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 1 && ( 
                  <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-2">
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3 pb-4">
                      {dates.map((d, i) => {
                        const isSelected = selectedDate?.toDateString() === d.toDateString();
                        return ( 
                          <button key={i} onClick={() => { setSelectedDate(d); setTimeout(() => setStep(2), 300); }} className={`relative w-full aspect-square rounded-[1.2rem] border flex flex-col items-center justify-center transition-all duration-300 group ${isSelected ? 'bg-[#0a0a0a] border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5'}`}>
                            <span className={`text-[9px] font-black uppercase mb-1 tracking-widest ${isSelected ? 'text-emerald-500/80' : 'text-white/40'}`}>{d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}</span>
                            <span className={`text-xl sm:text-2xl font-black ${isSelected ? 'text-emerald-500' : 'text-white/90'}`}>{d.getDate()}</span>
                            <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${isSelected ? 'text-emerald-500/80' : 'text-white/30'}`}>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</span>
                          </button> 
                        )
                      })}
                    </div>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 2 && ( 
                  <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 pb-6">
                      {hours.map((h) => {
                         const isSelected = selectedHour === h;
                         return ( 
                          <button key={h} onClick={() => { setSelectedHour(h); setTimeout(() => setStep(3), 300); }} className={`py-4 rounded-xl border text-sm font-black tracking-widest transition-all duration-300 ${isSelected ? 'bg-[#0a0a0a] text-emerald-500 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5 text-white/80'}`}>{h}</button> 
                        )
                      })}
                    </div>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 3 && ( 
                  <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6 h-full flex flex-col">
                    <div className="bg-[#111] p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                       <div className="flex flex-col">
                          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Wybrany Termin</span>
                          <span className="text-emerald-500 font-black mt-1 flex items-center gap-2"><CalendarIcon size={14}/> {selectedDate?.toLocaleDateString('pl-PL')} o {selectedHour}</span>
                       </div>
                    </div>
                    <div className="relative flex-1 flex flex-col">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 block">Wiadomość do właściciela (opcjonalnie)</label>
                      <textarea placeholder="Napisz krótko o czym chciałbyś porozmawiać..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full flex-1 bg-[#111] border border-white/40 hover:border-white/70 rounded-3xl p-5 text-sm text-white outline-none focus:border-white focus:bg-[#0a0a0a] resize-none transition-all duration-300 shadow-inner" />
                      <div className="absolute bottom-4 right-4 text-[10px] text-white/20 font-bold">{message.length}/300</div>
                    </div>
                  </motion.div> 
                )}
              </AnimatePresence>
            </div>
            
            {!isSuccess && step === 3 && ( 
              <div className="p-6 border-t border-white/5 bg-[#050505] shrink-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                {/* NOWY SUPER CZYTELNY PRZYCISK APPLE */}
                <button onClick={handleSubmit} disabled={isSubmitting} className="relative overflow-hidden w-full group flex items-center justify-center gap-3 rounded-[2rem] border-2 px-4 py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer bg-[#0a0a0a] hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                  {isSubmitting ? <Loader2 className="relative z-10 animate-spin m-auto text-emerald-500" size={20} /> : <><ShieldCheck size={18} className="relative z-10 transition-colors duration-300 text-emerald-500 group-hover:text-white" /> <span className="relative z-10 text-xs sm:text-sm font-black uppercase tracking-[0.2em] transition-colors duration-300 text-emerald-500 group-hover:text-white">Zatwierdź Propozycję</span></>}
                </button>
              </div> 
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return createPortal(modalContent, document.body);
}
