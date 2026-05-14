"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, Star, Key, ChevronRight, Loader2, Award, Briefcase, MapPin, CheckCircle2, X } from "lucide-react";

export default function ExpertsPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/eksperci').then(r => r.json()).then(data => setExperts(data));
    fetch('/api/user/profile').then(r => r.json()).then(data => {
      if (data && data.offers) setMyOffers(data.offers);
      setLoading(false);
    });
  }, []);

  const handleTransferRequest = async (offerId: number) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/concierge/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, agencyId: selectedExpert.id })
      });
      if (res.ok) setSuccess(true);
      else alert("Wystąpił błąd lub nie jesteś zalogowany.");
    } catch(e) {} finally { setSubmitting(false); }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] pb-40 pt-10 text-white md:pt-14">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-white/5 rounded-full blur-[150px] pointer-events-none"></div>
      
      <AnimatePresence>
        {selectedExpert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
            className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto bg-black/90 p-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))] backdrop-blur-md sm:pb-20 sm:pt-20"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              role="dialog"
              aria-modal="true"
              aria-label="Przekazanie oferty ekspertowi"
              className="relative w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-[#0a0a0a] p-8 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedExpert(null);
                  setSuccess(false);
                }}
                className="absolute right-6 top-6 rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Zamknij"
              >
                <X size={20} aria-hidden />
              </button>
              
              {success ? (
                <div className="py-10 text-center flex flex-col items-center">
                  <CheckCircle2 size={60} className="text-emerald-500 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-full" />
                  <h3 className="text-2xl font-black mb-2 text-yellow-500">Zapytanie Wysłane!</h3>
                  <p className="text-white/40 text-sm leading-relaxed">Twój ekspert właśnie analizuje ofertę. Wkrótce prześle Ci w panelu <b className="text-white">propozycję prowizji oraz zakres darmowych usług</b> (np. sesja zdjęciowa, home staging). Ty podejmujesz ostateczną decyzję.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><Key size={20}/></div>
                    <div><h3 className="text-xl font-black">Przekaż Ofertę</h3><p className="text-xs text-white/50">Wybrany ekspert: <span className="text-white font-bold">{selectedExpert.name}</span></p></div>
                  </div>
                  
                  {myOffers.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-white/10 rounded-2xl bg-white/5">
                      <p className="text-sm text-white/40 mb-4">Nie masz żadnych dodanych ofert do przekazania.</p>
                      <Link href="/dodaj-oferte" className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full inline-block">Dodaj Ofertę</Link>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="mb-6 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl shadow-inner">
                        <p className="text-xs text-white/60 leading-relaxed"><strong className="text-emerald-500 uppercase tracking-widest text-[10px] block mb-1">Usługa Premium Concierge</strong> Nie trać czasu na telefony i prezentacje. Wybierz ofertę, a agent prześle Ci swoje warunki (%). Gdy je zaakceptujesz, przejmie cały proces sprzedaży, a Ty zachowasz spokój.</p>
                      </div>
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">Wybierz nieruchomość do wyceny:</p>
                      {myOffers.map(o => (
                        <div key={o.id} className="flex justify-between items-center p-4 bg-[#111] border border-white/5 rounded-2xl hover:border-emerald-500/50 transition-colors group">
                          <div className="pr-4">
                            <h4 className="text-sm font-bold text-white truncate max-w-[200px]">{o.title}</h4>
                            <p className="text-[10px] text-white/40 flex items-center gap-1 mt-1"><MapPin size={10}/> {o.district}</p>
                          </div>
                          <button 
                            onClick={() => handleTransferRequest(o.id)} 
                            disabled={submitting} 
                            style={{
                              backgroundColor: submitting ? "rgba(16, 185, 129, 0.5)" : "#10b981",
                              color: "#000000",
                              boxShadow: submitting ? "none" : "0 0 20px rgba(16, 185, 129, 0.6)",
                              border: "1px solid #34d399",
                              opacity: 1,
                              visibility: "visible",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px"
                            }}
                            className="shrink-0 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                          >
                            {submitting ? <><Loader2 size={14} className="animate-spin"/> Przetwarzanie...</> : 'Zapytaj o warunki'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="eos-page-x">
        <Link href="/moje-konto" className="text-white/40 hover:text-white mb-8 inline-block text-[10px] uppercase tracking-widest font-bold transition-colors">← Wróć do panelu</Link>
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <Key size={14} /> Usługa Concierge
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">Oddaj klucze. <br/><span className="text-white/40">My zrobimy resztę.</span></h1>
          <p className="text-lg text-white/50 leading-relaxed">Wybierz licencjonowanego partnera EstateOS. Twój osobisty ekspert przygotuje ofertę, obsłuży Radar, przeprowadzi prezentacje i wynegocjuje najwyższą cenę.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-live="polite">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500/70" aria-hidden />
            <span className="text-sm font-medium text-white/45">Ładowanie ekspertów…</span>
          </div>
        ) : experts.length === 0 ? (
          <div
            role="status"
            className="mx-auto max-w-lg rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-8 py-14 text-center"
          >
            <p className="text-base font-semibold text-white/80">Brak partnerów w widoku</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">Spróbuj ponownie później lub skontaktuj się z pomocą EstateOS™.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {experts.map((exp, idx) => (
              <motion.div key={exp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 hover:border-white/30 transition-all group shadow-2xl relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[100%] pointer-events-none transition-colors group-hover:bg-white/10"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="w-16 h-16 bg-[#111] border border-white/10 rounded-full flex items-center justify-center text-xl font-black text-white shadow-inner">{exp.name[0]}</div>
                  <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full"><Star size={12} className="text-yellow-500 fill-yellow-500" /><span className="text-xs font-black text-yellow-500">{exp.rating}</span></div>
                </div>
                <div className="relative z-10 flex-1">
                  <Link href={`/ekspert/${exp.id}`} className="text-2xl font-black mb-1 group-hover:text-orange-500 transition-colors block">{exp.name}</Link>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-6"><ShieldCheck size={14} /> Zweryfikowany Partner</div>
                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3"><span className="text-white/40">Udane transakcje</span><span className="font-bold text-white flex items-center gap-2"><Award size={14} className="text-white/40"/> {exp.transactions}+</span></div>
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3"><span className="text-white/40">Opinie klientów</span><span className="font-bold text-white">{exp.reviewsCount}</span></div>
                  </div>
                </div>
                
                {/* TWARDO ZAKODOWANY ZŁOTY PRZYCISK (INLINE STYLES) */}
                <motion.button 
                  onClick={() => setSelectedExpert(exp)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: "linear-gradient(90deg, #eab308 0%, #facc15 100%)",
                    color: "#000000",
                    boxShadow: "0px 0px 30px rgba(234, 179, 8, 0.4)",
                    border: "1px solid rgba(250, 204, 21, 0.5)",
                  }}
                  className="w-full mt-6 py-4 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-xl flex items-center justify-center relative overflow-hidden z-10"
                >
                  <motion.div
                    className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-12"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  />
                  <span className="relative z-10 flex items-center">
                    ZLEĆ SPRZEDAŻ <ChevronRight size={14} className="ml-1" />
                  </span>
                </motion.button>
                
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
