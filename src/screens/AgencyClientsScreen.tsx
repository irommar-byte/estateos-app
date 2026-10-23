import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { hasLiveMeetingCountdown, hasLivePresentationCountdown, computeBuyerPipeline } from '../lib/sellerClientPipeline';
import { formatPolishDateTime } from '../lib/polishText';
import {
  applyCrmPersonOrder,
  formatCrmRoleLabel,
  groupCrmClientsByPerson,
  mergeCrmPersonOrder,
  type CrmPersonGroup,
} from '../lib/crmPersonGroups';
import { loadCrmPersonOrder, saveCrmPersonOrder } from '../lib/crmClientListOrder';
import TodayShowingsRail from '../components/agency/TodayShowingsRail';
import { fetchAgentToday, type AgentToday } from '../services/agentTodayService';

/** Jedno zdanie „co czeka na agenta” per klient — z ekranu „Dziś”. */
function buildWaitingReasons(today: AgentToday): Map<number, string> {
  const reasons = new Map<number, string>();
  const put = (clientId: number, reason: string) => {
    if (!reasons.has(clientId)) reasons.set(clientId, reason);
  };
  for (const row of today.outbox || []) put(row.clientId, `Do wysłania: ${row.subject || row.categoryLabel}`);
  for (const row of today.ownerCalls) put(row.clientId, `Zadzwoń do właściciela: ${row.offer?.title || 'oferta'}`);
  for (const row of today.replies) put(row.clientId, row.title);
  for (const row of today.approvals) put(row.clientId, `Do akceptacji: ${row.offer?.title || 'propozycja asystenta'}`);
  return reasons;
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim();
}

const clientsCacheKey = (userId: number) => `@estateos_crm_clients_v1_${userId}`;

async function readClientsCache(userId: number): Promise<AgencyClientListItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(clientsCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgencyClientListItem[]) : null;
  } catch {
    return null;
  }
}

async function writeClientsCache(userId: number, clients: AgencyClientListItem[]) {
  try {
    await AsyncStorage.setItem(clientsCacheKey(userId), JSON.stringify(clients));
  } catch {
    // ignore quota / storage errors
  }
}

