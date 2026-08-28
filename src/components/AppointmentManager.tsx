"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Clock, Send, MessageSquare, CalendarIcon, Loader2, ChevronLeft, CalendarCheck } from "lucide-react";

export default function AppointmentManager({ appointment, onClose }: any) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newHour, setNewHour] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [counterStep, setCounterStep] = useState(1);
  
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [checkingTurn, setCheckingTurn] = useState(false);

  // Wstępny stan na podstawie danych z bazy
  const initView = 
    appointment?.status === 'ACCEPTED' ? 'ACCEPTED_VIEW' :
    appointment?.status === 'DECLINED' ? 'DECLINED_VIEW' : 'IDLE';

  const [view, setView] = useState(initView);

  useEffect(() => { 
    setMounted(true); 
    // Local turn resolution based on canonical appointment state.
    setIsMyTurn(appointment?.status === 'PENDING');

    if (appointment?.id) {
      fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: appointment.id }) })
      .then(() => window.dispatchEvent(new Event('refreshNotifications'))).catch(() => {});
    }
  }, [appointment?.id]);

  const dates = Array.from({ length: 30 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const hours: string[] = [];
  for (let h = 8; h <= 20; h++) { hours.push(`${h.toString().padStart(2, '0')}:00`); if (h !== 20) hours.push(`${h.toString().padStart(2, '0')}:30`); }

  const handleAction = async (actionStatus: string) => {
    setIsSubmitting(true);
    let finalDate = appointment.proposedDate;
    if (actionStatus === 'COUNTER' && newDate && newHour) {
      const [h, m] = newHour.split(':');
      finalDate = new Date(newDate);
      finalDate.setHours(parseInt(h), parseInt(m), 0, 0);
    }
    
    // Paczka z danymi do API (obsługuje też oceny z gwiazdek)
    const decisionMap: Record<string, string> = {
      ACCEPTED: 'ACCEPT',
      DECLINED: 'DECLINE',
      COUNTER: 'RESCHEDULE',
    };
    const decision = decisionMap[actionStatus];
    if (!decision) {
      setIsSubmitting(false);
      return;
    }
    const payload: any = {
      action: decision,
      message,
      note: message,
    };
    if (decision === 'RESCHEDULE') {
      payload.counterDate = finalDate;
    }

    try {
      const res = await fetch(`/api/deals/${appointment.dealId}/appointments/${appointment.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) { window.dispatchEvent(new Event('refreshNotifications')); onClose(); } 
      else alert("Processing error");
    } catch(e) { alert("Connection error"); } finally { setIsSubmitting(false); }
  };

  if (!mounted || !appointment) return null;
  const currentPropDate = new Date(appointment.proposedDate);
  const isNegotiating = ['PROPOSED', 'COUNTER'].includes(appointment.status);

  // Kompaktowe klasy UI (bez scrolla)
  const btnClass = "w-full py-3.5 md:py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-xs";
  const neonGreen = "bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]";
  const neonYellow = "bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 hover:border-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.05)] hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]";
  const neonRed = "bg-red-500/5 hover:bg-red-500/15 text-red-500 border border-red-500/20 hover:border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]";

  const modalContent = (
    <div className="fixed inset-0 eos-z-modal flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="eos-modal-backdrop absolute inset-0" />
      
      {/* Usunięto sztywne h-[650px]. Dodano h-auto i elastyczne marginesy dla płynnego dopasowania */}
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="eos-themed-modal relative my-auto flex h-auto max-h-[95vh] w-full max-w-md shrink-0 flex-col overflow-hidden rounded-[2.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--eos-border)] bg-[var(--eos-bg)] p-4 md:p-6">
          <div className="flex items-center gap-3">
            {['ACCEPTING', 'COUNTERING', 'DECLINING'].includes(view) && ( 
               <button onClick={() => { setView(initView); setCounterStep(1); }} className="w-8 h-8 bg-[var(--eos-input)] hover:bg-[var(--eos-input)] rounded-full flex items-center justify-center text-[var(--eos-muted)] transition-colors"><ChevronLeft size={16} /></button> 
            )}
            <h3 className="text-sm md:text-base font-black text-[var(--eos-text)] uppercase tracking-widest">
               {view === 'IDLE' ? 'Negotiation' : view === 'ACCEPTED_VIEW' ? 'Confirmed' : 'Management'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-[var(--eos-input)] hover:bg-[var(--eos-input)] rounded-full flex items-center justify-center text-[var(--eos-muted)] transition-colors"><X size={16} /></button>
        </div>

        {/* Dynamiczny kontener bez custom-scrollbar na małych urządzeniach */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* WIDOK: NEGOCJACJE TRWAJĄ */}
            {view === 'IDLE' && (
              <motion.div key="idle" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="bg-[var(--eos-input)] rounded-2xl p-4 md:p-5 border border-[var(--eos-border)] text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-yellow-500"></div>
                  <p className="text-[9px] text-[var(--eos-subtle)] font-bold uppercase tracking-widest mb-2">Proponowany Termin</p>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl md:text-3xl font-black text-[var(--eos-text)] mb-2">{currentPropDate.getDate()} {currentPropDate.toLocaleDateString('pl-PL', { month: 'long' })}</span>
                    <span className="text-emerald-500 font-black text-sm md:text-lg flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"><Clock size={14}/> {currentPropDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {appointment.message && (
                  <div className="bg-[#151515] p-3 md:p-4 rounded-2xl border border-[var(--eos-border)] relative">
                     <MessageSquare className="absolute top-4 right-4 text-[var(--eos-subtle)]" size={24} />
                     <p className="text-[9px] text-[var(--eos-subtle)] font-bold uppercase tracking-widest mb-1">Message:</p>
                     <p className="text-xs text-[var(--eos-muted)] leading-relaxed italic relative z-10">"{appointment.message}"</p>
                  </div>
                )}

                {checkingTurn ? (
                  <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[var(--eos-subtle)]" size={24} /></div>
                ) : (
                  <>
                    {!isMyTurn && isNegotiating ? (
                      <div className="pt-2 flex flex-col gap-3">
                        <div className="bg-[var(--eos-input)] p-4 rounded-[1.5rem] border border-[var(--eos-border)] text-center relative">
                           <Loader2 className="animate-spin text-[var(--eos-subtle)] mx-auto mb-2" size={20} />
                           <h4 className="text-[10px] font-black text-[var(--eos-text)] uppercase tracking-widest mb-1">Waiting for response</h4>
                           <p className="text-[9px] text-[var(--eos-subtle)] font-medium">Your action has been submitted. You will be notified after the partner decision.</p>
                        </div>
                        <button onClick={() => setView('DECLINING')} className={`${btnClass} ${neonRed}`}><X size={16} /> Withdraw offer</button>
                      </div>
                    ) : (
                      <div className="pt-2 flex flex-col gap-2.5">
                        <button onClick={() => setView('ACCEPTING')} className={`${btnClass} ${neonGreen}`}><CheckCircle size={16} /> Accept time</button>
                        <button onClick={() => setView('COUNTERING')} className={`${btnClass} ${neonYellow}`}><Clock size={16} /> Zaproponuj Inny</button>
                        <button onClick={() => setView('DECLINING')} className={`${btnClass} ${neonRed}`}><X size={16} /> Decline</button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* WIDOK: STAN ZAAKCEPTOWANY (HANDSHAKE) */}
            {view === 'ACCEPTED_VIEW' && (
              <motion.div key="accepted_view" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center space-y-4 my-auto">
                 <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                    <CalendarCheck className="text-emerald-500 relative z-10" size={60} strokeWidth={1.5} />
                 </div>
                 <div>
                    <h4 className="text-xl md:text-2xl font-black text-[var(--eos-text)] tracking-tighter mb-1">Porozumienie Zawarte</h4>
                    <p className="text-emerald-500 font-black text-sm">{currentPropDate.getDate()} {currentPropDate.toLocaleDateString('pl-PL', { month: 'long' })} o {currentPropDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
                 </div>
                 
                 <p className="text-[10px] text-[var(--eos-subtle)] leading-relaxed px-4 pb-4">The meeting has been officially recorded. If you cannot attend, notify the other side to avoid negative profile feedback.</p>

                 <div className="w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-3">
                   <p className="text-[10px] text-[var(--eos-muted)] uppercase tracking-widest font-black">Tryb canonical</p>
                   <p className="text-xs text-[var(--eos-muted)] mt-1">Rating and closure are handled after finalization in DealRoom.</p>
                 </div>
              </motion.div>
            )}

            {/* ODTWORZONE KOMPAKTOWE WIDOKI (ACCEPTING, COUNTERING, DECLINING z trybu IDLE) */}
            {view === 'ACCEPTING' && (
               <motion.div key="accept" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full justify-center text-center space-y-4 my-auto">
                  <CheckCircle className="text-emerald-500 w-16 h-16 md:w-20 md:h-20 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] rounded-full" />
                  <h4 className="text-lg md:text-xl font-black text-[var(--eos-text)] tracking-tighter">Zatwierdzasz spotkanie?</h4>
                  <p className="text-[var(--eos-subtle)] text-[10px] md:text-xs leading-relaxed px-4 pb-4">Druga strona otrzyma natychmiastowe powiadomienie o akceptacji terminu w systemie.</p>
                  <button onClick={() => handleAction('ACCEPTED')} disabled={isSubmitting} className={`${btnClass} ${neonGreen}`}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Confirm binding'}
                  </button>
               </motion.div>
            )}

            {view === 'COUNTERING' && (
              <motion.div key="counter" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 h-full flex flex-col justify-center">
                {counterStep === 1 && (
                   <div className="grid grid-cols-3 gap-2">
                     {dates.slice(0, 15).map((d, i) => { // Pokazujemy mniej, żeby pasowało bez scrolla
                       const isSelected = newDate?.toDateString() === d.toDateString();
                       return (
                         <button key={i} onClick={() => { setNewDate(d); setTimeout(() => setCounterStep(2), 200); }} className={`eos-modal-chip eos-ask-chip w-full h-14 md:h-16 flex-col justify-center ${isSelected ? 'eos-modal-chip--selected eos-ask-chip--selected' : ''}`}>
                           <span className="text-[8px] font-black uppercase">{d.toLocaleDateString('pl-PL', { weekday: 'short' })}</span>
                           <span className="text-lg font-black">{d.getDate()}</span>
                         </button> 
                       )
                     })}
                   </div>
                )}
                {counterStep === 2 && (
                   <div className="grid grid-cols-4 gap-2">
                     {hours.map((h) => {
                       const isSelected = newHour === h;
                       return (
                         <button key={h} onClick={() => { setNewHour(h); setTimeout(() => setCounterStep(3), 200); }} className={`eos-modal-chip eos-ask-chip justify-center py-3 text-xs font-black tracking-widest ${isSelected ? 'eos-modal-chip--selected eos-ask-chip--selected' : ''}`}>
                           {h}
                         </button> 
                       )
                     })}
                   </div>
                )}
                {counterStep === 3 && (
                   <div className="space-y-4 h-full flex flex-col justify-center">
                      <div className="bg-[var(--eos-input)] p-3 rounded-2xl border border-[var(--eos-border)] flex items-center justify-between shadow-inner">
                         <div className="flex flex-col">
                            <span className="text-[9px] text-[var(--eos-subtle)] font-bold uppercase tracking-widest">Nowy Termin</span>
                            <span className="text-yellow-500 font-black text-sm flex items-center gap-1.5"><CalendarIcon size={12}/> {newDate?.toLocaleDateString('pl-PL')} o {newHour}</span>
                         </div>
                         <button onClick={() => { setCounterStep(1); setNewDate(null); setNewHour(null); }} className="text-[8px] font-black uppercase text-[var(--eos-subtle)] hover:text-[var(--eos-text)] border border-[var(--eos-border)] px-2 py-1 rounded-full">Change</button>
                      </div>
                      <textarea placeholder="Dlaczego proponujesz ten termin..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full h-[80px] md:h-[100px] bg-[var(--eos-input)] border border-[var(--eos-border)] rounded-[1.5rem] p-4 text-xs text-[var(--eos-text)] outline-none focus:border-yellow-500/50 resize-none transition-colors" />
                      <button onClick={() => handleAction('COUNTER')} disabled={isSubmitting} className={`${btnClass} ${neonYellow}`}>
                        {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><Send size={16}/> Send proposal</>}
                      </button>
                   </div>
                )}
              </motion.div>
            )}

            {view === 'DECLINING' && (
              <motion.div key="decline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full space-y-4 my-auto text-center">
                 <h4 className="text-lg md:text-xl font-black text-[var(--eos-text)] tracking-tighter">Odrzucenie wizyty</h4>
                 <p className="text-[var(--eos-subtle)] text-[10px] leading-relaxed px-4">Briefly explain why you are rejecting this request. It helps avoid misunderstandings and saves time.</p>
                 <textarea placeholder="e.g. The listing is no longer available..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full flex-1 min-h-[100px] bg-[var(--eos-input)] border border-[var(--eos-border)] rounded-[1.5rem] p-4 text-xs text-[var(--eos-text)] outline-none focus:border-red-500/50 resize-none transition-colors" />
                 <button onClick={() => handleAction('DECLINED')} disabled={isSubmitting} className={`${btnClass} ${neonRed}`}>
                   {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><X size={16}/> Definitywnie Decline</>}
                 </button>
              </motion.div>
            )}

            {/* WIDOK ZAKOŃCZENIA */}
            {['DECLINED_VIEW'].includes(view) && (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full justify-center items-center text-center space-y-4 my-auto">
                  <X size={50} className="text-red-500 mb-2" />
                  <h4 className="text-xl font-black text-[var(--eos-text)] tracking-tighter">
                    Odrzucono
                  </h4>
                  <p className="text-xs text-[var(--eos-subtle)]">This operation status has already been closed and archived in the system.</p>
                  <button onClick={onClose} className="mt-4 px-6 py-3 border border-[var(--eos-border)] rounded-full text-xs font-black uppercase tracking-widest hover:bg-[var(--eos-input)] transition-colors">Zamknij</button>
               </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
