'use client';

import React from 'react';
import { useUserMode } from '@/contexts/UserModeContext';
import { Building, Wallet, Briefcase } from 'lucide-react';

export default function PremiumModeToggle({ currentUser }: { currentUser?: any }) {
  const { mode, selectMode, forceMode } = useUserMode();

  return (
    <div className="flex flex-col items-center justify-center pointer-events-auto relative z-50 w-full max-w-[600px] mx-auto">
      
      
  
      
      
      {/* KONTENER PRZYCISKÓW - APPLE GLASSMORPHISM */}
      <div className="relative inline-flex items-center p-1.5 sm:p-2 bg-black/60 backdrop-blur-2xl border border-white/5 rounded-full shadow-[inset_0_2px_12px_rgba(0,0,0,1),_0_20px_40px_rgba(0,0,0,0.8)]">
        
        {/* PRZYCISK 1: INWESTOR */}
        <button 
          onClick={() => selectMode('BUYER', currentUser)} 
          className={`relative flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] transition-all duration-500 focus:outline-none overflow-hidden ${
            mode === 'BUYER' 
              ? "text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] bg-gradient-to-b from-white/10 to-transparent" 
              : "text-white/40 hover:text-white/90 hover:bg-white/5"
          }`}
        >
          {mode === 'BUYER' && (
            <div className="absolute inset-0 z-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-400 blur-sm opacity-60"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80"></div>
            </div>
          )}
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              {mode === 'BUYER' ? (
                <>
                  <div className="absolute inset-0 bg-emerald-400 rounded-full blur-[4px] opacity-80 animate-pulse" />
                  <div className="relative w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,1)]" />
                </>
              ) : (
                <div className="relative w-1.5 h-1.5 bg-white/10 rounded-full border border-white/20" />
              )}
            </div>
            <Wallet size={14} className={`shrink-0 ${mode === 'BUYER' ? 'text-emerald-400' : ''}`} />
            <span className="whitespace-nowrap drop-shadow-md">Inwestor</span>
          </div>
        </button>

        {/* PRZYCISK 2: ESTATEOS™ PARTNER */}
        <button 
          onClick={() => selectMode('AGENCY', currentUser)} 
          className={`relative flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] transition-all duration-500 focus:outline-none overflow-hidden mx-1 ${
            mode === 'AGENCY' 
              ? "text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] bg-gradient-to-b from-white/10 to-transparent" 
              : "text-white/40 hover:text-white/90 hover:bg-white/5"
          }`}
        >
          {mode === 'AGENCY' && (
            <div className="absolute inset-0 z-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-400 blur-sm opacity-60"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[1px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80"></div>
            </div>
          )}
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              {mode === 'AGENCY' ? (
                <>
                  <div className="absolute inset-0 bg-amber-400 rounded-full blur-[4px] opacity-80 animate-pulse" />
                  <div className="relative w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,1)]" />
                </>
              ) : (
                <div className="relative w-1.5 h-1.5 bg-white/10 rounded-full border border-white/20" />
              )}
            </div>
            <Briefcase size={14} className={`shrink-0 ${mode === 'AGENCY' ? 'text-amber-400' : ''}`} />
            <span className="whitespace-nowrap drop-shadow-md">EstateOS™Partner</span>
          </div>
        </button>

        {/* PRZYCISK 3: WŁAŚCICIEL */}
        <button 
          onClick={() => selectMode('SELLER', currentUser)} 
          className={`relative flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] transition-all duration-500 focus:outline-none overflow-hidden ${
            mode === 'SELLER' 
              ? "text-cyan-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] bg-gradient-to-b from-white/10 to-transparent" 
              : "text-white/40 hover:text-white/90 hover:bg-white/5"
          }`}
        >
          {mode === 'SELLER' && (
            <div className="absolute inset-0 z-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-cyan-400 blur-sm opacity-60"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"></div>
            </div>
          )}
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              {mode === 'SELLER' ? (
                <>
                  <div className="absolute inset-0 bg-cyan-400 rounded-full blur-[4px] opacity-80 animate-pulse" />
                  <div className="relative w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,1)]" />
                </>
              ) : (
                <div className="relative w-1.5 h-1.5 bg-white/10 rounded-full border border-white/20" />
              )}
            </div>
            <Building size={14} className={`shrink-0 ${mode === 'SELLER' ? 'text-cyan-400' : ''}`} />
            <span className="whitespace-nowrap drop-shadow-md">Właściciel</span>
          </div>
        </button>

      </div>

    </div>
  );
}
