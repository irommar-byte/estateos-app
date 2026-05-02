import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Image, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
  withRepeat,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const LINE1 = 'TWÓJ OSOBISTY RADAR';

/** Kolejne otwarcia aplikacji — rotacja (indeks w AsyncStorage). */
const TAGLINE_ROTATION = [
  'Odkrywaj nieruchomości zanim zrobią to inni.',
  'Widzisz więcej. Decydujesz szybciej.',
  'Pierwszy widzisz. Pierwszy działasz.',
] as const;

const SPLASH_TAGLINE_STORAGE_KEY = '@EstateOS_splash_tagline_slot';

const STAGGER_MS = 30;
const PARTICLE_COUNT = 80;

const LOGO_SIZE = Math.round(
  Math.min(Math.max(width * 0.88, 260), height * 0.48, 540)
);

// ─── Timing master ────────────────────────────────────────────────────────────
const T = {
  logoStart: 120,
  logoLightMs: 2600,
  gapLogoToLine1: 0,
  lineGapAfter1: 72,
  sunGapAfter2: 56,
  sunDuration: 2750,
  flyOutGapAfterSun: 0,
  flyOutMs: 380,
  doorDuration: 1180,
  doorSoundLead: 26,
} as const;

const LINE1_START_ADVANCE_MS = 2000;
const DOOR_OPEN_EARLIER_MS = 0;
const FLY_OUT_EARLIER_MS = 1200;

const EXIT_UP = -height * 0.52;
const EXIT_DOWN = height * 0.52;

