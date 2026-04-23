"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Globe, TrendingUp, Newspaper, UserPlus, HandCoins, CheckCircle2, Zap, Activity, LineChart, ChevronLeft, ChevronRight, PenTool, X, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

// --- DANE ---
const allNews = [
  { id: 1, type: 'PL', title: 'Warszawa: Popyt na apartamenty luksusowe wzrósł o 24% r/r.', source: 'Bankier' },
  { id: 2, type: 'WORLD', title: 'Nowy Jork: Najdroższa transakcja roku sfinalizowana na Manhattanie.', source: 'Bloomberg' },
  { id: 3, type: 'TREND', title: 'Off-Market: Inwestorzy szukają okazji poza oficjalnym rynkiem.', source: 'EstateOS Intel' },
  { id: 4, type: 'PL', title: 'Kraków: Deficyt działek budowlanych winduje ceny domów premium.', source: 'Rzeczpospolita' },
  { id: 5, type: 'WORLD', title: 'Dubaj: Rejestr transakcji bije kolejne rekordy w Q1 2026.', source: 'Reuters' },
];

const mockEvents = [
  { id: 1, icon: UserPlus, color: 'text-emerald-400', text: 'ZAREJESTROWANO: Nowy Inwestor PRO (Warszawa)' },
  { id: 2, icon: HandCoins, color: 'text-yellow-400', text: 'LICYTACJA: Oferta #84 otrzymała propozycję 1.150.000 PLN' },
  { id: 3, icon: CheckCircle2, color: 'text-blue-400', text: 'SUKCES: Zaakceptowano termin prezentacji dla Oferty #102' },
  { id: 4, icon: Zap, color: 'text-purple-400', text: 'SYSTEM: Zaktualizowano parametry Radar Inwestorski' },
];

