import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchTodayShowings } from '../../services/agencyClientService';

type Item = {
  id: string;
  kind: string;
  title: string;
  clientName: string;
  location: string;
  startsAt: string;
  status: string;
  clientId: number | null;
  offerId: number | null;
};

export default function TodayShowingsRail({
  navigation,
  isDark,
}: {
  navigation: any;
  isDark?: boolean;
}) {
  const token = useAuthStore((s: any) => s.token);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const colors = {
    card: isDark ? '#1c1c1e' : '#fff',
    text: isDark ? '#fff' : '#000',
    secondary: isDark ? '#8e8e93' : '#6b7280',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    accent: '#34C759',
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetchTodayShowings(token);
    setLoading(false);
    if (res.ok) setItems(res.items.filter((i) => i.kind === 'presentation'));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!loading && items.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>Dzisiejsze pokazy</Text>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>
      {items.slice(0, 6).map((item) => {
        const when = new Date(item.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        return (
          <View key={item.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
                {when} · {item.clientName}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {item.location || item.title}
                {item.status === 'pending' ? ' · do potwierdzenia' : ''}
              </Text>
            </View>
            {item.clientId ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('PresentationVisitWizard', {
                    clientId: item.clientId,
                    offerId: item.offerId || undefined,
                    clientName: item.clientName,
                  })
                }
                style={[styles.btn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.btnText}>Rozpocznij wizytę</Text>
              </Pressable>
            ) : null}
            {item.clientId ? (
              <Pressable
                onPress={() => navigation.navigate('AgencyClientDetail', { clientId: item.clientId })}
                hitSlop={8}
                style={{ marginLeft: 8 }}
              >
                <Ionicons name="person-circle-outline" size={26} color="#007AFF" />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 0, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 15, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  btn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 12 },
});
