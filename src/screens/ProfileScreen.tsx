import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Platform, Image, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';

import AuthScreen from './AuthScreen';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';

// --- KOMPONENT ADMINA (BAZA OFERT) - ZACHOWANY W 100% ---
const AdminOffersModal = ({ visible, onClose, theme }: any) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ACTIVE' | 'ARCHIVED'>('PENDING');
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/admin/offers?status=${activeTab}`);
      const data = await res.json();
      if (data.success) setOffers(data.offers);
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się pobrać ofert");
    }
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchOffers(); }, [visible, activeTab]);

  const changeStatus = async (offerId: number, newStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch('https://estateos.pl/api/mobile/v1/admin/offers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, newStatus })
      });
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchOffers();
      }
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się zmienić statusu");
    }
  };

  const renderOffer = ({ item }: any) => (
    <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <Text style={[styles.offerTitle, { color: theme.text }]}>{item.title}</Text>
      <Text style={styles.offerSubtitle}>{item.price} PLN • {item.city}</Text>
      <Text style={styles.offerUser}>Autor: {item.user?.email}</Text>
      <View style={styles.offerActions}>
        {activeTab === 'PENDING' && (
          <>
            <Pressable onPress={() => changeStatus(item.id, 'ACTIVE')} style={[styles.actionBtn, { backgroundColor: '#10b981' }]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.actionText}>Akceptuj</Text></Pressable>
            <Pressable onPress={() => changeStatus(item.id, 'REJECTED')} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}><Ionicons name="close" size={18} color="#fff" /><Text style={styles.actionText}>Odrzuć</Text></Pressable>
          </>
        )}
        {activeTab === 'ACTIVE' && (
          <Pressable onPress={() => changeStatus(item.id, 'ARCHIVED')} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}><Ionicons name="archive" size={18} color="#fff" /><Text style={styles.actionText}>Archiwizuj</Text></Pressable>
        )}
        {activeTab === 'ARCHIVED' && (
          <Pressable onPress={() => changeStatus(item.id, 'ACTIVE')} style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}><Ionicons name="refresh" size={18} color="#fff" /><Text style={styles.actionText}>Przywróć</Text></Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Weryfikacja Ofert</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        <View style={styles.tabsContainer}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('PENDING'); }} style={[styles.tab, activeTab === 'PENDING' && { backgroundColor: '#FF9F0A' }]}><Text style={[styles.tabText, { color: activeTab === 'PENDING' ? '#fff' : theme.subtitle }]}>Do weryfikacji</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ACTIVE'); }} style={[styles.tab, activeTab === 'ACTIVE' && { backgroundColor: '#10b981' }]}><Text style={[styles.tabText, { color: activeTab === 'ACTIVE' ? '#fff' : theme.subtitle }]}>Aktywne</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ARCHIVED'); }} style={[styles.tab, activeTab === 'ARCHIVED' && { backgroundColor: '#8E8E93' }]}><Text style={[styles.tabText, { color: activeTab === 'ARCHIVED' ? '#fff' : theme.subtitle }]}>Zarchiwizowane</Text></Pressable>
        </View>
        {loading ? <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} /> : <FlatList data={offers} keyExtractor={item => item.id.toString()} renderItem={renderOffer} contentContainerStyle={{ padding: 20 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak ofert w tej zakładce.</Text>} />}
      </View>
    </Modal>
  );
};

// --- NOWE KOMPONENTY KATEGORYZACJI (APPLE STYLE) ---

// --- KOMPONENT ZARZĄDZANIA OFERTAMI UŻYTKOWNIKA (APPLE STYLE PREMIUM) ---
const MyOffersModal = ({ visible, onClose, theme }: any) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'ENDED'>('ALL');
  const { user } = useAuthStore() as any;
  const navigation = useNavigation<any>();
  const isDark = theme.glass === 'dark';

  const fetchMyOffers = async () => {
    setLoading(true);
    try {
      // UWAGA: Publiczny endpoint /offers może odrzucać oferty PENDING. 
      // Docelowo należy tu użyć /offers/my, gdy backend zacznie go obsługiwać.
      // Próba pobrania wszystkich ofert (w tym nieaktywnych)
      const res = await fetch(`https://estateos.pl/api/mobile/v1/offers?includeAll=true&_t=${Date.now()}`);
      const text = await res.text();
      const data = JSON.parse(text);
      if (data.success && data.offers) {
         console.log("DEBUG: Twój ID:", user?.id, "Typ:", typeof user?.id);
         const myOffers = data.offers.filter((o: any) => {
            console.log("DEBUG: Oferta ID:", o.id, "userId oferty:", o.userId);
            return Number(o.userId) === Number(user?.id);
         });
         setOffers(myOffers);
      }
    } catch (e) {
      console.log("Błąd pobierania ofert:", e);
    }
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchMyOffers(); }, [visible]);

  // FILTROWANIE PO ZAKŁADKACH
  const filteredOffers = offers.filter(o => {
     if (activeTab === 'ACTIVE') return o.status === 'ACTIVE';
     if (activeTab === 'ENDED') return o.status === 'ARCHIVED' || o.status === 'REJECTED';
     // W zakładce "Wszystkie" pokazujemy wszystko, w tym PENDING i REJECTED
     return true; 
  });

  // GŁĘBOKI STATUS ODDYCHAJĄCY / PULSUJĄCY (Skala + Przezroczystość)
  const StatusBadge = ({ status }: { status: string }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (status === 'ACTIVE' || status === 'PENDING') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: status === 'PENDING' ? 0.3 : 0.6, duration: status === 'PENDING' ? 500 : 1500, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: status === 'PENDING' ? 500 : 1500, useNativeDriver: true })
          ])
        ).start();
      }
    }, [status]);

    let config = { text: 'NIEZNANY', color: '#8E8E93', glow: '#8E8E93' };
    if (status === 'ACTIVE') config = { text: 'AKTYWNE', color: '#34C759', glow: '#34C759' };
    if (status === 'PENDING') config = { text: 'WERYFIKACJA', color: '#FF9F0A', glow: '#FF9F0A' };
    if (status === 'REJECTED' || status === 'ARCHIVED') config = { text: 'ZAKOŃCZONE', color: '#FF3B30', glow: '#FF3B30' };

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
        <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: config.color, marginRight: 6, shadowColor: config.glow, shadowOffset: {width: 0, height: 0}, shadowOpacity: 1, shadowRadius: 4 }, (status === 'ACTIVE' || status === 'PENDING') && { opacity: pulseAnim }] } />
        <Text style={{ color: config.color, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>{config.text}</Text>
      </View>
    );
  };

  const CountdownTimer = ({ startDate, status }: { startDate: string, status: string }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      if (status !== 'ACTIVE') {
        setTimeLeft(status === 'PENDING' ? 'Oczekuje na akceptację' : 'Oferta zarchiwizowana');
        return;
      }

      const calculateTime = () => {
        const start = new Date(startDate).getTime();
        const expires = start + (30 * 24 * 60 * 60 * 1000);
        const now = new Date().getTime();
        const diff = expires - now;

        if (diff <= 0) return 'Czas minął (Wygasła)';

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        return `${d}d ${h}h ${m}m ${s}s`;
      };

      setTimeLeft(calculateTime());
      const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
      return () => clearInterval(timer);
    }, [startDate, status]);

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
         <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: 4, borderRadius: 6 }}>
           <Ionicons name="time" size={12} color={isDark ? '#E5E5EA' : '#8E8E93'} />
         </View>
         <Text style={{ fontSize: 13, color: isDark ? '#E5E5EA' : '#8E8E93', fontWeight: '700', fontVariant: ['tabular-nums'] }}>
           {timeLeft}
         </Text>
      </View>
    );
  };

  const translateType = (type: string) => {
    const dict: any = { FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' };
    return dict[type] || 'Nieruchomość';
  };

  const handleAction = (action: string, offer: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === 'PREVIEW') { onClose(); navigation.navigate('OfferDetail', { offer }); }
    if (action === 'REFRESH') Alert.alert('Odświeżenie', 'Twoja oferta została podbita na szczyt listy! (Wkrótce)');
    if (action === 'PROMOTE') Alert.alert('Wyróżnienie', 'Przenoszę do płatności za wyróżnienie... (Wkrótce)');
    if (action === 'END') {
       Alert.alert('Zakończ ofertę', 'Czy na pewno chcesz przenieść to ogłoszenie do archiwum?', [
         { text: 'Anuluj', style: 'cancel' },
         { text: 'Zakończ', style: 'destructive', onPress: async () => {
             try {
               const res = await fetch('https://estateos.pl/api/mobile/v1/admin/offers', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ offerId: offer.id, newStatus: 'ARCHIVED' })
               });
               const data = await res.json();
               if (res.ok && data.success) {
                 Alert.alert('Sukces', 'Oferta została zakończona i przeniesiona do archiwum.');
                 fetchMyOffers(); // Odświeżamy listę, żeby status od razu zmienił się na ekranie!
               } else {
                 Alert.alert('Błąd', 'Serwer odmówił: ' + (data.message || res.status));
               }
             } catch (e) {
               Alert.alert('Błąd', 'Brak połączenia z serwerem.');
             }
           } 
         }
       ]);
    }
  };

  const renderOffer = ({ item }: any) => {
     const firstImg = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images)[0] : item.images[0]) : null;
     
     return (
       <View style={[styles.myOfferCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
         <Pressable onPress={() => handleAction('PREVIEW', item)} style={({pressed}) => [styles.myOfferHeader, pressed && { opacity: 0.7 }]}>
            <View style={{ flexDirection: 'row', gap: 16, flex: 1 }}>
               <View style={styles.myOfferImgBox}>
                  {firstImg ? <Image source={{ uri: firstImg }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="home" size={28} color="#8E8E93" />}
               </View>
               <View style={{ flex: 1, justifyContent: 'center' }}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Text style={[styles.myOfferTitle, { color: theme.text }]} numberOfLines={1}>{translateType(item.propertyType)} {item.city}</Text>
                    <Text style={{fontSize: 10, color: theme.subtitle, fontWeight: '700'}}>#{item.id}</Text>
                  </View>
                  <Text style={[styles.myOfferPrice, { color: theme.text }]}>{parseInt(item.price || 0).toLocaleString('pl-PL')} PLN</Text>
                  <CountdownTimer startDate={item.createdAt} status={item.status || 'PENDING'} />
               </View>
            </View>
            <View style={{ paddingLeft: 10 }}>
                <StatusBadge status={item.status || 'PENDING'} />
            </View>
         </Pressable>
         
         <View style={[styles.myOfferToolbar, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 14, paddingHorizontal: 18 }}>
               <Pressable onPress={() => handleAction('REFRESH', item)} style={[styles.toolBtn, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}><Ionicons name="flash" size={16} color="#34C759" /><Text style={[styles.toolText, { color: '#34C759' }]}>Odśwież</Text></Pressable>
               <Pressable onPress={() => handleAction('PROMOTE', item)} style={[styles.toolBtn, { backgroundColor: 'rgba(255, 159, 10, 0.12)' }]}><Ionicons name="star" size={16} color="#FF9F0A" /><Text style={[styles.toolText, { color: '#FF9F0A' }]}>Wyróżnij</Text></Pressable>
               <Pressable onPress={() => handleAction('END', item)} style={[styles.toolBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}><Ionicons name="archive-outline" size={16} color="#FF3B30" /><Text style={[styles.toolText, { color: '#FF3B30' }]}>Zakończ</Text></Pressable>
            </ScrollView>
         </View>
       </View>
     );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Moje Ogłoszenia</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        
        {/* ZAKŁADKI / TABS */}
        <View style={styles.myTabsContainer}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ALL'); }} style={[styles.myTab, activeTab === 'ALL' && { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]}><Text style={[styles.myTabText, { color: activeTab === 'ALL' ? theme.text : theme.subtitle }]}>Wszystkie</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ACTIVE'); }} style={[styles.myTab, activeTab === 'ACTIVE' && { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]}><Text style={[styles.myTabText, { color: activeTab === 'ACTIVE' ? theme.text : theme.subtitle }]}>Aktywne</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ENDED'); }} style={[styles.myTab, activeTab === 'ENDED' && { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]}><Text style={[styles.myTabText, { color: activeTab === 'ENDED' ? theme.text : theme.subtitle }]}>Zakończone</Text></Pressable>
        </View>

        {loading ? <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} /> : 
        <FlatList data={filteredOffers} keyExtractor={item => item.id.toString()} renderItem={renderOffer} contentContainerStyle={{ padding: 16, paddingBottom: 50 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak ofert w tej zakładce.</Text>} />}
      </View>
    </Modal>
  );
};

const ListGroup = ({ children, isDark }: any) => (
  <View style={[styles.listGroup, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
    {children}
  </View>
);

const ListItem = ({ icon, color, title, subtitle, value, onPress, isLast, isDark, rightElement }: any) => (
  <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && onPress && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
    <View style={[styles.listIconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#FFF" />
    </View>
    <View style={[styles.listContent, !isLast && { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}>{title}</Text>
        {subtitle && <Text style={styles.listSubtitle}>{subtitle}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value && <Text style={styles.listValue}>{value}</Text>}
        {rightElement ? rightElement : (onPress ? <Ionicons name="chevron-forward" size={20} color="#8E8E93" opacity={0.5} style={{ marginLeft: 5 }} /> : null)}
      </View>
    </View>
  </Pressable>
);

const modes: { label: string; value: ThemeMode }[] = [ { label: 'Jasny', value: 'light' }, { label: 'Auto', value: 'auto' }, { label: 'Ciemny', value: 'dark' } ];

function AnimatedSegmentedControl({ themeMode, setThemeMode, isDark }: any) {
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth = containerWidth > 0 ? containerWidth / 3 : 0;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (segmentWidth === 0) return;
    const index = modes.findIndex(m => m.value === themeMode);
    Animated.spring(translateX, { toValue: index * segmentWidth, useNativeDriver: false, bounciness: 12, speed: 14 }).start();
  }, [themeMode, segmentWidth]);

  return (
    <View style={[styles.segmentContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 && <Animated.View style={[styles.segmentActive, { width: segmentWidth, transform: [{ translateX }], backgroundColor: isDark ? '#3A3A3C' : '#FFF', shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 }]} />}
      {modes.map((mode) => (
        <Pressable key={mode.value} onPress={() => { Haptics.selectionAsync(); setThemeMode(mode.value); }} style={styles.segmentButton}>
          <Text style={[styles.segmentText, { color: themeMode === mode.value ? (isDark ? '#FFF' : '#000') : '#8E8E93' }]}>{mode.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}


// --- KOMPONENT: ODDYCHAJĄCA PLAKIETKA WERYFIKACJI ---
const UnverifiedBadge = ({ onPress, isDark }: any) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }], flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 }} />
        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>NIEZWERYFIKOWANY</Text>
      </Animated.View>
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }]}>
        <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '800' }}>Zweryfikuj SMS</Text>
      </Pressable>
    </View>
  );
};

