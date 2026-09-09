import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import type { AdminCoreMetrics } from '../contracts/adminCoreContract';
import type {
  CoreDiagnoseReport,
  CoreFinding,
  CoreGuardDashboard,
  CoreGuardIncident,
  CoreLogAppName,
  CoreLogStream,
  CoreOptimizeAction,
  CorePm2Process,
  CoreProductionSnapshot,
} from '../contracts/adminCoreOpsContract';
import { CORE_LOG_APP_NAMES } from '../contracts/adminCoreOpsContract';
import {
  fetchAdminCoreMetrics,
  formatBytesShort,
  formatUptime,
} from '../services/adminCoreMetricsService';
import {
  controlCoreProcess,
  fetchCoreDiagnose,
  fetchCoreGuard,
  fetchCoreOpsLogs,
  fetchCoreProcesses,
  fetchCoreProduction,
  runCoreOptimize,
  runCoreGuardAction,
} from '../services/adminCoreOpsService';

type TabId = 'overview' | 'fleet' | 'logs' | 'prod' | 'repair';
type ConsoleTheme = ReturnType<typeof useConsoleTheme>;

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const METRICS_MS = 4000;
const DIAGNOSE_MS = 15000;
const LOGS_MS = 2500;
const WWW_NAME = 'nieruchomosci';

const PROCESS_META: Record<string, { title: string; hint: string }> = {
  nieruchomosci: { title: 'WWW', hint: 'estateos.pl · Next.js' },
  'lineage-movies-downloader': { title: 'Filmy · pobieranie', hint: 'yt-dlp / ffmpeg' },
  'lineage-movies-proxy': { title: 'Filmy · proxy', hint: 'stream' },
  'partner-growth-nurture': { title: 'Partner nurture', hint: 'cron' },
  'reviews-finalization-fallback': { title: 'Opinie · fallback', hint: 'cron' },
  'kei-import-worker': { title: 'KEI import', hint: 'dedykowany worker' },
  'estateos-core-guard': { title: 'CORE Guard', hint: 'monitoring 24/7' },
  'client-intelligence': { title: 'Client intelligence', hint: 'cron' },
  'seller-marketing-renewals': { title: 'Marketing sprzedawcy', hint: 'cron' },
  'rcn-market-ingest': { title: 'RCN ingest', hint: 'cron' },
  mariadb: { title: 'MariaDB', hint: 'baza' },
};

function useConsoleTheme() {
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  return useMemo(
    () => ({
      isDark,
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#F5F5F7' : '#111827',
      secondary: isDark ? '#8E8E93' : '#6B7280',
      muted: isDark ? '#636366' : '#8E8E93',
      separator: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.12)',
      hairline: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.1)',
      input: isDark ? '#2C2C2E' : '#E5E5EA',
      contrast: isDark ? '#111111' : '#FFFFFF',
      primary: isDark ? '#F5F5F7' : '#111827',
      ok: '#30D158',
      warn: '#FF9F0A',
      crit: '#FF453A',
      logBg: isDark ? '#0E0E10' : '#1C1C1E',
      logText: '#C7C7CC',
      logDim: '#636366',
    }),
    [isDark],
  );
}

function tone(level: string, colors: ConsoleTheme) {
  if (level === 'critical' || level === 'offline' || level === 'errored' || level === 'down') return colors.crit;
  if (level === 'warning' || level === 'launching' || level === 'stopping') return colors.warn;
  if (level === 'ok' || level === 'online' || level === 'healthy') return colors.ok;
  return colors.muted;
}

function formatUptimeMs(ms: number) {
  if (!ms || ms <= 0) return '—';
  return formatUptime(Math.floor(ms / 1000));
}

function formatClock(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatWhen(iso?: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function processTitle(name: string) {
  return PROCESS_META[name]?.title || name;
}

function processHint(name: string) {
  return PROCESS_META[name]?.hint || name;
}

function groupByName(list: CorePm2Process[]) {
  const map = new Map<string, CorePm2Process[]>();
  for (const item of list) {
    const next = map.get(item.name) || [];
    next.push(item);
    map.set(item.name, next);
  }
  return [...map.entries()];
}

function ScoreRing({ score, level, colors }: { score: number; level: string; colors: ConsoleTheme }) {
  const size = 44;
  const stroke = 3.25;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;
  const color = tone(level, colors);
  return (
    <View style={styles.scoreWrap}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.input} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.scoreInner}>
        <Text style={[styles.scoreValue, { color }]}>{clamped}</Text>
      </View>
    </View>
  );
}

