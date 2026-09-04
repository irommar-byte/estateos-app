import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { fetchAgencyClients, archiveAgencyClients, type AgencyClientListItem } from '../services/agencyClientService';
import { emitCrmClientsChanged } from '../lib/crmClientsEvents';
import SellerClientPipelineBar from '../components/agency/SellerClientPipelineBar';
import { useSellerClientPipelines } from '../hooks/useSellerClientPipelines';
import { hasLiveMeetingCountdown, computeBuyerPipeline } from '../lib/sellerClientPipeline';
import { formatPolishDateTime } from '../lib/polishText';
import {
  applyCrmPersonOrder,
  formatCrmRoleLabel,
  groupCrmClientsByPerson,
  type CrmPersonGroup,
} from '../lib/crmPersonGroups';
import { loadCrmPersonOrder, saveCrmPersonOrder } from '../lib/crmClientListOrder';

function MeetingCountdownBadge({ startsAtIso, location, isDark }: { startsAtIso: string; location?: string | null; isDark?: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startsAt = new Date(startsAtIso).getTime();
  if (Number.isNaN(startsAt)) return null;
  const diffSec = Math.floor((startsAt - now) / 1000);

  if (diffSec < -3600 * 2) return null;

  const isLive = diffSec <= 0 && diffSec >= -3600 * 2;
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = Math.floor(diffSec % 60);

  const countdownText = isLive
    ? 'SPOTKANIE W TRAKCIE'
    : `Za ${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const dateStr = formatPolishDateTime(new Date(startsAtIso), { year: false });

  return (
    <View style={[styles.meetingBadge, isLive ? styles.meetingBadgeLive : styles.meetingBadgeUpcoming]}>
      <Ionicons name="time-outline" size={14} color={isLive ? '#FF9500' : '#34C759'} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: isLive ? '#FF9500' : '#34C759', fontSize: 11, fontWeight: '800' }}>
          Spotkanie: {countdownText}
        </Text>
        <Text style={{ color: isDark ? '#8E8E93' : '#6C6C70', fontSize: 10, marginTop: 1 }}>
          {dateStr}{location ? ` · ${location}` : ''}
        </Text>
      </View>
    </View>
  );
}

type PersonCard = CrmPersonGroup<AgencyClientListItem>;

export default function AgencyClientsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id || 0);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BUYER' | 'SELLER'>('ALL');
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [personOrder, setPersonOrder] = useState<string[]>([]);
  const { pipelines, portalUrls } = useSellerClientPipelines(token, clients);

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchAgencyClients(token);
      if (!res.ok) {
        Alert.alert('Klienci', res.message);
        return;
      }
      setClients(res.clients);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    void loadCrmPersonOrder(userId).then(setPersonOrder);
  }, [userId]);

  const visible = useMemo(() => {
    const grouped = groupCrmClientsByPerson(clients);
    const scoped =
      filter === 'ALL' ? grouped : grouped.filter((group) => group.types.includes(filter));
    return applyCrmPersonOrder(scoped, personOrder);
  }, [clients, filter, personOrder]);

  const toggleSelection = (ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const confirmBulkArchive = () => {
    const count = selectedIds.size;
    if (!count || !token) return;
    const noun = count === 1 ? 'klienta' : 'klientów';
    Alert.alert(
      'Archiwizować klientów?',
      `Zaznaczono ${count} ${noun}.\n\n• Wyczyści zaplanowane spotkania, prezentacje, wpisy kalendarza i powiadomienia push.\n• Karta klienta, podpisane dokumenty i historia pozostają dostępne dla administratora.\n• Klient znika z radaru dopasowań i automatyzacji Intelligence.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Archiwizuj',
          style: 'destructive',
          onPress: async () => {
            setArchiveBusy(true);
            try {
              const res = await archiveAgencyClients(token, [...selectedIds]);
              if (!res.ok) {
                Alert.alert('Klienci', res.message);
                return;
              }
              const archivedIds = [...selectedIds];
              exitSelectMode();
              emitCrmClientsChanged({ archivedIds, reason: 'archive' });
              await load();
            } finally {
              setArchiveBusy(false);
            }
          },
        },
      ],
    );
  };

  const persistOrder = (next: PersonCard[]) => {
    const keys = next.map((item) => item.key);
    setPersonOrder(keys);
    if (userId) void saveCrmPersonOrder(userId, keys);
  };

  const renderCard = ({ item, drag, isActive }: RenderItemParams<PersonCard>) => {
    const client = item.primary;
    const sellerMember = item.members.find((row) => row.type === 'SELLER') || client;
    const buyerMember = item.members.find((row) => row.type === 'BUYER') || client;
    const showMeeting =
      item.members.some((row) => row.upcomingMeetingStartsAt && hasLiveMeetingCountdown(row.upcomingMeetingStartsAt));
    const meetingClient = item.members.find((row) => row.upcomingMeetingStartsAt && hasLiveMeetingCountdown(row.upcomingMeetingStartsAt));
    const pipeline =
      item.types.includes('SELLER') && pipelines[sellerMember.id]
        ? pipelines[sellerMember.id]
        : item.types.includes('BUYER')
          ? computeBuyerPipeline({
              hasCriteria: (buyerMember.matchCount || 0) > 0 || Boolean(buyerMember.buyerMaxPrice),
              hasMatches: (buyerMember.matchCount || 0) > 0,
              hasSent: (buyerMember.sentCount || 0) > 0,
              presentationConfirmed: buyerMember.presentationConfirmed === true,
              dealClosed: buyerMember.dealClosed === true,
            })
          : undefined;
    const portalUrl = client.portalUrl || portalUrls[client.id] || item.members.find((row) => row.portalUrl)?.portalUrl;
    const isSelected = item.ids.some((id) => selectedIds.has(id));
    const dual = item.types.length > 1;
    const roleColor = dual ? '#C9A227' : client.type === 'BUYER' ? '#FF9500' : '#34C759';

    return (
      <ScaleDecorator>
        <Pressable
          disabled={isActive}
          onLongPress={selectMode ? undefined : drag}
          delayLongPress={220}
          onPress={() => {
            if (selectMode) {
              toggleSelection(item.ids);
              return;
            }
            navigation.navigate('AgencyClientDetail', { clientId: client.id });
          }}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: isSelected ? '#34C759' : colors.border,
              shadowColor: isDark ? '#000' : '#1a1612',
              opacity: isActive ? 0.92 : 1,
            },
            isSelected ? styles.cardSelected : null,
          ]}
        >
          {selectMode ? (
            <View
              style={[
                styles.selectMark,
                {
                  borderColor: isSelected ? '#34C759' : colors.border,
                  backgroundColor: isSelected ? '#34C759' : 'transparent',
                },
              ]}
            >
              {isSelected ? <Ionicons name="checkmark" size={14} color="#000" /> : null}
            </View>
          ) : (
            <View style={styles.dragHandle}>
              <Ionicons name="reorder-three-outline" size={22} color={colors.secondary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: roleColor, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
              {formatCrmRoleLabel(item.types)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>
                {client.firstName} {client.lastName}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                ID {client.id}
                {item.ids.length > 1 ? ` · ${item.ids.length} sprawy` : ''}
              </Text>
            </View>
            <Text style={{ color: colors.secondary, marginTop: 4, fontSize: 13 }}>
              {client.email || client.phone || 'Brak kontaktu'}
            </Text>

            {showMeeting && meetingClient?.upcomingMeetingStartsAt ? (
              <MeetingCountdownBadge
                startsAtIso={meetingClient.upcomingMeetingStartsAt}
                location={meetingClient.upcomingMeetingLocation}
                isDark={isDark}
              />
            ) : null}
            {pipeline ? <SellerClientPipelineBar stages={pipeline} isDark={isDark} compact /> : null}

            {portalUrl ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  const url = portalUrl.startsWith('http') ? portalUrl : `https://estateos.pl${portalUrl}`;
                  void Linking.openURL(url);
                }}
                style={[styles.portalBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F6F4EE' }]}
              >
                <Ionicons name="eye-outline" size={15} color="#007AFF" />
                <Text style={styles.portalBtnText}>Zobacz panel klienta</Text>
                <Ionicons name="open-outline" size={13} color="#007AFF" />
              </Pressable>
            ) : null}
          </View>
          {!selectMode ? <Ionicons name="chevron-forward" size={18} color={colors.secondary} /> : null}
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.navKicker, { color: colors.secondary }]}>SEKCJA CRM</Text>
          <Text style={[styles.navTitle, { color: colors.text }]}>Moi klienci</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('AgencyClientCreate')} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="add-circle" size={28} color="#34C759" />
        </Pressable>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filters}>
          {([
            ['ALL', 'Wszyscy'],
            ['BUYER', 'Kupujący'],
            ['SELLER', 'Sprzedający'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === id ? '#34C759' : colors.card,
                  borderColor: filter === id ? '#34C759' : colors.border,
                },
              ]}
            >
              <Text style={{ color: filter === id ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            if (selectMode) exitSelectMode();
            else setSelectMode(true);
          }}
          style={[
            styles.selectToggle,
            {
              borderColor: selectMode ? '#FF3B30' : colors.border,
              backgroundColor: selectMode ? 'rgba(255,59,48,0.12)' : colors.card,
            },
          ]}
        >
          <Text style={{ color: selectMode ? '#FF3B30' : colors.text, fontWeight: '800', fontSize: 12 }}>
            {selectMode ? 'Anuluj' : 'Wybierz'}
          </Text>
        </Pressable>
      </View>

      {selectMode && selectedIds.size > 0 ? (
        <View style={[styles.bulkBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
            Zaznaczono: {selectedIds.size}
          </Text>
          <Pressable
            disabled={archiveBusy}
            onPress={confirmBulkArchive}
            style={[styles.archiveBtn, archiveBusy ? { opacity: 0.6 } : null]}
          >
            <Ionicons name="archive-outline" size={16} color="#fff" />
            <Text style={styles.archiveBtnText}>{archiveBusy ? 'Archiwizowanie…' : 'Archiwizuj'}</Text>
          </Pressable>
        </View>
      ) : null}

      <DraggableFlatList
        data={visible}
        extraData={`${selectMode}:${[...selectedIds].join(',')}:${isDark}:${filter}`}
        keyExtractor={(item) => item.key}
        onDragEnd={({ data }) => persistOrder(data)}
        activationDistance={selectMode ? 10_000 : 12}
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListHeaderComponent={
          !loading && visible.length ? (
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '600', marginBottom: 10 }}>
              Przytrzymaj kartę, żeby ułożyć kolejność. Ta sama osoba nie dubluje się — sprzedający, który też szuka, ma obie role.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#34C759" />
          ) : (
            <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 40 }}>Brak klientów w tej grupie.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  navTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginTop: 1 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  filters: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectToggle: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  archiveBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardSelected: {
    backgroundColor: 'rgba(52,199,89,0.08)',
  },
  selectMark: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dragHandle: {
    width: 22,
    alignItems: 'center',
    marginTop: 2,
  },
  portalBtn: {
    marginTop: 10,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  portalBtnText: { flex: 1, color: '#007AFF', fontSize: 12, fontWeight: '800' },
  meetingBadge: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingBadgeLive: { backgroundColor: 'rgba(255,149,0,0.14)', borderColor: '#FF9500' },
  meetingBadgeUpcoming: { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: '#34C759' },
});
