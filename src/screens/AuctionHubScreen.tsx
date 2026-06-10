import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useI18n } from '../i18n';
import { hasActiveInvestorProMembership } from '../utils/investorProMembership';
import {
  fetchHostAuctionEvents,
  fetchLiveAuctionEvents,
  fetchMyAuctionBids,
} from '../services/auctionService';
import type { AuctionEventRecord, AuctionMyBidRecord } from '../contracts/auctionContract';
import { resolveMediaUrl } from '../utils/userAvatar';
import { formatAmountWithCurrency } from '../money/format';
import { normalizeListingCurrency } from '../money/convert';

type Tab = 'discover' | 'host' | 'bids';

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function AuctionHubScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [tab, setTab] = useState<Tab>('discover');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<AuctionEventRecord[]>([]);
  const [bids, setBids] = useState<AuctionMyBidRecord[]>([]);

  const isPro = hasActiveInvestorProMembership(user);
  const accent = '#8B5CF6';
  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      if (tab === 'discover') {
        setBids([]);
        setEvents(await fetchLiveAuctionEvents(token));
      } else if (tab === 'host') {
        setBids([]);
        setEvents(token ? await fetchHostAuctionEvents(token) : []);
      } else if (tab === 'bids') {
        setEvents([]);
        setBids(token ? await fetchMyAuctionBids(token) : []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const renderEventCard = ({ item }: { item: AuctionEventRecord }) => {
    const priceLabel = formatAmountWithCurrency(
      item.currentPrice || item.startPrice,
      normalizeListingCurrency(item.currency)
    );
    const thumbUri = resolveMediaUrl(item.offer.imageUrl);
    const statusLabel =
      item.status === 'LIVE'
        ? t('auction.hub.statusLive')
        : item.status === 'SCHEDULED'
          ? t('auction.hub.statusScheduled')
          : t('auction.hub.statusEnded');

    return (
      <Pressable
        onPress={() => navigation.navigate('AuctionEvent', { eventId: item.id })}
        style={[styles.card, { backgroundColor: card }]}
      >
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="hammer-outline" size={24} color={accent} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
            {item.title || item.offer.title}
          </Text>
          <Text style={[styles.cardMeta, { color: muted }]}>
            {item.offer.city} · {item.offer.district}
          </Text>
          <Text style={[styles.cardAccent, { color: accent }]}>
            {t('auction.hub.currentPrice', { price: priceLabel })}
          </Text>
          <Text style={[styles.cardMeta, { color: muted }]}>
            {statusLabel} · {t('auction.hub.bidCount', { n: item.bidCount })}
            {item.timeRemainingMs > 0 ? ` · ${t('auction.hub.timeLeft', { time: formatCountdown(item.timeRemainingMs) })}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </Pressable>
    );
  };

  const renderBidCard = ({ item }: { item: AuctionMyBidRecord }) =>
    renderEventCard({ item: item.event });

  const listData = tab === 'bids' ? bids : events;
  const emptyCopy =
    tab === 'discover'
      ? t('auction.hub.emptyDiscover')
      : tab === 'host'
        ? t('auction.hub.emptyHost')
        : t('auction.hub.emptyBids');

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: text }]}>{t('auction.hub.title')}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{t('auction.hub.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['discover', t('auction.hub.tabDiscover')],
            ['host', t('auction.hub.tabHost')],
            ['bids', t('auction.hub.tabBids')],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && { backgroundColor: 'rgba(139,92,246,0.22)' }]}
          >
            <Text style={[styles.tabText, tab === key && { color: accent }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {isPro ? (
        <Pressable
          onPress={() => navigation.navigate('AuctionCreate')}
          style={[styles.createBtn, { backgroundColor: accent }]}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.createBtnText}>{t('auction.hub.createCta')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.proBanner, { backgroundColor: card }]}>
          <Ionicons name="diamond-outline" size={18} color={accent} />
          <Text style={[styles.proBannerText, { color: muted }]}>{t('auction.hub.proRequired')}</Text>
        </View>
      )}

      {loading && listData.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={accent} />
      ) : (
        <FlatList
          data={listData as any[]}
          keyExtractor={(item) =>
            tab === 'bids' ? String((item as AuctionMyBidRecord).bidId) : String((item as AuctionEventRecord).id)
          }
          renderItem={({ item }) =>
            tab === 'bids' ? renderBidCard({ item: item as AuctionMyBidRecord }) : renderEventCard({ item: item as AuctionEventRecord })
          }
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={accent} />
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: muted }]}>{emptyCopy}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(142,142,147,0.14)',
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  createBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  proBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 13 },
  cardAccent: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15, lineHeight: 22, paddingHorizontal: 24 },
});
