"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  UserPlus,
  ShoppingBag,
  Home,
  Mail,
  Phone,
  Search,
  Target,
  Send,
  RefreshCcw,
  FileText,
  X,
  Sparkles,
  BarChart3,
  Check,
  Radar,
  MessageSquare,
  BadgeCheck,
  ShieldAlert,
  ExternalLink,
  MessageCircle,
  PhoneCall,
  Clock3,
  SlidersHorizontal,
  Contact2,
  IdCard,
} from "lucide-react";
import AgencyClientFormModal from "@/components/crm/AgencyClientFormModal";
import CrmEmailPreviewModal from "@/components/crm/CrmEmailPreviewModal";
import OpenContactThreadButton from "@/components/contact/OpenContactThreadButton";
import { useLocale } from "@/contexts/LocaleContext";
import type { AgencyClientListItem } from "@/lib/agencyClientShape";
import { eosBtn } from "@/components/ui/eosButtonStyles";

function clientNeedsContactVerification(client: Pick<AgencyClientListItem, 'linkedUserId' | 'emailVerifiedAt' | 'phoneVerifiedAt'>) {
  if (client.linkedUserId) return false;
  return !client.emailVerifiedAt || !client.phoneVerifiedAt;
}

function clientEmailVerified(client: Pick<AgencyClientListItem, 'linkedUserId' | 'emailVerifiedAt'>) {
  return Boolean(client.linkedUserId || client.emailVerifiedAt);
}

function clientPhoneVerified(client: Pick<AgencyClientListItem, 'linkedUserId' | 'phoneVerifiedAt'>) {
  return Boolean(client.linkedUserId || client.phoneVerifiedAt);
}

