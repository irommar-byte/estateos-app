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
import { useI18n, localeToDateFormat } from '../i18n';
import { hasActiveInvestorProMembership } from '../utils/investorProMembership';
import {
  fetchHostOpenHouseEvents,
  fetchMyOpenHouseReservations,
  fetchPublishedOpenHouseEvents,
} from '../services/openHouseService';
import type { OpenHouseEventRecord, OpenHouseReservationRecord } from '../contracts/openHouseContract';

type Tab = 'discover' | 'host' | 'reservations';

export default function OpenHouseHubScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [tab, setTab] = useState<Tab>('discover');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<OpenHouseEventRecord[]>([]);
  const [reservations, setReservations] = useState<OpenHouseReservationRecord[]>([]);

  const isPro = hasActiveInvestorProMembership(user);
  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'discover') {
        setEvents(await fetchPublishedOpenHouseEvents(token));
      } else if (tab === 'host' && token) {
        setEvents(await fetchHostOpenHouseEvents(token));
      } else if (tab === 'reservations' && token) {
        setReservations(await fetchMyOpenHouseReservations(token));
      }
    } finally {
      setLoading(false);
    }
  }, [tab, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const renderEventCard = ({ item }: { item: OpenHouseEventRecord }) => {
    const dateLabel = item.nextSlotStartsAt
      ? new Date(item.nextSlotStartsAt).toLocaleString(localeToDateFormat(locale), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

    return (
      <Pressable
        onPress={() => navigation.navigate('OpenHouseEvent', { eventId: item.id })}
        style={[styles.card, { backgroundColor: card }]}
      >
        {item.offer.imageUrl ? (
          <Image source={{ uri: item.offer.imageUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="home-outline" size={24} color="#F59E0B" />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.cardMeta, { color: muted }]}>
            {item.offer.city} · {item.offer.district}
          </Text>
          <Text style={styles.cardAccent}>
            {t('openHouse.hub.nextSlot', { date: dateLabel })}
          </Text>
          <Text style={[styles.cardMeta, { color: muted }]}>
            {t('openHouse.hub.spotsLeft', { n: item.totalSpotsLeft })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </Pressable>
    );
  };

  const listData = tab === 'reservations' ? reservations : events;
  const emptyCopy =
    tab === 'discover'
      ? t('openHouse.hub.emptyDiscover')
      : tab === 'host'
        ? t('openHouse.hub.emptyHost')
        : t('openHouse.hub.emptyReservations');

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: text }]}>{t('openHouse.hub.title')}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{t('openHouse.hub.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['discover', t('openHouse.hub.tabDiscover')],
            ['host', t('openHouse.hub.tabHost')],
            ['reservations', t('openHouse.hub.tabReservations')],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {isPro ? (
        <Pressable
          onPress={() => navigation.navigate('OpenHouseCreate')}
          style={styles.createBtn}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.createBtnText}>{t('openHouse.hub.createCta')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.proBanner, { backgroundColor: card }]}>
          <Ionicons name="diamond-outline" size={18} color="#F59E0B" />
          <Text style={[styles.proBannerText, { color: muted }]}>{t('openHouse.hub.proRequired')}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#F59E0B" />
      ) : (
        <FlatList
          data={listData as any[]}
          keyExtractor={(item) =>
            tab === 'reservations' ? String((item as OpenHouseReservationRecord).reservationId) : String((item as OpenHouseEventRecord).id)
          }
          renderItem={({ item }) =>
            tab === 'reservations' ? (
              renderEventCard({ item: (item as OpenHouseReservationRecord).event })
            ) : (
              renderEventCard({ item: item as OpenHouseEventRecord })
            )
          }
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#F59E0B" />}
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(142,142,147,0.14)',
  },
  tabActive: { backgroundColor: 'rgba(245,158,11,0.22)' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  tabTextActive: { color: '#F59E0B' },
  createBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F59E0B',
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
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 13 },
  cardAccent: { fontSize: 13, fontWeight: '700', color: '#F59E0B', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15, lineHeight: 22, paddingHorizontal: 24 },
});
