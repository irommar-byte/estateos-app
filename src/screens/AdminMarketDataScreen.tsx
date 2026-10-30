import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  fetchMarketDataState,
  saveMarketDataSchedule,
  startMarketDataUpdate,
  type IngestSchedule,
  type IngestScheduleMode,
  type MarketDataState,
} from '../services/marketDataAdminService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MODES: Array<{ id: IngestScheduleMode; label: string }> = [
  { id: 'off', label: 'Wył.' },
  { id: 'daily', label: 'Codziennie' },
  { id: 'weekly', label: 'Tydzień' },
  { id: 'biweekly', label: '2 tyg.' },
  { id: 'monthly', label: 'Miesiąc' },
];
const WEEKDAYS = [
  { id: 1, label: 'Pn' },
  { id: 2, label: 'Wt' },
  { id: 3, label: 'Śr' },
  { id: 4, label: 'Cz' },
  { id: 5, label: 'Pt' },
  { id: 6, label: 'So' },
  { id: 0, label: 'Nd' },
];
const KIND_LABEL: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  LOCAL: { label: 'Mieszkania', icon: 'business-outline' },
  BUILDING: { label: 'Domy', icon: 'home-outline' },
  PLOT: { label: 'Działki', icon: 'leaf-outline' },
};

function usePalette() {
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  return useMemo(
    () => ({
      isDark,
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      fill: isDark ? '#2C2C2E' : '#EFEFF4',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
      tertiary: isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)',
      separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.18)',
      blue: isDark ? '#0A84FF' : '#007AFF',
      green: isDark ? '#30D158' : '#34C759',
      orange: isDark ? '#FF9F0A' : '#FF9500',
      red: isDark ? '#FF453A' : '#FF3B30',
      indigo: isDark ? '#5E5CE6' : '#5856D6',
    }),
    [isDark],
  );
}
type Palette = ReturnType<typeof usePalette>;

const nf = (n: number) => Math.round(n).toLocaleString('pl-PL');

function formatDay(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(today)) / 86_400_000);
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const day =
    diff === 0
      ? 'Dziś'
      : diff === -1
        ? 'Wczoraj'
        : diff === 1
          ? 'Jutro'
          : d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
  return withTime ? `${day}, ${time}` : day;
}

function countdown(iso: string | null, now: number): string {
  if (!iso) return 'Automat wyłączony';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'Za chwilę';
  const min = Math.floor(ms / 60_000);
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return `za ${days} ${days === 1 ? 'dzień' : 'dni'} ${hours} h`;
  if (hours > 0) return `za ${hours} h ${mins} min`;
  return `za ${mins} min`;
}

