import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NumericKeyboardAccessory from '../NumericKeyboardAccessory';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { fetchLiveAuctionEvents, placeAuctionBid } from '../../services/auctionService';
import { formatAmountWithCurrency } from '../../money/format';
import { normalizeListingCurrency } from '../../money/convert';
import { auctionCanBid, auctionHasStarted } from '../../utils/auctionUi';
import { formatLiveDistanceKm } from '../../utils/liveDistance';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type LiveDivision = 'open_house' | 'auction';

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
  const [bidDrafts, setBidDrafts] = useState<Record<number, string>>({});
  const [submittingBidId, setSubmittingBidId] = useState<number | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [division, setDivision] = useState<LiveDivision>('open_house');

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

  useEffect(() => {
    setBidDrafts((prev) => {
      const next = { ...prev };
      for (const event of auctionEvents) {
        if (next[event.id] == null) {
          next[event.id] = String(Math.round(event.nextMinBid || event.startPrice));
        }
      }
      return next;
    });
  }, [auctionEvents]);

  const submitCardBid = useCallback(
    (event: AuctionEventRecord) => {
      const amount = Number(String(bidDrafts[event.id] ?? '').replace(/\s/g, ''));
      if (!token) {
        Alert.alert(t('auction.event.title'), t('auction.event.loginRequired'));
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert(t('auction.event.title'), t('auction.event.bidTooLow'));
        return;
      }
      Alert.alert(t('auction.event.confirmBidTitle'), t('auction.event.confirmBidBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auction.event.outbidCta'),
          onPress: () => {
            void (async () => {
              setSubmittingBidId(event.id);
              const result = await placeAuctionBid(token, event.id, amount);
              setSubmittingBidId(null);
              if (!result.event) {
                Alert.alert(t('auction.event.title'), result.message || t('common.error'));
                return;
              }
              setAuctionEvents((items) =>
                items.map((item) => (item.id === result.event!.id ? result.event! : item)),
              );
              setBidDrafts((prev) => ({
                ...prev,
                [result.event!.id]: String(Math.round(result.event!.nextMinBid)),
              }));
            })();
          },
        },
      ]);
    },
    [bidDrafts, t, token],
  );

  const reservedSet = useMemo(() => new Set(reservedEventIds), [reservedEventIds]);

  const sortedOpenHouse = useMemo(() => {
    return [...items].sort((a, b) => {
      const aMine = reservedSet.has(a.eventId) ? 0 : 1;
      const bMine = reservedSet.has(b.eventId) ? 0 : 1;
      return aMine - bMine;
    });
  }, [items, reservedSet]);

  const divisionTabs = useMemo(
    () =>
      [
        {
          key: 'open_house' as const,
          label: t('openHouse.live.sectionOpenHouse'),
          accent: '#10B981',
          count: sortedOpenHouse.length,
          icon: 'home-outline' as const,
        },
        {
          key: 'auction' as const,
          label: t('openHouse.live.sectionAuction'),
          accent: '#8B5CF6',
          count: auctionEvents.length,
          icon: 'hammer-outline' as const,
        },
      ] as const,
    [sortedOpenHouse.length, auctionEvents.length, t],
  );

  useEffect(() => {
    if (!visible) return;
    if (division === 'open_house' && sortedOpenHouse.length === 0 && auctionEvents.length > 0) {
      setDivision('auction');
    } else if (division === 'auction' && auctionEvents.length === 0 && sortedOpenHouse.length > 0) {
      setDivision('open_house');
    }
  }, [visible, division, sortedOpenHouse.length, auctionEvents.length]);

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

  const renderCountdownStrip = (
    targetAt: string | null,
    accent: string,
    options?: { live?: boolean; untilEnd?: boolean },
  ) => (
    <View
      style={[
        styles.countdownStrip,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      <Text style={[styles.countdownPrefix, { color: muted }]}>
        {options?.untilEnd === false
          ? t('openHouse.live.countdownToStart')
          : t('openHouse.live.countdownToEnd')}
      </Text>
      <View style={styles.countdownValue}>
        <LiveEventCountdown targetAt={targetAt} compact urgency accent={accent} />
      </View>
      {options?.live ? (
        <View style={[styles.liveDot, styles.liveDotStrip]}>
          <Text style={styles.liveDotText}>LIVE</Text>
        </View>
      ) : null}
    </View>
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
        {renderCountdownStrip(item.startsAt, '#10B981', { untilEnd: false })}
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
            <Text style={[styles.spotsText, { color: muted, marginTop: 2 }]}>
              {t('openHouse.hub.spotsLeft', { n: item.spotsLeft })}
            </Text>
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
          repeat="restart"
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
    const canBid = auctionCanBid({ ...event, now: Date.now() });
    const isSubmitting = submittingBidId === event.id;
    const tickerText = [
      !started
        ? t('openHouse.live.auctionStartsHint', {
            date: formatOpenHouseLiveDateShort(event.startsAt, locale),
          })
        : t('openHouse.live.auctionLiveHint'),
      event.description?.trim(),
    ]
      .filter(Boolean)
      .join(' ◆ ');

    return (
      <Pressable
        onPress={event.isHost || !canBid ? () => openAuction(event.id) : undefined}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardBg, borderColor: 'rgba(139,92,246,0.35)' },
          pressed && (event.isHost || !canBid) && { opacity: 0.88 },
        ]}
      >
        {renderCountdownStrip(targetAt, '#8B5CF6', {
          live: event.status === 'LIVE' || started,
          untilEnd: started,
        })}
        <View style={styles.cardRow}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Ionicons name="hammer-outline" size={16} color="#8B5CF6" />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
              {event.title || event.offer.title}
            </Text>
            <Text style={[styles.metaLine, { color: muted }]} numberOfLines={1}>
              {event.offer.city} · {event.offer.district}
              {distance ? ` · ${distance}` : ''}
            </Text>
            <Text style={[styles.priceLabel, { color: muted }]}>
              {t('openHouse.live.currentAuctionPrice')}
            </Text>
            <Text style={[styles.priceValue, { color: '#8B5CF6' }]}>{price}</Text>
            <Text style={[styles.spotsText, { color: muted }]}>
              {t('openHouse.live.auctionBids', { n: event.bidCount })}
            </Text>
            {event.isLeading ? (
              <Text style={styles.leadingHint}>{t('openHouse.live.yourOfferLeading')}</Text>
            ) : event.bidCount > 0 && event.recentBids.some((b) => b.isMine) ? (
              <Text style={styles.outbidHint}>{t('auction.event.outbid')}</Text>
            ) : null}
          </View>
          {event.isHost ? (
            <Ionicons name="chevron-forward" size={14} color={muted} style={styles.chevron} />
          ) : null}
        </View>

        {canBid ? (
          <View
            style={[
              styles.bidRow,
              {
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                backgroundColor: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)',
              },
            ]}
          >
            <Text style={[styles.bidRowLabel, { color: muted }]}>{t('openHouse.live.outbidCta')}</Text>
            <TextInput
              value={bidDrafts[event.id] ?? ''}
              onChangeText={(v) => setBidDrafts((prev) => ({ ...prev, [event.id]: v }))}
              keyboardType="numeric"
              placeholder={String(Math.round(event.nextMinBid))}
              placeholderTextColor={muted}
              style={[
                styles.bidInput,
                {
                  color: text,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.2)',
                },
              ]}
            />
            <Pressable
              disabled={isSubmitting}
              onPress={() => submitCardBid(event)}
              style={[styles.bidSubmit, { opacity: isSubmitting ? 0.65 : 1 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.bidSubmitText}>{t('auction.event.confirmBidBtn')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <ScrollingNewsLine
          text={tickerText || t('openHouse.live.auctionLiveHint')}
          textStyle={[styles.tickerText, { color: muted }]}
          height={22}
          backgroundColor={isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)'}
          borderBottomRadius={10}
          pxPerSec={36}
          repeat="restart"
        />
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

        <View
          style={[
            styles.segmentedOuter,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#E8E8ED',
              borderColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <View
            style={[
              styles.segmentedInner,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.04)' },
            ]}
          >
            {divisionTabs.map((tab) => {
              const active = division === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setDivision(tab.key)}
                  style={[
                    styles.segment,
                    active && [
                      styles.segmentActive,
                      {
                        backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
                        shadowColor: '#000',
                      },
                    ],
                  ]}
                >
                  <View style={styles.segmentTopRow}>
                    <Ionicons name={tab.icon} size={13} color={active ? tab.accent : muted} />
                    <View
                      style={[
                        styles.segmentBadge,
                        {
                          backgroundColor: active ? `${tab.accent}18` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      <Text style={[styles.segmentBadgeText, { color: active ? tab.accent : muted }]}>
                        {tab.count}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.segmentLabel, { color: active ? text : muted, opacity: active ? 1 : 0.72 }]}
                    numberOfLines={2}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.divisionLead, { color: muted }]}>
          {division === 'open_house' ? t('openHouse.live.openHouseLead') : t('openHouse.live.auctionLead')}
        </Text>

        {division === 'open_house' ? (
          <FlatList
            data={sortedOpenHouse}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderOpenHouseCard(item)}
            contentContainerStyle={{ gap: 8, paddingBottom: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={{ color: muted, textAlign: 'center', marginTop: 32, fontSize: 13 }}>
                {t('openHouse.live.openHouseEmpty')}
              </Text>
            }
          />
        ) : (
          <FlatList
            data={auctionEvents}
            keyExtractor={(item) => `auc-${item.id}`}
            renderItem={({ item }) => renderAuctionCard(item)}
            contentContainerStyle={{ gap: 8, paddingBottom: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <Text style={{ color: muted, textAlign: 'center', marginTop: 32, fontSize: 13 }}>
                {t('openHouse.live.auctionEmpty')}
              </Text>
            }
          />
        )}
      </View>
    <NumericKeyboardAccessory />
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
  segmentedOuter: {
    borderRadius: 13,
    padding: 2,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentedInner: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 11,
  },
  segment: {
    flex: 1,
    minHeight: 52,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  segmentActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2.5,
    elevation: 2,
  },
  segmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentLabel: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 11,
    letterSpacing: 0.15,
  },
  segmentBadge: {
    minWidth: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  segmentBadgeText: { fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
  divisionLead: { fontSize: 12, lineHeight: 16, marginBottom: 8, paddingHorizontal: 2 },
  countdownStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  countdownPrefix: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  countdownValue: { flex: 1 },
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
  cardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  liveDot: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDotStrip: { marginLeft: 'auto' },
  liveDotText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  metaLine: { fontSize: 11, lineHeight: 14 },
  priceLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  priceValue: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  spotsText: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  leadingHint: { fontSize: 10, fontWeight: '800', color: '#34C759', marginTop: 3 },
  outbidHint: { fontSize: 10, fontWeight: '800', color: '#F59E0B', marginTop: 3 },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bidRowLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, width: 52 },
  bidInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bidSubmit: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  bidSubmitText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  chevron: { marginTop: 10 },
  tickerText: { fontSize: 10, fontWeight: '500' },
});
