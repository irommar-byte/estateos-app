"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Menu, X, Home, Building2, PlusCircle, Shield, LogIn, Search, Crown, ChevronUp } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import ReviewPrompt from "@/components/ReviewPrompt";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => { if (!data.error) setUser(data); })
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    // 1. Twarde żądanie do serwera (z uprawnieniami do ciastek)
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch(e) {}
    
    // 2. Czystka absolutna na frontendzie
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // 3. Twarde przeładowanie (omija Cache Next.js)
    window.location.replace("/login");
  };

  const handleNavClick = (path: string, isMap = false) => {
    if (isMap) {
      if (pathname === '/') document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else router.push('/#map');
    } else {
      router.push(path);
    }
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 font-sans">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        
        {/* LOGO */}
        <div onClick={() => router.push('/')} className="cursor-pointer group flex-shrink-0 relative z-20 hidden sm:block">
          <span className="text-xl font-black tracking-tighter text-white uppercase italic transition-all group-hover:text-emerald-500">
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </span>
        </div>
        
        {/* Małe Logo dla Mobajla, by zrobic miejsce na przełącznik */}
        <div onClick={() => router.push('/')} className="cursor-pointer group flex-shrink-0 relative z-20 sm:hidden hidden">
          <span className="text-lg font-black tracking-tighter text-emerald-500 uppercase italic">
            E<span className="text-white">OS</span>
          </span>
        </div>

        {/* MOBILE LOGO CENTERED */}
        <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-1 z-[101]">
          <span className="text-lg font-black tracking-tighter uppercase italic text-white relative overflow-hidden shimmer-logo">
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </span>
        </div>

        {/* CENTRALNY PRZEŁĄCZNIK (ZAWSZE WIDOCZNY) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-[100] top-1 md:top-2">
          <PremiumModeToggle currentUser={user} />
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden lg:flex items-center justify-end flex-1 ml-10">
            <div className="flex items-center gap-5">
               {user && <NotificationCenter />}
               
               {user ? (
                 <div className="flex items-center gap-4 ml-1">
                   <button onClick={() => router.push(user.role === 'ADMIN' ? '/centrala' : '/moje-konto')} style={{ backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }} className="text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-full hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                     {user.role === 'ADMIN' ? 'Centrala' : 'Zarządzaj'}
                   </button>
                   <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
                 </div>
               ) : (
                 <button onClick={() => router.push('/login')} className="text-[10px] font-black uppercase tracking-widest text-white hover:text-emerald-500 transition-colors flex items-center gap-2 ml-1">
                   Zaloguj <LogIn size={14} />
                 </button>
               )}
            </div>
        </div>

        {/* WYZWALACZ MOBILNY */}
        <div className="flex items-center gap-2 lg:hidden relative z-20">
          {user && <NotificationCenter />}
          <button onClick={() => setIsOpen(!isOpen)} className="text-white p-2 hover:text-emerald-500 transition-colors">
             {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MENU MOBILNE */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0, y: -20 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -20 }} className="lg:hidden bg-[#0a0a0a] border-b border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 flex flex-col gap-8">
              <div className="space-y-6 px-2 mt-4">
                <button onClick={() => handleNavClick('/', true)} className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all w-full text-left"><Home size={18} className="text-gray-600"/> Odkryj Mapę</button>
                <button onClick={() => handleNavClick('/oferty')} className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all w-full text-left"><Building2 size={18} className="text-gray-600"/> Rynek Nieruchomości</button>
                <button onClick={() => handleNavClick('/cennik')} className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-[#D4AF37] hover:text-[#FFF0AA] w-full text-left"><Crown size={18}/> EstateOS™ Elite</button>
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="space-y-6 px-2">
                {user ? (
                  <>
                    <button onClick={() => handleNavClick(user.role === 'ADMIN' ? '/centrala' : '/moje-konto')} className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-emerald-500 w-full text-left"><Shield size={18} /> {user.role === 'ADMIN' ? 'Zarządzaj (Centrala)' : 'Zarządzaj Kontem'}</button>
                    <button onClick={() => { handleLogout(); setIsOpen(false); }} className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-red-500/70 w-full text-left"><LogOut size={18} /> Wyloguj</button>
                  </>
                ) : (
                  <button onClick={() => handleNavClick('/login')} style={{ backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }} className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-500 w-full text-left p-4 rounded-2xl"><User size={18} /> Zaloguj do Systemu</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReviewPrompt />
<style jsx>{`
.shimmer-logo::after {
  content: "";
  position: absolute;
  top: 0;
  left: -150%;
  width: 150%;
  height: 100%;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35), transparent 70%);
  transform: skewX(-20deg);
  animation: shimmerMove 15s infinite;
}
@keyframes shimmerMove {
  0% { left: -150%; opacity: 0; }
  5% { opacity: 1; }
  10% { left: 150%; opacity: 0; }
  100% { left: 150%; opacity: 0; }
}
`}</style>

    </nav>
  );
}
