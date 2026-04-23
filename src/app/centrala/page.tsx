"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Users, BarChart3, ShieldAlert, LogOut, ArrowRight, Loader2, AlertTriangle, Smartphone, Power } from "lucide-react";

export default function Centrala() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [togglingSms, setTogglingSms] = useState(false);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setDebugMsg("Błąd API: " + data.error);
        } else if (data.role !== 'ADMIN') {
          setDebugMsg("Odmowa dostępu. Twoja rola to: " + (data.role || "BRAK"));
        } else {
          setIsAdmin(true);
          // Wczytywanie stanu przełącznika
          fetch('/api/admin/settings').then(r => r.json()).then(d => setSmsEnabled(d.smsEnabled)).catch(()=>{});
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setDebugMsg("Błąd serwera.");
        setIsLoading(false);
      });
  }, []);

  
  const handleSmsToggle = async () => {
    setTogglingSms(true);
    const newState = !smsEnabled;
    try {
      await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify({ enable: newState }) });
      setSmsEnabled(newState);
      // Szybki restart środowiska z poziomu API żeby uaktualnił się process.env w pamięci ram
      fetch('/api/admin/settings/restart-cache', {method: 'POST'}).catch(()=>{});
    } catch(e) {}
    setTogglingSms(false);
  };

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
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-32 md:p-16 md:pt-40">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Baza Ofert", desc: "Zarządzaj nieruchomościami.", icon: <Database size={32} />, path: "/centrala/oferty", color: "from-blue-500/20 to-blue-500/5" },
            { title: "Użytkownicy", desc: "Zarządzaj kontami.", icon: <Users size={32} />, path: "/centrala/uzytkownicy", color: "from-emerald-500/20 to-emerald-500/5" },
            { title: "Statystyki", desc: "Przeglądaj ruch.", icon: <BarChart3 size={32} />, path: "/centrala/statystyki", color: "from-purple-500/20 to-purple-500/5" }
          ].map((item, index) => (
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

        {/* --- SYSTEM GŁÓWNY (MASTER SWITCHES) --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-16 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
              <div className="flex items-start gap-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all duration-500 ${smsEnabled ? 'bg-orange-500/10 border border-orange-500/30 text-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.2)]' : 'bg-white/5 border border-white/10 text-white/30'}`}>
                    <Smartphone size={28} />
                 </div>
                 <div>
                    <h3 className="text-xl md:text-2xl font-black mb-2 flex items-center gap-3">Weryfikacja Kont SMS <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${smsEnabled ? 'bg-orange-500/20 text-orange-500' : 'bg-white/10 text-white/50'}`}>{smsEnabled ? 'Tarcza Aktywna' : 'Tryb Dev (Pominięty)'}</span></h3>
                    <p className="text-gray-500 text-xs md:text-sm leading-relaxed max-w-xl">
                      Przełącznik wymusza fizyczną weryfikację telefonu przez bramkę <b>SMSPlanet</b> przy zakładaniu konta przez inwestorów. Dezaktywuj ten protokół wyłącznie na czas własnych testów developerskich.
                    </p>
                 </div>
              </div>

              <button 
                 onClick={handleSmsToggle} 
                 disabled={togglingSms}
                 className={`shrink-0 h-16 w-32 rounded-full p-2 flex items-center transition-all duration-500 cursor-pointer border relative ${smsEnabled ? 'bg-orange-500 border-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.4)]' : 'bg-[#111] border-white/10 hover:border-white/30'}`}
              >
                 <motion.div 
                   animate={{ x: smsEnabled ? 64 : 0 }} 
                   transition={{ type: "spring", stiffness: 400, damping: 25 }}
                   className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${smsEnabled ? 'bg-black text-orange-500' : 'bg-white/10 text-white/30'}`}
                 >
                    {togglingSms ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} strokeWidth={3} />}
                 </motion.div>
              </button>
           </div>
        </motion.div>


        {/* SNAPSHOT ENGINE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="text-xl md:text-2xl font-black mb-4 flex items-center gap-3">
            🧠 Snapshot Engine
          </h3>

          <button
            onClick={async () => {
              await fetch("/api/admin/snapshot-create", { method: "POST" });
              location.reload();
            }}
            className="bg-green-500 hover:bg-green-400 text-black px-5 py-3 rounded-xl font-bold mb-6"
          >
            ➕ Nowy Snapshot
          </button>

          <div id="snapshots-container" className="space-y-3"></div>
        </motion.div>

      </main>
    </div>
  );
}