function StatusDot({ level, colors }: { level: string; colors: ConsoleTheme }) {
  return <View style={[styles.dot, { backgroundColor: tone(level, colors) }]} />;
}

function Meter({ percent, color, track }: { percent: number; color: string; track: string }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.meterTrack, { backgroundColor: track }]}>
      <View style={[styles.meterFill, { width: `${width}%`, backgroundColor: color }]} />
    </View>
  );
}

function Panel({ children, colors }: { children: React.ReactNode; colors: ConsoleTheme }) {
  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.separator }]}>{children}</View>
  );
}

function SectionLabel({ label, colors }: { label: string; colors: ConsoleTheme }) {
  return <Text style={[styles.sectionLabel, { color: colors.muted }]}>{label}</Text>;
}

function SegmentBar({
  value,
  onChange,
  options,
  colors,
}: {
  value: TabId;
  onChange: (id: TabId) => void;
  options: Array<{ id: TabId; label: string }>;
  colors: ConsoleTheme;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: colors.input }]}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.id);
            }}
            style={[styles.segment, active && { backgroundColor: colors.isDark ? '#636366' : '#FFFFFF' }]}
          >
            <Text numberOfLines={1} style={[styles.segmentLabel, { color: active ? colors.text : colors.secondary }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MetricTile({
  label,
  value,
  hint,
  meter,
  colors,
}: {
  label: string;
  value: string;
  hint?: string;
  meter?: number;
  colors: ConsoleTheme;
}) {
  const meterColor =
    meter == null ? colors.ok : meter >= 90 ? colors.crit : meter >= 75 ? colors.warn : colors.ok;
  return (
    <View style={styles.metricTile}>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={[styles.metricHint, { color: colors.secondary }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
      {meter != null ? <Meter percent={meter} color={meterColor} track={colors.hairline} /> : null}
    </View>
  );
}

function TextBtn({
  label,
  onPress,
  disabled,
  colors,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: ConsoleTheme;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={{ opacity: disabled ? 0.35 : 1 }}>
      <Text style={[styles.textBtn, { color: danger ? colors.crit : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function isErrorLine(line: string) {
  return /error|fatal|econnrefused|exception|unhandled|crash/i.test(line);
}

export default function AdminCoreConsoleScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useConsoleTheme();
  const getAdminToken = useAuthStore((s) => s.getAdminToken);

  const [tab, setTab] = useState<TabId>('overview');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [metrics, setMetrics] = useState<AdminCoreMetrics | null>(null);
  const [report, setReport] = useState<CoreDiagnoseReport | null>(null);
  const [processes, setProcesses] = useState<CorePm2Process[]>([]);
  const [mariadb, setMariadb] = useState<{ name: string; status: string; up: boolean } | null>(null);
  const [production, setProduction] = useState<CoreProductionSnapshot | null>(null);
  const [actions, setActions] = useState<CoreOptimizeAction[]>([]);
  const [guard, setGuard] = useState<CoreGuardDashboard | null>(null);

  const [logApp, setLogApp] = useState<CoreLogAppName>('nieruchomosci');
  const [logStream, setLogStream] = useState<CoreLogStream>('both');
  const [logText, setLogText] = useState('');
  const [logError, setLogError] = useState('');
  const [logAt, setLogAt] = useState('');
  const [logPaused, setLogPaused] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const logScroll = useRef<ScrollView>(null);

  const loadDiagnose = useCallback(async () => {
    const token = getAdminToken();
    if (!token) throw new Error('Brak sesji administratora.');
    setReport(await fetchCoreDiagnose(token));
  }, [getAdminToken]);

  const loadMetrics = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setMetrics(await fetchAdminCoreMetrics(token, { allowPreviewFallback: false }));
  }, [getAdminToken]);

  const loadFleet = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    const data = await fetchCoreProcesses(token);
    setProcesses(data.processes);
    setMariadb(data.mariadb);
  }, [getAdminToken]);

  const loadProduction = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setProduction(await fetchCoreProduction(token));
  }, [getAdminToken]);

  const loadGuard = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setGuard(await fetchCoreGuard(token, '24h'));
  }, [getAdminToken]);

  const loadLogs = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    const data = await fetchCoreOpsLogs(token, { name: logApp, stream: logStream, lines: 250 });
    setLogText(data.logs);
    setLogAt(data.collectedAt || '');
    setLogError('');
  }, [getAdminToken, logApp, logStream]);

  const refreshChrome = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setError('Brak sesji administratora.');
      return;
    }
    setError('');
    const results = await Promise.allSettled([loadDiagnose(), loadMetrics(), loadFleet(), loadProduction(), loadGuard()]);
    const diagnoseFailed = results[0];
    if (diagnoseFailed.status === 'rejected') {
      const reason = diagnoseFailed.reason;
      setError(reason instanceof Error ? reason.message : 'Nie udało się odświeżyć CORE.');
    }
  }, [getAdminToken, loadDiagnose, loadFleet, loadGuard, loadMetrics, loadProduction]);

  const refreshAll = useCallback(async () => {
    await refreshChrome();
    if (tab !== 'logs') return;
    try {
      await loadLogs();
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Nie udało się wczytać logów.');
    }
  }, [loadLogs, refreshChrome, tab]);

  useFocusEffect(
    useCallback(() => {
      void refreshChrome();
      const metricsTimer = setInterval(() => {
        void loadMetrics().catch(() => undefined);
      }, METRICS_MS);
      const diagnoseTimer = setInterval(() => {
        void Promise.all([loadDiagnose(), loadFleet(), loadProduction()]).catch(() => undefined);
      }, DIAGNOSE_MS);
      const guardTimer = setInterval(() => {
        void loadGuard().catch(() => undefined);
      }, 60_000);
      return () => {
        clearInterval(metricsTimer);
        clearInterval(diagnoseTimer);
        clearInterval(guardTimer);
      };
    }, [loadDiagnose, loadFleet, loadGuard, loadMetrics, loadProduction, refreshChrome]),
  );

  useEffect(() => {
    if (tab !== 'logs' || logPaused) return;
    void loadLogs().catch((err) => {
      setLogError(err instanceof Error ? err.message : 'Nie udało się wczytać logów.');
    });
    const timer = setInterval(() => {
      void loadLogs().catch((err) => {
        setLogError(err instanceof Error ? err.message : 'Nie udało się wczytać logów.');
      });
    }, LOGS_MS);
    return () => clearInterval(timer);
  }, [tab, logPaused, loadLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    void refreshAll().finally(() => setRefreshing(false));
  };

  const fixable = report?.findings.filter((item) => item.fixable) || [];
  const score = guard?.score ?? report?.score ?? (report?.healthy ? 100 : 0);
  const level = guard?.level || report?.level || 'ok';
  const guardIncidents = guard?.incidents.filter((item) => item.status === 'open') || [];
  const host = metrics?.host || 'nieruchomosci';
  const webOnline =
    processes.some((item) => item.name === WWW_NAME && item.status === 'online') ||
    (production?.workers || []).some((item) => item.status === 'online');
  const fleetOnline = processes.filter((item) => item.status === 'online').length;
  const fleetStopped = processes.filter((item) => item.status === 'stopped').length;
  const daemons = groupByName(processes.filter((item) => item.kind !== 'cron'));
  const crons = groupByName(processes.filter((item) => item.kind === 'cron'));

  const runOptimize = async () => {
    const token = getAdminToken();
    if (!token) return;
    setOptimizing(true);
    setError('');
    try {
      const result = await runCoreOptimize(token);
      setActions(result.actions || []);
      if (result.after) setReport(result.after);
      else await loadDiagnose();
      await Promise.all([loadFleet(), loadProduction(), loadMetrics()]);
      setTab('repair');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optymalizacja nie powiodła się.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setOptimizing(false);
    }
  };

  const confirmOptimize = () => {
    Alert.alert(
      'Wykonać bezpieczne naprawy?',
      'Najpierw powstanie plan. Automatycznie wykonają się wyłącznie odwracalne akcje niskiego ryzyka; procesy i baza wymagają osobnej decyzji.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Pokaż i wykonaj', onPress: () => void runOptimize() },
      ],
    );
  };

  const confirmGuardAction = (incident: CoreGuardIncident) => {
    if (!incident.recommendedAction) return;
    Alert.alert(
      incident.title,
      `${incident.detail}\n\nCORE wykona wyłącznie przypisany, dozwolony runbook i zapisze wynik w historii audytu.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wykonaj',
          onPress: () => {
            const token = getAdminToken();
            if (!token) return;
            setBusy(true);
            void runCoreGuardAction(token, incident.recommendedAction!, incident.id)
              .then(async () => {
                await Promise.all([loadGuard(), loadDiagnose(), loadFleet(), loadMetrics()]);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              })
              .catch((reason) => {
                setError(reason instanceof Error ? reason.message : 'Runbook CORE nie powiódł się.');
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const runProcess = async (name: string, action: 'start' | 'stop' | 'restart' | 'reload') => {
    const token = getAdminToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await controlCoreProcess(token, name, action);
      await loadFleet();
      if (name === WWW_NAME) await loadProduction();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Akcja na procesie nie powiodła się.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const confirmProcess = (name: string, action: 'start' | 'stop' | 'restart' | 'reload') => {
    const title = processTitle(name);
    if (name === WWW_NAME && action === 'stop') {
      Alert.alert('Zatrzymać WWW?', 'To zdejmie estateos.pl dla wszystkich użytkowników.', [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Kontynuuj',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Na pewno zdjąć produkcję?', 'Drugi raz: stop na nieruchomosci wyłącza stronę.', [
              { text: 'Anuluj', style: 'cancel' },
              {
                text: 'Zatrzymaj WWW',
                style: 'destructive',
                onPress: () => void runProcess(name, action),
              },
            ]),
        },
      ]);
      return;
    }
    const labels: Record<typeof action, string> = {
      start: `Uruchomić ${title}?`,
      stop: `Zatrzymać ${title}?`,
      restart: `Zrestartować ${title}?`,
      reload: `Przeładować ${title}?`,
    };
    Alert.alert(
      labels[action],
      action === 'reload' ? 'Rolling reload — strona zostaje online.' : 'Akcja na produkcji, z potwierdzeniem.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wykonaj', onPress: () => void runProcess(name, action) },
      ],
    );
  };

  const logLines = useMemo(() => {
    const needle = logFilter.trim().toLowerCase();
    return logText.split('\n').filter((line) => (needle ? line.toLowerCase().includes(needle) : true));
  }, [logText, logFilter]);

  const headline = optimizing
    ? 'Przywracam zdrowy stan'
    : !report
      ? 'Łączę z produkcją'
      : report.healthy
        ? 'Produkcja jest w zdrowym stanie'
        : fixable.length === 1
          ? '1 odchylenie do naprawy'
          : `${fixable.length} odchylenia do naprawy`;

  const renderFleetGroup = (name: string, items: CorePm2Process[], last: boolean) => {
    const online = items.some((item) => item.status === 'online');
    const cronIdle = items[0]?.kind === 'cron' && !online;
    const rss = items.reduce((sum, item) => sum + (item.memoryBytes || 0), 0);
    const cpu = items.reduce((sum, item) => sum + (item.cpu || 0), 0);
    return (
      <View key={name} style={[styles.listRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <View style={styles.row}>
            <StatusDot level={cronIdle ? 'ok' : online ? 'ok' : 'critical'} colors={colors} />
            <Text style={[styles.rowTitle, { color: colors.text }]}>{processTitle(name)}</Text>
          </View>
          <Text style={[styles.rowMeta, { color: colors.secondary }]} numberOfLines={1}>
            {cronIdle ? 'oczekuje między runami' : items.map((item) => item.status).join(' · ')}
            {items.length > 1 ? ` · ${items.length} inst.` : ''}
            {' · '}
            {Math.round(cpu)}% · {formatBytesShort(rss)}
          </Text>
        </View>
        <View style={styles.rowActions}>
          {online ? (
            <>
              <TextBtn label="Reload" disabled={busy} colors={colors} onPress={() => confirmProcess(name, 'reload')} />
              <TextBtn label="Stop" disabled={busy} colors={colors} danger onPress={() => confirmProcess(name, 'stop')} />
            </>
          ) : (
            <TextBtn label="Start" disabled={busy} colors={colors} onPress={() => confirmProcess(name, 'start')} />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.muted }]}>EstateOS™ CORE</Text>
          <View style={styles.liveLine}>
            <StatusDot level={webOnline ? 'ok' : processes.length ? 'critical' : 'warning'} colors={colors} />
            <Text style={[styles.hostLine, { color: colors.secondary }]} numberOfLines={1}>
              {host}
              {'  ·  '}
              {metrics && metrics.live === false ? 'podgląd' : webOnline ? 'live' : 'offline'}
              {'  ·  '}
              {mariadb?.up ? 'MariaDB' : 'MariaDB down'}
              {'  ·  '}
              {production?.inSync ? production.git.sha || 'commit' : 'dryf commita'}
            </Text>
          </View>
        </View>
        <Pressable onPress={onRefresh} hitSlop={8} disabled={refreshing || optimizing} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color={colors.muted} />
        </Pressable>
        <ScoreRing score={score} level={level} colors={colors} />
      </View>

      <SegmentBar
        value={tab}
        onChange={setTab}
        colors={colors}
        options={[
          { id: 'overview', label: 'Przegląd' },
          { id: 'fleet', label: 'Flota' },
          { id: 'logs', label: 'Logi' },
          { id: 'prod', label: 'Deploy' },
          { id: 'repair', label: 'Naprawa' },
        ]}
      />

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: `${colors.crit}14` }]}>
          <Text style={[styles.errorText, { color: colors.crit }]}>{error}</Text>
        </View>
      ) : null}

      {tab === 'logs' ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom + 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.appChips}
          >
            {CORE_LOG_APP_NAMES.map((name) => {
              const active = name === logApp;
              return (
                <Pressable
                  key={name}
                  onPress={() => {
                    setLogApp(name);
                    setLogPaused(false);
                  }}
                  style={[styles.logTab, active && { borderBottomColor: colors.text }]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? colors.text : colors.secondary,
                      fontSize: 13,
                      fontWeight: active ? '600' : '500',
                    }}
                  >
                    {processTitle(name)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.terminalShell, { backgroundColor: colors.logBg, borderColor: colors.separator }]}>
            <View style={styles.terminalBar}>
              <View style={styles.trafficDots}>
                <View style={[styles.winDot, { backgroundColor: '#FF5F57' }]} />
                <View style={[styles.winDot, { backgroundColor: '#FEBC2E' }]} />
                <View style={[styles.winDot, { backgroundColor: '#28C840' }]} />
              </View>
              <Text style={[styles.terminalTitle, { color: colors.logDim }]} numberOfLines={1}>
                {processTitle(logApp)} · {logStream === 'both' ? 'out+err' : logStream} · {logPaused ? 'pauza' : 'live'}
              </Text>
              <View style={styles.terminalTools}>
                {(['both', 'out', 'error'] as CoreLogStream[]).map((stream) => (
                  <Pressable key={stream} onPress={() => setLogStream(stream)} hitSlop={6}>
                    <Text style={{ color: stream === logStream ? colors.logText : colors.logDim, fontSize: 11, fontWeight: '600' }}>
                      {stream === 'both' ? 'Oba' : stream === 'out' ? 'Out' : 'Err'}
                    </Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setLogPaused((prev) => !prev)} hitSlop={6}>
                  <Text style={{ color: colors.logDim, fontSize: 11, fontWeight: '600' }}>{logPaused ? 'Wznów' : 'Pauza'}</Text>
                </Pressable>
                <Text style={{ color: colors.logDim, fontSize: 11, fontFamily: MONO }}>{formatClock(logAt)}</Text>
              </View>
            </View>
            <TextInput
              value={logFilter}
              onChangeText={setLogFilter}
              placeholder="Filtruj linie"
              placeholderTextColor={colors.logDim}
              style={[styles.filter, { color: colors.logText, borderBottomColor: 'rgba(255,255,255,0.06)' }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.terminal}>
              {logError ? (
                <Text style={{ color: colors.crit, fontFamily: MONO, fontSize: 12 }}>{logError}</Text>
              ) : !logText ? (
                <Text style={{ color: colors.logDim, fontFamily: MONO, fontSize: 12 }}>Czekam na logi…</Text>
              ) : (
                <ScrollView
                  ref={logScroll}
                  onContentSizeChange={() => {
                    if (!logPaused) logScroll.current?.scrollToEnd({ animated: false });
                  }}
                >
                  {logLines.map((line, index) => (
                    <Text
                      key={`${index}-${line.slice(0, 24)}`}
                      style={{
                        color: isErrorLine(line) ? '#FF8A80' : colors.logText,
                        fontFamily: MONO,
                        fontSize: 11,
                        lineHeight: 16,
                      }}
                    >
                      {line || ' '}
                    </Text>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        >
          {tab === 'overview' ? (
            <>
              <View style={styles.hero}>
                <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
                <Text style={[styles.lede, { color: colors.secondary }]}>
                  {optimizing
                    ? 'Wykonuję zatwierdzony, bezpieczny podzbiór napraw.'
                    : guardIncidents.length
                      ? `${guardIncidents.length} aktywnych incydentów CORE Guard.`
                      : report?.summary || 'Sprawdzam dysk, logi, PM2, bazę i tożsamość deployu.'}
                </Text>
              </View>
              <SectionLabel label="CORE Guard · historia trwała" colors={colors} />
              <Panel colors={colors}>
                {guardIncidents.length === 0 ? (
                  <View style={styles.listRow}>
                    <View style={styles.row}>
                      <StatusDot level="ok" colors={colors} />
                      <Text style={[styles.rowTitle, { color: colors.text }]}>
                        Brak aktywnych incydentów
                      </Text>
                    </View>
                  </View>
                ) : (
                  guardIncidents.slice(0, 5).map((incident, index, rows) => (
                    <View
                      key={incident.id}
                      style={[
                        styles.listRow,
                        index < rows.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View style={styles.row}>
                          <StatusDot level={incident.severity} colors={colors} />
                          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                            {incident.title}
                          </Text>
                        </View>
                        <Text style={[styles.rowMeta, { color: colors.secondary }]} numberOfLines={2}>
                          {incident.detail}
                        </Text>
                      </View>
                      {incident.recommendedAction ? (
                        <TextBtn
                          label="Napraw"
                          disabled={busy}
                          colors={colors}
                          onPress={() => confirmGuardAction(incident)}
                        />
                      ) : null}
                    </View>
                  ))
                )}
              </Panel>
              <View style={{ height: 12 }} />
              <Panel colors={colors}>
                <View style={styles.metricRow}>
                  <MetricTile
                    label="Load"
                    value={metrics?.cpu.load1 != null ? String(metrics.cpu.load1) : '—'}
                    hint={`${metrics?.cpu.cores || 0} rdzenie`}
                    meter={metrics?.cpu.percent}
                    colors={colors}
                  />
                  <View style={[styles.vRule, { backgroundColor: colors.hairline }]} />
                  <MetricTile
                    label="Pamięć"
                    value={`${Math.round(metrics?.memory.percent || 0)}%`}
                    hint={`${formatBytesShort(metrics?.memory.usedBytes || 0)} / ${formatBytesShort(metrics?.memory.totalBytes || 0)}`}
                    meter={metrics?.memory.percent}
                    colors={colors}
                  />
                </View>
                <View style={[styles.hRule, { backgroundColor: colors.hairline }]} />
                <View style={styles.metricRow}>
                  <MetricTile
                    label="Dysk"
                    value={`${Math.round(metrics?.disk.percent || 0)}%`}
                    hint={`${formatBytesShort(metrics?.disk.usedBytes || 0)} / ${formatBytesShort(metrics?.disk.totalBytes || 0)}`}
                    meter={metrics?.disk.percent}
                    colors={colors}
                  />
                  <View style={[styles.vRule, { backgroundColor: colors.hairline }]} />
                  <MetricTile
                    label="Baza"
                    value={metrics?.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)} ms` : '—'}
                    hint={mariadb?.up ? 'MariaDB online' : 'MariaDB niedostępna'}
                    colors={colors}
                  />
                </View>
              </Panel>
              <View style={{ height: 12 }} />
              <Panel colors={colors}>
                <View style={[styles.listRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>Flota</Text>
                    <Text style={[styles.rowMeta, { color: colors.secondary }]}>
                      {fleetOnline} online · {fleetStopped} oczekuje
                    </Text>
                  </View>
                  <Text style={[styles.mono, { color: colors.secondary }]}>{production?.git.sha || '—'}</Text>
                </View>
                <View style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>Oferty pending</Text>
                    <Text style={[styles.rowMeta, { color: colors.secondary }]}>Aktywni 24h · {metrics?.app?.activeUsers ?? '—'}</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text, marginTop: 0 }]}>{metrics?.app?.offersPending ?? '—'}</Text>
                </View>
              </Panel>
              {fixable.length > 0 ? (
                <Pressable
                  onPress={confirmOptimize}
                  disabled={optimizing}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: optimizing ? 0.45 : 1 }]}
                >
                  {optimizing ? <ActivityIndicator color={colors.contrast} /> : null}
                  <Text style={[styles.primaryBtnText, { color: colors.contrast }]}>Przywróć zdrowy stan</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {tab === 'fleet' ? (
            <>
              <SectionLabel label="Usługi" colors={colors} />
              <Panel colors={colors}>
                <View style={[styles.listRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}>
                      <StatusDot level={mariadb?.up ? 'ok' : 'critical'} colors={colors} />
                      <Text style={[styles.rowTitle, { color: colors.text }]}>MariaDB</Text>
                    </View>
                    <Text style={[styles.rowMeta, { color: colors.secondary }]}>{mariadb?.up ? 'online' : mariadb?.status || '—'}</Text>
                  </View>
                  {!mariadb?.up ? (
                    <TextBtn label="Start" disabled={busy} colors={colors} onPress={() => confirmProcess('mariadb', 'start')} />
                  ) : null}
                </View>
                {daemons.map(([name, items], index) => renderFleetGroup(name, items, index === daemons.length - 1))}
              </Panel>
              <SectionLabel label="Cron · stopped między runami jest OK" colors={colors} />
              <Panel colors={colors}>
                {crons.map(([name, items], index) => renderFleetGroup(name, items, index === crons.length - 1))}
              </Panel>
            </>
          ) : null}

          {tab === 'prod' ? (
            <>
              <View style={styles.hero}>
                <Text style={[styles.headline, { color: colors.text }]}>
                  {production?.inSync ? 'Deploy i proces są zgodne' : 'Proces WWW ma inny commit'}
                </Text>
                <Text style={[styles.lede, { color: colors.secondary }]}>
                  Health czyta COMMIT_SHA z workera. Kod na dysku może być nowszy niż ta etykieta.
                </Text>
              </View>
              <Panel colors={colors}>
                {[
                  { label: 'Repozytorium', value: production?.git.sha || '—' },
                  { label: 'Plik .env', value: production?.env.commitSha || '—' },
                  { label: 'Proces WWW', value: production?.process.commitSha || '—' },
                ].map((row, index, arr) => (
                  <View
                    key={row.label}
                    style={[
                      styles.listRow,
                      index < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
                    ]}
                  >
                    <Text style={[styles.rowTitle, { color: colors.secondary, fontWeight: '500' }]}>{row.label}</Text>
                    <Text style={[styles.mono, { color: colors.text }]}>{row.value}</Text>
                  </View>
                ))}
              </Panel>
              <View style={{ height: 12 }} />
              <Panel colors={colors}>
                <View style={[styles.listRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                      {production?.git.subject || 'Ostatni commit'}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.secondary }]}>{formatWhen(production?.git.committedAt)}</Text>
                  </View>
                </View>
                <View style={styles.listRow}>
                  <Text style={[styles.rowMeta, { color: colors.secondary, flex: 1 }]}>
                    health {production?.health.status || '—'} · {production?.health.durationMs ?? '—'} ms · up {formatUptime(production?.health.uptimeSec || 0)}
                  </Text>
                </View>
              </Panel>
              {(production?.workers || []).length ? (
                <>
                  <SectionLabel label="Workery WWW" colors={colors} />
                  <Panel colors={colors}>
                    {(production?.workers || []).map((worker, index, arr) => (
                      <View
                        key={`w-${worker.id}`}
                        style={[
                          styles.listRow,
                          index < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
                        ]}
                      >
                        <Text style={[styles.rowTitle, { color: colors.text }]}>#{worker.id}</Text>
                        <Text style={[styles.mono, { color: colors.secondary }]}>
                          {worker.status} · {formatBytesShort(worker.memoryBytes)} · {formatUptimeMs(worker.uptimeMs)}
                        </Text>
                      </View>
                    ))}
                  </Panel>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'repair' ? (
            <>
              <View style={styles.hero}>
                <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
                <Text style={[styles.lede, { color: colors.secondary }]}>{report?.summary || 'Skan diagnostyczny.'}</Text>
              </View>
              <Pressable
                onPress={confirmOptimize}
                disabled={optimizing || fixable.length === 0}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, opacity: optimizing || fixable.length === 0 ? 0.35 : 1, marginTop: 0 },
                ]}
              >
                {optimizing ? <ActivityIndicator color={colors.contrast} /> : null}
                <Text style={[styles.primaryBtnText, { color: colors.contrast }]}>Przywróć zdrowy stan</Text>
              </Pressable>
              {actions.length > 0 ? (
                <>
                  <SectionLabel label="Wykonane" colors={colors} />
                  <Panel colors={colors}>
                    {actions.map((action, index) => (
                      <View
                        key={action.id}
                        style={[
                          styles.listRow,
                          index < actions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowTitle, { color: colors.text }]}>{action.label}</Text>
                          <Text style={[styles.rowMeta, { color: colors.secondary }]}>
                            {action.detail}
                            {action.freedBytes ? ` · ${formatBytesShort(action.freedBytes)}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Panel>
                </>
              ) : null}
              <SectionLabel label="Znaleziska" colors={colors} />
              <Panel colors={colors}>
                {(report?.findings || []).length === 0 ? (
                  <View style={styles.listRow}>
                    <Text style={[styles.rowMeta, { color: colors.secondary }]}>
                      Brak śmieci, zaciętych procesów i rozjazdów wersji.
                    </Text>
                  </View>
                ) : (
                  (report?.findings || []).map((finding: CoreFinding, index, arr) => (
                    <View
                      key={finding.id}
                      style={[
                        styles.findingRow,
                        index < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
                      ]}
                    >
                      <View style={styles.row}>
                        <StatusDot level={finding.severity === 'info' ? 'ok' : finding.severity} colors={colors} />
                        <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{finding.title}</Text>
                      </View>
                      <Text style={[styles.rowMeta, { color: colors.secondary, marginTop: 6 }]}>{finding.detail}</Text>
                      {(finding.evidence || []).map((row) => (
                        <View key={`${finding.id}-${row.label}`} style={styles.evidenceRow}>
                          <Text style={[styles.metricLabel, { color: colors.muted, width: 108 }]}>{row.label}</Text>
                          <Text style={[styles.mono, { color: colors.text, flex: 1 }]}>{row.value}</Text>
                        </View>
                      ))}
                      <Text style={[styles.findingAction, { color: colors.muted }]}>
                        {finding.action || (finding.fixable ? 'Automatyczna' : 'Tylko podgląd')}
                      </Text>
                    </View>
                  ))
                )}
              </Panel>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: { padding: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  hostLine: { fontSize: 12, flex: 1 },
  refreshBtn: { padding: 4 },
  scoreWrap: { width: 44, height: 44 },
  scoreInner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dot: { width: 6, height: 6, borderRadius: 3 },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontSize: 11, fontWeight: '600' },
  errorBox: { marginHorizontal: 16, marginBottom: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { fontSize: 13, lineHeight: 18 },
  hero: { paddingTop: 4, paddingBottom: 16 },
  headline: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, lineHeight: 28 },
  lede: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  panel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  metricRow: { flexDirection: 'row' },
  metricTile: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  metricLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2 },
  metricValue: { fontSize: 22, fontWeight: '600', letterSpacing: -0.6, marginTop: 4, fontVariant: ['tabular-nums'] },
  metricHint: { fontSize: 12, marginTop: 3 },
  meterTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  meterFill: { height: 3, borderRadius: 2 },
  vRule: { width: StyleSheet.hairlineWidth },
  hRule: { height: StyleSheet.hairlineWidth },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  textBtn: { fontSize: 14, fontWeight: '500' },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  findingRow: { paddingHorizontal: 14, paddingVertical: 14 },
  evidenceRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  findingAction: { fontSize: 12, marginTop: 8 },
  primaryBtn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  appChips: { paddingHorizontal: 16, gap: 18, paddingBottom: 8, alignItems: 'flex-end' },
  logTab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  terminalShell: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  terminalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  trafficDots: { flexDirection: 'row', gap: 5 },
  winDot: { width: 8, height: 8, borderRadius: 4 },
  terminalTitle: { flex: 1, fontSize: 11, fontFamily: MONO },
  terminalTools: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  terminal: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
});
