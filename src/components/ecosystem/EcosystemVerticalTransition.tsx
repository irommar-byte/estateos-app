import React, { useEffect, useMemo } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../../store/useEcosystemStore';
import { useI18n } from '../../i18n';

const { width: W, height: H } = Dimensions.get('window');

/** Rytm: intro → crest → bloom → dissolve. Bez skalowania bitmapy. */
const INTRO_MS = 380;
const HOLD_MS = 720;
const BLOOM_MS = 780;
const EXIT_MS = 420;
const TOTAL_MS = INTRO_MS + HOLD_MS + BLOOM_MS + EXIT_MS;

type Theme = {
  deep: string;
  mid: string;
  glow: string;
  rim: string;
  accent: string;
  metal: [string, string, string];
};

const HOME_THEME: Theme = {
  deep: '#031A14',
  mid: '#0A3D2E',
  glow: 'rgba(52,211,153,0.55)',
  rim: 'rgba(167,243,208,0.55)',
  accent: '#34D399',
  metal: ['rgba(255,255,255,0.00)', 'rgba(236,253,245,0.55)', 'rgba(255,255,255,0.00)'],
};

const CAR_THEME: Theme = {
  deep: '#020B16',
  mid: '#0B2F4A',
  glow: 'rgba(56,189,248,0.52)',
  rim: 'rgba(186,230,253,0.55)',
  accent: '#38BDF8',
  metal: ['rgba(255,255,255,0.00)', 'rgba(240,249,255,0.55)', 'rgba(255,255,255,0.00)'],
};

function OrbitRing({
  size,
  duration,
  reverse,
  color,
  thickness = StyleSheet.hairlineWidth * 2,
  dash = false,
}: {
  size: number;
  duration: number;
  reverse?: boolean;
  color: string;
  thickness?: number;
  dash?: boolean;
}) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = 0;
    rot.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
  }, [duration, reverse, rot]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: color,
          borderStyle: dash ? 'dashed' : 'solid',
        },
        style,
      ]}
    />
  );
}

