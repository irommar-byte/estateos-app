import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import AcquisitionDatePickerModal from '../components/agency/AcquisitionDatePickerModal';
import ClientOutboundPreviewSheet, { type ClientOutboundPreview } from '../components/agency/ClientOutboundPreviewSheet';
import {
  SENTIMENT_UI,
  STAGE_UI,
  buyerDisplayName,
  fetchBuyerDeal,
  formatDealWhen,
  postBuyerDealAction,
  uploadDealFile,
  type BuyerDeal,
  type DealAction,
  type DealActor,
  type DealSentiment,
  type TransactionStepId,
} from '../services/offerBuyerService';
import { DocumentsSection, NegotiationSection, TransactionSection } from '../components/agency/BuyerDealSteps';
import { previewVisitPrepPacket, sendVisitPrepPacket } from '../services/agencyClientService';
import { resolveMediaUrl } from '../utils/userAvatar';
import { formatCurrencyPLN } from '../utils/crmFormatters';
import { API_URL } from '../config/network';

const appleType = Platform.select({
  ios: { fontFamily: 'System' as const },
  android: { fontFamily: 'sans-serif' as const },
  default: {},
});

const ACTOR_LABEL: Record<DealActor, string> = {
  agent: 'Ty',
  buyer: 'Kupujący',
  seller: 'Sprzedający',
  other_agent: 'Inny agent',
};

function absoluteUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

function localToIso(formatted: string): string | null {
  const m = formatted.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString();
}

