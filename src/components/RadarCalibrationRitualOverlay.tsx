// @ts-nocheck
/**
 * EstateOS Radar — HARDWARE PERFECTION EDITION
 * Kupno=Zielony, Wynajem=Niebieski. Twarde diody, sparkle blipy, wielkie miasto, odlot zygzakiem.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  G,
  Rect,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// === PALETA MATERIAŁÓW ===
const TITANIUM_DARK = '#121216';
const BRASS_GOLD = '#CBA135';
const BRASS_DARK = '#8A6A1C';
const RENT_COLOR = '#00D1FF';
const SELL_COLOR = '#39FF14';
const PWR_AMBER = '#FFB800';

// === TIMINGI FIZYKI ===
const PHASE_SCAN_MS = 4600;
const MAP_REVEAL_MS = 800;
const MAP_REVEAL_DELAY_MS = 200;
const HOLD_BEFORE_FLYAWAY_MS = 2200;
const FLYAWAY_DURATION_MS = 1400;
const MACHINE_BOTTOM_PAD = 28;
const SWEEP_MS_PER_TURN = 1600;
const BLIP_SWEEP_TAIL_DEG = 48;

const BLIP_COUNT = 8;
const BLIP_SCATTER = [
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

type Props = {
  visible: boolean;
  cityLabel: string;
  transactionType: 'RENT' | 'SELL';
  matchingOffersCount: number;
  onComplete: () => void;
  onFlyAwayBegin?: () => void;
  /** Nadpisuje kolor skanu (np. radar aut = niebieski EstateOS™Car). */
  accentColor?: string;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function blipIsLit(mask: number, index: number) {
  'worklet';
  return (mask & (1 << index)) !== 0;
}

function sweepPath(cx: number, cy: number, r: number, sweepDeg: number): string {
  const p1 = polar(cx, cy, r, -sweepDeg);
  const p2 = polar(cx, cy, r, 0);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

function TitaniumScrew({ size, slotAngle }: { size: number; slotAngle: string }) {
  const r = size / 2;
  const slotLen = size * 0.55;
  const slotW = Math.max(1.5, size * 0.12);
  const slotDeg = parseFloat(slotAngle) || 0;

  return (
    <View style={{ width: size + 6, height: size + 6, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size + 4,
          height: size + 4,
          borderRadius: (size + 4) / 2,
          backgroundColor: 'rgba(0,0,0,0.65)',
          top: 2,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: '#656575',
          borderBottomColor: '#050508',
          borderLeftColor: '#2A2A35',
          borderRightColor: '#2A2A35',
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#454552', '#1A1A22', '#08080C']}
          locations={[0, 0.5, 1]}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              position: 'absolute',
              width: slotLen,
              height: slotW,
              backgroundColor: '#020204',
              borderRadius: slotW / 2,
              transform: [{ rotate: `${slotDeg}deg` }],
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: slotLen,
              height: slotW,
              backgroundColor: '#020204',
              borderRadius: slotW / 2,
              transform: [{ rotate: `${slotDeg + 90}deg` }],
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(255,255,255,0.1)',
            }}
          />
          <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, backgroundColor: '#000' }} />
        </LinearGradient>
      </View>
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: size * 0.25,
          width: size * 0.3,
          height: size * 0.1,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.25)',
          transform: [{ rotate: '-20deg' }],
        }}
        pointerEvents="none"
      />
    </View>
  );
}

function HardwareLED({ color, isActive, size }: { color: string; isActive: SharedValue<number>; size: number }) {
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isActive.value, [0, 1], [0.15, 1], 'clamp'),
  }));

  return (
    <View style={[styles.ledHousing, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.ledBevel, { borderRadius: size / 2 }]} />
      <Animated.View
        style={[
          styles.ledCore,
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: (size * 0.7) / 2,
            backgroundColor: color,
          },
          coreStyle,
        ]}
      >
        <View style={[styles.ledReflex, { width: size * 0.25, height: size * 0.15, top: size * 0.1, left: size * 0.2 }]} />
      </Animated.View>
    </View>
  );
}

