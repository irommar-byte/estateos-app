// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Platform, Image, Modal, FlatList, ActivityIndicator, Switch, Easing, Dimensions, LayoutAnimation, UIManager, TextInput, useWindowDimensions, AppState, Linking, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { PasskeyService } from '../services/passkeyService';
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { API_URL } from '../config/network';
import { ESTATEOS_CONTACT_EMAIL, mailtoEstateosSubject } from '../constants/appContact';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import UserRegionFlag from '../components/UserRegionFlag';
import ProfilePublicHeader from '../components/ProfilePublicHeader';
import ProfileReputationBlock from '../components/ProfileReputationBlock';
import { markPasskeyEnabledForUser, clearPasskeyLocalForUser } from '../utils/passkeyBootstrap';
import { getDeviceRegionCountry } from '../utils/phoneRegions';
import AuthScreen from './AuthScreen';
import { useThemeStore, ThemeMode } from '../store/useThemeStore';
import { VerificationBadge } from '../components/VerificationBadge';
import { BlurView } from 'expo-blur';
import { purchasePakietPlusConsumable, PAKIET_PLUS_PRICE_LABEL, restorePakietPlusPurchases } from '../services/iapPakietPlus';
import { purchaseInvestorProSubscription, syncInvestorProEntitlement, transferInvestorProToCurrentAccount } from '../services/iapInvestorPro';
import { IAPManager } from '../services/iapManager';
import { investorProPurchaseAlertCopy, investorProPurchaseErrorAlertCopy, investorProSubscriptionNeedsTransfer, isNoAppleInvestorProSubscriptionMessage, promptInvestorProReassignAndSubscribeAlert, promptInvestorProTransferAlert } from '../utils/investorProPurchaseFeedback';
import { fetchInvestorProStoreListing } from '../services/iapInvestorProListing';
import type { SubscriptionStoreListing } from '../services/iapManager';
import * as Notifications from 'expo-notifications';
import EliteStatusBadges from '../components/EliteStatusBadges';
import ProfileProExtrasSection from '../components/profile/ProfileProExtrasSection';
import { hasActiveInvestorProMembership, buildProMembershipCountdown, userAfterInvestorProPurchase } from '../utils/investorProMembership';
import DeleteAccountSheet from '../components/DeleteAccountSheet';
import EditNameSheet from '../components/profile/EditNameSheet';
import EditPhoneSheet from '../components/profile/EditPhoneSheet';
import EditEmailSheet from '../components/profile/EditEmailSheet';
import BlockedUsersModal from '../components/BlockedUsersModal';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import { useProfileTabBadgeStore } from '../store/useProfileTabBadgeStore';
import AdminLegalVerificationModal from '../components/AdminLegalVerificationModal';
import AdminContentReportsModal from '../components/AdminContentReportsModal';
import AdminCoreCommandCenterModal from '../components/admin/AdminCoreCommandCenterModal';
import AdminBuyerSearchSection from '../components/admin/AdminBuyerSearchSection';
import AdminPromoWindowsModal from '../components/admin/AdminPromoWindowsModal';
import AdminStatisticsModal from '../components/admin/AdminStatisticsModal';
import AdminUsersModal from '../components/admin/AdminUsersModal';
import ProfileShopSection from '../components/profile/ProfileShopSection';
import InvestorProTrialIntroHost from '../components/profile/InvestorProTrialIntroHost';
import ProfileCardShell from '../components/profile/ProfileCardShell';
import { fetchUserProfilePromoCards } from '../services/profilePromoService';
import {
  dismissProfilePromoCardForever,
  loadDismissedProfilePromoIds,
} from '../utils/profilePromoDismissStorage';
import { buildBonusCouponStack } from '../utils/buildBonusCouponStack';
import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import { resolveReviewerLabel } from '../utils/reviewerDisplay';
import {
  coalesceRadarPreferenceFromPayload,
  fetchAdminUserRadarPreference,
  hasMeaningfulRadarFields,
  mergeRadarPreferenceForAdminUser,
} from '../services/adminUserRadarService';
import { useDisplayCurrencyStore } from '../store/useDisplayCurrencyStore';
import DisplayCurrencySelector from '../components/DisplayCurrencySelector';
import LanguageSelector from '../components/LanguageSelector';
import { getDeviceAppLocale, useAppLocaleStore } from '../store/useAppLocaleStore';
import { fetchAdminLegalVerificationQueue } from '../services/legalVerificationService';
import { fetchAdminContentReports } from '../services/adminReportsService';
import { userAfterPakietPlusPurchase } from '../utils/listingQuota';
import {
  persistMobileOfferUpdate,
  readMobileOfferResponseBody,
  isExplicitMobileOfferSaveFailure,
  extractMobileOfferJson,
} from '../utils/mobileOfferUpdate';
import { formatOfferLocationLine } from '../constants/locationEcosystem';
import { useMoneyContext } from '../money/useMoneyContext';
import {
  activateOfferPublication,
  decideReactivationFromQuote,
  fetchPublicationQuote,
  getPublicationCopy,
  isPublicationRequiresPlusError,
} from '../services/offerPublicationService';
import { readUserFirstFreePublicationUsed } from '../utils/userPublicationFlags';
import PublicationChoiceModal, {
  type PublicationChoiceConfirm,
} from '../components/publication/PublicationChoiceModal';
import { gatherPublicationBonusCoupons } from '../services/publicationBonusCoupons';
import {
  markProfilePromoCouponUsed,
  patchPromoCardCouponUsed,
  subscribeProfilePromoCouponUsed,
} from '../services/profilePromoService';
import {
  getAdditionalListingSlots,
  hasAdditionalPlusPublication,
} from '../utils/listingQuota';
import type { CreatePublicationRedemption } from '../contracts/offerPublicationContract';
import { localeToDateFormat, useI18n } from '../i18n';

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

/** Delikatna pigułka „Synchronizacja” — iOS-style po reaktywacji oferty (status stabilizuje się z serwerem). */
const OfferStatusSyncPill = ({ isDark }: { isDark: boolean }) => {
  const { t } = useI18n();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    rotateLoop.start();
    pulseLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[
        styles.syncPill,
        {
          opacity: pulse,
          backgroundColor: isDark ? 'rgba(10,132,255,0.16)' : 'rgba(10,132,255,0.08)',
          borderColor: isDark ? 'rgba(10,132,255,0.32)' : 'rgba(10,132,255,0.2)',
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="sync" size={12} color="#0A84FF" />
      </Animated.View>
      <Text style={styles.syncPillText}>{t('profile.sync.label')}</Text>
    </Animated.View>
  );
};

const NotificationsSettingsModal = ({ visible, onClose, theme }) => {
  const { t } = useI18n();
  const isDark = theme.glass === 'dark';
  const [pushPermissionStatus, setPushPermissionStatus] = useState(null);

  // Uwaga: świadomie NIE renderujemy tu „pseudo-przełączników" typu
  // „Zmiany cen" / „Nowe propozycje". Wcześniej istniały, ale nie były
  // podpięte ani do AsyncStorage, ani do backendu, ani do filtrowania
  // pushy — wprowadzały użytkownika w błąd (placebo UI). Dopóki nie ma
  // realnego kontraktu z serwerem na preferencje powiadomień, modal
  // pokazuje wyłącznie systemowy status uprawnień, który JEST realnie
  // sprzężony z iOS/Android przez `expo-notifications`.

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

  const handleSystemPushAction = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'denied') {
      Alert.alert(
        t('profile.notifications.systemAlertTitle'),
        t('profile.notifications.systemAlertBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.notifications.settings'), onPress: () => void Linking.openSettings() },
        ]
      );
      return;
    }
    await Notifications.requestPermissionsAsync();
    await refreshPushPermission();
  };

  const handleSystemPushToggle = async (nextValue: boolean) => {
    if (nextValue) {
      await handleSystemPushAction();
      return;
    }
    Alert.alert(
      t('profile.notifications.systemAlertTitle'),
      t('profile.notifications.systemAlertBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.notifications.settings'), onPress: () => void Linking.openSettings() },
      ]
    );
  };

  const pushStatusLabel =
    pushPermissionStatus === 'granted'
      ? t('profile.notifications.enabled')
      : pushPermissionStatus === 'denied'
        ? t('profile.notifications.disabledSystem')
        : pushPermissionStatus === 'undetermined'
          ? t('profile.notifications.notSet')
          : '—';

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{t('profile.notifications.title')}</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>{t('profile.notifications.deviceSection')}</Text>
          <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }}>
            <View style={[styles.listItem, { paddingVertical: 14 }]}>
              <View style={[styles.listIconBox, { backgroundColor: pushPermissionStatus === 'granted' ? '#34C759' : '#FF9500' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}>{t('profile.notifications.systemStatus')}</Text>
                <Text style={styles.listSubtitle}>{pushStatusLabel}</Text>
              </View>
              <Switch
                value={pushPermissionStatus === 'granted'}
                onValueChange={(value) => void handleSystemPushToggle(value)}
                trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                ios_backgroundColor={isDark ? '#3A3A3C' : '#E5E5EA'}
              />
            </View>
          </ProfileCardShell>
          <Text style={styles.sectionFooter}>
            {t('profile.notifications.footer')}
          </Text>
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

const getAdminStatusMeta = (statusRaw) => {
  const status = normalizeOfferTabStatus(statusRaw);
  if (status === 'PENDING') return { label: 'Do weryfikacji', bg: 'rgba(255,159,10,0.16)', border: 'rgba(255,159,10,0.32)', text: '#FF9F0A' };
  if (status === 'ACTIVE') return { label: 'Aktywne', bg: 'rgba(52,199,89,0.16)', border: 'rgba(52,199,89,0.32)', text: '#34C759' };
  return { label: 'Zarchiwizowane', bg: 'rgba(142,142,147,0.18)', border: 'rgba(142,142,147,0.32)', text: '#8E8E93' };
};

const getOfferTransactionBadge = (offer: any): { label: 'SPRZEDAŻ' | 'WYNAJEM'; color: string } => {
  const raw = String(
    offer?.transactionType ??
      offer?.offerType ??
      offer?.listingType ??
      offer?.type ??
      ''
  )
    .trim()
    .toUpperCase();
  if (raw === 'RENT' || raw === 'WYNAJEM' || raw === 'NAJEM') return { label: 'WYNAJEM', color: '#0A84FF' };
  return { label: 'SPRZEDAŻ', color: '#10B981' };
};

const AdminActionButton = ({ icon, label, tint, fill, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.adminActionBtn,
      { backgroundColor: fill, borderColor: `${tint}55`, opacity: pressed ? 0.86 : 1 },
    ]}
  >
    <Ionicons name={icon} size={16} color={tint} />
    <Text style={[styles.adminActionBtnText, { color: tint }]}>{label}</Text>
  </Pressable>
);

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

const resolveUserAvatarUrl = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'object') {
    const asObj = value as any;
    const nested = asObj?.url ?? asObj?.src ?? asObj?.uri ?? asObj?.path ?? asObj?.image ?? asObj?.avatar;
    if (nested != null) return resolveUserAvatarUrl(nested);
  }
  const raw = String(value).trim();
  if (!raw || raw === '[object Object]') return null;
  return resolveOfferMediaUrl(raw);
};