// --- GŁÓWNY EKRAN PROFILU ---

export default function ProfileScreen({ theme }: { theme: any }) {
  const navigation = useNavigation<any>();
  const { isLoggedIn, user, logout, updateAvatar, registerPasskey } = useAuthStore() as any;
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);
  const isDark = theme.glass === 'dark';
  
  const [isAdminOffersVisible, setIsAdminOffersVisible] = useState(false);
  const [isMyOffersVisible, setIsMyOffersVisible] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);


  if (!user) return <AuthScreen theme={theme} />;

  const isZarzad = user?.role === 'ADMIN';

  const handleAvatarPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (updateAvatar) updateAvatar(base64Img);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAddPasskey = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPasskeyLoading(true);
    try {
      await registerPasskey();
      Alert.alert("Sukces", "Klucz Passkey został wygenerowany w Twoim urządzeniu. Od teraz możesz logować się odciskiem palca lub twarzą!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Passkey", e.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Wyloguj się",
      "Czy na pewno chcesz wylogować się ze swojego konta EstateOS?",
      [
        { text: "Anuluj", style: "cancel" },
        { text: "Wyloguj", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); logout(); } }
      ]
    );
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        
        {/* Apple ID Card Style (Top Header) */}
        <View style={[styles.headerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
          <Pressable onPress={handleAvatarPick} style={({ pressed }) => [styles.avatarWrapper, { opacity: pressed ? 0.8 : 1 }]}>
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={36} color="#fff" /></View>}
            <View style={styles.editBadge}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>EDIT</Text></View>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{user?.firstName || user?.email} {user?.lastName || ''}</Text>
            <Text style={styles.headerRole}>{isZarzad ? 'Zarząd EstateOS™' : (user?.role === 'AGENT' ? 'Partner EstateOS™' : 'Osoba Prywatna')}</Text>
            {/* Tutaj sprawdzamy flagę weryfikacji. Na razie załóżmy, że pole isVerifiedPhone jest false (wymuś testowo) */}
            {(!user?.isVerifiedPhone) && (
              <UnverifiedBadge isDark={isDark} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('SmsVerification'); }} />
            )}
          </View>
        </View>

        {/* Sekcja: INFORMACJE KONTAKTOWE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dane kontaktowe</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="call" color="#34C759" title="Telefon" value={user?.phone || 'Brak'} isDark={isDark} />
            <ListItem icon="mail" color="#007AFF" title="Email" value={user?.email} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        {/* Sekcja: ZARZĄDZANIE OFERTAMI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twoje Nieruchomości</Text>
          <ListGroup isDark={isDark}>
            <ListItem 
              icon="home" color="#007AFF" title="Zarządzaj ogłoszeniami" subtitle="Podgląd, edycja i statystyki Twoich ofert" 
              onPress={() => setIsMyOffersVisible(true)} isLast={true} isDark={isDark}
            />
          </ListGroup>
        </View>

        {/* Sekcja: BEZPIECZEŃSTWO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bezpieczeństwo</Text>
          <ListGroup isDark={isDark}>
            <ListItem 
              icon="key" color="#FF9F0A" title="Dodaj klucz Passkey" subtitle="Loguj się bezpiecznie przez Face ID / Touch ID" 
              onPress={handleAddPasskey} isLast={true} isDark={isDark}
              rightElement={isPasskeyLoading ? <ActivityIndicator size="small" color="#FF9F0A" /> : undefined}
            />
          </ListGroup>
          <Text style={styles.sectionFooter}>Passkeys używają bezpiecznej technologii biometrycznej Twojego urządzenia. Opcja jest powiązana z webowym ekosystemem EstateOS.</Text>
        </View>

        {/* Sekcja: NARZĘDZIA ZARZĄDU */}
        {isZarzad && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Narzędzia Administratora</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="business" color="#5E5CE6" title="Baza Ofert (Weryfikacja)" onPress={() => setIsAdminOffersVisible(true)} isDark={isDark} />
              <ListItem icon="people" color="#32ADE6" title="Użytkownicy" onPress={() => Alert.alert("Wkrótce")} isDark={isDark} />
              <ListItem icon="stats-chart" color="#FF2D55" title="Analityka Radaru" onPress={() => Alert.alert("Wkrótce")} isLast={true} isDark={isDark} />
            </ListGroup>
          </View>
        )}

        {/* Sekcja: PREFERENCJE APLIKACJI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wygląd i ekran</Text>
          <ListGroup isDark={isDark}>
            <View style={styles.segmentWrapper}>
              <AnimatedSegmentedControl themeMode={themeMode} setThemeMode={setThemeMode} isDark={isDark} />
            </View>
          </ListGroup>
        </View>

        {/* WYLOGOWANIE */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <ListGroup isDark={isDark}>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutBtn, pressed && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Text style={styles.logoutText}>Wyloguj się</Text>
            </Pressable>
          </ListGroup>
        </View>

        <Text style={styles.versionText}>EstateOS™ v1.0.0</Text>

      </ScrollView>

      <MyOffersModal visible={isMyOffersVisible} onClose={() => setIsMyOffersVisible(false)} theme={theme} />
      <AdminOffersModal visible={isAdminOffersVisible} onClose={() => setIsAdminOffersVisible(false)} theme={theme} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 60 },
  
  // Apple ID Header
  headerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatarWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1D1D6', justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: -4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginBottom: 2 },
  headerRole: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },

  // Sections (Apple Grouped Style)
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: '#8E8E93', textTransform: 'uppercase', marginLeft: 16, marginBottom: 8, letterSpacing: 0.3 },
  sectionFooter: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginTop: 8, marginRight: 16, lineHeight: 18 },
  
  listGroup: { borderRadius: 12, overflow: 'hidden' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  listIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  listContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16 },
  listTitle: { fontSize: 17, fontWeight: '400', letterSpacing: -0.2 },
  listSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  listValue: { fontSize: 16, color: '#8E8E93' },
  
  segmentWrapper: { padding: 12 },
  segmentContainer: { width: '100%', height: 36, borderRadius: 8, flexDirection: 'row', position: 'relative', padding: 2 },
  segmentActive: { position: 'absolute', height: '100%', top: 2, left: 2, borderRadius: 6 },
  segmentButton: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  segmentText: { fontWeight: '600', fontSize: 13 },

  logoutBtn: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#FF3B30', fontSize: 17, fontWeight: '500' },
  versionText: { textAlign: 'center', color: '#8E8E93', fontSize: 13, marginTop: 10 },

  // Admin Modal Styles
  
  // My Offers Styles (Premium Apple Layout)
  myOfferCard: { borderRadius: 24, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 12}, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4, overflow: 'hidden' },
  myOfferHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18 },
  myOfferImgBox: { width: 65, height: 65, borderRadius: 16, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)' },
  myOfferTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  myOfferPrice: { fontSize: 15, fontWeight: '700' },
  myOfferToolbar: { borderTopWidth: StyleSheet.hairlineWidth },
  toolBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  toolText: { fontSize: 13, fontWeight: '700' },
  myTabsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  myTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  myTabText: { fontSize: 13, fontWeight: '700' },

  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginHorizontal: 2 },
  tabText: { fontSize: 13, fontWeight: '700' },
  offerCard: { padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  offerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 5 },
  offerSubtitle: { fontSize: 14, color: '#8E8E93', fontWeight: '600', marginBottom: 5 },
  offerUser: { fontSize: 12, color: '#8E8E93', marginBottom: 15 },
  offerActions: { flexDirection: 'row', justifyContent: 'flex-start', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginRight: 10 },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 5 }
});
