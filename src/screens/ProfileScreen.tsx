import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Platform, Image, Modal, FlatList, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import AuthScreen from './AuthScreen';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';
import { VerificationBadge } from '../components/VerificationBadge';

// --- KOMPONENT ADMINA: SZCZEGÓŁY UŻYTKOWNIKA (NOWY) ---
const AdminUserProfileModal = ({ visible, userId, onClose, theme }: any) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchUserDetails = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/admin/users/${userId}`);
      const data = await res.json();
      if (data.success) setUserData(data.user);
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się pobrać danych użytkownika.");
    }
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchUserDetails(); }, [visible, userId]);

  const changeOfferStatus = async (offerId: number, newStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch('https://estateos.pl/api/mobile/v1/admin/offers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, newStatus })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUserDetails(); // Odświeżamy listę po zmianie statusu
      }
    } catch (e) { Alert.alert("Błąd", "Zmiana statusu nie powiodła się."); }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Brak danych';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const renderOffer = ({ item }: any) => (
    <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.offerTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: item.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: item.status === 'ACTIVE' ? '#10b981' : '#ef4444' }}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.offerSubtitle}>{item.price} PLN • {item.city}</Text>
      
      <View style={styles.offerActions}>
        {item.status === 'PENDING' && (
          <>
            <Pressable onPress={() => changeOfferStatus(item.id, 'ACTIVE')} style={[styles.actionBtn, { backgroundColor: '#10b981' }]}><Ionicons name="checkmark" size={14} color="#fff" /><Text style={styles.actionText}>Akceptuj</Text></Pressable>
            <Pressable onPress={() => changeOfferStatus(item.id, 'REJECTED')} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}><Ionicons name="close" size={14} color="#fff" /><Text style={styles.actionText}>Odrzuć</Text></Pressable>
          </>
        )}
        {item.status === 'ACTIVE' && (
          <Pressable onPress={() => changeOfferStatus(item.id, 'ARCHIVED')} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}><Ionicons name="archive" size={14} color="#fff" /><Text style={styles.actionText}>Zawieś / Archiwizuj</Text></Pressable>
        )}
        {item.status === 'ARCHIVED' && (
          <Pressable onPress={() => changeOfferStatus(item.id, 'ACTIVE')} style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}><Ionicons name="refresh" size={14} color="#fff" /><Text style={styles.actionText}>Przywróć</Text></Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Karta Użytkownika</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>

        {loading || !userData ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            {/* WIZYTÓWKA */}
            <View style={[styles.headerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', marginBottom: 20 }]}>
              <View style={styles.avatarWrapper}>
                {userData.image ? <Image source={{ uri: userData.image }} style={styles.avatarImage} /> : <Ionicons name="person" size={36} color="#fff" />}
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{userData.name || 'Brak imienia'}</Text>
                <Text style={styles.headerRole}>{userData.role}</Text>
                <VerificationBadge isVerified={userData.isVerified} isDark={isDark} onPress={() => {}} />
              </View>
            </View>

            {/* DANE SZCZEGÓŁOWE */}
            <Text style={styles.sectionTitle}>Szczegóły konta</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="mail" color="#007AFF" title="Adres e-mail" value={userData.email} isDark={isDark} />
              <ListItem icon="call" color="#34C759" title="Telefon" value={userData.phone || 'Brak'} isDark={isDark} />
              <ListItem icon="calendar" color="#FF9F0A" title="Dołączył(a)" value={formatDate(userData.createdAt)} isLast={true} isDark={isDark} />
            </ListGroup>

            {/* LISTA OFERT TEGO UŻYTKOWNIKA */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Ogłoszenia ({userData.offers?.length || 0})</Text>
            {userData.offers && userData.offers.length > 0 ? (
              userData.offers.map((offer: any) => <React.Fragment key={offer.id}>{renderOffer({ item: offer })}</React.Fragment>)
            ) : (
              <Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 20 }}>Ten użytkownik nie posiada jeszcze ofert.</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// --- KOMPONENT ADMINA: BAZA OFERT ---
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
    } catch (e) {}
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
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchOffers();
      }
    } catch (e) { Alert.alert("Błąd", "Nie udało się zmienić statusu"); }
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

// --- KOMPONENT ADMINA: LISTA UŻYTKOWNIKÓW ---
const AdminUsersModal = ({ visible, onClose, onOpenUser, theme }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/admin/users`);
      const data = await res.json();
      if (res.ok && data.success) setUsers(data.users);
    } catch (e) { }
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchUsers(); }, [visible]);

  const deleteUser = (userId: number, email: string) => {
    Alert.alert("Usuń użytkownika", `Czy na pewno chcesz permanentnie usunąć ${email}?`, [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res = await fetch(`https://estateos.pl/api/mobile/v1/admin/users`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId })
              });
              if (res.ok) fetchUsers();
            } catch (e) {}
        }}
    ]);
  };

  const renderUser = ({ item }: any) => (
    <View style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.userAvatar} /> : <View style={styles.userAvatarPlaceholder}><Ionicons name="person" size={24} color="#8E8E93" /></View>}
        <View style={{ marginLeft: 15, flex: 1 }}>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{item.name || 'Brak imienia'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userRole}>{item.role} • {item.isVerified ? 'Zweryfikowany' : 'Niezweryfikowany'}</Text>
        </View>
      </View>
      <View style={styles.userStats}>
         <View style={styles.statBox}><Text style={[styles.statValue, { color: theme.text }]}>{item._count?.offers || 0}</Text><Text style={styles.statLabel}>Ofert</Text></View>
         <View style={styles.statBox}><Text style={[styles.statValue, { color: theme.text }]}>{item.phone || 'Brak'}</Text><Text style={styles.statLabel}>Telefon</Text></View>
      </View>
      <View style={styles.userActions}>
        <Pressable onPress={() => onOpenUser(item.id)} style={[styles.userBtn, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
          <Ionicons name="eye" size={18} color="#007AFF" /><Text style={[styles.userBtnText, { color: '#007AFF' }]}>Profil</Text>
        </Pressable>
        <Pressable onPress={() => deleteUser(item.id, item.email)} style={[styles.userBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
          <Ionicons name="trash" size={18} color="#FF3B30" /><Text style={[styles.userBtnText, { color: '#FF3B30' }]}>Usuń</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Użytkownicy</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {loading ? <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 50 }} /> : <FlatList data={users} keyExtractor={item => item.id.toString()} renderItem={renderUser} contentContainerStyle={{ padding: 20 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak użytkowników.</Text>} />}
      </View>
    </Modal>
  );
};

// --- KOMPONENT ZARZĄDZANIA OFERTAMI ---
const MyOffersModal = ({ visible, onClose, theme }: any) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore() as any;

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetch(`https://estateos.pl/api/mobile/v1/offers?includeAll=true&_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.offers) setOffers(data.offers.filter((o: any) => Number(o.userId) === Number(user?.id)));
        }).finally(() => setLoading(false));
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Moje Ogłoszenia</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {loading ? <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} /> : <FlatList data={offers} keyExtractor={item => item.id.toString()} renderItem={() => <View />} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak ofert.</Text>} />}
      </View>
    </Modal>
  );
};

// --- ELEMENTY UI ---
const ListGroup = ({ children, isDark }: any) => (
  <View style={[styles.listGroup, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>{children}</View>
);

const ListItem = ({ icon, color, title, subtitle, value, onPress, isLast, isDark, rightElement }: any) => (
  <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && onPress && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
    <View style={[styles.listIconBox, { backgroundColor: color }]}><Ionicons name={icon} size={20} color="#FFF" /></View>
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

const modes = [ { label: 'Jasny', value: 'light' }, { label: 'Auto', value: 'auto' }, { label: 'Ciemny', value: 'dark' } ];

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

// --- GŁÓWNY EKRAN PROFILU ---
export default function ProfileScreen({ theme }: { theme: any }) {
  const navigation = useNavigation<any>();
  const { user, logout, updateAvatar, registerPasskey } = useAuthStore() as any;
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);
  const isDark = theme.glass === 'dark';
  
  const [isAdminOffersVisible, setIsAdminOffersVisible] = useState(false);
  const [isAdminUsersVisible, setIsAdminUsersVisible] = useState(false);
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<number | null>(null);
  const [isMyOffersVisible, setIsMyOffersVisible] = useState(false);

  const [isSmsEnabled, setIsSmsEnabled] = useState(true);

  useEffect(() => {
    if (isZarzad) {
      fetch('https://estateos.pl/api/admin/settings')
        .then(res => res.json())
        .then(data => setIsSmsEnabled(data.smsEnabled))
        .catch(() => {});
    }
  }, [isZarzad]);

  const toggleSms = async (value: boolean) => {
    setIsSmsEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Uderzamy w Twoją centralę aby zapisać nowy stan
    try {
      await fetch('https://estateos.pl/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: value })
      });
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się zsynchronizować ustawień z centralą.");
    }
  };


  if (!user) return <AuthScreen theme={theme} />;

  const isZarzad = user?.role === 'ADMIN';

  const handleAvatarPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      if (updateAvatar) updateAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleLogout = () => {
    Alert.alert("Wyloguj się", "Czy na pewno chcesz wylogować się?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); logout(); } }
    ]);
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        
        <View style={[styles.headerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
          <Pressable onPress={handleAvatarPick} style={({ pressed }) => [styles.avatarWrapper, { opacity: pressed ? 0.8 : 1 }]}>
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={36} color="#fff" /></View>}
            <View style={styles.editBadge}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>EDIT</Text></View>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{user?.firstName || user?.email} {user?.lastName || ''}</Text>
            <Text style={styles.headerRole}>{isZarzad ? 'Zarząd EstateOS™' : (user?.role === 'AGENT' ? 'Partner EstateOS™' : 'Osoba Prywatna')}</Text>
            
            <VerificationBadge 
              isVerified={user?.isVerifiedPhone || user?.isVerified} 
              isDark={isDark} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('SmsVerification'); }} 
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dane kontaktowe</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="call" color="#34C759" title="Telefon" value={user?.phone || 'Brak'} isDark={isDark} />
            <ListItem icon="mail" color="#007AFF" title="Email" value={user?.email} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twoje Nieruchomości</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="home" color="#007AFF" title="Zarządzaj ogłoszeniami" subtitle="Podgląd i edycja" onPress={() => setIsMyOffersVisible(true)} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bezpieczeństwo</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="key" color="#FF9F0A" title="Dodaj klucz Passkey" subtitle="Loguj się bezpiecznie przez Face ID" onPress={() => {}} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        {isZarzad && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Narzędzia Administratora</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="business" color="#5E5CE6" title="Baza Ofert" onPress={() => setIsAdminOffersVisible(true)} isDark={isDark} />
              <ListItem icon="people" color="#32ADE6" title="Użytkownicy" onPress={() => setIsAdminUsersVisible(true)} isDark={isDark} />
              <ListItem icon="stats-chart" color="#FF2D55" title="Analityka Radaru" onPress={() => Alert.alert("Wkrótce")} isDark={isDark} />

              <ListItem 
                icon="chatbubble-ellipses" color="#34C759" title="Bramka SMSPlanet" subtitle="Globalny przełącznik wysyłki"
                isLast={true} isDark={isDark}
                rightElement={<Switch value={isSmsEnabled} onValueChange={toggleSms} trackColor={{ false: '#767577', true: '#34C759' }} />} 
              />

            </ListGroup>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wygląd i ekran</Text>
          <ListGroup isDark={isDark}>
            <View style={styles.segmentWrapper}>
              <AnimatedSegmentedControl themeMode={themeMode} setThemeMode={setThemeMode} isDark={isDark} />
            </View>
          </ListGroup>
        </View>

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
      <AdminUsersModal visible={isAdminUsersVisible} onClose={() => setIsAdminUsersVisible(false)} onOpenUser={(id: number) => setAdminSelectedUserId(id)} theme={theme} />
      
      {/* NOWY MODAL: SZCZEGÓŁY UŻYTKOWNIKA */}
      <AdminUserProfileModal visible={!!adminSelectedUserId} userId={adminSelectedUserId} onClose={() => setAdminSelectedUserId(null)} theme={theme} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 60 },
  headerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatarWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1D1D6', justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: -4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginBottom: 2 },
  headerRole: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
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
  offerActions: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, marginTop: 8 },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 5, fontSize: 12 },
  userCard: { padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#8E8E93', marginBottom: 2 },
  userRole: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  userStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)', paddingVertical: 10, marginBottom: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2, textTransform: 'uppercase' },
  userActions: { flexDirection: 'row', gap: 10 },
  userBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 10, gap: 5 },
  userBtnText: { fontSize: 14, fontWeight: '700' }
});
