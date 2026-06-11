import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  MARKET_CHART_COLORS,
  MARKET_PROPERTY_TYPES,
  buildMarketView,
  countOffersByPropertyType,
  type MarketDrillPath,
  type MarketOfferRow,
  type MarketPropertyFilter,
} from '../../utils/adminMarketAnalytics';

export type MarketThemeColors = {
  card: string;
  cardSecondary: string;
  text: string;
  secondary: string;
  tertiary: string;
  separator: string;
  accent: string;
};

type Props = {
  offers: MarketOfferRow[];
  colors: MarketThemeColors;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, outerR, endAngle);
  const end = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${start.x} ${start.y}`,
    `A ${outerR} ${outerR} 0 ${large} 0 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function MarketDonut({
  data,
  size,
  centerLabel,
  centerValue,
  emptyColor,
  textColor,
}: {
  data: Array<{ name: string; value: number; fill: string }>;
  size: number;
  centerLabel: string;
  centerValue: string;
  emptyColor: string;
  textColor: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const total = data.reduce((s, d) => s + d.value, 0);

  let angle = 0;
  const arcs =
    total > 0
      ? data.map((slice) => {
          const sweep = (slice.value / total) * 360;
          const path = donutArc(cx, cy, outerR, innerR, angle, angle + sweep);
          angle += sweep;
          return { path, fill: slice.fill, key: slice.name };
        })
      : [];

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {arcs.length ? (
            arcs.map((a) => <Path key={a.key} d={a.path} fill={a.fill} />)
          ) : (
            <Path d={donutArc(cx, cy, outerR, innerR, 0, 359.9)} fill={emptyColor} />
          )}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={[styles.donutCenterLabel, { color: emptyColor }]}>{centerLabel}</Text>
        <Text style={[styles.donutCenterValue, { color: textColor }]} numberOfLines={1}>
          {centerValue}
        </Text>
      </View>
    </View>
  );
}

