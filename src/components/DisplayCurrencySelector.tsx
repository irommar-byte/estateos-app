import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useI18n } from '../i18n';
import type { DisplayCurrencyPreference } from '../money/types';

type Option = {
  value: DisplayCurrencyPreference;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  labelKey: 'profile.currency.short.PLN' | 'profile.currency.short.EUR' | 'profile.currency.short.LISTING';
};

const OPTIONS: Option[] = [
  { value: 'PLN', icon: 'cash', accent: '#34C759', labelKey: 'profile.currency.short.PLN' },
  { value: 'EUR', icon: 'logo-euro', accent: '#007AFF', labelKey: 'profile.currency.short.EUR' },
  { value: 'LISTING', icon: 'pricetag', accent: '#5856D6', labelKey: 'profile.currency.short.LISTING' },
];

type Props = {
  value: DisplayCurrencyPreference;
  onChange: (next: DisplayCurrencyPreference) => void;
  isDark?: boolean;
};

export default function DisplayCurrencySelector({ value, onChange, isDark }: Props) {
  const { t } = useI18n();
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth = containerWidth > 0 ? (containerWidth - 8) / 3 : 0;
  const translateX = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.85)).current;
  const activeIndex = OPTIONS.findIndex((o) => o.value === value);
  const activeOption = OPTIONS[Math.max(0, activeIndex)] ?? OPTIONS[0];

  useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: Math.max(0, activeIndex) * segmentWidth,
        useNativeDriver: false,
        bounciness: 10,
        speed: 16,
      }),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.72,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [value, activeIndex, segmentWidth, translateX, glowOpacity]);

  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const thumbBg = isDark ? '#3A3A3C' : '#FFFFFF';

  return (
    <View
      style={[styles.track, { backgroundColor: trackBg }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {segmentWidth > 0 ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowHalo,
              {
                width: segmentWidth + 8,
                transform: [{ translateX }],
              },
            ]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.glowHaloFill,
                {
                  opacity: glowOpacity,
                  backgroundColor: `${activeOption.accent}22`,
                  shadowColor: activeOption.accent,
                },
              ]}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumbShell,
              {
                width: segmentWidth,
                transform: [{ translateX }],
              },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)']
                  : ['#FFFFFF', '#F8F8FA']
              }
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[
                styles.thumb,
                {
                  backgroundColor: thumbBg,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                  shadowColor: activeOption.accent,
                },
              ]}
            />
          </Animated.View>
        </>
      ) : null}

      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`profile.currency.labels.${opt.value}`)}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={styles.segment}
          >
            <View
              style={[
                styles.iconBubble,
                {
                  backgroundColor: active ? `${opt.accent}22` : 'transparent',
                  transform: [{ scale: active ? 1.05 : 1 }],
                },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={active ? opt.accent : isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93'}
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : isDark
                      ? 'rgba(235,235,245,0.5)'
                      : '#8E8E93',
                  fontWeight: active ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {t(opt.labelKey)}
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
    minHeight: 56,
    borderRadius: 14,
    flexDirection: 'row',
    position: 'relative',
    padding: 4,
    overflow: 'hidden',
  },
  glowHalo: {
    position: 'absolute',
    top: 2,
    left: 4,
    height: 52,
  },
  glowHaloFill: {
    borderRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 4,
  },
  thumbShell: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: 48,
    zIndex: 0,
  },
  thumb: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  segment: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    letterSpacing: -0.2,
  },
});
