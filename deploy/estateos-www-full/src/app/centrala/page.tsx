"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Users, BarChart3, ShieldAlert, LogOut, ArrowRight, Loader2, AlertTriangle, Wallet } from "lucide-react";
import KeiAmerWorkspace from "@/components/admin/KeiAmerWorkspace";
import PortalOnboardingInvitePanel from "@/components/admin/PortalOnboardingInvitePanel";
import ServerMemoryTile from "@/components/admin/ServerMemoryTile";

export default function Centrala() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/user/profile', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        const role = data?.role ?? data?.user?.role;
        if (!res.ok) {
          setDebugMsg(
            data?.error ? `Błąd API: ${data.error}` : `Brak sesji (${res.status}). Zaloguj się ponownie.`
          );
        } else if (role !== 'ADMIN') {
          setDebugMsg("Odmowa dostępu. Twoja rola to: " + (role || "BRAK"));
        } else {
          setIsAdmin(true);
        }
      } catch {
        setDebugMsg("Błąd serwera.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="animate-spin text-red-500" size={40} />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Wczytywanie Centrali...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="text-red-500 mb-6" size={64} />
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">Brak Uprawnień</h1>
        <p className="text-gray-400 mb-8 font-mono text-xs bg-[#111] p-4 rounded-xl">{debugMsg}</p>
      </div>
    );
  }

  return (
    <div className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] text-[var(--eos-text)] p-6 pt-32 md:p-16 md:pt-40">
      <nav className="max-w-7xl mx-auto flex justify-between items-center mb-24">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert size={20} />
          </div>
          <span className="font-black text-xs uppercase tracking-[0.4em]">Centrala Dowodzenia</span>
        </div>
        <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          Wyloguj <LogOut size={16} />
        </button>
      </nav>

      <main className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-20">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4">Zarząd EstateOS<span className="text-red-500">.</span></h1>
          <p className="text-gray-500 max-w-2xl font-medium leading-relaxed">
            Zalogowano pomyślnie na konto Master Admin. Masz pełen dostęp do platformy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          <ServerMemoryTile />
          {[
            { title: "Baza Ofert", desc: "Zarządzaj nieruchomościami.", icon: <Database size={32} />, path: "/centrala/oferty", color: "from-blue-500/20 to-blue-500/5" },
            { title: "Użytkownicy", desc: "Zarządzaj kontami.", icon: <Users size={32} />, path: "/centrala/uzytkownicy", color: "from-emerald-500/20 to-emerald-500/5" },
            { title: "Portfel", desc: "Kredyty, kupony i historia.", icon: <Wallet size={32} />, path: "/centrala/portfel", color: "from-amber-500/20 to-amber-500/5" },
            { title: "Statystyki", desc: "Przeglądaj ruch.", icon: <BarChart3 size={32} />, path: "/centrala/statystyki", color: "from-purple-500/20 to-purple-500/5" },
            { title: "Sesje zdjęciowe", desc: "Negocjacje EstateOS Studio.", icon: <Database size={32} />, path: "/centrala/sesje-zdjeciowe", color: "from-emerald-500/20 to-emerald-500/5" }
          ].map((item) => (
            <motion.div
              key={item.title}
              onClick={() => window.location.href = item.path}
              className={`group relative bg-[#0a0a0a] border border-white/5 p-10 rounded-[40px] cursor-pointer hover:border-white/20 transition-all overflow-hidden shadow-xl`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="text-gray-400 group-hover:text-white transition-colors duration-500 mb-8">{item.icon}</div>
                <h3 className="text-2xl font-black mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">{item.desc}</p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 duration-300">
                  Wejdź <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <PortalOnboardingInvitePanel />

        <KeiAmerWorkspace />
      </main>
    </div>
  );
}
