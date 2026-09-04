"use client";

import { useState } from "react";
import type { AgentOfferReplyCard } from "@/lib/crm/clientPortalFeedback";

export default function ClientPortalAgentReplyInbox({
  token,
  replies,
  onOpenOffer,
  onDone,
}: {
  token: string;
  replies: AgentOfferReplyCard[];
  onOpenOffer: (matchId: number) => void;
  onDone: () => void;
}) {
  const unread = replies.filter((item) => item.unread);
  const [busyId, setBusyId] = useState<number | null>(null);
  if (!unread.length) return null;

  const ack = async (matchId: number, openAfter?: boolean) => {
    setBusyId(matchId);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack_agent_reply", matchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się potwierdzić odczytu."));
      onDone();
      if (openAfter) onOpenOffer(matchId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-[1.75rem] border border-amber-400/70 bg-amber-500/12 p-5 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">
        Wymaga Twojej reakcji · {unread.length}{" "}
        {unread.length === 1 ? "odpowiedź agenta" : "odpowiedzi agenta"}
      </p>
      <p className="mt-1 text-sm text-[var(--eos-muted)]">
        Agent odpisał przy konkretnej ofercie — przeczytaj odpowiedź tutaj, nie w czacie.
      </p>
      <div className="mt-4 space-y-3">
        {unread.map((item) => (
          <article
            key={item.matchId}
            className="rounded-2xl border border-amber-300/60 bg-[var(--eos-card,#fff)] p-4"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
              Do przeczytania · {item.offerTitle}
            </p>
            {item.clientNote ? (
              <div className="mt-3 rounded-xl bg-[rgba(15,23,42,0.04)] px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                  Twoje pytanie
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-text)]">
                  {item.clientNote}
                </p>
              </div>
            ) : null}
            <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                Odpowiedź agenta
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-text)]">
                {item.agentReply}
              </p>
              {item.agentReplyAt ? (
                <p className="mt-1.5 text-[10px] text-[var(--eos-muted)]">
                  {new Date(item.agentReplyAt).toLocaleString("pl-PL")}
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === item.matchId}
                onClick={() => void ack(item.matchId)}
                className="inline-flex min-h-10 items-center rounded-full bg-amber-500 px-4 text-[12px] font-black text-black disabled:opacity-60"
              >
                {busyId === item.matchId ? "Zapisuję…" : "Przeczytałem"}
              </button>
              <button
                type="button"
                disabled={busyId === item.matchId}
                onClick={() => void ack(item.matchId, true)}
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 text-[12px] font-black text-[var(--eos-text)] disabled:opacity-60"
              >
                Otwórz ofertę
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
