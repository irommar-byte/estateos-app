import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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
  /** Engraved metal date plate beside the dial (day · month · year). */
  showEngravedDate?: boolean;
};

function truncateBrand(raw: string | null | undefined, max = 16): string {
  const t = String(raw || '').trim();
  if (!t) return 'ESTATEOS';
  if (t.length <= max) return t.toUpperCase();
  return `${t.slice(0, max - 1).trim().toUpperCase()}…`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function EngravedDatePlate({
  date,
  isDark,
  gold,
  height,
}: {
  date: Date;
  isDark: boolean;
  gold: boolean;
  height: number;
}) {
  const uid = useId().replace(/:/g, '');
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = String(date.getFullYear());
  const plateW = Math.max(72, Math.round(height * 0.52));
  const plateH = Math.round(height * 0.78);

  return (
    <View
      style={[
        styles.datePlateShell,
        {
          width: plateW,
          height: plateH,
          borderRadius: 12,
          shadowColor: gold ? '#C9A227' : '#000',
        },
      ]}
    >
      <Svg width={plateW} height={plateH} viewBox={`0 0 ${plateW} ${plateH}`}>
        <Defs>
          <LinearGradient id={`plateMetal-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gold ? (isDark ? '#F8E7B0' : '#FFF8E0') : '#F2F2F7'} stopOpacity={1} />
            <Stop offset="28%" stopColor={gold ? (isDark ? '#C9A227' : '#E8D08A') : '#D1D1D6'} stopOpacity={1} />
            <Stop offset="58%" stopColor={gold ? (isDark ? '#8A6A14' : '#B8952E') : '#8E8E93'} stopOpacity={1} />
            <Stop offset="82%" stopColor={gold ? (isDark ? '#E8D090' : '#F5E6B8') : '#E5E5EA'} stopOpacity={1} />
            <Stop offset="100%" stopColor={gold ? (isDark ? '#5C4510' : '#8A6A20') : '#636366'} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id={`plateInset-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isDark ? '#1A1408' : '#3A2E12'} stopOpacity={0.92} />
            <Stop offset="45%" stopColor={isDark ? '#0C0904' : '#2A220E'} stopOpacity={1} />
            <Stop offset="100%" stopColor={isDark ? '#2A2010' : '#4A3A18'} stopOpacity={0.88} />
          </LinearGradient>
          <LinearGradient id={`engraveTop-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.55} />
            <Stop offset="40%" stopColor={gold ? '#6B5420' : '#48484A'} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={gold ? '#F5E6B8' : '#FFFFFF'} stopOpacity={0.35} />
          </LinearGradient>
          <LinearGradient id={`plateShine-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Raised metal body */}
        <Rect x={1} y={2} width={plateW - 2} height={plateH - 3} rx={10} fill="rgba(0,0,0,0.45)" />
        <Rect x={0} y={0} width={plateW - 2} height={plateH - 3} rx={10} fill={`url(#plateMetal-${uid})`} />
        <Rect
          x={1.5}
          y={1.5}
          width={plateW - 5}
          height={plateH - 6}
          rx={8}
          fill="none"
          stroke={gold ? 'rgba(255,248,220,0.45)' : 'rgba(255,255,255,0.35)'}
          strokeWidth={1}
        />
        <Rect
          x={2.5}
          y={2.5}
          width={plateW - 7}
          height={plateH - 8}
          rx={7}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
        />

        {/* Recessed engraving well */}
        <Rect
          x={8}
          y={10}
          width={plateW - 18}
          height={plateH - 22}
          rx={6}
          fill={`url(#plateInset-${uid})`}
        />
        <Rect
          x={8.5}
          y={10.5}
          width={plateW - 19}
          height={plateH - 23}
          rx={5.5}
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={1.2}
        />
        <Rect
          x={9}
          y={11}
          width={plateW - 20}
          height={plateH - 24}
          rx={5}
          fill="none"
          stroke={gold ? 'rgba(255,230,160,0.18)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={0.8}
        />

        {/* Engraved digits — dark cut + light rim = carved metal */}
        {[
          { label: day, y: plateH * 0.32, size: 15 },
          { label: month, y: plateH * 0.52, size: 15 },
          { label: year, y: plateH * 0.74, size: 12 },
        ].map((row) => (
          <G key={row.label + row.y}>
            <SvgText
              x={plateW / 2 + 0.7}
              y={row.y + 0.8}
              textAnchor="middle"
              fill={gold ? 'rgba(255,240,200,0.28)' : 'rgba(255,255,255,0.22)'}
              fontSize={row.size}
              fontWeight="900"
              letterSpacing={1.4}
            >
              {row.label}
            </SvgText>
            <SvgText
              x={plateW / 2}
              y={row.y}
              textAnchor="middle"
              fill={`url(#engraveTop-${uid})`}
              fontSize={row.size}
              fontWeight="900"
              letterSpacing={1.4}
            >
              {row.label}
            </SvgText>
            <SvgText
              x={plateW / 2 - 0.5}
              y={row.y - 0.6}
              textAnchor="middle"
              fill="rgba(0,0,0,0.55)"
              fontSize={row.size}
              fontWeight="900"
              letterSpacing={1.4}
            >
              {row.label}
            </SvgText>
          </G>
        ))}

        {/* Separators engraved */}
        <Line
          x1={14}
          y1={plateH * 0.38}
          x2={plateW - 16}
          y2={plateH * 0.38}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={0.8}
        />
        <Line
          x1={14}
          y1={plateH * 0.38 + 0.7}
          x2={plateW - 16}
          y2={plateH * 0.38 + 0.7}
          stroke={gold ? 'rgba(255,230,160,0.2)' : 'rgba(255,255,255,0.15)'}
          strokeWidth={0.6}
        />
        <Line
          x1={14}
          y1={plateH * 0.58}
          x2={plateW - 16}
          y2={plateH * 0.58}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={0.8}
        />
        <Line
          x1={14}
          y1={plateH * 0.58 + 0.7}
          x2={plateW - 16}
          y2={plateH * 0.58 + 0.7}
          stroke={gold ? 'rgba(255,230,160,0.2)' : 'rgba(255,255,255,0.15)'}
          strokeWidth={0.6}
        />

        {/* Specular flash across plate */}
        <Rect x={0} y={0} width={plateW - 2} height={plateH - 3} rx={10} fill={`url(#plateShine-${uid})`} opacity={0.55} />
      </Svg>
    </View>
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

  // Slow metallic flash across the bezel — rare, not a frame loop.
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
  const bezelWidth = 11;
  const innerRadius = radius - bezelWidth;
  const dayOfMonth = time.getDate();
  const brand = useMemo(() => truncateBrand(brandLine), [brandLine]);

  const dialFill = red
    ? isDark
      ? '#14090A'
      : '#FBEFEE'
    : gold
      ? isDark
        ? '#0C0904'
        : '#FBF4DF'
      : isDark
        ? '#0F0F11'
        : '#F7F7FA';

  const hourTick = gold ? (isDark ? '#F8E7B0' : '#6B4C10') : isDark ? '#FFFFFF' : '#1C1C1E';
  const hourTickShade = gold ? (isDark ? 'rgba(40,28,5,0.9)' : 'rgba(40,28,5,0.4)') : 'rgba(0,0,0,0.4)';
  const minuteTick = gold
    ? isDark
      ? 'rgba(255,214,120,0.78)'
      : 'rgba(140,100,20,0.58)'
    : isDark
      ? 'rgba(255,255,255,0.28)'
      : 'rgba(0,0,0,0.22)';
  const handFill = gold ? (isDark ? '#EFD9A4' : '#5A3F0A') : isDark ? '#E5E5EA' : '#2C2C2E';
  const handShade = 'rgba(0,0,0,0.5)';
  const secondColor = '#FF3B30';

  const gleamX = gleam.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.35, size * 0.85],
  });
  const gleamOpacity = gleam.interpolate({
    inputRange: [0, 0.35, 0.55, 1],
    outputRange: [0, 0.55, 0.35, 0],
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
      {/* Ambient gold glow behind case */}
      {gold ? (
        <View
          pointerEvents="none"
          style={[
            styles.ambientGlow,
            {
              width: size + 24,
              height: size + 24,
              borderRadius: (size + 24) / 2,
              left: -12,
              top: -12,
            },
          ]}
        />
      ) : null}

      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={`caseBody-${uid}`} cx="32%" cy="28%" r="78%">
            <Stop offset="0%" stopColor={gold ? (isDark ? '#FFF6DC' : '#FFFBEA') : '#FFFFFF'} stopOpacity={0.95} />
            <Stop offset="22%" stopColor={gold ? (isDark ? '#E8D090' : '#F0DC9A') : '#E8E8ED'} stopOpacity={1} />
            <Stop offset="48%" stopColor={gold ? (isDark ? '#A88420' : '#C9A227') : '#AEAEB2'} stopOpacity={1} />
            <Stop offset="72%" stopColor={gold ? (isDark ? '#5C4510' : '#8A6A18') : '#636366'} stopOpacity={1} />
            <Stop offset="100%" stopColor={gold ? (isDark ? '#1A1206' : '#4A3810') : '#1C1C1E'} stopOpacity={1} />
          </RadialGradient>
          <LinearGradient id={`bezelRim-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
            <Stop offset="0%" stopColor={gold ? '#FFF8E0' : '#FFFFFF'} stopOpacity={0.95} />
            <Stop offset="18%" stopColor={gold ? '#F0D878' : '#D1D1D6'} stopOpacity={0.85} />
            <Stop offset="42%" stopColor={gold ? '#8A6A14' : '#8E8E93'} stopOpacity={0.9} />
            <Stop offset="68%" stopColor={gold ? '#E8D090' : '#C7C7CC'} stopOpacity={0.7} />
            <Stop offset="100%" stopColor={gold ? '#3A2A08' : '#3A3A3C'} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id={`dialShade-${uid}`} cx="36%" cy="30%" r="74%">
            <Stop offset="0%" stopColor={isDark ? '#3A2E14' : '#FFFFFF'} stopOpacity={gold ? 0.7 : 0.4} />
            <Stop offset="35%" stopColor={dialFill} stopOpacity={1} />
            <Stop offset="78%" stopColor={isDark ? '#080603' : '#E8D8A8'} stopOpacity={1} />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#C4B07A'} stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id={`dialVignette-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={isDark ? 0.55 : 0.22} />
          </RadialGradient>
          <LinearGradient id={`handHighlight-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.4} />
          </LinearGradient>
          <LinearGradient id={`specularArc-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="50%" stopColor="#FFF8E0" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Case body fill */}
        <Circle cx={center} cy={center} r={radius - 0.5} fill={`url(#caseBody-${uid})`} />

        {/* Outer rim ridge */}
        <Circle
          cx={center}
          cy={center}
          r={radius - 1.5}
          fill="none"
          stroke={`url(#bezelRim-${uid})`}
          strokeWidth={4.5}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius - 4}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(255,248,220,0.5)' : 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.35)'}
          strokeWidth={1.2}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius - 6.5}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={2}
        />

        {/* Inner bezel step into dial */}
        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 3.5}
          fill="none"
          stroke={gold ? (isDark ? 'rgba(200,160,40,0.55)' : 'rgba(120,86,18,0.4)') : 'rgba(0,0,0,0.2)'}
          strokeWidth={5}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 1.2}
          fill="none"
          stroke="rgba(0,0,0,0.65)"
          strokeWidth={2.5}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius + 0.4}
          fill="none"
          stroke={gold ? 'rgba(255,230,160,0.25)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={1}
        />

        {/* Dial + vignette */}
        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialShade-${uid})`} />
        <Circle cx={center} cy={center} r={innerRadius} fill={`url(#dialVignette-${uid})`} />

        {/* Soft specular on upper-left of dial */}
        <Ellipse
          cx={center - radius * 0.18}
          cy={center - radius * 0.22}
          rx={radius * 0.28}
          ry={radius * 0.18}
          fill={gold ? 'rgba(255,240,200,0.12)' : 'rgba(255,255,255,0.08)'}
        />

        {/* Minute ticks */}
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
              <Line
                x1={x1 + 0.7}
                y1={y1 + 0.7}
                x2={x2 + 0.7}
                y2={y2 + 0.7}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1.3}
              />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={minuteTick} strokeWidth={1.4} strokeLinecap="round" />
              <Line
                x1={x1 - 0.35}
                y1={y1 - 0.35}
                x2={x2 - 0.35}
                y2={y2 - 0.35}
                stroke={gold ? 'rgba(255,248,220,0.35)' : 'rgba(255,255,255,0.25)'}
                strokeWidth={0.7}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        {/* Hour markers */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r1 = innerRadius - 2.5;
          const r2 = innerRadius - 17;
          const x1 = center + r1 * Math.sin(angle);
          const y1 = center - r1 * Math.cos(angle);
          const x2 = center + r2 * Math.sin(angle);
          const y2 = center - r2 * Math.cos(angle);
          const w = i % 3 === 0 ? 3.6 : 2.5;
          return (
            <G key={`hour-${i}`}>
              <Line
                x1={x1 + 1}
                y1={y1 + 1}
                x2={x2 + 1}
                y2={y2 + 1}
                stroke={hourTickShade}
                strokeWidth={w + 1}
                strokeLinecap="round"
              />
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hourTick} strokeWidth={w} strokeLinecap="round" />
              <Line
                x1={x1 - 0.5}
                y1={y1 - 0.5}
                x2={x2 - 0.5}
                y2={y2 - 0.5}
                stroke={gold ? 'rgba(255,252,235,0.65)' : 'rgba(255,255,255,0.45)'}
                strokeWidth={Math.max(1, w - 1.5)}
                strokeLinecap="round"
              />
            </G>
          );
        })}

        {/* Brand */}
        <SvgText
          x={center + 0.5}
          y={center - radius * 0.32 + 0.6}
          textAnchor="middle"
          fill="rgba(0,0,0,0.45)"
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
                ? 'rgba(245,223,166,0.7)'
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

        {/* Day window */}
        <G transform={`translate(${center + radius * 0.4}, ${center - 10})`}>
          <Rect x={1} y={1.2} width={20} height={20} rx={4} fill="rgba(0,0,0,0.5)" />
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
          <Rect
            x={1.2}
            y={1.2}
            width={17.6}
            height={17.6}
            rx={3}
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.8}
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

        {/* Hour hand */}
        <G transform={`rotate(${hourAngle}, ${center}, ${center})`}>
          <Rect x={center - 2} y={center - radius * 0.45} width={6.5} height={radius * 0.5} rx={3} fill={handShade} opacity={0.6} />
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

        {/* Minute hand */}
        <G transform={`rotate(${minuteAngle}, ${center}, ${center})`}>
          <Rect x={center - 1} y={center - radius * 0.69} width={4.2} height={radius * 0.74} rx={2} fill={handShade} opacity={0.55} />
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

        {/* Second hand */}
        <G transform={`rotate(${secondAngle}, ${center}, ${center})`}>
          <Line
            x1={center + 0.9}
            y1={center + 15}
            x2={center + 0.9}
            y2={center - radius * 0.8}
            stroke="rgba(0,0,0,0.4)"
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

        {/* Center gem */}
        <Circle cx={center + 0.7} cy={center + 0.9} r={5.4} fill="rgba(0,0,0,0.45)" />
        <Circle
          cx={center}
          cy={center}
          r={5.1}
          fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
        />
        <Circle cx={center} cy={center} r={2.7} fill={secondColor} />
        <Circle cx={center - 0.7} cy={center - 0.9} r={1.15} fill="rgba(255,255,255,0.6)" />

        {/* Static bezel specular crescent */}
        <Path
          d={`M ${center - radius * 0.72} ${center - radius * 0.55}
              A ${radius * 0.85} ${radius * 0.85} 0 0 1 ${center + radius * 0.15} ${center - radius * 0.78}`}
          fill="none"
          stroke={`url(#specularArc-${uid})`}
          strokeWidth={3.2}
          strokeLinecap="round"
          opacity={0.7}
        />
      </Svg>

      {/* Animated metallic flash sweep */}
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

  return (
    <View style={styles.row}>
      {dial}
      <EngravedDatePlate date={time} isDark={isDark} gold={gold || red} height={size} />
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 12,
    marginVertical: 8,
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,230,160,0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 14,
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(201,162,39,0.18)',
  },
  gleamSweep: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,248,220,0.35)',
  },
  datePlateShell: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
