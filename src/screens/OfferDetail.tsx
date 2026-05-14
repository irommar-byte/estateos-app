import FloorPlanViewer from '../components/FloorPlanViewer';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Share, Alert, Modal, Platform, Pressable, ScrollView, Linking, ActivityIndicator, useColorScheme } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ChevronLeft, Share as ShareIcon, Heart, Maximize, MapPin, BedDouble, Layers, Calendar, Pencil, X, Lock, Crown, Handshake, CalendarClock, Star, ShieldCheck, ChevronRight, Eye, MoreHorizontal, Flag, Ban } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import { buildOfferShareMessage, SITE_ORIGIN } from '../utils/offerShareUrls';
import { DEAL_EVENT_PREFIX } from '../contracts/parityContracts';
import EliteStatusBadges from '../components/EliteStatusBadges';
import OwnerLegalVerificationCard from '../components/OwnerLegalVerificationCard';
import ClosedOfferOverlay from '../components/ClosedOfferOverlay';
import { getOfferLifecycleState } from '../utils/offerLifecycle';
import { formatLocationLabel, formatPublicAddress, resolveIsExactLocation } from '../constants/locationEcosystem';
import { getPublicMapPresentation } from '../utils/publicLocationPrivacy';
import { isPartnerIdentity } from '../utils/partnerIdentity';
import { describeOfferAgentCommission, parseOfferNumeric } from '../lib/agentCommission';
import ReportSheet from '../components/ReportSheet';
import BlockUserSheet from '../components/BlockUserSheet';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import UserRegionFlag from '../components/UserRegionFlag';
import { API_URL } from '../config/network';
import { findWebOfferById } from '../utils/webOffersFallback';
import { isOfferLegallyVerified } from '../utils/legalVerificationStatus';

