"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck,
  CalendarX,
  AlertCircle,
  Info,
  MapPin,
  User,
  X,
  Loader2,
} from "lucide-react";
import type { PresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";
import type { PendingPresentationPayload } from "@/lib/appointments/presentationFlowPending";

type Props = {
  open: boolean;
  data: PendingPresentationPayload["appointment"];
  t: PresentationFlowDictionary;
  onClose: () => void;
  onSuccess: () => void;
};

type OutcomeChoice = "COMPLETED" | "NO_SHOW" | "CANCELLED";

export default function PresentationOutcomeModal({ open, data, t, onClose, onSuccess }: Props) {
  const [choice, setChoice] = useState<OutcomeChoice | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const o = t.outcome;
  const dateStr = new Date(data.proposedDate).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${data.id}/outcome`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: choice, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "TOO_EARLY") setError(o.tooEarlyBody);
        else setError(json.error || "Error");
        return;
      }
      setDone(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const options: {
    id: OutcomeChoice;
    title: string;
    desc: string;
    icon: typeof CalendarCheck;
    border: string;
    active: string;
  }[] = [
    {
      id: "COMPLETED",
      title: o.completedTitle,
      desc: o.completedDesc,
      icon: CalendarCheck,
      border: "border-emerald-500/30",
      active: "ring-emerald-500/50 bg-emerald-500/10",
    },
    {
      id: "NO_SHOW",
      title: o.noShowTitle,
      desc: o.noShowDesc,
      icon: AlertCircle,
      border: "border-red-500/30",
      active: "ring-red-500/50 bg-red-500/10",
    },
    {
      id: "CANCELLED",
      title: o.cancelledTitle,
      desc: o.cancelledDesc,
      icon: CalendarX,
      border: "border-amber-500/30",
      active: "ring-amber-500/50 bg-amber-500/10",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200000] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md"
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="theme-aware-dashboard relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-2xl text-[var(--eos-text)]"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-[var(--eos-bg)] border border-[var(--eos-border)] flex items-center justify-center text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            aria-label={o.dismiss}
          >
            <X size={18} />
          </button>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">{o.badge}</p>
              <h2 className="text-2xl font-black tracking-tight">{o.title}</h2>
              <p className="text-sm text-[var(--eos-muted)] mt-2 leading-relaxed">{o.subtitle}</p>
            </div>

            <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/80 p-4 space-y-3 text-sm">
              {data.offer ? (
                <div className="flex gap-3">
                  {data.offer.imageUrl ? (
                    <img src={data.offer.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.offerLabel}</p>
                    <p className="font-bold truncate">{data.offer.title}</p>
                    <p className="text-[11px] text-[var(--eos-muted)] flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {data.offer.district || data.offer.city}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--eos-border)]">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.dateLabel}</p>
                  <p className="font-bold">{dateStr}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.counterpartyLabel}</p>
                  <p className="font-bold flex items-center gap-1">
                    <User size={12} /> {data.counterparty.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
              <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{o.instructionTitle}</p>
                <p className="text-xs text-[var(--eos-muted)] leading-relaxed">{o.instructionBody}</p>
              </div>
            </div>

            {done ? (
              <div className="text-center py-6">
                <CalendarCheck size={48} className="mx-auto text-emerald-500 mb-3" />
                <p className="font-black text-lg">{o.successTitle}</p>
                <p className="text-sm text-[var(--eos-muted)] mt-2">{o.successBody}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {options.map((opt) => {
                    const Icon = opt.icon;
                    const selected = choice === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChoice(opt.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${opt.border} ${
                          selected ? `ring-2 ${opt.active}` : "bg-[var(--eos-bg)] hover:border-[var(--eos-muted)]"
                        }`}
                      >
                        <div className="flex gap-3">
                          <Icon size={22} className={selected ? "text-[var(--eos-text)]" : "text-[var(--eos-subtle)]"} />
                          <div>
                            <p className="font-black text-sm">{opt.title}</p>
                            <p className="text-xs text-[var(--eos-muted)] mt-1 leading-snug">{opt.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {choice ? (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.noteLabel}</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={o.notePlaceholder}
                      className="mt-2 w-full rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm text-[var(--eos-text)] placeholder:text-[var(--eos-muted)] outline-none focus:border-emerald-500/50 min-h-[80px] resize-none"
                    />
                  </div>
                ) : null}

                {error ? <p className="text-xs text-red-400 font-bold">{error}</p> : null}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3.5 rounded-2xl border border-[var(--eos-border)] text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]"
                  >
                    {o.dismiss}
                  </button>
                  <button
                    type="button"
                    disabled={!choice || submitting}
                    onClick={submit}
                    className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {submitting ? o.submitting : o.submit}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
