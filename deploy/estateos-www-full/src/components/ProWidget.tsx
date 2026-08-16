"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, TrendingUp, Newspaper, UserPlus, HandCoins, CheckCircle2, Zap, Activity, LineChart, ChevronLeft, ChevronRight, PenTool, X, type LucideIcon } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  demandLabelForLevel,
  type PulseEvent,
  type PulseEventIcon,
  type PulseHeadline,
} from "@/types/marketPulse";
import OtodomImportProCard from "@/components/otodom/OtodomImportProCard";
import OpenHouseProCard from "@/components/openHouse/OpenHouseProCard";
import AuctionProCard from "@/components/crm/AuctionProCard";
import PulseUpcomingSchedule from "@/components/PulseUpcomingSchedule";
import { buildInvestorProBarPalette, buildInvestorProPeriodStatus } from "@/lib/investorProMembership";
import { isPlusCreditActive } from "@/lib/offerListingLimits";
import { fmtDict } from "@/i18n/crmExtendedDictionary";

type ProOfferRow = { id: number; title: string; city?: string; district?: string };

const FALLBACK_HEADLINES_PL: PulseHeadline[] = [
  {
    id: "fallback-1",
    type: "INTEL",
    title: "Synchronizacja z serwerem — oczekiwanie na dane rynku…",
    source: "EstateOS Terminal",
  },
];

const EVENT_ICONS: Record<PulseEventIcon, LucideIcon> = {
  UserPlus,
  HandCoins,
  CheckCircle2,
  Zap,
  TrendingUp,
};

const PULSE_POLL_MS = 60_000;

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
          <div className="relative w-[1px] md:w-[1.5px] h-[55px] md:h-[80px] origin-bottom -translate-y-1/2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-600 border border-black/80 shadow-[0_0_10px_rgba(239,68,68,0.45)]"></div>
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#050505] border-2 border-[#444] z-30 shadow-2xl"></div>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-40"></div>
      </div>
    </motion.div>
  );
};

