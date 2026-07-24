import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../../store/useEcosystemStore';
import { useI18n } from '../../i18n';

/** Krócej niż WWW — na telefonie wolniej męczy; nadal cinematic. */
const GEAR_MS = 720;
const ZOOM_MS = 780;
const EXIT_MS = 220;

const HOME_GRADIENT = ['#0B3D2E', '#10B981', '#064E3B'] as const;
const CAR_GRADIENT = ['#0C4A6E', '#0EA5E9', '#082F49'] as const;

function Gear({
  size,
  duration,
  reverse,
  opacity,
}: {
  size: number;
  duration: number;
  reverse?: boolean;
  opacity: number;
}) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = 0;
    rot.value = withTiming(reverse ? -360 : 360, {
      duration,
      easing: Easing.linear,
    });
    return () => cancelAnimation(rot);
  }, [duration, reverse, rot]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
    opacity,
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="settings-outline" size={size} color="rgba(255,255,255,0.88)" />
    </Animated.View>
  );
}

/**
 * Pełnoekranowe przejście Homes ↔ Cars — jak WWW (zębatki → zoom ikony),
 * dopracowane pod telefon: głębsze gradienty, miękkie krzywe, krótszy rytm.
 */
export default function EcosystemVerticalTransition() {
  const { t } = useI18n();
  const pendingSwitch = useEcosystemStore((s) => s.pendingSwitch);
  const setActiveVertical = useEcosystemStore((s) => s.setActiveVertical);
  const clearVerticalSwitch = useEcosystemStore((s) => s.clearVerticalSwitch);

  const visible = useSharedValue(0);
  const gearsOpacity = useSharedValue(0);
  const gearsY = useSharedValue(10);
  const zoomScale = useSharedValue(0.42);
  const zoomOpacity = useSharedValue(0);
  const veil = useSharedValue(0);

  const to: EcosystemVertical = pendingSwitch?.to ?? 'home';
  const isCar = to === 'car';
  const label = isCar
    ? t('radar.home.verticalSwitchToCar')
    : t('radar.home.verticalSwitchToHome');

  useEffect(() => {
    if (!pendingSwitch) {
      visible.value = 0;
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    visible.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    veil.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    gearsOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    gearsY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    zoomOpacity.value = 0;
    zoomScale.value = 0.42;

    const commit = setTimeout(() => {
      void Haptics.selectionAsync();
      setActiveVertical(pendingSwitch.to);

      gearsOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
      gearsY.value = withTiming(-8, { duration: 180, easing: Easing.in(Easing.quad) });
      zoomOpacity.value = withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withDelay(
          Math.round(ZOOM_MS * 0.42),
          withTiming(0, {
            duration: Math.round(ZOOM_MS * 0.48),
            easing: Easing.in(Easing.cubic),
          }),
        ),
      );
      zoomScale.value = withTiming(38, {
        duration: ZOOM_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
      veil.value = withDelay(
        Math.round(ZOOM_MS * 0.5),
        withTiming(0, { duration: EXIT_MS + 120, easing: Easing.inOut(Easing.quad) }),
      );
      visible.value = withDelay(
        ZOOM_MS,
        withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(clearVerticalSwitch)();
        }),
      );
    }, GEAR_MS);

    return () => clearTimeout(commit);
  }, [
    pendingSwitch,
    setActiveVertical,
    clearVerticalSwitch,
    visible,
    veil,
    gearsOpacity,
    gearsY,
    zoomOpacity,
    zoomScale,
  ]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
  }));

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
  }));

  const gearsStyle = useAnimatedStyle(() => ({
    opacity: gearsOpacity.value,
    transform: [{ translateY: gearsY.value }],
  }));

  const zoomStyle = useAnimatedStyle(() => ({
    opacity: zoomOpacity.value,
    transform: [{ scale: zoomScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(veil.value, [0, 1], [0, 0.55], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(veil.value, [0, 1], [0.92, 1.08], Extrapolation.CLAMP) }],
  }));

  if (!pendingSwitch) return null;

  const gradient = isCar ? CAR_GRADIENT : HOME_GRADIENT;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
        <LinearGradient colors={[...gradient]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.45)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: isCar ? 'rgba(56,189,248,0.35)' : 'rgba(52,211,153,0.32)' },
            glowStyle,
          ]}
        />
      </Animated.View>

      <View style={styles.center}>
        <Animated.View style={[styles.gearsBlock, gearsStyle]}>
          <View style={styles.gearStage}>
            <View style={styles.gearA}>
              <Gear size={54} duration={GEAR_MS} opacity={0.92} />
            </View>
            <View style={styles.gearB}>
              <Gear size={38} duration={Math.round(GEAR_MS * 1.12)} reverse opacity={0.72} />
            </View>
          </View>
          <Text style={styles.brand}>EstateOS™</Text>
          <Text style={styles.label}>{label}</Text>
        </Animated.View>

        <Animated.View style={[styles.zoomWrap, zoomStyle]}>
          <BlurView intensity={28} tint="light" style={styles.iconGlass}>
            <Ionicons
              name={isCar ? 'car-sport' : 'home'}
              size={56}
              color="#FFFFFF"
            />
          </BlurView>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 999,
    elevation: 999,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    alignSelf: 'center',
    top: '32%',
  },
  gearsBlock: {
    alignItems: 'center',
    gap: 18,
  },
  gearStage: {
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearA: {
    position: 'absolute',
    left: 8,
    top: 10,
  },
  gearB: {
    position: 'absolute',
    right: 6,
    bottom: 8,
  },
  brand: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
  label: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.35,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  zoomWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlass: {
    width: 112,
    height: 112,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.42)',
  },
});