export default function BuyerDealScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const dealId = Number(route.params?.dealId);
  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: '#34C759',
  };

  const [deal, setDeal] = useState<BuyerDeal | null>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [sentiment, setSentiment] = useState<DealSentiment | null>(null);
  const [sellerDraft, setSellerDraft] = useState<string | null>(null);
  const [datePick, setDatePick] = useState<{ title: string; initial: string; onSelect: (iso: string) => void } | null>(null);
  const [prepPreview, setPrepPreview] = useState<ClientOutboundPreview | null>(null);

  const load = useCallback(async () => {
    if (!token || !dealId) return;
    const res = await fetchBuyerDeal(token, dealId);
    if (res.ok) setDeal(res.deal);
    else Alert.alert('Kupujący', res.message);
  }, [token, dealId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (key: string, body: DealAction) => {
    if (!token) return { ok: false, otherActive: 0 };
    setBusy(key);
    const res = await postBuyerDealAction(token, body);
    setBusy('');
    if (!res.ok) {
      Alert.alert('Kupujący', res.message);
      return { ok: false, otherActive: 0 };
    }
    setDeal(res.deal);
    return { ok: true, otherActive: res.otherActive };
  };

  const pickDate = (title: string, initial: string | null | undefined, onSelect: (iso: string) => void) => {
    const d = initial ? new Date(initial) : null;
    const pad = (n: number) => String(n).padStart(2, '0');
    setDatePick({
      title,
      initial: d && Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '',
      onSelect,
    });
  };

  if (!deal) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + 60 }]}>
        <ActivityIndicator color="#34C759" />
      </View>
    );
  }

  const buyerClientId = deal.buyer.kind === 'client' ? deal.buyer.clientId : null;
  const stage = STAGE_UI[deal.stage];
  const cover = resolveMediaUrl(deal.offer.imageUrl);
  const held = Boolean(deal.presentation?.heldAt);
  const closed = deal.status === 'LOST';

  const openClient = (clientId: number, lane?: 'BUY' | 'SELL') =>
    navigation.push('AgencyClientDetail', lane ? { clientId, startAt: 'project', lane } : { clientId });

  const scheduleForBuyer = () => {
    if (buyerClientId) {
      navigation.push('AgencyClientDetail', { clientId: buyerClientId, startAt: 'project', lane: 'BUY', presentationOfferId: deal.offerId });
    } else {
      pickDate('Termin prezentacji', deal.presentation?.startsAt, (startsAt) => void act('schedule', { action: 'schedule_external', dealId: deal.id, startsAt }));
    }
  };

  const askAboutOthers = (count: number) =>
    Alert.alert(
      `Pozostali kupujący: ${count}`,
      'Nieruchomość jest zarezerwowana dla tego kupującego. Co z pozostałymi?',
      [
        { text: 'Zostaw jako rezerwowych', onPress: () => void act('others', { action: 'decide_others', dealId: deal.id, decision: 'backup' }) },
        { text: 'Wstrzymaj ich', style: 'destructive', onPress: () => void act('others', { action: 'decide_others', dealId: deal.id, decision: 'paused' }) },
      ],
    );

  const pickFile = (kind: 'attendance' | TransactionStepId) => {
    const send = async (file: { uri: string; name: string; mimeType: string }) => {
      if (!token) return;
      setBusy(kind);
      const res = await uploadDealFile(token, deal.id, kind, file);
      setBusy('');
      if (!res.ok) Alert.alert('Plik', res.message);
      else setDeal(res.deal);
    };
    Alert.alert(kind === 'attendance' ? 'Podpisane potwierdzenie' : 'Dodaj plik', 'Zdjęcie albo PDF.', [
      {
        text: 'Zrób zdjęcie',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) return;
          const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          const asset = shot.canceled ? null : shot.assets[0];
          if (asset) void send({ uri: asset.uri, name: asset.fileName || `${kind}-${deal.offerId}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
        },
      },
      {
        text: 'Wybierz plik',
        onPress: async () => {
          const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
          const asset = picked.canceled ? null : picked.assets[0];
          if (asset) void send({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'application/pdf' });
        },
      },
      { text: 'Anuluj', style: 'cancel' },
    ]);
  };

  const sendPrepPacket = async () => {
    if (!token || !buyerClientId) return;
    setBusy('prep');
    const res = await previewVisitPrepPacket(token, buyerClientId);
    setBusy('');
    if (!res.ok) Alert.alert('Pakiet przed wizytą', res.message);
    else setPrepPreview(res.preview);
  };

  const closeNotInterested = () => {
    const finish = (searchOther: boolean, searchNote?: string) =>
      void act('status', { action: 'set_status', dealId: deal.id, status: 'LOST', searchOther, searchNote }).then(({ ok }) => {
        if (ok && searchOther && buyerClientId) {
          Alert.alert('Szukamy dalej', 'Otworzyć kartę kupującego, żeby ustawić kryteria i radar?', [
            { text: 'Później', style: 'cancel' },
            { text: 'Otwórz', onPress: () => openClient(buyerClientId, 'BUY') },
          ]);
        }
      });
    Alert.alert('Szukamy dla niego czegoś innego?', buyerDisplayName(deal), [
      { text: 'Nie, kończymy', style: 'destructive', onPress: () => finish(false) },
      {
        text: 'Tak, szukamy',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Alert.prompt('Czego szukamy?', 'Np. większa kuchnia, z balkonem, do 650 tys. — zapiszę to na karcie kupującego.', (text) =>
              finish(true, text || undefined),
            );
          } else finish(true);
        },
      },
      { text: 'Anuluj', style: 'cancel' },
    ]);
  };

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, appleType, { color: colors.text }]} numberOfLines={1}>
          {buyerDisplayName(deal)} · {deal.offer.title}
        </Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 60 }} keyboardShouldPersistTaps="handled">
        {/* Powiązania: kto jest kto */}
        <View style={card}>
          <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>POWIĄZANIA</Text>
          <Pressable
            disabled={!deal.seller}
            onPress={() => deal.seller && openClient(deal.seller.clientId)}
            style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.roleIcon, { backgroundColor: 'rgba(52,199,89,0.14)' }]}>
              <Ionicons name="key-outline" size={16} color="#34C759" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleLabel, appleType, { color: colors.secondary }]}>Sprzedający</Text>
              <Text style={[styles.roleValue, appleType, { color: colors.text }]}>{deal.seller?.name || 'Spoza Twojego CRM'}</Text>
            </View>
            {deal.seller ? <Ionicons name="chevron-forward" size={16} color={colors.secondary} /> : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('OfferDetail', { offerId: deal.offerId })}
            style={({ pressed }) => [styles.linkRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 }]}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={styles.offerThumb} contentFit="cover" />
            ) : (
              <View style={[styles.roleIcon, { backgroundColor: colors.input }]}>
                <Ionicons name="home-outline" size={16} color={colors.secondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleLabel, appleType, { color: colors.secondary }]}>Nieruchomość · #{deal.offerId}</Text>
              <Text style={[styles.roleValue, appleType, { color: colors.text }]} numberOfLines={2}>
                {deal.offer.title}
              </Text>
              <Text style={[styles.small, appleType, { color: colors.secondary }]} numberOfLines={1}>
                {[deal.offer.address, deal.offer.price ? formatCurrencyPLN(deal.offer.price) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
          <Pressable
            disabled={!buyerClientId}
            onPress={() => buyerClientId && openClient(buyerClientId)}
            style={({ pressed }) => [styles.linkRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.roleIcon, { backgroundColor: deal.buyer.kind === 'external' ? 'rgba(88,86,214,0.14)' : 'rgba(255,149,0,0.14)' }]}>
              <Ionicons name={deal.buyer.kind === 'external' ? 'business-outline' : 'person-outline'} size={16} color={deal.buyer.kind === 'external' ? '#5856D6' : '#FF9500'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleLabel, appleType, { color: colors.secondary }]}>Kupujący · {deal.sourceLabel}</Text>
              <Text style={[styles.roleValue, appleType, { color: colors.text }]}>{buyerDisplayName(deal)}</Text>
              {deal.buyer.kind === 'external' && deal.buyer.agency && deal.buyer.name ? (
                <Text style={[styles.small, appleType, { color: colors.secondary }]}>{deal.buyer.agency}</Text>
              ) : null}
            </View>
            {deal.buyer.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${deal.buyer.phone}`)} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.input }]}>
                <Ionicons name="call" size={15} color="#34C759" />
              </Pressable>
            ) : null}
            {deal.buyer.email ? (
              <Pressable onPress={() => Linking.openURL(`mailto:${deal.buyer.email}`)} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.input }]}>
                <Ionicons name="mail" size={15} color="#007AFF" />
              </Pressable>
            ) : null}
            {buyerClientId ? <Ionicons name="chevron-forward" size={16} color={colors.secondary} /> : null}
          </Pressable>
        </View>

        {/* Etapy i następny krok */}
        <View style={card}>
          <View style={styles.phases}>
            {deal.phases.map((phase, index) => (
              <React.Fragment key={phase.id}>
                {index > 0 ? <View style={[styles.phaseRail, { backgroundColor: deal.phases[index - 1].done ? '#34C759' : colors.border }]} /> : null}
                <View style={styles.phase}>
                  <View
                    style={[
                      styles.phaseDot,
                      phase.done
                        ? { backgroundColor: '#34C759', borderColor: '#34C759' }
                        : phase.current
                          ? { backgroundColor: '#FF9500', borderColor: '#FF9500' }
                          : { borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                  >
                    {phase.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  <Text
                    style={[styles.phaseLabel, appleType, { color: phase.done ? '#34C759' : phase.current ? colors.text : colors.secondary, fontWeight: phase.current || phase.done ? '700' : '500' }]}
                  >
                    {phase.label}
                    {phase.skipped ? '\npominięte' : ''}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={[styles.nowBox, { backgroundColor: colors.input }]}>
            <View style={[styles.stagePill, { backgroundColor: `${stage.color}22` }]}>
              <Text style={[styles.stageText, appleType, { color: stage.color }]}>{deal.status === 'PAUSED' ? 'Wstrzymane' : stage.label}</Text>
            </View>
            <Text style={[styles.nowText, appleType, { color: colors.text }]}>{deal.nextAction}</Text>
            {!closed && ['interested', 'scheduling', 'scheduled', 'viewed', 'feedback'].includes(deal.stage) ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Klient kupuje?', deal.presentation?.heldAt ? 'Przejdziemy do negocjacji.' : 'Przejdziemy do negocjacji — prezentację oznaczymy jako pominiętą.', [
                    { text: 'Anuluj', style: 'cancel' },
                    { text: 'Przejdź do negocjacji', onPress: () => void act('neg', { action: 'start_negotiation', dealId: deal.id }) },
                  ])
                }
                style={[styles.btn, styles.btnPrimary, { alignSelf: 'flex-start' }]}
              >
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={[styles.btnText, appleType, { color: '#fff' }]}>Klient kupuje — negocjacje</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 1. Prezentacja */}
        <View style={card}>
          <Text style={[styles.sectionTitle, appleType, { color: colors.text }]}>1 · Prezentacja</Text>
          <View style={styles.factRow}>
            <Text style={[styles.factLabel, appleType, { color: colors.secondary }]}>Termin</Text>
            <Text style={[styles.factValue, appleType, { color: colors.text }]}>
              {deal.presentation
                ? deal.presentation.status === 'pending'
                  ? `${deal.presentation.proposedSlots.map(formatDealWhen).join(' · ')} — ${deal.presentation.proposedBy === 'client' ? 'proponuje kupujący' : 'czeka na wybór kupującego'}`
                  : formatDealWhen(deal.presentation.startsAt)
                : 'Nie umówiono'}
            </Text>
          </View>
          <View style={styles.factRow}>
            <Text style={[styles.factLabel, appleType, { color: colors.secondary }]}>Obejrzane</Text>
            <Text style={[styles.factValue, appleType, { color: held ? '#34C759' : colors.text }]}>
              {held ? formatDealWhen(deal.presentation!.heldAt!) : 'Jeszcze nie'}
            </Text>
          </View>
          <View style={styles.factRow}>
            <Text style={[styles.factLabel, appleType, { color: colors.secondary }]}>Potwierdzenie</Text>
            {deal.attendance.signed ? (
              <Pressable
                disabled={!deal.attendance.url}
                onPress={() => deal.attendance.url && Linking.openURL(absoluteUrl(deal.attendance.url))}
              >
                <Text style={[styles.factValue, appleType, { color: '#34C759' }]}>
                  {deal.attendance.via === 'tablet' ? `Podpisane na tablecie · ${deal.attendance.documentId}` : `Skan: ${deal.attendance.name || 'otwórz'}`}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.factValue, appleType, { color: colors.secondary }]}>Brak podpisu</Text>
            )}
          </View>
          {!closed ? (
            <View style={styles.actions}>
              {!held ? (
                <Pressable onPress={scheduleForBuyer} style={[styles.btn, { borderColor: colors.border }]}>
                  <Ionicons name="calendar-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>{deal.presentation ? 'Zmień termin' : 'Umów prezentację'}</Text>
                </Pressable>
              ) : null}
              {buyerClientId && deal.presentation && !held ? (
                <Pressable disabled={busy === 'prep'} onPress={() => void sendPrepPacket()} style={[styles.btn, { borderColor: colors.border }]}>
                  <Ionicons name="paper-plane-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>Pakiet przed wizytą</Text>
                </Pressable>
              ) : null}
              {buyerClientId && !deal.attendance.signed ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('PresentationVisitWizard', {
                      clientId: buyerClientId,
                      offerId: deal.offerId,
                      clientName: buyerDisplayName(deal),
                      clientEmail: deal.buyer.email,
                      clientPhone: deal.buyer.phone,
                      offerTitle: deal.offer.title,
                      viewingStartsAt: deal.presentation?.startsAt || null,
                    })
                  }
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <Ionicons name="tablet-portrait-outline" size={16} color="#fff" />
                  <Text style={[styles.btnText, appleType, { color: '#fff' }]}>Wizyta na tablecie</Text>
                </Pressable>
              ) : null}
              {!deal.attendance.signed ? (
                <Pressable disabled={busy === 'attendance'} onPress={() => pickFile('attendance')} style={[styles.btn, { borderColor: colors.border }]}>
                  <Ionicons name="document-attach-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>{busy === 'attendance' ? 'Wgrywam…' : 'Wgraj skan potwierdzenia'}</Text>
                </Pressable>
              ) : null}
              {!held ? (
                <Pressable disabled={busy === 'viewed'} onPress={() => void act('viewed', { action: 'mark_viewed', dealId: deal.id })} style={[styles.btn, { borderColor: colors.border }]}>
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>Oznacz jako obejrzane</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 2. Opinia */}
        <View style={card}>
          <Text style={[styles.sectionTitle, appleType, { color: colors.text }]}>2 · Opinia</Text>
          {deal.feedback ? (
            <View style={[styles.feedbackBox, { backgroundColor: `${SENTIMENT_UI[deal.feedback.sentiment].color}14` }]}>
              <Ionicons name={SENTIMENT_UI[deal.feedback.sentiment].icon} size={20} color={SENTIMENT_UI[deal.feedback.sentiment].color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleValue, appleType, { color: colors.text }]}>{SENTIMENT_UI[deal.feedback.sentiment].label}</Text>
                {deal.feedback.note ? <Text style={[styles.small, appleType, { color: colors.text }]}>{deal.feedback.note}</Text> : null}
                <Text style={[styles.small, appleType, { color: colors.secondary }]}>
                  {deal.feedback.by === 'buyer' ? 'Kupujący w panelu' : 'Wpisane przez Ciebie'}
                  {deal.feedback.at ? ` · ${formatDealWhen(deal.feedback.at)}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.small, appleType, { color: colors.secondary }]}>
              {deal.feedbackRequestedAt ? `Zapytano ${formatDealWhen(deal.feedbackRequestedAt)} — czekamy na odpowiedź.` : 'Brak opinii.'}
            </Text>
          )}

          {!closed ? (
            <>
              <Text style={[styles.kicker, appleType, { color: colors.secondary, marginTop: 14 }]}>
                {deal.feedback ? 'ZMIEŃ OPINIĘ' : 'WPISZ, CO POWIEDZIAŁ'}
              </Text>
              <View style={styles.sentiments}>
                {(Object.keys(SENTIMENT_UI) as DealSentiment[]).map((key) => {
                  const ui = SENTIMENT_UI[key];
                  const active = sentiment === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSentiment(key)}
                      style={[styles.sentimentChip, { borderColor: active ? ui.color : colors.border, backgroundColor: active ? `${ui.color}1A` : 'transparent' }]}
                    >
                      <Ionicons name={ui.icon} size={15} color={ui.color} />
                      <Text style={[styles.btnText, appleType, { color: colors.text }]}>{ui.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {sentiment ? (
                <>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Co się podobało, co nie, ile byłby gotów dać…"
                    placeholderTextColor={colors.secondary}
                    multiline
                    style={[styles.input, { color: colors.text, backgroundColor: colors.input }]}
                  />
                  <Pressable
                    disabled={busy === 'feedback'}
                    onPress={() =>
                      void act('feedback', { action: 'set_feedback', dealId: deal.id, sentiment, note: note.trim() || undefined }).then(({ ok }) => {
                        if (ok) {
                          setSentiment(null);
                          setNote('');
                        }
                      })
                    }
                    style={[styles.btn, styles.btnPrimary, { alignSelf: 'flex-start', marginTop: 8 }]}
                  >
                    <Text style={[styles.btnText, appleType, { color: '#fff' }]}>Zapisz opinię</Text>
                  </Pressable>
                </>
              ) : null}
              {buyerClientId ? (
                <Pressable
                  disabled={busy === 'ask'}
                  onPress={() => void act('ask', { action: 'request_feedback', dealId: deal.id })}
                  style={[styles.btn, { borderColor: colors.border, alignSelf: 'flex-start', marginTop: 10 }]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>Zapytaj kupującego o opinię</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {deal.feedback?.sentiment === 'dislike' && !closed ? (
            <View style={[styles.decision, { borderColor: '#FF3B30' }]}>
              <Text style={[styles.roleValue, appleType, { color: colors.text }]}>Nie pasuje — szukamy dla niego czegoś innego?</Text>
              <Pressable onPress={closeNotInterested} style={[styles.btn, { borderColor: colors.border, alignSelf: 'flex-start', marginTop: 8 }]}>
                <Text style={[styles.btnText, appleType, { color: colors.text }]}>Zdecyduj</Text>
              </Pressable>
            </View>
          ) : null}
          {deal.searchOther ? (
            <Text style={[styles.small, appleType, { color: colors.secondary, marginTop: 10 }]}>
              {deal.searchOther.wanted ? `Szukamy dalej${deal.searchOther.note ? `: ${deal.searchOther.note}` : ''}` : 'Nie szukamy dalej.'}
            </Text>
          ) : null}

          {deal.seller && (deal.feedback || held) ? (
            <View style={[styles.sellerBox, { borderTopColor: colors.border }]}>
              <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>
                DO SPRZEDAJĄCEGO {deal.sellerInformedAt ? `· PRZEKAZANO ${formatDealWhen(deal.sellerInformedAt).toUpperCase()}` : ''}
              </Text>
              {sellerDraft === null ? (
                <Pressable onPress={() => setSellerDraft('')} style={[styles.btn, { borderColor: colors.border, alignSelf: 'flex-start', marginTop: 8 }]}>
                  <Ionicons name="arrow-redo-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, appleType, { color: colors.text }]}>
                    {deal.sellerInformedAt ? 'Wyślij aktualizację' : 'Przekaż wynik sprzedającemu'}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Text style={[styles.small, appleType, { color: colors.secondary, marginTop: 6 }]}>
                    Wynik, termin i uwagi kupującego ułożymy w wiadomość sami — bez danych kupującego. Możesz dopisać coś od siebie.
                  </Text>
                  <TextInput
                    value={sellerDraft}
                    onChangeText={setSellerDraft}
                    multiline
                    placeholder="Kilka słów od siebie (opcjonalnie)"
                    placeholderTextColor={colors.secondary}
                    style={[styles.input, { color: colors.text, backgroundColor: colors.input }]}
                  />
                  <View style={[styles.actions, { marginTop: 8 }]}>
                    <Pressable
                      disabled={busy === 'seller'}
                      onPress={() =>
                        void act('seller', { action: 'inform_seller', dealId: deal.id, message: sellerDraft.trim() || undefined }).then(
                          ({ ok }) => ok && setSellerDraft(null),
                        )
                      }
                      style={[styles.btn, styles.btnPrimary]}
                    >
                      <Text style={[styles.btnText, appleType, { color: '#fff' }]}>Dalej do podglądu</Text>
                    </Pressable>
                    <Pressable onPress={() => setSellerDraft(null)} style={[styles.btn, { borderColor: colors.border }]}>
                      <Text style={[styles.btnText, appleType, { color: colors.text }]}>Anuluj</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : null}
        </View>

        <NegotiationSection deal={deal} colors={colors} act={act} pickDate={pickDate} askAboutOthers={askAboutOthers} />
        <TransactionSection deal={deal} colors={colors} act={act} pickDate={pickDate} pickFile={pickFile} askAboutOthers={askAboutOthers} />
        {token ? <DocumentsSection deal={deal} token={token} colors={colors} act={act} /> : null}

        {/* Historia */}
        <View style={card}>
          <Text style={[styles.sectionTitle, appleType, { color: colors.text }]}>Historia</Text>
          {deal.timeline.length ? (
            [...deal.timeline].reverse().map((event, index) => (
              <View key={`${event.at}-${index}`} style={styles.event}>
                <Text style={[styles.eventActor, appleType, { color: event.actor === 'agent' ? '#007AFF' : event.actor === 'buyer' ? '#C25E00' : '#5856D6' }]}>
                  {ACTOR_LABEL[event.actor]}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.small, appleType, { color: colors.text }]}>{event.text}</Text>
                  <Text style={[styles.eventWhen, appleType, { color: colors.secondary }]}>{formatDealWhen(event.at)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.small, appleType, { color: colors.secondary }]}>Brak wpisów.</Text>
          )}
        </View>

        <View style={styles.actions}>
          {deal.status === 'ACTIVE' ? (
            <Pressable onPress={() => void act('status', { action: 'set_status', dealId: deal.id, status: 'PAUSED' })} style={[styles.btn, { borderColor: colors.border }]}>
              <Text style={[styles.btnText, appleType, { color: colors.text }]}>Wstrzymaj</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => void act('status', { action: 'set_status', dealId: deal.id, status: 'ACTIVE' })} style={[styles.btn, { borderColor: colors.border }]}>
              <Text style={[styles.btnText, appleType, { color: colors.text }]}>Wznów</Text>
            </Pressable>
          )}
          {!closed ? (
            <Pressable onPress={closeNotInterested} style={[styles.btn, { borderColor: colors.border }]}>
              <Text style={[styles.btnText, appleType, { color: '#FF3B30' }]}>Kupujący rezygnuje</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <AcquisitionDatePickerModal
        visible={Boolean(datePick)}
        isDark={isDark}
        title={datePick?.title}
        initialValue={datePick?.initial || ''}
        onClose={() => setDatePick(null)}
        onSelect={(formatted) => {
          const iso = localToIso(formatted);
          const handler = datePick?.onSelect;
          setDatePick(null);
          if (iso && handler) handler(iso);
        }}
      />
      <ClientOutboundPreviewSheet
        visible={Boolean(prepPreview)}
        preview={prepPreview}
        busy={busy === 'prep'}
        colors={colors}
        onCancel={() => setPrepPreview(null)}
        onConfirm={async () => {
          if (!token || !buyerClientId) return;
          setBusy('prep');
          const res = await sendVisitPrepPacket(token, buyerClientId);
          setBusy('');
          setPrepPreview(null);
          if (!res.ok) Alert.alert('Pakiet przed wizytą', res.message);
          else void load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  navBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  roleIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  offerThumb: { width: 36, height: 36, borderRadius: 9 },
  roleLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  roleValue: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  circleBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  phases: { flexDirection: 'row', alignItems: 'flex-start' },
  phase: { alignItems: 'center', width: 78 },
  phaseRail: { flex: 1, height: 2, marginTop: 10 },
  phaseDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  phaseLabel: { fontSize: 11, marginTop: 5, textAlign: 'center' },
  nowBox: { marginTop: 14, borderRadius: 14, padding: 12, gap: 8 },
  stagePill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  stageText: { fontSize: 12, fontWeight: '700' },
  nowText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  factRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  factLabel: { width: 110, fontSize: 13 },
  factValue: { flex: 1, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: { backgroundColor: '#34C759', borderColor: '#34C759' },
  btnText: { fontSize: 14, fontWeight: '600' },
  feedbackBox: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12 },
  sentiments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  sentimentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 38, borderRadius: 99, borderWidth: 1 },
  input: { marginTop: 8, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
  decision: { marginTop: 14, borderLeftWidth: 3, paddingLeft: 12 },
  sellerBox: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  event: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  eventActor: { width: 78, fontSize: 12, fontWeight: '700' },
  eventWhen: { fontSize: 11, marginTop: 2 },
});
