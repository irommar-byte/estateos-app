import React, { useEffect, useMemo } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../i18n';
import { useFeaturedCelebrationStore } from '../../store/useFeaturedCelebrationStore';

const STAR_COUNT = 34;
const HOLD_MS = 2600;
const FADE_OUT_MS = 520;
const HERO_STAR = 72;
const RING = 140;

type BurstStar = {
  id: number;
  angle: number;
  distance: number;
  size: number;
  spin: number;
  opacity: number;
  delayFrac: number;
};

function BurstParticle({
  star,
  progress,
  cx,
  cy,
}: {
  star: BurstStar;
  progress: SharedValue<number>;
  cx: number;
  cy: number;
}) {
  const style = useAnimatedStyle(() => {
    const raw = progress.value;
    const local = Math.max(0, Math.min(1, (raw - star.delayFrac) / (1 - star.delayFrac || 1)));
    const travel = star.distance * local;
    const rad = (star.angle * Math.PI) / 180;
    const x = Math.cos(rad) * travel;
    const y = Math.sin(rad) * travel - 28 * local;
    const scale = interpolate(local, [0, 0.14, 0.62, 1], [0.08, 1.35, 1.05, 0.22]);
    const opacity = interpolate(local, [0, 0.08, 0.7, 1], [0, star.opacity, star.opacity, 0]);
    const rotate = `${star.spin * local}deg`;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }, { rotate }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.starAbs,
        { left: cx - star.size / 2, top: cy - star.size / 2, width: star.size, height: star.size },
        style,
      ]}
    >
      <Star size={star.size} color="#000000" fill="#000000" strokeWidth={0} />
    </Animated.View>
  );
}

/**
 * Full-screen yellow celebration: hero star + expanding ring impact → star burst → „7 dni”.
 */
export default function FeaturedCelebrationOverlay() {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const visible = useFeaturedCelebrationStore((s) => s.visible);
  const playToken = useFeaturedCelebrationStore((s) => s.playToken);
  const dismiss = useFeaturedCelebrationStore((s) => s.dismiss);

  const wash = useSharedValue(0);
  const hero = useSharedValue(0);
  const impact = useSharedValue(0);
  const ring = useSharedValue(0);
  const burst = useSharedValue(0);
  const days = useSharedValue(0);
  const title = useSharedValue(0);
  const exit = useSharedValue(0);

  const stars = useMemo<BurstStar[]>(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => {
        const golden = i * 137.508;
        return {
          id: i,
          angle: golden % 360,
          distance: 110 + (i % 8) * 42 + (i % 4) * 22,
          size: 11 + (i % 6) * 4,
          spin: (i % 2 === 0 ? 1 : -1) * (160 + (i % 7) * 48),
          opacity: 0.62 + (i % 4) * 0.1,
          delayFrac: (i % 9) * 0.018,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!visible) return;

    wash.value = 0;
    hero.value = 0;
    impact.value = 0;
    ring.value = 0;
    burst.value = 0;
    days.value = 0;
    title.value = 0;
    exit.value = 0;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    wash.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });

    // Hero star drops in / grows, then punches with the ring.
    hero.value = withSequence(
      withTiming(1.18, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(0.92, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );

    ring.value = withSequence(
      withDelay(180, withTiming(0.55, { duration: 220, easing: Easing.out(Easing.cubic) })),
      withTiming(1.15, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(2.7, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );

    impact.value = withDelay(
      340,
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }),
      ),
    );

    const impactHaptic = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 340);
    const burstHaptic = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 420);

    burst.value = withDelay(380, withTiming(1, { duration: 1450, easing: Easing.out(Easing.cubic) }));
    title.value = withDelay(520, withSpring(1, { damping: 12, stiffness: 160, mass: 0.7 }));
    days.value = withDelay(680, withSpring(1, { damping: 11, stiffness: 150, mass: 0.75 }));

    const closeTimer = setTimeout(() => {
      exit.value = withTiming(
        1,
        { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(dismiss)();
        },
      );
    }, HOLD_MS);

    return () => {
      clearTimeout(impactHaptic);
      clearTimeout(burstHaptic);
      clearTimeout(closeTimer);
    };
  }, [visible, playToken, dismiss, wash, hero, impact, ring, burst, days, title, exit]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0]),
  }));

  const washStyle = useAnimatedStyle(() => ({
    opacity: wash.value,
    transform: [{ scale: interpolate(wash.value, [0, 1], [1.18, 1]) }],
  }));

  const heroStyle = useAnimatedStyle(() => {
    const punch = interpolate(impact.value, [0, 1], [1, 1.28]);
    return {
      opacity: interpolate(hero.value, [0, 0.2, 1], [0, 1, 1]),
      transform: [{ scale: hero.value * punch }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.45, 1.1, 2.7], [0, 0.7, 0.35, 0]),
    transform: [{ scale: Math.max(0.01, ring.value) }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(impact.value, [0, 1], [0, 0.55]),
    transform: [{ scale: interpolate(impact.value, [0, 1], [0.6, 1.8]) }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [
      { scale: interpolate(title.value, [0, 1], [0.78, 1]) },
      { translateY: interpolate(title.value, [0, 1], [18, 0]) },
    ],
  }));

  const daysStyle = useAnimatedStyle(() => ({
    opacity: days.value,
    transform: [
      { scale: interpolate(days.value, [0, 1], [0.55, 1]) },
      { translateY: interpolate(days.value, [0, 1], [36, 0]) },
    ],
  }));

  const cx = width / 2;
  const cy = height * 0.38;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.root, rootStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, washStyle]}>
          <LinearGradient
            colors={['#FFF7D1', '#FBBF24', '#F59E0B', '#D97706']}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: cx - RING / 2,
              top: cy - RING / 2,
              width: RING,
              height: RING,
              borderRadius: RING / 2,
            },
            ringStyle,
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              left: cx - 48,
              top: cy - 48,
              width: 96,
              height: 96,
              borderRadius: 48,
            },
            flashStyle,
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.heroStar,
            {
              left: cx - HERO_STAR / 2,
              top: cy - HERO_STAR / 2,
              width: HERO_STAR,
              height: HERO_STAR,
            },
            heroStyle,
          ]}
        >
          <Star size={HERO_STAR} color="#000000" fill="#000000" strokeWidth={0} />
        </Animated.View>

        {stars.map((star) => (
          <BurstParticle key={`${playToken}-${star.id}`} star={star} progress={burst} cx={cx} cy={cy} />
        ))}

        <Animated.View style={[styles.titleWrap, { top: cy + HERO_STAR * 0.72 }, titleStyle]}>
          <Text style={styles.title}>{t('offer.detail.views.featuredCelebrationTitle')}</Text>
        </Animated.View>

        <Animated.View style={[styles.daysWrap, { bottom: Math.max(56, height * 0.12) }, daysStyle]}>
          <Text style={styles.daysText}>{t('offer.detail.views.featuredCelebrationDays')}</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FBBF24',
  },
  starAbs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: 'rgba(0,0,0,0.32)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  flash: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  heroStar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  title: {
    color: '#000000',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  daysWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  daysText: {
    color: '#000000',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -1.4,
    textAlign: 'center',
  },
});
