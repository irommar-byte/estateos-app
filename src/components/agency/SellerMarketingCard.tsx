import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import FeaturedPromoteSheet from "../offer/FeaturedPromoteSheet";
import AcquisitionDatePickerModal from "./AcquisitionDatePickerModal";
import PortalBrandMark from "../marketing/PortalBrandMark";
import {
  postAgencyClientAction,
  recordFacebookGroupPost,
  prepareFacebookGroupShare,
  uploadClientPortalAttachment,
} from "../../services/agencyClientService";
import { promoteMobileOfferListing } from "../../utils/mobileOfferPromote";
import { shareListingLink } from "../../utils/offerShareUrls";
import {
  groupPromotionsByChannel,
  isFacebookPostPermalink,
  resolveMarketingChannel,
} from "../../lib/marketingChannel";
import { groupPortalPath } from "../../lib/portalActivityStacks";
import MarketingChannelBrand from "../marketing/MarketingChannelBrand";
import { parseSellerEventProposal } from "../../lib/sellerEventStage";
import SellerActiveEventsPanel, {
  sellerEventsMetricSummary,
} from "./SellerActiveEventsPanel";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MarketingSection =
  | "external"
  | "plan"
  | "decision"
  | "facebook"
  | "channels"
  | "feed"
  | "events";

export type MarketingActivity = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId?: number | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  visibleToClient?: boolean;
};

export type SellerMarketingState = {
  estateos: {
    offerId: number;
    status: string;
    published: boolean;
    featured: boolean;
    promotedUntil: string | null;
    publicationEndsAt: string | null;
  } | null;
  activeChannels: {
    portal: string;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    activityId: number;
  }[];
  sellerNextStep: {
    currentStep: string;
    nextAction: string;
    clientMessage: string | null;
    dueAt: string | null;
    visibleToClient: boolean;
    updatedAt: string;
  } | null;
  pendingDecisions: {
    id: number;
    kind: string;
    title: string;
    clientMessage: string;
    status: string;
    clientResponse?: string | null;
    dueAt: string | null;
    createdAt: string;
    payload?: Record<string, unknown> | null;
  }[];
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
        startPrice?: number;
        title?: string | null;
      } | null;
    };
    stage: { id: string; label: string; kind: "open_house" | "auction" | null } | null;
  } | null;
  marketingTimeline: {
    id: number;
    kind: string;
    title: string | null;
    body: string | null;
    createdAt: string;
    portal: string | null;
    externalUrl: string | null;
    status: string | null;
    renewalDueAt: string | null;
    promotedUntil: string | null;
    visibleToClient: boolean;
  }[];
  facebookGroups?: {
    key: string;
    groupName: string;
    groupUrl: string | null;
    lastPostedAt: string;
    lastPostUrl: string | null;
    postCount: number;
    lastOfferId: number | null;
  }[];
  facebookShareOffers?: {
    id: number;
    title: string;
    city: string | null;
    price: number | null;
    imageUrl: string | null;
    linkedClientId: number | null;
  }[];
} | null;

type Props = {
  clientId: number;
  linkedOfferId: number | null;
  token: string;
  isDark: boolean;
  creditBalance: number;
  activities: MarketingActivity[];
  sellerMarketing: SellerMarketingState;
  colors: {
    card: string;
    border: string;
    text: string;
    secondary: string;
    accent: string;
    bg: string;
    input: string;
  };
  onRefresh: () => void;
  /** Gdy true — rozwiń sekcję Wydarzenia (np. jump z badge oferty). */
  focusEvents?: boolean;
};

const PORTAL_PRESETS = [
  "Otodom",
  "OLX",
  "Nieruchomosci-online",
  "Facebook",
  "Inny",
];

function formatDateLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("pl-PL");
}

function dateToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "Bez pośpiechu") return undefined;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function renewalTone(value: string | null) {
  if (!value) return { label: "Bez terminu", color: "#8E8E93" };
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Po terminie", color: "#FF3B30" };
  if (days <= 3) return { label: `${days} dni`, color: "#FF9500" };
  return { label: `${days} dni`, color: "#34C759" };
}

