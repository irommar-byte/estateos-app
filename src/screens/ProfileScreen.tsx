// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Platform, Image, Modal, FlatList, ActivityIndicator, Switch, Easing, Dimensions, LayoutAnimation, UIManager, TextInput, useWindowDimensions, AppState, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { PasskeyService } from '../services/passkeyService';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config/network';
import AuthScreen from './AuthScreen';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';
import { VerificationBadge } from '../components/VerificationBadge';
import { BlurView } from 'expo-blur';
import { openStripeCheckoutForPlan } from '../utils/listingQuota';
import * as Notifications from 'expo-notifications';
import EliteStatusBadges from '../components/EliteStatusBadges';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height } = Dimensions.get('window');

/** API / DB często zwraca status małymi literami (np. pending); filtry zakładały wyłącznie UPPERCASE. */
function normalizeOfferTabStatus(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (['ACTIVE', 'PUBLISHED', 'LIVE', 'APPROVED'].includes(s)) return 'ACTIVE';
  if (['PENDING', 'DRAFT', 'WAITING', 'UNDER_REVIEW', 'REVIEW', 'IN_REVIEW', 'NEW'].includes(s)) return 'PENDING';
  if (['ARCHIVED', 'CLOSED', 'REJECTED', 'EXPIRED', 'INACTIVE', 'CANCELLED', 'CANCELED', 'SOLD', 'OFF_MARKET'].includes(s)) return 'ARCHIVED';
  return s;
}

const AnimatedStatusDot = ({ status }) => {
  const animOpacity = useRef(new Animated.Value(normalizeOfferTabStatus(status) === 'PENDING' ? 0 : 0.4)).current;
  const animScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const st = normalizeOfferTabStatus(status);
    if (st === 'ACTIVE') {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animOpacity, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(animOpacity, { toValue: 0.4, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(animScale, { toValue: 1.3, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
          ])
        ])
      ).start();
    } else if (st === 'PENDING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(animOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true })
        ])
      ).start();
    } else {
      animOpacity.setValue(1);
      animScale.setValue(1);
    }
  }, [status]);

  const st = normalizeOfferTabStatus(status);
  const color = st === 'ACTIVE' ? '#34C759' : st === 'PENDING' ? '#FF9F0A' : '#FF3B30';

  return (
    <View style={styles.ledContainer}>
      <Animated.View style={[styles.ledGlow, { backgroundColor: color, opacity: animOpacity, transform: [{ scale: animScale }] }]} />
      <View style={[styles.ledCore, { backgroundColor: color }]} />
    </View>
  );
};

