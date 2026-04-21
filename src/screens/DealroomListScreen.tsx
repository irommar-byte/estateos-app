import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ChevronRight, ChevronLeft, MessageCircle, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore'; // Prawdziwa autoryzacja

export default function DealroomListScreen() {
  const navigation = useNavigation<any>();
  const { token } = useAuthStore() as any; // Pobieramy Twój prawdziwy token
  
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      if (!token) return;
      try {
        const res = await fetch('https://estateos.pl/api/mobile/v1/deals', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setDeals(data.deals || []);
      } catch (e) {
        console.error('Błąd pobierania listy transakcji:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeals();
    // Odświeżanie listy co 5 sekund (żeby widzieć nowe wiadomości z zewnątrz)
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const formatStatus = (status: string) => {
    switch(status) { case 'INITIATED': return 'Zainicjowano'; case 'NEGOTIATION': return 'Negocjacje'; case 'ACCEPTED': return 'Zaakceptowano'; case 'REJECTED': return 'Odrzucono'; default: return status; }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }} style={styles.backButton}>
          <ChevronLeft size={32} color="#ffffff" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>DEALROOM</Text>
          <Text style={styles.headerSubtitle}>TWOJE AKTYWNE TRANSAKCJE</Text>
        </View>
      </View>

      {loading ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Pobieranie transakcji...</Text>
        </Animated.View>
      ) : deals.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.loaderCenter}>
          <AlertCircle size={40} color="#444" />
          <Text style={styles.loaderText}>Brak aktywnych transakcji.</Text>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {deals.map((deal, index) => (
            <Animated.View key={deal.id} entering={FadeInDown.delay(index * 100).springify().damping(16)}>
              <Pressable 
                style={({ pressed }) => [styles.dealModule, pressed && styles.dealModulePressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('DealroomChat', { dealId: deal.id, title: deal.title });
                }}
              >
                <View style={styles.moduleTop}>
                  <View style={styles.statusRow}>
                    <ShieldCheck size={14} color="#10b981" strokeWidth={2.5} />
                    <Text style={styles.statusText}>{formatStatus(deal.status)}</Text>
                  </View>
                  <Text style={styles.timeText}>{deal.time}</Text>
                </View>
                <View style={styles.moduleMiddle}>
                  <Text style={styles.dealTitle}>{deal.title}</Text>
                  {deal.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{deal.unread}</Text></View>}
                </View>
                <View style={styles.moduleBottom}>
                  <MessageCircle size={14} color={deal.unread > 0 ? '#ffffff' : '#86868b'} />
                  <Text style={[styles.lastMessage, deal.unread > 0 && styles.lastMessageUnread]} numberOfLines={1}>{deal.lastMessage}</Text>
                  <ChevronRight size={18} color="#444" style={styles.chevron} />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 20 },
  backButton: { marginRight: 12, padding: 4, marginLeft: -4 },
  headerTitle: { color: '#ffffff', fontSize: 26, fontWeight: '700', letterSpacing: 2 },
  headerSubtitle: { color: '#86868b', fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginTop: 2 },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#86868b', fontSize: 13, fontWeight: '500', marginTop: 16, letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  dealModule: { backgroundColor: '#111111', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  dealModulePressed: { backgroundColor: '#1A1A1A', transform: [{ scale: 0.98 }] },
  moduleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#10b981', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  timeText: { color: '#666666', fontSize: 12, fontWeight: '500' },
  moduleMiddle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dealTitle: { color: '#ffffff', fontSize: 20, fontWeight: '400', letterSpacing: 0.5 },
  badge: { backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#000000', fontSize: 12, fontWeight: '800' },
  moduleBottom: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  lastMessage: { color: '#86868b', fontSize: 14, marginLeft: 8, flex: 1 },
  lastMessageUnread: { color: '#ffffff', fontWeight: '600' },
  chevron: { marginLeft: 'auto' },
});
