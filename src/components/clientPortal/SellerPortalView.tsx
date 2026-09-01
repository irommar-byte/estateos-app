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
  filterVisibleMarketingTimeline,
  isSafeSellerPortalUrl,
} from "../../lib/sellerPortalContract";

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
  const [historyLimit, setHistoryLimit] = useState(20);

  const listing = portal.listing;
  const progress = portal.listingProgress || [];
  const timeline = filterVisibleMarketingTimeline(portal.marketingTimeline);
  const visibleTimeline = timeline.slice(0, historyLimit);
  const channels = portal.activeChannels || [];
  const nextStep = portal.sellerNextStep;
  const decisions = portal.pendingDecisions || [];

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
            {decisions.map((item) => (
              <View
                key={item.id}
                style={[styles.decisionCard, { borderColor: colors.border }]}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 15,
                  }}
                >
                  {item.title}
                </Text>
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
                  placeholder="Komentarz (opcjonalnie)"
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
                      Odrzucam
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
              </View>
            ))}
          </ProfileCardShell>
        ) : null}

        {channels.length > 0 ? (
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
        ) : (
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
        )}

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
              wyróżnienia i aktualizacje.
            </Text>
          ) : (
            visibleTimeline.map((item) => (
              <View
                key={item.id}
                style={[styles.timelineRow, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.secondary, fontSize: 11 }}>
                  {formatDate(item.createdAt)}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {item.title || item.kind}
                </Text>
                {item.body ? (
                  <Text
                    style={{
                      color: colors.secondary,
                      marginTop: 4,
                      lineHeight: 20,
                    }}
                  >
                    {item.body}
                  </Text>
                ) : null}
                {item.externalUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openSafeLink(item.externalUrl!)}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: colors.green, fontWeight: "700" }}>
                      {item.portal || item.siteName || "Zobacz ogłoszenie"}
                    </Text>
                  </Pressable>
                ) : null}
                {item.evidenceUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openSafeLink(item.evidenceUrl!)}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: colors.green, fontWeight: "700" }}>
                      Potwierdzenie: {item.evidenceName || "otwórz plik"}
                    </Text>
                  </Pressable>
                ) : null}
                {item.promotedUntil ? (
                  <Text
                    style={{ color: colors.gold, fontSize: 12, marginTop: 6 }}
                  >
                    Wyróżnienie do {formatDate(item.promotedUntil)}
                  </Text>
                ) : null}
              </View>
            ))
          )}
          {timeline.length > visibleTimeline.length ? (
            <Pressable
              onPress={() => setHistoryLimit((current) => current + 20)}
              style={[styles.loadMoreBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.green, fontWeight: "800" }}>
                Pokaż starsze działania
              </Text>
            </Pressable>
          ) : null}
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
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
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