// --- EFEKT TABLICY DWORCOWEJ (SCRAMBLE TEXT) ---
const ScrambleText = ({ text }: { text: string }) => {
  const [display, setDisplay] = useState(text);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
  
  useEffect(() => {
    let iteration = 0;
    const max = text.length;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((char, index) => {
        if (char === ' ') return ' ';
        if (index < iteration) return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      
      if (iteration >= max) clearInterval(interval);
      iteration += 1/2; // Prędkość dekodowania
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{display}</span>;
};

// --- STONOWANY, PLATYNOWY CHRONOMETR Z GŁĘBIĄ ---
export const AppleClock = ({ isBooting = false }: { isBooting?: boolean }) => {
  const hr = useRef<any>(null), mr = useRef<any>(null), sr = useRef<any>(null);
  const today = new Date();
  
  useEffect(() => {
    let fId: number;
    const upd = () => {
      const n = new Date();
      let h = n.getHours(), m = n.getMinutes(), s = n.getSeconds(), ms = n.getMilliseconds();
      let smoothS = s + ms/1000;
      let smoothM = m + smoothS/60;
      let smoothH = (h % 12) + smoothM/60;
      if(hr.current) hr.current.style.transform = `rotate(${smoothH * 30}deg)`;
      if(mr.current) mr.current.style.transform = `rotate(${smoothM * 6}deg)`;
      if(sr.current) sr.current.style.transform = `rotate(${smoothS * 6}deg)`;
      fId = requestAnimationFrame(upd);
    };
    upd(); return () => cancelAnimationFrame(fId);
  }, []);

  return (
    <motion.div 
      layoutId="luxury-clock" 
      transition={{ layout: { type: "spring", stiffness: 35, damping: 14, mass: 1.2 } }}
      className={`relative flex items-center justify-center shrink-0 rounded-full bg-gradient-to-br from-[#2a2a2a] via-[#111] to-[#050505] p-[2px] shadow-[0_40px_80px_rgba(0,0,0,1),inset_0_2px_10px_rgba(255,255,255,0.05)] ${isBooting ? 'w-56 h-56 md:w-72 md:h-72' : 'w-32 h-32 md:w-44 md:h-44'}`}
    >
      <div className="absolute inset-0 rounded-full bg-[#1a1a1a] blur-[1px] opacity-50"></div>
      
      {/* Tarcza (Grafit z głębokim cieniowaniem) */}
      <div className="absolute inset-1 md:inset-1.5 rounded-full border border-black/80 bg-[#0f0f11] shadow-[inset_0_10px_40px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden">
        {/* Subtelny szlif */}
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,_transparent,_rgba(255,255,255,0.02),_transparent)] opacity-60"></div>
        
        {/* Indeksy godzinowe (Matowe srebro z platyną) */}
        {[...Array(12)].map((_, i) => (
          <div key={i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${i * 30}deg)` }}>
            <div className="w-[3px] md:w-[4px] h-[10px] md:h-[16px] mt-1.5 md:mt-2 bg-gradient-to-b from-[#888] to-[#444] rounded-[1px] shadow-[0_3px_6px_rgba(0,0,0,0.9)] border border-white/10 flex justify-center">
               <div className="w-[1px] md:w-[1.5px] h-[6px] md:h-[10px] mt-[1px] bg-[#d4ebd0] rounded-full blur-[0.5px] opacity-70"></div>
            </div>
          </div>
        ))}

        {[...Array(60)].map((_, i) => i % 5 !== 0 && (
          <div key={i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${i * 6}deg)` }}>
             <div className="w-[1px] md:w-[1.5px] h-[3px] md:h-[4px] mt-2 bg-white/10 rounded-full"></div>
          </div>
        ))}

        {/* Napisy */}
        <div className="absolute top-[25%] left-0 right-0 text-center z-0">
           <p className="text-[5px] md:text-[6px] font-black uppercase tracking-[0.4em] text-white/30 drop-shadow-md">EstateOS</p>
           <p className="text-[3.5px] md:text-[4px] text-emerald-500/50 uppercase tracking-[0.3em] font-medium mt-1">Automatic</p>
        </div>

        {/* Okienko Daty z głębią */}
        <div className="absolute right-[10%] top-1/2 -translate-y-1/2 w-6 h-4 md:w-8 md:h-5 bg-[#1a1a1a] rounded-[2px] border-t border-black border-b border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.8)] flex items-center justify-center z-0">
           <span className="text-[7px] md:text-[9px] font-black text-white/90 tabular-nums">{today.getDate()}</span>
        </div>

        {/* WSKAZÓWKI (Ciemny Metal) */}
        <div ref={hr} className="absolute inset-0 flex justify-center items-center z-10">
          <div className="w-[4px] md:w-[5px] h-[35px] md:h-[45px] origin-bottom -translate-y-1/2 bg-gradient-to-r from-[#666] to-[#333] rounded-full shadow-[0_8px_15px_rgba(0,0,0,1)] flex">
             <div className="w-1/2 h-full bg-white/10 rounded-l-full"></div>
          </div>
        </div>
        <div ref={mr} className="absolute inset-0 flex justify-center items-center z-10">
          <div className="w-[2.5px] md:w-[3px] h-[45px] md:h-[65px] origin-bottom -translate-y-1/2 bg-gradient-to-r from-[#888] to-[#444] rounded-full shadow-[0_8px_15px_rgba(0,0,0,1)] flex">
             <div className="w-1/2 h-full bg-white/20 rounded-l-full"></div>
          </div>
        </div>
        <div ref={sr} className="absolute inset-0 flex justify-center items-center z-20">
          <div className="relative w-[1px] md:w-[1.5px] h-[55px] md:h-[80px] origin-bottom -translate-y-1/2 bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-600 border border-black/80 shadow-lg"></div>
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#050505] border-2 border-[#444] z-30 shadow-2xl"></div>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-40"></div>
      </div>
    </motion.div>
  );
};

