"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Home,
  MessageSquare,
  Radar,
  Send,
  CheckCircle2,
  Building2,
  ExternalLink,
  SlidersHorizontal,
  CalendarCheck2,
  FileCheck2,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { ACQUISITION_DOCUMENTS, type AcquisitionFormData } from "@/lib/acquisitionWorkflow";

type SearchCriteria = {
  location: string;
  minArea: string;
  maxBudget: string;
  propertyType: string;
  transactionType: string;
  threshold: string;
  districts: string[];
  amenities: string[];
  calibrationMode: "MAP" | "CITY";
} | null;

type PortalMessage = {
  id: number;
  content: string;
  createdAt: string;
  fromAgent: boolean;
  fromMe: boolean;
};

type PortalData = {
  clientName: string;
  type: "BUYER" | "SELLER";
  agencyName: string;
  agentName: string;
  agentPhone: string | null;
  agentEmail: string | null;
  searchCriteria: SearchCriteria;
  canChat: boolean;
  matches: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    clientFeedback: string | null;
    clientFeedbackAt: string | null;
    offer: {
      id: number;
      title: string;
      price: number;
      priceCurrency: string | null;
      city: string;
      district: string | null;
      area: number;
      imageUrl: string;
    };
  }>;
  listing: {
    id: number;
    title: string;
    price: number;
    priceCurrency: string | null;
    city: string;
    district: string | null;
    status: string;
    managementStatus: string | null;
    imageUrl: string;
  } | null;
  acquisition: {
    status: string;
    currentStep: number;
    formData: AcquisitionFormData;
    agreementSnapshot: string | null;
    clientAcknowledgedAt: string | null;
    clientAcknowledgementName: string | null;
    signedAt: string | null;
    signerName: string | null;
    documentHash: string | null;
    copyEmailSentAt: string | null;
    updatedAt: string;
  } | null;
  activities: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
  }>;
};

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [acquisitionBusy, setAcquisitionBusy] = useState("");
  const [acknowledgementName, setAcknowledgementName] = useState("");

  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd ładowania");
      setPortal(json.portal);
      const drafts: Record<number, string> = {};
      for (const m of json.portal.matches || []) {
        if (m.clientFeedback) drafts[m.id] = m.clientFeedback;
      }
      setFeedbackDraft(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token || !portal?.canChat) return;
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_messages" }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.messages)) {
        setMessages(json.messages);
      }
    } catch {
      /* ignore */
    }
  }, [token, portal?.canChat]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const submitFeedback = async (matchId: number) => {
    const feedback = feedbackDraft[matchId]?.trim();
    if (!token || !feedback) return;
    setSavingId(matchId);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_feedback", matchId, feedback }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setSavingId(null);
    }
  };

  const sendChat = async () => {
    const content = chatDraft.trim();
    if (!token || !content || chatBusy) return;
    setChatBusy(true);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać");
      setChatDraft("");
      await loadMessages();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setChatBusy(false);
    }
  };

  const updateDocument = (documentId: string, checked: boolean) => {
    setPortal((current) => {
      if (!current?.acquisition) return current;
      return {
        ...current,
        acquisition: {
          ...current.acquisition,
          formData: {
            ...current.acquisition.formData,
            documents: {
              ...current.acquisition.formData.documents,
              [documentId]: checked,
            },
          },
        },
      };
    });
  };

  const saveDocumentChecklist = async () => {
    if (!token || !portal?.acquisition) return;
    setAcquisitionBusy("documents");
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_acquisition_checklist",
          documents: portal.acquisition.formData.documents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się zapisać listy.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setAcquisitionBusy("");
    }
  };

  const acknowledgeAcquisition = async () => {
    if (!token || !acknowledgementName.trim()) return;
    setAcquisitionBusy("acknowledge");
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_acquisition", name: acknowledgementName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się zapisać potwierdzenia.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setAcquisitionBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="text-emerald-500"
        >
          <Radar size={40} />
        </motion.div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--eos-text)]">Panel niedostępny</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{error || "Link wygasł lub jest nieprawidłowy."}</p>
        <Link href="/" className="mt-6 inline-block text-emerald-600 underline">
          Wróć na EstateOS
        </Link>
      </div>
    );
  }

  const criteria = portal.searchCriteria;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pt-28 pb-32 text-[var(--eos-text)]">
    <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6">
      <header className="rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 shadow-[var(--eos-shadow-soft)]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">Panel klienta</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--eos-text)]">Witaj, {portal.clientName}</h1>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">
          {portal.type === "BUYER"
            ? `Twój agent ${portal.agentName} (${portal.agencyName}) prowadzi poszukiwania nieruchomości.`
            : `${portal.agencyName} prowadzi Twoje ogłoszenie — poniżej status i ostatnie działania.`}
        </p>
        {(portal.agentPhone || portal.agentEmail) && (
          <p className="mt-3 text-xs text-[var(--eos-muted)]">
            Kontakt: {portal.agentPhone || ""} {portal.agentEmail ? `· ${portal.agentEmail}` : ""}
          </p>
        )}
      </header>

      {portal.type === "SELLER" && portal.acquisition ? (
        <section className="space-y-5 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                <BriefcaseBusiness className="size-4" />
                Twoja współpraca z agentem
              </p>
              <h2 className="mt-2 text-2xl font-black text-[var(--eos-text)]">Przejrzysty proces sprzedaży</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
                Widzisz przygotowanie nieruchomości, uzgodnione warunki, dokumenty i kolejne działania agenta w jednym miejscu.
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-wider ${
              portal.acquisition.status === "SIGNED"
                ? "bg-emerald-500/15 text-emerald-700"
                : "bg-amber-500/15 text-amber-700"
            }`}>
              {portal.acquisition.status === "SIGNED" ? <ShieldCheck className="size-3.5" /> : <CalendarCheck2 className="size-3.5" />}
              {portal.acquisition.status === "SIGNED" ? "Współpraca zawarta" : "Przygotowanie"}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            {[
              ["1", "Poznajemy cele", "Sytuacja i termin klienta"],
              ["2", "Sprawdzamy dane", "Stan prawny i dokumenty"],
              ["3", "Budujemy ofertę", "Parametry, cena i prezentacja"],
              ["4", "Promujemy", "Portale, baza klientów i kontakt"],
              ["5", "Prowadzimy transakcję", "Prezentacje, negocjacje i umowa"],
            ].map(([number, title, body]) => (
              <div key={number} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/35 p-3">
                <p className="text-[9px] font-black text-emerald-600">0{number}</p>
                <p className="mt-1 text-xs font-black text-[var(--eos-text)]">{title}</p>
                <p className="mt-1 text-[10px] leading-snug text-[var(--eos-muted)]">{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/30 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-black text-[var(--eos-text)]">
                  <FileCheck2 className="size-4 text-emerald-500" />
                  Przygotuj na spotkanie
                </p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">Zaznacz dokumenty, które masz już przygotowane.</p>
              </div>
              <p className="text-xs font-black text-emerald-600">
                {ACQUISITION_DOCUMENTS.filter((item) => portal.acquisition?.formData.documents[item.id]).length}/{ACQUISITION_DOCUMENTS.length}
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ACQUISITION_DOCUMENTS.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)]/70 p-3">
                  <input
                    type="checkbox"
                    disabled={portal.acquisition?.status === "SIGNED"}
                    checked={Boolean(portal.acquisition?.formData.documents[item.id])}
                    onChange={(event) => updateDocument(item.id, event.target.checked)}
                    className="mt-0.5 size-4 accent-emerald-500"
                  />
                  <span className="text-xs font-semibold leading-snug text-[var(--eos-text)]">{item.label}</span>
                </label>
              ))}
            </div>
            {portal.acquisition.status !== "SIGNED" ? (
              <button
                type="button"
                disabled={Boolean(acquisitionBusy)}
                onClick={() => void saveDocumentChecklist()}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)] disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                {acquisitionBusy === "documents" ? "Zapisywanie…" : "Zapisz listę dokumentów"}
              </button>
            ) : null}
          </div>

          {portal.acquisition.agreementSnapshot ? (
            <div>
              <p className="mb-3 text-sm font-black text-[var(--eos-text)]">Uzgodnione dane i warunki współpracy</p>
              <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--eos-border)] bg-white p-5 text-xs leading-relaxed text-slate-800 shadow-inner">
                {portal.acquisition.agreementSnapshot}
              </pre>
              {portal.acquisition.status === "SIGNED" ? (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="flex items-center gap-2 font-black text-emerald-700"><ShieldCheck className="size-4" /> Dokument podpisany</p>
                  <p className="mt-1 text-xs text-[var(--eos-muted)]">
                    {portal.acquisition.signerName} · {portal.acquisition.signedAt ? new Date(portal.acquisition.signedAt).toLocaleString("pl-PL") : ""}
                  </p>
                  <p className="mt-1 break-all text-[9px] text-[var(--eos-muted)]">SHA-256: {portal.acquisition.documentHash}</p>
                </div>
              ) : portal.acquisition.clientAcknowledgedAt ? (
                <p className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Potwierdzono zapoznanie: {portal.acquisition.clientAcknowledgementName} · {new Date(portal.acquisition.clientAcknowledgedAt).toLocaleString("pl-PL")}
                </p>
              ) : (
                <div className="mt-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/35 p-4">
                  <p className="text-xs leading-relaxed text-[var(--eos-muted)]">
                    To potwierdzenie oznacza zapoznanie się z dokumentem przed spotkaniem. Nie zastępuje podpisu umowy.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={acknowledgementName}
                      onChange={(event) => setAcknowledgementName(event.target.value)}
                      placeholder="Imię i nazwisko"
                      className="flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-sm text-[var(--eos-text)]"
                    />
                    <button
                      type="button"
                      disabled={acknowledgementName.trim().length < 3 || Boolean(acquisitionBusy)}
                      onClick={() => void acknowledgeAcquisition()}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {acquisitionBusy === "acknowledge" ? "Zapisywanie…" : "Zapoznałem/am się"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--eos-border)] p-5 text-sm text-[var(--eos-muted)]">
              Agent uzupełnia kartę nieruchomości i warunki współpracy. Dokument pojawi się tutaj przed podpisem.
            </p>
          )}
        </section>
      ) : null}

      {portal.type === "BUYER" && criteria ? (
        <section className="rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <SlidersHorizontal className="size-5 text-emerald-500" />
            Twoje kryteria poszukiwań
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Lokalizacja</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.location}</p>
            </div>
            <div className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Budżet</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.maxBudget}</p>
            </div>
            <div className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Typ</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                {criteria.transactionType} · {criteria.propertyType}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Metraż</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.minArea}</p>
            </div>
          </div>
          {criteria.districts?.length ? (
            <p className="mt-3 text-xs text-[var(--eos-muted)]">
              Dzielnice: {criteria.districts.join(", ")}
            </p>
          ) : null}
          {criteria.amenities?.length ? (
            <p className="mt-1 text-xs text-[var(--eos-muted)]">
              Udogodnienia: {criteria.amenities.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {portal.type === "SELLER" ? (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <Building2 className="size-5 text-emerald-500" />
            Twoje ogłoszenie u agencji
          </h2>
          {portal.listing ? (
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 sm:flex-row sm:items-center">
              <div
                className="h-24 w-full shrink-0 rounded-xl bg-cover bg-center sm:w-32"
                style={{ backgroundImage: `url(${portal.listing.imageUrl})` }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--eos-text)]">{portal.listing.title}</p>
                <p className="text-sm text-[var(--eos-muted)]">
                  {[portal.listing.city, portal.listing.district].filter(Boolean).join(", ")} ·{" "}
                  {Math.round(portal.listing.price).toLocaleString("pl-PL")} {portal.listing.priceCurrency || "PLN"}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {portal.listing.managementStatus === "AGENCY_MANAGED" ? "Prowadzone przez agencję" : "Aktywne"}
                </p>
              </div>
              <Link
                href={`/oferta/${portal.listing.id}?portal=${encodeURIComponent(token || "")}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-text)]"
              >
                Zobacz <ExternalLink className="size-3" />
              </Link>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--eos-border)] p-10 text-center">
              <Home className="mx-auto mb-3 size-8 text-[var(--eos-muted)]" />
              <p className="text-sm text-[var(--eos-muted)]">
                Agent przygotowuje ogłoszenie Twojej nieruchomości. Wkrótce zobaczysz je tutaj.
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <Radar className="size-5 text-emerald-500" />
            Propozycje od agenta
          </h2>
          {portal.matches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--eos-border)] p-8 text-center text-sm text-[var(--eos-muted)]">
              Agent właśnie szuka dopasowań — wróć za chwilę.
            </p>
          ) : (
            portal.matches.map((m) => (
              <article
                key={m.id}
                className="overflow-hidden rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row">
                  <div
                    className="h-28 w-full shrink-0 rounded-xl bg-cover bg-center sm:w-36"
                    style={{ backgroundImage: `url(${m.offer.imageUrl})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--eos-text)]">{m.offer.title}</p>
                    <p className="text-sm text-[var(--eos-muted)]">
                      {m.offer.city} · {Math.round(m.offer.price).toLocaleString("pl-PL")} zł · {m.score}% dopasowania
                    </p>
                    <Link
                      href={`/oferta/${m.offer.id}?portal=${encodeURIComponent(token || "")}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600"
                    >
                      Zobacz szczegóły <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
                <div className="border-t border-[var(--eos-border)] bg-[var(--eos-input)]/30 p-5">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                    <MessageSquare className="size-3.5" />
                    Twoje uwagi do tej nieruchomości
                  </label>
                  <textarea
                    value={feedbackDraft[m.id] || ""}
                    onChange={(e) => setFeedbackDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                    rows={2}
                    placeholder="Np. za mała kuchnia, ale świetna lokalizacja…"
                    className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)]"
                  />
                  <button
                    type="button"
                    disabled={savingId === m.id || !feedbackDraft[m.id]?.trim()}
                    onClick={() => void submitFeedback(m.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    <Send className="size-3" />
                    {m.clientFeedback ? "Zaktualizuj uwagi" : "Wyślij uwagi do agenta"}
                  </button>
                  {m.clientFeedbackAt ? (
                    <p className="mt-2 text-[10px] text-[var(--eos-muted)]">
                      Ostatnia aktualizacja: {new Date(m.clientFeedbackAt).toLocaleString("pl-PL")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      )}

      <section className="rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
          <MessageSquare className="size-5 text-emerald-500" />
          Wiadomości z agentem
        </h2>
        {portal.canChat ? (
          <>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/30 p-3">
              {messages.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--eos-muted)]">
                  Napisz do agenta — rozmowa trafi do jego Contact w EstateOS.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      m.fromMe
                        ? "ml-8 bg-emerald-500/15 text-[var(--eos-text)]"
                        : "mr-8 bg-[var(--eos-card)] text-[var(--eos-text)]"
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)]">
                      {m.fromMe ? "Ty" : portal.agentName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                placeholder="Napisz wiadomość do agenta…"
                className="flex-1 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)]"
              />
              <button
                type="button"
                disabled={chatBusy || !chatDraft.trim()}
                onClick={() => void sendChat()}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
              >
                <Send className="size-3" />
                Wyślij
              </button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--eos-muted)]">
            Czat będzie dostępny, gdy agent powiąże Twoje konto EstateOS. Możesz też skontaktować się bezpośrednio:
            {" "}
            {portal.agentPhone || portal.agentEmail || "dane kontaktowe agenta."}
          </p>
        )}
      </section>

      {portal.activities.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            Ostatnie działania
          </h2>
          <div className="space-y-2">
            {portal.activities.map((a) => (
              <div key={a.id} className="rounded-xl bg-[var(--eos-input)]/50 px-4 py-3 text-sm">
                <p className="font-medium text-[var(--eos-text)]">{a.title}</p>
                {a.body ? <p className="mt-1 text-xs text-[var(--eos-muted)]">{a.body}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
    </main>
  );
}
