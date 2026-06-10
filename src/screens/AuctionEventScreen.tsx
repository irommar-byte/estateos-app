import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useI18n, getAppLocale } from '../i18n';
import type { AuctionEventRecord } from '../contracts/auctionContract';
import {
  cancelAuctionEvent,
  fetchAuctionEvent,
  placeAuctionBid,
} from '../services/auctionService';
import { formatAmountWithCurrency } from '../money/format';
import { normalizeListingCurrency } from '../money/convert';
import {
  auctionCanBid,
  auctionCountdownMs,
  auctionHasStarted,
  countdownUrgencyColor,
  formatAuctionCountdown,
} from '../utils/auctionUi';
import { openDirectContactChat } from '../utils/openDirectContact';
import { resolveMediaUrl } from '../utils/userAvatar';

function formatBidTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AuctionEventScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eventId = Number(route.params?.eventId);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const locale = getAppLocale();
  const token = useAuthStore((s) => s.token);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<AuctionEventRecord | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [tick, setTick] = useState(0);

  const accent = '#8B5CF6';
  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const load = useCallback(async () => {
    if (!Number.isFinite(eventId) || eventId <= 0) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchAuctionEvent(token, eventId);
    setEvent(data);
    if (data) setBidAmount(String(Math.round(data.nextMinBid || data.startPrice)));
    setLoading(false);
  }, [eventId, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!event) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [event]);

  const now = Date.now();
  void tick;
  const hasStarted = event ? auctionHasStarted({ ...event, now }) : false;
  const countdownMs = event ? auctionCountdownMs({ ...event, now }) : 0;
  const urgencyColor = countdownUrgencyColor(countdownMs);
  const isLive = event?.status === 'LIVE' || (event?.status === 'SCHEDULED' && hasStarted);
  const isClosed = event && !['LIVE', 'SCHEDULED'].includes(event.status);
  const canBid = Boolean(event && auctionCanBid({ ...event, now }));

  const quickBids = useMemo(() => {
    if (!event) return [];
    const base = event.nextMinBid || event.startPrice;
    const inc = event.minIncrement || Math.max(1000, Math.round(base * 0.01));
    return [base, base + inc, base + inc * 2, base + inc * 5];
  }, [event]);

  const submitBid = () => {
    if (!token) {
      Alert.alert(t('auction.event.title'), t('auction.event.loginRequired'));
      return;
    }
    if (!event) return;
    const amount = Number(String(bidAmount).replace(/\s/g, ''));
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
            setSubmitting(true);
            const result = await placeAuctionBid(token, event.id, amount);
            setSubmitting(false);
            if (!result.event) {
              Alert.alert(t('auction.event.title'), result.message || t('common.error'));
              return;
            }
            setEvent(result.event);
            setBidAmount(String(Math.round(result.event.nextMinBid)));
          })();
        },
      },
    ]);
  };

  const onCancel = () => {
    if (!token || !event) return;
    Alert.alert(t('auction.event.cancelAuction'), t('auction.event.confirmCancel'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auction.event.cancelAuction'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await cancelAuctionEvent(token, event.id);
            if (!result.event) {
              Alert.alert(t('auction.event.title'), result.message || t('common.error'));
              return;
            }
            setEvent(result.event);
          })();
        },
      },
    ]);
  };

  const thumbUri = resolveMediaUrl(event?.offer.imageUrl);

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: text }]}>{t('auction.event.title')}</Text>
        {isLive ? (
          <View style={styles.livePill}>
            <Text style={styles.liveText}>{t('auction.event.live')}</Text>
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={accent} />
      ) : !event ? (
        <Text style={[styles.empty, { color: muted }]}>{t('auction.event.loadError')}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
          <Pressable
            onPress={() =>
              navigation.navigate('OfferDetail', {
                offer: { id: event.offerId },
                id: event.offerId,
                offerId: event.offerId,
              })
            }
            style={[styles.propertyCard, { backgroundColor: card, borderColor: border }]}
          >
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Ionicons name="home-outline" size={22} color={accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.propertyTitle, { color: text }]} numberOfLines={2}>
                {event.title || event.offer.title}
              </Text>
              <Text style={{ color: muted, fontSize: 13 }}>
                {event.offer.city} · {event.offer.district}
              </Text>
              <Text style={{ color: accent, fontWeight: '700', marginTop: 4, fontSize: 13 }}>
                {t('auction.event.viewOffer')} →
              </Text>
            </View>
          </Pressable>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.statLabel, { color: muted }]}>{t('auction.event.currentPrice')}</Text>
              <Text style={[styles.statValue, { color: accent }]}>
                {formatAmountWithCurrency(event.currentPrice || event.startPrice, normalizeListingCurrency(event.currency))}
              </Text>
              <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>
                {t('openHouse.live.auctionBids', { n: event.bidCount })}
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.statLabel, { color: muted }]}>
                {hasStarted ? t('auction.event.timeLeft') : t('auction.event.countdownToStart')}
              </Text>
              <Text style={[styles.statValue, { color: urgencyColor, fontFamily: 'Menlo' }]}>
                {formatAuctionCountdown(countdownMs)}
              </Text>
            </View>
          </View>

          {!hasStarted && !event.isHost ? (
            <View style={[styles.infoBox, { backgroundColor: card, borderColor: `${urgencyColor}40`, borderWidth: 1 }]}>
              <Text style={{ color: urgencyColor, fontSize: 13, lineHeight: 18 }}>{t('auction.event.notStartedYet')}</Text>
            </View>
          ) : null}

          <View style={styles.hostActions}>
            <Pressable
              onPress={() =>
                navigation.navigate('OfferDetail', {
                  offer: { id: event.offerId },
                  id: event.offerId,
                  offerId: event.offerId,
                })
              }
              style={[styles.hostActionBtn, { borderColor: border }]}
            >
              <Text style={{ color: accent, fontWeight: '700', fontSize: 12 }}>{t('auction.event.viewOffer')}</Text>
            </Pressable>
            {!event.isHost ? (
              <Pressable
                onPress={() => void openDirectContactChat(navigation, token, event.hostUserId, event.host?.name ?? undefined)}
                style={[styles.hostActionBtn, { borderColor: border }]}
              >
                <Text style={{ color: muted, fontWeight: '700', fontSize: 12 }}>{t('auction.event.contactHost')}</Text>
              </Pressable>
            ) : null}
          </View>

          {event.isLeading ? (
            <View style={styles.leadingBanner}>
              <Ionicons name="trending-up" size={16} color="#34C759" />
              <Text style={styles.leadingText}>{t('auction.event.leading')}</Text>
            </View>
          ) : event.bidCount > 0 && !event.isHost ? (
            <View style={styles.outbidBanner}>
              <Text style={styles.outbidText}>{t('auction.event.outbid')}</Text>
            </View>
          ) : null}

          {isClosed ? (
            <View style={[styles.infoBox, { backgroundColor: card }]}>
              <Text style={[styles.infoTitle, { color: text }]}>{t('auction.event.endedTitle')}</Text>
              <Text style={{ color: muted, marginTop: 4 }}>{t('auction.event.endedHint')}</Text>
            </View>
          ) : canBid ? (
            <>
              <Text style={[styles.fieldLabel, { color: muted }]}>{t('auction.event.outbidCta')}</Text>
              <TextInput
                value={bidAmount}
                onChangeText={setBidAmount}
                keyboardType="numeric"
                style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
              />
              <Text style={{ color: muted, fontSize: 12 }}>
                {t('auction.event.nextMinBid')}:{' '}
                {formatAmountWithCurrency(event.nextMinBid, normalizeListingCurrency(event.currency))}
              </Text>
              <Text style={[styles.fieldLabel, { color: muted, marginTop: 8 }]}>{t('auction.event.quickBid')}</Text>
              <View style={styles.quickRow}>
                {quickBids.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setBidAmount(String(Math.round(q)))}
                    style={[styles.quickChip, { borderColor: 'rgba(139,92,246,0.35)' }]}
                  >
                    <Text style={{ color: accent, fontWeight: '700', fontSize: 12 }}>
                      {formatAmountWithCurrency(q, normalizeListingCurrency(event.currency))}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                disabled={submitting}
                onPress={submitBid}
                style={[styles.bidBtn, { backgroundColor: accent, opacity: submitting ? 0.7 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="hammer" size={18} color="#FFF" />
                    <Text style={styles.bidBtnText}>{t('auction.event.confirmBidBtn')}</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : event.isHost ? (
            <>
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>{t('auction.event.hostBadge')}</Text>
              </View>
              {event.status === 'LIVE' || event.status === 'SCHEDULED' ? (
                <Pressable onPress={onCancel} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>{t('auction.event.cancelAuction')}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {event.recentBids.length > 0 ? (
            <View>
              <Text style={[styles.fieldLabel, { color: muted }]}>
                {event.isHost ? t('auction.event.bidHistory') : t('auction.event.recentBids')}
              </Text>
              {event.recentBids.map((b) => (
                <View
                  key={b.id}
                  style={[
                    styles.bidRow,
                    { backgroundColor: card, borderColor: b.isMine ? 'rgba(52,199,89,0.35)' : border },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: text, fontWeight: '700' }} numberOfLines={1}>
                      {b.bidderLabel}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      {t('auction.event.bidAt', { time: formatBidTime(b.createdAt, locale) })}
                    </Text>
                  </View>
                  <Text style={{ color: accent, fontWeight: '800', marginHorizontal: 8 }}>
                    {formatAmountWithCurrency(b.amount, normalizeListingCurrency(b.currency))}
                  </Text>
                  {event.isHost && b.bidderUserId ? (
                    <Pressable
                      onPress={() =>
                        void openDirectContactChat(navigation, token, b.bidderUserId!, b.bidderLabel)
                      }
                      hitSlop={8}
                      style={styles.writeBtn}
                    >
                      <Text style={styles.writeBtnText}>{t('auction.event.writeToBidder')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  livePill: { backgroundColor: '#EF4444', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  liveText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  empty: { textAlign: 'center', marginTop: 48, paddingHorizontal: 24, fontSize: 15 },
  propertyCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTitle: { fontSize: 16, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  leadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderRadius: 12,
    padding: 12,
  },
  leadingText: { color: '#34C759', fontWeight: '700' },
  outbidBanner: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12,
    padding: 12,
  },
  outbidText: { color: '#F59E0B', fontWeight: '700' },
  infoBox: { borderRadius: 14, padding: 14 },
  infoTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  bidBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bidBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  hostBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hostBadgeText: { color: '#8B5CF6', fontWeight: '800', fontSize: 12 },
  cancelBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    padding: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#EF4444', fontWeight: '700' },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  writeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  writeBtnText: { color: '#8B5CF6', fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  hostActions: { flexDirection: 'row', gap: 8 },
  hostActionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
