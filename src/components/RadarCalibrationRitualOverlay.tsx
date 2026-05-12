import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// === KONSTANTY BARWNE I TECHNICZNE ===
const RR_BLACK = '#040405';
const RR_GRAPHITE = '#101014';
const RR_GOLD = '#c9b07d';
const RR_GOLD_SOFT = 'rgba(201, 176, 125, 0.45)';
const RR_IVORY = '#ebe7df';
const STATUS_GREEN = '#32D74B'; // Apple iOS Green

// === TIMINGI FAZ ===
// UWAGA: skan (PHASE_SCAN_MS) i odsłonięcie liczby ofert (COUNT_SHOW_DELAY_MS)
// pozostają bez zmian — to jest ten kluczowy „moment ofert", od którego user
// chce dynamicznego pchnięcia tempa. Wszystkie poniższe fazy (msg → gears →
// brand) zostały skrócone, ale ŻADNA nie została wycięta.
const PHASE_SCAN_MS = 4600;
const COUNT_SHOW_DELAY_MS = 160;
const MESSAGE_AFTER_COUNT_MS = 950;   // 1500 → szybsze pojawienie się komunikatu kalibracji
const GEARS_AFTER_MSG_MS = 220;       // 380 → krótsza pauza przed zębatkami

const GEARS_APPEAR_MS = 240;          // 400 → ostrzejszy fade-in
const GEARS_FAST_SPIN_MS = 800;       // 1400 → znacznie szybsze rozpędzanie (same ±1440° = większa prędkość kątowa)
const GEARS_MERGE_MS = 460;           // 1000 → dynamiczny zatrzask
const GEARS_SLOW_SPIN_MS = 700;       // 2000 → krótkie dotoczenie po sczepieniu, brand wskakuje szybciej

const BRAND_HOLD_MS = 2600;
const CINEMATIC_OUT_MS = 720;

const GEARS_PHASE_START_MS =
  PHASE_SCAN_MS + COUNT_SHOW_DELAY_MS + MESSAGE_AFTER_COUNT_MS + GEARS_AFTER_MSG_MS;

// Brand pokazuje się 80 ms po sczepieniu (zamiast 200) — wrażenie „klik → tabliczka”.
const BRAND_VISIBLE_AT_MS =
  GEARS_PHASE_START_MS + GEARS_APPEAR_MS + GEARS_FAST_SPIN_MS + GEARS_MERGE_MS + 80;

const GOLD_COG = '#F4E8CC';
const GOLD_COG_SHADOW = '#C9A227';
const SWEEP_MS_PER_TURN = 5200;
const TRAIL_SECTOR_DEG = 40;
const BLIP_COUNT = 8;

const COG_SIZE = 96;
const INITIAL_GEAR_SEP = 60;

const BLIP_SCATTER: { angleDeg: number; distMul: number }[] = [
  { angleDeg: 43, distMul: 0.74 },
  { angleDeg: 118, distMul: 0.66 },
  { angleDeg: 171, distMul: 0.81 },
  { angleDeg: 229, distMul: 0.69 },
  { angleDeg: 287, distMul: 0.77 },
  { angleDeg: 338, distMul: 0.64 },
  { angleDeg: 89, distMul: 0.84 },
  { angleDeg: 204, distMul: 0.71 },
];

