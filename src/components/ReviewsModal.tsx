"use client";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import EliteStatusBadges from "@/components/ui/EliteStatusBadges";
import { resolveProfileHeadlines } from "@/lib/sellerDisplay";
import EosModal from "@/components/ui/EosModal";

export default function ReviewsModal({ isOpen, onClose, reviewsData, userName, subject }: { isOpen: boolean, onClose: () => void, reviewsData: any, userName: string, subject?: any }) {
  if (!reviewsData) return null;

  const headlines = resolveProfileHeadlines(subject ?? { name: userName });

  const totalReviews = Number(reviewsData.totalReviews || 0);
  const averageRating = totalReviews > 0 ? Number(reviewsData.averageRating || 0) : 0;
  const list = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : [];

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-2xl"
      hideHeader
      hideBodyPadding
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none z-0" />

      <div className="p-6 md:p-8 border-b border-[var(--eos-border)] flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-3xl font-black text-[var(--eos-text)] tracking-tighter mb-1">Opinie o Tobie</h3>
          <p className="text-[var(--eos-muted)] font-bold text-sm">{headlines.primary}</p>
          {headlines.secondary ? (
            <p className="text-[var(--eos-subtle)] font-bold uppercase tracking-widest text-[10px] mt-0.5">{headlines.secondary}</p>
          ) : null}
          <EliteStatusBadges subject={subject} compact className="mt-2" />
        </div>
      </div>

      <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center border-b border-[var(--eos-border)] relative z-10 bg-gradient-to-br from-[var(--eos-input)] to-[var(--eos-card)]">
        <div className="flex flex-col items-center justify-center shrink-0">
          <span className={`text-7xl font-black ${totalReviews > 0 ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'text-[var(--eos-subtle)]'}`}>
            {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
          </span>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={18} className={totalReviews > 0 && s <= Math.round(averageRating) ? "text-yellow-500 fill-yellow-500" : "text-[var(--eos-subtle)]"} />
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            {totalReviews > 0 ? `${totalReviews} Weryfikowanych Opinii` : 'Brak opinii po transakcjach'}
          </span>
        </div>

        <div className="flex-1 w-full space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = reviewsData.distribution?.[stars] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--eos-muted)] w-3">{stars}</span>
                <Star size={10} className="text-[var(--eos-subtle)] fill-white/30 shrink-0" />
                <div className="flex-1 h-1.5 bg-[var(--eos-input)] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                </div>
                <span className="text-[10px] font-bold text-[var(--eos-subtle)] w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 md:p-8 max-h-[40vh] overflow-y-auto custom-scrollbar space-y-4 bg-[var(--eos-bg)] relative z-10">
        {list.length === 0 ? (
          <p className="text-center text-[var(--eos-subtle)] text-sm font-semibold py-8">Jeszcze nikt nie wystawił opinii po zakończonej transakcji.</p>
        ) : null}
        {list.map((r: any) => (
          <div key={r.id} className="bg-[var(--eos-input)] border border-[var(--eos-border)] rounded-2xl p-5 hover:border-yellow-500/20 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-[var(--eos-border)]" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--eos-input)] border border-[var(--eos-border)] flex items-center justify-center text-[10px] font-black text-[var(--eos-muted)]">{r.avatar}</div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-[var(--eos-text)]">{r.author}</h4>
                  <span className="text-[9px] text-[var(--eos-subtle)] uppercase tracking-widest font-bold">{r.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={10} className={s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-[var(--eos-subtle)]"} />
                ))}
              </div>
            </div>
            <p className="text-[var(--eos-muted)] text-sm leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </EosModal>
  );
}
