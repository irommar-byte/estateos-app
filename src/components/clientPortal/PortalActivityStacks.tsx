import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../config/network";
import type { PortalMarketingTimelineItem } from "../../services/clientPortalService";
import {
  facebookClientOpenHref,
  facebookOpenLabel,
  formatPublicationStatus,
  listingThumbnailFallback,
  resolveMarketingChannel,
} from "../../lib/marketingChannel";
import {
  groupPortalPath,
  marketReportPortalHref,
  type PortalStackKind,
} from "../../lib/portalActivityStacks";

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  green: string;
  gold: string;
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

function TimelineEventRow({
  item,
  listingImage,
  isDark,
  colors,
  portalToken,
  onOpenUrl,
}: {
  item: PortalMarketingTimelineItem;
  listingImage?: string | null;
  isDark: boolean;
  colors: Colors;
  portalToken: string;
  onOpenUrl: (url: string) => void;
}) {
  const channel = resolveMarketingChannel({
    kind: item.kind,
    portal: item.portal,
    siteName: item.siteName,
    url: item.externalUrl,
    groupName: item.groupName,
    groupUrl: item.groupUrl,
    title: item.title,
  });
  const accent =
    channel.id === "estateos"
      ? "#C9A227"
      : channel.id === "facebook"
        ? "#1877F2"
        : channel.id === "otodom"
          ? "#00A651"
          : colors.green;
  const status = formatPublicationStatus(item.status);
  const preview = listingThumbnailFallback({
    image: item.image,
    channelId: channel.id,
    listingImage,
  });
  const isReport = item.kind === "MARKET_REPORT_SENT";
  const openHref = isReport
    ? marketReportPortalHref(portalToken, item.id, API_URL)
    : channel.id === "facebook"
      ? facebookClientOpenHref({
          url: item.externalUrl,
          groupUrl: item.groupUrl,
        })
      : item.externalUrl || item.groupUrl || null;
  const openLabel = isReport
    ? "Otwórz raport"
    : channel.id === "facebook"
      ? facebookOpenLabel({
          href: openHref,
          groupName: item.groupName,
        })
      : item.groupName || item.portal || item.siteName || "Zobacz ogłoszenie";

  return (
    <View
      style={[
        styles.timelineRow,
        {
          borderColor: accent,
          backgroundColor:
            channel.id === "estateos"
              ? isDark
                ? "rgba(201,162,39,0.16)"
                : "rgba(253,230,138,0.35)"
              : channel.id === "facebook"
                ? isDark
                  ? "rgba(24,119,242,0.14)"
                  : "rgba(24,119,242,0.08)"
                : colors.card,
        },
      ]}
    >
      <View style={styles.timelineHead}>
        <View style={[styles.channelMark, { backgroundColor: accent }]}>
          <Ionicons
            name={
              isReport
                ? "document-text-outline"
                : channel.id === "estateos"
                  ? "star"
                  : channel.id === "facebook"
                    ? "logo-facebook"
                    : channel.id === "otodom"
                      ? "home"
                      : "globe-outline"
            }
            size={14}
            color={channel.id === "estateos" ? "#1c1408" : "#fff"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: accent,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 0.6,
            }}
          >
            {channel.badge.toUpperCase()}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11 }}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.timelinePreview} />
      ) : null}
      <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>
        {channel.id === "facebook" && item.groupName
          ? `Facebook · ${item.groupName}`
          : item.title || channel.label}
      </Text>
      {item.body ? (
        <Text style={{ color: colors.secondary, marginTop: 4, lineHeight: 20 }}>
          {item.body}
        </Text>
      ) : null}
      {status ? (
        <Text
          style={{
            color: colors.secondary,
            fontSize: 11,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          {status}
        </Text>
      ) : null}
      {openHref ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => onOpenUrl(openHref)}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: accent, fontWeight: "800" }}>{openLabel}</Text>
        </Pressable>
      ) : null}
      {item.evidenceUrl ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => onOpenUrl(item.evidenceUrl!)}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: colors.green, fontWeight: "700" }}>
            Potwierdzenie: {item.evidenceName || "otwórz plik"}
          </Text>
        </Pressable>
      ) : null}
      {item.promotedUntil ? (
        <Text
          style={{
            color: "#C9A227",
            fontSize: 12,
            marginTop: 6,
            fontWeight: "800",
          }}
        >
          Wyróżnienie do {formatDate(item.promotedUntil)}
        </Text>
      ) : null}
    </View>
  );
}