const BLIP_DETECT_ANGLES = BLIP_SCATTER.map((b) => b.angleDeg);
const TICK_DEGREES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function polarFromTop(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function sectorPiePath(cx: number, cy: number, r: number, degStart: number, degEnd: number): string {
  const p1 = polarFromTop(cx, cy, r, degStart);
  const p2 = polarFromTop(cx, cy, r, degEnd);
  let sweep = degEnd - degStart;
  while (sweep <= 0) sweep += 360;
  while (sweep > 360) sweep -= 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

type Props = {
  visible: boolean;
  cityLabel: string;
  transactionType: 'RENT' | 'SELL';
  matchingOffersCount: number;
  onComplete: () => void;
};

const STAR_SEEDS = Array.from({ length: 56 }, (_, i) => ({
  id: i,
  x: ((i * 9301 + 49297) % 233280) / 233280,
  y: ((i * 7919 + 15485863) % 233280) / 233280,
  s: 0.6 + (((i * 17) % 40) / 100),
}));

function Star({
  x,
  y,
  size,
  phase,
  screenWidth,
  screenHeight,
}: {
  x: number;
  y: number;
  size: number;
  phase: SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.35, 0.7, 1], [0, 0.12 + (x + y) * 0.15, 0.45 + x * 0.2, 0.18], 'clamp'),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.starDot,
        { left: x * screenWidth, top: y * screenHeight * 0.72, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

function RadarTicks({ radius }: { radius: number }) {
  const tickLen = radius * 0.44;
  const tickTop = radius * 0.06;
  return (
    <View style={[styles.tickLayer, { width: radius, height: radius }]} pointerEvents="none">
      {TICK_DEGREES.map((deg) => (
        <View key={deg} style={[styles.tickArm, { width: radius, height: radius, transform: [{ rotate: `${deg}deg` }] }]}>
          <View style={[styles.tickMark, { height: tickLen, marginTop: tickTop }]} />
        </View>
      ))}
    </View>
  );
}

function GoldGearIcon({ size, rotation }: { size: number; rotation: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.goldCogStack, { width: size + 8, height: size + 8 }, animatedStyle]} pointerEvents="none">
      <Ionicons name="cog" size={size} color="rgba(40,32,18,0.55)" style={[styles.goldCogLayer, { transform: [{ translateX: 2.2 }, { translateY: 2.8 }] }]} />
      <Ionicons name="cog" size={size} color={GOLD_COG} style={[styles.goldCogLayer, { textShadowColor: GOLD_COG_SHADOW, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }]} />
    </Animated.View>
  );
}

function SweepTrailPie({ radarSize, accentMid, accentBright }: { radarSize: number; accentMid: string; accentBright: string }) {
  const cx = radarSize / 2;
  const cy = radarSize / 2;
  const rr = radarSize / 2 - 8;
  const d = sectorPiePath(cx, cy, rr, -TRAIL_SECTOR_DEG, 0);
  return (
    <Svg width={radarSize} height={radarSize} style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id="trailPieCalibGrad" x1={cx} y1={cy} x2={cx + rr * 0.85} y2={cy - rr * 0.85} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accentBright} stopOpacity={0.95} />
          <Stop offset="0.45" stopColor={accentMid} stopOpacity={0.5} />
          <Stop offset="1" stopColor={accentBright} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      <Path d={d} fill="url(#trailPieCalibGrad)" />
    </Svg>
  );
}

function RadarBlip({ center, angleDeg, dist, opacitySv }: { center: number; angleDeg: number; dist: number; opacitySv: SharedValue<number> }) {
  const rad = (angleDeg * Math.PI) / 180;
  const left = center + dist * Math.sin(rad) - 6;
  const top = center - dist * Math.cos(rad) - 6;
  const style = useAnimatedStyle(() => ({
    opacity: opacitySv.value,
    transform: [{ scale: interpolate(opacitySv.value, [0, 1], [0.25, 1]) }],
  }));
  return (
    <Animated.View style={[styles.blipWrap, { left, top }, style]} pointerEvents="none">
      <View style={styles.blipGlow} />
      <View style={styles.blipCore} />
    </Animated.View>
  );
}

function OfferCount3D({
  count,
  accentHex,
  scale,
  opacity,
  screenWidth,
}: {
  count: number;
  accentHex: string;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  screenWidth: number;
}) {
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const label = String(Math.max(0, count));
  const fs = label.length > 2 ? 96 : 124;
  const textW = screenWidth;
  
  return (
    <Animated.View style={[styles.countStage, wrapStyle]}>
      <Text style={[styles.countDeep, { fontSize: fs, width: textW, textAlign: 'center' }]}>{label}</Text>
      <Text style={[styles.countShadow, { fontSize: fs, color: accentHex, width: textW, textAlign: 'center' }]}>{label}</Text>
      <Text style={[styles.countBody, { fontSize: fs, color: accentHex, width: textW, textAlign: 'center' }]}>{label}</Text>
      <Text style={[styles.countSheen, { fontSize: fs * 0.92, width: textW, textAlign: 'center' }]}>{label}</Text>
      <Text style={[styles.countCaption, { width: textW, textAlign: 'center' }]}>ofert na mapie</Text>
    </Animated.View>
  );
}

function CascadedMicroText({
  text,
  progress,
  baseStyle,
  charDelay = 0.042,
  staggerDirection = 'forward',
}: {
  text: string;
  progress: SharedValue<number>;
  baseStyle: any;
  charDelay?: number;
  staggerDirection?: 'forward' | 'backward';
}) {
  const chars = useMemo(() => text.split(''), [text]);
  return (
    <View style={styles.cascadeWrap}>
      {chars.map((ch, i) => (
        <CascadeChar
          key={`${ch}-${i}`}
          ch={ch}
          progress={progress}
          index={staggerDirection === 'forward' ? i : chars.length - 1 - i}
          total={chars.length}
          baseStyle={baseStyle}
          charDelay={charDelay}
        />
      ))}
    </View>
  );
}

function CascadeChar({
  ch,
  progress,
  index,
  total,
  baseStyle,
  charDelay,
}: {
  ch: string;
  progress: SharedValue<number>;
  index: number;
  total: number;
  baseStyle: any;
  charDelay: number;
}) {
  const unit = total > 1 ? 1 / (total - 1) : 1;
  const charStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value - index * charDelay) / Math.max(0.001, 0.28)));
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 8 }, { scale: 0.985 + t * 0.015 }],
    };
  });
  return (
    <Animated.Text style={[baseStyle, charStyle, { marginRight: ch === ' ' ? 3 : 0, letterSpacing: unit < 0.05 ? 0.4 : undefined }]}>
      {ch === ' ' ? '\u00A0' : ch}
    </Animated.Text>
  );
}

