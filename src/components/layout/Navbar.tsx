"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Menu, X, Home, Building2, Shield, LogIn, Crown } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import ReviewPrompt from "@/components/ReviewPrompt";
import PremiumModeToggle from "@/components/ui/PremiumModeToggle";
import { useUserMode } from "@/contexts/UserModeContext";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { initModeFromUser } = useUserMode();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUser(data);
          initModeFromUser(data);
        }
      })
      .catch(() => setUser(null));
  }, [initModeFromUser]);

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
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-zinc-950/95 font-sans backdrop-blur-xl supports-[backdrop-filter]:bg-black/70 supports-[backdrop-filter]:backdrop-blur-2xl [@media(prefers-reduced-transparency:reduce)]:bg-zinc-950 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none [padding-top:env(safe-area-inset-top)]">
      <div
        className="relative z-[100] mx-auto flex h-24 max-w-[1400px] items-start justify-between px-3 pt-2 sm:h-20 sm:items-center sm:pt-0 md:px-6"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        
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
        <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-1 z-[15] pointer-events-none">
          <span className="text-lg font-black tracking-tighter uppercase italic text-white relative overflow-hidden shimmer-logo">
            <span className="text-[#10b981]">E</span>state<span className="text-[#10b981]">OS</span>&trade;
          </span>
        </div>

        {/* CENTRALNY PRZEŁĄCZNIK – TYLKO DLA ZALOGOWANYCH */}
        {user && (
          <div
            className={`absolute left-1/2 top-9 z-[12] flex max-lg:w-full max-lg:justify-center -translate-x-1/2 flex-col items-center sm:top-1 md:top-2 ${isOpen ? 'max-lg:pointer-events-none max-lg:opacity-0' : ''}`}
            aria-hidden={isOpen ? true : undefined}
          >
            <PremiumModeToggle currentUser={user} />
          </div>
        )}

        {/* DESKTOP NAV */}
        <div className="hidden lg:flex items-center justify-end flex-1 ml-10">
            <div className="flex items-center gap-5">
               {user && <NotificationCenter />}
               
               {user ? (
                 <div className="flex items-center gap-4 ml-1">
                   <button onClick={() => router.push('/moje-konto')} className="text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors px-2">
                     Profil
                   </button>
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
        <div className="relative z-40 mt-0.5 flex items-center gap-2.5 lg:hidden">
          {user && <NotificationCenter />}
          <button onClick={() => setIsOpen(!isOpen)} className="text-white p-2 hover:text-emerald-500 transition-colors bg-black/35 rounded-xl border border-white/10">
             {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MENU MOBILNE */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              key="mobile-nav-backdrop"
              type="button"
              aria-label="Zamknij menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+6rem)] z-30 bg-black/55 backdrop-blur-[2px] supports-[backdrop-filter]:backdrop-blur-sm lg:hidden [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none sm:top-[calc(env(safe-area-inset-top)+5.25rem)]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              key="mobile-nav-panel"
              initial={{ opacity: 0, height: 0, y: -12 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -12 }}
              className="relative z-40 lg:hidden overflow-hidden border-b border-white/10 bg-zinc-950 shadow-2xl"
            >
              <div className="flex flex-col gap-8 p-6 pb-10">
                <div className="mt-2 space-y-5 px-1">
                  <button
                    type="button"
                    onClick={() => handleNavClick('/', true)}
                    className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-100 transition-colors hover:bg-white/5 active:bg-white/10"
                  >
                    <Home size={20} className="shrink-0 text-emerald-400" aria-hidden />
                    Odkryj Mapę
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavClick('/oferty')}
                    className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-100 transition-colors hover:bg-white/5 active:bg-white/10"
                  >
                    <Building2 size={20} className="shrink-0 text-emerald-400" aria-hidden />
                    Rynek Nieruchomości
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavClick('/cennik')}
                    className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-amber-200 transition-colors hover:bg-amber-500/10 active:bg-amber-500/15"
                  >
                    <Crown size={20} className="shrink-0 text-amber-300" aria-hidden />
                    EstateOS™ Elite
                  </button>
                </div>
                <div className="h-px bg-white/10" />
                <div className="space-y-3 px-1">
                  {user ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleNavClick('/moje-konto')}
                        className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-100 transition-colors hover:bg-white/5"
                      >
                        <User size={20} className="shrink-0 text-zinc-300" aria-hidden />
                        Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick(user.role === 'ADMIN' ? '/centrala' : '/moje-konto')}
                        className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-emerald-300 transition-colors hover:bg-emerald-500/10"
                      >
                        <Shield size={20} className="shrink-0 text-emerald-400" aria-hidden />
                        {user.role === 'ADMIN' ? 'Zarządzaj (Centrala)' : 'Zarządzaj Kontem'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          setIsOpen(false);
                        }}
                        className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-red-300 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut size={20} className="shrink-0 text-red-400" aria-hidden />
                        Wyloguj
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNavClick('/login')}
                      style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}
                      className="flex w-full items-center gap-4 rounded-2xl p-4 text-left text-xs font-black uppercase tracking-[0.2em] text-emerald-400"
                    >
                      <User size={20} className="shrink-0" aria-hidden />
                      Zaloguj do Systemu
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
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
