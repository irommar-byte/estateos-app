import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
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
  ADMIN_CORE_SERVER_CONTROL_ENABLED,
  controlAdminCoreServer,
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
import { fetchAdminCoreMonitor, type AdminCoreMonitor } from '../services/adminSimulatorService';
import {
  Gauge,
  Led,
  MACHINE,
  MONO,
  Panel,
  Reactor,
  Readout,
  Scope,
  SegmentMeter,
  healthColor,
  type Health,
  type LedMode,
} from '../components/coreConsole/MachineParts';

type TabId = 'overview' | 'fleet' | 'logs' | 'prod' | 'repair';
type CoreTraffic = 'offline' | 'loading' | 'online';
type LiveSeries = { cpu: number[]; mem: number[]; rpm: number[]; p95: number[]; db: number[]; loop: number[] };
type LedState = { color: string; mode: LedMode; period: number; state: string };

const BRAND_MARK = require('../../assets/icon.png');
const METRICS_MS = 4000;
const DIAGNOSE_MS = 15000;
const LOGS_MS = 2500;
const LIVE_POINTS = 60;
const WWW_NAME = 'nieruchomosci';
const WEB_WORKER_LIMIT_BYTES = 1024 ** 3;
const DB_LATENCY_SCALE_MS = 400;
const EMPTY_LIVE: LiveSeries = { cpu: [], mem: [], rpm: [], p95: [], db: [], loop: [] };

const PROCESS_META: Record<string, { title: string; hint: string }> = {
  nieruchomosci: { title: 'WWW', hint: 'estateos.pl · Next.js' },
  'lineage-movies-downloader': { title: 'Filmy · pobieranie', hint: 'yt-dlp / ffmpeg' },
  'lineage-movies-proxy': { title: 'Filmy · proxy', hint: 'stream' },
  'partner-growth-nurture': { title: 'Partner nurture', hint: 'cron' },
  'reviews-finalization-fallback': { title: 'Opinie · fallback', hint: 'cron' },
  'kei-import-worker': { title: 'KEI import', hint: 'dedykowany worker' },
  'estateos-core-guard': { title: 'CORE Guard', hint: 'monitoring 24/7' },
  'client-intelligence': { title: 'Client intelligence', hint: 'cron' },
  'client-weekly-digest': { title: 'Digest klientów', hint: 'cron · piątek' },
  'seller-marketing-renewals': { title: 'Marketing sprzedawcy', hint: 'cron' },
  'marketing-insights': { title: 'Marketing insights', hint: 'cron' },
  'import-source-lifecycle': { title: 'Cykl życia importu', hint: 'cron · noc' },
  'db-backup': { title: 'Kopia bazy', hint: 'cron · noc' },
  'rcn-market-ingest': { title: 'RCN ingest', hint: 'cron' },
  'galleryos-people': { title: 'GalleryOS · ludzie', hint: 'usługa GalleryOS' },
  mariadb: { title: 'MariaDB', hint: 'baza ofert' },
};

function processTitle(name: string) {
  return PROCESS_META[name]?.title || name;
}

