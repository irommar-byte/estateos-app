'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Home } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoalModal({ isOpen, onClose }: GoalModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-6" 
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} 
            animate={{ scale: 1, y: 0 }} 
            exit={{ scale: 0.95, y: 20 }} 
            onClick={e => e.stopPropagation()} 
            className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none z-0"></div>
            
            <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/50 z-20">
              <X size={20}/>
            </button>
            
            <div className="relative z-10 text-center mb-10">
              <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">Jaki jest Twój <span className="text-emerald-500">Cel</span>?</h3>
              <p className="text-white/50 text-sm md:text-base">Wybierz odpowiednią ścieżkę, abyśmy mogli dopasować narzędzia do Twoich potrzeb.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <button onClick={() => window.location.href = '/szukaj'} className="flex flex-col items-center text-center gap-4 p-8 bg-[#111] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] rounded-[2rem] transition-all group cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Key size={36} />
                </div>
                <div>
                  <div className="font-black text-2xl text-white mb-2 group-hover:text-emerald-500 transition-colors">Chcę Kupić</div>
                  <div className="text-xs text-white/40 leading-relaxed">Przeglądaj ekskluzywne oferty i korzystaj z Radaru.</div>
                </div>
              </button>
              
              <button onClick={() => window.location.href = '/dodaj-oferte'} className="flex flex-col items-center text-center gap-4 p-8 bg-[#111] border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] rounded-[2rem] transition-all group cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Home size={36} />
                </div>
                <div>
                  <div className="font-black text-2xl text-white mb-2 group-hover:text-orange-500 transition-colors">Chcę Sprzedać</div>
                  <div className="text-xs text-white/40 leading-relaxed">Dodaj swoją nieruchomość do bazy i znajdź kupca.</div>
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
