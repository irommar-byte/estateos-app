import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react-native';
import { useI18n } from '../../i18n';
import { fetchOfferPriceHistory } from '../../services/offerPriceHistoryService';
import {
  buildChartSeriesFromHistory,
  buildFallbackPriceHistoryFromOffer,
  computePriceHistoryDelta,
  type OfferPriceHistoryPoint,
} from '../../utils/offerPriceHistory';
import OfferPriceHistoryChart from './OfferPriceHistoryChart';

type Props = {
  offerId: number;
  offer: unknown;
  isDark: boolean;
  token?: string | null;
  contentWidth: number;
};

function changeTypeLabel(
  changeType: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const key = String(changeType || '').toUpperCase();
  if (key === 'INITIAL') return t('offer.detail.priceHistory.changeInitial');
  if (key === 'REDUCTION' || key === 'DECREASE') return t('offer.detail.priceHistory.changeReduction');
  if (key === 'INCREASE') return t('offer.detail.priceHistory.changeIncrease');
  return t('offer.detail.priceHistory.changeUpdate');
}

export default function OfferPriceHistorySection({ offerId, offer, isDark, token, contentWidth }: Props) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<OfferPriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === 'pl' ? 'pl-PL' : locale === 'ru' ? 'ru-RU' : 'en-GB';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const remote = offerId > 0 ? await fetchOfferPriceHistory(offerId, token) : null;
      const fallback = buildFallbackPriceHistoryFromOffer(offer);
      const merged = remote && remote.length >= 2 ? remote : fallback;
      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId, offer, token]);

  const series = useMemo(() => buildChartSeriesFromHistory(rows), [rows]);
  const delta = useMemo(() => computePriceHistoryDelta(series), [series]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={isDark ? '#8E8E93' : '#007AFF'} />
      </View>
    );
  }

  if (series.length < 2) return null;

  const trendDown = delta.deltaPln < 0;
  const trendUp = delta.deltaPln > 0;
  const trendColor = trendDown ? '#10B981' : trendUp ? '#F59E0B' : '#0A84FF';
  const TrendIcon = trendDown ? TrendingDown : trendUp ? TrendingUp : Minus;
  const formatPln = (value: number) =>
    `${new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 }).format(Math.round(value))} PLN`;

  const timelineRows = [...rows].reverse().slice(0, 6);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWell, { backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)' }]}>
          <Ionicons name="analytics" size={20} color="#10B981" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{t('offer.detail.priceHistory.title')}</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{t('offer.detail.priceHistory.subtitle')}</Text>
        </View>
      </View>

      <View
        style={[
          styles.chartCard,
          isDark && { backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)' },
        ]}
      >
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>{t('offer.detail.priceHistory.startPrice')}</Text>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>{formatPln(delta.first)}</Text>
          </View>
          <View style={[styles.trendPill, { backgroundColor: `${trendColor}18`, borderColor: `${trendColor}44` }]}>
            <TrendIcon size={14} color={trendColor} strokeWidth={2.4} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {delta.deltaPercent > 0 ? '+' : ''}
              {delta.deltaPercent}%
            </Text>
          </View>
          <View style={[styles.statBlock, styles.statBlockRight]}>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>{t('offer.detail.priceHistory.currentPrice')}</Text>
            <Text style={[styles.statValue, isDark && styles.statValueDark]}>{formatPln(delta.last)}</Text>
          </View>
        </View>

        <OfferPriceHistoryChart
          data={series}
          width={contentWidth - 32}
          gradientId={`offer-price-history-${offerId}`}
        />
      </View>

      <View style={styles.timeline}>
        {timelineRows.map((row) => (
          <View
            key={`${row.id}-${row.recordedAt}`}
            style={[
              styles.timelineRow,
              isDark && { backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.06)' },
            ]}
          >
            <View style={styles.timelineLeft}>
              <Text style={[styles.timelinePrice, isDark && styles.timelinePriceDark]}>{formatPln(row.pricePln)}</Text>
              <Text style={[styles.timelineType, isDark && styles.timelineTypeDark]}>{changeTypeLabel(row.changeType, t)}</Text>
            </View>
            <Text style={[styles.timelineDate, isDark && styles.timelineDateDark]}>
              {new Date(row.recordedAt).toLocaleString(dateLocale, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    gap: 14,
  },
  loadingWrap: {
    marginTop: 28,
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#000000',
  },
  titleDark: { color: '#FFFFFF' },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  subtitleDark: { color: 'rgba(235,235,245,0.55)' },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBlock: { flex: 1, minWidth: 0 },
  statBlockRight: { alignItems: 'flex-end' },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  statLabelDark: { color: 'rgba(235,235,245,0.45)' },
  statValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#111827',
  },
  statValueDark: { color: '#FFFFFF' },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeline: { gap: 8 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  timelineLeft: { flex: 1, minWidth: 0 },
  timelinePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  timelinePriceDark: { color: '#FFFFFF' },
  timelineType: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  timelineTypeDark: { color: 'rgba(235,235,245,0.5)' },
  timelineDate: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: '#8E8E93',
    textAlign: 'right',
    flexShrink: 0,
  },
  timelineDateDark: { color: 'rgba(235,235,245,0.45)' },
});
