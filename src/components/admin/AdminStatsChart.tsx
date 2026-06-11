import React, { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import type { AdminStatsTabId } from '../../utils/adminStatistics';

type ChartColors = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipLabel: string;
  tooltipValue: string;
  cursor: string;
};

type Props = {
  data: Array<Record<string, unknown>>;
  dataKey: AdminStatsTabId;
  color: string;
  width: number;
  height: number;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  colors: ChartColors;
};

const PADDING = { left: 38, right: 12, top: 16, bottom: 36 };

export default function AdminStatsChart({
  data,
  dataKey,
  color,
  width,
  height,
  selectedIndex,
  onSelectIndex,
  colors,
}: Props) {
  const layoutRef = useRef({ width, height, pointCount: data.length });

  const values = useMemo(() => data.map((d) => Number(d[dataKey] || 0)), [data, dataKey]);
  const maxVal = Math.max(1, ...values);
  const chartW = Math.max(1, width - PADDING.left - PADDING.right);
  const chartH = Math.max(1, height - PADDING.top - PADDING.bottom);

  const points = useMemo(
    () =>
      values.map((v, i) => ({
        x: PADDING.left + (i / Math.max(1, values.length - 1)) * chartW,
        y: PADDING.top + chartH - (v / maxVal) * chartH,
        v,
        label: String(data[i]?.name || ''),
      })),
    [values, data, chartW, chartH, maxVal],
  );

  layoutRef.current = { width, height, pointCount: points.length };

  const indexFromX = useCallback((locationX: number) => {
    const { pointCount } = layoutRef.current;
    if (pointCount < 1) return 0;
    const rel = locationX - PADDING.left;
    const ratio = rel / chartW;
    return Math.max(0, Math.min(pointCount - 1, Math.round(ratio * (pointCount - 1))));
  }, [chartW]);

  const lastIndexRef = useRef(selectedIndex);

  const pickIndex = useCallback(
    (locationX: number) => {
      const idx = indexFromX(locationX);
      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx;
        void Haptics.selectionAsync();
        onSelectIndex(idx);
      }
    },
    [indexFromX, onSelectIndex],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => pickIndex(e.nativeEvent.locationX),
        onPanResponderMove: (e) => pickIndex(e.nativeEvent.locationX),
      }),
    [pickIndex],
  );

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: colors.axis, fontSize: 13 }}>Brak danych wykresu.</Text>
      </View>
    );
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PADDING.top + chartH} L ${points[0].x} ${PADDING.top + chartH} Z`;
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: PADDING.top + chartH - t * chartH,
    label: Math.round(maxVal * t).toLocaleString('pl-PL'),
  }));
  const active = points[selectedIndex] ?? points[points.length - 1];
  const labelStep = Math.ceil(Math.max(1, points.length / 6));

  return (
    <View>
      <View style={{ height }} {...panResponder.panHandlers}>
        <Svg width={width} height={height} pointerEvents="none">
          <Defs>
            <LinearGradient id="adminStatsArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          {yTicks.map((tick) => (
            <Line
              key={tick.label}
              x1={PADDING.left}
              y1={tick.y}
              x2={width - PADDING.right}
              y2={tick.y}
              stroke={colors.grid}
              strokeDasharray="4 4"
            />
          ))}
          <Path d={areaPath} fill="url(#adminStatsArea)" />
          <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Line
            x1={active.x}
            y1={PADDING.top}
            x2={active.x}
            y2={PADDING.top + chartH}
            stroke={colors.cursor}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Circle cx={active.x} cy={active.y} r={5} fill={color} stroke="#fff" strokeWidth={2} />
          {points.map((p, i) => (
            <SvgText
              key={`${p.label}-${i}`}
              x={p.x}
              y={height - 10}
              fill={colors.axis}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {i % labelStep === 0 || i === points.length - 1 ? p.label : ''}
            </SvgText>
          ))}
          {yTicks.slice(1).map((tick) => (
            <SvgText key={`y-${tick.label}`} x={6} y={tick.y + 3} fill={colors.axis} fontSize={9} fontWeight="600">
              {tick.label}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={[styles.tooltip, { backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder }]}>
        <Text style={[styles.tooltipLabel, { color: colors.tooltipLabel }]}>{active.label}</Text>
        <Text style={[styles.tooltipValue, { color: colors.tooltipValue }]}>
          {Number(active.v || 0).toLocaleString('pl-PL')}
        </Text>
        <Text style={[styles.tooltipHint, { color: colors.tooltipLabel }]}>Przesuń palcem po wykresie</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  tooltip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tooltipLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  tooltipValue: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 },
  tooltipHint: { fontSize: 10, marginTop: 4 },
});
