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

const PARTICLE_COUNT = 72;

/** Responsywne, większe logo — ograniczenie szer./wys. ekranu + cap na tabletach */
const LOGO_SIZE = Math.round(
  Math.min(Math.max(width * 0.88, 260), height * 0.48, 540)
);

const T = {
  logoStart: 120,
  /** Rozświetlenie jak luksusowy reveal: długo i bez „szarpnięcia” na końcu. */
  logoLightMs: 2600,
  /** Pierwsza litera zaraz po zakończeniu rozświetlenia loga. */
  gapLogoToLine1: 0,
  lineGapAfter1: 72,
  sunGapAfter2: 56,
  /** Wolniejszy „luksusowy” złoty błysk — dłuższy przejazd wiązki. */
  sunDuration: 2750,
  /** Tuż po końcu błysku — bez przerwy przed lotem. */
  flyOutGapAfterSun: 0,
  flyOutMs: 380,
  /** Wyraźniejsze „rozsuwanie” jak w pierwszej wersji (v1 miało ~1200 ms) */
  doorDuration: 1180,
  doorSoundLead: 26,
} as const;

/** Pierwsza linia tekstu wcześniej o tyle ms (nakłada się na rozświetlanie loga). */
const LINE1_START_ADVANCE_MS = 2000;

/** 0 = drzwi dopiero po zakończeniu odlotu (bez nakładania się — widać pełne otwarcie). */
const DOOR_OPEN_EARLIER_MS = 0;

/** Start odlotu (logo + tekst + backdrop) — o tyle wcześniej względem końca błysku. */
const FLY_OUT_EARLIER_MS = 1200;

const EXIT_UP = -height * 0.52;
const EXIT_DOWN = height * 0.52;

