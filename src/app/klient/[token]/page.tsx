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
  Zap,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { ACQUISITION_DOCUMENTS, type AcquisitionFormData } from "@/lib/acquisitionWorkflow";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import { formatContactBytes, type ContactAttachmentMeta } from "@/lib/contactAttachmentShared";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import ClientPortalJourney from "@/components/portal/ClientPortalJourney";
import ClientPortalMatchCard from "@/components/portal/ClientPortalMatchCard";

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
  attachments?: ContactAttachmentMeta[];
};

type ScheduleSlot = {
  startsAt: string;
  location: string | null;
  notes: string | null;
  status: "confirmed" | "pending";
  proposedBy: "agent" | "client";
  reason: string | null;
  previousStartsAt: string | null;
  prepLabels?: string[];
};

type JourneyStage = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
  at?: string | null;
};

type PortalData = {
  clientName: string;
  type: "BUYER" | "SELLER";
  agencyName: string;
  agentName: string;
  agentPhone: string | null;
  agentEmail: string | null;
  agentPhoto?: string | null;
  agentTitle?: string | null;
  agencyLogo?: string | null;
  agencySlug?: string | null;
  agencyWebsite?: string | null;
  agencyPhone?: string | null;
  agencyEmail?: string | null;
  agencyAddress?: string | null;
  searchCriteria: SearchCriteria;
  canChat: boolean;
  meeting: (ScheduleSlot & { prepLabels?: string[] }) | null;
  presentation: ScheduleSlot | null;
  journey: JourneyStage[];
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
      street?: string | null;
      area: number;
      rooms?: number | null;
      excerpt?: string | null;
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
    statusLabel?: string;
    managementStatus: string | null;
    imageUrl: string;
    promotedUntil?: string | null;
    featured?: boolean;
  } | null;
  listingProgress?: Array<{ id: string; label: string; done: boolean; current: boolean }>;
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
    metadata?: Record<string, unknown> | null;
    offerId?: number | null;
    offers?: Array<{
      id: number;
      title: string;
      city: string;
      district: string | null;
      imageUrl: string;
    }>;
  }>;
};

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [changeDraft, setChangeDraft] = useState({ startsAt: "", reason: "" });
  const [presentationChange, setPresentationChange] = useState({ startsAt: "", reason: "" });
  const [scheduleBusy, setScheduleBusy] = useState("");
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
    if (!token) return;
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
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const submitFeedback = async (
    matchId: number,
    payload: { sentiment: string | null; liked: string; disliked: string; phrases: string[]; note: string },
  ) => {
    if (!token) return;
    setSavingId(matchId);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_feedback", matchId, ...payload }),
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
    if (!token || chatBusy || (!content && !pendingFile)) return;
    setChatBusy(true);
    try {
      let attachments: ContactAttachmentMeta[] = [];
      if (pendingFile) {
        const payload = new FormData();
        payload.append("file", pendingFile);
        const up = await fetch(`/api/crm/client-portal/${token}/attachments`, { method: "POST", body: payload });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Nie udało się wgrać załącznika.");
        attachments = [upJson.attachment];
      }
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", content, attachments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać");
      setChatDraft("");
      setPendingFile(null);
      await loadMessages();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setChatBusy(false);
    }
  };

  const postSchedule = async (action: string, extra: Record<string, string>) => {
    if (!token) return;
    setScheduleBusy(action);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się zapisać.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setScheduleBusy("");
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
  const greetingName = formatClientGreeting(portal.clientName);

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pt-28 pb-32 text-[var(--eos-text)]">
    <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6">
      <header className="eos-inset-frame eos-stack-card relative rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              Panel Klienta EstateOS
            </span>
            <h1 className="mt-2 break-words text-3xl font-black leading-tight text-[var(--eos-text)]">Witaj, {greetingName}</h1>
            <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
              {portal.type === "BUYER"
                ? `Twój agent prowadzi dopasowanie ofert i poszukiwania nieruchomości. Każda propozycja ma osobną reakcję — nic nie ginie w czacie.`
                : `Dedykowany agent i biuro reprezentują Twoją nieruchomość.`}
            </p>
          </div>

          {/* Agent Business Card */}
          <div className="eos-inset-well relative z-10 -mt-1 flex w-full shrink-0 items-center gap-4 rounded-2xl p-4 md:-mr-2 md:mt-6 md:w-auto md:max-w-sm">
            {portal.agentPhoto ? (
              <img
                src={portal.agentPhoto}
                alt={portal.agentName}
                className="size-16 rounded-full object-cover ring-2 ring-emerald-500/30"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-xl font-black text-emerald-600">
                {portal.agentName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Twój agent</p>
              <p className="break-words text-base font-bold text-[var(--eos-text)]">{portal.agentName}</p>
              <p className="break-words text-xs text-[var(--eos-muted)]">{portal.agentTitle || "Doradca ds. Nieruchomości"}</p>
              <p className="break-words text-xs font-semibold text-emerald-600">{portal.agencyName}</p>
            </div>
          </div>
        </div>

        {/* Agency Office Details & Direct Actions */}
        <div className="mt-6 grid gap-3 border-t border-[var(--eos-border)]/60 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {portal.agentPhone && (
            <a
              href={`tel:${portal.agentPhone}`}
              className="eos-inset-well flex items-center gap-3 rounded-xl p-3 text-xs font-bold text-[var(--eos-text)] transition hover:border-emerald-500/50"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                📞
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--eos-muted)]">Zadzwoń do agenta</p>
                <p className="break-all">{portal.agentPhone}</p>
              </div>
            </a>
          )}
          {portal.agentEmail && (
            <a
              href={`mailto:${portal.agentEmail}`}
              className="eos-inset-well flex items-center gap-3 rounded-xl p-3 text-xs font-bold text-[var(--eos-text)] transition hover:border-emerald-500/50"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                ✉️
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--eos-muted)]">Wyślij wiadomość</p>
                <p className="break-all">{portal.agentEmail}</p>
              </div>
            </a>
          )}
          {(portal.agencySlug || portal.agencyWebsite) && (
            <a
              href={portal.agencySlug || portal.agencyWebsite!}
              target="_blank"
              rel="noreferrer"
              className="eos-inset-well flex items-center gap-3 rounded-xl p-3 text-xs font-bold text-[var(--eos-text)] transition hover:border-emerald-500/50"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                🏢
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--eos-muted)]">Profil biura EstateOS™</p>
                <p className="break-words">{portal.agencyName}</p>
              </div>
            </a>
          )}
        </div>
      </header>

      <section className="eos-inset-frame rounded-[1.6rem] p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Aplikacja iPhone</p>
        <h2 className="mt-1 text-lg font-black text-[var(--eos-text)]">Otwórz panel w aplikacji i łap powiadomienia od razu</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--eos-muted)]">
          Mail otwiera ten panel w przeglądarce. W aplikacji EstateOS masz te same oferty, czat z agentem i natychmiastowe powiadomienia, gdy pojawi się nowa propozycja albo zmiana etapu.
        </p>
        <div className="mt-4">
          <AppStoreBadgeLink compact />
        </div>
      </section>

      {portal.journey?.length ? <ClientPortalJourney stages={portal.journey} /> : null}

      {portal.meeting ? (
        <section className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Umówione spotkanie</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--eos-text)]">
                {new Date(portal.meeting.startsAt).toLocaleString("pl-PL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </h2>
              {portal.meeting.location ? (
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.meeting.location}</p>
              ) : null}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                portal.meeting.status === "confirmed"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-amber-500/15 text-amber-700"
              }`}
            >
              {portal.meeting.status === "confirmed" ? "Potwierdzone" : "Oczekuje na agenta"}
            </span>
          </div>
          {portal.meeting.prepLabels?.length ? (
            <ul className="mt-4 space-y-1.5 text-sm text-[var(--eos-text)]">
              {portal.meeting.prepLabels.map((label) => (
                <li key={label} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {portal.meeting.status === "confirmed" ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={scheduleBusy === "confirm_meeting"}
                onClick={() => void postSchedule("confirm_meeting", {})}
                className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
              >
                Potwierdzam termin
              </button>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                Zaproponuj inny termin
              </span>
              <input
                type="datetime-local"
                value={changeDraft.startsAt}
                onChange={(e) => setChangeDraft((d) => ({ ...d, startsAt: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={scheduleBusy === "propose_meeting_change"}
              onClick={() =>
                void postSchedule("propose_meeting_change", {
                  startsAt: changeDraft.startsAt ? new Date(changeDraft.startsAt).toISOString() : "",
                  reason: changeDraft.reason,
                })
              }
              className="rounded-full border border-emerald-500/40 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-600 disabled:opacity-50"
            >
              Wyślij propozycję
            </button>
          </div>
          <textarea
            value={changeDraft.reason}
            onChange={(e) => setChangeDraft((d) => ({ ...d, reason: e.target.value }))}
            rows={2}
            placeholder="Powód zmiany terminu lub godziny"
            className="mt-3 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm"
          />
        </section>
      ) : null}

      {portal.presentation ? (
        <section className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-soft)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Prezentacja nieruchomości</p>
          <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">
            {new Date(portal.presentation.startsAt).toLocaleString("pl-PL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </h2>
          {portal.presentation.location ? (
            <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.presentation.location}</p>
          ) : null}
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[var(--eos-muted)]">
            {portal.presentation.status === "confirmed" ? "Potwierdzona" : "Czeka na Twoją decyzję"}
          </p>
          {portal.presentation.status === "pending" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={scheduleBusy === "confirm_presentation"}
                onClick={() => void postSchedule("confirm_presentation", {})}
                className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
              >
                Potwierdzam prezentację
              </button>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="datetime-local"
              value={presentationChange.startsAt}
              onChange={(e) => setPresentationChange((d) => ({ ...d, startsAt: e.target.value }))}
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm"
            />
            <input
              value={presentationChange.reason}
              onChange={(e) => setPresentationChange((d) => ({ ...d, reason: e.target.value }))}
              placeholder="Powód zmiany"
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={scheduleBusy === "propose_presentation_change"}
            onClick={() =>
              void postSchedule("propose_presentation_change", {
                startsAt: presentationChange.startsAt ? new Date(presentationChange.startsAt).toISOString() : "",
                reason: presentationChange.reason,
              })
            }
            className="mt-3 rounded-full border border-emerald-500/40 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-600 disabled:opacity-50"
          >
            Zaproponuj inny termin prezentacji
          </button>
        </section>
      ) : null}

      {portal.type === "SELLER" && (portal.listing || portal.listingProgress?.length) ? (
        <section className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                Twoja oferta
              </p>
              <h2 className="mt-1 text-xl font-bold text-[var(--eos-text)]">
                {portal.listing?.title || "Przygotowanie ogłoszenia"}
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black uppercase text-emerald-600">
              {portal.listing?.statusLabel || "W przygotowaniu"}
            </span>
          </div>

          {portal.listingProgress?.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {portal.listingProgress.map((step) => (
                <div
                  key={step.id}
                  className={`rounded-xl border px-3 py-3 ${
                    step.done
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : step.current
                        ? "border-emerald-500/50 bg-[var(--eos-input)]/40"
                        : "border-[var(--eos-border)] bg-[var(--eos-input)]/20"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                    {step.done ? "Gotowe" : step.current ? "Teraz" : "Dalej"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--eos-text)]">{step.label}</p>
                </div>
              ))}
            </div>
          ) : null}

          {portal.listing ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {portal.listing.imageUrl && (
              <img
                src={portal.listing.imageUrl}
                alt={portal.listing.title}
                className="h-32 w-full rounded-2xl object-cover sm:w-48"
              />
            )}
            <div className="space-y-2">
              <p className="text-2xl font-black text-emerald-600">
                {portal.listing.price ? `${portal.listing.price.toLocaleString("pl-PL")} PLN` : "Cena na zapytanie"}
              </p>
              <p className="text-sm font-semibold text-[var(--eos-text)]">
                📍 {portal.listing.city} {portal.listing.district ? `· ${portal.listing.district}` : ""}
              </p>
              {portal.listing.status === "ACTIVE" || portal.listing.status === "PUBLISHED" ? (
                <>
                  <p className="text-xs text-[var(--eos-muted)]">
                    Ogłoszenie jest promowane w bazie kupujących EstateOS™ oraz w aplikacji mobilnej.
                  </p>
                  <Link
                    href={`/oferta/${portal.listing.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:underline"
                  >
                    Zobacz publiczną stronę ogłoszenia <ExternalLink className="size-3.5" />
                  </Link>
                </>
              ) : (
                <p className="text-xs text-[var(--eos-muted)]">
                  Agent dokończy zdjęcia i publikację. Status ogłoszenia zobaczysz tutaj na bieżąco.
                </p>
              )}
            </div>
          </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--eos-muted)]">
              Po podpisaniu umowy agent przygotuje ogłoszenie. Kolejne kroki — szkic, zdjęcia i publikacja — pojawią się tutaj.
            </p>
          )}
        </section>
      ) : null}

      {portal.type === "SELLER" ? (
        <SellerWorkBoard
          featured={Boolean(portal.listing?.featured)}
          featuredUntil={portal.listing?.promotedUntil || null}
          activities={portal.activities}
        />
      ) : null}

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
              {(portal.acquisition.formData.paperContracts || []).length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-black text-[var(--eos-text)]">Podpisana umowa (skan)</p>
                  {portal.acquisition.formData.paperContracts.map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-sm font-semibold text-emerald-700"
                    >
                      {file.name}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ))}
                </div>
              ) : null}
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

      {criteria ? (
        <section className="eos-inset-frame rounded-[1.6rem] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <SlidersHorizontal className="size-5 text-emerald-500" />
            Twoje kryteria poszukiwań
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Lokalizacja</p>
              <p className="mt-1 break-words text-sm font-semibold leading-snug text-[var(--eos-text)]">
                {criteria.location}
              </p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Budżet</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.maxBudget}</p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Typ</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                {criteria.transactionType} · {criteria.propertyType}
              </p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Metraż</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.minArea}</p>
            </div>
          </div>
          {criteria.districts?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {criteria.districts.map((district) => (
                <span
                  key={district}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {district}
                </span>
              ))}
            </div>
          ) : null}
          {criteria.amenities?.length ? (
            <p className="mt-3 text-sm text-[var(--eos-muted)]">
              Obowiązkowe 100%: {criteria.amenities.join(", ")}
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
      ) : null}

      {portal.type === "BUYER" || portal.matches.length > 0 ? (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <Radar className="size-5 text-emerald-500" />
            {portal.type === "SELLER" ? "Propozycje dla Ciebie" : "Propozycje od agenta"}
          </h2>
          {portal.matches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--eos-border)] p-8 text-center text-sm text-[var(--eos-muted)]">
              Agent właśnie szuka dopasowań — wróć za chwilę.
            </p>
          ) : (
            portal.matches.map((m) => (
              <ClientPortalMatchCard
                key={m.id}
                match={m}
                token={token || ""}
                saving={savingId === m.id}
                onSubmit={(payload) => submitFeedback(m.id, payload)}
              />
            ))
          )}
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
          <MessageSquare className="size-5 text-emerald-500" />
          Wiadomości z agentem
        </h2>
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/30 p-3">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--eos-muted)]">
              Napisz do agenta albo wyślij dokument — rozmowa i załączniki trafią do CRM.
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
                {m.content ? <p className="mt-1 whitespace-pre-wrap">{m.content}</p> : null}
                {(m.attachments || []).map((att) => (
                  <ContactAttachmentBubble key={att.url} attachment={att} isMe={m.fromMe} />
                ))}
              </div>
            ))
          )}
        </div>
        {pendingFile ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5">
            <Paperclip className="size-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{pendingFile.name}</p>
              <p className="text-[10px] text-[var(--eos-muted)]">{formatContactBytes(pendingFile.size)}</p>
            </div>
            <button type="button" onClick={() => setPendingFile(null)} className="rounded-full p-1.5 text-[var(--eos-muted)]">
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <label className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-emerald-600">
            <Plus className="size-5" />
            <input
              type="file"
              className="hidden"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            />
          </label>
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
            disabled={chatBusy || (!chatDraft.trim() && !pendingFile)}
            onClick={() => void sendChat()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
          >
            <Send className="size-3" />
            Wyślij
          </button>
        </div>
      </section>

      {portal.activities.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            Ostatnie działania
          </h2>
          <div className="space-y-3">
            {portal.activities.map((a) => {
              const metaOffers = Array.isArray(a.offers) ? a.offers : [];
              const meta =
                a.metadata && typeof a.metadata === "object" ? (a.metadata as Record<string, unknown>) : {};
              const nestedOffers = Array.isArray(meta.offers) ? (meta.offers as Array<Record<string, unknown>>) : [];
              const offers =
                metaOffers.length > 0
                  ? metaOffers
                  : nestedOffers.map((item) => ({
                      id: Number(item.id),
                      title: String(item.title || ""),
                      city: String(item.city || ""),
                      district: item.district ? String(item.district) : null,
                      imageUrl: String(item.imageUrl || ""),
                    }));
              return (
                <div key={a.id} className="eos-inset-well rounded-2xl px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-[var(--eos-text)]">{a.title}</p>
                    <p className="text-[11px] text-[var(--eos-muted)]">
                      {new Date(a.createdAt).toLocaleString("pl-PL")}
                    </p>
                  </div>
                  {a.body ? <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--eos-muted)]">{a.body}</p> : null}
                  {offers.length ? (
                    <div className="mt-3 space-y-2">
                      {offers.map((offer) => (
                        <Link
                          key={`${a.id}-${offer.id}`}
                          href={`/oferta/${offer.id}?portal=${encodeURIComponent(token || "")}`}
                          className="flex items-center gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-2"
                        >
                          {offer.imageUrl ? (
                            <span
                              className="h-12 w-16 shrink-0 rounded-lg bg-cover bg-center"
                              style={{ backgroundImage: `url(${offer.imageUrl})` }}
                            />
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-[var(--eos-text)]">{offer.title}</span>
                            <span className="block text-[11px] text-[var(--eos-muted)]">
                              {[offer.city, offer.district].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
    </main>
  );
}

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function formatClientGreeting(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^(pan|pani|pana|panią)$/i.test(parts[parts.length - 1] || "")) {
    return parts.slice(0, -1).join(" ");
  }
  return name;
}

function SellerWorkBoard({
  featured,
  featuredUntil,
  activities,
}: {
  featured: boolean;
  featuredUntil: string | null;
  activities: PortalData["activities"];
}) {
  const reports = activities.filter((a) => a.kind === "MARKET_REPORT_SENT");
  const portals = activities.filter((a) => a.kind === "EXTERNAL_PORTAL");
  const featuredActs = activities.filter((a) => a.kind === "LISTING_FEATURED");
  const untilLabel = featuredUntil
    ? new Date(featuredUntil).toLocaleDateString("pl-PL")
    : null;

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-emerald-500/25 bg-[var(--eos-card)] p-6 shadow-[var(--eos-shadow-soft)]">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
          <Zap className="size-4" /> Sprzedaż — co już zrobiliśmy
        </p>
        <h2 className="mt-2 text-2xl font-black text-[var(--eos-text)]">Nie czekasz w ciemno</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
          Tu widać konkretną pracę: raport z aktów, wyróżnienie na stronie głównej EstateOS™ i publikacje na innych portalach — z podglądem, nie gołym linkiem.
        </p>
      </div>

      {featured || featuredActs.length ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Wyróżnienie na stronie głównej</p>
          <p className="mt-1 text-sm font-bold text-[var(--eos-text)]">
            Twoje ogłoszenie jest na górze katalogu EstateOS™{untilLabel ? ` do ${untilLabel}` : ""}.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--eos-muted)]">
            Kupujący i agenci widzą je od razu, bez przewijania. To realne miejsce na stronie głównej i w aplikacji — nie pusty znaczek.
          </p>
        </div>
      ) : null}

      {reports.map((a) => (
        <div key={a.id} className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Raport z aktów</p>
          <p className="mt-1 text-sm font-bold text-[var(--eos-text)]">{a.title}</p>
          {a.body ? <p className="mt-1 text-[12px] leading-relaxed text-[var(--eos-muted)]">{a.body}</p> : null}
          <p className="mt-2 text-[11px] text-[var(--eos-muted)]">
            {new Date(a.createdAt).toLocaleString("pl-PL")}
          </p>
        </div>
      ))}

      {portals.map((a) => {
        const meta = asMeta(a.metadata);
        const url = String(meta.url || "");
        const image = String(meta.image || "");
        const siteName = String(meta.siteName || meta.host || "Portal");
        const title = String(meta.title || a.title || siteName);
        const description = String(meta.description || a.body || "");
        return (
          <a
            key={a.id}
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 transition hover:border-emerald-500/40"
          >
            <div className="flex flex-col sm:flex-row">
              {image ? (
                <img src={image} alt="" className="h-40 w-full object-cover sm:h-auto sm:w-52" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-emerald-500/10 sm:w-40">
                  <ExternalLink className="size-6 text-emerald-600" />
                </div>
              )}
              <div className="min-w-0 flex-1 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{siteName}</p>
                <p className="mt-1 text-sm font-black text-[var(--eos-text)]">{title}</p>
                {description ? (
                  <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[var(--eos-muted)]">{description}</p>
                ) : null}
                {url ? (
                  <p className="mt-2 truncate text-[11px] font-semibold text-emerald-700">{url}</p>
                ) : null}
              </div>
            </div>
          </a>
        );
      })}

      {!featured && !featuredActs.length && !reports.length && !portals.length ? (
        <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
          Gdy agent wyśle raport z aktów, wyróżni ogłoszenie na stronie głównej albo wrzuci je na Otodom / OLX — zobaczysz to tutaj od razu, z opisem co zrobiliśmy.
        </p>
      ) : null}
    </section>
  );
}