function processHint(name: string) {
  return PROCESS_META[name]?.hint || '';
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

function formatCount(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pl-PL').format(value);
}

function formatLoad(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function isPrivateIp(ip?: string | null) {
  return Boolean(ip && /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
}

/** git / .env mają skrócony SHA, PM2 pełny — porównujemy prefiks. */
function sameSha(left?: string, right?: string) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  if (!a || !b || a === 'unknown' || b === 'unknown') return false;
  const n = Math.min(7, a.length, b.length);
  return n >= 7 && a.slice(0, n) === b.slice(0, n);
}

function pushSample(series: number[], value?: number | null) {
  if (value == null || !Number.isFinite(value)) return series;
  return [...series, value].slice(-LIVE_POINTS);
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

/** Dioda procesu: tempo mrugania rośnie z obciążeniem, cron czuwa złotym oddechem. */
function processLed(items: CorePm2Process[]): LedState {
  const online = items.filter((item) => item.status === 'online');
  if (!online.length) {
    if (items[0]?.kind === 'cron' && items.every((item) => item.status === 'stopped')) {
      return { color: MACHINE.gold, mode: 'breathe', period: 4200, state: 'czuwa do następnego uruchomienia' };
    }
    if (items.some((item) => item.status === 'launching')) {
      return { color: MACHINE.warn, mode: 'blink', period: 600, state: 'startuje' };
    }
    return { color: MACHINE.crit, mode: 'blink', period: 420, state: items.map((item) => item.status).join(' · ') || 'zatrzymany' };
  }
  const cpu = online.reduce((sum, item) => sum + (item.cpu || 0), 0) / online.length;
  if (cpu >= 40) return { color: MACHINE.ok, mode: 'blink', period: 360, state: 'pracuje intensywnie' };
  if (cpu >= 5) return { color: MACHINE.ok, mode: 'blink', period: 1100, state: 'pracuje' };
  return { color: MACHINE.ok, mode: 'breathe', period: 3200, state: 'spokojny' };
}

function percentColor(percent?: number | null) {
  if (percent == null) return MACHINE.muted;
  if (percent >= 90) return MACHINE.crit;
  if (percent >= 75) return MACHINE.warn;
  return MACHINE.ok;
}

function isErrorLine(line: string) {
  return /error|fatal|econnrefused|exception|unhandled|crash/i.test(line);
}

function KeyButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  variant = 'plain',
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'gold' | 'plain' | 'danger';
}) {
  const gold = variant === 'gold';
  const tint = gold ? '#111111' : variant === 'danger' ? MACHINE.crit : MACHINE.text;
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.keyBtn,
        gold ? styles.keyBtnGold : styles.keyBtnPlain,
        variant === 'danger' && { borderColor: 'rgba(255,77,77,0.35)' },
        { opacity: disabled ? 0.35 : pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={tint} /> : icon ? <Ionicons name={icon} size={14} color={tint} /> : null}
      <Text style={[styles.keyBtnText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

function SmallAction({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.smallAction, danger && { borderColor: 'rgba(255,77,77,0.3)' }, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.smallActionText, { color: danger ? MACHINE.crit : MACHINE.text }]}>{label}</Text>
    </Pressable>
  );
}

function MasterSwitch({
  status,
  busy,
  onOffline,
  onOnline,
}: {
  status: CoreTraffic;
  busy: boolean;
  onOffline: () => void;
  onOnline: () => void;
}) {
  const keys: Array<{ id: CoreTraffic; label: string; color: string; mode: LedMode; onPress?: () => void }> = [
    { id: 'offline', label: 'OFFLINE', color: MACHINE.crit, mode: 'steady', onPress: onOffline },
    { id: 'loading', label: 'ŁADOWANIE', color: MACHINE.warn, mode: 'blink' },
    { id: 'online', label: 'ONLINE', color: MACHINE.ok, mode: 'breathe', onPress: onOnline },
  ];
  return (
    <View style={styles.switchRow}>
      {keys.map((key) => {
        const active = status === key.id;
        return (
          <Pressable
            key={key.id}
            disabled={!key.onPress || busy || active}
            onPress={key.onPress}
            style={[styles.switchKey, active && { borderColor: `${key.color}66`, backgroundColor: `${key.color}14` }]}
          >
            <Led color={key.color} mode={active ? key.mode : 'off'} period={key.id === 'loading' ? 500 : 2600} size={6} />
            <Text style={[styles.switchLabel, { color: active ? key.color : MACHINE.muted }]}>{key.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabRail({ value, onChange }: { value: TabId; onChange: (id: TabId) => void }) {
  const options: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: 'overview', label: 'Pulpit', icon: 'speedometer-outline' },
    { id: 'fleet', label: 'Rack', icon: 'server-outline' },
    { id: 'logs', label: 'Logi', icon: 'terminal-outline' },
    { id: 'prod', label: 'Deploy', icon: 'git-commit-outline' },
    { id: 'repair', label: 'Naprawa', icon: 'construct-outline' },
  ];
  return (
    <View style={styles.tabRail}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.id);
            }}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Ionicons name={opt.icon} size={14} color={active ? MACHINE.gold : MACHINE.muted} />
            <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? MACHINE.text : MACHINE.muted }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatusChip({ label, led }: { label: string; led: { color: string; mode: LedMode; period?: number } }) {
  return (
    <View style={styles.statusChip}>
      <Led color={led.color} mode={led.mode} period={led.period} size={5} />
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

export default function AdminCoreConsoleScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
  const [monitor, setMonitor] = useState<AdminCoreMonitor | null>(null);
  const [panelOffline, setPanelOffline] = useState(false);
  const [serverCommand, setServerCommand] = useState<'idle' | 'starting' | 'stopping'>('idle');
  const [live, setLive] = useState<LiveSeries>(EMPTY_LIVE);
  const lastSampleAt = useRef('');

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

  const loadMonitor = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      setMonitor(await fetchAdminCoreMonitor(token));
      setPanelOffline(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/offline/i.test(message)) setPanelOffline(true);
    }
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
    const results = await Promise.allSettled([
      loadDiagnose(),
      loadMetrics(),
      loadFleet(),
      loadProduction(),
      loadGuard(),
      loadMonitor(),
    ]);
    const diagnoseFailed = results[0];
    if (diagnoseFailed.status === 'rejected') {
      const reason = diagnoseFailed.reason;
      setError(reason instanceof Error ? reason.message : 'Nie udało się odświeżyć CORE.');
    }
  }, [getAdminToken, loadDiagnose, loadFleet, loadGuard, loadMetrics, loadMonitor, loadProduction]);

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
        void Promise.all([loadDiagnose(), loadFleet(), loadProduction(), loadMonitor()]).catch(() => undefined);
      }, DIAGNOSE_MS);
      const guardTimer = setInterval(() => {
        void loadGuard().catch(() => undefined);
      }, 60_000);
      return () => {
        clearInterval(metricsTimer);
        clearInterval(diagnoseTimer);
        clearInterval(guardTimer);
      };
    }, [loadDiagnose, loadFleet, loadGuard, loadMetrics, loadMonitor, loadProduction, refreshChrome]),
  );

  useEffect(() => {
    if (!metrics || !metrics.live || metrics.collectedAt === lastSampleAt.current) return;
    lastSampleAt.current = metrics.collectedAt;
    setLive((prev) => ({
      cpu: pushSample(prev.cpu, metrics.cpu.percent),
      mem: pushSample(prev.mem, metrics.memory.percent),
      rpm: pushSample(prev.rpm, metrics.network?.requestsPerMin),
      p95: pushSample(prev.p95, metrics.network?.latencyP95Ms),
      db: pushSample(prev.db, metrics.database?.latencyMs),
      loop: pushSample(prev.loop, metrics.process?.eventLoopP95Ms),
    }));
  }, [metrics]);

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

  const findings = report?.findings || [];
  const pains = findings.filter((item) => item.severity !== 'info');
  const chores = findings.filter((item) => item.severity === 'info');
  const fixable = findings.filter((item) => item.fixable);
  const guardIncidents = guard?.incidents.filter((item) => item.status === 'open' && item.severity !== 'info') || [];
  const score = guard?.score ?? report?.score ?? null;
  const host = metrics?.host || 'nieruchomosci';
  const webOnline =
    processes.some((item) => item.name === WWW_NAME && item.status === 'online') ||
    (production?.workers || []).some((item) => item.status === 'online');
  const guardOnline = processes.some((item) => item.name === 'estateos-core-guard' && item.status === 'online');
  const daemons = groupByName(processes.filter((item) => item.kind !== 'cron'));
  const crons = groupByName(processes.filter((item) => item.kind === 'cron'));
  const fleetOnline = processes.filter((item) => item.status === 'online').length;
  const fleetWaiting = processes.filter((item) => item.kind === 'cron' && item.status === 'stopped').length;
  const controlBusy = busy || optimizing || serverCommand !== 'idle';
  const coreTraffic: CoreTraffic =
    serverCommand !== 'idle'
      ? 'loading'
      : panelOffline
        ? 'offline'
        : webOnline || Boolean(metrics?.live)
          ? 'online'
          : processes.length
            ? 'offline'
            : 'loading';

  const cores = Math.max(1, metrics?.cpu.cores || 1);
  const loadRatio = (metrics?.cpu.load1 ?? 0) / cores;
  const heartPeriod = Math.round(Math.max(600, Math.min(3000, 3000 - loadRatio * 1500)));
  const versionsInSync =
    Boolean(production) &&
    sameSha(production?.git.sha, production?.env.commitSha) &&
    sameSha(production?.git.sha, production?.process.commitSha);

  const health: Health = panelOffline
    ? 'idle'
    : (processes.length > 0 && !webOnline) ||
        mariadb?.up === false ||
        guard?.level === 'critical' ||
        pains.some((item) => item.severity === 'critical') ||
        guardIncidents.some((item) => item.severity === 'critical')
      ? 'critical'
      : pains.length || guardIncidents.length || loadRatio >= 1.5 || (metrics?.memory.percent ?? 0) >= 90
        ? 'warning'
        : 'ok';
  const heartColor = healthColor(health);
  const painCount = pains.length + guardIncidents.length;

  const headline = optimizing
    ? 'Przywracam zdrowy stan'
    : panelOffline
      ? 'Panel CORE jest wyłączony'
      : !report && !metrics
        ? 'Łączę z maszynownią'
        : health === 'critical'
          ? 'Awaria — wymagana interwencja'
          : painCount
            ? painCount === 1
              ? 'Serwer zgłasza 1 dolegliwość'
              : `Serwer zgłasza ${painCount} dolegliwości`
            : loadRatio >= 1.2
              ? 'Serwer pracuje pod obciążeniem'
              : loadRatio >= 0.6
                ? 'Serwer pracuje równym rytmem'
                : 'Serwer oddycha spokojnie';

  const vitalsLine = metrics
    ? `Load ${formatLoad(metrics.cpu.load1)} na ${cores} ${cores === 1 ? 'rdzeniu' : 'rdzeniach'} · RAM ${Math.round(metrics.memory.percent)}% · baza ${
        metrics.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)} ms` : '—'
      }`
    : 'Czekam na pierwszy pomiar.';

  const day = useMemo(() => {
    const rows = guard?.history || [];
    const num = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      cpu: rows.map((row) => num(row.cpuPercent)),
      rpm: rows.map((row) => num(row.requestsPerMin)),
      rss: rows.map((row) => num(row.webRssBytes) / 1024 ** 2),
      p95: rows.map((row) => num(row.latencyP95Ms)),
      from: typeof rows[0]?.collectedAt === 'string' ? (rows[0].collectedAt as string) : '',
    };
  }, [guard]);

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

  const turnCoreOffline = () => {
    const token = getAdminToken();
    if (!token || !ADMIN_CORE_SERVER_CONTROL_ENABLED) return;
    Alert.alert(
      'Przełączyć CORE w OFFLINE?',
      'Wyłącza metryki i monitor w konsoli. PM2 i estateos.pl zostają online — to nie jest stop produkcji.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'OFFLINE',
          style: 'destructive',
          onPress: () => {
            setServerCommand('stopping');
            void controlAdminCoreServer(token, 'stop')
              .then(() => {
                setPanelOffline(true);
                setMetrics(null);
                setMonitor(null);
                setLive(EMPTY_LIVE);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              })
              .catch((err) => {
                setPanelOffline(false);
                setError(err instanceof Error ? err.message : 'Nie udało się wyłączyć panelu CORE.');
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              })
              .finally(() => setServerCommand('idle'));
          },
        },
      ],
    );
  };

  const turnCoreOnline = () => {
    const token = getAdminToken();
    if (!token || !ADMIN_CORE_SERVER_CONTROL_ENABLED || controlBusy) return;
    setServerCommand('starting');
    setError('');
    void (async () => {
      try {
        await controlAdminCoreServer(token, 'start');
        for (let i = 0; i < 12; i += 1) {
          try {
            await Promise.all([loadMetrics(), loadMonitor(), loadFleet()]);
            setPanelOffline(false);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        }
        setError('CORE nie wrócił online — sprawdź logi WWW.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się włączyć CORE.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setServerCommand('idle');
      }
    })();
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

  const runRunbook = (runbookId: string, targetId: string, title: string, detail: string) => {
    Alert.alert(title, `${detail}\n\nCORE wykona wyłącznie przypisany, dozwolony runbook i zapisze wynik w historii audytu.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wykonaj',
        onPress: () => {
          const token = getAdminToken();
          if (!token) return;
          setBusy(true);
          void runCoreGuardAction(token, runbookId, targetId)
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
    ]);
  };

  const confirmFindingAction = (finding: CoreFinding) => {
    if (finding.runbookId) runRunbook(finding.runbookId, finding.id, finding.title, finding.detail);
  };

  const confirmGuardAction = (incident: CoreGuardIncident) => {
    if (incident.recommendedAction) runRunbook(incident.recommendedAction, incident.id, incident.title, incident.detail);
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
              { text: 'Zatrzymaj WWW', style: 'destructive', onPress: () => void runProcess(name, action) },
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

  const rackModules = [
    ...(mariadb
      ? [
          {
            key: 'mariadb',
            title: 'MariaDB',
            meta: mariadb.up ? `${metrics?.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)} ms` : 'online'}` : mariadb.status,
            led: mariadb.up
              ? { color: MACHINE.db, mode: 'breathe' as LedMode, period: 2600 }
              : { color: MACHINE.crit, mode: 'blink' as LedMode, period: 420 },
          },
        ]
      : []),
    ...[...daemons, ...crons].map(([name, items]) => {
      const led = processLed(items);
      const online = items.filter((item) => item.status === 'online');
      const cpu = online.reduce((sum, item) => sum + (item.cpu || 0), 0);
      const rss = online.reduce((sum, item) => sum + (item.memoryBytes || 0), 0);
      return {
        key: name,
        title: processTitle(name),
        meta: online.length ? `${Math.round(cpu)}% · ${formatBytesShort(rss)}${items.length > 1 ? ` · ×${items.length}` : ''}` : 'czuwa',
        led,
      };
    }),
  ];

  const renderPain = (key: string, level: string, title: string, detail: string, action: React.ReactNode, last: boolean) => (
    <View key={key} style={[styles.painRow, !last && styles.rowDivider]}>
      <Led color={healthColor(level)} mode="blink" period={level === 'critical' ? 380 : 1300} size={7} />
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={3}>
          {detail}
        </Text>
      </View>
      {action}
    </View>
  );

  const renderRackUnit = (name: string, items: CorePm2Process[], last: boolean) => {
    const led = processLed(items);
    const online = items.filter((item) => item.status === 'online');
    const cronIdle = items[0]?.kind === 'cron' && !online.length;
    const cpu = online.reduce((sum, item) => sum + (item.cpu || 0), 0);
    const rss = online.reduce((sum, item) => sum + (item.memoryBytes || 0), 0);
    const uptime = online.reduce((max, item) => Math.max(max, item.uptimeMs || 0), 0);
    const restarts = items.reduce((sum, item) => sum + (item.restarts || 0), 0);
    const schedule = items.find((item) => item.cronRestart)?.cronRestart;
    return (
      <View key={name} style={[styles.rackUnit, !last && styles.rowDivider]}>
        <View style={styles.rackHead}>
          <Led color={led.color} mode={led.mode} period={led.period} size={8} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {processTitle(name)}
              {items.length > 1 ? <Text style={styles.rackCount}>{`  ×${items.length}`}</Text> : null}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {[processHint(name), led.state].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.rackActions}>
            {online.length ? (
              <>
                <SmallAction label="Reload" disabled={busy} onPress={() => confirmProcess(name, 'reload')} />
                <SmallAction label="Stop" danger disabled={busy} onPress={() => confirmProcess(name, 'stop')} />
              </>
            ) : (
              <SmallAction label="Start" disabled={busy} onPress={() => confirmProcess(name, 'start')} />
            )}
          </View>
        </View>
        {cronIdle ? (
          <Text style={[styles.mono, styles.rackSchedule]}>{schedule ? `harmonogram ${schedule}` : 'uruchamiany według harmonogramu'}</Text>
        ) : (
          <View style={styles.rackGauges}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rackGaugeLabel}>CPU {Math.round(cpu)}%</Text>
              <SegmentMeter percent={Math.min(100, cpu / Math.max(1, online.length))} color={MACHINE.ok} segments={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rackGaugeLabel}>RAM {formatBytesShort(rss)}</Text>
              <SegmentMeter
                percent={name === WWW_NAME ? (rss / Math.max(1, online.length) / WEB_WORKER_LIMIT_BYTES) * 100 : (rss / (metrics?.memory.totalBytes || rss || 1)) * 100}
                color={MACHINE.flow}
                segments={20}
              />
            </View>
            <View style={styles.rackStats}>
              <Text style={styles.rackStat}>up {formatUptimeMs(uptime)}</Text>
              <Text style={[styles.rackStat, restarts > 0 && { color: MACHINE.warn }]}>↻ {restarts}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={MACHINE.text} />
        </Pressable>
        <Image source={BRAND_MARK} style={styles.brandLogo} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>EstateOS™</Text>
            <View style={styles.coreBadge}>
              <Text style={styles.coreBadgeText}>CORE</Text>
            </View>
            <Text style={styles.brandSub} numberOfLines={1}>
              maszynownia · {host}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusStrip}>
            <StatusChip
              label={panelOffline ? 'panel offline' : webOnline ? 'WWW live' : 'WWW offline'}
              led={
                panelOffline
                  ? { color: MACHINE.warn, mode: 'breathe', period: 2400 }
                  : webOnline
                    ? { color: MACHINE.ok, mode: 'breathe', period: heartPeriod }
                    : { color: MACHINE.crit, mode: 'blink', period: 400 }
              }
            />
            <StatusChip
              label={mariadb?.up === false ? 'MariaDB down' : 'MariaDB'}
              led={mariadb?.up === false ? { color: MACHINE.crit, mode: 'blink', period: 400 } : { color: MACHINE.db, mode: 'breathe', period: 2600 }}
            />
            <StatusChip
              label="Guard"
              led={guardOnline ? { color: MACHINE.gold, mode: 'blink', period: 2000 } : { color: MACHINE.crit, mode: 'blink', period: 500 }}
            />
            <StatusChip
              label={versionsInSync ? production?.git.sha || 'kod' : 'wersje się różnią'}
              led={versionsInSync ? { color: MACHINE.ok, mode: 'steady' } : { color: MACHINE.warn, mode: 'breathe', period: 1800 }}
            />
          </ScrollView>
        </View>
        <Pressable onPress={onRefresh} hitSlop={8} disabled={refreshing || optimizing} style={styles.iconBtn}>
          <Ionicons name="refresh" size={17} color={MACHINE.secondary} />
        </Pressable>
      </View>

      <MasterSwitch status={coreTraffic} busy={controlBusy} onOffline={turnCoreOffline} onOnline={turnCoreOnline} />
      <TabRail value={tab} onChange={setTab} />

      {error ? (
        <View style={styles.errorBox}>
          <Led color={MACHINE.crit} mode="blink" period={500} size={6} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {tab === 'logs' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: insets.bottom + 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.logApps}>
            {CORE_LOG_APP_NAMES.map((name) => {
              const active = name === logApp;
              const items = processes.filter((item) => item.name === name);
              const led = items.length ? processLed(items) : null;
              return (
                <Pressable
                  key={name}
                  onPress={() => {
                    setLogApp(name);
                    setLogPaused(false);
                  }}
                  style={[styles.logApp, active && styles.logAppActive]}
                >
                  {led ? <Led color={led.color} mode={active ? led.mode : 'steady'} period={led.period} size={5} /> : null}
                  <Text numberOfLines={1} style={[styles.logAppText, { color: active ? MACHINE.text : MACHINE.secondary }]}>
                    {processTitle(name)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.terminal}>
            <View style={styles.terminalBar}>
              <Led color={logPaused ? MACHINE.warn : MACHINE.ok} mode={logPaused ? 'steady' : 'blink'} period={LOGS_MS} size={5} />
              <Text style={styles.terminalTitle} numberOfLines={1}>
                {processTitle(logApp)} · {logStream === 'both' ? 'out+err' : logStream} · {logPaused ? 'pauza' : 'na żywo'}
              </Text>
              <View style={styles.terminalTools}>
                {(['both', 'out', 'error'] as CoreLogStream[]).map((stream) => (
                  <Pressable key={stream} onPress={() => setLogStream(stream)} hitSlop={6}>
                    <Text style={[styles.terminalTool, stream === logStream && { color: MACHINE.gold }]}>
                      {stream === 'both' ? 'Oba' : stream === 'out' ? 'Out' : 'Err'}
                    </Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setLogPaused((prev) => !prev)} hitSlop={6}>
                  <Text style={styles.terminalTool}>{logPaused ? 'Wznów' : 'Pauza'}</Text>
                </Pressable>
                <Text style={[styles.terminalTool, { fontFamily: MONO }]}>{formatClock(logAt)}</Text>
              </View>
            </View>
            <TextInput
              value={logFilter}
              onChangeText={setLogFilter}
              placeholder="Filtruj linie"
              placeholderTextColor={MACHINE.muted}
              style={styles.filter}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.terminalBody}>
              {logError ? (
                <Text style={[styles.logLine, { color: MACHINE.crit }]}>{logError}</Text>
              ) : !logText ? (
                <Text style={[styles.logLine, { color: MACHINE.muted }]}>Czekam na logi…</Text>
              ) : (
                <ScrollView
                  ref={logScroll}
                  onContentSizeChange={() => {
                    if (!logPaused) logScroll.current?.scrollToEnd({ animated: false });
                  }}
                >
                  {logLines.map((line, index) => (
                    <Text key={`${index}-${line.slice(0, 24)}`} style={[styles.logLine, isErrorLine(line) && { color: '#FF8A80' }]}>
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 36 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MACHINE.gold} />}
        >
          {tab === 'overview' ? (
            <>
              <Panel>
                <View style={styles.heroRow}>
                  <Reactor score={score} color={heartColor} periodMs={heartPeriod} caption="ZDROWIE" />
                  <View style={styles.heroText}>
                    <Text style={styles.kicker}>STAN MASZYNY</Text>
                    <Text style={styles.headline}>{headline}</Text>
                    <Text style={styles.lede}>
                      {optimizing
                        ? 'Wykonuję zatwierdzony, bezpieczny podzbiór napraw.'
                        : panelOffline
                          ? 'Metryki są wstrzymane. WWW i baza mogą działać — przełącz na ONLINE, żeby wrócić do pulpitu.'
                          : vitalsLine}
                    </Text>
                    <View style={styles.heroReadouts}>
                      <Readout label="Uptime" value={formatUptime(monitor?.osUptimeSec || metrics?.uptimeSec || 0)} />
                      <Readout
                        label="Flota"
                        value={`${fleetOnline}/${fleetOnline + fleetWaiting}`}
                        hint={`${fleetWaiting} czuwa`}
                        led={{ color: MACHINE.ok, mode: 'breathe', period: 2400 }}
                      />
                    </View>
                  </View>
                </View>
              </Panel>

              <Panel title="Czym oddycha" right={<Text style={styles.panelNote}>na żywo · co {METRICS_MS / 1000} s</Text>}>
                <View style={styles.gaugeGrid}>
                  <View style={styles.gaugeCell}>
                    <Gauge
                      percent={metrics?.cpu.percent ?? null}
                      value={metrics ? `${Math.round(metrics.cpu.percent)}` : '—'}
                      unit="%"
                      label="PROCESOR"
                      hint={`load ${formatLoad(metrics?.cpu.load1)} · ${cores} rdz.`}
                      color={percentColor(metrics?.cpu.percent)}
                    />
                    <Scope data={live.cpu} color={percentColor(metrics?.cpu.percent)} height={38} max={100} />
                  </View>
                  <View style={styles.gaugeCell}>
                    <Gauge
                      percent={metrics?.memory.percent ?? null}
                      value={metrics ? `${Math.round(metrics.memory.percent)}` : '—'}
                      unit="%"
                      label="PAMIĘĆ"
                      hint={metrics ? `${formatBytesShort(metrics.memory.usedBytes)} / ${formatBytesShort(metrics.memory.totalBytes)}` : undefined}
                      color={percentColor(metrics?.memory.percent)}
                    />
                    <Scope data={live.mem} color={percentColor(metrics?.memory.percent)} height={38} max={100} />
                  </View>
                  <View style={styles.gaugeCell}>
                    <Gauge
                      percent={metrics?.disk.percent ?? null}
                      value={metrics ? `${Math.round(metrics.disk.percent)}` : '—'}
                      unit="%"
                      label="DYSK"
                      hint={metrics ? `${formatBytesShort(metrics.disk.usedBytes)} / ${formatBytesShort(metrics.disk.totalBytes)}` : undefined}
                      color={percentColor(metrics?.disk.percent)}
                    />
                    <View style={styles.gaugeFoot}>
                      <SegmentMeter percent={metrics?.disk.percent || 0} color={MACHINE.ok} segments={18} />
                    </View>
                  </View>
                  <View style={styles.gaugeCell}>
                    <Gauge
                      percent={metrics?.database?.latencyMs != null ? (metrics.database.latencyMs / DB_LATENCY_SCALE_MS) * 100 : null}
                      value={metrics?.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)}` : '—'}
                      unit="ms"
                      label="BAZA"
                      hint={
                        metrics?.database
                          ? `pula ${metrics.database.poolActive}/${metrics.database.poolMax}`
                          : mariadb?.up
                            ? 'MariaDB online'
                            : undefined
                      }
                      color={mariadb?.up === false ? MACHINE.crit : MACHINE.db}
                    />
                    <Scope data={live.db} color={MACHINE.db} height={38} />
                  </View>
                </View>
              </Panel>

              <Panel
                title="Krwiobieg · ruch"
                right={<Led color={MACHINE.flow} mode="blink" period={Math.max(300, 60000 / Math.max(1, metrics?.network?.requestsPerMin || 1))} size={5} />}
              >
                <Scope data={live.rpm} color={MACHINE.flow} height={96} />
                <View style={styles.readoutRow}>
                  <Readout label="Żądania / min" value={formatCount(metrics?.network?.requestsPerMin)} color={MACHINE.flow} />
                  <Readout
                    label="p95"
                    value={metrics?.network?.latencyP95Ms != null ? `${Math.round(metrics.network.latencyP95Ms)} ms` : '—'}
                  />
                  <Readout label="Połączenia" value={formatCount(metrics?.network?.activeConnections)} />
                </View>
                <View style={styles.readoutRow}>
                  <Readout
                    label="Błędy 5xx"
                    value={formatCount(metrics?.network?.status5xx)}
                    color={(metrics?.network?.status5xx || 0) > 0 ? MACHINE.crit : MACHINE.text}
                    led={(metrics?.network?.status5xx || 0) > 0 ? { color: MACHINE.crit, mode: 'blink', period: 500 } : undefined}
                  />
                  <Readout label="Odrzuty 499" value={formatCount(metrics?.network?.status499)} />
                  <Readout
                    label="Pętla zdarzeń"
                    value={metrics?.process?.eventLoopP95Ms != null ? `${Math.round(metrics.process.eventLoopP95Ms)} ms` : '—'}
                    hint={metrics?.process ? `RSS ${formatBytesShort(metrics.process.rssBytes)}` : undefined}
                  />
                </View>
              </Panel>

              <Panel
                title="Co go boli"
                right={
                  painCount ? (
                    <Text style={[styles.panelNote, { color: healthColor(health) }]}>{painCount} do uwagi</Text>
                  ) : null
                }
                padded={false}
              >
                {painCount === 0 ? (
                  <View style={styles.calmRow}>
                    <Led color={MACHINE.ok} mode="breathe" period={3200} size={8} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>Nic nie boli</Text>
                      <Text style={styles.rowMeta}>
                        {guardOnline ? 'CORE Guard czuwa co minutę, brak aktywnych incydentów.' : 'Brak zgłoszeń, ale CORE Guard nie jest online.'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    {guardIncidents.map((incident, index) =>
                      renderPain(
                        `g-${incident.id}`,
                        incident.severity,
                        incident.title,
                        incident.detail,
                        incident.recommendedAction ? (
                          <SmallAction label="Napraw" disabled={busy} onPress={() => confirmGuardAction(incident)} />
                        ) : null,
                        index === guardIncidents.length - 1 && pains.length === 0,
                      ),
                    )}
                    {pains.map((finding, index) =>
                      renderPain(
                        `f-${finding.id}`,
                        finding.severity,
                        finding.title,
                        finding.detail,
                        finding.runbookId ? (
                          <SmallAction label={finding.action || 'Napraw'} disabled={busy || optimizing} onPress={() => confirmFindingAction(finding)} />
                        ) : null,
                        index === pains.length - 1,
                      ),
                    )}
                  </>
                )}
                {chores.length ? (
                  <View style={[styles.choreRow, styles.rowDividerTop]}>
                    <Led color={MACHINE.gold} mode="breathe" period={3600} size={6} />
                    <Text style={[styles.rowMeta, { flex: 1, marginTop: 0 }]} numberOfLines={2}>
                      Kosmetyka: {chores.map((item) => item.title.toLowerCase()).join(', ')}
                    </Text>
                    <SmallAction label="Sprzątnij" disabled={optimizing || fixable.length === 0} onPress={confirmOptimize} />
                  </View>
                ) : null}
              </Panel>

              <Panel
                title="Rack · procesy"
                right={
                  <Pressable onPress={() => setTab('fleet')} hitSlop={8}>
                    <Text style={[styles.panelNote, { color: MACHINE.gold }]}>sterowanie ›</Text>
                  </Pressable>
                }
              >
                <View style={styles.moduleGrid}>
                  {rackModules.map((module) => (
                    <Pressable key={module.key} onPress={() => setTab('fleet')} style={styles.module}>
                      <Led color={module.led.color} mode={module.led.mode} period={module.led.period} size={6} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.moduleTitle} numberOfLines={1}>
                          {module.title}
                        </Text>
                        <Text style={styles.moduleMeta} numberOfLines={1}>
                          {module.meta}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </Panel>

              <Panel title="Doba · zapis CORE Guard" right={<Text style={styles.panelNote}>{day.from ? `od ${formatWhen(day.from)}` : 'brak próbek'}</Text>}>
                <Text style={styles.traceLabel}>PROCESOR %</Text>
                <Scope data={day.cpu} color={MACHINE.ok} height={52} max={100} live={false} />
                <Text style={styles.traceLabel}>RUCH · ŻĄDANIA / MIN</Text>
                <Scope data={day.rpm} color={MACHINE.flow} height={52} live={false} />
                <Text style={styles.traceLabel}>PAMIĘĆ WWW · MB</Text>
                <Scope data={day.rss} color={MACHINE.gold} height={52} max={1024} live={false} />
                <Text style={styles.traceLabel}>OPÓŹNIENIE p95 · MS</Text>
                <Scope data={day.p95} color={MACHINE.db} height={52} live={false} />
              </Panel>

              <Panel title="Biznes · produkcja SaaS">
                <View style={styles.readoutRow}>
                  <Readout label="Wizyty 24h" value={formatCount(monitor?.visits24h)} hint={`${formatCount(monitor?.uniqueIps24h)} unikalnych IP`} />
                  <Readout
                    label="Użytkownicy"
                    value={formatCount(monitor?.users)}
                    hint={`${formatCount(monitor?.activeUsers24h ?? metrics?.app?.activeUsers)} aktywnych 24h`}
                  />
                </View>
                <View style={styles.readoutRow}>
                  <Readout
                    label="Oferty"
                    value={formatCount(monitor?.activeOffers)}
                    hint={`oczekujące ${formatCount(monitor?.pendingOffers ?? metrics?.app?.offersPending)}`}
                  />
                  <Readout
                    label={isPrivateIp(monitor?.publicIp) ? 'Adres w sieci' : 'IP publiczne'}
                    value={monitor?.publicIp || '—'}
                    hint={isPrivateIp(monitor?.publicIp) ? 'za NAT · adres lokalny' : `odsłony ${formatCount(monitor?.pageViews)}`}
                  />
                </View>
              </Panel>

              <View style={styles.actionRow}>
                <KeyButton
                  label="Reload WWW"
                  icon="sync-outline"
                  disabled={controlBusy || !webOnline}
                  onPress={() => confirmProcess(WWW_NAME, 'reload')}
                />
                <KeyButton
                  label="Przywróć zdrowy stan"
                  icon="shield-checkmark-outline"
                  variant="gold"
                  disabled={fixable.length === 0}
                  busy={optimizing}
                  onPress={confirmOptimize}
                />
              </View>
            </>
          ) : null}

          {tab === 'fleet' ? (
            <>
              <Panel title="Usługi stałe" padded={false}>
                <View style={[styles.rackUnit, styles.rowDivider]}>
                  <View style={styles.rackHead}>
                    <Led
                      color={mariadb?.up ? MACHINE.db : MACHINE.crit}
                      mode={mariadb?.up ? 'breathe' : 'blink'}
                      period={mariadb?.up ? 2600 : 420}
                      size={8}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>MariaDB</Text>
                      <Text style={styles.rowMeta}>
                        {mariadb?.up
                          ? `baza ofert · ${metrics?.database?.latencyMs != null ? `${Math.round(metrics.database.latencyMs)} ms` : 'online'}`
                          : mariadb?.status || '—'}
                      </Text>
                    </View>
                    {mariadb && !mariadb.up ? (
                      <SmallAction label="Start" disabled={busy} onPress={() => confirmProcess('mariadb', 'start')} />
                    ) : null}
                  </View>
                </View>
                {daemons.map(([name, items], index) => renderRackUnit(name, items, index === daemons.length - 1))}
              </Panel>
              <Panel title="Harmonogram · zadania cykliczne" right={<Text style={styles.panelNote}>zatrzymane między runami = OK</Text>} padded={false}>
                {crons.length ? (
                  crons.map(([name, items], index) => renderRackUnit(name, items, index === crons.length - 1))
                ) : (
                  <Text style={[styles.rowMeta, { padding: 16 }]}>Brak zadań cyklicznych.</Text>
                )}
              </Panel>
            </>
          ) : null}

          {tab === 'prod' ? (
            <>
              <Panel>
                <Text style={styles.kicker}>WERSJA NA PRODUKCJI</Text>
                <Text style={styles.headline}>{versionsInSync ? 'Kod, konfiguracja i proces są zgodne' : 'Wersje się rozjechały'}</Text>
                <Text style={styles.lede}>
                  {versionsInSync
                    ? 'Workery WWW działają na tym samym commicie, który leży na dysku i w .env.'
                    : 'Proces WWW działa na innym commicie niż repozytorium. Przeładuj workery albo wykonaj deploy.'}
                </Text>
              </Panel>
              <Panel title="Łańcuch wersji" padded={false}>
                {[
                  { label: 'Repozytorium', value: production?.git.sha },
                  { label: 'Plik .env', value: production?.env.commitSha },
                  { label: 'Proces WWW', value: production?.process.commitSha },
                ].map((row, index, arr) => {
                  const ok = sameSha(production?.git.sha, row.value);
                  return (
                    <View key={row.label} style={[styles.chainRow, index < arr.length - 1 && styles.rowDivider]}>
                      <Led color={ok ? MACHINE.ok : MACHINE.warn} mode={ok ? 'steady' : 'blink'} period={1200} size={6} />
                      <Text style={[styles.rowMeta, { flex: 1, marginTop: 0 }]}>{row.label}</Text>
                      <Text style={styles.mono}>{row.value ? row.value.slice(0, 9) : '—'}</Text>
                    </View>
                  );
                })}
              </Panel>
              <Panel title="Ostatni commit">
                <Text style={styles.rowTitle}>{production?.git.subject || '—'}</Text>
                <Text style={styles.rowMeta}>{formatWhen(production?.git.committedAt)}</Text>
                <View style={[styles.readoutRow, { marginTop: 14 }]}>
                  <Readout
                    label="Health"
                    value={production?.health.status || '—'}
                    led={production?.health.ok ? { color: MACHINE.ok, mode: 'breathe', period: 2000 } : { color: MACHINE.crit, mode: 'blink', period: 450 }}
                  />
                  <Readout label="Odpowiedź" value={production?.health.durationMs != null ? `${production.health.durationMs} ms` : '—'} />
                  <Readout label="Proces up" value={formatUptime(production?.health.uptimeSec || 0)} />
                </View>
              </Panel>
              {(production?.workers || []).length ? (
                <Panel title="Workery WWW · limit 1 GiB" padded={false}>
                  {(production?.workers || []).map((worker, index, arr) => {
                    const percent = (worker.memoryBytes / WEB_WORKER_LIMIT_BYTES) * 100;
                    return (
                      <View key={`w-${worker.id}`} style={[styles.rackUnit, index < arr.length - 1 && styles.rowDivider]}>
                        <View style={styles.rackHead}>
                          <Led
                            color={healthColor(worker.status)}
                            mode="blink"
                            period={worker.status === 'online' ? Math.max(360, 1400 - worker.cpu * 15) : 420}
                            size={7}
                          />
                          <Text style={[styles.rowTitle, { flex: 1 }]}>Worker #{worker.id}</Text>
                          <Text style={styles.mono}>
                            {formatBytesShort(worker.memoryBytes)} · {Math.round(worker.cpu)}% · {formatUptimeMs(worker.uptimeMs)}
                          </Text>
                        </View>
                        <View style={{ marginTop: 10 }}>
                          <SegmentMeter percent={percent} color={MACHINE.flow} segments={32} />
                        </View>
                      </View>
                    );
                  })}
                </Panel>
              ) : null}
            </>
          ) : null}

          {tab === 'repair' ? (
            <>
              <Panel>
                <Text style={styles.kicker}>DIAGNOSTYKA</Text>
                <Text style={styles.headline}>{headline}</Text>
                <Text style={styles.lede}>{report?.summary || 'Skan diagnostyczny.'}</Text>
                <View style={[styles.actionRow, { marginTop: 16, marginBottom: 0 }]}>
                  <KeyButton
                    label="Przywróć zdrowy stan"
                    icon="shield-checkmark-outline"
                    variant="gold"
                    disabled={fixable.length === 0}
                    busy={optimizing}
                    onPress={confirmOptimize}
                  />
                </View>
              </Panel>
              {actions.length > 0 ? (
                <Panel title="Wykonane" padded={false}>
                  {actions.map((action, index) => (
                    <View key={action.id} style={[styles.chainRow, index < actions.length - 1 && styles.rowDivider]}>
                      <Led color={MACHINE.ok} mode="steady" size={6} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{action.label}</Text>
                        <Text style={styles.rowMeta}>
                          {action.detail}
                          {action.freedBytes ? ` · ${formatBytesShort(action.freedBytes)}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Panel>
              ) : null}
              <Panel title="Znaleziska" padded={false}>
                {findings.length === 0 ? (
                  <View style={styles.calmRow}>
                    <Led color={MACHINE.ok} mode="breathe" period={3200} size={7} />
                    <Text style={[styles.rowMeta, { flex: 1, marginTop: 0 }]}>Brak śmieci, zaciętych procesów i rozjazdów wersji.</Text>
                  </View>
                ) : (
                  findings.map((finding, index) => (
                    <View key={finding.id} style={[styles.findingRow, index < findings.length - 1 && styles.rowDivider]}>
                      <View style={styles.findingHead}>
                        <Led
                          color={finding.severity === 'info' ? MACHINE.gold : healthColor(finding.severity)}
                          mode={finding.severity === 'info' ? 'breathe' : 'blink'}
                          period={finding.severity === 'critical' ? 380 : finding.severity === 'warning' ? 1300 : 3600}
                          size={7}
                        />
                        <Text style={[styles.rowTitle, { flex: 1 }]}>{finding.title}</Text>
                      </View>
                      <Text style={[styles.rowMeta, { marginTop: 6 }]}>{finding.detail}</Text>
                      {(finding.evidence || []).map((row) => (
                        <View key={`${finding.id}-${row.label}`} style={styles.evidenceRow}>
                          <Text style={styles.evidenceLabel}>{row.label}</Text>
                          <Text style={[styles.mono, { flex: 1 }]}>{row.value}</Text>
                        </View>
                      ))}
                      <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                        {finding.runbookId ? (
                          <SmallAction label={finding.action || 'Napraw'} disabled={busy || optimizing} onPress={() => confirmFindingAction(finding)} />
                        ) : (
                          <Text style={styles.findingAction}>{finding.action || (finding.fixable ? 'Automatyczna' : 'Tylko podgląd')}</Text>
                        )}
                      </View>
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
  root: { flex: 1, backgroundColor: MACHINE.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  iconBtn: { padding: 6 },
  brandLogo: { width: 30, height: 30, borderRadius: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { color: MACHINE.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  brandSub: { color: MACHINE.muted, fontSize: 12, flexShrink: 1 },
  coreBadge: { backgroundColor: MACHINE.gold, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  coreBadgeText: { color: '#111111', fontSize: 9, fontWeight: '800', letterSpacing: 0.9 },
  statusStrip: { alignItems: 'center', gap: 4, marginTop: 2, marginLeft: -6 },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  statusChipText: { color: MACHINE.secondary, fontSize: 11.5, fontFamily: MONO },
  switchRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 10 },
  switchKey: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MACHINE.bezel,
    backgroundColor: '#0E0F12',
  },
  switchLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  tabRail: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#0E0F12',
    borderWidth: 1,
    borderColor: MACHINE.bezel,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: '#1D2025', borderWidth: 1, borderColor: MACHINE.bezelHi },
  tabLabel: { fontSize: 12.5, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.25)',
  },
  errorText: { color: MACHINE.crit, fontSize: 13, flex: 1 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18 },
  heroText: { flex: 1, minWidth: 220 },
  kicker: { color: MACHINE.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headline: { color: MACHINE.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.6, marginTop: 6 },
  lede: { color: MACHINE.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  heroReadouts: { flexDirection: 'row', gap: 16, marginTop: 16 },
  panelNote: { color: MACHINE.muted, fontSize: 11, fontFamily: MONO },
  gaugeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gaugeCell: { flexGrow: 1, flexBasis: 150, paddingHorizontal: 6, marginBottom: 12, gap: 8 },
  gaugeFoot: { height: 38, justifyContent: 'center', paddingHorizontal: 4 },
  readoutRow: { flexDirection: 'row', gap: 14, marginTop: 14 },
  calmRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 16, paddingLeft: 10 },
  painRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 14, paddingRight: 16, paddingLeft: 8 },
  choreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingRight: 16, paddingLeft: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: MACHINE.hairline },
  rowDividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: MACHINE.hairline },
  rowTitle: { color: MACHINE.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { color: MACHINE.secondary, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  mono: { color: MACHINE.text, fontFamily: MONO, fontSize: 12 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  module: {
    flexGrow: 1,
    flexBasis: 150,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: MACHINE.well,
    borderWidth: 1,
    borderColor: MACHINE.hairline,
  },
  moduleTitle: { color: MACHINE.text, fontSize: 12.5, fontWeight: '600' },
  moduleMeta: { color: MACHINE.muted, fontSize: 11, fontFamily: MONO, marginTop: 1 },
  traceLabel: { color: MACHINE.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 12, marginBottom: 6 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  keyBtn: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  keyBtnGold: { backgroundColor: MACHINE.gold },
  keyBtnPlain: { backgroundColor: '#14161A', borderWidth: 1, borderColor: MACHINE.bezelHi },
  keyBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  smallAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MACHINE.bezelHi,
    backgroundColor: '#15171B',
  },
  smallActionText: { fontSize: 12, fontWeight: '700' },
  rackUnit: { paddingVertical: 14, paddingHorizontal: 16 },
  rackHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -8 },
  rackCount: { color: MACHINE.gold, fontSize: 12, fontFamily: MONO },
  rackActions: { flexDirection: 'row', gap: 6 },
  rackSchedule: { color: MACHINE.muted, fontSize: 11, marginTop: 6, marginLeft: 22 },
  rackGauges: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 10, marginLeft: 14 },
  rackGaugeLabel: { color: MACHINE.muted, fontSize: 10.5, fontFamily: MONO, marginBottom: 5 },
  rackStats: { alignItems: 'flex-end' },
  rackStat: { color: MACHINE.secondary, fontSize: 11, fontFamily: MONO },
  chainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingRight: 16, paddingLeft: 8 },
  findingRow: { paddingVertical: 14, paddingHorizontal: 16 },
  findingHead: { flexDirection: 'row', alignItems: 'center', marginLeft: -8 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  evidenceLabel: { color: MACHINE.muted, fontSize: 11, width: 108 },
  findingAction: { color: MACHINE.muted, fontSize: 12, fontWeight: '600' },
  logApps: { gap: 6, paddingBottom: 10 },
  logApp: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MACHINE.bezel,
    backgroundColor: '#0E0F12',
  },
  logAppActive: { borderColor: `${MACHINE.gold}88`, backgroundColor: MACHINE.goldSoft },
  logAppText: { fontSize: 12.5, fontWeight: '600' },
  terminal: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: MACHINE.bezel, backgroundColor: '#050607', overflow: 'hidden' },
  terminalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MACHINE.hairline,
    backgroundColor: '#0D0E11',
  },
  terminalTitle: { flex: 1, color: MACHINE.secondary, fontSize: 11.5, fontFamily: MONO },
  terminalTools: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  terminalTool: { color: MACHINE.muted, fontSize: 11, fontWeight: '700' },
  filter: {
    color: MACHINE.text,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MACHINE.hairline,
  },
  terminalBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  logLine: { color: '#C9CCD1', fontFamily: MONO, fontSize: 11, lineHeight: 16 },
});
