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
      setTimeout(onSuccess, 1600);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const footer = done ? null : (
    <div className="space-y-2">
      {error ? <p className="text-center text-[11px] font-bold text-red-500">{error}</p> : null}
      <button
        type="button"
        disabled={rating < 1 || submitting}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-b from-amber-400 to-amber-600 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-black shadow-[0_10px_28px_rgba(245,158,11,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
        {submitting ? r.submitting : r.submit}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-1.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]"
      >
        {r.dismiss}
      </button>
    </div>
  );

  return (
    <PresentationFlowModalShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      dismissLabel={r.dismiss}
      footer={footer}
    >
      <div className="space-y-3.5 p-4 pr-12 text-center sm:p-5 sm:pr-14">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <ShieldCheck size={24} className="text-amber-500" />
        </div>

        <div>
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">{r.badge}</p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{r.title}</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--eos-muted)]">
            {fmtPresentation(r.subtitle, { name: data.counterparty.name })}
          </p>
        </div>

        <div className="flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5 text-left">
          <Info size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              {r.instructionTitle}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--eos-muted)]">{r.instructionBody}</p>
          </div>
        </div>

        {done ? (
          <div className="py-5">
            <CheckCircle2 size={44} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-base font-semibold">{r.successTitle}</p>
            <p className="mt-1 text-[12px] text-[var(--eos-muted)]">{r.successBody}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(star)}
                  className="rounded-lg p-1 transition-transform hover:scale-110"
                  aria-label={`${star}`}
                >
                  <Star
                    size={32}
                    className={
                      star <= (hover || rating)
                        ? "fill-amber-500 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                        : "fill-[var(--eos-surface)] text-[var(--eos-border)]"
                    }
                  />
                </button>
              ))}
            </div>

            {rating === 0 ? (
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                {r.starsRequired}
              </p>
            ) : null}

            <div className="text-left">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                {r.commentLabel}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder={r.commentPlaceholder}
                rows={3}
                disabled={rating < 1}
                className="mt-1.5 w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-[13px] text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-muted)] focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15 disabled:opacity-50"
              />
              <p className="mt-1 text-[10px] text-[var(--eos-subtle)]">{r.commentHint}</p>
            </div>
          </>
        )}
      </div>
    </PresentationFlowModalShell>
  );
}