// ─── Particle ─────────────────────────────────────────────────────────────────
function Particle({
  startX,
  startY,
  size,
  duration,
  delay,
  driftX = 0,
  warm = false,
}: {
  startX: number;
  startY: number;
  size: number;
  duration: number;
  delay: number;
  driftX?: number;
  warm?: boolean;
}) {
  const translateY = useSharedValue(startY);
  const driftValue = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const maxOpacity = warm
      ? Math.random() * 0.22 + 0.28   // złote — delikatniejsze
      : Math.random() * 0.28 + 0.38;  // białe — jak poprzednio

    opacity.value = withDelay(
      delay,
      withTiming(maxOpacity, { duration: 1600 })
    );

    translateY.value = withRepeat(
      withTiming(startY - 300, { duration, easing: Easing.linear }),
      -1,
      true
    );

    if (Math.abs(driftX) > 1) {
      driftValue.value = withRepeat(
        withSequence(
          withTiming(driftX, {
            duration: duration * 0.52,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-driftX * 0.45, {
            duration: duration * 0.48,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
     
    transform: [
      { translateY: translateY.value },
      { translateX: driftValue.value },
    ] as any,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        warm ? styles.particleWarm : null,
        style,
        { left: startX, width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
}

// ─── Text reveal helpers ───────────────────────────────────────────────────────
function getWordSpans(text: string): { word: string; startIndex: number }[] {
  const result: { word: string; startIndex: number }[] = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    while (i < len && /\s/.test(text.charAt(i))) i++;
    if (i >= len) break;
    const start = i;
    while (i < len && !/\s/.test(text.charAt(i))) i++;
    result.push({ word: text.slice(start, i), startIndex: start });
  }
  return result;
}

function SplashWordWrappedLine({
  text,
  reveal,
  lineId,
}: {
  text: string;
  reveal: SharedValue<number>;
  lineId: string;
}) {
  const spans = useMemo(() => getWordSpans(text), [text]);
  const total = text.length;

  const elements: React.ReactNode[] = [];
  spans.forEach(({ word, startIndex }, wIdx) => {
    if (wIdx > 0) {
      elements.push(<View key={`${lineId}-gap-${wIdx}`} style={styles.wordGap} />);
    }
    elements.push(
      <View key={`${lineId}-w-${wIdx}`} style={styles.wordGroup}>
        {Array.from(word).map((ch, k) => {
          const index = startIndex + k;
          return (
            <SplashChar
              key={`${lineId}-${index}`}
              ch={ch}
              index={index}
              total={total}
              reveal={reveal}
            />
          );
        })}
      </View>
    );
  });

  return <View style={styles.lineRow}>{elements}</View>;
}

function SplashChar({
  ch,
  index,
  total,
  reveal,
}: {
  ch: string;
  index: number;
  total: number;
  reveal: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    if (total <= 0) {
      return { opacity: 0, transform: [{ translateY: 12 }] };
    }
    const start = index / total;
    const end = (index + 1) / total;
    const o = interpolate(reveal.value, [start, end], [0, 1], Extrapolation.CLAMP);
    const y = interpolate(reveal.value, [start, end], [14, 0], Extrapolation.CLAMP);
    // subtelny blur-out via scale (iOS renderuje to płynnie)
    const s = interpolate(reveal.value, [start, Math.min(end, start + 0.05)], [0.88, 1], Extrapolation.CLAMP);
    return {
      opacity: o,
       
      transform: [{ translateY: y }, { scale: s }] as any,
    };
  });

  if (ch === ' ') {
    return <View style={{ width: 10 }} />;
  }

  return (
    <Animated.Text
      style={[styles.charText, style]}
      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
    >
      {ch}
    </Animated.Text>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function AppleSplashScreen({ onFinish }: { onFinish: () => void }) {
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const [taglineBoot, setTaglineBoot] = useState<{
    line2: string;
    slotIndex: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SPLASH_TAGLINE_STORAGE_KEY);
        let slot = 0;
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) {
            slot =
              ((n % TAGLINE_ROTATION.length) + TAGLINE_ROTATION.length) %
              TAGLINE_ROTATION.length;
          }
        }
        if (!cancelled) setTaglineBoot({ line2: TAGLINE_ROTATION[slot], slotIndex: slot });
      } catch {
        if (!cancelled) setTaglineBoot({ line2: TAGLINE_ROTATION[0], slotIndex: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Shared values ────────────────────────────────────────────────────────────
  const logoOpacity = useSharedValue(0);
  const logoScale   = useSharedValue(0.88);   // NEW: scale reveal
  const logoGlow    = useSharedValue(0);       // NEW: ambient halo
  const line1Reveal = useSharedValue(0);
  const line2Reveal = useSharedValue(0);
  const sunSweep    = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  const exitLift    = useSharedValue(0);
  const doorOpen    = useSharedValue(0);
  const doorEdgeGlow = useSharedValue(0);      // NEW: golden crack on door edge

  const line2Len = taglineBoot?.line2.length ?? 0;

  const line1Start = Math.max(
    T.logoStart,
    T.logoStart + T.logoLightMs + T.gapLogoToLine1 - LINE1_START_ADVANCE_MS
  );
  const line2Start = line1Start + LINE1.length * STAGGER_MS + T.lineGapAfter1;
  const sunStart   = line2Start + line2Len * STAGGER_MS + T.sunGapAfter2;
  const flyOutStart = Math.max(
    0,
    sunStart + T.sunDuration + T.flyOutGapAfterSun - FLY_OUT_EARLIER_MS
  );
  const doorMotionStart = flyOutStart + T.flyOutMs;
  const doorOpenAt = Math.max(0, doorMotionStart - DOOR_OPEN_EARLIER_MS);

  // ── Particle generation ──────────────────────────────────────────────────────
  const particles = useMemo(
    () =>
      taglineBoot
        ? Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
            const warm = i < Math.floor(PARTICLE_COUNT * 0.32); // 32% złote
            return {
              id: i,
              startX: Math.random() * width,
              startY: Math.random() * height + 80,
              size: warm
                ? Math.random() * 1.6 + 1.1   // złote — mniejsze
                : Math.random() * 2.2 + 2.1,  // białe — jak wcześniej
              duration: warm
                ? 13000 + Math.random() * 8000 // złote — wolniejsze
                : 9000 + Math.random() * 8000,
              delay: Math.random() * 1600,
              driftX: warm ? (Math.random() - 0.5) * 70 : 0,
              warm,
            };
          })
        : [],
    [taglineBoot]
  );

  // ── Audio ────────────────────────────────────────────────────────────────────
  const playDoorSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(require('../../assets/door.mp3'), {
        shouldPlay: true,
        volume: 0.24,
      });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) void sound.unloadAsync();
      });
      setTimeout(() => void sound.unloadAsync(), 5000);
    } catch {
      /* ignore */
    }
  };

  // ── Master animation sequence ─────────────────────────────────────────────────
  useEffect(() => {
    if (!taglineBoot || line2Len === 0) return;

    const nextSlot = (taglineBoot.slotIndex + 1) % TAGLINE_ROTATION.length;
    const runFinish = () => {
      void AsyncStorage.setItem(SPLASH_TAGLINE_STORAGE_KEY, String(nextSlot));
      finishRef.current();
    };

    // 1. Logo opacity — powolny luksusowy reveal ──────────────────────────────
    logoOpacity.value = withDelay(
      T.logoStart,
      withTiming(1, {
        duration: T.logoLightMs,
        easing: Easing.bezier(0.11, 0.008, 0.09, 1),
      })
    );

    // 2. Logo scale — wdech z 0.88 → 1.0, subtelna sprężyna na końcu ──────────
    logoScale.value = withDelay(
      T.logoStart,
      withSequence(
        withTiming(0.994, {
          duration: Math.round(T.logoLightMs * 0.88),
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        withSpring(1, { damping: 14, stiffness: 90, mass: 0.6 })
      )
    );

    // 3. Logo ambient glow ring — pojawia się po ~600ms
    logoGlow.value = withDelay(
      T.logoStart + 600,
      withTiming(1, {
        duration: Math.round(T.logoLightMs * 0.75),
        easing: Easing.out(Easing.cubic),
      })
    );

    // 4. Linia 1 — reveal liter ───────────────────────────────────────────────
    const line1Dur = Math.max(220, LINE1.length * STAGGER_MS + 100);
    line1Reveal.value = withDelay(
      line1Start,
      withTiming(1, {
        duration: line1Dur,
        easing: Easing.bezier(0.25, 0.1, 0.15, 1),
      })
    );

    // 5. Linia 2 — reveal liter ───────────────────────────────────────────────
    const line2Dur = Math.max(220, line2Len * STAGGER_MS + 100);
    line2Reveal.value = withDelay(
      line2Start,
      withTiming(1, {
        duration: line2Dur,
        easing: Easing.bezier(0.25, 0.1, 0.15, 1),
      })
    );

    // 6. Złota wiązka (główna) ─────────────────────────────────────────────────
    sunSweep.value = withDelay(
      sunStart,
      withTiming(1, {
        duration: T.sunDuration,
        easing: Easing.bezier(0.4, 0.02, 0.18, 1),
      })
    );

    // 7. Odlot zawartości ─────────────────────────────────────────────────────
    backdropOpacity.value = withDelay(
      flyOutStart,
      withTiming(0, { duration: T.flyOutMs, easing: Easing.out(Easing.cubic) })
    );
    exitLift.value = withDelay(
      flyOutStart,
      withTiming(1, {
        duration: T.flyOutMs,
        easing: Easing.bezier(0.34, 0, 0.22, 1),
      })
    );

    // 8. Złota szczelina drzwi — bardziej detaliczna: micro-pulse + dłuższe wygaszanie
    doorEdgeGlow.value = withDelay(
      doorOpenAt,
      withSequence(
        withTiming(1, { duration: 75, easing: Easing.out(Easing.quad) }),
        withTiming(0.74, { duration: 85, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: Math.round(T.doorDuration * 0.62), easing: Easing.out(Easing.cubic) })
      )
    );

    // 9. Drzwi ───────────────────────────────────────────────────────────────
    doorOpen.value = withDelay(
      doorOpenAt,
      withTiming(
        1,
        {
          duration: T.doorDuration,
          easing: Easing.bezier(0.55, 0, 0.05, 1),
        },
        (doorDone) => {
          if (doorDone) runOnJS(runFinish)();
        }
      )
    );

    const soundTimer = setTimeout(() => {
      void playDoorSound();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, Math.max(0, doorOpenAt - T.doorSoundLead));

    return () => clearTimeout(soundTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taglineBoot]);

  // ── Animated styles ───────────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const leftDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -doorOpen.value * (width / 2 + 50) }],
  }));

  const rightDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: doorOpen.value * (width / 2 + 50) }],
  }));

  // Złota krawędź przy otwieraniu drzwi
  const doorEdgeStyle = useAnimatedStyle(() => ({
    opacity: doorEdgeGlow.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }));

  // Logo: opacity + scale + wylot w górę
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
     
    transform: [
      { scale: logoScale.value },
      { translateY: interpolate(exitLift.value, [0, 1], [0, EXIT_UP], Extrapolation.CLAMP) },
    ] as any,
  }));

  // Ambient glow ring za logo
  const logoGlowRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logoGlow.value, [0, 0.4, 1], [0, 0.6, 0.82], Extrapolation.CLAMP),
     
    transform: [
      { scale: interpolate(logoGlow.value, [0, 1], [0.55, 1.02], Extrapolation.CLAMP) },
      { translateY: interpolate(exitLift.value, [0, 1], [0, EXIT_UP], Extrapolation.CLAMP) },
    ] as any,
  }));

  const textClusterStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(exitLift.value, [0, 1], [0, EXIT_DOWN], Extrapolation.CLAMP),
      },
    ],
  }));

  // Główna złota wiązka
  const sunBandStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sunSweep.value, [0, 1], [-width * 0.52, width * 0.52], Extrapolation.CLAMP),
      },
    ],
    opacity: interpolate(sunSweep.value, [0, 0.08, 0.92, 1], [0, 0.94, 0.94, 0], Extrapolation.CLAMP),
  }));

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!taglineBoot) {
    return (
      <View
        style={[StyleSheet.absoluteFill, styles.bootPlaceholder]}
        pointerEvents="none"
      />
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Tło */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        <LinearGradient
          colors={['#0a0a0c', '#030303', '#000000']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.0)', 'rgba(0,0,0,0.35)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Drzwi ze złotą krawędzią */}
      <View style={styles.doorStage} pointerEvents="none">
        <Animated.View style={[styles.doorLeft, styles.doorFillBlack, leftDoorStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.015)', 'rgba(0,0,0,0.38)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.06, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Złota linia-szczelina na prawej krawędzi lewych drzwi */}
          <Animated.View style={[styles.doorInnerEdgeRight, doorEdgeStyle]} />
        </Animated.View>
        <Animated.View style={[styles.doorRight, styles.doorFillBlack, rightDoorStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(0,0,0,0.38)', 'rgba(255,255,255,0.015)', 'rgba(255,255,255,0.07)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.94, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Złota linia-szczelina na lewej krawędzi prawych drzwi */}
          <Animated.View style={[styles.doorInnerEdgeLeft, doorEdgeStyle]} />
        </Animated.View>
      </View>

      <Animated.View style={contentStyle} pointerEvents="none">
        {/* Cząsteczki: 32% złote z dryfem, 68% białe */}
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}

        {/* Ambient glow ring — za logo, pojawia się po ~600ms */}
        <Animated.View style={[styles.logoGlowRing, logoGlowRingStyle]} pointerEvents="none" />

        {/* Logo */}
        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Tekst + złote wiązki */}
        <Animated.View style={[styles.textCluster, textClusterStyle]}>
          <View style={styles.textBlock}>
            <View style={styles.sunClip}>
              <View style={styles.linesUnderSun}>
                <SplashWordWrappedLine text={LINE1} reveal={line1Reveal} lineId="l1" />

                {taglineBoot ? (
                  <View style={styles.lineRowSecondWrap}>
                    <SplashWordWrappedLine
                      text={taglineBoot.line2}
                      reveal={line2Reveal}
                      lineId="l2"
                    />
                  </View>
                ) : null}
              </View>

              {/* Jedna wiązka premium (core + halo), bez drugiego przejazdu */}
              <Animated.View
                style={[styles.sunBandWrap, sunBandStyle]}
                pointerEvents="none"
                needsOffscreenAlphaCompositing
              >
                <LinearGradient
                  colors={[
                    'transparent',
                    'rgba(100, 62, 22, 0.2)',
                    'rgba(168, 112, 38, 0.55)',
                    'rgba(245, 210, 150, 1)',
                    'rgba(195, 138, 48, 0.62)',
                    'rgba(130, 82, 28, 0.22)',
                    'transparent',
                  ]}
                  locations={[0, 0.18, 0.38, 0.5, 0.58, 0.78, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.sunBandGrad, Platform.OS === 'ios' ? styles.sunBlend : null]}
                />
                <LinearGradient
                  colors={[
                    'transparent',
                    'rgba(248, 220, 140, 0.10)',
                    'rgba(255, 235, 170, 0.26)',
                    'rgba(255, 235, 170, 0.42)',
                    'rgba(224, 180, 80, 0.16)',
                    'rgba(180, 130, 40, 0.06)',
                    'transparent',
                  ]}
                  locations={[0, 0.2, 0.43, 0.5, 0.58, 0.78, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.sunBandGradHalo, Platform.OS === 'ios' ? styles.sunBlend : null]}
                />
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  doorStage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    overflow: 'visible',
  },
  doorLeft: {
    position: 'absolute',
    left: 0,
    width: width / 2,
    height: '100%',
    overflow: 'hidden',
    zIndex: 8,
  },
  doorRight: {
    position: 'absolute',
    right: 0,
    width: width / 2,
    height: '100%',
    overflow: 'hidden',
    zIndex: 8,
  },
  doorFillBlack: {
    backgroundColor: '#000000',
  },
  /** Złota krawędź na prawym boku lewych drzwi */
  doorInnerEdgeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowRadius: 12,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  /** Złota krawędź na lewym boku prawych drzwi */
  doorInnerEdgeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowRadius: 12,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  particleWarm: {
    backgroundColor: 'rgba(212,175,55,0.85)',
  },
  /** Ambient glow ring — podświetla logo od tyłu */
  logoGlowRing: {
    position: 'absolute',
    width: LOGO_SIZE * 0.68,
    height: LOGO_SIZE * 0.68,
    borderRadius: (LOGO_SIZE * 0.68) / 2,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    backgroundColor: 'transparent',
    shadowColor: '#D4AF37',
    shadowRadius: 56,
    shadowOpacity: 0.72,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    zIndex: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textCluster: {
    alignItems: 'center',
    maxWidth: width - 32,
  },
  textBlock: {
    marginTop: 26,
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: width - 32,
  },
  sunClip: {
    overflow: 'visible',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    position: 'relative',
  },
  linesUnderSun: {
    zIndex: 1,
  },
  sunBandWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  /** Główna wiązka — oryginalna szerokość */
  sunBandGrad: {
    width: width * 0.3,
    height: '112%',
    alignSelf: 'center',
  },
  /** Halo jednej wiązki — detal, bez drugiego przejazdu */
  sunBandGradHalo: {
    position: 'absolute',
    width: width * 0.45,
    height: '118%',
    alignSelf: 'center',
  },
  sunBlend: {
    mixBlendMode: 'screen',
  },
  lineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    width: '100%',
    maxWidth: width - 56,
    alignSelf: 'center',
  },
  lineRowSecondWrap: {
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  wordGroup: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  wordGap: {
    width: 10,
  },
  bootPlaceholder: {
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  charText: {
    color: 'rgba(248,248,252,0.98)',
    fontSize: 13.5,
    fontWeight: Platform.OS === 'ios' ? '500' : '600',
    letterSpacing: 2.75,
    ...Platform.select({
      ios: { fontFamily: 'AvenirNext-Medium' },
      android: { fontFamily: 'sans-serif-medium' },
      default: {},
    }),
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 5,
  },
});
