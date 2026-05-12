import FloorPlanViewer from '../components/FloorPlanViewer';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Share, Alert, Modal, Platform, Pressable, ScrollView, Linking, ActivityIndicator, useColorScheme } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import MapView, { Marker, Circle } from 'react-native-maps';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withSequence
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import { ChevronLeft, Share as ShareIcon, Heart, Maximize, MapPin, BedDouble, Layers, Calendar, Pencil, X, Lock, Crown, Handshake, CalendarClock, Star, ShieldCheck, ChevronRight, Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import { buildOfferShareMessage } from '../utils/offerShareUrls';
import { DEAL_EVENT_PREFIX } from '../contracts/parityContracts';
import EliteStatusBadges from '../components/EliteStatusBadges';
import { formatLocationLabel, formatPublicAddress, resolveIsExactLocation } from '../constants/locationEcosystem';
import { getPublicMapPresentation } from '../utils/publicLocationPrivacy';
import { isPartnerIdentity } from '../utils/partnerIdentity';

const { width, height } = Dimensions.get('window');
const IMG_HEIGHT = 450;
const API_URL = 'https://estateos.pl';
const EVENT_PREFIX = DEAL_EVENT_PREFIX;

function parseDealEvent(content?: string) {
  if (!content || !content.startsWith(EVENT_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(EVENT_PREFIX.length));
  } catch {
    return null;
  }
}

function isNegotiationPending(action?: string) {
  const normalized = String(action || '').toUpperCase();
  return normalized === 'PROPOSED' || normalized === 'COUNTERED';
}

function getDealActionLabel(action?: string) {
  const normalized = String(action || '').toUpperCase();
  if (normalized === 'ACCEPTED') return 'Zaakceptowano';
  if (normalized === 'REJECTED' || normalized === 'DECLINED') return 'Odrzucono';
  if (normalized === 'COUNTERED') return 'Kontroferta';
  return 'Propozycja';
}

function formatFloorStat(f: unknown): string {
  if (f === null || f === undefined || f === '') return '-';
  const n = Number(f);
  if (Number.isFinite(n) && n === 0) return 'parter';
  if (Number.isFinite(n)) return String(n);
  const s = String(f).trim();
  return s ? s : '-';
}

function sanitizeOfferDescription(input: unknown): string {
  const raw = String(input ?? '');
  if (!raw) return '';
  return raw
    // ukryj techniczne markery backendowe np. <!-- ESTATEOS_VERIFY:... -->
    .replace(/<!--\s*ESTATEOS_VERIFY:[\s\S]*?-->/gi, '')
    .replace(/\bESTATEOS_VERIFY:[A-Za-z0-9._=-]+\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

export default function OfferDetail({ route, navigation }: any) {
  const offerFromParams = route?.params?.offer;
  const idFromParams = firstDefined(route?.params?.id, route?.params?.offerId, route?.params?.offer?.id);
  const [hydratedOffer, setHydratedOffer] = useState<any>(null);

  // 🔥 FINALNY OBIEKT
  const offer = hydratedOffer || offerFromParams || (idFromParams ? { id: idFromParams } : null);
  // KLUCZOWE: theme musi pochodzić z globalnego store'a (useThemeStore),
  // a NIE z `route.params.theme` — bo żadne miejsce nawigacji nie przekazuje
  // tu theme w paramach, więc bez tego ekran wisi na sztywno w "light".
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
  const theme = { glass: isDark ? 'dark' : 'light' };
  const [isFavorite, setIsFavorite] = useState(false);
  const heartScale = useSharedValue(1);
  const { user, token } = useAuthStore() as any;
  const isGuest = !user?.id;
  const [isGuestGateVisible, setIsGuestGateVisible] = useState(isGuest);
  const [isPhoneVerifyGateVisible, setIsPhoneVerifyGateVisible] = useState(false);
  // Bramka kontaktu/umawiania spotkań — wymagamy WYŁĄCZNIE potwierdzonego numeru telefonu (SMS).
  // Nie traktujemy ogólnego `isVerified` (np. e-mail) jako sygnału — kontakt bez SMS jest zablokowany.
  const isPhoneVerified = Boolean(user?.isVerifiedPhone);
  const viewerUserId = Number(user?.id || 0);
  // W praktyce ownerId potrafi przychodzić pod różnymi kluczami (web/mobile/deal payload).
  // Zbieramy wszystkie sensowne kandydaty i na tej podstawie rozstrzygamy rolę.
  const ownerCandidateIds = useMemo(() => {
    return Array.from(
      new Set(
        [
          offer?.userId,
          offer?.ownerId,
          offer?.sellerId,
          offer?.owner?.id,
          offer?.seller?.id,
          offer?.user?.id,
          offer?.listingOwnerId,
        ]
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    ) as number[];
  }, [offer]);
  const listingOwnerUserId = ownerCandidateIds[0] ?? null;
  const isOwner = viewerUserId > 0 && ownerCandidateIds.includes(viewerUserId);
  const proExpiryMs = user?.proExpiresAt ? new Date(user.proExpiresAt).getTime() : null;
  const isProStillActive = Boolean(!proExpiryMs || proExpiryMs > Date.now());
  const isProUser = Boolean(
    (user?.isPro && isProStillActive) ||
    user?.role === 'ADMIN' ||
    user?.planType === 'PRO' ||
    user?.planType === 'AGENCY'
  );
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  const createdAtMs = offer?.createdAt ? new Date(offer.createdAt).getTime() : null;
  const unlockAtMs = createdAtMs ? createdAtMs + (24 * 60 * 60 * 1000) : null;
  /**
   * Czy oferta pochodzi od PARTNERA (agent / agencja / pośrednik / broker).
   *
   * DLACZEGO TO ROZRÓŻNIENIE
   * ────────────────────────
   * Standardowo nowa oferta (od osoby prywatnej) jest blokowana 24 h jako
   * „Off-Market" i odblokowuje się dla wszystkich po tym okienku — albo od
   * razu dla użytkowników PRO. Oferty zaczepione przez partnerów (agencje,
   * pośredników) są publikowane z myślą o jak najszerszej dystrybucji, więc
   * NIE należy ich chować pod off-marketem. Reviewerzy Apple i końcowi
   * użytkownicy też nie powinni widzieć tego ekranu blokady dla ofert
   * od profesjonalnych partnerów.
   *
   * Detekcja: `isPartnerIdentity` patrzy na role/typ/plan w wielu miejscach
   * obiektu oferty (samej oferty, owner, seller, user, partner flagi).
   */
  const isPartnerListing = useMemo(
    () =>
      Boolean(
        offer &&
          (isPartnerIdentity(offer) ||
            isPartnerIdentity(offer?.owner) ||
            isPartnerIdentity(offer?.seller) ||
            isPartnerIdentity(offer?.user) ||
            isPartnerIdentity(offer?.publisher))
      ),
    [offer]
  );
  const isOffMarketLocked = Boolean(
    unlockAtMs && Date.now() < unlockAtMs && !isProUser && !isOwner && !isPartnerListing
  );

  useEffect(() => {
    if (!unlockAtMs || !isOffMarketLocked) {
      setTimeLeftMs(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, unlockAtMs - Date.now());
      setTimeLeftMs(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [unlockAtMs, isOffMarketLocked]);

  const countdownParts = (() => {
    const totalSec = Math.max(0, Math.floor(timeLeftMs / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  })();

  useEffect(() => {
    const shouldHydrate = !!idFromParams && (!offerFromParams || !offerFromParams?.title || !offerFromParams?.price);
    if (!shouldHydrate) return;
    let mounted = true;
    const run = async () => {
      try {
        const id = Number(idFromParams);
        const [mobileRes, webRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
          fetch(`${API_URL}/api/offers/${id}`),
        ]);

        let candidate: any = null;
        if (mobileRes.status === 'fulfilled' && mobileRes.value.ok) {
          const mobileJson = await mobileRes.value.json();
          const offers = Array.isArray(mobileJson?.offers) ? mobileJson.offers : [];
          candidate = offers.find((o: any) => Number(o?.id || 0) === id) || null;
        }

        if (!candidate && webRes.status === 'fulfilled' && webRes.value.ok) {
          const webJson = await webRes.value.json();
          candidate = webJson?.offer || webJson?.data || (webJson?.id ? webJson : null);
        }

        if (mounted && candidate) {
          setHydratedOffer(candidate);
        }
      } catch {
        // noop
      } finally {
        // noop
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [idFromParams, offerFromParams, token]);

  const handleBecomePro = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Pakiet PRO',
        'Wkrótce zakup pakietu PRO bezpośrednio w aplikacji. Tymczasem szczegóły oferty odblokują się po standardowym czasie oczekiwania.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      await Linking.openURL('https://estateos.pl/cennik');
    } catch (_error) {
      Alert.alert('EstateOS', 'Nie udało się otworzyć strony cennika PRO.');
    }
  };

  const openAuthEntry = (intent: 'login' | 'register') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGuestGateVisible(false);
    navigation.goBack();
    setTimeout(() => {
      navigation.navigate('MainTabs', { screen: 'Profil', params: { authIntent: intent } });
    }, 120);
  };

  const guardPhoneVerification = () => {
    if (isGuest || !user?.id || isPhoneVerified) return false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsPhoneVerifyGateVisible(true);
    return true;
  };

  useEffect(() => {
    setIsGuestGateVisible(isGuest);
  }, [isGuest]);

  // --- STAN GALERII PEŁNOEKRANOWEJ ---
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
  const [isLocationPreviewOpen, setIsLocationPreviewOpen] = useState(false);
  const [dealId, setDealId] = useState<number | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [bidModalConfig, setBidModalConfig] = useState<any>({
    mode: 'create',
    bidId: null,
    initialAmount: null,
    eventAction: null,
    quickAccept: false,
    history: [],
  });
  const [appointmentModalConfig, setAppointmentModalConfig] = useState<any>({
    mode: 'create',
    appointmentId: null,
    eventAction: null,
    proposedDate: null,
    history: [],
  });
  const [dealSyncLoading, setDealSyncLoading] = useState(false);
  const [dealNegotiationState, setDealNegotiationState] = useState<any>(null);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [isOwnerProfileOpen, setIsOwnerProfileOpen] = useState(false);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(false);
  const [activeProfileData, setActiveProfileData] = useState<any>(null);
  const [activeProfileLoading, setActiveProfileLoading] = useState(false);
  const [activeProfileUserId, setActiveProfileUserId] = useState<number | null>(null);
  const [reviewerNameCache, setReviewerNameCache] = useState<Record<number, string>>({});
  const [profileHistory, setProfileHistory] = useState<number[]>([]);
  const bidBtnScale = useSharedValue(1);
  const apptBtnScale = useSharedValue(1);

  useEffect(() => {
    const checkFavorite = async () => {
      if (!offer?.id) return;
      try {
        const storedFavs = await AsyncStorage.getItem('@estateos_favorites');
        if (storedFavs) {
          const favArray = JSON.parse(storedFavs);
          if (favArray.includes(offer.id)) setIsFavorite(true);
        }
      } catch (e) {}
    };
    checkFavorite();
  }, [offer?.id]);

  const handleFavorite = async () => {
    if (!offer?.id) return;
    heartScale.value = withSpring(1.5, { damping: 2, stiffness: 80 }, () => { heartScale.value = withSpring(1); });
    const newFavState = !isFavorite;
    setIsFavorite(newFavState);
    if (newFavState) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const storedFavs = await AsyncStorage.getItem('@estateos_favorites');
      let favArray = storedFavs ? JSON.parse(storedFavs) : [];
      if (newFavState) { if (!favArray.includes(offer.id)) favArray.push(offer.id); }
      else { favArray = favArray.filter((id: number) => id !== offer.id); }
      await AsyncStorage.setItem('@estateos_favorites', JSON.stringify(favArray));
    } catch (e) {}
  };

  const animatedHeartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const handleEdit = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('EditOffer', { offerId: offer.id }); };

  let realImages: string[] = [];
  if (offer?.images) {
    try {
      const parsedImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
      realImages = parsedImages.map((img: string) => img.startsWith('/uploads') ? `${API_URL}${img}` : img);
    } catch (e) {}
  }
  const imagesToShow = (realImages && realImages.length > 0) ? realImages : ['https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1200&auto=format&fit=crop'];
  const lightboxImages = useMemo(() => imagesToShow.map((uri) => ({ uri })), [imagesToShow]);

  const displayOffer = {
    title: offer?.title || 'Apartament Premium',
    price: offer?.price ? new Intl.NumberFormat('pl-PL').format(offer.price) + ' PLN' : 'Cena na zapytanie',
    location: formatLocationLabel(offer?.city, offer?.district, 'Warszawa'),
    description: sanitizeOfferDescription(offer?.description) || 'Brak opisu dla tej nieruchomości.',
    stats: { beds: offer?.rooms || '-', size: offer?.area ? `${offer.area} m²` : '- m²' }
  };
  // Wskaźnik „PLN/m²” — kluczowy benchmark cenowy, pokazujemy go pod ceną
  // w dolnym pasku. Liczymy z surowego `offer.price` i `offer.area`, żeby
  // uniknąć parsowania sformatowanego stringa.
  const pricePerSqmLabel = useMemo(() => {
    const priceNum = Number(offer?.price);
    const areaNum = Number(String(offer?.area ?? '').replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
    if (!Number.isFinite(areaNum) || areaNum <= 0) return null;
    const perSqm = Math.round(priceNum / areaNum);
    return `${perSqm.toLocaleString('pl-PL')} PLN/m²`;
  }, [offer?.price, offer?.area]);
  // „Dokładna lokalizacja" decyduje, czy publicznie pokazujemy ulicę i numer.
  // Włączona (ON):  ulica + numer (np. „Reymonta 12").
  // Wyłączona (OFF): tylko miasto i dzielnica (lub sama miejscowość) — adres ukryty.
  const isExactLocation = resolveIsExactLocation(offer?.isExactLocation);
  const streetRaw = firstDefined(offer?.street, offer?.addressStreet, offer?.location?.street);
  const streetForPublic = String(streetRaw || '').trim();
  const locationLine = formatPublicAddress(
    offer?.city,
    offer?.district,
    streetForPublic,
    isExactLocation,
    'Polska',
  );

  const latRaw = Number(firstDefined(offer?.lat, offer?.latitude, offer?.location?.lat, offer?.location?.latitude));
  const lngRaw = Number(firstDefined(offer?.lng, offer?.lon, offer?.longitude, offer?.location?.lng, offer?.location?.lon, offer?.location?.longitude));
  const hasValidMapCoords = Number.isFinite(latRaw) && Number.isFinite(lngRaw);
  // Prezentacja mapy zależy od dwóch rzeczy: czy właściciel pozwolił na pokazanie
  // dokładnego adresu, oraz czy oglądający TO właściciel/partner (wtedy zawsze
  // dokładnie). Dla anonimowych widzów stosujemy deterministyczny jitter, żeby
  // środek okręgu nie zdradzał budynku — patrz `src/utils/publicLocationPrivacy.ts`.
  const viewerSeesExact = isExactLocation || !!isOwner || !!isPartnerListing;
  const mapPresentation = useMemo(() => {
    return getPublicMapPresentation({
      lat: hasValidMapCoords ? latRaw : 52.2297,
      lng: hasValidMapCoords ? lngRaw : 21.0122,
      offerId: offer?.id ?? null,
      isExactLocation,
      viewerIsOwner: !!isOwner || !!isPartnerListing,
    });
  }, [latRaw, lngRaw, hasValidMapCoords, offer?.id, isExactLocation, isOwner, isPartnerListing]);
  const mapCoordinate = { latitude: mapPresentation.latitude, longitude: mapPresentation.longitude };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!offer?.id) return;
    const { message, url } = buildOfferShareMessage({
      title: displayOffer.title,
      priceLine: displayOffer.price,
      offerId: offer.id,
    });
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message, url, title: 'EstateOS™ — udostępnianie oferty' }
          : { message, title: 'EstateOS™' }
      );
    } catch {
      /* anulowano lub błąd share */
    }
  };

  const isTrue = (v: any) => v === true || v === 1 || v === 'true' || v === '1';
  const activeAmenities = [];
  if (isTrue(offer?.hasBalcony)) activeAmenities.push('Balkon / Taras');
  if (isTrue(offer?.hasParking)) activeAmenities.push('Miejsce parkingowe');
  if (isTrue(offer?.hasElevator)) activeAmenities.push('Winda');
  if (isTrue(offer?.hasStorage)) activeAmenities.push('Piwnica / Komórka');
  if (isTrue(offer?.hasGarden)) activeAmenities.push('Ogródek');
  if (isTrue(offer?.petsAllowed)) activeAmenities.push('Zwierzęta akceptowane');
  if (isTrue(offer?.airConditioning)) activeAmenities.push('Klimatyzacja');
  const heatingLabel = String(offer?.heating || '').trim();
  const furnishedLabel = isTrue(offer?.isFurnished) ? 'Tak' : 'Nie';
  const adminFeeNumber = Number(String(offer?.adminFee ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  const hasAdminFee = Number.isFinite(adminFeeNumber) && adminFeeNumber > 0;
  const adminFeeLabel = hasAdminFee ? `${Math.round(adminFeeNumber).toLocaleString('pl-PL')} PLN` : 'Brak';
  const viewsCountRaw = Number(firstDefined(offer?.views, offer?.viewCount, offer?.viewsCount, offer?.stats?.views, 0));
  const viewsCount = Number.isFinite(viewsCountRaw) && viewsCountRaw > 0 ? Math.round(viewsCountRaw) : 0;
  const legalCheckStatus = String(firstDefined(offer?.legalCheckStatus, offer?.verificationStatus, '') || '').toUpperCase();
  const isLegalSafeVerified =
    isTrue(firstDefined(offer?.isLegalSafeVerified, offer?.isLandRegistryVerified, offer?.landRegistryVerified, offer?.isVerifiedLegal)) ||
    legalCheckStatus === 'VERIFIED' ||
    legalCheckStatus === 'SAFE';
  const legalSafetyText = isLegalSafeVerified
    ? 'Bezpieczna nieruchomość · księga i status zadłużenia potwierdzone'
    : 'Niezweryfikowany status księgi wieczystej i zadłużenia';

  const formatCondition = (cond: string) => { const map: any = { NEW: 'Nowe', VERY_GOOD: 'Bardzo dobry', GOOD: 'Dobry', TO_RENOVATION: 'Do remontu', DEVELOPER: 'Stan deweloperski', READY: 'Gotowe do zamieszkania' }; return map[cond] || cond || 'Brak danych'; };
  const formatDate = (dateString: string) => { if (!dateString) return 'Brak danych'; const d = new Date(dateString); return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }); };

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.5], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-IMG_HEIGHT, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));

  // --- FUNKCJE OTWIERANIA GALERII ---
  const openGallery = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGalleryInitialIndex(index);
    setGalleryCurrentIndex(index);
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGalleryOpen(false);
  };

  const ensureDeal = async () => {
    if (!offer?.id) return null;
    if (!token) {
      Alert.alert('EstateOS', 'Zaloguj się, aby rozpocząć negocjacje.');
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/api/deals/init`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.deal?.id) {
        Alert.alert('EstateOS', data?.error || 'Nie udało się otworzyć dealroomu.');
        return null;
      }
      const createdDealId = Number(data.deal.id);
      setDealId(createdDealId);
      return createdDealId;
    } catch (_e) {
      Alert.alert('EstateOS', 'Błąd połączenia z serwerem.');
      return null;
    }
  };

  const openBidFlow = async () => {
    const ensuredDealId = dealId || await ensureDeal();
    if (!ensuredDealId) return;
    setDealId(ensuredDealId);
    const latestBid = dealNegotiationState?.latestBid;
    const latestBidAction = String(latestBid?.action || '').toUpperCase();
    const bidPending = isNegotiationPending(latestBidAction);
    const bidAccepted = latestBidAction === 'ACCEPTED';
    const bidByMe = Number(latestBid?.senderId || 0) === Number(user?.id || 0);
    if (bidPending && bidByMe) {
      Alert.alert(
        'Negocjacje ceny trwają',
        'Twoja propozycja została wysłana. Oczekujemy na decyzję właściciela — szczegóły znajdziesz w dealroomie.'
      );
      return;
    }
    if (bidAccepted) {
      Alert.alert(
        'Warunki cenowe potwierdzone',
        `Uzgodniona kwota: ${Number(latestBid?.amount || 0).toLocaleString('pl-PL')} PLN. Dalsze ustalenia kontynuuj w dealroomie.`
      );
      return;
    }
    if (latestBid?.bidId && bidPending && !bidByMe) {
      setBidModalConfig({
        mode: 'respond',
        bidId: latestBid.bidId,
        initialAmount: latestBid.amount || null,
        eventAction: latestBid.action || null,
        quickAccept: false,
        history: dealNegotiationState?.bidHistory || [],
      });
    } else {
      setBidModalConfig({
        mode: 'create',
        bidId: null,
        initialAmount: Number(String(offer?.price || '').replace(/[^\d]/g, '')) || null,
        eventAction: null,
        quickAccept: false,
        history: dealNegotiationState?.bidHistory || [],
      });
    }
    setIsBidModalOpen(true);
  };

  const openAppointmentFlow = async () => {
    const ensuredDealId = dealId || await ensureDeal();
    if (!ensuredDealId) return;
    setDealId(ensuredDealId);
    const latestAppointment = dealNegotiationState?.latestAppointment;
    const latestAppointmentAction = String(latestAppointment?.action || '').toUpperCase();
    const appointmentPending = isNegotiationPending(latestAppointmentAction);
    const appointmentAccepted = latestAppointmentAction === 'ACCEPTED';
    const appointmentByMe = Number(latestAppointment?.senderId || 0) === Number(user?.id || 0);
    if (appointmentPending && appointmentByMe) {
      const ownerHint =
        ownerProfile?.user?.name ||
        ownerProfile?.user?.fullName ||
        (offer?.userId ? `właściciel (profil #${offer.userId})` : 'właściciel');
      Alert.alert(
        'Propozycja terminu już w czacie',
        `Wysłałeś propozycję terminu prezentacji. Teraz kolej u ${ownerHint}: akceptacja, kontroferta daty lub odrzucenie. Śledź odpowiedź w Dealroomie lub w tym ekranie.`
      );
      return;
    }
    if (appointmentAccepted) {
      const dateLabel = latestAppointment?.proposedDate
        ? new Date(latestAppointment.proposedDate).toLocaleString('pl-PL')
        : '-';
      Alert.alert(
        'Termin spotkania potwierdzony',
        `Spotkanie zostało umówione na: ${dateLabel}.`
      );
      return;
    }
    if (latestAppointment?.appointmentId && appointmentPending && !appointmentByMe) {
      setAppointmentModalConfig({
        mode: 'respond',
        appointmentId: latestAppointment.appointmentId,
        eventAction: latestAppointment.action || null,
        proposedDate: latestAppointment.proposedDate || null,
        history: dealNegotiationState?.appointmentHistory || [],
      });
    } else {
      setAppointmentModalConfig({
        mode: 'create',
        appointmentId: null,
        eventAction: null,
        proposedDate: null,
        history: dealNegotiationState?.appointmentHistory || [],
      });
    }
    setIsAppointmentModalOpen(true);
  };

  const openDealroom = () => {
    if (!dealId) return;
    navigation.navigate('DealroomChat', {
      dealId,
      title: offer?.title || `Transakcja #${dealId}`,
    });
  };

  useEffect(() => {
    const loadDealState = async () => {
      if (!token || !offer?.id || isOwner) {
        setDealNegotiationState(null);
        return;
      }
      setDealSyncLoading(true);
      try {
        const dealsRes = await fetch(`${API_URL}/api/mobile/v1/deals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dealsJson = await dealsRes.json();
        const deals = Array.isArray(dealsJson)
          ? dealsJson
          : Array.isArray(dealsJson?.deals)
            ? dealsJson.deals
            : Array.isArray(dealsJson?.items)
              ? dealsJson.items
              : Array.isArray(dealsJson?.data?.deals)
                ? dealsJson.data.deals
                : Array.isArray(dealsJson?.data?.items)
                  ? dealsJson.data.items
                  : [];
        const matchingDeal = deals.find((d: any) => Number(
          d?.offerId || d?.offer?.id || d?.listingId || d?.propertyId || 0
        ) === Number(offer.id));
        if (!matchingDeal?.id) {
          setDealNegotiationState(null);
          return;
        }
        const existingDealId = Number(matchingDeal.id);
        setDealId(existingDealId);
        const messagesRes = await fetch(`${API_URL}/api/mobile/v1/deals/${existingDealId}/messages?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const messagesJson = await messagesRes.json();
        const messages = Array.isArray(messagesJson?.messages) ? messagesJson.messages : [];
        const eventMessages = messages
          .map((msg: any) => {
            const event = parseDealEvent(msg?.content);
            return event ? { ...event, senderId: msg?.senderId, createdAt: msg?.createdAt } : null;
          })
          .filter(Boolean);
        const bidHistory = eventMessages.filter((e: any) => e.entity === 'BID');
        const appointmentHistory = eventMessages.filter((e: any) => e.entity === 'APPOINTMENT');
        const latestBid = bidHistory.length > 0 ? bidHistory[bidHistory.length - 1] : null;
        const latestAppointment = appointmentHistory.length > 0 ? appointmentHistory[appointmentHistory.length - 1] : null;
        setDealNegotiationState({
          dealId: existingDealId,
          bidHistory,
          appointmentHistory,
          latestBid,
          latestAppointment,
        });
      } catch {
        // noop
      } finally {
        setDealSyncLoading(false);
      }
    };
    loadDealState();
  }, [token, offer?.id, isOwner]);

  useEffect(() => {
    const loadOwnerProfile = async () => {
      if (!offer?.userId) return;
      setOwnerProfileLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/users/${offer.userId}/public`);
        const data = await res.json();
        if (res.ok && !data?.error) {
          setOwnerProfile(data);
        }
      } catch (_e) {
        // noop
      } finally {
        setOwnerProfileLoading(false);
      }
    };
    loadOwnerProfile();
  }, [offer?.userId]);

  const ownerReviews = Array.isArray(ownerProfile?.reviews) ? ownerProfile.reviews : [];
  const ownerAverageRating = ownerReviews.length > 0
    ? ownerReviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) / ownerReviews.length
    : 0;

  const fetchPublicProfile = async (userId: number) => {
    const res = await fetch(`${API_URL}/api/users/${userId}/public`);
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || 'Nie udało się pobrać profilu.');
    }
    return data;
  };

  const openOwnerProfileModal = () => {
    Haptics.selectionAsync();
    setProfileHistory([]);
    if (ownerProfile?.user?.id) {
      setActiveProfileUserId(Number(ownerProfile.user.id));
      setActiveProfileData(ownerProfile);
      setActiveProfileLoading(false);
    } else if (offer?.userId) {
      setActiveProfileUserId(Number(offer.userId));
      setActiveProfileData(null);
      setActiveProfileLoading(true);
    }
    setIsOwnerProfileOpen(true);
  };

  const openReviewerProfileInModal = async (reviewerId: number) => {
    if (!reviewerId) return;
    Haptics.selectionAsync();
    if (activeProfileUserId === reviewerId && activeProfileData) return;
    if (activeProfileUserId) {
      setProfileHistory(prev => [...prev, activeProfileUserId]);
    }
    setActiveProfileUserId(reviewerId);
    setActiveProfileData(null);
    setActiveProfileLoading(true);
    try {
      const profile = await fetchPublicProfile(reviewerId);
      setActiveProfileData(profile);
    } catch (_e) {
      Alert.alert('EstateOS', 'Nie udało się pobrać profilu autora opinii.');
    } finally {
      setActiveProfileLoading(false);
    }
  };

  const handleProfileBack = async () => {
    if (profileHistory.length === 0) return;
    Haptics.selectionAsync();
    const previousId = profileHistory[profileHistory.length - 1];
    setProfileHistory(prev => prev.slice(0, -1));
    setActiveProfileUserId(previousId);
    setActiveProfileData(null);
    setActiveProfileLoading(true);
    try {
      if (ownerProfile?.user?.id && Number(ownerProfile.user.id) === Number(previousId)) {
        setActiveProfileData(ownerProfile);
      } else {
        const profile = await fetchPublicProfile(previousId);
        setActiveProfileData(profile);
      }
    } catch (_e) {
      Alert.alert('EstateOS', 'Nie udało się wrócić do poprzedniego profilu.');
    } finally {
      setActiveProfileLoading(false);
    }
  };

  useEffect(() => {
    const seedOwnerAsActive = async () => {
      if (!isOwnerProfileOpen) return;
      const ownerUserId = Number(ownerProfile?.user?.id || offer?.userId || 0);
      if (!ownerUserId) return;
      if (activeProfileUserId && activeProfileData) return;
      setActiveProfileUserId(ownerUserId);
      if (ownerProfile?.user?.id) {
        setActiveProfileData(ownerProfile);
        setActiveProfileLoading(false);
        return;
      }
      setActiveProfileLoading(true);
      try {
        const profile = await fetchPublicProfile(ownerUserId);
        setActiveProfileData(profile);
      } catch (_e) {
        // noop
      } finally {
        setActiveProfileLoading(false);
      }
    };
    seedOwnerAsActive();
  }, [isOwnerProfileOpen, ownerProfile, offer?.userId]);

  useEffect(() => {
    const preloadReviewerNames = async () => {
      const reviews = Array.isArray(activeProfileData?.reviews) ? activeProfileData.reviews : [];
      const ids: number[] = Array.from(new Set<number>(
        reviews
          .map((r: any) => Number(r?.reviewerId || 0))
          .filter((id: number) => id > 0 && !reviewerNameCache[id])
      ));
      if (ids.length === 0) return;
      const next: Record<number, string> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const profile = await fetchPublicProfile(id);
          next[id] = profile?.user?.name || `Użytkownik #${id}`;
        } catch {
          next[id] = `Użytkownik #${id}`;
        }
      }));
      setReviewerNameCache(prev => ({ ...prev, ...next }));
    };
    preloadReviewerNames();
  }, [activeProfileData, reviewerNameCache]);

  const bidBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bidBtnScale.value }],
  }));

  const apptBtnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: apptBtnScale.value }],
  }));

  const animateBidButton = () => {
    bidBtnScale.value = withSequence(
      withTiming(0.95, { duration: 90 }),
      withSpring(1.06, { damping: 7, stiffness: 240 }),
      withSpring(1, { damping: 9, stiffness: 220 })
    );
  };

  const animateAppointmentButton = () => {
    apptBtnScale.value = withSequence(
      withTiming(0.95, { duration: 90 }),
      withSpring(1.05, { damping: 7, stiffness: 220 }),
      withSpring(1, { damping: 9, stiffness: 220 })
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
      <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
        <Pressable onPress={() => openGallery(0)} style={{ flex: 1 }}>
          <Image source={{ uri: imagesToShow[0] }} style={styles.mainImage} contentFit="cover" transition={500} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.4)']}
            style={styles.heroGradient}
            pointerEvents="none"
          />
        </Pressable>
      </Animated.View>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.glassButton} onPress={() => navigation?.goBack()} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <ChevronLeft color="white" size={24} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity style={[styles.glassButton, { marginRight: 12 }]} onPress={handleShare} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <ShareIcon color="white" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.glassButton} onPress={handleFavorite} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Animated.View style={animatedHeartStyle}>
              <Heart color={isFavorite ? "#ff3b30" : "white"} fill={isFavorite ? "#ff3b30" : "transparent"} size={20} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: IMG_HEIGHT - 40, paddingBottom: 160 }}>
        <View style={[styles.contentSheet, { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }]}>
          {/* Cena na górze została usunięta — pełna kwota i PLN/m² siedzą teraz
              w dolnym pasku CTA. Trzymamy tu tylko badge'y meta (czynsz, views). */}
          <View style={styles.topMetaBadgesRow}>
            {hasAdminFee ? (
              <View style={[styles.adminFeeBadge, { backgroundColor: isDark ? 'rgba(52,199,89,0.15)' : 'rgba(52,199,89,0.12)', borderColor: isDark ? 'rgba(52,199,89,0.4)' : 'rgba(52,199,89,0.35)' }]}>
                <Text style={[styles.adminFeeBadgeText, { color: isDark ? '#34d399' : '#1d1d1f' }]}>+ czynsz admin {adminFeeLabel}</Text>
              </View>
            ) : null}
            <View style={[styles.viewsBadge, { backgroundColor: isDark ? '#1c1c1e' : '#f3f4f6', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)' }]}>
              <Eye color={isDark ? "#9ca3af" : "#374151"} size={14} />
              <Text style={[styles.viewsBadgeText, { color: isDark ? '#d1d5db' : '#374151' }]}>{viewsCount > 0 ? `${viewsCount.toLocaleString('pl-PL')} wyświetleń` : 'Nowa oferta'}</Text>
            </View>
          </View>
          
          <Text style={[styles.title, isDark && { color: '#ffffff' }]}>{displayOffer.title}</Text>
          
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsLocationPreviewOpen(true);
            }}
            style={({ pressed }) => [styles.locationRow, pressed && { opacity: 0.72 }]}
          >
            <MapPin color={isDark ? "#9ca3af" : "#86868b"} size={16} />
            <Text style={[styles.locationText, isDark && { color: '#9ca3af' }]}>{locationLine}</Text>
          </Pressable>
          
          <View style={[styles.safetyBadgeCard, isLegalSafeVerified ? (isDark ? styles.safetyBadgeCardVerifiedDark : styles.safetyBadgeCardVerified) : (isDark ? styles.safetyBadgeCardPendingDark : styles.safetyBadgeCardPending)]}>
            <View style={[styles.safetyBadgeIconWrap, isLegalSafeVerified ? (isDark ? styles.safetyBadgeIconWrapVerifiedDark : styles.safetyBadgeIconWrapVerified) : (isDark ? styles.safetyBadgeIconWrapPendingDark : null)]}>
              <ShieldCheck color={isLegalSafeVerified ? '#10b981' : (isDark ? '#9ca3af' : '#6b7280')} size={16} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.safetyBadgeTitle, isLegalSafeVerified ? (isDark ? styles.safetyBadgeTitleVerifiedDark : styles.safetyBadgeTitleVerified) : (isDark ? styles.safetyBadgeTitlePendingDark : null)]}>
                {isLegalSafeVerified ? 'Zweryfikowano prawnie' : 'Weryfikacja prawna w toku'}
              </Text>
              <Text style={[styles.safetyBadgeSub, isDark && { color: '#9ca3af' }]}>{legalSafetyText}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <BedDouble color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{displayOffer.stats.beds} Pokoje</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Maximize color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{displayOffer.stats.size}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Layers color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Piętro {formatFloorStat(offer?.floor)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Calendar color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Rok {offer?.yearBuilt || offer?.buildYear || offer?.year || '-'}</Text>
            </View>
          </View>

          <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>Szczegóły</Text>
          <View style={[styles.detailsContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f5f6f8', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.05)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
            <View style={[styles.detailsContainerInnerGlow, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]} pointerEvents="none" />
            <View style={[styles.detailRow, { borderTopWidth: 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Stan wykończenia</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatCondition(offer?.condition)}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Czynsz administracyjny</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{adminFeeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Ogrzewanie</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{heatingLabel || 'Nie podano'}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Umeblowanie</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{furnishedLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Na rynku od</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatDate(offer?.createdAt)}</Text></View>
          </View>

          {/* RZUT NIERUCHOMOŚCI */}
          <FloorPlanViewer 
            imageUrl={offer?.floorPlanUrl ? (offer.floorPlanUrl.startsWith('/uploads') ? `${API_URL}${offer.floorPlanUrl}` : offer.floorPlanUrl) : 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=800&auto=format&fit=crop'} 
            theme={theme} 
          />

          {activeAmenities.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 15 }, isDark && { color: '#ffffff' }]}>Udogodnienia</Text>
              <View style={styles.amenitiesWrapper}>
                {activeAmenities.map((am, i) => <View key={i} style={[styles.amenityPill, isDark && { backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.05)' }]}><Text style={[styles.amenityText, isDark && { color: '#e5e7eb' }]}>{am}</Text></View>)}
              </View>
            </>
          )}

          <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>O nieruchomości</Text>
          <Text style={[styles.description, isDark && { color: '#d1d5db' }]}>{displayOffer.description}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 40 }, isDark && { color: '#ffffff' }]}>Galeria zdjęć</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.8 + 16} decelerationRate="fast" contentContainerStyle={styles.galleryContainer}>
            {imagesToShow.map((img, idx) => (
              <Pressable key={idx} onPress={() => openGallery(idx)}>
                <Image source={{ uri: img }} style={styles.galleryThumbnail} contentFit="cover" transition={200} />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.offerIdText}>ID Oferty: {offer?.id}</Text>
          {!isOwner && !dealSyncLoading && dealNegotiationState?.latestAppointment && (
            <View
              style={[
                styles.negotiationMemoryBox,
                String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? styles.negotiationMemoryBoxConfirmed
                  : styles.negotiationMemoryBoxPending
              ]}
            >
              <Text style={styles.negotiationMemoryLabel}>TERMIN SPOTKANIA</Text>
              <Text style={styles.negotiationMemoryTitle}>
                {String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? 'Termin prezentacji: uzgodniony'
                  : 'Termin prezentacji: w negocjacji'}
              </Text>
              <Text style={styles.negotiationMemoryText}>
                {String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? `Potwierdzona data i godzina: ${dealNegotiationState.latestAppointment?.proposedDate ? new Date(dealNegotiationState.latestAppointment.proposedDate).toLocaleString('pl-PL') : '-'}.`
                  : Number(dealNegotiationState.latestAppointment?.senderId || 0) === Number(user?.id || 0)
                    ? 'Ty wysłałeś ostatnią propozycję terminu — czekasz na reakcję właściciela nieruchomości (akceptacja, kontroferta lub odrzucenie).'
                    : `Ostatnia akcja właściciela: ${getDealActionLabel(dealNegotiationState.latestAppointment.action)}. Twoja kolej: akceptacja, kontroferta daty lub odrzucenie (przycisk „Spotkanie”).`}
              </Text>
            </View>
          )}
          {!isOwner && !dealSyncLoading && dealNegotiationState?.latestBid && (
            <View
              style={[
                styles.negotiationMemoryBox,
                String(dealNegotiationState.latestBid.action || '').toUpperCase() === 'ACCEPTED'
                  ? styles.negotiationMemoryBoxConfirmed
                  : styles.negotiationMemoryBoxPending
              ]}
            >
              <Text style={styles.negotiationMemoryLabel}>NEGOCJACJE CENOWE</Text>
              <Text style={styles.negotiationMemoryTitle}>
                {String(dealNegotiationState.latestBid.action || '').toUpperCase() === 'ACCEPTED'
                  ? 'Cena: uzgodniona'
                  : 'Cena: w negocjacji'}
              </Text>
              <Text style={styles.negotiationMemoryText}>
                {String(dealNegotiationState.latestBid.action || '').toUpperCase() === 'ACCEPTED'
                  ? `Uzgodniona kwota transakcyjna: ${Number(dealNegotiationState.latestBid?.amount || 0).toLocaleString('pl-PL')} PLN.`
                  : Number(dealNegotiationState.latestBid?.senderId || 0) === Number(user?.id || 0)
                    ? `Twoja ostatnia propozycja: ${Number(dealNegotiationState.latestBid?.amount || 0).toLocaleString('pl-PL')} PLN — czekasz na decyzję właściciela (akceptacja, kontroferta lub odrzucenie).`
                    : `Właściciel zaproponował ${Number(dealNegotiationState.latestBid?.amount || 0).toLocaleString('pl-PL')} PLN — Twoja kolej z przycisku „Negocjuj cenę”.`}
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* --- NOWY, LUKSUSOWY BOTTOM BAR APPLE-STYLE --- */}
      <View style={styles.bottomBarContainer}>
        <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={[styles.bottomBar, isDark && { backgroundColor: 'rgba(10,10,10,0.65)', borderTopColor: 'rgba(255,255,255,0.1)' }]}>
          
          {/* TOP ROW: Cena i Użytkownik */}
          <View style={styles.bottomBarTopRow}>
            <View style={{ flexShrink: 1, marginRight: 12 }}>
              <Text style={styles.bottomBarPriceLabel}>Cena ofertowa</Text>
              <Text
                style={[styles.bottomBarPrice, isDark && { color: '#ffffff' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {displayOffer.price}
              </Text>
              {pricePerSqmLabel ? (
                <Text style={[styles.bottomBarPriceSqm, isDark && { color: '#9ca3af' }]} numberOfLines={1}>
                  {pricePerSqmLabel}
                </Text>
              ) : null}
            </View>

            {isOwner ? (
              <View style={[styles.ownerCompactPill, isDark && { backgroundColor: '#1c1c1e' }]}>
                <Text style={[styles.ownerPillName, isDark && { color: '#ffffff' }]}>Twój panel zarządzania</Text>
              </View>
            ) : (
              <Pressable 
                onPress={openOwnerProfileModal} 
                style={({ pressed }) => [styles.ownerCompactPill, isDark && { backgroundColor: '#1c1c1e' }, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.ownerAvatarMock}>
                  <ShieldCheck size={12} color="#fff" />
                </View>
                <View style={styles.ownerPillInfo}>
                  <Text numberOfLines={1} style={[styles.ownerPillName, isDark && { color: '#ffffff' }]}>
                    {ownerProfile?.user?.name?.split(' ')[0] || offer?.userName || 'Sprzedawca'}
                  </Text>
                  <View style={styles.ownerStarsRowMini}>
                    <Star size={10} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ownerPillRatingText}>
                      {ownerProfileLoading ? '-' : (ownerAverageRating || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </View>

          {/* BOTTOM ROW: Akcje */}
          <View style={styles.bottomActionsRow}>
            {isOwner ? (
              <TouchableOpacity style={[styles.primaryAppleButton, { backgroundColor: isDark ? '#ffffff' : '#1d1d1f', flex: 1 }]} onPress={handleEdit}>
                <Pencil size={18} color={isDark ? '#000000' : '#fff'} />
                <Text style={[styles.primaryAppleButtonText, { color: isDark ? '#000000' : '#ffffff' }]}>Edytuj ofertę</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Animated.View style={[styles.actionFlexWrap, apptBtnAnimatedStyle]}>
                  <TouchableOpacity
                    style={[styles.secondaryAppleButton, isDark && { backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.1)' }]}
                    onPress={() => {
                      if (guardPhoneVerification()) return;
                      animateAppointmentButton();
                      openAppointmentFlow();
                    }}
                    activeOpacity={0.8}
                  >
                    <CalendarClock size={16} color={isDark ? '#ffffff' : '#1d1d1f'} />
                    <Text style={[styles.secondaryAppleButtonText, isDark && { color: '#ffffff' }]}>Spotkanie</Text>
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View style={[styles.actionFlexWrap, bidBtnAnimatedStyle]}>
                  <TouchableOpacity
                    style={styles.primaryAppleButton}
                    onPress={() => {
                      if (guardPhoneVerification()) return;
                      animateBidButton();
                      openBidFlow();
                    }}
                    activeOpacity={0.8}
                  >
                    <Handshake size={16} color="#fff" />
                    <Text style={styles.primaryAppleButtonText}>Negocjuj cenę</Text>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}
          </View>

        </BlurView>
      </View>

      <ImageViewing
        images={lightboxImages}
        imageIndex={galleryInitialIndex}
        visible={isGalleryOpen}
        onRequestClose={closeGallery}
        onImageIndexChange={(idx) => {
          if (!Number.isFinite(idx as number)) return;
          const safe = Number(idx);
          setGalleryCurrentIndex(safe);
        }}
        doubleTapToZoomEnabled
        swipeToCloseEnabled={false}
        presentationStyle="fullScreen"
        FooterComponent={({ imageIndex }) => (
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryCounter}>{(imageIndex ?? galleryCurrentIndex) + 1} z {imagesToShow.length}</Text>
          </View>
        )}
      />

      <Modal
        visible={isLocationPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLocationPreviewOpen(false)}
      >
        <View style={styles.locationModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsLocationPreviewOpen(false)} />
          <View style={styles.locationModalCard}>
            <View style={styles.locationModalHeader}>
              <Text style={styles.locationModalTitle}>Lokalizacja oferty</Text>
              <TouchableOpacity onPress={() => setIsLocationPreviewOpen(false)} style={styles.locationModalCloseBtn}>
                <X size={16} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.locationModalAddress}>{locationLine}</Text>
            <View style={styles.locationMiniMapWrap}>
              <MapView
                style={styles.locationMiniMap}
                pointerEvents="none"
                initialRegion={{
                  latitude: mapCoordinate.latitude,
                  longitude: mapCoordinate.longitude,
                  latitudeDelta: mapPresentation.latitudeDelta,
                  longitudeDelta: mapPresentation.longitudeDelta,
                }}
                region={{
                  latitude: mapCoordinate.latitude,
                  longitude: mapCoordinate.longitude,
                  latitudeDelta: mapPresentation.latitudeDelta,
                  longitudeDelta: mapPresentation.longitudeDelta,
                }}
              >
                {mapPresentation.mode === 'pin' ? (
                  <Marker coordinate={mapCoordinate} title={displayOffer.title} />
                ) : (
                  <Circle
                    center={mapCoordinate}
                    radius={mapPresentation.circleRadiusM}
                    strokeColor="rgba(220,38,38,0.9)"
                    strokeWidth={2}
                    fillColor="rgba(220,38,38,0.18)"
                  />
                )}
              </MapView>
            </View>
            {!hasValidMapCoords ? (
              <Text style={styles.locationModalHint}>Dokładne współrzędne nie są dostępne dla tej oferty.</Text>
            ) : mapPresentation.mode === 'circle' ? (
              <Text style={styles.locationModalHint}>
                Właściciel ukrył dokładny adres — pokazujemy obszar ok. 250 m, a środek tarczy jest
                celowo przesunięty (budynek leży gdzieś wewnątrz okręgu).
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <BidActionModal
        visible={isBidModalOpen}
        mode={bidModalConfig.mode}
        dealId={dealId}
        token={token || null}
        bidId={bidModalConfig.bidId}
        initialAmount={bidModalConfig.initialAmount}
        eventAction={bidModalConfig.eventAction}
        quickAccept={bidModalConfig.quickAccept}
        history={bidModalConfig.history}
        myUserId={user?.id != null ? Number(user.id) : null}
        title="Negocjacja ceny"
        offerId={offer?.id != null ? Number(offer.id) : null}
        userId={user?.id != null ? Number(user.id) : null}
        isListingOwner={!!isOwner}
        listingOwnerUserId={listingOwnerUserId}
        onClose={() => setIsBidModalOpen(false)}
        onDone={openDealroom}
      />

      <AppointmentActionModal
        visible={isAppointmentModalOpen}
        mode={appointmentModalConfig.mode}
        dealId={dealId}
        token={token || null}
        appointmentId={appointmentModalConfig.appointmentId}
        eventAction={appointmentModalConfig.eventAction}
        proposedDate={appointmentModalConfig.proposedDate}
        history={appointmentModalConfig.history}
        myUserId={user?.id != null ? Number(user.id) : null}
        title="Negocjacja terminu prezentacji"
        onClose={() => setIsAppointmentModalOpen(false)}
        onDone={openDealroom}
      />

      {/* --- MODALE --- */}
      <Modal visible={isOwnerProfileOpen} transparent animationType="fade" onRequestClose={() => setIsOwnerProfileOpen(false)}>
        <View style={styles.profileOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setIsOwnerProfileOpen(false);
              setProfileHistory([]);
            }}
          />
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderLeft}>
                {profileHistory.length > 0 ? (
                  <TouchableOpacity onPress={handleProfileBack} style={styles.profileBackBtn}>
                    <ChevronLeft size={16} color="#fff" />
                    <Text style={styles.profileBackText}>Wróć</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.profileBackPlaceholder} />
                )}
                <Text style={styles.profileTitle}>Profil użytkownika</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsOwnerProfileOpen(false);
                  setProfileHistory([]);
                }}
                style={styles.profileCloseBtn}
              >
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {activeProfileLoading ? (
              <View style={styles.profileLoaderWrap}>
                <ActivityIndicator color="#f59e0b" />
                <Text style={styles.profileMuted}>Ładowanie profilu...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.profileName}>{activeProfileData?.user?.name || 'Użytkownik'}</Text>
                <EliteStatusBadges subject={activeProfileData?.user || activeProfileData} isDark compact />
                <Text style={styles.profileMeta}>ID: {activeProfileData?.user?.id || activeProfileUserId || offer?.userId || '-'}</Text>

                <View style={styles.profileRatingBox}>
                  <Text style={styles.profileRatingValue}>
                    {(
                      (Array.isArray(activeProfileData?.reviews) && activeProfileData.reviews.length > 0)
                        ? (
                            activeProfileData.reviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) /
                            activeProfileData.reviews.length
                          )
                        : 0
                    ).toFixed(1)}
                  </Text>
                  <View style={styles.profileStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        color={s <= Math.round(
                          (Array.isArray(activeProfileData?.reviews) && activeProfileData.reviews.length > 0)
                            ? (
                                activeProfileData.reviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) /
                                activeProfileData.reviews.length
                              )
                            : 0
                        ) ? '#f59e0b' : '#4b5563'}
                        fill={s <= Math.round(
                          (Array.isArray(activeProfileData?.reviews) && activeProfileData.reviews.length > 0)
                            ? (
                                activeProfileData.reviews.reduce((acc: number, r: any) => acc + Number(r?.rating || 0), 0) /
                                activeProfileData.reviews.length
                              )
                            : 0
                        ) ? '#f59e0b' : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={styles.profileMuted}>{Array.isArray(activeProfileData?.reviews) ? activeProfileData.reviews.length : 0} opinii</Text>
                </View>

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {!Array.isArray(activeProfileData?.reviews) || activeProfileData.reviews.length === 0 ? (
                    <Text style={styles.profileMuted}>Brak opinii dla tego użytkownika.</Text>
                  ) : activeProfileData.reviews.slice(0, 12).map((r: any) => (
                    <View key={r.id} style={styles.reviewItem}>
                      <View style={styles.reviewTop}>
                        <View style={{ flex: 1 }}>
                          <Pressable onPress={() => openReviewerProfileInModal(Number(r?.reviewerId || 0))} style={({ pressed }) => [styles.reviewAuthorBtn, pressed && { opacity: 0.7 }]}>
                            <Text style={styles.reviewAuthorText}>
                              {reviewerNameCache[Number(r?.reviewerId || 0)] || `Użytkownik #${r?.reviewerId || '-'}`}
                            </Text>
                            <ChevronRight size={12} color="#9ca3af" />
                          </Pressable>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={10}
                                color={s <= Number(r?.rating || 0) ? '#f59e0b' : '#6b7280'}
                                fill={s <= Number(r?.rating || 0) ? '#f59e0b' : 'transparent'}
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

      {/* --- OFF MARKET: BLOKADA 24H DLA NIE-PRO --- */}
      <Modal visible={isOffMarketLocked} transparent animationType="fade">
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.offMarketBackdrop} />
          <View style={styles.offMarketOverlay}>
            <View style={styles.offMarketCard}>
              <View style={styles.offMarketTopStripe} />
              <View style={styles.offMarketIconWrap}>
                <Lock color="#D4AF37" size={30} />
              </View>
              <Text style={styles.offMarketTitle}>Oferta Off-Market</Text>
              <Text style={styles.offMarketSub}>
                Ta ekskluzywna oferta zadebiutowała w systemie. Zostanie odblokowana dla zwykłych użytkowników za:
              </Text>
              <View style={styles.countdownRow}>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValue}>{countdownParts.hours}</Text>
                  <Text style={styles.countdownLabel}>GODZ</Text>
                </View>
                <Text style={styles.countdownColon}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValue}>{countdownParts.minutes}</Text>
                  <Text style={styles.countdownLabel}>MIN</Text>
                </View>
                <Text style={styles.countdownColon}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValueAccent}>{countdownParts.seconds}</Text>
                  <Text style={styles.countdownLabelAccent}>SEK</Text>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.9} style={styles.offMarketPrimaryButton} onPress={handleBecomePro}>
                <Crown color="#0a0a0a" size={16} />
                <Text style={styles.offMarketPrimaryButtonText}>Zostań PRO i zobacz</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.offMarketSecondaryButton} onPress={() => navigation?.goBack()}>
                <Text style={styles.offMarketSecondaryButtonText}>Poczekam cierpliwie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* --- GUEST GATE: DOSTĘP DO OFERTY DLA NIEZALOGOWANYCH --- */}
      <Modal visible={isGuestGateVisible} transparent animationType="fade" onRequestClose={() => navigation?.goBack()}>
        <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.guestGateBackdrop} />
          <View style={styles.offMarketOverlay}>
            <View style={styles.guestGateCard}>
              <Pressable
                onPress={() => {
                  setIsGuestGateVisible(false);
                  navigation?.goBack();
                }}
                style={styles.guestCloseBtn}
                hitSlop={12}
              >
                <X color="rgba(255,255,255,0.8)" size={18} />
              </Pressable>
              <View style={styles.guestGateIconWrap}>
                <ShieldCheck color="#10B981" size={30} />
              </View>
              <Text style={styles.guestGateTitle}>Załóż bezpłatne konto</Text>
              <Text style={styles.guestGateSub}>
                Za darmo zobaczysz każdą ofertę, zainicjujesz kontakt z właścicielami oraz wystawisz własną ofertę bez opłat.
              </Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestPrimaryButton} onPress={() => openAuthEntry('register')}>
                <Crown color="#0a0a0a" size={16} />
                <Text style={styles.guestPrimaryButtonText}>Zarejestruj się</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestSecondaryButton} onPress={() => openAuthEntry('login')}>
                <Text style={styles.guestSecondaryButtonText}>Zaloguj się</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      <Modal
        visible={isPhoneVerifyGateVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPhoneVerifyGateVisible(false)}
      >
        <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.guestGateBackdrop} />
          <View style={styles.offMarketOverlay}>
            <View style={styles.guestGateCard}>
              <Pressable onPress={() => setIsPhoneVerifyGateVisible(false)} style={styles.guestCloseBtn} hitSlop={12}>
                <X color="rgba(255,255,255,0.8)" size={18} />
              </Pressable>
              <View style={styles.guestGateIconWrap}>
                <ShieldCheck color="#10B981" size={30} />
              </View>
              <Text style={styles.guestGateTitle}>Zweryfikuj numer telefonu</Text>
              <Text style={styles.guestGateSub}>
                W EstateOS wszyscy uczestnicy negocjacji są zweryfikowani, dzięki czemu rozmowy o cenie i terminie są
                realne, bezpieczne i traktowane na poważnie.
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.guestPrimaryButton}
                onPress={() => {
                  setIsPhoneVerifyGateVisible(false);
                  navigation.navigate('SmsVerification');
                }}
              >
                <ShieldCheck color="#062315" size={16} />
                <Text style={styles.guestPrimaryButtonText}>Zweryfikuj swój numer telefonu</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestSecondaryButton} onPress={() => setIsPhoneVerifyGateVisible(false)}>
                <Text style={styles.guestSecondaryButtonText}>Później</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  imageContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: IMG_HEIGHT },
  mainImage: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 55, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 100 },
  topBarRight: { flexDirection: 'row' },
  glassButton: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
  },
  contentSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, minHeight: 800, shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 10 },
  price: { fontSize: 34, fontWeight: '800', color: '#1d1d1f', letterSpacing: -1, marginBottom: 8 },
  topMetaBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  adminFeeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderColor: 'rgba(52,199,89,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminFeeBadgeText: { fontSize: 12, fontWeight: '800', color: '#1d1d1f', letterSpacing: 0.2 },
  viewsBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  viewsBadgeText: { color: '#374151', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 26, fontWeight: '800', color: '#1d1d1f', letterSpacing: -0.5, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  locationText: { fontSize: 15, color: '#86868b', marginLeft: 6, fontWeight: '500', flexShrink: 1 },
  locationModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  locationModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  locationModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  locationModalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  locationModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationModalAddress: { fontSize: 13, color: '#6b7280', marginBottom: 10, fontWeight: '600' },
  locationMiniMapWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  locationMiniMap: { width: '100%', height: 190 },
  locationModalHint: { marginTop: 8, fontSize: 12, color: '#9ca3af' },
  safetyBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
    gap: 12,
  },
  safetyBadgeCardPending: {
    backgroundColor: '#f4f4f5',
    borderColor: 'rgba(107,114,128,0.24)',
    borderTopColor: 'rgba(255,255,255,0.7)',
  },
  safetyBadgeCardPendingDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  safetyBadgeCardVerified: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.25)',
    borderTopColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  safetyBadgeCardVerifiedDark: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  safetyBadgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(107,114,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBadgeIconWrapPendingDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  safetyBadgeIconWrapVerified: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  safetyBadgeIconWrapVerifiedDark: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  safetyBadgeTitle: { color: '#4b5563', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  safetyBadgeTitlePendingDark: { color: '#d1d5db' },
  safetyBadgeTitleVerified: { color: '#047857' },
  safetyBadgeTitleVerifiedDark: { color: '#34d399' },
  safetyBadgeSub: { color: '#6b7280', fontSize: 12, fontWeight: '600', marginTop: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, columnGap: '4%', marginBottom: 32 },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#f6f7f9',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    borderTopColor: 'rgba(255,255,255,0.8)', // subtle highlight for 3D effect
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 22,
    width: '48%',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#1d1d1f' },
  divider: { height: 1, backgroundColor: '#e5e5ea', marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1d1d1f', marginBottom: 16, letterSpacing: -0.2 },
  description: { fontSize: 16, lineHeight: 26, color: '#424245', fontWeight: '400' },
  detailsContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f5f6f8',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
    borderTopColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  detailsContainerInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  detailLabel: { color: '#86868b', fontSize: 15, fontWeight: '500' },
  detailValue: { color: '#1d1d1f', fontSize: 15, fontWeight: '600' },
  amenitiesWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  amenityPill: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(17,24,39,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  amenityText: { color: '#1d1d1f', fontSize: 14, fontWeight: '600' },
  offerIdText: { textAlign: 'center', color: '#86868b', fontSize: 12, marginTop: 40, marginBottom: 20, letterSpacing: 0.5 },
  
  galleryContainer: { paddingRight: 24 },
  galleryThumbnail: { width: width * 0.8, height: 220, borderRadius: 24, marginRight: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  
  // --- ZMIENIONA SEKCJA BOTTOM BAR ---
  bottomBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBar: { 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  bottomBarTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  bottomBarPriceLabel: { fontSize: 11, fontWeight: '700', color: '#86868b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  bottomBarPrice: { fontSize: 22, fontWeight: '800', color: '#1d1d1f', letterSpacing: -0.5 },
  bottomBarPriceSqm: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.1, marginTop: 2 },
  
  ownerCompactPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ffffff', 
    borderRadius: 24, 
    padding: 6, 
    paddingRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    maxWidth: '50%' // Zabezpieczenie dla małych ekranów
  },
  ownerAvatarMock: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  ownerPillInfo: { marginLeft: 8, justifyContent: 'center' },
  ownerPillName: { color: '#1d1d1f', fontSize: 12, fontWeight: '700' },
  ownerStarsRowMini: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  ownerPillRatingText: { color: '#6b7280', fontSize: 10, fontWeight: '700', marginLeft: 4 },
  
  bottomActionsRow: { flexDirection: 'row', gap: 12 },
  actionFlexWrap: { flex: 1 },
  
  secondaryAppleButton: { 
    flex: 1,
    backgroundColor: '#f5f5f7', 
    borderRadius: 24, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  secondaryAppleButtonText: { color: '#1d1d1f', fontSize: 14, fontWeight: '700' },
  
  primaryAppleButton: { 
    flex: 1,
    backgroundColor: '#0071e3', 
    borderRadius: 24, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6,
    shadowColor: '#0071e3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5
  },
  primaryAppleButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  // --- KONIEC ZMIENIONEJ SEKCJI ---

  editButtonSubtle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 113, 227, 0.08)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginBottom: 24, gap: 8 },
  editButtonSubtleText: { color: '#0071e3', fontSize: 14, fontWeight: '700' },

  galleryHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  galleryCounter: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  galleryCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  offMarketBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.80)' },
  offMarketOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  offMarketCard: { width: '100%', maxWidth: 440, backgroundColor: '#0a0a0a', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', position: 'relative', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 30 },
  offMarketTopStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#D4AF37' },
  offMarketIconWrap: { width: 62, height: 62, borderRadius: 31, marginTop: 6, marginBottom: 18, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center' },
  offMarketTitle: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  offMarketSub: { color: 'rgba(255,255,255,0.52)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 30, paddingHorizontal: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 28 },
  countdownUnit: { alignItems: 'center', minWidth: 72 },
  countdownValue: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 0.2 },
  countdownValueAccent: { color: '#D4AF37', fontSize: 38, fontWeight: '900', letterSpacing: 0.2 },
  countdownLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 2.1, marginTop: 2 },
  countdownLabelAccent: { color: 'rgba(212,175,55,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 2.1, marginTop: 2 },
  countdownColon: { color: 'rgba(255,255,255,0.24)', fontSize: 30, fontWeight: '900', marginHorizontal: 6, marginTop: 2 },
  offMarketPrimaryButton: { width: '100%', borderRadius: 18, paddingVertical: 16, backgroundColor: '#D4AF37', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, shadowColor: '#D4AF37', shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  offMarketPrimaryButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  offMarketSecondaryButton: { width: '100%', borderRadius: 18, paddingVertical: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  offMarketSecondaryButtonText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  guestCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  guestGateBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.46)' },
  guestGateCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0a0a0a',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    elevation: 30,
  },
  guestGateIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: 6,
    marginBottom: 18,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestGateTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  guestGateSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 30,
    paddingHorizontal: 4,
  },
  guestPrimaryButton: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  guestPrimaryButtonText: {
    color: '#062315',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  guestSecondaryButton: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.38)',
    alignItems: 'center',
  },
  guestSecondaryButtonText: {
    color: 'rgba(217,255,239,0.92)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  
  profileOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', paddingHorizontal: 16 },
  profileCard: { backgroundColor: '#0a0a0a', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 18, maxHeight: '80%' },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  profileHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  profileBackBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6, marginRight: 8 },
  profileBackText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 2 },
  profileBackPlaceholder: { width: 8, marginRight: 0 },
  profileTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2, marginBottom: 10 },
  profileRatingBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, alignItems: 'center', marginBottom: 12 },
  profileRatingValue: { color: '#f59e0b', fontSize: 36, fontWeight: '900' },
  profileStarsRow: { flexDirection: 'row', gap: 4, marginVertical: 4 },
  profileLoaderWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  profileMuted: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },
  reviewItem: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 10, marginBottom: 8 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  reviewAuthorBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4, gap: 4 },
  reviewAuthorText: { color: '#e5e7eb', fontSize: 11, fontWeight: '700' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { color: '#6b7280', fontSize: 10 },
  reviewText: { color: '#e5e7eb', fontSize: 12, lineHeight: 17 },
  negotiationMemoryBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  negotiationMemoryBoxPending: {
    borderColor: 'rgba(250, 204, 21, 0.55)',
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
  },
  negotiationMemoryBoxConfirmed: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  negotiationMemoryLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  negotiationMemoryTitle: {
    color: '#1d1d1f',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  negotiationMemoryText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
});