"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Trash2, X, MapPin, User, Loader2, Edit3, ArrowRight, ArchiveX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OfertyAdmin() {
  const router = useRouter();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'pending_approval' | 'active' | 'archived'>('pending_approval');

  const fetchOffers = async () => {
    try {
      const res = await fetch("/api/admin/offers");
      const data = await res.json();
      if (data.success) setOffers(data.offers);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOffers(); }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/offers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    fetchOffers();
    if (selectedOffer?.id === id) setSelectedOffer({ ...selectedOffer, status });
  };
  
  // 🔥 Nowa funkcja "God Mode": Natychmiastowe Wymuszenie Archiwizacji
  const handleForceArchive = async (id: string) => {
    if (!confirm("Wymusić natychmiastowe wygaśnięcie oferty i przenieść ją do Archiwum?")) return;
    
    // Przewijamy czas - ustawiamy datę wygaśnięcia na chwilę obecną
    const pastDate = new Date().toISOString(); 
    
    // Ponieważ w admin API nie ma punktu końcowego stricte do zmiany daty, 
    // symulujemy zmianę na 'pending_approval' (by zeszła z mapy) z natychmiastowym starym expiresAt.
    // Z uwagi na to, że API /admin/offers (metoda PUT) akceptuje tylko 'status',
    // Musimy zbudować dedykowany mini-endpoint na żądanie... Ale zrobimy sprytniej!
    // Wysyłamy status 'archived_forced' i złapiemy to w starym API (zaktualizujemy je w locie).
    await fetch(`/api/admin/offers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: 'archived' })
    });
    
    fetchOffers();
    setSelectedOffer(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Na pewno usunąć tę ofertę z bazy na stałe?")) return;
    await fetch(`/api/admin/offers?id=${id}`, { method: "DELETE" });
    fetchOffers();
    setSelectedOffer(null);
  };

  const formatPrice = (price: any) => {
    const p = String(price).replace(/\D/g, "");
    return p ? new Intl.NumberFormat('pl-PL').format(parseInt(p)) + " PLN" : "Do negocjacji";
  };

  const filteredOffers = offers.filter(offer => {
    const isExpired = offer.status === 'archived' || (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now());
    if (activeTab === 'archived') return isExpired;
    if (activeTab === 'active') return offer.status === 'active' && !isExpired;
    if (activeTab === 'pending_approval') return offer.status === 'pending_approval' && !isExpired;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-32 md:p-16 md:pt-40">
      <Link href="/centrala" className="text-white/40 hover:text-white mb-10 inline-block text-[10px] uppercase tracking-widest font-bold transition-colors">
        ← Wróć do Centrali
      </Link>
      <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-12">Zasoby<span className="text-emerald-500">.</span></h1>

      {/* 🔥 iOS SEGMENTED CONTROL */}
      <div className="mb-10 w-full max-w-xl">
        <div className="flex bg-[#111] p-1.5 rounded-full border border-white/5 relative z-10">
          <button 
            onClick={() => { setActiveTab('pending_approval'); setSelectedOffer(null); }} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-full transition-colors duration-300 z-10 ${activeTab === 'pending_approval' ? 'text-black' : 'text-white/40 hover:text-white'}`}
          >
            Weryfikacja
          </button>
          <button 
            onClick={() => { setActiveTab('active'); setSelectedOffer(null); }} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-full transition-colors duration-300 z-10 ${activeTab === 'active' ? 'text-black' : 'text-white/40 hover:text-white'}`}
          >
            Aktywne
          </button>
          <button 
            onClick={() => { setActiveTab('archived'); setSelectedOffer(null); }} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-full transition-colors duration-300 z-10 ${activeTab === 'archived' ? 'text-white' : 'text-white/40 hover:text-white'}`}
          >
            Archiwum
          </button>
          
          {/* Płynna szklana pigułka (podświetlenie) */}
          <div 
            className={`absolute top-1.5 bottom-1.5 w-[calc(33.33%-4px)] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 shadow-lg ${
               activeTab === 'pending_approval' ? 'left-1.5 bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 
               activeTab === 'active' ? 'left-[calc(33.33%+1.5px)] bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 
               'left-[calc(66.66%)] bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
            }`} 
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-4">
          {loading ? <div className="text-white/20 animate-pulse font-bold uppercase tracking-widest text-xs p-6 bg-[#0a0a0a] rounded-3xl border border-white/5 text-center">Skanowanie zasobów...</div> : 
          filteredOffers.length === 0 ? (
            <div className="text-white/40 text-[10px] font-black uppercase tracking-widest p-12 text-center border border-dashed border-white/10 rounded-[2.5rem] bg-[#0a0a0a]">Brak ofert w tym widoku.</div>
          ) : filteredOffers.map(offer => {
            const isArchived = offer.status === 'archived' || (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now());
            const isActive = offer.status === 'active' && !isArchived;
            
            return (
            <motion.div 
              key={offer.id}
              onClick={() => setSelectedOffer(offer)}
              className={`p-6 rounded-[2.5rem] border cursor-pointer transition-all duration-500 flex items-center justify-between ${selectedOffer?.id === offer.id ? (isArchived ? 'border-purple-500/40 bg-purple-500/5' : isActive ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-yellow-500/40 bg-yellow-500/5') : 'border-white/5 bg-[#0a0a0a] hover:border-white/20'}`}
            >
              <div className="flex items-center gap-4 md:gap-6">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 ${isArchived ? 'text-purple-500 bg-purple-500/10' : isActive ? 'text-emerald-500 bg-emerald-500/10' : 'text-yellow-500 bg-yellow-500/10'}`}><Building2 size={24} /></div>
                <div className="max-w-[150px] sm:max-w-[250px] md:max-w-[300px]">
                  <h3 className="text-lg md:text-xl font-black truncate">{offer.title || 'Oferta ' + offer.id.slice(0,4)}</h3>
                  <p className="text-xs md:text-sm font-bold text-white/30 truncate">{offer.district} • {formatPrice(offer.price)}</p>
                </div>
              </div>
              <div className={`shrink-0 px-3 md:px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${isArchived ? 'border-purple-500/30 text-purple-500' : isActive ? 'border-emerald-500/30 text-emerald-500' : 'border-yellow-500/30 text-yellow-500'}`}>
                {isArchived ? 'Archiwum' : isActive ? 'Aktywna' : 'Weryfikacja'}
              </div>
            </motion.div>
          )})}
        </div>

        <AnimatePresence>
          {selectedOffer && (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="w-full lg:w-[480px] bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-10 h-fit sticky top-40 shadow-2xl flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-3xl font-black leading-tight pr-8">{selectedOffer.title}</h2>
                <button onClick={() => setSelectedOffer(null)} className="p-2 bg-white/5 rounded-full text-white/20 hover:text-white shrink-0"><X size={20}/></button>
              </div>

              <div className="flex flex-col gap-3 mb-10">
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleUpdateStatus(selectedOffer.id, selectedOffer.status === 'active' ? 'pending_approval' : 'active')} 
                    className={`flex-1 py-5 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all border shadow-lg ${selectedOffer.status === 'active' ? 'border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10' : 'border-white/20 text-white hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                  >
                    {selectedOffer.status === 'active' ? 'Cofnij Publikację' : 'Zatwierdź Ofertę'}
                  </button>
                  <button onClick={() => router.push(`/edytuj-oferte/${selectedOffer.id}?from=admin`)} className="p-5 border border-white/20 text-white hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-2xl transition-all flex items-center justify-center group shadow-lg shrink-0">
                    <Edit3 size={20} className="group-hover:rotate-12 transition-transform"/>
                  </button>
                </div>
                
                {/* 🔥 Przycisk Ręcznej Archiwizacji */}
                {!(selectedOffer.status === 'archived' || (selectedOffer.expiresAt && new Date(selectedOffer.expiresAt).getTime() < Date.now())) && (
                  <button onClick={() => handleForceArchive(selectedOffer.id)} className="w-full py-4 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg">
                    <ArchiveX size={16}/> Wymuś Archiwizację (Zakończ Czas)
                  </button>
                )}

                <button onClick={() => handleDelete(selectedOffer.id)} className="w-full py-4 border border-red-500/20 text-red-500/60 hover:bg-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2">
                  <Trash2 size={16}/> Usuń Zasób Na Zawsze
                </button>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-4">
                 <div className="flex items-center gap-3 text-xs font-bold text-white/40 uppercase tracking-widest"><MapPin size={16}/> {selectedOffer.district || 'Brak lokalizacji'}</div>
                 <div className="flex items-center gap-3 text-xs font-bold text-white/40 uppercase tracking-widest">
                   <User size={16}/> Właściciel: 
                   <Link href="/centrala/uzytkownicy" className="text-white hover:text-emerald-500 transition-colors ml-auto flex items-center gap-2">
                     {(selectedOffer.user?.buyerType === 'agency' || selectedOffer.advertiserType === 'agency') ? 'Agencja' : 'Prywatny'} 
                     <span className="text-[9px] bg-white/10 px-2 py-1 rounded">Profil ➔</span>
                   </Link>
                 </div>
                 <Link href={`/oferta/${selectedOffer.id}`} target="_blank" className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:translate-x-1 transition-all pt-2">
                   Podejrzyj na mapie <ArrowRight size={14}/>
                 </Link>
              </div>
              
              {selectedOffer.expiresAt && (
                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Status Cyklu Życia</p>
                  <p className={`text-xs font-bold ${new Date(selectedOffer.expiresAt).getTime() < Date.now() ? 'text-purple-500' : 'text-emerald-500'}`}>
                    {new Date(selectedOffer.expiresAt).getTime() < Date.now() ? 'Wygasła: ' : 'Ważna do: '}
                    {new Date(selectedOffer.expiresAt).toLocaleDateString('pl-PL')}
                  </p>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
