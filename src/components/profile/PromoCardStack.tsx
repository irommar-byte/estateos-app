import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';

type Props = {
  cards: ProfilePromoCardRecord[];
  isDark: boolean;
  swipeHint?: string;
};

const SWIPE_OUT = 340;
const SWIPE_THRESHOLD = 88;

function PromoCardFace({
  card,
  isDark,
  elevated,
}: {
  card: ProfilePromoCardRecord;
  isDark: boolean;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderColor: card.borderColor,
          shadowOpacity: elevated ? 0.28 : 0.12,
          marginLeft: elevated ? 4 : 0,
        },
      ]}
    >
      {elevated ? (
        <View style={styles.peelCorner} pointerEvents="none">
          <View style={[styles.peelFold, { backgroundColor: isDark ? '#2C2C2E' : '#E8E8ED' }]} />
        </View>
      ) : null}
      <View style={[styles.icon, { backgroundColor: card.iconBg }]}>
        <Ionicons name={card.iconName as any} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
            {card.title}
          </Text>
          <View
            style={[
              styles.pill,
              { backgroundColor: card.pillBg, borderColor: card.pillBorder },
            ]}
          >
            <Text style={[styles.pillText, { color: card.pillColor }]}>{card.pillLabel}</Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={2}>
          {card.subtitle}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {card.meta}
        </Text>
      </View>
    </View>
  );
}

export default function PromoCardStack({ cards, isDark, swipeHint }: Props) {
  const [topIndex, setTopIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateDeg = useSharedValue(0);
  const peelWiggle = useSharedValue(0);

  const safeCards = cards.length > 0 ? cards : [];
  const topCard = safeCards[topIndex];
  const backCard = safeCards[topIndex + 1];
  const topPeelable = Boolean(topCard?.peelable);
  const topPeelHint = Boolean(topCard?.peelHint);

  useEffect(() => {
    setTopIndex(0);
    translateX.value = 0;
    translateY.value = 0;
    rotateDeg.value = 0;
  }, [cards, translateX, translateY, rotateDeg]);

  useEffect(() => {
    rotateDeg.value = topPeelable ? 1.4 : 0;
  }, [topCard?.id, topPeelable, rotateDeg]);

  useEffect(() => {
    peelWiggle.value = 0;
    if (!topPeelHint) return;
    peelWiggle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 }),
      ),
      -1,
      true,
    );
  }, [topCard?.id, topPeelHint, peelWiggle]);

  const advance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTopIndex((i) => Math.min(i + 1, safeCards.length - 1));
    translateX.value = 0;
    translateY.value = 0;
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(topPeelable && Boolean(backCard))
        .onUpdate((e) => {
          const dx = Math.max(0, e.translationX);
          translateX.value = dx;
          translateY.value = dx * 0.08;
          rotateDeg.value = interpolate(dx, [0, SWIPE_OUT], [topPeelable ? 1.4 : 0, 8], Extrapolation.CLAMP);
        })
        .onEnd((e) => {
          if (e.translationX > SWIPE_THRESHOLD) {
            translateX.value = withTiming(SWIPE_OUT, { duration: 220 });
            translateY.value = withTiming(28, { duration: 220 });
            rotateDeg.value = withTiming(10, { duration: 220 }, () => {
              runOnJS(advance)();
            });
          } else {
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
            translateY.value = withSpring(0);
            rotateDeg.value = withSpring(topPeelable ? 1.4 : 0);
          }
        }),
    [topPeelable, backCard, topCard?.id],
  );

  const frontStyle = useAnimatedStyle(() => {
    const wiggleRot = topPeelHint ? interpolate(peelWiggle.value, [0, 1], [-0.9, 0.9]) : 0;
    const wiggleX = topPeelHint ? interpolate(peelWiggle.value, [0, 1], [-3, 3]) : 0;
    return {
      transform: [
        { translateX: translateX.value + wiggleX },
        { translateY: translateY.value },
        { rotate: `${rotateDeg.value + wiggleRot}deg` },
      ],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const lift = interpolate(translateX.value, [0, SWIPE_OUT], [0, -4], Extrapolation.CLAMP);
    return {
      transform: [
        { scale: 0.97 },
        { translateY: 10 + lift },
        { rotate: '-0.6deg' },
      ],
      opacity: interpolate(translateX.value, [0, 60], [0.92, 1], Extrapolation.CLAMP),
    };
  });

  if (!topCard) return null;

  return (
    <View style={styles.stack}>
      {backCard ? (
        <Animated.View style={[styles.backLayer, backStyle]} pointerEvents="none">
          <PromoCardFace card={backCard} isDark={isDark} />
          <View style={[styles.crease, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
        </Animated.View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.frontLayer, frontStyle]}>
          <PromoCardFace card={topCard} isDark={isDark} elevated={topPeelable} />
        </Animated.View>
      </GestureDetector>

      {backCard && topPeelable && swipeHint ? (
        <Text style={[styles.hint, { color: isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93' }]}>
          {swipeHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    minHeight: 132,
    marginBottom: 4,
  },
  backLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 0,
  },
  frontLayer: {
    zIndex: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  peelCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    overflow: 'hidden',
    borderTopRightRadius: 16,
  },
  peelFold: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 4,
    opacity: 0.9,
  },
  crease: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    height: 1,
    borderRadius: 1,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flex: 1 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { color: '#8E8E93', fontSize: 13, fontWeight: '700', marginTop: 3 },
  meta: { color: '#8E8E93', fontSize: 12, marginTop: 3 },
  hint: {
    marginTop: 8,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
