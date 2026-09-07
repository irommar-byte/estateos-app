import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useI18n } from '../i18n';
import { API_URL } from '../config/network';
import {
  createAuctionEvent,
  defaultAuctionEndIso,
  defaultAuctionStartIso,
  fetchAuctionEvent,
  updateAuctionEvent,
} from '../services/auctionService';
import { useOpenHouseLiveStore } from '../store/useOpenHouseLiveStore';

type OfferRow = { id: number; title: string; city: string; district: string; price?: number };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isoToLocalField(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localFieldToIso(value: string) {
  const parsed = new Date(value.trim().replace(' ', 'T'));
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function AuctionCreateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eventId = Number(route.params?.eventId) || 0;
  const isEdit = eventId > 0;
  const returnToLive = Boolean(route.params?.returnToLive);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const accent = '#8B5CF6';
  const bg = isDark ? '#000000' : '#F2F2F7';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [minIncrement, setMinIncrement] = useState('');
  const [startsAt, setStartsAt] = useState(isoToLocalField(defaultAuctionStartIso()));
  const [endsAt, setEndsAt] = useState(isoToLocalField(defaultAuctionEndIso()));
  const [loadingEvent, setLoadingEvent] = useState(isEdit);
  const [startPriceLocked, setStartPriceLocked] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const descriptionYRef = useRef(0);

  useEffect(() => {
    if (!token || !user?.id) return;
    void (async () => {
      setLoadingOffers(true);
      try {
        const res = await fetch(`${API_URL}/api/mobile/v1/offers?userId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rows = (Array.isArray(json?.offers) ? json.offers : [])
          .filter((o: any) => String(o?.status || '').toUpperCase() === 'ACTIVE')
          .map((o: any) => ({
            id: Number(o.id),
            title: String(o.title || ''),
            city: String(o.city || ''),
            district: String(o.district || ''),
            price: Number(o.price || 0),
          }));
        setOffers(rows);
        if (!isEdit && rows[0]) {
          setSelectedOfferId(rows[0].id);
          if (rows[0].price) setStartPrice(String(Math.round(rows[0].price * 0.9)));
        }
      } finally {
        setLoadingOffers(false);
      }
    })();
  }, [token, user?.id, isEdit]);

  useEffect(() => {
    if (!isEdit || !token) return;
    void (async () => {
      setLoadingEvent(true);
      const event = await fetchAuctionEvent(token, eventId);
      if (!event || !event.isHost) {
        setLoadingEvent(false);
        Alert.alert(t('auction.create.title'), t('auction.event.loadError'));
        navigation.goBack();
        return;
      }
      setSelectedOfferId(event.offerId);
      setTitle(event.title || '');
      setDescription(event.description || '');
      setStartPrice(String(Math.round(event.startPrice)));
      setReservePrice(event.reservePrice ? String(Math.round(event.reservePrice)) : '');
      setMinIncrement(event.minIncrement ? String(Math.round(event.minIncrement)) : '');
      setStartsAt(isoToLocalField(event.startsAt));
      setEndsAt(isoToLocalField(event.endsAt));
      setStartPriceLocked(event.bidCount > 0);
      setOffers((current) => {
        if (current.some((row) => row.id === event.offerId)) return current;
        return [
          {
            id: event.offer.id,
            title: event.offer.title,
            city: event.offer.city,
            district: event.offer.district,
            price: event.offer.price,
          },
          ...current,
        ];
      });
      setLoadingEvent(false);
    })();
  }, [isEdit, eventId, token, navigation, t]);

  const finishAfterSave = (savedId: number) => {
    if (returnToLive) {
      useOpenHouseLiveStore.getState().openPanel();
      navigation.goBack();
      return;
    }
    if (isEdit) {
      navigation.goBack();
      return;
    }
    navigation.replace('AuctionEvent', { eventId: savedId });
  };

  const publish = async () => {
    if (!token || !selectedOfferId) return;
    const sp = Number(startPrice);
    if (!Number.isFinite(sp) || sp <= 0) {
      Alert.alert(t('auction.create.title'), t('auction.create.startPrice'));
      return;
    }
    const startIso = localFieldToIso(startsAt);
    const endIso = localFieldToIso(endsAt);
    if (!startIso || !endIso) {
      Alert.alert(t('auction.create.title'), t('auction.create.datesRequired'));
      return;
    }
    setSubmitting(true);
    const result = isEdit
      ? await updateAuctionEvent(token, eventId, {
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          startPrice: startPriceLocked ? undefined : sp,
          reservePrice: reservePrice ? Number(reservePrice) : null,
          minIncrement: minIncrement ? Number(minIncrement) : null,
          startsAt: startIso,
          endsAt: endIso,
        })
      : await createAuctionEvent(token, {
          offerId: selectedOfferId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          startPrice: sp,
          reservePrice: reservePrice ? Number(reservePrice) : null,
          minIncrement: minIncrement ? Number(minIncrement) : null,
          startsAt: startIso,
          endsAt: endIso,
          publish: true,
        });
    setSubmitting(false);
    if (!result.event) {
      Alert.alert(t('auction.create.title'), result.message || t('common.error'));
      return;
    }
    Alert.alert(
      isEdit ? t('auction.create.updateSuccessTitle') : t('auction.create.successTitle'),
      isEdit ? t('auction.create.updateSuccessBody') : t('auction.create.successBody'),
      [
        {
          text: 'OK',
          onPress: () => finishAfterSave(result.event!.id),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </Pressable>
        <Text style={[styles.title, { color: text }]}>
          {isEdit ? t('auction.create.editTitle') : t('auction.create.title')}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 14 }}
      >
        <View style={[styles.guideBox, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.guideTitle, { color: text }]}>{t('auction.create.guideTitle')}</Text>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>• {t('auction.create.guideStart')}</Text>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>• {t('auction.create.guideReserve')}</Text>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>• {t('auction.create.guideAntiSnipe')}</Text>
        </View>

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.pickOffer')}</Text>
        {loadingOffers || loadingEvent ? (
          <ActivityIndicator color={accent} />
        ) : offers.length === 0 ? (
          <Text style={{ color: muted }}>{t('auction.create.noOffers')}</Text>
        ) : (
          offers.map((o) => (
            <Pressable
              key={o.id}
              disabled={isEdit}
              onPress={() => {
                setSelectedOfferId(o.id);
                if (o.price) setStartPrice(String(Math.round(o.price * 0.9)));
              }}
              style={[
                styles.offerRow,
                {
                  backgroundColor: card,
                  borderColor: selectedOfferId === o.id ? accent : border,
                  opacity: isEdit ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: text, fontWeight: '700' }} numberOfLines={2}>
                {o.title}
              </Text>
              <Text style={{ color: muted, fontSize: 12 }}>
                {o.city} · {o.district}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.startPrice')}</Text>
        <TextInput
          value={startPrice}
          onChangeText={setStartPrice}
          editable={!startPriceLocked}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border, opacity: startPriceLocked ? 0.7 : 1 }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.reservePrice')}</Text>
        <TextInput
          value={reservePrice}
          onChangeText={setReservePrice}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.minIncrement')}</Text>
        <TextInput
          value={minIncrement}
          onChangeText={setMinIncrement}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.startsAt')}</Text>
        <TextInput
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder="2026-09-08 18:00"
          placeholderTextColor={muted}
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.endsAt')}</Text>
        <TextInput
          value={endsAt}
          onChangeText={setEndsAt}
          placeholder="2026-09-11 20:00"
          placeholderTextColor={muted}
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.eventTitle')}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
        />

        <Text style={[styles.label, { color: muted }]}>{t('auction.create.eventDescription')}</Text>
        <View
          onLayout={(e) => {
            descriptionYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollTo({ y: Math.max(0, descriptionYRef.current - 24), animated: true });
              }, 120);
            }}
            multiline
            style={[styles.input, styles.textarea, { backgroundColor: card, color: text, borderColor: border }]}
          />
        </View>

        <Pressable
          disabled={submitting || !selectedOfferId}
          onPress={() => void publish()}
          style={[styles.publishBtn, { backgroundColor: accent, opacity: submitting ? 0.7 : 1 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.publishText}>
              {isEdit ? t('auction.create.save') : t('auction.create.publish')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800' },
  guideBox: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  guideTitle: { fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  offerRow: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  publishBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  publishText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
