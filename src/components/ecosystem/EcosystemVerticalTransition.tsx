import React, { useEffect } from 'react';
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
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../../store/useEcosystemStore';
import { useI18n } from '../../i18n';

const { width: W, height: H } = Dimensions.get('window');
const DIAG = Math.sqrt(W * W + H * H);

/** Duże kółko crestu — błysk tylko w nim, potem ekspansja na fullscreen. */
const CREST = Math.min(228, W * 0.58);
const EXPAND_SCALE = (DIAG / CREST) * 1.12;

const INTRO_MS = 320;
const SWEEP_DELAY_MS = 280;
const SWEEP_MS = 780;
const EXPAND_MS = 920;
const EXIT_MS = 280;

type Theme = {
  deep: string;
  fill: [string, string, string];
  rim: string;
  accent: string;
  metal: [string, string, string];
};

const HOME_THEME: Theme = {
  deep: 'rgba(3,26,20,0.72)',
  fill: ['#10B981', '#059669', '#047857'],
  rim: 'rgba(167,243,208,0.7)',
  accent: '#34D399',
  metal: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.00)'],
};

const CAR_THEME: Theme = {
  deep: 'rgba(2,11,22,0.72)',
  fill: ['#38BDF8', '#0EA5E9', '#0284C7'],
  rim: 'rgba(186,230,253,0.7)',
  accent: '#7DD3FC',
  metal: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.00)'],
};

function OrbitRing({
  size,
  duration,
  reverse,
  color,
  thickness = 1.25,
}: {
  size: number;
  duration: number;
  reverse?: boolean;
  color: string;
  thickness?: number;
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
        },
        style,
      ]}
    />
  );
}

/**
 * Błysk tylko wewnątrz kółka (rodzic ma overflow:hidden).
 */
function CrestSweep({
  colors,
  delayMs,
  durationMs,
  progress,
}: {
  colors: Theme['metal'];
  delayMs: number;
  durationMs: number;
  progress: SharedValue<number>;
}) {
  useEffect(() => {
    progress.value = -0.35;
    progress.value = withDelay(
      delayMs,
      withTiming(1.35, { duration: durationMs, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    return () => cancelAnimation(progress);
  }, [delayMs, durationMs, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [-0.35, 1.35], [-CREST * 0.85, CREST * 0.95]) },
      { rotate: '22deg' },
    ],
    opacity: interpolate(progress.value, [-0.35, 0.1, 0.85, 1.35], [0, 0.95, 0.95, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.crestSweep, style]}>
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/**
 * Homes ↔ Cars: crest → błysk w kółku → ekspansja koloru na cały ekran → dział.
 */
export default function EcosystemVerticalTransition() {
  const { t } = useI18n();
  const pendingSwitch = useEcosystemStore((s) => s.pendingSwitch);
  const setActiveVertical = useEcosystemStore((s) => s.setActiveVertical);
  const clearVerticalSwitch = useEcosystemStore((s) => s.clearVerticalSwitch);

  const backdrop = useSharedValue(0);
  const crestIn = useSharedValue(0);
  const sweep = useSharedValue(-0.35);
  const expand = useSharedValue(0);
  const contentFade = useSharedValue(1);

  const to: EcosystemVertical = pendingSwitch?.to ?? 'home';
  const isCar = to === 'car';
  const theme = isCar ? CAR_THEME : HOME_THEME;
  const label = isCar
    ? t('radar.home.verticalSwitchToCar')
    : t('radar.home.verticalSwitchToHome');

  useEffect(() => {
    if (!pendingSwitch) {
      backdrop.value = 0;
      crestIn.value = 0;
      sweep.value = -0.35;
      expand.value = 0;
      contentFade.value = 1;
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    backdrop.value = 0;
    crestIn.value = 0;
    sweep.value = -0.35;
    expand.value = 0;
    contentFade.value = 1;

    backdrop.value = withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) });
    crestIn.value = withDelay(
      60,
      withTiming(1, { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );

    const expandAt = SWEEP_DELAY_MS + SWEEP_MS + 40;
    const commitAt = expandAt + Math.round(EXPAND_MS * 0.28);
    const doneAt = expandAt + EXPAND_MS + EXIT_MS;

    const expandTimer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      contentFade.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      expand.value = withTiming(1, {
        duration: EXPAND_MS,
        easing: Easing.bezier(0.18, 0.9, 0.22, 1),
      });
    }, expandAt);

    const commitTimer = setTimeout(() => {
      void Haptics.selectionAsync();
      setActiveVertical(pendingSwitch.to);
    }, commitAt);

    const doneTimer = setTimeout(() => {
      backdrop.value = withTiming(0, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearVerticalSwitch)();
      });
    }, expandAt + EXPAND_MS - 40);

    const safety = setTimeout(() => {
      clearVerticalSwitch();
    }, doneAt + 120);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(commitTimer);
      clearTimeout(doneTimer);
      clearTimeout(safety);
    };
  }, [
    pendingSwitch,
    setActiveVertical,
    clearVerticalSwitch,
    backdrop,
    crestIn,
    sweep,
    expand,
    contentFade,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * interpolate(expand.value, [0.75, 1], [1, 0.15], Extrapolation.CLAMP),
  }));

  const crestStyle = useAnimatedStyle(() => {
    const enter = interpolate(crestIn.value, [0, 1], [0.82, 1], Extrapolation.CLAMP);
    const grow = interpolate(expand.value, [0, 1], [1, EXPAND_SCALE], Extrapolation.CLAMP);
    return {
      opacity: crestIn.value,
      transform: [{ scale: enter * grow }],
    };
  });

  const innerContentStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
  }));

  const ringsStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.12], [1, 0], Extrapolation.CLAMP),
  }));

  if (!pendingSwitch) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.deep }]} />
        </Animated.View>

        <View style={styles.stage}>
          <Animated.View style={[styles.crest, crestStyle]}>
            <LinearGradient
              colors={[...theme.fill]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'transparent', 'rgba(0,0,0,0.18)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Błysk wyłącznie w kółku */}
            <CrestSweep
              colors={theme.metal}
              delayMs={SWEEP_DELAY_MS}
              durationMs={SWEEP_MS}
              progress={sweep}
            />

            <Animated.View style={[styles.rings, ringsStyle]}>
              <OrbitRing size={CREST - 18} duration={12000} color="rgba(255,255,255,0.18)" />
              <OrbitRing size={CREST - 42} duration={8600} reverse color={theme.rim} thickness={1.5} />
            </Animated.View>

            <Animated.View style={[styles.crestContent, innerContentStyle]}>
              <View style={[styles.iconDisc, { borderColor: theme.rim }]}>
                <Ionicons name={isCar ? 'car-sport' : 'home'} size={40} color="#FFFFFF" />
              </View>
              <Text style={styles.brand}>EstateOS™</Text>
              <Text style={styles.label}>{label}</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crest: {
    width: CREST,
    height: CREST,
    borderRadius: CREST / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
  crestSweep: {
    position: 'absolute',
    top: -CREST * 0.35,
    width: 54,
    height: CREST * 1.7,
  },
  rings: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 8,
    zIndex: 2,
  },
  iconDisc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
    marginBottom: 4,
  },
  brand: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3.4,
    textTransform: 'uppercase',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 18,
  },
});
