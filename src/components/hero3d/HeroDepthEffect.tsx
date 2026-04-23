"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HeroDepthEffect() {
  const router = useRouter();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const fadeOutIndicator = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  const customEase = [0.16, 1, 0.3, 1] as const;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delayChildren: 1.0, staggerChildren: 0.12 } }
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.2, ease: customEase } }
  };

  const word = "WARSZAWA";

  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-black h-[100dvh]">
      <div className="sticky top-0 h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden">
        
        <motion.div
          style={{ y: bgY, backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop')" }}
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30 grayscale-[0.5]"
        />
        
        {/* CENTRALNY STOS (Lepsze skalowanie dzięki elastycznym marginesom, brak nachodzenia na siebie) */}
        <motion.div style={{ y: textY }} className="relative z-10 text-center flex flex-col items-center justify-center w-full px-4 -mt-[8vh] md:-mt-[5vh]">
          
          {/* KINOWY PREMIUM TEKST */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.8, duration: 2, ease: customEase }}
            className="w-full max-w-[900px] mb-6 md:mb-10 flex flex-col items-center gap-2 z-[100]"
          >
            <span className="text-[8px] sm:text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] border-b border-emerald-500/30 pb-1.5 md:pb-2">
                Prywatny System CRM Nieruchomości
            </span>
            <span className="text-[9px] sm:text-[10px] md:text-sm font-medium tracking-[0.1em] md:tracking-[0.2em] uppercase text-white/80 drop-shadow-[0_4px_4px_rgba(0,0,0,1)] leading-relaxed md:leading-loose text-center max-w-[800px] px-2">
                Wystaw nieruchomość <span className="text-white font-bold">całkowicie za darmo</span> lub znajdź wymarzoną.<br className="hidden sm:block" />
                Ustaw Inteligentny Radar raz, a idealne oferty same przyjdą.
            </span>
          </motion.div>

          {/* DYMKI KUPUJĘ / SPRZEDAJĘ */}
          <div className="w-full max-w-[850px] flex justify-between px-2 sm:px-10 md:px-16 pointer-events-none z-20 mb-4 md:mb-6">
            {/* KUPUJĘ - Lewy Dymek */}
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.5, duration: 0.8, ease: customEase }}
              className="relative pointer-events-auto cursor-pointer group"
              onClick={() => router.push('/szukaj')}
            >
              <div className="relative transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                <div className="relative z-10 px-5 py-2.5 md:px-10 md:py-3.5 rounded-full bg-gradient-to-b from-[#c0996b] via-[#8c6239] to-[#4a2e15] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_15px_25px_rgba(0,0,0,0.8)] border border-[#d6af84] text-white font-bold tracking-widest uppercase text-[9px] md:text-sm transition-all duration-300 group-hover:brightness-110 text-center">
                  Kupuję
                </div>
                {/* Ogonek dymka (Mniejszy na mobile) */}
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 md:-bottom-2 md:w-6 md:h-6 bg-gradient-to-br from-[#8c6239] to-[#4a2e15] border-b border-r border-[#d6af84] rotate-45 z-0 shadow-lg group-hover:brightness-110 transition-all duration-300"></div>
              </div>
            </motion.div>

            {/* SPRZEDAJĘ - Prawy Dymek */}
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.7, duration: 0.8, ease: customEase }}
              className="relative pointer-events-auto cursor-pointer group mt-[-10px] md:mt-[-20px]"
              onClick={() => router.push('/dodaj-oferte')}
            >
              <div className="relative transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                <div className="relative z-10 px-5 py-2.5 md:px-10 md:py-3.5 rounded-full bg-gradient-to-b from-[#c0996b] via-[#8c6239] to-[#4a2e15] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_15px_25px_rgba(0,0,0,0.8)] border border-[#d6af84] text-white font-bold tracking-widest uppercase text-[9px] md:text-sm transition-all duration-300 group-hover:brightness-110 text-center">
                  Sprzedaję
                </div>
                {/* Ogonek dymka (Mniejszy na mobile) */}
                <div className="absolute -bottom-1.5 left-6 w-3 h-3 md:-bottom-2 md:w-6 md:h-6 bg-gradient-to-br from-[#8c6239] to-[#4a2e15] border-b border-r border-[#d6af84] rotate-45 z-0 shadow-lg group-hover:brightness-110 transition-all duration-300"></div>
              </div>
            </motion.div>
          </div>

          {/* GŁÓWNE LOGO */}
          <motion.h1 
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 2, ease: customEase }}
            className="text-[17vw] sm:text-[15vw] md:text-[12vw] font-bold tracking-tighter leading-none text-white drop-shadow-2xl z-10 relative glowing-premium-emerald-text"
          >
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </motion.h1>

          {/* Napis WARSZAWA */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex space-x-2 md:space-x-3 mt-3 md:mt-6 text-white/40 text-[11px] sm:text-lg md:text-2xl tracking-[0.4em] md:tracking-[0.6em] uppercase font-semibold pl-[0.6em] subtle-glowing-pearl-text"
          >
            {word.split("").map((char, index) => (
              <motion.span key={index} variants={letterVariants}>{char}</motion.span>
            ))}
          </motion.div>

        </motion.div>
        
        {/* DOLNY PRZYCISK MAPY (Odchudzony dla mobile, zawieszony wyżej) */}
        <motion.div 
          style={{ opacity: fadeOutIndicator }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 1 }}
          className="absolute bottom-[11vh] md:bottom-[10vh] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center cursor-pointer pointer-events-auto w-max"
        >
          <div 
            onMouseEnter={() => document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onClick={() => document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="group flex flex-col items-center"
          >
            {/* Przycisk Główny */}
            <div className="relative z-10 px-5 py-3 md:px-12 md:py-5 rounded-full bg-gradient-to-b from-[#6b6b6b] via-[#3a3a3a] to-[#1a1a1a] shadow-[inset_0_2px_5px_rgba(255,255,255,0.3),_0_20px_40px_rgba(0,0,0,0.9)] border border-[#8a8a8a] transition-transform duration-300 group-hover:scale-105 group-active:scale-95 text-center">
              <span className="text-[8px] md:text-xs font-bold tracking-widest text-[#e0e0e0] uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-tight block">
                Znajdź wymarzoną<br className="hidden sm:block"/> nieruchomość na mapie
              </span>
            </div>
            
            {/* Strzałka 3D (Zmniejszona dla mobile) */}
            <motion.div 
              animate={{ y: [0, 5, 0] }} 
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="relative -mt-1 md:-mt-2 z-0 flex justify-center"
            >
              <svg viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[30px] h-[35px] md:w-[60px] md:h-[70px] drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_20px_20px_rgba(16,185,129,0.3)] transition-all duration-300">
                <path d="M15 0L15 40L0 40L30 70L60 40L45 40L45 0L15 0Z" fill="url(#metal-gradient)" stroke="#8a8a8a" strokeWidth="1"/>
                <defs>
                  <linearGradient id="metal-gradient" x1="30" y1="0" x2="30" y2="70" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4a4a4a"/>
                    <stop offset="0.5" stopColor="#2a2a2a"/>
                    <stop offset="1" stopColor="#0a0a0a"/>
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* PRZYCISKI NAROŻNE (Odsunięte od dolnej krawędzi) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8, duration: 1 }}
          className="absolute bottom-4 md:bottom-8 w-full px-4 md:px-12 flex justify-between z-30 pointer-events-auto"
        >
          <div className="cursor-pointer flex items-center gap-1 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[#111111]/80 backdrop-blur-md border border-white/10 text-white/50 hover:text-white transition-colors duration-300 group shadow-lg">
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform md:w-[16px]" />
            <span className="text-[8px] md:text-[10px] font-bold tracking-widest uppercase">Inwestor</span>
          </div>

          <div className="cursor-pointer flex items-center gap-1 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[#111111]/80 backdrop-blur-md border border-white/10 text-white/50 hover:text-white transition-colors duration-300 group shadow-lg">
            <span className="text-[8px] md:text-[10px] font-bold tracking-widest uppercase">Właściciel</span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform md:w-[16px]" />
          </div>
        </motion.div>

        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>
    </div>
  );
}
