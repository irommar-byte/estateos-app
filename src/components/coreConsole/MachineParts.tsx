import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

/** Maszynownia CORE: zawsze ciemny pulpit, złoto EstateOS jako akcent. */
export const MACHINE = {
  bg: '#060708',
  panelTop: '#16181C',
  panelBottom: '#0C0D10',
  bezel: 'rgba(255,255,255,0.07)',
  bezelHi: 'rgba(255,255,255,0.12)',
  hairline: 'rgba(255,255,255,0.06)',
  well: '#0A0B0D',
  text: '#EDEEF0',
  secondary: '#9A9EA6',
  muted: '#5C6068',
  gold: '#CBA135',
  goldSoft: 'rgba(203,161,53,0.16)',
  ok: '#34E07A',
  warn: '#FFB020',
  crit: '#FF4D4D',
  flow: '#5AC8FA',
  db: '#A78BFA',
  off: '#2A2D33',
} as const;

export const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export type LedMode = 'steady' | 'breathe' | 'blink' | 'off';
export type Health = 'ok' | 'warning' | 'critical' | 'idle';

export function healthColor(level: Health | string) {
  if (level === 'critical' || level === 'errored' || level === 'offline' || level === 'down') return MACHINE.crit;
  if (level === 'warning' || level === 'launching' || level === 'stopping') return MACHINE.warn;
  if (level === 'idle') return MACHINE.muted;
  return MACHINE.ok;
}

function loopFor(value: Animated.Value, mode: LedMode, period: number) {
  if (mode === 'blink') {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.delay(period * 0.35),
        Animated.timing(value, { toValue: 0.12, duration: 70, useNativeDriver: true }),
        Animated.delay(period * 0.65),
      ]),
    );
  }
  const half = period / 2;
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.22, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]),
  );
}

/** Dioda: rdzeń + poświata. breathe = oddycha, blink = mruga ostro, steady = świeci. */
export function Led({
  color,
  mode = 'steady',
  period = 1800,
  size = 8,
}: {
  color: string;
  mode?: LedMode;
  period?: number;
  size?: number;
}) {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (mode === 'steady' || mode === 'off') {
      value.setValue(1);
      return undefined;
    }
    const anim = loopFor(value, mode, Math.max(240, period));
    anim.start();
    return () => anim.stop();
  }, [mode, period, value]);

  const lit = mode !== 'off';
  const fill = lit ? color : MACHINE.off;
  const halo = size * 2.8;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      {lit ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            backgroundColor: fill,
            opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.26] }),
            transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
          }}
        />
      ) : null}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          opacity: lit ? value.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] }) : 1,
          shadowColor: fill,
          shadowOpacity: lit ? 0.95 : 0,
          shadowRadius: size * 0.7,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: size * 0.16,
            left: size * 0.2,
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: size,
            backgroundColor: 'rgba(255,255,255,0.55)',
          }}
        />
      </Animated.View>
    </View>
  );
}

