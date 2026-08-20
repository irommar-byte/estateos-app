import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { useKeiAmerExportStore } from '../../store/useKeiAmerExportStore';
import TitaniumHomeKeyBackdrop from '../profile/TitaniumHomeKeyBackdrop';
import InsetMetalRecess from '../profile/InsetMetalRecess';
import { profilePremiumCardShellStyle } from '../profile/profileCardElevation';
import AnalogAppleClock from '../agency/AnalogAppleClock';
import { crmRedPalette } from '../agency/crmRedTheme';
import {
  fetchAdminCoreMonitor,
  fetchSimulatorUsers,
  type AdminCoreMonitor,
  type SimulatorUser,
} from '../../services/adminSimulatorService';
import { formatBytesShort, formatUptime } from '../../services/adminCoreMetricsService';

type Props = {
  isDark: boolean;
};

const ITEM_H = 38;
const VISIBLE = 5;
const DRUM_H = ITEM_H * VISIBLE;

function formatCountdown(nextRunAt: string | null, nowMs: number): string {
  if (!nextRunAt) return '--:--';
  const ms = new Date(nextRunAt).getTime() - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StatTile({
  label,
  value,
  hint,
  isDark,
  palette,
}: {
  label: string;
  value: string;
  hint?: string;
  isDark: boolean;
  palette: ReturnType<typeof crmRedPalette>;
}) {
  return (
    <View style={styles.statCell}>
      <InsetMetalRecess isDark={isDark} variant="red" borderRadius={13} contentStyle={styles.statContent}>
        <Text style={[styles.statValue, { color: palette.text }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: palette.secondary }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.statHint, { color: palette.muted }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </InsetMetalRecess>
    </View>
  );
}

export default function ProfileAdminCoreSection({ isDark }: Props) {
  const palette = useMemo(() => crmRedPalette(isDark), [isDark]);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [expanded, setExpanded] = useState(true);
  const user = useAuthStore((s) => s.user);
  const adminSession = useAuthStore((s) => s.adminSession);
  const impersonateUser = useAuthStore((s) => s.impersonateUser);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const getAdminToken = useAuthStore((s) => s.getAdminToken);

  const running = useKeiAmerExportStore((s) => s.running);
  const autoEnabled = useKeiAmerExportStore((s) => s.autoEnabled);
  const sessionImportedCount = useKeiAmerExportStore((s) => s.sessionImportedCount);
  const targetCount = useKeiAmerExportStore((s) => s.targetCount);
  const nextRunAt = useKeiAmerExportStore((s) => s.nextRunAt);
  const items = useKeiAmerExportStore((s) => s.items);
  const hydrateFromServer = useKeiAmerExportStore((s) => s.hydrateFromServer);
  const setModalVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const cancelExport = useKeiAmerExportStore((s) => s.cancelExport);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [maxId, setMaxId] = useState(1);
  const [usersById, setUsersById] = useState<Record<number, SimulatorUser>>({});
  const [selectedId, setSelectedId] = useState(() => Number(user?.id || 1));
  const [monitor, setMonitor] = useState<AdminCoreMonitor | null>(null);
  const idScrollRef = useRef<ScrollView>(null);
  const nameScrollRef = useRef<ScrollView>(null);
  const applyingRef = useRef(false);

  const publishing = running && autoEnabled;
  const waiting = autoEnabled && !running;
  const cycleDone = items.filter((item) => item.status === 'done').length;
  const cycleTarget = targetCount > 0 ? targetCount : 3;
  const autoTone = publishing ? '#34C759' : waiting ? '#FFD60A' : palette.muted;
  const autoLabel = publishing ? 'PUBLICATION' : waiting ? 'WAITING' : 'IDLE';

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadDirectory = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const payload = await fetchSimulatorUsers(token);
      const map: Record<number, SimulatorUser> = {};
      for (const row of payload.users) map[row.id] = row;
      setUsersById(map);
      setMaxId(Math.max(1, payload.maxId));
    } catch {
      /* keep previous */
    }
  }, [getAdminToken]);

  const loadMonitor = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    try {
      setMonitor(await fetchAdminCoreMonitor(token));
    } catch {
      /* keep previous */
    }
  }, [getAdminToken]);

  useFocusEffect(
    useCallback(() => {
      void loadDirectory();
      void loadMonitor();
      const token = getAdminToken();
      if (token) void hydrateFromServer(token);
    }, [loadDirectory, loadMonitor, getAdminToken, hydrateFromServer]),
  );

  useEffect(() => {
    const t = setInterval(() => {
      void loadMonitor();
      const token = getAdminToken();
      if (token) void hydrateFromServer(token);
    }, 8000);
    return () => clearInterval(t);
  }, [loadMonitor, getAdminToken, hydrateFromServer]);

  const ids = useMemo(() => Array.from({ length: maxId }, (_, i) => i + 1), [maxId]);

  const scrollDrumsTo = useCallback((id: number, animated = false) => {
    const y = Math.max(0, (id - 1) * ITEM_H);
    idScrollRef.current?.scrollTo({ y, animated });
    nameScrollRef.current?.scrollTo({ y, animated });
  }, []);

  useEffect(() => {
    const current = Number(user?.id || 0);
    if (current > 0) {
      setSelectedId(current);
      requestAnimationFrame(() => scrollDrumsTo(current, false));
    }
  }, [user?.id, maxId, scrollDrumsTo]);

  const applyId = useCallback(
    async (id: number) => {
      if (!Number.isFinite(id) || id < 1) return;
      setSelectedId(id);
      const adminId = Number((adminSession?.user || user)?.id || 0);
      const liveId = Number(user?.id || 0);
      if (id === liveId) return;
      if (applyingRef.current) return;
      applyingRef.current = true;
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (adminSession && id === adminId) {
          await stopImpersonation();
          return;
        }
        if (!usersById[id]) return;
        const result = await impersonateUser(id);
        if (!result.ok && result.error) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } finally {
        applyingRef.current = false;
      }
    },
    [adminSession, impersonateUser, stopImpersonation, user, usersById],
  );

  const onIdScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    nameScrollRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
  };

  const onIdEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const id = Math.max(1, Math.min(maxId, Math.round(e.nativeEvent.contentOffset.y / ITEM_H) + 1));
    void applyId(id);
  };

  const selectedUser = usersById[selectedId];
  const impersonating = Boolean(adminSession);

  return (
    <View style={[profilePremiumCardShellStyle(isDark, 20), styles.shell]}>
      <View style={[styles.card, { borderColor: palette.hairline }]}>
        <TitaniumHomeKeyBackdrop isDark={isDark} variant="red" />
        <View style={styles.cardContent}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpanded((v) => !v);
            }}
            style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.88 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: palette.secondary }]}>PANEL ADMINISTRATORA</Text>
              <Text style={[styles.title, { color: palette.text }]}>EstateOS™ CORE</Text>
            </View>
            <View style={styles.headerRight}>
              {impersonating ? (
                <View style={[styles.chip, { borderColor: palette.attention, backgroundColor: `${palette.attention}22` }]}>
                  <Text style={[styles.chipText, { color: palette.attention }]}>SYMULATOR</Text>
                </View>
              ) : (
                <View style={[styles.chip, { borderColor: palette.onTrack, backgroundColor: `${palette.onTrack}22` }]}>
                  <Text style={[styles.chipText, { color: palette.onTrack }]}>LIVE</Text>
                </View>
              )}
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.muted} />
            </View>
          </Pressable>

          {expanded || !isTablet ? (
            <>
              <AnalogAppleClock size={168} isDark={isDark} variant="red" accent={palette.accent} />

              <View
                style={[
                  styles.autoShell,
                  {
                    borderColor: autoTone,
                    backgroundColor: publishing ? 'rgba(52,199,89,0.18)' : waiting ? 'rgba(255,214,10,0.2)' : palette.surface,
                  },
                ]}
              >
                <Pressable onPress={() => setModalVisible(true)} style={styles.autoMain}>
                  <View style={[styles.autoLed, { backgroundColor: autoTone }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.autoState, { color: autoTone }]}>{autoLabel}</Text>
                    <Text style={[styles.autoMeta, { color: palette.text }]}>
                      {publishing
                        ? `${cycleDone}`
                        : `${sessionImportedCount}`}
                      <Text style={{ color: palette.muted }}>
                        {publishing ? ` / ${cycleTarget}` : ' opublikowanych'}
                      </Text>
                    </Text>
                  </View>
                  <Text style={[styles.autoClock, { color: palette.text }]}>
                    {publishing ? '●' : formatCountdown(nextRunAt, nowMs)}
                  </Text>
                </Pressable>
                {running ? (
                  <Pressable onPress={() => cancelExport()} hitSlop={8} style={styles.autoStop}>
                    <Ionicons name="stop-circle" size={26} color="#FF453A" />
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.blockLabel, { color: palette.secondary }]}>SYMULATOR</Text>
              <View style={styles.drumsRow}>
                <InsetMetalRecess isDark={isDark} variant="red" borderRadius={16} contentStyle={styles.drumWell}>
                  <Text style={[styles.drumCaption, { color: palette.muted }]}>ID</Text>
                  <View style={styles.drumWindow}>
                    <ScrollView
                      ref={idScrollRef}
                      showsVerticalScrollIndicator={false}
                      snapToInterval={ITEM_H}
                      decelerationRate="fast"
                      onScroll={onIdScroll}
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={onIdEnd}
                      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                    >
                      {ids.map((id) => (
                        <View key={id} style={styles.drumItem}>
                          <Text style={[styles.drumId, { color: id === selectedId ? palette.text : palette.muted }]}>
                            {id}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                    <View pointerEvents="none" style={[styles.drumHighlight, { borderColor: palette.accent }]} />
                  </View>
                </InsetMetalRecess>
                <InsetMetalRecess isDark={isDark} variant="red" borderRadius={16} contentStyle={styles.drumWell}>
                  <Text style={[styles.drumCaption, { color: palette.muted }]}>UŻYTKOWNIK</Text>
                  <View style={styles.drumWindow} pointerEvents="none">
                    <ScrollView
                      ref={nameScrollRef}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                    >
                      {ids.map((id) => (
                        <View key={id} style={styles.drumItem}>
                          <Text
                            style={[styles.drumName, { color: id === selectedId ? palette.text : palette.muted }]}
                            numberOfLines={1}
                          >
                            {usersById[id]?.name || 'Brak konta'}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                    <View pointerEvents="none" style={[styles.drumHighlight, { borderColor: palette.accent }]} />
                  </View>
                </InsetMetalRecess>
              </View>
              <Text style={[styles.simHint, { color: palette.muted }]}>
                {selectedUser
                  ? impersonating
                    ? `Profil działa jako ${selectedUser.name} · ID ${selectedId}`
                    : `Wybrano ID ${selectedId} · ${selectedUser.name}`
                  : `ID ${selectedId} nie ma konta`}
              </Text>

              <Text style={[styles.blockLabel, { color: palette.secondary }]}>MONITOR SERWERA</Text>
              <View style={styles.statsGrid}>
                <StatTile isDark={isDark} palette={palette} label="Konta" value={String(monitor?.users ?? '—')} />
                <StatTile isDark={isDark} palette={palette} label="Wejścia" value={String(monitor?.pageViews ?? '—')} hint="wszystkie odsłony" />
                <StatTile isDark={isDark} palette={palette} label="Unikalne IP" value={String(monitor?.uniqueIps ?? '—')} />
                <StatTile isDark={isDark} palette={palette} label="IP teraz" value={monitor?.publicIp || '—'} />
                <StatTile
                  isDark={isDark}
                  palette={palette}
                  label="Uptime OS"
                  value={monitor ? formatUptime(monitor.osUptimeSec) : '—'}
                />
                <StatTile
                  isDark={isDark}
                  palette={palette}
                  label="Proces"
                  value={monitor ? formatUptime(monitor.processUptimeSec) : '—'}
                />
                <StatTile isDark={isDark} palette={palette} label="CPU" value={monitor ? `${Math.round(monitor.cpuPercent)}%` : '—'} />
                <StatTile isDark={isDark} palette={palette} label="RAM" value={monitor ? `${Math.round(monitor.memoryPercent)}%` : '—'} />
                <StatTile isDark={isDark} palette={palette} label="Dysk" value={monitor ? `${Math.round(monitor.diskPercent)}%` : '—'} />
                <StatTile
                  isDark={isDark}
                  palette={palette}
                  label="Baza"
                  value={monitor?.dbLatencyMs != null ? `${monitor.dbLatencyMs} ms` : '—'}
                />
                <StatTile isDark={isDark} palette={palette} label="24h wizyt" value={String(monitor?.visits24h ?? '—')} />
                <StatTile isDark={isDark} palette={palette} label="Online 24h" value={String(monitor?.activeUsers24h ?? '—')} />
              </View>
              {monitor?.host ? (
                <Text style={[styles.hostLine, { color: palette.muted }]}>
                  host {monitor.host}
                  {monitor.memoryUsedBytes
                    ? ` · RAM ${formatBytesShort(monitor.memoryUsedBytes)} / ${formatBytesShort(monitor.memoryTotalBytes)}`
                    : ''}
                  {` · oferty ${monitor.activeOffers} live / ${monitor.pendingOffers} pending`}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 12, marginBottom: 8 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContent: { position: 'relative', zIndex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 3 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  chip: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  autoShell: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  autoLed: { width: 10, height: 10, borderRadius: 5 },
  autoState: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  autoMeta: { fontSize: 20, fontWeight: '900', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  autoClock: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  autoStop: { paddingLeft: 4 },
  blockLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  drumsRow: { flexDirection: 'row', gap: 8 },
  drumWell: { padding: 10 },
  drumCaption: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  drumWindow: { height: DRUM_H, overflow: 'hidden' },
  drumItem: { height: ITEM_H, justifyContent: 'center' },
  drumId: { fontSize: 22, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  drumName: { fontSize: 15, fontWeight: '700' },
  drumHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H * 2,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  simHint: { marginTop: 8, fontSize: 12, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { width: '31.5%', flexGrow: 1 },
  statContent: { paddingVertical: 10, paddingHorizontal: 8, minHeight: 68, justifyContent: 'center' },
  statValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, marginTop: 2, textTransform: 'uppercase' },
  statHint: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  hostLine: { marginTop: 10, fontSize: 11, fontWeight: '600' },
});
