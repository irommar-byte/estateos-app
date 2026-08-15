import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NumericKeyboardAccessory from '../NumericKeyboardAccessory';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import {
  adminPhotoSessionAction,
  fetchAdminPhotoSessionQueue,
  PhotoSessionRequestItem,
  PhotoSessionServiceError,
} from '../../services/photoSessionService';
import { photoSessionPaymentAdminHint, photoSessionPaymentLabel } from '../../utils/photoSessionBilling';
import {
  offerPhotoSessionCalendarAfterAcceptance,
  photoSessionCalendarParamsFromItem,
} from '../../utils/photoSessionCalendar';
import CollapsiblePhotoSessionHistory from '../photoSession/CollapsiblePhotoSessionHistory';
import PresentationCountdown from '../dealroom/PresentationCountdown';
import { openDirectContactChat } from '../../utils/openDirectContact';

const ADMIN_HISTORY_LABELS = {
  timelineTitle: 'Historia negocjacji',
  timelineExpand: 'Pokaż historię negocjacji',
  timelineCollapse: 'Zwiń historię negocjacji',
  formatBadgeConfirmed: (date: string) => `Termin umówiony — ${date}`,
  formatBadgeNegotiating: (date: string) => `Negocjacje terminu — propozycja ${date}`,
};

type Theme = {
  background: string;
  text: string;
  subtitle: string;
  glass: 'dark' | 'light';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  onQueueChange?: (pendingCount: number) => void;
  onViewUser?: (userId: number, seed?: { name?: string | null; phone?: string | null; email?: string | null }) => void;
};

