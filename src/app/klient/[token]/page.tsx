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
} from "lucide-react";

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
