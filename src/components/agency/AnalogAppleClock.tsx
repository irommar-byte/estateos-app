import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  size?: number;
  isDark?: boolean;
  accent?: string;
  variant?: 'steel' | 'gold' | 'red';
  brandLine?: string | null;
  /** Engraved date carved into the gold beside the dial — no plate/frame. */
  showEngravedDate?: boolean;
};

const LUXURY_SERIF = Platform.select({
  ios: 'Didot',
  android: 'serif',
  default: 'serif',
}) as string;

const WEEKDAYS_PL = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
] as const;

const MONTHS_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
] as const;

const DAY_ORDINAL_PL: Record<number, string> = {
  1: 'pierwszy',
  2: 'drugi',
  3: 'trzeci',
  4: 'czwarty',
  5: 'piąty',
  6: 'szósty',
  7: 'siódmy',
  8: 'ósmy',
  9: 'dziewiąty',
  10: 'dziesiąty',
  11: 'jedenasty',
  12: 'dwunasty',
  13: 'trzynasty',
  14: 'czternasty',
  15: 'piętnasty',
  16: 'szesnasty',
  17: 'siedemnasty',
  18: 'osiemnasty',
  19: 'dziewiętnasty',
  20: 'dwudziesty',
  21: 'dwudziesty pierwszy',
  22: 'dwudziesty drugi',
  23: 'dwudziesty trzeci',
  24: 'dwudziesty czwarty',
  25: 'dwudziesty piąty',
  26: 'dwudziesty szósty',
  27: 'dwudziesty siódmy',
  28: 'dwudziesty ósmy',
  29: 'dwudziesty dziewiąty',
  30: 'trzydziesty',
  31: 'trzydziesty pierwszy',
};

function truncateBrand(raw: string | null | undefined, max = 16): string {
  const t = String(raw || '').trim();
  if (!t) return 'ESTATEOS';
  if (t.length <= max) return t.toUpperCase();
  return `${t.slice(0, max - 1).trim().toUpperCase()}…`;
}

function formatEngravedParts(date: Date) {
  const weekday = WEEKDAYS_PL[date.getDay()];
  const dayWord = DAY_ORDINAL_PL[date.getDate()] || String(date.getDate());
  const monthWord = MONTHS_PL[date.getMonth()];
  const year = String(date.getFullYear());
  return { weekday, dayWord, monthWord, year };
}

/** Multi-layer carved-metal lettering — no frame, just gold engraving. */
function EngravedLine({
  text,
  size,
  isDark,
  gold,
  letterSpacing = 0.6,
}: {
  text: string;
  size: number;
  isDark: boolean;
  gold: boolean;
  letterSpacing?: number;
}) {
  const cut = gold
    ? isDark
      ? 'rgba(28, 18, 4, 0.88)'
      : 'rgba(55, 38, 8, 0.78)'
    : isDark
      ? 'rgba(10,10,12,0.75)'
      : 'rgba(40,40,44,0.7)';
  const rim = gold
    ? isDark
      ? 'rgba(255, 236, 180, 0.45)'
      : 'rgba(255, 248, 220, 0.75)'
    : isDark
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(255,255,255,0.55)';
  const mid = gold
    ? isDark
      ? 'rgba(110, 80, 20, 0.95)'
      : 'rgba(85, 62, 14, 0.88)'
    : isDark
      ? 'rgba(90,90,95,0.9)'
      : 'rgba(70,70,74,0.85)';

  const base = {
    fontFamily: LUXURY_SERIF,
    fontSize: size,
    fontWeight: '400' as const,
    letterSpacing,
    fontStyle: 'italic' as const,
  };

  return (
    <View>
      <Text style={[base, { color: mid }]}>{text}</Text>
      <Text style={[base, styles.engraveLayer, { color: 'rgba(0,0,0,0.5)', top: 1.35, left: 1.05 }]}>{text}</Text>
      <Text style={[base, styles.engraveLayer, { color: cut, top: 0.55, left: 0.4 }]}>{text}</Text>
      <Text style={[base, styles.engraveLayer, { color: mid }]}>{text}</Text>
      <Text style={[base, styles.engraveLayer, { color: rim, top: -0.9, left: -0.6 }]}>{text}</Text>
    </View>
  );
}

