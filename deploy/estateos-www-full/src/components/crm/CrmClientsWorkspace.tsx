"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  UserPlus,
  ShoppingBag,
  Home,
  Mail,
  Search,
  Target,
  Send,
  RefreshCcw,
  FileText,
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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Archive,
} from "lucide-react";
import EosModal from "@/components/ui/EosModal";
import AgencyClientFormModal from "@/components/crm/AgencyClientFormModal";
import CrmEmailPreviewModal from "@/components/crm/CrmEmailPreviewModal";
import CrmClientLiveChat from "@/components/crm/CrmClientLiveChat";
import CrmClientPersonHub from "@/components/crm/CrmClientPersonHub";
import { formatCrmRoleLabel, groupCrmClientsByPerson } from "@/lib/crm/personGroups";
import { OfferDescriptionToggle, OfferPhotoCascade } from "@/components/crm/OfferPreviewExpand";
import CrmIntelligenceAssistant from "@/components/crm/CrmIntelligenceAssistant";
import { timelineKindLabel } from "@/lib/desk/timeline";
import type { IntelligenceLocks, IntelligenceSettings } from "@/lib/crm/clientIntelligence";
import { DEFAULT_INTELLIGENCE_LOCKS } from "@/lib/crm/clientIntelligence";
import { useLocale } from "@/contexts/LocaleContext";
import type { AgencyClientListItem } from "@/lib/agencyClientShape";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import SellerAcquisitionWorkspace from "@/components/crm/SellerAcquisitionWorkspace";
import AgencyClientCriteriaEditor from "@/components/crm/AgencyClientCriteriaEditor";
import { defaultWebRadarFilters, type WebRadarFilters } from "@/lib/radarCalibrationWeb";
import { formatClientFeedbackForAgent, parseClientOfferFeedback, sentimentLabel } from "@/lib/crm/clientPortalFeedback";
import { type ClientNextStep } from "@/lib/crm/clientNextStep";
import type { BuyerAgentTask } from "@/lib/crm/buyerAgentTasks";
import CrmClientStatusLamps, { clientHasUpcomingMeeting } from "@/components/crm/CrmClientStatusLamps";
import CrmClientMeetingCountdown from "@/components/crm/CrmClientMeetingCountdown";
import MatchImportAgentMeta, { type MatchImportBrief } from "@/components/crm/MatchImportAgentMeta";
import CrmSellerCollaborationPanel from "@/components/crm/CrmSellerCollaborationPanel";

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
    intelligenceSent?: boolean;
    intelligenceReason?: string | null;
    importBrief?: MatchImportBrief | null;
    offer: {
      id: number;
      title: string;
      price: number;
      city: string;
      district: string;
      excerpt?: string | null;
      description?: string | null;
      area: number;
      imageUrl: string;
      imageUrls?: string[] | null;
    };
  }>;
  buyerFilters?: WebRadarFilters | null;
  intelligence?: IntelligenceSettings | null;
  pendingCheckback?: {
    activityId: number;
    type: string;
    body: string;
    options: Array<{ id: string; label: string }>;
    createdAt: string;
  } | null;
  openHandoff?: { id: number; body: string } | null;
  nextStep?: ClientNextStep | null;
  portalUnreadCount?: number;
  buyerAgentTasks?: BuyerAgentTask[];
  activities?: Array<{
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  }>;
  sellerMarketing?: {
    sellerNextStep?: {
      currentStep: string;
      nextAction: string;
      clientMessage: string | null;
      dueAt: string | null;
      visibleToClient: boolean;
    } | null;
    sellerEvents?: {
      openHouse: {
        proposal: { id: number; title: string; status: string; payload?: Record<string, unknown> | null } | null;
        event: {
          id: number;
          status: string;
          startsAt: string | null;
          endsAt: string | null;
          title?: string | null;
        } | null;
      };
      auction: {
        proposal: { id: number; title: string; status: string; payload?: Record<string, unknown> | null } | null;
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
    facebookGroups?: Array<{
      key: string;
      groupName: string;
      groupUrl: string | null;
      lastPostedAt: string;
      lastPostUrl: string | null;
      postCount: number;
      lastOfferId: number | null;
    }>;
    facebookShareOffers?: Array<{
      id: number;
      title: string;
      city: string | null;
      price: number | null;
      imageUrl: string | null;
      linkedClientId: number | null;
    }>;
  } | null;
  relatedProjects?: {
    selling: ClientPersonProject[];
    buying: ClientPersonProject[];
  };
  managedOffers?: Array<{
    id: number;
    title: string;
    city: string | null;
    price: number | null;
    imageUrl: string | null;
    linkedClientId: number | null;
    status?: string;
  }>;
  meeting?: {
    startsAt: string;
    location: string | null;
    status: "confirmed" | "pending";
    reason: string | null;
  } | null;
  presentation?: {
    startsAt: string;
    status: "confirmed" | "pending";
    reason: string | null;
    offerId?: number | null;
  } | null;
};

type ClientPersonProject = {
  id: number;
  type: "BUYER" | "SELLER";
  title: string;
  subtitle: string;
  statusLabel: string;
  eventStage?: { id: string; label: string; kind: "open_house" | "auction" | null } | null;
  portalUnreadCount: number;
  linkedOfferId: number | null;
  matchCount: number;
  updatedAt: string;
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

const ACTIVITY_GROUPS: Array<{ label: string; kinds: string[] }> = [
  { label: "Plan i kolejka", kinds: ["INTELLIGENCE_PLANNED", "INTELLIGENCE_CHECKBACK", "INTELLIGENCE_HANDOFF"] },
  {
    label: "Wysłane i przypomnienia",
    kinds: ["INTELLIGENCE_OFFER", "CLIENT_NOTIFIED", "OFFER_SHARED", "FEEDBACK_REMINDER"],
  },
  { label: "Reakcje i nauka", kinds: ["CLIENT_FEEDBACK", "INTELLIGENCE_TASTE"] },
];

function groupClientActivities<T extends { kind: string }>(items: T[]) {
  const remaining = [...items.slice(0, 24)];
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const group of ACTIVITY_GROUPS) {
    const matched = remaining.filter((item) => group.kinds.includes(item.kind));
    if (matched.length) groups.push({ label: group.label, items: matched });
    for (const item of matched) {
      const index = remaining.indexOf(item);
      if (index >= 0) remaining.splice(index, 1);
    }
  }
  if (remaining.length) groups.push({ label: "Pozostałe", items: remaining });
  return groups;
}

function initialClientIdFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const id = Number(new URLSearchParams(window.location.search).get("clientId"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function CrmClientsWorkspace() {
  const { dict } = useLocale();
  const cl = dict.crmClients;
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(() => initialClientIdFromUrl());
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
  const [allowResend, setAllowResend] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "name" | "match">("recent");
  const [cardBusyId, setCardBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [presentationOfferId, setPresentationOfferId] = useState("");
  const [presentationAt, setPresentationAt] = useState("");
  const [guestAgencyMode, setGuestAgencyMode] = useState(false);
  const [guestAgencyName, setGuestAgencyName] = useState("");
  const [guestAgencyEmail, setGuestAgencyEmail] = useState("");
  const [guestAgencyPhone, setGuestAgencyPhone] = useState("");
  const [guestVisitorName, setGuestVisitorName] = useState("");
  const [sellerFilters, setSellerFilters] = useState<WebRadarFilters>(() => ({
    ...defaultWebRadarFilters(),
    pushNotifications: false,
  }));
  const [sellerSearching, setSellerSearching] = useState(false);
  const [intelLocks, setIntelLocks] = useState<IntelligenceLocks>(DEFAULT_INTELLIGENCE_LOCKS);
  const [criteriaCatalog, setCriteriaCatalog] = useState<{
    strictCities: string[];
    strictCityDistricts: Record<string, string[]>;
  }>({ strictCities: [], strictCityDistricts: {} });
  const hadClientSelection = useRef(false);
  const skipPersonReset = useRef(false);
  const [workspaceView, setWorkspaceView] = useState<"person" | "lane" | "project">("person");
  const [workspaceLane, setWorkspaceLane] = useState<"SELL" | "BUY" | null>(null);
  const [taskReplyDrafts, setTaskReplyDrafts] = useState<Record<string, string>>({});
  const [taskReplyingId, setTaskReplyingId] = useState<string | null>(null);

  useEffect(() => {
    const open = () => setFormOpen(true);
    window.addEventListener("crm-open-add-client", open);
    return () => window.removeEventListener("crm-open-add-client", open);
  }, []);

  useEffect(() => {
    const openClient = (event: Event) => {
      const id = Number((event as CustomEvent).detail?.clientId);
      if (Number.isFinite(id) && id > 0) setSelectedId(id);
    };
    window.addEventListener("crm-open-client", openClient);
    return () => window.removeEventListener("crm-open-client", openClient);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/location/districts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setCriteriaCatalog({
          strictCities: Array.isArray(data?.strictCities) ? data.strictCities : [],
          strictCityDistricts: data?.strictCityDistricts || {},
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!detail) return;
    const hasFilters = Boolean(detail.buyerFilters);
    setSellerSearching(hasFilters);
    if (detail.buyerFilters) {
      setSellerFilters({ ...defaultWebRadarFilters(), ...detail.buyerFilters, pushNotifications: false });
    }
    setIntelLocks(detail.intelligence?.lockedFields || DEFAULT_INTELLIGENCE_LOCKS);
  }, [detail?.id, detail?.buyerFilters]);

  const offerHref = (offerId: number, portalToken?: string | null) => {
    if (portalToken) return `/oferta/${offerId}?portal=${encodeURIComponent(portalToken)}`;
    return `/oferta/${offerId}`;
  };

  const loadReport = useCallback(async () => {
    try {
      const reportRes = await fetch("/api/crm/clients?report=1", { cache: "no-store" });
      const reportJson = await reportRes.json();
      if (reportJson.success) setReport(reportJson.report);
    } catch {
      /* ignore */
    }
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const listRes = await fetch(`/api/crm/clients`, { cache: "no-store" });
      const listJson = await listRes.json();
      if (listJson.success) {
        const nextClients: AgencyClientListItem[] = listJson.clients || [];
        setClients(nextClients);
        setSelectedId((prev) => {
          if (prev) return prev;
          return nextClients[0]?.id ?? null;
        });
      }
    } finally {
      setLoading(false);
    }
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const loadDetail = useCallback(async (id: number, options?: { silent?: boolean }) => {
    if (!options?.silent) setDetailLoading(true);
    try {
      const res = await fetch(`/api/crm/clients/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setDetail(json.client);
        const linkedId = Number(json.client?.linkedOfferId || 0);
        if (linkedId > 0) {
          setPresentationOfferId((current) => current || String(linkedId));
        }
        if (!options?.silent) setSelectedOffers(new Set());
      }
    } finally {
      if (!options?.silent) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
    if (skipPersonReset.current) {
      skipPersonReset.current = false;
      return;
    }
    setWorkspaceView("person");
    setWorkspaceLane(null);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = window.setInterval(
      () => void loadDetail(selectedId, { silent: true }),
      12_000,
    );
    return () => window.clearInterval(interval);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId && !formOpen && !previewOpen) {
        if (workspaceView === "project") {
          setWorkspaceView("lane");
          return;
        }
        if (workspaceView === "lane") {
          setWorkspaceView("person");
          setWorkspaceLane(null);
          return;
        }
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, formOpen, previewOpen, workspaceView]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) {
      hadClientSelection.current = true;
      url.searchParams.set("clientId", String(selectedId));
    } else if (hadClientSelection.current) {
      url.searchParams.delete("clientId");
    } else {
      return;
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState({}, "", next);
    }
  }, [selectedId]);

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

  const replyToOfferFeedback = async (task: BuyerAgentTask) => {
    if (!detail) return;
    const reply = String(taskReplyDrafts[task.id] || "").trim();
    if (!reply) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${detail.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply_to_offer_feedback",
          matchId: task.matchId,
          offerId: task.offerId,
          activityId: task.activityId,
          reply,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się wysłać odpowiedzi."));
      setTaskReplyDrafts((prev) => ({ ...prev, [task.id]: "" }));
      setTaskReplyingId(null);
      setToast("Odpowiedź jest już przy ofercie w panelu klienta.");
      await loadDetail(detail.id, { silent: true });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się wysłać odpowiedzi.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(""), 4500);
    }
  };

  const resolveBuyerAgentTask = async (activityId: number) => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${detail.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_buyer_agent_task", activityId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się zamknąć zadania."));
      await loadDetail(detail.id, { silent: true });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nie udało się zamknąć zadania.");
    } finally {
      setBusy(false);
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

  const personRows = useMemo(() => groupCrmClientsByPerson(filtered), [filtered]);

  const toggleAllFiltered = () => {
    const ids = personRows.flatMap((group) => group.ids);
    setSelectedClientIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const confirmBulkArchive = async () => {
    const clientIds = [...selectedClientIds];
    if (!clientIds.length) return;
    setArchiveBusy(true);
    setToast("");
    try {
      const res = await fetch("/api/crm/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_bulk", clientIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się zarchiwizować klientów."));
      if (selectedId && clientIds.includes(selectedId)) setSelectedId(null);
      setSelectedClientIds(new Set());
      setArchiveConfirmOpen(false);
      await loadClients();
      setToast(
        String(json.message || `Zarchiwizowano ${json.archivedIds?.length ?? clientIds.length} klientów.`),
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Błąd archiwizacji.");
    } finally {
      setArchiveBusy(false);
      window.setTimeout(() => setToast(""), 4500);
    }
  };

  const switcherClients = useMemo(() => {
    if (selectedId && !filtered.some((client) => client.id === selectedId)) {
      const current = clients.find((client) => client.id === selectedId);
      return current ? [current, ...filtered] : filtered;
    }
    return filtered;
  }, [clients, filtered, selectedId]);

  const switcherIndex = switcherClients.findIndex((client) => client.id === selectedId);

  const goPrevClient = () => {
    if (switcherIndex > 0) setSelectedId(switcherClients[switcherIndex - 1].id);
  };
  const goNextClient = () => {
    if (switcherIndex >= 0 && switcherIndex < switcherClients.length - 1) {
      setSelectedId(switcherClients[switcherIndex + 1].id);
    }
  };

  const toggleOffer = (offerId: number, notified: boolean) => {
    if (notified) return;
    setSelectedOffers((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

  const openPreview = async (offerIds: number[], opts?: { allowResend?: boolean }) => {
    if (!selectedId || !offerIds.length) return;
    setAllowResend(Boolean(opts?.allowResend));
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

  const saveIntelligence = async (next: IntelligenceSettings) => {
    if (!selectedId) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alsoSearching: true,
          buyerFilters: { ...sellerFilters, pushNotifications: false },
          intelligence: { ...next, lockedFields: intelLocks },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się zapisać asystenta."));
      await loadDetail(selectedId);
      return true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Błąd zapisu asystenta.");
      window.setTimeout(() => setToast(""), 3500);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmSend = async (message: string) => {
    if (!selectedId || !pendingOfferIds.length) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingOfferIds.length > 1 ? "notify_offers" : "notify_offer",
          offerIds: pendingOfferIds,
          offerId: pendingOfferIds[0],
          channel: "email",
          message,
          allowResend,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Nie udało się wysłać ofert."));
      setPreviewOpen(false);
      setPendingOfferIds([]);
      setAllowResend(false);
      await loadDetail(selectedId);
      await loadClients();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Błąd wysyłki.");
      window.setTimeout(() => setToast(""), 3500);
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

  const saveBuyerCriteria = async (filters = sellerFilters) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerFilters: { ...filters, pushNotifications: false },
          intelligence: { lockedFields: intelLocks },
        }),
      });
      await loadDetail(selectedId);
      setToast("Zapisano kryteria i kłódki asystenta.");
      window.setTimeout(() => setToast(""), 3500);
    } finally {
      setBusy(false);
    }
  };

  const saveSellerRadar = async (enabled: boolean, filters = sellerFilters) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/crm/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          enabled
            ? {
                alsoSearching: true,
                buyerFilters: { ...filters, pushNotifications: false },
                intelligence: { lockedFields: intelLocks },
              }
            : { alsoSearching: false },
        ),
      });
      await loadDetail(selectedId);
      setToast(enabled ? "Radar zakupowy sprzedającego zapisany." : "Radar zakupowy wyłączony.");
    } finally {
      setBusy(false);
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

  const relatedProjects = detail?.relatedProjects || {
    selling: detail?.type === "SELLER"
      ? [{
          id: detail.id,
          type: "SELLER" as const,
          title: `${detail.firstName} ${detail.lastName}`,
          subtitle: detail.sellerCity || "Pozysk sprzedaży",
          statusLabel: "W toku",
          portalUnreadCount: detail.portalUnreadCount || 0,
          linkedOfferId: detail.linkedOfferId || null,
          matchCount: 0,
          updatedAt: detail.updatedAt,
        }]
      : [],
    buying: detail?.type === "BUYER"
      ? [{
          id: detail.id,
          type: "BUYER" as const,
          title: `${detail.firstName} ${detail.lastName}`,
          subtitle: "Poszukiwanie",
          statusLabel: "Radar",
          portalUnreadCount: detail.portalUnreadCount || 0,
          linkedOfferId: null,
          matchCount: detail.matchCount || 0,
          updatedAt: detail.updatedAt,
        }]
      : [],
  };

  const openPersonProject = (projectId: number) => {
    if (projectId !== selectedId) {
      skipPersonReset.current = true;
      setSelectedId(projectId);
    }
    setWorkspaceView("project");
  };

  const addPersonProject = async (type: "BUYER" | "SELLER") => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/clients/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_person_project", type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się dodać projektu");
      skipPersonReset.current = true;
      setSelectedId(Number(json.clientId));
      setWorkspaceView("project");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  const runNextStep = () => {
    if (!detail?.nextStep) return;
    const action = detail.nextStep.action;
    if (action === "send_offers") {
      const first = (detail.matches || []).find((m) => !m.notifiedAt);
      if (first) void openPreview([first.offer.id]);
      else void refreshMatches();
      return;
    }
    if (action === "refresh_matches") {
      void refreshMatches();
      return;
    }
    if (action === "set_criteria") {
      document.getElementById("crm-criteria")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "verify_contact") {
      document.getElementById("crm-contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "propose_presentation") {
      document.getElementById("crm-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "respond_to_client") {
      document.getElementById("crm-agent-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "finish_acquisition" || action === "create_offer") {
      document.getElementById("crm-seller")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "accept_schedule") {
      document.getElementById("crm-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (detail.portalUrl) window.open(detail.portalUrl, "_blank", "noopener,noreferrer");
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

  const showOverview = !selectedId;

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      {showOverview ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: cl.statsBuyers, value: report?.buyers ?? "—", icon: ShoppingBag },
          { label: cl.statsSellers, value: report?.sellers ?? "—", icon: Home },
          { label: cl.statsMatches, value: report?.totalMatches ?? "—", icon: Target },
          { label: cl.statsOutreach, value: report?.outreachLast30Days ?? "—", icon: Send },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.12),0_4px_14px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
          >
            <card.icon className="mb-3 size-5 text-emerald-500 drop-shadow-[0_4px_10px_rgba(16,185,129,0.35)]" />
            <p className="text-2xl font-black tabular-nums text-[var(--eos-text)]">{card.value}</p>
            <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-muted)]">
              {card.label}
            </p>
          </motion.div>
        ))}
      </div> : null}

      {showOverview ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Weryfikacja e-mail", value: `${analytics.emailPct}%` },
          { label: "Weryfikacja telefonu", value: `${analytics.phonePct}%` },
          { label: "Klienci z dopasowaniami", value: `${analytics.matchPct}%` },
          { label: "Do dokończenia", value: analytics.pendingVerification },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--eos-border)] bg-gradient-to-b from-[var(--eos-card)] to-[var(--eos-input)]/40 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--eos-muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{card.value}</p>
          </div>
        ))}
      </div> : null}

      {showOverview ? <div className="min-w-0 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/70 p-4 text-xs text-[var(--eos-muted)] shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
        <p className="font-bold text-[var(--eos-text)]">Jak czytać analitykę CRM:</p>
        <p className="mt-1 break-words leading-relaxed">
          % e-mail/telefon = udział klientów ze zweryfikowanym kontaktem. % dopasowań = udział klientów z min. 1 aktywnym match-em.
          Status online liczony jest po ostatnim logowaniu klienta (aktywność w ciągu 10 min): teraz online {onlineCount}/{clients.length}.
        </p>
      </div> : null}

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eos-crm-clients-section-kicker">Moi klienci</p>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            Lampki: e-mail · telefon · konto · dopasowanie. Spotkanie pozyskania ma odliczanie zamiast lampek.
          </p>
        </div>
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

      <div className={`eos-crm-split ${selectedId ? "is-open" : ""}`}>
        <div className="eos-crm-split__list min-w-0 rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/85 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
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
          {selectedClientIds.size > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2">
              <span className="text-xs font-semibold text-[var(--eos-text)]">
                Zaznaczono: {selectedClientIds.size}
              </span>
              <button
                type="button"
                onClick={() => setSelectedClientIds(new Set())}
                className={eosBtn("ghost", { size: "sm" })}
              >
                Wyczyść
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className={eosBtn("danger", { size: "sm" })}
              >
                <Archive className="size-3.5" />
                Archiwizuj
              </button>
            </div>
          ) : null}
          {loading ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-[var(--eos-border)] bg-[var(--eos-card)]/50 px-4 py-8 text-center sm:p-10">
              <p className="break-words text-lg font-semibold text-[var(--eos-text)]">{cl.emptyTitle}</p>
              <p className="mt-2 break-words text-sm leading-relaxed text-[var(--eos-muted)]">{cl.emptyBody}</p>
            </div>
          ) : (
            <div className="w-full overflow-x-visible">
              <table className="eos-crm-clients-table w-full table-fixed text-left">
                <thead>
                  <tr className="border-b border-[var(--eos-border)] text-[10px] uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                    <th className="w-10 px-2 py-2">
                      <button
                        type="button"
                        onClick={toggleAllFiltered}
                        disabled={personRows.length === 0}
                        aria-label="Zaznacz wszystkich widocznych klientów"
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-30 ${
                          personRows.length > 0 && personRows.every((group) => group.ids.every((id) => selectedClientIds.has(id)))
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-[var(--eos-border)] hover:border-emerald-500/40"
                        }`}
                      >
                        {personRows.length > 0 && personRows.every((group) => group.ids.every((id) => selectedClientIds.has(id))) ? (
                          <Check className="size-3.5 text-black" />
                        ) : null}
                      </button>
                    </th>
                    <th className="w-[34%] px-3 py-2">Klient</th>
                    <th className="w-[18%] px-3 py-2">Status</th>
                    <th className="w-[28%] px-3 py-2">Kontakt</th>
                    <th className="w-[16%] px-3 py-2 text-right">Wizytówka</th>
                  </tr>
                </thead>
                <tbody>
                  {personRows.map((group) => {
                    const client = group.primary;
                    const selectedInGroup = group.ids.some((id) => selectedClientIds.has(id));
                    const active = selectedId != null && group.ids.includes(selectedId);
                    return (
                    <tr
                      key={group.key}
                      onClick={() => setSelectedId(client.id)}
                      className={`cursor-pointer border-b border-[var(--eos-border)]/60 text-sm transition hover:bg-[var(--eos-input)]/60 ${
                        active ? "bg-emerald-500/10" : ""
                      } ${selectedInGroup ? "bg-rose-500/5" : ""}`}
                    >
                      <td className="px-2 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = group.ids.every((id) => selectedClientIds.has(id));
                            setSelectedClientIds((prev) => {
                              const next = new Set(prev);
                              group.ids.forEach((id) => {
                                if (allSelected) next.delete(id);
                                else next.add(id);
                              });
                              return next;
                            });
                          }}
                          aria-label={`Zaznacz ${client.firstName} ${client.lastName}`}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                            selectedInGroup
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-[var(--eos-border)] hover:border-emerald-500/40"
                          }`}
                        >
                          {selectedInGroup ? <Check className="size-3.5 text-black" /> : null}
                        </button>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="break-words font-semibold text-[var(--eos-text)]">
                          {client.firstName} {client.lastName}
                          <span className="ml-2 text-[11px] font-bold tracking-wide text-[var(--eos-muted)]">ID {client.id}</span>
                        </p>
                        <p className="mt-1 break-all text-xs text-[var(--eos-muted)]">{client.email || "—"}{client.phone ? ` · ${client.phone}` : ""}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            group.types.length > 1
                              ? "bg-amber-500/15 text-amber-800"
                              : "bg-[var(--eos-input)] text-[var(--eos-muted)]"
                          }`}>
                            {formatCrmRoleLabel(group.types)}
                          </span>
                          {group.ids.length > 1 ? (
                            <span className="rounded-full bg-[var(--eos-input)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                              {group.ids.length} sprawy
                            </span>
                          ) : null}
                          {client.type === "BUYER" && client.matchCount > 0 ? (
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                              {client.matchCount} dopasowań{client.topMatchScore ? ` · ${client.topMatchScore}%` : ""}
                            </span>
                          ) : null}
                          {client.linkedUserId ? (
                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                              client.linkedUserLastLoginAt && Date.now() - new Date(client.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000
                                ? "text-emerald-600"
                                : "text-[var(--eos-muted)]"
                            }`}>
                              {client.linkedUserLastLoginAt && Date.now() - new Date(client.linkedUserLastLoginAt).getTime() <= 10 * 60 * 1000
                                ? "Online"
                                : "Konto"}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-700">Brak konta</span>
                          )}
                          <span className="text-[9px] font-semibold text-[var(--eos-muted)]">
                            {new Date(client.updatedAt).toLocaleDateString("pl-PL")}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {clientHasUpcomingMeeting(client) && client.upcomingMeetingStartsAt ? (
                          <CrmClientMeetingCountdown
                            startsAt={client.upcomingMeetingStartsAt}
                            location={client.upcomingMeetingLocation}
                          />
                        ) : (
                          <CrmClientStatusLamps client={client} />
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          {client.phone ? (
                            <a
                              href={`tel:${client.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 text-xs hover:border-emerald-500/40"
                            >
                              <PhoneCall className="size-3" />
                              Zadzwoń
                            </a>
                          ) : null}
                          {client.email ? (
                            <a
                              href={`mailto:${client.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--eos-border)] px-2 py-1 text-xs hover:border-emerald-500/40"
                            >
                              <Mail className="size-3" />
                              E-mail
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-right">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="eos-crm-split__detail relative min-h-[420px] min-w-0 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.12),0_6px_18px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-6">
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

          {selectedId && (detailLoading || !detail) ? (
            <p className="text-sm text-[var(--eos-muted)]">{cl.loading}</p>
          ) : selectedId && detail ? (
            <div className="min-w-0 space-y-6">
              <div className="eos-crm-switcher">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className={eosBtn("secondary", { size: "sm" })}
                >
                  <ArrowLeft className="size-3.5" />
                  Powrót
                </button>
                <button
                  type="button"
                  disabled={switcherIndex <= 0}
                  onClick={goPrevClient}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--eos-border)] text-[var(--eos-text)] disabled:opacity-30"
                  aria-label="Poprzedni klient"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <select
                  className="eos-crm-switcher__select"
                  value={detail.id}
                  onChange={(event) => setSelectedId(Number(event.target.value))}
                  aria-label="Szybka zmiana klienta"
                >
                  {switcherClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                      {client.type === "BUYER" ? " · kupujący" : " · sprzedający"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={switcherIndex < 0 || switcherIndex >= switcherClients.length - 1}
                  onClick={goNextClient}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--eos-border)] text-[var(--eos-text)] disabled:opacity-30"
                  aria-label="Następny klient"
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="text-[11px] font-bold text-[var(--eos-muted)]">
                  {switcherIndex >= 0 ? `${switcherIndex + 1} / ${switcherClients.length}` : ""}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {workspaceView !== "person" ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (workspaceView === "project") setWorkspaceView("lane");
                        else {
                          setWorkspaceView("person");
                          setWorkspaceLane(null);
                        }
                      }}
                      className="mb-2 text-[11px] font-bold text-emerald-600"
                    >
                      ← Wróć
                    </button>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                    {workspaceView === "project"
                      ? detail.type === "BUYER"
                        ? cl.buyerBadge
                        : cl.sellerBadge
                      : "Klient"}
                  </p>
                  <h3 className="mt-1 break-words text-xl font-bold text-[var(--eos-text)] sm:text-2xl">
                    {detail.firstName} {detail.lastName}
                    <span className="ml-2 text-sm font-semibold tracking-[0.14em] text-[var(--eos-muted)]">ID {detail.id}</span>
                  </h3>
                  <p className="mt-1 text-sm font-semibold">
                    {relatedProjects.selling.length || detail.type === "SELLER" ? (
                      <span className="text-emerald-600">Sprzedający</span>
                    ) : null}
                    {(relatedProjects.selling.length || detail.type === "SELLER") && (relatedProjects.buying.length || detail.type === "BUYER") ? (
                      <span className="text-[var(--eos-muted)]"> / </span>
                    ) : null}
                    {relatedProjects.buying.length || detail.type === "BUYER" ? (
                      <span className="text-orange-500">Kupujący</span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.nextStep ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={runNextStep}
                    className={eosBtn("home", { size: "sm" })}
                    title={detail.nextStep.hint}
                  >
                    {detail.nextStep.label}
                  </button>
                ) : null}
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
                {workspaceView === "project" ? (
                  <CrmClientLiveChat
                    clientId={detail.id}
                    clientName={`${detail.firstName} ${detail.lastName}`.trim()}
                    className={eosBtn("secondary", { size: "sm" })}
                  />
                ) : null}
              </div>

              {workspaceView !== "project" ? (
                <>
              <div className="overflow-hidden rounded-[1.6rem] border border-[#d9c7a3]/70 bg-[#f7f3ec] p-5 dark:border-[#8a6a32]/40 dark:bg-[#2a241c]">
                <div className="grid gap-5 sm:grid-cols-2">
                  <a
                    href={detail.phone ? `tel:${detail.phone}` : "#"}
                    onClick={(e) => {
                      if (!detail.phone) e.preventDefault();
                    }}
                    className="block min-w-0"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8a6a32]">Telefon</p>
                    <p className="mt-2 font-serif text-[28px] leading-tight tracking-wide text-[var(--eos-text)]">
                      {detail.phone || "Brak numeru"}
                    </p>
                  </a>
                  <a
                    href={detail.email ? `mailto:${detail.email}` : "#"}
                    onClick={(e) => {
                      if (!detail.email) e.preventDefault();
                    }}
                    className="block min-w-0"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8a6a32]">E-mail</p>
                    <p className="mt-2 break-all font-serif text-[20px] leading-snug text-[var(--eos-text)]">
                      {detail.email || "Brak e-maila"}
                    </p>
                  </a>
                </div>
              </div>
                <CrmClientPersonHub
                  selling={relatedProjects.selling}
                  buying={relatedProjects.buying}
                  view={workspaceView === "lane" ? "lane" : "person"}
                  lane={workspaceLane}
                  currentId={detail.id}
                  busy={busy}
                  onOpenLane={(next) => {
                    setWorkspaceLane(next);
                    setWorkspaceView("lane");
                  }}
                  onBackToPerson={() => {
                    setWorkspaceView("person");
                    setWorkspaceLane(null);
                  }}
                  onOpenProject={openPersonProject}
                  onAddProject={(type) => void addPersonProject(type)}
                  onSchedulePresentation={() => {
                    if (detail.linkedOfferId && !presentationOfferId) {
                      setPresentationOfferId(String(detail.linkedOfferId));
                    }
                    setWorkspaceView("project");
                    document.getElementById("crm-schedule")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                </>
              ) : (
              <>
              {detail.type === "BUYER" && (detail.buyerAgentTasks || []).length ? (
                <section
                  id="crm-agent-tasks"
                  className="rounded-2xl border border-amber-400/70 bg-amber-500/10 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        Wymaga Twojej reakcji · {detail.buyerAgentTasks?.length}
                      </p>
                      <p className="mt-1 text-sm text-[var(--eos-muted)]">
                        Komentarze i decyzje klienta pojawiają się tutaj na bieżąco.
                      </p>
                    </div>
                    <CrmClientLiveChat
                      clientId={detail.id}
                      clientName={`${detail.firstName} ${detail.lastName}`.trim()}
                      className={eosBtn("home", { size: "sm" })}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {(detail.buyerAgentTasks || []).slice(0, 3).map((task) => (
                      <article
                        key={task.id}
                        className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[var(--eos-text)]">{task.title}</p>
                            <p className="mt-1 text-sm leading-relaxed text-[var(--eos-text)]">{task.body}</p>
                            <p className="mt-1 text-[10px] font-semibold text-[var(--eos-muted)]">
                              {new Date(task.createdAt).toLocaleString("pl-PL")}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {task.offerId ? (
                              <Link
                                href={`/oferta/${task.offerId}`}
                                target="_blank"
                                className={eosBtn("secondary", { size: "sm" })}
                              >
                                Otwórz ofertę
                              </Link>
                            ) : null}
                            {task.kind === "viewing" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  document
                                    .getElementById("crm-matches")
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                                }
                                className={eosBtn("home", { size: "sm" })}
                              >
                                Umów prezentację
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setTaskReplyingId(task.id)}
                              className={eosBtn("home", { size: "sm" })}
                            >
                              Odpowiedz
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void resolveBuyerAgentTask(task.activityId)}
                              className={eosBtn("secondary", { size: "sm" })}
                            >
                              <Check className="size-3.5" />
                              Załatwione
                            </button>
                          </div>
                        </div>
                        {taskReplyingId === task.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={taskReplyDrafts[task.id] || ""}
                              onChange={(event) =>
                                setTaskReplyDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))
                              }
                              rows={3}
                              placeholder="Odpowiedź pojawi się przy tej ofercie w panelu klienta…"
                              className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy || !String(taskReplyDrafts[task.id] || "").trim()}
                                onClick={() => void replyToOfferFeedback(task)}
                                className={eosBtn("home", { size: "sm" })}
                              >
                                {busy ? "Wysyłam…" : "Wyślij przy ofercie"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaskReplyingId(null)}
                                className={eosBtn("secondary", { size: "sm" })}
                              >
                                Anuluj
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="overflow-hidden rounded-[1.6rem] border border-[#d9c7a3]/70 bg-[#f7f3ec] p-5 dark:border-[#8a6a32]/40 dark:bg-[#2a241c]">
                <div className="grid gap-5 sm:grid-cols-2">
                  <a
                    href={detail.phone ? `tel:${detail.phone}` : "#"}
                    onClick={(e) => {
                      if (!detail.phone) e.preventDefault();
                    }}
                    className="block min-w-0"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8a6a32]">Telefon</p>
                    <p className="mt-2 font-serif text-[28px] leading-tight tracking-wide text-[var(--eos-text)]">
                      {detail.phone || "Brak numeru"}
                    </p>
                  </a>
                  <a
                    href={detail.email ? `mailto:${detail.email}` : "#"}
                    onClick={(e) => {
                      if (!detail.email) e.preventDefault();
                    }}
                    className="block min-w-0"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8a6a32]">E-mail</p>
                    <p className="mt-2 break-all font-serif text-[20px] leading-snug text-[var(--eos-text)]">
                      {detail.email || "Brak e-maila"}
                    </p>
                  </a>
                </div>
                {detail.phone ? (
                  <a
                    href={`sms:${detail.phone}`}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#8a6a32]"
                  >
                    <MessageCircle className="size-3.5" />
                    SMS
                  </a>
                ) : null}
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
                <div className="mt-3">
                  {detail.nextStep ? (
                    <p className="text-sm text-[var(--eos-text)]">
                      <span className="font-semibold">{detail.nextStep.label}.</span>{" "}
                      <span className="text-[var(--eos-muted)]">{detail.nextStep.hint}</span>
                    </p>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      Wszystkie kluczowe kroki wykonane
                    </span>
                  )}
                </div>
              </div>

              <div id="crm-contact" className="grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4 sm:grid-cols-2">
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

              <div id="crm-schedule" className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                  Spotkanie i prezentacja
                </p>
                {detail.meeting ? (
                  <div className="mt-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card,#fff)]/40 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">Spotkanie</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                      {new Date(detail.meeting.startsAt).toLocaleString("pl-PL")}
                    </p>
                    {detail.meeting.location ? (
                      <p className="mt-1 text-xs text-[var(--eos-muted)]">{detail.meeting.location}</p>
                    ) : null}
                    <p className={`mt-1 text-xs font-black uppercase tracking-wider ${detail.meeting.status === "pending" ? "text-amber-700" : "text-emerald-700"}`}>
                      {detail.meeting.status === "pending"
                        ? detail.meeting.reason || "Oczekuje na Twoją decyzję"
                        : "Potwierdzone"}
                    </p>
                    {detail.meeting.status === "pending" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void clientAction("accept_schedule_change", { kind: "meeting" })}
                        className="mt-2 rounded-full bg-emerald-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                      >
                        Akceptuj nowy termin
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {detail.presentation ? (
                  <div className="mt-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card,#fff)]/40 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                      {detail.type === "SELLER" ? "Pokaz dla kupującego" : "Prezentacja oferty"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">
                      {new Date(detail.presentation.startsAt).toLocaleString("pl-PL")}
                    </p>
                    <p className={`mt-1 text-xs font-black uppercase tracking-wider ${detail.presentation.status === "pending" ? "text-amber-700" : "text-emerald-700"}`}>
                      {detail.presentation.status === "pending"
                        ? detail.presentation.reason || "Propozycja wysłana obu stronom"
                        : "Potwierdzona"}
                    </p>
                    {detail.presentation.status === "pending" && detail.presentation.reason ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void clientAction("accept_schedule_change", { kind: "presentation" })}
                        className="mt-2 rounded-full bg-emerald-500 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                      >
                        Akceptuj nowy termin pokazu
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                    <p className="text-xs text-[var(--eos-muted)]">
                      {guestAgencyMode
                        ? "Wybierz nieruchomość z portfela i wyślij termin właścicielowi oraz agentowi gościowi."
                        : "Wybierz nieruchomość z listy agenta albo wpisz ID oferty — kupujący i sprzedający dostaną ten sam termin na e-mail."}
                    </p>
                    {detail.type === "SELLER" || guestAgencyMode ? (
                      <button
                        type="button"
                        onClick={() => setGuestAgencyMode((open) => !open)}
                        className={`w-full rounded-xl border px-3 py-2 text-left ${
                          guestAgencyMode
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-[var(--eos-border)] bg-[var(--eos-input)]"
                        }`}
                      >
                        <p className="text-[11px] font-black text-[var(--eos-text)]">
                          {guestAgencyMode ? "Inna agencja pokazuje naszą nieruchomość" : "Tryb: inna agencja u naszego klienta"}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--eos-muted)]">
                          Mail idzie do sprzedającego i do agenta gościa. Nie tworzy drugiego klienta.
                        </p>
                      </button>
                    ) : null}
                    {guestAgencyMode ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={guestAgencyName}
                          onChange={(e) => setGuestAgencyName(e.target.value)}
                          placeholder="Nazwa agencji gościa"
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                        <input
                          value={guestAgencyEmail}
                          onChange={(e) => setGuestAgencyEmail(e.target.value)}
                          placeholder="E-mail agenta gościa"
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                        <input
                          value={guestVisitorName}
                          onChange={(e) => setGuestVisitorName(e.target.value)}
                          placeholder="Imię agenta (opcjonalnie)"
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                        <input
                          value={guestAgencyPhone}
                          onChange={(e) => setGuestAgencyPhone(e.target.value)}
                          placeholder="Telefon agenta (opcjonalnie)"
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </div>
                    ) : null}
                    {(detail.managedOffers || []).length > 0 ? (
                      <select
                        value={presentationOfferId}
                        onChange={(e) => setPresentationOfferId(e.target.value)}
                        className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                      >
                        <option value="">Wybierz nieruchomość agenta</option>
                        {(detail.managedOffers || []).map((offer) => (
                          <option key={offer.id} value={String(offer.id)}>
                            #{offer.id} · {offer.title}
                            {offer.city ? ` · ${offer.city}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {(detail.matches || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {[...(detail.matches || [])]
                          .sort((a, b) => Number(Boolean(b.notifiedAt)) - Number(Boolean(a.notifiedAt)) || b.score - a.score)
                          .slice(0, 8)
                          .map((m) => {
                            const selected = presentationOfferId === String(m.offer.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setPresentationOfferId(String(m.offer.id))}
                                className={`max-w-full rounded-xl border px-3 py-2 text-left ${
                                  selected
                                    ? "border-emerald-500/50 bg-emerald-500/15"
                                    : "border-[var(--eos-border)] bg-[var(--eos-input)]"
                                }`}
                              >
                                <p className="text-[11px] font-black text-[var(--eos-text)]">
                                  #{m.offer.id} · {m.offer.title}
                                </p>
                                <p className="text-[10px] text-[var(--eos-muted)]">
                                  {m.notifiedAt ? "Wysłana" : "Match"} · {m.score}%
                                </p>
                              </button>
                            );
                          })}
                      </div>
                    ) : null}
                    <input
                      value={presentationOfferId}
                      onChange={(e) => setPresentationOfferId(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="Albo wpisz ID oferty"
                      className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                    />
                    <input
                      type="datetime-local"
                      value={presentationAt}
                      onChange={(e) => setPresentationAt(e.target.value)}
                      className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                    />
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !presentationAt ||
                        !presentationOfferId.trim() ||
                        (guestAgencyMode && (!guestAgencyName.trim() || !guestAgencyEmail.includes("@")))
                      }
                      onClick={() => {
                        if (!presentationAt || !presentationOfferId.trim()) return;
                        void clientAction("propose_presentation", {
                          startsAt: new Date(presentationAt).toISOString(),
                          offerId: Number(presentationOfferId),
                          guestAgency: guestAgencyMode
                            ? {
                                name: guestAgencyName.trim(),
                                email: guestAgencyEmail.trim(),
                                phone: guestAgencyPhone.trim() || undefined,
                                visitorName: guestVisitorName.trim() || undefined,
                              }
                            : undefined,
                        }).then((json) => {
                          if (json?.success) {
                            setPresentationAt("");
                            setToast(
                              guestAgencyMode
                                ? "Wysłano termin do właściciela i do agencji gościa."
                                : "Wysłano propozycję prezentacji obu stronom.",
                            );
                          }
                        });
                      }}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
                    >
                      {guestAgencyMode ? "Wyślij termin właścicielowi i agencji gościa" : "Zaproponuj termin obu stronom"}
                    </button>
                  </div>
              </div>

              {detail.type === "BUYER" ? (
                <>
                  <CrmIntelligenceAssistant
                    clientId={detail.id}
                    value={detail.intelligence}
                    busy={busy}
                    activities={detail.activities}
                    pendingCheckback={detail.pendingCheckback}
                    openHandoff={detail.openHandoff}
                    onSave={(next) => saveIntelligence(next)}
                  />
                  <div id="crm-criteria">
                    <AgencyClientCriteriaEditor
                      compact
                      value={sellerFilters}
                      onChange={setSellerFilters}
                      catalog={criteriaCatalog}
                      locks={intelLocks}
                      onLocksChange={setIntelLocks}
                    />
                  </div>
                  <div id="crm-matches" className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveBuyerCriteria()}
                      className={eosBtn("home", { size: "sm" })}
                    >
                      Zapisz kryteria
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void refreshMatches()}
                      className={eosBtn("secondary", { size: "sm" })}
                    >
                      <RefreshCcw className="size-3.5" />
                      {cl.refreshMatches}
                    </button>
                    {selectedOffers.size > 0 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void openPreview([...selectedOffers])}
                        className={eosBtn("home", { size: "sm" })}
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
                              m.intelligenceSent
                                ? "eos-intel-frame"
                                : selected
                                  ? "border-emerald-500/40 bg-emerald-500/5"
                                  : "border-[var(--eos-border)] bg-[var(--eos-input)]/40"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
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
                              <OfferPhotoCascade offer={m.offer} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={offerHref(m.offer.id, detail.portalToken)}
                                    className="break-words font-semibold text-[var(--eos-text)] hover:text-emerald-600"
                                  >
                                    {m.offer.title}
                                  </Link>
                                  {m.intelligenceSent ? (
                                    <span className="eos-intel-kicker text-[10px] font-black uppercase tracking-[0.12em]">
                                      Domysł EstateOS™ Intelligence
                                    </span>
                                  ) : sent ? (
                                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                                      {cl.sentBadge}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-[var(--eos-muted)]">
                                  {[m.offer.city, m.offer.district].filter(Boolean).join(" · ")} · {Math.round(m.offer.price).toLocaleString("pl-PL")} zł
                                </p>
                                <OfferDescriptionToggle offer={m.offer} />
                                <MatchImportAgentMeta brief={m.importBrief} />
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--eos-input)]">
                                    <div
                                      className={`h-full rounded-full ${m.score >= 85 ? "bg-emerald-500" : m.score >= 70 ? "bg-lime-500" : m.score >= 55 ? "bg-amber-400" : "bg-rose-500"}`}
                                      style={{ width: `${Math.max(8, Math.min(100, m.score))}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-black text-[var(--eos-text)]">{m.score}%</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {!sent ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void openPreview([m.offer.id])}
                                    className={eosBtn("home", { size: "sm" })}
                                  >
                                    {cl.sendEmail}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void openPreview([m.offer.id], { allowResend: true })}
                                    className={eosBtn("secondary", { size: "sm" })}
                                  >
                                    Wyślij ponownie
                                  </button>
                                )}
                            <Link
                              href={offerHref(m.offer.id, detail.portalToken)}
                              className={eosBtn("secondary", { size: "sm" })}
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
                                  {parseClientOfferFeedback(m.clientFeedback).sentiment
                                    ? ` · ${sentimentLabel(parseClientOfferFeedback(m.clientFeedback).sentiment)}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-sm text-[var(--eos-text)]">
                                  {formatClientFeedbackForAgent(m.clientFeedback)}
                                </p>
                                {m.clientFeedbackAt ? (
                                  <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                                    {new Date(m.clientFeedbackAt).toLocaleString("pl-PL")}
                                  </p>
                                ) : null}
                              </div>
                            ) : sent ? (
                              <p className="text-[11px] text-[var(--eos-muted)]">Klient jeszcze nie odniósł się do tej oferty.</p>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div id="crm-seller" className="space-y-5">
                  <SellerAcquisitionWorkspace
                    client={{
                      id: detail.id,
                      firstName: detail.firstName,
                      lastName: detail.lastName,
                      email: detail.email,
                    }}
                    onUpdated={() => void loadDetail(detail.id)}
                  />
                  <div className="space-y-4 rounded-2xl border border-[var(--eos-border)] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                          <Radar className="size-4" />
                          Radar zakupowy sprzedającego
                        </p>
                        <p className="mt-1 text-sm text-[var(--eos-muted)]">
                          Jeśli klient sprzedaje i jednocześnie czegoś szuka, włącz dopasowania i proponuj oferty tak jak kupującemu.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={sellerSearching}
                          onChange={(event) => {
                            const next = event.target.checked;
                            setSellerSearching(next);
                            void saveSellerRadar(next);
                          }}
                          className="size-4 accent-emerald-500"
                        />
                        Klient też szuka
                      </label>
                    </div>
                    {sellerSearching ? (
                      <>
                        <CrmIntelligenceAssistant
                          clientId={detail.id}
                          value={detail.intelligence}
                          busy={busy}
                          activities={detail.activities}
                          pendingCheckback={detail.pendingCheckback}
                          openHandoff={detail.openHandoff}
                          onSave={(next) => saveIntelligence(next)}
                        />
                        <AgencyClientCriteriaEditor
                          compact
                          value={sellerFilters}
                          onChange={setSellerFilters}
                          catalog={criteriaCatalog}
                          locks={intelLocks}
                          onLocksChange={setIntelLocks}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveSellerRadar(true)}
                            className={eosBtn("home", { size: "sm" })}
                          >
                            Zapisz kryteria
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void refreshMatches()}
                            className={eosBtn("secondary", { size: "sm" })}
                          >
                            <RefreshCcw className="size-3.5" />
                            Odśwież dopasowania
                          </button>
                          {selectedOffers.size > 0 ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void openPreview([...selectedOffers])}
                              className={eosBtn("primary", { size: "sm" })}
                            >
                              <Send className="size-3.5" />
                              Zaproponuj ({selectedOffers.size})
                            </button>
                          ) : null}
                        </div>
                        {(detail.matches || []).length === 0 ? (
                          <p className="text-sm text-[var(--eos-muted)]">Brak dopasowań. Uzupełnij kryteria i odśwież radar.</p>
                        ) : (
                          (detail.matches || []).map((m) => {
                            const sent = Boolean(m.notifiedAt);
                            const selected = selectedOffers.has(m.offer.id);
                            return (
                              <div
                                key={m.id}
                                className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                                  m.intelligenceSent
                                    ? "eos-intel-frame"
                                    : selected
                                      ? "border-emerald-500/40 bg-emerald-500/5"
                                      : "border-[var(--eos-border)]"
                                }`}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                                  <button
                                    type="button"
                                    disabled={sent}
                                    onClick={() => toggleOffer(m.offer.id, sent)}
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                      sent || selected ? "border-emerald-500 bg-emerald-500" : "border-[var(--eos-border)]"
                                    }`}
                                  >
                                    {(sent || selected) ? <Check className="size-4 text-black" /> : null}
                                  </button>
                                  <OfferPhotoCascade offer={m.offer} thumbClassName="h-16 w-20 shrink-0 rounded-xl bg-[var(--eos-input)]" />
                                  <div className="min-w-0 flex-1">
                                    <Link href={offerHref(m.offer.id, detail.portalToken)} className="font-semibold text-[var(--eos-text)] hover:text-emerald-600">
                                      {m.offer.title}
                                    </Link>
                                    {m.intelligenceSent ? (
                                      <p className="eos-intel-kicker mt-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
                                        Domysł EstateOS™ Intelligence
                                      </p>
                                    ) : null}
                                    <p className="text-xs text-[var(--eos-muted)]">
                                      {[m.offer.city, m.offer.district].filter(Boolean).join(" · ")} · {Math.round(m.offer.price).toLocaleString("pl-PL")} zł · {m.score}%
                                    </p>
                                    <OfferDescriptionToggle offer={m.offer} />
                                    <MatchImportAgentMeta brief={m.importBrief} />
                                  </div>
                                  {!sent ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void openPreview([m.offer.id])}
                                      className={eosBtn("home", { size: "sm" })}
                                    >
                                      Zaproponuj
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void openPreview([m.offer.id], { allowResend: true })}
                                      className={eosBtn("secondary", { size: "sm" })}
                                    >
                                      Wyślij ponownie
                                    </button>
                                  )}
                                </div>
                                {m.clientFeedback ? (
                                  <p className="rounded-xl bg-amber-500/8 px-3 py-2 text-sm text-[var(--eos-text)]">
                                    {formatClientFeedbackForAgent(m.clientFeedback)}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : null}
                  </div>
                  <div className="space-y-4 rounded-2xl border border-[var(--eos-border)] p-5">
                    <p className="text-sm text-[var(--eos-muted)]">{cl.sellerPanelLead}</p>
                    {detail.linkedOfferId ? (
                      <div className="rounded-xl bg-[var(--eos-input)]/50 p-4">
                        <p className="text-sm font-semibold text-[var(--eos-text)]">{cl.viewLinkedListing}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/oferta/${detail.linkedOfferId}`}
                            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600"
                          >
                            #{detail.linkedOfferId}
                          </Link>
                          {detail.sellerMarketing?.sellerEvents?.stage ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-800">
                              {detail.sellerMarketing.sellerEvents.stage.kind === "auction"
                                ? "Licytacja"
                                : detail.sellerMarketing.sellerEvents.stage.kind === "open_house"
                                  ? "Dzień otwarty"
                                  : "Wydarzenie"}{" "}
                              · {detail.sellerMarketing.sellerEvents.stage.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--eos-muted)]">{cl.sellerPanelEmpty}</p>
                    )}
                    <CrmSellerCollaborationPanel
                      linkedOfferId={detail.linkedOfferId || null}
                      busy={busy}
                      sellerNextStep={detail.sellerMarketing?.sellerNextStep || null}
                      sellerEvents={detail.sellerMarketing?.sellerEvents || null}
                      facebookGroups={detail.sellerMarketing?.facebookGroups || []}
                      facebookShareOffers={detail.sellerMarketing?.facebookShareOffers || []}
                      onAction={clientAction}
                      onToast={setToast}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void clientAction("create_offer_from_acquisition")}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-black hover:bg-emerald-400"
                      >
                        ⚡ Utwórz szkic oferty (niepubliczny)
                      </button>
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
                </div>
              )}

              {(detail.activities || []).length > 0 ? (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                    <FileText className="size-3.5" />
                    Timeline i historia działań
                  </p>
                  <div className="space-y-5">
                    {groupClientActivities(detail.activities || []).map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                          {group.label}
                        </p>
                        <div className="space-y-2">
                          {group.items.map((a) => (
                            <div key={a.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 px-4 py-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                                    {timelineKindLabel(a.kind)}
                                  </p>
                                  <p className="font-medium text-[var(--eos-text)]">{a.title || "Aktywność CRM"}</p>
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--eos-muted)]">
                                  <Clock3 className="size-3" />
                                  {new Date(a.createdAt).toLocaleString("pl-PL")}
                                </span>
                              </div>
                              {a.body ? <p className="mt-1 whitespace-pre-line text-xs text-[var(--eos-muted)]">{a.body}</p> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showOverview && report?.topMatches?.length ? (
        <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/75 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
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

      <EosModal
        open={archiveConfirmOpen}
        onClose={() => {
          if (!archiveBusy) setArchiveConfirmOpen(false);
        }}
        title="Archiwizować klientów?"
        subtitle={`Zaznaczono ${selectedClientIds.size} ${
          selectedClientIds.size === 1 ? "klienta" : "klientów"
        }. Ta operacja jest odwracalna tylko przez administratora.`}
        icon={<Archive className="size-5" />}
        iconWrapClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500 shadow-[0_8px_24px_rgba(244,63,94,0.12)]"
        maxWidth="max-w-lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={archiveBusy}
              onClick={() => setArchiveConfirmOpen(false)}
              className={eosBtn("secondary", { size: "sm" })}
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={archiveBusy}
              onClick={() => void confirmBulkArchive()}
              className={eosBtn("danger", { size: "sm" })}
            >
              {archiveBusy ? "Archiwizowanie…" : "Archiwizuj"}
            </button>
          </div>
        }
      >
        <ul className="space-y-2 text-sm leading-relaxed text-[var(--eos-muted)]">
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
            Wyczyści zaplanowane spotkania, prezentacje, wpisy kalendarza i powiadomienia push.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            Karta klienta, podpisane dokumenty i historia pozostają dostępne dla administratora.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
            Klient znika z radaru dopasowań i automatyzacji Intelligence.
          </li>
        </ul>
      </EosModal>
    </div>
  );
}
