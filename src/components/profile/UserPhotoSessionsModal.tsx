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
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import {
  fetchMyPhotoSessionRequests,
  PhotoSessionRequestItem,
  PhotoSessionServiceError,
  respondMyPhotoSessionRequest,
} from '../../services/photoSessionService';
import {
  offerPhotoSessionCalendarAfterAcceptance,
  photoSessionCalendarParamsFromItem,
} from '../../utils/photoSessionCalendar';
import { photoSessionPaymentLabel } from '../../utils/photoSessionBilling';
import PresentationCountdown from '../dealroom/PresentationCountdown';
import CollapsiblePhotoSessionHistory from '../photoSession/CollapsiblePhotoSessionHistory';
import { openDirectContactChat } from '../../utils/openDirectContact';
import {
  PHOTO_SESSION_CONTRACTOR_NAME,
  PHOTO_SESSION_CONTRACTOR_USER_ID,
} from '../../constants/photoSession';

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
  onActionCountChange?: (count: number) => void;
  isAdmin?: boolean;
  onOpenAdminPhotoSessions?: () => void;
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

function eventLabel(action: string, t: (key: string) => string) {
  switch (String(action).toUpperCase()) {
    case 'PROPOSED':
      return t('profile.properties.photoSessions.eventProposed');
    case 'COUNTERED':
      return t('profile.properties.photoSessions.eventCountered');
    case 'ACCEPTED':
      return t('profile.properties.photoSessions.eventAccepted');
    case 'DECLINED':
      return t('profile.properties.photoSessions.eventDeclined');
    default:
      return action;
  }
}

function statusLabel(item: PhotoSessionRequestItem, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (item.status === 'ACCEPTED') return t('profile.properties.photoSessions.statusAccepted');
  if (item.status === 'REJECTED') return t('profile.properties.photoSessions.statusRejected');
  if (item.status === 'CANCELLED') return t('profile.properties.photoSessions.statusCancelled');
  if (item.waitingOn === 'USER') return t('profile.properties.photoSessions.statusNeedsYourReply');
  if (item.waitingOn === 'ADMIN') return t('profile.properties.photoSessions.statusWaitingAdmin');
  return t('profile.properties.photoSessions.statusPending');
}