function EngravedDateBeside({
  date,
  isDark,
  gold,
  height,
  gleam,
}: {
  date: Date;
  isDark: boolean;
  gold: boolean;
  height: number;
  gleam: Animated.Value;
}) {
  const parts = useMemo(() => formatEngravedParts(date), [date]);
  const daySize = height >= 160 ? 15 : 13;
  const monthSize = height >= 160 ? 17 : 15;
  const weekSize = height >= 160 ? 12 : 11;
  const yearSize = height >= 160 ? 14 : 12;

  const shine = gleam.interpolate({
    inputRange: [0, 0.4, 0.55, 1],
    outputRange: [0.08, 0.38, 0.22, 0.08],
  });
  const shiftX = gleam.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3.5],
  });

  return (
    <Animated.View
      style={[
        styles.dateCarve,
        {
          minHeight: height * 0.72,
          justifyContent: 'center',
          opacity: shine.interpolate({
            inputRange: [0.08, 0.38],
            outputRange: [0.92, 1],
            extrapolate: 'clamp',
          }),
          transform: [{ translateX: shiftX }],
        },
      ]}
    >
      <EngravedLine text={parts.weekday} size={weekSize} isDark={isDark} gold={gold} letterSpacing={1.4} />
      <View style={styles.dateGap} />
      <EngravedLine text={parts.dayWord} size={daySize} isDark={isDark} gold={gold} letterSpacing={0.8} />
      <EngravedLine text={parts.monthWord} size={monthSize} isDark={isDark} gold={gold} letterSpacing={1.1} />
      <View style={styles.dateGapSm} />
      <EngravedLine text={parts.year} size={yearSize} isDark={isDark} gold={gold} letterSpacing={2.4} />
    </Animated.View>
  );
}

