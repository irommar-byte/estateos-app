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
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import type { AdminCoreMetrics } from '../contracts/adminCoreContract';
import type {
  CoreDiagnoseReport,
  CoreFinding,
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
  fetchCoreOpsLogs,
  fetchCoreProcesses,
  fetchCoreProduction,
  runCoreOptimize,
} from '../services/adminCoreOpsService';

type TabId = 'overview' | 'fleet' | 'logs' | 'prod' | 'repair';

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
  'kei-auto-import': { title: 'KEI auto-import', hint: 'cron' },
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
      muted: isDark ? '#636366' : '#9CA3AF',
      separator: isDark ? 'rgba(84,84,88,0.55)' : 'rgba(60,60,67,0.12)',
      input: isDark ? '#2C2C2E' : '#EEF0F3',
      contrast: isDark ? '#111111' : '#FFFFFF',
      primary: isDark ? '#F5F5F7' : '#111827',
      ok: '#059669',
      warn: '#D97706',
      crit: '#DC2626',
      logBg: isDark ? '#0B0B0C' : '#111827',
      logText: isDark ? '#D1D5DB' : '#E5E7EB',
    }),
    [isDark],
  );
}

function tone(level: string, colors: ReturnType<typeof useConsoleTheme>) {
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

function ScoreMark({ score, level }: { score: number; level: string }) {
  const colors = useConsoleTheme();
  const color = tone(level, colors);
  return (
    <View style={[styles.scoreMark, { borderColor: color }]}>
      <Text style={[styles.scoreValue, { color }]}>{score}</Text>
      <Text style={[styles.scoreDenom, { color: colors.muted }]}>/100</Text>
    </View>
  );
}

function StatusDot({ level }: { level: string }) {
  const colors = useConsoleTheme();
  return <View style={[styles.dot, { backgroundColor: tone(level, colors) }]} />;
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
  colors: ReturnType<typeof useConsoleTheme>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.segmentRow}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.id);
            }}
            style={[
              styles.segmentChip,
              { backgroundColor: active ? colors.primary : colors.input },
            ]}
          >
            <Text style={[styles.segmentLabel, { color: active ? colors.contrast : colors.secondary }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MetricCell({
  label,
  value,
  hint,
  colors,
}: {
  label: string;
  value: string;
  hint?: string;
  colors: ReturnType<typeof useConsoleTheme>;
}) {
  return (
    <View style={[styles.metricCell, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={[styles.metricHint, { color: colors.secondary }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
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

  const loadLogs = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    const data = await fetchCoreOpsLogs(token, { name: logApp, stream: logStream, lines: 250 });
    setLogText(data.logs);
    setLogAt(data.collectedAt || '');
    setLogError('');
  }, [getAdminToken, logApp, logStream]);

  const refreshAll = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setError('Brak sesji administratora.');
      return;
    }
    setError('');
    const results = await Promise.allSettled([
      loadDiagnose(),
      loadMetrics(),
      loadFleet(),
      loadProduction(),
      tab === 'logs' ? loadLogs() : Promise.resolve(),
    ]);
    const diagnoseFailed = results[0];
    if (diagnoseFailed.status === 'rejected') {
      const reason = diagnoseFailed.reason;
      setError(reason instanceof Error ? reason.message : 'Nie udało się odświeżyć CORE.');
    }
  }, [getAdminToken, loadDiagnose, loadFleet, loadLogs, loadMetrics, loadProduction, tab]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      const metricsTimer = setInterval(() => {
        void loadMetrics().catch(() => undefined);
      }, METRICS_MS);
      const diagnoseTimer = setInterval(() => {
        void Promise.all([loadDiagnose(), loadFleet(), loadProduction()]).catch(() => undefined);
      }, DIAGNOSE_MS);
      return () => {
        clearInterval(metricsTimer);
        clearInterval(diagnoseTimer);
      };
    }, [loadDiagnose, loadFleet, loadMetrics, loadProduction, refreshAll]),
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
  const score = report?.score ?? (report?.healthy ? 100 : 0);
  const level = report?.level || 'ok';
  const host = metrics?.host || 'nieruchomosci';
  const webOnline = processes.some((item) => item.name === WWW_NAME && item.status === 'online');
  const fleetOnline = processes.filter((item) => item.status === 'online').length;
  const fleetStopped = processes.filter((item) => item.status === 'stopped').length;

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
      'Przywrócić zdrowy stan?',
      'Usunie śmieci, przytnie logi, przerwie zacięte ffmpeg i przeładuje WWW. Strona zostaje online. Ofert i filmów nie rusza.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Przywróć', onPress: () => void runOptimize() },
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
    ]);
  };

  const logLines = useMemo(() => {
    const needle = logFilter.trim().toLowerCase();
    return logText
      .split('\n')
      .filter((line) => (needle ? line.toLowerCase().includes(needle) : true));
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.muted }]}>EstateOS™</Text>
          <Text style={[styles.title, { color: colors.text }]}>CORE</Text>
          <Text style={[styles.hostLine, { color: colors.secondary }]} numberOfLines={1}>
            {host}
          </Text>
        </View>
        <ScoreMark score={score} level={level} />
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <StatusDot level={webOnline ? 'ok' : 'critical'} />
          <Text style={[styles.statusText, { color: colors.secondary }]}>WWW</Text>
        </View>
        <View style={styles.statusItem}>
          <StatusDot level={mariadb?.up ? 'ok' : 'critical'} />
          <Text style={[styles.statusText, { color: colors.secondary }]}>MariaDB</Text>
        </View>
        <View style={styles.statusItem}>
          <StatusDot level={production?.inSync ? 'ok' : 'warning'} />
          <Text style={[styles.statusText, { color: colors.secondary }]}>
            {production?.inSync ? 'Commit zgodny' : 'Dryf commita'}
          </Text>
        </View>
        <Pressable onPress={onRefresh} hitSlop={8} disabled={refreshing || optimizing}>
          <Ionicons name="refresh" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <SegmentBar
        value={tab}
        onChange={setTab}
        colors={colors}
        options={[
          { id: 'overview', label: 'Przegląd' },
          { id: 'fleet', label: 'Flota' },
          { id: 'logs', label: 'Logi' },
          { id: 'prod', label: 'Produkcja' },
          { id: 'repair', label: 'Naprawa' },
        ]}
      />

      {error ? (
        <View style={[styles.errorBox, { borderColor: `${colors.crit}33`, backgroundColor: `${colors.crit}12` }]}>
          <Text style={[styles.errorText, { color: colors.crit }]}>{error}</Text>
        </View>
      ) : null}

      {tab === 'logs' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appChips}>
            {CORE_LOG_APP_NAMES.map((name) => {
              const active = name === logApp;
              return (
                <Pressable
                  key={name}
                  onPress={() => {
                    setLogApp(name);
                    setLogPaused(false);
                  }}
                  style={[styles.miniChip, { backgroundColor: active ? colors.primary : colors.input }]}
                >
                  <Text style={{ color: active ? colors.contrast : colors.secondary, fontSize: 11, fontWeight: '600' }}>
                    {processTitle(name)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.logToolbar}>
            {(['both', 'out', 'error'] as CoreLogStream[]).map((stream) => {
              const active = stream === logStream;
              const label = stream === 'both' ? 'Oba' : stream === 'out' ? 'Out' : 'Err';
              return (
                <Pressable
                  key={stream}
                  onPress={() => setLogStream(stream)}
                  style={[styles.miniChip, { backgroundColor: active ? colors.primary : colors.input }]}
                >
                  <Text style={{ color: active ? colors.contrast : colors.secondary, fontSize: 11, fontWeight: '600' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setLogPaused((prev) => !prev)}
              style={[styles.miniChip, { backgroundColor: colors.input }]}
            >
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>
                {logPaused ? 'Wznów' : 'Pauza'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 11, marginLeft: 'auto' }}>{formatClock(logAt)}</Text>
          </View>
          <TextInput
            value={logFilter}
            onChangeText={setLogFilter}
            placeholder="Filtruj linie"
            placeholderTextColor={colors.muted}
            style={[styles.filter, { backgroundColor: colors.input, color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={[styles.terminal, { backgroundColor: colors.logBg }]}>
            {logError ? (
              <Text style={{ color: colors.crit, fontFamily: MONO, fontSize: 12 }}>{logError}</Text>
            ) : !logText ? (
              <Text style={{ color: colors.muted, fontFamily: MONO, fontSize: 12 }}>Czekam na logi…</Text>
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
                      color: isErrorLine(line) ? '#FCA5A5' : colors.logText,
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
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        >
          {tab === 'overview' ? (
            <>
              <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
              <Text style={[styles.lede, { color: colors.secondary }]}>
                {optimizing
                  ? 'Czyszczę śmieci, przycinam logi i przeładowuję workery. Strona zostaje online.'
                  : report?.summary || 'Sprawdzam dysk, logi, PM2, bazę i tożsamość deployu.'}
              </Text>
              <View style={styles.metricGrid}>
                <MetricCell
                  label="Obciążenie"
                  value={`${Math.round(metrics?.cpu.percent || 0)}%`}
                  hint={`load ${metrics?.cpu.load1 ?? '—'} · ${metrics?.cpu.cores || 0} rdzenie`}
                  colors={colors}
                />
                <MetricCell
                  label="Pamięć"
                  value={`${Math.round(metrics?.memory.percent || 0)}%`}
                  hint={`${formatBytesShort(metrics?.memory.usedBytes || 0)} / ${formatBytesShort(metrics?.memory.totalBytes || 0)}`}
                  colors={colors}
                />
                <MetricCell
                  label="Dysk"
                  value={`${Math.round(metrics?.disk.percent || 0)}%`}
                  hint={`${formatBytesShort(metrics?.disk.usedBytes || 0)} / ${formatBytesShort(metrics?.disk.totalBytes || 0)}`}
                  colors={colors}
                />
                <MetricCell
                  label="Baza"
                  value={metrics?.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)} ms` : '—'}
                  hint={mariadb?.up ? 'MariaDB online' : 'MariaDB niedostępna'}
                  colors={colors}
                />
              </View>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Flota</Text>
                <Text style={[styles.cardBody, { color: colors.secondary }]}>
                  {fleetOnline} online · {fleetStopped} stopped · cron między runami to stan oczekiwany
                </Text>
                <Text style={[styles.mono, { color: colors.text, marginTop: 10 }]}>
                  {production?.git.sha || '—'}
                  {production?.inSync ? '  zgodny' : '  dryf względem procesu'}
                </Text>
              </View>
              {metrics?.app ? (
                <View style={styles.metricGrid}>
                  <MetricCell label="Oferty pending" value={String(metrics.app.offersPending ?? '—')} colors={colors} />
                  <MetricCell label="Aktywni 24h" value={String(metrics.app.activeUsers ?? '—')} colors={colors} />
                </View>
              ) : null}
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
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{processTitle('mariadb')}</Text>
                    <Text style={[styles.cardBody, { color: colors.secondary }]}>{processHint('mariadb')}</Text>
                  </View>
                  <View style={styles.row}>
                    <StatusDot level={mariadb?.up ? 'ok' : 'critical'} />
                    <Text style={[styles.statusText, { color: colors.text }]}>{mariadb?.up ? 'online' : mariadb?.status || '—'}</Text>
                  </View>
                </View>
                {!mariadb?.up ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => confirmProcess('mariadb', 'start')}
                    style={[styles.actionChip, { borderColor: colors.separator, marginTop: 10 }]}
                  >
                    <Text style={[styles.actionChipText, { color: colors.text }]}>Start</Text>
                  </Pressable>
                ) : null}
              </View>
              {processes.map((proc) => {
                const online = proc.status === 'online';
                const cronIdle = proc.kind === 'cron' && proc.status === 'stopped';
                return (
                  <View
                    key={`${proc.name}-${proc.id}-${proc.pid || 0}`}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}
                  >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{processTitle(proc.name)}</Text>
                        <Text style={[styles.cardBody, { color: colors.secondary }]}>
                          {processHint(proc.name)}
                          {proc.kind === 'cron' ? ' · cron' : ''}
                          {proc.id ? ` · #${proc.id}` : ''}
                        </Text>
                      </View>
                      <View style={styles.row}>
                        <StatusDot level={cronIdle ? 'ok' : proc.status} />
                        <Text style={[styles.statusText, { color: colors.text }]}>
                          {cronIdle ? 'oczekuje' : proc.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.mono, { color: colors.secondary, marginTop: 8 }]}>
                      CPU {Math.round(proc.cpu)}% · {formatBytesShort(proc.memoryBytes)} · {formatUptimeMs(proc.uptimeMs)} · rst {proc.restarts}
                      {proc.pid ? ` · pid ${proc.pid}` : ''}
                    </Text>
                    {cronIdle ? (
                      <Text style={[styles.cardHint, { color: colors.muted }]}>
                        Stopped między runami to normalny stan crona.
                      </Text>
                    ) : null}
                    <View style={styles.actionRow}>
                      {online ? (
                        <>
                          <Pressable
                            disabled={busy}
                            onPress={() => confirmProcess(proc.name, 'reload')}
                            style={[styles.actionChip, { borderColor: colors.separator }]}
                          >
                            <Text style={[styles.actionChipText, { color: colors.text }]}>Reload</Text>
                          </Pressable>
                          <Pressable
                            disabled={busy}
                            onPress={() => confirmProcess(proc.name, 'restart')}
                            style={[styles.actionChip, { borderColor: colors.separator }]}
                          >
                            <Text style={[styles.actionChipText, { color: colors.text }]}>Restart</Text>
                          </Pressable>
                          <Pressable
                            disabled={busy}
                            onPress={() => confirmProcess(proc.name, 'stop')}
                            style={[styles.actionChip, { borderColor: `${colors.crit}55` }]}
                          >
                            <Text style={[styles.actionChipText, { color: colors.crit }]}>Stop</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          disabled={busy}
                          onPress={() => confirmProcess(proc.name, 'start')}
                          style={[styles.actionChip, { borderColor: colors.separator }]}
                        >
                          <Text style={[styles.actionChipText, { color: colors.text }]}>Start</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}

          {tab === 'prod' ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {production?.inSync ? 'Deploy i proces są zgodne' : 'Proces WWW ma inny commit niż repo'}
                </Text>
                <Text style={[styles.cardBody, { color: colors.secondary }]}>
                  Kod na dysku może być nowy, a health czyta COMMIT_SHA z środowiska workera.
                </Text>
              </View>
              {[
                { label: 'Repozytorium', value: production?.git.sha || '—' },
                { label: 'Plik .env', value: production?.env.commitSha || '—' },
                { label: 'Proces WWW', value: production?.process.commitSha || '—' },
              ].map((row) => (
                <View key={row.label} style={[styles.shaRow, { borderColor: colors.separator, backgroundColor: colors.card }]}>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>{row.label}</Text>
                  <Text style={[styles.mono, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{production?.git.subject || 'Ostatni commit'}</Text>
                <Text style={[styles.cardBody, { color: colors.secondary }]}>{formatWhen(production?.git.committedAt)}</Text>
                <Text style={[styles.mono, { color: colors.secondary, marginTop: 10 }]}>
                  health {production?.health.status || '—'} · {production?.health.durationMs ?? '—'} ms · uptime {formatUptime(production?.health.uptimeSec || 0)}
                </Text>
              </View>
              {(production?.workers || []).map((worker) => (
                <View key={`w-${worker.id}`} style={[styles.shaRow, { borderColor: colors.separator, backgroundColor: colors.card }]}>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Worker #{worker.id}</Text>
                  <Text style={[styles.mono, { color: colors.text }]}>
                    {worker.status} · {formatBytesShort(worker.memoryBytes)} · {formatUptimeMs(worker.uptimeMs)}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {tab === 'repair' ? (
            <>
              <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
              <Text style={[styles.lede, { color: colors.secondary }]}>{report?.summary || 'Skan diagnostyczny.'}</Text>
              <Pressable
                onPress={confirmOptimize}
                disabled={optimizing || fixable.length === 0}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, opacity: optimizing || fixable.length === 0 ? 0.35 : 1 },
                ]}
              >
                {optimizing ? <ActivityIndicator color={colors.contrast} /> : null}
                <Text style={[styles.primaryBtnText, { color: colors.contrast }]}>Przywróć zdrowy stan</Text>
              </Pressable>
              {actions.length > 0 ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                  <Text style={[styles.cardTitle, { color: colors.ok }]}>Wykonane naprawy</Text>
                  {actions.map((action) => (
                    <Text key={action.id} style={[styles.cardBody, { color: colors.text, marginTop: 8 }]}>
                      {action.label} — {action.detail}
                      {action.freedBytes ? ` · ${formatBytesShort(action.freedBytes)}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
              {(report?.findings || []).length === 0 ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                  <Text style={[styles.cardBody, { color: colors.secondary }]}>
                    Brak śmieci, zaciętych procesów i rozjazdów wersji.
                  </Text>
                </View>
              ) : (
                (report?.findings || []).map((finding: CoreFinding) => (
                  <View key={finding.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                    <View style={styles.row}>
                      <StatusDot level={finding.severity === 'info' ? 'ok' : finding.severity} />
                      <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>{finding.title}</Text>
                    </View>
                    <Text style={[styles.cardBody, { color: colors.secondary }]}>{finding.detail}</Text>
                    {(finding.evidence || []).map((row) => (
                      <View key={`${finding.id}-${row.label}`} style={styles.evidenceRow}>
                        <Text style={[styles.metricLabel, { color: colors.muted, width: 110 }]}>{row.label}</Text>
                        <Text style={[styles.mono, { color: colors.text, flex: 1 }]}>{row.value}</Text>
                      </View>
                    ))}
                    <Text style={[styles.cardHint, { color: colors.muted }]}>
                      {finding.action || (finding.fixable ? 'Automatyczna' : 'Tylko podgląd')}
                    </Text>
                  </View>
                ))
              )}
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 4 },
  kicker: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  hostLine: { fontSize: 12, marginTop: 1 },
  scoreMark: {
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scoreDenom: { fontSize: 9, fontWeight: '600', letterSpacing: 0.6 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '500' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  segmentRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  segmentChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  errorBox: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 10 },
  errorText: { fontSize: 13, lineHeight: 18 },
  headline: { fontSize: 26, fontWeight: '600', letterSpacing: -0.6, lineHeight: 32 },
  lede: { fontSize: 15, lineHeight: 22 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCell: {
    width: '48%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  metricValue: { fontSize: 22, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  metricHint: { fontSize: 11, marginTop: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  cardHint: { fontSize: 12, marginTop: 8 },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  actionChipText: { fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
  shaRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4 },
  evidenceRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  appChips: { gap: 8, paddingVertical: 8 },
  miniChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  logToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filter: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 8 },
  terminal: { flex: 1, borderRadius: 16, padding: 12 },
});
