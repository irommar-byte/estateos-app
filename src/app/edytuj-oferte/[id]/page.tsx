"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Home, MapPin, Loader2, Save, ArrowLeft, Image as ImageIcon, Trash2, GripHorizontal, Building2, Layers, CheckCircle, BedDouble, Calendar, Box, Sparkles, Map } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- LUKSUSOWE STYLE ---
const inputWrapper = "relative group flex items-center";
const inputPremium = "w-full bg-[#080808] border border-white/10 rounded-2xl text-white text-base md:text-lg py-4 pl-14 pr-5 focus:bg-[#0c0c0c] focus:border-emerald-500/50 outline-none transition-all duration-500 placeholder:text-zinc-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]";
const labelPremium = "block text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em] mb-3 ml-1 drop-shadow-md";
const glassPanel = "bg-[#050505]/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden transition-all duration-500";
const iconGlow = "absolute left-4 text-zinc-500 group-focus-within:text-emerald-400 group-focus-within:drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-500";

const AMENITIES_LIST = ["Balkon", "Garaż/Miejsce park.", "Piwnica/Pom. gosp.", "Ogródek", "Dwupoziomowe", "Winda", "Klimatyzacja"];

// --- FORMATOWANIE LICZB ---
const formatNum = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// --- KOMPONENT DRAG & DROP ZDJĘĆ ---
const SortablePhoto = ({ url, onRemove, isMain }: { url: string, onRemove: (url: string) => void, isMain: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: url });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 group transition-all ${isMain ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'border-[#222] bg-[#0a0a0a] hover:border-emerald-500/50'}`}>
      <img src={url} className={`w-full h-full object-cover saturate-[1.2] transition-all duration-700 ${isMain ? 'opacity-100 scale-110' : 'opacity-60 group-hover:opacity-100 group-hover:scale-105'}`} alt="Foto" />
      <div {...attributes} {...listeners} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 backdrop-blur-sm cursor-grab active:cursor-grabbing transition-opacity duration-300 z-10"><GripHorizontal size={32} className="text-white drop-shadow-lg" /></div>
      <button onClick={() => onRemove(url)} className="absolute top-2 right-2 p-2 bg-black/80 border border-white/10 hover:bg-red-500 hover:border-red-400 rounded-full text-white/80 hover:text-white z-20 transition-all shadow-xl"><Trash2 size={14} /></button>
      {isMain && <div className="absolute bottom-0 left-0 w-full bg-emerald-500 text-black text-[10px] uppercase tracking-[0.2em] font-black text-center py-1.5 z-20 shadow-[0_-10px_20px_rgba(16,185,129,0.5)]">Główne</div>}
    </div>
  );
};

export default function UltraPremiumEditForm({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [offerId, setOfferId] = useState<string | null>(null);
  const [data, setData] = useState<any>({});
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const updateData = (newData: any) => setData((prev: any) => ({ ...prev, ...newData }));

  useEffect(() => { params.then(p => setOfferId(p.id)); }, [params]);

  useEffect(() => {
    if (!offerId) return;
    const init = async () => {
      try {
        const [authRes, offerRes] = await Promise.all([fetch('/api/auth/check'), fetch(`/api/offers/${offerId}`)]);
        const auth = await authRes.json();
        const offer = await offerRes.json();

        if (!auth.loggedIn || offer.error) { setAuthError("Brak dostępu lub oferty."); setIsLoading(false); return; }
        const isOwner = offer.user?.email === auth.user?.email;
        const isAdmin = auth.user?.role === 'ADMIN';
        if (!isOwner && !isAdmin) { setAuthError("Brak uprawnień do edycji."); setIsLoading(false); return; }

        setData({
          ...offer,
          price: String(offer.price || ''),
          area: String(offer.area || ''),
          rooms: String(offer.rooms || ''),
          floor: String(offer.floor || ''),
          year: String(offer.year || offer.buildYear || ''),
          plotArea: String(offer.plotArea || ''),
          amenities: offer.amenities || "",
          district: offer.district || "",
          address: offer.address || "",
          apartmentNumber: offer.apartmentNumber || "",
          propertyType: offer.propertyType || "Mieszkanie"
        });
        if (offer.images) setImagesList(offer.images.split(',').filter(Boolean));
        setIsLoading(false);
      } catch (e) { setAuthError("Błąd serwera."); setIsLoading(false); }
    };
    init();
  }, [offerId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setIsUploading(true); const formData = new FormData(); Array.from(files).forEach(f => formData.append("files", f));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const d = await res.json(); const newImgs = [...imagesList, ...d.images].slice(0, 15); setImagesList(newImgs); updateData({ images: newImgs.join(","), imageUrl: newImgs[0] }); }
    } finally { setIsUploading(false); }
  };

  const handleRemoveImage = (url: string) => { const n = imagesList.filter(u => u !== url); setImagesList(n); updateData({ images: n.join(","), imageUrl: n[0] || '' }); };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImagesList((items) => {
        const newItems = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
        updateData({ images: newItems.join(","), imageUrl: newItems[0] }); return newItems;
      });
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    // Przed wysłaniem usuwamy spacje z ceny
    const payload = { ...data, price: data.price.replace(/\s/g, ''), images: imagesList.join(",") };
    const res = await fetch(`/api/offers/${offerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { 
      setIsSuccess(true); 
      setTimeout(() => router.back(), 2500); 
    } else { 
      alert("Wystąpił błąd zapisu."); 
      setIsSubmitting(false); 
    }
  };

  const toggleAmenity = (am: string) => {
    const current = data.amenities ? data.amenities.split(',').filter(Boolean) : [];
    if (current.includes(am)) updateData({ amenities: current.filter((a: string) => a !== am).join(',') });
    else updateData({ amenities: [...current, am].join(',') });
  };

  if (isLoading) return <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center gap-6"><div className="w-16 h-16 relative"><div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin"></div><div className="absolute inset-2 border-r-2 border-emerald-400 rounded-full animate-[spin_1.5s_reverse_infinite]"></div></div><span className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Ładowanie Systemu</span></div>;
  if (authError) return <div className="min-h-screen bg-[#020202] flex items-center justify-center text-red-500 font-bold uppercase tracking-widest">{authError}</div>;

  return (
    <div className="min-h-screen bg-[#020202] text-[#f5f5f7] pb-40 font-sans selection:bg-emerald-500/30">
      
      {/* Pasek Nawigacyjny */}
      <div className="sticky top-0 z-50 bg-[#020202]/80 backdrop-blur-2xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <button onClick={() => router.back()} className="flex items-center gap-3 text-zinc-400 hover:text-white transition-all duration-300 group">
          <div className="w-10 h-10 rounded-full bg-[#0a0a0a] border border-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all"><ArrowLeft size={16} /></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden md:block">Wróć</span>
        </button>
        <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
          <span className="text-emerald-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">Tryb Edycji Premium</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 mt-12 space-y-12">
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 relative z-10 drop-shadow-2xl">Edytuj <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700">Ofertę</span></h1>
          <p className="text-zinc-500 text-xs md:text-sm font-bold tracking-[0.2em] uppercase relative z-10">Zarządzaj ogłoszeniem <span className="text-white/40 ml-2">#{offerId}</span></p>
        </motion.div>

        {/* --- DANE PODSTAWOWE --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-emerald-500/20 to-emerald-900/20 flex items-center justify-center border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]"><Building2 className="text-emerald-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Kluczowe</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Najważniejsze parametry</p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div>
              <label className={labelPremium}>Tytuł Ogłoszenia</label>
              <div className={inputWrapper}>
                <Home className={iconGlow} size={20} />
                <input value={data.title || ''} onChange={e => updateData({ title: e.target.value })} className={inputPremium} placeholder="Np. Luksusowy Apartament w Centrum" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className={labelPremium}>Cena (PLN)</label>
                <div className={inputWrapper}>
                  <Sparkles className={iconGlow} size={20} />
                  <input value={formatNum(data.price || '')} onChange={e => updateData({ price: e.target.value })} className={`${inputPremium} font-mono font-bold text-emerald-400`} placeholder="Np. 1 250 000" />
                </div>
              </div>
              <div>
                <label className={labelPremium}>Powierzchnia (m²)</label>
                <div className={inputWrapper}>
                  <Box className={iconGlow} size={20} />
                  <input type="number" value={data.area || ''} onChange={e => updateData({ area: e.target.value })} className={inputPremium} placeholder="Np. 65" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- SZCZEGÓŁY --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={glassPanel}>
           <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-blue-500/20 to-blue-900/20 flex items-center justify-center border border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]"><Layers className="text-blue-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Szczegóły</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Rozszerzone informacje</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <label className={labelPremium}>Liczba Pokoi</label>
              <div className={inputWrapper}>
                <BedDouble className={iconGlow} size={20} />
                <input type="number" value={data.rooms || ''} onChange={e => updateData({ rooms: e.target.value })} className={inputPremium} placeholder="Np. 3" />
              </div>
            </div>
            <div>
              <label className={labelPremium}>Piętro / Liczba Pięter</label>
              <div className={inputWrapper}>
                <Layers className={iconGlow} size={20} />
                <input value={data.floor || ''} onChange={e => updateData({ floor: e.target.value })} className={inputPremium} placeholder="Np. 2/4" />
              </div>
            </div>
            <div>
              <label className={labelPremium}>Rok Budowy</label>
              <div className={inputWrapper}>
                <Calendar className={iconGlow} size={20} />
                <input type="number" value={data.year || ''} onChange={e => updateData({ year: e.target.value })} className={inputPremium} placeholder="Np. 2023" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelPremium}>Udogodnienia</label>
            <div className="flex flex-wrap gap-3 mt-4">
              {AMENITIES_LIST.map(am => {
                const isActive = (data.amenities || '').includes(am);
                return (
                  <div key={am} onClick={() => toggleAmenity(am)} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all duration-300 border ${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#0a0a0a] text-zinc-500 border-white/5 hover:bg-[#111] hover:border-white/10'}`}>
                    {am}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* --- MULTIMEDIA --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={glassPanel}>
          <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-purple-500/20 to-purple-900/20 flex items-center justify-center border border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.2)]"><ImageIcon className="text-purple-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Galeria</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Przeciągnij by ułożyć</p>
            </div>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={imagesList} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-4 md:gap-6 mb-6">
                {imagesList.map((url, idx) => (
                  <SortablePhoto key={url} url={url} onRemove={handleRemoveImage} isMain={idx === 0} />
                ))}
                
                {imagesList.length < 15 && (
                  <label className="w-28 h-28 md:w-36 md:h-36 rounded-2xl border-2 border-dashed border-[#222] hover:border-emerald-500/60 bg-[#0a0a0a]/50 hover:bg-[#111] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group shadow-inner">
                    {isUploading ? <Loader2 className="animate-spin text-emerald-500" size={28} /> : <><ImageIcon className="text-zinc-600 group-hover:text-emerald-400 transition-colors duration-500 mb-3" size={32} /><span className="text-[10px] uppercase font-black text-zinc-600 group-hover:text-emerald-400 tracking-widest">Dodaj</span></>}
                    <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </motion.div>

        {/* --- OPIS --- */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={glassPanel}>
           <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
            <div className="w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-orange-500/20 to-orange-900/20 flex items-center justify-center border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.2)]"><Layers className="text-orange-400" size={24} /></div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">Opis</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Treść ogłoszenia</p>
            </div>
          </div>
          <textarea value={data.description || ''} onChange={e => updateData({ description: e.target.value })} className={`${inputPremium} min-h-[250px] resize-y leading-relaxed pl-5`} placeholder="Opisz wszystkie atuty swojej nieruchomości. Dobry opis to klucz do sukcesu..." />
        </motion.div>

      </div>

      {/* --- LEWITUJĄCY, POTĘŻNY PRZYCISK ZAPISU (FLOATING ACTION BAR) --- */}
      <AnimatePresence>
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-[100]">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
          <button onClick={handleSave} disabled={isSubmitting || isSuccess} className={`relative w-full py-5 md:py-6 rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 border-2 overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${isSuccess ? 'bg-emerald-500 border-emerald-400 text-black scale-105' : 'bg-[#0a0a0a]/90 backdrop-blur-xl border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-400 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-95'}`}>
            {/* Lśnienie w tle przycisku */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            
            {isSubmitting ? <><Loader2 className="animate-spin" size={22} /> ZAPISYWANIE DANYCH...</> : 
             isSuccess ? <><CheckCircle size={24} className="animate-bounce" /> ZMIANY ZAPISANE!</> : 
             <><Save size={22} className="group-hover:scale-110 transition-transform" /> ZAKOŃCZ EDYCJĘ I ZAPISZ</>}
          </button>
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