export default function RadarCalibrationRitualOverlay({ visible, cityLabel, transactionType, matchingOffersCount, onComplete }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const shorterSide = Math.min(screenWidth, screenHeight);
  const isTabletLike = shorterSide >= 700;
  const radarSize = Math.min(shorterSide * (isTabletLike ? 0.42 : 0.44), isTabletLike ? 420 : 312);
  const cardWidth = Math.min(screenWidth - (isTabletLike ? 120 : 58), isTabletLike ? 540 : 360);
  const countOverlayTop = Math.max(isTabletLike ? 32 : 20, Math.min(72, screenHeight * 0.072));
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const radarSoundRef = useRef<Audio.Sound | null>(null);

  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);
  const vignette = useSharedValue(0);
  const line1 = useSharedValue(0);
  const line2 = useSharedValue(0);
  const line3 = useSharedValue(0);
  const phase = useSharedValue(0);
  const scanActive = useSharedValue(0);
  const dotMask = useSharedValue(0);
  const dotOp0 = useSharedValue(0); const dotOp1 = useSharedValue(0);
  const dotOp2 = useSharedValue(0); const dotOp3 = useSharedValue(0);
  const dotOp4 = useSharedValue(0); const dotOp5 = useSharedValue(0);
  const dotOp6 = useSharedValue(0); const dotOp7 = useSharedValue(0);
  const radarGroupOpacity = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const dustOpacity = useSharedValue(0);
  const countScale = useSharedValue(0.12);
  const countOpacity = useSharedValue(0);
  const calibMsgOpacity = useSharedValue(0);
  
  const gearsOpacity = useSharedValue(0);
  const gearRotL = useSharedValue(0);
  const gearRotR = useSharedValue(0);
  const gearSepL = useSharedValue(-INITIAL_GEAR_SEP); 
  const gearSepR = useSharedValue(INITIAL_GEAR_SEP);  
  
  const brandOpacity = useSharedValue(0);
  const brandMicroTextIn = useSharedValue(0);
  const bottomMicroTextIn = useSharedValue(0);
  const statusPulse = useSharedValue(0);
  const exitOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);

  const accentHex = transactionType === 'RENT' ? '#0A84FF' : '#34C759';
  const trailB = transactionType === 'RENT' ? 'rgba(10,132,255,0.55)' : 'rgba(52,199,89,0.58)';
  const trailC = transactionType === 'RENT' ? 'rgba(40,160,255,0.95)' : 'rgba(80,230,125,0.95)';

  const triggerBlip = useCallback((idx: number) => {
    Haptics.selectionAsync();
    const ops = [dotOp0, dotOp1, dotOp2, dotOp3, dotOp4, dotOp5, dotOp6, dotOp7];
    const op = ops[idx];
    if (op) op.value = withSpring(1, { damping: 15, stiffness: 280 });
  }, [dotOp0, dotOp1, dotOp2, dotOp3, dotOp4, dotOp5, dotOp6, dotOp7]);

  useAnimatedReaction(
    () => sweep.value,
    (sv) => {
      if (scanActive.value === 0) return;
      const ang = ((sv % 360) + 360) % 360;
      for (let i = 0; i < BLIP_COUNT; i++) {
        const target = BLIP_DETECT_ANGLES[i];
        const diff = Math.abs(ang - target);
        const dist = Math.min(diff, 360 - diff);
        const bit = 1 << i;
        if (dist < 5.5 && (dotMask.value & bit) === 0) {
          dotMask.value |= bit;
          runOnJS(triggerBlip)(i);
        }
      }
    },
    [triggerBlip]
  );

  useEffect(() => {
    if (!visible) {
      sweep.value = 0; pulse.value = 0; vignette.value = 0; line1.value = 0; line2.value = 0; line3.value = 0; phase.value = 0;
      scanActive.value = 0; dotMask.value = 0;
      dotOp0.value = 0; dotOp1.value = 0; dotOp2.value = 0; dotOp3.value = 0; dotOp4.value = 0; dotOp5.value = 0; dotOp6.value = 0; dotOp7.value = 0;
      radarGroupOpacity.value = 1; flashOpacity.value = 0; dustOpacity.value = 0; countScale.value = 0.12; countOpacity.value = 0; calibMsgOpacity.value = 0;
      brandOpacity.value = 0; brandMicroTextIn.value = 0; bottomMicroTextIn.value = 0; statusPulse.value = 0; exitOpacity.value = 1; exitScale.value = 1;
      gearsOpacity.value = 0; gearRotL.value = 0; gearRotR.value = 0;
      gearSepL.value = -INITIAL_GEAR_SEP; gearSepR.value = INITIAL_GEAR_SEP;
      cancelAnimation(sweep);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    scanActive.value = 1; dotMask.value = 0;
    
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(360, { duration: SWEEP_MS_PER_TURN, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 2200, easing: Easing.bezier(0.22, 0.01, 0.2, 1) }), withTiming(0.35, { duration: 2600, easing: Easing.bezier(0.22, 0.01, 0.2, 1) })),
      -1, true
    );
    vignette.value = withTiming(1, { duration: 900, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
    phase.value = withTiming(1, { duration: PHASE_SCAN_MS, easing: Easing.linear });
    line1.value = withDelay(200, withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 0.01, 0.2, 1) }));
    line2.value = withDelay(800, withTiming(1, { duration: 1000, easing: Easing.bezier(0.22, 0.01, 0.2, 1) }));
    line3.value = withDelay(1500, withTiming(1, { duration: 800, easing: Easing.bezier(0.22, 0.01, 0.2, 1) }));

    const tScanEnd = setTimeout(() => {
      scanActive.value = 0;
      cancelAnimation(sweep);
      radarGroupOpacity.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      flashOpacity.value = withSequence(withTiming(1, { duration: 70 }), withTiming(1, { duration: 120 }), withTiming(0.72, { duration: 280 }), withTiming(0, { duration: 420 }));
      dustOpacity.value = withSequence(withDelay(80, withTiming(0.55, { duration: 220 })), withTiming(0.22, { duration: 380 }), withTiming(0, { duration: 420 }));
      countOpacity.value = withDelay(160, withTiming(1, { duration: 140 }));
      countScale.value = 0.14;
      countScale.value = withDelay(160, withSpring(1, { damping: 13.5, stiffness: 210, mass: 0.82 }));
    }, PHASE_SCAN_MS);

    const tImpact = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, PHASE_SCAN_MS + 520);

    const tCalibMsg = setTimeout(() => {
      calibMsgOpacity.value = withTiming(1, { duration: 360, easing: Easing.bezier(0.22, 0.01, 0.2, 1) });
    }, PHASE_SCAN_MS + COUNT_SHOW_DELAY_MS + MESSAGE_AFTER_COUNT_MS);

    const tGearsStart = setTimeout(() => {
      gearsOpacity.value = withTiming(1, { duration: GEARS_APPEAR_MS });
      // Bardziej agresywny rozpęd — mocniej „in", żeby ostatnie 200 ms latały już bardzo szybko.
      gearRotL.value = withTiming(-1440, { duration: GEARS_FAST_SPIN_MS, easing: Easing.bezier(0.7, 0, 0.84, 0.2) });
      gearRotR.value = withTiming(1440, { duration: GEARS_FAST_SPIN_MS, easing: Easing.bezier(0.7, 0, 0.84, 0.2) });
    }, GEARS_PHASE_START_MS);

    const tGearsMerge = setTimeout(() => {
      // Sczepienie zębatek — dynamiczny zatrzask z lekkim „back" easingiem.
      gearSepL.value = withTiming(-5, { duration: GEARS_MERGE_MS, easing: Easing.bezier(0.34, 1.2, 0.4, 1) });
      gearSepR.value = withTiming(5, { duration: GEARS_MERGE_MS, easing: Easing.bezier(0.34, 1.2, 0.4, 1) });

      // Krótkie dotoczenie po sczepieniu — zachowane, ale wyraźnie skrócone (GEARS_SLOW_SPIN_MS = 700).
      gearRotL.value = withSequence(
        withTiming(-1500, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(-1500 + 360, { duration: GEARS_MERGE_MS + GEARS_SLOW_SPIN_MS - 140, easing: Easing.out(Easing.quad) })
      );

      gearRotR.value = withSequence(
        withTiming(1560, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(1560 - 372, { duration: GEARS_MERGE_MS + GEARS_SLOW_SPIN_MS - 140, easing: Easing.out(Easing.quad) })
      );
    }, GEARS_PHASE_START_MS + GEARS_FAST_SPIN_MS);

    const tGearsLockHaptic = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Haptics.selectionAsync();
    }, GEARS_PHASE_START_MS + GEARS_FAST_SPIN_MS + GEARS_MERGE_MS - 80);

    const tBrand = setTimeout(() => {
      // Tabliczka „radar aktywny" wskakuje już 80 ms po sczepieniu — czuć efekt
      // „klik → kompletny system". Wszystkie sub-animacje też dostały krótsze duration.
      brandOpacity.value = withTiming(1, { duration: 340, easing: Easing.bezier(0.22, 0.01, 0.2, 1) });
      brandMicroTextIn.value = withTiming(1, { duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
      bottomMicroTextIn.value = withDelay(80, withTiming(1, { duration: 440, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
      statusPulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }), withTiming(0.2, { duration: 720, easing: Easing.inOut(Easing.cubic) })),
        -1, true
      );
    }, BRAND_VISIBLE_AT_MS);

    const tCurtain = setTimeout(() => {
      exitScale.value = withTiming(1.07, { duration: CINEMATIC_OUT_MS * 0.55, easing: Easing.out(Easing.cubic) });
      exitOpacity.value = withTiming(0, { duration: CINEMATIC_OUT_MS, easing: Easing.in(Easing.cubic) });
    }, BRAND_VISIBLE_AT_MS + BRAND_HOLD_MS);

    const tDone = setTimeout(() => { completeRef.current(); }, BRAND_VISIBLE_AT_MS + BRAND_HOLD_MS + CINEMATIC_OUT_MS);

    return () => { 
      clearTimeout(tScanEnd); clearTimeout(tImpact); clearTimeout(tCalibMsg); 
      clearTimeout(tGearsStart); clearTimeout(tGearsMerge); clearTimeout(tGearsLockHaptic);
      clearTimeout(tBrand); clearTimeout(tCurtain); clearTimeout(tDone); 
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const playRadarCalibrationSound = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, allowsRecordingIOS: false, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync(require('../../assets/radar.mp3'), { shouldPlay: false, volume: 1, isLooping: false });
        if (cancelled) { await sound.unloadAsync(); return; }
        radarSoundRef.current = sound;
        await sound.playAsync();
      } catch {}
    };
    playRadarCalibrationSound();
    return () => {
      cancelled = true;
      const s = radarSoundRef.current;
      radarSoundRef.current = null;
      if (s) { s.stopAsync().catch(() => {}); s.unloadAsync().catch(() => {}); }
    };
  }, [visible]);

  // === STYLE ANIMOWANE ===
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value}deg` }] }));
  const ring1Style = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0.35, 1], [0.22, 0.5], 'clamp'), transform: [{ scale: interpolate(pulse.value, [0.35, 1], [0.96, 1.02], 'clamp') }] }));
  const ring2Style = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0.35, 1], [0.12, 0.28], 'clamp'), transform: [{ scale: interpolate(pulse.value, [0.35, 1], [0.92, 1.05], 'clamp') }] }));
  const lineAStyle = useAnimatedStyle(() => ({ opacity: line1.value * radarGroupOpacity.value, transform: [{ translateY: interpolate(line1.value, [0, 1], [12, 0], 'clamp') }] }));
  const lineBStyle = useAnimatedStyle(() => ({ opacity: line2.value * radarGroupOpacity.value, transform: [{ translateY: interpolate(line2.value, [0, 1], [12, 0], 'clamp') }] }));
  const vignetteStyle = useAnimatedStyle(() => ({ opacity: vignette.value * 0.95 }));
  const radarFadeStyle = useAnimatedStyle(() => ({ opacity: radarGroupOpacity.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const dustStyle = useAnimatedStyle(() => ({ opacity: dustOpacity.value }));
  const calibMsgStyle = useAnimatedStyle(() => ({ opacity: calibMsgOpacity.value }));
  const gearLAnim = useAnimatedStyle(() => ({ opacity: gearsOpacity.value, transform: [{ translateX: gearSepL.value }] }));
  const gearRAnim = useAnimatedStyle(() => ({ opacity: gearsOpacity.value, transform: [{ translateX: gearSepR.value }] }));
  const brandStyle = useAnimatedStyle(() => ({ opacity: brandOpacity.value, transform: [{ translateY: interpolate(brandOpacity.value, [0, 1], [10, 0]) }] }));
  const statusDotStyle = useAnimatedStyle(() => ({ opacity: interpolate(statusPulse.value, [0.2, 1], [0.48, 1], 'clamp'), transform: [{ scale: interpolate(statusPulse.value, [0.2, 1], [0.82, 1.18], 'clamp') }] }));
  const statusHaloStyle = useAnimatedStyle(() => ({ opacity: interpolate(statusPulse.value, [0.2, 1], [0.06, 0.32], 'clamp'), transform: [{ scale: interpolate(statusPulse.value, [0.2, 1], [1, 1.9], 'clamp') }] }));
  const finaleRootStyle = useAnimatedStyle(() => ({ opacity: exitOpacity.value, transform: [{ scale: exitScale.value }] }));

  const stars = useMemo(() => STAR_SEEDS, []);
  const blipOpacityByIndex = [dotOp0, dotOp1, dotOp2, dotOp3, dotOp4, dotOp5, dotOp6, dotOp7];

  if (!visible) return null;

  const cityText = cityLabel.trim() ? cityLabel : 'Wybrana metropolia';
  const cx = radarSize / 2;

  return (
    <Animated.View style={[styles.fill, finaleRootStyle]} pointerEvents="auto">
      <LinearGradient colors={[RR_BLACK, RR_GRAPHITE, '#060608', RR_BLACK]} locations={[0, 0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />

      {stars.map((st) => (
        <Star key={st.id} x={st.x} y={st.y} size={st.s} phase={phase} screenWidth={screenWidth} screenHeight={screenHeight} />
      ))}

      <Animated.View style={[styles.vignette, vignetteStyle]} pointerEvents="none">
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.flashBurst, flashStyle]} pointerEvents="none">
        <LinearGradient colors={['rgba(255,255,255,1)', 'rgba(250,250,252,0.96)', 'rgba(255,255,255,0.88)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.dustLayer, dustStyle]} pointerEvents="none">
        {STAR_SEEDS.slice(0, 24).map((st) => (
          <View key={`d-${st.id}`} style={[styles.dustMote, { left: st.x * screenWidth, top: st.y * screenHeight * 0.85, width: 2 + (st.id % 4), height: 2 + (st.id % 4), opacity: 0.35 + (st.id % 7) / 30 }]} />
        ))}
      </Animated.View>

      <View style={styles.topRule}>
        <View style={styles.ruleGold} />
      </View>

      <View style={styles.centerBlock}>
        <Animated.View style={[radarFadeStyle, { alignItems: 'center', marginBottom: 24 }]}>
          <Text style={styles.brandTopTitle}>EstateOS™ Radar</Text>
          <Text style={styles.brandTopSubtitle}>KALIBRACJA SYSTEMU</Text>
        </Animated.View>

        <Animated.View style={[radarFadeStyle, { alignItems: 'center' }]}>
          <View style={[styles.radarPedestal, { width: radarSize + 52, height: radarSize + 52 }]}>
            <BlurView intensity={Platform.OS === 'ios' ? 34 : 22} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined} style={[styles.radarBlurUnder, { borderRadius: (radarSize + 52) / 2 }]} />
            <LinearGradient colors={['rgba(45,42,36,0.95)', 'rgba(12,12,16,1)', 'rgba(8,8,10,1)']} style={[styles.radarBezelOuter, { width: radarSize + 44, height: radarSize + 44, borderRadius: (radarSize + 44) / 2 }]}>
              <View style={[styles.radarWrap, { width: radarSize + 38, height: radarSize + 38 }]}>
                <Animated.View style={[styles.ringOuter, ring2Style, { width: radarSize + 36, height: radarSize + 36, borderRadius: (radarSize + 36) / 2 }]} />
                <Animated.View style={[styles.ringMid, ring1Style, { width: radarSize + 14, height: radarSize + 14, borderRadius: (radarSize + 14) / 2 }]} />

                <LinearGradient colors={['#4a453c', '#2c2a26', '#18181c']} start={{ x: 0.2, y: 0 }} end={{ x: 0.85, y: 1 }} style={[styles.metalBezel, { width: radarSize + 10, height: radarSize + 10, borderRadius: (radarSize + 10) / 2 }]}>
                  <View style={[styles.radarDisk, { width: radarSize, height: radarSize, borderRadius: radarSize / 2 }]}>
                    <LinearGradient colors={['rgba(210,195,155,0.14)', 'rgba(22,22,28,0.97)', 'rgba(6,6,9,1)', RR_GRAPHITE]} locations={[0, 0.35, 0.72, 1]} start={{ x: 0.35, y: 0 }} end={{ x: 0.65, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radarSize / 2 }]} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']} locations={[0, 0.45, 1]} style={[StyleSheet.absoluteFill, { borderRadius: radarSize / 2 }]} pointerEvents="none" />
                    <LinearGradient colors={['rgba(255,255,255,0.11)', 'transparent', 'transparent']} locations={[0, 0.35, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={[styles.rimLight, { borderRadius: radarSize / 2 }]} pointerEvents="none" />
                    <RadarTicks radius={radarSize} />

                    {BLIP_SCATTER.map((b, i) => (
                      <RadarBlip key={`blip-${b.angleDeg}-${i}`} center={cx} angleDeg={b.angleDeg} dist={(radarSize / 2) * b.distMul} opacitySv={blipOpacityByIndex[i]} />
                    ))}

                    <Animated.View style={[sweepStyle, styles.sweepSpinner, { width: radarSize, height: radarSize }]}>
                      <SweepTrailPie radarSize={radarSize} accentMid={trailB} accentBright={trailC} />
                    </Animated.View>

                    <Animated.View style={[sweepStyle, styles.sweepSpinner, { width: radarSize, height: radarSize }]}>
                      <LinearGradient colors={['transparent', 'rgba(201,176,125,0.1)', 'rgba(201,176,125,0.04)', 'transparent']} start={{ x: 0.12, y: 1 }} end={{ x: 0.88, y: 0 }} style={{ marginTop: radarSize * 0.024, width: radarSize * 0.38, height: radarSize * 0.44, borderRadius: 8, opacity: 0.75 }} />
                    </Animated.View>
                    <Animated.View style={[sweepStyle, styles.sweepSpinner, { width: radarSize, height: radarSize }]}>
                      <LinearGradient colors={['transparent', RR_GOLD_SOFT, 'rgba(255,250,240,0.55)', 'transparent']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={[styles.sweepCore, { marginTop: radarSize * 0.026, width: Math.max(2.5, radarSize * 0.036), height: radarSize * 0.46 }]} />
                    </Animated.View>
                    <View style={[styles.centerDot, { position: 'absolute', left: radarSize / 2 - 5, top: radarSize / 2 - 5, width: 10, height: 10, borderRadius: 5 }]} />
                    <View pointerEvents="none" style={[styles.centerDotInner, { position: 'absolute', left: radarSize / 2 - 2, top: radarSize / 2 - 2, width: 4, height: 4, borderRadius: 2 }]} />
                  </View>
                </LinearGradient>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View style={lineAStyle}>
          <Text style={styles.subline}>{cityText}</Text>
        </Animated.View>
        <Animated.View style={lineBStyle}>
          <Text style={styles.whisper}>Nasłuchiwanie rynku w toku...</Text>
        </Animated.View>

        <View style={[styles.countOverlay, { paddingTop: countOverlayTop, paddingHorizontal: isTabletLike ? 44 : 20 }]} pointerEvents="none">
          <OfferCount3D count={matchingOffersCount} accentHex={accentHex} scale={countScale} opacity={countOpacity} screenWidth={screenWidth} />
          
          <Animated.View style={[styles.calibMsgWrap, calibMsgStyle, { maxWidth: screenWidth - (isTabletLike ? 140 : 44) }]}>
            <Text style={styles.calibMsgTitle}>
              Radar został poprawnie skalibrowany i jest gotowy do natychmiastowego informowania. Tryb czuwania został załączony.
            </Text>
          </Animated.View>
          
          <View style={styles.gearsRow}>
            <Animated.View style={[styles.gearIcon, gearLAnim]}>
              <GoldGearIcon size={COG_SIZE} rotation={gearRotL} />
            </Animated.View>
            <Animated.View style={[styles.gearIcon, gearRAnim]}>
              <GoldGearIcon size={COG_SIZE} rotation={gearRotR} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.brandBlock, brandStyle, { marginTop: isTabletLike ? 40 : 32 }]}>
            <View style={[styles.brandCard, { width: cardWidth, borderRadius: isTabletLike ? 28 : 24, paddingVertical: isTabletLike ? 28 : 24, paddingHorizontal: isTabletLike ? 28 : 22 }]}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(212,175,55,0.15)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
              
              <View style={[styles.brandBorder, { borderRadius: isTabletLike ? 28 : 24 }]} />
              <View style={styles.brandTopRule} />
              
              <CascadedMicroText text="INTELLIGENCE CORE" progress={brandMicroTextIn} baseStyle={[styles.brandEyebrow, isTabletLike && { fontSize: 11.5, letterSpacing: 4.2 }]} />
              <Text style={[styles.brandTitle, isTabletLike && { fontSize: 44 }]}>EstateOS™ Radar</Text>
              
              <View style={styles.brandDivider} />
              <View style={styles.statusRow}>
                <View style={styles.statusSignalWrap}>
                  <Animated.View style={[styles.statusSignalHalo, statusHaloStyle]} />
                  <Animated.View style={[styles.statusSignalDot, statusDotStyle]} />
                </View>
                <Text style={styles.brandStatus}>STATUS: AKTYWNY</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.bottomMark} pointerEvents="none">
        <CascadedMicroText
          text="PRECYZJA W CISZY · RADAR ESTATEOS"
          progress={bottomMicroTextIn}
          baseStyle={[styles.bottomText, isTabletLike && { fontSize: 10.5, letterSpacing: 3.3 }]}
          charDelay={0.028}
          staggerDirection="backward"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: RR_BLACK },
  flashBurst: { ...StyleSheet.absoluteFillObject, zIndex: 1500 },
  dustLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1510 },
  dustMote: { position: 'absolute', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.95)' },
  vignette: { ...StyleSheet.absoluteFillObject },
  starDot: { position: 'absolute', backgroundColor: GOLD_COG, shadowColor: GOLD_COG_SHADOW, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 5 },
  topRule: { paddingTop: Platform.OS === 'ios' ? 64 : 40, alignItems: 'center' },
  ruleGold: { width: 56, height: 1, backgroundColor: RR_GOLD, opacity: 0.85 },
  
  brandTopTitle: { 
    color: RR_IVORY, 
    fontSize: 24, 
    fontWeight: '800', 
    letterSpacing: 0.5, 
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-condensed',
    textShadowColor: 'rgba(0,0,0,0.8)', 
    textShadowOffset: { width: 0, height: 2 }, 
    textShadowRadius: 6 
  },
  brandTopSubtitle: { 
    color: RR_GOLD, 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 6, 
    marginTop: 4, 
    opacity: 0.85, 
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium' 
  },

  centerBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, marginTop: -14 },
  
  countOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-start', alignItems: 'center', zIndex: 1600 },
  calibMsgWrap: { marginTop: 14 },
  calibMsgTitle: { color: RR_IVORY, fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '500' },
  
  gearsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 28, 
    gap: 0, 
    height: COG_SIZE + 10, 
    width: COG_SIZE * 2 + 20, 
  },
  gearIcon: { position: 'absolute' },
  goldCogStack: { alignItems: 'center', justifyContent: 'center' },
  goldCogLayer: { position: 'absolute' },
  
  brandBlock: { marginTop: 32, width: '100%', paddingHorizontal: 10 },
  brandCard: { 
    borderRadius: 24, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(212,175,55,0.36)', 
    paddingVertical: 24, 
    paddingHorizontal: 22, 
    alignItems: 'center', 
    shadowColor: '#D4AF37', 
    shadowOffset: { width: 0, height: 12 }, 
    shadowOpacity: 0.35, 
    shadowRadius: 28, 
    elevation: 20 
  },
  brandBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  brandTopRule: { 
    width: 50, 
    height: 2, 
    backgroundColor: RR_GOLD, 
    opacity: 0.8, 
    marginBottom: 16, 
    shadowColor: RR_GOLD, 
    shadowOpacity: 1, 
    shadowRadius: 6, 
    shadowOffset: {width: 0, height: 0} 
  },
  brandEyebrow: { 
    color: 'rgba(244,232,204,0.65)', 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 3.4, 
    marginBottom: 10, 
    textAlign: 'center' 
  },
  brandTitle: { 
    color: '#F4E8CC', 
    fontSize: 36, 
    fontWeight: '900', 
    letterSpacing: -0.5, 
    textAlign: 'center', 
    textShadowColor: 'rgba(212,175,55,0.8)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 18 
  },
  brandDivider: { width: '50%', height: 1, backgroundColor: RR_GOLD_SOFT, marginTop: 18, marginBottom: 18 },
  
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  statusSignalWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  statusSignalHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: STATUS_GREEN },
  statusSignalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_GREEN, shadowColor: STATUS_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 10 },
  brandStatus: { color: STATUS_GREEN, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  
  countStage: { alignItems: 'center', justifyContent: 'center', minHeight: 230 },
  countDeep: { position: 'absolute', fontWeight: '900', color: 'rgba(0,0,0,0.45)', letterSpacing: -3, transform: [{ translateX: 5 }, { translateY: 7 }] },
  countShadow: { position: 'absolute', fontWeight: '900', letterSpacing: -3, opacity: 0.35, transform: [{ translateX: 3 }, { translateY: 4 }] },
  countBody: { position: 'absolute', fontWeight: '900', letterSpacing: -4, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 18 },
  countSheen: { position: 'absolute', fontWeight: '900', color: 'rgba(255,255,255,0.38)', letterSpacing: -3, transform: [{ translateX: -1.5 }, { translateY: -2 }] },
  countCaption: { marginTop: 120, fontSize: 13, fontWeight: '700', letterSpacing: 3, color: 'rgba(235,231,223,0.55)', textTransform: 'uppercase' },
  
  mark: { display: 'none' }, 
  
  radarPedestal: { alignItems: 'center', justifyContent: 'center', marginBottom: 36, position: 'relative' },
  radarBlurUnder: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  radarBezelOuter: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.58, shadowRadius: 32, elevation: 24 },
  metalBezel: { padding: 5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 14 },
  radarWrap: { alignItems: 'center', justifyContent: 'center' },
  rimLight: { position: 'absolute', left: 0, right: 0, top: 0, height: '56%' },
  sweepSpinner: { position: 'absolute', left: 0, top: 0, justifyContent: 'flex-start', alignItems: 'center' },
  sweepCore: { borderRadius: 2, shadowColor: RR_GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 6, elevation: 8 },
  tickLayer: { position: 'absolute', left: 0, top: 0 },
  tickArm: { position: 'absolute', left: 0, top: 0, justifyContent: 'flex-start', alignItems: 'center' },
  tickMark: { width: 1.5, backgroundColor: 'rgba(201,176,125,0.28)', borderRadius: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.65, shadowRadius: 2 },
  blipWrap: { position: 'absolute', width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  blipGlow: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,59,48,0.35)' },
  blipCore: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,220,218,0.95)', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 6, elevation: 6 },
  centerDotInner: { backgroundColor: 'rgba(255,252,245,0.95)', shadowColor: '#fff', shadowOpacity: 0.35, shadowRadius: 4 },
  ringOuter: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,176,125,0.2)' },
  ringMid: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(201,176,125,0.35)' },
  radarDisk: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(235,231,223,0.22)', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 16 },
  centerDot: { backgroundColor: RR_GOLD, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,250,240,0.35)', shadowColor: RR_GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.75, shadowRadius: 12, elevation: 10 },
  subline: { marginTop: 12, color: RR_GOLD, fontSize: 14, fontWeight: '600', letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  whisper: { marginTop: 18, color: 'rgba(235,231,223,0.42)', fontSize: 12, fontWeight: '500', letterSpacing: 2, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  bottomMark: { paddingBottom: Platform.OS === 'ios' ? 48 : 32, alignItems: 'center' },
  bottomText: { color: 'rgba(235,231,223,0.22)', fontSize: 9, letterSpacing: 2.8, fontWeight: '600' },
  cascadeWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