function formatDuration(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${sec % 60} s`;
}

/** Liczba, która płynnie dolicza do nowej wartości (jak w aplikacji Zdrowie). */
function CountUp({ value, style }: { value: number; style: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    Animated.timing(anim, { toValue: value, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, value]);
  return <Text style={style}>{nf(shown)}</Text>;
}

/** Pierścień postępu — gradient, płynne dojście, pulsujący blask podczas pracy. */
function ProgressRing({ percent, running, palette, size = 132 }: { percent: number; running: boolean; palette: Palette; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(100, percent)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, percent]);
  useEffect(() => {
    if (!running) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, running]);
  const offset = anim.interpolate({ inputRange: [0, 100], outputRange: [circ, 0] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: size / 2, backgroundColor: running ? palette.blue : palette.green, opacity: running ? glow : 0.12, transform: [{ scale: 0.86 }] },
        ]}
      />
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={running ? '#64D2FF' : '#7CF29B'} />
            <Stop offset="1" stopColor={running ? palette.blue : palette.green} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.fill} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {running ? (
            <Text style={{ fontSize: 30, fontWeight: '700', color: palette.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
              {Math.round(percent)}
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.secondary }}>%</Text>
            </Text>
          ) : (
            <Ionicons name="checkmark" size={46} color={palette.green} />
          )}
        </View>
      </View>
    </View>
  );
}

/** Pasek postępu z przesuwającym się połyskiem. */
function ProgressBar({ percent, palette }: { percent: number; palette: Palette }) {
  const width = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    Animated.timing(width, { toValue: percent, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [percent, width]);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [shine]);
  return (
    <View style={[styles.barTrack, { backgroundColor: palette.fill }]} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.barFill,
          { backgroundColor: palette.blue, width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      >
        <Animated.View
          style={[
            styles.barShine,
            { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-80, Math.max(80, trackW)] }) }] },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/** Wykres przyrostu: słupki rosną sprężyście jeden po drugim. */
function GrowthChart({ history, palette }: { history: MarketDataState['history']; palette: Palette }) {
  const items = history.slice(-10);
  const max = Math.max(1, ...items.map((h) => h.added));
  const anims = useRef(items.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    while (anims.length < items.length) anims.push(new Animated.Value(0));
    Animated.stagger(
      70,
      items.map((_, i) => Animated.spring(anims[i], { toValue: 1, friction: 7, tension: 60, useNativeDriver: false })),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, max]);
  if (!items.length) {
    return <Text style={[styles.empty, { color: palette.secondary }]}>Wykres pojawi się po pierwszej aktualizacji.</Text>;
  }
  return (
    <View style={styles.chart}>
      {items.map((h, i) => {
        const pct = h.added / max;
        const failed = h.status === 'FAILED';
        return (
          <View key={h.runId} style={styles.chartCol}>
            <Text style={[styles.chartValue, { color: palette.secondary }]} numberOfLines={1}>
              {h.added > 999 ? `${(h.added / 1000).toFixed(1).replace('.', ',')}k` : h.added}
            </Text>
            <View style={styles.chartBarWrap}>
              <Animated.View
                style={[
                  styles.chartBar,
                  {
                    backgroundColor: failed ? palette.red : i === items.length - 1 ? palette.green : palette.blue,
                    opacity: i === items.length - 1 ? 1 : 0.55,
                    height: (anims[i] || new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: ['2%', `${Math.max(4, pct * 100)}%`] }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.chartLabel, { color: palette.tertiary }]} numberOfLines={1}>
              {new Date(h.finishedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Przełącznik segmentowy jak w iOS — przesuwający się „kafelek”. */
function Segmented({ value, onChange, palette }: { value: IngestScheduleMode; onChange: (v: IngestScheduleMode) => void; palette: Palette }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, MODES.findIndex((m) => m.id === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: idx, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [idx, x]);
  const segW = w ? (w - 4) / MODES.length : 0;
  return (
    <View style={[styles.segment, { backgroundColor: palette.fill }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW ? (
        <Animated.View
          style={[
            styles.segmentThumb,
            { width: segW, backgroundColor: palette.isDark ? '#636366' : '#FFFFFF', transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }] },
          ]}
        />
      ) : null}
      {MODES.map((m) => (
        <Pressable
          key={m.id}
          style={styles.segmentItem}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            onChange(m.id);
          }}
        >
          <Text style={[styles.segmentText, { color: palette.text, fontWeight: m.id === value ? '600' : '500' }]}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Card({ children, palette, style }: { children: React.ReactNode; palette: Palette; style?: any }) {
  return <View style={[styles.card, { backgroundColor: palette.card }, style]}>{children}</View>;
}

function SectionTitle({ children, palette }: { children: React.ReactNode; palette: Palette }) {
  return <Text style={[styles.sectionTitle, { color: palette.secondary }]}>{children}</Text>;
}

export default function AdminMarketDataScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const getAdminToken = useAuthStore((s) => s.getAdminToken);
  const [state, setState] = useState<MarketDataState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const next = await fetchMarketDataState(token);
      setState(next);
      setError(null);
      const running = Boolean(next.running || (next.progress && !next.progress.done));
      if (wasRunning.current && !running) {
        Haptics.notificationAsync(
          next.lastRun?.status === 'FAILED' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      }
      wasRunning.current = running;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać.');
    }
  }, [getAdminToken]);

  const running = Boolean(state?.running || (state?.progress && !state.progress.done));

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => void load(), running || starting ? 2000 : 30_000);
    return () => clearInterval(id);
  }, [load, running, starting]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const runNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Alert.alert(
      'Aktualizować bazę teraz?',
      'Pobierzemy najnowsze akty notarialne z Rejestru Cen Nieruchomości (GUGiK). Trwa to zwykle 20–40 minut i działa w tle — możesz zamknąć aplikację.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Aktualizuj',
          onPress: async () => {
            const token = getAdminToken();
            if (!token) return;
            setStarting(true);
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setState(await startMarketDataUpdate(token));
              wasRunning.current = true;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            } catch (e) {
              Alert.alert('Aktualizacja', e instanceof Error ? e.message : 'Nie udało się uruchomić.');
            } finally {
              setStarting(false);
            }
          },
        },
      ],
    );
  };

  const updateSchedule = (patch: Partial<IngestSchedule>) => {
    if (!state) return;
    const schedule = { ...state.schedule, ...patch, minute: 20 };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setState({ ...state, schedule });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const token = getAdminToken();
      if (!token) return;
      try {
        const next = await saveMarketDataSchedule(token, schedule);
        setState(next);
        setSavedFlash(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setTimeout(() => setSavedFlash(false), 1600);
      } catch (e) {
        Alert.alert('Harmonogram', e instanceof Error ? e.message : 'Nie udało się zapisać.');
      }
    }, 600);
  };

  const percent = state?.progress?.percent ?? 0;
  const lastAdded = state?.lastRun?.added ?? null;
  const schedule = state?.schedule;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={palette.blue} />
          <Text style={{ color: palette.blue, fontSize: 17 }}>Profil</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.largeTitle, { color: palette.text }]}>Baza cen</Text>
        <Text style={[styles.largeSub, { color: palette.secondary }]}>Rejestr Cen Nieruchomości · GUGiK</Text>

        {!state ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            {error ? <Text style={{ color: palette.red }}>{error}</Text> : <ActivityIndicator />}
          </View>
        ) : (
          <>
            <Card palette={palette} style={styles.hero}>
              <ProgressRing percent={running ? percent : 100} running={running} palette={palette} />
              <View style={{ flex: 1, marginLeft: 18 }}>
                <Text style={[styles.heroLabel, { color: palette.secondary }]}>{running ? 'Aktualizacja w toku' : 'Akty w bazie'}</Text>
                <CountUp value={state.totals.records} style={[styles.heroNumber, { color: palette.text }]} />
                <Text style={[styles.heroMeta, { color: palette.secondary }]}>
                  {state.totals.dataAsOf
                    ? `Dane do ${new Date(state.totals.dataAsOf).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Brak danych'}
                </Text>
              </View>
            </Card>

            {running ? (
              <Card palette={palette}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.phase, { color: palette.text }]} numberOfLines={1}>
                    {state.progress?.phase || 'Uruchamiam…'}
                  </Text>
                  <Text style={[styles.percent, { color: palette.blue }]}>{Math.round(percent)}%</Text>
                </View>
                <ProgressBar percent={percent} palette={palette} />
                <Text style={[styles.detail, { color: palette.secondary }]}>
                  {state.progress?.detail || 'Łączę z Geoportalem…'}
                  {state.progress?.startedAt ? ` · start ${formatDay(state.progress.startedAt)}` : ''}
                </Text>
              </Card>
            ) : null}

            <SectionTitle palette={palette}>Aktualizacje</SectionTitle>
            <Card palette={palette} style={{ paddingVertical: 4 }}>
              <View style={styles.listRow}>
                <View style={[styles.iconTile, { backgroundColor: state.lastRun?.status === 'FAILED' ? palette.red : palette.green }]}>
                  <Ionicons name={state.lastRun?.status === 'FAILED' ? 'alert' : 'checkmark'} size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>Ostatnia</Text>
                  <Text style={[styles.rowSub, { color: palette.secondary }]}>
                    {state.lastRun
                      ? `${formatDay(state.lastRun.finishedAt || state.lastRun.startedAt)} · ${formatDuration(
                          state.lastRun.finishedAt
                            ? Math.round((new Date(state.lastRun.finishedAt).getTime() - new Date(state.lastRun.startedAt).getTime()) / 1000)
                            : 0,
                        )}`
                      : 'Jeszcze nie było'}
                  </Text>
                </View>
                {lastAdded != null ? (
                  <View style={[styles.pill, { backgroundColor: palette.isDark ? 'rgba(48,209,88,0.16)' : 'rgba(52,199,89,0.14)' }]}>
                    <Text style={[styles.pillText, { color: palette.green }]}>+{nf(lastAdded)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.sep, { backgroundColor: palette.separator }]} />
              <View style={styles.listRow}>
                <View style={[styles.iconTile, { backgroundColor: schedule?.mode === 'off' ? palette.tertiary : palette.blue }]}>
                  <Ionicons name="calendar" size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>Następna</Text>
                  <Text style={[styles.rowSub, { color: palette.secondary }]}>
                    {state.nextRunAt ? formatDay(state.nextRunAt) : 'Automatyczna aktualizacja wyłączona'}
                  </Text>
                </View>
                <Text style={[styles.countdown, { color: palette.blue }]}>{state.nextRunAt ? countdown(state.nextRunAt, now) : ''}</Text>
              </View>
              {state.lastRun?.status === 'FAILED' && state.lastRun.error ? (
                <Text style={[styles.errorText, { color: palette.red }]} numberOfLines={3}>
                  {state.lastRun.error}
                </Text>
              ) : null}
            </Card>

            <SectionTitle palette={palette}>Przyrost danych po aktualizacji</SectionTitle>
            <Card palette={palette}>
              <GrowthChart history={state.history} palette={palette} />
              <View style={styles.kinds}>
                {Object.entries(state.totals.byKind).map(([kind, count]) => (
                  <View key={kind} style={[styles.kind, { backgroundColor: palette.fill }]}>
                    <Ionicons name={KIND_LABEL[kind]?.icon || 'grid-outline'} size={15} color={palette.secondary} />
                    <Text style={[styles.kindLabel, { color: palette.secondary }]}>{KIND_LABEL[kind]?.label || kind}</Text>
                    <Text style={[styles.kindValue, { color: palette.text }]}>{nf(count)}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <View style={styles.sectionHead}>
              <SectionTitle palette={palette}>Automatyczna aktualizacja</SectionTitle>
              {savedFlash ? (
                <View style={styles.saved}>
                  <Ionicons name="checkmark-circle" size={14} color={palette.green} />
                  <Text style={{ color: palette.green, fontSize: 13, fontWeight: '600' }}>Zapisano</Text>
                </View>
              ) : null}
            </View>
            <Card palette={palette}>
              <Segmented value={schedule?.mode || 'weekly'} onChange={(mode) => updateSchedule({ mode })} palette={palette} />
              {schedule && (schedule.mode === 'weekly' || schedule.mode === 'biweekly') ? (
                <>
                  <Text style={[styles.fieldLabel, { color: palette.secondary }]}>Dzień</Text>
                  <View style={styles.weekRow}>
                    {WEEKDAYS.map((d) => {
                      const active = schedule.weekday === d.id;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => undefined);
                            updateSchedule({ weekday: d.id });
                          }}
                          style={({ pressed }) => [
                            styles.dayDot,
                            { backgroundColor: active ? palette.blue : palette.fill, transform: [{ scale: pressed ? 0.92 : 1 }] },
                          ]}
                        >
                          <Text style={{ color: active ? '#fff' : palette.text, fontWeight: '600', fontSize: 14 }}>{d.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {schedule && schedule.mode !== 'off' ? (
                <>
                  <Text style={[styles.fieldLabel, { color: palette.secondary }]}>Godzina</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                    {Array.from({ length: 24 }, (_, h) => {
                      const active = schedule.hour === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => undefined);
                            updateSchedule({ hour: h });
                          }}
                          style={({ pressed }) => [
                            styles.hourChip,
                            { backgroundColor: active ? palette.blue : palette.fill, transform: [{ scale: pressed ? 0.92 : 1 }] },
                          ]}
                        >
                          <Text style={{ color: active ? '#fff' : palette.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                            {String(h).padStart(2, '0')}:20
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Text style={[styles.footnote, { color: palette.secondary }]}>
                    {schedule.mode === 'monthly'
                      ? 'Pierwszego dnia każdego miesiąca. '
                      : schedule.mode === 'biweekly'
                        ? 'Co drugi tydzień we wskazany dzień. '
                        : ''}
                    Najlepiej w nocy — import pobiera dziesiątki tysięcy aktów i nie obciąża wtedy serwera.
                  </Text>
                </>
              ) : (
                <Text style={[styles.footnote, { color: palette.secondary }]}>Baza aktualizuje się tylko po ręcznym uruchomieniu.</Text>
              )}
            </Card>

            <Pressable
              onPress={runNow}
              disabled={running || starting}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: running ? palette.fill : palette.blue, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={running ? 'hourglass-outline' : 'arrow-down-circle'} size={20} color={running ? palette.secondary : '#fff'} />
                  <Text style={[styles.ctaText, { color: running ? palette.secondary : '#fff' }]}>
                    {running ? 'Aktualizacja trwa…' : 'Aktualizuj teraz'}
                  </Text>
                </>
              )}
            </Pressable>
            <Text style={[styles.footnote, { color: palette.secondary, textAlign: 'center', marginTop: 10 }]}>
              Źródło: Geoportal (GUGiK) · Warszawa · ostatnie 36 miesięcy
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8, paddingBottom: 4 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37, marginTop: 4 },
  largeSub: { fontSize: 15, marginTop: 2, marginBottom: 18 },
  card: { borderRadius: 14, padding: 16, marginBottom: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  heroLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroNumber: { fontSize: 36, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'], marginTop: 2 },
  heroMeta: { fontSize: 14, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  phase: { flex: 1, fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  percent: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], marginLeft: 10 },
  detail: { fontSize: 13, marginTop: 9 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  barShine: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.45)' },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3, marginLeft: 16, marginBottom: 7, marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  iconTile: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17 },
  rowSub: { fontSize: 14, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 42 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countdown: { fontSize: 14, fontWeight: '600' },
  errorText: { fontSize: 13, paddingBottom: 10, paddingLeft: 42 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%' },
  chartValue: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
  chartBarWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 5 },
  chartLabel: { fontSize: 10, marginTop: 5 },
  empty: { fontSize: 15, paddingVertical: 24, textAlign: 'center' },
  kinds: { flexDirection: 'row', gap: 8, marginTop: 14 },
  kind: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
  kindLabel: { fontSize: 12 },
  kindValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, height: 34 },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13 },
  fieldLabel: { fontSize: 13, marginTop: 16, marginBottom: 8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hourChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  footnote: { fontSize: 13, lineHeight: 18, marginTop: 12 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14, marginTop: 10 },
  ctaText: { fontSize: 17, fontWeight: '600' },
});
