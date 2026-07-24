import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import ApplePressable from './ApplePressable';
import { useEcosystemStore, type EcosystemVertical } from '../store/useEcosystemStore';
import { useI18n } from '../i18n';

type Props = {
  isDark: boolean;
  /** Węższy wariant pod top bar. */
  compact?: boolean;
  /**
   * `switch` — Homes|Cars z animacją (tylko Market).
   * `status` — informacyjny badge Radaru (Mapy), bez przełączania.
   */
  mode?: 'switch' | 'status';
};

const PILL_SPRING = { damping: 18, stiffness: 240, mass: 0.7 };

export default function VerticalSegmentRail({
  isDark,
  compact = true,
  mode = 'switch',
}: Props) {
  const { t } = useI18n();
  const activeVertical = useEcosystemStore((s) => s.activeVertical);
  const pendingSwitch = useEcosystemStore((s) => s.pendingSwitch);
  const requestVerticalSwitch = useEcosystemStore((s) => s.requestVerticalSwitch);
  const [trackWidth, setTrackWidth] = useState(0);

  /** Podświetlenie podąża za wyborem (w tym w trakcie animacji przejścia). */
  const highlight: EcosystemVertical = pendingSwitch?.to ?? activeVertical;
  const pillX = useSharedValue(highlight === 'car' ? 1 : 0);

  useEffect(() => {
    pillX.value = withSpring(highlight === 'car' ? 1 : 0, PILL_SPRING);
  }, [highlight, pillX]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const pillW = Math.max(0, (trackWidth - 6) / 2);
  const pillStyle = useAnimatedStyle(() => ({
    width: pillW,
    transform: [{ translateX: pillX.value * pillW }],
    backgroundColor: interpolateColor(
      pillX.value,
      [0, 1],
      ['rgba(16,185,129,0.22)', 'rgba(14,165,233,0.22)'],
    ),
  }));

  const select = (v: EcosystemVertical) => {
    if (mode !== 'switch') return;
    if (highlight === v || pendingSwitch) return;
    requestVerticalSwitch(v);
  };

  if (mode === 'status') {
    const isCar = highlight === 'car';
    const accent = isCar ? '#0EA5E9' : '#10b981';
    const label = isCar
      ? t('radar.home.radarStatusCars')
      : t('radar.home.radarStatusHomes');

    return (
      <View style={[styles.outer, styles.outerStatus, compact && styles.outerStatusCompact]}>
        <BlurView
          intensity={isDark ? 85 : 92}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blur,
            styles.statusBlur,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? 'rgba(28,28,30,0.82)' : 'rgba(255,255,255,0.92)',
            },
          ]}
        >
          <View
            accessibilityRole="text"
            accessibilityLabel={label}
            style={[
              styles.statusRow,
              { backgroundColor: isCar ? 'rgba(14,165,233,0.16)' : 'rgba(16,185,129,0.16)' },
            ]}
          >
            <Ionicons name={isCar ? 'car-sport' : 'home'} size={14} color={accent} />
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.statusLabel, { color: isDark ? '#FFF' : '#111' }]}
            >
              {label}
            </Text>
          </View>
        </BlurView>
      </View>
    );
  }

  return (
    <View style={[styles.outer, compact && styles.outerCompact]}>
      <BlurView
        intensity={isDark ? 85 : 92}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(28,28,30,0.82)' : 'rgba(255,255,255,0.92)',
          },
        ]}
      >
        <View style={styles.row} onLayout={onTrackLayout}>
          {pillW > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}
          <ApplePressable
            accessibilityRole="tab"
            accessibilityState={{ selected: highlight === 'home' }}
            onPress={() => select('home')}
            haptic="none"
            pressScale={0.97}
            style={styles.half}
          >
            <Ionicons
              name={highlight === 'home' ? 'home' : 'home-outline'}
              size={13}
              color={highlight === 'home' ? '#10b981' : '#8E8E93'}
            />
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.label,
                { color: highlight === 'home' ? (isDark ? '#FFF' : '#111') : '#8E8E93' },
              ]}
            >
              Homes
            </Text>
          </ApplePressable>
          <ApplePressable
            accessibilityRole="tab"
            accessibilityState={{ selected: highlight === 'car' }}
            onPress={() => select('car')}
            haptic="none"
            pressScale={0.97}
            style={styles.half}
          >
            <Ionicons
              name={highlight === 'car' ? 'car-sport' : 'car-sport-outline'}
              size={13}
              color={highlight === 'car' ? '#0EA5E9' : '#8E8E93'}
            />
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.label,
                { color: highlight === 'car' ? (isDark ? '#FFF' : '#111') : '#8E8E93' },
              ]}
            >
              Cars
            </Text>
          </ApplePressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    width: '100%',
    minWidth: 148,
    maxWidth: 196,
    flexShrink: 0,
  },
  outerStatus: {
    minWidth: 168,
    maxWidth: 260,
  },
  outerCompact: { maxWidth: 178 },
  outerStatusCompact: { maxWidth: 240 },
  blur: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBlur: {
    borderRadius: 18,
  },
  row: { flexDirection: 'row', padding: 2.5, position: 'relative' },
  pill: {
    position: 'absolute',
    top: 2.5,
    bottom: 2.5,
    left: 2.5,
    borderRadius: 13,
  },
  half: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 13,
    zIndex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.35,
    flexShrink: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
});