/** Panel pulpitu: szczotkowany grafit, jasna krawędź u góry, etykieta w kapitalikach. */
export function Panel({
  title,
  right,
  children,
  style,
  padded = true,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: object;
  padded?: boolean;
}) {
  return (
    <View style={[parts.panelShell, style]}>
      <LinearGradient colors={[MACHINE.panelTop, MACHINE.panelBottom]} style={StyleSheet.absoluteFill} />
      <View style={parts.panelHighlight} />
      {title ? (
        <View style={parts.panelHead}>
          <View style={parts.panelRivet} />
          <Text style={parts.panelTitle}>{title}</Text>
          <View style={{ flex: 1 }} />
          {right}
        </View>
      ) : null}
      <View style={padded ? parts.panelBody : undefined}>{children}</View>
    </View>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, to);
  const b = polar(cx, cy, r, from);
  const large = to - from <= 180 ? 0 : 1;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 0 ${b.x} ${b.y}`;
}

const GAUGE_FROM = -135;
const GAUGE_SWEEP = 270;

/** Zegar analogowy 270° z podziałką; wartość 0–100. */
export function Gauge({
  percent,
  value,
  unit,
  label,
  hint,
  color,
  size = 132,
}: {
  percent: number | null;
  value: string;
  unit?: string;
  label: string;
  hint?: string;
  color: string;
  size?: number;
}) {
  const c = size / 2;
  const r = c - 12;
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const end = GAUGE_FROM + (GAUGE_SWEEP * p) / 100;
  const ticks = useMemo(
    () =>
      Array.from({ length: 31 }, (_, i) => {
        const deg = GAUGE_FROM + (GAUGE_SWEEP * i) / 30;
        const major = i % 5 === 0;
        const outer = polar(c, c, r + 8, deg);
        const inner = polar(c, c, r + (major ? 2 : 5), deg);
        return { key: i, outer, inner, major, hot: i >= 24 };
      }),
    [c, r],
  );
  const tip = polar(c, c, r, end);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {ticks.map((t) => (
            <Line
              key={t.key}
              x1={t.inner.x}
              y1={t.inner.y}
              x2={t.outer.x}
              y2={t.outer.y}
              stroke={t.hot ? 'rgba(255,77,77,0.55)' : t.major ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.14)'}
              strokeWidth={t.major ? 1.4 : 1}
            />
          ))}
          <Path d={arcPath(c, c, r, GAUGE_FROM, GAUGE_FROM + GAUGE_SWEEP)} stroke={MACHINE.well} strokeWidth={7} fill="none" strokeLinecap="round" />
          {percent != null && p > 0.5 ? (
            <>
              <Path d={arcPath(c, c, r, GAUGE_FROM, end)} stroke={color} strokeOpacity={0.22} strokeWidth={13} fill="none" strokeLinecap="round" />
              <Path d={arcPath(c, c, r, GAUGE_FROM, end)} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
              <Circle cx={tip.x} cy={tip.y} r={3.2} fill="#FFFFFF" />
            </>
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, parts.gaugeCenter]}>
          <Text style={parts.gaugeValue} numberOfLines={1} adjustsFontSizeToFit>
            {value}
            {unit ? <Text style={parts.gaugeUnit}>{unit}</Text> : null}
          </Text>
          <Text style={[parts.gaugeLabel, { color }]}>{label}</Text>
        </View>
      </View>
      {hint ? (
        <Text style={parts.gaugeHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Oscyloskop: krzywa z wypełnieniem, siatka i przesuwająca się wiązka skanu. */
export function Scope({
  data,
  color,
  height = 64,
  max,
  live = true,
  grid = true,
}: {
  data: number[];
  color: string;
  height?: number;
  max?: number;
  live?: boolean;
  grid?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || !width) return undefined;
    sweep.setValue(0);
    const anim = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [live, sweep, width]);

  const gradientId = useMemo(() => `scope-${Math.random().toString(36).slice(2, 9)}`, []);
  const points = data.filter((v) => Number.isFinite(v));
  const top = Math.max(max ?? 0, ...points, 1);
  const path = useMemo(() => {
    if (!width || points.length < 2) return null;
    const step = width / (points.length - 1);
    const y = (v: number) => height - 3 - (Math.max(0, v) / top) * (height - 8);
    let line = `M 0 ${y(points[0])}`;
    for (let i = 1; i < points.length; i += 1) {
      const x0 = (i - 1) * step;
      const x1 = i * step;
      const mid = (x0 + x1) / 2;
      line += ` C ${mid} ${y(points[i - 1])} ${mid} ${y(points[i])} ${x1} ${y(points[i])}`;
    }
    return { line, area: `${line} L ${width} ${height} L 0 ${height} Z`, lastY: y(points[points.length - 1]) };
  }, [height, points, top, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  return (
    <View style={[parts.scopeWell, { height }]} onLayout={onLayout}>
      {width ? (
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          {grid
            ? [0.25, 0.5, 0.75].map((f) => (
                <Line key={`h${f}`} x1={0} x2={width} y1={height * f} y2={height * f} stroke="rgba(255,255,255,0.045)" strokeWidth={1} />
              ))
            : null}
          {grid
            ? Array.from({ length: 7 }, (_, i) => (
                <Line key={`v${i}`} y1={0} y2={height} x1={(width * (i + 1)) / 8} x2={(width * (i + 1)) / 8} stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
              ))
            : null}
          {path ? (
            <>
              <Path d={path.area} fill={`url(#${gradientId})`} />
              <Path d={path.line} stroke={color} strokeWidth={1.6} fill="none" />
              <Circle cx={width - 1.5} cy={path.lastY} r={2.6} fill={color} />
            </>
          ) : (
            <Line x1={0} x2={width} y1={height - 4} y2={height - 4} stroke={color} strokeOpacity={0.35} strokeDasharray="3 5" />
          )}
        </Svg>
      ) : null}
      {live && width ? (
        <Animated.View
          pointerEvents="none"
          style={[
            parts.scopeBeam,
            {
              height,
              backgroundColor: color,
              transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-24, width] }) }],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Serce maszyny: obrotowa podziałka turbiny, oddychające pierścienie, wynik zdrowia. */
