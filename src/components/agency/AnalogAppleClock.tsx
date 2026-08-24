import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type Props = {
  size?: number;
  isDark?: boolean;
  /** Accent for center gem (hour/minute highlights stay gold). */
  accent?: string;
  variant?: 'steel' | 'gold' | 'red';
  /** Replaces the old AUTOMATIC line — typically agency company name. */
  brandLine?: string | null;
};

function truncateBrand(raw: string | null | undefined, max = 16): string {
  const t = String(raw || '').trim();
  if (!t) return 'ESTATEOS';
  if (t.length <= max) return t.toUpperCase();
  return `${t.slice(0, max - 1).trim().toUpperCase()}…`;
}

function AnalogAppleClock({
  size = 180,
  isDark = true,
  accent = '#34C759',
  variant = 'steel',
  brandLine,
}: Props) {
  const gold = variant === 'gold';
  const red = variant === 'red';
  const [time, setTime] = useState(() => new Date());

  // Tick once per second — requestAnimationFrame was burning CPU on Profile.
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const secondAngle = seconds * 6;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = (hours + minutes / 60) * 30;

  const radius = size / 2;
  const center = radius;
  const innerRadius = radius - 10;
  const dayOfMonth = time.getDate();
  const brand = useMemo(() => truncateBrand(brandLine), [brandLine]);

  const dialFill = red
    ? isDark
      ? '#14090A'
      : '#FBEFEE'
    : gold
      ? isDark
        ? '#0E0B05'
        : '#FBF4DF'
      : isDark
        ? '#0F0F11'
        : '#F7F7FA';

  const hourTick = gold ? (isDark ? '#F5DFA6' : '#6B4C10') : isDark ? '#FFFFFF' : '#1C1C1E';
  const hourTickShade = gold ? (isDark ? 'rgba(90,60,10,0.85)' : 'rgba(40,28,5,0.35)') : 'rgba(0,0,0,0.35)';
  const minuteTick = gold
    ? isDark
      ? 'rgba(255,214,120,0.72)'
      : 'rgba(140,100,20,0.55)'
    : isDark
      ? 'rgba(255,255,255,0.28)'
      : 'rgba(0,0,0,0.22)';
  const handFill = gold ? (isDark ? '#EFD9A4' : '#5A3F0A') : isDark ? '#E5E5EA' : '#2C2C2E';
  const handShade = 'rgba(0,0,0,0.45)';
  const secondColor = '#FF3B30';
  const ringOuter = gold
    ? isDark
      ? 'rgba(255,226,163,0.55)'
      : 'rgba(120,86,18,0.42)'
    : red
      ? isDark
        ? 'rgba(255,176,166,0.45)'
        : 'rgba(110,22,18,0.38)'
      : isDark
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(0,0,0,0.15)';

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: ringOuter,
            backgroundColor: gold
              ? isDark
                ? '#171208'
                : '#F2E4BE'
              : red
                ? isDark
                  ? '#1A0C0D'
                  : '#F4D8D4'
                : isDark
                  ? '#141416'
                  : '#E8E8ED',
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="dialShade" cx="38%" cy="32%" r="72%">
              <Stop offset="0%" stopColor={isDark ? '#2A2210' : '#FFFFFF'} stopOpacity={gold ? 0.55 : 0.35} />
              <Stop offset="55%" stopColor={dialFill} stopOpacity={1} />
              <Stop offset="100%" stopColor={isDark ? '#050403' : '#D8C9A0'} stopOpacity={1} />
            </RadialGradient>
            <LinearGradient id="bezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gold ? '#FFF6DC' : '#FFFFFF'} stopOpacity={0.55} />
              <Stop offset="45%" stopColor={gold ? '#C9A227' : '#888'} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={isDark ? '#1A1408' : '#8A7040'} stopOpacity={0.75} />
            </LinearGradient>
            <LinearGradient id="handHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>

          {/* Bezel depth rings */}
          <Circle cx={center} cy={center} r={radius - 1} fill="none" stroke="url(#bezelGrad)" strokeWidth={5} />
          <Circle
            cx={center}
            cy={center}
            r={radius - 4}
            fill="none"
            stroke={gold ? (isDark ? 'rgba(255,226,163,0.35)' : 'rgba(90,60,10,0.28)') : 'rgba(255,255,255,0.12)'}
            strokeWidth={1.5}
          />
          <Circle
            cx={center}
            cy={center}
            r={innerRadius + 1}
            fill="none"
            stroke={isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.12)'}
            strokeWidth={3}
          />

          {/* Dial */}
          <Circle cx={center} cy={center} r={innerRadius} fill="url(#dialShade)" />
          <Circle
            cx={center}
            cy={center}
            r={innerRadius - 0.5}
            fill="none"
            stroke={gold ? (isDark ? 'rgba(255,226,163,0.22)' : 'rgba(120,86,18,0.18)') : 'rgba(255,255,255,0.1)'}
            strokeWidth={1.2}
          />

          {/* Minute ticks (every minute except hours) with gold shading */}
          {Array.from({ length: 60 }).map((_, i) => {
            if (i % 5 === 0) return null;
            const angle = (i * 6 * Math.PI) / 180;
            const r1 = innerRadius - 3;
            const r2 = innerRadius - 9;
            const x1 = center + r1 * Math.sin(angle);
            const y1 = center - r1 * Math.cos(angle);
            const x2 = center + r2 * Math.sin(angle);
            const y2 = center - r2 * Math.cos(angle);
            return (
              <G key={`tick-${i}`}>
                <Line
                  x1={x1 + 0.6}
                  y1={y1 + 0.6}
                  x2={x2 + 0.6}
                  y2={y2 + 0.6}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1.2}
                />
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={minuteTick} strokeWidth={1.35} strokeLinecap="round" />
              </G>
            );
          })}

          {/* Hour markers — gold with depth */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const r1 = innerRadius - 3;
            const r2 = innerRadius - 16;
            const x1 = center + r1 * Math.sin(angle);
            const y1 = center - r1 * Math.cos(angle);
            const x2 = center + r2 * Math.sin(angle);
            const y2 = center - r2 * Math.cos(angle);
            const w = i % 3 === 0 ? 3.4 : 2.4;
            return (
              <G key={`hour-${i}`}>
                <Line
                  x1={x1 + 0.9}
                  y1={y1 + 0.9}
                  x2={x2 + 0.9}
                  y2={y2 + 0.9}
                  stroke={hourTickShade}
                  strokeWidth={w + 0.8}
                  strokeLinecap="round"
                />
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hourTick} strokeWidth={w} strokeLinecap="round" />
                <Line
                  x1={x1 - 0.4}
                  y1={y1 - 0.4}
                  x2={x2 - 0.4}
                  y2={y2 - 0.4}
                  stroke={gold ? 'rgba(255,248,220,0.55)' : 'rgba(255,255,255,0.4)'}
                  strokeWidth={Math.max(1, w - 1.4)}
                  strokeLinecap="round"
                />
              </G>
            );
          })}

          <SvgText
            x={center}
            y={center - radius * 0.32}
            textAnchor="middle"
            fill={
              gold
                ? isDark
                  ? 'rgba(245,223,166,0.62)'
                  : 'rgba(107,76,16,0.6)'
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

          <G transform={`translate(${center + radius * 0.42}, ${center - 9})`}>
            <Rect
              x={0.8}
              y={0.8}
              width={18}
              height={18}
              rx={4}
              fill="rgba(0,0,0,0.35)"
            />
            <Rect
              x={0}
              y={0}
              width={18}
              height={18}
              rx={4}
              fill={gold ? (isDark ? '#1A1409' : '#FFFDF3') : isDark ? '#1C1C1E' : '#FFFFFF'}
              stroke={
                gold
                  ? isDark
                    ? 'rgba(255,226,163,0.4)'
                    : 'rgba(120,86,18,0.35)'
                  : isDark
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.2)'
              }
              strokeWidth={1}
            />
            <SvgText
              x={9}
              y={13}
              textAnchor="middle"
              fill={gold ? (isDark ? '#F7E7BC' : '#4F3808') : isDark ? '#FFFFFF' : '#000000'}
              fontSize={10}
              fontWeight="900"
            >
              {dayOfMonth}
            </SvgText>
          </G>

          {/* Hour hand — shadow + body + highlight */}
          <G transform={`rotate(${hourAngle}, ${center}, ${center})`}>
            <Rect
              x={center - 2.2}
              y={center - radius * 0.46}
              width={6}
              height={radius * 0.5}
              rx={3}
              fill={handShade}
              opacity={0.55}
            />
            <Rect
              x={center - 3}
              y={center - radius * 0.48}
              width={6}
              height={radius * 0.52}
              rx={3}
              fill={handFill}
            />
            <Rect
              x={center - 1.6}
              y={center - radius * 0.46}
              width={2.2}
              height={radius * 0.4}
              rx={1.1}
              fill="url(#handHighlight)"
            />
          </G>

          {/* Minute hand */}
          <G transform={`rotate(${minuteAngle}, ${center}, ${center})`}>
            <Rect
              x={center - 1.2}
              y={center - radius * 0.7}
              width={4}
              height={radius * 0.74}
              rx={2}
              fill={handShade}
              opacity={0.5}
            />
            <Rect
              x={center - 2}
              y={center - radius * 0.72}
              width={4}
              height={radius * 0.76}
              rx={2}
              fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
            />
            <Rect
              x={center - 0.9}
              y={center - radius * 0.7}
              width={1.4}
              height={radius * 0.58}
              rx={0.7}
              fill="url(#handHighlight)"
            />
          </G>

          {/* Second hand — red with counterweight */}
          <G transform={`rotate(${secondAngle}, ${center}, ${center})`}>
            <Line
              x1={center + 0.8}
              y1={center + 15}
              x2={center + 0.8}
              y2={center - radius * 0.8}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={1.8}
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
            <Circle cx={center} cy={center - radius * 0.62} r={1.2} fill="rgba(255,255,255,0.45)" />
            <Circle cx={center} cy={center + 12} r={2.2} fill={secondColor} />
          </G>

          {/* Center cap — gem volume */}
          <Circle cx={center + 0.6} cy={center + 0.8} r={5.2} fill="rgba(0,0,0,0.4)" />
          <Circle
            cx={center}
            cy={center}
            r={5}
            fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
          />
          <Circle cx={center} cy={center} r={2.6} fill={secondColor} />
          <Circle cx={center - 0.6} cy={center - 0.8} r={1.1} fill="rgba(255,255,255,0.55)" />
        </Svg>
      </View>
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
  outerRing: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 10,
  },
});