function SpecularSweep({ colors }: { colors: Theme['metal'] }) {
  const x = useSharedValue(-W * 0.6);

  useEffect(() => {
    x.value = -W * 0.6;
    x.value = withDelay(
      120,
      withTiming(W * 1.1, { duration: 980, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    return () => cancelAnimation(x);
  }, [x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.sweep, style]}>
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function DustMote({
  left,
  top,
  size,
  delay,
  drift,
  color,
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
  drift: number;
  color: string;
}) {
  const y = useSharedValue(0);
  const o = useSharedValue(0);

  useEffect(() => {
    o.value = withDelay(
      delay,
      withSequence(
        withTiming(0.55, { duration: 420 }),
        withTiming(0.2, { duration: 900 }),
        withTiming(0, { duration: 500 }),
      ),
    );
    y.value = withDelay(
      delay,
      withTiming(-drift, { duration: 1800, easing: Easing.out(Easing.quad) }),
    );
    return () => {
      cancelAnimation(o);
      cancelAnimation(y);
    };
  }, [delay, drift, o, y]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Cinematiczne przejście Homes ↔ Cars — Rolls-Royce / Apple:
 * velvet veil, orbit rings, crest, light sweep, soft bloom (bez zoomu ikony).
 */
export default function EcosystemVerticalTransition() {
  const { t } = useI18n();
  const pendingSwitch = useEcosystemStore((s) => s.pendingSwitch);
  const setActiveVertical = useEcosystemStore((s) => s.setActiveVertical);
  const clearVerticalSwitch = useEcosystemStore((s) => s.clearVerticalSwitch);

  const progress = useSharedValue(0);
  const crestScale = useSharedValue(0.92);
  const crestOpacity = useSharedValue(0);
  const bloom = useSharedValue(0);
  const exit = useSharedValue(0);

  const to: EcosystemVertical = pendingSwitch?.to ?? 'home';
  const isCar = to === 'car';
  const theme = isCar ? CAR_THEME : HOME_THEME;
  const label = isCar
    ? t('radar.home.verticalSwitchToCar')
    : t('radar.home.verticalSwitchToHome');

  const motes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: (W * ((i * 37) % 100)) / 100,
        top: H * (0.22 + ((i * 19) % 55) / 100),
        size: 1.5 + (i % 3),
        delay: 180 + i * 55,
        drift: 28 + (i % 5) * 10,
      })),
    [],
  );

  useEffect(() => {
    if (!pendingSwitch) {
      progress.value = 0;
      crestScale.value = 0.92;
      crestOpacity.value = 0;
      bloom.value = 0;
      exit.value = 0;
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    progress.value = 0;
    exit.value = 0;
    bloom.value = 0;
    crestOpacity.value = 0;
    crestScale.value = 0.88;

    progress.value = withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) });
    crestOpacity.value = withDelay(
      80,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    crestScale.value = withDelay(
      60,
      withTiming(1, { duration: 640, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );

    const commitAt = INTRO_MS + Math.round(HOLD_MS * 0.55);
    const bloomAt = INTRO_MS + HOLD_MS;
    const doneAt = TOTAL_MS;

    const commitTimer = setTimeout(() => {
      void Haptics.selectionAsync();
      setActiveVertical(pendingSwitch.to);
      bloom.value = withTiming(1, {
        duration: BLOOM_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
      crestOpacity.value = withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) });
      crestScale.value = withTiming(1.06, { duration: 420, easing: Easing.out(Easing.quad) });
    }, commitAt);

    const exitTimer = setTimeout(() => {
      exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearVerticalSwitch)();
      });
    }, bloomAt + Math.round(BLOOM_MS * 0.35));

    const safety = setTimeout(() => {
      clearVerticalSwitch();
    }, doneAt + 80);

    return () => {
      clearTimeout(commitTimer);
      clearTimeout(exitTimer);
      clearTimeout(safety);
    };
  }, [
    pendingSwitch,
    setActiveVertical,
    clearVerticalSwitch,
    progress,
    crestScale,
    crestOpacity,
    bloom,
    exit,
  ]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP) *
      interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const crestStyle = useAnimatedStyle(() => ({
    opacity: crestOpacity.value * interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: crestScale.value },
      {
        translateY: interpolate(crestOpacity.value, [0, 1], [14, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const bloomCoreStyle = useAnimatedStyle(() => {
    const s = interpolate(bloom.value, [0, 1], [0.15, 4.8], Extrapolation.CLAMP);
    const o = interpolate(bloom.value, [0, 0.15, 0.7, 1], [0, 0.85, 0.55, 0], Extrapolation.CLAMP);
    return {
      opacity: o * interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: s }],
    };
  });

  const bloomHaloStyle = useAnimatedStyle(() => {
    const s = interpolate(bloom.value, [0, 1], [0.4, 6.2], Extrapolation.CLAMP);
    const o = interpolate(bloom.value, [0, 0.2, 0.75, 1], [0, 0.45, 0.25, 0], Extrapolation.CLAMP);
    return {
      opacity: o * interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: s }],
    };
  });

  const vignetteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.9], Extrapolation.CLAMP) *
      interpolate(exit.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: crestOpacity.value * interpolate(bloom.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(crestOpacity.value, [0, 1], [10, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  if (!pendingSwitch) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
          <LinearGradient
            colors={[theme.deep, theme.mid, theme.deep]}
            locations={[0, 0.48, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.72)']}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.centerGlow, { backgroundColor: theme.glow }, vignetteStyle]} />
        </Animated.View>

        <SpecularSweep colors={theme.metal} />

        {motes.map((m) => (
          <DustMote
            key={m.id}
            left={m.left}
            top={m.top}
            size={m.size}
            delay={m.delay}
            drift={m.drift}
            color={isCar ? 'rgba(186,230,253,0.9)' : 'rgba(167,243,208,0.9)'}
          />
        ))}

        <View style={styles.stage}>
          <Animated.View style={[styles.crestWrap, crestStyle]}>
            <OrbitRing size={168} duration={14000} color="rgba(255,255,255,0.10)" thickness={1} />
            <OrbitRing size={148} duration={9000} reverse color={theme.rim} thickness={1.25} />
            <OrbitRing size={128} duration={11000} color="rgba(255,255,255,0.16)" thickness={StyleSheet.hairlineWidth} dash />

            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.crestDisc}
            >
              <View style={[styles.crestInner, { borderColor: theme.rim }]}>
                <Ionicons name={isCar ? 'car-sport' : 'home'} size={42} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.copy, copyStyle]}>
            <Text style={styles.brand}>EstateOS™</Text>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.hairline, { backgroundColor: theme.accent }]} />
          </Animated.View>
        </View>

        {/* Soft color bloom — skalujemy gładkie kule gradientu, NIE ikonę */}
        <View style={styles.bloomStage} pointerEvents="none">
          <Animated.View style={[styles.bloomHalo, bloomHaloStyle]}>
            <LinearGradient
              colors={[theme.glow, 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.bloomCore, bloomCoreStyle]}>
            <LinearGradient
              colors={[
                isCar ? 'rgba(125,211,252,0.95)' : 'rgba(110,231,183,0.95)',
                isCar ? 'rgba(14,165,233,0.55)' : 'rgba(16,185,129,0.55)',
                'transparent',
              ]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const BLOOM_BASE = Math.max(W, H) * 0.42;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerGlow: {
    position: 'absolute',
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
    alignSelf: 'center',
    top: H * 0.22,
    opacity: 0.35,
  },
  sweep: {
    position: 'absolute',
    top: -H * 0.2,
    width: 90,
    height: H * 1.4,
    opacity: 0.55,
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  crestWrap: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  crestInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  copy: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  brand: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4.2,
    textTransform: 'uppercase',
  },
  label: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  hairline: {
    marginTop: 4,
    width: 36,
    height: 2,
    borderRadius: 1,
    opacity: 0.85,
  },
  bloomStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloomCore: {
    width: BLOOM_BASE,
    height: BLOOM_BASE,
    borderRadius: BLOOM_BASE / 2,
    overflow: 'hidden',
  },
  bloomHalo: {
    position: 'absolute',
    width: BLOOM_BASE * 1.15,
    height: BLOOM_BASE * 1.15,
    borderRadius: (BLOOM_BASE * 1.15) / 2,
    overflow: 'hidden',
  },
});