function MeetingCountdownBadge({
  startsAtIso,
  location,
  isDark,
  label = 'Spotkanie',
}: {
  startsAtIso: string;
  location?: string | null;
  isDark?: boolean;
  label?: string;
}) {
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
  const days = Math.floor(Math.max(0, diffSec) / 86400);
  const hours = Math.floor((Math.max(0, diffSec) % 86400) / 3600);
  const minutes = Math.floor((Math.max(0, diffSec) % 3600) / 60);
  const seconds = Math.floor(Math.max(0, diffSec) % 60);

  const countdownText = isLive
    ? `${label.toUpperCase()} W TRAKCIE`
    : `Za ${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const dateStr = formatPolishDateTime(new Date(startsAtIso), { year: false });

  return (
    <View style={[styles.meetingBadge, isLive ? styles.meetingBadgeLive : styles.meetingBadgeUpcoming]}>
      <Ionicons name="time-outline" size={14} color={isLive ? '#FF9500' : '#34C759'} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: isLive ? '#FF9500' : '#34C759', fontSize: 11, fontWeight: '800' }}>
          {label}: {countdownText}
        </Text>
        <Text style={{ color: isDark ? '#8E8E93' : '#6C6C70', fontSize: 10, marginTop: 1 }}>
          {dateStr}
          {location ? ` · ${location}` : ''}
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
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BUYER' | 'SELLER' | 'WAITING'>('ALL');
  const [query, setQuery] = useState('');
  const [waiting, setWaiting] = useState<Map<number, string>>(new Map());
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [personOrder, setPersonOrder] = useState<string[]>([]);
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const { pipelines, portalUrls } = useSellerClientPipelines(token, clients);

  const colors = {
    bg: isDark ? '#000' : '#F2F2F7',
    card: isDark ? '#1C1C1E' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
  };

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const soft = Boolean(opts?.soft) && clientsRef.current.length > 0;
      if (soft) setRefreshing(true);
      else if (!clientsRef.current.length) setLoading(true);
      else setRefreshing(true);
      try {
        const [res, today] = await Promise.all([fetchAgencyClients(token), fetchAgentToday(token)]);
        if (today.ok) setWaiting(buildWaitingReasons(today.today));
        if (!res.ok) {
          Alert.alert('Klienci', res.message);
          return;
        }
        setClients(res.clients);
        if (userId) void writeClientsCache(userId, res.clients);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, userId],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void readClientsCache(userId).then((cached) => {
      if (cancelled || !cached?.length) return;
      setClients((prev) => (prev.length ? prev : cached));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load({ soft: true });
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    void loadCrmPersonOrder(userId).then(setPersonOrder);
  }, [userId]);

  const visible = useMemo(() => {
    const grouped = groupCrmClientsByPerson(clients);
    const byRole =
      filter === 'ALL'
        ? grouped
        : filter === 'WAITING'
          ? grouped.filter((group) => group.ids.some((id) => waiting.has(id)))
          : grouped.filter((group) => group.types.includes(filter));
    const needle = normalizeSearch(query);
    const needleDigits = query.replace(/\D/g, '');
    const scoped = !needle
      ? byRole
      : byRole.filter((group) =>
          group.members.some((row) => {
            const haystack = normalizeSearch(
              [row.firstName, row.lastName, row.email, row.sellerCity, row.buyerCity, `#${row.id}`, String(row.id)]
                .filter(Boolean)
                .join(' '),
            );
            if (haystack.includes(needle)) return true;
            const phoneDigits = String(row.phone || '').replace(/\D/g, '');
            return needleDigits.length >= 3 && phoneDigits.includes(needleDigits);
          }),
        );
    const ordered = applyCrmPersonOrder(scoped, personOrder);
    const withPres = ordered.filter((g) =>
      g.members.some(
        (row) =>
          row.type === 'BUYER' &&
          row.presentation?.startsAt &&
          !row.presentation?.heldAt &&
          hasLivePresentationCountdown(row.presentation.startsAt),
      ),
    );
    const without = ordered.filter((g) => !withPres.includes(g));
    withPres.sort((a, b) => {
      const aStart = a.members.find((m) => m.presentation?.startsAt)?.presentation?.startsAt || '';
      const bStart = b.members.find((m) => m.presentation?.startsAt)?.presentation?.startsAt || '';
      return new Date(aStart).getTime() - new Date(bStart).getTime();
    });
    return [...withPres, ...without];
  }, [clients, filter, personOrder, query, waiting]);

  const waitingCount = useMemo(
    () => groupCrmClientsByPerson(clients).filter((group) => group.ids.some((id) => waiting.has(id))).length,
    [clients, waiting],
  );

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
    const merged = mergeCrmPersonOrder(
      personOrder,
      next.map((item) => item.key),
    );
    setPersonOrder(merged);
    if (userId) void saveCrmPersonOrder(userId, merged);
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
              hasPresentation: buyerMember.presentationConfirmed === true,
              presentationHeld: buyerMember.dealClosed === true,
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
            {(() => {
              const reason = item.ids.map((id) => waiting.get(id)).find(Boolean);
              if (!reason) return null;
              return (
                <View style={[styles.waitingRow, { backgroundColor: isDark ? 'rgba(255,159,10,0.14)' : '#FFF4E5' }]}>
                  <View style={styles.waitingDot} />
                  <Text style={[styles.waitingText, { color: isDark ? '#FFB340' : '#C25E00' }]} numberOfLines={1}>
                    {reason}
                  </Text>
                </View>
              );
            })()}

            {showMeeting && meetingClient?.upcomingMeetingStartsAt ? (
              <MeetingCountdownBadge
                startsAtIso={meetingClient.upcomingMeetingStartsAt}
                location={meetingClient.upcomingMeetingLocation}
                isDark={isDark}
                label="Spotkanie"
              />
            ) : null}
            {(() => {
              const presClient = item.members.find(
                (row) =>
                  row.type === 'BUYER' &&
                  row.presentation?.startsAt &&
                  !row.presentation?.heldAt &&
                  hasLivePresentationCountdown(row.presentation.startsAt),
              );
              if (!presClient?.presentation?.startsAt) return null;
              return (
                <MeetingCountdownBadge
                  startsAtIso={presClient.presentation.startsAt}
                  location={presClient.presentation.location}
                  isDark={isDark}
                  label="Prezentacja"
                />
              );
            })()}
            {pipeline ? <SellerClientPipelineBar stages={pipeline} isDark={isDark} compact /> : null}

            {(() => {
              const uniqueOffers = Array.from(
                new Map(
                  item.members
                    .filter((row) => row.linkedOfferId)
                    .map((row) => [
                      Number(row.linkedOfferId),
                      {
                        id: Number(row.linkedOfferId),
                        label: row.sellerCity
                          ? `Oferta #${row.linkedOfferId} · ${row.sellerCity}`
                          : `Oferta #${row.linkedOfferId}`,
                      },
                    ]),
                ).values(),
              );
              if (selectMode || uniqueOffers.length === 0) return null;
              return (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    if (uniqueOffers.length === 1) {
                      navigation.navigate('OfferDetail', { offerId: uniqueOffers[0].id });
                      return;
                    }
                    Alert.alert(
                      'Która oferta?',
                      'Otwórz ogłoszenie bez karty klienta.',
                      [
                        ...uniqueOffers.map((offer) => ({
                          text: offer.label,
                          onPress: () => navigation.navigate('OfferDetail', { offerId: offer.id }),
                        })),
                        { text: 'Anuluj', style: 'cancel' },
                      ],
                    );
                  }}
                  style={[styles.offerBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : '#EAF8EE' }]}
                >
                  <Ionicons name="home-outline" size={15} color="#34C759" />
                  <Text style={styles.offerBtnText}>
                    {uniqueOffers.length === 1 ? 'Oferta' : `Oferty · ${uniqueOffers.length}`}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#34C759" />
                </Pressable>
              );
            })()}

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
        <Pressable
          onPress={() => navigation.navigate('AgencyToday')}
          hitSlop={8}
          style={styles.navBtn}
          accessibilityLabel="Dziś"
        >
          <Ionicons name="sunny" size={24} color="#FF9F0A" />
          {waitingCount ? (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{waitingCount > 9 ? '9+' : waitingCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('CapturePortalLead')} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="mail-unread-outline" size={24} color="#FF9F0A" />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('AgencyClientCreate')} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="add-circle" size={28} color="#34C759" />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: isDark ? '#1C1C1E' : 'rgba(118,118,128,0.12)' }]}>
          <Ionicons name="search" size={17} color={colors.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj: imię, telefon, e-mail, miasto"
            placeholderTextColor={colors.secondary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Wyczyść">
              <Ionicons name="close-circle" size={17} color={colors.secondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filters}>
          {([
            ['ALL', 'Wszyscy'],
            ...(waitingCount ? [['WAITING', `Czekają · ${waitingCount}`] as const] : []),
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
        extraData={`${selectMode}:${[...selectedIds].join(',')}:${isDark}:${filter}:${waiting.size}`}
        keyExtractor={(item) => item.key}
        onDragEnd={({ data }) => persistOrder(data)}
        activationDistance={selectMode || query.trim() ? 10_000 : 12}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 160 }}
        ListFooterComponent={<View style={{ height: 48 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ soft: true })} />}
        ListHeaderComponent={
          <View>
            <TodayShowingsRail navigation={navigation} isDark={isDark} />
            {!loading && visible.length ? (
              <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '600', marginBottom: 10 }}>
                Przytrzymaj kartę, żeby ułożyć kolejność. Ta sama osoba nie dubluje się — sprzedający, który też szuka, ma obie role.
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading && !clients.length ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      height: 96,
                      opacity: 0.55 - i * 0.08,
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 40 }}>
              {query.trim() ? `Nikt nie pasuje do „${query.trim()}”.` : 'Brak klientów w tej grupie.'}
            </Text>
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
  navBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  waitingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF9F0A' },
  waitingText: { color: '#C25E00', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  navKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  navTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginTop: 1 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
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
  offerBtn: {
    marginTop: 10,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerBtnText: { flex: 1, color: '#1F7A3A', fontSize: 12, fontWeight: '800' },
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
