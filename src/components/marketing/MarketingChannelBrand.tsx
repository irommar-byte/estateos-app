import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MarketingChannelId } from "../../lib/marketingChannel";
import { promotionGroupLabel } from "../../lib/marketingChannel";
import PortalBrandMark, { PORTAL_BRAND_COLORS } from "./PortalBrandMark";

export default function MarketingChannelBrand({
  id,
  label,
}: {
  id: MarketingChannelId;
  label?: string;
}) {
  const groupId = id === "system" ? "portal" : id;
  const tone = PORTAL_BRAND_COLORS[groupId];
  const word = label || promotionGroupLabel(groupId);
  return (
    <View style={styles.row}>
      <PortalBrandMark id={groupId} size="sm" />
      <Text
        style={[styles.word, { color: tone.bg === "#F5E6B8" ? "#7A5910" : tone.bg }]}
        numberOfLines={1}
      >
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
  word: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});
