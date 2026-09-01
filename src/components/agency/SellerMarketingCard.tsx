import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import FeaturedPromoteSheet from "../offer/FeaturedPromoteSheet";
import AcquisitionDatePickerModal from "./AcquisitionDatePickerModal";
import {
  postAgencyClientAction,
  uploadClientPortalAttachment,
} from "../../services/agencyClientService";
import { promoteMobileOfferListing } from "../../utils/mobileOfferPromote";

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
  }[];
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
}: Props) {
  const [busy, setBusy] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [portalNote, setPortalNote] = useState("");
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
    "published" | "renewal" | "next" | "decision" | null
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
  const [openSection, setOpenSection] = useState<
    "external" | "plan" | "decision" | null
  >(null);
  const [feedLimit, setFeedLimit] = useState(12);

  useEffect(() => {
    const next = sellerMarketing?.sellerNextStep;
    if (!next) return;
    setNextCurrent(next.currentStep);
    setNextAction(next.nextAction);
    setNextMessage(next.clientMessage || "");
    setNextDueAt(next.dueAt?.slice(0, 10) || "");
    setNextVisible(next.visibleToClient === true);
  }, [sellerMarketing?.sellerNextStep]);

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
  const marketingFeed = allMarketingFeed.slice(0, feedLimit);

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
      Alert.alert("Promocja", res.message);
      return false;
    }
    onRefresh();
    return true;
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
        PROMOCJA I DYSTRYBUCJA
      </Text>
      <Text
        style={{
          color: colors.secondary,
          fontSize: 12,
          marginTop: 4,
          lineHeight: 18,
        }}
      >
        Rejestruj publikacje zewnętrzne, podbijaj EstateOS i wybieraj, co klient
        widzi w panelu.
      </Text>
      <View style={styles.metricsRow}>
        <View style={[styles.metric, { backgroundColor: colors.input }]}>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {sellerMarketing?.activeChannels.length || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            kanały
          </Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.input }]}>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {allMarketingFeed.filter((item) => item.visibleToClient).length}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            dla klienta
          </Text>
        </View>
        <View style={[styles.metric, { backgroundColor: colors.input }]}>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {sellerMarketing?.pendingDecisions.length || 0}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.secondary }]}>
            decyzje
          </Text>
        </View>
      </View>

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
        onPress={() =>
          setOpenSection((current) =>
            current === "external" ? null : "external",
          )
        }
        style={[styles.sectionToggle, { borderColor: colors.border }]}
      >
        <Ionicons name="globe-outline" size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Dodaj publikację zewnętrzną
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            Link, termin i potwierdzenie
          </Text>
        </View>
        <Ionicons
          name={openSection === "external" ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSection === "external" ? (
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
            placeholder="https://www.otodom.pl/pl/oferta/..."
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

      {(sellerMarketing?.activeChannels?.length || 0) > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
            AKTYWNE KANAŁY
          </Text>
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
                    { backgroundColor: `${colors.accent}20` },
                  ]}
                >
                  <Ionicons
                    name="megaphone-outline"
                    size={17}
                    color={colors.accent}
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
        </View>
      ) : null}

      <Pressable
        onPress={() =>
          setOpenSection((current) => (current === "plan" ? null : "plan"))
        }
        style={[styles.sectionToggle, { borderColor: colors.border }]}
      >
        <Ionicons name="navigate-outline" size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Plan: teraz / dalej
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            {sellerMarketing?.sellerNextStep?.nextAction ||
              "Ustal następny krok dla klienta"}
          </Text>
        </View>
        <Ionicons
          name={openSection === "plan" ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSection === "plan" ? (
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
        onPress={() =>
          setOpenSection((current) =>
            current === "decision" ? null : "decision",
          )
        }
        style={[styles.sectionToggle, { borderColor: colors.border }]}
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
          name={openSection === "decision" ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.secondary}
        />
      </Pressable>
      {openSection === "decision" ? (
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
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
            OCZEKUJĄCE ODPOWIEDZI
          </Text>
          {sellerMarketing?.pendingDecisions.map((decision) => (
            <View
              key={decision.id}
              style={[styles.pendingRow, { borderColor: colors.border }]}
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

      {marketingFeed.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
            OSTATNIE DZIAŁANIA
          </Text>
          {marketingFeed.map((item) => (
            <View
              key={item.id}
              style={[styles.feedRow, { borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {item.title || item.kind}
                </Text>
                {item.body ? (
                  <Text
                    style={{
                      color: colors.secondary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                ) : null}
                {typeof item.metadata?.portal === "string" ||
                typeof item.metadata?.siteName === "string" ? (
                  <Text
                    style={{
                      color: colors.secondary,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {String(
                      item.metadata?.portal || item.metadata?.siteName || "",
                    )}
                    {typeof item.metadata?.renewalDueAt === "string"
                      ? ` · odnowienie ${formatDateLabel(item.metadata.renewalDueAt)}`
                      : ""}
                  </Text>
                ) : null}
                <Text
                  style={{
                    color: colors.secondary,
                    fontSize: 10,
                    marginTop: 4,
                  }}
                >
                  {formatDateLabel(item.createdAt)} ·{" "}
                  {item.visibleToClient ? "widoczne" : "tylko agent"}
                </Text>
              </View>
              <Switch
                value={Boolean(item.visibleToClient)}
                disabled={Boolean(busy)}
                onValueChange={(value) => void toggleVisibility(item.id, value)}
              />
            </View>
          ))}
          {allMarketingFeed.length > marketingFeed.length ? (
            <Pressable
              onPress={() => setFeedLimit((current) => current + 20)}
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.accent, fontWeight: "800" }}>
                Pokaż starsze działania
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AcquisitionDatePickerModal
        visible={datePicker !== null}
        initialValue={
          datePicker === "published"
            ? publishedDate
            : datePicker === "renewal"
              ? renewalDate
              : datePicker === "next"
                ? nextDueAt
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
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
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
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