// --- GŁÓWNY WIDGET PRO ---
export default function ProWidget({
  currentUser,
  isBooting = false,
  activeOffers = [],
  onProToolsChanged,
}: {
  currentUser: any;
  isBooting?: boolean;
  activeOffers?: ProOfferRow[];
  onProToolsChanged?: () => void;
}) {
  const { locale, dict } = useLocale();
  const pw = dict.crm.proWidget;
  const ps = dict.crm.proStatus;
  const dateTag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  const [avgPrice, setAvgPrice] = useState<number | null>(null);
  const [demandLabel, setDemandLabel] = useState<string>("—");
  const [headlines, setHeadlines] = useState<PulseHeadline[]>(FALLBACK_HEADLINES_PL);
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [pulseLive, setPulseLive] = useState(false);
  const [newsIndex, setNewsIndex] = useState(0);
  
  // Kalendarz State
  const [monthOffset, setMonthOffset] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + monthOffset);
  const currentMonth = displayDate.getMonth();
  const currentYear = displayDate.getFullYear();
  
  const today = new Date();
  const isCurrentMonthView = monthOffset === 0;
  const membershipPeriod =
    currentUser?.isPro && currentUser?.proExpiresAt
      ? buildInvestorProPeriodStatus(currentUser.proExpiresAt)
      : null;
  const membershipPalette = membershipPeriod
    ? buildInvestorProBarPalette(membershipPeriod.progressRemaining)
    : null;
  const membershipExpiry = membershipPeriod
    ? new Date(membershipPeriod.expiresAtMs).toLocaleDateString(dateTag)
    : null;
  const membershipCredits = isPlusCreditActive(currentUser)
    ? Number(currentUser?.extraListings ?? 0)
    : null;

  const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = i - firstDay + 1;
    return (d > 0 && d <= daysInMonth) ? d : null;
  });
  const months = pw.months;

  const fetchPulse = useCallback(async () => {
    try {
      const res = await fetch(`/api/pro-widget/pulse?locale=${locale}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;
      if (typeof data.metrics?.avgPricePerSqm === "number") {
        setAvgPrice(data.metrics.avgPricePerSqm);
      }
      if (data.metrics?.demandLevel) {
        setDemandLabel(demandLabelForLevel(data.metrics.demandLevel, locale));
      }
      if (Array.isArray(data.headlines) && data.headlines.length > 0) {
        setHeadlines(data.headlines);
        setNewsIndex(0);
      }
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
      }
      setPulseLive(true);
    } catch {
      setPulseLive(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchPulse();
    const poll = setInterval(fetchPulse, PULSE_POLL_MS);
    return () => clearInterval(poll);
  }, [fetchPulse]);

  useEffect(() => {
    if (headlines.length < 2) return;
    const t = setInterval(() => setNewsIndex((prev) => (prev + 1) % headlines.length), 8000);
    return () => clearInterval(t);
  }, [headlines.length]);

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
    } catch(e) { alert(pw.noteSaveError); }
  };

  const openNoteModal = (day: number) => {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = notes.find(n => n.date === dStr);
    setNoteText(existing ? existing.text : "");
    setSelectedDate(dStr);
  };

  return (
    <div className="mb-12">
      <header className="eos-pro-system-title mb-5 px-1 md:mb-6">
        <p className="eos-pro-system-title-brand">
          <span className="text-emerald-500">E</span>state<span className="text-emerald-500">OS</span>
          <sup className="eos-pro-system-title-tm">™</sup>
        </p>
        <p className="eos-pro-system-title-suffix">{pw.systemTitleSuffix}</p>
      </header>

    <div className="eos-pro-widget eos-pro-shell relative overflow-hidden rounded-[2.5rem] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent"></div>
      
      <div className="relative z-10 flex flex-col gap-6 p-6 md:p-8">
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        
        {/* KOLUMNA 1: ZEGAR + STATYSTYKI */}
        <div className="flex flex-col gap-4">
           <div className="eos-pro-panel eos-pro-panel-inset flex flex-col items-center justify-center gap-6 rounded-3xl p-6 sm:flex-row lg:flex-col lg:flex-1">
              {!isBooting && <AppleClock />}
              <div className="text-center sm:text-left lg:text-center">
                 <p className="eos-pro-subtle mb-1 text-[10px] font-black uppercase tracking-[0.4em] md:text-[11px]">{today.toLocaleDateString(dateTag, { weekday: 'long' })}</p>
                 <h1 className="text-4xl font-black tabular-nums leading-none tracking-tighter text-[var(--eos-text)] drop-shadow-sm md:text-5xl">{today.toLocaleTimeString(dateTag, { hour: '2-digit', minute: '2-digit' })}</h1>
              </div>
           </div>
           {membershipPeriod && membershipPalette ? (
             <div className="eos-pro-panel eos-pro-panel-inset rounded-2xl p-4">
               <div className="flex items-start justify-between gap-3">
                 <div className="min-w-0">
                   <p
                     className="text-[8px] font-black uppercase tracking-[0.22em]"
                     style={{ color: membershipPalette.tone }}
                   >
                     {ps.eyebrow}
                   </p>
                   <p className="mt-1 truncate text-[11px] font-bold text-[var(--eos-text)]">
                     {fmtDict(ps.compactUntil, { date: membershipExpiry || "—" })}
                   </p>
                 </div>
                 {membershipCredits !== null ? (
                   <div className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-center">
                     <p className="text-[7px] font-black uppercase tracking-[0.12em] text-emerald-500">
                       {ps.creditsShort}
                     </p>
                     <p className="text-xs font-black tabular-nums text-emerald-500">{membershipCredits}</p>
                   </div>
                 ) : null}
               </div>
               <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]">
                 <div
                   className="h-full rounded-full transition-all duration-700 ease-out"
                   style={{
                     width: `${Math.max(
                       membershipPeriod.progressRemaining * 100,
                       membershipPeriod.daysLeft > 0 ? 3 : 0,
                     )}%`,
                     background: `linear-gradient(90deg, ${membershipPalette.toneSoft}, ${membershipPalette.tone})`,
                     boxShadow: `0 0 14px ${membershipPalette.glow}`,
                   }}
                 />
               </div>
               <p className="eos-pro-subtle mt-1.5 text-[8px]">
                 {fmtDict(ps.barCaption, {
                   n: membershipPeriod.daysLeft,
                   total: membershipPeriod.periodDays,
                 })}
               </p>
             </div>
           ) : null}
           <div className="grid grid-cols-2 gap-4">
              <div className="eos-pro-panel eos-pro-panel-inset flex h-[80px] flex-col justify-between rounded-2xl p-4">
                 <div className="flex items-start justify-between">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10"><Activity size={12} className="text-emerald-500" /></div>
                    <span className="text-xs font-black tabular-nums text-[var(--eos-text)] drop-shadow-sm md:text-sm">{demandLabel}</span>
                 </div>
                 <span className="eos-pro-subtle text-[8px] font-black uppercase tracking-widest md:text-[9px]">
                   {pw.investmentDemand}
                 </span>
              </div>
              <div className="eos-pro-panel eos-pro-panel-inset group relative flex h-[80px] flex-col justify-between overflow-hidden rounded-2xl p-4">
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
                 <span className="eos-pro-subtle relative z-10 text-[8px] font-black uppercase tracking-widest md:text-[9px]">
                   {pw.marketAverage}
                 </span>
              </div>
           </div>
        </div>

        {/* KOLUMNA 2: KALENDARZ */}
        <div className="eos-pro-panel eos-pro-panel-inset relative flex flex-col rounded-3xl p-6 lg:flex-1">
            <div className="mb-6 flex items-center justify-between">
                <button onClick={() => setMonthOffset(p => p - 1)} className="eos-pro-subtle rounded-full p-1.5 transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"><ChevronLeft size={16}/></button>
                <h3 className="eos-pro-muted text-[10px] font-black uppercase tracking-[0.3em] md:text-[11px]">{months[currentMonth]} {currentYear}</h3>
                <button onClick={() => setMonthOffset(p => p + 1)} className="eos-pro-subtle rounded-full p-1.5 transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"><ChevronRight size={16}/></button>
            </div>
            <div className="grid flex-1 grid-cols-7 content-start gap-x-1 gap-y-2 text-center">
                {pw.weekdays.map((d, i) => (
                   <div key={d} className={`mb-3 text-[8px] font-black uppercase tracking-widest md:text-[9px] ${i >= 5 ? 'text-red-500/80' : 'eos-pro-subtle'}`}>{d}</div>
                ))}
                {days.map((day, i) => {
                    const isWeekend = i % 7 === 5 || i % 7 === 6;
                    const isToday = isCurrentMonthView && day === today.getDate();
                    const dStr = day ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const hasNote = dStr && notes.some(n => n.date === dStr);

                    return (
                        <div key={i} onClick={() => day && openNoteModal(day)} className={`relative flex h-8 flex-col items-center justify-center rounded-xl text-[11px] font-black transition-all duration-300 md:h-10 md:text-xs
                            ${isToday ? 'z-10 border border-[var(--eos-border-strong)] bg-[var(--eos-input)] text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]' : 
                              isWeekend ? 'text-red-500/70' : 'eos-pro-muted'}
                            ${!day ? 'opacity-0' : 'cursor-pointer border border-transparent hover:border-[var(--eos-border)] hover:bg-[var(--eos-input)]'}
                        `}>
                            {day}
                            {hasNote && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* KOLUMNA 3: PULS RYNKU (TABLICA DWORCOWA) */}
        <div className="eos-pro-panel eos-pro-panel-inset relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl p-6 lg:min-h-0 lg:flex-1">
           <div className="relative z-10 mb-4 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-3">
                 <Newspaper className="eos-pro-subtle" size={16}/>
                 <h3 className="eos-pro-muted text-[10px] font-black uppercase tracking-[0.3em] md:text-[11px]">{pw.pulseTitle}</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-[var(--eos-input)] px-2 py-1 shadow-inner">
                 <div className={`h-1.5 w-1.5 animate-pulse rounded-full ${pulseLive ? "bg-emerald-500" : "bg-amber-500"}`}></div>
                 <span className={`text-[7px] font-black uppercase tracking-widest ${pulseLive ? "text-emerald-600 dark:text-emerald-500/70" : "text-amber-600 dark:text-amber-500/70"}`}>
                   {pulseLive ? pw.pulseLive : pw.pulseSync}
                 </span>
              </div>
           </div>

           <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="shrink-0">
                 <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] md:h-10 md:w-10">
                       {headlines[newsIndex]?.type === "GLOBAL" ? (
                         <Globe size={14} className="text-blue-500/80" />
                       ) : (
                         <TrendingUp size={14} className="text-emerald-500/80" />
                       )}
                    </div>
                    <div className="flex-1 min-w-0 font-mono">
                       <p className="text-[10px] md:text-[11px] font-bold text-emerald-400/90 leading-relaxed min-h-[36px] drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                          <ScrambleText key={`${headlines[newsIndex]?.id}-${newsIndex}`} text={headlines[newsIndex]?.title ?? ""} />
                       </p>
                       <p className="text-[8px] font-black uppercase tracking-widest eos-pro-subtle mt-1 md:text-[9px]">
                          {headlines[newsIndex]?.source}
                       </p>
                    </div>
                 </div>
              </div>

              <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-[var(--eos-border)] to-transparent"></div>

              <PulseUpcomingSchedule locale={locale} copy={dict.crm.pulseSchedule} />

              <p className="eos-pro-subtle shrink-0 text-center text-[7px] uppercase tracking-[0.18em]">
                {pw.encryptedConnection}
              </p>
           </div>
        </div>

        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          <OtodomImportProCard />
          <OpenHouseProCard activeOffers={activeOffers} onChanged={onProToolsChanged} />
          <AuctionProCard activeOffers={activeOffers} onChanged={onProToolsChanged} />
        </div>
      </div>

      {/* PASEK AKTYWNOŚCI NA DOLE (TICKER) */}
      <div className="eos-pro-ticker relative flex h-12 w-full items-center overflow-hidden rounded-b-[2.5rem] border-t border-[var(--eos-border)] md:h-14">
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
          
          <motion.div className="flex items-center gap-12 md:gap-16 whitespace-nowrap pl-12 md:pl-16" animate={{ x: '-33.33%' }} transition={{ duration: 45, ease: "linear", repeat: Infinity }}>
              {[...events, ...events, ...events].map((e, i) => {
                const Icon = EVENT_ICONS[e.icon] ?? Zap;
                return (
                  <div key={`${e.id}-${i}`} className="flex items-center gap-3 shrink-0">
                     <Icon size={14} className={e.color}/>
                     <span className="eos-pro-muted shrink-0 text-[9px] font-black uppercase tracking-widest md:text-[10px]">{e.text}</span>
                     <div className="ml-8 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--eos-border)] md:ml-12"></div>
                  </div>
                );
              })}
          </motion.div>
      </div>

      {/* POPUP NOTATKI */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="eos-modal-backdrop fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto p-4 pt-10 pb-10 sm:pt-20 sm:pb-20">
             <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="eos-modal-surface eos-modal-shell eos-themed-modal my-auto w-full max-w-md rounded-[2rem] border p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]"><PenTool size={16} className="eos-pro-muted"/></div>
                      <div>
                         <h3 className="text-sm font-black uppercase tracking-widest text-[var(--eos-text)]">{pw.noteTitle}</h3>
                         <p className="text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-500">{selectedDate}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedDate(null)} className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] p-2 transition-colors hover:bg-[var(--eos-border)] eos-pro-muted"><X size={16}/></button>
                </div>
                <textarea 
                   autoFocus
                   value={noteText}
                   onChange={e => setNoteText(e.target.value)}
                   placeholder={pw.notePlaceholder}
                   className="custom-scrollbar h-32 w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-xs font-medium text-[var(--eos-text)] shadow-inner transition-all placeholder:text-[var(--eos-subtle)] focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
                <button onClick={handleSaveNote} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--eos-border-strong)] bg-[var(--eos-input)] py-4 text-[10px] font-black uppercase tracking-widest text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)] transition-all hover:bg-[var(--eos-border)]">
                   {pw.noteSaveCloud}
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </div>
  );
}
