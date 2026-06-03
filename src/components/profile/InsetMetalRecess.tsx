import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  isDark: boolean;
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

function recessPalette(isDark: boolean) {
  if (isDark) {
    return {
      floor: ['#171B22', '#1A1F27', '#161A21'] as const,
      floorSheen: ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.02)', 'transparent'] as const,
      topLip: ['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'transparent'] as const,
      leftLip: ['rgba(0,0,0,0.28)', 'transparent'] as const,
      bottomLip: ['transparent', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.08)'] as const,
      rightLip: ['transparent', 'rgba(255,255,255,0.12)'] as const,
      pitAo: ['transparent', 'rgba(0,0,0,0.16)'] as const,
      specularBand: 'rgba(255, 255, 255, 0.16)',
      specularTail: 'rgba(220, 228, 240, 0.04)',
      glossCap: 'rgba(255, 255, 255, 0.1)',
      bevelShadow: 'rgba(0, 0, 0, 0.38)',
      bevelShadowSoft: 'rgba(0, 0, 0, 0.22)',
      bevelHighlight: 'rgba(255, 255, 255, 0.22)',
      bevelHighlightSoft: 'rgba(255, 255, 255, 0.12)',
      pressOverlay: 'rgba(0, 0, 0, 0.1)',
      ridgeShadow: 'rgba(0, 0, 0, 0.16)',
    };
  }

  return {
    floor: ['#8E98A6', '#A3ADB9', '#949EAC'] as const,
    floorSheen: ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.1)', 'transparent'] as const,
    topLip: ['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'transparent'] as const,
    leftLip: ['rgba(0,0,0,0.28)', 'transparent'] as const,
    bottomLip: ['transparent', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.28)'] as const,
    rightLip: ['transparent', 'rgba(255,255,255,0.48)'] as const,
    pitAo: ['transparent', 'rgba(0,0,0,0.16)'] as const,
    specularBand: 'rgba(255, 255, 255, 0.82)',
    specularTail: 'rgba(240, 244, 250, 0.22)',
    glossCap: 'rgba(255, 255, 255, 0.38)',
    bevelShadow: 'rgba(0, 0, 0, 0.38)',
    bevelShadowSoft: 'rgba(0, 0, 0, 0.18)',
    bevelHighlight: 'rgba(255, 255, 255, 0.88)',
    bevelHighlightSoft: 'rgba(255, 255, 255, 0.48)',
    pressOverlay: 'rgba(0, 0, 0, 0.12)',
    ridgeShadow: 'rgba(0, 0, 0, 0.14)',
  };
}

function RecessBody({
  isDark,
  children,
  style,
  contentStyle,
  borderRadius,
  pressed = false,
}: {
  isDark: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius: number;
  pressed?: boolean;
}) {
  const palette = recessPalette(isDark);
  const radiusStyle = { borderRadius };

  return (
    <View style={[styles.recess, radiusStyle, style]}>
      <LinearGradient colors={[...palette.floor]} style={[StyleSheet.absoluteFill, radiusStyle]} />

      <LinearGradient
        colors={[...palette.topLip]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.48 }}
        style={[StyleSheet.absoluteFill, radiusStyle]}
      />

      <LinearGradient
        colors={[...palette.leftLip]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.32, y: 0.5 }}
        style={[StyleSheet.absoluteFill, radiusStyle]}
      />

      <LinearGradient
        colors={[...palette.bottomLip]}
        start={{ x: 0.5, y: 0.62 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, radiusStyle]}
      />

      <LinearGradient
        colors={[...palette.rightLip]}
        start={{ x: 0.74, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, radiusStyle]}
      />

      <LinearGradient
        colors={[...palette.pitAo]}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, radiusStyle, styles.pitAo]}
      />

      <LinearGradient
        colors={[...palette.floorSheen]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.62, y: 0.52 }}
        style={[StyleSheet.absoluteFill, radiusStyle, styles.floorSheen]}
      />

      <LinearGradient
        colors={['transparent', palette.specularBand, palette.specularTail, 'transparent']}
        start={{ x: 0.04, y: 0.68 }}
        end={{ x: 0.96, y: 0.84 }}
        style={[StyleSheet.absoluteFill, radiusStyle, styles.specularBand]}
      />

      <LinearGradient
        colors={['transparent', palette.glossCap]}
        start={{ x: 0.5, y: 0.74 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, radiusStyle, styles.glossCap]}
      />

      <View style={[styles.content, contentStyle]}>{children}</View>

      <View
        style={[
          styles.bevelShadow,
          radiusStyle,
          {
            borderTopColor: palette.bevelShadow,
            borderLeftColor: palette.bevelShadowSoft,
          },
        ]}
      />
      <View
        style={[
          styles.bevelHighlight,
          radiusStyle,
          {
            borderBottomColor: palette.bevelHighlight,
            borderRightColor: palette.bevelHighlightSoft,
          },
        ]}
      />

      {pressed ? (
        <View style={[StyleSheet.absoluteFill, radiusStyle, { backgroundColor: palette.pressOverlay }]} />
      ) : null}

      <View
        style={[
          styles.outerRidge,
          radiusStyle,
          { shadowColor: palette.ridgeShadow },
        ]}
      />
    </View>
  );
}

export default function InsetMetalRecess({
  isDark,
  children,
  onPress,
  disabled = false,
  style,
  contentStyle,
  borderRadius = 14,
}: Props) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
      >
        {({ pressed }) => (
          <RecessBody
            isDark={isDark}
            style={style}
            contentStyle={contentStyle}
            borderRadius={borderRadius}
            pressed={pressed}
          >
            {children}
          </RecessBody>
        )}
      </Pressable>
    );
  }

  return (
    <RecessBody isDark={isDark} style={style} contentStyle={contentStyle} borderRadius={borderRadius}>
      {children}
    </RecessBody>
  );
}

export function InsetMetalIconWell({
  isDark,
  children,
  size = 40,
  borderRadius = 12,
}: {
  isDark: boolean;
  children: React.ReactNode;
  size?: number;
  borderRadius?: number;
}) {
  return (
    <InsetMetalRecess
      isDark={isDark}
      borderRadius={borderRadius}
      style={{ width: size, height: size }}
      contentStyle={styles.iconWellContent}
    >
      {children}
    </InsetMetalRecess>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 14,
  },
  pressablePressed: {
    transform: [{ scale: 0.992 }],
  },
  recess: {
    overflow: 'hidden',
    position: 'relative',
  },
  pitAo: {
    opacity: 0.88,
  },
  floorSheen: {
    opacity: 0.82,
  },
  specularBand: {
    opacity: 0.92,
  },
  glossCap: {
    opacity: 0.78,
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
  bevelShadow: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    zIndex: 3,
    pointerEvents: 'none',
  },
  bevelHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    zIndex: 3,
    pointerEvents: 'none',
  },
  outerRidge: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    pointerEvents: 'none',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 1.5,
    elevation: 1,
  },
  iconWellContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