// --- GŁÓWNY WIDGET PRO ---
export default function ProWidget({ currentUser, isBooting = false }: { currentUser: any, isBooting?: boolean }) {
  const [avgPrice, setAvgPrice] = useState<number | null>(null);
  const [newsIndex, setNewsIndex] = useState(0);
  
  // Kalendarz State
  const [monthOffset, setMonthOffset] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // --- LOGIKA BIOMETRII I PAYWALLA ---
  const [showProModal, setShowProModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);

  useEffect(() => {
    const checkPasskey = async () => {
      try {
        const res = await fetch('/api/passkeys/check');
        if (res.ok) {
          const data = await res.json();
          setHasPasskey(data.hasPasskey);
        }
      } catch (e) {
        console.error("Błąd sprawdzania kluczy");
      } finally {
        setIsCheckingPasskey(false);
      }
    };
    checkPasskey();
  }, []);

  const handleRegisterPasskey = async () => {
    const isPro = currentUser?.isPro || currentUser?.planType === 'INVESTOR' || currentUser?.planType === 'AGENCY' || currentUser?.planType === 'pakiet_plus';
    if (!isPro) {
      setShowProModal(true);
      return;
    }
    
    setIsRegistering(true);
    try {
      const resp = await fetch('/api/passkeys/register-options');
      const options = await resp.json();
      if (options.error) throw new Error(options.error);
      
      const attResp = await startRegistration(options);
      
      const verifyResp = await fetch('/api/passkeys/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });
      
      const verifyResult = await verifyResp.json();
      if (verifyResult.success) {
      setHasPasskey(true);
    }
    } catch (error) {
      console.error("Błąd autoryzacji:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async () => {
    setIsRegistering(true);
    try {
      const res = await fetch('/api/passkeys/delete', { method: 'DELETE' });
      if (res.ok) setHasPasskey(false);
    } catch (e) {
      console.error("Błąd usuwania klucza");
    } finally {
      setIsRegistering(false);
    }
  };


  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + monthOffset);
  const currentMonth = displayDate.getMonth();
  const currentYear = displayDate.getFullYear();
  
  const today = new Date();
  const isCurrentMonthView = monthOffset === 0;

  const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = i - firstDay + 1;
    return (d > 0 && d <= daysInMonth) ? d : null;
  });
  const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  // Rotacja Newsów (Tablica dworcowa)
  useEffect(() => {
    const t = setInterval(() => setNewsIndex(prev => (prev + 1) % allNews.length), 8000);
    return () => clearInterval(t);
  }, []);

  // Pobieranie notatek i statystyk
  useEffect(() => {
    fetch('/api/stats/market').then(res => res.json()).then(data => { if (data.avgPricePerSqm) setAvgPrice(data.avgPricePerSqm); }).catch(()=>{});
  }, []);

  useEffect(() => {
    const fetchNotes = async () => {
       const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
       try {
         const res = await fetch(`/api/user/notes?month=${monthStr}`);
         if(res.ok) setNotes(await res.json());
       } catch(e) {}
    };
    fetchNotes();
  }, [currentMonth, currentYear]);

  const handleSaveNote = async () => {
    if(!selectedDate) return;
    try {
      const res = await fetch('/api/user/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, text: noteText })
      });
      if(res.ok) {
        const data = await res.json();
        setNotes(prev => {
          const filtered = prev.filter(n => n.date !== selectedDate);
          if (data.deleted) return filtered;
          return [...filtered, data.note];
        });
        setSelectedDate(null);
      }
    } catch(e) { alert("Błąd zapisu notatki"); }
  };

  const openNoteModal = (day: number) => {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = notes.find(n => n.date === dStr);
    setNoteText(existing ? existing.text : "");
    setSelectedDate(dStr);
  };

  return (
    <div className="bg-[#050505] border border-white/5 rounded-[2.5rem] relative overflow-hidden backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] mb-12">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
      
      <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* KOLUMNA 1: ZEGAR + STATYSTYKI Z WYKRESEM */}
        <div className="flex flex-col gap-4">
           <div className="bg-[#0a0a0a] border border-[#222] rounded-3xl p-6 shadow-[inset_0_5px_20px_rgba(0,0,0,1)] flex flex-col sm:flex-row lg:flex-col items-center gap-6 justify-center flex-1">
              {!isBooting && <AppleClock />}
              <div className="text-center sm:text-left lg:text-center">
                 <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">{today.toLocaleDateString('pl-PL', { weekday: 'long' })}</p>
                 <h1 className="text-4xl md:text-5xl font-black text-white/90 tracking-tighter tabular-nums leading-none drop-shadow-2xl">{today.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</h1>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,1)] flex flex-col justify-between h-[80px]">
                 <div className="flex justify-between items-start">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center"><Activity size={12} className="text-emerald-500" /></div>
                    <span className="text-white/80 font-black text-xs md:text-sm drop-shadow-md">Wysoki</span>
                 </div>
                 <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/30">Popyt Inwestycyjny</span>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,1)] flex flex-col justify-between h-[80px] relative overflow-hidden group">
                 <div className="absolute bottom-0 left-0 right-0 h-12 opacity-30 group-hover:opacity-60 transition-opacity duration-500">
                    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
                       <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
                       <path d="M0,30 L0,20 Q10,25 20,15 T40,20 T60,10 T80,15 T100,5 L100,30 Z" fill="url(#chartGrad)" />
                       <path d="M0,20 Q10,25 20,15 T40,20 T60,10 T80,15 T100,5" fill="none" stroke="#10b981" strokeWidth="1.5" />
                    </svg>
                 </div>
                 <div className="flex justify-between items-start relative z-10">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><LineChart size={12} className="text-emerald-500" /></div>
                    <span className="text-emerald-400 font-black text-[11px] md:text-xs tracking-tight tabular-nums drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{avgPrice ? `${avgPrice.toLocaleString('pl-PL')} zł/m²` : '...'}</span>
                 </div>
                 <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/30 relative z-10">Średnia Rynkowa</span>
              </div>
           </div>

           {/* --- MODUŁ BIOMETRYCZNY (Luksusowy Paywall) --- */}
           
      <div 
        className={`mt-1 w-full rounded-[22px] p-4 transition-all duration-700 ease-out flex items-center justify-between overflow-hidden relative backdrop-blur-2xl ${
          hasPasskey 
            ? "bg-[#111112]/90 border border-emerald-500/20 shadow-[inset_0_2px_20px_rgba(0,0,0,1)]" 
            : "bg-[#1c1c1e]/80 border border-white/10 shadow-lg"
        }`}
      >
        {/* Tło oddychające gdy włączone */}
        {hasPasskey && (
          <div className="absolute inset-0 bg-emerald-500/5 animate-[pulse_4s_ease-in-out_infinite] pointer-events-none"></div>
        )}

        <div className="flex items-center gap-4 z-10">
          <div className={`relative flex items-center justify-center w-[46px] h-[46px] rounded-full transition-all duration-700 ${
            hasPasskey 
              ? "bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-[pulse_3s_ease-in-out_infinite]" 
              : "bg-white/5"
          }`}>
            {/* Animacja pulsującego ringu (życie) */}
            {hasPasskey && (
               <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
            )}
            
            <svg className={`w-[22px] h-[22px] transition-all duration-700 ${hasPasskey ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)] scale-110' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </div>
          
          <div className="text-left z-10">
            <h3 className={`text-[16px] font-semibold tracking-wide transition-colors duration-500 ${hasPasskey ? 'text-white' : 'text-neutral-200'}`}>
              Face ID / Touch ID
            </h3>
            <p className={`text-[13px] mt-0.5 tracking-wide transition-colors duration-500 ${hasPasskey ? 'text-emerald-400/90 font-medium' : 'text-neutral-500'}`}>
              {hasPasskey ? "Aktywne dla tego urządzenia" : "Skonfiguruj logowanie"}
            </p>
          </div>
        </div>

        {/* Natywny przełącznik (Toggle) Apple */}
        <button
          onClick={hasPasskey ? handleDeletePasskey : handleRegisterPasskey}
          disabled={isRegistering || isCheckingPasskey}
          className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none z-10 ${
            hasPasskey ? 'bg-[#34C759] shadow-[0_0_12px_rgba(52,199,89,0.5)]' : 'bg-[#39393D]'
          } ${(isRegistering || isCheckingPasskey) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none relative inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] ring-0 transition-transform duration-300 ease-in-out ${
              hasPasskey ? 'translate-x-[20px]' : 'translate-x-0'
            }`}
          >
            {(isRegistering || isCheckingPasskey) && (
              <svg className="animate-spin absolute inset-0 m-auto h-3 w-3 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            )}
          </span>
        </button>
      </div>

        </div>

        {/* KOLUMNA 2: GŁĘBOKI KALENDARZ Z NOTATKAMI */}
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-3xl p-6 shadow-[inset_0_10px_30px_rgba(0,0,0,1),0_10px_20px_rgba(0,0,0,0.5)] relative flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setMonthOffset(p => p - 1)} className="p-1.5 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
                <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-white/70">{months[currentMonth]} {currentYear}</h3>
                <button onClick={() => setMonthOffset(p => p + 1)} className="p-1.5 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors"><ChevronRight size={16}/></button>
            </div>
            <div className="grid grid-cols-7 gap-x-1 gap-y-2 text-center flex-1 content-start">
                {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map((d, i) => (
                   <div key={d} className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${i >= 5 ? 'text-red-500/80 drop-shadow-[0_0_5px_rgba(239,68,68,0.4)]' : 'text-white/20'} mb-3`}>{d}</div>
                ))}
                {days.map((day, i) => {
                    const isWeekend = i % 7 === 5 || i % 7 === 6;
                    const isToday = isCurrentMonthView && day === today.getDate();
                    const dStr = day ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const hasNote = dStr && notes.some(n => n.date === dStr);

                    return (
                        <div key={i} onClick={() => day && openNoteModal(day)} className={`h-8 md:h-10 flex flex-col items-center justify-center text-[11px] md:text-xs font-black rounded-xl transition-all duration-300 relative
                            ${isToday ? 'bg-gradient-to-br from-[#333] to-[#111] border border-white/20 text-white shadow-[0_5px_15px_rgba(0,0,0,0.8)] z-10' : 
                              isWeekend ? 'text-red-500/60' : 'text-white/50'}
                            ${!day ? 'opacity-0' : 'hover:bg-white/5 cursor-pointer shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)] border border-transparent hover:border-white/5'}
                        `}>
                            {day}
                            {hasNote && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* KOLUMNA 3: PULS RYNKU (TABLICA DWORCOWA) */}
        <div className="bg-[#080808] border border-[#1a1a1a] rounded-3xl p-6 shadow-[inset_0_5px_20px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col">
           <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                 <Newspaper className="text-white/30" size={16}/>
                 <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-white/50">Puls Rynku</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-black/50 border border-emerald-500/20 rounded-full shadow-inner">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[7px] font-black uppercase tracking-widest text-emerald-500/70">Terminal</span>
              </div>
           </div>
           <div className="space-y-5 relative z-10 flex-1 overflow-hidden">
              <div className="flex gap-4 items-start pb-4">
                 <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-black border border-[#222] shadow-[inset_0_2px_5px_rgba(0,0,0,1)] flex items-center justify-center shrink-0">
                    {allNews[newsIndex].type==='PL' ? <TrendingUp size={14} className="text-emerald-500/80"/> : <Globe size={14} className="text-blue-500/80"/>}
                 </div>
                 <div className="flex-1 min-w-0 font-mono">
                    <p className="text-[10px] md:text-[11px] font-bold text-emerald-400/90 leading-relaxed min-h-[40px] drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                       <ScrambleText text={allNews[newsIndex].title} />
                    </p>
                    <p className="text-[8px] md:text-[9px] text-white/20 mt-2 uppercase font-black tracking-widest">
                       {allNews[newsIndex].source}
                    </p>
                 </div>
              </div>
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              <p className="text-[8px] text-white/20 uppercase tracking-[0.2em] text-center mt-4">Połączenie z serwerem szyfrowane</p>
           </div>
        </div>

      </div>

      {/* PASEK AKTYWNOŚCI NA DOLE (TICKER) */}
      <div className="w-full h-12 md:h-14 border-t border-[#1a1a1a] bg-black/80 shadow-[inset_0_5px_15px_rgba(0,0,0,1)] overflow-hidden relative flex items-center rounded-b-[2.5rem]">
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
          
          <motion.div className="flex items-center gap-12 md:gap-16 whitespace-nowrap pl-12 md:pl-16" animate={{ x: '-33.33%' }} transition={{ duration: 45, ease: "linear", repeat: Infinity }}>
              {[...mockEvents, ...mockEvents, ...mockEvents].map((e, i) => (
                  <div key={i} className="flex items-center gap-3 shrink-0">
                     <e.icon size={14} className={e.color}/>
                     <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white/40">{e.text}</span>
                     <div className="w-1.5 h-1.5 rounded-full bg-white/5 ml-8 md:ml-12"></div>
                  </div>
              ))}
          </motion.div>
      </div>

      {/* POPUP NOTATKI */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
             <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-[#222] p-6 md:p-8 rounded-[2rem] w-full max-w-md shadow-[0_50px_100px_rgba(0,0,0,1),inset_0_2px_10px_rgba(255,255,255,0.02)]">
                <div className="flex justify-between items-center mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><PenTool size={16} className="text-white/50"/></div>
                      <div>
                         <h3 className="text-white font-black text-sm uppercase tracking-widest">Twoja Notatka</h3>
                         <p className="text-emerald-500 text-[10px] font-bold tracking-widest">{selectedDate}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedDate(null)} className="p-2 bg-black hover:bg-white/10 rounded-full text-white/50 transition-colors border border-white/5"><X size={16}/></button>
                </div>
                <textarea 
                   autoFocus
                   value={noteText}
                   onChange={e => setNoteText(e.target.value)}
                   placeholder="Wpisz tajne informacje dla tego dnia (np. negocjacje, spotkanie z klientem)..."
                   className="w-full h-32 bg-black border border-[#222] rounded-xl p-4 text-xs text-white/80 font-medium placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none shadow-inner custom-scrollbar"
                />
                <button onClick={handleSaveNote} className="w-full mt-6 py-4 rounded-xl bg-gradient-to-b from-[#222] to-[#111] hover:from-[#333] hover:to-[#222] border border-[#333] text-[10px] font-black uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all flex items-center justify-center gap-2">
                   Zapisz w chmurze
                </button>
             </motion.div>
          </motion.div>
        )}
      {showProModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
             <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-emerald-500/30 p-8 md:p-10 rounded-[2rem] w-full max-w-lg shadow-[0_0_100px_rgba(16,185,129,0.1),inset_0_2px_20px_rgba(255,255,255,0.02)] text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600"></div>
                <button onClick={() => setShowProModal(false)} className="absolute top-6 right-6 p-2 bg-black hover:bg-white/10 rounded-full text-white/50 transition-colors border border-white/5"><X size={16}/></button>

                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                   <Fingerprint size={32} className="text-emerald-400"/>
                </div>
                
                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Logowanie Biometryczne</h3>
                <p className="text-sm text-white/50 leading-relaxed mb-8">Ta funkcja jest zarezerwowana dla pakietów <span className="text-emerald-500 font-bold">PRO</span>. Odblokuj pełen potencjał EstateOS i loguj się za pomocą skanu twarzy lub odcisku palca, bez wpisywania haseł i kodów SMS.</p>
                
                <button onClick={() => window.location.href='/moje-konto/crm'} className="w-full py-5 rounded-full font-black text-sm hover:scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex justify-center items-center uppercase tracking-widest bg-emerald-500 text-black">
                   Rozbuduj pakiet do PRO
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
