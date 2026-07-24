import React, { useEffect, useMemo } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, View } from 'react-native';
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
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../../store/useEcosystemStore';
import { useI18n } from '../../i18n';

const { width: W, height: H } = Dimensions.get('window');
const DIAG = Math.sqrt(W * W + H * H);

const CREST = Math.min(210, W * 0.54);
/** Mniejszy scale końcowy = mniej janku przy ekspansji na starych GPU. */
const EXPAND_SCALE = Math.min((DIAG / CREST) * 1.05, 14);

/**
 * Tier wydajności — mniej gwiazd / SVG / równoległych animacji na słabszym sprzęcie.
 * totalMemory bywa niedostępne na simulatorze → ostrożny fallback.
 */
const TOTAL_MEM = Number(Device.totalMemory || 0);
/** Android i urządzenia z < ~3.2 GB RAM → lżejsza ścieżka animacji. */
const LOW_END =
  Platform.OS === 'android' || (TOTAL_MEM > 0 && TOTAL_MEM < 3.2 * 1024 * 1024 * 1024);
const STAR_COUNT = LOW_END ? 14 : 28;
const SHOW_ORBIT = !LOW_END;
const GEAR_TEETH_A = LOW_END ? 8 : 12;
const GEAR_TEETH_B = LOW_END ? 6 : 9;

const SWEEP_DELAY_MS = LOW_END ? 180 : 240;
const SWEEP_MS = LOW_END ? 560 : 680;
const EXPAND_MS = LOW_END ? 720 : 860;
const EXIT_MS = LOW_END ? 260 : 300;
const CREST_IN_MS = LOW_END ? 320 : 380;

const SMOOTH = Easing.bezier(0.22, 1, 0.36, 1);
const SMOOTH_OUT = Easing.bezier(0.16, 1, 0.3, 1);

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

/** Heavy → krótka przerwa → Light (tik-tak). */
async function playSwitchHaptics() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise<void>((resolve) => setTimeout(resolve, 78));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* ignore */
  }
}

