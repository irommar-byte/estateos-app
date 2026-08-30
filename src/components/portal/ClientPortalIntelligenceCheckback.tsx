"use client";

import { useState } from "react";
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
  const snap = checkback.marketSnapshot;

  const respond = async (optionId: string) => {
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
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="eos-lux-panel space-y-4 rounded-[1.75rem] border border-amber-400/30 bg-amber-500/5 p-5 sm:p-6">
      <p className="eos-portal-label text-amber-700">Pytanie od asystenta</p>
      <p className="text-sm leading-relaxed text-[var(--eos-text)]">{checkback.body}</p>

      {snap && snap.medianPpsm != null && snap.p25Ppsm != null ? (
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {checkback.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={busy}
            onClick={() => void respond(opt.id)}
            className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--eos-text)] transition hover:border-emerald-400/50 disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
