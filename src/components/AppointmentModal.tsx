"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarIcon, ShieldCheck, Loader2, CheckCircle, ChevronLeft } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { appointmentDateLocale, getOfferModalsDictionary } from "@/i18n/offerModalsDictionary";

export default function AppointmentModal({ isOpen, onClose, offerId, sellerId }: any) {
  const { locale } = useLocale();
  const m = getOfferModalsDictionary(locale);
  const dateTag = appointmentDateLocale(locale);
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
        body: JSON.stringify({
          offerId,
          sellerId,
          buyerId,
          proposedDate: finalDate.toISOString(),
          message: message + (shareContact ? m.appointment.contactConsentNote : ""),
        })
      });
      if (res.ok) { setIsSuccess(true); setTimeout(() => { onClose(); setIsSuccess(false); setStep(1); setSelectedDate(null); setSelectedHour(null); setMessage(""); }, 3000); } 
      else {
        const data = await res.json().catch(() => ({}));
        if (data.errorCode === 'PHONE_VERIFICATION_REQUIRED') {
          window.location.href = '/moje-konto/weryfikacja';
          return;
        }
        alert(data.error || data.message || m.appointment.saveError);
      }
    } catch (e) { alert(m.appointment.connectionError); } finally { setIsSubmitting(false); }
  };

  const slideVariants: any = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }, exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" } } };

  if (!mounted) return null;

  const stepTitle = isSuccess
    ? m.appointment.successTitle
    : step === 1
      ? m.appointment.stepDay
      : step === 2
        ? m.appointment.stepHour
        : m.appointment.stepDetails;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="eos-modal-backdrop absolute inset-0" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="eos-modal-surface eos-modal-shell eos-themed-modal relative my-auto flex h-[650px] max-h-[90vh] w-full max-w-md shrink-0 flex-col overflow-hidden rounded-[2.5rem]" onClick={(e) => e.stopPropagation()}>
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--eos-border)] p-6 md:p-8">
              <div className="flex items-center gap-4">
                {step > 1 && !isSuccess && ( <button type="button" onClick={() => setStep(step - 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-border)]"><ChevronLeft size={20} /></button> )}
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-[var(--eos-text)] md:text-2xl">{stepTitle}</h3>
                  {!isSuccess && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{m.appointment.stepOf(step)}</p>}
                </div>
              </div>
              <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-border)]"><X size={20} /></button>
            </div>
            
            <div className="custom-scrollbar relative flex-1 overflow-y-auto p-6 md:p-8">
              <AnimatePresence mode="wait">
                {isSuccess && ( 
                  <motion.div key="success" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="mb-6 h-24 w-24 rounded-full text-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]" />
                    <h4 className="mb-2 text-3xl font-black tracking-tighter text-[var(--eos-text)]">{m.appointment.successHeading}</h4>
                    <p className="mt-2 text-sm text-[var(--eos-muted)]">{m.appointment.successBody}</p>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 1 && ( 
                  <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 pb-4 sm:grid-cols-5 sm:gap-3">
                      {dates.map((d, i) => {
                        const isSelected = selectedDate?.toDateString() === d.toDateString();
                        return ( 
                          <button key={i} type="button" onClick={() => { setSelectedDate(d); setTimeout(() => setStep(2), 300); }} className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-[1.2rem] border transition-all duration-300 ${isSelected ? 'z-10 scale-[1.05] border-2 border-emerald-500 bg-[var(--eos-input)] shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-[var(--eos-border-strong)]'}`}>
                            <span className={`mb-1 text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-emerald-500/80' : 'text-[var(--eos-muted)]'}`}>{d.toLocaleDateString(dateTag, { weekday: 'short' }).replace('.', '')}</span>
                            <span className={`text-xl font-black sm:text-2xl ${isSelected ? 'text-emerald-500' : 'text-[var(--eos-text)]'}`}>{d.getDate()}</span>
                            <span className={`mt-0.5 text-[8px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-500/80' : 'text-[var(--eos-subtle)]'}`}>{d.toLocaleDateString(dateTag, { month: 'short' }).replace('.', '')}</span>
                          </button> 
                        )
                      })}
                    </div>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 2 && ( 
                  <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                    <div className="grid grid-cols-3 gap-2 pb-6 sm:grid-cols-4 sm:gap-3">
                      {hours.map((h) => {
                         const isSelected = selectedHour === h;
                         return ( 
                          <button key={h} type="button" onClick={() => { setSelectedHour(h); setTimeout(() => setStep(3), 300); }} className={`rounded-xl border py-4 text-sm font-black tracking-widest transition-all duration-300 ${isSelected ? 'z-10 scale-[1.05] border-2 border-emerald-500 bg-[var(--eos-input)] text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-text)] hover:border-[var(--eos-border-strong)]'}`}>{h}</button> 
                        )
                      })}
                    </div>
                  </motion.div> 
                )}
                
                {!isSuccess && step === 3 && ( 
                  <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="flex h-full flex-col space-y-6">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 shadow-inner">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{m.appointment.selectedSlot}</span>
                          <span className="mt-1 flex items-center gap-2 font-black text-emerald-500"><CalendarIcon size={14}/> {selectedDate?.toLocaleDateString(dateTag)} · {selectedHour}</span>
                       </div>
                    </div>
                    <div className="relative flex flex-1 flex-col">
                      <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">{m.appointment.messageLabel}</label>
                      <textarea placeholder={m.appointment.messagePlaceholder} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full flex-1 resize-none rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-5 text-sm text-[var(--eos-text)] shadow-inner outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50" />
                      <div className="absolute bottom-4 right-4 text-[10px] font-bold text-[var(--eos-subtle)]">{message.length}/300</div>
                    </div>
                  </motion.div> 
                )}
              </AnimatePresence>
            </div>
            
            {!isSuccess && step === 3 && ( 
              <div className="z-10 shrink-0 border-t border-[var(--eos-border)] p-6">
                <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="relative flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-[2rem] border-2 border-emerald-500/30 bg-[var(--eos-input)] px-4 py-5 transition-all duration-500 hover:scale-[1.02] hover:border-emerald-400 hover:bg-emerald-950/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="relative z-10 m-auto animate-spin text-emerald-500" size={20} /> : <><ShieldCheck size={18} className="relative z-10 text-emerald-500" /> <span className="relative z-10 text-xs font-black uppercase tracking-[0.2em] text-emerald-500 sm:text-sm">{m.appointment.confirmCta}</span></>}
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
