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
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../../store/useEcosystemStore';
import { useI18n } from '../../i18n';

const { width: W, height: H } = Dimensions.get('window');
const DIAG = Math.sqrt(W * W + H * H);

const CREST = Math.min(228, W * 0.58);
const EXPAND_SCALE = (DIAG / CREST) * 1.12;
const STAR_COUNT = 56;

const INTRO_MS = 320;
const SWEEP_DELAY_MS = 280;
const SWEEP_MS = 780;
const EXPAND_MS = 920;
const EXIT_MS = 320;

type Theme = {
  fill: [string, string, string];
  rim: string;
  metal: [string, string, string];
};

const HOME_THEME: Theme = {
  fill: ['#10B981', '#059669', '#047857'],
  rim: 'rgba(167,243,208,0.7)',
  metal: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.00)'],
};

const CAR_THEME: Theme = {
  fill: ['#38BDF8', '#0EA5E9', '#0284C7'],
  rim: 'rgba(186,230,253,0.7)',
  metal: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.00)'],
};

function Star({
  left,
  top,
  size,
  delay,
  warm,
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
  warm: boolean;
}) {
  const o = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    const peak = warm ? 0.35 + Math.random() * 0.25 : 0.4 + Math.random() * 0.45;
    o.value = withDelay(delay, withTiming(peak, { duration: 700 }));
    twinkle.value = withDelay(
      delay + 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900 + Math.random() * 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900 + Math.random() * 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(o);
      cancelAnimation(twinkle);
    };
  }, [delay, o, twinkle, warm]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value * interpolate(twinkle.value, [0, 1], [0.55, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(twinkle.value, [0, 1], [0.85, 1.15], Extrapolation.CLAMP) }],
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
          backgroundColor: warm ? '#F5D08A' : '#FFFFFF',
          shadowColor: warm ? '#F5D08A' : '#FFF',
          shadowOpacity: 0.8,
          shadowRadius: size * 1.4,
        },
        style,
      ]}
    />
  );
}

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

/** Dwie dyskretne zębatki u dołu — wkręcają się w siebie. */
function MeshingGears({ accent }: { accent: string }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withDelay(180, withTiming(1, { duration: 420 }));
    a.value = withRepeat(withTiming(360, { duration: 2400, easing: Easing.linear }), -1, false);
    b.value = withRepeat(withTiming(-360, { duration: 2400 * (22 / 16), easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
      cancelAnimation(fade);
    };
  }, [a, b, fade]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: fade.value * 0.72 }));
  const gearAStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  const gearBStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${b.value}deg` }] }));

  return (
    <Animated.View style={[styles.gearsWrap, wrapStyle]}>
      <Animated.View style={[styles.gearA, gearAStyle]}>
        <Ionicons name="settings-outline" size={22} color={accent} />
      </Animated.View>
      <Animated.View style={[styles.gearB, gearBStyle]}>
        <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.55)" />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Homes ↔ Cars: czarne niebo z gwiazdami → crest → błysk → ekspansja.
 * Katalog ładuje się od razu pod overlay (activeVertical przełączane przy starcie).
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
  const overlayOut = useSharedValue(0);

  const to: EcosystemVertical = pendingSwitch?.to ?? 'home';
  const isCar = to === 'car';
  const theme = isCar ? CAR_THEME : HOME_THEME;
  const label = isCar
    ? t('radar.home.verticalSwitchToCar')
    : t('radar.home.verticalSwitchToHome');

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        left: (((i * 97) % 1000) / 1000) * W,
        top: (((i * 53) % 1000) / 1000) * H,
        size: 1.2 + (i % 4) * 0.7,
        delay: 40 + (i % 12) * 35,
        warm: i % 5 === 0,
      })),
    [],
  );

  useEffect(() => {
    if (!pendingSwitch) {
      backdrop.value = 0;
      crestIn.value = 0;
      sweep.value = -0.35;
      expand.value = 0;
      contentFade.value = 1;
      overlayOut.value = 0;
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Czarne niebo od razu — potem montujemy katalog pod osłoną, żeby ładował się w trakcie.
    backdrop.value = 1;
    crestIn.value = 0;
    sweep.value = -0.35;
    expand.value = 0;
    contentFade.value = 1;
    overlayOut.value = 0;

    crestIn.value = withDelay(
      40,
      withTiming(1, { duration: 420, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );

    const loadTimer = setTimeout(() => {
      setActiveVertical(pendingSwitch.to);
    }, 30);

    const expandAt = SWEEP_DELAY_MS + SWEEP_MS + 40;
    const doneAt = expandAt + EXPAND_MS + EXIT_MS;

    const expandTimer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      contentFade.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      expand.value = withTiming(1, {
        duration: EXPAND_MS,
        easing: Easing.bezier(0.18, 0.9, 0.22, 1),
      });
    }, expandAt);

    const doneTimer = setTimeout(() => {
      overlayOut.value = withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearVerticalSwitch)();
      });
    }, expandAt + EXPAND_MS - 60);

    const safety = setTimeout(() => {
      clearVerticalSwitch();
    }, doneAt + 160);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(expandTimer);
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
    overlayOut,
  ]);

  const starfieldStyle = useAnimatedStyle(() => ({
    opacity:
      backdrop.value *
      interpolate(overlayOut.value, [0, 1], [1, 0], Extrapolation.CLAMP) *
      interpolate(expand.value, [0.55, 1], [1, 0.2], Extrapolation.CLAMP),
  }));

  const crestStyle = useAnimatedStyle(() => {
    const enter = interpolate(crestIn.value, [0, 1], [0.82, 1], Extrapolation.CLAMP);
    const grow = interpolate(expand.value, [0, 1], [1, EXPAND_SCALE], Extrapolation.CLAMP);
    return {
      opacity: crestIn.value * interpolate(overlayOut.value, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: enter * grow }],
    };
  });

  const innerContentStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
  }));

  const ringsStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.12], [1, 0], Extrapolation.CLAMP),
  }));

  const gearsFadeStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));

  if (!pendingSwitch) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, starfieldStyle]}>
          <View style={[StyleSheet.absoluteFill, styles.space]} />
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.55)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          {stars.map((s) => (
            <Star key={s.id} left={s.left} top={s.top} size={s.size} delay={s.delay} warm={s.warm} />
          ))}
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

        <Animated.View style={[styles.gearsDock, gearsFadeStyle]}>
          <MeshingGears accent={isCar ? '#7DD3FC' : '#34D399'} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  space: {
    backgroundColor: '#000000',
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
  gearsDock: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gearsWrap: {
    width: 56,
    height: 40,
  },
  gearA: {
    position: 'absolute',
    left: 4,
    top: 4,
  },
  gearB: {
    position: 'absolute',
    right: 2,
    bottom: 2,
  },
});
