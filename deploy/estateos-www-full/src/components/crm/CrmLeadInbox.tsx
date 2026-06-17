"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, CheckCircle2, Loader2, Percent, Send, XCircle } from "lucide-react";

type Lead = {
  id: number;
  offerId: number;
  ownerId: number;
  agencyId: number;
  status: string;
  commissionRate: number | null;
  commissionTerms: string | null;
  createdAt: string;
};

type Props = {
  leads: Lead[];
  isAgency: boolean;
  currentUserId?: number;
  onRefresh?: () => void;
};

export default function CrmLeadInbox({ leads, isAgency, currentUserId, onRefresh }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [commission, setCommission] = useState<Record<number, string>>({});
  const [terms, setTerms] = useState<Record<number, string>>({});

  const pending = leads.filter((l) =>
    isAgency
      ? ["PENDING", "USER_COUNTER"].includes(l.status)
      : ["TERMS_PROPOSED", "USER_COUNTER"].includes(l.status),
  );

  const proposeTerms = async (leadId: number) => {
    setBusy(leadId);
    try {
      await fetch("/api/concierge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status: "TERMS_PROPOSED",
          commissionRate: commission[leadId] || "2.5",
          commissionTerms: terms[leadId] || "Pełna obsługa sprzedaży, sesja zdjęciowa, prezentacje.",
        }),
      });
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  const acceptTransfer = async (leadId: number) => {
    setBusy(leadId);
    try {
      const res = await fetch("/api/concierge/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Nie udało się zaakceptować.");
      onRefresh?.();
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div className="mb-8 rounded-[2rem] border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <Briefcase className="size-5 text-amber-400" />
        <h3 className="text-lg font-black tracking-tight text-white">
          {isAgency ? "Zapytania o przejęcie ofert" : "Przekazanie do agencji"}
        </h3>
      </div>
      <div className="space-y-4">
        {pending.map((lead) => (
          <div
            key={lead.id}
            className="rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
              Oferta #{lead.offerId} · {lead.status}
            </p>
            {isAgency ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="10"
                    placeholder="Prowizja %"
                    value={commission[lead.id] ?? ""}
                    onChange={(e) => setCommission((p) => ({ ...p, [lead.id]: e.target.value }))}
                    className="w-28 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Zakres usług"
                    value={terms[lead.id] ?? ""}
                    onChange={(e) => setTerms((p) => ({ ...p, [lead.id]: e.target.value }))}
                    className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy === lead.id}
                  onClick={() => void proposeTerms(lead.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                >
                  {busy === lead.id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  Wyślij warunki
                </button>
              </div>
            ) : (
              <div className="mt-3">
                {lead.commissionRate != null ? (
                  <p className="flex items-center gap-2 text-sm text-white">
                    <Percent className="size-4 text-emerald-400" />
                    Propozycja prowizji: <strong>{lead.commissionRate}%</strong>
                  </p>
                ) : null}
                {lead.commissionTerms ? (
                  <p className="mt-2 text-sm text-[var(--eos-muted)]">{lead.commissionTerms}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === lead.id}
                    onClick={() => void acceptTransfer(lead.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Akceptuję — przekazuję agencji
                  </button>
                  <Link
                    href={`/oferta/${lead.offerId}`}
                    className="rounded-full border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white/80"
                  >
                    Podgląd oferty
                  </Link>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--eos-subtle)]">
                  Po akceptacji agencja przejmuje kontakt z kupującymi. Ty zachowujesz podgląd statystyk i zmian ceny.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
