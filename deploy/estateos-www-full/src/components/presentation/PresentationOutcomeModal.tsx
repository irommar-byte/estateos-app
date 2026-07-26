"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarX,
  AlertCircle,
  Info,
  MapPin,
  User,
  Loader2,
} from "lucide-react";
import type { PresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";
import type { PendingPresentationPayload } from "@/lib/appointments/presentationFlowPending";
import PresentationFlowModalShell from "./PresentationFlowModalShell";

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
      }, 900);
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
    iconColor: string;
  }[] = [
    {
      id: "COMPLETED",
      title: o.completedTitle,
      desc: o.completedDesc,
      icon: CalendarCheck,
      border: "border-emerald-500/35",
      active: "ring-emerald-500/45 bg-emerald-500/[0.12]",
      iconColor: "text-emerald-500",
    },
    {
      id: "NO_SHOW",
      title: o.noShowTitle,
      desc: o.noShowDesc,
      icon: AlertCircle,
      border: "border-red-500/35",
      active: "ring-red-500/45 bg-red-500/[0.10]",
      iconColor: "text-red-500",
    },
    {
      id: "CANCELLED",
      title: o.cancelledTitle,
      desc: o.cancelledDesc,
      icon: CalendarX,
      border: "border-amber-500/35",
      active: "ring-amber-500/45 bg-amber-500/[0.10]",
      iconColor: "text-amber-500",
    },
  ];

  const footer =
    done ? null : (
      <div className="space-y-2">
        {error ? <p className="text-center text-[11px] font-bold text-red-500">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)] transition hover:text-[var(--eos-text)]"
          >
            {o.dismiss}
          </button>
          <button
            type="button"
            disabled={!choice || submitting}
            onClick={submit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-gradient-to-b from-emerald-400 to-emerald-600 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-black shadow-[0_10px_28px_rgba(16,185,129,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {submitting ? o.submitting : o.submit}
          </button>
        </div>
      </div>
    );

  return (
    <PresentationFlowModalShell open={open} onClose={onClose} dismissLabel={o.dismiss} footer={footer}>
      <div className="space-y-3 p-4 pr-12 sm:p-5 sm:pr-14">
        <div>
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">{o.badge}</p>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{o.title}</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--eos-muted)]">{o.subtitle}</p>
        </div>

        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-3 text-sm">
          {data.offer ? (
            <div className="flex gap-2.5">
              {data.offer.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.offer.imageUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{data.offer.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--eos-muted)]">
                  <MapPin size={11} /> {data.offer.district || data.offer.city}
                </p>
              </div>
            </div>
          ) : null}
          <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--eos-border)] pt-2.5 text-[11px]">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.dateLabel}</p>
              <p className="font-semibold">{dateStr}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">{o.counterpartyLabel}</p>
              <p className="flex items-center gap-1 font-semibold">
                <User size={11} /> <span className="truncate">{data.counterparty.name}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5 dark:border-sky-400/20 dark:bg-sky-500/[0.08]">
          <Info size={15} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-[11px] leading-snug text-[var(--eos-muted)]">
            <span className="font-semibold text-sky-700 dark:text-sky-300">{o.instructionTitle}. </span>
            {o.instructionBody}
          </p>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <CalendarCheck size={40} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-base font-semibold">{o.successTitle}</p>
            <p className="mt-1 text-[12px] text-[var(--eos-muted)]">
              {choice === "CANCELLED"
                ? "Wizyta oznaczona jako odwołana — bez oceny kontrahenta."
                : o.successBody}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {options.map((opt) => {
                const Icon = opt.icon;
                const selected = choice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChoice(opt.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${opt.border} ${
                      selected
                        ? `ring-2 ${opt.active}`
                        : "bg-[var(--eos-surface)] hover:bg-[var(--eos-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon size={18} className={`mt-0.5 shrink-0 ${selected ? opt.iconColor : "text-[var(--eos-subtle)]"}`} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight">{opt.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--eos-muted)]">{opt.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {choice ? (
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                  {o.noteLabel}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={o.notePlaceholder}
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-[13px] text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-muted)] focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </PresentationFlowModalShell>
  );
}
