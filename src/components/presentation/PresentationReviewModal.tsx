"use client";

import { useState } from "react";
import { Star, ShieldCheck, Send, Loader2, Info, CheckCircle2 } from "lucide-react";
import type { PresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";
import { fmtPresentation } from "@/i18n/presentationFlowDictionary";
import type { PendingPresentationPayload } from "@/lib/appointments/presentationFlowPending";
import PresentationFlowModalShell from "./PresentationFlowModalShell";

type Props = {
  open: boolean;
  data: PendingPresentationPayload["appointment"];
  t: PresentationFlowDictionary;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PresentationReviewModal({ open, data, t, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const r = t.review;

  const submit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: data.id,
          dealId: data.dealId,
          targetId: data.counterparty.id,
          rating,
          comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error");
        return;
      }
      setDone(true);
      setTimeout(onSuccess, 2000);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <PresentationFlowModalShell open={open} onClose={onClose} maxWidth="max-w-md" dismissLabel={r.dismiss}>
      <div className="space-y-5 p-6 text-center sm:p-8">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck size={28} className="text-amber-500" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">{r.badge}</p>
              <h2 className="text-xl font-black">{r.title}</h2>
              <p className="text-sm text-[var(--eos-muted)] mt-2 leading-relaxed">
                {fmtPresentation(r.subtitle, { name: data.counterparty.name })}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/80 p-4 text-left flex gap-3">
              <Info size={18} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{r.instructionTitle}</p>
                <p className="text-xs text-[var(--eos-muted)] mt-1 leading-relaxed">{r.instructionBody}</p>
              </div>
            </div>

            {done ? (
              <div className="py-6">
                <CheckCircle2 size={52} className="mx-auto text-emerald-500 mb-3" />
                <p className="font-black text-lg">{r.successTitle}</p>
                <p className="text-sm text-[var(--eos-muted)] mt-2">{r.successBody}</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        size={36}
                        className={
                          star <= (hover || rating)
                            ? "text-amber-500 fill-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                            : "text-[var(--eos-border)] fill-[var(--eos-bg)]"
                        }
                      />
                    </button>
                  ))}
                </div>
                {rating === 0 ? (
                  <p className="text-[10px] font-bold text-[var(--eos-subtle)] uppercase tracking-widest">{r.starsRequired}</p>
                ) : (
                  <div className="text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{r.commentLabel}</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, 500))}
                      placeholder={r.commentPlaceholder}
                      className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm min-h-[100px] resize-none outline-none focus:border-amber-500/40"
                    />
                    <p className="text-[10px] text-[var(--eos-subtle)] mt-2">{r.commentHint}</p>
                  </div>
                )}

                {error ? <p className="text-xs text-red-400 font-bold">{error}</p> : null}

                <button
                  type="button"
                  disabled={rating < 1 || submitting}
                  onClick={submit}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black uppercase tracking-widest text-[10px] disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? r.submitting : r.submit}
                </button>
                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                  {r.dismiss}
                </button>
              </>
            )}
      </div>
    </PresentationFlowModalShell>
  );
}
