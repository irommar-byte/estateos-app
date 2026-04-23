"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, ShieldCheck, Trash2, X, ExternalLink, Mail, 
  ChevronRight, Loader2, TrendingUp, Building2, Crown, Activity
} from "lucide-react";
import Link from "next/link";

type TabType = 'BUYERS' | 'SELLERS' | 'AGENCIES';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('BUYERS');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (activeTab === 'AGENCIES') return u.isPro === true;
    if (activeTab === 'SELLERS') return !u.isPro && u.offers && u.offers.length > 0;
    if (activeTab === 'BUYERS') return !u.isPro && (!u.offers || u.offers.length === 0);
    
    return true;
  });

  const calculatePortfolio = (offers: any[]) => {
    if (!offers) return 0;
    return offers.reduce((acc, off) => acc + (parseFloat(String(off.price).replace(/\s/g, '')) || 0), 0);
  };

  const togglePro = async (id: number, isPro: boolean) => {
    console.log("CLICK PRO:", id, isPro);
    await fetch(`/api/admin/users/${id}/toggle-pro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isPro ? "take" : "give" })
    });
    fetchUsers();
  };

  const handleUpdate = async (id: string, payload: any) => {


    const res = await fetch("/api/admin/users", {
      method: "PUT",
      body: JSON.stringify({ id, ...payload })
    });
    if (res.ok) {
      fetchUsers();
      setSelectedUser((prev: any) => ({ ...prev, ...payload }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("⚠️ UWAGA: Czy na pewno chcesz CAŁKOWICIE usunąć tego użytkownika i jego oferty z bazy? Tej operacji nie można cofnąć.")) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setSelectedUser(null);
        fetchUsers();
      } else {
        alert("Błąd podczas usuwania. Sprawdź logi serwera.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: 'BUYERS', label: 'Kupujący', icon: Users },
    { id: 'SELLERS', label: 'Sprzedający', icon: TrendingUp },
    { id: 'AGENCIES', label: 'Agencje (PRO)', icon: Building2 }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-32 md:p-16 md:pt-40">
      <div className="max-w-7xl mx-auto">
        <Link href="/centrala" className="text-white/40 hover:text-white mb-10 inline-block text-[10px] uppercase tracking-widest font-bold transition-colors">
          ← Powrót do Centrali
        </Link>

        {/* HEADER STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
           <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem]">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Suma Użytkowników</p>
              <h4 className="text-4xl font-black">{users.length}</h4>
           </div>
           <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem]">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50 mb-2">Aktywne Oferty</p>
              <h4 className="text-4xl font-black text-emerald-500">{users.reduce((acc, u) => acc + (u.offers?.length || 0), 0)}</h4>
           </div>
           <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[2rem] md:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Kapitalizacja Bazy (Estymowana)</p>
              <h4 className="text-4xl font-black">
                {new Intl.NumberFormat('pl-PL').format(users.reduce((acc, u) => acc + calculatePortfolio(u.offers), 0))} PLN
              </h4>
           </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
          <h1 className="text-5xl lg:text-6xl font-black tracking-tighter">Segmentacja<span className="text-emerald-500">.</span></h1>
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="E-mail, nazwisko..."
              className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-emerald-500/50 transition-all font-medium"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* APPLE-STYLE TABS (Sliding Segmented Control) */}
        <div className="flex relative p-2 bg-[#18181b] rounded-full border border-white/10 w-fit mb-8 shadow-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative z-10 px-6 md:px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${activeTab === tab.id ? 'text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab-pill"
                  className={`absolute inset-0 rounded-full -z-10 ${tab.id === 'BUYERS' ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : tab.id === 'SELLERS' ? 'bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]'}`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon size={16} /> <span className="hidden sm:block">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* MAIN LIST */}
          <div className="flex-1 space-y-3">
            {loading ? (
              <div className="flex items-center gap-3 text-white/40"><Loader2 className="animate-spin" /> Wczytywanie systemów...</div>
            ) : filteredUsers.length === 0 ? (
               <div className="p-10 border border-white/5 border-dashed rounded-[2rem] text-center text-white/30 font-medium">
                 Brak użytkowników w tym segmencie.
               </div>
            ) : filteredUsers.map((u) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`group p-6 rounded-[2rem] border transition-all duration-300 flex items-center justify-between cursor-pointer ${selectedUser?.id === u.id ? 'bg-white/10 border-white/20' : 'bg-[#0a0a0a] border-white/5 hover:border-white/10'}`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${u.isPro ? 'bg-orange-500/20 text-orange-500' : activeTab === 'SELLERS' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-white/40'}`}>
                    {u.name ? u.name[0] : u.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-lg">{u.name || "Użytkownik"}</h3>
                      {u.role === 'ADMIN' && <ShieldCheck size={14} className="text-emerald-500" />}
                      {u.isPro && <Crown size={14} className="text-orange-500" />}
                    </div>
                    <p className="text-[10px] font-bold text-white/30 tracking-wider uppercase">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                   <div className="hidden xl:block text-right">
                      <p className="text-[9px] font-black text-white/20 uppercase mb-1">Aktywność</p>
                      <p className="font-black text-white text-sm">{u.offers?.length || 0} Ofert</p>
                   </div>
                   <ChevronRight size={20} className="text-white/10 group-hover:text-white/50 transition-all group-hover:translate-x-1" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* ADVANCED CONTROL DRAWER */}
          <AnimatePresence>
            {selectedUser && (
              <motion.div 
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                className="w-full lg:w-[450px] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 h-fit sticky top-32 shadow-2xl"
              >
                <div className="flex justify-between items-start mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-2xl font-black text-white/40">
                      {selectedUser.name ? selectedUser.name[0] : '?'}
                    </div>
                    <div>
                       <h2 className="text-2xl font-black leading-tight truncate max-w-[200px]">{selectedUser.name || 'Brak Danych'}</h2>
                       <p className={`text-[9px] font-black tracking-widest uppercase mt-1 ${selectedUser.isPro ? 'text-orange-500' : 'text-emerald-500'}`}>
                         {selectedUser.isPro ? 'Konto Agencji PRO' : 'Aktywny Profil'}
                       </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X size={18}/></button>
                </div>

                {/* 1. MONITOR AKTYWNOŚCI */}
                <div className="mb-8">
                   <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
                     <Activity size={12} className="text-emerald-500"/> Monitor Aktywności
                   </h4>
                   <div className="bg-[#111] border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                         <span className="text-[10px] text-white/40 font-bold uppercase">Rejestracja</span>
                         <span className="text-xs font-black text-white">
                           {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('pl-PL') : 'Brak danych'}
                         </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                         <span className="text-[10px] text-white/40 font-bold uppercase">Zainteresowanie</span>
                         <span className="text-xs font-black text-emerald-500">
                           {selectedUser.searchType === 'sprzedaz' ? 'Kupno Nieruchomości' : selectedUser.searchType === 'wynajem' ? 'Wynajem' : 'Nie określono'}
                         </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                         <span className="text-[10px] text-white/40 font-bold uppercase">Zadeklarowany Budżet</span>
                         <span className="text-xs font-black text-white">
                           {selectedUser.searchMaxPrice ? new Intl.NumberFormat('pl-PL').format(selectedUser.searchMaxPrice) + ' PLN' : 'Brak limitu'}
                         </span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] text-white/40 font-bold uppercase">Lokalizacje</span>
                         <span className="text-xs font-black text-white truncate max-w-[150px]" title={selectedUser.searchDistricts}>
                           {selectedUser.searchDistricts ? selectedUser.searchDistricts.split(',').join(', ') : 'Dowolne'}
                         </span>
                      </div>
                   </div>
                </div>

                {/* 2. STATYSTYKI FINANSOWE */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                   <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                      <p className="text-[9px] font-black text-white/30 uppercase mb-1.5">Łączny Kapitał</p>
                      <p className="text-lg font-black text-white truncate">
                        {new Intl.NumberFormat('pl-PL').format(calculatePortfolio(selectedUser.offers))} <span className="text-[10px] text-white/40">PLN</span>
                      </p>
                   </div>
                   <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                      <p className="text-[9px] font-black text-white/30 uppercase mb-1.5">Telefon</p>
                      <p className="text-sm font-black text-white truncate">{selectedUser.phone || 'Brak numeru'}</p>
                   </div>
                </div>

                {/* 3. OPERACYJNE PRZYCISKI DOWODZENIA */}
                <div className="space-y-3 mb-8">
                   <a 
                    href={`mailto:${selectedUser.email}?subject=Wiadomość od EstateOS Administrator`}
                    className="w-full bg-white text-black py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-200 transition-all shadow-xl shadow-white/5"
                   >
                     <Mail size={16}/> Kontakt Direct Mail
                   </a>
                   
                   <div className="flex gap-3">
                      <button 
                        onClick={() => togglePro(selectedUser.id, selectedUser.isPro)}
                        className={`flex-1 py-3.5 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all ${selectedUser.isPro ? 'border-orange-500/30 text-orange-500 bg-orange-500/10 hover:bg-orange-500/20' : 'border-white/10 text-white/50 hover:bg-white/5'}`}
                      >
                        {selectedUser.isPro ? 'Zabierz PRO' : 'Daj Status PRO'}
                      </button>
                      
                      <button 
                        onClick={() => handleDelete(selectedUser.id)}
                        disabled={isDeleting}
                        className="flex-1 py-3.5 rounded-xl border border-red-500/20 text-red-500 font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex justify-center items-center"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <><Trash2 size={14} className="mr-2"/> Usuń Konto</>}
                      </button>
                   </div>
                </div>

                {/* 4. AUDYT OGŁOSZEŃ */}
                {selectedUser.offers && selectedUser.offers.length > 0 && (
                  <div>
                     <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Audyt Ofert Użytkownika ({selectedUser.offers.length})</h4>
                     <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {selectedUser.offers.map((off: any) => (
                          <div key={off.id} className="group/item flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/20 transition-all">
                             <div className="truncate pr-4">
                                <p className="text-xs font-bold truncate group-hover/item:text-white transition-colors">{off.title}</p>
                                <p className="text-[9px] text-white/30 font-black uppercase mt-0.5">{off.status === 'active' ? '● Aktywne' : '○ Weryfikacja'}</p>
                             </div>
                             <Link href={`/oferta/${off.id}`} target="_blank" className="p-2 bg-white/5 rounded-lg hover:bg-white hover:text-black transition-all">
                                <ExternalLink size={12}/>
                             </Link>
                          </div>
                        ))}
                     </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
