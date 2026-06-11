import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { useAuthStore } from '../../store/useAuthStore';
import AdminMarketSection from './AdminMarketSection';
import AdminStatsChart from './AdminStatsChart';
import {
  ADMIN_STATS_PERIODS,
  ADMIN_STATS_TABS,
  AdminStatsPeriod,
  AdminStatsTabId,
  buildAdminStatsInsights,
  buildAdminStatsVisitorsList,
  formatStatsDateTime,
  getFlagEmoji,
  processAdminStatsChartData,
} from '../../utils/adminStatistics';

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: { background?: string; text?: string; subtitle?: string; glass?: string };
};

type SectionId = 'overview' | 'market' | 'visitors';

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  colors: ReturnType<typeof useAnalyticsTheme>;
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
            style={[styles.segment, active && [styles.segmentActive, { backgroundColor: colors.segmentActive }]]}
          >
            <Text
              style={[styles.segmentText, { color: active ? colors.text : colors.secondary }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function useAnalyticsTheme(theme: Props['theme']) {
  return useMemo(() => {
    const isDark = theme.glass === 'dark';
    return {
      isDark,
      bg: isDark ? '#000000' : theme.background || '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      cardSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
      text: isDark ? '#FFFFFF' : theme.text || '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      tertiary: isDark ? '#636366' : '#AEAEB2',
      separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)',
      segmentBg: isDark ? '#2C2C2E' : '#E5E5EA',
      segmentActive: isDark ? '#636366' : '#FFFFFF',
      accent: '#10b981',
      accentBlue: '#007AFF',
      accentPink: '#ec4899',
      accentViolet: '#8b5cf6',
      chartGrid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      chartAxis: isDark ? '#8E8E93' : '#6C6C70',
      tooltipBg: isDark ? '#2C2C2E' : '#FFFFFF',
      tooltipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      tooltipLabel: isDark ? '#8E8E93' : '#6C6C70',
      tooltipValue: isDark ? '#FFFFFF' : '#000000',
      cursor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
    };
  }, [theme]);
}

function KpiGrid({ kpis, colors }: { kpis: Record<string, number>; colors: ReturnType<typeof useAnalyticsTheme> }) {
  const items = [
    { label: 'Użytkownicy', value: kpis.users },
    { label: 'Oferty', value: kpis.offers },
    { label: 'Aktywne', value: kpis.active },
    { label: 'Odsłony', value: kpis.pageViews },
    { label: 'Unikalne IP', value: kpis.uniqueViews },
  ];
  return (
    <View style={styles.kpiGrid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.kpiCell, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.kpiLabel, { color: colors.secondary }]}>{item.label}</Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{Number(item.value || 0).toLocaleString('pl-PL')}</Text>
        </View>
      ))}
    </View>
  );
}

