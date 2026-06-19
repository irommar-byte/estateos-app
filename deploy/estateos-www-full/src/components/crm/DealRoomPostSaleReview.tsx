"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  buildDealReviewPayload,
  encodeDealReviewMessage,
} from "@/lib/dealroomReviewMessage";
import { resolveCounterpartyLabel } from "@/lib/sellerDisplay";

type Props = {
  dealId: number;
  currentUserId: number;
  counterparty: {
    id: number;
    name?: string | null;
    email?: string | null;
    companyName?: string | null;
    role?: string | null;
    planType?: string | null;
  };
  myReviewSubmitted: boolean;
  partnerReviewVisible: boolean;
  partnerReview: { rating: number; comment?: string | null } | null;
  reviewRevealUnlocked: boolean;
  authHeaders: (json?: boolean) => Record<string, string>;
  onUpdated: () => void;
};

export default function DealRoomPostSaleReview({
  dealId,
  currentUserId,
  counterparty,
  myReviewSubmitted,
  partnerReviewVisible,
  partnerReview,
  reviewRevealUnlocked,
  authHeaders,
  onUpdated,
}: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const counterpartyLabel = useMemo(
    () => resolveCounterpartyLabel(counterparty),
    [counterparty],
  );

  const submitted = myReviewSubmitted || localSubmitted;

  const submitReview = async () => {
    if (submitting || submitted) return;
    if (rating < 1 || rating > 5) {
      alert("Wybierz ocenę od 1 do 5 gwiazdek.");
      return;
    }
    const payload = buildDealReviewPayload({
      dealId,
      targetId: Number(counterparty.id),
      rating,
      review: comment.trim(),
      senderId: currentUserId,
    });
    if (!payload) {
      alert("Nie udało się przygotować opinii.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(true),
        body: JSON.stringify({
          dealId: payload.dealId,
          targetId: payload.targetId,
          rating: payload.rating,
          review: payload.review || "",
          comment: payload.review || "",
          senderId: currentUserId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const duplicate =
        res.status === 409 ||
        String(data?.error || "")
          .toLowerCase()
          .includes("już");
      if (!res.ok && !duplicate) {
        throw new Error(data?.error || "Nie udało się zapisać opinii.");
      }

      await fetch(`/api/deals/${dealId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(true),
        body: JSON.stringify({
          content: encodeDealReviewMessage(payload),
          senderId: currentUserId,
        }),
      }).catch(() => {
        // wpis w wątku jest pomocniczy — sama ocena w bazie ma pierwszeństwo
      });

      setLocalSubmitted(true);
      onUpdated();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Nie udało się wysłać opinii.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-5 md:p-6">
      <p className="text-[10px] uppercase tracking-[0.24em] font-black text-emerald-300">
        Transakcja zakończona
      </p>
      <p className="text-sm text-white/85 mt-2 leading-relaxed">
        Oceń współpracę z <span className="font-bold text-white">{counterpartyLabel}</span>.
        Twoja opinia pomoże innym użytkownikom i odblokuje ocenę drugiej strony.
      </p>

      {submitted ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-4 py-2">
          <span className="text-emerald-300 font-black">✓</span>
          <span className="text-sm font-bold text-emerald-200">Opinia została wystawiona</span>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                aria-label={`Oceń na ${star}`}
              >
                <Star
                  size={28}
                  className={star <= rating ? "text-amber-400 fill-amber-400" : "text-white/25"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Opcjonalny komentarz o współpracy…"
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-500/40 resize-none"
          />
          <button
            type="button"
            onClick={() => void submitReview()}
            disabled={submitting || rating < 1}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-widest text-black disabled:opacity-45"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Wyślij opinię
          </button>
        </div>
      )}

      {partnerReviewVisible && reviewRevealUnlocked && partnerReview ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] uppercase tracking-widest font-black text-white/45 mb-2">
            Opinia {counterpartyLabel}
          </p>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                className={
                  star <= Number(partnerReview.rating || 0)
                    ? "text-amber-400 fill-amber-400"
                    : "text-white/20"
                }
              />
            ))}
          </div>
          {partnerReview.comment ? (
            <p className="text-sm text-white/80 leading-relaxed">„{partnerReview.comment}”</p>
          ) : (
            <p className="text-sm text-white/50">Bez komentarza.</p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-white/45 leading-relaxed">
          {submitted
            ? "Ocena drugiej strony pojawi się po jej opinii lub po 14 dniach od finalizacji."
            : "Druga strona zobaczy Twoją opinię dopiero po wystawieniu własnej lub po 14 dniach."}
        </p>
      )}
    </div>
  );
}
