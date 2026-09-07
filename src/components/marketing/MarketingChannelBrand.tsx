import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { MarketingChannelId } from "../../lib/marketingChannel";
import { promotionGroupLabel } from "../../lib/marketingChannel";

const MARK_COLORS: Record<MarketingChannelId, { bg: string; fg: string }> = {
  facebook: { bg: "#1877F2", fg: "#FFFFFF" },
  olx: { bg: "#23E5DB", fg: "#002F34" },
  otodom: { bg: "#00A651", fg: "#FFFFFF" },
  estateos: { bg: "#FDE68A", fg: "#7A5910" },
  gratka: { bg: "#E85D04", fg: "#FFFFFF" },
  morizon: { bg: "#1D4ED8", fg: "#FFFFFF" },
  portal: { bg: "#0F766E", fg: "#FFFFFF" },
  system: { bg: "#64748B", fg: "#FFFFFF" },
};

function ChannelGlyph({ id, color }: { id: MarketingChannelId; color: string }) {
  if (id === "facebook") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M13.5 21v-7.2h2.4l.36-2.76H13.5V9.3c0-.8.22-1.34 1.38-1.34h1.48V5.5c-.26-.03-1.14-.11-2.16-.11-2.14 0-3.6 1.3-3.6 3.7v2.05H8.1v2.76h2.5V21h2.9Z"
        />
      </Svg>
    );
  }
  if (id === "olx") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="7.2" fill="none" stroke={color} strokeWidth="2.4" />
        <Circle cx="12" cy="12" r="2.4" fill={color} />
      </Svg>
    );
  }
  if (id === "otodom") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path fill={color} d="M4.5 11.2 12 4.8l7.5 6.4v8.4H14.2v-4.6h-4.4v4.6H4.5V11.2Z" />
      </Svg>
    );
  }
  if (id === "estateos") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path fill={color} d="M12 3.4 14.2 9h6.2l-5 3.7 1.9 5.9L12 15.7 6.7 18.6 8.6 12.7 3.6 9h6.2L12 3.4Z" />
      </Svg>
    );
  }
  if (id === "gratka") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path fill={color} d="M8.2 6.2h7.1v2.4H11v2.2h3.6v2.3H11V18H8.2V6.2Z" />
      </Svg>
    );
  }
  if (id === "morizon") {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path fill={color} d="M5.4 17.8V6.2h2.6l4 6.6 4-6.6h2.6v11.6h-2.6V10.4l-4 6.4-4-6.4v7.4H5.4Z" />
      </Svg>
    );
  }
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6Zm0 1.8c1.3 0 2.5.7 3.4 1.8H8.6A5.8 5.8 0 0 1 12 6Zm-5.7 5.2h11.4A6 6 0 0 1 12 16.2 6 6 0 0 1 6.3 11.2Z"
      />
    </Svg>
  );
}

export default function MarketingChannelBrand({
  id,
  label,
}: {
  id: MarketingChannelId;
  label?: string;
}) {
  const groupId = id === "system" ? "portal" : id;
  const tone = MARK_COLORS[groupId];
  const word = label || promotionGroupLabel(groupId);
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: tone.bg }]}>
        <ChannelGlyph id={groupId} color={tone.fg} />
      </View>
      <Text style={[styles.word, { color: tone.bg === "#FDE68A" ? "#7A5910" : tone.bg }]} numberOfLines={1}>
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});