function SparkleBlip({
  center,
  angleDeg,
  dist,
  blipIndex,
  dotMask,
  sweepValue,
  themeColor,
}: {
  center: number;
  angleDeg: number;
  dist: number;
  blipIndex: number;
  dotMask: SharedValue<number>;
  sweepValue: SharedValue<number>;
  themeColor: string;
}) {
  const pos = polar(center, center, dist, angleDeg);

  const sparkleStyle = useAnimatedStyle(() => {
    if (blipIsLit(dotMask.value, blipIndex)) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    const ang = ((sweepValue.value % 360) + 360) % 360;
    let diff = ang - angleDeg;
    if (diff < 0) diff += 360;
    const scale = diff > 30 ? 0 : interpolate(diff, [0, 10, 30], [2.5, 1, 0], 'clamp');
    const opacity = diff > 30 ? 0 : interpolate(diff, [0, 10, 30], [1, 0.8, 0], 'clamp');
    return { opacity, transform: [{ scale }] };
  });

  const dotStyle = useAnimatedStyle(() => {
    if (blipIsLit(dotMask.value, blipIndex)) return { opacity: 1 };
    const ang = ((sweepValue.value % 360) + 360) % 360;
    let diff = ang - angleDeg;
    if (diff < 0) diff += 360;
    return { opacity: diff > 30 ? 0 : interpolate(diff, [0, 10, 30], [1, 0.8, 0], 'clamp') };
  });

  return (
    <View style={[styles.sparkleWrap, { left: pos.x - 6, top: pos.y - 6 }]} pointerEvents="none">
      <Animated.View style={[styles.sparkleHalo, { backgroundColor: themeColor }, sparkleStyle]} />
      <Animated.View style={[{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFF' }, dotStyle]} />
    </View>
  );
}

function VolumetricSweep({ size, color }: { size: number; color: string }) {
  const cx = size / 2;
  const r = size / 2 - 8;
  const gradId = `sweepGrad${size}`;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <Stop offset="22%" stopColor={color} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path d={sweepPath(cx, cx, r, 78)} fill={`url(#${gradId})`} />
      <Path d={`M ${cx} ${cx} L ${cx} 10`} stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
      <Path d={`M ${cx} ${cx} L ${cx} 10`} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.95} />
    </Svg>
  );
}

/** Tylko delikatny blik u góry — bez ciemnej maski zasłaniającej siatkę i laser. */
function SapphireDome({ size }: { size: number }) {
  const cx = size / 2;
  const glareId = `domeGlare${size}`;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id={glareId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.03" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d={`M 0 0 L ${size} 0 L ${size} ${size * 0.32} Q ${cx} ${size * 0.5} 0 ${size * 0.32} Z`}
        fill={`url(#${glareId})`}
      />
    </Svg>
  );
}

function RadarGridSvg({ radarSize, cx, themeColor }: { radarSize: number; cx: number; themeColor: string }) {
  const coreId = `radarCoreDeep${radarSize}`;
  return (
    <Svg width={radarSize} height={radarSize} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={themeColor} stopOpacity="0.28" />
          <Stop offset="45%" stopColor="#0A1812" stopOpacity="0.55" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.92" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cx} r={cx} fill={`url(#${coreId})`} />
      <Circle cx={cx} cy={cx} r={cx - 14} stroke={BRASS_GOLD} strokeOpacity={0.45} strokeWidth={1.2} fill="none" />
      <Circle cx={cx} cy={cx} r={cx - 15} stroke={themeColor} strokeOpacity={0.65} strokeWidth={1.8} fill="none" strokeDasharray="3 7" />
      <Circle cx={cx} cy={cx} r={cx * 0.6} stroke={themeColor} strokeOpacity={0.45} strokeWidth={1.2} fill="none" />
      <Circle cx={cx} cy={cx} r={cx * 0.3} stroke={themeColor} strokeOpacity={0.35} strokeWidth={1} fill="none" />
      <Path
        d={`M ${cx} 12 L ${cx} ${radarSize - 12} M 12 ${cx} L ${radarSize - 12} ${cx}`}
        stroke={themeColor}
        strokeOpacity={0.5}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

function MapLayer({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(width, height) * 0.55;
  const streets = useMemo(() => {
    const out = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      out.push(
        <Path
          key={`h-${i}`}
          d={`M ${width * 0.02} ${height * (0.05 + t * 0.9)} L ${width * 0.98} ${height * (0.08 + t * 0.88)}`}
          stroke="rgba(200,215,225,0.15)"
          strokeWidth={i % 4 === 0 ? 2 : 0.8}
        />,
      );
      out.push(
        <Path
          key={`v-${i}`}
          d={`M ${width * (0.04 + t * 0.92)} ${height * 0.04} L ${width * (0.06 + t * 0.88)} ${height * 0.96}`}
          stroke="rgba(200,215,225,0.12)"
          strokeWidth={0.8}
        />,
      );
    }
    return out;
  }, [width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#091014' }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="mapVigHS" cx="50%" cy="50%" r="65%">
            <Stop offset="0%" stopColor="#1A2A33" />
            <Stop offset="75%" stopColor="#0B131A" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#mapVigHS)" />
        <G>{streets}</G>
        <Circle cx={cx * 0.75} cy={cy * 0.45} r={r * 0.25} fill="rgba(40,90,70,0.35)" />
        <Circle cx={cx * 1.15} cy={cy * 0.65} r={r * 0.18} fill="rgba(20,60,90,0.3)" />
      </Svg>
    </View>
  );
}

function GlassCrackOverlay({ size, phase }: { size: number; phase: SharedValue<number> }) {
  const cx = size / 2;
  const crackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 0.15, 0.5, 1], [0, 0.6, 0.2, 0], 'clamp'),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, crackStyle]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Path d={`M ${cx} 0 L ${size} ${size} L ${cx} ${size} Z`} fill="rgba(255,255,255,0.15)" />
        <Path d={`M 0 ${size} L ${cx} ${size} L 0 0 Z`} fill="rgba(255,255,255,0.08)" />
      </Svg>
    </Animated.View>
  );
}

