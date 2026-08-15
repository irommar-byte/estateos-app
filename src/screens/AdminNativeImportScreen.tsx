import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NumericKeyboardAccessory from '../components/NumericKeyboardAccessory';
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { useI18n } from '../i18n';
import { useThemeStore } from '../store/useThemeStore';
import { hasActiveInvestorProMembership } from '../utils/investorProMembership';
import { requestInvestorProUpsell } from '../services/investorProUpsell';
import { useNavigation } from '@react-navigation/native';
import { getAdditionalListingSlots, hasAdditionalPlusPublication, userAfterPakietPlusPurchase } from '../utils/listingQuota';
import { purchasePakietPlusConsumable, PAKIET_PLUS_PRICE_LABEL } from '../services/iapPakietPlus';
import { gatherPublicationBonusCoupons } from '../services/publicationBonusCoupons';
import { readUserFirstFreePublicationUsed } from '../utils/userPublicationFlags';
import PublicationChoiceModal, { type PublicationChoiceConfirm } from '../components/publication/PublicationChoiceModal';
import type { CreatePublicationRedemption } from '../contracts/offerPublicationContract';

type ImportSource = 'OTODOM' | 'OLX' | 'NIERUCHOMOSCI_ONLINE';

type ImportDraft = {
  source: ImportSource;
  externalId: number;
  title: string;
  transactionType?: 'RENT' | 'SALE' | null;
  descriptionText?: string;
  imageCount: number;
  imageUrls: string[];
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  district?: string | null;
  adminFee?: number | null;
  features?: string[];
  locationWarnings?: string[];
};

type ImportPresentation = {
  title: string;
  descriptionHtml: string;
};

const IMPORT_DRAFT_STORAGE_KEY = 'nativeImport:portalDraft:v1';

