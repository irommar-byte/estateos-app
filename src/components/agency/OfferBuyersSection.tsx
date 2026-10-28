import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  SENTIMENT_UI,
  STAGE_UI,
  buyerDisplayName,
  fetchBuyerClientDeals,
  fetchOfferBuyerDeals,
  formatDealWhen,
  postBuyerDealAction,
  type BuyerDeal,
} from '../../services/offerBuyerService';
import { fetchAgencyClients, type AgencyClientListItem } from '../../services/agencyClientService';
import { resolveMediaUrl } from '../../utils/userAvatar';
import { formatCurrencyPLN } from '../../utils/crmFormatters';

const appleType = Platform.select({
  ios: { fontFamily: 'System' as const },
  android: { fontFamily: 'sans-serif' as const },
  default: {},
});

type Colors = { card: string; text: string; secondary: string; border: string; input: string };

type Props = {
  token: string | null;
  colors: Colors;
  isDark: boolean;
  onOpenDeal: (dealId: number) => void;
} & ({ mode: 'offer'; offerId: number } | { mode: 'buyer'; buyerClientId: number });

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'K'
  );
}

function DealRow({ deal, mode, colors, onPress }: { deal: BuyerDeal; mode: 'offer' | 'buyer'; colors: Colors; onPress: () => void }) {
  const stage = STAGE_UI[deal.stage];
  const sentiment = deal.feedback ? SENTIMENT_UI[deal.feedback.sentiment] : null;
  const external = deal.buyer.kind === 'external';
  const cover = resolveMediaUrl(deal.offer.imageUrl);
  const title = mode === 'offer' ? buyerDisplayName(deal) : deal.offer.title;
  const subtitle =
    mode === 'offer'
      ? deal.buyer.kind === 'external'
        ? [deal.buyer.agency && deal.buyer.name ? deal.buyer.agency : null, deal.sourceLabel].filter(Boolean).join(' · ')
        : deal.sourceLabel
      : [deal.offer.address, deal.offer.price ? formatCurrencyPLN(deal.offer.price) : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
      {mode === 'buyer' ? (
        cover ? (
          <Image source={{ uri: cover }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.center, { backgroundColor: colors.input }]}>
            <Ionicons name="home-outline" size={18} color={colors.secondary} />
          </View>
        )
      ) : (
        <View style={[styles.avatar, { backgroundColor: external ? 'rgba(88,86,214,0.14)' : 'rgba(255,149,0,0.14)' }]}>
          {external ? (
            <Ionicons name="business-outline" size={17} color="#5856D6" />
          ) : (
            <Text style={[styles.avatarText, appleType, { color: '#C25E00' }]}>{initials(title)}</Text>
          )}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, appleType, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {deal.status === 'PAUSED' ? <Text style={[styles.paused, { color: colors.secondary }]}>wstrzymane</Text> : null}
        </View>
        {subtitle ? (
          <Text style={[styles.rowSub, appleType, { color: colors.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.stagePill, { backgroundColor: `${stage.color}1F` }]}>
            <View style={[styles.dot, { backgroundColor: stage.color }]} />
            <Text style={[styles.stageText, appleType, { color: stage.color }]}>{stage.label}</Text>
          </View>
          {deal.presentation && deal.stage !== 'feedback' && deal.stage !== 'lost' ? (
            <Text style={[styles.metaText, appleType, { color: colors.secondary }]}>
              {formatDealWhen(deal.presentation.heldAt || deal.presentation.startsAt)}
            </Text>
          ) : null}
          {sentiment ? (
            <View style={styles.sentiment}>
              <Ionicons name={sentiment.icon} size={13} color={sentiment.color} />
              <Text style={[styles.metaText, appleType, { color: sentiment.color, fontWeight: '600' }]}>{sentiment.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.next, appleType, { color: colors.text }]} numberOfLines={1}>
          → {deal.nextAction}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.secondary} />
    </Pressable>
  );
}

function AddBuyerSheet({
  token,
  offerId,
  colors,
  onClose,
  onAdded,
}: {
  token: string;
  offerId: number;
  colors: Colors;
  onClose: () => void;
  onAdded: (dealId: number) => void;
}) {
  const [tab, setTab] = useState<'crm' | 'new' | 'agency'>('crm');
  const [buyers, setBuyers] = useState<AgencyClientListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', agency: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchAgencyClients(token, 'BUYER').then((res) => setBuyers(res.clients));
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (buyers || [])
      .filter((b) => !q || `${b.firstName} ${b.lastName} ${b.phone || ''} ${b.email || ''}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [buyers, query]);

  const submit = async (body: Parameters<typeof postBuyerDealAction>[1]) => {
    setBusy(true);
    const res = await postBuyerDealAction(token, body);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Kupujący', res.message);
      return;
    }
    onAdded(res.deal.id);
  };

  const field = (key: keyof typeof form, placeholder: string, extra?: object) => (
    <TextInput
      value={form[key]}
      onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
      placeholder={placeholder}
      placeholderTextColor={colors.secondary}
      style={[styles.input, { color: colors.text, backgroundColor: colors.input }]}
      {...extra}
    />
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, appleType, { color: colors.text }]}>Dodaj kupującego</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: '#007AFF', fontSize: 16 }}>Zamknij</Text>
          </Pressable>
        </View>
        <View style={[styles.segment, { backgroundColor: colors.input }]}>
          {(
            [
              ['crm', 'Z mojego CRM'],
              ['new', 'Nowy'],
              ['agency', 'Inna agencja'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.segmentItem, tab === key && { backgroundColor: colors.card }]}>
              <Text style={[styles.segmentText, appleType, { color: colors.text, fontWeight: tab === key ? '700' : '500' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'crm' ? (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Szukaj po nazwisku, telefonie, e-mailu"
              placeholderTextColor={colors.secondary}
              style={[styles.input, { color: colors.text, backgroundColor: colors.input }]}
            />
            {buyers === null ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#34C759" />
            ) : (
              <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
                {filtered.map((buyer) => (
                  <Pressable
                    key={buyer.id}
                    disabled={busy}
                    onPress={() => void submit({ action: 'add_buyer', offerId, buyerClientId: buyer.id })}
                    style={({ pressed }) => [styles.pickRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.rowTitle, appleType, { color: colors.text }]}>
                      {buyer.firstName} {buyer.lastName}
                    </Text>
                    <Text style={[styles.rowSub, appleType, { color: colors.secondary }]}>
                      {[buyer.phone, buyer.buyerCity, buyer.buyerMaxPrice ? `do ${formatCurrencyPLN(buyer.buyerMaxPrice)}` : null]
                        .filter(Boolean)
                        .join(' · ') || `Nr ${buyer.id}`}
                    </Text>
                  </Pressable>
                ))}
                {!filtered.length ? (
                  <Text style={[styles.rowSub, appleType, { color: colors.secondary, marginTop: 16, textAlign: 'center' }]}>
                    Brak kupujących — dodaj nowego w zakładce „Nowy”.
                  </Text>
                ) : null}
              </ScrollView>
            )}
          </>
        ) : tab === 'new' ? (
          <View style={{ gap: 8 }}>
            {field('firstName', 'Imię')}
            {field('lastName', 'Nazwisko')}
            {field('phone', 'Telefon', { keyboardType: 'phone-pad' })}
            {field('email', 'E-mail', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            <Pressable
              disabled={busy || !form.firstName.trim()}
              onPress={() =>
                void submit({
                  action: 'add_buyer',
                  offerId,
                  newBuyer: { firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email },
                })
              }
              style={[styles.primary, { opacity: busy || !form.firstName.trim() ? 0.5 : 1 }]}
            >
              <Text style={styles.primaryText}>Dodaj i otwórz ścieżkę</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={[styles.rowSub, appleType, { color: colors.secondary }]}>
              Kupujący innej agencji — zapisujesz agencję i kontakt do agenta. Danych osobowych kupującego nie potrzebujesz.
            </Text>
            {field('agency', 'Nazwa agencji')}
            {field('firstName', 'Agent albo kupujący (opcjonalnie)')}
            {field('phone', 'Telefon', { keyboardType: 'phone-pad' })}
            {field('email', 'E-mail', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            <Pressable
              disabled={busy || !form.agency.trim()}
              onPress={() =>
                void submit({
                  action: 'add_buyer',
                  offerId,
                  external: { agency: form.agency, name: form.firstName, phone: form.phone, email: form.email },
                })
              }
              style={[styles.primary, { opacity: busy || !form.agency.trim() ? 0.5 : 1 }]}
            >
              <Text style={styles.primaryText}>Dodaj i otwórz ścieżkę</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

/**
 * Sekcja „Kupujący” na karcie oferty sprzedającego albo „W procesie” na karcie kupującego.
 * Każdy wiersz otwiera tę samą ścieżkę kupujący ↔ nieruchomość.
 */
export default function OfferBuyersSection(props: Props) {
  const { token, colors, onOpenDeal } = props;
  const [deals, setDeals] = useState<BuyerDeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [adding, setAdding] = useState(false);
  const offerId = props.mode === 'offer' ? props.offerId : 0;
  const buyerClientId = props.mode === 'buyer' ? props.buyerClientId : 0;

  const load = useCallback(async () => {
    if (!token) return;
    const res = offerId ? await fetchOfferBuyerDeals(token, offerId) : await fetchBuyerClientDeals(token, buyerClientId);
    if (res.ok) {
      setDeals(res.deals);
      setError(null);
    } else setError(res.message);
  }, [token, offerId, buyerClientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = useMemo(() => {
    const list = deals || [];
    const closed = list.filter((d) => d.status === 'LOST');
    const radar = list.filter((d) => d.status !== 'LOST' && d.stage === 'interested' && d.source === 'radar');
    const active = list.filter((d) => !closed.includes(d) && !radar.includes(d));
    return { active, radar, closed };
  }, [deals]);

  const counts = useMemo(() => {
    const list = (deals || []).filter((d) => d.status !== 'LOST');
    return [
      { label: 'Umówione', value: list.filter((d) => d.stage === 'scheduled' || d.stage === 'scheduling').length },
      { label: 'Obejrzało', value: list.filter((d) => Boolean(d.presentation?.heldAt)).length },
      { label: 'Podoba się', value: list.filter((d) => d.feedback?.sentiment === 'like').length },
      { label: 'Nie pasuje', value: (deals || []).filter((d) => d.feedback?.sentiment === 'dislike').length },
    ];
  }, [deals]);

  const isOffer = props.mode === 'offer';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: isOffer ? 'rgba(255,149,0,0.14)' : 'rgba(0,122,255,0.12)' }]}>
          <Ionicons name={isOffer ? 'people-outline' : 'home-outline'} size={19} color={isOffer ? '#FF9500' : '#007AFF'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, appleType, { color: isOffer ? '#C25E00' : '#007AFF' }]}>
            {isOffer ? 'KUPUJĄCY' : 'W PROCESIE'} · {deals ? deals.filter((d) => d.status !== 'LOST').length : '…'}
          </Text>
          <Text style={[styles.title, appleType, { color: colors.text }]}>
            {isOffer ? 'Kto ogląda tę nieruchomość' : 'Nieruchomości, które ogląda'}
          </Text>
        </View>
        {isOffer && token ? (
          <Pressable onPress={() => setAdding(true)} hitSlop={8} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="add" size={16} color="#C25E00" />
            <Text style={[styles.addText, appleType]}>Dodaj</Text>
          </Pressable>
        ) : null}
      </View>

      {isOffer && deals?.length ? (
        <View style={styles.counts}>
          {counts.map((item) => (
            <View key={item.label} style={[styles.count, { backgroundColor: colors.input }]}>
              <Text style={[styles.countValue, appleType, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.countLabel, appleType, { color: colors.secondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {deals === null && !error ? <ActivityIndicator style={{ marginVertical: 18 }} color="#FF9500" /> : null}
      {error ? <Text style={[styles.empty, appleType, { color: '#FF3B30' }]}>{error}</Text> : null}
      {deals && !deals.length ? (
        <Text style={[styles.empty, appleType, { color: colors.secondary }]}>
          {isOffer
            ? 'Nikt jeszcze nie ogląda. Kupujący pojawią się sami po wysłaniu oferty z radaru, zapytaniu albo umówionej prezentacji — możesz też dodać ich ręcznie.'
            : 'Kupujący nie jest jeszcze w procesie przy żadnej nieruchomości.'}
        </Text>
      ) : null}

      {groups.active.map((deal) => (
        <DealRow key={deal.id} deal={deal} mode={props.mode} colors={colors} onPress={() => onOpenDeal(deal.id)} />
      ))}

      {groups.radar.length ? (
        <>
          <Pressable onPress={() => setShowRadar((v) => !v)} style={[styles.groupToggle, { borderTopColor: colors.border }]}>
            <Text style={[styles.groupText, appleType, { color: colors.secondary }]}>
              Otrzymali ofertę z radaru, bez reakcji · {groups.radar.length}
            </Text>
            <Ionicons name={showRadar ? 'chevron-up' : 'chevron-down'} size={15} color={colors.secondary} />
          </Pressable>
          {showRadar
            ? groups.radar.map((deal) => (
                <DealRow key={deal.id} deal={deal} mode={props.mode} colors={colors} onPress={() => onOpenDeal(deal.id)} />
              ))
            : null}
        </>
      ) : null}

      {groups.closed.length ? (
        <>
          <Pressable onPress={() => setShowClosed((v) => !v)} style={[styles.groupToggle, { borderTopColor: colors.border }]}>
            <Text style={[styles.groupText, appleType, { color: colors.secondary }]}>Zakończone · {groups.closed.length}</Text>
            <Ionicons name={showClosed ? 'chevron-up' : 'chevron-down'} size={15} color={colors.secondary} />
          </Pressable>
          {showClosed
            ? groups.closed.map((deal) => (
                <DealRow key={deal.id} deal={deal} mode={props.mode} colors={colors} onPress={() => onOpenDeal(deal.id)} />
              ))
            : null}
        </>
      ) : null}

      {adding && token && offerId ? (
        <AddBuyerSheet
          token={token}
          offerId={offerId}
          colors={colors}
          onClose={() => setAdding(false)}
          onAdded={(dealId) => {
            setAdding(false);
            void load();
            onOpenDeal(dealId);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255,149,0,0.14)',
  },
  addText: { color: '#C25E00', fontSize: 13, fontWeight: '700' },
  counts: { flexDirection: 'row', gap: 8, marginTop: 14 },
  count: { flex: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 },
  countValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 11, marginTop: 1 },
  empty: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  paused: { fontSize: 11, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  stagePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stageText: { fontSize: 11, fontWeight: '700' },
  metaText: { fontSize: 12 },
  sentiment: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  next: { fontSize: 13, fontWeight: '500', marginTop: 5 },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  groupText: { fontSize: 13, fontWeight: '600' },
  sheet: { flex: 1, padding: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: 14 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 13 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  pickRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  primary: { marginTop: 6, minHeight: 48, borderRadius: 14, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
