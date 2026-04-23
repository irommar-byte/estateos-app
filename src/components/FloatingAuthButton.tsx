"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ShieldAlert } from "lucide-react";

export default function FloatingAuthButton() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setUser(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading || !user) return null;

  const isAdmin = user.id === 'admin' || user.role === 'ADMIN';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50, x: "-50%" }} 
        animate={{ opacity: 1, y: 0, x: "-50%" }} 
        exit={{ opacity: 0, y: 50, x: "-50%" }}
        className="fixed bottom-10 left-1/2 z-50 pointer-events-auto"
      >
        <a 
          href={isAdmin ? "/centrala" : "/moje-konto"} 
          className="group relative flex items-center gap-4 bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] hover:border-white/30 hover:scale-105 transition-all duration-500 cursor-pointer overflow-hidden"
        >
          <div className={`absolute inset-0 bg-gradient-to-r ${isAdmin ? 'from-red-500/0 via-red-500/20 to-red-500/0' : 'from-emerald-500/0 via-emerald-500/20 to-emerald-500/0'} -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out`} />
          <div className={`relative z-10 p-2 rounded-full ${isAdmin ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}>
            {isAdmin ? <ShieldAlert size={20} /> : <User size={20} />}
          </div>
          <span className="relative z-10 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white">
            {isAdmin ? 'Centrala Dowodzenia' : 'Panel Klienta'}
          </span>
        </a>
      </motion.div>
    </AnimatePresence>
  );
}