function Particle({
  startX,
  startY,
  size,
  duration,
  delay,
}: {
  startX: number;
  startY: number;
  size: number;
  duration: number;
  delay: number;
}) {
  const translateY = useSharedValue(startY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(Math.random() * 0.28 + 0.38, { duration: 1400 })
    );
    translateY.value = withRepeat(
      withTiming(startY - 280, { duration, easing: Easing.linear }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        { left: startX, width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
}

/** Słowa z pozycją startu w oryginalnym stringu (spacje zostają w układzie czasowym reveal). */
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
    const y = interpolate(reveal.value, [start, end], [13, 0], Extrapolation.CLAMP);
    return {
      opacity: o,
      transform: [{ translateY: y }],
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
        if (!cancelled) {
          setTaglineBoot({
            line2: TAGLINE_ROTATION[slot],
            slotIndex: slot,
          });
        }
      } catch {
        if (!cancelled) {
          setTaglineBoot({ line2: TAGLINE_ROTATION[0], slotIndex: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logoOpacity = useSharedValue(0);

  const line1Reveal = useSharedValue(0);
  const line2Reveal = useSharedValue(0);
  const sunSweep = useSharedValue(0);

  const backdropOpacity = useSharedValue(1);
  /** 0 = centrum, 1 = logo i tekst poza ekranem — wtedy startują drzwi. */
  const exitLift = useSharedValue(0);
  const doorOpen = useSharedValue(0);

  const line2Len = taglineBoot?.line2.length ?? 0;

  const line1Start = Math.max(
    T.logoStart,
    T.logoStart + T.logoLightMs + T.gapLogoToLine1 - LINE1_START_ADVANCE_MS
  );
  const line2Start =
    line1Start + LINE1.length * STAGGER_MS + T.lineGapAfter1;
  const sunStart = line2Start + line2Len * STAGGER_MS + T.sunGapAfter2;
  const flyOutStart = Math.max(
    0,
    sunStart + T.sunDuration + T.flyOutGapAfterSun - FLY_OUT_EARLIER_MS
  );
  const doorMotionStart = flyOutStart + T.flyOutMs;
  const doorOpenAt = Math.max(0, doorMotionStart - DOOR_OPEN_EARLIER_MS);

  const particles = useMemo(
    () =>
      taglineBoot
        ? Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
            id: i,
            startX: Math.random() * width,
            startY: Math.random() * height + 80,
            size: Math.random() * 2.2 + 2.1,
            duration: 9000 + Math.random() * 8000,
            delay: Math.random() * 1400,
          }))
        : [],
    [taglineBoot]
  );

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

  useEffect(() => {
    if (!taglineBoot || line2Len === 0) return;

    const nextSlot = (taglineBoot.slotIndex + 1) % TAGLINE_ROTATION.length;

    const runFinish = () => {
      void AsyncStorage.setItem(SPLASH_TAGLINE_STORAGE_KEY, String(nextSlot));
      finishRef.current();
    };

    logoOpacity.value = withDelay(
      T.logoStart,
      withTiming(1, {
        duration: T.logoLightMs,
        easing: Easing.bezier(0.11, 0.008, 0.09, 1),
      })
    );

    const line1Dur = Math.max(220, LINE1.length * STAGGER_MS + 100);
    line1Reveal.value = withDelay(
      line1Start,
      withTiming(1, {
        duration: line1Dur,
        easing: Easing.bezier(0.25, 0.1, 0.15, 1),
      })
    );

    const line2Dur = Math.max(220, line2Len * STAGGER_MS + 100);
    line2Reveal.value = withDelay(
      line2Start,
      withTiming(1, {
        duration: line2Dur,
        easing: Easing.bezier(0.25, 0.1, 0.15, 1),
      })
    );

    sunSweep.value = withDelay(
      sunStart,
      withTiming(1, {
        duration: T.sunDuration,
        easing: Easing.bezier(0.4, 0.02, 0.18, 1),
      })
    );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jednorazowa sekwencja po znanym tagline
  }, [taglineBoot]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const leftDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -doorOpen.value * (width / 2 + 50) }],
  }));

  const rightDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: doorOpen.value * (width / 2 + 50) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      {
        translateY: interpolate(exitLift.value, [0, 1], [0, EXIT_UP], Extrapolation.CLAMP),
      },
    ],
  }));

  const textClusterStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(exitLift.value, [0, 1], [0, EXIT_DOWN], Extrapolation.CLAMP),
      },
    ],
  }));

  /** Wiązka — nieco dłuższy przejazd po osi X niż wcześniej */
  const sunBandStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sunSweep.value, [0, 1], [-width * 0.52, width * 0.52], Extrapolation.CLAMP),
      },
    ],
    opacity: interpolate(sunSweep.value, [0, 0.08, 0.92, 1], [0, 0.94, 0.94, 0], Extrapolation.CLAMP),
  }));

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
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        {/** Jedna warstwa — bez jasnych nakładek (wcześniej przy drzwiach zostawała „poświata”) */}
        <LinearGradient
          colors={['#0a0a0c', '#030303', '#000000']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.doorStage} pointerEvents="none">
        {/** Pełna czerń — przy środku nie ma jaśniejszej krawędzi (#15151a) przy rozsuwaniu */}
        <Animated.View style={[styles.doorLeft, styles.doorFillBlack, leftDoorStyle]} pointerEvents="none" />
        <Animated.View style={[styles.doorRight, styles.doorFillBlack, rightDoorStyle]} pointerEvents="none" />
      </View>

      <Animated.View style={contentStyle} pointerEvents="none">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}

        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

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
            </Animated.View>
          </View>
        </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Przezroczysty — po zaniku backdropu i przy otwartych drzwiach widać aplikację pod spodem (nie czarną „podłogę”). */
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
  particle: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
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
  /** Węższa wiązka — światło jedzie nad samym tekstem (nie „zasłania” całej szerokości) */
  sunBandGrad: {
    width: width * 0.3,
    height: '112%',
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
      ios: {
        fontFamily: 'AvenirNext-Medium',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
      default: {},
    }),
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 5,
  },
});
