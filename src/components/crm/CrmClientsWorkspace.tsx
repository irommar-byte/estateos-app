"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users,
  UserPlus,
  ShoppingBag,
  Home,
  Mail,
  Phone,
  Target,
  Send,
  RefreshCcw,
  FileText,
  ChevronRight,
  X,
  Sparkles,
  BarChart3,
} from "lucide-react";
import AgencyClientFormModal from "@/components/crm/AgencyClientFormModal";
import { useLocale } from "@/contexts/LocaleContext";
import type { AgencyClientListItem } from "@/lib/agencyClientShape";

type ClientDetail = AgencyClientListItem & {
  notes?: string | null;
  sellerDescription?: string | null;
  sellerArea?: number | null;
  sellerRooms?: number | null;
  sellerDistrict?: string | null;
  sellerTransactionType?: string | null;
  matches?: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    offer: {
      id: number;
      title: string;
      price: number;
      city: string;
      district: string;
      area: number;
      imageUrl: string;
    };
  }>;
  activities?: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
  }>;
};

type Report = {
  buyers: number;
  sellers: number;
  totalMatches: number;
  outreachLast30Days: number;
  topMatches: Array<{
    clientName: string;
    offerTitle: string;
    score: number;
    offerId: number;
  }>;
};

export default function CrmClientsWorkspace() {
  const { dict } = useLocale();
  const cl = dict.crmClients;
  const [segment, setSegment] = useState<"BUYER" | "SELLER">("BUYER");
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, reportRes] = await Promise.all([
        fetch(`/api/crm/clients?type=${segment}`, { cache: "no-store" }),
        fetch("/api/crm/clients?report=1", { cache: "no-store" }),
      ]);
      const listJson = await listRes.json();
      const reportJson = await reportRes.json();
      if (listJson.success) setClients(listJson.clients || []);
      if (reportJson.success) setReport(reportJson.report);
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/crm/clients/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setDetail(json.client);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(
    () => clients.filter((c) => c.type === segment),
    [clients, segment],
  );

  const notifyOffer = async (offerId: number, withEmail: boolean) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify_offer",
          offerId,
          channel: withEmail ? "email" : "manual",
        }),
      });
      await loadDetail(selectedId);
      await loadClients();
    } finally {
      setBusy(false);
    }
  };

  const refreshMatches = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_matches" }),
      });
      await loadDetail(selectedId);
      await loadClients();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: cl.statsBuyers, value: report?.buyers ?? "—", icon: ShoppingBag },
          { label: cl.statsSellers, value: report?.sellers ?? "—", icon: Home },
          { label: cl.statsMatches, value: report?.totalMatches ?? "—", icon: Target },
          { label: cl.statsOutreach, value: report?.outreachLast30Days ?? "—", icon: Send },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/80 p-5 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl"
          >
            <card.icon className="mb-3 size-5 text-emerald-500" />
            <p className="text-2xl font-black tabular-nums text-[var(--eos-text)]">{card.value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-muted)]">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] p-1">
          {(["BUYER", "SELLER"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                segment === key
                  ? "bg-emerald-500 text-black shadow-[0_8px_24px_rgba(16,185,129,0.25)]"
                  : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
              }`}
            >
              {key === "BUYER" ? cl.segmentBuyers : cl.segmentSellers}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-emerald-300 to-emerald-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-black shadow-[0_12px_32px_rgba(16,185,129,0.28)] transition hover:scale-[1.02]"
        >
          <UserPlus className="size-4" />
          {cl.addClient}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 p-10 text-center">
              <Users className="mx-auto mb-4 size-10 text-emerald-500/70" />
              <p className="text-lg font-semibold text-[var(--eos-text)]">{cl.emptyTitle}</p>
              <p className="mt-2 text-sm text-[var(--eos-muted)]">{cl.emptyBody}</p>
            </div>
          ) : (
            filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedId(client.id)}
                className={`w-full rounded-[1.5rem] border p-5 text-left transition ${
                  selectedId === client.id
                    ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                    : "border-[var(--eos-border)] bg-[var(--eos-card)]/70 hover:border-emerald-500/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[var(--eos-text)]">
                      {client.firstName} {client.lastName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--eos-muted)]">
                      {client.email ? <span className="inline-flex items-center gap-1"><Mail className="size-3" />{client.email}</span> : null}
                      {client.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3" />{client.phone}</span> : null}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-[var(--eos-muted)]" />
                </div>
                {client.type === "BUYER" && client.matchCount > 0 ? (
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
                    {cl.matchCountLabel.replace("{n}", String(client.matchCount))}
                    {client.topMatchScore ? ` · ${client.topMatchScore}%` : ""}
                  </p>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/80 p-6 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl min-h-[420px]">
          {!selectedId ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
              <Sparkles className="mb-4 size-10 text-emerald-500/60" />
              <p className="text-lg font-semibold text-[var(--eos-text)]">{cl.selectClientTitle}</p>
              <p className="mt-2 max-w-sm text-sm text-[var(--eos-muted)]">{cl.selectClientBody}</p>
            </div>
          ) : detailLoading || !detail ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {detail.type === "BUYER" ? cl.buyerBadge : cl.sellerBadge}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[var(--eos-text)]">
                    {detail.firstName} {detail.lastName}
                  </h3>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]">
                  <X className="size-4" />
                </button>
              </div>

              {detail.notes ? (
                <p className="rounded-2xl bg-[var(--eos-input)]/80 p-4 text-sm leading-relaxed text-[var(--eos-muted)]">
                  {detail.notes}
                </p>
              ) : null}

              {detail.type === "BUYER" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void refreshMatches()}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
                    >
                      <RefreshCcw className="size-3.5" />
                      {cl.refreshMatches}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                      {cl.matchesTitle}
                    </p>
                    {(detail.matches || []).length === 0 ? (
                      <p className="text-sm text-[var(--eos-muted)]">{cl.noMatches}</p>
                    ) : (
                      (detail.matches || []).map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4 sm:flex-row sm:items-center"
                        >
                          <div
                            className="h-16 w-20 shrink-0 rounded-xl bg-cover bg-center"
                            style={{ backgroundImage: `url(${m.offer.imageUrl})` }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[var(--eos-text)]">{m.offer.title}</p>
                            <p className="text-xs text-[var(--eos-muted)]">
                              {m.offer.city} · {Math.round(m.offer.price).toLocaleString("pl-PL")} zł · {m.score}%
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void notifyOffer(m.offer.id, true)}
                              className="rounded-full bg-emerald-500 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black"
                            >
                              {cl.sendEmail}
                            </button>
                            <Link
                              href={`/oferta/${m.offer.id}`}
                              className="rounded-full border border-[var(--eos-border)] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[var(--eos-text)]"
                            >
                              {cl.viewOffer}
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3 rounded-2xl border border-[var(--eos-border)] p-4">
                  <p className="text-sm text-[var(--eos-muted)]">
                    {[detail.sellerCity, detail.sellerDistrict].filter(Boolean).join(", ") || cl.sellerLocationEmpty}
                  </p>
                  {detail.sellerPrice ? (
                    <p className="text-xl font-bold text-[var(--eos-text)]">
                      {Math.round(detail.sellerPrice).toLocaleString("pl-PL")} zł
                    </p>
                  ) : null}
                  {detail.sellerDescription ? (
                    <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{detail.sellerDescription}</p>
                  ) : null}
                  <Link
                    href="/dodaj-oferte"
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--eos-text)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-bg)]"
                  >
                    {cl.createListing}
                  </Link>
                </div>
              )}

              {(detail.activities || []).length > 0 ? (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                    <FileText className="size-3.5" />
                    {cl.activityTitle}
                  </p>
                  <div className="space-y-2">
                    {(detail.activities || []).slice(0, 8).map((a) => (
                      <div key={a.id} className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3 text-sm">
                        <p className="font-medium text-[var(--eos-text)]">{a.title}</p>
                        {a.body ? <p className="mt-1 text-xs text-[var(--eos-muted)]">{a.body}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {report?.topMatches?.length ? (
        <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/60 p-6">
          <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            <BarChart3 className="size-4 text-emerald-500" />
            {cl.reportTopMatches}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.topMatches.map((m) => (
              <div key={`${m.offerId}-${m.clientName}`} className="rounded-2xl bg-[var(--eos-input)]/50 p-4">
                <p className="font-semibold text-[var(--eos-text)]">{m.clientName}</p>
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{m.offerTitle}</p>
                <p className="mt-2 text-xs font-bold text-emerald-500">{m.score}% dopasowania</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AgencyClientFormModal
        open={formOpen}
        initialType={segment}
        onClose={() => setFormOpen(false)}
        onCreated={() => {
          setFormOpen(false);
          void loadClients();
        }}
      />
    </div>
  );
}
