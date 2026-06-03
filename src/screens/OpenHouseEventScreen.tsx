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
import { useI18n, localeToDateFormat } from '../i18n';
import type {
  OpenHouseEventRecord,
  OpenHouseSlotRecord,
  OpenHouseVisitMode,
} from '../contracts/openHouseContract';
import {
  cancelOpenHouseReservation,
  fetchOpenHouseEvent,
  reserveOpenHouseSlot,
  updateOpenHouseEvent,
} from '../services/openHouseService';
import { normalizeListingCurrency } from '../money/convert';
import { formatAmountWithCurrency } from '../money/format';
import { resolveMediaUrl } from '../utils/userAvatar';
import { offerOpenHouseCalendarAfterReserve } from '../utils/openHouseCalendar';
import { useOpenHouseLiveStore } from '../store/useOpenHouseLiveStore';

export default function OpenHouseEventScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eventId = Number(route.params?.eventId);
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const token = useAuthStore((s) => s.token);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<OpenHouseEventRecord | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState('');

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
    const data = await fetchOpenHouseEvent(token, eventId);
    setEvent(
      data
        ? {
            ...data,
            visitMode: (data.visitMode ?? 'FLEX') as OpenHouseVisitMode,
          }
        : null
    );
    if (data?.slots?.length) {
      const booked = data.slots.find((s) => s.myReservation);
      if (booked) setSelectedSlotId(booked.id);
      else if (data.visitMode === 'FLEX' && data.slots.length === 1) setSelectedSlotId(data.slots[0].id);
      else setSelectedSlotId(null);
    } else {
      setSelectedSlotId(null);
    }
    setLoading(false);
  }, [eventId, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const formatSlot = (slot: OpenHouseSlotRecord, visitMode: OpenHouseVisitMode = 'FLEX') => {
    const fmt = localeToDateFormat(locale);
    const start = new Date(slot.startsAt);
    const end = new Date(slot.endsAt);
    const durationMs = end.getTime() - start.getTime();
    if (visitMode !== 'FLEX' && durationMs <= 65 * 60 * 1000) {
      const day = start.toLocaleDateString(fmt, { weekday: 'short', day: 'numeric', month: 'short' });
      const t1 = start.toLocaleTimeString(fmt, { hour: '2-digit', minute: '2-digit' });
      const t2 = end.toLocaleTimeString(fmt, { hour: '2-digit', minute: '2-digit' });
      return `${day} · ${t1} – ${t2}`;
    }
    return `${start.toLocaleString(fmt, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })} – ${end.toLocaleTimeString(fmt, { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatSlotChip = (slot: OpenHouseSlotRecord) =>
    new Date(slot.startsAt).toLocaleTimeString(localeToDateFormat(locale), {
      hour: '2-digit',
      minute: '2-digit',
    });

  const reserve = async () => {
    if (!token) {
      Alert.alert(t('openHouse.event.title'), t('openHouse.event.loginRequired'));
      return;
    }
    if (!selectedSlotId) {
      Alert.alert(t('openHouse.event.title'), t('openHouse.event.pickSlotRequired'));
      return;
    }
    setSubmitting(true);
    const result = await reserveOpenHouseSlot(token, selectedSlotId, { guestCount, note });
    setSubmitting(false);
    if (!result.event) {
      Alert.alert(t('openHouse.event.title'), result.message || t('common.error'));
      return;
    }
    setEvent(result.event);
    useOpenHouseLiveStore.getState().addReservedEventId(result.event.id);
    const slot = result.event.slots.find((s) => s.id === selectedSlotId);
    if (slot) {
      void offerOpenHouseCalendarAfterReserve({
        eventTitle: result.event.title,
        offer: result.event.offer,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
    } else {
      Alert.alert(t('openHouse.event.title'), t('openHouse.event.reserveSuccess'));
    }
  };

  const cancelMyReservation = async (reservationId: number) => {
    if (!token) return;
    setSubmitting(true);
    const result = await cancelOpenHouseReservation(token, reservationId);
    setSubmitting(false);
    if (!result.event) {
      Alert.alert(t('openHouse.event.title'), result.message || t('common.error'));
      return;
    }
    setEvent(result.event);
    useOpenHouseLiveStore.getState().removeReservedEventId(result.event.id);
    Alert.alert(t('openHouse.event.title'), t('openHouse.event.cancelSuccess'));
  };

  const cancelEvent = () => {
    if (!token || !event?.isHost) return;
    Alert.alert(t('openHouse.event.manageCancel'), t('openHouse.event.confirmCancelEvent'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('openHouse.event.manageCancel'),
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          const result = await updateOpenHouseEvent(token, event.id, { status: 'CANCELLED' });
          setSubmitting(false);
          if (result.event) {
            setEvent(result.event);
            navigation.goBack();
          } else {
            Alert.alert(t('openHouse.event.title'), result.message || t('common.error'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg, paddingTop: insets.top }]}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: bg, paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#F59E0B" />
        <Text style={[styles.errorTitle, { color: text }]}>{t('openHouse.event.loadError')}</Text>
        <Text style={{ color: muted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          {t('openHouse.event.loadErrorHint')}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const selectedSlot = event.slots.find((s) => s.id === selectedSlotId) ?? null;
  const maxGuests = Math.min(5, selectedSlot?.capacity ?? 5);
  const guestOptions = useMemo(
    () => Array.from({ length: maxGuests }, (_, i) => i + 1),
    [maxGuests]
  );

  useEffect(() => {
    if (guestCount > maxGuests) setGuestCount(maxGuests);
  }, [maxGuests, guestCount]);

  const myReservation = selectedSlot?.myReservation;
  const listingCurrency = normalizeListingCurrency(event.offer.priceCurrency);
  const priceLabel = formatAmountWithCurrency(event.offer.price, listingCurrency);
  const hasAnyReservation = event.slots.some((s) => s.reservations.length > 0);
  const heroUri = resolveMediaUrl(event.offer.imageUrl);
  const isTimedBooking = event.visitMode !== 'FLEX';
  const upcomingSlots = event.slots.filter((s) => new Date(s.endsAt).getTime() > Date.now());

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {event.isHost ? t('openHouse.event.hostViewTitle') : event.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 16 }}>
        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.event.propertySection')}</Text>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="image-outline" size={40} color="#F59E0B" />
            </View>
          )}
          <Text style={[styles.propertyTitle, { color: text }]}>{event.offer.title}</Text>
          <Text style={{ color: muted }}>
            {event.offer.city} · {event.offer.district}
            {event.offer.street ? ` · ${event.offer.street}` : ''}
          </Text>
          <Text style={[styles.price, { color: text }]}>
            {priceLabel} · {event.offer.area} m²
            {event.offer.rooms ? ` · ${event.offer.rooms} pok.` : ''}
          </Text>
          {event.description ? <Text style={{ color: muted, lineHeight: 20 }}>{event.description}</Text> : null}
          <Pressable
            onPress={() => navigation.navigate('OfferDetail', { offerId: event.offerId })}
            style={styles.linkBtn}
          >
            <Text style={styles.linkBtnText}>{t('openHouse.event.viewOffer')}</Text>
            <Ionicons name="open-outline" size={16} color="#F59E0B" />
          </Pressable>
        </View>

        {event.isHost && !hasAnyReservation ? (
          <View style={[styles.hostHint, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' }]}>
            <Ionicons name="people-outline" size={20} color="#F59E0B" />
            <Text style={[styles.hostHintText, { color: text }]}>{t('openHouse.event.hostNoGuests')}</Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: card }]}>
          <Text style={[styles.sectionTitle, { color: text }]}>
            {!event.isHost && isTimedBooking
              ? t('openHouse.event.pickHourSection')
              : t('openHouse.event.slotsSection')}
          </Text>
          {!event.isHost && isTimedBooking ? (
            <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>{t('openHouse.event.pickHourHint')}</Text>
          ) : null}
          {!event.isHost && event.visitMode === 'FLEX' && event.slots.length === 1 ? (
            <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>{t('openHouse.event.flexWindowHint')}</Text>
          ) : null}

          {!event.isHost && isTimedBooking ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourChipRow}>
              {upcomingSlots.map((slot) => {
                const selected = slot.id === selectedSlotId;
                const booked = Boolean(slot.myReservation);
                const disabled = slot.isFull && !booked;
                return (
                  <Pressable
                    key={slot.id}
                    disabled={disabled}
                    onPress={() => setSelectedSlotId(slot.id)}
                    style={[
                      styles.hourChip,
                      {
                        borderColor: selected ? '#F59E0B' : border,
                        backgroundColor: selected ? 'rgba(245,158,11,0.16)' : 'transparent',
                        opacity: disabled ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.hourChipTime, { color: text }]}>{formatSlotChip(slot)}</Text>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      {booked
                        ? t('openHouse.event.reservedCta')
                        : slot.isFull
                          ? t('openHouse.event.full')
                          : t('openHouse.hub.spotsLeft', { n: slot.spotsLeft })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            event.slots.map((slot) => {
              const selected = slot.id === selectedSlotId;
              const booked = Boolean(slot.myReservation);
              return (
                <Pressable
                  key={slot.id}
                  disabled={slot.isFull && !booked}
                  onPress={() => setSelectedSlotId(slot.id)}
                  style={[
                    styles.slotRow,
                    {
                      borderColor: selected ? '#F59E0B' : border,
                      backgroundColor: selected ? 'rgba(245,158,11,0.1)' : 'transparent',
                      opacity: slot.isFull && !booked ? 0.55 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotTime, { color: text }]}>
                      {formatSlot(slot, event.visitMode)}
                    </Text>
                    <Text style={{ color: muted, fontSize: 13 }}>
                      {event.isHost
                        ? t('openHouse.event.slotOccupancy', {
                            reserved: slot.reservedCount,
                            capacity: slot.capacity,
                          })
                        : slot.isFull
                          ? t('openHouse.event.full')
                          : t('openHouse.hub.spotsLeft', { n: slot.spotsLeft })}
                    </Text>
                  </View>
                  {booked ? (
                    <View style={styles.bookedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.bookedText}>{t('openHouse.event.reservedCta')}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {!event.isHost && selectedSlot && !myReservation ? (
            <View style={[styles.selectedSlotBanner, { borderColor: 'rgba(245,158,11,0.45)' }]}>
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
              <Text style={{ color: text, fontWeight: '700', flex: 1 }}>
                {t('openHouse.event.selectedSlot', {
                  time: formatSlot(selectedSlot, event.visitMode),
                })}
              </Text>
            </View>
          ) : null}
        </View>

        {event.isHost && hasAnyReservation ? (
          <View style={[styles.section, { backgroundColor: card }]}>
            <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.event.reservationsSection')}</Text>
            {event.slots.flatMap((slot) =>
              slot.reservations.map((r) => (
                <View key={`guest-${r.id}`} style={[styles.guestRow, { borderColor: border }]}>
                  <Text style={{ color: text, fontWeight: '700' }}>{r.userName}</Text>
                  <Text style={{ color: muted, fontSize: 13 }}>
                    {formatSlot(slot, event.visitMode)} · {r.guestCount} os.
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {!event.isHost ? (
          <View style={[styles.section, { backgroundColor: card }]}>
            <Text style={[styles.sectionTitle, { color: text }]}>{t('openHouse.event.guestCount')}</Text>
            <View style={styles.guestRowControls}>
              {guestOptions.map((n) => (
                <Pressable
                  key={`guest-${n}`}
                  onPress={() => setGuestCount(n)}
                  style={[
                    styles.guestChip,
                    {
                      borderColor: border,
                      backgroundColor: guestCount === n ? 'rgba(245,158,11,0.18)' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: text, fontWeight: '700' }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('openHouse.event.note')}
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: border }]}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: card, borderTopColor: border }]}>
        {event.isHost ? (
          <Pressable onPress={cancelEvent} style={[styles.secondaryBtn, submitting && { opacity: 0.6 }]}>
            <Text style={styles.secondaryBtnText}>{t('openHouse.event.manageCancel')}</Text>
          </Pressable>
        ) : myReservation ? (
          <Pressable
            onPress={() => void cancelMyReservation(myReservation.id)}
            style={[styles.secondaryBtn, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.secondaryBtnText}>{t('openHouse.event.cancelReservation')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void reserve()}
            disabled={submitting || !selectedSlot || selectedSlot.isFull}
            style={[styles.primaryBtn, (submitting || !selectedSlot || selectedSlot.isFull) && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {!selectedSlot
                  ? t('openHouse.event.pickSlotCta')
                  : t('openHouse.event.reserveCta')}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  errorBtn: {
    marginTop: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  section: { borderRadius: 16, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  hostHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  hostHintText: { flex: 1, fontSize: 14, lineHeight: 20 },
  hero: { width: '100%', height: 180, borderRadius: 14 },
  heroFallback: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  price: { fontSize: 16, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  linkBtnText: { color: '#F59E0B', fontWeight: '700' },
  slotRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slotTime: { fontSize: 15, fontWeight: '700' },
  hourChipRow: { marginTop: 4 },
  hourChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  hourChipTime: { fontSize: 16, fontWeight: '800' },
  selectedSlotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  bookedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookedText: { color: '#10B981', fontWeight: '700', fontSize: 12 },
  guestRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 2 },
  guestRowControls: { flexDirection: 'row', gap: 8 },
  guestChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
  secondaryBtnText: { color: '#FF3B30', fontWeight: '800', fontSize: 16 },
});
