import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProfileCardShell from "../profile/ProfileCardShell";
import { formatCurrencyPLN } from "../../utils/crmFormatters";
import {
  respondPortalDecision,
  type ClientPortalPayload,
} from "../../services/clientPortalService";
import {
  isSafeSellerPortalUrl,
  resolveSellerPortalTimeline,
} from "../../lib/sellerPortalContract";
import { portalStackKind } from "../../lib/portalActivityStacks";
import PortalActivityStacks from "./PortalActivityStacks";
import PortalScheduleCard from "./PortalScheduleCard";
import { parseSellerEventProposal } from "../../lib/sellerEventStage";

type Props = {
  portal: ClientPortalPayload;
  portalToken: string;
  isDark: boolean;
  colors: {
    bg: string;
    card: string;
    text: string;
    secondary: string;
    border: string;
    green: string;
    gold: string;
    tint: string;
  };
  insetsTop: number;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenChat: () => void;
  canChat: boolean;
  canInteract: boolean;
  accountSection: React.ReactNode;
  pushSection: React.ReactNode | null;
  onBack: () => void;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

export default function SellerPortalView({
  portal,
  portalToken,
  isDark,
  colors,
  insetsTop,
  refreshing,
  onRefresh,
  onOpenChat,
  canChat,
  canInteract,
  accountSection,
  pushSection,
  onBack,
}: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>(
    {},
  );

  const listing = portal.listing;
  const progress = portal.listingProgress || [];
  const timeline = resolveSellerPortalTimeline(portal);
  const channels = portal.activeChannels || [];
  const hasPromotionEvents = timeline.some(
    (item) => portalStackKind(item.kind) === "promotions",
  );
  const nextStep = portal.sellerNextStep;
  const decisions = portal.pendingDecisions || [];
  const sellerEvents = portal.sellerEvents || null;
  const confirmedAuction = sellerEvents?.auction?.event || null;
  const confirmedOpenHouse = sellerEvents?.openHouse?.event || null;
  const eventStage = sellerEvents?.stage || null;

  const respond = async (
    decisionId: number,
    response: "approve" | "reject" | "comment",
  ) => {
    if (!canInteract) return;
    setBusyId(decisionId);
    try {
      await respondPortalDecision(portalToken, {
        decisionId,
        response,
        comment: commentDrafts[decisionId],
      });
      setCommentDrafts((current) => {
        const next = { ...current };
        delete next[decisionId];
        return next;
      });
      onRefresh();
    } catch (err: any) {
      Alert.alert(
        "Decyzja",
        err?.message || "Nie udało się zapisać odpowiedzi.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const openSafeLink = async (url: string) => {
    if (!isSafeSellerPortalUrl(url)) {
      Alert.alert("Link", "Ten adres nie może zostać otwarty.");
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Link", "Nie można otworzyć tego adresu na urządzeniu.");
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={[
          styles.header,
          { paddingTop: insetsTop + 6, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.secondary, fontSize: 12, fontWeight: "600" }}
            numberOfLines={1}
          >
            {portal.agencyName || "EstateOS"}
          </Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
            Moja oferta
          </Text>
          <Text
            style={{ color: colors.secondary, fontSize: 13, marginTop: 2 }}
            numberOfLines={1}
          >
            {portal.clientName} · {portal.agentName}
          </Text>
        </View>
        <Pressable
          onPress={canChat ? onOpenChat : undefined}
          disabled={!canChat}
          hitSlop={8}
          style={[styles.headerBtn, !canChat ? { opacity: 0.35 } : null]}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={22}
            color={colors.green}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green}
          />
        }
      >
        {accountSection}
        {pushSection}

        {portal.presentation ? (
          <PortalScheduleCard
            portalToken={portalToken}
            kind="presentation"
            slot={portal.presentation}
            role={portal.type}
            canInteract={canInteract}
            isDark={isDark}
            colors={colors}
            onDone={onRefresh}
          />
        ) : null}

        {portal.meeting ? (
          <PortalScheduleCard
            portalToken={portalToken}
            kind="meeting"
            slot={portal.meeting}
            role={portal.type}
            compact={Boolean(portal.presentation) || portal.acquisition?.status === "SIGNED"}
            canInteract={canInteract}
            isDark={isDark}
            colors={colors}
            onDone={onRefresh}
          />
        ) : null}

        {listing ? (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              STATUS OFERTY
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
              {listing.imageUrl ? (
                <Image
                  source={{ uri: listing.imageUrl }}
                  style={styles.thumb}
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 16,
                  }}
                >
                  {listing.title}
                </Text>
                <Text style={{ color: colors.secondary, marginTop: 4 }}>
                  {[listing.city, listing.district].filter(Boolean).join(" · ")}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    marginTop: 6,
                  }}
                >
                  {formatCurrencyPLN(listing.price)}
                </Text>
                <Text
                  style={{
                    color: colors.green,
                    fontWeight: "700",
                    marginTop: 6,
                    fontSize: 12,
                  }}
                >
                  {listing.statusLabel || listing.status}
                  {listing.featured && listing.promotedUntil
                    ? ` · wyróżnione do ${formatDate(listing.promotedUntil)}`
                    : ""}
                </Text>
              </View>
            </View>
            {progress.length > 0 ? (
              <View style={{ marginTop: 14, gap: 8 }}>
                {progress.map((step) => (
                  <View key={step.id} style={styles.progressRow}>
                    <Ionicons
                      name={step.done ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={step.done ? colors.green : colors.secondary}
                    />
                    <Text
                      style={{
                        color: step.done ? colors.text : colors.secondary,
                        fontSize: 13,
                        flex: 1,
                      }}
                    >
                      {step.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ProfileCardShell>
        ) : (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <View style={styles.emptyState}>
              <View
                style={[styles.emptyIcon, { backgroundColor: colors.tint }]}
              >
                <Ionicons name="home-outline" size={24} color={colors.green} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "800",
                  fontSize: 16,
                  marginTop: 10,
                }}
              >
                Oferta jest w przygotowaniu
              </Text>
              <Text
                style={{
                  color: colors.secondary,
                  textAlign: "center",
                  marginTop: 5,
                  lineHeight: 20,
                }}
              >
                Gdy agent zakończy przygotowanie i opublikuje ogłoszenie, status
                pojawi się tutaj automatycznie.
              </Text>
            </View>
          </ProfileCardShell>
        )}

        {nextStep ? (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              CO TERAZ / CO DALEJ
            </Text>
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              {nextStep.currentStep}
            </Text>
            <Text
              style={{ color: colors.secondary, marginTop: 6, lineHeight: 20 }}
            >
              {nextStep.nextAction}
            </Text>
            {nextStep.clientMessage ? (
              <Text
                style={{
                  color: colors.text,
                  marginTop: 8,
                  fontSize: 13,
                  lineHeight: 20,
                }}
              >
                {nextStep.clientMessage}
              </Text>
            ) : null}
            {nextStep.dueAt ? (
              <Text
                style={{
                  color: colors.gold,
                  fontWeight: "700",
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                Termin: {formatDate(nextStep.dueAt)}
              </Text>
            ) : null}
          </ProfileCardShell>
        ) : null}

        {confirmedAuction || confirmedOpenHouse ? (
          eventStage &&
          eventStage.id !== "pending_approval" &&
          eventStage.id !== "rejected" ? (
            <ProfileCardShell
              isDark={isDark}
              style={{ marginBottom: 12 }}
              faceStyle={{ padding: 16 }}
            >
              <Text
                style={{
                  color: colors.green,
                  fontSize: 10,
                  fontWeight: "900",
                  letterSpacing: 0.6,
                }}
              >
                WYDARZENIE SPRZEDAŻY · {eventStage.label.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 20,
                  marginTop: 6,
                }}
              >
                {confirmedAuction ? "Licytacja" : "Dzień otwarty"}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "800",
                  fontSize: 18,
                  marginTop: 8,
                }}
              >
                {formatDateTime(
                  confirmedAuction?.startsAt || confirmedOpenHouse?.startsAt,
                )}
              </Text>
              {confirmedAuction?.startPrice != null ? (
                <Text style={{ color: colors.secondary, marginTop: 6 }}>
                  Cena startowa: {formatMoney(confirmedAuction.startPrice)}
                </Text>
              ) : null}
            </ProfileCardShell>
          ) : null
        ) : null}

        {decisions.length > 0 ? (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              POTRZEBUJĘ TWOJEJ DECYZJI
            </Text>
            {decisions.map((item) => {
              const proposal = parseSellerEventProposal(item.payload);
              const isEvent =
                item.kind === "open_house" ||
                item.kind === "auction" ||
                Boolean(proposal);
              return (
              <View
                key={item.id}
                style={[
                  styles.decisionCard,
                  {
                    borderColor: isEvent ? "#FF9500" : colors.border,
                    backgroundColor: isEvent ? "#FF950012" : "transparent",
                  },
                ]}
              >
                {isEvent ? (
                  <>
                    <Text
                      style={{
                        color: "#FF9500",
                        fontSize: 10,
                        fontWeight: "900",
                        letterSpacing: 0.5,
                      }}
                    >
                      WYDARZENIE SPRZEDAŻY · DO AKCEPTACJI
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 18,
                        marginTop: 4,
                      }}
                    >
                      {proposal?.kind === "auction" || item.kind === "auction"
                        ? "Licytacja"
                        : "Dzień otwarty"}
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "800",
                        fontSize: 16,
                        marginTop: 8,
                      }}
                    >
                      {formatDateTime(
                        proposal?.startsAt ||
                          proposal?.slots?.[0]?.startsAt ||
                          null,
                      ) || item.title}
                    </Text>
                    {proposal?.kind === "auction" &&
                    proposal.startPrice != null ? (
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          marginTop: 6,
                        }}
                      >
                        Cena startowa: {formatMoney(proposal.startPrice)}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                      fontSize: 15,
                    }}
                  >
                    {item.title}
                  </Text>
                )}
                <Text
                  style={{
                    color: colors.secondary,
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  {item.clientMessage}
                </Text>
                {item.clientResponse ? (
                  <Text
                    style={{ color: colors.text, marginTop: 8, lineHeight: 20 }}
                  >
                    Twój ostatni komentarz: {item.clientResponse}
                  </Text>
                ) : null}
                {item.dueAt ? (
                  <Text
                    style={{
                      color: colors.gold,
                      fontSize: 12,
                      fontWeight: "700",
                      marginTop: 6,
                    }}
                  >
                    Do: {formatDate(item.dueAt)}
                  </Text>
                ) : null}
                <TextInput
                  editable={canInteract && busyId !== item.id}
                  value={commentDrafts[item.id] || ""}
                  onChangeText={(value) =>
                    setCommentDrafts((prev) => ({ ...prev, [item.id]: value }))
                  }
                  placeholder={
                    isEvent
                      ? "Inny termin / inna cena (opcjonalnie)"
                      : "Komentarz (opcjonalnie)"
                  }
                  placeholderTextColor={colors.secondary}
                  style={[
                    styles.commentInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
                <View style={styles.decisionActions}>
                  <Pressable
                    disabled={!canInteract || busyId === item.id}
                    onPress={() => void respond(item.id, "approve")}
                    style={[
                      styles.decisionBtn,
                      {
                        backgroundColor: colors.green,
                        opacity: canInteract ? 1 : 0.45,
                      },
                    ]}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.decisionBtnText}>Akceptuję</Text>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={!canInteract || busyId === item.id}
                    onPress={() => void respond(item.id, "reject")}
                    style={[
                      styles.decisionBtn,
                      {
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: canInteract ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>
                      {isEvent ? "Inny termin" : "Odrzucam"}
                    </Text>
                  </Pressable>
                </View>
                {(commentDrafts[item.id] || "").trim() ? (
                  <Pressable
                    disabled={!canInteract || busyId === item.id}
                    onPress={() => void respond(item.id, "comment")}
                    style={[
                      styles.commentBtn,
                      {
                        borderColor: colors.border,
                        opacity: canInteract ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color={colors.green}
                    />
                    <Text style={{ color: colors.green, fontWeight: "800" }}>
                      Wyślij tylko komentarz
                    </Text>
                  </Pressable>
                ) : null}
                {isEvent ? (
                  <Pressable
                    disabled={!canInteract || busyId === item.id}
                    onPress={() => void respond(item.id, "reject")}
                    style={{ marginTop: 8 }}
                  >
                    <Text
                      style={{
                        color: colors.secondary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Nie teraz
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              );
            })}
          </ProfileCardShell>
        ) : null}

        {channels.length > 0 && !hasPromotionEvents ? (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              AKTYWNE KANAŁY
            </Text>
            {channels.map((channel) => (
              <View
                key={`${channel.activityId}-${channel.portal}`}
                style={[styles.channelRow, { borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {channel.portal}
                  </Text>
                  {channel.renewalDueAt ? (
                    <Text
                      style={{
                        color: colors.secondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      Odnowienie: {formatDate(channel.renewalDueAt)}
                    </Text>
                  ) : null}
                </View>
                {channel.externalUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Otwórz publikację na ${channel.portal}`}
                    onPress={() => void openSafeLink(channel.externalUrl!)}
                  >
                    <Text style={{ color: colors.green, fontWeight: "800" }}>
                      Otwórz
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ProfileCardShell>
        ) : !hasPromotionEvents && timeline.length === 0 ? (
          <ProfileCardShell
            isDark={isDark}
            style={{ marginBottom: 12 }}
            faceStyle={{ padding: 16 }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: 10,
                fontWeight: "900",
                letterSpacing: 0.6,
              }}
            >
              KANAŁY PUBLIKACJI
            </Text>
            <Text
              style={{ color: colors.secondary, marginTop: 8, lineHeight: 20 }}
            >
              Agent przygotowuje dystrybucję. Gdy udostępni publikację,
              zobaczysz tutaj portal, termin odnowienia i bezpieczny link.
            </Text>
          </ProfileCardShell>
        ) : null}

        <ProfileCardShell
          isDark={isDark}
          style={{ marginBottom: 12 }}
          faceStyle={{ padding: 16 }}
        >
          <Text
            style={{
              color: colors.gold,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 0.6,
            }}
          >
            HISTORIA DZIAŁAŃ
          </Text>
          {timeline.length === 0 ? (
            <Text
              style={{ color: colors.secondary, marginTop: 10, lineHeight: 20 }}
            >
              Agent udostępni tu kolejne kroki promocji — publikacje,
              wyróżnienia, raporty i aktualizacje. Karty można zwijać.
            </Text>
          ) : (
            <PortalActivityStacks
              items={timeline}
              listingImage={listing?.imageUrl}
              activePortals={channels.map((channel) => channel.portal)}
              portalToken={portalToken}
              isDark={isDark}
              colors={colors}
              onOpenUrl={(url) => void openSafeLink(url)}
            />
          )}
        </ProfileCardShell>

        <ProfileCardShell
          isDark={isDark}
          style={{ marginBottom: 12 }}
          faceStyle={{ padding: 16 }}
        >
          <Text
            style={{
              color: colors.gold,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 0.6,
            }}
          >
            TWÓJ AGENT
          </Text>
          <View style={styles.agentRow}>
            {portal.agentPhoto ? (
              <Image
                source={{ uri: portal.agentPhoto }}
                style={styles.agentPhoto}
              />
            ) : (
              <View
                style={[
                  styles.agentPhoto,
                  styles.agentFallback,
                  { backgroundColor: colors.tint },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={22}
                  color={colors.green}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}
              >
                {portal.agentName}
              </Text>
              {portal.agentTitle ? (
                <Text
                  style={{
                    color: colors.secondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {portal.agentTitle}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.contactActions}>
            <Pressable
              disabled={!canChat}
              onPress={canChat ? onOpenChat : undefined}
              style={[
                styles.contactBtn,
                { borderColor: colors.border, opacity: canChat ? 1 : 0.5 },
              ]}
            >
              <Ionicons
                name="chatbubble-outline"
                size={17}
                color={colors.green}
              />
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                Napisz
              </Text>
            </Pressable>
            {portal.agentPhone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${portal.agentPhone}`)}
                style={[styles.contactBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="call-outline" size={17} color={colors.green} />
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  Zadzwoń
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ProfileCardShell>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#ccc" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyState: { alignItems: "center", paddingVertical: 10 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  timelineRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  timelinePreview: {
    width: "100%",
    height: 112,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: "#ccc",
  },
  timelineHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  channelMark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  decisionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    fontSize: 14,
  },
  decisionActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  decisionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  decisionBtnText: { color: "#000", fontWeight: "900" },
  commentBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  agentPhoto: { width: 48, height: 48, borderRadius: 16 },
  agentFallback: { alignItems: "center", justifyContent: "center" },
  contactActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  contactBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
});