/** Ozdobne łezki / klejnoty po bokach nazwy miasta (jak grawer na ramie). */
function RitualCityOrnamentGroup({ scale }: { scale: number }) {
  const tearW = Math.max(2, Math.round(2.5 * scale));
  const tearH = Math.round(14 * scale);
  const dot = Math.max(3, Math.round(4 * scale));
  const gap = Math.round(5 * scale);

  const Tear = ({ opacity = 0.42 }: { opacity?: number }) => (
    <View
      style={{
        width: tearW,
        height: tearH,
        borderRadius: tearW,
        backgroundColor: '#FFFFFF',
        opacity,
        transform: [{ scaleX: 0.55 }],
      }}
    />
  );

  return (
    <View style={styles.cityOrnamentGroup}>
      <Tear opacity={0.28} />
      <View style={{ width: gap }} />
      <Tear opacity={0.5} />
      <View style={{ width: gap }} />
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: 'rgba(255,255,255,0.92)',
        }}
      />
      <View style={{ width: gap }} />
      <Tear opacity={0.5} />
      <View style={{ width: gap }} />
      <Tear opacity={0.28} />
    </View>
  );
}

function RitualCityLine({ city, fontSize }: { city: string; fontSize: number }) {
  const scale = fontSize / 15;
  return (
    <View style={styles.cityLineRow}>
      <RitualCityOrnamentGroup scale={scale} />
      <Text
        style={[styles.ritualCityLabel, { fontSize, marginHorizontal: Math.round(14 * scale) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {city.toUpperCase()}
      </Text>
      <RitualCityOrnamentGroup scale={scale} />
    </View>
  );
}

function computeRitualLayout(screenWidth: number, screenHeight: number, insetsTop: number, insetsBottom: number) {
  const shorterSide = Math.min(screenWidth, screenHeight);
  const isTabletLike = shorterSide >= 700 || screenWidth >= 768;
  const stageHeight = screenHeight - insetsTop - insetsBottom;
  const maxBoxW = isTabletLike ? 560 : 400;
  const radarRatio = 0.74;

  let scale = isTabletLike ? Math.min(1.14, 0.92 + shorterSide / 920) : Math.max(0.78, Math.min(1, shorterSide / 390));
  let boxWidth = 320;
  let boxHeight = 480;
  let radarSize = 240;
  let trenchPad = 32;
  let trenchSize = 272;
  let trenchTop = 42;
  let cornerInset = 16;
  let screwSize = 14;

  for (let i = 0; i < 4; i++) {
    boxWidth = Math.round(Math.min(screenWidth - 20, maxBoxW) * scale);
    radarSize = Math.round(boxWidth * radarRatio);
    trenchPad = Math.round(30 * scale);
    trenchSize = radarSize + trenchPad;
    cornerInset = Math.round(16 * scale);
    screwSize = Math.round((isTabletLike ? 16 : 14) * scale);
    trenchTop = Math.round(cornerInset + screwSize + 24);
    const brandBand = Math.round((isTabletLike ? 168 : 152) * scale);
    boxHeight = trenchTop + trenchSize + 24 + brandBand;
    if (boxHeight <= stageHeight * 0.92) break;
    scale *= (stageHeight * 0.92) / boxHeight;
  }

  const ui = Math.max(0.75, scale);
  const fonts = {
    ledCaption: Math.max(7, Math.round(6.5 * ui)),
    countValue: Math.round((isTabletLike ? 56 : 48) * ui),
    countLabel: Math.max(9, Math.round(10 * ui)),
    brandEyebrow: Math.max(8, Math.round((isTabletLike ? 10 : 9) * ui)),
    brandTitle: Math.round((isTabletLike ? 28 : 22) * ui),
    cityLabel: Math.round((isTabletLike ? 17 : 15) * ui),
    statusText: Math.max(9, Math.round(10 * ui)),
  };

  return {
    isTabletLike,
    stageHeight,
    boxWidth,
    boxHeight,
    radarSize,
    trenchPad,
    trenchSize,
    trenchTop,
    trenchLeft: (boxWidth - trenchSize) / 2,
    screwSize,
    ledSize: Math.round((isTabletLike ? 12 : 11) * ui),
    ledGap: Math.round(16 * ui),
    cornerInset,
    housingRadius: Math.round(36 * ui),
    fonts,
    machineBottomPad: Math.max(10, Math.round(MACHINE_BOTTOM_PAD * ui)),
    brandInset: Math.round(20 * ui),
  };
}

export default function RadarCalibrationRitualOverlay({
  visible,
  cityLabel,
  transactionType,
  matchingOffersCount,
  onComplete,
  onFlyAwayBegin,
  accentColor,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const layout = useMemo(
    () => computeRitualLayout(screenWidth, screenHeight, insets.top, insets.bottom),
    [screenWidth, screenHeight, insets.top, insets.bottom],
  );
  const {
    boxWidth,
    boxHeight,
    radarSize,
    trenchSize,
    trenchTop,
    trenchLeft,
    screwSize,
    ledSize,
    ledGap,
    cornerInset,
    housingRadius,
    fonts,
    stageHeight,
    isTabletLike,
    machineBottomPad,
    brandInset,
  } = layout;

  const cx = radarSize / 2;
  const themeColor = accentColor || (transactionType === 'RENT' ? RENT_COLOR : SELL_COLOR);
  const cityText = (cityLabel || '').trim() || 'Wybrana metropolia';
  const brandBlockTop = trenchTop + trenchSize + 24;

  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const flyAwayBeginRef = useRef(onFlyAwayBegin);
  flyAwayBeginRef.current = onFlyAwayBegin;
  const radarSoundRef = useRef(null);
  const glassHapticFired = useRef(false);

  const powerOn = useSharedValue(0);
  const radarSweep = useSharedValue(0);
  const dotMask = useSharedValue(0);
  const mapRevealPhase = useSharedValue(0);
  const flyAwayProgress = useSharedValue(0);
  const exitOpacity = useSharedValue(1);
  const ledPwr = useSharedValue(0);
  const ledSync = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);

  const invokeComplete = useCallback(() => {
    completeRef.current?.();
  }, []);

  const finishUnmount = useCallback(() => {
    setShouldRender(false);
  }, []);

  const fireGlassHaptic = useCallback(() => {
    if (glassHapticFired.current) return;
    glassHapticFired.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const triggerHapticBlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useAnimatedReaction(
    () => mapRevealPhase.value,
    (tp, prev) => {
      if ((prev ?? 0) < 0.06 && tp >= 0.06) runOnJS(fireGlassHaptic)();
    },
    [fireGlassHaptic],
  );

  useAnimatedReaction(
    () => radarSweep.value,
    (sv) => {
      if (mapRevealPhase.value > 0.02) return;
      const ang = ((sv % 360) + 360) % 360;
      for (let i = 0; i < BLIP_COUNT; i++) {
        const target = BLIP_DETECT_ANGLES[i];
        const diff = Math.abs(ang - target);
        const distAng = Math.min(diff, 360 - diff);
        if (distAng < 12 && !blipIsLit(dotMask.value, i)) {
          dotMask.value |= 1 << i;
          runOnJS(triggerHapticBlip)();
        }
      }
    },
    [triggerHapticBlip],
  );

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      exitOpacity.value = 1;
    } else if (shouldRender) {
      exitOpacity.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(finishUnmount)();
      });
    }
  }, [visible, shouldRender, finishUnmount]);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(powerOn);
      cancelAnimation(radarSweep);
      cancelAnimation(flyAwayProgress);
      cancelAnimation(mapRevealPhase);
      cancelAnimation(ledPwr);
      cancelAnimation(ledSync);
      powerOn.value = 0;
      radarSweep.value = 0;
      dotMask.value = 0;
      flyAwayProgress.value = 0;
      mapRevealPhase.value = 0;
      ledPwr.value = 0;
      ledSync.value = 0;
      glassHapticFired.current = false;
      return;
    }

    glassHapticFired.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    dotMask.value = 0;

    powerOn.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.exp) });
    ledPwr.value = withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.1, { duration: 400 })),
      -1,
      true,
    );
    ledSync.value = withRepeat(
      withSequence(withTiming(1, { duration: 150 }), withTiming(0.1, { duration: 150 })),
      -1,
      true,
    );
    radarSweep.value = withRepeat(withTiming(360, { duration: SWEEP_MS_PER_TURN, easing: Easing.linear }), -1, false);

    const tScanEnd = setTimeout(() => {
      cancelAnimation(radarSweep);
      cancelAnimation(ledSync);
      ledSync.value = withTiming(1, { duration: 200 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      mapRevealPhase.value = withTiming(1, { duration: MAP_REVEAL_MS, easing: Easing.inOut(Easing.cubic) });
    }, PHASE_SCAN_MS);

    const tFlyAway = setTimeout(() => {
      flyAwayBeginRef.current?.();
      flyAwayProgress.value = withTiming(
        1,
        { duration: FLYAWAY_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(invokeComplete)();
        },
      );
    }, PHASE_SCAN_MS + MAP_REVEAL_DELAY_MS + HOLD_BEFORE_FLYAWAY_MS);

    return () => {
      clearTimeout(tScanEnd);
      clearTimeout(tFlyAway);
    };
  }, [visible, invokeComplete]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync(require('../../assets/radar.mp3'), {
          shouldPlay: false,
          volume: 1,
        });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        radarSoundRef.current = sound;
        await sound.playAsync();
      } catch {}
    })();
    return () => {
      cancelled = true;
      const s = radarSoundRef.current;
      radarSoundRef.current = null;
      if (s) {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
      }
    };
  }, [visible]);

  const hardwareFlyStyle = useAnimatedStyle(() => {
    const p = flyAwayProgress.value;
    const enterScale = interpolate(powerOn.value, [0, 1], [0.92, 1], 'clamp');
    const enterY = interpolate(powerOn.value, [0, 1], [70, 0], 'clamp');

    if (p <= 0.001) {
      return { opacity: powerOn.value, transform: [{ translateY: enterY }, { scale: enterScale }] };
    }

    const zigzagX = Math.sin(p * Math.PI * 4.5) * 280 * p;
    const flyY = -(screenHeight + boxHeight * 1.5) * p ** 1.8;
    const exitOpacity = interpolate(p, [0, 0.9, 1], [1, 1, 0], 'clamp');
    const shrink = interpolate(p, [0, 1], [1, 0.25], 'clamp');

    return {
      opacity: powerOn.value * exitOpacity,
      transform: [
        { perspective: 1200 },
        { translateX: zigzagX },
        { translateY: enterY + flyY },
        { scale: enterScale * shrink },
        { rotateZ: `${interpolate(p, [0, 1], [0, 15], 'clamp')}deg` },
        { rotateX: `${interpolate(p, [0, 1], [0, 30], 'clamp')}deg` },
      ],
    };
  });

  const coreHideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mapRevealPhase.value, [0, 0.4], [1, 0], 'clamp'),
  }));
  const mapRevealStyle = useAnimatedStyle(() => ({
    opacity: mapRevealPhase.value,
    transform: [{ scale: interpolate(mapRevealPhase.value, [0, 1], [1.08, 1], 'clamp') }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${radarSweep.value}deg` }] }));
  const countRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mapRevealPhase.value, [0.5, 1], [0, 1], 'clamp'),
  }));

  const statusBorderLit = `${themeColor}66`;
  const statusBgLit = `${themeColor}18`;
  const statusPillRevealStyle = useAnimatedStyle(() => {
    const p = mapRevealPhase.value;
    return {
      opacity: interpolate(p, [0.48, 0.72], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(p, [0.48, 0.72], [0.94, 1], 'clamp') }],
      borderColor: interpolateColor(p, [0.5, 1], ['rgba(255,255,255,0.06)', statusBorderLit]),
      backgroundColor: interpolateColor(p, [0.5, 1], ['rgba(0,0,0,0.28)', statusBgLit]),
      shadowOpacity: interpolate(p, [0.5, 1], [0, 0.65], 'clamp'),
      shadowRadius: interpolate(p, [0.5, 1], [0, 16], 'clamp'),
    };
  });
  const statusDotRevealStyle = useAnimatedStyle(() => {
    const p = mapRevealPhase.value;
    return {
      backgroundColor: interpolateColor(p, [0.5, 1], ['#3A3A40', themeColor]),
      opacity: interpolate(p, [0.5, 1], [0.25, 1], 'clamp'),
    };
  });
  const statusTextRevealStyle = useAnimatedStyle(() => {
    const p = mapRevealPhase.value;
    return {
      color: interpolateColor(p, [0.5, 1], ['rgba(255,255,255,0.22)', themeColor]),
      opacity: interpolate(p, [0.5, 1], [0.3, 1], 'clamp'),
    };
  });

  const scrimStyle = useAnimatedStyle(() => {
    const fly = flyAwayProgress.value;
    const base = interpolate(mapRevealPhase.value, [0, 1], [1, 0.15], 'clamp');
    const flyFade = interpolate(fly, [0, 0.2, 1], [1, 0.35, 0], 'clamp');
    return { opacity: base * flyFade };
  });

  const rootFadeStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
  }));

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.fullscreen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
        rootFadeStyle,
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <LinearGradient colors={['#040406', '#0E0E12', '#040406']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View
        style={[
          styles.machineCenter,
          { minHeight: stageHeight, justifyContent: isTabletLike ? 'center' : 'flex-end', paddingBottom: machineBottomPad },
        ]}
      >
        <Animated.View style={[styles.hardwareHousing, { width: boxWidth, height: boxHeight, borderRadius: housingRadius }, hardwareFlyStyle]}>
          <LinearGradient
            colors={['#32323D', TITANIUM_DARK, '#050508']}
            locations={[0, 0.5, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: housingRadius }]}
          />
          <View style={[styles.housingRimLight, { borderRadius: housingRadius }]} pointerEvents="none" />
          <View style={[styles.brassTrimLine, { top: cornerInset - 2, left: brandInset, right: brandInset }]} pointerEvents="none" />

          <View style={[styles.screwCorner, { top: cornerInset, left: cornerInset }]}>
            <TitaniumScrew size={screwSize} slotAngle="45deg" />
          </View>
          <View style={[styles.screwCorner, { top: cornerInset, right: cornerInset }]}>
            <TitaniumScrew size={screwSize} slotAngle="-22deg" />
          </View>
          <View style={[styles.screwCorner, { bottom: cornerInset, left: cornerInset }]}>
            <TitaniumScrew size={screwSize} slotAngle="88deg" />
          </View>
          <View style={[styles.screwCorner, { bottom: cornerInset, right: cornerInset }]}>
            <TitaniumScrew size={screwSize} slotAngle="-12deg" />
          </View>

          <View
            style={[
              styles.ledRow,
              {
                top: cornerInset + screwSize / 2 - ledSize / 2,
                left: cornerInset + screwSize + 18,
              },
            ]}
          >
            <View style={[styles.ledSlot, { marginRight: ledGap }]}>
              <HardwareLED color={PWR_AMBER} isActive={ledPwr} size={ledSize} />
              <Text style={[styles.ledCaption, { fontSize: fonts.ledCaption, marginTop: Math.round(5 * (ledSize / 11)) }]}>PWR</Text>
            </View>
            <View style={styles.ledSlot}>
              <HardwareLED color={themeColor} isActive={ledSync} size={ledSize} />
              <Text style={[styles.ledCaption, { fontSize: fonts.ledCaption, marginTop: Math.round(5 * (ledSize / 11)) }]}>SYNC</Text>
            </View>
          </View>

          <View style={[styles.trenchHousing, { width: trenchSize, height: trenchSize, top: trenchTop, left: trenchLeft }]}>
            <Svg width={trenchSize} height={trenchSize} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id="trenchShadow" cx="50%" cy="40%" r="60%">
                  <Stop offset="75%" stopColor="#000" stopOpacity="0" />
                  <Stop offset="95%" stopColor="#000" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#000" stopOpacity="1" />
                </RadialGradient>
                <RadialGradient id="trenchGoldRim" cx="50%" cy="50%" r="50%">
                  <Stop offset="88%" stopColor={BRASS_DARK} stopOpacity="0" />
                  <Stop offset="98%" stopColor={BRASS_GOLD} stopOpacity="0.5" />
                  <Stop offset="100%" stopColor={BRASS_DARK} stopOpacity="0.8" />
                </RadialGradient>
              </Defs>
              <Circle cx={trenchSize / 2} cy={trenchSize / 2} r={trenchSize / 2} fill="#050508" />
              <Circle cx={trenchSize / 2} cy={trenchSize / 2} r={trenchSize / 2} fill="url(#trenchGoldRim)" />
              <Circle cx={trenchSize / 2} cy={trenchSize / 2} r={trenchSize / 2} fill="url(#trenchShadow)" />
            </Svg>

            <View
              style={[
                styles.glassCore,
                {
                  width: radarSize,
                  height: radarSize,
                  borderRadius: radarSize / 2,
                  borderTopColor: 'rgba(203,161,53,0.45)',
                  borderBottomColor: 'rgba(203,161,53,0.08)',
                  borderLeftColor: `${themeColor}44`,
                  borderRightColor: `${themeColor}44`,
                },
              ]}
            >
              <Animated.View style={[StyleSheet.absoluteFill, mapRevealStyle]} pointerEvents="none">
                <MapLayer width={radarSize} height={radarSize} />
              </Animated.View>

              <Animated.View style={[styles.radarScanLayer, coreHideStyle]} pointerEvents="none">
                <RadarGridSvg radarSize={radarSize} cx={cx} themeColor={themeColor} />

                <Animated.View style={[styles.radarSweepLayer, sweepStyle]}>
                  <VolumetricSweep size={radarSize} color={themeColor} />
                </Animated.View>

                {BLIP_SCATTER.map((b, i) => (
                  <SparkleBlip
                    key={`blip-${i}`}
                    center={cx}
                    angleDeg={b.angleDeg}
                    dist={cx * b.distMul}
                    blipIndex={i}
                    dotMask={dotMask}
                    sweepValue={radarSweep}
                    themeColor={themeColor}
                  />
                ))}
              </Animated.View>

              <View style={styles.domeGlareLayer} pointerEvents="none">
                <SapphireDome size={radarSize} />
              </View>

              <GlassCrackOverlay size={radarSize} phase={mapRevealPhase} />

              <Animated.View style={[styles.countOverlay, countRevealStyle]} pointerEvents="none">
                <Text
                  style={[
                    styles.countValue,
                    {
                      fontSize: fonts.countValue,
                      color: BRASS_GOLD,
                      textShadowColor: 'rgba(0,0,0,0.75)',
                      textShadowRadius: Math.max(4, fonts.countValue * 0.1),
                    },
                  ]}
                >
                  {Math.max(0, matchingOffersCount)}
                </Text>
                <Text
                  style={[
                    styles.countLabel,
                    { fontSize: fonts.countLabel, marginTop: Math.round(4 * (fonts.countLabel / 10)) },
                  ]}
                >
                  DOPASOWAŃ
                </Text>
              </Animated.View>
            </View>
          </View>

          <View style={[styles.brandBlock, { top: brandBlockTop, left: brandInset, right: brandInset }]}>
            <Text style={[styles.brandEyebrow, { fontSize: fonts.brandEyebrow, letterSpacing: fonts.brandEyebrow * 0.38 }]}>
              INTELLIGENCE CORE
            </Text>
            <Text
              style={[styles.brandTitle, { fontSize: fonts.brandTitle }]}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
            >
              EstateOS™ Radar
            </Text>
            <View style={styles.divider} />
            <Animated.View
              style={[
                styles.statusRow,
                { shadowColor: themeColor },
                statusPillRevealStyle,
              ]}
            >
              <Animated.View style={[styles.statusDot, statusDotRevealStyle]} />
              <Animated.Text
                style={[styles.statusText, { fontSize: fonts.statusText }, statusTextRevealStyle]}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
              >
                MAPOWANIE ZAKOŃCZONE
              </Animated.Text>
            </Animated.View>
            <RitualCityLine city={cityText} fontSize={fonts.cityLabel} />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: 'transparent', overflow: 'visible' },
  machineCenter: { flex: 1, alignItems: 'center', overflow: 'visible' },
  hardwareHousing: {
    borderRadius: 36,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(20,20,25,1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 45 },
    shadowOpacity: 0.95,
    shadowRadius: 55,
    elevation: 35,
  },
  housingRimLight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderLeftColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(255,255,255,0.06)',
    borderBottomColor: 'rgba(0,0,0,0.85)',
  },
  brassTrimLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(203,161,53,0.35)' },
  screwCorner: { position: 'absolute', zIndex: 20 },
  ledRow: { position: 'absolute', flexDirection: 'row', zIndex: 18, alignItems: 'center' },
  ledSlot: { alignItems: 'center', overflow: 'visible' },
  ledCaption: {
    fontWeight: '800',
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.55)',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  ledHousing: {
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    borderBottomColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  ledBevel: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.8)' },
  ledCore: { alignItems: 'center', justifyContent: 'center' },
  ledReflex: { position: 'absolute', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  trenchHousing: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glassCore: {
    overflow: 'hidden',
    backgroundColor: '#05080A',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.95,
    shadowRadius: 28,
  },
  radarScanLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  radarSweepLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  domeGlareLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  sparkleWrap: { position: 'absolute', width: 12, height: 12, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  sparkleHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7, opacity: 0.55 },
  countOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 14 },
  countValue: {
    fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  countLabel: {
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(244,232,204,0.88)',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandBlock: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 12 },
  brandEyebrow: {
    color: 'rgba(244,232,204,0.55)',
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  brandTitle: {
    color: '#F4E8CC',
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  divider: { width: '45%', height: 1, backgroundColor: 'rgba(203,161,53,0.3)', marginVertical: 12 },
  cityLineRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  cityOrnamentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ritualCityLabel: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: {
    fontWeight: '800',
    letterSpacing: 1.5,
    flexShrink: 1,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
