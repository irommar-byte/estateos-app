"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, CheckCircle2, ShieldCheck, Send } from "lucide-react";

export default function ReviewPrompt() {
  const [pendingReview, setPendingReview] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Sprawdzamy czy są zaległe oceny po 3 sekundach od załadowania strony (dla płynności UX)
    const checkPending = async () => {
      try {
        const res = await fetch('/api/reviews/pending');
        if (res.ok) {
          const data = await res.json();
          if (data.pending) {
            setPendingReview(data.pending);
            setIsOpen(true);
          }
        }
      } catch (e) {}
    };
    
    const timer = setTimeout(checkPending, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: pendingReview.targetId,
          rating,
          comment
        })
      });
      
      if (res.ok) {
        setIsSuccess(true);
        setTimeout(() => setIsOpen(false), 2500); // Zamknij po sukcesie
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !pendingReview) return null;

  return (
    <AnimatePresence>
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }} 
         className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-6"
      >
        <motion.div 
           initial={{ scale: 0.9, y: 50 }} 
           animate={{ scale: 1, y: 0 }} 
           exit={{ scale: 0.9, y: 50 }} 
           transition={{ type: 'spring', damping: 25, stiffness: 300 }}
           className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative text-center"
        >
           {/* Złota poświata */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none"></div>

           <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors z-20">
             <X size={16} />
           </button>

           <div className="p-8 md:p-10 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#111] border border-yellow-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(234,179,8,0.15)]">
                 <ShieldCheck size={28} className="text-yellow-500" />
              </div>
              
              <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Podsumowanie Wizyty</h2>
              <p className="text-white/50 text-sm mb-8 leading-relaxed">
                 Spotkałeś się niedawno z inwestorem <strong className="text-white">{pendingReview.targetName}</strong>. Jak oceniasz przebieg prezentacji i komunikację?
              </p>

              {isSuccess ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center py-6">
                  <CheckCircle2 size={60} className="text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] mb-4" />
                  <h3 className="text-xl font-bold text-white mb-1">Opinia zapisana</h3>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-bold">Dziękujemy za budowanie zaufania</p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {/* Interaktywne gwiazdki */}
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star 
                          size={36} 
                          className={`transition-all duration-300 ${
                            star <= (hoverRating || rating) 
                              ? "text-yellow-500 fill-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" 
                              : "text-white/10 fill-white/5"
                          }`} 
                        />
                      </button>
                    ))}
                  </div>

                  {/* Pole na komentarz */}
                  <motion.div 
                    initial={false} 
                    animate={{ height: rating > 0 ? 'auto' : 0, opacity: rating > 0 ? 1 : 0 }} 
                    className="overflow-hidden"
                  >
                    <textarea 
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Napisz dyskretną opinię o kontrahencie (opcjonalnie)..."
                      className="w-full bg-[#111] border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-yellow-500/50 transition-colors resize-none h-28 custom-scrollbar mt-4"
                    />
                    
                    <button 
                      onClick={handleSubmit} 
                      disabled={isSubmitting || rating === 0}
                      className="mt-4 w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isSubmitting ? 'Przesyłanie...' : <><Send size={14} /> Opublikuj Opinię</>}
                    </button>
                  </motion.div>
                </div>
              )}
           </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