function todayYmd() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function SellerMarketingCard({
  clientId,
  linkedOfferId,
  token,
  isDark,
  creditBalance,
  activities,
  sellerMarketing,
  colors,
  onRefresh,
  focusEvents = false,
}: Props) {
  const [busy, setBusy] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [portalNote, setPortalNote] = useState("");
  const [portalGroupName, setPortalGroupName] = useState("");
  const [portalPreset, setPortalPreset] = useState("Otodom");
  const [portalStatus, setPortalStatus] = useState<"active" | "paused">(
    "active",
  );
  const [publishedDate, setPublishedDate] = useState(todayYmd);
  const [renewalDate, setRenewalDate] = useState("");
  const [showClientPortal, setShowClientPortal] = useState(false);
  const [evidence, setEvidence] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [datePicker, setDatePicker] = useState<
    "published" | "renewal" | "next" | "decision" | "event" | null
  >(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [nextCurrent, setNextCurrent] = useState(
    sellerMarketing?.sellerNextStep?.currentStep || "",
  );
  const [nextAction, setNextAction] = useState(
    sellerMarketing?.sellerNextStep?.nextAction || "",
  );
  const [nextMessage, setNextMessage] = useState(
    sellerMarketing?.sellerNextStep?.clientMessage || "",
  );
  const [nextDueAt, setNextDueAt] = useState(
    sellerMarketing?.sellerNextStep?.dueAt?.slice(0, 10) || "",
  );
  const [nextVisible, setNextVisible] = useState(
    sellerMarketing?.sellerNextStep?.visibleToClient === true,
  );
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [decisionKind, setDecisionKind] = useState("price");
  const [decisionDueAt, setDecisionDueAt] = useState("");
  const [eventMode, setEventMode] = useState<"open_house" | "auction" | null>(
    null,
  );
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [eventStartTime, setEventStartTime] = useState("11:00");
  const [eventEndTime, setEventEndTime] = useState("14:00");
  const [eventStartPrice, setEventStartPrice] = useState("");
  const [eventReservePrice, setEventReservePrice] = useState("");
  const [eventMessage, setEventMessage] = useState("");
  const [notifyOwner, setNotifyOwner] = useState(true);
  const [openSections, setOpenSections] = useState<Record<MarketingSection, boolean>>({
    external: false,
    plan: false,
    decision: false,
    facebook: false,
    channels: false,
    feed: false,
    events: false,
  });
  const [feedLimit, setFeedLimit] = useState(5);
  const [fbListLimit, setFbListLimit] = useState(4);
  const [openFeedStack, setOpenFeedStack] = useState<string | null>(null);
  const [pickedFbOfferId, setPickedFbOfferId] = useState<number | null>(
    linkedOfferId,
  );
  const [facebookPending, setFacebookPending] = useState<{
    groupName: string;
    groupUrl: string | null;
    offerId: number;
  } | null>(null);
  const [fbGroupNameDraft, setFbGroupNameDraft] = useState("");
  const [fbPostUrl, setFbPostUrl] = useState("");
  const [fbShowClient, setFbShowClient] = useState(true);

  useEffect(() => {
    const next = sellerMarketing?.sellerNextStep;
    if (!next) return;
    setNextCurrent(next.currentStep);
    setNextAction(next.nextAction);
    setNextMessage(next.clientMessage || "");
    setNextDueAt(next.dueAt?.slice(0, 10) || "");
    setNextVisible(next.visibleToClient === true);
  }, [sellerMarketing?.sellerNextStep]);

  useEffect(() => {
    if (!facebookPending) return;
    setOpenSections((current) =>
      current.facebook ? current : { ...current, facebook: true },
    );
  }, [facebookPending]);

  const toggleSection = (id: MarketingSection) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    void Haptics.selectionAsync();
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const revealSection = (id: MarketingSection) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    setOpenSections((current) => (current[id] ? current : { ...current, [id]: true }));
  };

  useEffect(() => {
    if (!focusEvents) return;
    revealSection("events");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pulse when parent requests focus
  }, [focusEvents]);

  useEffect(() => {
    const hasEvent =
      Boolean(sellerMarketing?.sellerEvents?.openHouse?.event) ||
      Boolean(sellerMarketing?.sellerEvents?.auction?.event);
    if (!hasEvent) return;
    setOpenSections((current) =>
      current.events ? current : { ...current, events: true },
    );
  }, [
    sellerMarketing?.sellerEvents?.openHouse?.event?.id,
    sellerMarketing?.sellerEvents?.auction?.event?.id,
  ]);

  const allMarketingFeed = useMemo(() => {
    const kinds = new Set([
      "ESTATEOS_PROMOTED",
      "ESTATEOS_ACTIVATED",
      "EXTERNAL_PORTAL_LISTED",
      "EXTERNAL_PORTAL_UPDATED",
      "EXTERNAL_PORTAL",
      "LISTING_FEATURED",
      "MARKETING_NOTE",
      "MARKET_REPORT_SENT",
    ]);
    return activities.filter((item) => kinds.has(item.kind));
  }, [activities]);
  const feedStacks = useMemo(
    () =>
      groupPortalPath(
        allMarketingFeed.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          portal:
            typeof item.metadata?.portal === "string"
              ? item.metadata.portal
              : null,
          siteName:
            typeof item.metadata?.siteName === "string"
              ? item.metadata.siteName
              : null,
          groupName:
            typeof item.metadata?.groupName === "string"
              ? item.metadata.groupName
              : null,
          url:
            typeof item.metadata?.url === "string"
              ? item.metadata.url
              : typeof item.metadata?.externalUrl === "string"
                ? item.metadata.externalUrl
                : null,
          status:
            typeof item.metadata?.status === "string" ? item.metadata.status : null,
        })),
        {
          activePortals: (sellerMarketing?.activeChannels || []).map(
            (channel) => channel.portal,
          ),
        },
      ),
    [allMarketingFeed, sellerMarketing?.activeChannels],
  );
  const renewalSoon = (sellerMarketing?.activeChannels || []).filter((channel) => {
    if (!channel.renewalDueAt) return false;
    const due = new Date(channel.renewalDueAt).getTime();
    return Number.isFinite(due) && due - Date.now() < 7 * 86400000;
  }).length;

  const eventsMetric = sellerEventsMetricSummary({
    openHouseEvent: sellerMarketing?.sellerEvents?.openHouse?.event,
    auctionEvent: sellerMarketing?.sellerEvents?.auction?.event,
  });

  const hasActiveOpenHouse = Boolean(
    sellerMarketing?.sellerEvents?.openHouse?.event &&
      !["CANCELLED", "COMPLETED"].includes(
        String(sellerMarketing.sellerEvents.openHouse.event.status || "").toUpperCase(),
      ),
  );
  const hasActiveAuction = Boolean(
    sellerMarketing?.sellerEvents?.auction?.event &&
      !["CANCELLED", "ENDED", "SETTLED"].includes(
        String(sellerMarketing.sellerEvents.auction.event.status || "").toUpperCase(),
      ),
  );

  const runAction = async (
    action: string,
    body: Record<string, unknown>,
    label: string,
  ) => {
    setBusy(label);
    const res = await postAgencyClientAction(token, clientId, {
      action,
      ...body,
    });
    setBusy("");
    if (!res.ok) {
      const msg = String(res.message || "");
      const alreadyPublished =
        /już opublikowany|already published|ALREADY_PUBLISHED/i.test(msg);
      if (alreadyPublished) {
        revealSection("events");
        setEventMode(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Już aktywne", "To wydarzenie jest już na ogłoszeniu — szczegóły poniżej.");
        onRefresh();
        return false;
      }
      Alert.alert("Promocja", msg);
      return false;
    }
    onRefresh();
    return true;
  };

  const shareToFacebookGroup = async (
    group: { groupName: string; groupUrl: string | null },
    offerId: number,
  ) => {
    if (!offerId) {
      Alert.alert("Facebook", "Wybierz ogłoszenie do wystawienia.");
      return;
    }
    setBusy("facebook");
    const res = await prepareFacebookGroupShare(token, clientId, {
      offerId,
      groupName: group.groupName,
      groupUrl: group.groupUrl,
    });
    setBusy("");
    if (!res.ok) {
      Alert.alert("Facebook", res.message);
      return;
    }
    const shareUrl = String(res.shareUrl || "");
    if (group.groupUrl) {
      await Linking.openURL(group.groupUrl).catch(() => {});
    }
    if (shareUrl) {
      await shareListingLink({
        url: shareUrl,
        sheetTitle: group.groupName || "Facebook",
      }).catch(() => {});
    }
    setFacebookPending({
      groupName: group.groupName,
      groupUrl: group.groupUrl,
      offerId,
    });
    setFbGroupNameDraft(group.groupName);
    setFbPostUrl("");
    setFbShowClient(true);
  };

  const confirmFacebookShare = async () => {
    if (!facebookPending) return;
    if (!isFacebookPostPermalink(fbPostUrl)) {
      Alert.alert(
        "Facebook",
        "Wklej link do konkretnego posta na grupie, nie do samej grupy. Na Facebooku: ⋯ przy poście → Kopiuj link.",
      );
      return;
    }
    setBusy("facebook");
    const res = await recordFacebookGroupPost(token, clientId, {
      offerId: facebookPending.offerId,
      groupName: fbGroupNameDraft.trim() || facebookPending.groupName,
      groupUrl: facebookPending.groupUrl,
      postUrl: fbPostUrl.trim() || undefined,
      confirmed: true,
      visibleToClient: fbShowClient,
    });
    setBusy("");
    if (!res.ok) {
      Alert.alert("Facebook", res.message);
      return;
    }
    setFacebookPending(null);
    setFbPostUrl("");
    onRefresh();
  };

  const pickEvidence = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setEvidence({
      uri: asset.uri,
      name: asset.name || "potwierdzenie",
      mimeType: asset.mimeType || "application/octet-stream",
    });
  };

  const savePortal = async () => {
    if (!portalUrl.trim()) {
      Alert.alert("Portal", "Wklej link do ogłoszenia.");
      return;
    }
    if (!/^https?:\/\//i.test(portalUrl.trim())) {
      Alert.alert("Portal", "Link musi zaczynać się od https:// lub http://.");
      return;
    }
    const renewalDueAt = dateToIso(renewalDate);
    if (
      renewalDate.trim() &&
      renewalDate !== "Bez pośpiechu" &&
      !renewalDueAt
    ) {
      Alert.alert("Termin odnowienia", "Wybierz poprawną datę w kalendarzu.");
      return;
    }
    let uploadedEvidence:
      { url: string; name: string; mimeType: string; size: number } | undefined;
    if (evidence) {
      setBusy("evidence");
      const upload = await uploadClientPortalAttachment(
        token,
        clientId,
        evidence,
      );
      if (!upload.ok) {
        setBusy("");
        Alert.alert("Potwierdzenie", upload.message);
        return;
      }
      uploadedEvidence = upload.attachment;
    }
    const ok = await runAction(
      "add_external_portal",
      {
        url: portalUrl.trim(),
        portal: portalPreset,
        status: portalStatus,
        note: portalNote.trim() || undefined,
        groupName: portalGroupName.trim() || undefined,
        visibleToClient: showClientPortal,
        publishedAt: dateToIso(publishedDate),
        renewalDueAt,
        evidenceUrl: uploadedEvidence?.url,
        evidenceName: uploadedEvidence?.name,
        evidenceMimeType: uploadedEvidence?.mimeType,
      },
      "portal",
    );
    if (ok) {
      setPortalUrl("");
      setPortalNote("");
      setPortalGroupName("");
      setRenewalDate("");
      setPublishedDate(todayYmd());
      setEvidence(null);
      setShowClientPortal(false);
    }
  };

  const handleAddPortal = () => {
    if (!showClientPortal) {
      void savePortal();
      return;
    }
    Alert.alert(
      "Udostępnić klientowi?",
      "Po zapisie klient zobaczy wpis w panelu i otrzyma powiadomienie. Sprawdź link i treść przed publikacją.",
      [
        { text: "Anuluj", style: "cancel" },
        { text: "Udostępnij", onPress: () => void savePortal() },
      ],
    );
  };

  const handlePromote = async (credits: number) => {
    if (!linkedOfferId) return;
    setBusy("promote");
    const result = await promoteMobileOfferListing(
      token,
      linkedOfferId,
      credits,
    );
    if (result.ok === false) {
      setBusy("");
      Alert.alert("EstateOS", result.message);
      return;
    }
    setBusy("");
    setPromoteOpen(false);
    onRefresh();
    Alert.alert(
      "Oferta wyróżniona",
      `Wyróżnienie działa do ${formatDateLabel(result.promotedUntil)}. Wpis zapisano jako widoczny tylko dla agenta.`,
      [
        { text: "Zostaw prywatnie", style: "cancel" },
        {
          text: "Pokaż klientowi",
          onPress: () =>
            void runAction(
              "publish_latest_estateos_promotion",
              { offerId: linkedOfferId },
              "publish-promotion",
            ),
        },
      ],
    );
  };

  const handleSaveNextStep = async () => {
    await runAction(
      "set_seller_next_step",
      {
        currentStep: nextCurrent,
        nextAction: nextAction,
        clientMessage: nextMessage,
        dueAt: dateToIso(nextDueAt),
        visibleToClient: nextVisible,
      },
      "next",
    );
  };

  const handleRequestDecision = async () => {
    if (!decisionTitle.trim() || decisionMessage.trim().length < 5) {
      Alert.alert("Decyzja", "Uzupełnij tytuł i komunikat dla klienta.");
      return;
    }
    const ok = await runAction(
      "request_client_decision",
      {
        kind: decisionKind,
        title: decisionTitle.trim(),
        clientMessage: decisionMessage.trim(),
        dueAt: dateToIso(decisionDueAt),
      },
      "decision",
    );
    if (ok) {
      setDecisionTitle("");
      setDecisionMessage("");
      setDecisionDueAt("");
    }
  };

  const handleSubmitEvent = async (mode: "propose" | "start") => {
    if (!linkedOfferId) {
      Alert.alert("Wydarzenie", "Najpierw powiąż aktywne ogłoszenie.");
      return;
    }
    if (!eventMode) return;
    if (
      mode === "start" &&
      ((eventMode === "open_house" && hasActiveOpenHouse) ||
        (eventMode === "auction" && hasActiveAuction))
    ) {
      revealSection("events");
      setEventMode(null);
      Alert.alert("Już aktywne", "To wydarzenie jest już na ogłoszeniu — szczegóły powyżej.");
      return;
    }
    if (!eventDate || !eventStartTime || !eventEndTime) {
      Alert.alert("Wydarzenie", "Uzupełnij datę i godziny.");
      return;
    }
    if (
      eventMode === "auction" &&
      (!eventStartPrice.trim() || Number(eventStartPrice) <= 0)
    ) {
      Alert.alert("Licytacja", "Podaj cenę startową.");
      return;
    }
    const startsAt = new Date(`${eventDate}T${eventStartTime}:00`).toISOString();
    const endsAt = new Date(`${eventDate}T${eventEndTime}:00`).toISOString();
    const isAuction = eventMode === "auction";
    const ok = await runAction(
      mode === "start"
        ? isAuction
          ? "start_auction"
          : "start_open_house"
        : isAuction
          ? "propose_auction"
          : "propose_open_house",
      {
        startsAt,
        endsAt,
        startPrice: isAuction ? Number(eventStartPrice) : undefined,
        reservePrice:
          isAuction && eventReservePrice.trim()
            ? Number(eventReservePrice)
            : undefined,
        clientMessage: eventMessage.trim() || null,
        notifyOwner,
      },
      mode === "start" ? "event-start" : "event-propose",
    );
    if (ok) {
      setEventMode(null);
      setEventMessage("");
      setEventStartPrice("");
      setEventReservePrice("");
      Alert.alert(
        mode === "start" ? "Uruchomiono" : "Wysłano",
        mode === "start"
          ? notifyOwner
            ? "Wydarzenie jest na ogłoszeniu. Właściciel dostał informację."
            : "Wydarzenie jest na ogłoszeniu — bez wiadomości do właściciela."
          : "Propozycja czeka na akceptację klienta w panelu.",
      );
    }
  };

  const toggleVisibility = async (activityId: number, visible: boolean) => {
    if (!visible) {
      await runAction(
        "set_marketing_visibility",
        { activityId, visibleToClient: false },
        `vis-${activityId}`,
      );
      return;
    }
    Alert.alert(
      "Pokazać klientowi?",
      "Klient otrzyma powiadomienie i zobaczy ten wpis w historii działań.",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Pokaż",
          onPress: () =>
            void runAction(
              "set_marketing_visibility",
              { activityId, visibleToClient: true },
              `vis-${activityId}`,
            ),
        },
      ],
    );
  };

  const removeChannel = (activityId: number, portal: string) => {
    Alert.alert(
      `Zakończyć publikację na ${portal}?`,
      "Kanał zniknie z listy aktywnych. Historia działań pozostanie w CRM.",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Zakończ",
          style: "destructive",
          onPress: () =>
            void runAction(
              "remove_external_portal",
              {
                activityId,
                note: `Publikacja na ${portal} została zakończona.`,
              },
              `remove-${activityId}`,
            ),
        },
      ],
    );
  };

  const renewChannel = (activityId: number, portal: string) => {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 30);
    Alert.alert(
      `Odnowić publikację na ${portal}?`,
      `Nowy termin odnowienia: ${formatDateLabel(dueAt.toISOString())}.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Odnów",
          onPress: () =>
            void runAction(
              "update_external_portal",
              {
                activityId,
                status: "active",
                renewalDueAt: dueAt.toISOString(),
                note: `Publikacja na ${portal} została odnowiona.`,
              },
              `renew-${activityId}`,
            ),
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.kicker, { color: colors.accent }]}>
        DYSTRYBUCJA I WSPÓŁPRACA
      </Text>
      <Text
        style={{
          color: colors.secondary,
          fontSize: 13,
          marginTop: 4,
          lineHeight: 18,
        }}
      >
        Gdzie wisi ogłoszenie, co ustalamy z klientem i co już zrobiliśmy.
      </Text>
      <View style={styles.metricsRow}>
        <Pressable
          onPress={() => revealSection("channels")}
          style={[styles.metric, { backgroundColor: colors.input }]}
        >
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {sellerMarketing?.activeChannels.length || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            kanały
          </Text>
        </Pressable>
        <Pressable
          onPress={() => revealSection("events")}
          style={[styles.metric, { backgroundColor: colors.input }]}
        >
          <Text
            style={[
              styles.metricValue,
              { color: eventsMetric.highlight ? "#34C759" : colors.text },
            ]}
          >
            {eventsMetric.label}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            wydarzenie
          </Text>
        </Pressable>
        <Pressable
          onPress={() => revealSection("channels")}
          style={[styles.metric, { backgroundColor: colors.input }]}
        >
          <Text style={[styles.metricValue, { color: renewalSoon ? "#F59E0B" : colors.text }]}>
            {renewalSoon}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            do odnowienia
          </Text>
        </Pressable>
        <Pressable
          onPress={() => revealSection("feed")}
          style={[styles.metric, { backgroundColor: colors.input }]}
        >
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {allMarketingFeed.length}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            historia
          </Text>
        </Pressable>
      </View>

      {/* Kategorie publikacji — kolejność jak screen 2 */}
      <Text style={[styles.groupKicker, { color: colors.secondary, marginTop: 14 }]}>PUBLIKACJE</Text>
      <Text style={[styles.groupPurpose, { color: colors.secondary }]}>
        Grupy, portale i EstateOS — każde osobno.
      </Text>
        <View style={{ marginTop: 6 }}>
          <Pressable
            onPress={() => toggleSection("facebook")}
            style={[styles.sectionToggle, { borderColor: "rgba(24,119,242,0.35)", backgroundColor: colors.card }]}
          >
            <PortalBrandMark id="facebook" size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Grupy Facebook · {sellerMarketing?.facebookGroups?.length || 0}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                {facebookPending
                  ? `Dokończ wpis na „${facebookPending.groupName}”`
                  : "Wystaw ogłoszenie, potem wklej link do posta"}
              </Text>
            </View>
            <Ionicons
              name={openSections.facebook || facebookPending ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.secondary}
            />
          </Pressable>
          {openSections.facebook || facebookPending ? (
        <View>
          <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
            Otworzy się Facebook z kartą ogłoszenia. Żeby klik w panelu otwierał
            ogłoszenie, wklej link do konkretnego posta (⋯ → Kopiuj link).
          </Text>
          {facebookPending ? (
            <View
              style={[
                styles.channelRow,
                {
                  borderColor: "rgba(24,119,242,0.45)",
                  backgroundColor: "rgba(24,119,242,0.12)",
                  marginTop: 10,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  Wklej link do posta na „{facebookPending.groupName}”
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>
                  Facebook nie oddaje adresu ogłoszenia. Pod wrzuconym postem: ⋯ → Kopiuj link.
                </Text>
                <TextInput
                  value={fbGroupNameDraft}
                  onChangeText={setFbGroupNameDraft}
                  placeholder="Nazwa grupy"
                  placeholderTextColor={colors.secondary}
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
                <TextInput
                  value={fbPostUrl}
                  onChangeText={setFbPostUrl}
                  placeholder="https://www.facebook.com/groups/…/posts/…"
                  placeholderTextColor={colors.secondary}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
                <View style={styles.switchRow}>
                  <Text style={{ color: colors.text, flex: 1 }}>
                    Pokaż klientowi
                  </Text>
                  <Switch
                    value={fbShowClient}
                    onValueChange={setFbShowClient}
                  />
                </View>
                <Pressable
                  disabled={Boolean(busy) || !isFacebookPostPermalink(fbPostUrl)}
                  onPress={() => void confirmFacebookShare()}
                  style={[
                    styles.fbShareBtn,
                    !isFacebookPostPermalink(fbPostUrl) ? { opacity: 0.45 } : null,
                  ]}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                    ZAPISZ W ŚCIEŻCE
                  </Text>
                </Pressable>
                <Pressable onPress={() => setFacebookPending(null)}>
                  <Text style={{ color: colors.secondary, fontWeight: "700" }}>
                    Nie teraz
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {(sellerMarketing?.facebookShareOffers?.length || 0) > 1 ? (
            <View style={styles.chips}>
              {sellerMarketing?.facebookShareOffers?.slice(0, 8).map((offer) => (
                <Pressable
                  key={offer.id}
                  onPress={() => setPickedFbOfferId(offer.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor:
                        (pickedFbOfferId || linkedOfferId) === offer.id
                          ? "#1877F2"
                          : colors.border,
                      backgroundColor:
                        (pickedFbOfferId || linkedOfferId) === offer.id
                          ? "rgba(24,119,242,0.16)"
                          : colors.input,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                    numberOfLines={1}
                  >
                    {offer.id === linkedOfferId ? "Ta oferta" : offer.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {(sellerMarketing?.facebookGroups || []).slice(0, fbListLimit).map((group) => (
            <View
              key={group.key}
              style={[
                styles.channelRow,
                {
                  borderColor: "rgba(24,119,242,0.35)",
                  backgroundColor: "rgba(24,119,242,0.08)",
                },
              ]}
            >
              <View
                style={[styles.channelIcon, { backgroundColor: "#1877F2" }]}
              >
                <Ionicons name="logo-facebook" size={17} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  {group.groupName}
                </Text>
                <Text
                  style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}
                >
                  {group.postCount}× · {formatDateLabel(group.lastPostedAt)}
                </Text>
              </View>
              {linkedOfferId ? (
                <Pressable
                  disabled={Boolean(busy)}
                  onPress={() =>
                    void shareToFacebookGroup(group, linkedOfferId)
                  }
                  hitSlop={8}
                >
                  <Ionicons name="refresh-outline" size={19} color="#1877F2" />
                </Pressable>
              ) : null}
              <Pressable
                disabled={Boolean(busy)}
                onPress={() =>
                  void shareToFacebookGroup(
                    group,
                    pickedFbOfferId || linkedOfferId || 0,
                  )
                }
                style={[styles.fbShareBtn, { opacity: busy === "facebook" ? 0.6 : 1 }]}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                  WYSTAW
                </Text>
              </Pressable>
            </View>
          ))}
          {(sellerMarketing?.facebookGroups?.length || 0) > fbListLimit ? (
            <Pressable
              onPress={() => setFbListLimit((current) => current + 8)}
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.accent, fontWeight: "800" }}>
                Pokaż pozostałe {(sellerMarketing?.facebookGroups?.length || 0) - fbListLimit} grup
              </Text>
            </Pressable>
          ) : null}
        </View>
          ) : null}
        </View>

      <View style={{ marginTop: 6 }}>
          <Pressable
            onPress={() => toggleSection("channels")}
            style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <PortalBrandMark id="otodom" size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Aktywne kanały · {sellerMarketing?.activeChannels.length}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                {renewalSoon
                  ? `${renewalSoon} do odnowienia w tym tygodniu`
                  : "Otodom, grupy i terminy odnowienia"}
              </Text>
            </View>
            <Ionicons
              name={openSections.channels ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.secondary}
            />
          </Pressable>
          {openSections.channels ? (
          <>
          <View style={{ marginBottom: 8, gap: 0 }}>
      <View style={styles.row}>
        <View style={[styles.estateosState, { backgroundColor: colors.input }]}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: sellerMarketing?.estateos?.published
                  ? "#34C759"
                  : "#FF9500",
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}
            >
              {sellerMarketing?.estateos?.published
                ? "Opublikowana na EstateOS™"
                : "Oferta w przygotowaniu"}
            </Text>
            <Text
              style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }}
            >
              {sellerMarketing?.estateos?.featured &&
              sellerMarketing.estateos.promotedUntil
                ? `Wyróżniona do ${formatDateLabel(sellerMarketing.estateos.promotedUntil)}`
                : "Bez aktywnego wyróżnienia"}
            </Text>
          </View>
        </View>
        <Pressable
          disabled={!linkedOfferId || Boolean(busy)}
          onPress={() => setPromoteOpen(true)}
          style={[styles.primaryBtn, { opacity: linkedOfferId ? 1 : 0.45 }]}
        >
          <Ionicons name="star" size={16} color="#000" />
          <Text style={styles.primaryBtnText}>Podbij EstateOS</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => toggleSection("external")}
        style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <PortalBrandMark
          id={
            /otodom/i.test(portalPreset)
              ? "otodom"
              : /olx/i.test(portalPreset)
                ? "olx"
                : /facebook/i.test(portalPreset)
                  ? "facebook"
                  : "portal"
          }
          size="sm"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Dodaj publikację zewnętrzną
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            Link z Otodom, OLX albo innego portalu
          </Text>
        </View>
        <Ionicons
          name={openSections.external ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSections.external ? (
        <>
          <View style={styles.chips}>
            {PORTAL_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setPortalPreset(preset)}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      portalPreset === preset ? colors.accent : colors.border,
                    backgroundColor:
                      portalPreset === preset
                        ? `${colors.accent}22`
                        : colors.input,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {preset}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chips}>
            {[
              { id: "active" as const, label: "Aktywna" },
              { id: "paused" as const, label: "Wstrzymana" },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setPortalStatus(item.id)}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      portalStatus === item.id ? colors.accent : colors.border,
                    backgroundColor:
                      portalStatus === item.id
                        ? `${colors.accent}22`
                        : colors.input,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={portalUrl}
            onChangeText={setPortalUrl}
            placeholder={
              portalPreset === "Facebook"
                ? "https://www.facebook.com/groups/..."
                : "https://www.otodom.pl/pl/oferta/..."
            }
            placeholderTextColor={colors.secondary}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          {portalPreset === "Facebook" ? (
            <TextInput
              value={portalGroupName}
              onChangeText={setPortalGroupName}
              placeholder="Nazwa grupy Facebook (opcjonalnie)"
              placeholderTextColor={colors.secondary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                },
              ]}
            />
          ) : null}
          <TextInput
            value={portalNote}
            onChangeText={setPortalNote}
            placeholder="Krótka notatka (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <Pressable
            onPress={() => setDatePicker("published")}
            style={[
              styles.input,
              styles.dateButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.accent} />
            <Text style={{ color: colors.text, flex: 1 }}>
              Data publikacji: {formatDateLabel(publishedDate)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDatePicker("renewal")}
            style={[
              styles.input,
              styles.dateButton,
              { borderColor: colors.border, backgroundColor: colors.input },
            ]}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.accent} />
            <Text
              style={{
                color: renewalDate ? colors.text : colors.secondary,
                flex: 1,
              }}
            >
              {renewalDate
                ? `Odnowienie: ${formatDateLabel(renewalDate)}`
                : "Ustaw termin odnowienia"}
            </Text>
            {renewalDate ? (
              <Pressable onPress={() => setRenewalDate("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.secondary}
                />
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => void pickEvidence()}
            style={[
              styles.input,
              styles.dateButton,
              { borderColor: colors.border, backgroundColor: colors.input },
            ]}
          >
            <Ionicons
              name={evidence ? "checkmark-circle" : "attach"}
              size={17}
              color={colors.accent}
            />
            <Text
              style={{
                color: evidence ? colors.text : colors.secondary,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {evidence?.name || "Dodaj potwierdzenie: zdjęcie lub PDF"}
            </Text>
            {evidence ? (
              <Pressable onPress={() => setEvidence(null)} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.secondary}
                />
              </Pressable>
            ) : null}
          </Pressable>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Pokaż klientowi
              </Text>
              <Text
                style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}
              >
                Domyślnie wyłączone. Włączenie wyśle powiadomienie.
              </Text>
            </View>
            <Switch
              value={showClientPortal}
              onValueChange={setShowClientPortal}
            />
          </View>
          {showClientPortal ? (
            <View
              style={[
                styles.clientPreview,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.secondary,
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: 0.6,
                }}
              >
                PODGLĄD DLA KLIENTA
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "800",
                  marginTop: 5,
                }}
              >
                Opublikowano na {portalPreset}
              </Text>
              <Text
                style={{
                  color: colors.secondary,
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 3,
                }}
              >
                {portalNote.trim() ||
                  `Twoja nieruchomość jest widoczna na ${portalPreset}. Link do ogłoszenia znajdziesz w panelu.`}
              </Text>
            </View>
          ) : null}
          <Pressable
            disabled={Boolean(busy)}
            onPress={() => void handleAddPortal()}
            style={[
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: busy === "portal" ? 0.6 : 1,
              },
            ]}
          >
            {busy === "portal" ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Zapisz publikację
              </Text>
            )}
          </Pressable>
        </>
      ) : null}

          </View>
          {(sellerMarketing?.activeChannels || []).length === 0 ? (
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
              Brak aktywnych kanałów. Zapisz publikację powyżej, żeby pojawiła się tutaj.
            </Text>
          ) : null}
          {sellerMarketing?.activeChannels.map((channel) => {
            const tone = renewalTone(channel.renewalDueAt);
            return (
              <View
                key={`${channel.activityId}-${channel.portal}`}
                style={[styles.channelRow, { borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.channelIcon,
                    { backgroundColor: "transparent", padding: 0 },
                  ]}
                >
                  <PortalBrandMark
                    id={resolveMarketingChannel({ portal: channel.portal, url: channel.externalUrl }).id}
                    size="sm"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {channel.portal}
                  </Text>
                  <Text
                    style={{
                      color: tone.color,
                      fontSize: 11,
                      marginTop: 2,
                      fontWeight: "700",
                    }}
                  >
                    {channel.renewalDueAt
                      ? `Odnowienie ${formatDateLabel(channel.renewalDueAt)} · ${tone.label}`
                      : tone.label}
                  </Text>
                </View>
                {channel.externalUrl ? (
                  <Pressable
                    accessibilityLabel={`Otwórz publikację na ${channel.portal}`}
                    onPress={() => void Linking.openURL(channel.externalUrl!)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="open-outline"
                      size={19}
                      color={colors.accent}
                    />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Odnów publikację na ${channel.portal}`}
                  onPress={() =>
                    renewChannel(channel.activityId, channel.portal)
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={19}
                    color={colors.accent}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Zakończ publikację na ${channel.portal}`}
                  onPress={() =>
                    removeChannel(channel.activityId, channel.portal)
                  }
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </Pressable>
              </View>
            );
          })}
          </>
          ) : null}
        </View>

      <View style={styles.group}>
        <Text style={[styles.groupKicker, { color: colors.secondary }]}>KROK Z KLIENTEM</Text>
        <Text style={[styles.groupPurpose, { color: colors.secondary }]}>
          Co ustalamy dziś i jakie decyzje czekają.
        </Text>
      <Pressable
        onPress={() => toggleSection("plan")}
        style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="navigate-outline" size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Plan: teraz / dalej
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            {sellerMarketing?.sellerNextStep?.nextAction ||
              "Co robimy dziś i co dalej"}
          </Text>
        </View>
        <Ionicons
          name={openSections.plan ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSections.plan ? (
        <>
          <TextInput
            value={nextCurrent}
            onChangeText={setNextCurrent}
            placeholder="Co robimy teraz"
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <TextInput
            value={nextAction}
            onChangeText={setNextAction}
            placeholder="Następne działanie"
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <TextInput
            value={nextMessage}
            onChangeText={setNextMessage}
            placeholder="Wersja dla klienta (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <Pressable
            onPress={() => setDatePicker("next")}
            style={[
              styles.input,
              styles.dateButton,
              { borderColor: colors.border, backgroundColor: colors.input },
            ]}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.accent} />
            <Text
              style={{
                color: nextDueAt ? colors.text : colors.secondary,
                flex: 1,
              }}
            >
              {nextDueAt
                ? `Termin: ${formatDateLabel(nextDueAt)}`
                : "Ustaw termin następnego kroku"}
            </Text>
            {nextDueAt ? (
              <Pressable onPress={() => setNextDueAt("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.secondary}
                />
              </Pressable>
            ) : null}
          </Pressable>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Plan widoczny dla klienta
              </Text>
              <Text
                style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}
              >
                Używaj wyłącznie bezpiecznego, zrozumiałego opisu.
              </Text>
            </View>
            <Switch value={nextVisible} onValueChange={setNextVisible} />
          </View>
          <Pressable
            disabled={Boolean(busy)}
            onPress={() => void handleSaveNextStep()}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {busy === "next" ? "…" : "Zapisz plan"}
            </Text>
          </Pressable>
        </>
      ) : null}
      <Pressable
        onPress={() => toggleSection("decision")}
        style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="help-circle-outline" size={19} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Poproś o decyzję
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            Cena, materiały, termin lub inne
          </Text>
        </View>
        <Ionicons
          name={openSections.decision ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSections.decision ? (
        <>
          <View style={styles.chips}>
            {[
              { id: "price", label: "Cena" },
              { id: "materials", label: "Materiały" },
              { id: "schedule", label: "Termin" },
              { id: "other", label: "Inne" },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setDecisionKind(item.id)}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      decisionKind === item.id ? colors.accent : colors.border,
                    backgroundColor:
                      decisionKind === item.id
                        ? `${colors.accent}22`
                        : colors.input,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={decisionTitle}
            onChangeText={setDecisionTitle}
            placeholder="Tytuł prośby"
            placeholderTextColor={colors.secondary}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <TextInput
            value={decisionMessage}
            onChangeText={setDecisionMessage}
            placeholder="Co klient ma zatwierdzić?"
            placeholderTextColor={colors.secondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
          />
          <Pressable
            onPress={() => setDatePicker("decision")}
            style={[
              styles.input,
              styles.dateButton,
              { borderColor: colors.border, backgroundColor: colors.input },
            ]}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.accent} />
            <Text
              style={{
                color: decisionDueAt ? colors.text : colors.secondary,
                flex: 1,
              }}
            >
              {decisionDueAt
                ? `Odpowiedź do: ${formatDateLabel(decisionDueAt)}`
                : "Ustaw termin odpowiedzi"}
            </Text>
            {decisionDueAt ? (
              <Pressable onPress={() => setDecisionDueAt("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.secondary}
                />
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable
            disabled={Boolean(busy)}
            onPress={() => void handleRequestDecision()}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>
              {busy === "decision" ? "…" : "Wyślij prośbę"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {(sellerMarketing?.pendingDecisions.length || 0) > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupKicker, { color: colors.secondary }]}>
            OCZEKUJĄCE ODPOWIEDZI
          </Text>
          <Text style={[styles.groupPurpose, { color: colors.secondary }]}>
            Decyzje czekające na klienta.
          </Text>
          {sellerMarketing?.pendingDecisions.map((decision) => (
            <View
              key={decision.id}
              style={[styles.pendingRow, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="hourglass-outline" size={18} color="#FF9500" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {decision.title}
                </Text>
                <Text
                  style={{
                    color: colors.secondary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {decision.dueAt
                    ? `Odpowiedź do ${formatDateLabel(decision.dueAt)}`
                    : "Bez terminu"}
                </Text>
                {decision.clientResponse ? (
                  <Text
                    style={{ color: colors.text, fontSize: 12, marginTop: 5 }}
                    numberOfLines={2}
                  >
                    Komentarz: {decision.clientResponse}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupKicker, { color: colors.secondary }]}>WYDARZENIA SPRZEDAŻY</Text>
        <Text style={[styles.groupPurpose, { color: colors.secondary }]}>
          Kalendarz dnia otwartego i licytacji — osobno od planu współpracy.
        </Text>
      <Pressable
        onPress={() => toggleSection("events")}
        style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Wydarzenia sprzedaży
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            Dzień otwarty albo licytacja na ogłoszeniu
          </Text>
        </View>
        <Ionicons
          name={openSections.events ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSections.events ? (
          <View
            style={[
              styles.eventBox,
              { borderColor: `${colors.accent}44`, backgroundColor: `${colors.accent}12` },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
              Wydarzenie sprzedaży
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
              Status, odliczanie i rezerwacje — albo uruchom dzień otwarty / licytację.
            </Text>

            {sellerMarketing?.sellerEvents ? (
              <SellerActiveEventsPanel
                token={token}
                openHouse={sellerMarketing.sellerEvents.openHouse}
                auction={sellerMarketing.sellerEvents.auction}
                stage={sellerMarketing.sellerEvents.stage}
                colors={colors}
                onRequestLaunch={(kind) => {
                  setEventMode(kind);
                  void Haptics.selectionAsync();
                }}
              />
            ) : null}

            {(!hasActiveOpenHouse || !hasActiveAuction || eventMode) ? (
              <>
            <View style={[styles.chips, { marginTop: 10 }]}>
              {!hasActiveOpenHouse || eventMode === "open_house" ? (
              <Pressable
                onPress={() =>
                  setEventMode(eventMode === "open_house" ? null : "open_house")
                }
                style={[
                  styles.chip,
                  {
                    borderColor:
                      eventMode === "open_house" ? colors.accent : colors.border,
                    backgroundColor:
                      eventMode === "open_house"
                        ? `${colors.accent}22`
                        : colors.input,
                    opacity: hasActiveOpenHouse && eventMode !== "open_house" ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                  Dzień otwarty
                </Text>
              </Pressable>
              ) : null}
              {!hasActiveAuction || eventMode === "auction" ? (
              <Pressable
                onPress={() =>
                  setEventMode(eventMode === "auction" ? null : "auction")
                }
                style={[
                  styles.chip,
                  {
                    borderColor:
                      eventMode === "auction" ? colors.accent : colors.border,
                    backgroundColor:
                      eventMode === "auction"
                        ? `${colors.accent}22`
                        : colors.input,
                    opacity: hasActiveAuction && eventMode !== "auction" ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                  Licytacja
                </Text>
              </Pressable>
              ) : null}
            </View>
            {eventMode ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Pressable
                  onPress={() => setDatePicker("event")}
                  style={[
                    styles.input,
                    styles.dateButton,
                    { borderColor: colors.border, backgroundColor: colors.input },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={17} color={colors.accent} />
                  <Text style={{ color: colors.text, flex: 1 }}>
                    Data: {formatDateLabel(eventDate)}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    value={eventStartTime}
                    onChangeText={setEventStartTime}
                    placeholder="11:00"
                    placeholderTextColor={colors.secondary}
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.input,
                      },
                    ]}
                  />
                  <TextInput
                    value={eventEndTime}
                    onChangeText={setEventEndTime}
                    placeholder="14:00"
                    placeholderTextColor={colors.secondary}
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.input,
                      },
                    ]}
                  />
                </View>
                {eventMode === "auction" ? (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={eventStartPrice}
                      onChangeText={(v) =>
                        setEventStartPrice(v.replace(/[^\d]/g, ""))
                      }
                      placeholder="Cena startowa"
                      placeholderTextColor={colors.secondary}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        {
                          flex: 1,
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.input,
                        },
                      ]}
                    />
                    <TextInput
                      value={eventReservePrice}
                      onChangeText={(v) =>
                        setEventReservePrice(v.replace(/[^\d]/g, ""))
                      }
                      placeholder="Rezerwa"
                      placeholderTextColor={colors.secondary}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        {
                          flex: 1,
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.input,
                        },
                      ]}
                    />
                  </View>
                ) : null}
                <TextInput
                  value={eventMessage}
                  onChangeText={setEventMessage}
                  placeholder="Wiadomość do klienta (opcjonalnie)"
                  placeholderTextColor={colors.secondary}
                  multiline
                  style={[
                    styles.input,
                    styles.multiline,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.input,
                    },
                  ]}
                />
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      Poinformuj właściciela
                    </Text>
                    <Text
                      style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}
                    >
                      Portal, e-mail i powiadomienie — bez prośby o zgodę.
                    </Text>
                  </View>
                  <Switch value={notifyOwner} onValueChange={setNotifyOwner} />
                </View>
                <Pressable
                  disabled={Boolean(busy)}
                  onPress={() => void handleSubmitEvent("start")}
                  style={[styles.secondaryBtn, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: "800" }}>
                    {busy === "event-start"
                      ? "…"
                      : eventMode === "auction"
                        ? "Uruchom licytację"
                        : "Uruchom dzień otwarty"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={Boolean(busy)}
                  onPress={() => void handleSubmitEvent("propose")}
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {busy === "event-propose" ? "…" : "Wyślij do akceptacji"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
              </>
            ) : null}
          </View>
      ) : null}
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupKicker, { color: colors.secondary }]}>HISTORIA</Text>
        <Text style={[styles.groupPurpose, { color: colors.secondary }]}>
          Co już zrobiliśmy przy promocji ogłoszenia.
        </Text>
      <View style={{ marginTop: 6 }}>
          <Pressable
            onPress={() => toggleSection("feed")}
            style={[styles.sectionToggle, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Historia · {allMarketingFeed.length}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {allMarketingFeed[0]?.title || "Ostatnie publikacje i raporty"}
              </Text>
            </View>
            <Ionicons
              name={openSections.feed ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.secondary}
            />
          </Pressable>
          {openSections.feed
            ? feedStacks.map((stack) => {
                const open = openFeedStack === stack.kind;
                const items = stack.items.slice(0, open ? feedLimit : 0);
                return (
                  <View key={stack.kind} style={{ marginTop: 8 }}>
                    <Pressable
                      onPress={() =>
                        setOpenFeedStack((current) =>
                          current === stack.kind ? null : stack.kind,
                        )
                      }
                      style={[
                        styles.feedRow,
                        { borderColor: colors.border, backgroundColor: colors.input },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
                          {stack.label} · {stack.items.length}
                        </Text>
                        <Text
                          style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}
                          numberOfLines={2}
                        >
                          {stack.summary}
                        </Text>
                      </View>
                      <Ionicons
                        name={open ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.secondary}
                      />
                    </Pressable>
                    {open
                      ? (stack.kind === "promotions"
                          ? groupPromotionsByChannel(stack.items).map((group) => (
                              <View key={group.id} style={{ marginTop: 8, marginLeft: 4 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 4 }}>
                                  <MarketingChannelBrand id={group.id} label={group.label} />
                                  <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: "700" }}>
                                    {group.items.length}
                                  </Text>
                                </View>
                                {group.items.slice(0, feedLimit).map((item) => {
                                  const full = allMarketingFeed.find((row) => row.id === item.id);
                                  if (!full) return null;
                                  return (
                                    <View
                                      key={item.id}
                                      style={[styles.feedRow, { borderColor: colors.border, marginLeft: 6 }]}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
                                          {full.title || full.kind}
                                        </Text>
                                        <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>
                                          {formatDateLabel(full.createdAt)} ·{" "}
                                          {full.visibleToClient ? "widoczne" : "tylko agent"}
                                        </Text>
                                      </View>
                                      <Switch
                                        value={Boolean(full.visibleToClient)}
                                        disabled={Boolean(busy)}
                                        onValueChange={(value) => void toggleVisibility(full.id, value)}
                                      />
                                    </View>
                                  );
                                })}
                              </View>
                            ))
                          : items.map((item) => {
                          const full = allMarketingFeed.find((row) => row.id === item.id);
                          if (!full) return null;
                          return (
                            <View
                              key={item.id}
                              style={[styles.feedRow, { borderColor: colors.border, marginLeft: 10 }]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
                                  {full.title || full.kind}
                                </Text>
                                <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>
                                  {formatDateLabel(full.createdAt)} ·{" "}
                                  {full.visibleToClient ? "widoczne" : "tylko agent"}
                                </Text>
                              </View>
                              <Switch
                                value={Boolean(full.visibleToClient)}
                                disabled={Boolean(busy)}
                                onValueChange={(value) => void toggleVisibility(full.id, value)}
                              />
                            </View>
                          );
                        }))
                      : null}
                    {open && stack.items.length > items.length ? (
                      <Pressable
                        onPress={() => setFeedLimit((current) => current + 8)}
                        style={[styles.secondaryBtn, { borderColor: colors.border }]}
                      >
                        <Text style={{ color: colors.accent, fontWeight: "800" }}>
                          Pokaż starsze w tej grupie
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            : null}
          {openSections.feed && feedStacks.length === 0 ? (
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
              Historia pojawi się po pierwszej publikacji lub podbiciu.
            </Text>
          ) : null}
        </View>
      </View>

      <AcquisitionDatePickerModal
        visible={datePicker !== null}
        initialValue={
          datePicker === "published"
            ? publishedDate
            : datePicker === "renewal"
              ? renewalDate
              : datePicker === "next"
                ? nextDueAt
                : datePicker === "event"
                  ? eventDate
                  : decisionDueAt
        }
        onClose={() => setDatePicker(null)}
        onSelect={(value) => {
          const normalized = value === "Bez pośpiechu" ? "" : value;
          if (datePicker === "published" && normalized)
            setPublishedDate(normalized);
          if (datePicker === "renewal") setRenewalDate(normalized);
          if (datePicker === "next") setNextDueAt(normalized);
          if (datePicker === "decision") setDecisionDueAt(normalized);
          if (datePicker === "event" && normalized) setEventDate(normalized);
        }}
        isDark={isDark}
        mode="timeline"
        title={
          datePicker === "published"
            ? "Data publikacji"
            : datePicker === "renewal"
              ? "Termin odnowienia publikacji"
              : datePicker === "next"
                ? "Termin następnego kroku"
                : datePicker === "event"
                  ? "Data wydarzenia"
                  : "Termin odpowiedzi klienta"
        }
      />

      <FeaturedPromoteSheet
        visible={promoteOpen}
        creditBalance={creditBalance}
        hasCredits={creditBalance > 0}
        loading={busy === "promote"}
        onClose={() => setPromoteOpen(false)}
        onConfirm={(credits) => void handlePromote(credits)}
        onTopUp={() => {
          setPromoteOpen(false);
          Alert.alert(
            "Kredyty",
            "Doładuj Pakiet + w profilu, aby wyróżnić ogłoszenie.",
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  group: {
    marginTop: 14,
    borderRadius: 0,
    padding: 0,
  },
  groupKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  groupPurpose: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  metric: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metricValue: { fontSize: 18, fontWeight: "900" },
  metricLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  estateosState: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#34C759",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: "#000", fontWeight: "900", fontSize: 13 },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontSize: 14,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  clientPreview: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    gap: 10,
  },
  channelIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fbShareBtn: {
    backgroundColor: "#1877F2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  eventBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  eventStageChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
});
