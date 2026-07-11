import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';

type Props = {
  data: number[];
  width: number;
  height?: number;
  gradientId?: string;
};

export default function OfferPriceHistoryChart({
  data,
  width,
  height = 72,
  gradientId = 'offer-price-history-fill',
}: Props) {
  const chart = useMemo(() => {
    if (!data.length) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 8;

    const points = data.map((point, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - pad - ((point - min) / range) * (height - pad * 2);
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
    const isDrop = data[0] > data[data.length - 1];
    const stroke = isDrop ? '#10B981' : data[0] < data[data.length - 1] ? '#F59E0B' : '#0A84FF';

    return { linePath, areaPath, points, stroke };
  }, [data, width, height]);

  if (!chart) return null;

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={chart.stroke} stopOpacity="0.38" />
            <Stop offset="100%" stopColor={chart.stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={chart.areaPath} fill={`url(#${gradientId})`} />
        <Path
          d={chart.linePath}
          fill="none"
          stroke={chart.stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chart.points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === chart.points.length - 1 ? 4 : 2.5}
            fill={chart.stroke}
            opacity={i === chart.points.length - 1 ? 1 : 0.55}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
