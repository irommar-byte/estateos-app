import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type Option<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  accentColor: string;
  isDark?: boolean;
  size?: 'normal' | 'large';
};

export default function AdvancedFilterSegment<T extends string>({
  options,
  value,
  onChange,
  accentColor,
  isDark,
  size = 'normal',
}: Props<T>) {
  const isLarge = size === 'large';
  const [containerWidth, setContainerWidth] = useState(0);
  const count = options.length;
  const segmentWidth = containerWidth > 0 && count > 0 ? (containerWidth - 8) / count : 0;
  const translateX = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.8)).current;
  const activeIndex = Math.max(0, options.findIndex((o) => o.key === value));

  useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: activeIndex * segmentWidth,
        useNativeDriver: false,
        bounciness: isLarge ? 8 : 10,
        speed: 16,
      }),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.7,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [value, activeIndex, segmentWidth, translateX, glowOpacity, isLarge]);

  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const thumbBg = isDark ? '#3A3A3C' : '#FFFFFF';

  return (
    <View
      style={[styles.track, isLarge && styles.trackLarge, { backgroundColor: trackBg }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {segmentWidth > 0 ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              isLarge && styles.glowLarge,
              {
                width: segmentWidth + 6,
                transform: [{ translateX }],
              },
            ]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.glowFill,
                isLarge && styles.glowFillLarge,
                {
                  opacity: glowOpacity,
                  backgroundColor: `${accentColor}20`,
                  shadowColor: accentColor,
                },
              ]}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumbShell,
              isLarge && styles.thumbShellLarge,
              { width: segmentWidth, transform: [{ translateX }] },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']
                  : ['#FFFFFF', '#F7F7FA']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[
                styles.thumb,
                isLarge && styles.thumbLarge,
                {
                  backgroundColor: thumbBg,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  shadowColor: accentColor,
                },
              ]}
            />
          </Animated.View>
        </>
      ) : null}

      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(opt.key);
            }}
            style={[styles.segment, isLarge && styles.segmentLarge]}
          >
            <Text
              style={[
                isLarge ? styles.labelLarge : styles.label,
                {
                  color: active
                    ? accentColor
                    : isDark
                      ? 'rgba(235,235,245,0.5)'
                      : '#8E8E93',
                  fontWeight: active ? '800' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    minHeight: 40,
    borderRadius: 12,
    flexDirection: 'row',
    position: 'relative',
    padding: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  trackLarge: {
    minHeight: 52,
    borderRadius: 14,
    marginBottom: 16,
  },
  glow: {
    position: 'absolute',
    top: 3,
    left: 4,
    height: 34,
  },
  glowLarge: {
    top: 4,
    height: 44,
  },
  glowFill: {
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  glowFillLarge: {
    borderRadius: 11,
  },
  thumbShell: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: 32,
    zIndex: 0,
  },
  thumbShellLarge: {
    height: 44,
  },
  thumb: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbLarge: {
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  segmentLarge: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.15,
  },
  labelLarge: {
    fontSize: 16,
    letterSpacing: -0.25,
  },
});
