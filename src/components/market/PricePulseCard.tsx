import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import InsetMetalRecess from '../profile/InsetMetalRecess';
import {
  fetchPricePulse,
  formatPpsm,
  formatSignedPct,
  type PricePulseDirection,
  type PricePulsePayload,
  type PricePulseTone,
  type PricePulseWindow,
} from '../../services/marketService';

type WindowKey = 'd7' | 'd30' | 'd90';
type MetalVariant = 'gold' | 'titanium';

type Props = {
  isDark: boolean;
  token: string | null;
  variant?: MetalVariant;
  compact?: boolean;
  textColor?: string;
  mutedColor?: string;
};

function sparklinePath(values: Array<number | null>, width: number, height: number, pad = 4) {
  const pts = values
    .map((value, index) => ({ index, value }))
    .filter((row): row is { index: number; value: number } => row.value != null && Number.isFinite(row.value));
  if (pts.length < 2) return { line: '', area: '', last: null as { x: number; y: number } | null };
  const ys = pts.map((p) => p.value);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 0);
  const span = max - min || 1;
  const n = Math.max(values.length - 1, 1);
  const drawn: Array<{ x: number; y: number }> = [];
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) return;
    drawn.push({
      x: pad + (index / n) * (width - pad * 2),
      y: pad + (1 - (value - min) / span) * (height - pad * 2),
    });
  });
  const line = drawn.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${drawn[drawn.length - 1].x.toFixed(1)},${height - pad} L${drawn[0].x.toFixed(1)},${height - pad} Z`;
  return { line, area, last: drawn[drawn.length - 1] };
}

function dualPaths(a: Array<number | null>, b: Array<number | null>, width: number, height: number, pad = 8) {
  const nums = [...a, ...b].filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return { a: '', b: '' };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const n = Math.max(Math.max(a.length, b.length) - 1, 1);
  const pathOf = (values: Array<number | null>) => {
    const drawn: Array<{ x: number; y: number }> = [];
    values.forEach((value, index) => {
      if (value == null || !Number.isFinite(value)) return;
      drawn.push({
        x: pad + (index / n) * (width - pad * 2),
        y: pad + (1 - (value - min) / span) * (height - pad * 2),
      });
    });
    if (drawn.length < 2) return '';
    return drawn.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  };
  return { a: pathOf(a), b: pathOf(b) };
}

function toneColor(tone: PricePulseTone) {
  if (tone === 'up') return '#34C759';
  if (tone === 'down') return '#F43F5E';
  return '#8E8E93';
}

function directionLabel(direction: PricePulseDirection) {
  if (direction === 'falling') return 'Oferty schodzą';
  if (direction === 'rising') return 'Oferty rosną';
  return 'Oferty stabilne';
}

function narrative(data: PricePulsePayload, win: PricePulseWindow) {
  const gap = formatSignedPct(win.vsDeedsPct ?? data.vsDeedsPct);
  const move = formatSignedPct(win.listingChangePct);
  const dir = win.listingChangePct ?? 0;
  const trend =
    dir <= -1 ? 'Ceny ofertowe schodzą.' : dir >= 1 ? 'Ceny ofertowe idą w górę.' : 'Ceny ofertowe stoją w miejscu.';
  return `Oferty, które wchodzą na rynek w Warszawie, są ${gap} względem cen z aktów. ${trend} Zmiana w tym oknie: ${move}.`;
}

function toneOfChange(value: number | null): PricePulseTone {
  if (value == null) return 'flat';
  if (value > 0.3) return 'up';
  if (value < -0.3) return 'down';
  return 'flat';
}

export default function PricePulseCard({
  isDark,
  token,
  variant = 'gold',
  compact = false,
  textColor,
  mutedColor,
}: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PricePulsePayload | null>(null);
  const [open, setOpen] = useState(false);
  const [windowKey, setWindowKey] = useState<WindowKey>('d30');
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  const text = textColor || (isDark ? '#F4E7C5' : '#3F2B05');
  const muted = mutedColor || (isDark ? 'rgba(244,231,197,0.62)' : 'rgba(63,43,5,0.55)');

  const load = useCallback(async () => {
    const json = await fetchPricePulse(token);
    if (json.ok) setData(json);
    setLoading(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const spark = useMemo(() => sparklinePath(data?.sparkline || [], 280, 64), [data]);
  const win = data?.windows[windowKey] ?? null;
  const headlinePct = win?.listingChangePct ?? data?.windows.d30.listingChangePct ?? null;
  const tone = toneOfChange(headlinePct);
  const pctColor = toneColor(tone);
  const stroke = tone === 'down' ? '#F43F5E' : '#34C759';
  const dual = useMemo(() => {
    const series = data?.series || [];
    const take = windowKey === 'd7' ? 14 : windowKey === 'd30' ? 30 : 90;
    const slice = series.slice(-take);
    return dualPaths(
      slice.map((p) => p.listingPpsm),
      slice.map((p) => p.deedPpsm),
      320,
      120,
    );
  }, [data, windowKey]);

  const openDetails = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  return (
    <>
      <InsetMetalRecess
        isDark={isDark}
        variant={variant}
        onPress={openDetails}
        contentStyle={compact ? styles.compactContent : styles.cardContent}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: muted }]}>PULS CENOWY</Text>
            <Text style={[styles.hint, { color: muted }]} numberOfLines={1}>
              {windowKey === 'd7' ? '7 dni' : windowKey === 'd90' ? '3 miesiące' : '30 dni'} · oferty
            </Text>
          </View>
          {loading && !data ? (
            <ActivityIndicator size="small" color={pctColor} />
          ) : (
            <Animated.Text
              style={[styles.pct, { color: pctColor, transform: [{ scale: pulse }] }]}
            >
              {formatSignedPct(headlinePct)}
            </Animated.Text>
          )}
        </View>

        {!compact ? (
          <View style={styles.chartWrap}>
            {spark.line ? (
              <Svg width="100%" height={64} viewBox="0 0 280 64" preserveAspectRatio="none">
                <Path d={spark.area} fill={tone === 'down' ? 'rgba(244,63,94,0.18)' : 'rgba(52,199,89,0.18)'} />
                <Path d={spark.line} fill="none" stroke={stroke} strokeWidth={1.8} />
                {spark.last ? <Circle cx={spark.last.x} cy={spark.last.y} r={3.2} fill={stroke} /> : null}
              </Svg>
            ) : (
              <Text style={[styles.empty, { color: muted }]}>Za mało danych, żeby narysować grafik.</Text>
            )}
          </View>
        ) : null}

        <Text style={[styles.footer, { color: muted }]} numberOfLines={1}>
          {data ? `${directionLabel(data.direction)} · 30 dni ${formatSignedPct(data.windows.d30.listingChangePct)}` : 'Dotknij, aby zobaczyć trend'}
        </Text>
      </InsetMetalRecess>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: isDark ? '#12110E' : '#F6F1E4', paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: muted }]}>PULS CENOWY</Text>
              <Text style={[styles.modalTitle, { color: text }]}>Warszawa · mieszkania</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color={text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Text style={[styles.hint, { color: muted }]}>
                Zmiana cen ofertowych · {windowKey === 'd7' ? '7 dni' : windowKey === 'd90' ? '3 miesiące' : '30 dni'}
              </Text>
              <Animated.Text style={[styles.heroPct, { color: pctColor, transform: [{ scale: pulse }] }]}>
                {formatSignedPct(headlinePct)}
              </Animated.Text>
              <Text style={[styles.narrative, { color: muted }]}>
                {data && win ? narrative(data, win) : 'Brak pulsu.'}
              </Text>
              <Svg width="100%" height={132} viewBox="0 0 320 120" preserveAspectRatio="none">
                {dual.b ? <Path d={dual.b} fill="none" stroke="#C9A227" strokeWidth={2.2} /> : null}
                {dual.a ? <Path d={dual.a} fill="none" stroke={stroke} strokeWidth={2.4} /> : null}
              </Svg>
              <View style={styles.legendRow}>
                <Text style={[styles.legend, { color: stroke }]}>● oferty</Text>
                <Text style={[styles.legend, { color: '#C9A227' }]}>● akty</Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              {([
                ['d7', '7 dni'],
                ['d30', '1 miesiąc'],
                ['d90', '3 miesiące'],
              ] as const).map(([key, label]) => {
                const active = windowKey === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setWindowKey(key)}
                    style={[styles.chip, active && { borderColor: '#34C759', backgroundColor: 'rgba(52,199,89,0.14)' }]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#34C759' : muted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.statsGrid}>
              <Stat label="Ceny ofertowe" value={win?.listingPpsm ? formatPpsm(win.listingPpsm) : '—'} hint={formatSignedPct(win?.listingChangePct ?? null)} color={toneColor(toneOfChange(win?.listingChangePct ?? null))} muted={muted} />
              <Stat label="Ceny z aktów" value={win?.deedPpsm ? formatPpsm(win.deedPpsm) : '—'} hint={formatSignedPct(win?.deedChangePct ?? null)} color={toneColor(toneOfChange(win?.deedChangePct ?? null))} muted={muted} />
              <Stat label="Zmiana ofert" value={formatSignedPct(win?.listingChangePct ?? null)} hint={`${win?.listingCount ?? 0} ofert`} color={toneColor(toneOfChange(win?.listingChangePct ?? null))} muted={muted} />
              <Stat label="Zmiana aktów" value={formatSignedPct(win?.deedChangePct ?? null)} hint={`${win?.deedCount ?? 0} aktów`} color={toneColor(toneOfChange(win?.deedChangePct ?? null))} muted={muted} />
            </View>

            {data?.districts?.length ? (
              <View style={{ marginTop: 18 }}>
                <Text style={[styles.eyebrow, { color: muted, marginBottom: 8 }]}>DZIELNICE</Text>
                {data.districts.map((row) => (
                  <View key={row.district} style={styles.districtRow}>
                    <Text style={[styles.districtName, { color: text }]}>{row.district}</Text>
                    <Text
                      style={[
                        styles.districtPct,
                        { color: row.vsDeedsPct > 1.5 ? '#F43F5E' : row.vsDeedsPct < -1.5 ? '#34C759' : muted },
                      ]}
                    >
                      {formatSignedPct(row.vsDeedsPct)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {data?.disclaimer ? (
              <Text style={[styles.disclaimer, { color: muted }]}>{data.disclaimer}</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
  muted,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statHint, { color: muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: { padding: 14, gap: 8 },
  compactContent: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  hint: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  pct: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -0.6 },
  chartWrap: { height: 64, marginTop: 2 },
  empty: { fontSize: 11, fontWeight: '600' },
  footer: { fontSize: 10.5, fontWeight: '700' },
  modal: { flex: 1, paddingHorizontal: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, padding: 14, backgroundColor: 'rgba(0,0,0,0.16)' },
  heroPct: { fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1, marginVertical: 4 },
  narrative: { fontSize: 13, lineHeight: 19, fontWeight: '600', marginBottom: 10 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  legend: { fontSize: 11, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { width: '47%', borderRadius: 16, padding: 12, backgroundColor: 'rgba(0,0,0,0.12)' },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  statHint: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  districtRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  districtName: { fontSize: 14, fontWeight: '700' },
  districtPct: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  disclaimer: { marginTop: 18, fontSize: 11, lineHeight: 16, fontWeight: '500' },
});