const NotificationsSettingsModal = ({ visible, onClose, theme }) => {
  const isDark = theme.glass === 'dark';
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [negotiationAlerts, setNegotiationAlerts] = useState(true);
  const [pushPermissionStatus, setPushPermissionStatus] = useState(null);

  const refreshPushPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPushPermissionStatus(status);
    } catch {
      setPushPermissionStatus(null);
    }
  };

  useEffect(() => {
    if (!visible) return;
    void refreshPushPermission();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPushPermission();
    });
    return () => sub.remove();
  }, [visible]);

  const toggleSetting = (setter, value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(value);
  };

  const handleSystemPushAction = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'denied') {
      Alert.alert(
        'Powiadomienia systemowe',
        'System nie pozwoli ponownie wyświetlić okna zgody. Otwórz Ustawienia → Powiadomienia → EstateOS™ i włącz powiadomienia.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Ustawienia', onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }
    await Notifications.requestPermissionsAsync();
    await refreshPushPermission();
  };

  const pushStatusLabel =
    pushPermissionStatus === 'granted'
      ? 'Włączone'
      : pushPermissionStatus === 'denied'
        ? 'Wyłączone (ustawienia systemowe)'
        : pushPermissionStatus === 'undetermined'
          ? 'Nie ustawiono — możesz zezwolić'
          : '—';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Powiadomienia</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Powiadomienia na urządzeniu</Text>
          <View style={[styles.listGroup, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', marginBottom: 12 }]}>
            <View style={[styles.listItem, { paddingVertical: 14 }]}>
              <View style={[styles.listIconBox, { backgroundColor: pushPermissionStatus === 'granted' ? '#34C759' : '#FF9500' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}>Status systemowy</Text>
                <Text style={styles.listSubtitle}>{pushStatusLabel}</Text>
              </View>
              <Pressable
                onPress={() => void handleSystemPushAction()}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={{ color: '#007AFF', fontWeight: '700', fontSize: 15 }}>
                  {pushPermissionStatus === 'denied' ? 'Ustawienia' : 'Zezwól'}
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.sectionFooter}>
            Bez zgody systemowej iOS/Android nie wyśle alertów na ekran blokady — przełącznik pojawi się w Ustawieniach dopiero po pierwszej próbie zezwolenia.
          </Text>

          <Text style={styles.sectionTitle}>Ulubione oferty</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="pricetag" color="#34C759" title="Zmiany cen" subtitle="Gdy cena obserwowanej oferty spadnie" isDark={isDark} rightElement={<Switch value={priceAlerts} onValueChange={(v) => toggleSetting(setPriceAlerts, v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />} />
            <ListItem icon="chatbubbles" color="#007AFF" title="Nowe propozycje" subtitle="Gdy ktoś złoży ofertę cenową (negocjacje)" isDark={isDark} isLast={true} rightElement={<Switch value={negotiationAlerts} onValueChange={(v) => toggleSetting(setNegotiationAlerts, v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#007AFF' }} />} />
          </ListGroup>
          <Text style={styles.sectionFooter}>Otrzymasz powiadomienie Push na ekran blokady, które natychmiast przeniesie Cię do oferty.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const PremiumActionButton = ({ icon, color, title, subtitle, onPress, disabled, theme, isDark, isPrimary }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const buttonWidth = (width - 40 - 12) / 2;

  useEffect(() => {
    if (isPrimary && !disabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.03, duration: 1800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [isPrimary, disabled]);

  const onPressIn = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(scale, { toValue: 0.95, friction: 6, tension: 50, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 30, useNativeDriver: true }).start();
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={{ width: buttonWidth, marginBottom: 12 }} disabled={disabled}>
      <Animated.View style={[
        styles.livingActionBtn, 
        { 
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', 
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          opacity: disabled ? 0.4 : 1, 
          transform: [{ scale }] 
        }
      ]}>
        <View style={[styles.livingIconWrap, { backgroundColor: color.bg, shadowColor: color.icon }]}>
          <Ionicons name={icon} size={24} color={color.icon} />
        </View>
        <Text style={[styles.livingActionText, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        <Text style={styles.livingActionSub} numberOfLines={2}>{subtitle}</Text>
      </Animated.View>
    </Pressable>
  );
};

const resolveOfferMediaUrl = (value: unknown): string | null => {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
};

const parseOfferImageCandidates = (raw: unknown): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    if (trimmed.includes(',')) return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
    return [trimmed];
  }
};

const extractOfferCardImage = (offer: any): string | null => {
  const direct = [
    offer?.thumbnail,
    offer?.thumbnailUrl,
    offer?.image,
    offer?.imageUrl,
    offer?.coverImage,
    offer?.mainImage,
  ]
    .map(resolveOfferMediaUrl)
    .find(Boolean);
  if (direct) return direct;

  const candidates = parseOfferImageCandidates(offer?.images);
  for (const item of candidates) {
    if (typeof item === 'string') {
      const url = resolveOfferMediaUrl(item);
      if (url) return url;
      continue;
    }
    if (item && typeof item === 'object') {
      const url = resolveOfferMediaUrl(item.url ?? item.src ?? item.uri ?? item.path);
      if (url) return url;
    }
  }
  return null;
};

const MyOffersModal = ({ visible, onClose, theme }) => {
  const navigation = useNavigation();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [pendingReactivationOfferId, setPendingReactivationOfferId] = useState<number | null>(null);
  const [reactivating, setReactivating] = useState(false);
  
  const { user, token } = useAuthStore();
  const isDark = theme.glass === 'dark';

  const fetchMyOffers = async () => {
    if (!user || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.offers) ? data.offers : [];
      if (res.ok) setOffers(list);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { 
    if (visible) {
      fetchMyOffers(); 
      setSelectedOffer(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!pendingReactivationOfferId || !visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const offerId = pendingReactivationOfferId;
      setPendingReactivationOfferId(null);
      void finalizeOfferReactivation(offerId);
    });
    return () => sub.remove();
  }, [pendingReactivationOfferId, visible]);

  const handleOpenManagement = (offer) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedOffer(offer);
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedOffer(null);
  };

  const finalizeOfferReactivation = async (offerId: number) => {
    if (!token) return;
    setReactivating(true);
    try {
      await fetch(`${API_URL}/api/stripe/force-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      }).catch(() => null);

      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          offerId,
          newStatus: 'ACTIVE',
          renewDays: 30,
          extendDays: 30,
          reactivationPaid: true,
          reactivateAsNew: true,
          refreshCreatedAt: true,
          notifyRadar: true,
        }),
      });
      if (!res.ok) throw new Error('Serwer odrzucił reaktywację.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchMyOffers();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedOffer(null);
      setActiveTab('ACTIVE');
      Alert.alert('Oferta aktywowana', 'Ogłoszenie zostało aktywowane ponownie na kolejne 30 dni.');
    } catch {
      Alert.alert(
        'Nie udało się aktywować',
        'Po opłaceniu pakietu wróć tutaj i ponów aktywację. Jeśli płatność była przed chwilą, synchronizacja może potrwać chwilę.'
      );
    } finally {
      setReactivating(false);
    }
  };

  const handleAction = async (actionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actionType === 'PREVIEW') {
      onClose();
      setTimeout(() => navigation.navigate("OfferDetail", { offer: selectedOffer }), 200);
    } else if (actionType === 'EDIT') {
      Alert.alert("Edycja", "Funkcja edycji zostanie udostępniona wkrótce.");
    } else if (actionType === 'BUMP') {
      if (!selectedOffer?.id || !token || reactivating) return;
      Alert.alert(
        "Odśwież ofertę (+30 dni)",
        "Podbicie działa jak odnowienie: po płatności oferta dostaje kolejne 30 dni, wraca do aktywnych i może być promowana jak nowa na radarze.",
        [
          { text: "Anuluj", style: "cancel" },
          {
            text: "Przejdź do płatności",
            onPress: async () => {
              const opened = await openStripeCheckoutForPlan(API_URL, token, 'renewal', {
                offerId: Number(selectedOffer.id),
                metadata: { action: 'bump_as_renew_30d' },
              });
              if (opened) setPendingReactivationOfferId(selectedOffer.id);
            },
          },
        ]
      );
    } else if (actionType === 'ARCHIVE') {
      Alert.alert("Zakończ ogłoszenie", "Czy na pewno chcesz wycofać ofertę do archiwum?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Wycofaj", style: "destructive", onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ offerId: selectedOffer.id, newStatus: 'ARCHIVED' })
            });
            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchMyOffers();
              handleGoBack();
            }
          } catch(e) { Alert.alert("Błąd", "Nie udało się wycofać oferty."); }
        }}
      ]);
    } else if (actionType === 'REACTIVATE_30D') {
      if (!selectedOffer?.id || !token || reactivating) return;
      Alert.alert(
        'Aktywuj ponownie na 30 dni',
        'Aby ponownie aktywować zakończone ogłoszenie na 30 dni, przejdź do płatności Stripe. Po powrocie aplikacja spróbuje automatycznie odnowić ofertę.',
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przejdź do Stripe',
            onPress: async () => {
              const opened = await openStripeCheckoutForPlan(API_URL, token, 'renewal', {
                offerId: Number(selectedOffer.id),
                metadata: { action: 'reactivate_offer_30d' },
              });
              if (opened) setPendingReactivationOfferId(selectedOffer.id);
            },
          },
        ]
      );
    }
  };

  const filteredOffers = offers.filter((o) => {
    const st = normalizeOfferTabStatus(o.status);
    if (activeTab === 'ACTIVE') return st === 'ACTIVE';
    if (activeTab === 'PENDING') return st === 'PENDING';
    if (activeTab === 'ARCHIVED') return st === 'ARCHIVED';
    return false;
  });

  const renderMyOffer = ({ item }) => {
    const imageUri = extractOfferCardImage(item);

    const rowStatus = normalizeOfferTabStatus(item.status);

    return (
      <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
           {imageUri ? <Image source={{ uri: imageUri }} style={{ width: 65, height: 65, borderRadius: 14, marginRight: 15 }} /> : <View style={{ width: 65, height: 65, borderRadius: 14, marginRight: 15, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="home" size={24} color="#8E8E93" /></View>}
           <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.offerTitle, { color: theme.text, marginBottom: 4 }]} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.offerSubtitle}>{item.price} PLN • {item.city}</Text>
           </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AnimatedStatusDot status={item.status} />
            <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 8, color: rowStatus === 'ACTIVE' ? '#34C759' : rowStatus === 'PENDING' ? '#FF9F0A' : '#FF3B30' }}>
              {rowStatus === 'ACTIVE' ? 'AKTYWNE' : rowStatus === 'PENDING' ? 'OCZEKUJĄCE' : 'ZAKOŃCZONE'}
            </Text>
          </View>
          <Pressable onPress={() => handleOpenManagement(item)} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Zarządzaj</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderManagementView = () => {
    if (!selectedOffer) return null;
    const selSt = normalizeOfferTabStatus(selectedOffer.status);
    const expiryDate = selectedOffer.expiresAt ? new Date(selectedOffer.expiresAt) : null;
    const fallbackExpiryDate = selectedOffer.createdAt
      ? new Date(new Date(selectedOffer.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;
    const effectiveExpiryDate = expiryDate || fallbackExpiryDate;
    const daysLeft = effectiveExpiryDate
      ? Math.max(0, Math.ceil((effectiveExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;
    const realViews = Number(selectedOffer.viewsCount ?? selectedOffer.views ?? 0);

    const imageUri = extractOfferCardImage(selectedOffer);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', marginBottom: 25 }}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.mgtImage} /> : <View style={[styles.mgtImage, { backgroundColor: isDark ? '#333' : '#E5E5EA', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="home" size={30} color="#8E8E93" /></View>}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4 }} numberOfLines={2}>{selectedOffer.title}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.subtitle }}>{selectedOffer.price} PLN</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 25 }}>
          <View style={[styles.mgtStatBox, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="eye" size={24} color="#007AFF" />
            <Text style={[styles.mgtStatValue, { color: theme.text }]}>{realViews}</Text>
            <Text style={styles.mgtStatLabel}>Wyświetleń</Text>
          </View>
          <View style={[styles.mgtStatBox, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="time" size={24} color={daysLeft < 5 ? '#FF3B30' : '#34C759'} />
            <Text style={[styles.mgtStatValue, { color: theme.text }]}>{daysLeft}</Text>
            <Text style={styles.mgtStatLabel}>Dni do końca</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 15 }]}>Dostępne akcje</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <PremiumActionButton onPress={() => handleAction('PREVIEW')} icon="search" color={{ bg: 'rgba(0,122,255,0.1)', icon: '#007AFF' }} title="Podgląd" subtitle="Z perspektywy klienta" theme={theme} isDark={isDark} />
          <PremiumActionButton onPress={() => handleAction('EDIT')} icon="pencil" color={{ bg: 'rgba(255,159,10,0.1)', icon: '#FF9F0A' }} title="Edytuj" subtitle="Zmień parametry" theme={theme} isDark={isDark} />
          <PremiumActionButton isPrimary={true} disabled={selSt !== 'ACTIVE' || reactivating} onPress={() => handleAction('BUMP')} icon="rocket" color={{ bg: selSt === 'ACTIVE' ? 'rgba(52,199,89,0.15)' : 'rgba(142,142,147,0.1)', icon: selSt === 'ACTIVE' ? '#34C759' : '#8E8E93' }} title={reactivating && selSt === 'ACTIVE' ? 'Odświeżanie...' : 'Podbij (+30 dni)'} subtitle="Płatne odnowienie (renew)" theme={theme} isDark={isDark} />
          <PremiumActionButton disabled={selSt === 'ARCHIVED'} onPress={() => handleAction('ARCHIVE')} icon="archive" color={{ bg: selSt === 'ARCHIVED' ? 'rgba(142,142,147,0.1)' : 'rgba(255,59,48,0.1)', icon: selSt === 'ARCHIVED' ? '#8E8E93' : '#FF3B30' }} title="Wycofaj" subtitle="Zakończ ofertę" theme={theme} isDark={isDark} />
          {selSt === 'ARCHIVED' && (
            <PremiumActionButton
              isPrimary={true}
              disabled={reactivating}
              onPress={() => handleAction('REACTIVATE_30D')}
              icon="refresh-circle"
              color={{ bg: 'rgba(59,130,246,0.15)', icon: '#3b82f6' }}
              title={reactivating ? 'Aktywowanie...' : 'Aktywuj ponownie'}
              subtitle="30 dni po płatności Stripe"
              theme={theme}
              isDark={isDark}
            />
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        
        <View style={[styles.modalHeader, { paddingVertical: 15, paddingHorizontal: 15 }]}>
          {selectedOffer ? (
            <Pressable onPress={handleGoBack} style={{ width: 80, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text style={{ fontSize: 17, color: '#007AFF', fontWeight: '500', marginLeft: -4 }}>Wróć</Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <Text style={[styles.modalTitle, { color: theme.text, flex: 1, textAlign: 'center', fontSize: 18 }]}>
            {selectedOffer ? 'Zarządzanie' : 'Moje Ogłoszenia'}
          </Text>

          <Pressable onPress={onClose} style={{ width: 80, alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: 6, borderRadius: 15 }}>
              <Ionicons name="close" size={20} color={theme.subtitle} />
            </View>
          </Pressable>
        </View>

        {!selectedOffer && (
          <View style={styles.tabsContainer}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ACTIVE'); }} style={[styles.tab, activeTab === 'ACTIVE' && { backgroundColor: '#34C759' }]}><Text style={[styles.tabText, { color: activeTab === 'ACTIVE' ? '#fff' : theme.subtitle }]}>Aktywne</Text></Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('PENDING'); }} style={[styles.tab, activeTab === 'PENDING' && { backgroundColor: '#FF9F0A' }]}><Text style={[styles.tabText, { color: activeTab === 'PENDING' ? '#fff' : theme.subtitle }]}>Oczekujące</Text></Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ARCHIVED'); }} style={[styles.tab, activeTab === 'ARCHIVED' && { backgroundColor: '#FF3B30' }]}><Text style={[styles.tabText, { color: activeTab === 'ARCHIVED' ? '#fff' : theme.subtitle }]}>Zakończone</Text></Pressable>
          </View>
        )}

        {loading ? (
           <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
           selectedOffer ? renderManagementView() : <FlatList data={filteredOffers} extraData={activeTab} keyExtractor={item => String(item.id)} renderItem={renderMyOffer} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak ofert w tej sekcji.</Text>} />
        )}
      </View>
    </Modal>
  );
};

const ListGroup = ({ children, isDark }) => (
  <View style={[styles.listGroup, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>{children}</View>
);

const ListItem = ({ icon, color, title, subtitle, value, onPress, isLast, isDark, rightElement }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && onPress && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
    <View style={[styles.listIconBox, { backgroundColor: color }]}><Ionicons name={icon} size={20} color="#FFF" /></View>
    <View style={[styles.listContent, !isLast && { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
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

function AnimatedSegmentedControl({ themeMode, setThemeMode, isDark }) {
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

const AdminUserProfileModal = ({ visible, userId, onClose, theme }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchUserDetails = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/users/${userId}`);
      const data = await res.json();
      if (data.success) setUserData(data.user);
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się pobrać danych użytkownika.");
    }
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchUserDetails(); }, [visible, userId]);

  const changeOfferStatus = async (offerId, newStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, newStatus })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUserDetails(); 
      }
    } catch (e) { Alert.alert("Błąd", "Zmiana statusu nie powiodła się."); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Brak danych';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const renderOffer = ({ item }) => (
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
            <View style={[styles.headerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', marginBottom: 20 }]}>
              <View style={styles.avatarWrapper}>
                {userData.image ? <Image source={{ uri: userData.image }} style={styles.avatarImage} /> : <Ionicons name="person" size={36} color="#fff" />}
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{userData.name || 'Brak imienia'}</Text>
                <Text style={styles.headerRole}>{userData.role}</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Szczegóły konta</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="mail" color="#007AFF" title="Adres e-mail" value={userData.email} isDark={isDark} />
              <ListItem icon="call" color="#34C759" title="Telefon" value={userData.phone || 'Brak'} isDark={isDark} />
              <ListItem icon="calendar" color="#FF9F0A" title="Dołączył(a)" value={formatDate(userData.createdAt)} isLast={true} isDark={isDark} />
            </ListGroup>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Ogłoszenia ({userData.offers?.length || 0})</Text>
            {userData.offers && userData.offers.length > 0 ? (
              userData.offers.map((offer) => <React.Fragment key={offer.id}>{renderOffer({ item: offer })}</React.Fragment>)
            ) : (
              <Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 20 }}>Ten użytkownik nie posiada jeszcze ofert.</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const AdminOffersModal = ({ visible, onClose, theme }) => {
  const [activeTab, setActiveTab] = useState('PENDING');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers?status=${activeTab}`);
      const data = await res.json();
      if (data.success) setOffers(data.offers);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchOffers(); }, [visible, activeTab]);

  const changeStatus = async (offerId, newStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, newStatus })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchOffers();
      }
    } catch (e) { Alert.alert("Błąd", "Nie udało się zmienić statusu"); }
  };

  const renderOffer = ({ item }) => (
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

const AdminUsersModal = ({ visible, onClose, onOpenUser, theme }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const limit = 25;
  const [hasMore, setHasMore] = useState(true);

  const sortUsers = (arr) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const normalize = (v) => String(v || '').toLowerCase();
    const asTime = (v) => {
      const t = new Date(v || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const asNum = (v) => {
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
      // createdAt (default)
      const av = asTime(a?.createdAt);
      const bv = asTime(b?.createdAt);
      return (av - bv) * dir;
    });
  };

  const fetchUsers = async (mode = 'reset') => {
    setLoading(true);
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
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextUsers = Array.isArray(data.users) ? data.users : [];
        const nextPage = data?.pagination?.page || 1;
        const totalPages = data?.pagination?.totalPages || 1;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (mode === 'append') {
          setUsers(prev => sortUsers([...prev, ...nextUsers]));
        } else {
          setUsers(sortUsers(nextUsers));
        }
        setPage(nextPage + 1);
        setHasMore(nextPage < totalPages);
      }
    } catch (e) { }
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    setPage(1);
    setHasMore(true);
    fetchUsers('reset');
  }, [visible, sortBy, sortDir]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchUsers('reset');
    }, 250);
    return () => clearTimeout(t);
  }, [search, visible]);

  const deleteUser = (userId, email) => {
    Alert.alert("Usuń użytkownika", `Czy na pewno chcesz permanentnie usunąć ${email}?`, [
        { text: "Anuluj", style: "cancel" },
        { text: "Usuń", style: "destructive", onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res = await fetch(`${API_URL}/api/mobile/v1/admin/users`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId })
              });
              if (res.ok) fetchUsers();
            } catch (e) {}
        }}
    ]);
  };

  const renderUser = ({ item }) => (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onOpenUser(item.id); }}
      style={({ pressed }) => [
        styles.userCard,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#FFF',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          transform: [{ scale: pressed ? 0.99 : 1 }],
          opacity: pressed ? 0.95 : 1,
        }
      ]}
    >
      <View style={styles.userRowTop}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatarPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>
              {(item?.name || item?.email || '?').trim().slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.userMain}>
          <View style={styles.userTitleRow}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {item.name || 'Użytkownik'}
            </Text>
            <View style={styles.badgeRow}>
              {item.role === 'ADMIN' && <View style={[styles.badge, { backgroundColor: 'rgba(255,45,85,0.12)', borderColor: 'rgba(255,45,85,0.25)' }]}><Text style={[styles.badgeText, { color: '#FF2D55' }]}>ADMIN</Text></View>}
              {item.role === 'AGENT' && <View style={[styles.badge, { backgroundColor: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.25)' }]}><Text style={[styles.badgeText, { color: '#FF9F0A' }]}>AGENT</Text></View>}
              {item.isVerified && <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }]}><Text style={[styles.badgeText, { color: '#10b981' }]}>OK</Text></View>}
              <View style={[styles.badge, { backgroundColor: 'rgba(175,82,222,0.12)', borderColor: 'rgba(175,82,222,0.25)' }]}>
                <Text style={[styles.badgeText, { color: '#AF52DE' }]}>
                  {item.radarPreference?.pushNotifications ? `${item.radarPreference?.minMatchThreshold || 70}%` : 'RADAR OFF'}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.userRole} numberOfLines={1}>{item.phone || 'Brak telefonu'}</Text>
        </View>

        <Pressable
          onPress={(e) => { e.stopPropagation(); deleteUser(item.id, item.email); }}
          style={({ pressed }) => [styles.iconDangerBtn, pressed && { opacity: 0.8 }]}
          hitSlop={10}
        >
          <Ionicons name="trash" size={18} color="#FF3B30" />
        </Pressable>
      </View>

      <View style={styles.userStatsRow}>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: theme.text }]}>{item._count?.offers || 0}</Text>
          <Text style={styles.statLabel}>Ofert</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: theme.text }]}>{item.isVerified ? 'Tak' : 'Nie'}</Text>
          <Text style={styles.statLabel}>Weryfikacja</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statValue, { color: theme.text }]}>{item.role}</Text>
          <Text style={styles.statLabel}>Rola</Text>
        </View>
      </View>

      <View style={styles.userActionBar}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenUser(item.id); }}
          style={({ pressed }) => [styles.primaryActionBtn, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
        >
          <Ionicons name="eye" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>Otwórz profil</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          onPress={() => { Haptics.selectionAsync(); fetchUsers('reset'); }}
          style={({ pressed }) => [styles.secondaryActionBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="refresh" size={18} color={isDark ? '#fff' : '#1d1d1f'} />
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Użytkownicy</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="search" size={18} color="#8E8E93" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Szukaj: email, imię, telefon…"
                placeholderTextColor="#8E8E93"
                style={{ flex: 1, marginLeft: 10, color: theme.text, fontWeight: '600' }}
              />
            </View>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setSortDir(d => (d === 'desc' ? 'asc' : 'desc')); }}
              style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name={sortDir === 'desc' ? 'arrow-down' : 'arrow-up'} size={20} color="#007AFF" />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 10, gap: 8 }}>
            {[
              { id: 'createdAt', label: 'Najnowsi' },
              { id: 'offersCount', label: 'Najwięcej ofert' },
              { id: 'email', label: 'E-mail A→Z' },
              { id: 'name', label: 'Imię A→Z' },
            ].map((opt) => {
              const active = sortBy === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => { Haptics.selectionAsync(); setSortBy(opt.id); setSortDir(opt.id === 'offersCount' ? 'desc' : sortDir); }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: active ? 'rgba(0,122,255,0.12)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    borderWidth: 1,
                    borderColor: active ? 'rgba(0,122,255,0.35)' : 'transparent'
                  }}
                >
                  <Text style={{ color: active ? '#007AFF' : theme.subtitle, fontWeight: '800', fontSize: 12 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading && users.length === 0 ? (
          <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item.id.toString()}
            renderItem={renderUser}
            contentContainerStyle={{ padding: 20, paddingTop: 10 }}
            ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak użytkowników.</Text>}
            onEndReached={() => { if (!loading && hasMore) fetchUsers('append'); }}
            onEndReachedThreshold={0.6}
            ListFooterComponent={loading && users.length > 0 ? <ActivityIndicator style={{ paddingVertical: 20 }} /> : <View style={{ height: 20 }} />}
          />
        )}
      </View>
    </Modal>
  );
};

const AdminRadarAnalyticsModal = ({ visible, onClose, theme }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';
  const { width } = Dimensions.get('window');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/radar-analytics`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const json = await res.json();
      if (res.ok && json.success) setData(json.radar);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { if (visible) fetchAnalytics(); }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Analityka Radaru</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {loading || !data ? (
          <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: 'Aktywne radary push', value: data?.kpis?.pushActive ?? 0, color: '#AF52DE' },
                { label: 'Preferencje', value: data?.kpis?.preferencesTotal ?? 0, color: '#007AFF' },
                { label: 'Notyfikacje', value: data?.kpis?.notificationsTotal ?? 0, color: '#FF2D55' },
                { label: 'Błędy', value: data?.kpis?.notificationsFailed ?? 0, color: '#FF3B30' },
              ].map((k, idx) => (
                <View key={idx} style={{ width: (width - 16 * 2 - 12) / 2, padding: 14, borderRadius: 18, backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ color: theme.subtitle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{k.label}</Text>
                  <Text style={{ color: k.color, fontSize: 26, fontWeight: '900', marginTop: 6 }}>{k.value}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Rozkład progów dopasowania</Text>
            <View style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              {[
                { label: '100% (ultra strict)', value: data?.thresholdBands?.strict100 ?? 0 },
                { label: '85–99%', value: data?.thresholdBands?.high85_99 ?? 0 },
                { label: '70–84%', value: data?.thresholdBands?.medium70_84 ?? 0 },
                { label: '50–69%', value: data?.thresholdBands?.broad50_69 ?? 0 },
              ].map((row, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: idx === 3 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ color: theme.subtitle, fontWeight: '700' }}>{row.label}</Text>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{row.value}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Top miasta</Text>
            <View style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              {(data?.cityDistribution || []).map((row, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: idx === (data.cityDistribution.length - 1) ? 0 : StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{row.city}</Text>
                  <Text style={{ color: theme.subtitle, fontWeight: '900' }}>{row.count}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const AdminDealroomCheckModal = ({ visible, onClose, theme }) => {
  const navigation = useNavigation();
  const { token, user } = useAuthStore();
  const isDark = theme.glass === 'dark';
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState([]);

  const parseMaybeNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const extractOfferId = (deal) => {
    const direct = parseMaybeNumber(deal?.offerId ?? deal?.offer?.id ?? deal?.propertyId ?? deal?.listingId);
    if (direct) return direct;
    const fromTitle = String(deal?.title || '').match(/#(\d{1,12})/);
    if (fromTitle?.[1]) return parseMaybeNumber(fromTitle[1]);
    return null;
  };

  const extractParticipantsLabel = (deal) => {
    const names = new Set<string>();
    const ids = new Set<string>();
    const ownId = parseMaybeNumber(user?.id);

    const addName = (v) => {
      const s = String(v ?? '').trim();
      if (s && !/^unknown$/i.test(s) && !/^null$/i.test(s) && !/^undefined$/i.test(s)) {
        names.add(s);
      }
    };
    const addId = (v) => {
      const n = parseMaybeNumber(v);
      if (n && n !== ownId) ids.add(`#${n}`);
    };

    addName(deal?.otherParty?.name);
    addName(deal?.counterparty?.name);
    addName(deal?.otherUserName);
    addName(deal?.buyer?.fullName);
    addName(deal?.seller?.fullName);
    addId(deal?.buyerId);
    addId(deal?.sellerId);
    addId(deal?.otherUserId);
    addId(deal?.counterpartyId);
    addId(deal?.partnerId);

    const participants = Array.isArray(deal?.participants) ? deal.participants : [];
    for (const p of participants) {
      addName(p?.fullName ?? p?.name ?? p?.displayName);
      addId(p?.id ?? p?.userId);
    }

    const namesList = Array.from(names).slice(0, 4);
    const idsList = Array.from(ids).slice(0, 3);
    if (namesList.length > 0) return namesList.join(' • ');
    if (idsList.length > 0) return idsList.join(' • ');
    return 'Brak danych uczestników';
  };

  const fetchDeals = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/deals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.deals) ? data.deals : Array.isArray(data) ? data : [];
      const sorted = [...list].sort((a: any, b: any) => {
        const ta = new Date(a?.updatedAt || a?.createdAt || a?.time || 0).getTime();
        const tb = new Date(b?.updatedAt || b?.createdAt || b?.time || 0).getTime();
        return tb - ta;
      });
      setDeals(sorted);
    } catch (_e) {
      Alert.alert('Błąd', 'Nie udało się pobrać listy dealroomów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchDeals();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Dealroom Check</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close-circle" size={32} color={theme.subtitle} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#34C759" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            <Text style={[styles.sectionFooter, { marginTop: 0, marginBottom: 10 }]}>
              Lista wszystkich dealroomów i stron uczestniczących. Kliknij numer, aby otworzyć podgląd.
            </Text>

            {deals.length === 0 ? (
              <Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 30 }}>Brak dealroomów.</Text>
            ) : (
              deals.map((deal: any, idx: number) => {
                const offerId = extractOfferId(deal);
                const participantsLabel = extractParticipantsLabel(deal);
                const dealId = parseMaybeNumber(deal?.id);
                return (
                  <View
                    key={`${deal?.id || idx}`}
                    style={[
                      styles.userCard,
                      {
                        backgroundColor: isDark ? '#1C1C1E' : '#FFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        paddingVertical: 12,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        if (!dealId) return;
                        Haptics.selectionAsync();
                        onClose();
                        setTimeout(() => {
                          navigation.navigate('DealroomChat', {
                            dealId,
                            offerId: offerId ?? undefined,
                            title: deal?.title || `Transakcja #${dealId}`,
                          });
                        }, 140);
                      }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
                    >
                      <Text style={{ color: '#007AFF', fontWeight: '900', fontSize: 15 }}>
                        #{dealId || '?'}
                      </Text>
                    </Pressable>
                    <Text style={{ color: theme.text, fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                      Strony: {participantsLabel}
                    </Text>
                    <Text style={{ color: theme.subtitle, fontSize: 10, marginTop: 3 }}>
                      {deal?.status ? `Status: ${deal.status}` : 'Status: -'}
                      {offerId ? ` • Oferta #${offerId}` : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default function ProfileScreen({ theme }) {
  const navigation = useNavigation();
  const { user, logout, updateAvatar, token } = useAuthStore();
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);
  const isDark = theme.glass === 'dark';
  
  const [isMyOffersVisible, setIsMyOffersVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isAdminOffersVisible, setIsAdminOffersVisible] = useState(false);
  const [isAdminUsersVisible, setIsAdminUsersVisible] = useState(false);
  const [isAdminRadarVisible, setIsAdminRadarVisible] = useState(false);
  const [isAdminDealroomCheckVisible, setIsAdminDealroomCheckVisible] = useState(false);
  const [adminSelectedUserId, setAdminSelectedUserId] = useState(null);
  const [isSmsEnabled, setIsSmsEnabled] = useState(true);
  const [isOwnPublicProfileOpen, setIsOwnPublicProfileOpen] = useState(false);
  const [ownPublicProfile, setOwnPublicProfile] = useState(null);
  const [ownPublicProfileLoading, setOwnPublicProfileLoading] = useState(false);
  const isZarzad = user?.role === 'ADMIN';

  // --- LOGIKA KLAWISZA PASSKEY (Z PAMIĘCIĄ LOCALSTORAGE) ---
  const [isPasskeyActive, setIsPasskeyActive] = useState(false);

  useEffect(() => {
    const checkServerPasskeyStatus = async () => {
      if (!user?.id) return;
      try {
        // 1. Szybki odczyt z pamięci (żeby uniknąć "mrugania" gałki przy wejściu)
        const saved = await AsyncStorage.getItem(`@passkey_${user.id}`);
        if (saved === 'active') setIsPasskeyActive(true);

        // 2. Twarda weryfikacja na serwerze - JEDYNE ŹRÓDŁO PRAWDY
        const res = await fetch(`${API_URL}/api/passkey/status?userId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.success !== undefined) {
          setIsPasskeyActive(data.hasPasskey);
          
          // Aktualizujemy lokalny cache, żeby był w 100% zsynchronizowany z bazą
          if (data.hasPasskey) {
            await AsyncStorage.setItem(`@passkey_${user.id}`, 'active');
          } else {
            await AsyncStorage.removeItem(`@passkey_${user.id}`);
          }
        }
      } catch (e) {
        console.log("Błąd weryfikacji statusu klucza:", e);
      }
    };
    
    checkServerPasskeyStatus();
  }, [user?.id]);

  const togglePasskey = async (value) => {
    if (value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      try {
        const success = await PasskeyService.register(token, String(user.id), user.email);
        if (success) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsPasskeyActive(true);
          await AsyncStorage.setItem(`@passkey_${user.id}`, 'active');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          // Użytkownik anulował - WYMUSZAMY cofnięcie gałki (React Native Hack)
          setIsPasskeyActive(true);
          setTimeout(() => setIsPasskeyActive(false), 50);
        }
      } catch (error) {
        // Błąd serwera / autoryzacji - WYMUSZAMY cofnięcie gałki
        setIsPasskeyActive(true);
        setTimeout(() => setIsPasskeyActive(false), 50);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Przerwano', error.message || 'Konfiguracja FaceID/TouchID nie powiodła się.');
      }
    } else {
      Alert.alert('Usuń klucz', 'Czy na pewno chcesz wyłączyć logowanie biometryczne dla tego urządzenia? Pamiętaj, że usunie to powiązanie tylko w aplikacji.', [
        { text: 'Anuluj', style: 'cancel', onPress: () => {
            setIsPasskeyActive(false);
            setTimeout(() => setIsPasskeyActive(true), 50);
        }},
        { 
          text: 'Wyłącz', 
          style: 'destructive', 
          onPress: async () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            // 1. Aktualizacja wizualna
            setIsPasskeyActive(false);
            // 2. Usunięcie z lokalnej pamięci
            await AsyncStorage.removeItem(`@passkey_${user.id}`);
            // 3. FIZYCZNE USUNIĘCIE KLUCZA Z SERWERA (Z BAZY DANYCH)
            await PasskeyService.revoke(token, String(user.id));
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]);
    }
  };

  useEffect(() => {
    if (isZarzad) {
      fetch('https://estateos.pl/api/admin/settings')
        .then(res => res.json())
        .then(data => setIsSmsEnabled(data.smsEnabled))
        .catch(() => {});
    }
  }, [user?.role]);

  const fetchOwnPublicProfile = async () => {
    if (!user?.id) return;
    setOwnPublicProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/public`);
      const data = await res.json();
      if (res.ok && !data?.error) {
        setOwnPublicProfile(data);
      }
    } catch (_e) {
      // noop
    } finally {
      setOwnPublicProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnPublicProfile();
  }, [user?.id]);

  const toggleSms = async (value) => {
    setIsSmsEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch('https://estateos.pl/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enable: value }) });
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się zsynchronizować ustawień.");
    }
  };

  if (!user) return <AuthScreen theme={theme} />;

  const handleAvatarPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0].uri) {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 500, height: 500 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
        const formData = new FormData();
        formData.append('userId', String(user.id));
        formData.append('file', { uri: manipResult.uri, name: `avatar_${user.id}.jpg`, type: 'image/jpeg' });

        const res = await fetch(`https://estateos.pl/api/mobile/v1/user/avatar`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
          if (updateAvatar) updateAvatar(`${API_URL}${data.url}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) { Alert.alert('Błąd', 'Problem z awatarem.'); }
    }
  };

  const handleLogout = () => {
    Alert.alert("Wyloguj się", "Czy na pewno chcesz wylogować się?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); logout(); } }
    ]);
  };

  const ownReviews = Array.isArray(ownPublicProfile?.reviews) ? ownPublicProfile.reviews : [];
  const ownAverageRating = ownReviews.length > 0
    ? ownReviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) / ownReviews.length
    : 0;

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.container, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        
        <View style={[styles.headerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
          <Pressable onPress={handleAvatarPick} style={({ pressed }) => [styles.avatarWrapper, { opacity: pressed ? 0.8 : 1 }]}>
            {(() => {
              const rawAvatar = user?.avatar || user?.image;
              const finalAvatar = rawAvatar ? (rawAvatar.startsWith('/') ? `https://estateos.pl${rawAvatar}` : rawAvatar) : null;
              return finalAvatar ? <Image source={{ uri: finalAvatar }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={36} color="#fff" /></View>;
            })()}
            <View style={styles.editBadge}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>EDIT</Text></View>
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{user?.firstName || user?.email} {user?.lastName || ''}</Text>
            <EliteStatusBadges subject={user} isDark={isDark} compact />
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setIsOwnPublicProfileOpen(true);
              }}
              style={({ pressed }) => [styles.profileRatingBtn, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.profileRatingStarsInline}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= Math.round(ownAverageRating) ? 'star' : 'star-outline'}
                    size={12}
                    color="#f59e0b"
                  />
                ))}
              </View>
              <Text style={styles.profileRatingMetaInline}>
                {ownPublicProfileLoading ? 'Ładowanie opinii...' : `${ownAverageRating.toFixed(1)} (${ownReviews.length} komentarzy)`}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#8E8E93" />
            </Pressable>
            <Text style={styles.headerRole}>{user?.role === 'ADMIN' ? 'Zarząd EstateOS™' : (user?.role === 'AGENT' ? 'Partner EstateOS™' : 'Osoba Prywatna')}</Text>
            <Text style={styles.headerId}>ID Użytkownika: {user?.id}</Text>
            <VerificationBadge isVerified={user?.isVerifiedPhone || user?.isVerified} isDark={isDark} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('SmsVerification'); }} />
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
            <ListItem icon="home" color="#007AFF" title="Zarządzaj ogłoszeniami" subtitle="Podgląd, edycja i podbijanie" onPress={() => setIsMyOffersVisible(true)} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Powiadomienia i Ustawienia</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="notifications" color="#FF2D55" title="Powiadomienia" subtitle="Ulubione, zmiany cen i alerty" onPress={() => setIsNotificationsVisible(true)} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        {/* --- SEKCJA BEZPIECZEŃSTWA PASSKEY --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bezpieczeństwo</Text>
          <View style={[styles.listGroup, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={[styles.listItem, { paddingVertical: 12 }]}>
              
              <View style={[styles.listIconBox, { backgroundColor: isPasskeyActive ? '#10b981' : (isDark ? '#3A3A3C' : '#E5E5EA') }]}>
                <Ionicons name="finger-print" size={20} color={isPasskeyActive ? '#FFF' : '#8E8E93'} />
              </View>
              
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}>Klucz Passkey</Text>
                <Text style={styles.listSubtitle}>{isPasskeyActive ? 'Aktywny (FaceID / TouchID)' : 'Logowanie biometryczne'}</Text>
              </View>
              
              <Switch 
                value={isPasskeyActive} 
                onValueChange={togglePasskey} 
                trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#10b981' }} 
              />
            </View>
          </View>
          
          <Text style={styles.sectionFooter}>
            {isPasskeyActive 
              ? 'Twój klucz sprzętowy zabezpiecza to urządzenie. Możesz logować się natychmiastowo.' 
              : 'Zabezpiecz to urządzenie i loguj się błyskawicznie używając FaceID lub TouchID.'}
          </Text>
        </View>

        {isZarzad && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Narzędzia Administratora</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="business" color="#5E5CE6" title="Baza Ofert" onPress={() => setIsAdminOffersVisible(true)} isDark={isDark} />
              <ListItem icon="people" color="#32ADE6" title="Użytkownicy" onPress={() => setIsAdminUsersVisible(true)} isDark={isDark} />
              <ListItem icon="stats-chart" color="#FF2D55" title="Analityka Radaru" onPress={() => setIsAdminRadarVisible(true)} isDark={isDark} />
              <ListItem icon="albums" color="#30B0C7" title="Dealroom Check" subtitle="Lista dealroomów i uczestników" onPress={() => setIsAdminDealroomCheckVisible(true)} isDark={isDark} />
              <ListItem icon="chatbubble-ellipses" color="#34C759" title="Bramka SMSPlanet" subtitle="Globalny przełącznik wysyłki" isLast={true} isDark={isDark} rightElement={<Switch value={isSmsEnabled} onValueChange={toggleSms} trackColor={{ false: '#767577', true: '#34C759' }} />} />
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
      <NotificationsSettingsModal visible={isNotificationsVisible} onClose={() => setIsNotificationsVisible(false)} theme={theme} />

      <AdminOffersModal visible={isAdminOffersVisible} onClose={() => setIsAdminOffersVisible(false)} theme={theme} />
      <AdminUsersModal visible={isAdminUsersVisible} onClose={() => setIsAdminUsersVisible(false)} onOpenUser={(id) => setAdminSelectedUserId(id)} theme={theme} />
      <AdminUserProfileModal visible={!!adminSelectedUserId} userId={adminSelectedUserId} onClose={() => setAdminSelectedUserId(null)} theme={theme} />
      <AdminRadarAnalyticsModal visible={isAdminRadarVisible} onClose={() => setIsAdminRadarVisible(false)} theme={theme} />
      <AdminDealroomCheckModal visible={isAdminDealroomCheckVisible} onClose={() => setIsAdminDealroomCheckVisible(false)} theme={theme} />

      <Modal visible={isOwnPublicProfileOpen} transparent animationType="fade" onRequestClose={() => setIsOwnPublicProfileOpen(false)}>
        <View style={styles.profileOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOwnPublicProfileOpen(false)} />
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderRow}>
              <Text style={styles.profileTitle}>Twój profil publiczny</Text>
              <Pressable onPress={() => setIsOwnPublicProfileOpen(false)} style={styles.profileCloseBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>

            {ownPublicProfileLoading ? (
              <View style={styles.profileLoaderWrap}>
                <ActivityIndicator color="#f59e0b" />
                <Text style={styles.profileMuted}>Ładowanie profilu...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.profileName}>{ownPublicProfile?.user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Użytkownik'}</Text>
                <EliteStatusBadges subject={ownPublicProfile?.user || user} isDark compact />
                <Text style={styles.profileMeta}>ID: {user?.id || '-'}</Text>
                <View style={styles.profileRatingBox}>
                  <Text style={styles.profileRatingValue}>{ownAverageRating.toFixed(1)}</Text>
                  <View style={styles.profileStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(ownAverageRating) ? 'star' : 'star-outline'}
                        size={14}
                        color="#f59e0b"
                      />
                    ))}
                  </View>
                  <Text style={styles.profileMuted}>{ownReviews.length} opinii</Text>
                </View>

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {ownReviews.length === 0 ? (
                    <Text style={styles.profileMuted}>Brak opinii dla tego użytkownika.</Text>
                  ) : ownReviews.slice(0, 12).map((r: any) => (
                    <View key={r.id} style={styles.reviewItem}>
                      <View style={styles.reviewTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewAuthorText}>{r?.reviewerName || `Użytkownik #${r?.reviewerId || '-'}`}</Text>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Ionicons
                                key={s}
                                name={s <= Number(r?.rating || 0) ? 'star' : 'star-outline'}
                                size={10}
                                color="#f59e0b"
                              />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('pl-PL')}</Text>
                      </View>
                      <Text style={styles.reviewText}>{r.comment || 'Bez komentarza.'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  profileRatingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, alignSelf: 'flex-start' },
  profileRatingStarsInline: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  profileRatingMetaInline: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  headerRole: { fontSize: 13, color: '#8E8E93', fontWeight: '500', marginBottom: 2 },
  headerId: { fontSize: 11, color: '#007AFF', fontWeight: '700', marginBottom: 6 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: '#8E8E93', textTransform: 'uppercase', marginLeft: 16, marginBottom: 8, letterSpacing: 0.3 },
  sectionFooter: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginTop: 8, marginRight: 16, lineHeight: 18 },
  listGroup: { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  listIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  listContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16 },
  listTitle: { fontSize: 17, fontWeight: '400', letterSpacing: -0.2 },
  listSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2, paddingRight: 10 },
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
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginHorizontal: 4 },
  tabText: { fontSize: 13, fontWeight: '700' },
  offerCard: { padding: 16, borderRadius: 20, marginBottom: 15, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  offerTitle: { fontSize: 17, fontWeight: '700', marginBottom: 5 },
  offerSubtitle: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },

  // --- ADMIN USERS (COMMAND CENTER) ---
  userCard: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  userRowTop: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 46, height: 46, borderRadius: 16 },
  userAvatarPlaceholder: { width: 46, height: 46, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  userMain: { flex: 1, marginLeft: 12 },
  userTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  userName: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2, flex: 1, paddingRight: 10 },
  userEmail: { fontSize: 12, color: '#8E8E93', fontWeight: '700', marginTop: 2 },
  userRole: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },

  iconDangerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  userStatsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.12)',
  },
  statValue: { fontSize: 13, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },

  userActionBar: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
  },
  primaryActionText: { color: '#fff', fontWeight: '900', letterSpacing: -0.2 },
  actionDivider: { width: StyleSheet.hairlineWidth, height: '100%', backgroundColor: 'rgba(255,255,255,0.25)' },
  secondaryActionBtn: { width: 56, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  
  ledContainer: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  ledCore: { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  ledGlow: { width: 14, height: 14, borderRadius: 7 },

  mgtModalContent: { height: Platform.OS === 'ios' ? height * 0.75 : height * 0.8, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 30 },
  mgtDragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginTop: 12, marginBottom: 15 },
  mgtImage: { width: 80, height: 80, borderRadius: 16, marginRight: 16 },
  mgtStatBox: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  mgtStatValue: { fontSize: 24, fontWeight: '800', marginTop: 8, marginBottom: 2 },
  mgtStatLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase' },
  mgtActionGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 20, padding: 8 },
  mgtActionBtn: { width: '50%', padding: 12, alignItems: 'center' },
  mgtIconBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  mgtActionText: { fontSize: 13, fontWeight: '600' },

  livingActionBtn: { 
    padding: 16, 
    borderRadius: 24, 
    alignItems: 'flex-start', 
    borderWidth: 1,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 12 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 18, 
    elevation: 8 
  },
  livingIconWrap: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5
  },
  livingActionText: { fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3 },
  livingActionSub: { fontSize: 11, color: '#8E8E93', fontWeight: '600', letterSpacing: 0.2 },

  profileOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 18 },
  profileCard: { backgroundColor: '#111827', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1f2937' },
  profileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  profileTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '800' },
  profileCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  profileLoaderWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  profileMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2, marginBottom: 12 },
  profileRatingBox: { alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
  profileRatingValue: { color: '#f3f4f6', fontSize: 28, fontWeight: '900', marginBottom: 2 },
  profileStarsRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  profileMuted: { color: '#9ca3af', fontSize: 12 },
  reviewItem: { borderWidth: 1, borderColor: '#1f2937', borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)' },
  reviewTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  reviewAuthorText: { color: '#e5e7eb', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { color: '#9ca3af', fontSize: 10, marginLeft: 8 },
  reviewText: { color: '#d1d5db', fontSize: 13, lineHeight: 18 },
});