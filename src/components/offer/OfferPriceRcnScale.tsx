import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  buildOfferPriceRcnScale,
  formatRcnDeltaLabel,
} from '../lib/offerPriceRcnScale';
import { formatPln } from '../services/marketService';

type Props = {
  listingPrice: number;
  recommendedAsk: number;
  isDark: boolean;
  compact?: boolean;
  labels?: {
    below?: string;
    recommended?: string;
    above?: string;
    beyond?: string;
  };
};

export default function OfferPriceRcnScale({
  listingPrice,
  recommendedAsk,
  isDark,
  compact = false,
  labels,
}: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const model = useMemo(
    () => buildOfferPriceRcnScale({ listingPrice, recommendedAsk }),
    [listingPrice, recommendedAsk],
  );
  const marker = useSharedValue(50);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!model.ok) return;
    marker.value = reduceMotion
      ? model.positionPct
      : withTiming(model.positionPct, { duration: 280 });
  }, [marker, model, reduceMotion]);

  const markerStyle = useAnimatedStyle(() => ({
    left: `${marker.value}%`,
  }));

  if (!model.ok) return null;

  const deltaLabel = formatRcnDeltaLabel(model.deltaPln, model.deltaPct);
  const beyond =
    model.clamped && labels?.beyond
      ? ` · ${labels.beyond}`
      : model.clamped
        ? ' · >30%'
        : '';
  const a11y = `Cena ofertowa ${formatPln(model.listingPrice)}. Rekomendacja RCN ${formatPln(
    model.recommendedAsk,
  )}. Odchylenie ${deltaLabel}${beyond}.`;

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        {
          borderColor: isDark ? 'rgba(52,199,89,0.28)' : 'rgba(52,199,89,0.22)',
          backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
        },
      ]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      <View style={styles.topRow}>
        <Text style={[styles.delta, { color: isDark ? '#F5F5F7' : '#111827' }]} numberOfLines={1}>
          {deltaLabel}
          {beyond}
        </Text>
        <Text style={[styles.rec, { color: isDark ? '#86EFAC' : '#15803d' }]} numberOfLines={1}>
          RCN {formatPln(model.recommendedAsk)}
        </Text>
      </View>

      <View style={styles.trackWrap}>
        <LinearGradient
          colors={['#3B82F6', '#34C759', '#F59E0B', '#EF4444']}
          locations={[0, 0.5, 0.78, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.track}
        />
        <View style={styles.centerTick} pointerEvents="none" />
        <Animated.View style={[styles.marker, markerStyle]} pointerEvents="none">
          <View
            style={[
              styles.markerDot,
              {
                borderColor: isDark ? '#0a0a0a' : '#ffffff',
                backgroundColor: isDark ? '#ffffff' : '#111827',
              },
            ]}
          />
          <View
            style={[
              styles.markerArrow,
              { borderTopColor: isDark ? '#ffffff' : '#111827' },
            ]}
          />
        </Animated.View>
      </View>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
          {labels?.below || 'poniżej'}
        </Text>
        <Text style={[styles.legendText, { color: isDark ? '#86EFAC' : '#15803d' }]}>
          {labels?.recommended || 'rekomendowana'}
        </Text>
        <Text style={[styles.legendText, { color: isDark ? '#FCA5A5' : '#B91C1C', textAlign: 'right' }]}>
          {labels?.above || 'powyżej'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  wrapCompact: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  delta: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  rec: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '800',
  },
  trackWrap: {
    height: 18,
    justifyContent: 'center',
  },
  track: {
    height: 8,
    borderRadius: 999,
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  marker: {
    position: 'absolute',
    top: -1,
    marginLeft: -7,
    width: 14,
    alignItems: 'center',
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  markerArrow: {
    width: 0,
    height: 0,
    marginTop: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  legend: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  legendText: {
    flex: 1,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
