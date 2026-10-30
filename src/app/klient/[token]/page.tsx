"use client";

import { portalToast } from "@/lib/portalUi";
import OfferInterestPanel from "@/components/offers/OfferInterestPanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  CalendarCheck2,
  BriefcaseBusiness,
  Calculator,
  Columns2,
  Handshake,
  MapPinned,
  MessageCircle,
  Users,
  Route,
  Sparkles,
  FolderOpen,
  LayoutGrid,
  MessagesSquare,
  Megaphone,
  FileSignature,
  Gift,
} from "lucide-react";
import PortalLuxHeader from "@/components/portal/lux/PortalLuxHeader";
import PortalJourneyAxis, { type LuxAxisStage } from "@/components/portal/lux/PortalJourneyAxis";
import PortalLuxFooter from "@/components/portal/lux/PortalLuxFooter";
import PortalUiHost from "@/components/portal/lux/PortalUiHost";
import PortalStickyBar from "@/components/portal/lux/PortalStickyBar";
import PortalMilestone from "@/components/portal/lux/PortalMilestone";
import PortalLoadingSkeleton from "@/components/portal/lux/PortalLoadingSkeleton";
import PortalToolsGrid, { type LuxTool } from "@/components/portal/lux/PortalToolsGrid";
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
import PortalDocuments, { computeDocumentsSummary, type PortalDocument } from "@/components/portal/lux/PortalDocuments";
import PortalGroup, { usePortalGroups } from "@/components/portal/lux/PortalGroup";
import PortalBuyerDeals, { type PortalBuyerDeal } from "@/components/portal/lux/PortalBuyerDeals";
import PortalNotificationsBell, { useNoticeReadState } from "@/components/portal/lux/PortalNotificationsBell";
import { buildPortalNotices, type PortalNotice, type PortalNoticeGroup } from "@/lib/crm/portalNotices";
import { PortalReferral, PortalReview } from "@/components/portal/lux/PortalReviewReferral";
import { matchSentiment, type LuxMatch, type LuxPartnerFeedback } from "@/components/portal/lux/types";
import { type AcquisitionFormData } from "@/lib/acquisitionWorkflow";
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
import PortalReachCard, { type PortalReach } from "@/components/portal/lux/PortalReachCard";
import { rememberClientPortalToken } from "@/lib/crm/portalSession";
import { buyerOnboardingStorageKey, isBuyerOnboardingDismissed } from "@/lib/clientPortalPath";
import { PortalLanguageSwitch, PortalLocaleProvider, usePortalLocaleState } from "@/components/portal/PortalLocale";
import type { Locale } from "@/i18n/config";
import { collectAgentOfferReplies, type ClientOfferSentiment } from "@/lib/crm/clientPortalFeedback";
import { initialOpenMatchIds } from "@/lib/crm/clientPortalOfferBoard";
import ClientPortalAgentReplyInbox from "@/components/portal/ClientPortalAgentReplyInbox";
import ClientPortalNowCard, { resolvePortalNow, type PortalNowInput } from "@/components/portal/ClientPortalNowCard";

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
  locale?: Locale;
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
  appInvite?: { code: string; link: string; qrSvg?: string; expiresAt?: string | null } | null;
  searchPolygon?: unknown;
  seller?: SellerPortalV2 | null;
  buyerDeals?: PortalBuyerDeal[];
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
  reach?: PortalReach | null;
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
  const [chatInfo, setChatInfo] = useState<{ unread: number; latestAgentId: string | null; latestAt: string | null; preview: string | null }>({
    unread: 0,
    latestAgentId: null,
    latestAt: null,
    preview: null,
  });
  const onChatUnread = useCallback(
    (info: { unread: number; latestAgentId: string | null; latestAt: string | null; preview: string | null }) =>
      setChatInfo((prev) =>
        prev.unread === info.unread && prev.latestAgentId === info.latestAgentId && prev.preview === info.preview ? prev : info,
      ),
    [],
  );
  const groupDefaults = useMemo(
    () => ({ journey: true, deals: true, offers: true, sale: true, listing: false, agreement: false, documents: true, tools: false, chat: true, more: false }),
    [],
  );
  const groups = usePortalGroups(token, groupDefaults);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const portalLoaded = Boolean(portal);
  const portalLocale = usePortalLocaleState(token, portal?.locale, portal?.viewer?.role === "partner");
  const { t, p, dateLocale } = portalLocale;
  /** Termin w języku panelu, zawsze w czasie warszawskim. */
  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  useEffect(() => {
    if (!portalLoaded || typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-group]"));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = top?.target.getAttribute("data-group");
        if (id) setActiveGroup(id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [portalLoaded]);
  const { read: readNotices, markRead: markNoticesRead } = useNoticeReadState(token);

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
      portalToast.error(t("Nie udało się potwierdzić odczytu."), String(json?.error || ""));
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
      if (!res.ok) throw new Error(json.error || t("Nie udało się wysłać"));
      await load({ silent: true });
      if (json.intelligenceReply?.action === "error" && json.intelligenceReply?.message) {
        portalToast.info(t("Wiadomość od asystenta"), String(json.intelligenceReply.message));
      } else {
        const sentimentLabel =
          payload.sentiment === "like" ? "Chcę oglądać" : payload.sentiment === "dislike" ? "Nie pasuje" : payload.sentiment === "maybe" ? "Do przemyślenia" : null;
        portalToast.success(t("Ocena zapisana"), sentimentLabel ? `${t(sentimentLabel)} — ${t("agent zobaczy to od razu.")}` : t("Agent zobaczy ją od razu."));
      }
    } catch (e) {
      portalToast.error(t("Nie udało się wysłać oceny"), e);
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
      portalToast.success(favorite ? t("Dodano do ulubionych") : t("Usunięto z ulubionych"), favorite ? t("Damy znać, gdy zmieni się cena.") : undefined);
      await load({ silent: true });
    } catch (e) {
      portalToast.error(t("Nie udało się zapisać ulubionej"), e);
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
  if (loading && !fromSzukam) return <PortalLoadingSkeleton />;
  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        {fromSzukam ? (
          <ClientPortalOfferSearchPanel compact />
        ) : null}
        {fromSzukam && welcomeEmailSent ? (
          <p className="mt-4 text-center text-xs leading-relaxed text-[var(--eos-muted)]">
            {t("Link do panelu leci też na Twój e-mail.")}
          </p>
        ) : null}
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--eos-text)]">{t("Panel niedostępny")}</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{error || t("Link wygasł lub jest nieprawidłowy.")}</p>
        <Link href="/" className="mt-6 inline-block text-emerald-600 underline">
          {t("Wróć na EstateOS")}
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
  /** Rozwija grupę, w której jest element, przewija do niego i krótko go podświetla. */
  const focusAnchor = (anchor: string, fallbackGroup?: string) => {
    const el = document.getElementById(anchor);
    const groupId = el?.closest("[data-group]")?.getAttribute("data-group") || fallbackGroup || null;
    const wasOpen = groupId ? groups.isOpen(groupId) : true;
    if (groupId && !wasOpen) groups.setOpen(groupId, true);
    window.setTimeout(() => {
      const target = document.getElementById(anchor) || (groupId ? document.getElementById(`grp-${groupId}`) : null);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.remove("eos-flash");
      void target.offsetWidth;
      target.classList.add("eos-flash");
    }, wasOpen ? 40 : 420);
  };
  const scrollTo = (id: string) => focusAnchor(id);

  const nowInput: PortalNowInput = {
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
              ? openBuyerOffers.length === 1
                ? t("Oferta kupującego czeka na odpowiedź")
                : t("{n} {offers} czeka na odpowiedź", { n: openBuyerOffers.length, offers: p(openBuyerOffers.length, "oferta kupującego|oferty kupujących|ofert kupujących") })
              : pendingDecision
                ? pendingDecision.title
                : null
            : null,
        agreementSigned: portal.acquisition?.status === "SIGNED",
        hasAgreement: Boolean(portal.acquisition?.agreementSnapshot),
        listingLive,
        purchasePhase: portal.purchase?.phase || null,
  };
  const nowCard = <ClientPortalNowCard input={nowInput} />;

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
      label: t("Kryteria"),
      state: stateFor(0, buyerStageIndex),
      summary: criteria ? (
        <>
          {[criteria.location, criteria.maxBudget ? t("do {v}", { v: criteria.maxBudget }) : null, criteria.minRooms ? t("od {n} pok.", { n: criteria.minRooms }) : null]
            .filter(Boolean)
            .join(" · ")}
          {!isPartner ? (
            <>
              {" · "}
              <button type="button" onClick={() => setAreaOpen(true)} className="font-bold text-[var(--lux-accent)]">
                {portal.searchPolygon ? t("obszar na mapie ✓") : t("narysuj obszar")}
              </button>
            </>
          ) : null}
        </>
      ) : (
        t("{agent} ustala z Tobą, czego szukamy.", { agent: agentFirst })
      ),
      content: nowCard,
    },
    {
      id: "proposals",
      label: luxMatches.length ? `${t("Propozycje")} · ${ratedCount} ${p(ratedCount, "oceniona|ocenione|ocenionych")}` : t("Propozycje"),
      state: stateFor(1, buyerStageIndex),
      summary: luxMatches.length ? (
        <>
          {favoriteCount ? `${favoriteCount} ${p(favoriteCount, "ulubiona|ulubione|ulubionych")} · ` : ""}
          <button type="button" onClick={() => scrollTo("portal-offers")} className="font-bold text-[var(--lux-accent)]">
            {t("zobacz wszystkie")}
          </button>
          {compareIds.length >= 2 ? (
            <>
              {" · "}
              <button type="button" onClick={() => setCompareOpen(true)} className="font-bold text-[var(--lux-accent)]">
                {t("porównaj")}
              </button>
            </>
          ) : null}
        </>
      ) : (
        t("Pierwsze propozycje pojawią się tutaj.")
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
      label: t("Oglądania"),
      state: stateFor(2, buyerStageIndex),
      summary: portal.presentation
        ? `${new Date(portal.presentation.startsAt).getTime() < Date.now() ? t("Ostatnie") : t("Najbliższe")}: ${fmtWhen(portal.presentation.startsAt)}`
        : t("Gdy coś się spodoba — umówimy oglądanie."),
      content: (
        <>
          {nowCard}
          {presentationBlock}
          {canSelfBook ? (
            <button type="button" onClick={() => { setBookingOfferId(null); setBookingOpen(true); }} className="lux-btn lux-btn--ink w-full">
              {t("Wybierz termin oglądania z kalendarza {agent}", { agent: agentFirst })}
            </button>
          ) : null}
        </>
      ),
    },
    {
      id: "offer",
      label: t("Oferta i negocjacje"),
      state: stateFor(3, buyerStageIndex),
      summary: portal.purchase && portal.purchase.phase !== "viewed"
        ? `${portal.purchase.title} · ${portal.purchase.statusLabel}`
        : t("Propozycja ceny, odpowiedź sprzedającego, warunki."),
      content: (
        <>
          {nowCard}
          {portal.purchase ? (
            <section className="lux-card p-4">
              <p className="text-[15px] font-bold">{portal.purchase.title}</p>
              <p className="text-[13px] text-[var(--lux-ink-2)]">{portal.purchase.address}</p>
              <p className="lux-serif mt-2 text-[22px]">
                {portal.purchase.price ? `${Number(portal.purchase.price).toLocaleString(dateLocale)} zł` : t("Cena do uzgodnienia")}
              </p>
              <p className="mt-1 text-[12px] font-bold text-[var(--lux-accent)]">{portal.purchase.statusLabel}</p>
            </section>
          ) : null}
        </>
      ),
    },
    {
      id: "contract",
      label: t("Umowa, kredyt, notariusz"),
      state: stateFor(4, buyerStageIndex),
      summary: t("Lista dokumentów i terminy w jednym miejscu."),
    },
    {
      id: "keys",
      label: t("Klucze"),
      state: portal.purchase?.phase === "closed" ? "done" : stateFor(5, buyerStageIndex),
      summary: portal.purchase?.phase === "closed" ? t("Gratulacje — nieruchomość jest Twoja.") : t("Protokół przekazania i stany liczników."),
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
      label: t("Umowa i wycena"),
      state: stateFor(0, sellerCurrentIndex),
      summary: signed
        ? `${t("Podpisana")}${portal.acquisition?.signedAt ? ` ${new Date(portal.acquisition.signedAt).toLocaleDateString(dateLocale)}` : ""}`
        : portal.meeting
          ? `${t("Spotkanie")}: ${fmtWhen(portal.meeting.startsAt)}`
          : t("{agent} przygotowuje umowę.", { agent: agentFirst }),
      content: nowCard,
    },
    {
      id: "prep",
      label: t("Przygotowanie"),
      state: stateFor(1, sellerCurrentIndex),
      summary: portal.listing ? t("Zdjęcia, rzut i opis gotowe.") : t("Sesja zdjęciowa, rzut i opis."),
      content: nowCard,
    },
    {
      id: "publish",
      label: t("Publikacja"),
      state: stateFor(2, sellerCurrentIndex),
      summary: listingLive
        ? portal.activeChannels?.length
          ? t("Aktywne na {n} portalach", { n: portal.activeChannels.length + 1 })
          : t("Aktywne")
        : t("Ogłoszenie zobaczysz tutaj po aktywacji — dostaniesz powiadomienie."),
      content: nowCard,
    },
    {
      id: "viewings",
      label: t("Oglądania i oferty"),
      state: stateFor(3, sellerCurrentIndex),
      summary: seller?.stats
        ? `${seller.stats.showings} ${p(seller.stats.showings, "oglądanie|oglądania|oglądań")} · ${t("{n} {offers} do decyzji", { n: openBuyerOffers.length, offers: p(openBuyerOffers.length, "oferta|oferty|ofert") })}`
        : t("Pokazy i oferty kupujących."),
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
      label: t("Umowa przedwstępna"),
      state: stateFor(4, sellerCurrentIndex),
      summary: acceptedOffer ? `${t("Przyjęta oferta")}: ${acceptedOffer.buyerLabel.replace(/^Kupujący/, t("Kupujący"))} · ${acceptedOffer.amount.toLocaleString(dateLocale)} zł` : t("Zadatek, terminy, warunki kredytu kupującego."),
      content: nowCard,
    },
    { id: "deed", label: t("Akt notarialny"), state: stateFor(5, sellerCurrentIndex), summary: t("Lista dokumentów do sprzedaży i termin u notariusza.") },
    { id: "handover", label: t("Przekazanie mieszkania"), state: stateFor(6, sellerCurrentIndex), summary: t("Protokół, liczniki, klucze.") },
  ];

  const stages = portal.type === "BUYER" ? buyerStages : sellerStages;
  const currentStage = stages.find((s) => s.state === "current");
  const doneCount = stages.filter((s) => s.state === "done").length;
  const headline =
    portal.type === "BUYER"
      ? (
          {
            criteria: t("Ustalamy, czego szukamy."),
            proposals: luxMatches.length ? t("Wybieramy najlepsze propozycje.") : t("Szukamy dla Ciebie."),
            viewings: t("Jesteśmy na etapie oglądań."),
            offer: t("Negocjujemy warunki."),
            contract: t("Dopinamy formalności."),
            keys: t("Klucze są Twoje."),
          } as Record<string, string>
        )[currentStage?.id || "keys"]
      : (
          {
            agreement: t("Zaczynamy współpracę."),
            prep: t("Przygotowujemy ogłoszenie."),
            publish: t("Ogłoszenie trafia na rynek."),
            viewings: portal.listing?.createdAt
              ? t("Sprzedaż trwa — {n} {days} na rynku.", {
                  n: Math.max(1, Math.round((Date.now() - new Date(portal.listing.createdAt).getTime()) / 86_400_000)),
                  days: p(Math.max(1, Math.round((Date.now() - new Date(portal.listing.createdAt).getTime()) / 86_400_000)), "dzień|dni|dni"),
                })
              : t("Sprzedaż trwa."),
            preliminary: t("Mamy kupującego."),
            deed: t("Przed aktem notarialnym."),
            handover: t("Przekazanie mieszkania."),
          } as Record<string, string>
        )[currentStage?.id || "handover"] || t("Sprzedane.");

  const buyerTools: LuxTool[] = [
    ...(compareIds.length
      ? [{ key: "compare", title: t("Porównanie"), description: t("{n} {offers} obok siebie", { n: compareIds.length, offers: p(compareIds.length, "oferta|oferty|ofert") }), icon: Columns2, onClick: () => setCompareOpen(true), badge: String(compareIds.length) }]
      : [{ key: "compare", title: t("Porównanie"), description: t("Zaznacz oferty „Do porównania”"), icon: Columns2, onClick: () => scrollTo("portal-offers") }]),
    ...(!isPartner && criteria ? [{ key: "area", title: t("Moje kryteria"), description: portal.searchPolygon ? t("Obszar na mapie zapisany") : t("Narysuj obszar na mapie"), icon: MapPinned, onClick: () => setAreaOpen(true) }] : []),
    ...(canSelfBook ? [{ key: "booking", title: t("Umów oglądanie"), description: t("Wolne terminy: {agent}", { agent: agentFirst }), icon: CalendarCheck2, onClick: () => { setBookingOfferId(null); setBookingOpen(true); } }] : []),
    { key: "calc", title: t("Rata i koszty"), description: t("Kredyt, podatek, notariusz, prowizja"), icon: Calculator, onClick: () => setCalcOpen(true) },
    ...(!isPartner && permissions.partnerAccess ? [{ key: "partner", title: t("Druga osoba"), description: portal.companions?.length ? t("{names} ma dostęp", { names: portal.companions.map((c) => c.name).join(", ") }) : t("Wybierajcie razem"), icon: Users, onClick: () => setPartnerOpen(true) }] : []),
    { key: "chat", title: t("Rozmowa"), description: t("Napisz do: {agent}", { agent: agentFirst }), icon: MessageCircle, onClick: () => scrollTo("portal-chat") },
  ];
  const sellerTools: LuxTool[] = [
    ...(seller ? [{ key: "net", title: t("Ile zostanie na rękę"), description: t("Po prowizji, podatku i spłacie kredytu"), icon: Calculator, onClick: () => setNetOpen(true) }] : []),
    ...(openBuyerOffers.length ? [{ key: "offers", title: t("Oferty kupujących"), description: t("{n} do decyzji", { n: openBuyerOffers.length }), icon: Handshake, onClick: () => scrollTo("portal-buyer-offers"), badge: String(openBuyerOffers.length) }] : []),
    ...(portal.listing?.id && listingLive ? [{ key: "listing", title: t("Ogłoszenie"), description: t("Zobacz, co widzą kupujący"), icon: ExternalLink, onClick: () => window.open(`/oferta/${portal.listing?.id}`, "_blank") }] : []),
    ...(portal.acquisition?.agreementSnapshot && token ? [{ key: "doc", title: t("Umowa"), description: t("Dokument w przeglądarce"), icon: BriefcaseBusiness, onClick: () => window.open(`/klient/${token}/dokument`, "_blank") }] : []),
    { key: "chat", title: t("Rozmowa"), description: t("Napisz do: {agent}", { agent: agentFirst }), icon: MessageCircle, onClick: () => scrollTo("portal-chat") },
  ];

  // ── Powiadomienia (dzwonek) i plakietki grup ──
  const docSummary = computeDocumentsSummary(portal.documents || []);
  const notices: PortalNotice[] = buildPortalNotices({
    type: portal.type,
    isPartner,
    agentFirst,
    documents: (portal.permissions?.documents ?? true) ? portal.documents || [] : [],
    matches: portal.matches,
    agentReplies: collectAgentOfferReplies(portal.matches),
    checkback: portal.type === "BUYER" && portal.pendingCheckback && !isPartner
      ? {
          activityId: Number((portal.pendingCheckback as { activityId?: number }).activityId || 0),
          body: String((portal.pendingCheckback as { body?: string }).body || ""),
          createdAt: (portal.pendingCheckback as { createdAt?: string }).createdAt,
        }
      : null,
    presentation: portal.presentation,
    meeting: portal.type === "SELLER" ? portal.meeting : null,
    buyerOffers: seller?.buyerOffers || [],
    decisions: portal.pendingDecisions || [],
    agreement:
      portal.type === "SELLER" && portal.acquisition?.agreementSnapshot && !signed
        ? { pending: true, updatedAt: portal.acquisition.updatedAt }
        : null,
    chat: chatInfo,
  }, portalLocale);
  const NOTICE_TO_GROUP: Record<PortalNoticeGroup, string> = {
    journey: "journey",
    offers: "offers",
    sale: "sale",
    listing: "listing",
    agreement: "agreement",
    documents: "documents",
    chat: "chat",
  };
  const groupIds = portal.type === "BUYER"
    ? ["journey", "deals", "offers", "documents", "chat", "tools", "more"]
    : ["journey", "sale", "listing", "agreement", "documents", "chat", "tools", "more"];
  const groupBadge = (groupId: string) => {
    const actions = notices.filter((n) => NOTICE_TO_GROUP[n.group] === groupId && n.tone === "action").length;
    if (groupId === "documents") return Math.max(actions, isPartner ? 0 : docSummary.missing);
    return actions;
  };
  const groupBlink = (groupId: string) => notices.some((n) => NOTICE_TO_GROUP[n.group] === groupId && !readNotices.has(n.id));
  const navigateNotice = (notice: PortalNotice) => {
    if (notice.matchId) ensureMatchOpen(notice.matchId);
    focusAnchor(notice.anchor, NOTICE_TO_GROUP[notice.group]);
  };

  // Jedna rzecz do zrobienia teraz: najpierw to, co prowadzi etap, potem najnowsze powiadomienie z akcją.
  const now = resolvePortalNow(nowInput, portalLocale);
  const topAction = notices.find((n) => n.tone === "action" && !readNotices.has(n.id)) || notices.find((n) => n.tone === "action") || null;
  const nextStep =
    now.tone === "action" && now.cta
      ? { title: now.title, body: now.body, tone: "action" as const, cta: now.cta.label, onClick: () => focusAnchor(now.cta!.target, "journey") }
      : topAction
        ? { title: topAction.title, body: topAction.body || null, tone: "action" as const, cta: t("Przejdź"), onClick: () => navigateNotice(topAction) }
        : {
            title: now.title,
            body: now.body,
            tone: now.tone,
            onClick: now.cta ? () => focusAnchor(now.cta!.target, "journey") : () => focusAnchor("portal-journey", "journey"),
          };
  const GROUP_LABEL: Record<string, string> = {
    journey: t("Etapy"),
    deals: t("Transakcje"),
    offers: t("Propozycje"),
    sale: t("Sprzedaż"),
    listing: t("Ogłoszenie"),
    agreement: t("Umowa"),
    documents: t("Dokumenty"),
    chat: t("Rozmowa"),
    tools: t("Narzędzia"),
    more: t("Więcej"),
  };
  const groupAvailable: Record<string, boolean> = {
    journey: true,
    deals: portal.type === "BUYER" && Boolean(portal.buyerDeals?.length),
    offers: portal.type === "BUYER",
    sale: portal.type === "SELLER",
    listing: portal.type === "SELLER" && Boolean(portal.listing || seller),
    agreement: portal.type === "SELLER" && Boolean(portal.acquisition?.agreementSnapshot),
    documents: Boolean(token && portal.documents?.length && (portal.permissions?.documents ?? true)),
    chat: Boolean(token),
    tools: true,
    more: true,
  };
  const stickyChips = groupIds
    .filter((id) => groupAvailable[id])
    .map((id) => ({ id, label: GROUP_LABEL[id] || id, badge: groupBadge(id), blink: groupBlink(id) }));

  return (
    <PortalLocaleProvider value={portalLocale}>
    <main className="client-portal-page pb-24 text-[var(--eos-text)] sm:pb-28">
      <PortalLuxHeader
        greeting={portalLocale.locale === "pl" && portal.greeting ? portal.greeting : t("Dzień dobry, {name}", { name: greetingName.split(" ")[0] || greetingName })}
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
        bell={
          <PortalNotificationsBell notices={notices} read={readNotices} onMarkRead={markNoticesRead} onNavigate={navigateNotice} />
        }
        nextStep={nextStep}
        languageSwitch={<PortalLanguageSwitch />}
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
                  <p className="lux-serif mt-0.5 text-[20px]">{portal.listing.price ? `${portal.listing.price.toLocaleString(dateLocale)} zł` : t("Cena na zapytanie")}</p>
                  <p className="mt-0.5 text-[12px] text-[#BDB6AA]">{listingLive ? t("Aktywne") : t("Pokażemy je po aktywacji")}</p>
                </div>
              </div>
            ) : null}
            <SellerStatsTiles stats={seller.stats} />
          </>
        ) : null}
      </PortalLuxHeader>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eos-group-divider flex-1">{t("Na teraz")}</p>
          <div className="flex shrink-0 gap-3 text-[12px] font-bold text-[var(--lux-accent)]">
            <button type="button" onClick={() => groups.setAll(groupIds, false)}>{t("Zwiń wszystko")}</button>
            <button type="button" onClick={() => groups.setAll(groupIds, true)}>{t("Rozwiń")}</button>
          </div>
        </div>

        <PortalGroup
          id="journey"
          title={portal.type === "BUYER" ? t("Droga do kluczy") : t("Droga do aktu")}
          summary={currentStage ? `${t("Etap {n} z {total}", { n: stages.indexOf(currentStage) + 1, total: stages.length })} · ${currentStage.label}` : t("Wszystkie etapy zakończone")}
          icon={Route}
          tone="ink"
          open={groups.isOpen("journey")}
          onToggle={() => groups.setOpen("journey", !groups.isOpen("journey"))}
          badge={groupBadge("journey")}
          blink={groupBlink("journey")}
        >
          <div id="portal-journey" className="scroll-mt-24">
            <PortalJourneyAxis title={portal.type === "BUYER" ? t("Droga do kluczy") : t("Droga do aktu")} stages={stages} hideTitle />
          </div>
        </PortalGroup>

        <p className="eos-group-divider pt-3">{t("Twoje sprawy")}</p>

        {portal.type === "BUYER" && portal.buyerDeals?.length ? (
          <PortalGroup
            id="deals"
            title={portal.buyerDeals.length === 1 ? t("Twoja nieruchomość") : t("Twoje nieruchomości")}
            summary={portal.buyerDeals.map((deal) => t(deal.status)).slice(0, 2).join(" · ")}
            icon={Handshake}
            tone="green"
            open={groups.isOpen("deals")}
            onToggle={() => groups.setOpen("deals", !groups.isOpen("deals"))}
            badge={groupBadge("deals")}
            blink={groupBlink("deals")}
          >
            <PortalBuyerDeals deals={portal.buyerDeals} token={token || ""} onChanged={() => void load({ silent: true })} />
          </PortalGroup>
        ) : null}

        {portal.type === "BUYER" ? (
          <PortalGroup
            id="offers"
            title={t("Propozycje ofert")}
            summary={
              luxMatches.length
                ? `${luxMatches.length} ${p(luxMatches.length, "propozycja|propozycje|propozycji")} · ${pendingMatches.length ? t("{n} czeka na Twoją ocenę", { n: pendingMatches.length }) : t("wszystkie ocenione")}`
                : t("Pierwsze propozycje pojawią się tutaj.")
            }
            icon={Sparkles}
            tone="gold"
            open={groups.isOpen("offers")}
            onToggle={() => groups.setOpen("offers", !groups.isOpen("offers"))}
            badge={groupBadge("offers")}
            blink={groupBlink("offers")}
          >
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


          </PortalGroup>
        ) : (
          <>
            <PortalGroup
              id="sale"
              title={t("Sprzedaż i decyzje")}
              summary={
                openBuyerOffers.length
                  ? t("{n} {offers} czeka na decyzję", { n: openBuyerOffers.length, offers: p(openBuyerOffers.length, "oferta kupującego|oferty kupujących|ofert kupujących") })
                  : pendingDecision
                    ? pendingDecision.title
                    : t("Oferty kupujących, spotkania i decyzje")
              }
              icon={Handshake}
              tone="gold"
              open={groups.isOpen("sale")}
              onToggle={() => groups.setOpen("sale", !groups.isOpen("sale"))}
              badge={groupBadge("sale")}
              blink={groupBlink("sale")}
            >
              {portal.meeting && !collapseAgentMeeting && portal.type === "SELLER" ? (
                <section id="portal-meeting" className="lux-card scroll-mt-24 p-5">
                  <p className="lux-kicker">{t("Spotkanie z agentem")}</p>
                  <h2 className="lux-serif mt-1.5 text-[24px] font-medium">{fmtWhen(portal.meeting.startsAt)}</h2>
                  {portal.meeting.location ? <p className="mt-1 text-sm text-[var(--lux-ink-2)]">{portal.meeting.location}</p> : null}
                  {portal.meeting.prepLabels?.length ? (
                    <ul className="mt-4 space-y-2 text-sm">
                      {portal.meeting.prepLabels.map((label) => (
                        <li key={label} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--lux-accent)]" />
                          {t(label)}
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


            </PortalGroup>
            {portal.listing || seller ? (
              <PortalGroup
                id="listing"
                title={t("Ogłoszenie i rynek")}
                summary={
                  listingLive
                    ? [portal.listing?.statusLabel, portal.activeChannels?.length ? `${portal.activeChannels.length + 1} portale` : null].filter(Boolean).join(" · ")
                    : portal.listing
                      ? t("Pokażemy je po aktywacji")
                      : t("Promocja, portale i konkurencja")
                }
                icon={Megaphone}
                tone="blue"
                open={groups.isOpen("listing")}
                onToggle={() => groups.setOpen("listing", !groups.isOpen("listing"))}
                badge={groupBadge("listing")}
                blink={groupBlink("listing")}
              >
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
                    <PortalReachCard reach={portal.reach} agentFirst={agentFirst} />
                    {token ? (
                      <div className="mt-4">
                        <OfferInterestPanel offerId={portal.listing.id} portalToken={token} title="Co oglądają kupujący" />
                      </div>
                    ) : null}
                  </section>
                ) : null}


                {portal.type === "SELLER" && seller ? <SellerCompetition seller={seller} /> : null}


              </PortalGroup>
            ) : null}
            {portal.acquisition?.agreementSnapshot ? (
              <PortalGroup
                id="agreement"
                title={t("Umowa")}
                summary={signed ? `${t("Podpisana")}${portal.acquisition?.signedAt ? ` ${new Date(portal.acquisition.signedAt).toLocaleDateString(dateLocale)}` : ""}` : t("Czeka na Twój podpis")}
                icon={FileSignature}
                tone="slate"
                open={groups.isOpen("agreement")}
                onToggle={() => groups.setOpen("agreement", !groups.isOpen("agreement"))}
                badge={groupBadge("agreement")}
                blink={groupBlink("agreement")}
              >
                {portal.type === "SELLER" && portal.acquisition?.agreementSnapshot ? (
                  <section id="portal-agreement" className="lux-card scroll-mt-24 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="lux-kicker">{t("Umowa")}</p>
                        <h2 className="lux-serif mt-1.5 text-[22px] font-medium">{t("Warunki współpracy")}</h2>
                      </div>
                      <span className="rounded-full bg-black px-3 py-1 text-[11px] font-bold text-[#D8C3A0]">
                        {signed ? t("Podpisana") : t("Do podpisu")}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-[18rem] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[var(--lux-well)] p-4 text-xs leading-relaxed text-[var(--lux-ink)]">
                      {portal.acquisition.agreementSnapshot}
                    </pre>
                    {token ? (
                      <a href={`/klient/${token}/dokument`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--lux-accent)]">
                        {t("Otwórz dokument")} <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                    {(portal.acquisition.formData.paperContracts || []).map((file) => (
                      <a
                        key={file.url}
                        href={file.url.startsWith("http") ? file.url : `https://estateos.pl${file.url.startsWith("/") ? file.url : `/${file.url}`}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center justify-between rounded-xl bg-[var(--lux-well)] px-4 py-3 text-sm font-semibold text-[var(--lux-accent)]"
                      >
                        {file.name} <ExternalLink className="size-3.5" />
                      </a>
                    ))}
                  </section>
                ) : null}


              </PortalGroup>
            ) : null}
          </>
        )}

        {token && portal.documents?.length && (portal.permissions?.documents ?? true) ? (
          <PortalGroup
            id="documents"
            title={t("Dokumenty")}
            summary={docSummary.missing ? t("Brakuje {n} z {total}", { n: docSummary.missing, total: docSummary.total }) : t("Komplet — {n} z {total}", { n: docSummary.total, total: docSummary.total })}
            icon={FolderOpen}
            tone="green"
            open={groups.isOpen("documents")}
            onToggle={() => groups.setOpen("documents", !groups.isOpen("documents"))}
            badge={groupBadge("documents")}
            blink={groupBlink("documents")}
          >
            <PortalDocuments
              token={token}
              documents={portal.documents}
              agentFirst={agentFirst}
              canUpload={!isPartner}
              onChanged={() => void load({ silent: true })}
              embedded
            />
          </PortalGroup>
        ) : null}

        <p className="eos-group-divider pt-3">{t("Kontakt i narzędzia")}</p>

        {token ? (
          <PortalGroup
            id="chat"
            title={`Rozmowa z ${agentFirst}`}
            summary={chatInfo.unread ? `${chatInfo.unread} ${p(chatInfo.unread, "nowa wiadomość|nowe wiadomości|nowych wiadomości")}` : t("Masz pytanie? Napisz tutaj")}
            icon={MessagesSquare}
            tone="rose"
            open={groups.isOpen("chat")}
            onToggle={() => groups.setOpen("chat", !groups.isOpen("chat"))}
            badge={groupBadge("chat")}
            blink={groupBlink("chat")}
          >
            <div id="portal-chat" className="scroll-mt-24">
              <p className="text-sm text-[var(--lux-ink-2)]">{t("{agent} odpowie w tym oknie — dostaniesz też powiadomienie.", { agent: agentFirst })}</p>
              <div className="mt-4">
                <ClientPortalLiveChat token={token} agentName={portal.agentName} onUnreadChange={onChatUnread} />
              </div>
            </div>
          </PortalGroup>
        ) : null}

        <PortalGroup
          id="tools"
          title={portal.type === "BUYER" ? t("Narzędzia — żeby wybrać pewnie") : t("Narzędzia — wszystko o sprzedaży")}
          summary={(portal.type === "BUYER" ? buyerTools : sellerTools).map((t) => t.title).join(" · ")}
          icon={LayoutGrid}
          tone="slate"
          open={groups.isOpen("tools")}
          onToggle={() => groups.setOpen("tools", !groups.isOpen("tools"))}
        >
          <PortalToolsGrid
            kicker={t("Narzędzia")}
            title={portal.type === "BUYER" ? t("Żeby wybrać pewnie") : t("Wszystko o sprzedaży")}
            tools={portal.type === "BUYER" ? buyerTools : sellerTools}
          />
        </PortalGroup>

        <PortalGroup
          id="more"
          title={t("Więcej")}
          summary={t("Aplikacja na telefon, opinia i polecenie")}
          icon={Gift}
          tone="slate"
          open={groups.isOpen("more")}
          onToggle={() => groups.setOpen("more", !groups.isOpen("more"))}
        >
          {token && !isPartner ? (
            <ClientPortalSetupPrompt token={token} invite={portal.appInvite} allowPush />
          ) : null}

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


        </PortalGroup>

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



        <PortalLuxFooter
          agencyName={portal.agencyName}
          partner={isPartner}
          agentName={portal.agentName}
          agentTitle={portal.agentTitle}
          agentPhoto={portal.agentPhoto}
          agentPhone={portal.agentPhone || portal.agencyPhone || null}
          agencyEmail={portal.agentEmail || portal.agencyEmail || null}
          agencyWebsite={portal.agencyWebsite}
          agencyAddress={portal.agencyAddress}
        />
      </div>

      <PortalStickyBar
        agencyName={portal.agencyName}
        agencyLogo={portal.agencyLogo}
        stageLabel={currentStage ? currentStage.label : portal.type === "BUYER" ? t("Klucze są Twoje.") : t("Sprzedane.")}
        done={doneCount}
        total={stages.length}
        chips={stickyChips}
        activeChip={activeGroup}
        onChip={(id) => focusAnchor(`grp-${id}`, id)}
        onChat={() => scrollTo("portal-chat")}
        bell={
          <PortalNotificationsBell
            variant="bar"
            notices={notices}
            read={readNotices}
            onMarkRead={markNoticesRead}
            onNavigate={navigateNotice}
          />
        }
      />
      {token ? (
        <PortalMilestone
          token={token}
          stageIndex={currentStage ? stages.indexOf(currentStage) : stages.length}
          stageLabels={stages.map((st) => st.label.split(" · ")[0])}
          docsComplete={Boolean(portal.documents?.length) && docSummary.missing === 0}
          agentFirst={agentFirst}
        />
      ) : null}
      <PortalUiHost />

      {portal.type === "BUYER" && compareIds.length ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={() => (compareIds.length >= 2 ? setCompareOpen(true) : scrollTo("portal-offers"))}
            className="flex items-center gap-3 rounded-full bg-black px-5 py-3 text-[14px] font-bold text-[#D8C3A0] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
          >
            <Columns2 className="size-4" />
            {compareIds.length >= 2 ? t("Porównaj ({n})", { n: compareIds.length }) : t("Wybierz jeszcze jedną ofertę do porównania")}
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
    </PortalLocaleProvider>
  );
}

function formatClientGreeting(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^(pan|pani|pana|panią)$/i.test(parts[parts.length - 1] || "")) {
    return parts.slice(0, -1).join(" ");
  }
  return name;
}
