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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useI18n } from '../i18n';
import { API_URL } from '../config/network';
import {
  createAuctionEvent,
  defaultAuctionEndIso,
  defaultAuctionStartIso,
} from '../services/auctionService';

type OfferRow = { id: number; title: string; city: string; district: string; price?: number };

export default function AuctionCreateScreen() {
  const navigation = useNavigation<any>();
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
        if (rows[0]) {
          setSelectedOfferId(rows[0].id);
          if (rows[0].price) setStartPrice(String(Math.round(rows[0].price * 0.9)));
        }
      } finally {
        setLoadingOffers(false);
      }
    })();
  }, [token, user?.id]);

  const publish = async () => {
    if (!token || !selectedOfferId) return;
    const sp = Number(startPrice);
    if (!Number.isFinite(sp) || sp <= 0) {
      Alert.alert(t('auction.create.title'), t('auction.create.startPrice'));
      return;
    }
    setSubmitting(true);
    const result = await createAuctionEvent(token, {
      offerId: selectedOfferId,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      startPrice: sp,
      reservePrice: reservePrice ? Number(reservePrice) : null,
      minIncrement: minIncrement ? Number(minIncrement) : null,
      startsAt: defaultAuctionStartIso(),
      endsAt: defaultAuctionEndIso(),
      publish: true,
    });
    setSubmitting(false);
    if (!result.event) {
      Alert.alert(t('auction.create.title'), result.message || t('common.error'));
      return;
    }
    Alert.alert(t('auction.create.successTitle'), t('auction.create.successBody'), [
      {
        text: 'OK',
        onPress: () => navigation.replace('AuctionEvent', { eventId: result.event!.id }),
      },
    ]);
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
        <Text style={[styles.title, { color: text }]}>{t('auction.create.title')}</Text>
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
        {loadingOffers ? (
          <ActivityIndicator color={accent} />
        ) : offers.length === 0 ? (
          <Text style={{ color: muted }}>{t('auction.create.noOffers')}</Text>
        ) : (
          offers.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => {
                setSelectedOfferId(o.id);
                if (o.price) setStartPrice(String(Math.round(o.price * 0.9)));
              }}
              style={[
                styles.offerRow,
                {
                  backgroundColor: card,
                  borderColor: selectedOfferId === o.id ? accent : border,
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
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: card, color: text, borderColor: border }]}
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
            <Text style={styles.publishText}>{t('auction.create.publish')}</Text>
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
