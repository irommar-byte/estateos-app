"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";

export default function ReviewsModal({ isOpen, onClose, reviewsData, userName }: { isOpen: boolean, onClose: () => void, reviewsData: any, userName: string }) {
  if (!isOpen || !reviewsData) return null;

  return (
    <AnimatePresence>
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }} 
         className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-6" 
         onClick={onClose}
      >
        <motion.div 
           initial={{ scale: 0.95, y: 20 }} 
           animate={{ scale: 1, y: 0 }} 
           exit={{ scale: 0.95, y: 20 }} 
           onClick={e => e.stopPropagation()} 
           className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative"
        >
           {/* Tło Modalu */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none z-0"></div>

           <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-start relative z-10">
              <div>
                 <h3 className="text-3xl font-black text-white tracking-tighter mb-1">Opinie o Tobie</h3>
                 <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">{userName}</p>
              </div>
              <button onClick={onClose} className="p-3 bg-white/5 hover:bg-red-500 hover:text-white rounded-full transition-colors text-white/50"><X size={20}/></button>
           </div>
           
           <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center border-b border-white/5 relative z-10 bg-gradient-to-br from-[#111] to-[#0a0a0a]">
              {/* Sekcja Średniej Oceny */}
              <div className="flex flex-col items-center justify-center shrink-0">
                 <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">{reviewsData.averageRating.toFixed(1)}</span>
                 <div className="flex items-center gap-1 my-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                       <Star key={s} size={18} className={s <= Math.round(reviewsData.averageRating) ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />
                    ))}
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{reviewsData.totalReviews} Weryfikowanych Opinii</span>
              </div>
              
              {/* Paski Dystrybucji */}
              <div className="flex-1 w-full space-y-2">
                 {[5, 4, 3, 2, 1].map((stars) => {
                    const count = reviewsData.distribution[stars] || 0;
                    const percentage = reviewsData.totalReviews > 0 ? (count / reviewsData.totalReviews) * 100 : 0;
                    return (
                       <div key={stars} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-white/50 w-3">{stars}</span>
                          <Star size={10} className="text-white/30 fill-white/30 shrink-0" />
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></motion.div>
                          </div>
                          <span className="text-[10px] font-bold text-white/30 w-4 text-right">{count}</span>
                       </div>
                    );
                 })}
              </div>
           </div>

           <div className="p-6 md:p-8 max-h-[40vh] overflow-y-auto custom-scrollbar space-y-4 bg-[#050505] relative z-10">
              {reviewsData.reviews.map((r: any) => (
                 <div key={r.id} className="bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-yellow-500/20 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/70">{r.avatar}</div>
                          <div>
                             <h4 className="text-sm font-bold text-white">{r.author}</h4>
                             <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{r.date}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                             <Star key={s} size={10} className={s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-white/10"} />
                          ))}
                       </div>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{r.text}</p>
                 </div>
              ))}
           </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
