"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Briefcase, CalendarCheck, CalendarX, AlertCircle, Home, Eye, User, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import EliteStatusBadges from "@/components/ui/EliteStatusBadges";
import { buildReviewsDistribution } from "@/lib/reviewsDistribution";
import { getBestUserAvatarUrl, isAgencyUser, resolveAgencyDisplayName } from "@/lib/userAvatar";

export default function PublicProfileModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string | null }) {
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showDistribution, setShowDistribution] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            setShowDistribution(false);
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

    const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
    const { averageRating, totalReviews, distribution } = buildReviewsDistribution(reviews);
    const avatarUrl = getBestUserAvatarUrl(data?.user);
    const agencyName = isAgencyUser(data?.user) ? resolveAgencyDisplayName(data?.user) : null;

    const modalContent = (
        <div className="fixed inset-0 z-[999999] flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />
                
                <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 transition-colors z-20">
                    <X size={18} />
                </button>

                <div className="px-5 pt-5 pb-2 border-b border-white/5 relative z-10">
                    <h3 className="text-lg font-black text-white tracking-tight">Profil użytkownika</h3>
                </div>

                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Wczytywanie profilu...</p>
                    </div>
                ) : data ? (
                    <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-5">
                        
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-[#111] shrink-0 flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : agencyName ? (
                                    <Briefcase size={28} className="text-blue-400" />
                                ) : (
                                    <User size={28} className="text-white/40" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-black text-white tracking-tight leading-tight">{data.user.name}</h3>
                                {agencyName ? (
                                    <p className="text-sm font-bold text-blue-300/90 mt-0.5 truncate">{agencyName}</p>
                                ) : null}
                                <EliteStatusBadges subject={data.user} isDark compact className="mt-1.5" />
                                <p className="text-[11px] text-white/40 mt-1">ID: {data.user.id}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowDistribution((v) => !v)}
                            className="w-full bg-[#111] border border-white/5 rounded-2xl p-4 text-left hover:border-yellow-500/25 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-4xl font-black text-yellow-500 shrink-0">{averageRating.toFixed(1)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex gap-0.5 mb-1">
                                        {[1,2,3,4,5].map(i => <Star key={i} size={14} className={i <= Math.round(averageRating) ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />)}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{totalReviews} opinii</span>
                                        {showDistribution ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showDistribution ? (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-2 mt-4 pt-3 border-t border-white/5">
                                            {[5, 4, 3, 2, 1].map((stars) => {
                                                const count = distribution[stars as 1|2|3|4|5] || 0;
                                                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                                                return (
                                                    <div key={stars} className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-white/50 w-3">{stars}</span>
                                                        <Star size={10} className="text-white/30 fill-white/30 shrink-0" />
                                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${percentage}%` }}
                                                                transition={{ duration: 0.9, ease: "easeOut" }}
                                                                className="h-full bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white/30 w-4 text-right">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </button>

                        <div>
                            <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 text-center">Historia Prezentacji</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-[#111] border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                                    <CalendarCheck size={18} className="text-emerald-500 mb-1" />
                                    <span className="text-xl font-black text-white">{data.stats.completed}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Odbyte</span>
                                </div>
                                <div className="bg-[#111] border border-yellow-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                                    <CalendarX size={18} className="text-yellow-500 mb-1" />
                                    <span className="text-xl font-black text-white">{data.stats.excused}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Usprawiedl.</span>
                                </div>
                                <div className="bg-[#111] border border-red-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                                    <AlertCircle size={18} className="text-red-500 mb-1" />
                                    <span className="text-xl font-black text-white">{data.stats.noShow}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Brak obecn.</span>
                                </div>
                            </div>
                        </div>

                        {data.offers.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 text-center">Inne oferty ({data.offers.length})</h4>
                                <div className="flex flex-col gap-2">
                                    {data.offers.map((o: any) => (
                                        <Link key={o.id} href={`/oferta/${o.id}`} className="flex items-center gap-3 p-2.5 bg-[#111] hover:bg-[#1a1a1a] border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group">
                                            <div className="w-14 h-14 rounded-lg bg-black overflow-hidden relative shrink-0">
                                                {o.images?.[0] ? <img src={o.images[0]} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="oferta" /> : <Home className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="text-xs font-bold text-white truncate mb-0.5">{o.title || `Oferta ID: ${o.id}`}</h5>
                                                <p className="text-[10px] text-white/50 truncate">{o.district || o.city || 'Polska'}</p>
                                            </div>
                                            <Eye size={14} className="text-emerald-500/60 shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {reviews.length > 0 ? (
                            <div>
                                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 text-center">Opinie</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {reviews.slice(0, 8).map((r: any) => (
                                        <div key={r.id} className="p-3 bg-[#111] border border-white/5 rounded-xl">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(i => <Star key={i} size={10} className={i <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />)}
                                                </div>
                                                <span className="text-[8px] text-white/30 uppercase tracking-widest">{new Date(r.createdAt).toLocaleDateString('pl-PL')}</span>
                                            </div>
                                            <p className="text-xs text-white/70 leading-relaxed">{r.comment || 'Bez komentarza.'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-white/40">Brak opinii dla tego użytkownika.</p>
                        )}

                    </div>
                ) : (
                    <div className="p-10 text-center text-white/50">Nie udało się wczytać profilu.</div>
                )}
            </motion.div>
        </div>
    );

    return createPortal(
        <AnimatePresence>{isOpen && modalContent}</AnimatePresence>,
        document.body
    );
}
