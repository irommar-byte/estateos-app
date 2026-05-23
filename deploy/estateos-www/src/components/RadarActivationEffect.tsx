"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Sparkles, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function RadarActivationEffect({ 
  onComplete, 
  matchedCount 
}: { 
  onComplete: () => void, 
  matchedCount: number 
}) {
  const [phase, setPhase] = useState<'scanning' | 'explosion' | 'result'>('scanning');

  useEffect(() => {
    // Faza 1: Skanowanie (2.5 sekundy napięcia)
    const scanTimer = setTimeout(() => setPhase('explosion'), 2500);
    return () => clearTimeout(scanTimer);
  }, []);

  useEffect(() => {
    // Faza 2: Szybki "wybuch" (0.5 sekundy)
    if (phase === 'explosion') {
      const explodeTimer = setTimeout(() => setPhase('result'), 500);
      return () => clearTimeout(explodeTimer);
    }
  }, [phase]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-2xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-6 text-center overflow-hidden"
    >
      <AnimatePresence mode="wait">
        
        {/* FAZA 1: NAPIĘCIE I SKANOWANIE */}
        {phase === 'scanning' && (
          <motion.div key="scanning" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0, filter: "blur(20px)" }} className="flex flex-col items-center">
             <div className="relative w-48 h-48 flex items-center justify-center mb-8">
               <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-[ping_2s_linear_infinite]"></div>
               <div className="absolute inset-4 rounded-full border border-emerald-500/10 animate-[ping_3s_linear_infinite]"></div>
               <Radar size={80} className="text-emerald-500 animate-[spin_3s_linear_infinite]" strokeWidth={1.5} />
             </div>
             <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-emerald-500 mb-3 shadow-emerald-500/50 drop-shadow-lg">Kalibracja</h2>
             <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Aplikowanie nowych kryteriów do sieci...</p>
          </motion.div>
        )}

        {/* FAZA 2: "POPIÓŁ" / ROZBŁYSK (Eksplozja cząsteczek - zrobiona czystym CSS i Framer) */}
        {phase === 'explosion' && (
          <motion.div key="explosion" className="relative w-full h-full flex items-center justify-center">
            {/* Pierścień uderzeniowy */}
            <motion.div initial={{ scale: 0.1, opacity: 1, borderWidth: "50px" }} animate={{ scale: 4, opacity: 0, borderWidth: "0px" }} transition={{ duration: 0.8, ease: "easeOut" }} className="absolute rounded-full border-emerald-500" />
            <motion.div initial={{ opacity: 1, scale: 0.5 }} animate={{ opacity: 0, scale: 3 }} transition={{ duration: 0.5 }} className="absolute w-64 h-64 bg-emerald-500/30 rounded-full blur-[80px]" />
          </motion.div>
        )}

        {/* FAZA 3: WYNIK (Duża cyfra z efektem glow) */}
        {phase === 'result' && (
          <motion.div key="result" initial={{ scale: 0.8, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.4, duration: 0.8 }} className="flex flex-col items-center max-w-xl">
             <div className="relative mb-6">
               <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="absolute -inset-10 bg-emerald-500/20 rounded-full blur-[60px]"></motion.div>
               
               {matchedCount > 0 ? (
                 <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-500 drop-shadow-[0_0_40px_rgba(16,185,129,0.6)] relative z-10 leading-none pb-4">
                   {matchedCount}
                 </h1>
               ) : (
                 <CheckCircle size={100} className="text-emerald-500 drop-shadow-[0_0_40px_rgba(16,185,129,0.6)] relative z-10" strokeWidth={1} />
               )}
             </div>

             <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4 mt-4">
               {matchedCount > 0 ? "Nowe Dopasowania" : "System Uzbrojony"}
             </h2>
             
             <p className="text-white/40 text-sm md:text-base mb-12 max-w-sm leading-relaxed">
               {matchedCount > 0 
                 ? "Twój radar zlokalizował oferty perfekcyjnie pasujące do nowych kryteriów. Sprawdź je w swoim portfolio." 
                 : "Kryteria zapisane. Zostaniesz powiadomiony w ułamku sekundy, gdy tylko odpowiednia nieruchomość trafi na rynek."}
             </p>

             <button 
                onClick={onComplete}
                className="group relative px-10 py-5 bg-[#111] hover:bg-[#1a1a1a] border border-emerald-500/30 hover:border-emerald-500 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] overflow-hidden"
             >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <span className="relative z-10 text-xs font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-3">
                   <Sparkles size={16} /> Przejdź do Konta
                </span>
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
