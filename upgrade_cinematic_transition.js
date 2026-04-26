const fs = require('fs');
const path = require('path');

console.log("=== WDRAŻANIE ULTRA-PREMIUM MODE TRANSITION ===");

const transitionPath = path.join(process.cwd(), 'src', 'components', 'ui', 'ModeTransition.tsx');

const cinematicCode = `
'use client';

import { useEffect, useState, useRef } from 'react';
import { useUserMode } from '@/contexts/UserModeContext';

export default function ModeTransition() {
  const { mode } = useUserMode();
  const [visible, setVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState(mode);
  
  // Choreografia animacji: 0=ukryte, 1=tło+światło, 2=tekst, 3=zanikanie
  const [stage, setStage] = useState(0); 

  const isInitialMount = useRef(true);
  const prevMode = useRef(mode);

  useEffect(() => {
    // Blokada przed błyskiem przy odświeżeniu (F5)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevMode.current = mode;
      return;
    }

    if (mode && mode !== prevMode.current) {
      setDisplayMode(mode);
      setVisible(true);
      setStage(1);
      prevMode.current = mode;

      // Oś czasu animacji (Timeline)
      setTimeout(() => setStage(2), 150);  // Wejście tekstu
      setTimeout(() => setStage(3), 1600); // Start zanikania
      setTimeout(() => {
        setVisible(false);
        setStage(0);
      }, 2100); // Pełne ukrycie
    }
  }, [mode]);

  if (!visible || !displayMode) return null;

  const config = {
    BUYER: {
      title: "INWESTOR",
      subtitle: "Inicjalizacja Radaru Off-Market",
      color: "from-emerald-500/20 to-emerald-900/40",
      glow: "bg-emerald-500"
    },
    SELLER: {
      title: "WŁAŚCICIEL",
      subtitle: "Przygotowanie Panelu Sprzedaży",
      color: "from-blue-500/20 to-blue-900/40",
      glow: "bg-blue-500"
    },
    AGENCY: {
      title: "PARTNER",
      subtitle: "Ładowanie Środowiska Agencji",
      color: "from-[#D4AF37]/20 to-amber-900/40",
      glow: "bg-[#D4AF37]"
    }
  };

  const current = config[displayMode as keyof typeof config];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-none overflow-hidden">
      {/* 1. Głębia i Szkło (Backdrop) */}
      <div 
        className={\`absolute inset-0 bg-black/90 backdrop-blur-2xl transition-opacity duration-500 ease-in-out \${stage >= 1 && stage < 3 ? 'opacity-100' : 'opacity-0'}\`} 
      />

      {/* 2. Poświata koloru trybu */}
      <div 
        className={\`absolute inset-0 bg-gradient-to-br \${current.color} mix-blend-screen transition-opacity duration-700 \${stage >= 1 && stage < 3 ? 'opacity-100' : 'opacity-0'}\`} 
      />

      {/* 3. Centralne jądro światła */}
      <div 
        className={\`absolute w-[80vw] h-[80vw] md:w-[600px] md:h-[600px] \${current.glow} rounded-full blur-[120px] transition-all duration-1000 ease-out \${stage >= 1 && stage < 3 ? 'scale-100 opacity-20' : 'scale-50 opacity-0'}\`} 
      />

      {/* 4. Kaskadowa Typografia */}
      <div 
        className={\`relative flex flex-col items-center justify-center text-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] \${stage === 2 ? 'opacity-100 scale-100 translate-y-0' : stage === 3 ? 'opacity-0 scale-105 -translate-y-8' : 'opacity-0 scale-95 translate-y-12'}\`}
      >
        <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-white/50 mb-4 drop-shadow-md">
          System EstateOS™
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
          {current.title}
        </h1>
        
        <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md">
          <div className={\`w-2 h-2 rounded-full \${current.glow} animate-ping absolute opacity-75\`} />
          <div className={\`w-2 h-2 rounded-full \${current.glow} relative shadow-[0_0_8px_currentColor]\`} />
          <div className="text-xs md:text-sm font-bold tracking-widest text-white/80 uppercase">
            {current.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

try {
  fs.writeFileSync(transitionPath, cinematicCode.trim());
  console.log("✅ Nowa, kinowa choreografia została wdrożona.");
} catch(e) {
  console.error("❌ Błąd:", e.message);
}