const { width, height } = Dimensions.get('window');
const IMG_HEIGHT = 450;
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
  /**
   * Status hydratacji — potrzebny, żeby rozróżnić „jeszcze nie próbowano"
   * od „próbowano i backend zwrócił NIC" (np. oferta zarchiwizowana,
   * niedostępna dla mobile API). Bez tego stary deeplink do skasowanej
   * oferty pokazywałby pusty ekran — teraz pokazujemy zaślepkę.
   */
  const [hydrationStatus, setHydrationStatus] = useState<'idle' | 'success' | 'missing'>('idle');

  // 🔥 FINALNY OBIEKT
  const offer = hydratedOffer || offerFromParams || (idFromParams ? { id: idFromParams } : null);
  // KLUCZOWE: theme musi pochodzić z globalnego store'a (useThemeStore),
  // a NIE z `route.params.theme` — bo żadne miejsce nawigacji nie przekazuje
  // tu theme w paramach, więc bez tego ekran wisi na sztywno w "light".
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
  const theme = { glass: isDark ? 'dark' : 'light' };
  const [isFavorite, setIsFavorite] = useState(false);
  /*
   * Wysokość bottom baru mierzymy dynamicznie. Bottom bar może mieć różną wysokość:
   *   • baseline (cena + CTA),
   *   • + pigułka „Prowizja agenta" (pełna szerokość) gdy oferta agentowska,
   *   • + safe-area iOS.
   * Statyczny `paddingBottom: 160` w `ScrollView` powodował, że galeria/ID oferty/
   * boksy „Termin spotkania" znikały pod barem. Mierzona wysokość + **jednolity blok
   * w kolorze karty** na końcu treści (zamiast przezroczystego paddingu) — inaczej
   * przy scrollu widać hero zdjęcia („szczelina" między kartą a bottom barem).
   */
  const [bottomBarHeight, setBottomBarHeight] = useState(220);
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
    const id = Number(idFromParams);
    if (!id) return;
    let mounted = true;
    const run = async () => {
      try {
        const seed = route?.params?.offer && typeof route.params.offer === 'object' ? route.params.offer : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        /** Pełny rekord z mobile (lista lub pojedynczy GET) — zawiera m.in. prowizję agenta. */
        let candidate: any = null;
        try {
          const detailRes = await fetch(`${API_URL}/api/mobile/v1/offers/${id}`, { headers });
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            candidate =
              detailJson?.offer ??
              detailJson?.data?.offer ??
              detailJson?.data ??
              (detailJson?.id ? detailJson : null);
          }
        } catch {
          /* endpoint może nie istnieć na starszym backendzie */
        }

        if (!candidate) {
          const mobileRes = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, { headers });
          if (mobileRes.ok) {
            const mobileJson = await mobileRes.json();
            const offers = Array.isArray(mobileJson?.offers) ? mobileJson.offers : [];
            candidate = offers.find((o: any) => Number(o?.id || 0) === id) || null;
          }
        }

        let webCandidate: any = null;
        const webRes = await fetch(`${API_URL}/api/offers/${id}`);
        if (webRes.ok) {
          const webJson = await webRes.json();
          webCandidate =
            webJson?.offer ||
            webJson?.data?.offer ||
            webJson?.data ||
            (webJson?.id ? webJson : null);
        }
        if (!webCandidate) {
          webCandidate = await findWebOfferById(id);
        }

        if (webCandidate) {
          candidate = {
            ...(candidate || {}),
            ...webCandidate,
          };
        }

        if (mounted && candidate) {
          // Lista Radaru bywa „chuda" (bez prowizji / ról) — zawsze nadbijamy seed świeżym GET-em.
          setHydratedOffer({
            ...(seed || {}),
            ...candidate,
            id: Number(candidate?.id) || id,
          });
          setHydrationStatus('success');
        } else if (mounted) {
          setHydrationStatus('missing');
        }
      } catch {
        if (mounted) setHydrationStatus('missing');
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [idFromParams, token]);

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
      await Linking.openURL(`${SITE_ORIGIN}/cennik`);
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

  /**
   * Zgłoszenie wyświetlenia oferty do backendu — fire-and-forget.
   *
   * Wcześniej nikt nie pingował serwera, gdy ktoś otwierał `OfferDetail` —
   * pole `offer.views` mogło rosnąć tylko jeśli backend sam doliczał view
   * przy GET-ach listy/szczegółu, co byłoby błędem analitycznym (każdy
   * scroll Radaru bumpałby liczniki).
   *
   * Tu wysyłamy JEDEN dedykowany POST przy wejściu w widok oferty:
   *   POST {API_URL}/api/mobile/v1/offers/{id}/view
   *
   * Reguły po stronie klienta:
   *   • strzelamy tylko gdy mamy realne `offer.id` (po hydratacji),
   *   • pomijamy własne wyświetlenia właściciela (`isOwner`),
   *   • blokujemy podwójne strzały w obrębie tej samej instancji ekranu
   *     (ref) — refresh tej samej karty nie wymusza kolejnego POST-a,
   *   • błędy łykamy cicho (w DEV logujemy w konsoli) — gdyby endpoint
   *     jeszcze nie był wdrożony, UI nadal działa.
   *
   * Dedupe „1 view per user / IP / N minut" zostaje po stronie backendu —
   * patrz briefing dla backend-agenta (#offer-view-tracking).
   */
  const viewTrackedRef = useRef<number | null>(null);
  useEffect(() => {
    const offerIdNum = Number(offer?.id || 0);
    if (!offerIdNum || offerIdNum <= 0) return;
    if (viewTrackedRef.current === offerIdNum) return;
    if (isOwner) return;
    // Zamknięta oferta to widok „read-only memento" — nie pompujemy
    // licznika ani statystyk, bo to fałszuje analitykę aktywnego rynku.
    if (getOfferLifecycleState(offer).isClosed) return;

    viewTrackedRef.current = offerIdNum;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_URL}/api/mobile/v1/offers/${offerIdNum}/view`, {
      method: 'POST',
      headers,
    })
      .then((res) => {
        // 404 oznacza brak endpointu trackingu na danym backendzie — to nie błąd UX.
        if (__DEV__ && res.status !== 404) {
          console.log('[offer-view-track]', offerIdNum, 'status:', res.status);
        }
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn('[offer-view-track] failed', err);
        }
      });
  }, [offer?.id, isOwner, token]);

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const blockUser = useBlockedUsersStore((s) => s.block);
  const [activeProfileData, setActiveProfileData] = useState<any>(null);
  const [activeProfileLoading, setActiveProfileLoading] = useState(false);
  const [activeProfileUserId, setActiveProfileUserId] = useState<number | null>(null);
  const [reviewerNameCache, setReviewerNameCache] = useState<Record<number, string>>({});
  const [profileHistory, setProfileHistory] = useState<number[]>([]);
  const [ownerLegalVerifiedOverride, setOwnerLegalVerifiedOverride] = useState<boolean | null>(null);
  const bidBtnScale = useSharedValue(1);
  const apptBtnScale = useSharedValue(1);

  useEffect(() => {
    setOwnerLegalVerifiedOverride(null);
  }, [offer?.id]);

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

  const priceNumeric = parseOfferNumeric(offer?.price);
  const displayOffer = {
    title: offer?.title || 'Apartament Premium',
    price:
      Number.isFinite(priceNumeric) && priceNumeric > 0
        ? new Intl.NumberFormat('pl-PL').format(Math.round(priceNumeric)) + ' PLN'
        : 'Cena na zapytanie',
    location: formatLocationLabel(offer?.city, offer?.district, 'Warszawa'),
    description: sanitizeOfferDescription(offer?.description) || 'Brak opisu dla tej nieruchomości.',
    stats: { beds: offer?.rooms || '-', size: offer?.area ? `${offer.area} m²` : '- m²' }
  };
  // Wskaźnik „PLN/m²” — kluczowy benchmark cenowy, pokazujemy go pod ceną
  // w dolnym pasku. Liczymy z surowego `offer.price` i `offer.area`, żeby
  // uniknąć parsowania sformatowanego stringa.
  const pricePerSqmLabel = useMemo(() => {
    const priceNum = parseOfferNumeric(offer?.price);
    const areaNum = parseOfferNumeric(offer?.area);
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

  /**
   * ====================================================================
   *  Cykl życia oferty (czy NIE można już z nią nic zrobić)
   * ====================================================================
   *
   *  Cała logika siedzi w `src/utils/offerLifecycle.ts` — tu tylko czytamy
   *  wynik. Memoizowane, żeby zaślepka nie remountowała się przy każdym
   *  re-renderze (animacja `fade-in` ma trwać raz, przy wejściu na ekran).
   *
   *  Wynik kontroluje:
   *    1. czy renderujemy `ClosedOfferOverlay` (pełnoekranowa zaślepka),
   *    2. czy chowamy dolny pasek CTA (Skontaktuj się / Spotkanie / Negocjuj),
   *    3. czy blokujemy „Polub" w pasku górnym (po co lajkować zamkniętą).
   */
  const lifecycleState = useMemo(() => getOfferLifecycleState(offer), [offer]);
  /**
   * „Oferta wygląda na duszę" — backend zwrócił 404 / brak w mobile-feed,
   * a my mamy w paramach tylko goły `id` bez tytułu / ceny. To znaczy:
   *   • albo została skasowana,
   *   • albo właściciel ją wycofał i mobile API jej już nie serwuje.
   * W obu przypadkach traktujemy jako „nieaktualna" — pokazujemy zaślepkę
   * z reason=EXPIRED (najbliższe semantyczne dopasowanie).
   */
  const isHydrationMissing =
    hydrationStatus === 'missing' && !!idFromParams && !offerFromParams?.title && !offerFromParams?.price;
  const isOfferLocked = lifecycleState.isClosed || isHydrationMissing;

  /**
   * ====================================================================
   *  EstateOS™ Statistics — ROI i status cenowy (Okazja / Rynkowa / Luksusowa)
   * ====================================================================
   *
   * Logika 1:1 jak w `AddOffer/Step4_Finance.tsx` — czyli to, co użytkownik
   * widzi podczas dodawania oferty, idealnie pokrywa się z tym, co widzi
   * na karcie OfferDetail. Trzymanie tych liczb w jednym miejscu jest tu
   * świadomą decyzją: wzór jest świadomie uproszczony („mediana per miasto"),
   * ma być orientacyjny, a nie wyceną ekspercką (jasno zaznaczone w UI).
   *
   * Trzy zmienne wynikowe wykorzystywane w pasku CTA:
   *   • `marketStatus.label / color / bg`  — etykieta (OKAZJA / W RYNKU /
   *     LUKSUSOWA) + iOS-owy zielony / żółty / czerwony,
   *   • `marketDiffPercent`                — różnica vs średnia (pokazywana
   *     w sub-linii),
   *   • `estimatedRoi`                     — roczna stopa zwrotu w procentach
   *     (tylko dla sprzedaży; dla najmu zwraca null).
   */
  const cityForStats = String(offer?.city || '').trim();
  const isRentForStats = String(offer?.transactionType || '').toUpperCase() === 'RENT';
  const priceNumForStats = parseOfferNumeric(offer?.price);
  /**
   * Informacja o prowizji agenta — pokazywana KUPUJĄCEMU w bottom barze
   * pod ceną. Cena oferty NIE jest modyfikowana, kwota prowizji to
   * informacja "z tej ceny X% (= Y PLN) stanowi prowizję agenta —
   * płatna agentowi bezpośrednio po finalizacji transakcji".
   */
  const agentCommissionInfo = useMemo(
    () => describeOfferAgentCommission(offer, offer?.price),
    [offer],
  );
  const txTypeLabel =
    String(offer?.transactionType || '').toUpperCase() === 'RENT' ? 'Wynajem' : 'Sprzedaż';
  const propTypeRaw = String(offer?.propertyType || '').toUpperCase();
  const propTypeLabel =
    propTypeRaw === 'FLAT' || propTypeRaw === 'APARTMENT'
      ? 'Mieszkanie'
      : propTypeRaw === 'HOUSE'
        ? 'Dom'
        : propTypeRaw === 'PLOT'
          ? 'Działka'
          : propTypeRaw === 'PREMISES'
            ? 'Lokal użytkowy'
            : offer?.propertyType
              ? String(offer.propertyType)
              : '—';
  const areaNumForStats = parseOfferNumeric(offer?.area);
  const offerPricePerSqm =
    Number.isFinite(priceNumForStats) && priceNumForStats > 0 &&
    Number.isFinite(areaNumForStats) && areaNumForStats > 0
      ? Math.round(priceNumForStats / areaNumForStats)
      : 0;
  const avgPricePerSqmForCity =
    cityForStats === 'Warszawa' ? 16500 : (cityForStats === 'Łódź' ? 8500 : 12000);
  const marketDiffPercent =
    offerPricePerSqm > 0 && avgPricePerSqmForCity > 0
      ? Math.round(((offerPricePerSqm - avgPricePerSqmForCity) / avgPricePerSqmForCity) * 100)
      : null;
  const marketStatus = (() => {
    if (marketDiffPercent === null) {
      return {
        label: 'BRAK DANYCH',
        color: '#9ca3af',
        bg: isDark ? 'rgba(156,163,175,0.15)' : 'rgba(156,163,175,0.12)',
      };
    }
    if (marketDiffPercent <= -5) {
      return {
        label: 'OKAZJA',
        color: '#10b981',
        bg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)',
      };
    }
    if (marketDiffPercent >= 5) {
      return {
        label: 'LUKSUSOWA',
        color: '#ef4444',
        bg: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.13)',
      };
    }
    return {
      label: 'RYNKOWA',
      color: '#f59e0b',
      bg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.13)',
    };
  })();
  const estimatedRoi: number | null = (() => {
    if (isRentForStats) return null;
    if (!Number.isFinite(priceNumForStats) || priceNumForStats <= 0) return null;
    if (!Number.isFinite(areaNumForStats) || areaNumForStats <= 0) return null;
    let estRentPerSqm = 60;
    if (cityForStats === 'Warszawa') estRentPerSqm = 85;
    else if (cityForStats === 'Kraków' || cityForStats === 'Wrocław' || cityForStats === 'Trójmiasto') estRentPerSqm = 65;
    else if (cityForStats === 'Łódź' || cityForStats === 'Poznań') estRentPerSqm = 55;
    const monthlyRent = areaNumForStats * estRentPerSqm;
    const adminMonthly = hasAdminFee ? adminFeeNumber : 0;
    const netMonthly = Math.max(0, monthlyRent - adminMonthly);
    const annual = netMonthly * 12;
    if (annual <= 0) return null;
    return Number(((annual / priceNumForStats) * 100).toFixed(1));
  })();
  const viewsCountRaw = Number(firstDefined(offer?.views, offer?.viewCount, offer?.viewsCount, offer?.stats?.views, 0));
  const viewsCount = Number.isFinite(viewsCountRaw) && viewsCountRaw > 0 ? Math.round(viewsCountRaw) : 0;
  const isLegalSafeVerified = isOfferLegallyVerified(offer, ownerLegalVerifiedOverride === true);
  const handleOwnerLegalStatusChanged = useCallback((next: any) => {
    const status = String(next?.status || '').toUpperCase();
    const verified =
      next?.isLegalSafeVerified === true || status === 'VERIFIED' || status === 'SAFE';
    setOwnerLegalVerifiedOverride(verified ? true : null);
  }, []);

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
  const ownerSummarySecondary = agentCommissionInfo?.companyName
    ? ownerProfileLoading
      ? 'Profil agenta · ładowanie…'
      : ownerReviews.length > 0
        ? `Ocena ${ownerAverageRating.toFixed(1)} · ${ownerReviews.length} opinii`
        : 'Profil agenta · wizytówka'
    : ownerProfileLoading
      ? 'Profil sprzedawcy · ładowanie…'
      : `Ocena ${(ownerAverageRating || 0).toFixed(1)}`;

  const sellerPersonName =
    String(ownerProfile?.user?.name || ownerProfile?.user?.fullName || offer?.userName || '').trim() || null;
  const sellerPrimaryLabel =
    agentCommissionInfo?.companyName ||
    sellerPersonName ||
    offer?.userName ||
    'Sprzedawca';
  const sellerSubtitleLine =
    agentCommissionInfo?.companyName && sellerPersonName && sellerPersonName !== sellerPrimaryLabel
      ? sellerPersonName
      : null;

  const sellerInitials = useMemo(() => {
    const parts = (sellerPrimaryLabel || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2) || '?';
    }
    return (parts[0]?.slice(0, 2).toUpperCase() || '?').slice(0, 2);
  }, [sellerPrimaryLabel]);

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

      <View style={[styles.topBar, { top: Math.max(12, insets.top + 6) }]}>
        <TouchableOpacity style={styles.glassButton} onPress={() => navigation?.goBack()} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <ChevronLeft color="white" size={24} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity style={[styles.glassButton, { marginRight: 12 }]} onPress={handleShare} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <ShareIcon color="white" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.glassButton, { marginRight: 12 }]} onPress={handleFavorite} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Animated.View style={animatedHeartStyle}>
              <Heart color={isFavorite ? "#ff3b30" : "white"} fill={isFavorite ? "#ff3b30" : "transparent"} size={20} />
            </Animated.View>
          </TouchableOpacity>
          {!isOwner ? (
            <TouchableOpacity
              style={styles.glassButton}
              onPress={() => {
                Haptics.selectionAsync();
                setIsMoreMenuOpen(true);
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              accessibilityLabel="Więcej opcji"
              accessibilityRole="button"
            >
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
              <MoreHorizontal color="white" size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: IMG_HEIGHT - 40, paddingBottom: 12 }}
      >
        <View style={[styles.contentSheet, { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }]}>
          {/* Cena na górze została usunięta — pełna kwota i PLN/m² siedzą teraz
              w dolnym pasku CTA. Trzymamy tu tylko badge'y meta (czynsz, views). */}
          <View style={styles.topMetaBadgesRow}>
            {/*
              Wcześniej tu była zielona pigułka „+ czynsz admin {kwota} PLN".
              Została przeniesiona do dolnego paska CTA — bezpośrednio pod
              ceną — żeby cała informacja o cenie i jej składnikach była
              w jednym miejscu. Tutaj zostawiamy tylko widget „liczby
              wyświetleń / Nowa oferta" jako neutralny meta-badge.
            */}
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

          {!isLegalSafeVerified && isOwner && Number(offer?.id) > 0 ? (
            <View style={styles.legalVerificationBlock}>
              <OwnerLegalVerificationCard
                offerId={Number(offer.id)}
                token={token}
                isDark={isDark}
                initialLandRegistryNumber={offer?.landRegistryNumber || null}
                initialApartmentNumber={offer?.apartmentNumber || null}
                onStatusChanged={handleOwnerLegalStatusChanged}
              />
            </View>
          ) : null}

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
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>Kluczowe parametry</Text>
          <View style={[styles.detailsContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f5f6f8', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.05)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
            <View style={[styles.detailsContainerInnerGlow, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]} pointerEvents="none" />
            <View style={[styles.detailRow, { borderTopWidth: 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Typ transakcji</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{txTypeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Typ nieruchomości</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{propTypeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Powierzchnia</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{displayOffer.stats.size}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Pokoje</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{offer?.rooms != null && offer?.rooms !== '' ? String(offer.rooms) : '—'}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Piętro</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatFloorStat(offer?.floor)}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Rok budowy</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{offer?.yearBuilt || offer?.buildYear || offer?.year || '—'}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Cena</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{displayOffer.price}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isPartnerListing || agentCommissionInfo ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent', borderBottomWidth: isPartnerListing || agentCommissionInfo ? StyleSheet.hairlineWidth : 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Cena za m²</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{pricePerSqmLabel || '—'}</Text></View>
            {isPartnerListing || agentCommissionInfo ? (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>Prowizja agenta</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]} numberOfLines={6}>{agentCommissionInfo ? (agentCommissionInfo.isZero ? 'Bez prowizji (0%). Kupujący nie dopłaca prowizji pośrednika.' : `${agentCommissionInfo.percentLabel} ceny ofertowej (brutto), ok. ${agentCommissionInfo.amountLabel}, płatne agentowi po sfinalizowaniu transakcji.`) : 'Biuro nie ujawniło procentu prowizji w ogłoszeniu.'}</Text></View>
            ) : null}
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
          {/*
            Przezroczysty paddingBottom ScrollView pokazywał hero zdjęcia = „szczelina” między
            białą kartą a dolnym paskiem. Ten blok ma ten sam kolor co contentSheet.
          */}
          <View
            pointerEvents="none"
            style={{
              height: bottomBarHeight + (isOwner ? 72 : 40),
              marginTop: 4,
              marginHorizontal: -24,
              backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
            }}
          />
        </View>
      </Animated.ScrollView>

      {/* --- NOWY, LUKSUSOWY BOTTOM BAR APPLE-STYLE --- */}
      <View
        style={styles.bottomBarContainer}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          // Aktualizujemy tylko gdy zmiana > 2px, żeby nie wpadać w pętlę re-renderów.
          if (Math.abs(h - bottomBarHeight) > 2) setBottomBarHeight(h);
        }}
      >
        <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={[styles.bottomBar, isDark && { backgroundColor: 'rgba(10,10,10,0.65)', borderTopColor: 'rgba(255,255,255,0.1)' }]}>
          
          {/* TOP ROW: Cena (z meta-pigułkami) + ROI / status cenowy / sprzedawca */}
          <View style={styles.bottomBarTopRow}>
            <View style={styles.bottomBarPriceColumn}>
              <Text style={styles.bottomBarPriceLabel}>Cena ofertowa</Text>
              <Text
                style={[styles.bottomBarPrice, isDark && { color: '#ffffff' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {displayOffer.price}
              </Text>
              {/*
                Wiersz meta pod główną kwotą — krótkie pigułki w stylu Apple:
                  • PLN/m² (neutralne, główna informacja porównawcza),
                  • status cenowy (Okazja / Rynkowa / Luksusowa) — zielony /
                    żółty / czerwony zgodnie z `EstateOS™ Statistics`,
                  • „+ czynsz admin {kwota}" (przeniesione tu z górnego rzędu).
              */}
              <View style={styles.priceMetaRow}>
                {pricePerSqmLabel ? (
                  <Text
                    style={[styles.bottomBarPriceSqm, isDark && { color: '#9ca3af' }]}
                    numberOfLines={1}
                  >
                    {pricePerSqmLabel}
                  </Text>
                ) : null}
                {marketDiffPercent !== null ? (
                  <View
                    style={[
                      styles.marketStatusPill,
                      { backgroundColor: marketStatus.bg, borderColor: marketStatus.color },
                    ]}
                  >
                    <View style={[styles.marketStatusDot, { backgroundColor: marketStatus.color }]} />
                    <Text
                      style={[styles.marketStatusPillText, { color: marketStatus.color }]}
                      numberOfLines={1}
                    >
                      {marketStatus.label}
                    </Text>
                  </View>
                ) : null}
                {hasAdminFee ? (
                  <View
                    style={[
                      styles.adminFeeMiniPill,
                      {
                        backgroundColor: isDark ? 'rgba(52,199,89,0.15)' : 'rgba(52,199,89,0.12)',
                        borderColor: isDark ? 'rgba(52,199,89,0.42)' : 'rgba(52,199,89,0.38)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.adminFeeMiniPillText,
                        { color: isDark ? '#34d399' : '#15803d' },
                      ]}
                      numberOfLines={1}
                    >
                      + czynsz admin {adminFeeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isOwner ? (
              <View style={styles.ownerStatsColumn}>
                <View
                  style={[
                    styles.ownerCompactPill,
                    styles.ownerStatsIdentityPill,
                    isDark && { backgroundColor: 'rgba(28,28,30,0.72)' },
                    agentCommissionInfo?.companyName && {
                      borderColor: 'rgba(255,159,10,0.55)',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={
                      agentCommissionInfo?.companyName
                        ? ['rgba(255,159,10,0.95)', 'rgba(251,146,60,0.88)']
                        : ['rgba(16,185,129,0.92)', 'rgba(5,150,105,0.88)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ownerAvatarGrad}
                  >
                    <Text style={styles.ownerAvatarInitials} allowFontScaling={false}>
                      {sellerInitials}
                    </Text>
                  </LinearGradient>
                  <View style={styles.ownerPillInfo}>
                    <Text numberOfLines={1} style={[styles.ownerPillName, isDark && { color: '#ffffff' }]}>
                      {sellerPrimaryLabel}
                    </Text>
                    <View style={styles.ownerPillStarsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={8}
                          color={
                            s <= Math.round(ownerAverageRating || 0)
                              ? '#f59e0b'
                              : isDark
                                ? '#4b5563'
                                : '#d1d5db'
                          }
                          fill={s <= Math.round(ownerAverageRating || 0) ? '#f59e0b' : 'transparent'}
                        />
                      ))}
                    </View>
                    {sellerSubtitleLine ? (
                      <Text style={[styles.ownerPillSecondary, isDark && { color: '#9ca3af' }]} numberOfLines={1}>
                        {sellerSubtitleLine}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {estimatedRoi !== null ? (
                  <View
                    style={[
                      styles.roiPillCard,
                      styles.roiPillCardBelowIdentity,
                      {
                        backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.10)',
                        borderColor: '#3b82f6',
                      },
                    ]}
                  >
                    <Text style={styles.roiPillLabel} numberOfLines={1}>
                      EstateOS™ ROI
                    </Text>
                    <Text style={styles.roiPillValue} numberOfLines={1}>
                      {estimatedRoi}%
                    </Text>
                    <Text style={styles.roiPillSub} numberOfLines={1}>
                      roczna stopa
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={openOwnerProfileModal}
                style={({ pressed }) => [
                  styles.ownerCompactPill,
                  isDark && { backgroundColor: 'rgba(28,28,30,0.72)' },
                  agentCommissionInfo?.companyName && {
                    borderColor: 'rgba(255,159,10,0.55)',
                    borderWidth: 1,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <LinearGradient
                  colors={
                    agentCommissionInfo?.companyName
                      ? ['rgba(255,159,10,0.95)', 'rgba(251,146,60,0.88)']
                      : ['rgba(16,185,129,0.92)', 'rgba(5,150,105,0.88)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ownerAvatarGrad}
                >
                  <Text style={styles.ownerAvatarInitials} allowFontScaling={false}>
                    {sellerInitials}
                  </Text>
                </LinearGradient>
                <View style={styles.ownerPillInfo}>
                  <Text numberOfLines={1} style={[styles.ownerPillName, isDark && { color: '#ffffff' }]}>
                    {sellerPrimaryLabel}
                  </Text>
                  <View style={styles.ownerPillStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={8}
                        color={
                          s <= Math.round(ownerAverageRating || 0)
                            ? '#f59e0b'
                            : isDark
                              ? '#4b5563'
                              : '#d1d5db'
                        }
                        fill={s <= Math.round(ownerAverageRating || 0) ? '#f59e0b' : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={[styles.ownerPillSecondary, isDark && { color: '#9ca3af' }]} numberOfLines={1}>
                    {ownerSummarySecondary}
                  </Text>
                  {agentCommissionInfo ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.ownerPillCommission,
                        agentCommissionInfo.isZero
                          ? { color: isDark ? '#6ee7b7' : '#059669' }
                          : { color: isDark ? '#FBBF24' : '#C2410C' },
                      ]}
                    >
                      {agentCommissionInfo.isZero
                        ? 'Prowizja 0% brutto'
                        : `Prowizja ${agentCommissionInfo.percentLabel} · ${agentCommissionInfo.amountLabel}`}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={14} color={isDark ? '#9ca3af' : '#9ca3af'} style={styles.ownerPillChevron} />
              </Pressable>
            )}
          </View>

          {/*
            PIGUŁKA PROWIZJI — pełna szerokość tylko dla właściciela (lub gdy brak
            wizytówki sprzedawcy). Kupujący widzi skrót w małej pigułce obok ceny.
          */}
          {agentCommissionInfo && (isOwner || !offer?.userId) ? (
            <View
              style={[
                styles.agentCommissionPill,
                agentCommissionInfo.isZero
                  ? {
                      backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                      borderColor: isDark ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.5)',
                    }
                  : {
                      backgroundColor: isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,159,10,0.10)',
                      borderColor: isDark ? 'rgba(255,159,10,0.55)' : 'rgba(255,159,10,0.45)',
                    },
              ]}
            >
              <View style={styles.agentCommissionTopRow}>
                <View style={styles.agentCommissionLabelCol}>
                  <View style={styles.agentCommissionLabelLine}>
                    <Handshake
                      size={13}
                      color={agentCommissionInfo.isZero ? '#10b981' : '#FF9F0A'}
                      strokeWidth={2.6}
                    />
                    <Text
                      style={[
                        styles.agentCommissionTopLabel,
                        { color: agentCommissionInfo.isZero ? '#10b981' : '#FF9F0A' },
                      ]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {agentCommissionInfo.isZero ? 'BEZ PROWIZJI' : 'PROWIZJA AGENTA'}
                    </Text>
                  </View>
                </View>
                <View style={styles.agentCommissionHeroCol}>
                  {agentCommissionInfo.isZero ? (
                    <Text
                      style={[styles.agentCommissionHeroAmount, { color: '#10b981' }]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      0% · 0 PLN
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={[styles.agentCommissionHeroPercent, { color: '#FF9F0A' }]}
                        numberOfLines={1}
                        allowFontScaling={false}
                      >
                        {agentCommissionInfo.percentLabel}
                      </Text>
                      <Text
                        style={[styles.agentCommissionHeroAmount, { color: '#FF9F0A' }]}
                        numberOfLines={1}
                        allowFontScaling={false}
                      >
                        ≈ {agentCommissionInfo.amountLabel}
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <Text
                style={[
                  styles.agentCommissionBody,
                  agentCommissionInfo.isZero
                    ? { color: isDark ? '#9BE7C7' : '#047857' }
                    : { color: isDark ? '#FFD09B' : '#B45309' },
                ]}
              >
                {agentCommissionInfo.isZero ? (
                  <>
                    Kupujący nie płaci prowizji na tym ogłoszeniu.{' '}
                    {agentCommissionInfo.companyName
                      ? `${agentCommissionInfo.companyName} udostępnia ofertę bez dodatkowych opłat dla nabywcy.`
                      : 'Agent udostępnia ofertę bez dodatkowych opłat dla nabywcy.'}
                  </>
                ) : (
                  <>
                    Płacisz dokładnie cenę ofertową — z tej kwoty{' '}
                    {agentCommissionInfo.amountLabel} ({agentCommissionInfo.percentLabel}) trafia do
                    {agentCommissionInfo.companyName ? ` ${agentCommissionInfo.companyName}` : ' agenta'}{' '}
                    po finalizacji transakcji.{' '}
                    <Text style={{ fontWeight: '800' }}>
                      Kwota prowizji jest BRUTTO — zawiera już VAT, kupujący nie dopłaca żadnego podatku ani opłat dodatkowych.
                    </Text>
                  </>
                )}
              </Text>
            </View>
          ) : null}

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
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <UserRegionFlag
                    phone={activeProfileData?.user?.phone || activeProfileData?.user?.contactPhone}
                    fallbackIso="PL"
                    size={40}
                    isDark={isDark}
                  />
                </View>
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

      {/*
        ====================================================================
         Zaślepka „Oferta zakończona / nieaktualna"
        ====================================================================
        Renderujemy JAKO OSTATNI element w `container`, żeby leżała na samej
        górze stosu (przykrywa zarówno hero, content, jak i dolny pasek CTA).
        `pointerEvents: 'auto'` w środku komponentu robi blokadę interakcji
        bez konieczności rozplątywania pojedynczych przycisków pod spodem.

        Dla właściciela też pokazujemy, ale z innym tonem („Twoja oferta
        jest zakończona") — może wrócić do panelu i przywrócić publikację.
      */}
      {isOfferLocked ? (
        <ClosedOfferOverlay
          visible
          reason={lifecycleState.isClosed ? lifecycleState.reason : 'EXPIRED'}
          headline={lifecycleState.isClosed ? lifecycleState.headline : 'Oferta nieaktualna'}
          subline={
            lifecycleState.isClosed
              ? lifecycleState.subline
              : 'Ten link prowadzi do oferty, która nie jest już dostępna w EstateOS™. Mogła zostać wycofana z rynku lub jej okres publikacji się skończył.'
          }
          isDark={isDark}
          isOwner={isOwner}
          onGoBack={() => navigation?.goBack?.()}
          onBrowseSimilar={
            isOwner
              ? undefined
              : () => {
                  // Wracamy na ekran główny Radaru — to tam użytkownik
                  // dostanie świeże propozycje pasujące do jego kryteriów.
                  try {
                    navigation?.navigate?.('MainTabs', { screen: 'Radar' });
                  } catch {
                    navigation?.goBack?.();
                  }
                }
          }
        />
      ) : null}

      {/* Action sheet z opcjami „⋯" — Apple Guideline 1.2 (Report + Block). */}
      <Modal
        visible={isMoreMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreMenuOpen(false)}
      >
        <Pressable
          style={styles.moreOverlay}
          onPress={() => setIsMoreMenuOpen(false)}
        >
          <View
            style={[
              styles.moreSheet,
              {
                backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <Pressable
              onPress={() => {
                setIsMoreMenuOpen(false);
                setTimeout(() => setIsReportOpen(true), 180);
              }}
              style={({ pressed }) => [
                styles.moreItem,
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
              ]}
              accessibilityRole="button"
            >
              <Flag color="#FF9F0A" size={18} />
              <Text style={[styles.moreItemText, { color: isDark ? '#fff' : '#111' }]}>
                Zgłoś ofertę
              </Text>
            </Pressable>
            {offer?.userId && Number(offer.userId) !== Number(user?.id || 0) ? (
              <Pressable
                onPress={() => {
                  setIsMoreMenuOpen(false);
                  setTimeout(() => setIsBlockOpen(true), 180);
                }}
                style={({ pressed }) => [
                  styles.moreItem,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                  pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                ]}
                accessibilityRole="button"
              >
                <Ban color="#FF453A" size={18} />
                <Text style={[styles.moreItemText, { color: isDark ? '#fff' : '#111' }]}>
                  Zablokuj sprzedającego
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setIsMoreMenuOpen(false)}
              style={({ pressed }) => [
                styles.moreCancel,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.moreCancelText, { color: isDark ? '#fff' : '#111' }]}>
                Anuluj
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ReportSheet
        visible={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="offer"
        targetId={Number(offer?.id || 0)}
        targetLabel={displayOffer?.title ? `Oferta: ${displayOffer.title}` : undefined}
        token={token}
        isDark={isDark}
      />

      <BlockUserSheet
        visible={isBlockOpen}
        onClose={() => setIsBlockOpen(false)}
        targetLabel={
          ownerProfile?.user?.name ||
          ownerProfile?.user?.fullName ||
          undefined
        }
        affectsConversations
        isDark={isDark}
        onConfirm={async () => {
          const targetId = Number(offer?.userId || 0);
          if (!targetId || !token || !user?.id) {
            return { ok: false, error: 'MISSING_CONTEXT' };
          }
          const result = await blockUser(targetId, token, user.id);
          if (result.ok) {
            setTimeout(() => navigation?.goBack?.(), 220);
          }
          return result;
        }}
      />

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
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
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
  /** Karta KW / zgłoszenie — tylko gdy właściciel i brak pieczęci prawnej. */
  legalVerificationBlock: {
    gap: 14,
    marginBottom: 28,
  },
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  detailLabel: {
    color: '#86868b',
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 0,
    marginRight: 10,
    maxWidth: '46%',
  },
  detailValue: {
    color: '#1d1d1f',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
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
  bottomBarTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  bottomBarPriceColumn: { flex: 1, minWidth: 0 },
  bottomBarPriceLabel: { fontSize: 11, fontWeight: '700', color: '#86868b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  bottomBarPrice: { fontSize: 22, fontWeight: '800', color: '#1d1d1f', letterSpacing: -0.5 },
  bottomBarPriceSqm: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.1 },

  /**
   * Wiersz meta pod ceną — luźne mini-pigułki, owijają się gdyby zabrakło
   * miejsca (`flexWrap: 'wrap'`), więc na małych ekranach „LUKSUSOWA" oraz
   * „+ czynsz admin XYZ PLN" mogą wskoczyć w kolejną linię — żaden tekst
   * się nie ucina.
   */
  priceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    maxWidth: '100%',
  },
  marketStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  marketStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  marketStatusPillText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  adminFeeMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  adminFeeMiniPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /*
    — Pigułka prowizji agenta — pełna szerokość bottom baru.
    Renderowana POD `bottomBarTopRow`, dlatego procent + kwota mieszczą się
    bez ucinania i opis ma luz na 2 linie nawet na iPhone Mini / SE.
  */
  agentCommissionPill: {
    marginTop: -2,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  agentCommissionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  agentCommissionLabelCol: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  agentCommissionLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  agentCommissionTopLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  agentCommissionHeroCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  agentCommissionHeroPercent: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  agentCommissionHeroAmount: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  agentCommissionBody: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },

  /** Kolumna analityczna dla właściciela — wizytówka jak u kupującego + ROI pod spodem */
  ownerStatsColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    flexShrink: 1,
    width: 132,
    minWidth: 118,
    maxWidth: 140,
  },
  ownerStatsIdentityPill: {
    flexGrow: 0,
    alignSelf: 'flex-end',
    maxWidth: 132,
    paddingRight: 10,
  },
  roiPillCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    minWidth: 110,
  },
  roiPillLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#3b82f6',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  roiPillValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: '#3b82f6',
    lineHeight: 22,
  },
  roiPillSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3b82f6',
    opacity: 0.78,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  roiPillCardBelowIdentity: {
    marginTop: 10,
  },

  ownerCompactPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 22, 
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 116,
    maxWidth: '56%',
  },
  ownerAvatarGrad: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ownerAvatarInitials: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  ownerPillInfo: { marginLeft: 8, justifyContent: 'center', flex: 1, minWidth: 0 },
  ownerPillName: { color: '#1d1d1f', fontSize: 12, fontWeight: '800', letterSpacing: -0.1 },
  ownerPillStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  ownerPillSecondary: { color: '#6b7280', fontSize: 9.5, fontWeight: '700', marginTop: 2, letterSpacing: 0.08 },
  ownerPillCommission: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.15,
    marginTop: 3,
  },
  ownerPillChevron: { marginLeft: 2, flexShrink: 0 },
  
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
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 26,
  },
  moreSheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  moreItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  moreCancel: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  moreCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
});