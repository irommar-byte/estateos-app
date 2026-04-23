"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Briefcase, CalendarCheck, CalendarX, AlertCircle, Home, Eye } from "lucide-react";
import Link from "next/link";

export default function PublicProfileModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string | null }) {
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            fetch(`/api/users/${userId}/public`)
                .then(res => res.json())
                .then(d => { if (!d.error) setData(d); })
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setData(null);
        }
    }, [isOpen, userId]);

    if (!mounted || !isOpen) return null;

    let averageRating = 5.0;
    if (data?.reviews?.length > 0) {
        averageRating = data.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / data.reviews.length;
    }

    const modalContent = (
        <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                
                {/* Header z gradientem */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />
                
                <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 transition-colors z-20">
                    <X size={20} />
                </button>

                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Wczytywanie profilu...</p>
                    </div>
                ) : data ? (
                    <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-8">
                        
                        {/* 1. Wizytówka Główna */}
                        <div className="flex flex-col items-center text-center mt-4">
                            <div className="w-20 h-20 rounded-[1.5rem] bg-[#111] border border-white/10 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                                {data.user.type === 'AGENCY' ? <Briefcase size={32} className="text-blue-400" /> : <span className="text-4xl">👤</span>}
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter mb-2">{data.user.name}</h3>
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Zweryfikowany {data.user.type === 'AGENCY' ? 'Agent' : 'Użytkownik'}</span>
                            </div>
                        </div>

                        {/* 2. Reputacja i Gwiazdki */}
                        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-5xl font-black text-yellow-500 mb-2 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]">{averageRating.toFixed(1)}</div>
                            <div className="flex gap-1 mb-2">
                                {[1,2,3,4,5].map(i => <Star key={i} size={16} className={i <= Math.round(averageRating) ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />)}
                            </div>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{data.reviews.length} Ocen i Opinii</span>
                        </div>

                        {/* 3. Statystyki Prezentacji (Game Changer) */}
                        <div>
                            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 text-center">Historia Prezentacji</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-[#111] border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center text-center">
                                    <CalendarCheck size={20} className="text-emerald-500 mb-2" />
                                    <span className="text-2xl font-black text-white">{data.stats.completed}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Odbyte</span>
                                </div>
                                <div className="bg-[#111] border border-yellow-500/20 rounded-2xl p-4 flex flex-col items-center text-center">
                                    <CalendarX size={20} className="text-yellow-500 mb-2" />
                                    <span className="text-2xl font-black text-white">{data.stats.excused}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Usprawiedl.</span>
                                </div>
                                <div className="bg-[#111] border border-red-500/20 rounded-2xl p-4 flex flex-col items-center text-center">
                                    <AlertCircle size={20} className="text-red-500 mb-2" />
                                    <span className="text-2xl font-black text-white">{data.stats.noShow}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Brak obecn.</span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Aktualne Oferty (Cross-selling) */}
                        {data.offers.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 text-center">Inne oferty użytkownika ({data.offers.length})</h4>
                                <div className="flex flex-col gap-3">
                                    {data.offers.map((o: any) => (
                                        <Link key={o.id} href={`/oferta/${o.id}`} className="flex items-center gap-4 p-3 bg-[#111] hover:bg-[#1a1a1a] border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all group">
                                            <div className="w-16 h-16 rounded-xl bg-black overflow-hidden relative shrink-0">
                                                {o.images?.[0] ? <img src={o.images[0]} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="oferta" /> : <Home className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="text-xs font-bold text-white truncate mb-1">{o.title || `Oferta ID: ${o.id}`}</h5>
                                                <p className="text-[10px] text-white/50 truncate">{o.address || o.district || 'Polska'}</p>
                                                <div className="mt-2 inline-block px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 text-[9px] font-black text-emerald-500">
                                                    ID: {o.id} ↗
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 5. Komentarze */}
                        {data.reviews.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 text-center">Ostatnie Komentarze</h4>
                                <div className="space-y-3">
                                    {data.reviews.slice(0, 5).map((r: any) => (
                                        <div key={r.id} className="p-4 bg-[#111] border border-white/5 rounded-2xl">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(i => <Star key={i} size={10} className={i <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />)}
                                                </div>
                                                <span className="text-[8px] text-white/30 uppercase tracking-widest">{new Date(r.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-white/70 italic leading-relaxed">"{r.comment || 'Brak treści komentarza.'}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="p-10 text-center text-white/50">Wystąpił błąd podczas ładowania profilu.</div>
                )}
            </motion.div>
        </div>
    );

    return createPortal(
        <AnimatePresence>{isOpen && modalContent}</AnimatePresence>,
        document.body
    );
}
