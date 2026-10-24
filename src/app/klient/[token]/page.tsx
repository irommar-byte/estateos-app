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
  Calculator,
  Columns2,
  Handshake,
  MapPinned,
  MessageCircle,
  Users,
} from "lucide-react";
import PortalLuxHeader from "@/components/portal/lux/PortalLuxHeader";
import PortalJourneyAxis, { type LuxAxisStage } from "@/components/portal/lux/PortalJourneyAxis";
import PortalLuxFooter from "@/components/portal/lux/PortalLuxFooter";
import PortalToolsGrid, { type LuxTool } from "@/components/portal/lux/PortalToolsGrid";
import PortalAppInvite from "@/components/portal/lux/PortalAppInvite";
import PortalOfferSheet from "@/components/portal/lux/PortalOfferSheet";
import PortalCompare from "@/components/portal/lux/PortalCompare";
import PortalPartnerSheet, { type PortalCompanion } from "@/components/portal/lux/PortalPartnerSheet";
import PortalBookingSheet, { type BookingOffer } from "@/components/portal/lux/PortalBookingSheet";
import PortalAreaSheet from "@/components/portal/lux/PortalAreaSheet";
import PortalCostCalculator from "@/components/portal/lux/PortalCostCalculator";
import {
  SellerBuyerOffers,
  SellerCompetition,
  SellerNetSheet,
  SellerShowingFeedback,
  SellerStatsTiles,
  type SellerPortalV2,
} from "@/components/portal/lux/SellerLux";
import { portalAction } from "@/components/portal/lux/portalApi";
import PortalDocuments, { type PortalDocument } from "@/components/portal/lux/PortalDocuments";
import { PortalReferral, PortalReview } from "@/components/portal/lux/PortalReviewReferral";
import { matchSentiment, type LuxMatch, type LuxPartnerFeedback } from "@/components/portal/lux/types";
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
import ClientPortalPresentationHero, {
  type PortalPresentationSlot,
} from "@/components/portal/ClientPortalPresentationHero";
import ListingProgressRail from "@/components/portal/ListingProgressRail";
import SellerPortalCollaboration from "@/components/portal/SellerPortalCollaboration";
import PortalPromoPresence from "@/components/portal/PortalPromoPresence";
import { rememberClientPortalToken } from "@/lib/crm/portalSession";
import { buyerOnboardingStorageKey, isBuyerOnboardingDismissed } from "@/lib/clientPortalPath";
import { formatMeetingWhenPl } from "@/lib/datetime/warsaw";
import { collectAgentOfferReplies, type ClientOfferSentiment } from "@/lib/crm/clientPortalFeedback";
import { initialOpenMatchIds } from "@/lib/crm/clientPortalOfferBoard";
import ClientPortalAgentReplyInbox from "@/components/portal/ClientPortalAgentReplyInbox";
import ClientPortalNowCard from "@/components/portal/ClientPortalNowCard";
import { Mail, Phone } from "lucide-react";

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
  proposedSlots?: string[];
  offer?: PortalPresentationSlot["offer"];
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
  viewer?: { role: "owner" } | { role: "partner"; companionId: number; name: string };
  greeting?: string;
  clientFirstName?: string;
  permissions?: {
    selfBooking: boolean;
    criteriaEdit: boolean;
    earlyAccess: boolean;
    partnerAccess: boolean;
    sellerStats: boolean;
    sellerFeedback: boolean;
    sellerCompetition: boolean;
    weeklyDigest: boolean;
    viewingReminders?: boolean;
    documents?: boolean;
  };
  companions?: PortalCompanion[];
  appInvite?: { code: string; link: string; qrSvg?: string } | null;
  searchPolygon?: unknown;
  seller?: SellerPortalV2 | null;
  documents?: PortalDocument[];
  documentsSummary?: { required: number; done: number; missing: number; toReview: number } | null;
  review?: { rating: number; comment: string | null; at: string } | null;
  reviewLink?: string;
  syncVersion?: string;
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
  purchase?: {
    phase: "viewed" | "negotiating" | "closed";
    title: string;
    price: number | null;
    address: string;
    offerId: number;
    statusLabel: string;
  } | null;
  matches: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    clientFeedback: string | null;
    clientFeedbackAt: string | null;
    intelligenceSent?: boolean;
    intelligenceReason?: string | null;
    clientWhy?: string | null;
    favorite?: boolean;
    favoriteBadge?: string | null;
    partnerFeedback?: LuxPartnerFeedback[];
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
    createdAt?: string | null;
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
  otherAgencies?: { live?: boolean; body?: string | null } | null;
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
    kind?: string;
    title: string;
    clientMessage: string;
    clientResponse?: string | null;
    dueAt: string | null;
    payload?: Record<string, unknown> | null;
  }>;
  sellerEvents?: {
    openHouse: {
      proposal: { id: number; title: string; status: string } | null;
      event: {
        id: number;
        status: string;
        startsAt: string | null;
        endsAt: string | null;
        title?: string | null;
      } | null;
    };
    auction: {
      proposal: { id: number; title: string; status: string } | null;
      event: {
        id: number;
        status: string;
        startsAt: string | null;
        endsAt: string | null;
        startPrice: number;
        title?: string | null;
      } | null;
    };
    stage: { id: string; label: string; kind: "open_house" | "auction" | null } | null;
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
  const [firstOfferPendingAgent, setFirstOfferPendingAgent] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const matchesSectionRef = useRef<HTMLDivElement | null>(null);
  const knownMatchIdsRef = useRef<number[]>([]);
  const syncVersionRef = useRef("");
  const syncBusyRef = useRef(false);
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
      syncVersionRef.current = String(json.portal?.syncVersion || "");
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
    const checkForChanges = async () => {
      if (document.visibilityState !== "visible" || syncBusyRef.current) return;
      syncBusyRef.current = true;
      try {
        const response = await fetch(`/api/crm/client-portal/${token}/sync`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) return;
        const version = String(json.version || "");
        if (version && syncVersionRef.current && version !== syncVersionRef.current) {
          await load({ silent: true });
        } else if (version) {
          syncVersionRef.current = version;
        }
      } finally {
        syncBusyRef.current = false;
      }
    };
    const timer = window.setInterval(() => void checkForChanges(), 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkForChanges();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
    if (!portal.intelligenceEnabled) return;
    if (portal.matches.length > 0) return;
    if (!portal.unscoredMatchCount) return;

    setReleaseAttempted(true);
    void fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release_first_match" }),
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        // Agent najpierw zatwierdza pierwszą propozycję — pokazujemy to zamiast pustego ekranu.
        if (json?.pendingAgent) setFirstOfferPendingAgent(true);
        return load({ silent: true });
      })
      .catch(() => {});
  }, [token, portal, releaseAttempted, load]);

  const pickSlotHandled = useRef(false);
  useEffect(() => {
    if (!token || !portal || pickSlotHandled.current) return;
    if (portal.type !== "BUYER" || !portal.presentation) return;
    if (portal.presentation.status === "confirmed") return;
    const query = new URLSearchParams(window.location.search);
    const pickSlot = query.get("pickSlot");
    if (!pickSlot) return;
    const allowed = [portal.presentation.startsAt, ...(portal.presentation.proposedSlots || [])];
    if (!allowed.includes(pickSlot)) return;
    pickSlotHandled.current = true;
    void fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_presentation", startsAt: pickSlot }),
    })
      .then(() => {
        query.delete("pickSlot");
        const next = `${window.location.pathname}${query.toString() ? `?${query}` : ""}`;
        window.history.replaceState({}, "", next);
        return load({ silent: true });
      })
      .catch(() => {
        pickSlotHandled.current = false;
      });
  }, [token, portal, load]);
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

  const ackAgentReply = async (matchId: number) => {
    if (!token) return;
    const res = await fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack_agent_reply", matchId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(String(json?.error || "Nie udało się potwierdzić odczytu."));
      return;
    }
    await load({ silent: true });
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
      if (json.intelligenceReply?.action === "error" && json.intelligenceReply?.message) {
        alert(String(json.intelligenceReply.message));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setSavingId(null);
    }
  };

  const [sheetMatchId, setSheetMatchId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingOfferId, setBookingOfferId] = useState<number | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    try {
      const raw = window.localStorage.getItem(`eos-compare:${token}`);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setCompareIds(parsed.map(Number).filter(Number.isFinite).slice(0, 4));
    } catch {
      /* ignore */
    }
  }, [token]);

  const toggleCompare = (matchId: number) => {
    setCompareIds((prev) => {
      const next = prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId].slice(-4);
      try {
        if (token) window.localStorage.setItem(`eos-compare:${token}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleFavorite = async (matchId: number, favorite: boolean) => {
    if (!token) return;
    try {
      await portalAction(token, "toggle_favorite", { matchId, favorite });
      await load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    }
  };

  const rateFromSheet = async (matchId: number, sentiment: "like" | "maybe" | "dislike", note: string) => {
    if (!token || !portal) return;
    if (portal.viewer?.role === "partner") {
      await portalAction(token, "partner_feedback", { matchId, sentiment, note });
      await load({ silent: true });
      return;
    }
    const match = portal.matches.find((m) => m.id === matchId);
    let prev: { liked?: string; disliked?: string; phrases?: string[]; note?: string } = {};
    try {
      prev = match?.clientFeedback ? JSON.parse(match.clientFeedback) : {};
    } catch {
      prev = {};
    }
    await submitFeedback(matchId, {
      sentiment,
      liked: String(prev.liked || ""),
      disliked: String(prev.disliked || ""),
      phrases: Array.isArray(prev.phrases) ? prev.phrases.map(String) : [],
      note: note || String(prev.note || ""),
    });
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

  const unreadAgentReplies = collectAgentOfferReplies(portal.matches).filter((reply) => reply.unread).length;
  const pendingDecision = (portal.pendingDecisions || []).find((decision) => !decision.clientResponse) || null;
  const listingLive = portal.listing?.status === "ACTIVE" || portal.listing?.status === "PUBLISHED";
  const isPartner = portal.viewer?.role === "partner";
  const partnerName = portal.viewer?.role === "partner" ? portal.viewer.name : null;
  const agentFirst = portal.agentName.split(" ")[0] || portal.agentName;
  const permissions = portal.permissions || {
    selfBooking: true,
    criteriaEdit: false,
    earlyAccess: true,
    partnerAccess: true,
    sellerStats: true,
    sellerFeedback: true,
    sellerCompetition: true,
    weeklyDigest: true,
  };
  const luxMatches = portal.matches as unknown as LuxMatch[];
  const sheetMatch = luxMatches.find((m) => m.id === sheetMatchId) || null;
  const compareMatches = compareIds.map((id) => luxMatches.find((m) => m.id === id)).filter(Boolean) as LuxMatch[];
  const ratedCount = luxMatches.filter((m) => matchSentiment(m.clientFeedback)).length;
  const favoriteCount = luxMatches.filter((m) => m.favorite).length;
  const likedOffers: BookingOffer[] = luxMatches
    .filter((m) => matchSentiment(m.clientFeedback) === "like" || m.favorite)
    .map((m) => ({ offerId: m.offer.id, title: m.offer.title }));
  const bookingOffers: BookingOffer[] = likedOffers.length
    ? likedOffers
    : luxMatches.map((m) => ({ offerId: m.offer.id, title: m.offer.title }));
  const canSelfBook =
    portal.type === "BUYER" && !isPartner && permissions.selfBooking && luxMatches.length > 0 &&
    !(portal.presentation && portal.presentation.status === "pending" && new Date(portal.presentation.startsAt).getTime() > Date.now());
  const seller = (portal.seller || null) as SellerPortalV2 | null;
  const listPrice = Number(portal.listing?.price || 0);
  const openBuyerOffers = seller?.buyerOffers.filter((o) => o.status === "OPEN") || [];
  const favoritePrice = Number(
    luxMatches.find((m) => m.favorite)?.offer.price || luxMatches[0]?.offer.price || 0,
  );
  const criteria = portal.searchCriteria;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const nowCard = (
    <ClientPortalNowCard
      input={{
        type: portal.type,
        clientFirstName: greetingName.split(" ")[0] || greetingName,
        agentName: portal.agentName,
        agentPhone: portal.agentPhone || portal.agencyPhone || null,
        presentation: portal.presentation,
        meeting: portal.meeting,
        hasCheckback: portal.type === "BUYER" && Boolean(portal.pendingCheckback),
        unreadAgentReplies,
        pendingOfferCount: pendingMatches.length,
        totalOfferCount: portal.matches.length,
        awaitingFirstOffer,
        firstOfferPendingAgent: firstOfferPendingAgent && portal.matches.length === 0,
        pendingDecisionTitle:
          portal.type === "SELLER"
            ? openBuyerOffers.length
              ? `${openBuyerOffers.length === 1 ? "Oferta kupującego" : `${openBuyerOffers.length} oferty kupujących`} czeka na odpowiedź`
              : pendingDecision
                ? pendingDecision.title
                : null
            : null,
        agreementSigned: portal.acquisition?.status === "SIGNED",
        hasAgreement: Boolean(portal.acquisition?.agreementSnapshot),
        listingLive,
        purchasePhase: portal.purchase?.phase || null,
      }}
    />
  );

  const presentationBlock =
    portal.presentation && token ? (
      <div id="portal-presentation" className="scroll-mt-24">
        <ClientPortalPresentationHero
          token={token}
          clientType={portal.type}
          slot={portal.presentation}
          agentName={portal.agentName}
          onDone={() => load()}
        />
      </div>
    ) : null;

  // ── Oś kupującego ──
  const buyerStageIndex = portal.purchase?.phase === "closed"
    ? 6
    : portal.purchase?.phase === "negotiating"
      ? 3
      : portal.presentation || likedOffers.length
        ? 2
        : luxMatches.length
          ? 1
          : criteria
            ? 1
            : 0;
  const stateFor = (index: number, current: number): LuxAxisStage["state"] =>
    index < current ? "done" : index === current ? "current" : "future";
  const buyerStages: LuxAxisStage[] = [
    {
      id: "criteria",
      label: "Kryteria",
      state: stateFor(0, buyerStageIndex),
      summary: criteria ? (
        <>
          {[criteria.location, criteria.maxBudget ? `do ${criteria.maxBudget}` : null, criteria.minRooms ? `od ${criteria.minRooms} pok.` : null]
            .filter(Boolean)
            .join(" · ")}
          {!isPartner ? (
            <>
              {" · "}
              <button type="button" onClick={() => setAreaOpen(true)} className="font-bold text-[var(--lux-accent)]">
                {portal.searchPolygon ? "obszar na mapie ✓" : "narysuj obszar"}
              </button>
            </>
          ) : null}
        </>
      ) : (
        `${agentFirst} ustala z Tobą, czego szukamy.`
      ),
      content: nowCard,
    },
    {
      id: "proposals",
      label: luxMatches.length ? `Propozycje · ${ratedCount} ${ratedCount === 1 ? "oceniona" : "ocenionych"}` : "Propozycje",
      state: stateFor(1, buyerStageIndex),
      summary: luxMatches.length ? (
        <>
          {favoriteCount ? `${favoriteCount} ulubionych · ` : ""}
          <button type="button" onClick={() => scrollTo("portal-offers")} className="font-bold text-[var(--lux-accent)]">
            zobacz wszystkie
          </button>
          {compareIds.length >= 2 ? (
            <>
              {" · "}
              <button type="button" onClick={() => setCompareOpen(true)} className="font-bold text-[var(--lux-accent)]">
                porównaj
              </button>
            </>
          ) : null}
        </>
      ) : (
        "Pierwsze propozycje pojawią się tutaj."
      ),
      content: (
        <>
          {nowCard}
          {portal.pendingCheckback && token && !isPartner ? (
            <ClientPortalIntelligenceCheckback token={token} checkback={portal.pendingCheckback} onDone={() => void load()} />
          ) : null}
        </>
      ),
    },
    {
      id: "viewings",
      label: "Oglądania",
      state: stateFor(2, buyerStageIndex),
      summary: portal.presentation
        ? `${new Date(portal.presentation.startsAt).getTime() < Date.now() ? "Ostatnie" : "Najbliższe"}: ${formatMeetingWhenPl(portal.presentation.startsAt)}`
        : "Gdy coś się spodoba — umówimy oglądanie.",
      content: (
        <>
          {nowCard}
          {presentationBlock}
          {canSelfBook ? (
            <button type="button" onClick={() => { setBookingOfferId(null); setBookingOpen(true); }} className="lux-btn lux-btn--ink w-full">
              Wybierz termin oglądania z kalendarza {agentFirst}
            </button>
          ) : null}
        </>
      ),
    },
    {
      id: "offer",
      label: "Oferta i negocjacje",
      state: stateFor(3, buyerStageIndex),
      summary: portal.purchase && portal.purchase.phase !== "viewed"
        ? `${portal.purchase.title} · ${portal.purchase.statusLabel}`
        : "Propozycja ceny, odpowiedź sprzedającego, warunki.",
      content: (
        <>
          {nowCard}
          {portal.purchase ? (
            <section className="lux-card p-4">
              <p className="text-[15px] font-bold">{portal.purchase.title}</p>
              <p className="text-[13px] text-[#5B574F]">{portal.purchase.address}</p>
              <p className="lux-serif mt-2 text-[22px]">
                {portal.purchase.price ? `${Number(portal.purchase.price).toLocaleString("pl-PL")} zł` : "Cena do uzgodnienia"}
              </p>
              <p className="mt-1 text-[12px] font-bold text-[var(--lux-accent)]">{portal.purchase.statusLabel}</p>
            </section>
          ) : null}
        </>
      ),
    },
    {
      id: "contract",
      label: "Umowa, kredyt, notariusz",
      state: stateFor(4, buyerStageIndex),
      summary: "Lista dokumentów i terminy w jednym miejscu.",
    },
    {
      id: "keys",
      label: "Klucze",
      state: portal.purchase?.phase === "closed" ? "done" : stateFor(5, buyerStageIndex),
      summary: portal.purchase?.phase === "closed" ? "Gratulacje — nieruchomość jest Twoja." : "Protokół przekazania i stany liczników.",
    },
  ];

  // ── Oś sprzedającego ──
  const signed = portal.acquisition?.status === "SIGNED";
  const listingSold = ["SOLD", "ARCHIVED"].includes(String(portal.listing?.status || "").toUpperCase());
  const acceptedOffer = seller?.buyerOffers.find((o) => o.status === "ACCEPTED") || null;
  const sellerDone = [signed, Boolean(portal.listing), listingLive, Boolean(acceptedOffer) || listingSold, listingSold, listingSold, listingSold];
  const sellerCurrent = Math.max(0, sellerDone.findIndex((d) => !d));
  const sellerCurrentIndex = sellerDone.every(Boolean) ? 7 : sellerCurrent;
  const sellerStages: LuxAxisStage[] = [
    {
      id: "agreement",
      label: "Umowa i wycena",
      state: stateFor(0, sellerCurrentIndex),
      summary: signed
        ? `Podpisana${portal.acquisition?.signedAt ? ` ${new Date(portal.acquisition.signedAt).toLocaleDateString("pl-PL")}` : ""}`
        : portal.meeting
          ? `Spotkanie: ${formatMeetingWhenPl(portal.meeting.startsAt)}`
          : `${agentFirst} przygotowuje umowę.`,
      content: nowCard,
    },
    {
      id: "prep",
      label: "Przygotowanie",
      state: stateFor(1, sellerCurrentIndex),
      summary: portal.listing ? "Zdjęcia, rzut i opis gotowe." : "Sesja zdjęciowa, rzut i opis.",
      content: nowCard,
    },
    {
      id: "publish",
      label: "Publikacja",
      state: stateFor(2, sellerCurrentIndex),
      summary: listingLive
        ? `Aktywne${portal.activeChannels?.length ? ` na ${portal.activeChannels.length + 1} portalach` : ""}`
        : portal.listing?.statusLabel || "Ogłoszenie trafi na portale po akceptacji.",
      content: nowCard,
    },
    {
      id: "viewings",
      label: "Oglądania i oferty",
      state: stateFor(3, sellerCurrentIndex),
      summary: seller?.stats
        ? `${seller.stats.showings} ${seller.stats.showings === 1 ? "oglądanie" : "oglądań"} · ${openBuyerOffers.length} ${openBuyerOffers.length === 1 ? "oferta" : "ofert"} do decyzji`
        : "Pokazy i oferty kupujących.",
      content: (
        <>
          {nowCard}
          {presentationBlock}
          {seller ? (
            <SellerShowingFeedback
              seller={seller}
              agentFirst={agentFirst}
              agentRecommendation={portal.sellerNextStep?.clientMessage || null}
            />
          ) : null}
        </>
      ),
    },
    {
      id: "preliminary",
      label: "Umowa przedwstępna",
      state: stateFor(4, sellerCurrentIndex),
      summary: acceptedOffer ? `Przyjęta oferta: ${acceptedOffer.buyerLabel} · ${acceptedOffer.amount.toLocaleString("pl-PL")} zł` : "Zadatek, terminy, warunki kredytu kupującego.",
      content: nowCard,
    },
    { id: "deed", label: "Akt notarialny", state: stateFor(5, sellerCurrentIndex), summary: "Lista dokumentów do sprzedaży i termin u notariusza." },
    { id: "handover", label: "Przekazanie mieszkania", state: stateFor(6, sellerCurrentIndex), summary: "Protokół, liczniki, klucze." },
  ];

  const stages = portal.type === "BUYER" ? buyerStages : sellerStages;
  const currentStage = stages.find((s) => s.state === "current");
  const doneCount = stages.filter((s) => s.state === "done").length;
  const headline =
    portal.type === "BUYER"
      ? (
          {
            criteria: "Ustalamy, czego szukamy.",
            proposals: luxMatches.length ? "Wybieramy najlepsze propozycje." : "Szukamy dla Ciebie.",
            viewings: "Jesteśmy na etapie oglądań.",
            offer: "Negocjujemy warunki.",
            contract: "Dopinamy formalności.",
            keys: "Klucze są Twoje.",
          } as Record<string, string>
        )[currentStage?.id || "keys"]
      : (
          {
            agreement: "Zaczynamy współpracę.",
            prep: "Przygotowujemy ogłoszenie.",
            publish: "Ogłoszenie trafia na rynek.",
            viewings: portal.listing?.createdAt
              ? `Sprzedaż trwa — ${Math.max(1, Math.round((Date.now() - new Date(portal.listing.createdAt).getTime()) / 86_400_000))} dni na rynku.`
              : "Sprzedaż trwa.",
            preliminary: "Mamy kupującego.",
            deed: "Przed aktem notarialnym.",
            handover: "Przekazanie mieszkania.",
          } as Record<string, string>
        )[currentStage?.id || "handover"] || "Sprzedane.";

  const buyerTools: LuxTool[] = [
    ...(compareIds.length
      ? [{ key: "compare", title: "Porównanie", description: `${compareIds.length} ${compareIds.length === 1 ? "oferta" : "oferty"} obok siebie`, icon: Columns2, onClick: () => setCompareOpen(true), badge: String(compareIds.length) }]
      : [{ key: "compare", title: "Porównanie", description: "Zaznacz oferty „Do porównania”", icon: Columns2, onClick: () => scrollTo("portal-offers") }]),
    ...(!isPartner && criteria ? [{ key: "area", title: "Moje kryteria", description: portal.searchPolygon ? "Obszar na mapie zapisany" : "Narysuj obszar na mapie", icon: MapPinned, onClick: () => setAreaOpen(true) }] : []),
    ...(canSelfBook ? [{ key: "booking", title: "Umów oglądanie", description: `Wolne terminy ${agentFirst}`, icon: CalendarCheck2, onClick: () => { setBookingOfferId(null); setBookingOpen(true); } }] : []),
    { key: "calc", title: "Rata i koszty", description: "Kredyt, podatek, notariusz, prowizja", icon: Calculator, onClick: () => setCalcOpen(true) },
    ...(!isPartner && permissions.partnerAccess ? [{ key: "partner", title: "Druga osoba", description: portal.companions?.length ? `${portal.companions.map((c) => c.name).join(", ")} ma dostęp` : "Wybierajcie razem", icon: Users, onClick: () => setPartnerOpen(true) }] : []),
    { key: "chat", title: "Rozmowa", description: `Napisz do ${agentFirst}`, icon: MessageCircle, onClick: () => scrollTo("portal-chat") },
  ];
  const sellerTools: LuxTool[] = [
    ...(seller ? [{ key: "net", title: "Ile zostanie na rękę", description: "Po prowizji, podatku i spłacie kredytu", icon: Calculator, onClick: () => setNetOpen(true) }] : []),
    ...(openBuyerOffers.length ? [{ key: "offers", title: "Oferty kupujących", description: `${openBuyerOffers.length} do decyzji`, icon: Handshake, onClick: () => scrollTo("portal-buyer-offers"), badge: String(openBuyerOffers.length) }] : []),
    ...(portal.listing?.id ? [{ key: "listing", title: "Ogłoszenie", description: "Zobacz, co widzą kupujący", icon: ExternalLink, onClick: () => window.open(`/oferta/${portal.listing?.id}`, "_blank") }] : []),
    ...(portal.acquisition?.agreementSnapshot && token ? [{ key: "doc", title: "Umowa", description: "Dokument w przeglądarce", icon: BriefcaseBusiness, onClick: () => window.open(`/klient/${token}/dokument`, "_blank") }] : []),
    { key: "chat", title: "Rozmowa", description: `Napisz do ${agentFirst}`, icon: MessageCircle, onClick: () => scrollTo("portal-chat") },
  ];

  return (
    <main className="client-portal-page pb-24 text-[var(--eos-text)] sm:pb-28">
      <PortalLuxHeader
        greeting={portal.greeting || `Dzień dobry, ${greetingName}`}
        headline={headline}
        bar={{ done: doneCount, total: stages.length }}
        agencyName={portal.agencyName}
        agencyLogo={portal.agencyLogo}
        agentName={portal.agentName}
        agentPhoto={portal.agentPhoto}
        agentTitle={portal.agentTitle}
        agentPhone={portal.agentPhone || portal.agencyPhone || null}
        partnerName={partnerName}
        onChat={() => scrollTo("portal-chat")}
      >
        {portal.type === "SELLER" && seller ? (
          <>
            {portal.listing ? (
              <div className="mt-4 flex gap-3 rounded-[20px] border border-[#D8C3A0]/20 bg-white/[0.06] p-3">
                {portal.listing.imageUrl ? (
                  <img src={portal.listing.imageUrl} alt="" className="size-[84px] shrink-0 rounded-[14px] object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{portal.listing.title}</p>
                  <p className="lux-serif mt-0.5 text-[20px]">{portal.listing.price ? `${portal.listing.price.toLocaleString("pl-PL")} zł` : "Cena na zapytanie"}</p>
                  <p className="mt-0.5 text-[12px] text-[#BDB6AA]">{portal.listing.statusLabel || ""}</p>
                </div>
              </div>
            ) : null}
            <SellerStatsTiles stats={seller.stats} />
          </>
        ) : null}
      </PortalLuxHeader>

      <div className="mx-auto max-w-3xl space-y-7 px-4 pt-6 sm:px-6">
        <PortalJourneyAxis title={portal.type === "BUYER" ? "Droga do kluczy" : "Droga do aktu"} stages={stages} />

        {portal.type === "BUYER" && token && !isPartner ? (
          <div id="portal-replies" className="scroll-mt-24">
            <ClientPortalAgentReplyInbox
              token={token}
              replies={collectAgentOfferReplies(portal.matches)}
              onOpenOffer={(matchId) => {
                ensureMatchOpen(matchId);
                window.setTimeout(() => {
                  document.getElementById(`portal-match-${matchId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
              onDone={() => void load({ silent: true })}
            />
          </div>
        ) : null}

        {portal.meeting && !collapseAgentMeeting && portal.type === "SELLER" ? (
          <section id="portal-meeting" className="lux-card scroll-mt-24 p-5">
            <p className="lux-kicker">Spotkanie z agentem</p>
            <h2 className="lux-serif mt-1.5 text-[24px] font-medium">{formatMeetingWhenPl(portal.meeting.startsAt)}</h2>
            {portal.meeting.location ? <p className="mt-1 text-sm text-[#5B574F]">{portal.meeting.location}</p> : null}
            {portal.meeting.prepLabels?.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {portal.meeting.prepLabels.map((label) => (
                  <li key={label} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--lux-accent)]" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
            {token ? <ClientPortalScheduleActions token={token} kind="meeting" slot={portal.meeting} onDone={() => load()} /> : null}
          </section>
        ) : null}

        {portal.type === "SELLER" && seller && token ? (
          <SellerBuyerOffers seller={seller} listPrice={listPrice} token={token} agentFirst={agentFirst} onChanged={() => void load({ silent: true })} />
        ) : null}

        {portal.type === "SELLER" && token ? (
          <div id="portal-decisions" className="scroll-mt-24">
            <SellerPortalCollaboration
              token={token}
              listingImage={portal.listing?.imageUrl}
              listingPath={portal.listingPath || []}
              activeChannels={portal.activeChannels || []}
              sellerNextStep={portal.sellerNextStep || null}
              pendingDecisions={portal.pendingDecisions || []}
              sellerEvents={portal.sellerEvents || null}
              listingHref={portal.listing?.id ? `/oferta/${portal.listing.id}` : null}
              onDone={() => void load()}
            />
          </div>
        ) : null}

        {portal.type === "SELLER" && portal.listing ? (
          <section id="portal-listing" className="lux-card scroll-mt-24 p-5">
            <p className="lux-kicker">Ogłoszenie i promocja</p>
            {portal.listingProgress?.length ? <ListingProgressRail stages={portal.listingProgress} /> : null}
            <PortalPromoPresence
              listing={portal.listing}
              listingPath={portal.listingPath || []}
              activeChannels={portal.activeChannels || []}
              otherAgencies={portal.otherAgencies || null}
            />
          </section>
        ) : null}

        {portal.type === "SELLER" && seller ? <SellerCompetition seller={seller} /> : null}

        {portal.type === "SELLER" && portal.acquisition?.agreementSnapshot ? (
          <section id="portal-agreement" className="lux-card scroll-mt-24 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="lux-kicker">Umowa</p>
                <h2 className="lux-serif mt-1.5 text-[22px] font-medium">Warunki współpracy</h2>
              </div>
              <span className="rounded-full bg-black px-3 py-1 text-[11px] font-bold text-[#D8C3A0]">
                {signed ? "Podpisana" : "Do podpisu"}
              </span>
            </div>
            <pre className="mt-3 max-h-[18rem] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#F6F3EE] p-4 text-xs leading-relaxed text-[#2E2C28]">
              {portal.acquisition.agreementSnapshot}
            </pre>
            {token ? (
              <a href={`/klient/${token}/dokument`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--lux-accent)]">
                Otwórz dokument <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            {(portal.acquisition.formData.paperContracts || []).map((file) => (
              <a
                key={file.url}
                href={file.url.startsWith("http") ? file.url : `https://estateos.pl${file.url.startsWith("/") ? file.url : `/${file.url}`}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-between rounded-xl bg-[#F6F3EE] px-4 py-3 text-sm font-semibold text-[var(--lux-accent)]"
              >
                {file.name} <ExternalLink className="size-3.5" />
              </a>
            ))}
          </section>
        ) : null}

        {portal.type === "BUYER" && token ? (
          <div ref={matchesSectionRef} id="portal-offers" className="scroll-mt-24">
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
              onAckReply={ackAgentReply}
              onOpenSheet={(matchId) => setSheetMatchId(matchId)}
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

        {token && portal.documents?.length && (portal.permissions?.documents ?? true) ? (
          <PortalDocuments
            token={token}
            documents={portal.documents}
            summary={portal.documentsSummary}
            agentFirst={agentFirst}
            canUpload={!isPartner}
            onChanged={() => void load({ silent: true })}
          />
        ) : null}

        <PortalToolsGrid
          kicker="Narzędzia"
          title={portal.type === "BUYER" ? "Żeby wybrać pewnie" : "Wszystko o sprzedaży"}
          tools={portal.type === "BUYER" ? buyerTools : sellerTools}
        />

        {token ? (
          <section id="portal-chat" className="lux-card scroll-mt-24 p-5 sm:p-6">
            <p className="lux-kicker">Rozmowa</p>
            <h2 className="lux-serif mt-1.5 text-[22px] font-medium">Masz pytanie? Napisz tutaj</h2>
            <p className="mt-1 text-sm text-[#5B574F]">
              {agentFirst} odpowie w tym oknie — dostaniesz też powiadomienie.
            </p>
            <div className="mt-4">
              <ClientPortalLiveChat token={token} agentName={portal.agentName} />
            </div>
          </section>
        ) : null}

        {portal.appInvite ? <PortalAppInvite invite={portal.appInvite} /> : null}

        {token && !isPartner && (portal.type === "BUYER" ? portal.purchase?.phase === "closed" : listingSold) ? (
          <PortalReview
            token={token}
            agentFirst={agentFirst}
            review={portal.review}
            reviewLink={portal.reviewLink}
            onChanged={() => void load({ silent: true })}
          />
        ) : null}
        {token ? <PortalReferral token={token} agentFirst={agentFirst} /> : null}

        {portal.type === "BUYER" && token && !onboardingDismissed && !isPartner ? (
          <ClientPortalBuyerOnboarding
            token={token}
            agentName={portal.agentName}
            hasPendingOffer={pendingMatches.length > 0}
            welcomeEmailSent={welcomeEmailSent}
            intelligenceEnabled={Boolean(portal.intelligenceEnabled)}
            onDismiss={() => {
              setFromSzukam(false);
              setOnboardingDismissed(true);
              try {
                window.localStorage.setItem(buyerOnboardingStorageKey(token), "1");
              } catch {
                /* ignore */
              }
            }}
            onShowOffers={() => {
              matchesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : null}

        {token && !isPartner ? (
          <ClientPortalSetupPrompt token={token} deferUntilReady={fromSzukam && !onboardingDismissed} />
        ) : null}

        <PortalLuxFooter agencyName={portal.agencyName} partner={isPartner} />
      </div>

      {portal.type === "BUYER" && compareIds.length ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => (compareIds.length >= 2 ? setCompareOpen(true) : scrollTo("portal-offers"))}
            className="flex items-center gap-3 rounded-full bg-black px-5 py-3 text-[14px] font-bold text-[#D8C3A0] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
          >
            <Columns2 className="size-4" />
            {compareIds.length >= 2 ? `Porównaj ${compareIds.length} oferty` : "Wybierz jeszcze jedną ofertę do porównania"}
          </button>
        </div>
      ) : null}

      <PortalOfferSheet
        match={sheetMatch}
        onClose={() => setSheetMatchId(null)}
        isPartner={isPartner}
        partnerName={partnerName}
        inCompare={sheetMatch ? compareIds.includes(sheetMatch.id) : false}
        onToggleCompare={() => sheetMatch && toggleCompare(sheetMatch.id)}
        onToggleFavorite={() => sheetMatch && void toggleFavorite(sheetMatch.id, !sheetMatch.favorite)}
        onRate={(sentiment, note) => (sheetMatch ? rateFromSheet(sheetMatch.id, sentiment, note) : Promise.resolve())}
        onBook={() => {
          if (!sheetMatch) return;
          setBookingOfferId(sheetMatch.offer.id);
          setSheetMatchId(null);
          setBookingOpen(true);
        }}
        canBook={canSelfBook}
      />
      {token ? (
        <>
          <PortalCompare
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            matches={compareMatches}
            onOpenOffer={(m) => {
              setCompareOpen(false);
              setSheetMatchId(m.id);
            }}
            onRemove={(id) => toggleCompare(id)}
            agentName={portal.agentName}
          />
          <PortalPartnerSheet
            open={partnerOpen}
            onClose={() => setPartnerOpen(false)}
            token={token}
            companions={portal.companions || []}
            onChanged={() => void load({ silent: true })}
          />
          <PortalBookingSheet
            open={bookingOpen}
            onClose={() => setBookingOpen(false)}
            token={token}
            offers={bookingOffers}
            initialOfferId={bookingOfferId}
            agentName={agentFirst}
            onBooked={() => void load({ silent: true })}
          />
          <PortalAreaSheet
            open={areaOpen}
            onClose={() => setAreaOpen(false)}
            token={token}
            initial={(portal.searchPolygon as Array<[number, number]> | null) || null}
            criteriaEditAllowed={permissions.criteriaEdit}
            agentName={agentFirst}
            onSaved={() => void load({ silent: true })}
          />
          <PortalCostCalculator open={calcOpen} onClose={() => setCalcOpen(false)} initialPrice={favoritePrice} />
          {seller ? (
            <SellerNetSheet
              open={netOpen}
              onClose={() => setNetOpen(false)}
              seller={seller}
              defaultPrice={listPrice}
              token={token}
              onSaved={() => void load({ silent: true })}
            />
          ) : null}
        </>
      ) : null}
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
