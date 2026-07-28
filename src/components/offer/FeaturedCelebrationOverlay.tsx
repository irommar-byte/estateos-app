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

const STAR_COUNT = 28;
const HOLD_MS = 2300;
const FADE_OUT_MS = 520;

type BurstStar = {
  id: number;
  angle: number;
  distance: number;
  size: number;
  spin: number;
  opacity: number;
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
    const p = progress.value;
    const travel = star.distance * p;
    const rad = (star.angle * Math.PI) / 180;
    const x = Math.cos(rad) * travel;
    const y = Math.sin(rad) * travel - 22 * p;
    const scale = interpolate(p, [0, 0.16, 0.68, 1], [0.12, 1.28, 1.02, 0.28]);
    const opacity = interpolate(p, [0, 0.1, 0.72, 1], [0, star.opacity, star.opacity, 0]);
    const rotate = `${star.spin * p}deg`;
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
 * Full-screen yellow celebration when any listing is successfully featured.
 */
export default function FeaturedCelebrationOverlay() {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const visible = useFeaturedCelebrationStore((s) => s.visible);
  const playToken = useFeaturedCelebrationStore((s) => s.playToken);
  const dismiss = useFeaturedCelebrationStore((s) => s.dismiss);

  const progress = useSharedValue(0);
  const wash = useSharedValue(0);
  const title = useSharedValue(0);
  const ring = useSharedValue(0);
  const exit = useSharedValue(0);

  const stars = useMemo<BurstStar[]>(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => {
        const golden = i * 137.508;
        return {
          id: i,
          angle: golden % 360,
          distance: 96 + (i % 7) * 40 + (i % 3) * 18,
          size: 10 + (i % 5) * 4,
          spin: (i % 2 === 0 ? 1 : -1) * (140 + (i % 6) * 42),
          opacity: 0.58 + (i % 4) * 0.1,
        };
      }),
    [],
  );

  useEffect(() => {
    if (!visible) return;

    progress.value = 0;
    wash.value = 0;
    title.value = 0;
    ring.value = 0;
    exit.value = 0;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const hapticBurst = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 120);
    const hapticTail = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 380);

    wash.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    ring.value = withSequence(
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
      withTiming(0.3, { duration: 980, easing: Easing.inOut(Easing.quad) }),
    );
    progress.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    title.value = withDelay(160, withSpring(1, { damping: 11, stiffness: 170, mass: 0.68 }));

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
      clearTimeout(hapticBurst);
      clearTimeout(hapticTail);
      clearTimeout(closeTimer);
    };
  }, [visible, playToken, dismiss, progress, wash, title, ring, exit]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0]),
  }));

  const washStyle = useAnimatedStyle(() => ({
    opacity: wash.value,
    transform: [{ scale: interpolate(wash.value, [0, 1], [1.2, 1]) }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [
      { scale: interpolate(title.value, [0, 1], [0.7, 1]) },
      { translateY: interpolate(title.value, [0, 1], [30, 0]) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.28, 1], [0, 0.58, 0.1]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.32, 2.55]) }],
  }));

  const cx = width / 2;
  const cy = height * 0.42;

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
              left: cx - 70,
              top: cy - 70,
              width: 140,
              height: 140,
              borderRadius: 70,
            },
            ringStyle,
          ]}
        />

        {stars.map((star) => (
          <BurstParticle key={`${playToken}-${star.id}`} star={star} progress={progress} cx={cx} cy={cy} />
        ))}

        <Animated.View style={[styles.titleWrap, { top: cy + 28 }, titleStyle]}>
          <View style={styles.titleBadge}>
            <Star size={18} color="#000" fill="#000" strokeWidth={0} />
            <Star size={26} color="#000" fill="#000" strokeWidth={0} />
            <Star size={18} color="#000" fill="#000" strokeWidth={0} />
          </View>
          <Text style={styles.title}>{t('offer.detail.views.featuredCelebrationTitle')}</Text>
          <Text style={styles.subtitle}>{t('offer.detail.views.featuredCelebrationSubtitle')}</Text>
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
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.28)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  titleWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: '#000000',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(0,0,0,0.62)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