function parsePositiveDecimal(raw: string): number | null {
  const n = Number(String(raw).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function collectImportGaps(d: ImportDraft): string[] {
  const gaps: string[] = [];
  if (d.lat == null || d.lng == null) gaps.push('pinezkę (GPS)');
  if (!d.price || d.price <= 0) gaps.push('cenę');
  if (!d.area || d.area <= 0) gaps.push('metraż');
  if (!String(d.city || d.district || '').trim()) gaps.push('miejscowość');
  return gaps;
}

function ImportSuccessCinematic({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const confetti = useRef(Array.from({ length: 26 }, () => new Animated.Value(0))).current;
  const fireworks = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(0.92);
    confetti.forEach((v) => v.setValue(0));
    fireworks.forEach((v) => v.setValue(0));

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.stagger(
        40,
        confetti.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: 1300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          })
        )
      ),
      Animated.stagger(
        180,
        fireworks.map((v) =>
          Animated.sequence([
            Animated.delay(180),
            Animated.timing(v, {
              toValue: 1,
              duration: 620,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ])
        )
      ),
    ]).start();
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [visible, confetti, fireworks, opacity, scale, onDone]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <Animated.View style={[styles.fxBackdrop, { opacity }]}>
        {fireworks.map((v, i) => {
          const scaleFx = v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] });
          const alpha = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
          return (
            <Animated.View
              key={`fx-${i}`}
              style={[
                styles.fxRing,
                {
                  left: `${18 + i * 20}%`,
                  top: i % 2 === 0 ? '18%' : '28%',
                  opacity: alpha,
                  transform: [{ scale: scaleFx }],
                },
              ]}
            />
          );
        })}
        {confetti.map((v, i) => {
          const x = (i % 2 === 0 ? -1 : 1) * (16 + (i % 7) * 12);
          const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-30, 560 + (i % 5) * 55] });
          const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${220 + i * 17}deg`] });
          const alpha = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] });
          return (
            <Animated.View
              key={`confetti-${i}`}
              style={[
                styles.fxConfetti,
                {
                  left: `${8 + (i % 10) * 9}%`,
                  backgroundColor: ['#10B981', '#0A84FF', '#FFCC00', '#AF52DE', '#FF3B30'][i % 5],
                  opacity: alpha,
                  transform: [{ translateX: x }, { translateY }, { rotate }],
                },
              ]}
            />
          );
        })}
        <Animated.View style={[styles.fxCard, { transform: [{ scale }] }]}>
          <Ionicons name="sparkles" size={34} color="#FFD60A" />
          <Text style={styles.fxTitle}>Oferta utworzona</Text>
          <Text style={styles.fxSubtitle}>Cinematic success</Text>
          <Pressable style={styles.fxButton} onPress={onDone}>
            <Text style={styles.fxButtonText}>Super</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    <NumericKeyboardAccessory />
    </Modal>
  );
}

export default function AdminNativeImportScreen() {
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const theme = useMemo(
    () =>
      isDark
        ? { bg: '#000000', card: '#1C1C1E', border: 'rgba(255,255,255,0.08)', text: '#F5F5F7', sub: '#8E8E93' }
        : { bg: '#F2F2F7', card: '#FFFFFF', border: 'rgba(0,0,0,0.06)', text: '#111111', sub: '#6B7280' },
    [isDark]
  );

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [presentation, setPresentation] = useState<ImportPresentation | null>(null);
  const [createdOfferId, setCreatedOfferId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [publicationChoiceVisible, setPublicationChoiceVisible] = useState(false);
  const [publicationChoiceCoupons, setPublicationChoiceCoupons] = useState<
    Awaited<ReturnType<typeof gatherPublicationBonusCoupons>>['coupons']
  >([]);
  const [publicationChoicePlusSlots, setPublicationChoicePlusSlots] = useState(0);
  const [publicationChoiceHasPlus, setPublicationChoiceHasPlus] = useState(false);
  const [pendingRedemption, setPendingRedemption] = useState<CreatePublicationRedemption | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [restoredDraftBadge, setRestoredDraftBadge] = useState(false);
  const [successFxVisible, setSuccessFxVisible] = useState(false);

  const asMoney = (raw?: number | null) => (raw == null ? '—' : `${Number(raw).toLocaleString('pl-PL')} zł`);
  const asArea = (raw?: number | null) => (raw == null ? '—' : `${raw} m²`);
  const asTransactionType = (raw?: 'RENT' | 'SALE' | null) =>
    raw === 'RENT' ? 'Wynajem' : raw === 'SALE' ? 'Sprzedaż' : '—';
  const hasMap = Number.isFinite(Number(draft?.lat)) && Number.isFinite(Number(draft?.lng));

  const stripHtml = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const descriptionFull = useMemo(() => {
    if (presentation?.descriptionHtml) return stripHtml(String(presentation.descriptionHtml));
    return String(draft?.descriptionText || '').trim();
  }, [presentation?.descriptionHtml, draft?.descriptionText]);

  const locationPrecision = useMemo(() => {
    const warnings = Array.isArray(draft?.locationWarnings) ? draft?.locationWarnings : [];
    const joined = warnings.join(' ').toLowerCase();
    if (/przybliżon|obszar|approx/.test(joined)) return 'Obszarowa';
    return hasMap ? 'Dokładna' : 'Brak współrzędnych';
  }, [draft?.locationWarnings, hasMap]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(IMPORT_DRAFT_STORAGE_KEY);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw) as {
          url?: string;
          draft?: ImportDraft | null;
          presentation?: ImportPresentation | null;
        };
        if (typeof parsed?.url === 'string') setUrl(parsed.url);
        if (parsed?.draft) setDraft(parsed.draft);
        if (parsed?.presentation) setPresentation(parsed.presentation);
        if (parsed?.draft || parsed?.presentation || parsed?.url) {
          setRestoredDraftBadge(true);
        }
      } catch {
        // ignore invalid cache
      } finally {
        if (mounted) setStorageReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const payload = JSON.stringify({ url, draft, presentation });
    void AsyncStorage.setItem(IMPORT_DRAFT_STORAGE_KEY, payload);
  }, [storageReady, url, draft, presentation]);

  const clearImportDraftCache = useCallback(async () => {
    await AsyncStorage.removeItem(IMPORT_DRAFT_STORAGE_KEY);
  }, []);

  const handleAnalyze = async () => {
    if (!token) {
      Alert.alert(t('common.error'), 'Brak sesji. Zaloguj się ponownie.');
      return;
    }
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      Alert.alert(t('common.error'), 'Wklej link do oferty.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    setDraft(null);
    setPresentation(null);
    setRestoredDraftBadge(false);
    setPendingRedemption(null);
    setCreatedOfferId(null);
    setEditUrl('');
    setPublicUrl('');
    try {
      let res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: cleanUrl }),
      });
      if (res.status === 404) {
        // Backward compatibility: older API namespace
        res = await fetch(`${API_URL}/api/mobile/v1/admin/otodom-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: cleanUrl }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(String(data?.message || data?.error || `Błąd importu (${res.status})`));
        return;
      }
      setDraft((data.draft || null) as ImportDraft | null);
      setPresentation((data.presentation || null) as ImportPresentation | null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  const applyCreatedOffer = async (
    data: Record<string, unknown>,
    redemption: CreatePublicationRedemption,
  ) => {
    setMessage(String(data?.message || 'Oferta utworzona.'));
    setCreatedOfferId(Number(data?.offerId || 0) || null);
    setEditUrl(String(data?.editUrl || ''));
    setPublicUrl(String(data?.publicUrl || ''));
    setPendingRedemption(redemption);
    if (redemption.source === 'bonus_coupon' && user?.id) {
      setPublicationChoiceCoupons((prev) =>
        prev.filter((coupon) => coupon.id !== redemption.couponId),
      );
      const { markProfilePromoCouponUsed } = await import('../services/profilePromoService');
      await markProfilePromoCouponUsed(user.id, redemption.couponId, token!);
    }
    const wallet = data?.wallet as { extraListings?: number; plusExpiresAt?: string | null } | undefined;
    if (wallet && user) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.setState({
          user: {
            ...currentUser,
            extraListings: Number(wallet.extraListings ?? currentUser.extraListings ?? 0),
            ...(wallet.plusExpiresAt ? { plusExpiresAt: wallet.plusExpiresAt } : {}),
          },
        });
      }
    }
    await clearImportDraftCache();
    setRestoredDraftBadge(false);
    await refreshUser();
    setSuccessFxVisible(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const tryRecoverImportedOffer = async (
    redemption: CreatePublicationRedemption,
  ): Promise<Record<string, unknown> | null> => {
    if (!token || !draft) return null;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import/existing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.found || !data?.offerId) return null;
      return {
        success: true,
        offerId: data.offerId,
        message:
          data.publicationReserved === true
            ? `Oferta #${data.offerId} została utworzona (import zakończony po stronie serwera).`
            : String(data.message || `Oferta #${data.offerId} już istnieje.`),
        editUrl: data.editUrl,
        publicUrl: data.publicUrl,
        publicationReserved: data.publicationReserved === true,
        redemption,
      };
    } catch {
      return null;
    }
  };

  const runCreate = async (redemption: CreatePublicationRedemption) => {
    if (!token || !draft) return;
    Alert.alert('Utworzyć ofertę?', 'Utworzę ofertę PENDING na podstawie zaimportowanych danych.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Utwórz',
        style: 'default',
        onPress: async () => {
          setCreating(true);
          setError('');
          setMessage('');
          try {
            const res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ draft, rightsConfirmed: true, redemption }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
              if (data?.code === 'ALREADY_IMPORTED' && data?.existingOfferId) {
                await applyCreatedOffer(
                  {
                    success: true,
                    offerId: data.existingOfferId,
                    message: String(data?.message || `Oferta #${data.existingOfferId} już istnieje.`),
                    editUrl: data.editUrl,
                    publicUrl: data.publicUrl,
                    publicationReserved: true,
                    redemption,
                  },
                  redemption,
                );
                return;
              }

              const shouldRecover = res.status === 504 || res.status === 502 || res.status === 408;
              if (shouldRecover) {
                const recovered = await tryRecoverImportedOffer(redemption);
                if (recovered?.publicationReserved === true) {
                  await applyCreatedOffer(recovered, redemption);
                  return;
                }
              }

              const errMessage = String(data?.message || data?.error || `Błąd tworzenia oferty (${res.status})`);
              setError(errMessage);
              if (data?.code === 'NEEDS_USER_INPUT' && Array.isArray(data?.issues)) {
                Alert.alert(
                  'Uzupełnij dane',
                  data.issues.map((i: { message?: string }) => i.message).filter(Boolean).join('\n') ||
                    errMessage,
                );
              } else {
                Alert.alert('Nie udało się utworzyć oferty', errMessage);
              }
              return;
            }
            if (!data?.redemption || data?.publicationReserved !== true) {
              const recovered = await tryRecoverImportedOffer(redemption);
              if (recovered?.publicationReserved === true) {
                await applyCreatedOffer(recovered, redemption);
                return;
              }
              const errMessage =
                'Serwer nie potwierdził opłacenia publikacji. Kredyt nie został pobrany — spróbuj ponownie po aktualizacji aplikacji.';
              setError(errMessage);
              Alert.alert('Publikacja nieopłacona', errMessage);
              return;
            }
            await applyCreatedOffer(data as Record<string, unknown>, redemption);
          } catch {
            const recovered = await tryRecoverImportedOffer(redemption);
            if (recovered?.publicationReserved === true) {
              await applyCreatedOffer(recovered, redemption);
              return;
            }
            setError('Błąd połączenia podczas tworzenia oferty.');
            Alert.alert('Błąd połączenia', 'Nie udało się utworzyć oferty. Sprawdź internet i spróbuj ponownie.');
          } finally {
            setCreating(false);
          }
        },
      },
    ]);
  };

  const openPublicationChoice = async () => {
    if (!token || !user?.id) return;
    await refreshUser();
    const latestUser = useAuthStore.getState().user;
    const gathered = await gatherPublicationBonusCoupons({
      apiUrl: API_URL,
      token,
      userId: user.id,
      email: latestUser?.email,
      firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
      t,
    });
    setPublicationChoiceCoupons(gathered.coupons);
    setPublicationChoicePlusSlots(getAdditionalListingSlots(latestUser));
    setPublicationChoiceHasPlus(hasAdditionalPlusPublication(latestUser));
    setPublicationChoiceVisible(true);
  };

  const runPakietPlusPurchaseAndCreate = async () => {
    if (!token || !draft) return;
    const purchase = await purchasePakietPlusConsumable(API_URL, token);
    if (!purchase.ok) {
      if (!purchase.cancelled && purchase.message) {
        Alert.alert(t('common.error'), purchase.message);
      }
      return;
    }
    await refreshUser();
    const patched = userAfterPakietPlusPurchase(useAuthStore.getState().user, {
      backendRegistered: Boolean(purchase.backendRegistered),
      extraListings: purchase.extraListings,
    });
    const currentUser = useAuthStore.getState().user;
    if (patched && currentUser) {
      useAuthStore.setState({ user: { ...currentUser, ...patched } });
    }
    const tx = String(purchase.transactionId || '').trim();
    if (!tx) {
      Alert.alert(
        'Brak transakcji IAP',
        'Zakup nie zwrócił ID transakcji. Otwórz ponownie okno publikacji i spróbuj jeszcze raz.'
      );
      return;
    }
    void runCreate({ source: 'plus_iap', transactionId: tx });
  };

  const handlePublicationChoice = (result: PublicationChoiceConfirm) => {
    setPublicationChoiceVisible(false);
    if (result.action === 'cancel') return;
    if (result.action === 'buy_plus') {
      void runPakietPlusPurchaseAndCreate();
      return;
    }
    void runCreate(result.redemption);
  };

  const handleCreatePress = () => {
    if (!token || !draft || creating) return;
    const gaps = collectImportGaps(draft);
    if (gaps.length) {
      Alert.alert(
        'Uzupełnij brakujące dane',
        `W sekcji „Doprecyzuj dane” uzupełnij: ${gaps.join(', ')}.`,
      );
      return;
    }
    void openPublicationChoice();
  };

  const patchDraft = (patch: Partial<ImportDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const openOfferPreviewNative = async (offerId: number) => {
    if (!token || !Number.isFinite(offerId) || offerId <= 0) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const offer = data?.offer;
      if (offer) {
        navigation.navigate('OfferDetail', { offer });
        return;
      }
      navigation.navigate('OfferDetail', { id: offerId });
    } catch {
      navigation.navigate('OfferDetail', { id: offerId });
    }
  };

  if (!hasActiveInvestorProMembership(user)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="diamond-outline" size={36} color="#F59E0B" />
        <Text style={[styles.noAccessTitle, { color: theme.text }]}>{t('profile.shop.investorProUpsell.import.title')}</Text>
        <Text style={[styles.noAccessBody, { color: theme.sub }]}>{t('profile.shop.investorProUpsell.import.body')}</Text>
        <Pressable
          style={styles.upsellBtn}
          onPress={() => requestInvestorProUpsell('import')}
        >
          <Text style={styles.upsellBtnText}>{t('profile.shop.investorProUpsell.cta')}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.upsellLaterBtn}>
          <Text style={[styles.upsellLaterText, { color: theme.sub }]}>{t('profile.shop.investorProUpsell.later')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: Math.max(insets.top + 10, 28) }}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F8F9FB' }]}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
          <Text style={[styles.backBtnText, { color: theme.text }]}>Wróć</Text>
        </Pressable>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIconWrap, { backgroundColor: isDark ? 'rgba(10,132,255,0.15)' : 'rgba(10,132,255,0.12)' }]}>
            <Ionicons name="sparkles" size={18} color="#0A84FF" />
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>PREMIUM IMPORT</Text>
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Import z portali</Text>
        {restoredDraftBadge ? (
          <View style={styles.restoreBadge}>
            <Ionicons name="refresh-circle" size={14} color="#10B981" />
            <Text style={styles.restoreBadgeText}>Przywrócono zapisany draft</Text>
          </View>
        ) : null}
        <Text style={[styles.heroSubtitle, { color: theme.sub }]}>
          Wklej link OtoDom, OLX lub Nieruchomosci-Online. System wykryje portal i przygotuje draft oferty.
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}
        />
        <Pressable onPress={handleAnalyze} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={16} color="#fff" />}
          <Text style={styles.primaryBtnText}>{loading ? 'Analizowanie…' : 'Analizuj link'}</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {draft ? (
        <>
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Podgląd draftu</Text>
            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="pricetag" size={16} color="#10B981" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{asMoney(draft.price)}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Cena</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="resize" size={16} color="#0A84FF" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{asArea(draft.area)}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Powierzchnia</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="home" size={16} color="#AF52DE" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{draft.rooms ?? '—'}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Pokoje</Text>
              </View>
            </View>

            <Text style={[styles.row, { color: theme.sub }]}>Źródło: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.source}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Transakcja: <Text style={[styles.rowStrong, { color: theme.text }]}>{asTransactionType(draft.transactionType)}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Tytuł: <Text style={[styles.rowStrong, { color: theme.text }]}>{presentation?.title || draft.title}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Lokalizacja: <Text style={[styles.rowStrong, { color: theme.text }]}>{[draft.district, draft.city].filter(Boolean).join(', ') || '—'}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Tryb lokalizacji: <Text style={[styles.rowStrong, { color: theme.text }]}>{locationPrecision}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Zdjęcia: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.imageCount}</Text></Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Doprecyzuj dane</Text>
            <Text style={[styles.row, { color: theme.sub, marginBottom: 10 }]}>
              Jeśli parser czegoś nie wyciągnął, uzupełnij tutaj przed utworzeniem oferty.
            </Text>
            <Text style={[styles.gapLabel, { color: theme.sub }]}>Metraż (m²) *</Text>
            <TextInput
              value={draft.area != null && draft.area > 0 ? String(draft.area) : ''}
              onChangeText={(v) => patchDraft({ area: parsePositiveDecimal(v) })}
              placeholder="np. 45"
              placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
              keyboardType="decimal-pad"
              style={[
                styles.gapInput,
                {
                  color: theme.text,
                  borderColor: !draft.area || draft.area <= 0 ? '#FF9500' : theme.border,
                  backgroundColor: isDark ? '#111114' : '#F9FAFB',
                },
              ]}
            />
            <Text style={[styles.gapLabel, { color: theme.sub }]}>Cena (PLN) *</Text>
            <TextInput
              value={draft.price != null && draft.price > 0 ? String(draft.price) : ''}
              onChangeText={(v) => patchDraft({ price: parsePositiveDecimal(v) })}
              placeholder="np. 2500"
              placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
              keyboardType="decimal-pad"
              style={[
                styles.gapInput,
                {
                  color: theme.text,
                  borderColor: !draft.price || draft.price <= 0 ? '#FF9500' : theme.border,
                  backgroundColor: isDark ? '#111114' : '#F9FAFB',
                },
              ]}
            />
            <Text style={[styles.gapLabel, { color: theme.sub }]}>Miejscowość</Text>
            <TextInput
              value={String(draft.city || '')}
              onChangeText={(v) => patchDraft({ city: v.trim() || null })}
              placeholder="Miasto / wieś"
              placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
              autoCapitalize="words"
              style={[
                styles.gapInput,
                {
                  color: theme.text,
                  borderColor: !String(draft.city || draft.district || '').trim() ? '#FF9500' : theme.border,
                  backgroundColor: isDark ? '#111114' : '#F9FAFB',
                },
              ]}
            />
            <Text style={[styles.gapLabel, { color: theme.sub }]}>Dzielnica / rejon</Text>
            <TextInput
              value={String(draft.district || '')}
              onChangeText={(v) => patchDraft({ district: v.trim() || null })}
              placeholder="Opcjonalnie"
              placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
              autoCapitalize="words"
              style={[
                styles.gapInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: isDark ? '#111114' : '#F9FAFB',
                },
              ]}
            />
            <Text style={[styles.gapLabel, { color: theme.sub }]}>Czynsz (PLN/mies.)</Text>
            <TextInput
              value={draft.adminFee != null && draft.adminFee > 0 ? String(draft.adminFee) : ''}
              onChangeText={(v) => patchDraft({ adminFee: parsePositiveDecimal(v) })}
              placeholder="Opcjonalnie"
              placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
              keyboardType="decimal-pad"
              style={[
                styles.gapInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: isDark ? '#111114' : '#F9FAFB',
                },
              ]}
            />
          </View>

          {!!draft.imageUrls?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Miniatury zdjęć</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
                {draft.imageUrls.slice(0, 16).map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    style={[styles.thumbItem, { borderColor: theme.border }]}
                    onPress={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  >
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[styles.lightboxHint, { color: theme.sub }]}>Dotknij miniatury, aby otworzyć pełny podgląd.</Text>
            </View>
          ) : null}

          {hasMap ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Mapa podglądu</Text>
              <View style={[styles.mapWrap, { borderColor: theme.border }]}>
                <MapView
                  style={styles.map}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: Number(draft?.lat),
                    longitude: Number(draft?.lng),
                    latitudeDelta: 0.018,
                    longitudeDelta: 0.018,
                  }}
                >
                  <Marker coordinate={{ latitude: Number(draft?.lat), longitude: Number(draft?.lng) }} />
                </MapView>
              </View>
            </View>
          ) : null}

          {descriptionFull ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pełny podgląd opisu</Text>
              <View style={[styles.descriptionCard, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Text style={[styles.descriptionText, { color: theme.text }]}>{descriptionFull}</Text>
              </View>
            </View>
          ) : null}

          {!!draft.locationWarnings?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Ostrzeżenia importu</Text>
              <View style={styles.chipsWrap}>
                {draft.locationWarnings.map((warning, idx) => (
                  <View key={`${warning}-${idx}`} style={styles.warningChip}>
                    <Text style={styles.warningChipText}>{warning}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!!draft.features?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Cechy oferty</Text>
              <View style={styles.chipsWrap}>
                {draft.features.map((feature, idx) => (
                  <View key={`${feature}-${idx}`} style={[styles.featureChip, { borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}>
                    <Text style={[styles.featureChipText, { color: theme.text }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Utworzenie oferty</Text>
            <Text style={[styles.row, { color: theme.sub, marginBottom: 8 }]}>
              Przed utworzeniem pojawi się okno publikacji jak przy dodawaniu nieruchomości.
            </Text>
            {pendingRedemption ? (
              <Text style={[styles.row, { color: '#10B981', marginBottom: 8 }]}>
                Ostatnio wybrane źródło: {pendingRedemption.source === 'bonus_coupon' ? 'Kupon' : pendingRedemption.source === 'plus_credit' ? 'Kredyt Plus' : 'Dokupienie Plus'}
              </Text>
            ) : null}
          <Pressable onPress={handleCreatePress} disabled={creating} style={[styles.successBtn, creating && styles.btnDisabled]}>
            {creating ? <ActivityIndicator color="#fff" /> : <Ionicons name="add-circle" size={16} color="#fff" />}
            <Text style={styles.primaryBtnText}>{creating ? 'Tworzenie…' : 'Utwórz ofertę'}</Text>
          </Pressable>

          {message ? <Text style={styles.successText}>{message}</Text> : null}

          {createdOfferId ? (
            <View style={styles.linksRow}>
              <Pressable
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (!createdOfferId) return;
                  navigation.navigate('EditOffer', { offerId: createdOfferId });
                }}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Edytuj #{createdOfferId}</Text>
              </Pressable>
              <Pressable
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (!createdOfferId) return;
                  void openOfferPreviewNative(createdOfferId);
                }}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Podgląd</Text>
              </Pressable>
              <Pressable
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (!createdOfferId) return;
                  navigation.navigate('OfferComments', { offerId: createdOfferId, offerTitle: presentation?.title || draft?.title || '' });
                }}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Komentarze</Text>
              </Pressable>
            </View>
          ) : null}
          </View>
        </>
      ) : null}

      <Modal visible={lightboxOpen} animationType="fade" transparent onRequestClose={() => setLightboxOpen(false)}>
        <View style={styles.lightboxBackdrop}>
          <View style={[styles.lightboxHeader, { paddingTop: Math.max(insets.top, 10) }]}>
            <Text style={styles.lightboxCounter}>
              {lightboxIndex + 1} / {draft?.imageUrls?.length || 0}
            </Text>
            <Pressable onPress={() => setLightboxOpen(false)} style={styles.lightboxClose}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: lightboxIndex * screenWidth, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const width = e.nativeEvent.layoutMeasurement.width || 1;
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setLightboxIndex(Math.max(0, idx));
            }}
          >
            {(draft?.imageUrls || []).map((uri, idx) => (
              <View key={`${uri}-full-${idx}`} style={[styles.lightboxSlide, { width: screenWidth }]}>
                <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      <NumericKeyboardAccessory />
    </Modal>
      <PublicationChoiceModal
        visible={publicationChoiceVisible}
        isDark={isDark}
        title={t('addOffer.step6.publicationChoice.title')}
        subtitle={t('addOffer.step6.publicationChoice.subtitle')}
        couponsSectionTitle={t('addOffer.step6.publicationChoice.couponsSection')}
        couponsEmptyHint={t('addOffer.step6.publicationChoice.couponsEmpty')}
        plusSectionTitle={t('addOffer.step6.publicationChoice.plusSection')}
        plusCreditLabel={t('addOffer.step6.publicationChoice.plusCreditTitle')}
        plusCreditSubtitle={t('addOffer.step6.publicationChoice.plusCreditSubtitle', {
          count: publicationChoicePlusSlots,
        })}
        buyPlusLabel={t('addOffer.step6.publicationChoice.buyPlusTitle')}
        buyPlusSubtitle={t('addOffer.step6.publicationChoice.buyPlusSubtitle', {
          price: PAKIET_PLUS_PRICE_LABEL,
        })}
        publishLabel={t('addOffer.step6.publicationChoice.publish')}
        cancelLabel={t('common.cancel')}
        couponPriorityHint={t('addOffer.step6.publicationChoice.couponPriorityHint')}
        coupons={publicationChoiceCoupons}
        plusSlots={publicationChoicePlusSlots}
        hasPlusCredit={publicationChoiceHasPlus}
        onConfirm={handlePublicationChoice}
        onClose={() => setPublicationChoiceVisible(false)}
      />
      <ImportSuccessCinematic visible={successFxVisible} onDone={() => setSuccessFxVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noAccessTitle: { marginTop: 10, fontSize: 20, fontWeight: '800' },
  noAccessBody: { marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  upsellBtn: {
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  upsellLaterBtn: { marginTop: 12, paddingVertical: 8 },
  upsellLaterText: { fontSize: 14, fontWeight: '600' },
  heroCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 10,
  },
  backBtnText: { fontSize: 13, fontWeight: '700' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(10,132,255,0.16)' },
  heroBadgeText: { color: '#0A84FF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  restoreBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  restoreBadgeText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  heroSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  input: { marginTop: 14, borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 15 },
  primaryBtn: { marginTop: 12, borderRadius: 12, minHeight: 46, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  successBtn: { marginTop: 14, borderRadius: 12, minHeight: 46, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errorText: { marginTop: 10, color: '#FF3B30', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  successText: { marginTop: 10, color: '#10B981', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiBox: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  kpiValue: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  row: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  rowStrong: { fontWeight: '700' },
  thumbStrip: { gap: 10, paddingRight: 6 },
  thumbItem: { width: 116, height: 84, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  lightboxHint: { marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  mapWrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', height: 220 },
  map: { width: '100%', height: '100%' },
  descriptionCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  descriptionText: { fontSize: 14, lineHeight: 21 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warningChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,149,0,0.14)', borderWidth: 1, borderColor: 'rgba(255,149,0,0.32)' },
  warningChipText: { color: '#FF9500', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  featureChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  featureChipText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  linksRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  linkBtn: { minWidth: '31%', flexGrow: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700' },
  gapLabel: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  gapInput: { borderWidth: 1, borderRadius: 10, minHeight: 42, paddingHorizontal: 12, fontSize: 15, marginBottom: 4 },
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  lightboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  lightboxCounter: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lightboxClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxSlide: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '84%' },
  fxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,8,20,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,216,10,0.9)',
  },
  fxConfetti: {
    position: 'absolute',
    width: 8,
    height: 16,
    borderRadius: 2,
    top: 70,
  },
  fxCard: {
    width: '82%',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(20,24,44,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fxTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  fxSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '600' },
  fxButton: {
    marginTop: 18,
    minHeight: 44,
    minWidth: 140,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  fxButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
