"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Radar,
  CheckCircle2,
  ExternalLink,
  CalendarCheck2,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { type AcquisitionFormData } from "@/lib/acquisitionWorkflow";
import ClientPortalJourney from "@/components/portal/ClientPortalJourney";
import ClientPortalOfferBoard from "@/components/portal/ClientPortalOfferBoard";
import ClientPortalIntelligenceCheckback, {
  type PortalPendingCheckback,
} from "@/components/portal/ClientPortalIntelligenceCheckback";
import ClientPortalOfferSearchPanel from "@/components/portal/ClientPortalOfferSearchPanel";
import ClientPortalLiveChat from "@/components/portal/ClientPortalLiveChat";
import ClientPortalSetupPrompt from "@/components/portal/ClientPortalSetupPrompt";
import ClientPortalBuyerOnboarding from "@/components/portal/ClientPortalBuyerOnboarding";
import ClientPortalScheduleActions from "@/components/portal/ClientPortalScheduleActions";
import ListingProgressRail from "@/components/portal/ListingProgressRail";
import SellerPortalCollaboration from "@/components/portal/SellerPortalCollaboration";
import { rememberClientPortalToken } from "@/lib/crm/portalSession";
import { buyerOnboardingStorageKey, isBuyerOnboardingDismissed } from "@/lib/clientPortalPath";
import { formatMeetingWhenPl } from "@/lib/datetime/warsaw";
import type { ClientOfferSentiment } from "@/lib/crm/clientPortalFeedback";
import { initialOpenMatchIds } from "@/lib/crm/clientPortalOfferBoard";

