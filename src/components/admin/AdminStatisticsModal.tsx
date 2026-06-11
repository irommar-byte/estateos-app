import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Path, Stop, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { useAuthStore } from '../../store/useAuthStore';
import {
  ADMIN_STATS_PERIODS,
  ADMIN_STATS_PROPERTY_TYPES,
  ADMIN_STATS_TABS,
  AdminStatsPeriod,
  AdminStatsTabId,
  buildAdminStatsInsights,
  buildAdminStatsMarketData,
  buildAdminStatsVisitorsList,
  formatStatsDateTime,
  getFlagEmoji,
  processAdminStatsChartData,
} from '../../utils/adminStatistics';

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: any;
};

function StatsAreaChart({
  data,
  dataKey,
  color,
  width,
  height,
  activeLabel,
  activeValue,
  onSelectIndex,
}: {
  data: any[];
  dataKey: AdminStatsTabId;
  color: string;
  width: number;
  height: number;
  activeLabel: string | null;
  activeValue: number;
  onSelectIndex: (index: number, label: string, value: number) => void;
}) {
  const padding = { left: 34, right: 10, top: 12, bottom: 34 };
  const chartW = Math.max(1, width - padding.left - padding.right);
  const chartH = Math.max(1, height - padding.top - padding.bottom);
  const values = data.map((d) => Number(d[dataKey] || 0));
  const maxVal = Math.max(1, ...values);
  const points = values.map((v, i) => {
    const x = padding.left + (i / Math.max(1, values.length - 1)) * chartW;
    const y = padding.top + chartH - (v / maxVal) * chartH;
    return { x, y, v, label: String(data[i]?.name || '') };
  });

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Brak danych wykresu.</Text>
      </View>
    );
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padding.top + chartH - t * chartH,
    label: Math.round(maxVal * t).toLocaleString('pl-PL'),
  }));

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="statsGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="95%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {yTicks.map((tick) => (
          <Line
            key={tick.label}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
          />
        ))}
        <Path d={areaPath} fill="url(#statsGradient)" />
        <Path d={linePath} stroke={color} strokeWidth={3} fill="none" />
        {points.map((p, i) => (
          <SvgText key={`${p.label}-${i}`} x={p.x} y={height - 8} fill="#6b7280" fontSize="8" fontWeight="700" textAnchor="middle">
            {i % Math.ceil(Math.max(1, points.length / 6)) === 0 || i === points.length - 1 ? p.label : ''}
          </SvgText>
        ))}
        {yTicks.slice(1).map((tick) => (
          <SvgText key={`y-${tick.label}`} x={4} y={tick.y + 3} fill="#6b7280" fontSize="8" fontWeight="700">
            {tick.label}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.chartTouchRow}>
        {points.map((p, i) => (
          <Pressable
            key={`touch-${i}`}
            style={styles.chartTouchCell}
            onPress={() => onSelectIndex(i, p.label, p.v)}
          />
        ))}
      </View>
      {activeLabel != null ? (
        <View style={styles.chartTooltip}>
          <Text style={styles.chartTooltipLabel}>{activeLabel}</Text>
          <Text style={styles.chartTooltipValue}>{Number(activeValue || 0).toLocaleString('pl-PL')}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminStatisticsModal({ visible, onClose, theme }: Props) {
  const { token } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDark = theme.glass === 'dark';

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<AdminStatsTabId>('pageViews');
  const [activePeriod, setActivePeriod] = useState<AdminStatsPeriod>('Ostatnie 30 Dni');
  const [showVisitors, setShowVisitors] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [marketFilter, setMarketFilter] = useState('Wszystkie');
  const [selectedChartLabel, setSelectedChartLabel] = useState<string | null>(null);
  const [selectedChartValue, setSelectedChartValue] = useState(0);
  const [chartPending, startChartTransition] = useTransition();

  const activeTab = ADMIN_STATS_TABS.find((t) => t.id === activeTabId) || ADMIN_STATS_TABS[0];

  const fetchStats = useCallback(async () => {
    if (!token) {
      setFetchError('Brak sesji — zaloguj się ponownie.');
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/stats`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
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
    }
  }, [token]);

  useEffect(() => {
    if (visible) fetchStats();
  }, [visible, fetchStats]);

  const chartData = useMemo(
    () => processAdminStatsChartData(activePeriod, stats?.timeline),
    [activePeriod, stats]
  );
  const visitorsList = useMemo(() => buildAdminStatsVisitorsList(stats?.timeline), [stats]);
  const marketData = useMemo(() => buildAdminStatsMarketData(stats, marketFilter), [stats, marketFilter]);
  const insights = useMemo(() => buildAdminStatsInsights(stats), [stats]);

  useEffect(() => {
    if (chartData.length > 0) {
      const last = chartData[chartData.length - 1];
      setSelectedChartLabel(String(last?.name || ''));
      setSelectedChartValue(Number(last?.[activeTabId] || 0));
    }
  }, [chartData, activeTabId, activePeriod]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#050505' : theme.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>
              Analityka<Text style={{ color: '#10b981' }}>.</Text>
            </Text>
            <View style={styles.subtitleRow}>
              <Ionicons name="trending-up" size={14} color="#10b981" />
              <Text style={styles.subtitle}>Raport Systemowy EstateOS</Text>
            </View>
          </View>
          <Pressable onPress={onClose}>
            <Ionicons name="close-circle" size={32} color={theme.subtitle} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} />
        ) : fetchError ? (
          <View style={{ padding: 24 }}>
            <Text style={{ color: '#FF3B30', marginBottom: 12 }}>{fetchError}</Text>
            <Pressable onPress={() => void fetchStats()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <View style={styles.moduleButtonsRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowMarket((v) => !v);
                  setShowVisitors(false);
                }}
                style={[styles.moduleBtn, showMarket && styles.moduleBtnMarketActive]}
              >
                <Ionicons name="map-outline" size={16} color={showMarket ? '#10b981' : theme.text} />
                <Text style={[styles.moduleBtnText, showMarket && { color: '#10b981' }]}>Analiza Rynku</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowVisitors((v) => !v);
                  setShowMarket(false);
                }}
                style={[styles.moduleBtn, showVisitors && styles.moduleBtnVisitorsActive]}
              >
                <Ionicons name="globe-outline" size={16} color={showVisitors ? '#3b82f6' : theme.text} />
                <Text style={[styles.moduleBtnText, showVisitors && { color: '#3b82f6' }]}>Live IP Tracker</Text>
              </Pressable>
            </View>

            {showMarket && marketData ? (
              <View style={styles.panel}>
                <Text style={styles.panelKicker}>Średnia w Warszawie</Text>
                <Text style={styles.panelBigValue}>
                  {marketData.avgWarsawSqm.toLocaleString('pl-PL')} <Text style={styles.panelUnit}>PLN/m²</Text>
                </Text>
                <Text style={styles.panelHint}>Na podstawie wszystkich zgromadzonych ofert w systemie.</Text>

                <Text style={[styles.panelKicker, { marginTop: 18 }]}>Typ Nieruchomości</Text>
                <View style={styles.filterCol}>
                  {ADMIN_STATS_PROPERTY_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setMarketFilter(type)}
                      style={[styles.filterChip, marketFilter === type && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, marketFilter === type && styles.filterChipTextActive]}>{type}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.panelKicker, { marginTop: 18 }]}>Ranking Dzielnic (PLN/m²)</Text>
                {marketData.districts.length === 0 ? (
                  <Text style={styles.panelHint}>Brak danych dla wybranego filtru.</Text>
                ) : (
                  marketData.districts.map((d: any, index: number) => {
                    const percentage = Math.max((d.avgSqm / marketData.maxDistrictPrice) * 100, 5);
                    return (
                      <View key={d.name} style={styles.districtRow}>
                        <View style={styles.districtHeader}>
                          <Text style={styles.districtName}>{index + 1}. {d.name}</Text>
                          <Text style={styles.districtPrice}>{d.avgSqm.toLocaleString('pl-PL')} PLN</Text>
                        </View>
                        <View style={styles.districtTrack}>
                          <View style={[styles.districtFill, { width: `${percentage}%` }]} />
                        </View>
                        <Text style={styles.districtCount}>{d.count} ofert</Text>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {showVisitors ? (
              <View style={[styles.panel, styles.panelVisitors]}>
                <Text style={styles.panelTitle}>Rejestr Odwiedzających (Top 50 powracających)</Text>
                {visitorsList.map((v: any, i: number) => (
                  <View key={`${v.ip}-${i}`} style={styles.visitorRow}>
                    <Text style={styles.visitorFlag}>{getFlagEmoji(v.country)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitorIp}>{v.ip}</Text>
                      <Text style={styles.visitorMeta}>{formatStatsDateTime(v.lastVisit)}</Text>
                    </View>
                    <View style={styles.visitorCounts}>
                      <Text style={styles.visitorCount}>{v.count}</Text>
                      <Text style={styles.visitorMain}>{v.mainPageViews}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {insights?.visits?.best ? (
              <View style={styles.insightRow}>
                <View style={styles.insightCard}>
                  <Text style={styles.insightKicker}>Wizyty — najlepszy dzień</Text>
                  <Text style={styles.insightValue}>
                    {insights.visits.best.day} ({insights.visits.best.visits})
                  </Text>
                </View>
                {insights.offers?.best ? (
                  <View style={styles.insightCard}>
                    <Text style={styles.insightKicker}>Oferty — najlepszy dzień</Text>
                    <Text style={styles.insightValue}>
                      {insights.offers.best.day} ({insights.offers.best.offers})
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.chartPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
                {ADMIN_STATS_TABS.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const total = chartData.reduce((sum, item) => sum + Number(item[tab.id] || 0), 0);
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        startChartTransition(() => setActiveTabId(tab.id));
                      }}
                      style={[styles.tabBtn, isActive && { borderColor: tab.color, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                    >
                      <Ionicons name={tab.icon} size={14} color={isActive ? tab.color : '#6b7280'} />
                      <Text style={[styles.tabBtnText, isActive && { color: theme.text }]}>
                        {tab.label}{total > 0 ? ` (${total})` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
                {ADMIN_STATS_PERIODS.map((period) => (
                  <Pressable
                    key={period}
                    onPress={() => {
                      Haptics.selectionAsync();
                      startChartTransition(() => setActivePeriod(period));
                    }}
                    style={[styles.periodBtn, activePeriod === period && styles.periodBtnActive]}
                  >
                    <Text style={[styles.periodBtnText, activePeriod === period && styles.periodBtnTextActive]}>{period}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={{ position: 'relative' }}>
                {chartPending ? (
                  <View style={styles.chartLoadingOverlay}>
                    <ActivityIndicator size="small" color="#10b981" />
                    <Text style={styles.chartLoadingText}>Przeliczanie…</Text>
                  </View>
                ) : null}
                <StatsAreaChart
                  data={chartData}
                  dataKey={activeTabId}
                  color={activeTab.color}
                  width={width - 32}
                  height={280}
                  activeLabel={selectedChartLabel}
                  activeValue={selectedChartValue}
                  onSelectIndex={(index, label, value) => {
                    setSelectedChartLabel(label);
                    setSelectedChartValue(value);
                  }}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: { fontSize: 34, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  subtitle: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  moduleButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  moduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  moduleBtnMarketActive: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.1)' },
  moduleBtnVisitorsActive: { borderColor: 'rgba(59,130,246,0.35)', backgroundColor: 'rgba(59,130,246,0.1)' },
  moduleBtnText: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  panel: {
    backgroundColor: '#0a0a0a',
    borderColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },
  panelVisitors: { borderColor: 'rgba(59,130,246,0.2)' },
  panelKicker: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  panelBigValue: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 8 },
  panelUnit: { color: '#10b981', fontSize: 16 },
  panelHint: { color: '#6b7280', fontSize: 12, marginTop: 6, marginBottom: 4 },
  panelTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  filterCol: { gap: 8, marginTop: 8 },
  filterChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: { backgroundColor: '#10b981' },
  filterChipText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#000', fontWeight: '900' },
  districtRow: { marginTop: 12 },
  districtHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  districtName: { color: '#fff', fontWeight: '800', fontSize: 13, flex: 1, paddingRight: 8 },
  districtPrice: { color: '#fff', fontWeight: '900', fontSize: 14 },
  districtTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  districtFill: { height: '100%', borderRadius: 999, backgroundColor: '#10b981' },
  districtCount: { color: '#6b7280', fontSize: 10, marginTop: 4 },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  visitorFlag: { fontSize: 22, width: 30 },
  visitorIp: { color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  visitorMeta: { color: '#6b7280', fontSize: 10, marginTop: 2 },
  visitorCounts: { alignItems: 'flex-end', minWidth: 52 },
  visitorCount: { color: '#fff', fontWeight: '900', fontSize: 16 },
  visitorMain: { color: '#10b981', fontWeight: '900', fontSize: 14 },
  insightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  insightCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  insightKicker: { color: '#6b7280', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  insightValue: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 6 },
  chartLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,5,0.75)',
    borderRadius: 16,
    gap: 8,
  },
  chartLoadingText: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  chartPanel: {
    backgroundColor: '#0a0a0a',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  tabsRow: { gap: 8, paddingBottom: 10 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabBtnText: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  periodRow: { gap: 8, marginBottom: 8 },
  periodBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  periodBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  periodBtnText: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  periodBtnTextActive: { color: '#fff' },
  chartTouchRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
    flexDirection: 'row',
  },
  chartTouchCell: { flex: 1 },
  chartTooltip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5,5,5,0.85)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chartTooltipLabel: { color: '#6b7280', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  chartTooltipValue: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
});
