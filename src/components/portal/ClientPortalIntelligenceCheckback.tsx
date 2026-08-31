"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { formatPln, formatPpsm } from "@/lib/market/format";

export type PortalPendingCheckback = {
  activityId: number;
  type: string;
  body: string;
  options: Array<{ id: string; label: string }>;
  marketSnapshot?: {
    impliedPpsm?: number;
    medianPpsm?: number | null;
    p25Ppsm?: number | null;
    txnCount?: number;
    periodDays?: number;
    districtLabel?: string;
    maxPrice?: number;
    area?: number;
    source?: string;
  } | null;
  createdAt: string;
};

export default function ClientPortalIntelligenceCheckback({
  token,
  checkback,
  onDone,
}: {
  token: string;
  checkback: PortalPendingCheckback;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const snap = checkback.marketSnapshot;

  const respond = async (optionId: string) => {
    setPicked(optionId);
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "intelligence_checkback",
          activityId: checkback.activityId,
          optionId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać");
      onDone();
    } catch (e) {
      setPicked(null);
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="portal-checkback"
      className="portal-checkback relative scroll-mt-24 overflow-hidden rounded-[1.85rem] p-5 sm:p-6"
      aria-labelledby="portal-checkback-title"
      aria-live="polite"
    >
      <div className="portal-checkback__glow pointer-events-none absolute inset-0" aria-hidden />
      <span className="portal-checkback__halo pointer-events-none absolute -left-16 -top-16 size-44 rounded-full" aria-hidden />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="portal-checkback__icon relative flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <span className="portal-checkback__ring" aria-hidden />
            <span className="portal-checkback__ring portal-checkback__ring--delayed" aria-hidden />
            <MessageCircleQuestion className="relative size-5" strokeWidth={2.25} />
          </span>
          <span className="portal-checkback__badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
            <span className="eos-live-dot eos-live-dot--amber shrink-0" aria-hidden />
            Wymaga Twojej odpowiedzi
          </span>
        </div>

        <h2 id="portal-checkback-title" className="mt-3 text-xl font-black tracking-tight text-[var(--eos-text)] sm:text-2xl">
          Pytanie od asystenta
        </h2>
        <p className="portal-checkback__hint mt-1 text-sm font-semibold leading-relaxed">
          Wybierz jedną opcję poniżej — bez tego asystent nie wyśle kolejnej oferty.
        </p>

        <p className="mt-4 text-[15px] leading-relaxed text-[var(--eos-text)] sm:text-base">
          {checkback.body}
        </p>

        {snap && snap.medianPpsm != null && snap.p25Ppsm != null ? (
          <div className="portal-checkback__proof mt-4 rounded-2xl p-4 text-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
              Dowód — transakcje notarialne (RCN)
            </p>
            <ul className="mt-3 space-y-1.5 text-[var(--eos-text)]">
              <li>
                {snap.districtLabel} · {snap.txnCount} aktów · {snap.periodDays} dni
              </li>
              <li>Mediana: {formatPpsm(snap.medianPpsm)}</li>
              <li>Dolny kwartyl: {formatPpsm(snap.p25Ppsm)}</li>
              {snap.maxPrice && snap.area ? (
                <li>
                  Twój budżet {formatPln(snap.maxPrice)} przy {snap.area} m² ≈{" "}
                  {formatPpsm(snap.impliedPpsm || snap.maxPrice / snap.area)}
                </li>
              ) : null}
              {snap.source ? <li className="text-xs text-[var(--eos-muted)]">{snap.source}</li> : null}
            </ul>
          </div>
        ) : null}

        <p className="eos-portal-label mt-5 mb-2">Twoja decyzja</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {checkback.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => void respond(opt.id)}
              className={`portal-checkback__choice min-h-[3.4rem] rounded-2xl px-4 py-3 text-left text-sm font-bold leading-snug disabled:opacity-50 ${
                picked === opt.id ? "portal-checkback__choice--on" : ""
              }`}
            >
              {busy && picked === opt.id ? "Wysyłam…" : opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