function SessionCard({
  item,
  isDark,
  theme,
  token,
  onUpdated,
  onCloseModal,
  t,
}: {
  item: PhotoSessionRequestItem;
  isDark: boolean;
  theme: Theme;
  token: string;
  onUpdated: () => void;
  onCloseModal?: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [respondMode, setRespondMode] = useState<'idle' | 'counter'>('idle');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141418' : '#f9fafb';
  const needsUser = item.status === 'PENDING' && item.waitingOn === 'USER';
  const waitingAdmin = item.status === 'PENDING' && item.waitingOn === 'ADMIN';
  const canContactContractor = item.status === 'PENDING' || item.status === 'ACCEPTED';

  const handleContactContractor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCloseModal?.();
    void openDirectContactChat(
      navigation,
      token,
      PHOTO_SESSION_CONTRACTOR_USER_ID,
      PHOTO_SESSION_CONTRACTOR_NAME,
    );
  };

  const handleRespond = async (action: 'accept' | 'counter' | 'decline') => {
    if (loading) return;
    if (action === 'counter') {
      if (!selectedDate || !selectedHour) {
        setError(t('profile.properties.photoSessions.pickDateTime'));
        return;
      }
      const [hh, mm] = selectedHour.split(':');
      const dt = new Date(selectedDate);
      dt.setHours(Number(hh), Number(mm), 0, 0);
      setLoading(true);
      setError(null);
      try {
        await respondMyPhotoSessionRequest(
          item.id,
          { action: 'counter', proposedAt: dt.toISOString(), note: note.trim() || undefined },
          token,
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRespondMode('idle');
        onUpdated();
      } catch (err: any) {
        setError(err?.message || t('profile.properties.photoSessions.actionFailed'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const confirm =
      action === 'decline'
        ? t('profile.properties.photoSessions.declineConfirm')
        : t('profile.properties.photoSessions.acceptConfirm', { label: formatDateTime(item.proposedAt) });

    Alert.alert(t('profile.properties.photoSessions.title'), confirm, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: action === 'decline' ? t('profile.properties.photoSessions.decline') : t('profile.properties.photoSessions.accept'),
        style: action === 'decline' ? 'destructive' : 'default',
        onPress: () => {
          setLoading(true);
          setError(null);
          void respondMyPhotoSessionRequest(item.id, { action }, token)
            .then((result) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (action === 'accept' && result?.request) {
                void offerPhotoSessionCalendarAfterAcceptance(
                  photoSessionCalendarParamsFromItem(result.request, 'user'),
                );
              }
              onUpdated();
            })
            .catch((err: any) => {
              setError(err?.message || t('profile.properties.photoSessions.actionFailed'));
            })
            .finally(() => setLoading(false));
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: cardBorder }]}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Ionicons name="camera" size={18} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {item.propertyLabel || t('profile.properties.photoSessions.defaultProperty')}
          </Text>
          <Text style={[styles.statusPill, needsUser && styles.statusPillAction, waitingAdmin && styles.statusPillWait]}>
            {statusLabel(item, t)}
          </Text>
        </View>
        {item.isProFree ? (
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
          {item.status === 'ACCEPTED'
            ? t('profile.properties.photoSessions.confirmedTerm')
            : t('profile.properties.photoSessions.currentTerm')}
        </Text>
        <Text style={[styles.termValue, { color: theme.text }]}>{formatDateTime(item.proposedAt)}</Text>
        {item.status === 'ACCEPTED' ? (
          <Text style={[styles.billingInline, { color: theme.subtitle }]}>
            {item.paymentLabel || photoSessionPaymentLabel(item.isProFree)}
          </Text>
        ) : null}
      </View>

      {item.status === 'ACCEPTED' ? (
        <PresentationCountdown
          presentationIso={item.proposedAt}
          label={t('profile.properties.photoSessions.countdownLabel')}
          variant="panel"
        />
      ) : null}

      {waitingAdmin ? (
        <Text style={[styles.waitHint, { color: theme.subtitle }]}>{t('profile.properties.photoSessions.waitingAdminBody')}</Text>
      ) : null}

      {needsUser ? (
        <Text style={[styles.waitHint, { color: theme.subtitle }]}>{t('profile.properties.photoSessions.needsReplyBody')}</Text>
      ) : null}

      <CollapsiblePhotoSessionHistory
        item={item}
        isDark={isDark}
        textColor={theme.text}
        mutedColor={theme.subtitle}
        labels={{
          timelineTitle: t('profile.properties.photoSessions.timelineTitle'),
          timelineExpand: t('profile.properties.photoSessions.timelineExpand'),
          timelineCollapse: t('profile.properties.photoSessions.timelineCollapse'),
          formatBadgeConfirmed: (date) =>
            t('profile.properties.photoSessions.badgeConfirmed', { date }),
          formatBadgeNegotiating: (date) =>
            t('profile.properties.photoSessions.badgeNegotiating', { date }),
        }}
        formatEventLabel={(action) => eventLabel(action, t)}
      />

      {canContactContractor ? (
        <TouchableOpacity
          onPress={handleContactContractor}
          style={[styles.contactBtn, { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f9fafb' }]}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0ea5e9" />
          <Text style={[styles.contactBtnText, { color: theme.text }]}>
            {t('profile.properties.photoSessions.contactContractor')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.subtitle} />
        </TouchableOpacity>
      ) : null}

      {needsUser && respondMode === 'counter' ? (
        <View style={[styles.counterBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.counterTitle, { color: theme.text }]}>{t('profile.properties.photoSessions.counterTitle')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesRow}>
            {dates.map((d) => {
              const selected = selectedDate?.toDateString() === d.toDateString();
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => setSelectedDate(d)}
                  style={[
                    styles.dayCard,
                    { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                    selected && styles.dayCardActive,
                  ]}
                >
                  <Text style={[styles.dayNum, { color: theme.text }, selected && styles.dayNumActive]}>{d.getDate()}</Text>
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
                  onPress={() => setSelectedHour(h)}
                  style={[
                    styles.hourTile,
                    { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                    selected && styles.hourTileActive,
                  ]}
                >
                  <Text style={[styles.hourText, { color: theme.text }, selected && styles.hourTextActive]}>{h}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('profile.properties.photoSessions.notePlaceholder')}
            placeholderTextColor={theme.subtitle}
            style={[
              styles.noteInput,
              { color: theme.text, borderColor: cardBorder, backgroundColor: isDark ? '#0b0b0b' : '#fff' },
            ]}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable onPress={() => setRespondMode('idle')} style={[styles.secondaryBtn, { borderColor: cardBorder }]}>
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleRespond('counter')}
              disabled={loading || !selectedDate || !selectedHour}
              style={[styles.primaryBtn, (loading || !selectedDate || !selectedHour) && { opacity: 0.5 }]}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{t('profile.properties.photoSessions.sendCounter')}</Text>}
            </Pressable>
          </View>
        </View>
      ) : needsUser ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: 'rgba(239,68,68,0.35)' }]}
            onPress={() => void handleRespond('decline')}
            disabled={loading}
          >
            <Text style={styles.rejectBtnText}>{t('profile.properties.photoSessions.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.counterOutlineBtn, { borderColor: 'rgba(14,165,233,0.35)' }]}
            onPress={() => setRespondMode('counter')}
            disabled={loading}
          >
            <Text style={styles.counterOutlineText}>{t('profile.properties.photoSessions.otherTerm')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, loading && { opacity: 0.6 }]}
            onPress={() => void handleRespond('accept')}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.acceptBtnText}>{t('profile.properties.photoSessions.accept')}</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default function UserPhotoSessionsModal({
  visible,
  onClose,
  theme,
  onActionCountChange,
  isAdmin = false,
  onOpenAdminPhotoSessions,
}: Props) {
  const { t } = useI18n();
  const { token } = useAuthStore() as { token?: string | null };
  const isDark = theme.glass === 'dark';
  const [items, setItems] = useState<PhotoSessionRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<'none' | 'auth' | 'failed'>('none');

  const safeToken = useMemo(() => {
    const trimmed = String(token || '').trim();
    if (!trimmed) return null;
    return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
  }, [token]);

  const load = useCallback(async () => {
    if (!safeToken) {
      setItems([]);
      setLoadError('auth');
      onActionCountChange?.(0);
      return;
    }
    setLoading(true);
    setLoadError('none');
    try {
      const list = await fetchMyPhotoSessionRequests(safeToken);
      setItems(list);
      const actionCount = list.filter((x) => x.status === 'PENDING' && x.waitingOn === 'USER').length;
      onActionCountChange?.(actionCount);
      for (const accepted of list.filter((x) => x.status === 'ACCEPTED')) {
        void offerPhotoSessionCalendarAfterAcceptance(
          photoSessionCalendarParamsFromItem(accepted, 'user'),
        );
      }
    } catch (err) {
      setItems([]);
      setLoadError('failed');
      const msg = err instanceof PhotoSessionServiceError ? err.message : t('profile.properties.photoSessions.loadFailed');
      Alert.alert(t('profile.properties.photoSessions.title'), msg);
      onActionCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [safeToken, onActionCountChange, t]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, safeToken, load]);

  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const pending = items.filter((x) => x.status === 'PENDING');
  const confirmed = items.filter((x) => x.status === 'ACCEPTED');
  const closed = items.filter((x) => x.status === 'REJECTED' || x.status === 'CANCELLED');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.subtitle }]}>{t('profile.properties.sectionTitle').toUpperCase()}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t('profile.properties.photoSessions.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>{t('profile.properties.photoSessions.subtitle')}</Text>
          </View>
          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: cardBorder }]}>
            <Ionicons name="close" size={18} color={theme.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#10b981" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={42} color={theme.subtitle} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {loadError === 'auth'
                ? t('profile.properties.photoSessions.loginRequired')
                : isAdmin
                  ? t('profile.properties.photoSessions.emptyAdminTitle')
                  : t('profile.properties.photoSessions.emptyTitle')}
            </Text>
            <Text style={[styles.emptySub, { color: theme.subtitle }]}>
              {loadError === 'auth'
                ? t('profile.properties.photoSessions.loginRequired')
                : isAdmin
                  ? t('profile.properties.photoSessions.emptyAdminBody')
                  : t('profile.properties.photoSessions.emptyBody')}
            </Text>
            {isAdmin && onOpenAdminPhotoSessions && loadError !== 'auth' ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenAdminPhotoSessions();
                }}
                style={[styles.adminLinkBtn, { borderColor: cardBorder }]}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color="#10b981" />
                <Text style={styles.adminLinkBtnText}>{t('profile.properties.photoSessions.openAdminPhotoSessions')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {confirmed.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: '#10b981' }]}>
                {t('profile.properties.photoSessions.confirmedSection')}
              </Text>
            ) : null}
            {confirmed.map((item) => (
              <SessionCard
                key={item.id}
                item={item}
                isDark={isDark}
                theme={theme}
                token={safeToken!}
                onUpdated={load}
                onCloseModal={onClose}
                t={t}
              />
            ))}
            {pending.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: theme.subtitle, marginTop: confirmed.length ? 8 : 0 }]}>
                {t('profile.properties.photoSessions.activeSection')}
              </Text>
            ) : null}
            {pending.map((item) => (
              <SessionCard
                key={item.id}
                item={item}
                isDark={isDark}
                theme={theme}
                token={safeToken!}
                onUpdated={load}
                onCloseModal={onClose}
                t={t}
              />
            ))}
            {closed.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: theme.subtitle, marginTop: 8 }]}>
                {t('profile.properties.photoSessions.historySection')}
              </Text>
            ) : null}
            {closed.map((item) => (
              <SessionCard
                key={item.id}
                item={item}
                isDark={isDark}
                theme={theme}
                token={safeToken!}
                onUpdated={load}
                onCloseModal={onClose}
                t={t}
              />
            ))}
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
  subtitle: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 6 },
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
  adminLinkBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adminLinkBtnText: { color: '#10b981', fontSize: 14, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
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
  statusPill: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  statusPillAction: { color: '#0ea5e9' },
  statusPillWait: { color: '#FF9F0A' },
  proPill: {
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  proPillText: { color: '#a855f7', fontSize: 10, fontWeight: '900' },
  pricePill: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pricePillText: { color: '#10b981', fontSize: 10, fontWeight: '900' },
  termBox: { borderRadius: 12, padding: 10 },
  termLabel: { color: '#10b981', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  termValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  billingInline: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  waitHint: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contactBtnText: { flex: 1, fontSize: 14, fontWeight: '800' },
  counterBox: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 10 },
  counterTitle: { fontSize: 13, fontWeight: '800' },
  datesRow: { gap: 8, paddingVertical: 4 },
  dayCard: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  dayNum: { fontSize: 15, fontWeight: '800' },
  dayNumActive: { color: '#000' },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourTile: {
    minWidth: '22%',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  hourTileActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  hourText: { fontSize: 12, fontWeight: '700' },
  hourTextActive: { color: '#000' },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 56,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  rejectBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  counterOutlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterOutlineText: { color: '#0ea5e9', fontSize: 12, fontWeight: '800' },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },
  error: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
});