export function Reactor({
  score,
  color,
  periodMs,
  caption,
  size = 176,
}: {
  score: number | null;
  color: string;
  periodMs: number;
  caption: string;
  size?: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 36000, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [spin]);
  useEffect(() => {
    const half = Math.max(260, periodMs / 2);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: half, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: half, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [breath, periodMs]);

  const c = size / 2;
  const ringR = c - 26;
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * ringR;
  const ticks = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const deg = i * 5;
        const major = i % 6 === 0;
        const a = polar(c, c, c - 4, deg);
        const b = polar(c, c, c - (major ? 13 : 9), deg);
        return { key: i, a, b, major };
      }),
    [c],
  );
  const bpm = Math.round(60000 / Math.max(1, periodMs));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1].map((layer) => (
        <Animated.View
          key={layer}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size - 30,
            height: size - 30,
            borderRadius: size,
            borderWidth: layer ? 1 : 10,
            borderColor: color,
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: layer ? [0, 0.5] : [0.04, 0.16] }),
            transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: layer ? [0.9, 1.12] : [0.94, 1.04] }) }],
          }}
        />
      ))}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      >
        <Svg width={size} height={size}>
          {ticks.map((t) => (
            <Line
              key={t.key}
              x1={t.a.x}
              y1={t.a.y}
              x2={t.b.x}
              y2={t.b.y}
              stroke={t.major ? MACHINE.gold : 'rgba(255,255,255,0.16)'}
              strokeWidth={t.major ? 1.6 : 1}
            />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={ringR} stroke={MACHINE.well} strokeWidth={8} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={ringR}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - (value / 100) * circumference}
          transform={`rotate(-90 ${c} ${c})`}
        />
        <Circle cx={c} cy={c} r={ringR - 14} fill="#0B0C0F" stroke={MACHINE.bezel} strokeWidth={1} />
      </Svg>
      <View style={parts.reactorCenter}>
        <Text style={[parts.reactorScore, { color }]}>{score == null ? '—' : value}</Text>
        <Text style={parts.reactorCaption}>{caption}</Text>
        <View style={parts.reactorPulse}>
          <Led color={color} mode="breathe" period={periodMs} size={5} />
          <Text style={parts.reactorBpm}>{bpm} / min</Text>
        </View>
      </View>
    </View>
  );
}

/** Wskaźnik liczbowy na pulpicie: etykieta, wartość mono, dioda statusu. */
export function Readout({
  label,
  value,
  hint,
  color = MACHINE.text,
  led,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  led?: { color: string; mode?: LedMode; period?: number };
}) {
  return (
    <View style={parts.readout}>
      <View style={[parts.readoutHead, led && { marginLeft: -5 }]}>
        {led ? <Led color={led.color} mode={led.mode} period={led.period} size={5} /> : null}
        <Text style={parts.readoutLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[parts.readoutValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={parts.readoutHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Pozioma belka obciążenia z segmentami jak w wskaźniku VU. */
export function SegmentMeter({ percent, color, segments = 24 }: { percent: number; color: string; segments?: number }) {
  const lit = Math.round((Math.max(0, Math.min(100, percent)) / 100) * segments);
  return (
    <View style={parts.segmentMeter}>
      {Array.from({ length: segments }, (_, i) => {
        const on = i < lit;
        const zone = i >= segments * 0.85 ? MACHINE.crit : i >= segments * 0.7 ? MACHINE.warn : color;
        return <View key={i} style={[parts.segment, { backgroundColor: on ? zone : 'rgba(255,255,255,0.05)' }]} />;
      })}
    </View>
  );
}

const parts = StyleSheet.create({
  panelShell: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MACHINE.bezel,
    overflow: 'hidden',
    marginBottom: 14,
  },
  panelHighlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: MACHINE.bezelHi,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  panelRivet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: MACHINE.gold,
    opacity: 0.85,
  },
  panelTitle: {
    color: MACHINE.secondary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  panelBody: { padding: 16 },
  gaugeCenter: { alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  gaugeValue: {
    color: MACHINE.text,
    fontSize: 24,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
    maxWidth: 86,
  },
  gaugeUnit: { fontSize: 12, color: MACHINE.secondary, fontWeight: '500' },
  gaugeLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  gaugeHint: { color: MACHINE.secondary, fontSize: 11, marginTop: -6, maxWidth: 140, textAlign: 'center' },
  scopeWell: {
    backgroundColor: MACHINE.well,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MACHINE.hairline,
    overflow: 'hidden',
  },
  scopeBeam: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    opacity: 0.07,
  },
  reactorCenter: { alignItems: 'center', justifyContent: 'center' },
  reactorScore: { fontSize: 46, fontWeight: '200', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  reactorCaption: { color: MACHINE.secondary, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.8, marginTop: -4 },
  reactorPulse: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  reactorBpm: { color: MACHINE.muted, fontSize: 10, fontFamily: MONO },
  readout: { flex: 1, minWidth: 0 },
  readoutHead: { flexDirection: 'row', alignItems: 'center' },
  readoutLabel: { color: MACHINE.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  readoutValue: { fontSize: 20, fontWeight: '300', fontFamily: MONO, letterSpacing: -0.5, marginTop: 2 },
  readoutHint: { color: MACHINE.secondary, fontSize: 11, marginTop: 2 },
  segmentMeter: { flexDirection: 'row', gap: 2, height: 6 },
  segment: { flex: 1, borderRadius: 1.5 },
});
