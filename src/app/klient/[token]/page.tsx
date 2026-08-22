"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Radar,
  CheckCircle2,
  ExternalLink,
  SlidersHorizontal,
  CalendarCheck2,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { type AcquisitionFormData } from "@/lib/acquisitionWorkflow";
import ClientPortalJourney from "@/components/portal/ClientPortalJourney";
import ClientPortalMatchCard from "@/components/portal/ClientPortalMatchCard";
import ClientPortalChatDock from "@/components/portal/ClientPortalChatDock";
import ListingProgressRail from "@/components/portal/ListingProgressRail";
import { rememberClientPortalToken } from "@/lib/crm/portalSession";
import { formatMeetingWhenPl } from "@/lib/datetime/warsaw";

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
      description?: string | null;
      imageUrl: string;
      imageUrls?: string[] | null;
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
  listingPath?: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    startsAt?: string | null;
    url?: string | null;
    image?: string | null;
    siteName?: string | null;
  }>;
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

  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (token) rememberClientPortalToken(token);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd ładowania");
      setPortal(json.portal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
            <span className="eos-portal-label eos-portal-label--ok inline-flex items-center gap-1.5 eos-raised-chip rounded-full px-3 py-1">
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
              <div className="eos-inset-well flex size-16 items-center justify-center rounded-full text-xl font-black text-emerald-600">
                {portal.agentName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="eos-portal-label eos-portal-label--ok">Twój agent</p>
              <p className="break-words text-base font-bold text-[var(--eos-text)]">{portal.agentName}</p>
              <p className="break-words text-xs text-[var(--eos-muted)]">{portal.agentTitle || "Doradca ds. Nieruchomości"}</p>
              <p className="break-words text-xs font-semibold text-emerald-600">{portal.agencyName}</p>
            </div>
          </div>
        </div>

        {/* Agency Office Details & Direct Actions */}
        <div className="mt-6 grid gap-3 border-t border-[var(--eos-border)]/60 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {token ? <ClientPortalChatDock token={token} agentName={portal.agentName} /> : null}
          {portal.agentPhone && (
            <a
              href={`tel:${portal.agentPhone}`}
              className="eos-inset-well flex items-center gap-3 rounded-xl p-3 text-xs font-bold text-[var(--eos-text)] transition hover:border-emerald-500/50"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                📞
              </div>
              <div className="min-w-0">
                <p className="eos-portal-label">Zadzwoń do agenta</p>
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
                <p className="eos-portal-label">Wyślij wiadomość</p>
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
                <p className="eos-portal-label">Profil biura EstateOS™</p>
                <p className="break-words">{portal.agencyName}</p>
              </div>
            </a>
          )}
        </div>
      </header>

      {portal.journey?.length ? <ClientPortalJourney stages={portal.journey} clientType={portal.type} /> : null}

      {portal.meeting ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eos-portal-label eos-portal-label--ok">Umówienie spotkania</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--eos-text)]">
                {formatMeetingWhenPl(portal.meeting.startsAt)}
              </h2>
              {portal.meeting.location ? (
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.meeting.location}</p>
              ) : null}
            </div>
            <span className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-[10px]">
              Potwierdzone
            </span>
          </div>
          {portal.meeting.prepLabels?.length ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="eos-portal-label">Na spotkanie proszę przygotować</p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--eos-text)]">
                {portal.meeting.prepLabels.map((label) => (
                  <li key={label} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {portal.type === "SELLER" && portal.acquisition ? (
        <section className="eos-lux-panel space-y-5 rounded-[1.75rem] p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eos-portal-label eos-portal-label--ok flex items-center gap-2">
                <BriefcaseBusiness className="size-4" />
                Pozysk
              </p>
              <h2 className="mt-2 text-2xl font-black text-[var(--eos-text)]">Umowa i ustalenia</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
                Umowa i ustalenia ze spotkania. Agent prowadzi ten etap — nic nie zaznaczasz.
              </p>
            </div>
            <span className={`eos-raised-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[9px] ${
              portal.acquisition.status === "SIGNED" ? "eos-raised-chip--on" : ""
            }`}>
              {portal.acquisition.status === "SIGNED" ? <ShieldCheck className="size-3.5" /> : <CalendarCheck2 className="size-3.5" />}
              {portal.acquisition.status === "SIGNED" ? "Umowa podpisana" : "W przygotowaniu"}
            </span>
          </div>

          {portal.acquisition.agreementSnapshot ? (
            <div>
              <p className="mb-3 text-sm font-black text-[var(--eos-text)]">Uzgodnione warunki współpracy</p>
              <pre className="eos-inset-well max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-2xl p-5 text-xs leading-relaxed text-slate-800">
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
                      className="eos-inset-well flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-emerald-700"
                    >
                      {file.name}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ))}
                </div>
              ) : null}
              {portal.acquisition.status === "SIGNED" ? (
                <div className="eos-inset-well mt-3 rounded-xl border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="flex items-center gap-2 font-black text-emerald-700"><ShieldCheck className="size-4" /> Dokument podpisany</p>
                  <p className="mt-1 text-xs text-[var(--eos-muted)]">
                    {portal.acquisition.signerName} · {portal.acquisition.signedAt ? new Date(portal.acquisition.signedAt).toLocaleString("pl-PL") : ""}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="eos-inset-well rounded-2xl border border-dashed border-[var(--eos-border)] p-5 text-sm text-[var(--eos-muted)]">
              Agent przygotowuje umowę i ustalenia ze spotkania. Dokument pojawi się tutaj, gdy będzie gotowy.
            </p>
          )}
        </section>
      ) : null}

      {portal.type === "SELLER" && (portal.listing || portal.listingProgress?.length) ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eos-portal-label eos-portal-label--ok">Sprzedaż</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--eos-text)]">
                {portal.listing?.title || "Przygotowanie ogłoszenia"}
              </h2>
            </div>
            <span className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-xs">
              {portal.listing?.statusLabel || "W przygotowaniu"}
            </span>
          </div>
          {portal.listingProgress?.length ? <ListingProgressRail stages={portal.listingProgress} /> : null}
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
                    Ogłoszenie jest aktywne w bazie kupujących EstateOS™ oraz w aplikacji.
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
                  Szkic jest u agenta. Nie jest jeszcze publiczny — zobaczysz publikację i wystawienia w ścieżce poniżej.
                </p>
              )}
            </div>
          </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--eos-muted)]">
              Po podpisaniu umowy agent przygotuje ogłoszenie. Szkic, zdjęcia i publikacja pojawią się tutaj.
            </p>
          )}
          {(portal.listingPath || []).length ? (
            <div className="mt-6 space-y-3">
              <p className="eos-portal-label eos-portal-label--ok">Ścieżka oferty</p>
              {portal.listingPath!.map((item) => (
                <div key={item.id} className="eos-inset-well rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-[var(--eos-text)]">{item.title || item.kind}</p>
                    <p className="text-[11px] text-[var(--eos-muted)]">
                      {item.startsAt
                        ? formatMeetingWhenPl(item.startsAt)
                        : new Date(item.createdAt).toLocaleString("pl-PL")}
                    </p>
                  </div>
                  {item.body ? <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{item.body}</p> : null}
                  {item.siteName ? <p className="mt-1 text-[11px] font-semibold text-emerald-700">{item.siteName}</p> : null}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      Zobacz publikację <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {portal.presentation && portal.type === "BUYER" ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eos-portal-label eos-portal-label--ok">Prezentacja nieruchomości</p>
              <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">
                {formatMeetingWhenPl(portal.presentation.startsAt)}
              </h2>
              {portal.presentation.location ? (
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.presentation.location}</p>
              ) : null}
            </div>
            <span className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-[10px]">
              {portal.presentation.status === "confirmed" ? "Potwierdzona" : "Umówiona"}
            </span>
          </div>
        </section>
      ) : null}

      {criteria && portal.type === "BUYER" ? (
        <section className="eos-inset-frame rounded-[1.6rem] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <SlidersHorizontal className="size-5 text-emerald-500" />
            Twoje kryteria poszukiwań
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="eos-portal-label">Lokalizacja</p>
              <p className="mt-1 break-words text-sm font-semibold leading-snug text-[var(--eos-text)]">
                {criteria.location}
              </p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="eos-portal-label">Budżet</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.maxBudget}</p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="eos-portal-label">Typ</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                {criteria.transactionType} · {criteria.propertyType}
              </p>
            </div>
            <div className="eos-inset-well rounded-xl px-4 py-3">
              <p className="eos-portal-label">Metraż</p>
              <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{criteria.minArea}</p>
            </div>
          </div>
          {criteria.districts?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {criteria.districts.map((district) => (
                <span
                  key={district}
                  className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-xs"
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

      {portal.type === "BUYER" ? (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--eos-text)]">
            <Radar className="size-5 text-emerald-500" />
            Propozycje od agenta
          </h2>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            Każda karta to osobna nieruchomość. Reakcja schodzi do agenta przy tej ofercie — proces idzie dalej.
          </p>
          {portal.matches.length === 0 ? (
            <p className="eos-inset-well rounded-2xl border border-dashed border-[var(--eos-border)] p-8 text-center text-sm text-[var(--eos-muted)]">
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
    </div>
    </main>
  );
}

function formatClientGreeting(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^(pan|pani|pana|panią)$/i.test(parts[parts.length - 1] || "")) {
    return parts.slice(0, -1).join(" ");
  }
  return name;
}
