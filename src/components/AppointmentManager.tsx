"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Clock, Send, MessageSquare, CalendarIcon, Loader2, ChevronLeft, Star, CalendarCheck, AlertTriangle, CalendarX2 } from "lucide-react";

export default function AppointmentManager({ appointment, onClose }: any) {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newHour, setNewHour] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [counterStep, setCounterStep] = useState(1);
  
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [checkingTurn, setCheckingTurn] = useState(true);

  // Wstępny stan na podstawie danych z bazy
  const initView = 
    appointment?.status === 'ACCEPTED' ? 'ACCEPTED_VIEW' :
    appointment?.status === 'CANCELED' ? 'CANCELED_VIEW' :
    appointment?.status === 'COMPLETED' ? 'COMPLETED_VIEW' :
    appointment?.status === 'DECLINED' ? 'DECLINED_VIEW' : 'IDLE';

  const [view, setView] = useState(initView);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => { 
    setMounted(true); 
    fetch('/api/auth/check').then(r => r.json()).then(d => { if(d.loggedIn) setCurrentUserEmail(d.user.email) });

    const fetchTurnData = async () => {
      try {
        const turnRes = await fetch(`/api/appointments/check-turn?appId=${appointment.id}`);
        const turnData = await turnRes.json();
        setIsMyTurn(turnData.isMyTurn);
      } catch (e) {} finally { setCheckingTurn(false); }
    };

    if (appointment?.id) {
      fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: appointment.id }) })
      .then(() => window.dispatchEvent(new Event('refreshNotifications'))).catch(() => {});
      fetchTurnData();
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
    const payload: any = { appointmentId: appointment.id, status: actionStatus, newDate: finalDate, message: message };
    if (actionStatus === 'COMPLETED') {
       payload.rating = rating;
       payload.reviewComment = message;
    }

    try {
      const res = await fetch('/api/appointments/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { window.dispatchEvent(new Event('refreshNotifications')); onClose(); } 
      else alert("Błąd przetwarzania");
    } catch(e) { alert("Błąd połączenia"); } finally { setIsSubmitting(false); }
  };

  if (!mounted || !appointment) return null;
  const currentPropDate = new Date(appointment.proposedDate);
  const isNegotiating = ['PROPOSED', 'COUNTER'].includes(appointment.status);
  
  // Twarda blokada: czy minął czas spotkania?
  const isPast = new Date() > currentPropDate;

  // Kompaktowe klasy UI (bez scrolla)
  const btnClass = "w-full py-3.5 md:py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-xs";
  const neonGreen = "bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]";
  const neonYellow = "bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 hover:border-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.05)] hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]";
  const neonRed = "bg-red-500/5 hover:bg-red-500/15 text-red-500 border border-red-500/20 hover:border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]";

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      
      {/* Usunięto sztywne h-[650px]. Dodano h-auto i elastyczne marginesy dla płynnego dopasowania */}
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] h-auto my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-[#050505] shrink-0">
          <div className="flex items-center gap-3">
            {['CANCELLING', 'RATING', 'ACCEPTING', 'COUNTERING', 'DECLINING'].includes(view) && ( 
               <button onClick={() => { setView(initView); setCounterStep(1); }} className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/80 transition-colors"><ChevronLeft size={16} /></button> 
            )}
            <h3 className="text-sm md:text-base font-black text-white uppercase tracking-widest">
               {view === 'IDLE' ? 'Negocjacje' : view === 'ACCEPTED_VIEW' ? 'Potwierdzono' : 'Zarządzanie'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 transition-colors"><X size={16} /></button>
        </div>

        {/* Dynamiczny kontener bez custom-scrollbar na małych urządzeniach */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* WIDOK: NEGOCJACJE TRWAJĄ */}
            {view === 'IDLE' && (
              <motion.div key="idle" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="bg-[#111] rounded-2xl p-4 md:p-5 border border-white/5 text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-yellow-500"></div>
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-2">Proponowany Termin</p>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl md:text-3xl font-black text-white mb-2">{currentPropDate.getDate()} {currentPropDate.toLocaleDateString('pl-PL', { month: 'long' })}</span>
                    <span className="text-emerald-500 font-black text-sm md:text-lg flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"><Clock size={14}/> {currentPropDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {appointment.message && (
                  <div className="bg-[#151515] p-3 md:p-4 rounded-2xl border border-white/5 relative">
                     <MessageSquare className="absolute top-4 right-4 text-white/10" size={24} />
                     <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">Wiadomość:</p>
                     <p className="text-xs text-white/80 leading-relaxed italic relative z-10">"{appointment.message}"</p>
                  </div>
                )}

                {checkingTurn ? (
                  <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-white/20" size={24} /></div>
                ) : (
                  <>
                    {!isMyTurn && isNegotiating ? (
                      <div className="pt-2 flex flex-col gap-3">
                        <div className="bg-[#111] p-4 rounded-[1.5rem] border border-white/5 text-center relative">
                           <Loader2 className="animate-spin text-white/20 mx-auto mb-2" size={20} />
                           <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Oczekujemy na odpowiedź</h4>
                           <p className="text-[9px] text-white/40 font-medium">Twój ruch został wykonany. Zostaniesz powiadomiony po decyzji partnera.</p>
                        </div>
                        <button onClick={() => setView('DECLINING')} className={`${btnClass} ${neonRed}`}><X size={16} /> Wycofaj Ofertę</button>
                      </div>
                    ) : (
                      <div className="pt-2 flex flex-col gap-2.5">
                        <button onClick={() => setView('ACCEPTING')} className={`${btnClass} ${neonGreen}`}><CheckCircle size={16} /> Akceptuję Termin</button>
                        <button onClick={() => setView('COUNTERING')} className={`${btnClass} ${neonYellow}`}><Clock size={16} /> Zaproponuj Inny</button>
                        <button onClick={() => setView('DECLINING')} className={`${btnClass} ${neonRed}`}><X size={16} /> Odrzuć</button>
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
                    <h4 className="text-xl md:text-2xl font-black text-white tracking-tighter mb-1">Porozumienie Zawarte</h4>
                    <p className="text-emerald-500 font-black text-sm">{currentPropDate.getDate()} {currentPropDate.toLocaleDateString('pl-PL', { month: 'long' })} o {currentPropDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
                 </div>
                 
                 <p className="text-[10px] text-white/40 leading-relaxed px-4 pb-4">Spotkanie zostało oficjalnie wpisane do systemu. W przypadku braku możliwości dotarcia, poinformuj drugą stronę, aby uniknąć negatywnej noty w profilu.</p>

                 <div className="w-full flex flex-col gap-3">
                   <button onClick={() => setView('CANCELLING')} className={`${btnClass} ${neonRed}`}><CalendarX2 size={16} /> Nie pojawię się (Odwołaj)</button>
                   <div className="relative group w-full">
                     <button disabled={!isPast} onClick={() => setView('RATING')} className={`w-full py-3.5 md:py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 text-xs ${!isPast ? 'bg-[#111] text-white/20 border border-white/5 cursor-not-allowed' : neonGreen}`}>
                       <Star size={16} /> Potwierdź i Oceń
                     </button>
                     {!isPast && (
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 text-[9px] text-white/60 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                         Dostępne po terminie spotkania
                       </div>
                     )}
                   </div>
                 </div>
              </motion.div>
            )}

            {/* WIDOK: ODWOŁANIE POTWIERDZONEGO SPOTKANIA */}
            {view === 'CANCELLING' && (
              <motion.div key="cancelling" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full space-y-4">
                 <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center">
                    <AlertTriangle className="text-red-500 mx-auto mb-2" size={24} />
                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Uwaga: Zerwanie Porozumienia</h4>
                    <p className="text-[9px] text-red-500/70 leading-relaxed">Odwołanie potwierdzonego spotkania zostanie odnotowane w Twoich statystykach i może wpłynąć na ocenę rzetelności profilu.</p>
                 </div>
                 <textarea placeholder="Podaj ważny powód odwołania..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full flex-1 min-h-[100px] bg-[#111] border border-white/10 rounded-[1.5rem] p-4 text-xs text-white outline-none focus:border-red-500/50 resize-none transition-colors" />
                 <button onClick={() => handleAction('CANCELED')} disabled={isSubmitting || message.length < 5} className={`${btnClass} ${neonRed} disabled:opacity-30`}>
                   {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Potwierdzam Nieobecność'}
                 </button>
              </motion.div>
            )}

            {/* WIDOK: OCENIANIE PO SPOTKANIU */}
            {view === 'RATING' && (
              <motion.div key="rating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full space-y-5 text-center my-auto">
                 <h4 className="text-lg md:text-xl font-black text-white tracking-tighter">Oceń jakość współpracy</h4>
                 <p className="text-[10px] text-white/40 px-4">Twoja opinia buduje zaufanie w systemie EstateOS. Jak oceniasz punktualność i kontakt?</p>
                 
                 <div className="flex justify-center gap-2 py-4">
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="focus:outline-none transition-transform hover:scale-110">
                       <Star size={32} className={`transition-colors duration-200 ${(hoverRating || rating) >= star ? 'text-yellow-500 fill-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]' : 'text-white/10'}`} />
                     </button>
                   ))}
                 </div>

                 <textarea placeholder="Napisz krótki komentarz dla innych użytkowników..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full h-[80px] bg-[#111] border border-white/10 rounded-[1.5rem] p-4 text-xs text-white outline-none focus:border-emerald-500/50 resize-none transition-colors" />
                 <button onClick={() => handleAction('COMPLETED')} disabled={isSubmitting} className={`${btnClass} ${neonGreen}`}>
                   {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Zakończ i Zapisz Opinię'}
                 </button>
              </motion.div>
            )}

            {/* ODTWORZONE KOMPAKTOWE WIDOKI (ACCEPTING, COUNTERING, DECLINING z trybu IDLE) */}
            {view === 'ACCEPTING' && (
               <motion.div key="accept" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full justify-center text-center space-y-4 my-auto">
                  <CheckCircle className="text-emerald-500 w-16 h-16 md:w-20 md:h-20 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] rounded-full" />
                  <h4 className="text-lg md:text-xl font-black text-white tracking-tighter">Zatwierdzasz spotkanie?</h4>
                  <p className="text-white/40 text-[10px] md:text-xs leading-relaxed px-4 pb-4">Druga strona otrzyma natychmiastowe powiadomienie o akceptacji terminu w systemie.</p>
                  <button onClick={() => handleAction('ACCEPTED')} disabled={isSubmitting} className={`${btnClass} ${neonGreen}`}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Potwierdzam Wiążąco'}
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
                         <button key={i} onClick={() => { setNewDate(d); setTimeout(() => setCounterStep(2), 200); }} className={`w-full h-14 md:h-16 rounded-xl border flex flex-col items-center justify-center transition-all duration-300 ${isSelected ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 text-white/60 hover:border-white/20'}`}>
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
                         <button key={h} onClick={() => { setNewHour(h); setTimeout(() => setCounterStep(3), 200); }} className={`py-3 rounded-xl border text-xs font-black tracking-widest transition-all duration-300 ${isSelected ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.05] z-10' : 'bg-[#111] border-white/5 text-white/60 hover:border-white/20'}`}>
                           {h}
                         </button> 
                       )
                     })}
                   </div>
                )}
                {counterStep === 3 && (
                   <div className="space-y-4 h-full flex flex-col justify-center">
                      <div className="bg-[#111] p-3 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                         <div className="flex flex-col">
                            <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Nowy Termin</span>
                            <span className="text-yellow-500 font-black text-sm flex items-center gap-1.5"><CalendarIcon size={12}/> {newDate?.toLocaleDateString('pl-PL')} o {newHour}</span>
                         </div>
                         <button onClick={() => { setCounterStep(1); setNewDate(null); setNewHour(null); }} className="text-[8px] font-black uppercase text-white/30 hover:text-white border border-white/10 px-2 py-1 rounded-full">Zmień</button>
                      </div>
                      <textarea placeholder="Dlaczego proponujesz ten termin..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full h-[80px] md:h-[100px] bg-[#111] border border-white/10 rounded-[1.5rem] p-4 text-xs text-white outline-none focus:border-yellow-500/50 resize-none transition-colors" />
                      <button onClick={() => handleAction('COUNTER')} disabled={isSubmitting} className={`${btnClass} ${neonYellow}`}>
                        {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><Send size={16}/> Wyślij Propozycję</>}
                      </button>
                   </div>
                )}
              </motion.div>
            )}

            {view === 'DECLINING' && (
              <motion.div key="decline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full space-y-4 my-auto text-center">
                 <h4 className="text-lg md:text-xl font-black text-white tracking-tighter">Odrzucenie wizyty</h4>
                 <p className="text-white/40 text-[10px] leading-relaxed px-4">Napisz krótko, dlaczego odrzucasz tę prośbę. To pozwoli uniknąć nieporozumień i zaoszczędzi czas.</p>
                 <textarea placeholder="Np. Oferta jest już nieaktualna..." maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full flex-1 min-h-[100px] bg-[#111] border border-white/10 rounded-[1.5rem] p-4 text-xs text-white outline-none focus:border-red-500/50 resize-none transition-colors" />
                 <button onClick={() => handleAction('DECLINED')} disabled={isSubmitting} className={`${btnClass} ${neonRed}`}>
                   {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><X size={16}/> Definitywnie Odrzuć</>}
                 </button>
              </motion.div>
            )}

            {/* WIDOK ZAKOŃCZENIA / CANCELED POKAZYWANY PO ZAKOŃCZENIU */}
            {['COMPLETED_VIEW', 'CANCELED_VIEW', 'DECLINED_VIEW'].includes(view) && (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full justify-center items-center text-center space-y-4 my-auto">
                  {view === 'COMPLETED_VIEW' ? <CheckCircle size={50} className="text-emerald-500 mb-2" /> : <X size={50} className="text-red-500 mb-2" />}
                  <h4 className="text-xl font-black text-white tracking-tighter">
                    {view === 'COMPLETED_VIEW' ? 'Spotkanie Zakończone' : view === 'CANCELED_VIEW' ? 'Spotkanie Odwołane' : 'Odrzucono'}
                  </h4>
                  <p className="text-xs text-white/40">Status tej operacji został już zamknięty i zarchiwizowany w systemie.</p>
                  <button onClick={onClose} className="mt-4 px-6 py-3 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-colors">Zamknij</button>
               </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