export default function PortalActivityStacks({
  items,
  listingImage,
  activePortals,
  portalToken,
  isDark,
  colors,
  onOpenUrl,
}: {
  items: PortalMarketingTimelineItem[];
  listingImage?: string | null;
  activePortals?: string[];
  portalToken: string;
  isDark: boolean;
  colors: Colors;
  onOpenUrl: (url: string) => void;
}) {
  const stacks = useMemo(
    () => groupPortalPath(items, { activePortals }),
    [items, activePortals],
  );
  const [open, setOpen] = useState<Partial<Record<PortalStackKind, boolean>>>({});

  if (!stacks.length) return null;

  return (
    <View>
      {stacks.map((stack) => {
        const expanded = open[stack.kind] === true;
        const countLabel =
          stack.items.length === 1 ? "1 wpis" : `${stack.items.length} wpisy`;
        const latestReport = stack.kind === "reports" ? stack.items[0] : null;
        return (
          <View
            key={stack.kind}
            style={[
              styles.stack,
              {
                borderColor:
                  stack.kind === "reports"
                    ? "rgba(15,118,110,0.35)"
                    : stack.kind === "promotions"
                      ? "rgba(201,162,39,0.4)"
                      : colors.border,
                backgroundColor: isDark
                  ? "rgba(28,24,18,0.55)"
                  : "rgba(250,247,240,0.9)",
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setOpen((current) => ({ ...current, [stack.kind]: !expanded }))
              }
              style={styles.stackToggle}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.gold,
                    fontSize: 10,
                    fontWeight: "900",
                    letterSpacing: 0.7,
                  }}
                >
                  {stack.kicker.toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {stack.label}
                </Text>
                <Text
                  style={{
                    color: colors.secondary,
                    marginTop: 8,
                    lineHeight: 20,
                    fontSize: 13,
                  }}
                >
                  {stack.summary}
                </Text>
                <Text
                  style={{
                    color: colors.gold,
                    fontSize: 11,
                    fontWeight: "800",
                    marginTop: 8,
                  }}
                >
                  {countLabel}
                  {stack.latestAt ? ` · ost. ${formatDate(stack.latestAt)}` : ""}
                </Text>
              </View>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.gold}
              />
            </Pressable>
            {latestReport ? (
              <Pressable
                onPress={() =>
                  onOpenUrl(
                    marketReportPortalHref(portalToken, latestReport.id, API_URL),
                  )
                }
                style={{ paddingHorizontal: 14, paddingBottom: 12 }}
              >
                <Text style={{ color: colors.green, fontWeight: "800" }}>
                  {stack.items.length === 1
                    ? "Otwórz raport"
                    : "Otwórz ostatni raport"}
                </Text>
              </Pressable>
            ) : null}
            {expanded
              ? stack.items.map((row) => {
                  const full = items.find((item) => item.id === row.id);
                  if (!full) return null;
                  return (
                    <TimelineEventRow
                      key={row.id}
                      item={full}
                      listingImage={listingImage}
                      isDark={isDark}
                      colors={colors}
                      portalToken={portalToken}
                      onOpenUrl={onOpenUrl}
                    />
                  );
                })
              : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 12,
    overflow: "hidden",
  },
  stackToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
  },
  timelineRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 10,
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
});
