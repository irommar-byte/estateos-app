import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buildBuyerIntentSummary,
  computeBuyerSearchAnalytics,
  extractSearchSnapshotsFromUser,
  formatSnapshotDate,
  radarPreferenceDetailRows,
  type SearchPatternGroup,
} from '../../utils/adminBuyerSearchProfile';
import { coalesceRadarPreferenceFromPayload } from '../../services/adminUserRadarService';

type ThemeSlice = { text: string; subtitle: string; glass?: string };

type Props = {
  user: unknown;
  theme: ThemeSlice;
  isDark: boolean;
  radarFetchMiss?: boolean;
};

function confidenceColor(level: 'low' | 'medium' | 'high'): string {
  if (level === 'high') return '#34C759';
  if (level === 'medium') return '#FF9F0A';
  return '#8E8E93';
}

function PatternGroupRow({
  group,
  theme,
  isDark,
}: {
  group: SearchPatternGroup;
  theme: ThemeSlice;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.snapshotRow,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View style={styles.snapshotTop}>
        <View style={[styles.countBadge, { backgroundColor: 'rgba(175,82,222,0.15)', borderColor: 'rgba(175,82,222,0.35)' }]}>
          <Text style={[styles.countBadgeText, { color: '#AF52DE' }]}>{group.count}×</Text>
        </View>
        <Text style={[styles.shareText, { color: theme.subtitle }]}>{group.sharePercent}% wyszukiwań</Text>
        <Text style={[styles.snapshotDate, { color: theme.subtitle }]}>{formatSnapshotDate(group.lastSavedAtIso)}</Text>
      </View>
      <Text style={[styles.snapshotTitle, { color: theme.text }]} numberOfLines={2}>
        {group.title}
      </Text>
      <Text style={[styles.snapshotSubtitle, { color: theme.subtitle }]} numberOfLines={4}>
        {group.subtitle}
      </Text>
    </View>
  );
}

export default function AdminBuyerSearchSection({ user, theme, isDark, radarFetchMiss }: Props) {
  const snapshots = useMemo(() => extractSearchSnapshotsFromUser(user), [user]);
  const analytics = useMemo(() => computeBuyerSearchAnalytics(snapshots), [snapshots]);
  const summary = useMemo(() => buildBuyerIntentSummary(snapshots), [snapshots]);
  const radarPref = useMemo(() => coalesceRadarPreferenceFromPayload(user), [user]);
  const detailRows = useMemo(() => radarPreferenceDetailRows(radarPref), [radarPref]);
  const surface = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={styles.wrap}>
      {radarFetchMiss && (
        <View
          style={[
            styles.warnBanner,
            {
              backgroundColor: isDark ? 'rgba(255,149,0,0.12)' : 'rgba(255,149,0,0.1)',
              borderColor: 'rgba(255,149,0,0.35)',
            },
          ]}
        >
          <Ionicons name="warning" size={18} color="#FF9F0A" />
          <Text style={[styles.warnText, { color: theme.text }]}>
            Radar jest włączony, ale w odpowiedzi API brakuje parametrów (miasto, dzielnice, rok, cena…).
            Zamknij kartę i otwórz ponownie po kalibracji użytkownika.
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Profil kupującego</Text>
      <View style={[styles.summaryCard, { backgroundColor: surface, borderColor: border }]}>
        <View style={styles.probabilityRow}>
          <View style={[styles.probabilityCircle, { borderColor: confidenceColor(summary.confidence) }]}>
            <Text style={[styles.probabilityValue, { color: theme.text }]}>{summary.probabilityPercent}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.probabilityTitle, { color: theme.text }]}>Prawdopodobieństwo profilu</Text>
            <Text style={[styles.probabilityMeta, { color: theme.subtitle }]}>
              {summary.probabilityLabel} · {analytics.historyEvents} wyszukiwań w historii
            </Text>
          </View>
        </View>

        <Text style={[styles.summaryHeadline, { color: theme.text }]}>{summary.headline}</Text>
        {summary.bullets.map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={[styles.bulletText, { color: theme.subtitle }]}>{line}</Text>
          </View>
        ))}
      </View>

      {analytics.dimensionFrequencies.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Częstotliwość parametrów</Text>
          <View style={[styles.detailCard, { backgroundColor: surface, borderColor: border }]}>
            {analytics.dimensionFrequencies.map((row, idx) => (
              <View
                key={`${row.dimension}-${row.value}`}
                style={[
                  styles.freqRow,
                  idx < analytics.dimensionFrequencies.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: border,
                  },
                ]}
              >
                <Text style={[styles.freqDim, { color: theme.subtitle }]}>{row.dimension}</Text>
                <Text style={[styles.freqVal, { color: theme.text }]} numberOfLines={1}>
                  {row.value}
                </Text>
                <Text style={[styles.freqCount, { color: '#AF52DE' }]}>
                  {row.count}× · {row.sharePercent}%
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Radar — ustawienia</Text>
      {detailRows.length === 0 ? (
        <Text style={[styles.emptyHint, { color: theme.subtitle }]}>
          Brak zapisanych preferencji radaru dla tego konta.
        </Text>
      ) : (
        <View style={[styles.detailCard, { backgroundColor: surface, borderColor: border }]}>
          {detailRows.map((row, idx) => (
            <View
              key={row.label}
              style={[
                styles.detailRow,
                idx < detailRows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: border,
                },
              ]}
            >
              <Text style={[styles.detailLabel, { color: theme.subtitle }]}>{row.label}</Text>
              <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={3}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
        Historia wyszukiwań ({analytics.historyEvents} zdarzeń · {analytics.patternGroups.length} wzorców)
      </Text>
      {analytics.patternGroups.length === 0 ? (
        <Text style={[styles.emptyHint, { color: theme.subtitle }]}>
          Brak historii na serwerze. Każda kalibracja radaru i wyszukiwanie zaawansowane zapisuje się przez POST
          /api/radar/search-history (wymaga wdrożenia backendu).
        </Text>
      ) : (
        analytics.patternGroups.map((group) => (
          <PatternGroupRow key={group.fingerprint} group={group} theme={theme} isDark={isDark} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20 },
  warnBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  probabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  probabilityCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probabilityValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  probabilityTitle: { fontSize: 15, fontWeight: '800' },
  probabilityMeta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  summaryHeadline: { fontSize: 15, fontWeight: '700', lineHeight: 22, letterSpacing: -0.2, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bulletMark: { color: '#8E8E93', fontSize: 14, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  detailCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  detailValue: { fontSize: 13, fontWeight: '800', flex: 1.2, textAlign: 'right' },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  freqDim: { fontSize: 11, fontWeight: '700', width: 72, textTransform: 'uppercase' },
  freqVal: { flex: 1, fontSize: 13, fontWeight: '700' },
  freqCount: { fontSize: 12, fontWeight: '800' },
  emptyHint: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 4 },
  snapshotRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
  },
  snapshotTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  countBadgeText: { fontSize: 12, fontWeight: '900' },
  shareText: { flex: 1, fontSize: 11, fontWeight: '700' },
  snapshotDate: { fontSize: 11, fontWeight: '600' },
  snapshotTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  snapshotSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
});