function gearToothPath(
  cx: number,
  cy: number,
  teeth: number,
  outerR: number,
  innerR: number,
  rootR: number,
): string {
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const step = (Math.PI * 2) / teeth;
    const a0 = i * step;
    const a1 = a0 + step * 0.18;
    const a2 = a0 + step * 0.38;
    const a3 = a0 + step * 0.62;
    const a4 = a0 + step * 0.82;
    const a5 = a0 + step;
    const pt = (r: number, a: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    if (i === 0) parts.push(`M ${pt(rootR, a0)}`);
    else parts.push(`L ${pt(rootR, a0)}`);
    parts.push(`L ${pt(innerR, a1)}`);
    parts.push(`L ${pt(outerR, a2)}`);
    parts.push(`L ${pt(outerR, a3)}`);
    parts.push(`L ${pt(innerR, a4)}`);
    parts.push(`L ${pt(rootR, a5)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function MetalGear({
  size,
  teeth,
  accent,
  uid,
  simplified,
}: {
  size: number;
  teeth: number;
  accent: string;
  uid: string;
  simplified?: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const tipR = size * 0.42;
  const rootR = size * 0.3;
  const holeR = size * 0.11;
  const hubR = size * 0.2;
  const path = useMemo(
    () => gearToothPath(cx, cy, teeth, tipR, size * 0.42, rootR),
    [cx, cy, teeth, tipR, rootR, size],
  );
  const gradId = `metal-${uid}`;
  const hubId = `hub-${uid}`;

  if (simplified) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path d={path} fill={accent} opacity={0.55} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        <Circle cx={cx} cy={cy} r={hubR} fill="#CBD5E1" />
        <Circle cx={cx} cy={cy} r={holeR} fill="#0B1220" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="18%" y1="8%" x2="82%" y2="92%">
          <Stop offset="0%" stopColor="#F8FAFC" stopOpacity="1" />
          <Stop offset="32%" stopColor="#CBD5E1" stopOpacity="1" />
          <Stop offset="55%" stopColor={accent} stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="1" />
        </SvgLinearGradient>
        <RadialGradient id={hubId} cx="42%" cy="38%" r="62%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#64748B" stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <G>
        <Path d={path} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
        <Circle cx={cx} cy={cy} r={hubR} fill={`url(#${hubId})`} />
        <Circle cx={cx} cy={cy} r={holeR} fill="#0B1220" />
      </G>
    </Svg>
  );
}

/** Statyczne gwiazdy + jedna wspólna animacja migotu (zamiast N× withRepeat). */
function Starfield({
  stars,
  twinkle,
}: {
  stars: { id: number; left: number; top: number; size: number; warm: boolean; base: number }[];
  twinkle: SharedValue<number>;
}) {
  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [0.72, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, fieldStyle]} pointerEvents="none">
      {stars.map((s) => (
        <View
          key={s.id}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: s.warm ? '#F5D08A' : '#FFFFFF',
            opacity: s.base,
          }}
        />
      ))}
    </Animated.View>
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
      withTiming(1.35, { duration: durationMs, easing: SMOOTH }),
    );
    return () => cancelAnimation(progress);
  }, [delayMs, durationMs, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [-0.35, 1.35], [-CREST * 0.85, CREST * 0.95]) },
      { rotate: '22deg' },
    ],
    opacity: interpolate(progress.value, [-0.35, 0.12, 0.82, 1.35], [0, 0.9, 0.9, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.crestSweep, style]}>
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function MeshingGears({ accent }: { accent: string }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const fade = useSharedValue(0);
  const durationA = LOW_END ? 4200 : 3400;
  const durationB = durationA * (GEAR_TEETH_A / GEAR_TEETH_B);

  useEffect(() => {
    fade.value = withDelay(120, withTiming(1, { duration: 360, easing: SMOOTH_OUT }));
    a.value = withRepeat(withTiming(360, { duration: durationA, easing: Easing.linear }), -1, false);
    b.value = withRepeat(withTiming(-360, { duration: durationB, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
      cancelAnimation(fade);
    };
  }, [a, b, fade, durationA, durationB]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: fade.value * 0.9 }));
  const gearAStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  const gearBStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${b.value}deg` }] }));

  return (
    <Animated.View style={[styles.gearsWrap, wrapStyle]}>
      <Animated.View style={[styles.gearA, gearAStyle]}>
        <MetalGear size={LOW_END ? 44 : 52} teeth={GEAR_TEETH_A} accent={accent} uid="a" simplified={LOW_END} />
      </Animated.View>
      <Animated.View style={[styles.gearB, gearBStyle]}>
        <MetalGear size={LOW_END ? 32 : 38} teeth={GEAR_TEETH_B} accent={accent} uid="b" simplified={LOW_END} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Homes ↔ Cars: płynne przejście z lekkim footprintem GPU.
 * Katalog ładuje się pod overlay w trakcie animacji.
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
  const twinkle = useSharedValue(0);

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
        size: 1.1 + (i % 3) * 0.55,
        warm: i % 5 === 0,
        base: 0.35 + ((i * 17) % 50) / 100,
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
      cancelAnimation(twinkle);
      twinkle.value = 0;
      return;
    }

    void playSwitchHaptics();

    backdrop.value = 1;
    crestIn.value = 0;
    sweep.value = -0.35;
    expand.value = 0;
    contentFade.value = 1;
    overlayOut.value = 0;

    // Jeden wspólny migot gwiazd — taniej niż N osobnych pętli.
    twinkle.value = withRepeat(
      withTiming(1, { duration: LOW_END ? 1600 : 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    crestIn.value = withTiming(1, { duration: CREST_IN_MS, easing: SMOOTH_OUT });

    const loadTimer = setTimeout(() => {
      setActiveVertical(pendingSwitch.to);
    }, 24);

    const expandAt = SWEEP_DELAY_MS + SWEEP_MS + 20;
    const doneAt = expandAt + EXPAND_MS + EXIT_MS;

    const expandTimer = setTimeout(() => {
      contentFade.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
      expand.value = withTiming(1, {
        duration: EXPAND_MS,
        easing: SMOOTH,
      });
    }, expandAt);

    const doneTimer = setTimeout(() => {
      overlayOut.value = withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(clearVerticalSwitch)();
      });
    }, expandAt + EXPAND_MS - 80);

    const safety = setTimeout(() => {
      clearVerticalSwitch();
    }, doneAt + 140);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(expandTimer);
      clearTimeout(doneTimer);
      clearTimeout(safety);
      cancelAnimation(twinkle);
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
    twinkle,
  ]);

  const starfieldStyle = useAnimatedStyle(() => ({
    opacity:
      backdrop.value *
      interpolate(overlayOut.value, [0, 1], [1, 0], Extrapolation.CLAMP) *
      interpolate(expand.value, [0.45, 1], [1, 0.15], Extrapolation.CLAMP),
  }));

  const crestStyle = useAnimatedStyle(() => {
    const enter = interpolate(crestIn.value, [0, 1], [0.88, 1], Extrapolation.CLAMP);
    const grow = interpolate(expand.value, [0, 1], [1, EXPAND_SCALE], Extrapolation.CLAMP);
    return {
      opacity: crestIn.value * interpolate(overlayOut.value, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: enter * grow }],
    };
  });

  const innerContentStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.18], [1, 0], Extrapolation.CLAMP),
  }));

  const ringsStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.1], [1, 0], Extrapolation.CLAMP),
  }));

  const gearsFadeStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value * interpolate(expand.value, [0, 0.22], [1, 0], Extrapolation.CLAMP),
  }));

  if (!pendingSwitch) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.root} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, starfieldStyle]}>
          <View style={[StyleSheet.absoluteFill, styles.space]} />
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'transparent', 'rgba(0,0,0,0.5)']}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Starfield stars={stars} twinkle={twinkle} />
        </Animated.View>

        <View style={styles.stage}>
          <Animated.View
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
            collapsable={false}
            style={[styles.crest, !LOW_END && styles.crestShadow, crestStyle]}
          >
            <LinearGradient
              colors={[...theme.fill]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.26)', 'transparent', 'rgba(0,0,0,0.16)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />

            <CrestSweep
              colors={theme.metal}
              delayMs={SWEEP_DELAY_MS}
              durationMs={SWEEP_MS}
              progress={sweep}
            />

            {SHOW_ORBIT ? (
              <Animated.View style={[styles.rings, ringsStyle]}>
                <OrbitRing size={CREST - 20} duration={14000} color="rgba(255,255,255,0.16)" />
                <OrbitRing size={CREST - 44} duration={9800} reverse color={theme.rim} thickness={1.4} />
              </Animated.View>
            ) : (
              <View
                pointerEvents="none"
                style={[
                  styles.staticRing,
                  { width: CREST - 28, height: CREST - 28, borderRadius: (CREST - 28) / 2, borderColor: theme.rim },
                ]}
              />
            )}

            <Animated.View style={[styles.crestContent, innerContentStyle]}>
              <View style={[styles.iconDisc, { borderColor: theme.rim }]}>
                <Ionicons name={isCar ? 'car-sport' : 'home'} size={38} color="#FFFFFF" />
              </View>
              <Text style={styles.brand}>EstateOS™</Text>
              <Text style={styles.label}>{label}</Text>
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.gearsDock, gearsFadeStyle]}>
          <MeshingGears accent={isCar ? '#38BDF8' : '#34D399'} />
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
  },
  crestShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  crestSweep: {
    position: 'absolute',
    top: -CREST * 0.35,
    width: 48,
    height: CREST * 1.7,
  },
  rings: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 1.25,
    opacity: 0.55,
  },
  crestContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 8,
    zIndex: 2,
  },
  iconDisc: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gearsWrap: {
    width: 92,
    height: 68,
  },
  gearA: {
    position: 'absolute',
    left: 0,
    top: 4,
  },
  gearB: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});