function buildNextDays() {
  return Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

function buildHours() {
  const arr: string[] = [];
  for (let h = 8; h <= 20; h += 1) {
    arr.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) arr.push(`${String(h).padStart(2, '0')}:30`);
  }
  return arr;
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function eventLabel(action: string) {
  switch (String(action).toUpperCase()) {
    case 'PROPOSED':
      return 'Propozycja klienta';
    case 'COUNTERED':
      return 'Kontroferta';
    case 'ACCEPTED':
      return 'Zaakceptowano';
    case 'DECLINED':
      return 'Odrzucono';
    default:
      return action;
  }
}

function CounterPicker({
  isDark,
  textColor,
  mutedColor,
  cardBorder,
  selectedDate,
  selectedHour,
  onSelectDate,
  onSelectHour,
}: {
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  cardBorder: string;
  selectedDate: Date | null;
  selectedHour: string | null;
  onSelectDate: (d: Date) => void;
  onSelectHour: (h: string) => void;
}) {
  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);

  return (
    <View style={styles.counterPicker}>
      <Text style={[styles.counterLabel, { color: mutedColor }]}>Wybierz kontrofertę</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesRow}>
        {dates.map((d) => {
          const selected = selectedDate?.toDateString() === d.toDateString();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => onSelectDate(d)}
              style={[
                styles.dayCard,
                { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                selected && styles.dayCardActive,
              ]}
            >
              <Text style={[styles.dayWeek, selected && styles.dayWeekActive]}>
                {d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}
              </Text>
              <Text style={[styles.dayNum, { color: textColor }, selected && styles.dayNumActive]}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.hoursGrid}>
        {hours.map((h) => {
          const selected = selectedHour === h;
          return (
            <Pressable
              key={h}
              onPress={() => onSelectHour(h)}
              style={[
                styles.hourTile,
                { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                selected && styles.hourTileActive,
              ]}
            >
              <Text style={[styles.hourText, { color: textColor }, selected && styles.hourTextActive]}>{h}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AdminPhotoSessionsModal({ visible, onClose, theme, onQueueChange, onViewUser }: Props) {
  const navigation = useNavigation<any>();
  const { token } = useAuthStore() as { token?: string | null };
  const safeToken = useMemo(() => {
    const trimmed = String(token || '').trim();
    if (!trimmed) return null;
    return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
  }, [token]);
  const isDark = theme.glass === 'dark';
  const [items, setItems] = useState<PhotoSessionRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [counterForId, setCounterForId] = useState<number | null>(null);
  const [counterDate, setCounterDate] = useState<Date | null>(null);
  const [counterHour, setCounterHour] = useState<string | null>(null);
  const [counterNote, setCounterNote] = useState('');

  const loadQueue = useCallback(async () => {
    if (!safeToken) return;
    setLoading(true);
    try {
      const list = await fetchAdminPhotoSessionQueue('ALL', safeToken);
      const sorted = [...list].sort((a, b) => {
        const rank = (item: PhotoSessionRequestItem) => {
          if (item.status === 'PENDING') return item.waitingOn === 'ADMIN' ? 0 : 1;
          if (item.status === 'ACCEPTED') return 2;
          return 3;
        };
        const aRank = rank(a);
        const bRank = rank(b);
        if (aRank !== bRank) return aRank - bRank;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setItems(sorted);
      onQueueChange?.(list.filter((x) => x.status === 'PENDING' && x.waitingOn === 'ADMIN').length);
    } catch (err) {
      const msg = err instanceof PhotoSessionServiceError ? err.message : 'Nie udało się pobrać kolejki sesji.';
      Alert.alert('Sesje zdjęciowe', msg);
      onQueueChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [safeToken, onQueueChange]);

  useEffect(() => {
    if (visible) {
      setCounterForId(null);
      setCounterDate(null);
      setCounterHour(null);
      setCounterNote('');
      void loadQueue();
    }
  }, [visible, loadQueue]);

  const runAction = async (
    item: PhotoSessionRequestItem,
    action: 'accept' | 'counter' | 'reject',
    extra?: { proposedAt?: string; adminNote?: string },
  ) => {
    if (submittingId) return;
    setSubmittingId(item.id);
    try {
      const result = await adminPhotoSessionAction(item.id, { action, ...extra }, safeToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCounterForId(null);
      setCounterDate(null);
      setCounterHour(null);
      setCounterNote('');
      if (action === 'accept' && result?.request) {
        void offerPhotoSessionCalendarAfterAcceptance(
          photoSessionCalendarParamsFromItem(result.request, 'admin', {
            adminNote: extra?.adminNote ?? result.request.adminNote,
          }),
        );
      }
      await loadQueue();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof PhotoSessionServiceError ? err.message : 'Operacja nie powiodła się.';
      Alert.alert('Sesje zdjęciowe', msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAccept = (item: PhotoSessionRequestItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Zaakceptować termin?',
      formatDateTime(item.proposedAt),
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Akceptuj', onPress: () => void runAction(item, 'accept') },
      ],
    );
  };

  const handleReject = (item: PhotoSessionRequestItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Odrzucić propozycję?', 'Klient dostanie powiadomienie o odrzuceniu.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Odrzuć', style: 'destructive', onPress: () => void runAction(item, 'reject') },
    ]);
  };

  const handleCounterSubmit = (item: PhotoSessionRequestItem) => {
    if (!counterDate || !counterHour) {
      Alert.alert('Sesje zdjęciowe', 'Wybierz dzień i godzinę kontroferty.');
      return;
    }
    const [hh, mm] = counterHour.split(':');
    const dt = new Date(counterDate);
    dt.setHours(Number(hh), Number(mm), 0, 0);
    void runAction(item, 'counter', {
      proposedAt: dt.toISOString(),
      adminNote: counterNote.trim() || undefined,
    });
  };

  const handleContactClient = (item: PhotoSessionRequestItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    void openDirectContactChat(
      navigation,
      safeToken,
      item.userId,
      item.requesterName || `Użytkownik #${item.userId}`,
    );
  };

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const pendingItems = useMemo(() => items.filter((x) => x.status === 'PENDING'), [items]);
  const confirmedItems = useMemo(() => items.filter((x) => x.status === 'ACCEPTED'), [items]);
  const closedItems = useMemo(
    () => items.filter((x) => x.status === 'REJECTED' || x.status === 'CANCELLED'),
    [items],
  );
  const hasAnyItems = pendingItems.length + confirmedItems.length + closedItems.length > 0;

  const renderSessionCard = (item: PhotoSessionRequestItem, readOnly: 'negotiate' | 'confirmed' | 'closed') => (
    <View key={item.id} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Ionicons name="camera" size={18} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {item.requesterName || `Użytkownik #${item.userId}`}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.subtitle }]}>
            {item.propertyLabel || 'Nieruchomość w kreatorze'}
          </Text>
        </View>
        {readOnly === 'confirmed' ? (
          <View style={styles.confirmedPill}>
            <Text style={styles.confirmedPillText}>Potwierdzono</Text>
          </View>
        ) : readOnly === 'closed' ? (
          <View style={styles.closedPill}>
            <Text style={styles.closedPillText}>
              {item.status === 'REJECTED' ? 'Odrzucono' : 'Anulowano'}
            </Text>
          </View>
        ) : item.isProFree ? (
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>Investor Pro</Text>
          </View>
        ) : (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>199 zł</Text>
          </View>
        )}
      </View>

      <View style={[styles.termBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)' }]}>
        <Text style={styles.termLabel}>
          {readOnly === 'confirmed' ? 'Umówiony termin' : 'Aktualna propozycja'}
        </Text>
        <Text style={[styles.termValue, { color: theme.text }]}>{formatDateTime(item.proposedAt)}</Text>
        {readOnly === 'negotiate' ? (
          <Text style={[styles.waitingHint, { color: theme.subtitle }]}>
            {item.waitingOn === 'ADMIN'
              ? 'Twoja kolej — odpowiedz klientowi'
              : 'Termin wysłany — czekamy na odpowiedź klienta'}
          </Text>
        ) : readOnly === 'confirmed' ? (
          <Text style={[styles.waitingHint, { color: theme.subtitle }]}>
            Termin zaakceptowany — sesja w kalendarzu klienta i admina.
          </Text>
        ) : null}
      </View>

      {readOnly === 'confirmed' ? (
        <PresentationCountdown
          presentationIso={item.proposedAt}
          label="DO SESJI ZDJĘCIOWEJ POZOSTAŁO"
          variant="panel"
        />
      ) : null}

      <View
        style={[
          styles.billingBox,
          {
            backgroundColor: item.isProFree
              ? isDark
                ? 'rgba(168,85,247,0.12)'
                : 'rgba(168,85,247,0.08)'
              : isDark
                ? 'rgba(255,159,10,0.12)'
                : 'rgba(255,159,10,0.08)',
            borderColor: item.isProFree ? 'rgba(168,85,247,0.35)' : 'rgba(255,159,10,0.35)',
          },
        ]}
      >
        <Text style={[styles.billingLabel, { color: theme.subtitle }]}>Rozliczenie</Text>
        <Text style={[styles.billingValue, { color: theme.text }]}>
          {item.paymentLabel || photoSessionPaymentLabel(item.isProFree)}
        </Text>
        <Text style={[styles.billingHint, { color: theme.subtitle }]}>
          {photoSessionPaymentAdminHint(item.isProFree)}
        </Text>
      </View>

      {onViewUser ? (
        <Pressable
          onPress={() =>
            onViewUser(item.userId, {
              name: item.requesterName,
              phone: item.requesterPhone,
              email: item.requesterEmail,
            })
          }
          style={[styles.profileBtn, { borderColor: cardBorder }]}
        >
          <Ionicons name="person-circle-outline" size={16} color="#0ea5e9" />
          <Text style={styles.profileBtnText}>Profil zleceniodawcy</Text>
          <Ionicons name="chevron-forward" size={14} color="#8E8E93" />
        </Pressable>
      ) : null}

      {readOnly !== 'closed' ? (
        <TouchableOpacity
          onPress={() => handleContactClient(item)}
          style={[styles.contactBtn, { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f9fafb' }]}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0ea5e9" />
          <Text style={[styles.contactBtnText, { color: theme.text }]}>Kontakt z klientem</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.subtitle} />
        </TouchableOpacity>
      ) : null}

      {item.note ? (
        <Text style={[styles.note, { color: theme.subtitle }]} numberOfLines={4}>
          „{item.note}"
        </Text>
      ) : null}

      {(item.requesterPhone || item.requesterEmail) && (
        <Text style={[styles.contact, { color: theme.subtitle }]}>
          {[item.requesterPhone, item.requesterEmail].filter(Boolean).join(' · ')}
        </Text>
      )}

      <CollapsiblePhotoSessionHistory
        item={item}
        isDark={isDark}
        textColor={theme.text}
        mutedColor={theme.subtitle}
        labels={ADMIN_HISTORY_LABELS}
        formatEventLabel={eventLabel}
      />

      {readOnly === 'negotiate' && counterForId === item.id && item.waitingOn === 'ADMIN' ? (
        <>
          <CounterPicker
            isDark={isDark}
            textColor={theme.text}
            mutedColor={theme.subtitle}
            cardBorder={cardBorder}
            selectedDate={counterDate}
            selectedHour={counterHour}
            onSelectDate={setCounterDate}
            onSelectHour={setCounterHour}
          />
          <TextInput
            value={counterNote}
            onChangeText={setCounterNote}
            placeholder="Uwaga do kontroferty (opcjonalnie)"
            placeholderTextColor={theme.subtitle}
            style={[
              styles.noteInput,
              {
                color: theme.text,
                borderColor: cardBorder,
                backgroundColor: isDark ? '#141418' : '#f9fafb',
              },
            ]}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setCounterForId(null)}
              style={[styles.secondaryBtn, { borderColor: cardBorder }]}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Anuluj</Text>
            </Pressable>
            <Pressable
              onPress={() => handleCounterSubmit(item)}
              disabled={submittingId === item.id}
              style={[styles.primaryBtn, submittingId === item.id && { opacity: 0.6 }]}
            >
              {submittingId === item.id ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>Wyślij kontrofertę</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : readOnly === 'negotiate' && item.waitingOn === 'ADMIN' ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleReject(item)}
            disabled={submittingId === item.id}
            style={[styles.rejectBtn, { borderColor: 'rgba(239,68,68,0.35)' }]}
          >
            <Text style={styles.rejectBtnText}>Odrzuć</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCounterForId(item.id);
              setCounterDate(null);
              setCounterHour(null);
              setCounterNote('');
            }}
            disabled={submittingId === item.id}
            style={[styles.counterBtn, { borderColor: 'rgba(14,165,233,0.35)' }]}
          >
            <Text style={styles.counterBtnText}>Kontroferta</Text>
          </Pressable>
          <Pressable
            onPress={() => handleAccept(item)}
            disabled={submittingId === item.id}
            style={[styles.acceptBtn, submittingId === item.id && { opacity: 0.6 }]}
          >
            {submittingId === item.id ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#000" />
                <Text style={styles.acceptBtnText}>Akceptuj</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : readOnly === 'negotiate' ? (
        <View style={[styles.awaitingUserBox, { backgroundColor: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)' }]}>
          <Ionicons name="hourglass-outline" size={16} color="#0ea5e9" />
          <Text style={[styles.awaitingUserText, { color: theme.subtitle }]}>
            Kontroferta wysłana. Rezerwacja pozostaje na liście do czasu odpowiedzi klienta.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.subtitle }]}>NARZĘDZIA ADMINA</Text>
            <Text style={[styles.title, { color: theme.text }]}>Sesje zdjęciowe</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>
              Negocjuj terminy z klientami — akceptuj, odrzucaj lub proponuj kontrofertę.
            </Text>
          </View>
          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: cardBorder }]}>
            <Ionicons name="close" size={18} color={theme.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#10b981" />
          </View>
        ) : !hasAnyItems ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={42} color={theme.subtitle} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Brak rezerwacji sesji</Text>
            <Text style={[styles.emptySub, { color: theme.subtitle }]}>
              Gdy klient zaproponuje termin sesji, pojawi się tutaj do negocjacji. Po potwierdzeniu terminu sesja
              zostanie w sekcji „Potwierdzone”.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {confirmedItems.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: '#10b981' }]}>Umówione</Text>
            ) : null}
            {confirmedItems.map((item) => renderSessionCard(item, 'confirmed'))}
            {pendingItems.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: theme.subtitle, marginTop: confirmedItems.length ? 8 : 0 }]}>
                Do negocjacji
              </Text>
            ) : null}
            {pendingItems.map((item) => renderSessionCard(item, 'negotiate'))}
            {closedItems.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: theme.subtitle, marginTop: 8 }]}>Zamknięte</Text>
            ) : null}
            {closedItems.map((item) => renderSessionCard(item, 'closed'))}
          </ScrollView>
        )}
      </View>
    <NumericKeyboardAccessory />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 18 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  subtitle: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 6, maxWidth: 280 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  proPill: {
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  proPillText: { color: '#a855f7', fontSize: 10, fontWeight: '900' },
  confirmedPill: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmedPillText: { color: '#10b981', fontSize: 10, fontWeight: '900' },
  closedPill: {
    backgroundColor: 'rgba(142,142,147,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closedPillText: { color: '#8E8E93', fontSize: 10, fontWeight: '900' },
  pricePill: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pricePillText: { color: '#10b981', fontSize: 10, fontWeight: '900' },
  termBox: { borderRadius: 12, padding: 10 },
  billingBox: { borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 10, gap: 4 },
  billingLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  billingValue: { fontSize: 14, fontWeight: '800' },
  billingHint: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  termLabel: { color: '#10b981', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  termValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  waitingHint: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileBtnText: { flex: 1, color: '#0ea5e9', fontSize: 13, fontWeight: '800' },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contactBtnText: { flex: 1, fontSize: 14, fontWeight: '800' },
  awaitingUserBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  awaitingUserText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  note: { fontSize: 12, fontWeight: '500', lineHeight: 17, fontStyle: 'italic' },
  contact: { fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  acceptBtn: {
    flex: 1.2,
    minWidth: 120,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtnText: { color: '#000', fontSize: 13, fontWeight: '900' },
  counterBtn: {
    flex: 1,
    minWidth: 100,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(14,165,233,0.08)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { color: '#0ea5e9', fontSize: 13, fontWeight: '800' },
  rejectBtn: {
    minWidth: 72,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '800' },
  counterPicker: { gap: 10, marginTop: 4 },
  counterLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  datesRow: { gap: 8, paddingVertical: 2 },
  dayCard: {
    width: 54,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dayCardActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  dayWeek: { fontSize: 9, fontWeight: '700', color: '#9da0a6', textTransform: 'uppercase' },
  dayWeekActive: { color: 'rgba(255,255,255,0.9)' },
  dayNum: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  dayNumActive: { color: '#fff' },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourTile: {
    width: '23%',
    minWidth: 68,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hourTileActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  hourText: { fontSize: 13, fontWeight: '800' },
  hourTextActive: { color: '#fff' },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 64,
    padding: 12,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 14,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 13, fontWeight: '900' },
});
