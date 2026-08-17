import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { fetchAgencyClients, type AgencyClientListItem } from '../services/agencyClientService';

export default function AgencyClientsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BUYER' | 'SELLER'>('ALL');
  const [clients, setClients] = useState<AgencyClientListItem[]>([]);

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

  const visible = useMemo(
    () => (filter === 'ALL' ? clients : clients.filter((c) => c.type === filter)),
    [clients, filter],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Moi klienci</Text>
        <Pressable onPress={() => navigation.navigate('AgencyClientCreate')} hitSlop={12} style={styles.navBtn}>
          <Ionicons name="add" size={28} color="#34C759" />
        </Pressable>
      </View>
      <View style={styles.filters}>
        {([
          ['ALL', 'Wszyscy'],
          ['BUYER', 'Kupujący'],
          ['SELLER', 'Sprzedający'],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setFilter(id)}
            style={[styles.chip, { backgroundColor: filter === id ? '#34C759' : colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: filter === id ? '#000' : colors.text, fontWeight: '800', fontSize: 12 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && clients.length === 0 ? <ActivityIndicator color="#34C759" /> : null}
        {visible.map((client) => (
          <Pressable
            key={client.id}
            onPress={() => navigation.navigate('AgencyClientDetail', { clientId: client.id })}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
                {client.type === 'BUYER' ? 'KUPUJĄCY' : 'SPRZEDAJĄCY'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                {client.firstName} {client.lastName}
              </Text>
              <Text style={{ color: colors.secondary, marginTop: 4, fontSize: 13 }}>
                {client.email || client.phone || 'Brak kontaktu'}
              </Text>
              {client.matchCount > 0 ? (
                <Text style={{ color: colors.secondary, marginTop: 6, fontSize: 12 }}>
                  {client.matchCount} dopasowań{client.topMatchScore ? ` · top ${client.topMatchScore}%` : ''}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
          </Pressable>
        ))}
        {!loading && visible.length === 0 ? (
          <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 40 }}>Brak klientów w tej grupie.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  filters: { flexDirection: 'row', gap: 8, padding: 16 },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
