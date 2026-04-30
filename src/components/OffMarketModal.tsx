"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';

type OffMarketModalProps = {
  isOpen: boolean;
  onClose: () => void;
  offerCreatedAt?: string | Date | null;
};

export default function OffMarketModal({ isOpen, onClose, offerCreatedAt }: OffMarketModalProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!isOpen || !offerCreatedAt) return;
    
    // Obliczamy czas odblokowania (24 godziny po utworzeniu)
    const targetDate = new Date(offerCreatedAt).getTime() + (24 * 60 * 60 * 1000);

    const interval = setInterval(() => {
      const diff = targetDate - new Date().getTime();
      
      if (diff <= 0) {
         clearInterval(interval);
         onClose(); // Zamykamy modal, oferta staje się publiczna
      } else {
         setTimeLeft({
           hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
           minutes: Math.floor((diff / 1000 / 60) % 60),
           seconds: Math.floor((diff / 1000) % 60)
         });
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, offerCreatedAt]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-[0_30px_60px_rgba(0,0,0,0.8)] relative overflow-hidden"
        >
           {/* Złoty pasek postępu / premium */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D4AF37] to-[#FFF0AA]"></div>
           
           <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
                 <Lock className="text-[#D4AF37]" size={32} />
              </div>
           </div>
           
           <h2 className="text-2xl font-black text-center text-white mb-2 tracking-tight">Oferta Off-Market</h2>
           <p className="text-white/50 text-center text-sm mb-8 leading-relaxed">
             Ta ekskluzywna oferta zadebiutowała w systemie. Zostanie odblokowana dla zwykłych użytkowników za:
           </p>

           {/* ZEGAR Z SEKUNDAMI */}
           <div className="flex justify-center gap-5 mb-10">
               <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white">{timeLeft.hours.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Godz</span>
               </div>
               <span className="text-3xl font-black text-white/20 mt-1">:</span>
               <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-white">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Min</span>
               </div>
               <span className="text-3xl font-black text-white/20 mt-1">:</span>
               <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-[#D4AF37] animate-pulse">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#D4AF37]/50 uppercase font-bold tracking-widest mt-1">Sek</span>
               </div>
           </div>

           {/* PRZYCISKI */}
           <div className="flex flex-col gap-3">
              <button 
                onClick={() => { router.push('/cennik'); onClose(); }} 
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B5952F] text-black font-black uppercase tracking-widest rounded-2xl flex justify-center items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                <Crown size={18} /> Chcę zostać PRO
              </button>
              <button 
                onClick={onClose} 
                className="w-full py-4 bg-white/5 text-white/40 font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 hover:text-white transition-all"
              >
                Poczekam cierpliwie
              </button>
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
