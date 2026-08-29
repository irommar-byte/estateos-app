import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import type { AutomationOverview, ImportRegistryRow, ScheduledJobView } from '../contracts/automationContract';
import type { KeiImportJobSnapshot } from '../contracts/keiAmerContract';
import { fetchAutomationOverview, fetchImportRegistry } from '../services/automationService';
import { keiAmerFetchAutoImport, keiAmerSaveAutoImport } from '../services/keiAmerService';
import { KEI_AUTO_INTERVALS_MIN, KEI_AUTO_MAX_COUNT, keiAutoIntervalLabel } from '../contracts/keiAmerContract';

type TabId = 'panel' | 'harmonogram' | 'rejestr';

const SOURCE_FILTERS = ['', 'KEI', 'OTODOM', 'NERYCHOMOSCI'] as const;

function useScreenTheme() {
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  return useMemo(
    () => ({
      isDark,
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)',
      accent: '#AF52DE',
      accentGreen: '#34C759',
      accentBlue: '#007AFF',
      danger: '#FF453A',
      segmentBg: isDark ? '#2C2C2E' : '#E5E5EA',
      segmentActive: isDark ? '#636366' : '#FFFFFF',
    }),
    [isDark],
  );
}

function statusColor(status: string | null | undefined, colors: ReturnType<typeof useScreenTheme>) {
  const s = String(status || '').toLowerCase();
  if (['online', 'running', 'done', 'active'].includes(s)) return colors.accentGreen;
  if (['queued', 'warning'].includes(s)) return '#FF9F0A';
  if (['error', 'cancelled', 'stopped'].includes(s)) return colors.danger;
  return colors.secondary;
}

function sourceLabel(source: string) {
  const s = source.toUpperCase();
  if (s === 'KEI') return 'KEI';
  if (s === 'OTODOM') return 'Otodom';
  if (s === 'NERYCHOMOSCI' || s === 'N-O') return 'N-O';
  return source || '—';
}

