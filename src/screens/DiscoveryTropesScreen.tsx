import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { fetchDiscoveryTropes, mutateDiscoveryTrope, submitDiscoveryVisitFeedback, type DiscoveryTrope } from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';

export default function DiscoveryTropesScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryTropesInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryTropesInner({ navigation }: any) {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState<DiscoveryTrope[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchDiscoveryTropes(token));
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>DISCOVERY™</Text>
      <Text style={styles.title}>Twoje tropy</Text>
      <Text style={styles.lead}>Miejsca, do których warto wrócić spokojnie.</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => void reload()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nie ma jeszcze zapisanych tropów.</Text>}
        renderItem={({ item }) => {
          const offer = item.offer;
          const image = (() => {
            try { return JSON.parse(offer?.images || '[]')[0] || null; } catch { return null; }
          })();
          return (
            <View style={styles.card}>
              {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" /> : null}
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>{offer?.title || 'Oferta niedostępna'}</Text>
                <Text style={styles.location}>{[offer?.district, offer?.city].filter(Boolean).join(' · ') || 'Polska'}</Text>
                <Text style={styles.status}>{item.status === 'SERIOUS' ? 'WAŻNY TROP' : item.visitOutcome ? `WIZYTA: ${item.visitOutcome}` : 'ZAPISANY TROP'}</Text>
                <View style={styles.actions}>
                  <ApplePressable onPress={() => navigation.navigate('OfferDetail', { offerId: item.offerId })} style={styles.action}><Text style={styles.actionText}>Otwórz</Text></ApplePressable>
                  <ApplePressable onPress={async () => { await mutateDiscoveryTrope(token, { offerId: item.offerId, action: 'SERIOUS' }); await reload(); }} style={styles.action}><Text style={styles.actionText}>Ważny</Text></ApplePressable>
                  <ApplePressable onPress={async () => { await submitDiscoveryVisitFeedback(token, { offerId: item.offerId, visitOutcome: 'YES' }); await reload(); }} style={styles.action}><Text style={styles.actionText}>Wizyta</Text></ApplePressable>
                  <ApplePressable onPress={() => navigation.navigate('DiscoveryBridge', { offerId: item.offerId })} style={styles.action}><Text style={styles.actionText}>Rozmowa</Text></ApplePressable>
                  {item.status === 'SERIOUS' ? <ApplePressable onPress={() => navigation.navigate('DiscoveryJourneyHonor', { offerId: item.offerId })} style={styles.action}><Text style={styles.actionText}>Domknij</Text></ApplePressable> : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040405', paddingTop: 60, paddingHorizontal: 18 },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#FFF', fontSize: 30, fontWeight: '800', marginTop: 8 },
  lead: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, marginTop: 6 },
  list: { paddingVertical: 22, gap: 12 },
  empty: { color: DISCOVERY_COLORS.textMuted, textAlign: 'center', marginTop: 70 },
  card: { minHeight: 110, borderRadius: 22, overflow: 'hidden', flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  image: { width: 100, height: '100%' },
  meta: { flex: 1, padding: 13 },
  name: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  location: { color: DISCOVERY_COLORS.textMuted, fontSize: 12, marginTop: 3 },
  status: { color: DISCOVERY_COLORS.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  actionText: { color: DISCOVERY_COLORS.ivory, fontSize: 11, fontWeight: '800' },
});
