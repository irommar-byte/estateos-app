import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';

type Props = {
  size?: number;
  isDark?: boolean;
  /** Hands, brand line and center cap accent. */
  accent?: string;
  /** `gold` dresses the case and dial in warm alloy tones. */
  variant?: 'steel' | 'gold';
};

export default function AnalogAppleClock({
  size = 180,
  isDark = true,
  accent = '#34C759',
  variant = 'steel',
}: Props) {
  const gold = variant === 'gold';
  const [time, setTime] = useState(() => new Date());
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      setTime(new Date());
      animFrame.current = requestAnimationFrame(update);
    };
    animFrame.current = requestAnimationFrame(update);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, []);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const millis = time.getMilliseconds();

  const smoothSeconds = seconds + millis / 1000;
  const smoothMinutes = minutes + smoothSeconds / 60;
  const smoothHours = hours + smoothMinutes / 60;

  const secondAngle = smoothSeconds * 6; // 360 / 60
  const minuteAngle = smoothMinutes * 6; // 360 / 60
  const hourAngle = smoothHours * 30; // 360 / 12

  const radius = size / 2;
  const center = radius;
  const innerRadius = radius - 8;

  const dayOfMonth = time.getDate();

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Outer Metallic Ring */}
      <View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: gold
              ? isDark
                ? 'rgba(255,226,163,0.42)'
                : 'rgba(120,86,18,0.35)'
              : isDark
                ? 'rgba(255,255,255,0.22)'
                : 'rgba(0,0,0,0.15)',
            backgroundColor: gold ? (isDark ? '#171208' : '#F2E4BE') : isDark ? '#141416' : '#E8E8ED',
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Dial Background */}
          <Circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill={gold ? (isDark ? '#0E0B05' : '#FBF4DF') : isDark ? '#0F0F11' : '#F7F7FA'}
            stroke={
              gold
                ? isDark
                  ? 'rgba(255,226,163,0.16)'
                  : 'rgba(120,86,18,0.14)'
                : isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.08)'
            }
            strokeWidth={1.5}
          />

          {/* 60 Minute Ticks */}
          {Array.from({ length: 60 }).map((_, i) => {
            if (i % 5 === 0) return null; // Primary hour ticks drawn separately
            const angle = (i * 6 * Math.PI) / 180;
            const r1 = innerRadius - 4;
            const r2 = innerRadius - 8;
            const x1 = center + r1 * Math.sin(angle);
            const y1 = center - r1 * Math.cos(angle);
            const x2 = center + r2 * Math.sin(angle);
            const y2 = center - r2 * Math.cos(angle);
            return (
              <Line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  gold
                    ? isDark
                      ? 'rgba(255,226,163,0.28)'
                      : 'rgba(120,86,18,0.28)'
                    : isDark
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(0,0,0,0.18)'
                }
                strokeWidth={1}
              />
            );
          })}

          {/* 12 Hour Markers */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const r1 = innerRadius - 4;
            const r2 = innerRadius - 14;
            const x1 = center + r1 * Math.sin(angle);
            const y1 = center - r1 * Math.cos(angle);
            const x2 = center + r2 * Math.sin(angle);
            const y2 = center - r2 * Math.cos(angle);
            return (
              <Line
                key={`hour-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={gold ? (isDark ? '#F5DFA6' : '#6B4C10') : isDark ? '#FFFFFF' : '#1C1C1E'}
                strokeWidth={i % 3 === 0 ? 3 : 2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Brand Text */}
          <SvgText
            x={center}
            y={center - radius * 0.32}
            textAnchor="middle"
            fill={
              gold
                ? isDark
                  ? 'rgba(245,223,166,0.6)'
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
            fontSize={6}
            fontWeight="700"
            letterSpacing={1.2}
          >
            AUTOMATIC
          </SvgText>

          {/* Date Window at 3 o'clock */}
          <G transform={`translate(${center + radius * 0.42}, ${center - 9})`}>
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
                    ? 'rgba(255,226,163,0.3)'
                    : 'rgba(120,86,18,0.3)'
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

          {/* Hour Hand */}
          <G transform={`rotate(${hourAngle}, ${center}, ${center})`}>
            <Rect
              x={center - 3}
              y={center - radius * 0.48}
              width={6}
              height={radius * 0.52}
              rx={3}
              fill={gold ? (isDark ? '#EFD9A4' : '#5A3F0A') : isDark ? '#E5E5EA' : '#2C2C2E'}
            />
            <Rect
              x={center - 1}
              y={center - radius * 0.44}
              width={2}
              height={radius * 0.35}
              rx={1}
              fill={accent}
            />
          </G>

          {/* Minute Hand */}
          <G transform={`rotate(${minuteAngle}, ${center}, ${center})`}>
            <Rect
              x={center - 2}
              y={center - radius * 0.72}
              width={4}
              height={radius * 0.76}
              rx={2}
              fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
            />
            <Rect
              x={center - 0.75}
              y={center - radius * 0.68}
              width={1.5}
              height={radius * 0.55}
              rx={0.75}
              fill={accent}
            />
          </G>

          {/* Second Hand */}
          <G transform={`rotate(${secondAngle}, ${center}, ${center})`}>
            <Line
              x1={center}
              y1={center + 14}
              x2={center}
              y2={center - radius * 0.82}
              stroke={accent}
              strokeWidth={1.5}
            />
            <Circle cx={center} cy={center - radius * 0.62} r={3} fill={accent} />
          </G>

          {/* Center Cap */}
          <Circle
            cx={center}
            cy={center}
            r={5}
            fill={gold ? (isDark ? '#FFF6DC' : '#3F2B05') : isDark ? '#FFFFFF' : '#000000'}
          />
          <Circle cx={center} cy={center} r={2.5} fill={accent} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  outerRing: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