const deepFindAvatarUrl = (input: any, depth = 0): string | null => {
  if (!input || depth > 4) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s) || s.startsWith('/uploads/') || s.startsWith('/api/')) {
      return resolveOfferMediaUrl(s);
    }
    return null;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = deepFindAvatarUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof input === 'object') {
    const blockedKeys = new Set(['offers']);
    const priorityKeys = [
      'avatar',
      'avatarUrl',
      'image',
      'imageUrl',
      'photo',
      'photoUrl',
      'profileImage',
      'profilePicture',
      'picture',
      'url',
      'uri',
      'src',
      'path',
      'thumbnail',
      'small',
      'medium',
      'large',
    ];
    for (const key of priorityKeys) {
      if (key in input) {
        const found = deepFindAvatarUrl((input as any)[key], depth + 1);
        if (found) return found;
      }
    }
    for (const [k, v] of Object.entries(input)) {
      if (blockedKeys.has(String(k))) continue;
      const found = deepFindAvatarUrl(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
};

const getBestUserAvatarUrl = (userLike: any): string | null => {
  const candidates = [
    userLike?.image,
    userLike?.avatar,
    userLike?.avatarUrl,
    userLike?.avatar_url,
    userLike?.avatarPath,
    userLike?.avatar_path,
    userLike?.photo,
    userLike?.photoUrl,
    userLike?.photo_url,
    userLike?.profileImage,
    userLike?.profileImageUrl,
    userLike?.profile_image,
    userLike?.profile_image_url,
    userLike?.profile_picture,
    userLike?.profilePicture,
    userLike?.picture,
    userLike?.pictureUrl,
    userLike?.picture_url,
    userLike?.img,
    userLike?.imgUrl,
    userLike?.img_url,
    userLike?.profile?.image,
    userLike?.profile?.avatar,
    userLike?.profile?.avatar_url,
    userLike?.profile?.profile_image,
    userLike?.userProfile?.image,
    userLike?.userProfile?.avatar,
    userLike?.userProfile?.avatar_url,
    userLike?.owner?.image,
    userLike?.owner?.avatar,
    userLike?.owner?.avatar_url,
    userLike?.user?.image,
    userLike?.user?.avatar,
    userLike?.user?.avatar_url,
  ];
  for (const c of candidates) {
    const uri = resolveUserAvatarUrl(c);
    if (uri) return uri;
  }
  return (
    deepFindAvatarUrl(userLike?.profile) ||
    deepFindAvatarUrl(userLike?.userProfile) ||
    deepFindAvatarUrl(userLike?.user) ||
    deepFindAvatarUrl(userLike?.owner) ||
    deepFindAvatarUrl({
      ...userLike,
      offers: undefined,
    })
  );
};

const MyOffersModal = ({ visible, onClose, theme }) => {
  const { t, locale } = useI18n();
  const publicationCopy = useMemo(() => getPublicationCopy(), [locale]);
  const navigation = useNavigation();
  const { formatOffer } = useMoneyContext();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [reactivating, setReactivating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const [reactivationChoiceVisible, setReactivationChoiceVisible] = useState(false);
  const [reactivationChoiceLoading, setReactivationChoiceLoading] = useState(false);
  const [reactivationChoiceCoupons, setReactivationChoiceCoupons] = useState([]);
  const [reactivationChoicePlusSlots, setReactivationChoicePlusSlots] = useState(0);
  const [reactivationChoiceHasPlus, setReactivationChoiceHasPlus] = useState(false);
  const pendingReactivationRef = useRef<{ offerId: number; offerTitle: string } | null>(null);
  const recentlyReactivatedUntilRef = useRef<Record<number, number>>({});
  
  const { user, token, refreshUser } = useAuthStore();
  const isDark = theme.glass === 'dark';

  const REACTIVATE_STATUS_LOCK_MS = 30000;

  const isOfferSyncing = (offerId: number) => {
    void syncTick;
    return Number(recentlyReactivatedUntilRef.current[offerId] || 0) > Date.now();
  };

  const clearReactivateLock = (offerId: number) => {
    if (!Number.isFinite(offerId) || offerId <= 0) return;
    delete recentlyReactivatedUntilRef.current[offerId];
  };

  const dismissReactivationChoice = () => {
    setReactivationChoiceVisible(false);
    setReactivationChoiceLoading(false);
    pendingReactivationRef.current = null;
  };

  const handleMyOffersClose = () => {
    dismissReactivationChoice();
    setSelectedOffer(null);
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      recentlyReactivatedUntilRef.current = {};
      dismissReactivationChoice();
      return;
    }
    const pulse = () => {
      const now = Date.now();
      Object.keys(recentlyReactivatedUntilRef.current).forEach((k) => {
        const id = Number(k);
        if ((recentlyReactivatedUntilRef.current[id] || 0) <= now) {
          delete recentlyReactivatedUntilRef.current[id];
        }
      });
      setSyncTick((n) => n + 1);
    };
    pulse();
    const id = setInterval(pulse, 1000);
    return () => clearInterval(id);
  }, [visible]);

  const fetchMyOffers = async () => {
    if (!user || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.offers) ? data.offers : [];
      if (res.ok) {
        const now = Date.now();
        const protectedList = list.map((o: any) => {
          const id = Number(o?.id);
          const lockUntil = Number(recentlyReactivatedUntilRef.current[id] || 0);
          if (!id || lockUntil <= now) return o;
          const normalized = normalizeOfferTabStatus(o?.status);
          if (normalized === 'ACTIVE') {
            clearReactivateLock(id);
            return o;
          }
          if (normalized === 'ARCHIVED') {
            return { ...o, status: 'ACTIVE' };
          }
          return o;
        });
        setOffers(protectedList);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { 
    if (visible) {
      fetchMyOffers(); 
      setSelectedOffer(null);
    }
  }, [visible]);

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

  const reactivateEndedOfferWithPakietPlus = async (
    offerId: number,
    offerTitle: string,
    opts?: {
      iapTransactionId?: string;
      redemption?: CreatePublicationRedemption | null;
    },
  ) => {
    if (!token || reactivating) return;
    setReactivating(true);
    try {
      const res = await activateOfferPublication(API_URL, token, offerId, {
        iapTransactionId: opts?.iapTransactionId,
        redemption: opts?.redemption ?? null,
      });
      if (!res.ok) {
        if (res.status === 422 && isPublicationRequiresPlusError(res.body)) {
          const latestUser = useAuthStore.getState().user ?? user;
          const gathered = await gatherPublicationBonusCoupons({
            apiUrl: API_URL,
            token,
            userId: user?.id,
            email: latestUser?.email,
            firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
            t,
          });
          pendingReactivationRef.current = { offerId, offerTitle };
          setReactivationChoiceCoupons(gathered.coupons);
          setReactivationChoicePlusSlots(getAdditionalListingSlots(latestUser));
          setReactivationChoiceHasPlus(hasAdditionalPlusPublication(latestUser));
          setReactivationChoiceVisible(true);
          return;
        }
        throw new Error(
          res.body?.message ||
            res.body?.error ||
            t('profile.myOffers.alerts.activationRejected', { status: res.status }),
        );
      }

      const endsAt =
        typeof res.body?.publication?.endsAt === 'string'
          ? res.body.publication.endsAt
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const serverOffer = extractMobileOfferJson(res.body);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      recentlyReactivatedUntilRef.current[offerId] = Date.now() + REACTIVATE_STATUS_LOCK_MS;
      setOffers((prev) =>
        prev.map((o) => {
          if (Number(o?.id) !== offerId) return o;
          const merged = serverOffer ? { ...o, ...serverOffer } : { ...o, status: 'ACTIVE' };
          return { ...merged, status: 'ACTIVE', expiresAt: endsAt };
        }),
      );
      if (opts?.redemption?.source === 'bonus_coupon' && user?.id) {
        await markProfilePromoCouponUsed(user.id, opts.redemption.couponId, token);
      }
      setSelectedOffer(null);
      setActiveTab('ACTIVE');
      await refreshUser?.();
      await fetchMyOffers();
      Alert.alert(
        t('profile.myOffers.alerts.onMarketTitle'),
        t('profile.myOffers.alerts.onMarketBody', { title: offerTitle }),
      );
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('profile.myOffers.alerts.publishFailedTitle'),
        e?.message || t('profile.myOffers.alerts.publishFailedBody'),
      );
    } finally {
      setReactivating(false);
    }
  };

  const openReactivationPublicationChoice = async (offerId: number, offerTitle: string) => {
    if (!token || !user?.id || reactivating || reactivationChoiceLoading) return;
    setReactivationChoiceLoading(true);
    try {
      const quoteRes = await fetchPublicationQuote(API_URL, token, offerId);
      const decision = decideReactivationFromQuote(quoteRes);
      if (decision.action === 'block') {
        Alert.alert(decision.title, decision.message);
        return;
      }

      const latestUser = useAuthStore.getState().user ?? user;
      const gathered = await gatherPublicationBonusCoupons({
        apiUrl: API_URL,
        token,
        userId: user.id,
        email: latestUser?.email,
        firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
        t,
      });
      const hasPlusCredit = hasAdditionalPlusPublication(latestUser);
      const hasCoupons = gathered.coupons.length > 0;

      if (decision.action === 'activate_free' && !hasCoupons && !hasPlusCredit) {
        await reactivateEndedOfferWithPakietPlus(offerId, offerTitle, {});
        return;
      }

      pendingReactivationRef.current = { offerId, offerTitle };
      setReactivationChoiceCoupons(gathered.coupons);
      setReactivationChoicePlusSlots(getAdditionalListingSlots(latestUser));
      setReactivationChoiceHasPlus(hasPlusCredit);
      setReactivationChoiceVisible(true);
    } finally {
      setReactivationChoiceLoading(false);
    }
  };

  const handleReactivationPublicationChoice = (result: PublicationChoiceConfirm) => {
    const pending = pendingReactivationRef.current;
    dismissReactivationChoice();
    if (!pending) return;
    if (result.action === 'cancel') return;

    if (result.action === 'buy_plus') {
      void (async () => {
        const r = await purchasePakietPlusConsumable(API_URL, token, {
          deferPublicationConsume: true,
          targetOfferId: pending.offerId,
        });
        if (r.cancelled) return;
        if (!r.ok) {
          if (r.message) Alert.alert(t('profile.myOffers.alerts.storeTitle'), r.message);
          return;
        }
        const tx = r.transactionId ?? '';
        if (!tx) {
          Alert.alert(t('profile.myOffers.alerts.plusTitle'), publicationCopy.restoreHint);
          return;
        }
        await reactivateEndedOfferWithPakietPlus(pending.offerId, pending.offerTitle, {
          redemption: { source: 'plus_iap', transactionId: tx },
        });
      })();
      return;
    }

    void reactivateEndedOfferWithPakietPlus(pending.offerId, pending.offerTitle, {
      redemption: result.redemption,
    });
  };

  const handleAction = async (actionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (actionType === 'PREVIEW') {
      handleMyOffersClose();
      setTimeout(() => navigation.navigate("OfferDetail", { offer: selectedOffer }), 200);
    } else if (actionType === 'EDIT') {
      /*
       * Otwieramy ekran edycji oferty (`EditOfferScreen`). Wcześniej był to
       * placeholder „Funkcja wkrótce", ale od czasu wdrożenia karty prowizji
       * agenta (Step4_Finance / EditOffer) edycja działa w pełni i ma własną
       * walidację. Zamykamy szufladę zarządzania PRZED nawigacją z `setTimeout`,
       * dokładnie jak w `PREVIEW`, żeby gesture „swipe-back" nie zostawił
       * artefaktu modala na ekranie EditOffer.
       */
      if (!selectedOffer?.id) {
        Alert.alert(t('profile.myOffers.alerts.editTitle'), t('profile.myOffers.alerts.editFailed'));
        return;
      }
      handleMyOffersClose();
      setTimeout(() => navigation.navigate('EditOffer', { offerId: selectedOffer.id }), 200);
    } else if (actionType === 'COMMENTS') {
      if (!selectedOffer?.id) return;
      const offerId = Number(selectedOffer.id);
      handleMyOffersClose();
      setTimeout(
        () => navigation.navigate('OfferComments', { offerId, offerTitle: String(selectedOffer.title || '') }),
        180,
      );
    } else if (actionType === 'BUMP') {
      Alert.alert(
        t('profile.myOffers.alerts.plusPackageTitle'),
        t('profile.myOffers.alerts.plusPackageBump'),
        [{ text: t('common.ok') }]
      );
    } else if (actionType === 'ARCHIVE') {
      if (!selectedOffer?.id || !token || archiving) return;
      const offerId = Number(selectedOffer.id);
      const offerTitle = String(selectedOffer.title || t('profile.myOffers.defaultOfferTitle'));
      Alert.alert(
        t('profile.myOffers.alerts.endListingTitle'),
        publicationCopy.archiveWarning,
        [
        { text: t('common.cancel'), style: "cancel" },
        { text: t('profile.myOffers.alerts.withdrawAction'), style: "destructive", onPress: async () => {
          setArchiving(true);
          try {
            const payload = {
              id: offerId,
              userId: user?.id,
              status: 'ARCHIVED',
              newStatus: 'ARCHIVED',
              archivedAt: new Date().toISOString(),
            };
            const res = await persistMobileOfferUpdate({
              offerId,
              token,
              payload,
            });
            const body = await readMobileOfferResponseBody(res);

            if (isExplicitMobileOfferSaveFailure(body, res.ok)) {
              throw new Error(
                body?.message ||
                body?.error ||
                (typeof body?._raw === 'string' ? body._raw.slice(0, 240) : null) ||
                t('profile.myOffers.alerts.withdrawRejected', { status: res.status })
              );
            }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearReactivateLock(offerId);
            const archivedOffer = extractMobileOfferJson(body);
            setOffers((prev) =>
              prev.map((o) => {
                if (Number(o?.id) !== offerId) return o;
                const merged = archivedOffer ? { ...o, ...archivedOffer } : { ...o, status: 'ARCHIVED' };
                return { ...merged, status: 'ARCHIVED' };
              }),
            );
            setSelectedOffer(null);
            setActiveTab('ARCHIVED');
              await fetchMyOffers();
            Alert.alert(
              t('profile.myOffers.alerts.withdrawnTitle'),
              t('profile.myOffers.alerts.withdrawnBody', { title: offerTitle }),
            );
          } catch(e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
              t('profile.myOffers.alerts.withdrawFailedTitle'),
              e?.message || t('profile.myOffers.alerts.withdrawFailedBody'),
            );
          } finally {
            setArchiving(false);
          }
        }}
        ]
      );
    } else if (actionType === 'REACTIVATE_30D') {
      if (!selectedOffer?.id || !token || reactivating) return;
      const offerId = Number(selectedOffer.id);
      const offerTitle = String(selectedOffer.title || t('profile.myOffers.defaultOfferTitle'));
      void openReactivationPublicationChoice(offerId, offerTitle);
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
    const offerId = Number(item?.id);
    const rowStatus = normalizeOfferTabStatus(item.status);
    const syncing = offerId > 0 && isOfferSyncing(offerId);

    return (
      <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: syncing ? 10 : 15 }}>
           {imageUri ? <Image source={{ uri: imageUri }} style={{ width: 65, height: 65, borderRadius: 14, marginRight: 15 }} /> : <View style={{ width: 65, height: 65, borderRadius: 14, marginRight: 15, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="home" size={24} color="#8E8E93" /></View>}
           <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[styles.offerTitle, { color: theme.text, marginBottom: 4 }]} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.offerSubtitle} numberOfLines={2}>
                {formatOffer(item).primary} • {formatOfferLocationLine(item) || item.city || '—'}
              </Text>
           </View>
        </View>

        {syncing ? (
          <View style={styles.syncPillRow}>
            <OfferStatusSyncPill isDark={isDark} />
            <Text style={[styles.syncPillHint, { color: theme.subtitle }]}>
              {t('profile.sync.statusConfirming')}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AnimatedStatusDot status={item.status} />
            <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 8, color: rowStatus === 'ACTIVE' ? '#34C759' : rowStatus === 'PENDING' ? '#FF9F0A' : '#FF3B30' }}>
              {rowStatus === 'ACTIVE' ? t('profile.myOffers.status.active') : rowStatus === 'PENDING' ? t('profile.myOffers.status.pending') : t('profile.myOffers.status.archived')}
            </Text>
          </View>
          <Pressable onPress={() => handleOpenManagement(item)} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{t('profile.myOffers.manage')}</Text>
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
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.subtitle }}>{formatOffer(selectedOffer).primary}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 25 }}>
          <View style={[styles.mgtStatBox, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="eye" size={24} color="#007AFF" />
            <Text style={[styles.mgtStatValue, { color: theme.text }]}>{realViews}</Text>
            <Text style={styles.mgtStatLabel}>{t('profile.myOffers.views')}</Text>
          </View>
          <View style={[styles.mgtStatBox, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
            <Ionicons name="time" size={24} color={daysLeft < 5 ? '#FF3B30' : '#34C759'} />
            <Text style={[styles.mgtStatValue, { color: theme.text }]}>{daysLeft}</Text>
            <Text style={styles.mgtStatLabel}>{t('profile.myOffers.daysLeft')}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 15 }]}>{t('profile.myOffers.actionsTitle')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <PremiumActionButton onPress={() => handleAction('PREVIEW')} icon="search" color={{ bg: 'rgba(0,122,255,0.1)', icon: '#007AFF' }} title={t('profile.myOffers.preview')} subtitle={t('profile.myOffers.previewSubtitle')} theme={theme} isDark={isDark} />
          <PremiumActionButton onPress={() => handleAction('EDIT')} icon="pencil" color={{ bg: 'rgba(255,159,10,0.1)', icon: '#FF9F0A' }} title={t('profile.myOffers.edit')} subtitle={t('profile.myOffers.editSubtitle')} theme={theme} isDark={isDark} />
          <PremiumActionButton onPress={() => handleAction('COMMENTS')} icon="chatbubbles" color={{ bg: 'rgba(175,82,222,0.12)', icon: '#AF52DE' }} title={t('profile.myOffers.comments')} subtitle={t('profile.myOffers.commentsSubtitle')} theme={theme} isDark={isDark} />
          <PremiumActionButton disabled={selSt === 'ARCHIVED' || archiving} onPress={() => handleAction('ARCHIVE')} icon="archive" color={{ bg: selSt === 'ARCHIVED' ? 'rgba(142,142,147,0.1)' : 'rgba(255,59,48,0.1)', icon: selSt === 'ARCHIVED' ? '#8E8E93' : '#FF3B30' }} title={archiving ? t('profile.myOffers.withdrawing') : t('profile.myOffers.withdraw')} subtitle={t('profile.myOffers.withdrawSubtitle')} theme={theme} isDark={isDark} />
          {selSt === 'ARCHIVED' && (
            <PremiumActionButton
              isPrimary
              disabled={reactivating || reactivationChoiceLoading}
              onPress={() => handleAction('REACTIVATE_30D')}
              icon="refresh-circle"
              color={{ bg: 'rgba(52,199,89,0.14)', icon: '#34C759' }}
              title={
                reactivating
                  ? t('profile.myOffers.republishing')
                  : reactivationChoiceLoading
                    ? t('profile.myOffers.republishLoading', { defaultValue: 'Przygotowanie…' })
                    : t('profile.myOffers.republish')
              }
              subtitle={t('profile.myOffers.republishSubtitle', { price: PAKIET_PLUS_PRICE_LABEL })}
              theme={theme}
              isDark={isDark}
            />
          )}
        </View>
      </ScrollView>
    );
  };

  if (!visible) return null;

  return (
    <>
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        
        <View style={[styles.modalHeader, { paddingVertical: 15, paddingHorizontal: 15 }]}>
          {selectedOffer ? (
            <Pressable onPress={handleGoBack} style={{ width: 80, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text style={{ fontSize: 17, color: '#007AFF', fontWeight: '500', marginLeft: -4 }}>{t('profile.myOffers.back')}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <Text style={[styles.modalTitle, { color: theme.text, flex: 1, textAlign: 'center', fontSize: 18 }]}>
            {selectedOffer ? t('profile.myOffers.management') : t('profile.myOffers.title')}
          </Text>

          <Pressable onPress={handleMyOffersClose} style={{ width: 80, alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: 6, borderRadius: 15 }}>
              <Ionicons name="close" size={20} color={theme.subtitle} />
            </View>
          </Pressable>
        </View>

        {!selectedOffer && (
          <View style={styles.tabsContainer}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ACTIVE'); }} style={[styles.tab, activeTab === 'ACTIVE' && { backgroundColor: '#34C759' }]}><Text style={[styles.tabText, { color: activeTab === 'ACTIVE' ? '#fff' : theme.subtitle }]}>{t('profile.myOffers.tabs.active')}</Text></Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('PENDING'); }} style={[styles.tab, activeTab === 'PENDING' && { backgroundColor: '#FF9F0A' }]}><Text style={[styles.tabText, { color: activeTab === 'PENDING' ? '#fff' : theme.subtitle }]}>{t('profile.myOffers.tabs.pending')}</Text></Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ARCHIVED'); }} style={[styles.tab, activeTab === 'ARCHIVED' && { backgroundColor: '#FF3B30' }]}><Text style={[styles.tabText, { color: activeTab === 'ARCHIVED' ? '#fff' : theme.subtitle }]}>{t('profile.myOffers.tabs.archived')}</Text></Pressable>
          </View>
        )}

        {loading ? (
           <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
           selectedOffer ? renderManagementView() : <FlatList data={filteredOffers} extraData={`${activeTab}-${syncTick}`} keyExtractor={item => String(item.id)} renderItem={renderMyOffer} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>{t('profile.myOffers.emptySection')}</Text>} />
        )}
        <PublicationChoiceModal
          variant="overlay"
          visible={reactivationChoiceVisible}
          isDark={isDark}
          title={publicationCopy.reactivateTitle}
          subtitle={publicationCopy.reactivateBody}
          couponsSectionTitle={t('addOffer.step6.publicationChoice.couponsSection')}
          couponsEmptyHint={t('addOffer.step6.publicationChoice.couponsEmpty')}
          plusSectionTitle={t('addOffer.step6.publicationChoice.plusSection')}
          plusCreditLabel={t('addOffer.step6.publicationChoice.plusCreditTitle')}
          plusCreditSubtitle={t('addOffer.step6.publicationChoice.plusCreditSubtitle', {
            count: reactivationChoicePlusSlots,
          })}
          buyPlusLabel={t('addOffer.step6.publicationChoice.buyPlusTitle')}
          buyPlusSubtitle={t('addOffer.step6.publicationChoice.buyPlusSubtitle', {
            price: PAKIET_PLUS_PRICE_LABEL,
          })}
          publishLabel={t('profile.myOffers.republish')}
          cancelLabel={t('common.cancel')}
          couponPriorityHint={t('addOffer.step6.publicationChoice.couponPriorityHint')}
          coupons={reactivationChoiceCoupons}
          plusSlots={reactivationChoicePlusSlots}
          hasPlusCredit={reactivationChoiceHasPlus}
          onConfirm={handleReactivationPublicationChoice}
          onClose={dismissReactivationChoice}
        />
      </View>
    </Modal>
    </>
  );
};

const ListGroup = ({ children, isDark, style }) => (
  <ProfileCardShell isDark={isDark} style={style}>{children}</ProfileCardShell>
);

const ListItem = ({ icon, color, title, subtitle, subtitleNode, value, onPress, isLast, isDark, rightElement, badgeCount }: any) => (
  <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && onPress && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
    <View style={[styles.listIconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#FFF" />
      {typeof badgeCount === 'number' && badgeCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: '#ef4444',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: isDark ? '#1c1c1e' : '#ffffff',
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', lineHeight: 14 }}>{badgeCount}</Text>
        </View>
      ) : null}
    </View>
    <View style={[styles.listContent, !isLast && { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flexShrink: 1, minWidth: 0, justifyContent: 'center', paddingRight: 10 }}>
        <Text
          style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          allowFontScaling={false}
        >
          {title}
        </Text>
        {subtitleNode ? (
          subtitleNode
        ) : subtitle ? (
          <Text
            style={styles.listSubtitle}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            allowFontScaling={false}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>
        {value && (
          <Text
            style={[styles.listValue, { flexShrink: 1, textAlign: 'right' }]}
            numberOfLines={1}
            ellipsizeMode="middle"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            allowFontScaling={false}
          >
            {value}
          </Text>
        )}
        {rightElement ? rightElement : (onPress ? <Ionicons name="chevron-forward" size={20} color="#8E8E93" opacity={0.5} style={{ marginLeft: 5 }} /> : null)}
      </View>
    </View>
  </Pressable>
);

function AnimatedSegmentedControl({ themeMode, setThemeMode, isDark }) {
  const { t } = useI18n();
  const modes = [
    { label: t('profile.appearance.light'), value: 'light' },
    { label: t('profile.appearance.auto'), value: 'auto' },
    { label: t('profile.appearance.dark'), value: 'dark' },
  ];
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

/** `resumeUsersList` — gdy false (np. nawigacja do oferty), nie otwieraj ponownie listy pod spodem — unikamy dwóch modali naraz na iOS. */
const AdminUserProfileModal = ({ visible, userId, initialUser, onClose, theme }) => {
  const navigation = useNavigation();
  const { token } = useAuthStore();
  const { formatOffer } = useMoneyContext();
  const [userData, setUserData] = useState(initialUser || null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offerThumbById, setOfferThumbById] = useState<Record<number, string>>({});
  const [radarFetchMiss, setRadarFetchMiss] = useState(false);
  const isDark = theme.glass === 'dark';

  const fetchUserDetails = async () => {
    if (!userId || !token) {
      setUserData(initialUser || null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    const attachRadarPreference = async (base: Record<string, unknown>) => {
      const fromDetail = coalesceRadarPreferenceFromPayload(base);
      const remoteRadar =
        fromDetail && hasMeaningfulRadarFields(fromDetail)
          ? null
          : await fetchAdminUserRadarPreference(userId, token);
      const mergedRadar = mergeRadarPreferenceForAdminUser(base, remoteRadar);
      const enrichedUser = {
        ...base,
        radarPreference: Object.keys(mergedRadar).length ? mergedRadar : base.radarPreference,
      };
      const pushOn = Boolean(
        mergedRadar.pushNotifications === true || mergedRadar.push_notifications === true,
      );
      setRadarFetchMiss(pushOn && !hasMeaningfulRadarFields(mergedRadar));
      return enrichedUser;
    };

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      let resolved = null;
      if (res.ok && data?.user && typeof data.user === 'object') resolved = data.user;
      else if (res.ok && data && typeof data === 'object' && data.id != null && !data.error) resolved = data;
      if (resolved) {
        let enriched = { ...(initialUser || {}), ...(resolved || {}) };
        if (!getBestUserAvatarUrl(resolved)) {
          try {
            const pubRes = await fetch(`${API_URL}/api/users/${userId}/public`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pubData = await pubRes.json().catch(() => ({}));
            const pubUser = pubData?.user || pubData;
            if (pubRes.ok && pubUser && typeof pubUser === 'object') {
              enriched = {
                ...(initialUser || {}),
                ...(resolved || {}),
                ...(pubUser || {}),
                image:
                  resolved?.image ||
                  resolved?.avatar ||
                  resolved?.avatar_url ||
                  resolved?.profile_image ||
                  pubUser?.image ||
                  pubUser?.avatar ||
                  pubUser?.avatar_url ||
                  pubUser?.profile_image ||
                  initialUser?.image ||
                  initialUser?.avatar ||
                  initialUser?.avatar_url ||
                  initialUser?.profile_image,
                avatar:
                  resolved?.avatar ||
                  resolved?.image ||
                  resolved?.avatar_url ||
                  resolved?.profile_image ||
                  pubUser?.avatar ||
                  pubUser?.image ||
                  pubUser?.avatar_url ||
                  pubUser?.profile_image ||
                  initialUser?.avatar ||
                  initialUser?.image ||
                  initialUser?.avatar_url ||
                  initialUser?.profile_image,
              };
            }
          } catch {
            // noop
          }
        }
        try {
          const bpRes = await fetch(`${API_URL}/api/mobile/v1/admin/users/${userId}/buyer-profile`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const bpData = await bpRes.json().catch(() => ({}));
          if (bpRes.ok) {
            const bp =
              bpData?.buyerProfile ||
              bpData?.buyer_profile ||
              bpData?.profile ||
              (bpData?.success && typeof bpData === 'object' ? bpData : null);
            if (bp && typeof bp === 'object') {
              enriched = {
                ...enriched,
                ...bp,
                radarPreference: enriched.radarPreference || bp.radarPreference || bp.radar_preference,
                radarSearchHistory:
                  bp.radarSearchHistory ||
                  bp.radar_search_history ||
                  enriched.radarSearchHistory ||
                  enriched.radar_search_history,
              };
            }
          }
        } catch {
          // endpoint opcjonalny — karta działa z danymi user detail
        }

        enriched = await attachRadarPreference(enriched as Record<string, unknown>);
        setUserData(enriched);
        setFetchError(null);
      } else {
        // Fallback #1: szukamy użytkownika przez endpoint listy adminów.
        let fallbackUser: any = null;
        try {
          const listRes = await fetch(`${API_URL}/api/mobile/v1/admin/users?page=1&limit=50&search=${encodeURIComponent(String(userId))}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const listData = await listRes.json().catch(() => ({}));
          const usersList = Array.isArray(listData?.users) ? listData.users : [];
          fallbackUser = usersList.find((u: any) => Number(u?.id) === Number(userId)) || null;
        } catch {
          // noop
        }

        // Fallback #2: dociągamy publiczne dane użytkownika.
        let publicUser: any = null;
        try {
          const pubRes = await fetch(`${API_URL}/api/users/${userId}/public`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pubData = await pubRes.json().catch(() => ({}));
          if (pubRes.ok && pubData && typeof pubData === 'object') {
            publicUser = pubData?.user || pubData;
          }
        } catch {
          // noop
        }

        // Fallback #3: dociągamy oferty użytkownika.
        let offers: any[] = [];
        try {
          const offersRes = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${encodeURIComponent(String(userId))}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const offersData = await offersRes.json().catch(() => ({}));
          if (offersRes.ok && Array.isArray(offersData?.offers)) offers = offersData.offers;
        } catch {
          // noop
        }

        const mergedFallback = {
          ...(initialUser || {}),
          ...(fallbackUser || {}),
          ...(publicUser || {}),
          offers,
        };
        const hasAnyUsefulData = mergedFallback && (mergedFallback.id != null || mergedFallback.email || mergedFallback.name);
        if (hasAnyUsefulData) {
          setUserData(await attachRadarPreference(mergedFallback as Record<string, unknown>));
        } else {
          setUserData(initialUser || null);
        }
        setFetchError(data?.error || data?.message || `Serwer zwrócił kod ${res.status}. Spróbuj ponownie.`);
      }
    } catch {
      setUserData(initialUser || null);
      setFetchError('Nie udało się połączyć z serwerem. Sprawdź sieć i spróbuj ponownie.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) {
      setUserData(null);
      setFetchError(null);
      setLoading(false);
      setRadarFetchMiss(false);
      return;
    }
    if (initialUser) setUserData(initialUser);
    void fetchUserDetails();
  }, [visible, userId, initialUser]);

  useEffect(() => {
    const offers = Array.isArray(userData?.offers) ? userData.offers : [];
    if (offers.length === 0) return;
    let cancelled = false;
    const loadThumbs = async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        offers.slice(0, 24).map(async (offer: any) => {
          const offerId = Number(offer?.id);
          if (!offerId) return;
          const direct = extractOfferCardImage(offer);
          if (direct) {
            next[offerId] = direct;
            return;
          }
          try {
            const res = await fetch(`${API_URL}/api/offers/${offerId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = await res.json().catch(() => ({}));
            const payload = data?.offer || data;
            const fetched = extractOfferCardImage(payload);
            if (fetched) next[offerId] = fetched;
          } catch {
            // noop
          }
        })
      );
      if (!cancelled) setOfferThumbById((prev) => ({ ...prev, ...next }));
    };
    void loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [userData?.offers, token]);

  const changeOfferStatus = async (offerId, newStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offerId, newStatus })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchUserDetails(); 
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert('Błąd', String(errData?.error || errData?.message || 'Zmiana statusu nie powiodła się.'));
      }
    } catch (e) { Alert.alert("Błąd", "Zmiana statusu nie powiodła się."); }
  };

  const deleteOfferPermanently = (offer) => {
    const title = String(offer?.title || `Oferta #${offer?.id}`).trim();
    Alert.alert(
      'Usunąć ofertę bezpowrotnie?',
      `"${title}" zostanie trwale usunięta wraz ze zdjęciami i powiązanymi danymi. Tej operacji nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              Alert.alert('Sesja', 'Zaloguj się ponownie.');
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ offerId: offer.id }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                fetchUserDetails();
              } else {
                Alert.alert('Błąd', String(data?.message || data?.error || 'Nie udało się usunąć oferty.'));
              }
            } catch {
              Alert.alert('Błąd', 'Nie udało się usunąć oferty.');
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Brak danych';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const openOfferPreview = (offer) => {
    Haptics.selectionAsync();
    onClose?.({ resumeUsersList: false });
    setTimeout(() => {
      navigation.navigate('OfferDetail', { offer });
    }, 160);
  };

  const renderOffer = ({ item }) => (
    <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <Pressable onPress={() => openOfferPreview(item)} style={({ pressed }) => [styles.adminOfferHeaderRow, pressed && { opacity: 0.75 }]}>
        {(() => {
          const offerId = Number(item?.id);
          const imageUri = (offerId && offerThumbById[offerId]) || extractOfferCardImage(item);
          const txBadge = getOfferTransactionBadge(item);
          return (
            <View style={styles.adminPreviewWrap}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.adminPreviewImage} />
              ) : (
                <View style={[styles.adminPreviewImage, { backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="home" size={18} color="#8E8E93" />
                </View>
              )}
              <View style={[styles.adminTxBadgeOnImage, { backgroundColor: txBadge.color }]}>
                <Text
                  style={styles.adminTxBadgeOnImageText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {txBadge.label}
                </Text>
              </View>
            </View>
          );
        })()}
        <View style={{ flex: 1 }}>
        <Text style={[styles.offerTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
          {(() => {
            const statusMeta = getAdminStatusMeta(item?.status);
            return (
              <View style={[styles.adminStatusPill, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border, alignSelf: 'flex-start', marginTop: 4 }]}>
                <Text style={[styles.adminStatusPillText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
        </View>
            );
          })()}
      </View>
      </Pressable>
      <Text style={styles.offerSubtitle} numberOfLines={2}>
        {formatOffer(item).primary} • {formatOfferLocationLine(item) || item.city || '—'}
      </Text>
      
      <View style={styles.adminActionRow}>
        {normalizeOfferTabStatus(item?.status) === 'PENDING' && (
          <>
            <AdminActionButton icon="checkmark-circle" label="Akceptuj" tint="#34C759" fill="rgba(52,199,89,0.12)" onPress={() => changeOfferStatus(item.id, 'ACTIVE')} />
            <AdminActionButton icon="close-circle" label="Odrzuć" tint="#FF3B30" fill="rgba(255,59,48,0.12)" onPress={() => changeOfferStatus(item.id, 'REJECTED')} />
          </>
        )}
        {normalizeOfferTabStatus(item?.status) === 'ACTIVE' && (
          <AdminActionButton icon="archive" label="Zawieś / Archiwizuj" tint="#FF9F0A" fill="rgba(255,159,10,0.14)" onPress={() => changeOfferStatus(item.id, 'ARCHIVED')} />
        )}
        {normalizeOfferTabStatus(item?.status) === 'ARCHIVED' && (
          <>
            <AdminActionButton icon="refresh-circle" label="Przywróć" tint="#0A84FF" fill="rgba(10,132,255,0.14)" onPress={() => changeOfferStatus(item.id, 'ACTIVE')} />
            <AdminActionButton icon="trash" label="Usuń" tint="#FF3B30" fill="rgba(255,59,48,0.12)" onPress={() => deleteOfferPermanently(item)} />
          </>
        )}
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose?.({ resumeUsersList: true })}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Karta Użytkownika</Text>
          <Pressable onPress={() => onClose?.({ resumeUsersList: true })}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : fetchError && !userData ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
            <View style={[styles.adminInlineError, { borderColor: 'rgba(255,59,48,0.35)', backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)' }]}>
              <Ionicons name="alert-circle" size={22} color="#FF3B30" />
              <Text style={[styles.adminInlineErrorText, { color: theme.text }]}>{fetchError}</Text>
              </View>
            <Pressable
              onPress={() => void fetchUserDetails()}
              style={({ pressed }) => [styles.adminRetryBtn, pressed && { opacity: 0.88 }]}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.adminRetryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
              </View>
        ) : userData ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 42 }}>
            {!!fetchError && (
              <View style={[styles.adminInlineError, { borderColor: 'rgba(255,149,0,0.35)', backgroundColor: isDark ? 'rgba(255,149,0,0.10)' : 'rgba(255,149,0,0.08)' }]}>
                <Ionicons name="warning" size={20} color="#FF9F0A" />
                <Text style={[styles.adminInlineErrorText, { color: theme.text }]}>
                  Nie udało się odświeżyć pełnej karty z serwera. Pokazuję dane z listy.
                </Text>
            </View>
            )}
            <View style={[styles.adminProfileHeroCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={styles.adminProfileAvatarWrap}>
                {getBestUserAvatarUrl(userData) ? <Image source={{ uri: getBestUserAvatarUrl(userData) as string }} style={styles.avatarImage} /> : <Ionicons name="person" size={36} color="#fff" />}
              </View>
              <View style={styles.adminProfileHeroBody}>
                <Text style={[styles.adminProfileHeroName, { color: theme.text }]} numberOfLines={1}>{userData.name || 'Brak imienia'}</Text>
                <View style={styles.adminProfileHeroMetaRow}>
                  <View style={[styles.adminProfileRolePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={styles.adminProfileRolePillText}>{userData.role || 'USER'}</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>Szczegóły konta</Text>
            <ListGroup isDark={isDark}>
              <ListItem icon="finger-print" color="#8E8E93" title="ID konta" value={String(userData.id)} isDark={isDark} />
              <ListItem icon="mail" color="#007AFF" title="Adres e-mail" value={userData.email} isDark={isDark} />
              <ListItem icon="call" color="#34C759" title="Telefon" value={userData.phone || 'Brak'} isDark={isDark} />
              <ListItem icon="business" color="#5856D6" title="Firma" value={userData.companyName || '—'} isDark={isDark} />
              <ListItem icon="ribbon" color="#007AFF" title="Plan" value={String(userData.planType || 'NONE')} isDark={isDark} />
              <ListItem icon="calendar" color="#FF9F0A" title="Dołączył(a)" value={formatDate(userData.createdAt)} isDark={isDark} />
              <ListItem
                icon="log-in"
                color="#34C759"
                title="Ostatnie logowanie"
                value={userData.lastLoginAt ? new Date(userData.lastLoginAt).toLocaleString('pl-PL') : 'Brak danych'}
                isLast={true}
                isDark={isDark}
              />
            </ListGroup>

            <AdminBuyerSearchSection
              user={userData}
              theme={theme}
              isDark={isDark}
              radarFetchMiss={radarFetchMiss}
            />

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Ogłoszenia ({userData.offers?.length || 0})</Text>
            {(() => {
              const offers = Array.isArray(userData?.offers) ? [...userData.offers] : [];
              if (offers.length === 0) {
                return <Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 20 }}>Ten użytkownik nie posiada jeszcze ofert.</Text>;
              }
              const sorted = offers.sort((a: any, b: any) => {
                const ta = new Date(a?.createdAt || 0).getTime();
                const tb = new Date(b?.createdAt || 0).getTime();
                return tb - ta;
              });
              const grouped = {
                PENDING: sorted.filter((o: any) => normalizeOfferTabStatus(o?.status) === 'PENDING'),
                ACTIVE: sorted.filter((o: any) => normalizeOfferTabStatus(o?.status) === 'ACTIVE'),
                ARCHIVED: sorted.filter((o: any) => normalizeOfferTabStatus(o?.status) === 'ARCHIVED'),
              };
              const sections = [
                { key: 'PENDING', label: 'Do weryfikacji', color: '#FF9F0A' },
                { key: 'ACTIVE', label: 'Aktywne', color: '#34C759' },
                { key: 'ARCHIVED', label: 'Zarchiwizowane', color: '#8E8E93' },
              ];
              return sections.map((section) => {
                const list = grouped[section.key as keyof typeof grouped];
                if (!list || list.length === 0) return null;
                return (
                  <View key={section.key} style={{ marginTop: 10 }}>
                    <View style={[styles.adminSectionDivider, { borderColor: `${section.color}55` }]}>
                      {section.key === 'PENDING' ? <AnimatedStatusDot status="PENDING" /> : <AnimatedStatusDot status={section.key === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'} />}
                      <Text style={[styles.adminSectionDividerText, { color: section.color }]}>{section.label} ({list.length})</Text>
                    </View>
                    {list.map((offer: any) => <React.Fragment key={offer.id}>{renderOffer({ item: offer })}</React.Fragment>)}
                  </View>
                );
              });
            })()}
          </ScrollView>
        ) : (
          <Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 48 }}>Brak danych profilu.</Text>
        )}
      </View>
    </Modal>
  );
};

const AdminOffersModal = ({ visible, onClose, theme, onPendingCountChange }) => {
  const navigation = useNavigation();
  const { token } = useAuthStore();
  const { formatOffer } = useMoneyContext();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [transactionFilter, setTransactionFilter] = useState('ALL');
  const [txFilterContainerWidth, setTxFilterContainerWidth] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const txFilterTranslateX = useRef(new Animated.Value(0)).current;
  const openOfferPreview = (offer) => {
    Haptics.selectionAsync();
    onClose?.();
    setTimeout(() => {
      navigation.navigate('OfferDetail', { offer });
    }, 160);
  };

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const isDark = theme.glass === 'dark';
  const txFilterSegmentWidth = txFilterContainerWidth > 0 ? txFilterContainerWidth / 3 : 0;

  useEffect(() => {
    if (txFilterSegmentWidth === 0) return;
    const idx = transactionFilter === 'SELL' ? 1 : transactionFilter === 'RENT' ? 2 : 0;
    Animated.spring(txFilterTranslateX, {
      toValue: idx * txFilterSegmentWidth,
      useNativeDriver: false,
      bounciness: 10,
      speed: 16,
    }).start();
  }, [transactionFilter, txFilterSegmentWidth, txFilterTranslateX]);

  const extractAdminOffersList = (data: any): any[] => {
    if (Array.isArray(data?.offers)) return data.offers;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  };

  const fetchOffers = async () => {
    if (!token) {
      setFetchError('Brak sesji — zaloguj się ponownie.');
      setOffers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/mobile/v1/admin/offers?status=${encodeURIComponent(activeTab)}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data?.message || data?.error || `Serwer: ${res.status}`).trim();
        setFetchError(msg || 'Nie udało się pobrać listy ofert.');
        setOffers([]);
        return;
      }
      setOffers(extractAdminOffersList(data));
    } catch {
      setFetchError('Brak połączenia z serwerem.');
      setOffers([]);
    } finally {
    setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers?status=PENDING`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const nextCount = extractAdminOffersList(data).length;
      onPendingCountChange?.(nextCount);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!visible) return;
    fetchOffers();
    fetchPendingCount();
  }, [visible, activeTab, token]);

  const changeStatus = async (offerId, newStatus) => {
    if (!token) {
      Alert.alert('Sesja', 'Zaloguj się ponownie, aby zmieniać statusy ofert.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offerId, newStatus }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchOffers();
        fetchPendingCount();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Błąd', String(err?.message || err?.error || 'Nie udało się zmienić statusu.'));
      }
    } catch {
      Alert.alert('Błąd', 'Nie udało się zmienić statusu.');
    }
  };

  const deleteOfferPermanently = (offer) => {
    const title = String(offer?.title || `Oferta #${offer?.id}`).trim();
    Alert.alert(
      'Usunąć ofertę bezpowrotnie?',
      `"${title}" zostanie trwale usunięta wraz ze zdjęciami i powiązanymi danymi. Tej operacji nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              Alert.alert('Sesja', 'Zaloguj się ponownie.');
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ offerId: offer.id }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                fetchOffers();
                fetchPendingCount();
              } else {
                Alert.alert('Błąd', String(data?.message || data?.error || 'Nie udało się usunąć oferty.'));
              }
            } catch {
              Alert.alert('Błąd', 'Nie udało się usunąć oferty.');
            }
          },
        },
      ],
    );
  };

  const renderOffer = ({ item }) => {
    const statusMeta = getAdminStatusMeta(item?.status);
    const imageUri = extractOfferCardImage(item);
    const txBadge = getOfferTransactionBadge(item);
    return (
    <View style={[styles.offerCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <Pressable onPress={() => openOfferPreview(item)} style={({ pressed }) => [styles.adminOfferHeaderRow, pressed && { opacity: 0.75 }]}>
          <View style={styles.adminPreviewWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.adminPreviewImage} />
            ) : (
              <View style={[styles.adminPreviewImage, { backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="home" size={18} color="#8E8E93" />
              </View>
            )}
            <View style={[styles.adminTxBadgeOnImage, { backgroundColor: txBadge.color }]}>
              <Text
                style={styles.adminTxBadgeOnImageText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {txBadge.label}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.offerTitle, { color: theme.text, flex: 1 }]} numberOfLines={2}>{item.title}</Text>
            <View style={[styles.adminStatusPill, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border, alignSelf: 'flex-start', marginTop: 4 }]}>
              <Text style={[styles.adminStatusPillText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
            </View>
          </View>
        </Pressable>
        <Text style={styles.offerSubtitle} numberOfLines={2}>
          {formatOffer(item).primary} • {formatOfferLocationLine(item) || item.city || '—'}
        </Text>
      <Text style={styles.offerUser}>Autor: {item.user?.email}</Text>
        <View style={styles.adminActionRow}>
        {activeTab === 'PENDING' && (
          <>
              <AdminActionButton icon="checkmark-circle" label="Akceptuj" tint="#34C759" fill="rgba(52,199,89,0.12)" onPress={() => changeStatus(item.id, 'ACTIVE')} />
              <AdminActionButton icon="close-circle" label="Odrzuć" tint="#FF3B30" fill="rgba(255,59,48,0.12)" onPress={() => changeStatus(item.id, 'REJECTED')} />
          </>
        )}
        {activeTab === 'ACTIVE' && (
            <AdminActionButton icon="archive" label="Archiwizuj" tint="#FF9F0A" fill="rgba(255,159,10,0.14)" onPress={() => changeStatus(item.id, 'ARCHIVED')} />
        )}
        {activeTab === 'ARCHIVED' && (
            <>
              <AdminActionButton icon="refresh-circle" label="Przywróć" tint="#0A84FF" fill="rgba(10,132,255,0.14)" onPress={() => changeStatus(item.id, 'ACTIVE')} />
              <AdminActionButton icon="trash" label="Usuń" tint="#FF3B30" fill="rgba(255,59,48,0.12)" onPress={() => deleteOfferPermanently(item)} />
            </>
        )}
      </View>
    </View>
  );
  };

  const filteredOffers = offers.filter((item) => {
    if (transactionFilter === 'ALL') return true;
    const raw = String(item?.transactionType ?? item?.offerType ?? item?.listingType ?? item?.type ?? '').toUpperCase();
    const isRent = raw === 'RENT' || raw === 'WYNAJEM' || raw === 'NAJEM';
    return transactionFilter === 'RENT' ? isRent : !isRent;
  });

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Weryfikacja Ofert</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {fetchError ? (
          <View style={[styles.adminInlineError, { borderColor: 'rgba(255,59,48,0.35)', backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)', marginHorizontal: 16, marginBottom: 8 }]}>
            <Text style={[styles.adminInlineErrorText, { color: theme.text }]}>{fetchError}</Text>
            <Pressable onPress={() => void fetchOffers()} style={({ pressed }) => [styles.adminRetryBtn, pressed && { opacity: 0.88 }]}>
              <Text style={styles.adminRetryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.tabsContainer}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('PENDING'); }} style={[styles.tab, activeTab === 'PENDING' && { backgroundColor: '#FF9F0A' }]}><Text style={[styles.tabText, { color: activeTab === 'PENDING' ? '#fff' : theme.subtitle }]}>Do weryfikacji</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ACTIVE'); }} style={[styles.tab, activeTab === 'ACTIVE' && { backgroundColor: '#10b981' }]}><Text style={[styles.tabText, { color: activeTab === 'ACTIVE' ? '#fff' : theme.subtitle }]}>Aktywne</Text></Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setActiveTab('ARCHIVED'); }} style={[styles.tab, activeTab === 'ARCHIVED' && { backgroundColor: '#8E8E93' }]}><Text style={[styles.tabText, { color: activeTab === 'ARCHIVED' ? '#fff' : theme.subtitle }]}>Zarchiwizowane</Text></Pressable>
        </View>
        <View
          style={[styles.adminTxFilterRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
          onLayout={(e) => setTxFilterContainerWidth(e.nativeEvent.layout.width - 8)}
        >
          {txFilterSegmentWidth > 0 && (
            <Animated.View
              style={[
                styles.adminTxFilterSlider,
                {
                  width: txFilterSegmentWidth,
                  transform: [{ translateX: txFilterTranslateX }],
                  backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF',
                },
              ]}
            />
          )}
          <Pressable onPress={() => { Haptics.selectionAsync(); setTransactionFilter('ALL'); }} style={styles.adminTxFilterBtn}>
            <Text style={[styles.adminTxFilterText, transactionFilter === 'ALL' && styles.adminTxFilterTextActive]}>Wszystkie</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setTransactionFilter('SELL'); }} style={styles.adminTxFilterBtn}>
            <Text style={[styles.adminTxFilterText, transactionFilter === 'SELL' && styles.adminTxFilterTextActive]}>Sprzedaż</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setTransactionFilter('RENT'); }} style={styles.adminTxFilterBtn}>
            <Text style={[styles.adminTxFilterText, transactionFilter === 'RENT' && styles.adminTxFilterTextActive]}>Wynajem</Text>
          </Pressable>
        </View>
        {activeTab === 'PENDING' && offers.length > 0 && (
          <View style={[styles.adminPendingInfo, { backgroundColor: isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.10)', borderColor: 'rgba(255,159,10,0.35)' }]}>
            <Ionicons name="notifications" size={16} color="#FF9F0A" />
            <Text style={styles.adminPendingInfoText}>
              {offers.length} {offers.length === 1 ? 'oferta czeka na weryfikację' : 'ofert czeka na weryfikację'}
            </Text>
          </View>
        )}
        {loading ? <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} /> : <FlatList data={filteredOffers} keyExtractor={item => item.id.toString()} renderItem={renderOffer} contentContainerStyle={{ padding: 20 }} ListEmptyComponent={<Text style={{ color: theme.subtitle, textAlign: 'center', marginTop: 50 }}>Brak ofert dla tego filtra.</Text>} />}
      </View>
    </Modal>
  );
};

const AdminRadarAnalyticsModal = ({ visible, onClose, theme }) => {
  const { token } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isDark = theme.glass === 'dark';
  const { width } = Dimensions.get('window');

  const fetchAnalytics = async () => {
    if (!token) {
      setFetchError('Brak sesji — zaloguj się ponownie.');
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/radar-analytics`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setData(json.radar || {});
      } else {
        setData(null);
        setFetchError(String(json?.message || json?.error || `Serwer: ${res.status}`).trim() || 'Nie udało się pobrać analityki.');
      }
    } catch {
      setData(null);
      setFetchError('Brak połączenia z serwerem.');
    } finally {
    setLoading(false);
    }
  };

  useEffect(() => { if (visible) fetchAnalytics(); }, [visible, token]);

  const kpis = data?.kpis || {};
  const pushActive = Number(kpis.pushActive || 0);
  const preferencesTotal = Number(kpis.preferencesTotal || 0);
  const notificationsTotal = Number(kpis.notificationsTotal || 0);
  const notificationsFailed = Number(kpis.notificationsFailed || 0);
  const pushFailureRate = notificationsTotal > 0 ? (notificationsFailed / notificationsTotal) * 100 : 0;
  const pushHealthRate = Math.max(0, 100 - pushFailureRate);
  const thresholdBands = data?.thresholdBands || {};
  const thresholdRows = [
    { label: '100% (Ultra strict)', value: Number(thresholdBands.strict100 || 0), color: '#FF2D55' },
    { label: '85-99%', value: Number(thresholdBands.high85_99 || 0), color: '#AF52DE' },
    { label: '70-84%', value: Number(thresholdBands.medium70_84 || 0), color: '#0A84FF' },
    { label: '50-69%', value: Number(thresholdBands.broad50_69 || 0), color: '#34C759' },
  ];
  const thresholdMax = Math.max(1, ...thresholdRows.map((r) => r.value));
  const cityRows = Array.isArray(data?.cityDistribution) ? data.cityDistribution : [];
  const cityMax = Math.max(1, ...cityRows.map((r) => Number(r?.count || 0)));

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Analityka Radaru</Text>
          <Pressable onPress={onClose}><Ionicons name="close-circle" size={32} color={theme.subtitle} /></Pressable>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 50 }} />
        ) : fetchError ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
            <View style={[styles.adminInlineError, { borderColor: 'rgba(255,59,48,0.35)', backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)' }]}>
              <Ionicons name="alert-circle" size={22} color="#FF3B30" />
              <Text style={[styles.adminInlineErrorText, { color: theme.text }]}>{fetchError}</Text>
            </View>
            <Pressable
              onPress={() => void fetchAnalytics()}
              style={({ pressed }) => [styles.adminRetryBtn, pressed && { opacity: 0.88 }]}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.adminRetryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            <View style={[styles.analyticsHero, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.analyticsHeroTitle, { color: theme.text }]}>Radar Control Center</Text>
              <Text style={styles.analyticsHeroSubtitle}>Monitoring jakości wysyłki, progów dopasowania i aktywności miast.</Text>
              <View style={styles.analyticsHealthRow}>
                <Text style={[styles.analyticsHealthLabel, { color: theme.subtitle }]}>Zdrowie push</Text>
                <Text style={[styles.analyticsHealthValue, { color: pushHealthRate >= 95 ? '#34C759' : pushHealthRate >= 85 ? '#FF9F0A' : '#FF3B30' }]}>
                  {pushHealthRate.toFixed(1)}%
                </Text>
              </View>
              <View style={[styles.analyticsHealthTrack, { backgroundColor: isDark ? '#2C2C2E' : '#ECECEC' }]}>
                <View
                  style={[
                    styles.analyticsHealthFill,
                    { width: `${Math.max(3, Math.min(100, pushHealthRate))}%`, backgroundColor: pushHealthRate >= 95 ? '#34C759' : pushHealthRate >= 85 ? '#FF9F0A' : '#FF3B30' },
                  ]}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Aktywne radary push', value: pushActive, color: '#AF52DE' },
                { label: 'Preferencje', value: preferencesTotal, color: '#007AFF' },
                { label: 'Notyfikacje', value: notificationsTotal, color: '#FF2D55' },
                { label: 'Błędy', value: notificationsFailed, color: '#FF3B30' },
              ].map((k, idx) => (
                <View key={idx} style={{ width: (width - 16 * 2 - 12) / 2, padding: 14, borderRadius: 18, backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <Text style={{ color: theme.subtitle, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{k.label}</Text>
                  <Text style={{ color: k.color, fontSize: 26, fontWeight: '900', marginTop: 6 }}>{k.value}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Rozkład progów dopasowania</Text>
            <View style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              {thresholdRows.map((row, idx) => (
                <View key={idx} style={{ paddingVertical: 10, borderBottomWidth: idx === thresholdRows.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Text style={{ color: theme.subtitle, fontWeight: '700' }}>{row.label}</Text>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{row.value}</Text>
                  </View>
                  <View style={{ height: 7, borderRadius: 999, backgroundColor: isDark ? '#2C2C2E' : '#ECECEC', overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.max(2, (row.value / thresholdMax) * 100)}%`, borderRadius: 999, backgroundColor: row.color }} />
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Top miasta</Text>
            <View style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              {cityRows.length === 0 ? (
                <Text style={{ color: theme.subtitle, textAlign: 'center' }}>Brak danych miast.</Text>
              ) : cityRows.map((row, idx) => (
                <View key={idx} style={{ paddingVertical: 10, borderBottomWidth: idx === (cityRows.length - 1) ? 0 : StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{row.city}</Text>
                  <Text style={{ color: theme.subtitle, fontWeight: '900' }}>{row.count}</Text>
                  </View>
                  <View style={{ height: 7, borderRadius: 999, backgroundColor: isDark ? '#2C2C2E' : '#ECECEC', overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.max(2, (Number(row?.count || 0) / cityMax) * 100)}%`, borderRadius: 999, backgroundColor: '#30B0C7' }} />
                  </View>
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
    <Modal visible animationType="slide" presentationStyle="pageSheet">
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

/** Cienka brama auth — stała liczba hooków; pełny profil w osobnym komponencie. */
export default function ProfileScreen({
  theme,
  tabRouteParams,
}: {
  theme: any;
  tabRouteParams?: {
    authIntent?: 'login' | 'register';
    openManageListings?: boolean;
    prefillEmail?: string;
  };
}) {
  const route = useRoute<any>();
  const authIntent = (tabRouteParams?.authIntent ?? route.params?.authIntent) as
    | 'login'
    | 'register'
    | undefined;
  const prefillEmail = String(
    tabRouteParams?.prefillEmail ?? route.params?.prefillEmail ?? '',
  ).trim();
  const openManageListings = Boolean(
    tabRouteParams?.openManageListings ?? route.params?.openManageListings,
  );
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <AuthScreen
        theme={theme}
        authIntent={authIntent}
        prefillEmail={prefillEmail || undefined}
        embedded
      />
    );
  }

  return <ProfileScreenLoggedIn theme={theme} openManageListingsOnMount={openManageListings} />;
}

function ProfileScreenLoggedIn({
  theme,
  openManageListingsOnMount = false,
}: {
  theme: any;
  openManageListingsOnMount?: boolean;
}) {
  const { t, locale } = useI18n();
  const dateLocale = localeToDateFormat(locale);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isProfileTabFocused = useIsFocused();
  const { user, logout, updateAvatar, token, deleteAccount, refreshUser } = useAuthStore();
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);
  const displayCurrency = useDisplayCurrencyStore((s) => s.preference);
  const setDisplayCurrency = useDisplayCurrencyStore((s) => s.setPreference);
  const hydrateDisplayCurrency = useDisplayCurrencyStore((s) => s.hydrate);
  const localePreference = useAppLocaleStore((s) => s.preference);
  const setLocalePreference = useAppLocaleStore((s) => s.setPreference);
  const isDark = theme.glass === 'dark';

  const languageActiveHint = useMemo(() => {
    if (localePreference === 'system') {
      const device = getDeviceAppLocale();
      return t('profile.language.systemHint', {
        language: t(`profile.language.labels.${device}`),
      });
    }
    return t(`profile.language.labels.${localePreference}`);
  }, [localePreference, locale, t]);

  useEffect(() => {
    void hydrateDisplayCurrency();
  }, [hydrateDisplayCurrency]);
  
  const [isMyOffersVisible, setIsMyOffersVisible] = useState(false);

  const openManageListingsFromRoute = useCallback(() => {
    setIsMyOffersVisible(true);
    navigation.setParams({ openManageListings: undefined });
  }, [navigation]);

  useEffect(() => {
    if (!openManageListingsOnMount) return;
    openManageListingsFromRoute();
  }, [openManageListingsOnMount, openManageListingsFromRoute]);

  useFocusEffect(
    useCallback(() => {
      if (!route.params?.openManageListings) return;
      openManageListingsFromRoute();
    }, [openManageListingsFromRoute, route.params?.openManageListings]),
  );

  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isAdminOffersVisible, setIsAdminOffersVisible] = useState(false);
  const [isAdminUsersVisible, setIsAdminUsersVisible] = useState(false);
  const [isAdminRadarVisible, setIsAdminRadarVisible] = useState(false);
  const [isAdminStatisticsVisible, setIsAdminStatisticsVisible] = useState(false);
  const [isAdminDealroomCheckVisible, setIsAdminDealroomCheckVisible] = useState(false);
  const [isAdminLegalVerifyVisible, setIsAdminLegalVerifyVisible] = useState(false);
  const [isAdminCoreVisible, setIsAdminCoreVisible] = useState(false);
  const [isAdminReportsVisible, setIsAdminReportsVisible] = useState(false);
  const [isAdminPromoWindowsVisible, setIsAdminPromoWindowsVisible] = useState(false);
  const [userPromoCards, setUserPromoCards] = useState<ProfilePromoCardRecord[]>([]);
  const [dismissedPromoIds, setDismissedPromoIds] = useState<Set<string>>(() => new Set());
  const [adminPendingLegalCount, setAdminPendingLegalCount] = useState(0);
  const [adminPendingReportsCount, setAdminPendingReportsCount] = useState(0);
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminPendingOffersCount, setAdminPendingOffersCount] = useState(0);
  const [isSmsEnabled, setIsSmsEnabled] = useState(true);
  const [isOwnPublicProfileOpen, setIsOwnPublicProfileOpen] = useState(false);
  const [ownPublicProfile, setOwnPublicProfile] = useState(null);
  const [ownPublicProfileLoading, setOwnPublicProfileLoading] = useState(false);
  const [publicModalViewUserId, setPublicModalViewUserId] = useState<number | null>(null);
  const [publicModalViewData, setPublicModalViewData] = useState(null);
  const [publicModalViewLoading, setPublicModalViewLoading] = useState(false);
  const [publicModalStack, setPublicModalStack] = useState<number[]>([]);
  // Case-insensitive — backend mógł zwrócić 'admin' / 'Admin' / 'ADMIN'.
  const isZarzad = String(user?.role || '').trim().toUpperCase() === 'ADMIN';

  const [isDeleteAccountVisible, setIsDeleteAccountVisible] = useState(false);
  const [isBlockedUsersVisible, setIsBlockedUsersVisible] = useState(false);
  const blockedUsersCount = useBlockedUsersStore((s) => s.blockedIds.size);
  const [isEditNameVisible, setIsEditNameVisible] = useState(false);
  const [isEditPhoneVisible, setIsEditPhoneVisible] = useState(false);
  const [isEditEmailVisible, setIsEditEmailVisible] = useState(false);
  const proExpiryMsForDelete = user?.proExpiresAt ? new Date(user.proExpiresAt).getTime() : null;
  const hasPaidIndicators =
    !!user?.isPro ||
    user?.planType === 'PRO' ||
    user?.planType === 'AGENCY' ||
    (proExpiryMsForDelete != null && proExpiryMsForDelete > Date.now());

  // --- LOGIKA KLAWISZA PASSKEY (Z PAMIĘCIĄ LOCALSTORAGE) ---
  const [isPasskeyActive, setIsPasskeyActive] = useState(false);
  /**
   * „Przywróć zakupy" — App Store Review Guideline 3.1.1 wymaga
   * widocznego przycisku w każdej aplikacji oferującej IAP. Przycisk
   * woła `IAPManager.restorePurchases()`, który drenuje historię z
   * App Store / Google Play i zgłasza ponownie do backendu (idempotentnie
   * po `transactionId`). Stan trzymamy lokalnie, żeby pokazać spinner
   * w trakcie operacji (Apple lubi wizualne potwierdzenie).
   */
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [isBuyingPakietPlus, setIsBuyingPakietPlus] = useState(false);
  const [isBuyingInvestorPro, setIsBuyingInvestorPro] = useState(false);
  const [investorProListing, setInvestorProListing] = useState<SubscriptionStoreListing | null>(null);
  const adminPendingRef = useRef<number | null>(null);
  /** Zapobiega nakładaniu się dwóch Modal z listą użytkowników i kartą profilu (iOS psuje dotyk). */
  const adminUsersReturnRef = useRef(false);

  useEffect(() => {
    const checkServerPasskeyStatus = async () => {
      if (!user?.id || !token) return;
      try {
        // 1. Szybki odczyt z pamięci (żeby uniknąć "mrugania" gałki przy wejściu)
        const saved = await AsyncStorage.getItem(`@passkey_${user.id}`);
        if (saved === 'active') setIsPasskeyActive(true);

        // 2. Serwer — wcześniej wymagano pola `success`, więc przy samym `hasPasskey` stan się nie aktualizował:
        //    UI pokazywało „wyłączone”, a logowanie Passkey nadal działało.
        const serverHas = await PasskeyService.fetchHasPasskey(token, String(user.id));
        if (serverHas !== null) {
          setIsPasskeyActive(serverHas);
          if (serverHas) {
            await markPasskeyEnabledForUser(user.id);
          } else {
            await AsyncStorage.removeItem(`@passkey_${user.id}`);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('Błąd weryfikacji statusu klucza:', e);
      }
    };
    
    checkServerPasskeyStatus();
  }, [user?.id, token]);

  const refreshAdminPendingOffers = async () => {
    if (!isZarzad || !token) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/offers?status=PENDING`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = Array.isArray(data?.offers)
        ? data.offers
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
            ? data.items
            : [];
      const nextCount = list.length;
      setAdminPendingOffersCount(nextCount);
      const prev = adminPendingRef.current;
      if (prev != null && nextCount > prev) {
        Alert.alert(
          'Nowe ogłoszenie do weryfikacji',
          nextCount === 1
            ? 'W panelu administratora czeka 1 ogłoszenie do akceptacji.'
            : `W panelu administratora czeka ${nextCount} ogłoszeń do akceptacji.`
        );
      }
      adminPendingRef.current = nextCount;
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!isZarzad) return;
    refreshAdminPendingOffers();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAdminPendingOffers();
    });
    return () => sub.remove();
  }, [isZarzad, token]);

  /**
   * Licznik PENDING zgłoszeń weryfikacji prawnej (KW + nr lokalu).
   * Trzymamy go analogicznie do `adminPendingOffersCount`, żeby admin
   * zaraz po wejściu w Profil widział czerwony badge przy nowej pozycji
   * „Weryfikacja prawna". Refresh przy aktywacji aplikacji + manualny
   * callback z modala (po accept/reject natychmiast aktualizujemy licznik).
   */
  const refreshAdminPendingLegalVerifications = async () => {
    if (!isZarzad) return;
    try {
      const items = await fetchAdminLegalVerificationQueue('PENDING', token);
      setAdminPendingLegalCount(items.length);
    } catch {
      // noop — brak końcówki po stronie back-endu nie powinien wywalić Profilu
    }
  };

  const refreshAdminPendingReports = async () => {
    if (!isZarzad || !token) return;
    try {
      const { counts } = await fetchAdminContentReports(token, { status: 'PENDING', targetType: 'ALL' });
      setAdminPendingReportsCount(counts.pending);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (!isZarzad) return;
    refreshAdminPendingLegalVerifications();
    void refreshAdminPendingReports();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshAdminPendingLegalVerifications();
        void refreshAdminPendingReports();
      }
    });
    return () => sub.remove();
  }, [isZarzad, token]);

  const adminProfileTabBadgeTotal = isZarzad
    ? adminPendingOffersCount + adminPendingReportsCount + adminPendingLegalCount
    : 0;

  useEffect(() => {
    useProfileTabBadgeStore.getState().setProfilePendingCount(adminProfileTabBadgeTotal);
  }, [adminProfileTabBadgeTotal]);

  useEffect(() => {
    if (!isZarzad) return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification?.request?.content?.data || {}) as Record<string, unknown>;
      if (String(data?.kind || data?.notificationType || '').toLowerCase() !== 'admin_attention') return;
      void refreshAdminPendingOffers();
      void refreshAdminPendingLegalVerifications();
      void refreshAdminPendingReports();
    });
    return () => sub.remove();
  }, [isZarzad, token]);

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
        Alert.alert(
          t('profile.security.alerts.cancelledTitle'),
          error.message || t('profile.security.alerts.setupFailed'),
        );
      }
    } else {
      Alert.alert(t('profile.security.alerts.removeKeyTitle'), t('profile.security.alerts.removeKeyBody'), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => {
            setIsPasskeyActive(false);
            setTimeout(() => setIsPasskeyActive(true), 50);
        }},
        { 
          text: t('profile.security.alerts.disable'), 
          style: 'destructive', 
          onPress: async () => {
            try {
              await PasskeyService.revoke(token, String(user.id));
              const outcome = await PasskeyService.confirmPasskeyRemoved(token, String(user.id));
              if (outcome === 'still') {
                throw new Error(t('profile.security.alerts.stillActive'));
              }
              if (outcome === 'unknown') {
                if (__DEV__) console.warn('[Passkey] Nie udało się odczytać statusu po revoke — zakładam sukces operacji.');
              }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsPasskeyActive(false);
              await clearPasskeyLocalForUser(user.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                t('profile.security.alerts.disableFailedTitle'),
                String(err?.message || '').trim() ||
                  t('profile.security.alerts.disableFailedBody'),
              );
            }
          }
        }
      ]);
    }
  };

  useEffect(() => {
    if (isZarzad) {
      fetch(`${API_URL}/api/admin/settings`)
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

  const loadPublicModalView = async (userId: number) => {
    if (!userId) return;
    setPublicModalViewLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/public`);
      const data = await res.json();
      if (res.ok && !data?.error) {
        setPublicModalViewData(data);
      }
    } catch (_e) {
      // noop
    } finally {
      setPublicModalViewLoading(false);
    }
  };

  const openPublicProfileModal = (userId?: number) => {
    const id = Number(userId || user?.id);
    if (!id) return;
    Haptics.selectionAsync();
    setPublicModalStack([]);
    setPublicModalViewUserId(id);
    setPublicModalViewData(null);
    setIsOwnPublicProfileOpen(true);
    void loadPublicModalView(id);
  };

  const openReviewerInPublicModal = (reviewerId: number) => {
    if (!reviewerId || reviewerId === publicModalViewUserId) return;
    Haptics.selectionAsync();
    setPublicModalStack((prev) => [...prev, Number(publicModalViewUserId)]);
    setPublicModalViewUserId(reviewerId);
    setPublicModalViewData(null);
    void loadPublicModalView(reviewerId);
  };

  const goBackPublicModal = () => {
    const prev = publicModalStack[publicModalStack.length - 1];
    if (!prev) return;
    Haptics.selectionAsync();
    setPublicModalStack((s) => s.slice(0, -1));
    setPublicModalViewUserId(prev);
    setPublicModalViewData(null);
    void loadPublicModalView(prev);
  };

  const closePublicProfileModal = () => {
    setIsOwnPublicProfileOpen(false);
    setPublicModalStack([]);
    setPublicModalViewUserId(null);
    setPublicModalViewData(null);
  };

  useEffect(() => {
    fetchOwnPublicProfile();
  }, [user?.id]);

  const reloadUserPromoCards = useCallback(async () => {
    if (!token || !user?.id) {
      setUserPromoCards([]);
      return;
    }
    const legacyUsed =
      (user as any)?.firstFreePublicationUsed === true ||
      (user as any)?.first_free_publication_used === true;
    const cards = await fetchUserProfilePromoCards(token, user.id, {
      email: user.email,
      firstFreePublicationUsed: legacyUsed ? true : false,
    });
    setUserPromoCards(cards);
  }, [token, user?.id, user?.email, t]);

  useFocusEffect(
    useCallback(() => {
      void reloadUserPromoCards();
    }, [reloadUserPromoCards]),
  );

  useFocusEffect(
    useCallback(() => {
      if (hasActiveInvestorProMembership(user)) return;
      let cancelled = false;
      void (async () => {
        const listing = await fetchInvestorProStoreListing();
        if (!cancelled) setInvestorProListing(listing);
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  useEffect(() => {
    if (!user?.id) {
      setDismissedPromoIds(new Set());
      return;
    }
    void loadDismissedProfilePromoIds(user.id).then(setDismissedPromoIds);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeProfilePromoCouponUsed((uid, cardId) => {
      if (String(uid) !== String(user.id)) return;
      setUserPromoCards((prev) => patchPromoCardCouponUsed(prev, cardId));
    });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadPromos = async () => {
      if (!token || !user?.id) {
        if (!cancelled) setUserPromoCards([]);
        return;
      }
      const legacyUsed =
        (user as any)?.firstFreePublicationUsed === true ||
        (user as any)?.first_free_publication_used === true;
      const cards = await fetchUserProfilePromoCards(token, user.id, {
        email: user.email,
        firstFreePublicationUsed: legacyUsed ? true : false,
      });
      if (!cancelled) {
        setUserPromoCards(cards);
      }
    };
    void loadPromos();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadPromos();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [token, user?.id, user?.email, t]);

  const handleRequestDismissPromoCard = useCallback(
    (card: ProfilePromoCardRecord) => {
      if (!user?.id) return;
      Alert.alert(
        t('profile.shop.promoDismissTitle'),
        t('profile.shop.promoDismissBody', { title: card.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile.shop.promoDismissConfirm'),
            style: 'destructive',
            onPress: () => {
              void dismissProfilePromoCardForever(user.id, card.id).then(() => {
                setDismissedPromoIds((prev) => new Set([...prev, card.id]));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              });
            },
          },
        ],
      );
    },
    [user?.id, t],
  );

  const [profileShellReady, setProfileShellReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => setProfileShellReady(true));
    });
    return () => handle.cancel();
  }, []);

  const dismissProfileOverlays = useCallback(() => {
    setIsMyOffersVisible(false);
    setIsNotificationsVisible(false);
    setIsAdminOffersVisible(false);
    setIsAdminUsersVisible(false);
    setIsAdminRadarVisible(false);
    setIsAdminDealroomCheckVisible(false);
    setIsAdminLegalVerifyVisible(false);
    setIsAdminCoreVisible(false);
    setIsAdminReportsVisible(false);
    setIsAdminPromoWindowsVisible(false);
    setIsOwnPublicProfileOpen(false);
    setIsDeleteAccountVisible(false);
    setIsBlockedUsersVisible(false);
    setIsEditNameVisible(false);
    setIsEditPhoneVisible(false);
    setIsEditEmailVisible(false);
    setAdminSelectedUser(null);
  }, []);

  const handleLogout = () => {
    Alert.alert(t('profile.session.logoutConfirmTitle'), t('profile.session.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.session.logoutAction'),
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismissProfileOverlays();
          InteractionManager.runAfterInteractions(() => {
            void (async () => {
              try {
                (navigation as any).navigate('Radar');
              } catch {
                // noop
              }
              await logout();
            })();
          });
        },
      },
    ]);
  };

  const plusSlots = Math.max(0, Math.floor(Number((user as any)?.extraListings || 0)));
  const plusExpiresAtRaw = String((user as any)?.plusExpiresAt || '').trim();
  const plusExpiresAtMs = plusExpiresAtRaw ? new Date(plusExpiresAtRaw).getTime() : null;
  const plusHasValidExpiry = plusExpiresAtMs != null && Number.isFinite(plusExpiresAtMs);
  const plusDaysLeft = plusHasValidExpiry ? Math.max(0, Math.ceil((plusExpiresAtMs! - Date.now()) / 86400000)) : null;
  const hasPlusPublicationAvailable =
    !!user &&
    plusSlots > 0 &&
    plusHasValidExpiry &&
    (plusExpiresAtMs ?? 0) > Date.now();
  const plusCounterLabel = hasPlusPublicationAvailable
    ? plusSlots === 1
      ? t('profile.shop.plusSlotOne')
      : t('profile.shop.plusSlotsMany', { count: plusSlots })
    : t('profile.shop.noPackages');
  const plusExpiryLabel = plusHasValidExpiry
    ? new Date(plusExpiresAtMs!).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const plusDaysLabel =
    plusDaysLeft == null
      ? t('profile.shop.plusDaysDefault')
      : plusDaysLeft === 0
        ? t('profile.shop.plusDaysToday')
        : t('profile.shop.plusDaysLeft', {
            days: plusDaysLeft,
            daysLabel: plusDaysLeft === 1 ? t('profile.shop.dayOne') : t('profile.shop.dayMany'),
          });

  const bonusCouponCards = useMemo(
    () => {
      if (!user) return [];
      return buildBonusCouponStack({
        t,
        adminPromos: userPromoCards,
        dismissedIds: dismissedPromoIds,
      });
    },
    [user?.id, t, userPromoCards, dismissedPromoIds],
  );

  const plusExpiryLine =
    hasPlusPublicationAvailable && plusExpiryLabel
      ? t('profile.shop.plusValidUntil', { date: plusExpiryLabel })
      : null;

  const hasInvestorProActive = hasActiveInvestorProMembership(user);
  const investorProCountdown = buildProMembershipCountdown((user as any)?.proExpiresAt);
  const investorProExpiryLabel = investorProCountdown
    ? new Date(investorProCountdown.expiresAtMs).toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;
  const investorProStatusLabel = hasInvestorProActive
    ? t('profile.shop.investorProActive')
    : t('profile.shop.investorProInactive');
  const investorProMetaLabel = hasInvestorProActive
    ? [
        investorProCountdown
          ? t('profile.shop.investorProDaysLeft', {
              days: investorProCountdown.daysLeft,
              daysLabel:
                investorProCountdown.daysLeft === 1 ? t('profile.shop.dayOne') : t('profile.shop.dayMany'),
            })
          : null,
        t('profile.shop.investorProSubscriptionMeta'),
      ]
        .filter(Boolean)
        .join('\n')
    : t('profile.shop.investorProMeta');
  const investorProExpiryLine =
    hasInvestorProActive && investorProExpiryLabel
      ? t('profile.shop.investorProValidUntil', { date: investorProExpiryLabel })
      : null;
  const investorProTrialBadge = !hasInvestorProActive ? t('profile.shop.investorProTrialBadge') : null;
  const investorProPriceLine =
    !hasInvestorProActive && investorProListing?.priceLabel
      ? t('profile.shop.investorProTrialPriceAfter', { price: investorProListing.priceLabel })
      : !hasInvestorProActive
        ? t('profile.shop.investorProTrialPriceFallback')
        : null;
  const investorProBuySubtitle = hasInvestorProActive
    ? t('profile.shop.buyInvestorProSubtitle')
    : t('profile.shop.buyInvestorProTrialSubtitle');

  const toggleSms = async (value) => {
    setIsSmsEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(`${API_URL}/api/admin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enable: value }) });
    } catch (e) {
      Alert.alert("Błąd", "Nie udało się zsynchronizować ustawień.");
    }
  };

  if (!profileShellReady) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const handleAvatarPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0].uri) {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 500, height: 500 } }], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
        const formData = new FormData();
        formData.append('userId', String(user.id));
        formData.append('file', { uri: manipResult.uri, name: `avatar_${user.id}.jpg`, type: 'image/jpeg' } as any);

        const res = await fetch(`${API_URL}/api/mobile/v1/user/avatar`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          Alert.alert(
            t('common.error'),
            [data?.message, data?.error].find((x) => typeof x === 'string' && String(x).trim()) ||
              t('profile.session.alerts.avatarUploadFailed', { status: res.status }),
          );
          return;
        }
        const rel =
          (typeof data.url === 'string' && data.url) ||
          (typeof data.avatarUrl === 'string' && data.avatarUrl) ||
          (typeof data.avatar === 'string' && data.avatar) ||
          (typeof data.path === 'string' && data.path) ||
          (typeof data?.data?.url === 'string' && data.data.url) ||
          '';
        const explicitFail = data?.success === false || data?.ok === false;
        if (explicitFail || !rel) {
          Alert.alert(t('common.error'), t('profile.session.alerts.avatarNotSaved'));
          return;
        }
        const finalUrl = /^https?:\/\//i.test(rel) ? rel : rel.startsWith('/') ? `${API_URL}${rel}` : `${API_URL}/${rel}`;
        await updateAvatar?.(finalUrl);
        await refreshUser?.();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        Alert.alert(t('common.error'), t('profile.session.alerts.avatarProblem'));
      }
    }
  };

  /**
   * Restore Purchases — pobiera historię z App Store / Google Play i
   * przepuszcza ją przez backend (idempotentnie). Dla pure-consumable
   * (jak Pakiet Plus 30d) Apple zwraca pustą listę, ale przycisk musi
   * istnieć i działać — wymóg Review Guideline 3.1.1.
   */
  const handleRestorePurchases = async () => {
    if (isRestoringPurchases) return;
    setIsRestoringPurchases(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await restorePakietPlusPurchases();
      if (result.ok) {
        if (result.restored > 0) {
          await refreshUser?.();
          Alert.alert(
            t('profile.shop.alerts.restoreTitle'),
            result.restored === 1
              ? t('profile.shop.alerts.restoreBodyOne')
              : t('profile.shop.alerts.restoreBodyMany', { count: result.restored }),
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (
          result.subscriptionConflict ||
          investorProSubscriptionNeedsTransfer(result.errorCode, result.message)
        ) {
          void promptInvestorProTransferFlow(hasActiveInvestorProMembership(user), 'restore', setIsRestoringPurchases);
        } else if (hasActiveInvestorProMembership(user)) {
          Alert.alert(
            t('profile.shop.alerts.investorProAlreadyActiveTitle'),
            t('profile.shop.alerts.investorProRestoreNoAppleSubBody'),
          );
        } else {
          const syncResult = await syncInvestorProEntitlement();
          await refreshUser?.();
          const syncedUser = useAuthStore.getState().user;
          if (syncResult.ok || hasActiveInvestorProMembership(syncedUser)) {
            if (syncResult.ok) {
              await applyInvestorProPurchaseResult(syncResult, false);
            } else {
              Alert.alert(
                t('profile.shop.alerts.investorProActiveTitle'),
                t('profile.shop.alerts.investorProActivePending'),
              );
            }
          } else if (
            investorProSubscriptionNeedsTransfer(syncResult.errorCode, syncResult.message)
          ) {
            void promptInvestorProTransferFlow(false, 'restore', setIsRestoringPurchases);
          } else {
            Alert.alert(
              t('profile.shop.alerts.nothingToRestoreTitle'),
              t('profile.shop.alerts.nothingToRestoreBody'),
            );
          }
        }
      } else {
        Alert.alert(t('profile.shop.alerts.restoreFailedTitle'), result.message || t('profile.shop.alerts.restoreFailedBody'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  /**
   * Bezpośredni zakup z sekcji „Zakupy i sklep" — żeby reviewer i użytkownik
   * mogli uruchomić StoreKit bez konieczności przechodzenia przez flow oferty.
   */
  const handleBuyPakietPlus = async () => {
    if (isBuyingPakietPlus) return;
    if (!token) {
      Alert.alert(t('profile.shop.alerts.loginRequiredTitle'), t('profile.shop.alerts.loginRequiredBody'));
      return;
    }

    setIsBuyingPakietPlus(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await purchasePakietPlusConsumable(API_URL, token);
      if (result.cancelled) return;
      if (!result.ok) {
        Alert.alert(t('profile.shop.alerts.purchaseTitle'), result.message || t('profile.shop.alerts.purchaseFailed'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await refreshUser?.();
      const patched = userAfterPakietPlusPurchase(useAuthStore.getState().user, {
        backendRegistered: Boolean(result.backendRegistered),
        extraListings: result.extraListings,
      });
      if (patched) {
        useAuthStore.setState({ user: { ...useAuthStore.getState().user, ...patched } });
      }

      const slotsAfter = Math.max(0, Number((patched as any)?.extraListings ?? 0));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('profile.shop.alerts.plusActiveTitle'),
        slotsAfter > 0
          ? slotsAfter === 1
            ? t('profile.shop.alerts.plusActiveSlotsOne')
            : t('profile.shop.alerts.plusActiveSlotsMany', { count: slotsAfter })
          : t('profile.shop.alerts.plusActivePending'),
      );
    } finally {
      setIsBuyingPakietPlus(false);
    }
  };

  const applyInvestorProPurchaseResult = async (
    result: Extract<Awaited<ReturnType<typeof purchaseInvestorProSubscription>>, { ok: true }>,
    hadProBeforePurchase: boolean,
  ) => {
    await refreshUser?.();
    const patched = userAfterInvestorProPurchase(useAuthStore.getState().user, {
      backendRegistered: Boolean(result.backendRegistered),
      isPro: result.isPro,
      proExpiresAt: result.proExpiresAt,
      extraListings: result.extraListings,
      plusExpiresAt: result.plusExpiresAt,
      syncedExistingSubscription: result.syncedExistingSubscription,
      subscriptionTransferred: result.subscriptionTransferred,
    });
    if (patched) {
      const merged = { ...useAuthStore.getState().user!, ...patched };
      useAuthStore.setState({ user: merged });
      await AsyncStorage.setItem('user_data', JSON.stringify(merged));
    }

    const mergedUser = patched ?? useAuthStore.getState().user;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const alertCopy = investorProPurchaseAlertCopy(result, mergedUser, t, { hadProBeforePurchase });
    Alert.alert(alertCopy.title, alertCopy.body);
  };

  const runInvestorProTransfer = (
    setBusy: (value: boolean) => void,
    hadProBeforePurchase: boolean,
    _mode: 'restore' | 'purchase',
  ) => {
    void (async () => {
      if (!token) return;
      setBusy(true);
      try {
        const transferResult = await transferInvestorProToCurrentAccount(API_URL, token);

        if (transferResult.cancelled) return;
        if (!transferResult.ok) {
          const alertCopy = investorProPurchaseErrorAlertCopy(t, {
            errorCode: transferResult.errorCode,
            message: transferResult.message,
            alreadyHasEstateOsPro: hasActiveInvestorProMembership(useAuthStore.getState().user),
          });
          Alert.alert(alertCopy.title, alertCopy.body);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        await applyInvestorProPurchaseResult(transferResult, hadProBeforePurchase);
      } finally {
        setBusy(false);
      }
    })();
  };

  const promptInvestorProTransferFlow = async (
    hadProBeforePurchase: boolean,
    mode: 'restore' | 'purchase',
    setBusy: (value: boolean) => void,
  ) => {
    const hasAppleSub = await IAPManager.hasActiveInvestorProOnDevice();
    if (hasAppleSub) {
      promptInvestorProTransferAlert(t, () => runInvestorProTransfer(setBusy, hadProBeforePurchase, mode));
      return;
    }
    promptInvestorProReassignAndSubscribeAlert(t, () =>
      runInvestorProTransfer(setBusy, hadProBeforePurchase, 'purchase'),
    );
  };

  const handleBuyInvestorPro = async () => {
    if (isBuyingInvestorPro) return;
    if (!token) {
      Alert.alert(t('profile.shop.alerts.loginRequiredTitle'), t('profile.shop.alerts.investorProLoginBody'));
      return;
    }

    if (hasActiveInvestorProMembership(user)) {
      Alert.alert(
        t('profile.shop.alerts.investorProAlreadyActiveTitle'),
        t('profile.shop.alerts.investorProAlreadyActiveBody'),
      );
      return;
    }

    setIsBuyingInvestorPro(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hadProBeforePurchase = hasActiveInvestorProMembership(user);
    try {
      const result = await purchaseInvestorProSubscription(API_URL, token);
      if (result.cancelled) return;
      if (!result.ok) {
        if (investorProSubscriptionNeedsTransfer(result.errorCode, result.message)) {
          void promptInvestorProTransferFlow(hadProBeforePurchase, 'purchase', setIsBuyingInvestorPro);
          return;
        }
        if (isNoAppleInvestorProSubscriptionMessage(result.message)) {
          const syncResult = await syncInvestorProEntitlement();
          await refreshUser?.();
          if (syncResult.ok) {
            await applyInvestorProPurchaseResult(syncResult, hadProBeforePurchase);
            return;
          }
          if (investorProSubscriptionNeedsTransfer(syncResult.errorCode, syncResult.message)) {
            void promptInvestorProTransferFlow(hadProBeforePurchase, 'purchase', setIsBuyingInvestorPro);
            return;
          }
        }
        const alertCopy = investorProPurchaseErrorAlertCopy(t, {
          errorCode: result.errorCode,
          message: result.message,
          alreadyHasEstateOsPro: hasActiveInvestorProMembership(useAuthStore.getState().user),
        });
        Alert.alert(alertCopy.title, alertCopy.body);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await applyInvestorProPurchaseResult(result, hadProBeforePurchase);
    } finally {
      setIsBuyingInvestorPro(false);
    }
  };

  const ownReviews = Array.isArray(ownPublicProfile?.reviews) ? ownPublicProfile.reviews : [];
  const ownAverageRating = ownReviews.length > 0
    ? ownReviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) / ownReviews.length
    : 0;

  const currentEmailLcProfile = String(user?.email || '').trim().toLowerCase();
  const pendingEmailLcProfile = String((user as any)?.pendingEmail || '').trim().toLowerCase();
  const hasPendingEmailChange =
    pendingEmailLcProfile.length > 0 && pendingEmailLcProfile !== currentEmailLcProfile;
  const profileNameLocked = Boolean((user as any)?.profileNameLocked);

  const handleHeaderEditName = () => {
    Haptics.selectionAsync();
    setIsEditNameVisible(true);
  };

  const hasPhoneForSms = (() => {
    const raw = String(user?.phone || '').trim();
    if (!raw || raw === 'Brak numeru') return false;
    if (isValidPhoneNumber(raw)) return true;
    const withPlus = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
    if (isValidPhoneNumber(withPlus)) return true;
    const p = parsePhoneNumberFromString(raw, 'PL');
    return Boolean(p?.isValid());
  })();

  const profileScreenBg = isDark ? '#000' : '#F2F2F7';

  return (
    <>
      <View style={{ flex: 1, backgroundColor: profileScreenBg }} collapsable={false}>
        <ScrollView
          style={{ flex: 1, backgroundColor: profileScreenBg }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            { backgroundColor: profileScreenBg },
            !hasInvestorProActive && { paddingBottom: 220 },
          ]}
        >
        
        <ProfileCardShell isDark={isDark} variant="header" style={styles.headerCardShell} faceStyle={styles.headerCard}>
          <Pressable onPress={handleAvatarPick} style={({ pressed }) => [styles.avatarWrapper, { opacity: pressed ? 0.8 : 1 }]}>
            {(() => {
              const rawAvatar = user?.avatar || user?.image;
              const finalAvatar = rawAvatar ? (rawAvatar.startsWith('/') ? `${API_URL}${rawAvatar}` : rawAvatar) : null;
              return finalAvatar ? <Image source={{ uri: finalAvatar }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={36} color="#fff" /></View>;
            })()}
            <View style={styles.editBadge}><Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{t('profile.header.editAvatar')}</Text></View>
            <View style={styles.avatarRegionFlag} pointerEvents="none">
              <UserRegionFlag phone={user?.phone} fallbackIso={getDeviceRegionCountry()} size={30} />
            </View>
          </Pressable>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text
                style={[styles.headerName, { color: theme.text, flex: 1, minWidth: 0 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                allowFontScaling={false}
              >
                {user?.firstName || user?.email} {user?.lastName || ''}
              </Text>
            <Pressable
                onPress={handleHeaderEditName}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                style={({ pressed }) => [
                  styles.headerNameEditPaper,
                  isDark ? styles.headerNameEditPaperDark : null,
                  pressed && { opacity: 0.88 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={profileNameLocked ? t('profile.header.nameLockedA11y') : t('profile.header.editNameA11y')}
              >
                <View style={styles.headerNameEditBtn}>
                  <Ionicons
                    name="pencil"
                    size={profileNameLocked ? 17 : 19}
                    color={profileNameLocked ? (isDark ? '#636366' : '#AEAEB2') : '#0A84FF'}
                  />
                </View>
              </Pressable>
            </View>
            <EliteStatusBadges subject={user} isDark={isDark} compact />
            <Pressable
              onPress={() => openPublicProfileModal()}
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
              <Text
                style={[styles.profileRatingMetaInline, { flexShrink: 1 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                allowFontScaling={false}
              >
                {ownPublicProfileLoading
                  ? t('profile.header.reviewsLoading')
                  : t('profile.header.reviewsMeta', {
                      rating: ownAverageRating.toFixed(1),
                      count: ownReviews.length,
                    })}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#8E8E93" />
            </Pressable>
            <Text
              style={styles.headerRole}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              allowFontScaling={false}
            >
              {isZarzad
                ? 'Zarząd EstateOS™'
                : String(user?.role || '').trim().toUpperCase() === 'AGENT'
                  ? t('profile.header.roleAgent')
                  : t('profile.header.rolePrivate')}
            </Text>
            <Text
              style={styles.headerId}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              allowFontScaling={false}
            >
              {t('profile.header.userId', { id: user?.id })}
            </Text>
            <VerificationBadge
              phoneVerified={Boolean(user?.isVerifiedPhone)}
              emailVerified={Boolean(user?.isEmailVerified)}
              isDark={isDark}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!user?.isVerifiedPhone) {
                  setIsEditPhoneVisible(true);
                } else if (!user?.isEmailVerified || hasPendingEmailChange) {
                  setIsEditEmailVisible(true);
                } else {
                  openPublicProfileModal();
                }
              }}
            />
          </View>
        </ProfileCardShell>

        <View style={styles.section}>
            <ProfileProExtrasSection
              user={user}
              isDark={isDark}
              onFeaturePress={(featureId) => {
                if (featureId === 'insider') {
                  (navigation as any).navigate('AdminNativeImport');
                  return;
                }
                if (featureId === 'openHouse') {
                  (navigation as any).navigate('OpenHouseHub');
                  return;
                }
                if (featureId === 'auction') {
                  (navigation as any).navigate('AuctionHub');
                }
              }}
            />
          </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.contact.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <ListItem
              icon="call"
              color="#34C759"
              title={t('profile.contact.phone')}
              value={user?.phone || t('profile.contact.none')}
              subtitle={user?.isVerifiedPhone ? t('profile.contact.confirmed') : undefined}
              subtitleNode={
                user?.isVerifiedPhone ? undefined : hasPhoneForSms ? (
                  <Text
                    style={styles.listSubtitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    <Text style={{ color: '#FF3B30', fontWeight: '700' }}>{t('profile.contact.unconfirmed')}</Text>
                    {t('profile.contact.tapVerifyPhone')}
                  </Text>
                ) : (
                  <Text
                    style={styles.listSubtitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    <Text style={{ color: '#FF3B30', fontWeight: '700' }}>{t('profile.contact.noNumber')}</Text>
                    {t('profile.contact.tapAddPhone')}
                  </Text>
                )
              }
              onPress={
                user?.isVerifiedPhone
                  ? undefined
                  : () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditPhoneVisible(true);
                    }
              }
              isDark={isDark}
            />
            <ListItem
              icon="mail"
              color="#007AFF"
              title={t('profile.contact.email')}
              value={user?.email || '—'}
              subtitle={user?.isEmailVerified && !hasPendingEmailChange ? t('profile.contact.confirmed') : undefined}
              subtitleNode={
                user?.isEmailVerified && !hasPendingEmailChange ? undefined : hasPendingEmailChange ? (
                  <Text
                    style={styles.listSubtitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    <Text style={{ color: '#FF9500', fontWeight: '700' }}>{t('profile.contact.pendingCode')}</Text>
                    {t('profile.contact.tapFinishEmail')}
                  </Text>
                ) : (
                  <Text
                    style={styles.listSubtitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    allowFontScaling={false}
                  >
                    <Text style={{ color: '#FF3B30', fontWeight: '700' }}>{t('profile.contact.unconfirmed')}</Text>
                    {t('profile.contact.tapConfirmEmail')}
                  </Text>
                )
              }
              onPress={
                user?.isEmailVerified && !hasPendingEmailChange
                  ? undefined
                  : () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditEmailVisible(true);
                    }
              }
              isLast={true}
              isDark={isDark}
            />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.properties.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <ListItem icon="home" color="#007AFF" title={t('profile.properties.manageListings')} subtitle={t('profile.properties.manageSubtitle')} onPress={() => setIsMyOffersVisible(true)} isLast={true} isDark={isDark} />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.notifications.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <ListItem
              icon="notifications"
              color="#FF2D55"
              title={t('profile.notifications.listTitle')}
              subtitle={t('profile.notifications.listSubtitle')}
              onPress={() => setIsNotificationsVisible(true)}
              isLast={true}
              isDark={isDark}
            />
          </ListGroup>
          <Text style={styles.sectionFooter}>
            {t('profile.notifications.sectionFooter')}
          </Text>
        </View>

        {/* --- SEKCJA BEZPIECZEŃSTWA PASSKEY --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.security.sectionTitle')}</Text>
          <ProfileCardShell isDark={isDark}>
            <View style={[styles.listItem, { paddingVertical: 12 }]}>
              
              <View style={[styles.listIconBox, { backgroundColor: isPasskeyActive ? '#10b981' : (isDark ? '#3A3A3C' : '#E5E5EA') }]}>
                <Ionicons name="finger-print" size={20} color={isPasskeyActive ? '#FFF' : '#8E8E93'} />
              </View>
              
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.listTitle, { color: isDark ? '#FFF' : '#000' }]}>{t('profile.security.passkeyTitle')}</Text>
                <Text style={styles.listSubtitle}>{isPasskeyActive ? t('profile.security.passkeyActive') : t('profile.security.passkeyInactive')}</Text>
              </View>
              
              <Switch 
                value={isPasskeyActive} 
                onValueChange={togglePasskey} 
                trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#10b981' }} 
              />
            </View>
          </ProfileCardShell>
          
          <Text style={styles.sectionFooter}>
            {isPasskeyActive 
              ? t('profile.security.footerActive')
              : t('profile.security.footerInactive')}
          </Text>
        </View>

        {/*
          ──────────────────────────────────────────────────────────────
          ZAKUPY I SKLEP — wymóg Apple Review Guideline 3.1.1
          ──────────────────────────────────────────────────────────────
          Każda aplikacja oferująca In-App Purchase MUSI mieć widoczny
          przycisk „Przywróć zakupy". Tu trafia użytkownik który:
            • zmienił urządzenie i chce odzyskać Pakiet Plus,
            • odinstalował aplikację i ponownie zainstalował,
            • został w połowie transakcji bez zaksięgowania (np. brak sieci),
            • korzysta z Family Sharing.
          Klik woła `IAPManager.restorePurchases()` — natywne
          `getAvailablePurchases` + ponowna weryfikacja w backendzie
          z idempotencją po `transactionId`.
        */}
        <View style={styles.section}>
        <ProfileShopSection
          isDark={isDark}
          sectionTitle={t('profile.shop.sectionTitle')}
          hubTitle={t('profile.shop.membershipHubTitle')}
          hubSubtitle={t('profile.shop.membershipHubSubtitle')}
          proActiveShort={t('profile.shop.membershipHubProActive')}
          proInactiveShort={t('profile.shop.membershipHubProInactive')}
          creditsShort={t('profile.shop.membershipHubCredits')}
          couponsShort={t('profile.shop.membershipHubCoupons')}
          proShort={t('profile.shop.membershipHubProLabel')}
          publicationCredits={hasPlusPublicationAvailable ? plusSlots : 0}
          couponCount={bonusCouponCards.length}
          hasInvestorProActive={hasInvestorProActive}
          defaultHubExpanded={
            !hasInvestorProActive || !hasPlusPublicationAvailable || bonusCouponCards.length > 0
          }
          bonusCoupons={{
            cards: bonusCouponCards,
            title: t('profile.shop.bonusCouponsTitle'),
            subtitle: t('profile.shop.bonusCouponsSubtitle'),
            swipeHint: t('profile.shop.promoSwipeHint'),
            dismissHint: t('profile.shop.promoDismissHint'),
            emptyHint: t('profile.shop.bonusCouponsEmpty'),
            onRequestDismiss: handleRequestDismissPromoCard,
          }}
          plus={{
            title: t('profile.shop.plusPackage'),
            plusSlots,
            hasPlusAvailable: hasPlusPublicationAvailable,
            counterLabel: plusCounterLabel,
            expiryLabel: plusExpiryLine,
            daysLabel: plusDaysLabel,
            buyLabel: t('profile.shop.buyPlus'),
            buySubtitle: t('profile.shop.buyPlusSubtitle', { price: PAKIET_PLUS_PRICE_LABEL }),
            buying: isBuyingPakietPlus,
            footer: (
              <Text style={styles.sectionFooter}>
                {Platform.OS === 'ios'
                  ? t('profile.shop.footerIos', { price: PAKIET_PLUS_PRICE_LABEL })
                  : t('profile.shop.footerAndroid')}
              </Text>
            ),
            onBuy: handleBuyPakietPlus,
          }}
          investorPro={{
            title: t('profile.shop.investorProPackage'),
            statusLabel: investorProStatusLabel,
            metaLabel: investorProMetaLabel,
            expiryLabel: investorProExpiryLine,
            trialBadge: investorProTrialBadge,
            priceLine: investorProPriceLine,
            buyLabel: hasInvestorProActive
              ? t('profile.shop.buyInvestorProExtend')
              : t('profile.shop.buyInvestorPro'),
            buySubtitle: investorProBuySubtitle,
            buying: isBuyingInvestorPro,
            isActive: hasInvestorProActive,
            footer: (
              <Text style={styles.sectionFooter}>
                {t('profile.shop.investorProFooter')}
                {!hasInvestorProActive && investorProListing && !investorProListing.hasFreeTrial
                  ? `\n\n${t('profile.shop.investorProTrialAscHint')}`
                  : ''}
              </Text>
            ),
            onBuy: handleBuyInvestorPro,
          }}
          restore={{
            label: t('profile.shop.restorePurchases'),
            subtitle: isRestoringPurchases
              ? t('profile.shop.restoring')
              : Platform.OS === 'ios'
                ? t('profile.shop.restoreIos')
                : t('profile.shop.restoreAndroid'),
            restoring: isRestoringPurchases,
            onRestore: handleRestorePurchases,
          }}
        />
        </View>

        {isZarzad && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Narzędzia Administratora</Text>
            <ListGroup isDark={isDark}>
              <ListItem
                icon="business"
                color="#5E5CE6"
                title="Baza Ofert"
                subtitle={adminPendingOffersCount > 0 ? `${adminPendingOffersCount} do weryfikacji` : 'Brak oczekujących'}
                onPress={() => setIsAdminOffersVisible(true)}
                isDark={isDark}
                rightElement={adminPendingOffersCount > 0 ? (
                  <View style={styles.adminPendingBadge}>
                    <Text style={styles.adminPendingBadgeText}>{adminPendingOffersCount}</Text>
                  </View>
                ) : undefined}
              />
              <ListItem
                icon="cloud-download-outline"
                color="#FF9500"
                title="Amer KEI"
                subtitle="Import ofert z panelu KEI AMER (Warszawa)"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  (navigation as any).navigate('AdminKeiAmer');
                }}
                isDark={isDark}
              />
              <ListItem icon="people" color="#32ADE6" title="Użytkownicy" onPress={() => setIsAdminUsersVisible(true)} isDark={isDark} />
              <ListItem
                icon="sparkles"
                color="#AF52DE"
                title="Promocyjne okienka"
                subtitle="Wyślij kupon do sekcji Kupony bonusowe"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsAdminPromoWindowsVisible(true);
                }}
                isDark={isDark}
              />
              <ListItem
                icon="flag"
                color="#FF453A"
                title="Zgłoszenia UGC"
                subtitle={
                  adminPendingReportsCount > 0
                    ? `${adminPendingReportsCount} oczekuje na reakcję`
                    : 'Oferty i użytkownicy — moderacja'
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsAdminReportsVisible(true);
                }}
                isDark={isDark}
                rightElement={
                  adminPendingReportsCount > 0 ? (
                    <View style={styles.adminPendingBadge}>
                      <Text style={styles.adminPendingBadgeText}>{adminPendingReportsCount}</Text>
                    </View>
                  ) : undefined
                }
              />
              <ListItem
                icon="pulse"
                color="#10b981"
                title="EstateOS™ CORE"
                subtitle="Centrum dowodzenia — CPU, RAM, dysk, LIVE"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsAdminCoreVisible(true);
                }}
                isDark={isDark}
              />
              <ListItem icon="stats-chart" color="#FF2D55" title="Analityka Radaru" onPress={() => setIsAdminRadarVisible(true)} isDark={isDark} />
              <ListItem
                icon="analytics"
                color="#A855F7"
                title="Statystyki"
                subtitle="Analityka systemu — jak w Centrali WWW"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsAdminStatisticsVisible(true);
                }}
                isDark={isDark}
              />
              <ListItem icon="albums" color="#30B0C7" title="Dealroom Check" subtitle="Lista dealroomów i uczestników" onPress={() => setIsAdminDealroomCheckVisible(true)} isDark={isDark} />
              {/*
                Weryfikacja prawna: KW + nr lokalu przychodzą od właściciela
                i czekają tutaj na ręczne ACK administratora. Po zatwierdzeniu
                na karcie oferty zapala się zielony znaczek „Zweryfikowano
                prawnie" (`isLegalSafeVerified = true`).
              */}
              <ListItem
                icon="shield-checkmark"
                color="#34C759"
                title="Weryfikacja prawna"
                subtitle={adminPendingLegalCount > 0 ? `${adminPendingLegalCount} zgłoszeń do weryfikacji` : 'Brak oczekujących KW'}
                onPress={() => setIsAdminLegalVerifyVisible(true)}
                isDark={isDark}
                rightElement={adminPendingLegalCount > 0 ? (
                  <View style={styles.adminPendingBadge}>
                    <Text style={styles.adminPendingBadgeText}>{adminPendingLegalCount}</Text>
                  </View>
                ) : undefined}
              />
              <ListItem icon="chatbubble-ellipses" color="#34C759" title="Bramka SMSPlanet" subtitle="Globalny przełącznik wysyłki" isLast={true} isDark={isDark} rightElement={<Switch value={isSmsEnabled} onValueChange={toggleSms} trackColor={{ false: '#767577', true: '#34C759' }} />} />
            </ListGroup>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.help.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <ListItem
              icon="document-text"
              color="#5856D6"
              title={t('profile.help.terms')}
              subtitle={t('profile.help.termsSubtitle')}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('Terms' as never);
              }}
              isDark={isDark}
            />
            <ListItem
              icon="shield-checkmark"
              color="#34C759"
              title={t('profile.help.privacy')}
              subtitle={t('profile.help.privacySubtitle')}
              onPress={() => {
                Haptics.selectionAsync();
                navigation.navigate('Terms' as never, { initialScrollTo: 'privacy' } as never);
              }}
              isDark={isDark}
            />
            <ListItem
              icon="mail"
              color="#0A84FF"
              title={t('profile.help.contact')}
              subtitle={t('profile.help.contactSubtitle', { email: ESTATEOS_CONTACT_EMAIL })}
              onPress={() => {
                Haptics.selectionAsync();
                Linking.openURL(mailtoEstateosSubject(t('profile.help.mailSubject'))).catch(() => {
                  Alert.alert(
                    t('profile.help.noMailClientTitle'),
                    t('profile.help.noMailClientBody', { email: ESTATEOS_CONTACT_EMAIL }),
                  );
                });
              }}
              isDark={isDark}
            />
            <ListItem
              icon="ban"
              color="#FF453A"
              title={t('profile.blocked.listTitle')}
              subtitle={
                blockedUsersCount > 0
                  ? blockedUsersCount === 1
                    ? t('profile.blocked.listOne')
                    : t('profile.blocked.listMany', { count: blockedUsersCount })
                  : t('profile.blocked.listEmpty')
              }
              onPress={() => {
                Haptics.selectionAsync();
                setIsBlockedUsersVisible(true);
              }}
              isLast={true}
              isDark={isDark}
            />
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.appearance.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <View style={styles.segmentWrapper}>
              <AnimatedSegmentedControl themeMode={themeMode} setThemeMode={setThemeMode} isDark={isDark} />
            </View>
          </ListGroup>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <View style={styles.segmentWrapper}>
              <LanguageSelector
                value={localePreference}
                onChange={(code) => void setLocalePreference(code)}
                isDark={isDark}
              />
              <Text
                style={[
                  styles.currencyActiveHint,
                  { color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.55)' },
                ]}
                numberOfLines={2}
              >
                {languageActiveHint}
              </Text>
            </View>
          </ListGroup>
          <Text style={styles.sectionFooter}>{t('profile.language.footer')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.currency.sectionTitle')}</Text>
          <ListGroup isDark={isDark}>
            <View style={styles.segmentWrapper}>
              <DisplayCurrencySelector
                value={displayCurrency}
                onChange={(code) => void setDisplayCurrency(code)}
                isDark={isDark}
              />
              <Text
                style={[
                  styles.currencyActiveHint,
                  { color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.55)' },
                ]}
                numberOfLines={2}
              >
                {t(`profile.currency.labels.${displayCurrency}`)}
              </Text>
            </View>
          </ListGroup>
          <Text style={styles.sectionFooter}>
            {t('profile.currency.footer')}
          </Text>
        </View>

        <View style={[styles.section, { marginTop: 10 }]}>
          <ListGroup isDark={isDark}>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutBtn, pressed && { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Text style={styles.logoutText}>{t('profile.session.logout')}</Text>
            </Pressable>
          </ListGroup>
        </View>

        <Text style={styles.versionText}>{t('profile.session.version')}</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setIsDeleteAccountVisible(true);
          }}
          hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}
          style={styles.deleteAccountMicroWrap}
          accessibilityRole="button"
          accessibilityLabel={t('profile.session.deleteAccountA11y')}
        >
          <Text style={[styles.deleteAccountMicro, { color: isDark ? 'rgba(235,235,245,0.35)' : 'rgba(60,60,67,0.38)' }]}>
            {t('profile.session.deleteAccount')}
          </Text>
        </Pressable>
      </ScrollView>
        <InvestorProTrialIntroHost
          enabled={isProfileTabFocused}
          isDark={isDark}
          onPurchase={handleBuyInvestorPro}
        />
      </View>

      <MyOffersModal visible={isMyOffersVisible} onClose={() => setIsMyOffersVisible(false)} theme={theme} />
      <NotificationsSettingsModal visible={isNotificationsVisible} onClose={() => setIsNotificationsVisible(false)} theme={theme} />

      <AdminOffersModal
        visible={isAdminOffersVisible}
        onClose={() => {
          setIsAdminOffersVisible(false);
          refreshAdminPendingOffers();
        }}
        theme={theme}
        onPendingCountChange={(nextCount) => {
          setAdminPendingOffersCount(nextCount);
          adminPendingRef.current = nextCount;
        }}
      />
      <AdminUsersModal
        visible={isAdminUsersVisible}
        onClose={() => setIsAdminUsersVisible(false)}
        onOpenUser={(selectedUser) => {
          adminUsersReturnRef.current = true;
          setIsAdminUsersVisible(false);
          setTimeout(() => setAdminSelectedUser(selectedUser), 320);
        }}
        theme={theme}
      />
      <AdminUserProfileModal
        visible={!!adminSelectedUser}
        userId={adminSelectedUser?.id}
        initialUser={adminSelectedUser}
        onClose={(opts) => {
          const resumeUsersList = opts?.resumeUsersList !== false;
          setAdminSelectedUser(null);
          if (resumeUsersList && adminUsersReturnRef.current) {
            adminUsersReturnRef.current = false;
            setTimeout(() => setIsAdminUsersVisible(true), 280);
          } else {
            adminUsersReturnRef.current = false;
          }
        }}
        theme={theme}
      />
      <AdminCoreCommandCenterModal
        visible={isAdminCoreVisible}
        onClose={() => setIsAdminCoreVisible(false)}
        theme={theme}
      />
      <AdminRadarAnalyticsModal visible={isAdminRadarVisible} onClose={() => setIsAdminRadarVisible(false)} theme={theme} />
      <AdminStatisticsModal visible={isAdminStatisticsVisible} onClose={() => setIsAdminStatisticsVisible(false)} theme={theme} />
      <AdminDealroomCheckModal visible={isAdminDealroomCheckVisible} onClose={() => setIsAdminDealroomCheckVisible(false)} theme={theme} />
      <AdminLegalVerificationModal
        visible={isAdminLegalVerifyVisible}
        onClose={() => {
          setIsAdminLegalVerifyVisible(false);
          // Po zamknięciu odśwież licznik w pigułce — admin mógł w środku
          // coś zaakceptować, więc PENDING mogło spaść.
          void refreshAdminPendingLegalVerifications();
        }}
        theme={theme}
        onQueueChange={setAdminPendingLegalCount}
      />
      <AdminContentReportsModal
        visible={isAdminReportsVisible}
        onClose={() => {
          setIsAdminReportsVisible(false);
          void refreshAdminPendingReports();
        }}
        theme={theme}
        onQueueChange={setAdminPendingReportsCount}
      />
      <AdminPromoWindowsModal
        visible={isAdminPromoWindowsVisible}
        onClose={() => setIsAdminPromoWindowsVisible(false)}
        theme={theme}
        onSent={() => {
          if (token && user?.id) {
            void fetchUserProfilePromoCards(token, user.id).then(setUserPromoCards);
          }
        }}
      />

      <EditNameSheet
        visible={isEditNameVisible}
        onClose={() => setIsEditNameVisible(false)}
        theme={theme}
        isDark={isDark}
      />
      <EditPhoneSheet
        visible={isEditPhoneVisible}
        onClose={() => setIsEditPhoneVisible(false)}
        theme={theme}
        isDark={isDark}
      />
      <EditEmailSheet
        visible={isEditEmailVisible}
        onClose={() => setIsEditEmailVisible(false)}
        theme={theme}
        isDark={isDark}
        initialVerifyMode={hasPendingEmailChange ? 'change' : 'verify'}
      />

      <DeleteAccountSheet
        visible={isDeleteAccountVisible}
        onClose={() => setIsDeleteAccountVisible(false)}
        isDark={isDark}
        userEmail={user?.email}
        hasPaidIndicators={hasPaidIndicators}
        onConfirmDelete={async (password) => {
          const r = await deleteAccount(password);
          if (!r.ok) {
            Alert.alert(t('profile.session.alerts.deleteFailedTitle'), r.error || t('profile.session.alerts.deleteFailedBody'));
            return r;
          }
          setIsDeleteAccountVisible(false);
          Alert.alert(t('profile.session.alerts.deleteSuccessTitle'), t('profile.session.alerts.deleteSuccessBody'));
          return r;
        }}
      />

      <BlockedUsersModal
        visible={isBlockedUsersVisible}
        onClose={() => setIsBlockedUsersVisible(false)}
        isDark={isDark}
      />

      {isOwnPublicProfileOpen ? (
      <Modal visible transparent animationType="fade" onRequestClose={closePublicProfileModal}>
        <View style={styles.profileOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePublicProfileModal} />
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderRow}>
              {publicModalStack.length > 0 ? (
                <Pressable onPress={goBackPublicModal} style={styles.profileCloseBtn}>
                  <Ionicons name="chevron-back" size={18} color="#fff" />
                </Pressable>
              ) : (
                <View style={{ width: 28 }} />
              )}
              <Text style={[styles.profileTitle, { flex: 1, textAlign: 'center' }]}>
                {Number(publicModalViewUserId) === Number(user?.id)
                  ? t('profile.publicProfile.title')
                  : publicModalViewData?.user?.name || t('profile.publicProfile.title')}
              </Text>
              <Pressable onPress={closePublicProfileModal} style={styles.profileCloseBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>

            {publicModalViewLoading ? (
              <View style={styles.profileLoaderWrap}>
                <ActivityIndicator color="#f59e0b" />
                <Text style={styles.profileMuted}>{t('profile.publicProfile.loading')}</Text>
              </View>
            ) : (
              <>
                {(() => {
                  const modalReviews = Array.isArray(publicModalViewData?.reviews)
                    ? publicModalViewData.reviews
                    : [];
                  const modalUser = publicModalViewData?.user;
                  const isSelfModal = Number(publicModalViewUserId) === Number(user?.id);
                  return (
                    <>
                <ProfilePublicHeader
                  user={{
                    ...(modalUser || user),
                    name:
                      modalUser?.name ||
                      (isSelfModal
                        ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                        : '') ||
                      t('profile.publicProfile.userFallback'),
                    image: modalUser?.image || (isSelfModal ? user?.image : null),
                    companyName: modalUser?.companyName || (isSelfModal ? user?.companyName : null),
                  }}
                  idLabel={t('profile.publicProfile.id', { id: publicModalViewUserId || user?.id || '-' })}
                  isDark
                />
                <ProfileReputationBlock
                  reviews={modalReviews}
                  reviewsCountLabel={(count) => t('profile.publicProfile.reviewsCount', { count })}
                  isDark
                />

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {modalReviews.length === 0 ? (
                    <Text style={styles.profileMuted}>{t('profile.publicProfile.noReviews')}</Text>
                  ) : modalReviews.slice(0, 12).map((r: any) => (
                    <View key={r.id} style={styles.reviewItem}>
                      <View style={styles.reviewTop}>
                        <View style={{ flex: 1 }}>
                          <Pressable
                            onPress={() => openReviewerInPublicModal(Number(r?.reviewerId || 0))}
                            style={({ pressed }) => [styles.reviewAuthorBtn, pressed && { opacity: 0.7 }]}
                          >
                            <Text style={styles.reviewAuthorText}>
                              {resolveReviewerLabel(r, (id) =>
                                t('profile.publicProfile.reviewerFallback', { id }),
                              )}
                            </Text>
                            <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
                          </Pressable>
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
                        <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString(dateLocale)}</Text>
                      </View>
                      <Text style={styles.reviewText}>{r.comment || t('profile.publicProfile.noComment')}</Text>
                    </View>
                  ))}
                </ScrollView>
                    </>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      </Modal>
      ) : null}

    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 60 },
  headerCardShell: { marginBottom: 30 },
  headerCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatarWrapper: { position: 'relative', width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1D1D6', justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarRegionFlag: { position: 'absolute', right: -6, bottom: -2, zIndex: 4 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: -4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  headerName: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    minWidth: 0,
    maxWidth: '100%',
  },
  headerNameEditPaper: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  headerNameEditPaperDark: {
    backgroundColor: 'rgba(44,44,46,0.96)',
    borderColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0.35,
  },
  headerNameEditBtn: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileRatingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, alignSelf: 'flex-start' },
  profileRatingStarsInline: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  profileRatingMetaInline: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  headerRole: { fontSize: 13, color: '#8E8E93', fontWeight: '500', marginBottom: 2 },
  headerId: { fontSize: 11, color: '#007AFF', fontWeight: '700', marginBottom: 6 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: '#8E8E93', textTransform: 'uppercase', marginLeft: 16, marginBottom: 8, letterSpacing: 0.3 },
  sectionFooter: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginTop: 8, marginRight: 16, lineHeight: 18 },
  plusStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  plusStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  plusStatusBody: { flex: 1, minWidth: 0 },
  plusStatusHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  plusStatusTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  plusStatusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  plusStatusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  plusStatusSubtitle: { color: '#8E8E93', fontSize: 13, fontWeight: '700', marginTop: 3 },
  plusStatusMeta: { color: '#8E8E93', fontSize: 12, marginTop: 3 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  listIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  listContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16 },
  listTitle: { fontSize: 17, fontWeight: '400', letterSpacing: -0.2 },
  listSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2, paddingRight: 10 },
  listValue: { fontSize: 16, color: '#8E8E93' },
  segmentWrapper: { padding: 12 },
  currencyActiveHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: -0.15,
  },
  segmentContainer: { width: '100%', height: 36, borderRadius: 8, flexDirection: 'row', position: 'relative', padding: 2 },
  segmentActive: { position: 'absolute', height: '100%', top: 2, left: 2, borderRadius: 6 },
  segmentButton: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  segmentText: { fontWeight: '600', fontSize: 13 },
  logoutBtn: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#FF3B30', fontSize: 17, fontWeight: '500' },
  versionText: { textAlign: 'center', color: '#8E8E93', fontSize: 13, marginTop: 10, marginBottom: 2 },
  deleteAccountMicroWrap: { alignSelf: 'center', paddingVertical: 6, marginBottom: 32 },
  deleteAccountMicro: { fontSize: 11, fontWeight: '500', letterSpacing: 0.15, textTransform: 'lowercase' },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginHorizontal: 4 },
  tabText: { fontSize: 13, fontWeight: '700' },
  offerCard: { padding: 16, borderRadius: 20, marginBottom: 15, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  syncPillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  syncPillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: '#0A84FF',
  },
  syncPillHint: {
    flex: 1,
    minWidth: 120,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  offerTitle: { fontSize: 17, fontWeight: '700', marginBottom: 5 },
  offerSubtitle: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },
  offerUser: { fontSize: 12, color: '#8E8E93', marginTop: 4, marginBottom: 10, fontWeight: '600' },
  adminOfferHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminPreviewWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
    flexShrink: 0,
  },
  adminPreviewImage: { width: '100%', height: '100%' },
  adminTxBadgeOnImage: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: 52,
    minWidth: 44,
    alignItems: 'center',
  },
  adminTxBadgeOnImageText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  adminStatusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  adminStatusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  adminActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  adminActionBtn: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  adminActionBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.1 },
  adminPendingBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminPendingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  adminPendingInfo: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminPendingInfoText: { color: '#FF9F0A', fontSize: 13, fontWeight: '700' },
  adminInlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  adminInlineErrorText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  adminRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 14,
  },
  adminRetryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  analyticsHero: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  analyticsHeroTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  analyticsHeroSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 3, fontWeight: '600' },
  analyticsHealthRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  analyticsHealthLabel: { fontSize: 12, fontWeight: '700' },
  analyticsHealthValue: { fontSize: 20, fontWeight: '900' },
  analyticsHealthTrack: { marginTop: 8, height: 8, borderRadius: 999, overflow: 'hidden' },
  analyticsHealthFill: { height: '100%', borderRadius: 999 },
  adminProfileHeroCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  adminProfileAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: 'rgba(150,150,150,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminProfileHeroBody: { flex: 1 },
  adminProfileHeroName: { fontSize: 32 / 1.6, fontWeight: '900', letterSpacing: -0.3, marginBottom: 5 },
  adminProfileHeroMetaRow: { flexDirection: 'row', alignItems: 'center' },
  adminProfileRolePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  adminProfileRolePillText: { fontSize: 11, fontWeight: '900', color: '#8E8E93', letterSpacing: 0.5, textTransform: 'uppercase' },
  adminSectionDivider: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(150,150,150,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminSectionDividerText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.35, textTransform: 'uppercase' },
  adminTxFilterRow: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adminTxFilterSlider: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  adminTxFilterBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  adminTxFilterText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
  },
  adminTxFilterTextActive: {
    color: '#007AFF',
    fontWeight: '900',
  },

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
  userSignalRow: {
    marginTop: 10,
    marginBottom: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  userSignalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(150,150,150,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.15)',
  },
  userSignalText: { fontSize: 11, fontWeight: '700' },
  userPresenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 2 },
  userPresenceDot: { width: 8, height: 8, borderRadius: 4 },
  userPresenceText: { fontSize: 11, fontWeight: '700' },
  adminUsersListHeader: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  adminUsersListContent: { paddingHorizontal: 16, paddingBottom: 28 },
  adminUsersEmpty: { textAlign: 'center', marginTop: 40, fontSize: 15, fontWeight: '600' },
  adminSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },
  adminSearchInput: { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 10 },
  adminSortDirBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminToolsDisclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  adminToolsDisclosureMain: { flex: 1, minWidth: 0 },
  adminToolsDisclosureTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  adminToolsDisclosureMeta: { fontSize: 12, color: '#8E8E93', fontWeight: '500', marginTop: 2 },
  adminFilterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  adminFilterBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  adminStatsCompact: { fontSize: 12, fontWeight: '600', marginTop: 8, lineHeight: 17 },
  adminToolsPanel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adminFilterGroup: { marginBottom: 8 },
  adminFilterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  adminFilterChipRow: { gap: 8, paddingRight: 4 },
  adminResetFiltersBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  adminResetFiltersText: { color: '#007AFF', fontSize: 14, fontWeight: '700' },
  userSortChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(150,150,150,0.10)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  userSortChipActive: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderColor: 'rgba(0,122,255,0.35)',
  },
  userSortChipText: { color: '#8E8E93', fontWeight: '800', fontSize: 12 },
  userSortChipTextActive: { color: '#007AFF' },
  userFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  userFilterChipActive: { borderColor: 'rgba(0,122,255,0.35)' },
  userFilterChipText: { color: '#8E8E93', fontWeight: '700', fontSize: 12 },
  userFilterChipTextActive: { color: '#007AFF', fontWeight: '900' },
  
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
  reviewAuthorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 3 },
  reviewAuthorText: { color: '#e5e7eb', fontSize: 12, fontWeight: '700' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { color: '#9ca3af', fontSize: 10, marginLeft: 8 },
  reviewText: { color: '#d1d5db', fontSize: 13, lineHeight: 18 },
});