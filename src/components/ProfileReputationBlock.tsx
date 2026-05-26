import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Star, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { buildReviewsDistribution } from '../utils/reviewsDistribution';

type Props = {
  reviews: unknown[];
  reviewsCountLabel: (count: number) => string;
  expandHint?: string;
  isDark?: boolean;
};

function DistributionBar({
  stars,
  percentage,
  count,
  expanded,
  isDark,
}: {
  stars: number;
  percentage: number;
  count: number;
  expanded: boolean;
  isDark?: boolean;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(expanded ? percentage : 0, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, percentage, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.distRow}>
      <Text style={[styles.distStarLabel, isDark && styles.distStarLabelDark]}>{stars}</Text>
      <Star size={10} color="#f59e0b" fill="#f59e0b" />
      <View style={[styles.distTrack, isDark && styles.distTrackDark]}>
        <Animated.View style={[styles.distFill, fillStyle]} />
      </View>
      <Text style={[styles.distCount, isDark && styles.distCountDark]}>{count}</Text>
    </View>
  );
}

export default function ProfileReputationBlock({
  reviews,
  reviewsCountLabel,
  expandHint = 'Pokaż rozkład ocen',
  isDark = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { distribution, totalReviews, averageRating } = useMemo(
    () => buildReviewsDistribution(reviews),
    [reviews],
  );

  const toggle = () => {
    Haptics.selectionAsync();
    setExpanded((v) => !v);
  };

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        styles.box,
        isDark ? styles.boxDark : styles.boxLight,
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={expandHint}
    >
      <View style={styles.summaryRow}>
        <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
        <View style={styles.summaryRight}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                color={s <= Math.round(averageRating) ? '#f59e0b' : isDark ? '#4b5563' : '#d1d5db'}
                fill={s <= Math.round(averageRating) ? '#f59e0b' : 'transparent'}
              />
            ))}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.muted, isDark && styles.mutedDark]}>
              {reviewsCountLabel(totalReviews)}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color="#9ca3af" />
            ) : (
              <ChevronDown size={14} color="#9ca3af" />
            )}
          </View>
        </View>
      </View>

      {expanded ? (
        <View style={styles.distBlock}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <DistributionBar
                key={stars}
                stars={stars}
                percentage={percentage}
                count={count}
                expanded={expanded}
                isDark={isDark}
              />
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  boxDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  boxLight: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderColor: 'rgba(0,0,0,0.08)',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ratingValue: { color: '#f59e0b', fontSize: 36, fontWeight: '900', minWidth: 72 },
  summaryRight: { flex: 1 },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: '#6b7280', fontSize: 13 },
  mutedDark: { color: '#9ca3af' },
  distBlock: { marginTop: 12, gap: 6 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distStarLabel: { width: 12, fontSize: 10, fontWeight: '700', color: '#6b7280' },
  distStarLabelDark: { color: '#9ca3af' },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  distTrackDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  distFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  distCount: { width: 20, textAlign: 'right', fontSize: 10, fontWeight: '700', color: '#6b7280' },
  distCountDark: { color: '#9ca3af' },
});
