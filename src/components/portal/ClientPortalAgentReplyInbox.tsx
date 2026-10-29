"use client";

import { portalToast } from "@/lib/portalUi";
import { useState } from "react";
import type { AgentOfferReplyCard } from "@/lib/crm/clientPortalFeedback";
import { usePortalLocale } from "@/components/portal/PortalLocale";

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
  const { t, p, dateLocale } = usePortalLocale();
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
      if (!res.ok) throw new Error(String(json?.error || t("Nie udało się potwierdzić odczytu.")));
      onDone();
      if (openAfter) onOpenOffer(matchId);
    } catch (error) {
      portalToast.error(t("Nie udało się potwierdzić odczytu."), error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="lux-card lux-card--gold p-5 sm:p-6">
      <p className="lux-kicker">
        {t("Wymaga Twojej reakcji")} · {unread.length} {p(unread.length, "odpowiedź agenta|odpowiedzi agenta|odpowiedzi agenta")}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
        {t("Agent odpisał przy konkretnej ofercie.")}
      </p>
      <div className="mt-4 space-y-3">
        {unread.map((item) => (
          <article key={item.matchId} className="rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] p-4">
            <p className="text-[12px] font-bold text-[var(--lux-ink)]">{item.offerTitle}</p>
            {item.clientNote ? (
              <div className="mt-3 rounded-xl bg-[var(--lux-well)] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lux-ink-3)]">{t("Twoje pytanie")}</p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--lux-ink)]">{item.clientNote}</p>
              </div>
            ) : null}
            <div className="mt-3 rounded-xl border border-[var(--lux-gold-line)] bg-[var(--lux-gold-soft)] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lux-gold-ink)]">{t("Odpowiedź agenta")}</p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--lux-ink)]">{item.agentReply}</p>
              {item.agentReplyAt ? (
                <p className="mt-1.5 text-[11px] text-[var(--lux-ink-3)]">
                  {new Date(item.agentReplyAt).toLocaleString(dateLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === item.matchId} onClick={() => void ack(item.matchId)} className="lux-btn lux-btn--ink disabled:opacity-60">
                {busyId === item.matchId ? t("Zapisuję…") : t("Przeczytałem")}
              </button>
              <button type="button" disabled={busyId === item.matchId} onClick={() => void ack(item.matchId, true)} className="lux-btn lux-btn--ghost disabled:opacity-60">
                {t("Otwórz ofertę")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