type ClientDetail = AgencyClientListItem & {
  linkedOfferId?: number | null;
  portalUrl?: string | null;
  portalToken?: string | null;
  notes?: string | null;
  sellerDescription?: string | null;
  sellerArea?: number | null;
  sellerRooms?: number | null;
  sellerDistrict?: string | null;
  sellerTransactionType?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  pesel?: string | null;
  linkedUserId?: number | null;
  linkedUserEmail?: string | null;
  linkedUserLastLoginAt?: string | null;
  matches?: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    clientFeedback: string | null;
    clientFeedbackAt: string | null;
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

type EmailPreview = {
  subject: string;
  html: string;
  intro: string;
  agentName: string;
  agencyName: string;
  clientName: string;
  clientEmail: string | null;
  offers: Array<{ id: number; title: string }>;
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
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<Set<number>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
  const [pendingOfferIds, setPendingOfferIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "name" | "match">("recent");
  const [cardBusyId, setCardBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const open = () => setFormOpen(true);
    window.addEventListener("crm-open-add-client", open);
    return () => window.removeEventListener("crm-open-add-client", open);
  }, []);

  const offerHref = (offerId: number, portalToken?: string | null) => {
    if (portalToken) return `/oferta/${offerId}?portal=${encodeURIComponent(portalToken)}`;
    return `/oferta/${offerId}`;
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, reportRes] = await Promise.all([
        fetch(`/api/crm/clients`, { cache: "no-store" }),
        fetch("/api/crm/clients?report=1", { cache: "no-store" }),
      ]);
      const listJson = await listRes.json();
      const reportJson = await reportRes.json();
      if (listJson.success) setClients(listJson.clients || []);
      if (reportJson.success) setReport(reportJson.report);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/crm/clients/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setDetail(json.client);
        setSelectedOffers(new Set());
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const sendBusinessCard = async (clientId: number) => {
    setCardBusyId(clientId);
    setToast("");
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_business_card" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się wysłać wizytówki."));
      setToast(`Wysłano wizytówkę na ${json.email || "e-mail klienta"}`);
      if (selectedId === clientId) void loadDetail(clientId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Błąd wysyłki wizytówki.");
    } finally {
      setCardBusyId(null);
      window.setTimeout(() => setToast(""), 4500);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = clients.filter((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const textHit =
        !q ||
        fullName.includes(q) ||
        (client.email || "").toLowerCase().includes(q) ||
        (client.phone || "").toLowerCase().includes(q);
      if (!textHit) return false;
      if (!onlyAttention) return true;
      return clientNeedsContactVerification(client) || client.matchCount === 0;
    });
    return [...base].sort((a, b) => {
      if (sortBy === "name") {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pl");
      }
      if (sortBy === "match") {
        const aScore = a.topMatchScore || 0;
        const bScore = b.topMatchScore || 0;
        return bScore - aScore;
      }
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
  }, [clients, onlyAttention, query, sortBy]);

  const toggleOffer = (offerId: number, notified: boolean) => {
    if (notified) return;
    setSelectedOffers((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const openPreview = async (offerIds: number[]) => {
    if (!selectedId || !offerIds.length) return;
    setPendingOfferIds(offerIds);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_offers", offerIds }),
      });
      const json = await res.json();
      if (json.success) setPreviewData(json.preview);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmSend = async (message: string) => {
    if (!selectedId || !pendingOfferIds.length) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingOfferIds.length > 1 ? "notify_offers" : "notify_offer",
          offerIds: pendingOfferIds,
          offerId: pendingOfferIds[0],
          channel: "email",
          message,
        }),
      });
      setPreviewOpen(false);
      setPendingOfferIds([]);
      await loadDetail(selectedId);
      await loadClients();
    } finally {
      setBusy(false);
    }
  };

  const refreshMatches = async () => {
    if (!selectedId) return;
    setBusy(true);
    setScanning(true);
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
      setTimeout(() => setScanning(false), 800);
    }
  };

  const clientAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wykonać akcji");
      await loadDetail(selectedId);
      return json;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const analytics = useMemo(() => {
    const total = clients.length || 1;
    const emailVerified = clients.filter((c) => clientEmailVerified(c)).length;
    const phoneVerified = clients.filter((c) => clientPhoneVerified(c)).length;
    const withMatches = clients.filter((c) => c.matchCount > 0).length;
    const buyers = clients.filter((c) => c.type === "BUYER").length;
    const sellers = clients.filter((c) => c.type === "SELLER").length;
    return {
      emailPct: Math.round((emailVerified / total) * 100),
      phonePct: Math.round((phoneVerified / total) * 100),
      matchPct: Math.round((withMatches / total) * 100),
      buyers,
      sellers,
      pendingVerification: clients.filter((c) => clientNeedsContactVerification(c)).length,
    };
  }, [clients]);

  const onlineCount = useMemo(
    () =>
      clients.filter((c) => {
        if (!c.linkedUserLastLoginAt) return false;
        return Date.now() - new Date(c.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000;
      }).length,
    [clients],
  );

  const detailAnalytics = useMemo(() => {
    if (!detail) return null;
    const matches = detail.matches || [];
    const activities = detail.activities || [];
    const sentCount = matches.filter((m) => m.notifiedAt).length;
    const feedbackCount = matches.filter((m) => m.clientFeedback).length;
    const verificationPoints =
      (detail.linkedUserId ? 2 : Number(Boolean(detail.emailVerifiedAt)) + Number(Boolean(detail.phoneVerifiedAt)));
    const engagementPoints = Math.min(2, sentCount > 0 ? 1 : 0) + Math.min(2, feedbackCount > 0 ? 1 : 0);
    const activityPoints = activities.length > 0 ? 1 : 0;
    const scorePct = Math.round(((verificationPoints + engagementPoints + activityPoints) / 7) * 100);
    return {
      sentCount,
      feedbackCount,
      activityCount: activities.length,
      scorePct,
      pendingItems: [
        detail.linkedUserId ? null : !detail.emailVerifiedAt ? "Zweryfikować e-mail" : null,
        detail.linkedUserId ? null : !detail.phoneVerifiedAt ? "Zweryfikować telefon" : null,
        sentCount === 0 && detail.type === "BUYER" ? "Wysłać pierwsze oferty" : null,
        feedbackCount === 0 && detail.type === "BUYER" ? "Zebrać feedback klienta" : null,
      ].filter(Boolean) as string[],
    };
  }, [detail]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: cl.statsBuyers, value: report?.buyers ?? "—", icon: ShoppingBag },
          { label: cl.statsSellers, value: report?.sellers ?? "—", icon: Home },
          { label: cl.statsMatches, value: report?.totalMatches ?? "—", icon: Target },
          { label: cl.statsOutreach, value: report?.outreachLast30Days ?? "—", icon: Send },
        ].map((card) => (
          <div
            key={card.label}
            className="min-w-0 rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/80 p-5 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl"
          >
            <card.icon className="mb-3 size-5 text-emerald-500" />
            <p className="text-2xl font-black tabular-nums text-[var(--eos-text)]">{card.value}</p>
            <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-muted)]">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--eos-muted)]">Weryfikacja e-mail</p>
          <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{analytics.emailPct}%</p>
        </div>
        <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--eos-muted)]">Weryfikacja telefonu</p>
          <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{analytics.phonePct}%</p>
        </div>
        <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--eos-muted)]">Klienci z dopasowaniami</p>
          <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{analytics.matchPct}%</p>
        </div>
        <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--eos-muted)]">Do dokończenia</p>
          <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{analytics.pendingVerification}</p>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/60 p-4 text-xs text-[var(--eos-muted)]">
        <p className="font-bold text-[var(--eos-text)]">Jak czytać analitykę CRM:</p>
        <p className="mt-1 break-words leading-relaxed">
          % e-mail/telefon = udział klientów ze zweryfikowanym kontaktem. % dopasowań = udział klientów z min. 1 aktywnym match-em.
          Status online liczony jest po ostatnim logowaniu klienta (aktywność w ciągu 10 min): teraz online {onlineCount}/{clients.length}.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words text-xs font-bold uppercase tracking-[0.15em] text-[var(--eos-muted)]">
          Wszystkie kontakty CRM
        </p>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={eosBtn("home", { className: "w-full shrink-0 shadow-[0_12px_32px_rgba(16,185,129,0.28)] sm:w-auto" })}
        >
          <UserPlus className="size-4" />
          {cl.addClient}
        </button>
      </div>

      {toast ? (
        <p className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
          {toast}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 rounded-[1.25rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/75 p-3">
          <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 px-3 py-2">
              <Search className="size-4 shrink-0 text-[var(--eos-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj: imię, e-mail, telefon"
                className="min-w-0 w-full bg-transparent text-sm text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-muted)]"
              />
            </label>
            <button
              type="button"
              onClick={() => setOnlyAttention((prev) => !prev)}
              className={`inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
                onlyAttention
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-700"
                  : "border-[var(--eos-border)] text-[var(--eos-muted)]"
              }`}
            >
              <SlidersHorizontal className="size-3.5 shrink-0" />
              Priorytet
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "recent" | "name" | "match")}
              className="min-w-0 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 px-3 py-2 text-xs font-semibold text-[var(--eos-text)] outline-none"
            >
              <option value="recent">Sort: ostatnia aktywność</option>
              <option value="name">Sort: nazwa A-Z</option>
              <option value="match">Sort: najwyższe dopasowanie</option>
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 px-4 py-8 text-center sm:p-10">
              <p className="break-words text-lg font-semibold text-[var(--eos-text)]">{cl.emptyTitle}</p>
              <p className="mt-2 break-words text-sm leading-relaxed text-[var(--eos-muted)]">{cl.emptyBody}</p>
            </div>
          ) : (
            <div className="-mx-1 max-w-full overflow-x-auto overscroll-x-contain px-1 touch-pan-x">
              <table className="w-full min-w-[44rem] text-left">
                <thead>
                  <tr className="border-b border-[var(--eos-border)] text-[10px] uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                    <th className="px-3 py-2">Klient</th>
                    <th className="px-3 py-2">Typ</th>
                    <th className="px-3 py-2">Kontakt</th>
                    <th className="px-3 py-2">Konto</th>
                    <th className="px-3 py-2">Weryfikacja</th>
                    <th className="px-3 py-2">Analityka</th>
                    <th className="px-3 py-2">Aktualizacja</th>
                    <th className="px-3 py-2">Wizytówka</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedId(client.id)}
                      className={`cursor-pointer border-b border-[var(--eos-border)]/60 text-sm transition hover:bg-[var(--eos-input)]/60 ${
                        selectedId === client.id ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <td className="max-w-[11rem] px-3 py-3">
                        <p className="break-words font-semibold text-[var(--eos-text)]">{client.firstName} {client.lastName}</p>
                        <p className="mt-1 break-all text-xs text-[var(--eos-muted)]">{client.email || "—"} · {client.phone || "—"}</p>
                        {client.type === "BUYER" && client.matchCount > 0 ? (
                          <span className="mt-1 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                            {client.matchCount} dopasowań
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                        {client.type === "BUYER" ? "Kupujący" : "Sprzedający"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--eos-muted)]">
                        <div className="flex items-center gap-2">
                          {client.phone ? (
                            <a
                              href={`tel:${client.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 hover:border-emerald-500/40"
                            >
                              <PhoneCall className="size-3" />
                              Zadzwoń
                            </a>
                          ) : null}
                          {client.email ? (
                            <a
                              href={`mailto:${client.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 hover:border-emerald-500/40"
                            >
                              <Mail className="size-3" />
                              E-mail
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--eos-muted)]">
                        {client.linkedUserId ? (
                          <div>
                            <p className="font-semibold text-[var(--eos-text)]">ID: {client.linkedUserId}</p>
                            <p className={client.linkedUserLastLoginAt && Date.now() - new Date(client.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000 ? "text-emerald-600" : ""}>
                              {client.linkedUserLastLoginAt && Date.now() - new Date(client.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000
                                ? "Online"
                                : "Offline"}
                            </p>
                          </div>
                        ) : (
                          <span>Brak konta</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className={clientEmailVerified(client) ? "text-emerald-600" : "text-amber-700"}>E-mail</p>
                        <p className={clientPhoneVerified(client) ? "text-emerald-600" : "text-amber-700"}>Telefon</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--eos-muted)]">
                        {client.matchCount} dop.
                        {client.topMatchScore ? ` · ${client.topMatchScore}%` : ""}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--eos-muted)]">
                        {new Date(client.updatedAt).toLocaleDateString("pl-PL")}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={!client.email || cardBusyId === client.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void sendBusinessCard(client.id);
                          }}
                          title={client.email ? "Wyślij wizytówkę e-mailem" : "Brak e-maila klienta"}
                          className={eosBtn("secondary", {
                            size: "sm",
                            className: "disabled:opacity-40",
                          })}
                        >
                          <IdCard className="size-3.5" />
                          {cardBusyId === client.id ? "…" : "Wyślij"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="relative min-h-[420px] min-w-0 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/80 p-4 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl sm:p-6">
          {scanning ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[1.75rem] bg-[var(--eos-card)]/90 px-4 backdrop-blur-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Radar className="size-10 text-emerald-500" />
              </motion.div>
              <p className="mt-4 break-words text-center text-sm font-semibold text-[var(--eos-text)]">{cl.scanningMatches}</p>
            </div>
          ) : null}

          {!selectedId ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-2 py-8 text-center sm:min-h-[360px] sm:px-4">
              <Sparkles className="mb-4 size-10 shrink-0 text-emerald-500/60" />
              <p className="max-w-full break-words text-lg font-semibold text-[var(--eos-text)]">{cl.selectClientTitle}</p>
              <p className="mt-2 max-w-sm break-words text-sm leading-relaxed text-[var(--eos-muted)]">{cl.selectClientBody}</p>
            </div>
          ) : detailLoading || !detail ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : (
            <div className="min-w-0 space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {detail.type === "BUYER" ? cl.buyerBadge : cl.sellerBadge}
                  </p>
                  <h3 className="mt-1 break-words text-xl font-bold text-[var(--eos-text)] sm:text-2xl">
                    {detail.firstName} {detail.lastName}
                  </h3>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]">
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!detail.email || cardBusyId === detail.id}
                  onClick={() => void sendBusinessCard(detail.id)}
                  className={eosBtn("home", { size: "sm" })}
                >
                  <Contact2 className="size-3.5" />
                  {cardBusyId === detail.id ? "Wysyłanie…" : "Wyślij wizytówkę"}
                </button>
                {detail.portalUrl ? (
                  <Link
                    href={detail.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={eosBtn("secondary", { size: "sm" })}
                  >
                    Panel klienta
                    <ExternalLink className="size-3.5" />
                  </Link>
                ) : null}
                {detail.linkedUserId ? (
                  <OpenContactThreadButton
                    peerUserId={detail.linkedUserId}
                    peerName={`${detail.firstName} ${detail.lastName}`.trim()}
                    label="Napisz do klienta"
                    returnTo="/moje-konto/crm?tab=klienci"
                    className={eosBtn("secondary", { size: "sm" })}
                  />
                ) : null}
              </div>

              <div className="grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4 sm:grid-cols-3">
                <a
                  href={detail.phone ? `sms:${detail.phone}` : "#"}
                  onClick={(e) => {
                    if (!detail.phone) e.preventDefault();
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    detail.phone
                      ? "border-[var(--eos-border)] text-[var(--eos-text)] hover:border-emerald-500/40"
                      : "border-[var(--eos-border)]/40 text-[var(--eos-muted)] opacity-60"
                  }`}
                >
                  <p className="inline-flex items-center gap-2 font-semibold"><MessageCircle className="size-4" /> SMS</p>
                  <p className="mt-1 text-xs">{detail.phone || "Brak numeru"}</p>
                </a>
                <a
                  href={detail.phone ? `tel:${detail.phone}` : "#"}
                  onClick={(e) => {
                    if (!detail.phone) e.preventDefault();
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    detail.phone
                      ? "border-[var(--eos-border)] text-[var(--eos-text)] hover:border-emerald-500/40"
                      : "border-[var(--eos-border)]/40 text-[var(--eos-muted)] opacity-60"
                  }`}
                >
                  <p className="inline-flex items-center gap-2 font-semibold"><Phone className="size-4" /> Telefon</p>
                  <p className="mt-1 text-xs">{detail.phone || "Brak numeru"}</p>
                </a>
                <a
                  href={detail.email ? `mailto:${detail.email}` : "#"}
                  onClick={(e) => {
                    if (!detail.email) e.preventDefault();
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    detail.email
                      ? "border-[var(--eos-border)] text-[var(--eos-text)] hover:border-emerald-500/40"
                      : "border-[var(--eos-border)]/40 text-[var(--eos-muted)] opacity-60"
                  }`}
                >
                  <p className="inline-flex items-center gap-2 font-semibold"><Mail className="size-4" /> E-mail</p>
                  <p className="mt-1 text-xs">{detail.email || "Brak e-maila"}</p>
                </a>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Konto klienta</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                    {detail.linkedUserId ? `User ID: ${detail.linkedUserId}` : "Brak powiązanego konta"}
                  </p>
                  {detail.linkedUserEmail ? (
                    <p className="mt-1 text-xs text-[var(--eos-muted)]">{detail.linkedUserEmail}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Status online</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                    {detail.linkedUserLastLoginAt && Date.now() - new Date(detail.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000
                      ? "Online teraz"
                      : "Offline"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--eos-muted)]">
                    {detail.linkedUserLastLoginAt
                      ? `Ostatnie logowanie: ${new Date(detail.linkedUserLastLoginAt).toLocaleString("pl-PL")}`
                      : "Brak danych logowania"}
                  </p>
                </div>
              </div>

              {detail.notes ? (
                <p className="rounded-2xl bg-[var(--eos-input)]/80 p-4 text-sm leading-relaxed text-[var(--eos-muted)]">
                  {detail.notes}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Wysłane oferty</p>
                  <p className="mt-1 text-xl font-black text-[var(--eos-text)]">{detailAnalytics?.sentCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Feedback klienta</p>
                  <p className="mt-1 text-xl font-black text-[var(--eos-text)]">{detailAnalytics?.feedbackCount ?? 0}</p>
                </div>
                <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Akcje CRM</p>
                  <p className="mt-1 text-xl font-black text-[var(--eos-text)]">{detailAnalytics?.activityCount ?? 0}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Postęp obsługi klienta</p>
                  <p className="text-sm font-black text-emerald-600">{detailAnalytics?.scorePct ?? 0}%</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--eos-border)]/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                    style={{ width: `${detailAnalytics?.scorePct ?? 0}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(detailAnalytics?.pendingItems || []).length === 0 ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      Wszystkie kluczowe kroki wykonane
                    </span>
                  ) : (
                    (detailAnalytics?.pendingItems || []).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-700"
                      >
                        {item}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">PESEL</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{detail.pesel || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${clientEmailVerified(detail) ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
                    {clientEmailVerified(detail) ? <BadgeCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                    E-mail {clientEmailVerified(detail) ? "zweryfikowany" : "do weryfikacji"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${clientPhoneVerified(detail) ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
                    {clientPhoneVerified(detail) ? <BadgeCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                    Telefon {clientPhoneVerified(detail) ? "zweryfikowany" : "do weryfikacji"}
                  </span>
                </div>
                {!clientEmailVerified(detail) ? (
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !detail.email}
                      onClick={() => void clientAction("send_email_code")}
                      className="rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--eos-text)] disabled:opacity-50"
                    >
                      Wyślij kod e-mail
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const code = window.prompt("Wpisz kod e-mail klienta");
                        if (code) void clientAction("verify_email_code", { code });
                      }}
                      className="rounded-full bg-emerald-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      Potwierdź e-mail
                    </button>
                  </div>
                ) : null}
                {!clientPhoneVerified(detail) ? (
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !detail.phone}
                      onClick={() => void clientAction("send_sms_code")}
                      className="rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--eos-text)] disabled:opacity-50"
                    >
                      Wyślij kod SMS
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const code = window.prompt("Wpisz kod SMS klienta");
                        if (code) void clientAction("verify_sms_code", { code });
                      }}
                      className="rounded-full bg-emerald-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      Potwierdź telefon
                    </button>
                  </div>
                ) : null}
              </div>

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
                    {selectedOffers.size > 0 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void openPreview([...selectedOffers])}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black"
                      >
                        <Send className="size-3.5" />
                        {cl.sendSelected} ({selectedOffers.size})
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                      {cl.matchesTitle}
                    </p>
                    {(detail.matches || []).length === 0 ? (
                      <p className="text-sm text-[var(--eos-muted)]">{cl.noMatches}</p>
                    ) : (
                      (detail.matches || []).map((m) => {
                        const sent = Boolean(m.notifiedAt);
                        const selected = selectedOffers.has(m.offer.id);
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${
                              selected ? "border-emerald-500/40 bg-emerald-500/5" : "border-[var(--eos-border)] bg-[var(--eos-input)]/40"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <button
                                type="button"
                                disabled={sent}
                                onClick={() => toggleOffer(m.offer.id, sent)}
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                                  sent
                                    ? "cursor-default border-emerald-500/30 bg-emerald-500/10"
                                    : selected
                                      ? "border-emerald-500 bg-emerald-500"
                                      : "border-[var(--eos-border)] hover:border-emerald-500/40"
                                }`}
                              >
                                {(sent || selected) ? <Check className={`size-4 ${sent ? "text-emerald-600" : "text-black"}`} /> : null}
                              </button>
                              <div
                                className="h-16 w-20 shrink-0 rounded-xl bg-cover bg-center"
                                style={{ backgroundImage: `url(${m.offer.imageUrl})` }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="break-words font-semibold text-[var(--eos-text)]">{m.offer.title}</p>
                                  {sent ? (
                                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                                      {cl.sentBadge}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-[var(--eos-muted)]">
                                  {m.offer.city} · {Math.round(m.offer.price).toLocaleString("pl-PL")} zł · {m.score}%
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {!sent ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void openPreview([m.offer.id])}
                                    className="rounded-full bg-emerald-500 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black"
                                  >
                                    {cl.sendEmail}
                                  </button>
                                ) : null}
                            <Link
                              href={offerHref(m.offer.id, detail.portalToken)}
                              className="rounded-full border border-[var(--eos-border)] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[var(--eos-text)]"
                            >
                                  {cl.viewOffer}
                                </Link>
                              </div>
                            </div>
                            {m.clientFeedback ? (
                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                                <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                  <MessageSquare className="size-3" />
                                  {cl.clientFeedbackLabel}
                                </p>
                                <p className="mt-1 text-sm text-[var(--eos-text)]">{m.clientFeedback}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 rounded-2xl border border-[var(--eos-border)] p-5">
                  <p className="text-sm text-[var(--eos-muted)]">{cl.sellerPanelLead}</p>
                  {detail.linkedOfferId ? (
                    <div className="rounded-xl bg-[var(--eos-input)]/50 p-4">
                      <p className="text-sm font-semibold text-[var(--eos-text)]">{cl.viewLinkedListing}</p>
                      <Link
                        href={`/oferta/${detail.linkedOfferId}`}
                        className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-emerald-600"
                      >
                        #{detail.linkedOfferId}
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--eos-muted)]">{cl.sellerPanelEmpty}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dodaj-oferte?agencyClientId=${detail.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--eos-text)] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-bg)]"
                    >
                      {cl.addClientListing}
                    </Link>
                    <Link
                      href="/dodaj-oferte"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]"
                    >
                      {cl.addOwnLead}
                    </Link>
                  </div>
                </div>
              )}

              {(detail.activities || []).length > 0 ? (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                    <FileText className="size-3.5" />
                    Timeline i historia działań
                  </p>
                  <div className="space-y-2">
                    {(detail.activities || []).slice(0, 8).map((a) => (
                      <div key={a.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-[var(--eos-text)]">{a.title || "Aktywność CRM"}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--eos-muted)]">
                            <Clock3 className="size-3" />
                            {new Date(a.createdAt).toLocaleString("pl-PL")}
                          </span>
                        </div>
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
        initialType="BUYER"
        onClose={() => setFormOpen(false)}
        onCreated={(clientId) => {
          setFormOpen(false);
          void loadClients();
          if (clientId) {
            setSelectedId(clientId);
            setScanning(true);
            setTimeout(() => setScanning(false), 2500);
          }
        }}
      />

      <CrmEmailPreviewModal
        open={previewOpen}
        loading={previewLoading}
        preview={previewData}
        onClose={() => {
          setPreviewOpen(false);
          setPendingOfferIds([]);
        }}
        onConfirm={(msg) => void confirmSend(msg)}
        confirming={busy}
      />
    </div>
  );
}