type SearchCriteria = {
  location: string;
  areaLabel: string;
  minArea: string;
  maxBudget: string;
  propertyType: string;
  transactionType: string;
  threshold: string;
  districts: string[];
  amenities: string[];
  calibrationMode: "MAP" | "CITY";
  minYear?: number | null;
  minRooms?: number | null;
  maxArea?: number | null;
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
  intelligenceEnabled: boolean;
  pendingCheckback?: PortalPendingCheckback | null;
  unscoredMatchCount: number;
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
    intelligenceSent?: boolean;
    intelligenceReason?: string | null;
    clientWhy?: string | null;
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
    officeReviewStatus?: string | null;
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
    groupName?: string | null;
    groupUrl?: string | null;
    portal?: string | null;
    status?: string | null;
    promotedUntil?: string | null;
    reportId?: number | null;
  }>;
  activeChannels?: Array<{
    portal: string;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    activityId: number;
  }>;
  sellerNextStep?: {
    currentStep: string;
    nextAction: string;
    clientMessage: string | null;
    dueAt: string | null;
    visibleToClient: boolean;
    updatedAt: string;
  } | null;
  pendingDecisions?: Array<{
    id: number;
    title: string;
    clientMessage: string;
    clientResponse?: string | null;
    dueAt: string | null;
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

const SENTIMENTS = new Set<ClientOfferSentiment>(["like", "maybe", "dislike"]);

function readStoredOpenMatchIds(token: string): number[] {
  try {
    const raw = window.sessionStorage.getItem(`eos-portal-open-matches:${token}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(Number(id))).map(Number) : [];
  } catch {
    return [];
  }
}

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openMatchIds, setOpenMatchIds] = useState<number[]>([]);
  const openMatchesHydratedRef = useRef(false);
  const [focusOfferId, setFocusOfferId] = useState(0);
  const [focusMatchId, setFocusMatchId] = useState(0);
  const [reactPrefill, setReactPrefill] = useState("");
  const [phrasePrefill, setPhrasePrefill] = useState<string | null>(null);
  const [fromSzukam, setFromSzukam] = useState(false);
  const [welcomeEmailSent, setWelcomeEmailSent] = useState(false);
  const [releaseAttempted, setReleaseAttempted] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const matchesSectionRef = useRef<HTMLDivElement | null>(null);
  const knownMatchIdsRef = useRef<number[]>([]);
  const [freshMatchBanner, setFreshMatchBanner] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setFocusOfferId(Number(query.get("offer") || 0));
    setFocusMatchId(Number(query.get("match") || 0));
    setReactPrefill(query.get("react") || "");
    setPhrasePrefill(query.get("phrase"));
    setFromSzukam(query.get("from") === "szukam");
    setWelcomeEmailSent(query.get("mail") === "1");
  }, []);

  useEffect(() => {
    if (token) rememberClientPortalToken(token);
    if (token) setOnboardingDismissed(isBuyerOnboardingDismissed(token));
  }, [token]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd ładowania");
      setPortal(json.portal);
    } catch (e) {
      if (!options?.silent) setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = portal?.matches || [];
  const awaitingFirstOffer =
    portal?.type === "BUYER" &&
    matches.length === 0 &&
    Boolean(portal.intelligenceEnabled || portal.unscoredMatchCount || fromSzukam);
  const showUpcomingSlot =
    portal?.type === "BUYER" &&
    matches.length > 0 &&
    Boolean(portal.unscoredMatchCount || portal.intelligenceEnabled);
  const livePortalSync =
    portal?.type === "BUYER" &&
    Boolean(portal.intelligenceEnabled || portal.unscoredMatchCount || fromSzukam || showUpcomingSlot);

  useEffect(() => {
    if (!livePortalSync || !token) return;
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [livePortalSync, token, load]);

  useEffect(() => {
    if (!portal?.matches?.length) return;
    const ids = portal.matches.map((match) => match.id);
    const previous = knownMatchIdsRef.current;
    const added = ids.filter((id) => !previous.includes(id));
    if (added.length && previous.length) {
      const newest = portal.matches.find((match) => match.id === added[added.length - 1]) || portal.matches[0];
      setFreshMatchBanner(newest?.offer.title || "Nowa propozycja od agenta");
      window.setTimeout(() => setFreshMatchBanner(null), 8000);
    }
    knownMatchIdsRef.current = ids;
  }, [portal?.matches]);

  useEffect(() => {
    if (!token || !portal || releaseAttempted) return;
    if (portal.type !== "BUYER") return;
    if (portal.matches.length > 0) return;
    if (!portal.unscoredMatchCount && !portal.intelligenceEnabled) return;

    setReleaseAttempted(true);
    void fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release_first_match" }),
    })
      .then(() => load({ silent: true }))
      .catch(() => {});
  }, [token, portal, releaseAttempted, load]);
  const pendingMatches = matches.filter((match) => !match.clientFeedback);

  useEffect(() => {
    if (!token || !matches.length || openMatchesHydratedRef.current) return;
    openMatchesHydratedRef.current = true;
    setOpenMatchIds(
      initialOpenMatchIds({
        matches,
        storedIds: readStoredOpenMatchIds(token),
        focusMatchId,
        focusOfferId,
      }),
    );
  }, [token, matches, focusMatchId, focusOfferId]);

  useEffect(() => {
    if (!token || !openMatchesHydratedRef.current) return;
    try {
      window.sessionStorage.setItem(`eos-portal-open-matches:${token}`, JSON.stringify(openMatchIds));
    } catch {
      /* ignore */
    }
  }, [openMatchIds, token]);

  const toggleMatch = (matchId: number) => {
    setOpenMatchIds((current) =>
      current.includes(matchId) ? current.filter((id) => id !== matchId) : [...current, matchId],
    );
  };

  const ensureMatchOpen = (matchId: number) => {
    setOpenMatchIds((current) => (current.includes(matchId) ? current : [...current, matchId]));
  };

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
      await load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        {fromSzukam ? (
          <ClientPortalOfferSearchPanel compact />
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="text-emerald-500"
            >
              <Radar size={40} />
            </motion.div>
            <p className="text-sm font-semibold text-[var(--eos-text)]">Ładujemy panel…</p>
          </div>
        )}
        {fromSzukam && welcomeEmailSent ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-[var(--eos-muted)]">
            Link do panelu leci też na Twój e-mail.
          </p>
        ) : null}
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

  const greetingName = formatClientGreeting(portal.clientName);
  const collapseAgentMeeting =
    portal.type === "SELLER" &&
    (Boolean(portal.presentation) || portal.acquisition?.status === "SIGNED");

  return (
    <main className="client-portal-page pb-24 pt-2 text-[var(--eos-text)] sm:pb-28">
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
                ? `Twój agent prowadzi dopasowanie. Oferty są posegregowane: nowe, do oglądania, do przemyślenia i te, które nie pasują.`
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

        {token ? (
          <div className="mt-6 space-y-3 border-t border-[var(--eos-border)]/60 pt-6">
            <ClientPortalLiveChat token={token} agentName={portal.agentName} />
            <ClientPortalSetupPrompt
              token={token}
              deferUntilReady={fromSzukam && !onboardingDismissed}
            />
          </div>
        ) : null}
      </header>

      {portal.journey?.length ? <ClientPortalJourney stages={portal.journey} clientType={portal.type} /> : null}

      {portal.type === "BUYER" && portal.pendingCheckback && token ? (
        <ClientPortalIntelligenceCheckback
          token={token}
          checkback={portal.pendingCheckback}
          onDone={() => void load()}
        />
      ) : null}

      {portal.type === "BUYER" && fromSzukam && token ? (
        <ClientPortalBuyerOnboarding
          token={token}
          agentName={portal.agentName}
          hasPendingOffer={pendingMatches.length > 0}
          welcomeEmailSent={welcomeEmailSent}
          onDismiss={() => {
            setFromSzukam(false);
            setOnboardingDismissed(true);
            try {
              window.sessionStorage.setItem(buyerOnboardingStorageKey(token), "1");
            } catch {
              /* ignore */
            }
          }}
          onShowOffers={() => {
            matchesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : null}

      {portal.presentation ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eos-portal-label eos-portal-label--ok">
                {portal.type === "SELLER" ? "Pokaz mieszkania kupującemu" : "Prezentacja nieruchomości"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-[var(--eos-text)]">
                {formatMeetingWhenPl(portal.presentation.startsAt)}
              </h2>
              {portal.presentation.location ? (
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.presentation.location}</p>
              ) : null}
              {portal.type === "SELLER" ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
                  To termin oglądania z kupującym — nie spotkanie z agentem. Potwierdzenie lub prośba o zmianę
                  trafia też do drugiej strony.
                </p>
              ) : null}
            </div>
            <span className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-[10px]">
              {portal.presentation.status === "confirmed" ? "Potwierdzona" : "Do potwierdzenia"}
            </span>
          </div>
          {portal.presentation.status === "pending" && portal.presentation.reason ? (
            <p className="mt-3 text-sm text-amber-700">Prośba o zmianę: {portal.presentation.reason}</p>
          ) : null}
          {token ? (
            <ClientPortalScheduleActions
              token={token}
              kind="presentation"
              slot={portal.presentation}
              onDone={() => load()}
            />
          ) : null}
        </section>
      ) : null}

      {portal.meeting && collapseAgentMeeting ? (
        <p className="px-1 text-sm leading-relaxed text-[var(--eos-muted)]">
          Spotkanie z agentem ({formatMeetingWhenPl(portal.meeting.startsAt)})
          {portal.meeting.status === "confirmed" ? " — zakończone." : "."} Umowa i ogłoszenie są poniżej.
        </p>
      ) : portal.meeting ? (
        <section className="eos-lux-panel rounded-[1.75rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eos-portal-label eos-portal-label--ok">
                {portal.type === "SELLER" ? "Spotkanie z agentem" : "Umówienie spotkania"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-[var(--eos-text)]">
                {formatMeetingWhenPl(portal.meeting.startsAt)}
              </h2>
              {portal.meeting.location ? (
                <p className="mt-1 text-sm text-[var(--eos-muted)]">{portal.meeting.location}</p>
              ) : null}
            </div>
            <span className="eos-raised-chip eos-raised-chip--on rounded-full px-3 py-1 text-[10px]">
              {portal.meeting.status === "confirmed" ? "Potwierdzone" : "Do potwierdzenia"}
            </span>
          </div>
          {portal.meeting.status === "pending" && portal.meeting.reason ? (
            <p className="mt-3 text-sm text-amber-700">Prośba o zmianę: {portal.meeting.reason}</p>
          ) : null}
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
          {token ? (
            <ClientPortalScheduleActions
              token={token}
              kind="meeting"
              slot={portal.meeting}
              onDone={() => load()}
            />
          ) : null}
        </section>
      ) : null}

      {portal.type === "SELLER" && portal.acquisition ? (
        <section className="eos-lux-panel space-y-5 rounded-[1.75rem] p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eos-portal-label eos-portal-label--ok flex items-center gap-2">
                <BriefcaseBusiness className="size-4" />
                Umowa
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
              {token ? (
                <a
                  href={`/klient/${token}/dokument`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
                >
                  Otwórz dokument w przeglądarce
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
              {(portal.acquisition.formData.paperContracts || []).length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-black text-[var(--eos-text)]">Podpisana umowa (skan)</p>
                  {portal.acquisition.formData.paperContracts.map((file) => (
                    <a
                      key={file.url}
                      href={file.url.startsWith("http") ? file.url : `https://estateos.pl${file.url.startsWith("/") ? file.url : `/${file.url}`}`}
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

      {portal.type === "SELLER" ? (
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
              ) : portal.listing.officeReviewStatus === "OFFICE_REVIEW" ||
                portal.listing.statusLabel === "Oferta weryfikowana przez biuro" ? (
                <p className="text-xs text-[var(--eos-muted)]">
                  Oferta jest weryfikowana przez biuro. Po akceptacji kierownika zobaczysz publikację tutaj.
                </p>
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
        </section>
      ) : null}

      {portal.type === "SELLER" && token ? (
        <SellerPortalCollaboration
          token={token}
          listingImage={portal.listing?.imageUrl}
          listingPath={portal.listingPath || []}
          activeChannels={portal.activeChannels || []}
          sellerNextStep={portal.sellerNextStep || null}
          pendingDecisions={portal.pendingDecisions || []}
          onDone={() => void load()}
        />
      ) : null}

      {portal.type === "BUYER" && token ? (
        <div ref={matchesSectionRef}>
          <ClientPortalOfferBoard
            token={token}
            matches={portal.matches}
            activities={portal.activities}
            criteria={portal.searchCriteria}
            intelligenceEnabled={portal.intelligenceEnabled}
            live={livePortalSync}
            unscoredCount={portal.unscoredMatchCount}
            pendingCheckback={Boolean(portal.pendingCheckback)}
            awaitingFirstOffer={awaitingFirstOffer}
            freshBanner={freshMatchBanner}
            savingId={savingId}
            openMatchIds={openMatchIds}
            onToggleMatch={toggleMatch}
            onEnsureMatchOpen={ensureMatchOpen}
            onSubmit={(matchId, payload) => submitFeedback(matchId, payload)}
            prefillFor={{
              matchId: focusMatchId || undefined,
              offerId: focusOfferId || undefined,
              sentiment: SENTIMENTS.has(reactPrefill as ClientOfferSentiment)
                ? (reactPrefill as ClientOfferSentiment)
                : null,
              phrase: phrasePrefill,
            }}
          />
        </div>
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