function formatTs(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pl-PL');
  } catch {
    return value;
  }
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  colors,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
  colors: ReturnType<typeof useScreenTheme>;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: colors.segmentBg }]}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.id);
            }}
            style={[styles.segment, active && { backgroundColor: colors.segmentActive }]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.text : colors.secondary }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function JobOffersRow({
  job,
  colors,
  onOpenImport,
  onOpenOffer,
}: {
  job: KeiImportJobSnapshot;
  colors: ReturnType<typeof useScreenTheme>;
  onOpenImport: (offerId: number, title?: string) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.secondary, fontSize: 12 }}>
        {job.exported.length} zaimport. · {job.skipped.length} pominięte
      </Text>
      {job.exported.map((row) => (
        <View key={row.offerId} style={styles.offerRow}>
          <Pressable onPress={() => onOpenOffer(row.offerId)}>
            <Text style={[styles.linkChip, { color: colors.accent }]}>#{row.offerId}</Text>
          </Pressable>
          <Pressable onPress={() => onOpenImport(row.offerId)}>
            <Text style={[styles.linkChip, { color: colors.accentBlue }]}>Dane importu</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function RegistryRow({
  row,
  colors,
  onOpenImport,
  onOpenOffer,
}: {
  row: ImportRegistryRow;
  colors: ReturnType<typeof useScreenTheme>;
  onOpenImport: (offerId: number, title?: string) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  return (
    <View style={[styles.registryCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      <View style={styles.registryTop}>
        <Pressable onPress={() => onOpenOffer(row.offerId)}>
          <Text style={[styles.registryTitle, { color: colors.text }]}>#{row.offerId} · {row.offerTitle}</Text>
        </Pressable>
        <Text style={[styles.registryMeta, { color: colors.secondary }]}>{formatTs(row.importedAt)}</Text>
      </View>
      <Text style={[styles.registryMeta, { color: colors.secondary }]}>
        {sourceLabel(row.importSource)} · {row.userName || `User #${row.userId}`}
      </Text>
      {row.smartAddFields.length ? (
        <Text style={[styles.registryMeta, { color: colors.accent }]} numberOfLines={2}>
          Smart Add: {row.smartAddFields.join(', ')}
        </Text>
      ) : null}
      <View style={styles.offerRow}>
        <Pressable onPress={() => onOpenImport(row.offerId, row.offerTitle)}>
          <Text style={[styles.linkChip, { color: colors.accentBlue }]}>Dane importu</Text>
        </Pressable>
        {row.importExternalUrl ? (
          <Pressable onPress={() => void Linking.openURL(row.importExternalUrl!)}>
            <Text style={[styles.linkChip, { color: colors.accentBlue }]}>Portal</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function AdminAutomationScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colors = useScreenTheme();
  const getAdminToken = useAuthStore((s) => s.getAdminToken);

  const [tab, setTab] = useState<TabId>('panel');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<AutomationOverview | null>(null);
  const [registry, setRegistry] = useState<ImportRegistryRow[]>([]);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('');
  const [keiSaving, setKeiSaving] = useState(false);
  const [keiDraft, setKeiDraft] = useState({
    enabled: false,
    intervalMinutes: 60,
    count: '3',
    targetUserId: '55',
    agentCommissionPercent: '2',
    propertyKind: 'apartment' as 'apartment' | 'house',
    transactionKind: 'sale' as 'sale' | 'rent',
  });

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setError('Brak sesji administratora.');
      setLoading(false);
      return;
    }
    try {
      const [ov, reg, auto] = await Promise.all([
        fetchAutomationOverview(token),
        fetchImportRegistry(token, { limit: 50, offset: 0, source: sourceFilter || undefined }),
        keiAmerFetchAutoImport(token).catch(() => null),
      ]);
      setOverview(ov);
      setRegistry(reg.rows);
      setRegistryTotal(reg.total);
      if (auto?.config) {
        setKeiDraft({
          enabled: auto.config.enabled,
          intervalMinutes: auto.config.intervalMinutes,
          count: String(auto.config.count),
          targetUserId: String(auto.config.targetUserId),
          agentCommissionPercent: String(auto.config.agentCommissionPercent),
          propertyKind: auto.config.propertyKind,
          transactionKind: auto.config.transactionKind,
        });
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAdminToken, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const saveKei = async (patch?: Partial<typeof keiDraft & { enabled: boolean }>) => {
    const token = getAdminToken();
    if (!token) return;
    setKeiSaving(true);
    try {
      const body = {
        enabled: patch?.enabled ?? keiDraft.enabled,
        intervalMinutes: patch?.intervalMinutes ?? keiDraft.intervalMinutes,
        count: Number(patch?.count ?? keiDraft.count),
        targetUserId: Number(patch?.targetUserId ?? keiDraft.targetUserId),
        agentCommissionPercent: Number(patch?.agentCommissionPercent ?? keiDraft.agentCommissionPercent),
        propertyKind: patch?.propertyKind ?? keiDraft.propertyKind,
        transactionKind: patch?.transactionKind ?? keiDraft.transactionKind,
      };
      await keiAmerSaveAutoImport(token, body);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać KEI');
    } finally {
      setKeiSaving(false);
    }
  };

  const openOffer = (offerId: number) => {
    navigation.navigate('OfferDetail', { offerId: String(offerId) });
  };

  const openImport = (offerId: number, offerTitle?: string) => {
    navigation.navigate('OfferComments', { offerId, offerTitle });
  };

  const kpis = useMemo(() => {
    const scheduled = overview?.scheduled || [];
    const cronOnline = scheduled.filter((j) => String(j.pm2Status).toLowerCase() === 'online').length;
    return {
      imports: overview?.importsTotal ?? registryTotal,
      active: overview?.activeJobs?.length ?? 0,
      nextKei: overview?.keiAuto?.enabled
        ? formatTs(overview.keiAuto.nextRunAt)
        : 'Wyłączony',
      cronOnline,
    };
  }, [overview, registryTotal]);

  const renderScheduled = (job: ScheduledJobView) => (
    <View key={job.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{job.name}</Text>
        <View style={[styles.statusPill, { borderColor: statusColor(job.pm2Status, colors) }]}>
          <Text style={[styles.statusText, { color: statusColor(job.pm2Status, colors) }]}>{job.pm2Status || '—'}</Text>
        </View>
      </View>
      <Text style={[styles.cardSub, { color: colors.secondary }]}>
        {job.scheduleLabel} · {job.schedule}
      </Text>
      <Text style={[styles.cardBody, { color: colors.secondary }]}>{job.description}</Text>
      {job.nextHint ? <Text style={[styles.cardHint, { color: colors.accent }]}>{job.nextHint}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Automatyzacja</Text>
          <Text style={[styles.headerSub, { color: colors.secondary }]}>Harmonogram i rejestr importów</Text>
        </View>
        <Pressable onPress={onRefresh} hitSlop={10}>
          <Ionicons name="refresh" size={22} color={colors.secondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.kpiRow}>
          {[
            { label: 'Importy', value: String(kpis.imports) },
            { label: 'Aktywne', value: String(kpis.active) },
            { label: 'Cron OK', value: String(kpis.cronOnline) },
            { label: 'Nast. KEI', value: kpis.nextKei, small: true },
          ].map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <Text style={[styles.kpiLabel, { color: colors.secondary }]}>{k.label}</Text>
              <Text style={[k.small ? styles.kpiValueSmall : styles.kpiValue, { color: colors.text }]} numberOfLines={2}>
                {k.value}
              </Text>
            </View>
          ))}
        </View>

        <SegmentedControl
          value={tab}
          onChange={setTab}
          colors={colors}
          options={[
            { id: 'panel', label: 'Panel' },
            { id: 'harmonogram', label: 'Harmonogram' },
            { id: 'rejestr', label: 'Rejestr' },
          ]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !overview ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : null}

        {tab === 'panel' ? (
          <View style={{ marginTop: 14, gap: 12 }}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
              <View style={styles.keiHeader}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>KEI auto-import</Text>
                  <Text style={[styles.cardSub, { color: colors.secondary }]}>Sterowanie cyklem na serwerze</Text>
                </View>
                <Switch
                  value={keiDraft.enabled}
                  onValueChange={(enabled) => {
                    setKeiDraft((p) => ({ ...p, enabled }));
                    void saveKei({ enabled });
                  }}
                  disabled={keiSaving}
                />
              </View>
              <View style={styles.formGrid}>
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>Interwał</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {KEI_AUTO_INTERVALS_MIN.map((min) => (
                    <Pressable
                      key={min}
                      onPress={() => setKeiDraft((p) => ({ ...p, intervalMinutes: min }))}
                      style={[
                        styles.chip,
                        keiDraft.intervalMinutes === min && { backgroundColor: `${colors.accent}33`, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>{keiAutoIntervalLabel(min)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>Ilość / cykl (max {KEI_AUTO_MAX_COUNT})</Text>
                <TextInput
                  value={keiDraft.count}
                  onChangeText={(count) => setKeiDraft((p) => ({ ...p, count }))}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.bg }]}
                />
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>User ID docelowy</Text>
                <TextInput
                  value={keiDraft.targetUserId}
                  onChangeText={(targetUserId) => setKeiDraft((p) => ({ ...p, targetUserId }))}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.bg }]}
                />
              </View>
              <Pressable
                onPress={() => void saveKei()}
                disabled={keiSaving}
                style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: keiSaving ? 0.6 : 1 }]}
              >
                {keiSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Zapisz harmonogram</Text>
                )}
              </Pressable>
              <Pressable onPress={() => navigation.navigate('AdminKeiAmer')} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.accentBlue, fontWeight: '700', fontSize: 13 }}>Ręczny import KEI →</Text>
              </Pressable>
            </View>

            {(overview?.activeJobs || []).map((job) => (
              <View key={job.id} style={[styles.card, { backgroundColor: colors.card, borderColor: '#FF9F0A55' }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Import w toku</Text>
                <Text style={{ color: colors.secondary, fontSize: 12 }}>{job.message}</Text>
                <JobOffersRow job={job} colors={colors} onOpenImport={openImport} onOpenOffer={openOffer} />
              </View>
            ))}

            {(overview?.recentJobs || []).slice(0, 8).map((job) => (
              <View key={job.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{job.source} · {job.status}</Text>
                  <Text style={{ color: colors.secondary, fontSize: 11 }}>{formatTs(job.finishedAt || job.updatedAt)}</Text>
                </View>
                <JobOffersRow job={job} colors={colors} onOpenImport={openImport} onOpenOffer={openOffer} />
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'harmonogram' ? (
          <View style={{ marginTop: 14, gap: 10 }}>{(overview?.scheduled || []).map(renderScheduled)}</View>
        ) : null}

        {tab === 'rejestr' ? (
          <View style={{ marginTop: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {SOURCE_FILTERS.map((filter) => {
                const active = sourceFilter === filter;
                return (
                  <Pressable
                    key={filter || 'all'}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setSourceFilter(filter);
                    }}
                    style={[styles.chip, active && { backgroundColor: `${colors.accent}33`, borderColor: colors.accent }]}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
                      {filter ? sourceLabel(filter) : 'Wszystkie'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.registryCount, { color: colors.secondary }]}>{registryTotal} wpisów</Text>
            {registry.map((row) => (
              <RegistryRow
                key={`${row.offerId}-${row.userId}`}
                row={row}
                colors={colors}
                onOpenImport={openImport}
                onOpenOffer={openOffer}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerSub: { fontSize: 11, marginTop: 2 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 10 },
  kpiLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  kpiValueSmall: { fontSize: 11, fontWeight: '800', marginTop: 4, lineHeight: 14 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentText: { fontSize: 11, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  cardSub: { fontSize: 11, marginTop: 4 },
  cardBody: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  cardHint: { fontSize: 11, marginTop: 8, fontWeight: '700' },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  keiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  formGrid: { gap: 6, marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  primaryBtn: { borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(120,120,128,0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  offerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  linkChip: { fontSize: 12, fontWeight: '800' },
  registryCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  registryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  registryTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  registryMeta: { fontSize: 11, marginTop: 4 },
  registryCount: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  error: { color: '#FF453A', fontSize: 13, marginTop: 10 },
});
