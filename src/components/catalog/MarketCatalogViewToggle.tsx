import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';

export type MarketCatalogContentMode = 'catalog' | 'rails';

type Props = {
  mode: MarketCatalogContentMode;
  onToggle: () => void;
  isDark: boolean;
  lightChrome?: boolean;
  accent?: string;
  accessibilityLabelCatalog?: string;
  accessibilityLabelRails?: string;
};

/**
 * Przycisk w miejscu „typu mapy” na zakładce Market —
 * przełącza katalog ↔ taśmy Market z krótką mikroanimacją ikony.
 */
export default function MarketCatalogViewToggle({
  mode,
  onToggle,
  isDark,
  lightChrome = false,
  accent = '#6366F1',
  accessibilityLabelCatalog = 'Pokaż katalog ofert',
  accessibilityLabelRails = 'Pokaż taśmy Market',
}: Props) {
  const progress = useRef(new Animated.Value(mode === 'rails' ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: mode === 'rails' ? 1 : 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.86,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(pulse, {
          toValue: 1,
          friction: 5,
          tension: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [mode, progress, pulse]);

  const catalogOpacity = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 0, 0],
  });
  const railsOpacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });
  const catalogRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-28deg'],
  });
  const railsRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['28deg', '0deg'],
  });
  const catalogScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.72],
  });
  const railsScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  const active = mode === 'rails';
  const iconColor = active ? accent : isDark ? '#FFF' : '#1C1C1E';

  return (
    <ApplePressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? accessibilityLabelCatalog : accessibilityLabelRails}
      onPress={onToggle}
      haptic="medium"
      pressScale={0.94}
      style={[styles.wrap, lightChrome && styles.wrapLight]}
    >
      <BlurView
        intensity={lightChrome ? 96 : isDark ? 80 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.glass,
          lightChrome && styles.glassLight,
          active && { backgroundColor: `${accent}24`, borderColor: `${accent}55` },
        ]}
      >
        <Animated.View style={[styles.iconStage, { transform: [{ scale: pulse }] }]}>
          {/* Na katalogu: albums = „wejdź w taśmy”. Na taśmach: grid = „wróć do katalogu”. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.iconLayer,
              {
                opacity: catalogOpacity,
                transform: [{ rotate: catalogRotate }, { scale: catalogScale }],
              },
            ]}
          >
            <Ionicons name="albums-outline" size={22} color={iconColor} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.iconLayer,
              {
                opacity: railsOpacity,
                transform: [{ rotate: railsRotate }, { scale: railsScale }],
              },
            ]}
          >
            <Ionicons name="grid" size={21} color={iconColor} />
          </Animated.View>
        </Animated.View>
        {active ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
      </BlurView>
    </ApplePressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  wrapLight: {
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  glass: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  glassLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  iconStage: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