export default function AdminMarketSection({ offers, colors }: Props) {
  const [propertyFilter, setPropertyFilter] = useState<MarketPropertyFilter>('FLAT');
  const [drill, setDrill] = useState<MarketDrillPath>({});

  const typeCounts = useMemo(() => countOffersByPropertyType(offers), [offers]);
  const view = useMemo(() => buildMarketView(offers, propertyFilter, drill), [offers, propertyFilter, drill]);
  const maxAvg = view.buckets[0]?.avgSqm ?? 1;

  const shareChartData = useMemo(
    () =>
      view.buckets.slice(0, 8).map((b, i) => ({
        name: b.label,
        value: b.count,
        fill: MARKET_CHART_COLORS[i % MARKET_CHART_COLORS.length],
      })),
    [view.buckets],
  );

  const priceChartData = useMemo(
    () =>
      view.buckets.slice(0, 8).map((b, i) => ({
        name: b.label,
        value: b.avgSqm,
        fill: MARKET_CHART_COLORS[i % MARKET_CHART_COLORS.length],
      })),
    [view.buckets],
  );

  const propertyLabel = MARKET_PROPERTY_TYPES.find((t) => t.id === propertyFilter)?.label ?? '—';
  const levelTitle =
    view.level === 'country'
      ? 'Kraje'
      : view.level === 'city'
        ? `Miasta · ${drill.countryName || drill.countryCode}`
        : `Dzielnice · ${drill.city}`;

  const breadcrumb = [propertyLabel, drill.countryName, drill.city].filter(Boolean).join(' · ');

  const drillInto = (bucket: { key: string; label: string }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (view.level === 'country') {
      setDrill({ countryCode: bucket.key, countryName: bucket.label });
    } else if (view.level === 'city') {
      setDrill((prev) => ({ ...prev, city: bucket.label }));
    }
  };

  const drillBack = () => {
    void Haptics.selectionAsync();
    if (drill.city) {
      setDrill({ countryCode: drill.countryCode, countryName: drill.countryName });
    } else if (drill.countryCode) {
      setDrill({});
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.card }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Analiza rynku</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {breadcrumb || propertyLabel}
          </Text>
          {(drill.countryCode || drill.city) ? (
            <Pressable onPress={drillBack} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={colors.accent} />
              <Text style={[styles.backText, { color: colors.accent }]}>Wróć poziom wyżej</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryLabel, { color: colors.secondary }]}>Średnia</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {view.summary.avgSqm > 0 ? view.summary.avgSqm.toLocaleString('pl-PL') : '—'}
          </Text>
          <Text style={[styles.summaryUnit, { color: colors.accent }]}>PLN/m²</Text>
          <Text style={[styles.summaryCount, { color: colors.tertiary }]}>{view.summary.count} ofert</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        {MARKET_PROPERTY_TYPES.map((type) => {
          const active = propertyFilter === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setPropertyFilter(type.id);
                setDrill({});
              }}
              style={[
                styles.typeChip,
                { backgroundColor: active ? colors.accent : colors.cardSecondary },
              ]}
            >
              <Text style={[styles.typeChipLabel, { color: active ? '#000' : colors.text }]}>{type.label}</Text>
              <Text style={[styles.typeChipCount, { color: active ? 'rgba(0,0,0,0.55)' : colors.tertiary }]}>
                {typeCounts[type.id]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.chartsRow}>
        <View style={[styles.chartCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.chartTitle, { color: colors.secondary }]}>Udział ofert</Text>
          <MarketDonut
            data={shareChartData}
            size={130}
            centerLabel="Ofert"
            centerValue={String(view.summary.count)}
            emptyColor={colors.tertiary}
            textColor={colors.text}
          />
        </View>
        <View style={[styles.chartCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.chartTitle, { color: colors.secondary }]}>Średnia PLN/m²</Text>
          <MarketDonut
            data={priceChartData}
            size={130}
            centerLabel="Średnia"
            centerValue={view.summary.avgSqm > 0 ? view.summary.avgSqm.toLocaleString('pl-PL') : '—'}
            emptyColor={colors.tertiary}
            textColor={colors.text}
          />
        </View>
      </View>

      <View style={styles.listHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listTitle, { color: colors.secondary }]}>{levelTitle}</Text>
          <Text style={[styles.listHint, { color: colors.tertiary }]}>
            {view.level !== 'district' ? 'Dotknij wiersz, aby zejść poziom niżej' : 'Poziom dzielnic'}
          </Text>
        </View>
      </View>

      {view.buckets.length === 0 ? (
        <Text style={[styles.empty, { color: colors.tertiary }]}>Brak danych dla wybranego filtru.</Text>
      ) : (
        <View style={styles.list}>
          {view.buckets.map((bucket, index) => {
            const pct = Math.max((bucket.avgSqm / maxAvg) * 100, 4);
            const canDrill = view.level !== 'district';
            return (
              <Pressable
                key={bucket.key}
                disabled={!canDrill}
                onPress={() => canDrill && drillInto(bucket)}
                style={({ pressed }) => [
                  styles.bucket,
                  { backgroundColor: colors.cardSecondary, opacity: pressed && canDrill ? 0.85 : 1 },
                ]}
              >
                <View style={styles.bucketTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.bucketTitleRow}>
                      <Text style={[styles.bucketIndex, { color: colors.tertiary }]}>{index + 1}.</Text>
                      <Text style={[styles.bucketName, { color: colors.text }]} numberOfLines={1}>
                        {bucket.label}
                      </Text>
                      {canDrill ? <Ionicons name="chevron-forward" size={14} color={colors.tertiary} /> : null}
                    </View>
                    <Text style={[styles.bucketMeta, { color: colors.secondary }]}>
                      {bucket.count} ofert · udział {bucket.sharePct}%
                    </Text>
                  </View>
                  <View style={styles.bucketPriceCol}>
                    <Text style={[styles.bucketPrice, { color: colors.text }]}>
                      {bucket.avgSqm.toLocaleString('pl-PL')}
                    </Text>
                    <Text style={[styles.bucketUnit, { color: colors.tertiary }]}>PLN/m²</Text>
                  </View>
                </View>
                <View style={[styles.bucketTrack, { backgroundColor: colors.separator }]}>
                  <View style={[styles.bucketFill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: 16, overflow: 'hidden', marginTop: 14 },
  header: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kicker: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 },
  backText: { fontSize: 13, fontWeight: '600' },
  summaryBox: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryUnit: { fontSize: 12, fontWeight: '700' },
  summaryCount: { fontSize: 11, marginTop: 2 },
  typeRow: { gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  typeChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  typeChipLabel: { fontSize: 12, fontWeight: '700' },
  typeChipCount: { fontSize: 10, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  chartsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 12 },
  chartCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  chartTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, alignSelf: 'flex-start' },
  donutCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  donutCenterLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  donutCenterValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], maxWidth: 72, textAlign: 'center' },
  listHeader: { paddingHorizontal: 14, paddingBottom: 8 },
  listTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  listHint: { fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  list: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  bucket: { borderRadius: 12, padding: 12 },
  bucketTop: { flexDirection: 'row', gap: 10 },
  bucketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bucketIndex: { fontSize: 10, fontVariant: ['tabular-nums'] },
  bucketName: { fontSize: 15, fontWeight: '700', flex: 1 },
  bucketMeta: { fontSize: 12, marginTop: 2 },
  bucketPriceCol: { alignItems: 'flex-end' },
  bucketPrice: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bucketUnit: { fontSize: 10 },
  bucketTrack: { height: 5, borderRadius: 99, marginTop: 10, overflow: 'hidden' },
  bucketFill: { height: '100%', borderRadius: 99 },
});
