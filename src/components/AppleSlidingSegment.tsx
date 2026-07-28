import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  isDark: boolean;
  /** Gradient shown for active option. */
  activeGradient?: string[];
  containerStyle?: object;
  compact?: boolean;
};

/**
 * Reusable iOS-like sliding segment control with one animated capsule.
 * Keeps transitions smooth and visually consistent across screens.
 */
export default function AppleSlidingSegment<T extends string>({
  value,
  options,
  onChange,
  isDark,
  activeGradient = ['#FFB44A', '#FF9F0A', '#F59E0B'],
  containerStyle,
  compact = false,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = width > 0 ? width / Math.max(1, options.length) : 0;

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.parallel([
      Animated.spring(x, {
        toValue: index * segmentWidth,
        damping: 18,
        stiffness: 220,
        mass: 0.75,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [glow, index, segmentWidth, x]);

  const hostBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.045)';
  const hostBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const inactiveText = isDark ? 'rgba(235,235,245,0.72)' : '#6B7280';

  const glowStyle = useMemo(
    () => ({
      opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
      transform: [{ translateX: x }],
    }),
    [glow, x],
  );

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.wrap, compact && styles.wrapCompact, { backgroundColor: hostBg, borderColor: hostBorder }, containerStyle]}
    >
      {segmentWidth > 0 ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              compact && styles.glowCompact,
              glowStyle,
              { width: segmentWidth - 8 },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeCapsule,
              compact && styles.activeCapsuleCompact,
              { width: segmentWidth - 8, transform: [{ translateX: x }] },
            ]}
          >
            <LinearGradient colors={activeGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          </Animated.View>
        </>
      ) : null}

      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[styles.item, compact && styles.itemCompact]}
          >
            <Text style={[styles.label, compact && styles.labelCompact, { color: active ? '#FFFFFF' : inactiveText }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  wrapCompact: {
    borderRadius: 14,
    padding: 3,
  },
  activeCapsule: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeCapsuleCompact: {
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 10,
  },
  glow: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: '#FF9F0A',
  },
  glowCompact: {
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 10,
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    zIndex: 2,
  },
  itemCompact: {
    minHeight: 40,
    borderRadius: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  labelCompact: {
    fontSize: 14,
  },
});

