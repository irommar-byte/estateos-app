import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { useAuthStore } from '../../store/useAuthStore';
import {
  formatUserDate,
  formatUserDateTime,
  getUserPresence,
  isRadarEnabled,
  isUserVerified,
  planMeta,
  radarThreshold,
  roleMeta,
} from '../../utils/adminUserAnalytics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ThemeLike = { background?: string; text?: string; subtitle?: string; glass?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenUser: (user: any) => void;
  theme: ThemeLike;
};

function useUsersTheme(theme: ThemeLike) {
  return useMemo(() => {
    const isDark = theme.glass === 'dark';
    return {
      isDark,
      bg: isDark ? '#000000' : theme.background || '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      cardSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
      text: isDark ? '#FFFFFF' : theme.text || '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      tertiary: isDark ? '#636366' : '#AEAEB2',
      separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)',
      accent: '#007AFF',
      danger: '#FF3B30',
      segmentBg: isDark ? '#2C2C2E' : '#E5E5EA',
      segmentActive: isDark ? '#636366' : '#FFFFFF',
    };
  }, [theme]);
}

function KpiStrip({
  total,
  verified,
  radarOn,
  agents,
  colors,
}: {
  total: number;
  verified: number;
  radarOn: number;
  agents: number;
  colors: ReturnType<typeof useUsersTheme>;
}) {
  const items = [
    { label: 'Lista', value: total },
    { label: 'Zweryf.', value: verified },
    { label: 'Radar', value: radarOn },
    { label: 'Agenci', value: agents },
  ];
  return (
    <View style={styles.kpiRow}>
      {items.map((item) => (
        <View key={item.label} style={[styles.kpiCell, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{item.value}</Text>
          <Text style={[styles.kpiLabel, { color: colors.secondary }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminUsersModal({ visible, onClose, onOpenUser, theme }: Props) {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const colors = useUsersTheme(theme);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [radarFilter, setRadarFilter] = useState('ALL');
  const [presenceFilter, setPresenceFilter] = useState('ALL');
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const limit = 25;

  useEffect(() => {
    if (!visible) setToolsExpanded(false);
  }, [visible]);

  const sortUsers = useCallback((arr: any[]) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const normalize = (v: unknown) => String(v || '').toLowerCase();
    const asTime = (v: unknown) => {
      const t = new Date(String(v || 0)).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const asNum = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    return [...arr].sort((a, b) => {
      if (sortBy === 'offersCount') {
        const av = asNum(a?._count?.offers);
        const bv = asNum(b?._count?.offers);
        if (av !== bv) return (av - bv) * dir;
        return (asTime(a?.createdAt) - asTime(b?.createdAt)) * -1;
      }
      if (sortBy === 'email') {
        const av = normalize(a?.email);
        const bv = normalize(b?.email);
        if (av !== bv) return av > bv ? dir : -dir;
        return (asTime(a?.createdAt) - asTime(b?.createdAt)) * -1;
      }
      if (sortBy === 'name') {
        const av = normalize(a?.name || a?.email);
        const bv = normalize(b?.name || b?.email);
        if (av !== bv) return av > bv ? dir : -dir;
        return (asTime(a?.createdAt) - asTime(b?.createdAt)) * -1;
      }
      return (asTime(a?.createdAt) - asTime(b?.createdAt)) * dir;
    });
  }, [sortBy, sortDir]);

  const fetchUsers = useCallback(
    async (mode: 'reset' | 'append' = 'reset') => {
      if (!token) return;
      if (mode === 'reset') setLoading(true);
      try {
        const nextPage = mode === 'reset' ? 1 : page;
        const qs =
          `page=${encodeURIComponent(String(nextPage))}` +
          `&limit=${encodeURIComponent(String(limit))}` +
          `&search=${encodeURIComponent(search || '')}` +
          `&sortBy=${encodeURIComponent(sortBy)}` +
          `&sortDir=${encodeURIComponent(sortDir)}`;

        const res = await fetch(`${API_URL}/api/mobile/v1/admin/users?${qs}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const nextUsers = Array.isArray(data.users) ? data.users : [];
          const nextPageNum = data?.pagination?.page || 1;
          const totalPages = data?.pagination?.totalPages || 1;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (mode === 'append') {
            setUsers((prev) => sortUsers([...prev, ...nextUsers]));
          } else {
            setUsers(sortUsers(nextUsers));
          }
          setPage(nextPageNum + 1);
          setHasMore(nextPageNum < totalPages);
        }
      } catch {
        // noop
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, page, search, sortBy, sortDir, sortUsers],
  );

  useEffect(() => {
    if (!visible) return;
    setPage(1);
    setHasMore(true);
    void fetchUsers('reset');
  }, [visible, sortBy, sortDir]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      void fetchUsers('reset');
    }, 280);
    return () => clearTimeout(t);
  }, [search, visible]);

  const filteredUsers = useMemo(
    () =>
      users.filter((item) => {
        const presence = getUserPresence(item);
        if (roleFilter !== 'ALL' && String(item?.role || 'USER') !== roleFilter) return false;
        if (verificationFilter === 'VERIFIED' && !isUserVerified(item)) return false;
        if (verificationFilter === 'UNVERIFIED' && isUserVerified(item)) return false;
        if (radarFilter === 'ON' && !isRadarEnabled(item)) return false;
        if (radarFilter === 'OFF' && isRadarEnabled(item)) return false;
        if (presenceFilter === 'ONLINE' && presence.state !== 'ONLINE') return false;
        if (presenceFilter === 'RECENT' && presence.state !== 'RECENT') return false;
        if (presenceFilter === 'OFFLINE' && !['OFFLINE', 'UNKNOWN'].includes(presence.state)) return false;
        return true;
      }),
    [users, roleFilter, verificationFilter, radarFilter, presenceFilter],
  );

  const stats = useMemo(
    () => ({
      total: filteredUsers.length,
      verified: filteredUsers.filter((u) => isUserVerified(u)).length,
      radarOn: filteredUsers.filter((u) => isRadarEnabled(u)).length,
      agents: filteredUsers.filter((u) => String(u?.role) === 'AGENT').length,
    }),
    [filteredUsers],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (roleFilter !== 'ALL') n += 1;
    if (verificationFilter !== 'ALL') n += 1;
    if (radarFilter !== 'ALL') n += 1;
    if (presenceFilter !== 'ALL') n += 1;
    return n;
  }, [roleFilter, verificationFilter, radarFilter, presenceFilter]);

  const sortOptions = useMemo(
    () => [
      { id: 'createdAt', label: 'Najnowsi' },
      { id: 'offersCount', label: 'Oferty' },
      { id: 'email', label: 'E-mail' },
      { id: 'name', label: 'Imię' },
    ],
    [],
  );

  const deleteUser = (userId: number, email: string) => {
    Alert.alert('Usuń użytkownika', `Permanentnie usunąć ${email}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          try {
            const res = await fetch(`${API_URL}/api/mobile/v1/admin/users`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ userId }),
            });
            if (res.ok) void fetchUsers('reset');
          } catch {
            // noop
          }
        },
      },
    ]);
  };

  const renderFilterChip = (
    activeValue: string,
    label: string,
    value: string,
    setter: (v: string) => void,
  ) => {
    const active = activeValue === value;
    return (
      <Pressable
        key={value}
        onPress={() => {
          void Haptics.selectionAsync();
          setter(value);
        }}
        style={[
          styles.filterChip,
          {
            backgroundColor: active ? 'rgba(0,122,255,0.16)' : colors.cardSecondary,
            borderColor: active ? 'rgba(0,122,255,0.35)' : 'transparent',
          },
        ]}
      >
        <Text style={[styles.filterChipText, { color: active ? colors.accent : colors.secondary }]}>{label}</Text>
      </Pressable>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <KpiStrip {...stats} colors={colors} />

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.separator }]}>
        <Ionicons name="search" size={17} color={colors.secondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Szukaj: email, imię, telefon…"
          placeholderTextColor={colors.tertiary}
          style={[styles.searchInput, { color: colors.text }]}
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
          }}
          style={[styles.sortBtn, { borderColor: colors.separator }]}
          hitSlop={8}
        >
          <Ionicons name={sortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={18} color={colors.accent} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          void Haptics.selectionAsync();
          setToolsExpanded((v) => !v);
        }}
        style={[styles.toolsToggle, { backgroundColor: colors.cardSecondary, borderColor: colors.separator }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.toolsTitle, { color: colors.text }]}>Sortowanie i filtry</Text>
          <Text style={[styles.toolsMeta, { color: colors.secondary }]} numberOfLines={1}>
            {sortOptions.find((o) => o.id === sortBy)?.label}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} filtr.` : ''}
            {` · ${stats.total} wyników`}
          </Text>
        </View>
        {activeFilterCount > 0 ? (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
        <Ionicons name={toolsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondary} />
      </Pressable>

      {toolsExpanded ? (
        <View style={[styles.toolsPanel, { backgroundColor: colors.cardSecondary, borderColor: colors.separator }]}>
          <Text style={[styles.filterSectionLabel, { color: colors.secondary }]}>Sortowanie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {sortOptions.map((opt) => {
              const active = sortBy === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSortBy(opt.id);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? 'rgba(0,122,255,0.16)' : colors.card,
                      borderColor: active ? 'rgba(0,122,255,0.35)' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? colors.accent : colors.secondary }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {[
            ['Rola', [
              { k: 'ALL', l: 'Wszyscy' },
              { k: 'ADMIN', l: 'Admin' },
              { k: 'AGENT', l: 'Agent' },
              { k: 'USER', l: 'User' },
            ], roleFilter, setRoleFilter],
            ['Weryfikacja', [
              { k: 'ALL', l: 'Wszystkie' },
              { k: 'VERIFIED', l: 'Zweryf.' },
              { k: 'UNVERIFIED', l: 'Bez wer.' },
            ], verificationFilter, setVerificationFilter],
            ['Radar', [
              { k: 'ALL', l: 'Wszystkie' },
              { k: 'ON', l: 'ON' },
              { k: 'OFF', l: 'OFF' },
            ], radarFilter, setRadarFilter],
            ['Aktywność', [
              { k: 'ALL', l: 'Wszystkie' },
              { k: 'ONLINE', l: 'Online' },
              { k: 'RECENT', l: 'Niedawno' },
              { k: 'OFFLINE', l: 'Offline' },
            ], presenceFilter, setPresenceFilter],
          ].map(([title, opts, active, setter]) => (
            <View key={String(title)} style={styles.filterGroup}>
              <Text style={[styles.filterSectionLabel, { color: colors.secondary }]}>{title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {(opts as Array<{ k: string; l: string }>).map((r) =>
                  renderFilterChip(active as string, r.l, r.k, setter as (v: string) => void),
                )}
              </ScrollView>
            </View>
          ))}

          {(activeFilterCount > 0 || search.trim()) ? (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setRoleFilter('ALL');
                setVerificationFilter('ALL');
                setRadarFilter('ALL');
                setPresenceFilter('ALL');
                setSearch('');
                setSortBy('createdAt');
                setSortDir('desc');
              }}
              style={styles.resetBtn}
            >
              <Text style={[styles.resetBtnText, { color: colors.accent }]}>Wyczyść filtry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderUser = ({ item, index }: { item: any; index: number }) => {
    const verified = isUserVerified(item);
    const radarOn = isRadarEnabled(item);
    const presence = getUserPresence(item);
    const role = roleMeta(item.role);
    const plan = planMeta(item.planType);
    const threshold = radarThreshold(item);
    const offersCount = item._count?.offers ?? 0;
    const isLast = index === filteredUsers.length - 1;

    return (
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onOpenUser(item);
        }}
        style={({ pressed }) => [
          styles.userRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.separator,
            opacity: pressed ? 0.92 : 1,
            borderBottomWidth: isLast ? StyleSheet.hairlineWidth : 0,
          },
        ]}
      >
        <View style={styles.userTop}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.avatarLetter, { color: colors.text }]}>
                {(item?.name || item?.email || '?').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.userBody}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {item.name || 'Użytkownik'}
              </Text>
              <View style={[styles.rolePill, { backgroundColor: role.bg }]}>
                <Text style={[styles.rolePillText, { color: role.color }]}>{role.label}</Text>
              </View>
              {verified ? (
                <Ionicons name="checkmark-seal" size={14} color="#34C759" />
              ) : null}
            </View>
            <Text style={[styles.userSub, { color: colors.secondary }]} numberOfLines={1}>
              {item.email}
            </Text>
            <Text style={[styles.userSub, { color: colors.tertiary }]} numberOfLines={1}>
              {item.phone || 'Brak telefonu'}
              {item.companyName ? ` · ${item.companyName}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              deleteUser(item.id, item.email);
            }}
            hitSlop={10}
            style={[styles.deleteBtn, { backgroundColor: 'rgba(255,59,48,0.12)' }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          <MetricCell label="Oferty" value={String(offersCount)} colors={colors} accent={offersCount > 0} />
          <MetricCell label="Plan" value={plan.label} colors={colors} tint={plan.color} />
          <MetricCell
            label="Radar"
            value={radarOn ? (threshold != null ? `${threshold}%` : 'ON') : 'OFF'}
            colors={colors}
            tint={radarOn ? '#AF52DE' : colors.tertiary}
          />
          <MetricCell label="Aktywność" value={presence.label} colors={colors} tint={presence.color} small />
        </View>

        <View style={[styles.footerRow, { borderTopColor: colors.separator }]}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.tertiary} />
            <Text style={[styles.footerText, { color: colors.tertiary }]}>Od {formatUserDate(item.createdAt)}</Text>
          </View>
          {item.lastLoginAt ? (
            <View style={styles.footerItem}>
              <Ionicons name="log-in-outline" size={12} color={colors.tertiary} />
              <Text style={[styles.footerText, { color: colors.tertiary }]}>{formatUserDateTime(item.lastLoginAt)}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.tertiary} />
        </View>
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.navBar, { borderBottomColor: colors.separator }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.navTitle, { color: colors.text }]}>Centrum użytkowników</Text>
            <Text style={[styles.navSubtitle, { color: colors.secondary }]}>Analityka kont i aktywności</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        {loading && users.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUser}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.accent}
                onRefresh={() => {
                  setRefreshing(true);
                  void fetchUsers('reset');
                }}
              />
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.secondary }]}>Brak użytkowników dla tych filtrów.</Text>
            }
            onEndReached={() => {
              if (!loading && hasMore) void fetchUsers('append');
            }}
            onEndReachedThreshold={0.5}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListFooterComponent={
              loading && users.length > 0 ? (
                <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.accent} />
              ) : (
                <View style={{ height: 8 }} />
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

function MetricCell({
  label,
  value,
  colors,
  tint,
  accent,
  small,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useUsersTheme>;
  tint?: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <View style={[styles.metricCell, { backgroundColor: colors.cardSecondary }]}>
      <Text style={[styles.metricLabel, { color: colors.secondary }]}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          { color: tint || (accent ? colors.accent : colors.text), fontSize: small ? 10 : 12 },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  navSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listHeader: { paddingTop: 12, paddingBottom: 8, gap: 10 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCell: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  kpiValue: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kpiLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  sortBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  toolsTitle: { fontSize: 15, fontWeight: '600' },
  toolsMeta: { fontSize: 12, marginTop: 2 },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  toolsPanel: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  filterGroup: { gap: 6 },
  filterSectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { gap: 8, paddingVertical: 2 },
  filterChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  resetBtnText: { fontSize: 14, fontWeight: '600' },
  userRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    overflow: 'hidden',
  },
  userTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 17, fontWeight: '700' },
  userBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  rolePill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rolePillText: { fontSize: 10, fontWeight: '700' },
  userSub: { fontSize: 12, marginTop: 2 },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  metricCell: { flex: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center' },
  metricLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { fontSize: 12, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  footerText: { fontSize: 10, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15, fontWeight: '500' },
});