function InsightCards({ insights, colors }: { insights: any; colors: ReturnType<typeof useAnalyticsTheme> }) {
  if (!insights?.visits?.best) return null;
  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightCard, { backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.insightKicker, { color: colors.secondary }]}>Wizyty — najlepszy dzień</Text>
        <Text style={[styles.insightValue, { color: colors.text }]}>
          {insights.visits.best.day} ({insights.visits.best.visits})
        </Text>
        {insights.visits.peakHour != null ? (
          <Text style={[styles.insightExtra, { color: colors.tertiary }]}>
            Szczyt: {String(insights.visits.peakHour).padStart(2, '0')}:00
          </Text>
        ) : null}
      </View>
      {insights.offers?.best ? (
        <View style={[styles.insightCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.insightKicker, { color: colors.secondary }]}>Oferty — najlepszy dzień</Text>
          <Text style={[styles.insightValue, { color: colors.text }]}>
            {insights.offers.best.day} ({insights.offers.best.offers})
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MonthlyOffersChart({ data, colors }: { data: Array<{ label: string; count: number }>; colors: ReturnType<typeof useAnalyticsTheme> }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>Oferty w tym roku</Text>
      <View style={styles.barRow}>
        {data.map((row) => (
          <View key={row.label} style={styles.barCol}>
            <Text style={[styles.barValue, { color: colors.secondary }]}>{row.count}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.cardSecondary }]}>
              <View style={[styles.barFill, { height: `${Math.max(8, (row.count / max) * 100)}%`, backgroundColor: colors.accentPink }]} />
            </View>
            <Text style={[styles.barLabel, { color: colors.tertiary }]} numberOfLines={1}>
              {row.label.slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminStatisticsModal({ visible, onClose, theme }: Props) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useAnalyticsTheme(theme);

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('overview');
  const [activeTabId, setActiveTabId] = useState<AdminStatsTabId>('pageViews');
  const [activePeriod, setActivePeriod] = useState<AdminStatsPeriod>('Ostatnie 30 Dni');
  const [selectedChartIndex, setSelectedChartIndex] = useState(0);
  const [chartPending, startChartTransition] = useTransition();

  const activeTab = ADMIN_STATS_TABS.find((t) => t.id === activeTabId) || ADMIN_STATS_TABS[0];

  const fetchStats = useCallback(async (silent = false) => {
    if (!token) {
      setFetchError('Brak sesji — zaloguj się ponownie.');
      setStats(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/stats`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setStats(json);
      } else {
        setStats(null);
        setFetchError(String(json?.message || json?.error || `Serwer: ${res.status}`).trim() || 'Nie udało się pobrać statystyk.');
      }
    } catch {
      setStats(null);
      setFetchError('Brak połączenia z serwerem.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (visible) void fetchStats();
  }, [visible, fetchStats]);

  const chartData = useMemo(() => processAdminStatsChartData(activePeriod, stats?.timeline), [activePeriod, stats]);
  const visitorsList = useMemo(() => buildAdminStatsVisitorsList(stats?.timeline), [stats]);
  const visitorCountries = useMemo(() => stats?.timeline?.visitorCountries || [], [stats]);
  const marketOffers = useMemo(() => stats?.timeline?.offers || [], [stats]);
  const insights = useMemo(() => buildAdminStatsInsights(stats), [stats]);
  const monthlyOffers = useMemo(() => insights?.monthlyOffers || [], [insights]);

  useEffect(() => {
    if (chartData.length > 0) setSelectedChartIndex(chartData.length - 1);
  }, [chartData, activeTabId, activePeriod]);

  if (!visible) return null;

  const chartWidth = width - 32;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.navBar, { borderBottomColor: colors.separator }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.navTitle, { color: colors.text }]}>Analityka</Text>
            <Text style={[styles.navSubtitle, { color: colors.secondary }]}>Raport systemowy · Europe/Warsaw</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : fetchError ? (
          <View style={styles.centered}>
            <Text style={{ color: '#FF3B30', marginBottom: 12, textAlign: 'center', paddingHorizontal: 24 }}>{fetchError}</Text>
            <Pressable onPress={() => void fetchStats()} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.primaryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.accent}
                onRefresh={() => {
                  setRefreshing(true);
                  void fetchStats(true);
                }}
              />
            }
          >
            <SegmentedControl
              options={[
                { id: 'overview', label: 'Przegląd' },
                { id: 'market', label: 'Rynek' },
                { id: 'visitors', label: 'Live IP' },
              ]}
              value={section}
              onChange={setSection}
              colors={colors}
            />

            {section === 'overview' ? (
              <>
                <View style={{ marginTop: 14 }}>
                  <KpiGrid kpis={stats?.kpis || {}} colors={colors} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <InsightCards insights={insights} colors={colors} />
                </View>
                {monthlyOffers.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <MonthlyOffersChart data={monthlyOffers} colors={colors} />
                  </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: colors.card, marginTop: 12 }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {ADMIN_STATS_TABS.map((tab) => {
                      const isActive = tab.id === activeTabId;
                      const total = chartData.reduce((sum, item) => sum + Number(item[tab.id] || 0), 0);
                      return (
                        <Pressable
                          key={tab.id}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            startChartTransition(() => setActiveTabId(tab.id));
                          }}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: isActive ? `${tab.color}22` : colors.cardSecondary,
                              borderColor: isActive ? tab.color : 'transparent',
                            },
                          ]}
                        >
                          <Ionicons name={tab.icon} size={14} color={isActive ? tab.color : colors.secondary} />
                          <Text style={[styles.chipText, { color: isActive ? colors.text : colors.secondary }]}>
                            {tab.label}
                            {total > 0 ? ` · ${total}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginTop: 8 }]}>
                    {ADMIN_STATS_PERIODS.map((period) => {
                      const active = period === activePeriod;
                      return (
                        <Pressable
                          key={period}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            startChartTransition(() => setActivePeriod(period));
                          }}
                          style={[
                            styles.periodChip,
                            { backgroundColor: active ? colors.text : colors.cardSecondary },
                          ]}
                        >
                          <Text style={[styles.periodChipText, { color: active ? colors.bg : colors.secondary }]}>{period}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={{ marginTop: 8, position: 'relative' }}>
                    {chartPending ? (
                      <View style={[styles.chartOverlay, { backgroundColor: `${colors.card}CC` }]}>
                        <ActivityIndicator color={colors.accent} />
                        <Text style={[styles.chartOverlayText, { color: colors.secondary }]}>Przeliczanie…</Text>
                      </View>
                    ) : null}
                    <AdminStatsChart
                      data={chartData}
                      dataKey={activeTabId}
                      color={activeTab.color}
                      width={chartWidth - 28}
                      height={260}
                      selectedIndex={selectedChartIndex}
                      onSelectIndex={setSelectedChartIndex}
                      colors={{
                        grid: colors.chartGrid,
                        axis: colors.chartAxis,
                        tooltipBg: colors.tooltipBg,
                        tooltipBorder: colors.tooltipBorder,
                        tooltipLabel: colors.tooltipLabel,
                        tooltipValue: colors.tooltipValue,
                        cursor: colors.cursor,
                      }}
                    />
                  </View>

                  {activePeriod === 'Dni Szczytu' && insights?.weekdays ? (
                    <View style={styles.weekdayGrid}>
                      {insights.weekdays.map((row: any) => (
                        <View key={row.day} style={[styles.weekdayCell, { backgroundColor: colors.cardSecondary }]}>
                          <Text style={[styles.weekdayName, { color: colors.secondary }]}>{row.day.slice(0, 3)}</Text>
                          <Text style={[styles.weekdayVisits, { color: colors.accent }]}>{row.visits}</Text>
                          <Text style={[styles.weekdayOffers, { color: colors.tertiary }]}>{row.offers} ofert</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {section === 'market' && marketOffers.length > 0 ? (
              <AdminMarketSection
                offers={marketOffers}
                colors={{
                  card: colors.card,
                  cardSecondary: colors.cardSecondary,
                  text: colors.text,
                  secondary: colors.secondary,
                  tertiary: colors.tertiary,
                  separator: colors.separator,
                  accent: colors.accent,
                }}
              />
            ) : section === 'market' ? (
              <View style={[styles.card, { backgroundColor: colors.card, marginTop: 14 }]}>
                <Text style={[styles.cardHint, { color: colors.tertiary, textAlign: 'center', paddingVertical: 24 }]}>
                  Brak ofert do analizy rynku.
                </Text>
              </View>
            ) : null}

            {section === 'visitors' ? (
              <View style={{ marginTop: 14, gap: 12 }}>
                {visitorCountries.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Rozkład krajów</Text>
                    <View style={styles.countryWrap}>
                      {visitorCountries.map((c: any) => (
                        <View key={c.countryCode} style={[styles.countryChip, { backgroundColor: colors.cardSecondary }]}>
                          <Text>{c.flag || getFlagEmoji(c.countryCode)}</Text>
                          <Text style={[styles.countryChipText, { color: colors.text }]}>{c.countryName}</Text>
                          <Text style={[styles.countryChipMeta, { color: colors.secondary }]}>
                            {c.pageViews} · {c.sharePct}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Top 50 odwiedzających</Text>
                  <Text style={[styles.cardHint, { color: colors.tertiary }]}>Czas w strefie Europe/Warsaw</Text>
                  {visitorsList.map((v: any, i: number) => (
                    <View
                      key={`${v.ip}-${i}`}
                      style={[styles.visitorRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}
                    >
                      <Text style={styles.visitorFlag}>{getFlagEmoji(v.country)}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.visitorIp, { color: colors.text }]}>{v.ip}</Text>
                        <Text style={[styles.visitorMeta, { color: colors.secondary }]} numberOfLines={1}>
                          {[v.city, v.regionName].filter(Boolean).join(', ') || v.countryName || v.country}
                        </Text>
                        <Text style={[styles.visitorTime, { color: colors.tertiary }]}>{formatStatsDateTime(v.lastVisit)}</Text>
                      </View>
                      <View style={styles.visitorCounts}>
                        <Text style={[styles.visitorCount, { color: colors.text }]}>{v.count}</Text>
                        <Text style={[styles.visitorMap, { color: colors.accent }]}>{v.mainPageViews} mapa</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  navSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  primaryBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  segment: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  segmentActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segmentText: { fontSize: 12, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCell: { width: '31%', borderRadius: 12, padding: 10, minWidth: 100, flexGrow: 1 },
  kpiLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 20, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  insightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insightCard: { flex: 1, minWidth: 150, borderRadius: 12, padding: 12 },
  insightKicker: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  insightExtra: { fontSize: 11, marginTop: 4 },
  card: { borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardKicker: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardHint: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  periodChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  periodChipText: { fontSize: 11, fontWeight: '700' },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  chartOverlayText: { fontSize: 11, fontWeight: '600' },
  weekdayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  weekdayCell: { width: '13%', minWidth: 44, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  weekdayName: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  weekdayVisits: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  weekdayOffers: { fontSize: 9, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 12 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: 80, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  barValue: { fontSize: 9, fontWeight: '700', marginBottom: 4 },
  barLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  countryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  countryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  countryChipText: { fontSize: 12, fontWeight: '600' },
  countryChipMeta: { fontSize: 11 },
  visitorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  visitorFlag: { fontSize: 22, width: 28 },
  visitorIp: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, fontWeight: '600' },
  visitorMeta: { fontSize: 11, marginTop: 2 },
  visitorTime: { fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  visitorCounts: { alignItems: 'flex-end', minWidth: 56 },
  visitorCount: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  visitorMap: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
