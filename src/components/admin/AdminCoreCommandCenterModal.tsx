import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/useAuthStore';
import type { AdminCoreMetrics } from '../../contracts/adminCoreContract';
import {
  AdminCoreMetricsError,
  ADMIN_CORE_SERVER_CONTROL_ENABLED,
  controlAdminCoreServer,
  fetchAdminCoreLogs,
  fetchAdminCoreMetrics,
  formatBytesShort,
  formatUptime,
} from '../../services/adminCoreMetricsService';

const CORE_ACCENT = '#10b981';
const CORE_GOLD = '#CBA135';
const PM2_PROCESS_NAME = 'nieruchomosci';
const HISTORY_LEN = 36;
const POLL_MS = 3000;
const LOG_POLL_MS = 2500;

type CoreTraffic = 'offline' | 'loading' | 'online';

const TRAFFIC_COLORS: Record<CoreTraffic, string> = {
  offline: '#FF453A',
  loading: '#FFCC00',
  online: '#34C759',
};

function CoreTrafficLight({
  label,
  tone,
  active,
  blink,
  onPress,
  disabled,
  isDark,
}: {
  label: string;
  tone: CoreTraffic;
  active: boolean;
  blink?: Animated.Value;
  onPress?: () => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  const color = TRAFFIC_COLORS[tone];
  const labelColor = active ? '#0A0A0A' : isDark ? '#636366' : '#AEAEB2';

  const pill = (
    <Animated.View
      style={[
        styles.trafficPill,
        active
          ? {
              backgroundColor: color,
              borderColor: color,
              shadowColor: color,
            }
          : {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            },
        active && blink ? { opacity: blink } : { opacity: active ? 1 : 0.55 },
        active
          ? { shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 }
          : { elevation: 0 },
      ]}
    >
      <Text style={[styles.trafficPillLabel, { color: labelColor, fontWeight: active ? '900' : '600' }]}>{label}</Text>
    </Animated.View>
  );

  if (!onPress) {
    return <View style={styles.trafficSlot}>{pill}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.trafficSlot, { opacity: disabled ? 0.45 : pressed ? 0.92 : 1 }]}
    >
      {pill}
    </Pressable>
  );
}

type ThemeLike = { background?: string; text?: string; subtitle?: string; glass?: string };

function toneForPercent(p: number): string {
  if (p >= 90) return '#FF3B30';
  if (p >= 75) return '#FF9F0A';
  return CORE_ACCENT;
}

function pushHistory(prev: number[], value: number): number[] {
  const next = [...prev, value];
  if (next.length > HISTORY_LEN) return next.slice(next.length - HISTORY_LEN);
  return next;
}

function sparkPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 0.001);
  const step = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function MetricCard({
  title,
  subtitle,
  percent,
  usedLabel,
  totalLabel,
  accent,
  history,
  chartWidth,
  isDark,
  children,
}: {
  title: string;
  subtitle: string;
  percent: number;
  usedLabel: string;
  totalLabel: string;
  accent: string;
  history: number[];
  chartWidth: number;
  isDark: boolean;
  children?: React.ReactNode;
}) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const p = Math.max(0, Math.min(100, percent));
  const tone = toneForPercent(p);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: p / 100,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [p, fillAnim]);

  const barWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: isDark ? '#141416' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View style={styles.metricCardHead}>
        <View>
          <Text style={[styles.metricTitle, { color: isDark ? '#F5F5F7' : '#1C1C1E' }]}>{title}</Text>
          <Text style={[styles.metricSubtitle, { color: isDark ? '#8E8E93' : '#6B7280' }]}>{subtitle}</Text>
        </View>
        <Text style={[styles.metricPercent, { color: tone }]}>{p.toFixed(1)}%</Text>
      </View>

      <View style={[styles.sparkWrap, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)' }]}>
        <Svg width={chartWidth} height={44}>
          <Defs>
            <SvgGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={accent} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </SvgGradient>
          </Defs>
          <Path
            d={`${sparkPath(history, chartWidth, 44)} L ${chartWidth} 44 L 0 44 Z`}
            fill={`url(#grad-${title})`}
          />
          <Path d={sparkPath(history, chartWidth, 44)} stroke={accent} strokeWidth={2} fill="none" />
        </Svg>
      </View>

      <View style={[styles.track, { backgroundColor: isDark ? '#2C2C2E' : '#ECECEC' }]}>
        <Animated.View style={[styles.trackFill, { width: barWidth, backgroundColor: tone }]} />
      </View>
      <View style={styles.metricFoot}>
        <Text style={[styles.metricFootText, { color: isDark ? '#AEAEB2' : '#6B7280' }]}>{usedLabel}</Text>
        <Text style={[styles.metricFootText, { color: isDark ? '#AEAEB2' : '#6B7280' }]}>{totalLabel}</Text>
      </View>
      {children}
    </View>
  );
}

