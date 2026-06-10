import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useThemeStore } from '../../store/useThemeStore';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { OpenHouseTickerItem } from '../../contracts/openHouseContract';
import type { AuctionEventRecord } from '../../contracts/auctionContract';
import { useI18n, getAppLocale } from '../../i18n';
import { resolveMediaUrl } from '../../utils/userAvatar';
import {
  formatOpenHouseLiveDateShort,
  formatOpenHouseLiveDetail,
  formatOpenHouseLiveLocation,
} from './openHouseLiveFormat';
import LiveEventCountdown from './LiveEventCountdown';
import ScrollingNewsLine from './ScrollingNewsLine';
import { fetchLiveAuctionEvents } from '../../services/auctionService';
import { formatAmountWithCurrency } from '../../money/format';
import { normalizeListingCurrency } from '../../money/convert';
import { auctionCountdownMs, auctionHasStarted } from '../../utils/auctionUi';
import { formatLiveDistanceKm } from '../../utils/liveDistance';
import { openDirectContactChat } from '../../utils/openDirectContact';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type SectionRow =
  | { kind: 'open_house'; item: OpenHouseTickerItem }
  | { kind: 'auction'; item: AuctionEventRecord };

export default function OpenHouseLivePanel({ visible, onClose }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const { t } = useI18n();
  const locale = getAppLocale();
  const items = useOpenHouseLiveStore((s) => s.items);
  const reservedEventIds = useOpenHouseLiveStore((s) => s.reservedEventIds);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';
  const text = isDark ? '#F3F4F6' : '#111827';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#6B7280';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const [auctionEvents, setAuctionEvents] = useState<AuctionEventRecord[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        setAuctionEvents(await fetchLiveAuctionEvents(token));
      } catch {
        setAuctionEvents([]);
      }
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        }
      } catch {
        /* brak lokalizacji */
      }
    })();
  }, [visible, token]);

  const reservedSet = useMemo(() => new Set(reservedEventIds), [reservedEventIds]);

  const sortedOpenHouse = useMemo(() => {
    return [...items].sort((a, b) => {
      const aMine = reservedSet.has(a.eventId) ? 0 : 1;
      const bMine = reservedSet.has(b.eventId) ? 0 : 1;
      return aMine - bMine;
    });
  }, [items, reservedSet]);

  const sections = useMemo(() => {
    const out: Array<{ title: string; accent: string; data: SectionRow[] }> = [];
    if (sortedOpenHouse.length) {
      out.push({
        title: t('openHouse.live.sectionOpenHouse'),
        accent: '#10B981',
        data: sortedOpenHouse.map((item) => ({ kind: 'open_house' as const, item })),
      });
    }
    if (auctionEvents.length) {
      out.push({
        title: t('openHouse.live.sectionAuction'),
        accent: '#8B5CF6',
        data: auctionEvents.map((item) => ({ kind: 'auction' as const, item })),
      });
    }
    return out;
  }, [sortedOpenHouse, auctionEvents, t]);

  const openOpenHouse = useCallback(
    (eventId: number) => {
      onClose();
      navigation.dispatch(CommonActions.navigate({ name: 'OpenHouseEvent', params: { eventId } }));
    },
    [navigation, onClose],
  );

  const openAuction = useCallback(
    (eventId: number) => {
      onClose();
      navigation.dispatch(CommonActions.navigate({ name: 'AuctionEvent', params: { eventId } }));
    },
    [navigation, onClose],
  );

  const openOffer = useCallback(
    (offerId: number) => {
      onClose();
      navigation.dispatch(
        CommonActions.navigate({
          name: 'OfferDetail',
          params: { offer: { id: offerId }, id: offerId, offerId },
        }),
      );
    },
    [navigation, onClose],
  );

  const renderOpenHouseCard = (item: OpenHouseTickerItem) => {
    const thumb = resolveMediaUrl(item.imageUrl);
    const location = formatOpenHouseLiveLocation(item);
    const dateShort = formatOpenHouseLiveDateShort(item.startsAt, locale);
    const invite = formatOpenHouseLiveDetail(item, locale);
    const isMine = reservedSet.has(item.eventId);
    const distance = formatLiveDistanceKm(userLat, userLng, item.lat, item.lng, locale);

    return (
      <Pressable
        onPress={() => openOpenHouse(item.eventId)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardBg, borderColor: isMine ? '#10B981' : cardBorder },
          isMine && styles.cardPinned,
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.cardRow}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, isDark && styles.thumbFallbackDark]}>
              <Ionicons name="home-outline" size={16} color={muted} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.metaLine, { color: muted }]} numberOfLines={1}>
              {location} · {dateShort}
              {distance ? ` · ${distance}` : ''}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.spotsText, { color: muted }]}>
                {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
              </Text>
              <LiveEventCountdown startsAt={item.startsAt} compact urgency />
            </View>
            <View style={styles.actionRow}>
              {item.hostUserId ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    void openDirectContactChat(navigation, token, item.hostUserId!, undefined);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.actionLink}>{t('openHouse.live.contactHost')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  openOffer(item.offerId);
                }}
                hitSlop={8}
              >
                <Text style={[styles.actionLink, { color: muted }]}>{t('openHouse.live.viewOffer')}</Text>
              </Pressable>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color={muted} style={styles.chevron} />
        </View>
        <ScrollingNewsLine
          text={invite}
          textStyle={[styles.tickerText, { color: muted }]}
          height={22}
          backgroundColor={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
          borderBottomRadius={10}
          pxPerSec={40}
        />
      </Pressable>
    );
  };

  const renderAuctionCard = (event: AuctionEventRecord) => {
    const thumb = resolveMediaUrl(event.offer.imageUrl);
    const started = auctionHasStarted(event);
    const targetAt = started ? event.effectiveEndsAt : event.startsAt;
    const price = formatAmountWithCurrency(
      event.currentPrice || event.startPrice,
      normalizeListingCurrency(event.currency),
    );
    const distance = formatLiveDistanceKm(userLat, userLng, event.offer.lat, event.offer.lng, locale);

    return (
      <Pressable
        onPress={() => openAuction(event.id)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardBg, borderColor: 'rgba(139,92,246,0.35)' },
          pressed && { opacity: 0.88 },
        ]}
      >
        <View style={styles.cardRow}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Ionicons name="hammer-outline" size={16} color="#8B5CF6" />
            </View>
          )}
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
                {event.title || event.offer.title}
              </Text>
              {event.status === 'LIVE' || started ? (
                <View style={styles.liveDot}>
                  <Text style={styles.liveDotText}>LIVE</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.metaLine, { color: muted }]} numberOfLines={1}>
              {event.offer.city} · {event.offer.district}
              {distance ? ` · ${distance}` : ''}
            </Text>
            <Text style={[styles.priceLine, { color: '#8B5CF6' }]}>{price}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.spotsText, { color: muted }]}>
                {t('openHouse.live.auctionBids', { n: event.bidCount })}
              </Text>
              <LiveEventCountdown targetAt={targetAt} compact urgency />
            </View>
            <View style={styles.countdownFull}>
              <LiveEventCountdown targetAt={targetAt} urgency />
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  void openDirectContactChat(navigation, token, event.hostUserId, event.host?.name ?? undefined);
                }}
                hitSlop={8}
              >
                <Text style={[styles.actionLink, { color: '#8B5CF6' }]}>{t('openHouse.live.contactHost')}</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  openOffer(event.offerId);
                }}
                hitSlop={8}
              >
                <Text style={[styles.actionLink, { color: muted }]}>{t('openHouse.live.viewOffer')}</Text>
              </Pressable>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color={muted} style={styles.chevron} />
        </View>
        <View style={[styles.auctionTicker, { backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)' }]}>
          <Text style={[styles.tickerText, { color: muted }]}>
            {started
              ? t('openHouse.live.auctionLiveHint')
              : t('openHouse.live.auctionStartsHint', {
                  date: formatOpenHouseLiveDateShort(event.startsAt, locale),
                })}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={isDark ? 50 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 12,
            paddingTop: insets.top + 10,
            backgroundColor: isDark ? 'rgba(18,18,20,0.96)' : 'rgba(247,247,248,0.98)',
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: text }]}>{t('openHouse.live.panelTitle')}</Text>
            <Text style={[styles.sheetSubtitle, { color: muted }]}>{t('openHouse.live.panelSubtitleDual')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="close" size={18} color={text} />
          </Pressable>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(row) => (row.kind === 'open_house' ? row.item.id : `auc-${row.item.id}`)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: section.accent }]} />
              <Text style={[styles.sectionTitle, { color: text }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item: row }) =>
            row.kind === 'open_house' ? renderOpenHouseCard(row.item) : renderAuctionCard(row.item)
          }
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={{ color: muted, textAlign: 'center', marginTop: 32, fontSize: 13 }}>
              {t('openHouse.live.panelEmpty')}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    flex: 1,
    marginTop: 56,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetSubtitle: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardPinned: { borderWidth: 1.5 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  thumbFallback: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  liveDot: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDotText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  metaLine: { fontSize: 11, lineHeight: 14 },
  priceLine: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  countdownFull: { marginTop: 4, marginBottom: 2 },
  spotsText: { fontSize: 10, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionLink: { fontSize: 10, fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.4 },
  chevron: { marginTop: 10 },
  tickerText: { fontSize: 10, fontWeight: '500' },
  auctionTicker: { paddingHorizontal: 10, paddingVertical: 6 },
});
