import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';
import {
  decideIntelligenceApproval,
  fetchAgentToday,
  reportOwnerCall,
  type AgentToday,
  type TodayApproval,
  type TodayOffer,
  type TodayOwnerCall,
  type TodayReply,
  type TodayScheduleItem,
  type TodayStaleClient,
} from '../services/agentTodayService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Palette = ReturnType<typeof makePalette>;

function makePalette(isDark: boolean) {
  return {
    isDark,
    bg: isDark ? '#000000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    raised: isDark ? '#2C2C2E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#98989F' : '#6C6C70',
    hairline: isDark ? 'rgba(84,84,88,0.5)' : 'rgba(60,60,67,0.14)',
    green: '#34C759',
    greenInk: '#052E16',
    orange: '#FF9F0A',
    red: '#FF453A',
    blue: isDark ? '#0A84FF' : '#007AFF',
    purple: isDark ? '#BF5AF2' : '#AF52DE',
  };
}

function formatPrice(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function offerLine(offer: TodayOffer | null): string {
  if (!offer) return '';
  return [
    formatPrice(offer.price),
    offer.area ? `${Math.round(offer.area)} m²` : null,
    offer.rooms ? `${offer.rooms} pok.` : null,
    [offer.district, offer.city].filter(Boolean).join(', ') || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function agoLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'wczoraj' : `${days} dni temu`;
}

function animateNext() {
  LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
}

function openPhone(phone: string | null | undefined, mode: 'tel' | 'sms' = 'tel') {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  if (!clean) return;
  void Linking.openURL(`${mode}:${clean}`);
}

function openMaps(location: string) {
  if (!location.trim()) return;
  const query = encodeURIComponent(location);
  void Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${query}` : `geo:0,0?q=${query}`);
}

const REPLY_META: Record<TodayReply['kind'], { icon: keyof typeof Ionicons.glyphMap; tint: keyof Palette }> = {
  viewing: { icon: 'eye', tint: 'green' },
  message: { icon: 'chatbubble-ellipses', tint: 'blue' },
  handoff: { icon: 'hand-left', tint: 'orange' },
  question: { icon: 'help-circle', tint: 'purple' },
  stalled: { icon: 'pause-circle', tint: 'secondary' },
};

/* ───────────────────────────── building blocks ───────────────────────────── */

function SectionHeader({
  title,
  count,
  tint,
  icon,
  palette,
  hint,
}: {
  title: string;
  count: number;
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: Palette;
  hint?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {title} <Text style={{ color: palette.secondary, fontWeight: '600' }}>{count}</Text>
        </Text>
        {hint ? <Text style={[styles.sectionHint, { color: palette.secondary }]}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  palette,
  tone = 'neutral',
  busy,
  flex = 1,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: Palette;
  tone?: 'primary' | 'neutral' | 'danger' | 'blue';
  busy?: boolean;
  flex?: number;
}) {
  const bg =
    tone === 'primary' ? palette.green : tone === 'blue' ? palette.blue : palette.raised;
  const fg =
    tone === 'primary' ? palette.greenInk : tone === 'blue' ? '#fff' : tone === 'danger' ? palette.red : palette.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: bg, flex, opacity: busy ? 0.6 : pressed ? 0.8 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
          <Text style={[styles.actionBtnText, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function OfferHeader({ offer, palette, badge }: { offer: TodayOffer | null; palette: Palette; badge?: React.ReactNode }) {
  return (
    <View style={styles.offerRow}>
      {offer?.imageUrl ? (
        <Image source={{ uri: offer.imageUrl }} style={styles.offerThumb} contentFit="cover" transition={180} />
      ) : (
        <View style={[styles.offerThumb, styles.offerThumbEmpty, { backgroundColor: palette.raised }]}>
          <Ionicons name="home-outline" size={22} color={palette.secondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.offerTitle, { color: palette.text }]} numberOfLines={2}>
          {offer?.title || 'Oferta'}
        </Text>
        <Text style={[styles.offerMeta, { color: palette.secondary }]} numberOfLines={1}>
          {offerLine(offer)}
        </Text>
        {badge}
      </View>
    </View>
  );
}

function ClientChip({ name, onPress, palette }: { name: string; onPress: () => void; palette: Palette }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.clientChip, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name="person-circle" size={16} color={palette.blue} />
      <Text style={[styles.clientChipText, { color: palette.blue }]} numberOfLines={1}>
        dla: {name}
      </Text>
      <Ionicons name="chevron-forward" size={12} color={palette.blue} />
    </Pressable>
  );
}

/* ───────────────────────────── cards ───────────────────────────── */

function OwnerCallCard({
  item,
  palette,
  busy,
  onOutcome,
  onOpenClient,
}: {
  item: TodayOwnerCall;
  palette: Palette;
  busy: boolean;
  onOutcome: (outcome: 'available' | 'sold' | 'no_answer') => void;
  onOpenClient: () => void;
}) {
  const [called, setCalled] = useState(false);
  const phone = item.owner?.phone || null;
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.hairline }]}>
      <OfferHeader
        offer={item.offer}
        palette={palette}
        badge={
          <View style={[styles.badge, { backgroundColor: 'rgba(255,159,10,0.14)' }]}>
            <Text style={[styles.badgeText, { color: palette.orange }]}>
              Ogłoszenie zniknęło z portali{item.attempts ? ` · próba ${item.attempts + 1}` : ''}
            </Text>
          </View>
        }
      />
      <ClientChip name={item.clientName} onPress={onOpenClient} palette={palette} />
      {item.owner?.note ? (
        <Text style={[styles.ownerNote, { color: palette.secondary }]} numberOfLines={3}>
          {item.owner.note}
        </Text>
      ) : null}
      {phone ? (
        <ActionButton
          label={`Zadzwoń do właściciela · ${phone}`}
          icon="call"
          tone="blue"
          palette={palette}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setCalled(true);
            openPhone(phone);
          }}
        />
      ) : (
        <Text style={[styles.ownerNote, { color: palette.secondary }]}>
          Brak numeru w notatce oferty — sprawdź kontakt na karcie oferty.
        </Text>
      )}
      <Text style={[styles.outcomeLabel, { color: palette.secondary }]}>
        {called ? 'Jak poszło?' : 'Wynik rozmowy'}
      </Text>
      <View style={styles.actionsRow}>
        <ActionButton label="Dostępna — wyślij" icon="checkmark" tone="primary" palette={palette} busy={busy} flex={1.4} onPress={() => onOutcome('available')} />
        <ActionButton label="Nie odbiera" palette={palette} busy={busy} onPress={() => onOutcome('no_answer')} />
        <ActionButton label="Sprzedana" tone="danger" palette={palette} busy={busy} onPress={() => onOutcome('sold')} />
      </View>
    </View>
  );
}

function ApprovalCard({
  item,
  palette,
  busy,
  onDecide,
  onOpenClient,
}: {
  item: TodayApproval;
  palette: Palette;
  busy: boolean;
  onDecide: (decision: 'approve' | 'skip') => void;
  onOpenClient: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.hairline }]}>
      <OfferHeader
        offer={item.offer}
        palette={palette}
        badge={
          item.score != null ? (
            <View style={[styles.badge, { backgroundColor: 'rgba(52,199,89,0.14)' }]}>
              <Text style={[styles.badgeText, { color: palette.green }]}>Dopasowanie {item.score}%</Text>
            </View>
          ) : null
        }
      />
      <ClientChip name={item.clientName} onPress={onOpenClient} palette={palette} />
      {item.clientWhy ? (
        <View style={[styles.quote, { borderLeftColor: palette.green, backgroundColor: palette.raised }]}>
          <Text style={[styles.quoteLabel, { color: palette.secondary }]}>KLIENT PRZECZYTA</Text>
          <Text style={[styles.quoteText, { color: palette.text }]}>{item.clientWhy}</Text>
        </View>
      ) : null}
      <View style={styles.actionsRow}>
        <ActionButton label="Pomiń" palette={palette} busy={busy} onPress={() => onDecide('skip')} />
        <ActionButton label="Wyślij klientowi" icon="paper-plane" tone="primary" palette={palette} busy={busy} flex={1.8} onPress={() => onDecide('approve')} />
      </View>
    </View>
  );
}

function ReplyRow({ item, palette, onPress }: { item: TodayReply; palette: Palette; onPress: () => void }) {
  const meta = REPLY_META[item.kind];
  const tint = palette[meta.tint] as string;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: palette.card, borderColor: palette.hairline, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={meta.icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
            {item.clientName}
          </Text>
          <Text style={[styles.rowTime, { color: palette.secondary }]}>{agoLabel(item.createdAt)}</Text>
        </View>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={[styles.rowBody, { color: palette.secondary }]} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.secondary} />
    </Pressable>
  );
}

function ScheduleRow({ item, palette, onPress }: { item: TodayScheduleItem; palette: Palette; onPress: () => void }) {
  const started = new Date(item.startsAt).getTime() <= Date.now();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: palette.card, borderColor: palette.hairline, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, { color: started ? palette.secondary : palette.text }]}>{timeLabel(item.startsAt)}</Text>
        {item.status === 'pending' ? (
          <Text style={[styles.timeHint, { color: palette.orange }]}>niepotw.</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.rowBody, { color: palette.secondary }]} numberOfLines={1}>
          {item.location || item.subtitle}
        </Text>
      </View>
      {item.location ? (
        <Pressable
          onPress={() => openMaps(item.location)}
          hitSlop={10}
          accessibilityLabel="Nawiguj"
          style={[styles.roundBtn, { backgroundColor: palette.raised }]}
        >
          <Ionicons name="navigate" size={16} color={palette.blue} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function StaleRow({ item, palette, onPress }: { item: TodayStaleClient; palette: Palette; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: palette.card, borderColor: palette.hairline, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Text style={[styles.rowBody, { color: palette.secondary }]}>
          {item.type === 'SELLER' ? 'Sprzedający' : 'Kupujący'} · {item.days} dni bez kontaktu
        </Text>
      </View>
      {item.phone ? (
        <>
          <Pressable onPress={() => openPhone(item.phone, 'sms')} hitSlop={8} accessibilityLabel="SMS" style={[styles.roundBtn, { backgroundColor: palette.raised }]}>
            <Ionicons name="chatbubble" size={15} color={palette.blue} />
          </Pressable>
          <Pressable onPress={() => openPhone(item.phone)} hitSlop={8} accessibilityLabel="Zadzwoń" style={[styles.roundBtn, { backgroundColor: palette.raised }]}>
            <Ionicons name="call" size={15} color={palette.green} />
          </Pressable>
        </>
      ) : null}
    </Pressable>
  );
}

/* ───────────────────────────── screen ───────────────────────────── */

export default function AgencyTodayScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useIsDarkTheme();
  const palette = useMemo(() => makePalette(isDark), [isDark]);

  const [today, setToday] = useState<AgentToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setToast(null));
      }, 2400);
    },
    [toastOpacity],
  );

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!token) return;
      if (mode === 'refresh') setRefreshing(true);
      const res = await fetchAgentToday(token);
      if (res.ok) {
        if (mode !== 'initial') animateNext();
        setToday(res.today);
        setError(null);
      } else if (!today) {
        setError(res.message);
      }
      setLoading(false);
      setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load(today ? 'silent' : 'initial');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const setBusy = (id: number, value: boolean) =>
    setBusyIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const removeApproval = (approvalId: number) => {
    animateNext();
    setToday((current) =>
      current
        ? {
            ...current,
            ownerCalls: current.ownerCalls.filter((row) => row.approvalId !== approvalId),
            approvals: current.approvals.filter((row) => row.approvalId !== approvalId),
          }
        : current,
    );
  };

  const openClient = (clientId: number | null) => {
    if (!clientId) return;
    void Haptics.selectionAsync();
    navigation.navigate('AgencyClientDetail', { clientId });
  };

  const decide = async (item: TodayApproval, decision: 'approve' | 'skip') => {
    if (!token) return;
    setBusy(item.approvalId, true);
    const res = await decideIntelligenceApproval(token, item.clientId, item.approvalId, decision);
    setBusy(item.approvalId, false);
    if (!res.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Propozycja', res.message);
      void load('silent');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    removeApproval(item.approvalId);
    const firstName = item.clientName.split(' ')[0];
    showToast(decision === 'approve' ? `Wysłano — ${firstName} dostał propozycję` : 'Pominięto — ta oferta nie wróci');
  };

  const ownerOutcome = (item: TodayOwnerCall, outcome: 'available' | 'sold' | 'no_answer') => {
    const run = async () => {
      if (!token) return;
      setBusy(item.approvalId, true);
      const res = await reportOwnerCall(token, item.approvalId, outcome);
      setBusy(item.approvalId, false);
      if (!res.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Rozmowa z właścicielem', res.message);
        void load('silent');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      removeApproval(item.approvalId);
      if (outcome === 'available') showToast(`Wysłano do: ${item.clientName.split(' ')[0]}`);
      else if (outcome === 'sold')
        showToast(res.skippedOthers ? `Oferta wycofana u ${res.skippedOthers + 1} klientów` : 'Oferta wycofana z bazy');
      else showToast(res.snoozedUntil ? `Przypomnę o ${timeLabel(res.snoozedUntil)}` : 'Przypomnę później');
    };
    if (outcome === 'sold') {
      Alert.alert(
        'Nieruchomość sprzedana?',
        'Propozycja odpadnie u wszystkich klientów, a oferta wypadnie z bazy.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Tak, sprzedana', style: 'destructive', onPress: () => void run() },
        ],
      );
      return;
    }
    void run();
  };

  const counts = today?.counts;
  const actionable = counts ? counts.ownerCalls + counts.approvals + counts.replies : 0;
  const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const summary = !counts
    ? ''
    : actionable === 0
      ? counts.schedule
        ? `${counts.schedule} ${counts.schedule === 1 ? 'termin' : 'terminy'} w kalendarzu, nic pilnego`
        : 'Nic nie czeka na Twój ruch'
      : `${actionable} ${actionable === 1 ? 'sprawa czeka' : actionable < 5 ? 'sprawy czekają' : 'spraw czeka'} na Twój ruch`;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn} accessibilityLabel="Wróć">
          <Ionicons name="chevron-back" size={28} color={palette.blue} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('AgencyClients')}
          hitSlop={12}
          style={styles.navLink}
          accessibilityRole="button"
        >
          <Ionicons name="people" size={18} color={palette.blue} />
          <Text style={[styles.navLinkText, { color: palette.blue }]}>Klienci</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={palette.secondary} />}
      >
        <Text style={[styles.dateLabel, { color: palette.secondary }]}>{dateLabel.toUpperCase()}</Text>
        <Text style={[styles.title, { color: palette.text }]}>Dziś</Text>
        {summary ? <Text style={[styles.summary, { color: palette.secondary }]}>{summary}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={palette.secondary} />
        ) : error && !today ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={40} color={palette.secondary} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>{error}</Text>
            <ActionButton label="Spróbuj ponownie" palette={palette} onPress={() => void load('refresh')} flex={0} />
          </View>
        ) : today && counts && counts.total === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyBadge, { backgroundColor: 'rgba(52,199,89,0.14)' }]}>
              <Ionicons name="checkmark" size={34} color={palette.green} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Wszystko załatwione</Text>
            <Text style={[styles.emptyBody, { color: palette.secondary }]}>
              Asystent pracuje w tle. Gdy klient odpowie albo pojawi się oferta do akceptacji, zobaczysz ją tutaj.
            </Text>
          </View>
        ) : today ? (
          <>
            {today.ownerCalls.length ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Zadzwoń do właściciela"
                  count={today.ownerCalls.length}
                  tint={palette.orange}
                  icon="call"
                  palette={palette}
                  hint="Kupujący czeka — ogłoszenia już nie ma w internecie, kontakt masz tylko Ty"
                />
                {today.ownerCalls.map((item) => (
                  <OwnerCallCard
                    key={item.approvalId}
                    item={item}
                    palette={palette}
                    busy={busyIds.has(item.approvalId)}
                    onOutcome={(outcome) => ownerOutcome(item, outcome)}
                    onOpenClient={() => openClient(item.clientId)}
                  />
                ))}
              </View>
            ) : null}

            {today.approvals.length ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Do akceptacji"
                  count={today.approvals.length}
                  tint={palette.green}
                  icon="sparkles"
                  palette={palette}
                  hint="Asystent przygotował propozycje — wyślij albo pomiń"
                />
                {today.approvals.map((item) => (
                  <ApprovalCard
                    key={item.approvalId}
                    item={item}
                    palette={palette}
                    busy={busyIds.has(item.approvalId)}
                    onDecide={(decision) => void decide(item, decision)}
                    onOpenClient={() => openClient(item.clientId)}
                  />
                ))}
              </View>
            ) : null}

            {today.replies.length ? (
              <View style={styles.section}>
                <SectionHeader title="Klienci czekają" count={today.replies.length} tint={palette.blue} icon="chatbubbles" palette={palette} />
                {today.replies.map((item) => (
                  <ReplyRow key={item.id} item={item} palette={palette} onPress={() => openClient(item.clientId)} />
                ))}
              </View>
            ) : null}

            {today.schedule.length ? (
              <View style={styles.section}>
                <SectionHeader title="W kalendarzu" count={today.schedule.length} tint={palette.purple} icon="calendar" palette={palette} />
                {today.schedule.map((item) => (
                  <ScheduleRow key={item.id} item={item} palette={palette} onPress={() => openClient(item.clientId)} />
                ))}
              </View>
            ) : null}

            {today.stale.length ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Bez kontaktu"
                  count={today.stale.length}
                  tint="#8E8E93"
                  icon="time"
                  palette={palette}
                  hint="Krótki telefon albo SMS utrzyma klienta przy Tobie"
                />
                {today.stale.map((item) => (
                  <StaleRow key={item.clientId} item={item} palette={palette} onPress={() => openClient(item.clientId)} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 54, opacity: toastOpacity, backgroundColor: isDark ? '#2C2C2E' : '#1C1C1E' }]}
        >
          <Ionicons name="checkmark-circle" size={18} color={palette.green} />
          <Text style={styles.toastText} numberOfLines={2}>
            {toast}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  navBtn: { width: 44, height: 36, justifyContent: 'center' },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, height: 36 },
  navLinkText: { fontSize: 16, fontWeight: '600' },
  dateLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  summary: { fontSize: 15, marginTop: 4, marginBottom: 8 },
  section: { marginTop: 22, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  sectionIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionHint: { fontSize: 12, marginTop: 1 },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  offerRow: { flexDirection: 'row', gap: 12 },
  offerThumb: { width: 76, height: 76, borderRadius: 12 },
  offerThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  offerTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  offerMeta: { fontSize: 13, marginTop: 3 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  clientChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  clientChipText: { fontSize: 14, fontWeight: '600', maxWidth: 260 },
  ownerNote: { fontSize: 13, lineHeight: 18 },
  outcomeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: -4 },
  quote: { borderLeftWidth: 3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  quoteLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  quoteText: { fontSize: 14, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700' },
  rowTime: { fontSize: 12 },
  rowTitle: { fontSize: 14, fontWeight: '600', marginTop: 1 },
  rowBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  timeCol: { width: 52, alignItems: 'flex-start' },
  timeText: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeHint: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 64, paddingHorizontal: 24 },
  emptyBadge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
});
