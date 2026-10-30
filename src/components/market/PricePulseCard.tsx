import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import InsetMetalRecess from '../profile/InsetMetalRecess';
import PricePulseHeartbeat from './PricePulseHeartbeat';
import {
  fetchPricePulse,
  formatPpsm,
  formatSignedPct,
  type PricePulseKind,
  type PricePulsePayload,
  type PricePulseTone,
  type PricePulseTrendKey,
  type PricePulseWindow,
} from '../../services/marketService';

type WindowKey = 'd7' | 'd30' | 'd90';
type TrendKey = PricePulseTrendKey;
type MetalVariant = 'gold' | 'titanium' | 'red';

type Props = {
  isDark: boolean;
  token: string | null;
  variant?: MetalVariant;
  compact?: boolean;
  textColor?: string;
  mutedColor?: string;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const UP = '#30D158';
const DOWN = '#FF453A';
const FLAT = '#A1A1AA';
const GOLD = '#D4AF37';

const KIND_TEXT: Record<PricePulseKind, { tab: string; gen: string; nom: string; title: string }> = {
  LOCAL: { tab: 'Mieszkania', gen: 'mieszkań', nom: 'Mieszkania', title: 'mieszkania' },
  BUILDING: { tab: 'Domy', gen: 'domów', nom: 'Domy', title: 'domy' },
  PLOT: { tab: 'Działki', gen: 'działek', nom: 'Działki', title: 'działki · cena za m² gruntu' },
};

/** Krótko, po ludzku: co dokładnie pokazuje puls dla wybranej opcji. */
const KIND_INFO: Record<PricePulseKind, string> = {
  LOCAL:
    'Lokale mieszkalne sprzedane w Warszawie — rynek pierwotny i wtórny. Cena za m² powierzchni użytkowej mieszkania, bez komórek i garaży. Pomijamy sprzedaże udziałów i lokale użytkowe.',
  BUILDING:
    'Domy i inne budynki mieszkalne sprzedane w Warszawie. Cena za m² powierzchni użytkowej budynku; gdy akt nie podaje ceny samego budynku — cena całej nieruchomości z gruntem.',
  PLOT:
    'Działki gruntu sprzedane w Warszawie — głównie niezabudowane. Cena za m² powierzchni działki, więc nie porównuj jej z ceną m² mieszkania czy domu.',
};

const PERIOD_INFO: Record<TrendKey, string> = {
  day: 'Ostatni dzień z aktami względem poprzedniego dnia. Bardzo czuły — pojedyncze drogie transakcje potrafią nim mocno ruszyć.',
  week: 'Ostatni tydzień aktów względem poprzedniego tygodnia. Dobry do wyłapania świeżego ruchu, ale wciąż dość nerwowy.',
  month: 'Ostatni pełny miesiąc aktów względem poprzedniego miesiąca. Najlepsza miara bieżącego kierunku cen.',
  year: 'Ostatnie 12 miesięcy względem poprzednich 12. Pokazuje długi trend — czy rynek realnie drożeje, czy tanieje.',
};

const WINDOW_INFO: Record<WindowKey, string> = {
  d7: 'Ostatnie 7 dni: ceny w ogłoszeniach EstateOS kontra ceny z aktów w ostatnim kompletnym tygodniu.',
  d30: 'Ostatni miesiąc: ile sprzedający żądają w ogłoszeniach, a ile kupujący naprawdę płacą u notariusza.',
  d90: 'Ostatnie 3 miesiące: najspokojniejsze porównanie, najmniej zależne od pojedynczych ofert.',
};

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function monthName(key: string, short = false) {
  const m = Number(key.split('-')[1]);
  return (short ? MONTHS_SHORT : MONTHS)[m - 1] || key;
}

/** Etykieta punktu wykresu: dzień „12 sie”, tydzień „tydz. 34”, miesiąc „sie 2026”. */
function pointLabel(key: string) {
  if (/^\d{4}-W\d{2}$/.test(key)) return `tydz. ${Number(key.slice(6))} · ${key.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return `${Number(key.slice(8))} ${monthName(key, true)} ${key.slice(0, 4)}`;
  if (/^\d{4}-\d{2}$/.test(key)) return `${monthName(key)} ${key.slice(0, 4)}`;
  return key;
}

function comparedPeriods(trend: { key: PricePulseTrendKey; points: Array<{ key: string; ppsm: number | null }> } | null, short = false) {
  if (!trend) return null;
  if (trend.key === 'month') {
    const filled = trend.points.filter((p) => p.ppsm != null);
    if (filled.length < 2) return null;
    const last = filled[filled.length - 1].key;
    const prev = filled[filled.length - 2].key;
    return short ? `${monthName(last, true)} vs ${monthName(prev, true)}` : `${monthName(last)} względem: ${monthName(prev)}`;
  }
  if (trend.key === 'year') return short ? '12 mies. vs poprzednie 12' : 'ostatnie 12 miesięcy względem poprzednich 12';
  if (trend.key === 'week') return short ? 'tydzień vs poprzedni' : 'ostatni pełny tydzień aktów względem poprzedniego';
  return short ? 'dzień vs poprzedni' : 'ostatni dzień z aktami względem poprzedniego';
}

function toneOfChange(value: number | null): PricePulseTone {
  if (value == null) return 'flat';
  if (value > 0.3) return 'up';
  if (value < -0.3) return 'down';
  return 'flat';
}

function toneColor(tone: PricePulseTone) {
  return tone === 'up' ? UP : tone === 'down' ? DOWN : FLAT;
}

function directionLabel(changePct: number | null, kind: PricePulseKind) {
  const k = KIND_TEXT[kind];
  if (changePct == null) return 'Za mało kompletnych aktów w tym okresie';
  if (changePct > 0.3) return `${k.nom} sprzedają się drożej`;
  if (changePct < -0.3) return `${k.nom} sprzedają się taniej`;
  return `Ceny ${k.gen} z aktów stabilne`;
}

function periodCaption(key: TrendKey) {
  return key === 'day' ? 'Dzień' : key === 'week' ? 'Tydzień' : key === 'year' ? 'Rok' : 'Miesiąc';
}

function asOfLabel(iso?: string | null, long = false) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('pl-PL', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' });
}

function narrative(win: PricePulseWindow, kind: PricePulseKind) {
  const gap = win.vsDeedsPct;
  const gapText =
    gap == null
      ? `Za mało ofert ${KIND_TEXT[kind].gen}, żeby porównać je z aktami.`
      : Math.abs(gap) < 1.5
        ? `Ceny ofertowe ${KIND_TEXT[kind].gen} są praktycznie równe cenom z aktów.`
        : gap > 0
          ? `Oferty ${KIND_TEXT[kind].gen} są średnio o ${formatSignedPct(gap, 1).slice(1)} droższe niż ceny, po których faktycznie sprzedano.`
          : `Oferty ${KIND_TEXT[kind].gen} są średnio o ${formatSignedPct(gap, 1).slice(1)} tańsze niż ceny z aktów.`;
  const move = win.listingChangePct;
  const moveText =
    move == null ? '' : move <= -1 ? ' Ceny ofertowe schodzą.' : move >= 1 ? ' Ceny ofertowe idą w górę.' : ' Ceny ofertowe stoją w miejscu.';
  return gapText + moveText;
}

/* ───────────────────────── geometria wykresu ───────────────────────── */

type Pt = { x: number; y: number; i: number };

function buildPoints(values: Array<number | null>, width: number, height: number, padX: number, padY: number, range?: [number, number]) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2 || width <= 0) return [] as Pt[];
  const min = range ? range[0] : Math.min(...nums);
  const max = range ? range[1] : Math.max(...nums);
  const span = max - min || 1;
  const n = Math.max(values.length - 1, 1);
  const out: Pt[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    out.push({ i, x: padX + (i / n) * (width - padX * 2), y: padY + (1 - (v - min) / span) * (height - padY * 2) });
  });
  return out;
}

/** Gładka krzywa (Catmull-Rom → Bezier) — wykres wygląda jak w Akcjach na iPhonie, nie jak łamana. */
function smoothPath(pts: Pt[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function pathLength(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len * 1.08 + 4;
}

/* ───────────────────────── animowane elementy ───────────────────────── */

/** Liczba „dobiegająca” do wartości — jak licznik w Apple Fitness. */
function CountUp({ value, format, style }: { value: number | null; format: (n: number) => string; style: any }) {
  const [shown, setShown] = useState<number | null>(value);
  const from = useRef<number | null>(value);
  useEffect(() => {
    if (value == null) {
      setShown(null);
      from.current = null;
      return;
    }
    const start = from.current ?? value * 0.92;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={style}>{shown == null ? '—' : format(shown)}</Text>;
}

/** Ostatni punkt wykresu: kropka + rozchodzący się „sonar” — dane żyją. */
function PingDot({ x, y, color, r = 3.6 }: { x: number; y: number; color: string; r?: number }) {
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);
  return (
    <>
      <AnimatedCircle
        cx={x}
        cy={y}
        r={ping.interpolate({ inputRange: [0, 1], outputRange: [r, r * 4.2] })}
        fill={color}
        opacity={ping.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] })}
      />
      <Circle cx={x} cy={y} r={r + 2.2} fill={color} opacity={0.22} />
      <Circle cx={x} cy={y} r={r} fill={color} />
      <Circle cx={x} cy={y} r={r * 0.42} fill="#FFFFFF" opacity={0.9} />
    </>
  );
}

/**
 * Wykres trendu: gradientowe wypełnienie, krzywa rysująca się przy każdej zmianie danych, pulsujący ostatni punkt
 * i przeciąganie palcem (scrub) z dymkiem ceny — jak w aplikacji Akcje.
 */
function LiveChart({
  points,
  color,
  height,
  muted,
  text,
  scrub = false,
  animateKey,
}: {
  points: Array<{ key: string; ppsm: number | null }>;
  color: string;
  height: number;
  muted: string;
  text: string;
  scrub?: boolean;
  animateKey: string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const draw = useRef(new Animated.Value(0)).current;
  const values = useMemo(() => points.map((p) => p.ppsm), [points]);
  const padY = scrub ? 18 : 6;
  const pts = useMemo(() => buildPoints(values, width, height, 6, padY), [values, width, height, padY]);
  const line = useMemo(() => smoothPath(pts), [pts]);
  const len = useMemo(() => pathLength(pts), [pts]);
  const area = pts.length >= 2 ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z` : '';
  const gradId = `pp-grad-${scrub ? 'big' : 'small'}`;

  useEffect(() => {
    draw.setValue(0);
    Animated.timing(draw, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [animateKey, width, draw]);

  const nearest = useCallback(
    (x: number) => {
      if (!pts.length) return null;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
      return best.i;
    },
    [pts],
  );
  const lastIndex = useRef<number | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => scrub && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const i = nearest(e.nativeEvent.locationX);
          lastIndex.current = i;
          setActive(i);
          Haptics.selectionAsync().catch(() => undefined);
        },
        onPanResponderMove: (e) => {
          const i = nearest(e.nativeEvent.locationX);
          if (i !== lastIndex.current) {
            lastIndex.current = i;
            setActive(i);
            Haptics.selectionAsync().catch(() => undefined);
          }
        },
        onPanResponderRelease: () => setActive(null),
        onPanResponderTerminate: () => setActive(null),
      }),
    [scrub, nearest],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const last = pts[pts.length - 1];
  const activePt = active != null ? pts.find((p) => p.i === active) || null : null;
  const activeVal = active != null ? points[active] : null;

  return (
    <View style={{ height }} onLayout={onLayout} {...(scrub ? responder.panHandlers : {})}>
      {width > 0 && pts.length >= 2 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.34} />
              <Stop offset="0.7" stopColor={color} stopOpacity={0.06} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {scrub
            ? [0.25, 0.5, 0.75].map((f) => (
                <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={muted} strokeOpacity={0.14} strokeDasharray="2 5" />
              ))
            : null}
          <AnimatedPath d={area} fill={`url(#${gradId})`} opacity={draw} />
          <AnimatedPath
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={scrub ? 2.6 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })}
          />
          {activePt ? (
            <>
              <Line x1={activePt.x} x2={activePt.x} y1={0} y2={height} stroke={text} strokeOpacity={0.35} strokeWidth={1} />
              <Circle cx={activePt.x} cy={activePt.y} r={5.5} fill={color} stroke="#FFFFFF" strokeWidth={2} />
            </>
          ) : last ? (
            <PingDot x={last.x} y={last.y} color={color} r={scrub ? 4.2 : 3.4} />
          ) : null}
        </Svg>
      ) : width > 0 ? (
        <View style={[styles.emptyChart, { height }]}>
          <Text style={[styles.empty, { color: muted }]}>Za mało kompletnych aktów, żeby narysować trend.</Text>
        </View>
      ) : null}
      {activePt && activeVal ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            { left: Math.min(Math.max(activePt.x - 70, 0), Math.max(0, width - 140)), backgroundColor: 'rgba(20,18,14,0.92)' },
          ]}
        >
          <Text style={styles.tooltipValue}>{activeVal.ppsm != null ? formatPpsm(activeVal.ppsm) : '—'}</Text>
          <Text style={styles.tooltipLabel}>{pointLabel(activeVal.key)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Przełącznik segmentowy z przesuwanym „kafelkiem” jak w iOS. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  text,
  muted,
  isDark,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (v: T) => void;
  text: string;
  muted: string;
  isDark: boolean;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex(([k]) => k === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [idx, x]);
  const segW = w ? (w - 4) / options.length : 0;
  return (
    <View
      style={[styles.segment, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(63,43,5,0.07)' }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {segW ? (
        <Animated.View
          style={[
            styles.segmentThumb,
            {
              width: segW,
              backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }],
            },
          ]}
        />
      ) : null}
      {options.map(([key, label]) => (
        <Pressable
          key={key}
          style={styles.segmentItem}
          onPress={() => {
            if (key === value) return;
            Haptics.selectionAsync().catch(() => undefined);
            onChange(key);
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.15}
            style={[styles.segmentText, { color: key === value ? text : muted, fontWeight: key === value ? '700' : '600' }]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Jedno zdanie pod przełącznikiem — płynnie się podmienia przy zmianie opcji. */
function OptionCaption({ text: caption, color }: { text: string; color: string }) {
  const v = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(caption);
  useEffect(() => {
    if (caption === shown) return;
    Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setShown(caption);
      Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [caption, shown, v]);
  return (
    <Animated.Text style={[styles.optionCaption, { color, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
      {shown}
    </Animated.Text>
  );
}

/** Wejście sekcji: lekki fade + uniesienie, kolejno — modal „rozkwita”, a nie wskakuje. */
function Rise({ delay, children, style }: { delay: number; children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function DistrictBars({
  rows,
  text,
  muted,
}: {
  rows: PricePulsePayload['districts'];
  text: string;
  muted: string;
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rows, grow]);
  const maxAbs = Math.max(5, ...rows.map((r) => Math.abs(r.vsDeedsPct)));
  return (
    <View>
      {rows.map((row) => {
        const pct = row.vsDeedsPct;
        const color = pct > 1.5 ? DOWN : pct < -1.5 ? UP : FLAT;
        const frac = Math.min(1, Math.abs(pct) / maxAbs);
        return (
          <View key={row.district} style={styles.districtRow}>
            <Text style={[styles.districtName, { color: text }]} numberOfLines={1}>
              {row.district}
            </Text>
            <View style={styles.districtTrack}>
              <View style={[styles.districtAxis, { backgroundColor: muted }]} />
              <Animated.View
                style={[
                  styles.districtBar,
                  {
                    backgroundColor: color,
                    [pct >= 0 ? 'left' : 'right']: '50%',
                    width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${frac * 50}%`] }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.districtPct, { color }]}>{formatSignedPct(pct, 1)}</Text>
          </View>
        );
      })}
      <View style={styles.districtLegend}>
        <Text style={[styles.legendSmall, { color: UP }]}>◀ oferty tańsze niż akty</Text>
        <Text style={[styles.legendSmall, { color: DOWN }]}>droższe niż akty ▶</Text>
      </View>
    </View>
  );
}

/* ───────────────────────── karta ───────────────────────── */

export default function PricePulseCard({ isDark, token, variant = 'gold', compact = false, textColor, mutedColor }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PricePulsePayload | null>(null);
  const [open, setOpen] = useState(false);
  const [windowKey, setWindowKey] = useState<WindowKey>('d30');
  const [trendKey, setTrendKey] = useState<TrendKey>('month');
  const [kind, setKind] = useState<PricePulseKind>('LOCAL');
  const [loading, setLoading] = useState(true);

  const text = textColor || (isDark ? '#F4E7C5' : '#3F2B05');
  const muted = mutedColor || (isDark ? 'rgba(244,231,197,0.62)' : 'rgba(63,43,5,0.55)');

  const load = useCallback(async () => {
    setLoading(true);
    const json = await fetchPricePulse(token, kind);
    setData(json.ok ? json : null);
    setLoading(false);
  }, [token, kind]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const trend = data?.trends?.[trendKey] ?? null;
  const points = trend?.points || [];
  const win = data?.windows[windowKey] ?? null;
  const headlinePct = trend?.changePct ?? null;
  const tone = toneOfChange(headlinePct);
  const accent = toneColor(tone);
  const asOfShort = asOfLabel(data?.asOf);
  const asOfLong = asOfLabel(data?.asOf, true);
  const animateKey = `${kind}-${trendKey}-${data?.updatedAt || ''}`;

  const dualPoints = useMemo(() => {
    const series = data?.series || [];
    const take = windowKey === 'd7' ? 14 : windowKey === 'd30' ? 30 : 90;
    return series.slice(-take);
  }, [data, windowKey]);

  const openDetails = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setOpen(true);
  };

  return (
    <>
      <InsetMetalRecess isDark={isDark} variant={variant} onPress={openDetails} contentStyle={compact ? styles.compactContent : styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.eyebrowRow}>
              <PricePulseHeartbeat color={accent} size={14} />
              <Text style={[styles.eyebrow, { color: muted }]}>PULS CENOWY · WARSZAWA</Text>
            </View>
            <Text style={[styles.hint, { color: text }]} numberOfLines={1}>
              {KIND_TEXT[kind].nom} · {periodCaption(trendKey).toLowerCase()}
              {comparedPeriods(trend, true) ? ` · ${comparedPeriods(trend, true)}` : ''}
            </Text>
            {trend?.currentPpsm ? (
              <Text style={[styles.explain, { color: muted }]} numberOfLines={1}>
                mediana {formatPpsm(trend.currentPpsm)} z aktów notarialnych
              </Text>
            ) : null}
          </View>
          {loading && !data ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <View style={{ alignItems: 'flex-end' }}>
              <CountUp value={headlinePct} format={(n) => formatSignedPct(n, 1)} style={[styles.pct, { color: accent }]} />
              {asOfShort ? (
                <View style={[styles.asOfChip, { borderColor: muted }]}>
                  <Text style={[styles.asOfText, { color: muted }]}>akty do {asOfShort}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {!compact ? (
          <View style={styles.chartWrap}>
            <LiveChart points={points} color={accent} height={64} muted={muted} text={text} animateKey={animateKey} />
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <Text style={[styles.footer, { color: muted }]} numberOfLines={1}>
            {data ? directionLabel(headlinePct, kind) : 'Dotknij, aby zobaczyć trend'}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={muted} />
        </View>
      </InsetMetalRecess>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: isDark ? '#0E0D0B' : '#F7F2E6', paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.grabber} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.eyebrowRow}>
                <PricePulseHeartbeat color={accent} size={14} />
                <Text style={[styles.eyebrow, { color: muted }]}>PULS CENOWY</Text>
              </View>
              <Text style={[styles.modalTitle, { color: text }]}>Warszawa · {KIND_TEXT[kind].title}</Text>
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(63,43,5,0.08)' }]}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color={text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
            <Rise delay={0}>
              <Segmented
                options={[['LOCAL', 'Mieszkania'], ['BUILDING', 'Domy'], ['PLOT', 'Działki']] as const}
                value={kind}
                onChange={setKind}
                text={text}
                muted={muted}
                isDark={isDark}
              />
              <OptionCaption text={KIND_INFO[kind]} color={muted} />
            </Rise>

            <Rise delay={80} style={[styles.hero, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF', borderColor: isDark ? 'rgba(212,175,55,0.18)' : 'rgba(63,43,5,0.08)' }]}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroKicker, { color: muted }]}>Mediana z aktów · {periodCaption(trendKey).toLowerCase()}</Text>
                  <CountUp value={trend?.currentPpsm ?? null} format={(n) => formatPpsm(n)} style={[styles.heroPrice, { color: text }]} />
                  {trend?.previousPpsm ? (
                    <Text style={[styles.heroPrev, { color: muted }]}>wcześniej {formatPpsm(trend.previousPpsm)}</Text>
                  ) : null}
                </View>
                <View style={[styles.deltaPill, { backgroundColor: `${accent}22` }]}>
                  <Ionicons name={tone === 'up' ? 'arrow-up' : tone === 'down' ? 'arrow-down' : 'remove'} size={14} color={accent} />
                  {loading ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <CountUp value={headlinePct} format={(n) => formatSignedPct(n, 1)} style={[styles.deltaText, { color: accent }]} />
                  )}
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <LiveChart points={points} color={accent} height={168} muted={muted} text={text} scrub animateKey={animateKey} />
              </View>
              <Text style={[styles.scrubHint, { color: muted }]}>Przesuń palcem po wykresie, aby zobaczyć cenę w danym okresie</Text>

              <View style={{ marginTop: 12 }}>
                <Segmented
                  options={[['day', 'Dzień'], ['week', 'Tydzień'], ['month', 'Miesiąc'], ['year', 'Rok']] as const}
                  value={trendKey}
                  onChange={setTrendKey}
                  text={text}
                  muted={muted}
                  isDark={isDark}
                />
                <OptionCaption text={PERIOD_INFO[trendKey]} color={muted} />
              </View>
            </Rise>

            <Rise delay={160} style={[styles.explainBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(63,43,5,0.04)' }]}>
              <Text style={[styles.explainTitle, { color: text }]}>{directionLabel(headlinePct, kind)}</Text>
              <Text style={[styles.narrative, { color: muted }]}>
                {headlinePct == null
                  ? `W tym okresie było za mało kompletnych aktów ${KIND_TEXT[kind].gen}, żeby uczciwie policzyć zmianę.`
                  : `Zmiana mediany ceny za m² w aktach notarialnych z Rejestru Cen Nieruchomości — ${comparedPeriods(trend) || periodCaption(trendKey).toLowerCase()}. Mediana to cena „środkowa”: pojedyncze bardzo drogie lub tanie transakcje jej nie zawyżają.`}
                {asOfLong ? ` Akty spływają z urzędów z opóźnieniem — są kompletne do ${asOfLong}.` : ''}
              </Text>
            </Rise>

            <Rise delay={240}>
              <Text style={[styles.section, { color: muted }]}>OFERTY A FAKTYCZNE CENY</Text>
              <View style={[styles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF' }]}>
                <Segmented
                  options={[['d7', '7 dni'], ['d30', '1 miesiąc'], ['d90', '3 miesiące']] as const}
                  value={windowKey}
                  onChange={setWindowKey}
                  text={text}
                  muted={muted}
                  isDark={isDark}
                />
                <OptionCaption text={WINDOW_INFO[windowKey]} color={muted} />
                {win ? <Text style={[styles.narrative, { color: text, marginTop: 12 }]}>{narrative(win, kind)}</Text> : null}
                <DualChart series={dualPoints} height={128} muted={muted} animateKey={`${animateKey}-${windowKey}`} />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
                    <Text style={[styles.legend, { color: muted }]}>oferty</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: UP }]} />
                    <Text style={[styles.legend, { color: muted }]}>akty notarialne</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <Stat label="Ceny ofertowe" value={win?.listingPpsm ? formatPpsm(win.listingPpsm) : '—'} hint={`${formatSignedPct(win?.listingChangePct ?? null, 1)} · ${win?.listingCount ?? 0} ofert`} color={text} muted={muted} isDark={isDark} />
                  <Stat label="Ceny z aktów" value={win?.deedPpsm ? formatPpsm(win.deedPpsm) : '—'} hint={`${formatSignedPct(win?.deedChangePct ?? null, 1)} · ${win?.deedCount ?? 0} aktów`} color={text} muted={muted} isDark={isDark} />
                </View>
              </View>
            </Rise>

            {data?.districts?.length ? (
              <Rise delay={320}>
                <Text style={[styles.section, { color: muted }]}>DZIELNICE · OFERTY WZGLĘDEM AKTÓW</Text>
                <View style={[styles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF' }]}>
                  <DistrictBars rows={data.districts} text={text} muted={muted} />
                </View>
              </Rise>
            ) : null}

            <Rise delay={400}>
              <Text style={[styles.section, { color: muted }]}>SKĄD TE LICZBY</Text>
              <View style={[styles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF', gap: 12 }]}>
                <InfoRow icon="document-text-outline" title="Akty notarialne" body="Każda sprzedaż w Warszawie zgłoszona przez notariusza do Rejestru Cen Nieruchomości (GUGiK): data aktu, cena, powierzchnia, adres i dzielnica. To ceny, za które naprawdę sprzedano — nie ceny z ogłoszeń." text={text} muted={muted} />
                <InfoRow icon="pricetags-outline" title="Ogłoszenia EstateOS" body="Ceny ofertowe z ogłoszeń w EstateOS. Różnica między nimi a aktami pokazuje, ile sprzedający „dokładają” do realnej ceny rynkowej." text={text} muted={muted} />
                <InfoRow icon="stats-chart-outline" title="Mediana, nie średnia" body={`Liczymy cenę środkową — połowa transakcji była tańsza, połowa droższa. Odrzucamy udziały, lokale niemieszkalne i ceny nierealne.${trend?.count ? ` W tym okresie: ${trend.count.toLocaleString('pl-PL')} aktów.` : ''}`} text={text} muted={muted} />
                <InfoRow icon="time-outline" title="Opóźnienie rejestru" body={`Urzędy wpisują akty z opóźnieniem kilku tygodni, dlatego puls kończy się na ostatnim kompletnym miesiącu${asOfLong ? ` (${asOfLong})` : ''}, a nie na dzisiejszej dacie.`} text={text} muted={muted} />
              </View>
            </Rise>

            {data?.disclaimer ? <Text style={[styles.disclaimer, { color: muted }]}>{data.disclaimer}</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** Oferty (złoto) i akty (zieleń) na wspólnej skali — od razu widać rozjazd między ceną wywoławczą a faktyczną. */
function DualChart({
  series,
  height,
  muted,
  animateKey,
}: {
  series: PricePulsePayload['series'];
  height: number;
  muted: string;
  animateKey: string;
}) {
  const [width, setWidth] = useState(0);
  const draw = useRef(new Animated.Value(0)).current;
  const listing = series.map((p) => p.listingPpsm);
  const deed = series.map((p) => p.deedPpsm);
  const nums = [...listing, ...deed].filter((v): v is number => v != null && Number.isFinite(v));
  const range: [number, number] | undefined = nums.length ? [Math.min(...nums), Math.max(...nums)] : undefined;
  const a = buildPoints(listing, width, height, 6, 12, range);
  const b = buildPoints(deed, width, height, 6, 12, range);
  const la = smoothPath(a);
  const lb = smoothPath(b);
  const lenA = pathLength(a);
  const lenB = pathLength(b);
  useEffect(() => {
    draw.setValue(0);
    Animated.timing(draw, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [animateKey, width, draw]);
  return (
    <View style={{ height, marginTop: 10 }} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 && (la || lb) ? (
        <Svg width={width} height={height}>
          {[0.33, 0.66].map((f) => (
            <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={muted} strokeOpacity={0.14} strokeDasharray="2 5" />
          ))}
          {lb ? (
            <AnimatedPath d={lb} fill="none" stroke={UP} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={`${lenB} ${lenB}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [lenB, 0] })} />
          ) : null}
          {la ? (
            <AnimatedPath d={la} fill="none" stroke={GOLD} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={`${lenA} ${lenA}`} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [lenA, 0] })} />
          ) : null}
          {a.length ? <PingDot x={a[a.length - 1].x} y={a[a.length - 1].y} color={GOLD} r={3.2} /> : null}
          {b.length ? <Circle cx={b[b.length - 1].x} cy={b[b.length - 1].y} r={3.2} fill={UP} /> : null}
        </Svg>
      ) : width > 0 ? (
        <View style={[styles.emptyChart, { height }]}>
          <Text style={[styles.empty, { color: muted }]}>Za mało danych w tym oknie.</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({ icon, title, body, text, muted }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; text: string; muted: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: 'rgba(212,175,55,0.14)' }]}>
        <Ionicons name={icon} size={16} color={GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoTitle, { color: text }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: muted }]}>{body}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, hint, color, muted, isDark }: { label: string; value: string; hint: string; color: string; muted: string; isDark: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(63,43,5,0.045)' }]}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statHint, { color: muted }]} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: { padding: 14, gap: 8 },
  compactContent: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  hint: { fontSize: 13, fontWeight: '700', marginTop: 4, letterSpacing: -0.1 },
  explain: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  pct: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  asOfChip: { marginTop: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  asOfText: { fontSize: 9.5, fontWeight: '700' },
  chartWrap: { height: 64, marginTop: 2 },
  empty: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  emptyChart: { alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  footer: { flex: 1, fontSize: 11.5, fontWeight: '600' },
  modal: { flex: 1, paddingHorizontal: 18 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.35)', marginBottom: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroKicker: { fontSize: 12, fontWeight: '600' },
  heroPrice: { fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'], marginTop: 2 },
  heroPrev: { fontSize: 13, fontWeight: '500', marginTop: 1, fontVariant: ['tabular-nums'] },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  deltaText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scrubHint: { fontSize: 10.5, fontWeight: '500', textAlign: 'center', marginTop: 6 },
  tooltip: { position: 'absolute', top: -4, width: 140, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  tooltipValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tooltipLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  explainBox: { borderRadius: 18, padding: 14, marginTop: 14 },
  explainTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  narrative: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 20, padding: 14 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legend: { fontSize: 12, fontWeight: '600' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, height: 34 },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { fontSize: 13 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, padding: 12 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 17, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  statHint: { fontSize: 11, fontWeight: '500', marginTop: 3, fontVariant: ['tabular-nums'] },
  districtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  districtName: { width: 104, fontSize: 13.5, fontWeight: '600' },
  districtTrack: { flex: 1, height: 8, justifyContent: 'center' },
  districtAxis: { position: 'absolute', left: '50%', width: StyleSheet.hairlineWidth * 2, top: -4, bottom: -4, opacity: 0.35 },
  districtBar: { position: 'absolute', height: 8, borderRadius: 4 },
  districtPct: { width: 58, textAlign: 'right', fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  districtLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendSmall: { fontSize: 10.5, fontWeight: '600' },
  optionCaption: { fontSize: 12, lineHeight: 17, fontWeight: '500', marginTop: 8, marginHorizontal: 2 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 14, fontWeight: '700' },
  infoBody: { fontSize: 12.5, lineHeight: 18, fontWeight: '500', marginTop: 2 },
  disclaimer: { marginTop: 20, fontSize: 11, lineHeight: 16, fontWeight: '500' },
});