function AnalogAppleClock({
  size = 180,
  isDark = true,
  accent = '#34C759',
  variant = 'steel',
  brandLine,
  showEngravedDate = true,
}: Props) {
  const gold = variant === 'gold';
  const red = variant === 'red';
  const uid = useId().replace(/:/g, '');
  const [time, setTime] = useState(() => new Date());
  const gleam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(gleam, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(gleam, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(3800),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [gleam]);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const secondAngle = seconds * 6;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = (hours + minutes / 60) * 30;

  const radius = size / 2;
  const center = radius;
  const bezelWidth = 12;
  const innerRadius = radius - bezelWidth;
  const dayOfMonth = time.getDate();
  const brand = useMemo(() => truncateBrand(brandLine), [brandLine]);

  const dialFill = red
    ? isDark
      ? '#14090A'
      : '#FBEFEE'
    : gold
      ? isDark
        ? '#0A0803'
        : '#FBF4DF'
      : isDark
        ? '#0F0F11'
        : '#F7F7FA';

  const hourTick = gold ? (isDark ? '#F8E7B0' : '#6B4C10') : isDark ? '#FFFFFF' : '#1C1C1E';
  const hourTickShade = gold ? (isDark ? 'rgba(40,28,5,0.92)' : 'rgba(40,28,5,0.42)') : 'rgba(0,0,0,0.4)';
  const minuteTick = gold
    ? isDark
      ? 'rgba(255,214,120,0.82)'
      : 'rgba(140,100,20,0.6)'
    : isDark
      ? 'rgba(255,255,255,0.28)'
      : 'rgba(0,0,0,0.22)';
  const handFill = gold ? (isDark ? '#EFD9A4' : '#5A3F0A') : isDark ? '#E5E5EA' : '#2C2C2E';
  const handShade = 'rgba(0,0,0,0.55)';
  const secondColor = '#FF3B30';

  const gleamX = gleam.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.35, size * 0.85],
  });
  const gleamOpacity = gleam.interpolate({
    inputRange: [0, 0.35, 0.55, 1],
    outputRange: [0, 0.58, 0.32, 0],
  });
  const assemblyShift = gleam.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.6, 0],
  });

  const dial = (
    <View
      style={[
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: gold
            ? isDark
              ? '#1A1408'
              : '#E8D090'
            : red
              ? isDark
                ? '#1A0C0D'
                : '#F4D8D4'
              : isDark
                ? '#141416'
                : '#E8E8ED',
          shadowColor: gold ? '#C9A227' : '#000',
        },
      ]}
    >
      {gold ? (
        <View
          pointerEvents="none"
          style={[
            styles.ambientGlow,
            {
              width: size + 28,
              height: size + 28,
              borderRadius: (size + 28) / 2,
              left: -14,
              top: -14,
            },
          ]}
        />
      ) : null}

      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={`caseBody-${uid}`} cx="30%" cy="26%" r="80%">
            <Stop offset="0%" stopColor={gold ? (isDark ? '#FFF8E8' : '#FFFBEA') : '#FFFFFF'} stopOpacity={1} />
            <Stop offset="18%" stopColor={gold ? (isDark ? '#F0D878' : '#F5E4A8') : '#E8E8ED'} stopOpacity={1} />
            <Stop offset="40%" stopColor={gold ? (isDark ? '#C9A227' : '#D4B24A') : '#AEAEB2'} stopOpacity={1} />
            <Stop offset="62%" stopColor={gold ? (isDark ? '#7A5C12' : '#A88828') : '#8E8E93'} stopOpacity={1} />
            <Stop offset="82%" stopColor={gold ? (isDark ? '#3A2A08' : '#6B5420') : '#636366'} stopOpacity={1} />
            <Stop offset="100%" stopColor={gold ? (isDark ? '#100C04' : '#3A2A10') : '#1C1C1E'} stopOpacity={1} />
          </RadialGradient>
          <LinearGradient id={`bezelRim-${uid}`} x1="12%" y1="0%" x2="88%" y2="100%">
            <Stop offset="0%" stopColor={gold ? '#FFFCF0' : '#FFFFFF'} stopOpacity={1} />
            <Stop offset="16%" stopColor={gold ? '#F5E08A' : '#D1D1D6'} stopOpacity={0.95} />
            <Stop offset="38%" stopColor={gold ? '#8A6A14' : '#8E8E93'} stopOpacity={0.95} />
            <Stop offset="58%" stopColor={gold ? '#E8D090' : '#C7C7CC'} stopOpacity={0.75} />
            <Stop offset="78%" stopColor={gold ? '#5C4510' : '#636366'} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={gold ? '#1A1206' : '#2C2C2E'} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id={`dialShade-${uid}`} cx="34%" cy="28%" r="76%">
            <Stop offset="0%" stopColor={isDark ? '#3A2E14' : '#FFFFFF'} stopOpacity={gold ? 0.75 : 0.4} />
            <Stop offset="32%" stopColor={dialFill} stopOpacity={1} />
            <Stop offset="72%" stopColor={isDark ? '#060503' : '#E0D0A0'} stopOpacity={1} />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#B8A474'} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={`dialVignette-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="48%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={isDark ? 0.62 : 0.26} />
          </RadialGradient>
          <LinearGradient id={`handHighlight-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.65} />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.42} />
          </LinearGradient>
          <LinearGradient id={`specularArc-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="32%" stopColor="#FFFFFF" stopOpacity={0.62} />
            <Stop offset="48%" stopColor="#FFF8E0" stopOpacity={0.18} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Circle cx={center} cy={center} r={radius - 0.5} fill={`url(#caseBody-${uid})`} />

        <Circle cx={center} cy={center} r={radius - 1.2} fill="none" stroke={`url(#bezelRim-${uid})`} strokeWidth={5.2} />
        <Circle
          cx={center}
          cy={center}
          r={radius - 3.8}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(255,250,230,0.55)' : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.35)'}
          strokeWidth={1.35}
        />
        <Circle cx={center} cy={center} r={radius - 6.2} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={2.2} />
        <Circle
          cx={center}
          cy={center}
          r={radius - 8}
          fill="none"
          stroke={gold ? 'rgba(255,220,140,0.2)' : 'rgba(255,255,255,0.08)'}
          strokeWidth={1}
        />

        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 4}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(180,140,30,0.6)' : 'rgba(120,86,18,0.45)') : 'rgba(0,0,0,0.22)'}
          strokeWidth={5.5}
        />
        <Circle cx={center} cy={center} r={innerRadius + 1.4} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth={2.8} />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 0.35}
          fill="none"
          stroke={gold ? 'rgba(255,230,160,0.28)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={1}
        />

        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialShade-${uid})`} />
        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialVignette-${uid})`} />

        <Ellipse
          cx={center - radius * 0.2}
          cy={center - radius * 0.24}
          rx={radius * 0.3}
          ry={radius * 0.19}
          fill={gold ? 'rgba(255,242,200,0.14)' : 'rgba(255,255,255,0.08)'}
        />

        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const angle = (i * 6 * Math.PI) / 180;
          const r1 = innerRadius - 2.5;
          const r2 = innerRadius - 8.5;
          const x1 = center + r1 * Math.sin(angle);
          const y1 = center - r1 * Math.cos(angle);
          const x2 = center + r2 * Math.sin(angle);
          const y2 = center - r2 * Math.cos(angle);
          return (
            <G key={`tick-${i}`}>
              <Line x1={x1 + 0.7} y1={y1 + 0.7} x2={x2 + 0.7} y2={y2 + 0.7} stroke="rgba(0,0,0,0.42)" strokeWidth={1.3} />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={minuteTick} strokeWidth={1.45} strokeLinecap="round" />
              <Line
                x1={x1 - 0.35}
                y1={y1 - 0.35}
                x2={x2 - 0.35}
                y2={y2 - 0.35}
                stroke={gold ? 'rgba(255,248,220,0.4)' : 'rgba(255,255,255,0.25)'}
                strokeWidth={0.75}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r1 = innerRadius - 2.5;
          const r2 = innerRadius - 17;
          const x1 = center + r1 * Math.sin(angle);
          const y1 = center - r1 * Math.cos(angle);
          const x2 = center + r2 * Math.sin(angle);
          const y2 = center - r2 * Math.cos(angle);
          const w = i % 3 === 0 ? 3.7 : 2.55;
          return (
            <G key={`hour-${i}`}>
              <Line
                x1={x1 + 1.05}
                y1={y1 + 1.05}
                x2={x2 + 1.05}
                y2={y2 + 1.05}
                stroke={hourTickShade}
                strokeWidth={w + 1.1}
                strokeLinecap="round"
              />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hourTick} strokeWidth={w} strokeLinecap="round" />
              <Line
                x1={x1 - 0.55}
                y1={y1 - 0.55}
                x2={x2 - 0.55}
                y2={y2 - 0.55}
                stroke={gold ? 'rgba(255,252,235,0.7)' : 'rgba(255,255,255,0.45)'}
                strokeWidth={Math.max(1, w - 1.5)}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        <SvgText
          x={center + 0.5}
          y={center - radius * 0.32 + 0.6}
          textAnchor="middle"
          fill="rgba(0,0,0,0.5)"
          fontSize={8}
          fontWeight="900"
          letterSpacing={2}
        >
          ESTATEOS
        </SvgText>
        <SvgText
          x={center}
          y={center - radius * 0.32}
          textAnchor="middle"
          fill={
            gold
              ? isDark
                ? 'rgba(245,223,166,0.72)'
                : 'rgba(107,76,16,0.65)'
              : isDark
                ? 'rgba(255,255,255,0.45)'
                : 'rgba(0,0,0,0.45)'
          }
          fontSize={8}
          fontWeight="900"
          letterSpacing={2}
        >
          ESTATEOS
        </SvgText>
        <SvgText
          x={center}
          y={center - radius * 0.22}
          textAnchor="middle"
          fill={accent}
          fontSize={brand.length > 12 ? 5.5 : 6.5}
          fontWeight="800"
          letterSpacing={0.8}
        >
          {brand}
        </SvgText>

        <G transform={`translate(${center + radius * 0.4}, ${center - 10})`}>
          <Rect x={1} y={1.2} width={20} height={20} rx={4} fill="rgba(0,0,0,0.55)" />
          <Rect
            x={0}
            y={0}
            width={20}
            height={20}
            rx={4}
            fill={gold ? (isDark ? '#141008' : '#FFFDF3') : isDark ? '#1C1C1E' : '#FFFFFF'}
            stroke={gold ? (isDark ? 'rgba(255,226,163,0.45)' : 'rgba(120,86,18,0.4)') : 'rgba(255,255,255,0.2)'}
            strokeWidth={1}
          />
          <SvgText
            x={10.5}
            y={14.5}
            textAnchor="middle"
            fill={gold ? (isDark ? '#F7E7BC' : '#4F3808') : isDark ? '#FFFFFF' : '#000000'}
            fontSize={11}
            fontWeight="900"
          >
            {dayOfMonth}
          </SvgText>
        </G>

        <G transform={`rotate(${hourAngle}, ${center}, ${center})`}>
          <Rect x={center - 2} y={center - radius * 0.45} width={6.5} height={radius * 0.5} rx={3} fill={handShade} opacity={0.65} />
          <Rect x={center - 3} y={center - radius * 0.48} width={6} height={radius * 0.52} rx={3} fill={handFill} />
          <Rect
            x={center - 1.5}
            y={center - radius * 0.46}
            width={2.2}
            height={radius * 0.4}
            rx={1.1}
            fill={`url(#handHighlight-${uid})`}
          />
        </G>

        <G transform={`rotate(${minuteAngle}, ${center}, ${center})`}>
          <Rect x={center - 1} y={center - radius * 0.69} width={4.2} height={radius * 0.74} rx={2} fill={handShade} opacity={0.58} />
          <Rect
            x={center - 2}
            y={center - radius * 0.72}
            width={4}
            height={radius * 0.76}
            rx={2}
            fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
          />
          <Rect
            x={center - 0.85}
            y={center - radius * 0.7}
            width={1.4}
            height={radius * 0.58}
            rx={0.7}
            fill={`url(#handHighlight-${uid})`}
          />
        </G>

        <G transform={`rotate(${secondAngle}, ${center}, ${center})`}>
          <Line
            x1={center + 0.9}
            y1={center + 15}
            x2={center + 0.9}
            y2={center - radius * 0.8}
            stroke="rgba(0,0,0,0.42)"
            strokeWidth={1.9}
          />
          <Line
            x1={center}
            y1={center + 14}
            x2={center}
            y2={center - radius * 0.82}
            stroke={secondColor}
            strokeWidth={1.55}
            strokeLinecap="round"
          />
          <Circle cx={center} cy={center - radius * 0.62} r={3.1} fill={secondColor} />
          <Circle cx={center} cy={center - radius * 0.62} r={1.15} fill="rgba(255,255,255,0.5)" />
          <Circle cx={center} cy={center + 12} r={2.3} fill={secondColor} />
        </G>

        <Circle cx={center + 0.7} cy={center + 0.9} r={5.4} fill="rgba(0,0,0,0.48)" />
        <Circle
          cx={center}
          cy={center}
          r={5.1}
          fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
        />
        <Circle cx={center} cy={center} r={2.7} fill={secondColor} />
        <Circle cx={center - 0.7} cy={center - 0.9} r={1.15} fill="rgba(255,255,255,0.62)" />

        <Path
          d={`M ${center - radius * 0.72} ${center - radius * 0.55}
              A ${radius * 0.85} ${radius * 0.85} 0 0 1 ${center + radius * 0.15} ${center - radius * 0.78}`}
          fill="none"
          stroke={`url(#specularArc-${uid})`}
          strokeWidth={3.4}
          strokeLinecap="round"
          opacity={0.75}
        />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.gleamSweep,
          {
            height: size,
            width: size * 0.22,
            opacity: gleamOpacity,
            transform: [{ translateX: gleamX }, { skewX: '-18deg' }],
          },
        ]}
      />
    </View>
  );

  if (!showEngravedDate) {
    return <View style={[styles.wrapper, { width: size, height: size }]}>{dial}</View>;
  }

  // One rigid assembly — clock + engraving scroll / animate together.
  return (
    <Animated.View
      collapsable={false}
      style={[styles.assembly, { transform: [{ translateX: assemblyShift }] }]}
    >
      {dial}
      <EngravedDateBeside date={time} isDark={isDark} gold={gold || red} height={size} gleam={gleam} />
    </Animated.View>
  );
}

export default memo(AnalogAppleClock);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  assembly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 14,
    marginVertical: 8,
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.58,
    shadowRadius: 22,
    elevation: 16,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(201,162,39,0.2)',
  },
  gleamSweep: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,248,220,0.38)',
  },
  dateCarve: {
    maxWidth: 148,
    paddingLeft: 2,
    // No border, no background plate — pure engraving into the gold panel.
  },
  dateGap: { height: 8 },
  dateGapSm: { height: 6 },
  engraveLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
