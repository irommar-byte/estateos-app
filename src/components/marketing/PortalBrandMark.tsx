import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { MarketingChannelId } from "../../lib/marketingChannel";

export const PORTAL_BRAND_COLORS: Record<
  MarketingChannelId,
  { bg: string; fg: string; border: string }
> = {
  facebook: { bg: "#1877F2", fg: "#FFFFFF", border: "rgba(24,119,242,0.35)" },
  olx: { bg: "#002F34", fg: "#23E5DB", border: "rgba(35,229,219,0.4)" },
  otodom: { bg: "#00A651", fg: "#FFFFFF", border: "rgba(0,166,81,0.35)" },
  estateos: { bg: "#F5E6B8", fg: "#7A5910", border: "rgba(122,89,16,0.25)" },
  gratka: { bg: "#E85D04", fg: "#FFFFFF", border: "rgba(232,93,4,0.35)" },
  morizon: { bg: "#1D4ED8", fg: "#FFFFFF", border: "rgba(29,78,216,0.35)" },
  portal: { bg: "#0F766E", fg: "#FFFFFF", border: "rgba(15,118,110,0.35)" },
  system: { bg: "#64748B", fg: "#FFFFFF", border: "rgba(100,116,139,0.35)" },
};

const SIZE = { sm: 28, md: 42, lg: 48 } as const;

function BrandGlyph({
  id,
  color,
  size,
}: {
  id: MarketingChannelId;
  color: string;
  size: number;
}) {
  const s = size * 0.58;
  if (id === "facebook") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h2.6L16 12h-3v-2c0-.6.4-1 1-1Z"
        />
      </Svg>
    );
  }
  if (id === "olx") {
    // Stylizowane „O” OLX — teal na navy
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="8.2" fill="none" stroke={color} strokeWidth="2.6" />
        <Circle cx="12" cy="12" r="3.1" fill={color} />
      </Svg>
    );
  }
  if (id === "otodom") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M12 3.2 3.6 10.4v10.2h5.4v-5.6h6v5.6h5.4V10.4L12 3.2Zm0 2.6 6.2 5.2v7.2h-2.2v-5.6H7.9v5.6H5.8v-7.2L12 5.8Z"
        />
      </Svg>
    );
  }
  if (id === "estateos") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M12 2.8 14.4 9h6.6l-5.3 3.9 2 6.3L12 15.8 6.3 19.2l2-6.3L3 9h6.6L12 2.8Z"
        />
      </Svg>
    );
  }
  if (id === "gratka") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path fill={color} d="M7.8 5.5h8.2v2.8h-4.8v2.4h4.2v2.6h-4.2V18.5H7.8V5.5Z" />
      </Svg>
    );
  }
  if (id === "morizon") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M4.8 18.2V5.8h3l4.2 7.2 4.2-7.2h3v12.4h-3V10.6l-4.2 6.8-4.2-6.8v7.6h-3Z"
        />
      </Svg>
    );
  }
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Rect x="4" y="4" width="16" height="16" rx="4" fill={color} opacity={0.2} />
      <Path
        fill={color}
        d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 2c1.2 0 2.3.6 3.1 1.6H8.9A5.2 5.2 0 0 1 12 7Zm-5.1 4.6h10.2A5.4 5.4 0 0 1 12 15.4a5.4 5.4 0 0 1-5.1-3.8Z"
      />
    </Svg>
  );
}

export default function PortalBrandMark({
  id,
  size = "md",
  style,
}: {
  id: MarketingChannelId;
  size?: keyof typeof SIZE | number;
  style?: ViewStyle;
}) {
  const groupId = id === "system" ? "portal" : id;
  const tone = PORTAL_BRAND_COLORS[groupId];
  const px = typeof size === "number" ? size : SIZE[size];
  const radius = Math.round(px * 0.32);

  return (
    <View
      style={[
        styles.tile,
        {
          width: px,
          height: px,
          borderRadius: radius,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          shadowOpacity: 0.12,
          shadowRadius: px > 36 ? 8 : 4,
          shadowOffset: { width: 0, height: 3 },
          elevation: px > 36 ? 4 : 2,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={groupId}
    >
      <BrandGlyph id={groupId} color={tone.fg} size={px} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
  },
});