function MiniStat({
  label,
  value,
  color,
  isDark,
}: {
  label: string;
  value: string;
  color: string;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.miniStat,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      <Text style={[styles.miniStatLabel, { color: isDark ? '#8E8E93' : '#6B7280' }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: ThemeLike;
};

export default function AdminCoreCommandCenterModal({ visible, onClose, theme }: Props) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDark = theme?.glass === 'dark';
  const chartWidth = width - 32 - 28;

  const [metrics, setMetrics] = useState<AdminCoreMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [diskHist, setDiskHist] = useState<number[]>([]);
  const [rssHist, setRssHist] = useState<number[]>([]);
  const [serverCommand, setServerCommand] = useState<'idle' | 'starting' | 'stopping'>('idle');
  const [manualOffline, setManualOffline] = useState(false);
  const [pm2Logs, setPm2Logs] = useState('');
  const [logsUpdatedAt, setLogsUpdatedAt] = useState<string | null>(null);
  const loadingBlink = useRef(new Animated.Value(1)).current;
  const logsScrollRef = useRef<ScrollView>(null);

  const applyMetrics = useCallback((m: AdminCoreMetrics) => {
    setMetrics(m);
    setCpuHist((h) => pushHistory(h, m.cpu.percent));
    setMemHist((h) => pushHistory(h, m.memory.percent));
    setDiskHist((h) => pushHistory(h, m.disk.percent));
    const rssMb = (m.process?.rssBytes ?? 0) / (1024 * 1024);
    setRssHist((h) => pushHistory(h, rssMb));
    setLastRefresh(new Date());
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setError('Brak tokenu — zaloguj się ponownie.');
      return;
    }
    try {
      const m = await fetchAdminCoreMetrics(token, { allowPreviewFallback: false });
      applyMetrics(m);
      setManualOffline(false);
      if (serverCommand === 'starting') setServerCommand('idle');
    } catch (e: unknown) {
      if (e instanceof AdminCoreMetricsError) {
        if ((serverCommand === 'starting' || serverCommand === 'stopping' || manualOffline) && e.code === 'unavailable') {
          setError(null);
        } else {
          setError(e.message);
          setMetrics(null);
        }
      } else {
        setError(e instanceof Error ? e.message : 'Nie udało się pobrać metryk.');
      }
    } finally {
      if (serverCommand !== 'starting') setLoading(false);
    }
  }, [token, applyMetrics, serverCommand, manualOffline]);

  useEffect(() => {
    if (!visible) {
      setMetrics(null);
      setCpuHist([]);
      setMemHist([]);
      setDiskHist([]);
      setRssHist([]);
      setError(null);
      setServerCommand('idle');
      setManualOffline(false);
      setPm2Logs('');
      setLogsUpdatedAt(null);
      return;
    }
    setLoading(true);
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const refreshLogs = useCallback(async () => {
    if (!token || !visible) return;
    try {
      const { logs, collectedAt } = await fetchAdminCoreLogs(token);
      setPm2Logs(logs);
      setLogsUpdatedAt(collectedAt ?? new Date().toISOString());
    } catch {
      /* logi opcjonalne — nie blokują panelu */
    }
  }, [token, visible]);

  useEffect(() => {
    if (!visible) return;
    void refreshLogs();
    const id = setInterval(() => void refreshLogs(), LOG_POLL_MS);
    return () => clearInterval(id);
  }, [visible, refreshLogs]);

  useEffect(() => {
    if (pm2Logs && logsScrollRef.current) {
      logsScrollRef.current.scrollToEnd({ animated: false });
    }
  }, [pm2Logs]);

  const heroTone = useMemo(() => {
    if (!metrics) return CORE_ACCENT;
    const peak = Math.max(metrics.cpu.percent, metrics.memory.percent, metrics.disk.percent);
    return toneForPercent(peak);
  }, [metrics]);

  /** LOADING = PM2 niegotowy (build/deploy/start/stop) · ONLINE = metryki · OFFLINE = wyłączony/błąd */
  const coreStatus: CoreTraffic = useMemo(() => {
    if (serverCommand === 'starting' || serverCommand === 'stopping') return 'loading';
    if (metrics && !manualOffline) return 'online';
    if (manualOffline || error) return 'offline';
    if (loading) return 'loading';
    return 'offline';
  }, [manualOffline, error, metrics, serverCommand, loading]);

  const controlBusy = serverCommand !== 'idle';

  const handleTurnOffline = useCallback(() => {
    if (!ADMIN_CORE_SERVER_CONTROL_ENABLED || !token) {
      setError('Brak tokenu — zaloguj się ponownie.');
      return;
    }
    Alert.alert(
      'Wyłączyć CORE (OFFLINE)?',
      'Wyłącza metryki i panel CORE. PM2 zostaje na serwerze — włączenie z aplikacji będzie możliwe.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyłącz',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setServerCommand('stopping');
              setManualOffline(true);
              setMetrics(null);
              setError(null);
              setLoading(true);
              try {
                await controlAdminCoreServer(token, 'stop');
                setServerCommand('idle');
                setLoading(false);
              } catch (e: unknown) {
                setManualOffline(false);
                setServerCommand('idle');
                setLoading(false);
                setError(e instanceof Error ? e.message : 'Nie udało się wyłączyć CORE.');
              }
            })();
          },
        },
      ],
    );
  }, [token]);

  const runStartCore = useCallback(async () => {
    if (!ADMIN_CORE_SERVER_CONTROL_ENABLED || !token) {
      setError('Brak tokenu — zaloguj się ponownie.');
      return;
    }
    if (controlBusy) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setServerCommand('starting');
    setManualOffline(false);
    setLoading(true);
    setMetrics(null);
    setError(null);

    try {
      await controlAdminCoreServer(token, 'start');
    } catch (e: unknown) {
      if (!(e instanceof AdminCoreMetricsError)) {
        setServerCommand('idle');
        setLoading(false);
        setError(e instanceof Error ? e.message : 'Nie udało się włączyć CORE.');
        return;
      }
      if (e.code === 'unauthorized' || e.code === 'forbidden') {
        setServerCommand('idle');
        setLoading(false);
        setError(e.message);
        return;
      }
    }

    void refreshLogs();

    for (let i = 0; i < 40; i++) {
      try {
        const m = await fetchAdminCoreMetrics(token, { allowPreviewFallback: false });
        applyMetrics(m);
        setServerCommand('idle');
        setManualOffline(false);
        setLoading(false);
        void refreshLogs();
        return;
      } catch {
        void refreshLogs();
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setServerCommand('idle');
    setLoading(false);
    setError('CORE nie wrócił online — sprawdź logi PM2 poniżej.');
  }, [token, controlBusy, applyMetrics, refreshLogs]);

  const handleTurnOnline = useCallback(() => {
    void runStartCore();
  }, [runStartCore]);

  useEffect(() => {
    if (!visible || coreStatus !== 'loading') {
      loadingBlink.stopAnimation();
      loadingBlink.setValue(1);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingBlink, { toValue: 0.12, duration: 90, useNativeDriver: true }),
        Animated.timing(loadingBlink, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(loadingBlink, { toValue: 0.18, duration: 90, useNativeDriver: true }),
        Animated.timing(loadingBlink, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [visible, coreStatus, loadingBlink]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: theme.background || (isDark ? '#000' : '#F2F2F7') }]}>
        <LinearGradient
          colors={isDark ? ['#0a0f0d', '#000000'] : ['#ecfdf5', '#f2f2f7']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: CORE_GOLD }]}>EstateOS™</Text>
            <Text style={[styles.title, { color: theme.text || '#000' }]}>CORE — Centrum dowodzenia</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            hitSlop={12}
          >
            <Ionicons name="close-circle" size={32} color={theme.subtitle || '#8E8E93'} />
          </Pressable>
        </View>

        <View style={styles.trafficRow}>
          <CoreTrafficLight
            label="OFFLINE"
            tone="offline"
            active={coreStatus === 'offline'}
            onPress={ADMIN_CORE_SERVER_CONTROL_ENABLED ? handleTurnOffline : undefined}
            disabled={coreStatus === 'offline' || controlBusy}
            isDark={isDark}
          />
          <CoreTrafficLight
            label="ŁADOWANIE"
            tone="loading"
            active={coreStatus === 'loading'}
            blink={loadingBlink}
            isDark={isDark}
          />
          <CoreTrafficLight
            label="ONLINE"
            tone="online"
            active={coreStatus === 'online'}
            onPress={ADMIN_CORE_SERVER_CONTROL_ENABLED ? handleTurnOnline : undefined}
            disabled={controlBusy}
            isDark={isDark}
          />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setLoading(true);
              void refresh();
            }}
            style={[styles.trafficRefresh, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
            hitSlop={8}
          >
            <Ionicons name="refresh" size={20} color={theme.subtitle || '#8E8E93'} />
          </Pressable>
        </View>

        <View style={[styles.terminalWrap, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={styles.terminalHead}>
            <View style={styles.terminalDots}>
              <View style={[styles.termDot, { backgroundColor: '#FF5F57' }]} />
              <View style={[styles.termDot, { backgroundColor: '#FEBC2E' }]} />
              <View style={[styles.termDot, { backgroundColor: '#28C840' }]} />
            </View>
            <Text style={styles.terminalTitle}>pm2 logs · {PM2_PROCESS_NAME}</Text>
            {logsUpdatedAt ? (
              <Text style={styles.terminalMeta}>{new Date(logsUpdatedAt).toLocaleTimeString('pl-PL')}</Text>
            ) : null}
          </View>
          <ScrollView
            ref={logsScrollRef}
            style={styles.terminalScroll}
            contentContainerStyle={styles.terminalContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.terminalText} selectable>
              {pm2Logs || 'Ładowanie logów PM2…'}
            </Text>
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {metrics ? (
              <>
                <View
                  style={[
                    styles.hero,
                    {
                      backgroundColor: isDark ? '#1C1C1E' : '#FFF',
                      borderColor: `${heroTone}44`,
                    },
                  ]}
                >
                  <View style={styles.heroTop}>
                    <Ionicons name="hardware-chip" size={28} color={CORE_ACCENT} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.heroHost, { color: theme.text }]} numberOfLines={1}>
                        {metrics.host}
                      </Text>
                      <Text style={[styles.heroSub, { color: theme.subtitle }]}>
                        Uptime {formatUptime(metrics.uptimeSec)}
                        {lastRefresh ? ` · ${lastRefresh.toLocaleTimeString('pl-PL')}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.coreBadge, { borderColor: `${CORE_GOLD}66` }]}>
                      <Text style={[styles.coreBadgeText, { color: CORE_GOLD }]}>CORE</Text>
                    </View>
                  </View>

                  <View style={styles.ringRow}>
                    <Svg width={88} height={88}>
                      <Circle cx={44} cy={44} r={36} stroke={isDark ? '#2C2C2E' : '#E5E7EB'} strokeWidth={8} fill="none" />
                      <Circle
                        cx={44}
                        cy={44}
                        r={36}
                        stroke={heroTone}
                        strokeWidth={8}
                        fill="none"
                        strokeDasharray={`${(Math.min(100, metrics.cpu.percent) / 100) * 226} 226`}
                        strokeLinecap="round"
                        rotation="-90"
                        origin="44, 44"
                      />
                    </Svg>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={[styles.ringLabel, { color: theme.subtitle }]}>Obciążenie CPU</Text>
                      <Text style={[styles.ringValue, { color: heroTone }]}>{metrics.cpu.percent.toFixed(1)}%</Text>
                      <Text style={[styles.ringMeta, { color: theme.subtitle }]}>
                        {metrics.cpu.cores} rdzeni
                        {metrics.cpu.load1 != null ? ` · load ${metrics.cpu.load1.toFixed(2)}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <MetricCard
                  title="Procesor"
                  subtitle="Natężenie pracy CPU"
                  percent={metrics.cpu.percent}
                  usedLabel={`Load avg ${(metrics.cpu.load5 ?? metrics.cpu.load1 ?? 0).toFixed(2)}`}
                  totalLabel={`${metrics.cpu.cores} rdzeni`}
                  accent="#00D1FF"
                  history={cpuHist.length > 1 ? cpuHist : [metrics.cpu.percent, metrics.cpu.percent]}
                  chartWidth={chartWidth}
                  isDark={isDark}
                />

                <MetricCard
                  title="Pamięć operacyjna"
                  subtitle="RAM serwera"
                  percent={metrics.memory.percent}
                  usedLabel={formatBytesShort(metrics.memory.usedBytes)}
                  totalLabel={formatBytesShort(metrics.memory.totalBytes)}
                  accent="#AF52DE"
                  history={memHist.length > 1 ? memHist : [metrics.memory.percent, metrics.memory.percent]}
                  chartWidth={chartWidth}
                  isDark={isDark}
                />

                <MetricCard
                  title="Dysk"
                  subtitle="Pojemność wolumenu danych"
                  percent={metrics.disk.percent}
                  usedLabel={formatBytesShort(metrics.disk.usedBytes)}
                  totalLabel={formatBytesShort(metrics.disk.totalBytes)}
                  accent="#FF9F0A"
                  history={diskHist.length > 1 ? diskHist : [metrics.disk.percent, metrics.disk.percent]}
                  chartWidth={chartWidth}
                  isDark={isDark}
                />

                <MetricCard
                  title="Pamięć procesu Node"
                  subtitle="RSS / heap serwera aplikacji"
                  percent={
                    metrics.process?.heapTotalBytes
                      ? (metrics.process.heapUsedBytes / metrics.process.heapTotalBytes) * 100
                      : 0
                  }
                  usedLabel={`RSS ${formatBytesShort(metrics.process?.rssBytes ?? 0)}`}
                  totalLabel={`Heap ${formatBytesShort(metrics.process?.heapUsedBytes ?? 0)} / ${formatBytesShort(metrics.process?.heapTotalBytes ?? 0)}`}
                  accent={CORE_ACCENT}
                  history={rssHist.length > 1 ? rssHist : [0, 0]}
                  chartWidth={chartWidth}
                  isDark={isDark}
                />

                <Text style={[styles.sectionLabel, { color: theme.subtitle }]}>Operacje platformy</Text>
                <View style={styles.miniGrid}>
                  <MiniStat
                    label="Req / min"
                    value={String(metrics.network?.requestsPerMin ?? '—')}
                    color="#00D1FF"
                    isDark={isDark}
                  />
                  <MiniStat
                    label="Połączenia"
                    value={String(metrics.network?.activeConnections ?? '—')}
                    color="#5E5CE6"
                    isDark={isDark}
                  />
                  <MiniStat
                    label="DB pool"
                    value={`${metrics.database?.poolActive ?? '—'}/${metrics.database?.poolMax ?? '—'}`}
                    color="#FF2D55"
                    isDark={isDark}
                  />
                  <MiniStat
                    label="DB ping"
                    value={metrics.database?.latencyMs != null ? `${metrics.database.latencyMs} ms` : '—'}
                    color={toneForPercent((metrics.database?.latencyMs ?? 0) > 50 ? 80 : 30)}
                    isDark={isDark}
                  />
                  <MiniStat
                    label="Oferty PENDING"
                    value={String(metrics.app?.offersPending ?? '—')}
                    color="#FF9F0A"
                    isDark={isDark}
                  />
                  <MiniStat
                    label="Radar push ON"
                    value={String(metrics.app?.radarPushActive ?? '—')}
                    color={CORE_ACCENT}
                    isDark={isDark}
                  />
                  <MiniStat
                    label="Aktywni użytk."
                    value={String(metrics.app?.activeUsers ?? '—')}
                    color="#34C759"
                    isDark={isDark}
                  />
                  <MiniStat
                    label="Kolejka push"
                    value={String(metrics.app?.pushQueueDepth ?? '—')}
                    color="#BF5AF2"
                    isDark={isDark}
                  />
                </View>

              </>
            ) : null}

            {error && coreStatus === 'offline' && serverCommand === 'idle' ? (
              <Text style={[styles.errorText, { color: '#FF453A' }]}>{error}</Text>
            ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brand: { fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  trafficSlot: {
    flex: 1,
    minHeight: 52,
  },
  trafficPill: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  trafficPillLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
  },
  trafficRefresh: {
    width: 48,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  terminalWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0d1117',
  },
  terminalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  terminalDots: { flexDirection: 'row', gap: 6 },
  termDot: { width: 10, height: 10, borderRadius: 5 },
  terminalTitle: {
    flex: 1,
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  terminalMeta: { color: '#6e7681', fontSize: 10, fontWeight: '600' },
  terminalScroll: { maxHeight: 160 },
  terminalContent: { padding: 10 },
  terminalText: {
    color: '#7ee787',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Menlo',
  },
  scroll: { padding: 16, paddingBottom: 48, gap: 14 },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroHost: { fontSize: 17, fontWeight: '800' },
  heroSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  coreBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coreBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  ringRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  ringLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  ringValue: { fontSize: 32, fontWeight: '900', marginTop: 4 },
  ringMeta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  metricCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metricTitle: { fontSize: 15, fontWeight: '800' },
  metricSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  metricPercent: { fontSize: 22, fontWeight: '900' },
  sparkWrap: { borderRadius: 12, marginTop: 12, marginBottom: 10, overflow: 'hidden', height: 44 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999 },
  metricFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricFootText: { fontSize: 11, fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniStat: {
    width: '47.5%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  miniStatLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  miniStatValue: { fontSize: 20, fontWeight: '900', marginTop: 6 },
  previewHint: { fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  errorText: { textAlign: 'center', fontWeight: '700', marginTop: 12 },
});
