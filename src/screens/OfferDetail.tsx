import FloorPlanViewer from '../components/FloorPlanViewer';
import { normalizeStoredScanMeta } from '../lib/roomScan/parseRoomPlanJson';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Modal, Platform, Pressable, ScrollView, ActivityIndicator, useColorScheme, type GestureResponderEvent } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import { ChevronLeft, Share as ShareIcon, Heart, Maximize, Images, MapPin, BedDouble, Layers, Calendar, Pencil, X, Lock, Crown, Handshake, CalendarClock, Star, ShieldCheck, ChevronRight, ChevronUp, Eye, MoreHorizontal, Flag, Ban } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BidActionModal from '../components/dealroom/BidActionModal';
import AppointmentActionModal from '../components/dealroom/AppointmentActionModal';
import OpenHouseOfferBanner from '../components/openHouse/OpenHouseOfferBanner';
import AuctionOfferBanner from '../components/auction/AuctionOfferBanner';
import { fetchOpenHouseForOffer } from '../services/openHouseService';
import { fetchAuctionForOffer } from '../services/auctionService';
import type { OpenHouseEventRecord } from '../contracts/openHouseContract';
import type { AuctionEventRecord } from '../contracts/auctionContract';
import { SITE_ORIGIN } from '../utils/offerShareUrls';
import { DEAL_EVENT_PREFIX } from '../contracts/parityContracts';
import EliteStatusBadges from '../components/EliteStatusBadges';
import OwnerLegalVerificationCard from '../components/OwnerLegalVerificationCard';
import ClosedOfferOverlay from '../components/ClosedOfferOverlay';
import { getOfferLifecycleState, isOfferNewListing } from '../utils/offerLifecycle';
import {
  formatOfferConditionLabel,
  formatOfferHeatingLabel,
  formatOfferPropertyTypeLabel,
  formatOfferTransactionTypeLabel,
} from '../utils/offerFieldLabels';
import {
  formatLocationLabel,
  formatOfferLocationLine,
  formatPublicAddress,
  isPolandLocationDraft,
  resolveIsExactLocation,
} from '../constants/locationEcosystem';
import { getPublicMapPresentation } from '../utils/publicLocationPrivacy';
import { formatOfferDescriptionForDisplay } from '../utils/offerDescriptionDisplay';
import { isPartnerIdentity } from '../utils/partnerIdentity';
import { requestInvestorProUpsell } from '../services/investorProUpsell';
import { describeOfferAgentCommission, parseOfferNumeric, formatCommissionAmountForDisplay } from '../lib/agentCommission';
import ReportSheet from '../components/ReportSheet';
import BlockUserSheet from '../components/BlockUserSheet';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import { useFocusEffect } from '@react-navigation/native';
import { deriveOfferDealPresentation } from '../utils/offerDealPresentation';
import ProfilePublicHeader from '../components/ProfilePublicHeader';
import ProfileReputationBlock from '../components/ProfileReputationBlock';
import ProfileWriteMessageButton from '../components/messaging/ProfileWriteMessageButton';
import { openDirectContactChat } from '../utils/openDirectContact';
import LegalVerifiedShieldBadge from '../components/LegalVerifiedShieldBadge';
import { API_URL } from '../config/network';
import { findWebOfferById } from '../utils/webOffersFallback';
import { useMoneyContext } from '../money/useMoneyContext';
import {
  isFavoriteId,
  loadFavoriteIds,
  toggleFavoriteId,
} from '../utils/favoritesStorage';
import { normalizeListingCurrency } from '../money/convert';
import { formatAmountWithCurrency, formatOfferSecondaryAmount, resolveOfferDisplayAmount } from '../money/format';
import { resolveOfferListingPrice } from '../money/offerPrice';
import { formatListedPriceLabel, resolveOfferPriceDiscount } from '../utils/offerPriceDiscount';
import OfferDiscountPriceBlock from '../components/OfferDiscountPriceBlock';
import OfferPriceHistorySection from '../components/offer/OfferPriceHistorySection';
import { isOfferLegallyVerified } from '../utils/legalVerificationStatus';
import { localeToDateFormat, useI18n } from '../i18n';
import { isProPhotoSessionSampleOfferId } from '../data/proPhotoSessionSampleOffers';

const { width, height } = Dimensions.get('window');
/** ~4:3 względem szerokości ekranu — więcej kadru, mniej cropu niż stałe 450px. */
const IMG_HEIGHT = Math.max(480, Math.round(Math.min(width * (4 / 3), height * 0.58)));
/** Ile białej karty nachodzi na dół zdjęcia (zaokrąglone rogi). */
const HERO_SHEET_OVERLAP = 28;
const HERO_TAP_HEIGHT = IMG_HEIGHT - HERO_SHEET_OVERLAP;
const GALLERY_CONTENT_WIDTH = width - 48;
const GALLERY_HERO_HEIGHT = Math.round(GALLERY_CONTENT_WIDTH * 0.62);
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

function getDealActionLabel(action: string | undefined, translate: (key: string) => string) {
  const normalized = String(action || '').toUpperCase();
  if (normalized === 'ACCEPTED') return translate('offer.shared.dealActions.accepted');
  if (normalized === 'REJECTED' || normalized === 'DECLINED') return translate('offer.shared.dealActions.rejected');
  if (normalized === 'COUNTERED') return translate('offer.shared.dealActions.countered');
  return translate('offer.shared.dealActions.proposed');
}

function formatFloorStat(f: unknown, translate: (key: string) => string): string {
  if (f === null || f === undefined || f === '') return '-';
  const n = Number(f);
  if (Number.isFinite(n) && n === 0) return translate('offer.shared.floorGround');
  if (Number.isFinite(n)) return String(n);
  const s = String(f).trim();
  return s ? s : '-';
}


const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

export default function OfferDetail({ route, navigation }: any) {
  const offerFromParams = route?.params?.offer;
  const idFromParams = firstDefined(route?.params?.id, route?.params?.offerId, route?.params?.offer?.id);
  const isSamplePreview = Boolean(
    route?.params?.isSamplePreview || isProPhotoSessionSampleOfferId(idFromParams) || isProPhotoSessionSampleOfferId(offerFromParams?.id),
  );
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
  const { formatOffer, preference, rate } = useMoneyContext();
  const { t, locale } = useI18n();
  const dateLocale = localeToDateFormat(locale);
  const offerPriceDisplay = useMemo(() => formatOffer(offer), [offer, formatOffer]);
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
  const [bottomBarHeight, setBottomBarHeight] = useState(240);
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
  const viewerPlanType = String(user?.planType || '').trim().toUpperCase();
  const isProUser = Boolean(
    (viewerPlanType !== 'PLUS' && user?.isPro && isProStillActive) ||
    user?.role === 'ADMIN' ||
    viewerPlanType === 'PRO' ||
    viewerPlanType === 'AGENCY'
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
    unlockAtMs &&
      Date.now() < unlockAtMs &&
      !isGuest &&
      !isProUser &&
      !isOwner &&
      !isPartnerListing
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
    if (isSamplePreview) return;
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
  }, [idFromParams, token, isSamplePreview]);

  const handleBecomePro = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    requestInvestorProUpsell('off_market');
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
    if (isSamplePreview) return;
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
  }, [offer?.id, isOwner, token, isSamplePreview]);

  // --- STAN GALERII PEŁNOEKRANOWEJ ---
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
  const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(0);
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
  const [contactWriteLoading, setContactWriteLoading] = useState(false);
  const [reviewerNameCache, setReviewerNameCache] = useState<Record<number, string>>({});
  const [profileHistory, setProfileHistory] = useState<number[]>([]);
  const [ownerLegalVerifiedOverride, setOwnerLegalVerifiedOverride] = useState<boolean | null>(null);
  const [openHouseEvent, setOpenHouseEvent] = useState<OpenHouseEventRecord | null>(null);
  const [auctionEvent, setAuctionEvent] = useState<AuctionEventRecord | null>(null);
  const bidBtnScale = useSharedValue(1);
  const apptBtnScale = useSharedValue(1);

  useEffect(() => {
    if (isSamplePreview) {
      setOpenHouseEvent(null);
      return;
    }
    const offerIdNum = Number(offer?.id || 0);
    if (!Number.isFinite(offerIdNum) || offerIdNum <= 0) {
      setOpenHouseEvent(null);
      return;
    }
    let cancelled = false;
    void fetchOpenHouseForOffer(token, offerIdNum).then((event) => {
      if (!cancelled) setOpenHouseEvent(event);
    });
    return () => {
      cancelled = true;
    };
  }, [offer?.id, token, isSamplePreview]);

  useEffect(() => {
    if (isSamplePreview) {
      setAuctionEvent(null);
      return;
    }
    const offerIdNum = Number(offer?.id || 0);
    if (!Number.isFinite(offerIdNum) || offerIdNum <= 0) {
      setAuctionEvent(null);
      return;
    }
    let cancelled = false;
    void fetchAuctionForOffer(token, offerIdNum).then((event) => {
      if (!cancelled) {
        if (event && (event.status === 'LIVE' || event.status === 'SCHEDULED')) {
          setAuctionEvent(event);
        } else {
          setAuctionEvent(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [offer?.id, token, isSamplePreview]);

  useEffect(() => {
    setOwnerLegalVerifiedOverride(null);
  }, [offer?.id]);

  const favoriteSync = { apiBaseUrl: API_URL, accessToken: token || null };

  useEffect(() => {
    const checkFavorite = async () => {
      if (!offer?.id) return;
      const ids = await loadFavoriteIds(favoriteSync);
      setIsFavorite(isFavoriteId(offer.id, ids));
    };
    void checkFavorite();
  }, [offer?.id, token]);

  const handleFavorite = async () => {
    if (isSamplePreview || !offer?.id) return;
    heartScale.value = withSpring(1.5, { damping: 2, stiffness: 80 }, () => { heartScale.value = withSpring(1); });
    const ids = await loadFavoriteIds(favoriteSync);
    const { ids: nextIds, added } = await toggleFavoriteId(offer.id, ids, favoriteSync);
    setIsFavorite(added);
    if (added) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const listingPrice = useMemo(() => resolveOfferListingPrice(offer, rate), [offer, rate]);
  const priceDiscount = useMemo(() => resolveOfferPriceDiscount(offer), [offer]);
  const listedPriceLabel = useMemo(
    () => formatListedPriceLabel(offer, rate, preference),
    [offer, rate, preference],
  );
  const displayOffer = {
    title: offer?.title || t('offer.shared.defaultTitle'),
    price: offerPriceDisplay.primary,
    priceSecondary: offerPriceDisplay.secondary,
    location: formatOfferLocationLine(offer) || formatLocationLabel(offer?.city, offer?.district, t('offer.shared.defaultCity')),
    description: formatOfferDescriptionForDisplay(offer?.description) || t('offer.detail.noDescription'),
    stats: { beds: offer?.rooms || '-', size: offer?.area ? `${offer.area} m²` : '- m²' }
  };
  const pricePerSqmLabel = useMemo(() => {
    const areaNum = parseOfferNumeric(offer?.area);
    if (listingPrice.amount <= 0) return null;
    if (!Number.isFinite(areaNum) || areaNum <= 0) return null;
    const disp = resolveOfferDisplayAmount({
      amount: listingPrice.amount,
      listingCurrency: listingPrice.currency,
      pricePln: listingPrice.plnAmount,
      displayPreference: preference,
      rate,
    });
    const perSqm = Math.round(disp.displayAmount / areaNum);
    return `${formatAmountWithCurrency(perSqm, disp.displayCurrency)}/m²`;
  }, [offer?.area, listingPrice.amount, listingPrice.currency, listingPrice.plnAmount, preference, rate]);
  // „Dokładna lokalizacja" decyduje, czy publicznie pokazujemy ulicę i numer.
  // Włączona (ON):  ulica + numer (np. „Reymonta 12").
  // Wyłączona (OFF): tylko miasto i dzielnica (lub sama miejscowość) — adres ukryty.
  const isExactLocation = resolveIsExactLocation(offer?.isExactLocation);
  const streetRaw = firstDefined(offer?.street, offer?.addressStreet, offer?.location?.street);
  const streetForPublic = String(streetRaw || '').trim();

  const latRaw = Number(firstDefined(offer?.lat, offer?.latitude, offer?.location?.lat, offer?.location?.latitude));
  const lngRaw = Number(firstDefined(offer?.lng, offer?.lon, offer?.longitude, offer?.location?.lng, offer?.location?.lon, offer?.location?.longitude));

  const locationLine =
    formatOfferLocationLine(offer) ||
    formatPublicAddress(offer?.city, offer?.district, streetForPublic, isExactLocation);

  const isPolandOffer = isPolandLocationDraft({
    city: offer?.city,
    district: offer?.district,
    localityCountry: offer?.localityCountry,
    localityCountryCode: offer?.localityCountryCode,
    lat: latRaw,
    lng: lngRaw,
  });
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
    if (isSamplePreview) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!offer?.id) return;
    try {
      const { shareListingLink, buildOfferLandingPageUrl } = await import('../utils/offerShareUrls');
      await shareListingLink({
        url: buildOfferLandingPageUrl(offer.id),
        sheetTitle: t('offer.detail.shareTitleIos'),
      });
    } catch {
      /* anulowano lub błąd share */
    }
  };

  const isTrue = (v: any) => v === true || v === 1 || v === 'true' || v === '1';
  const activeAmenities: string[] = [];
  if (isTrue(offer?.hasBalcony)) activeAmenities.push(t('offer.shared.amenities.balcony'));
  if (isTrue(offer?.hasParking)) activeAmenities.push(t('offer.shared.amenities.parking'));
  if (isTrue(offer?.hasElevator)) activeAmenities.push(t('offer.shared.amenities.elevator'));
  if (isTrue(offer?.hasStorage)) activeAmenities.push(t('offer.shared.amenities.storage'));
  if (isTrue(offer?.hasGarden)) activeAmenities.push(t('offer.shared.amenities.garden'));
  if (isTrue(offer?.isTwoLevel)) activeAmenities.push(t('offer.shared.amenities.twoLevel'));
  if (isTrue(offer?.petsAllowed)) activeAmenities.push(t('offer.shared.amenities.petsAllowed'));
  const heatingLabel = formatOfferHeatingLabel(offer?.heating, t);
  const furnishedLabel = isTrue(offer?.isFurnished) ? t('offer.shared.furnished.yes') : t('offer.shared.furnished.no');
  const adminFeeNumber = Number(String(offer?.adminFee ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  const hasAdminFee = Number.isFinite(adminFeeNumber) && adminFeeNumber > 0;
  const adminFeeLabel = useMemo(() => {
    if (!hasAdminFee) return t('offer.shared.none');
    const listingCurrency = normalizeListingCurrency(offer?.priceCurrency);
    return formatOfferSecondaryAmount({
      amount: adminFeeNumber,
      listingCurrency,
      pricePln: listingCurrency === 'PLN' ? adminFeeNumber : null,
      displayPreference: preference,
      rate,
    });
  }, [hasAdminFee, adminFeeNumber, offer?.priceCurrency, preference, rate, t]);

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
  const dealPresentation = dealNegotiationState?.presentation;
  const blockBuyerNegotiation = Boolean(
    !isOwner && dealPresentation?.shouldHideBuyerNegotiationButtons,
  );

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
  const agentCommissionAmountLabel = useMemo(() => {
    if (!agentCommissionInfo) return null;
    return formatCommissionAmountForDisplay(
      agentCommissionInfo.amount,
      offer,
      offer?.price,
      preference,
      rate,
    );
  }, [agentCommissionInfo, offer, preference, rate]);
  const txTypeLabel = formatOfferTransactionTypeLabel(offer?.transactionType, t);
  const propTypeLabel = formatOfferPropertyTypeLabel(offer?.propertyType, t);
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
        label: t('offer.shared.market.noData'),
        color: '#9ca3af',
        bg: isDark ? 'rgba(156,163,175,0.15)' : 'rgba(156,163,175,0.12)',
      };
    }
    if (marketDiffPercent <= -5) {
      return {
        label: t('offer.shared.market.bargain'),
        color: '#10b981',
        bg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.13)',
      };
    }
    if (marketDiffPercent >= 5) {
      return {
        label: t('offer.shared.market.luxury'),
        color: '#ef4444',
        bg: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.13)',
      };
    }
    return {
      label: t('offer.shared.market.market'),
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
  const isNewOfferListing = useMemo(() => isOfferNewListing(offer), [offer]);
  const newOfferPulse = useSharedValue(1);

  useEffect(() => {
    if (!isNewOfferListing) {
      newOfferPulse.value = 1;
      return;
    }
    newOfferPulse.value = withRepeat(
      withSequence(withTiming(0.58, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      false,
    );
  }, [isNewOfferListing, newOfferPulse]);

  const newOfferBadgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: newOfferPulse.value,
  }));
  const isLegalSafeVerified = isOfferLegallyVerified(offer, ownerLegalVerifiedOverride === true);
  const handleOwnerLegalStatusChanged = useCallback((next: any) => {
    const status = String(next?.status || '').toUpperCase();
    const verified =
      next?.isLegalSafeVerified === true || status === 'VERIFIED' || status === 'SAFE';
    setOwnerLegalVerifiedOverride(verified ? true : null);
  }, []);

  const agentCommissionDetail = agentCommissionInfo
    ? agentCommissionInfo.isZero
      ? t('offer.detail.commission.zeroDetail')
      : t('offer.detail.commission.percentDetail', {
          percent: agentCommissionInfo.percentLabel,
          amount: agentCommissionAmountLabel ?? agentCommissionInfo.amountLabel,
        })
    : t('offer.detail.commission.undisclosed');
  const formatDate = (dateString: string) => {
    if (!dateString) return t('offer.shared.noData');
    const d = new Date(dateString);
    return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const scrollY = useSharedValue(0);
  const sheetNudge = useSharedValue(0);
  const scrollViewRef = useRef<GHScrollView>(null);
  const touchTapRef = useRef({ x: 0, y: 0, at: 0 });
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });

  const isTapNotScroll = (start: { x: number; y: number; at: number }, end: GestureResponderEvent) => {
    const dx = Math.abs(end.nativeEvent.pageX - start.x);
    const dy = Math.abs(end.nativeEvent.pageY - start.y);
    return Date.now() - start.at < 280 && dx < 14 && dy < 14;
  };

  const rememberTouchStart = (e: GestureResponderEvent) => {
    touchTapRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      at: Date.now(),
    };
  };

  const nudgeSheetOpen = () => {
    scrollViewRef.current?.scrollTo({ y: 96, animated: true });
  };

  const handleSheetHintTapEnd = (e: GestureResponderEvent) => {
    if (isTapNotScroll(touchTapRef.current, e)) nudgeSheetOpen();
  };

  useEffect(() => {
    sheetNudge.value = withRepeat(
      withSequence(withTiming(-5, { duration: 420 }), withTiming(0, { duration: 420 })),
      3,
      false,
    );
  }, [sheetNudge]);

  const sheetGrabberAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetNudge.value }],
  }));

  const sheetSwipeHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 28, 56], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 56], [0, -10], Extrapolation.CLAMP) }],
  }));

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

  useEffect(() => {
    setGalleryPreviewIndex(0);
  }, [offer?.id, imagesToShow.length]);

  const selectGalleryPreview = (index: number) => {
    Haptics.selectionAsync();
    setGalleryPreviewIndex(index);
  };

  const closeGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGalleryOpen(false);
  };

  const ensureDeal = async () => {
    if (!offer?.id) return null;
    if (!token) {
      Alert.alert('EstateOS', t('offer.detail.alerts.loginToNegotiate'));
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
        Alert.alert('EstateOS', data?.error || t('offer.detail.alerts.dealroomOpenFailed'));
        return null;
      }
      const createdDealId = Number(data.deal.id);
      setDealId(createdDealId);
      return createdDealId;
    } catch (_e) {
      Alert.alert('EstateOS', t('offer.detail.alerts.connectionError'));
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
        t('offer.detail.alerts.bidPendingTitle'),
        t('offer.detail.alerts.bidPendingBody')
      );
      return;
    }
    if (bidAccepted) {
      Alert.alert(
        t('offer.detail.alerts.bidAcceptedTitle'),
        t('offer.detail.alerts.bidAcceptedBody', {
          amount: Number(latestBid?.amount || 0).toLocaleString(dateLocale),
        })
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
        (offer?.userId
          ? t('offer.shared.ownerProfileHint', { userId: offer.userId })
          : t('offer.shared.ownerFallback'));
      Alert.alert(
        t('offer.detail.alerts.appointmentPendingTitle'),
        t('offer.detail.alerts.appointmentPendingBody', { owner: ownerHint })
      );
      return;
    }
    if (appointmentAccepted) {
      const dateLabel = latestAppointment?.proposedDate
        ? new Date(latestAppointment.proposedDate).toLocaleString(dateLocale)
        : '-';
      Alert.alert(
        t('offer.detail.alerts.appointmentAcceptedTitle'),
        t('offer.detail.alerts.appointmentAcceptedBody', { date: dateLabel })
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
      title: offer?.title || t('offer.detail.dealTitleFallback', { dealId }),
    });
  };

  const loadDealState = useCallback(async () => {
    if (!token || !offer?.id) {
      setDealNegotiationState(null);
      return;
    }
    if (isOwner) {
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
      const matchingDeal = deals.find(
        (d: any) =>
          Number(d?.offerId || d?.offer?.id || d?.listingId || d?.propertyId || 0) === Number(offer.id),
      );
        if (!matchingDeal?.id) {
          setDealNegotiationState(null);
          return;
        }
        const existingDealId = Number(matchingDeal.id);
        setDealId(existingDealId);
      const messagesRes = await fetch(
        `${API_URL}/api/mobile/v1/deals/${existingDealId}/messages?t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
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
      const latestAppointment =
        appointmentHistory.length > 0 ? appointmentHistory[appointmentHistory.length - 1] : null;
      const presentation = deriveOfferDealPresentation({
        messages,
        dealStatus: matchingDeal?.status ?? matchingDeal?.dealStatus,
        acceptedBidId: matchingDeal?.acceptedBidId ?? matchingDeal?.acceptedBid?.id,
      });
        setDealNegotiationState({
          dealId: existingDealId,
          bidHistory,
          appointmentHistory,
          latestBid,
          latestAppointment,
        presentation,
        });
      } catch {
        // noop
      } finally {
        setDealSyncLoading(false);
      }
  }, [token, offer?.id, isOwner]);

  useEffect(() => {
    void loadDealState();
  }, [loadDealState]);

  useFocusEffect(
    useCallback(() => {
      void loadDealState();
    }, [loadDealState]),
  );

  const reloadOfferHydration = useCallback(async () => {
    const id = Number(offer?.id || idFromParams || 0);
    if (!id) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const detailRes = await fetch(`${API_URL}/api/mobile/v1/offers/${id}`, { headers });
      if (!detailRes.ok) return;
      const detailJson = await detailRes.json();
      const candidate =
        detailJson?.offer ??
        detailJson?.data?.offer ??
        detailJson?.data ??
        (detailJson?.id ? detailJson : null);
      if (candidate) {
        setHydratedOffer((prev: any) => ({
          ...(prev || offerFromParams || {}),
          ...candidate,
          id: Number(candidate?.id) || id,
        }));
        setHydrationStatus('success');
      }
    } catch {
      /* noop */
    }
  }, [offer?.id, idFromParams, token, offerFromParams]);

  useFocusEffect(
    useCallback(() => {
      void reloadOfferHydration();
    }, [reloadOfferHydration]),
  );

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
      ? t('offer.detail.seller.agentLoading')
      : ownerReviews.length > 0
        ? t('offer.detail.seller.ratingReviews', {
            rating: ownerAverageRating.toFixed(1),
            count: ownerReviews.length,
          })
        : t('offer.detail.seller.agentCard')
    : ownerProfileLoading
      ? t('offer.detail.seller.sellerLoading')
      : t('offer.detail.seller.ratingOnly', { rating: (ownerAverageRating || 0).toFixed(1) });

  const sellerPersonName =
    String(ownerProfile?.user?.name || ownerProfile?.user?.fullName || offer?.userName || '').trim() || null;
  const sellerPrimaryLabel =
    agentCommissionInfo?.companyName ||
    sellerPersonName ||
    offer?.userName ||
    t('offer.shared.sellerFallback');
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
      throw new Error(data?.error || t('offer.detail.alerts.profileFetchFailed'));
    }
    return data;
  };

  const openOwnerProfileModal = () => {
    if (isSamplePreview) return;
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
      Alert.alert('EstateOS', t('offer.detail.alerts.profileLoadFailed'));
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
      Alert.alert('EstateOS', t('offer.detail.alerts.profileBackFailed'));
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
          next[id] = profile?.user?.name || t('offer.detail.profile.reviewerFallback', { id });
        } catch {
          next[id] = t('offer.detail.profile.reviewerFallback', { id });
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
      <Animated.View
        style={[styles.imageContainer, imageAnimatedStyle]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => openGallery(0)}
          style={styles.heroImagePressable}
          accessibilityRole="button"
          accessibilityLabel={t('offer.detail.hero.openGallery')}
        >
          <Image
            source={{ uri: imagesToShow[0] }}
            style={styles.mainImage}
            contentFit="cover"
            contentPosition="center"
            transition={500}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.52)']}
            locations={[0, 0.55, 1]}
            style={styles.heroGradient}
            pointerEvents="none"
          />
        </Pressable>
        {imagesToShow.length > 0 ? (
          <Pressable
            onPress={() => openGallery(0)}
            style={styles.heroPhotoPill}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('offer.detail.hero.openGallery')}
          >
            <BlurView intensity={68} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.heroPhotoPillInner} pointerEvents="none">
              <Images color="#FFFFFF" size={15} strokeWidth={2.2} />
              <Text style={styles.heroPhotoPillText}>
                {t('offer.detail.hero.photoCount', { count: imagesToShow.length })}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </Animated.View>

      <View style={[styles.topBar, { top: Math.max(12, insets.top + 6) }]}>
        <TouchableOpacity style={styles.glassButton} onPress={() => navigation?.goBack()} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <ChevronLeft color="white" size={24} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          {!isSamplePreview ? (
            <>
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
              accessibilityLabel={t('offer.detail.accessibility.moreOptions')}
              accessibilityRole="button"
            >
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
              <MoreHorizontal color="white" size={20} />
            </TouchableOpacity>
          ) : null}
            </>
          ) : null}
        </View>
      </View>

      <AnimatedScrollView
        ref={scrollViewRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        overScrollMode="always"
        bounces
        pointerEvents="box-none"
        style={styles.scrollLayer}
        contentContainerStyle={styles.scrollContent}
      >
        {/*
          Przezroczysty pas nad zdjęciem — ScrollView ma pointerEvents="box-none",
          więc dotyk trafia w Pressable hero pod spodem (galeria). Przewijanie działa
          na białej karcie treści poniżej.
        */}
        <Pressable
          onPress={() => openGallery(0)}
          style={styles.heroTapStrip}
          accessibilityRole="button"
          accessibilityLabel={t('offer.detail.hero.openGallery')}
        />
        <View
          style={[
            styles.contentSheet,
            {
              backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
              marginTop: -HERO_SHEET_OVERLAP,
            },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={
              isDark
                ? ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'transparent']
                : ['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.06)', 'transparent']
            }
            locations={[0, 0.45, 1]}
            style={styles.sheetTopShade}
          />
          <Animated.View
            style={[styles.sheetGrabberZone, sheetGrabberAnimatedStyle]}
            accessibilityRole="adjustable"
            accessibilityLabel={t('offer.detail.sheetSwipeHint')}
          >
            <View
              pointerEvents="none"
              style={[
                styles.sheetDragHandle,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.34)' : 'rgba(60,60,67,0.28)' },
              ]}
            />
            <View
              onTouchStart={rememberTouchStart}
              onTouchEnd={handleSheetHintTapEnd}
              accessibilityRole="button"
              accessibilityHint={t('offer.detail.sheetSwipeHint')}
            >
              <Animated.View pointerEvents="none" style={[styles.sheetSwipeHintRow, sheetSwipeHintStyle]}>
                <ChevronUp
                  size={13}
                  color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(60,60,67,0.45)'}
                  strokeWidth={2.5}
                />
                <Text
                  style={[
                    styles.sheetSwipeHintText,
                    { color: isDark ? 'rgba(255,255,255,0.58)' : 'rgba(60,60,67,0.52)' },
                  ]}
                >
                  {t('offer.detail.sheetSwipeHint')}
                </Text>
                <ChevronUp
                  size={13}
                  color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(60,60,67,0.45)'}
                  strokeWidth={2.5}
                />
              </Animated.View>
            </View>
          </Animated.View>
          {/* Cena na górze została usunięta — pełna kwota i PLN/m² siedzą teraz
              w dolnym pasku CTA. Trzymamy tu tylko badge'y meta (czynsz, views). */}
          <View style={styles.topMetaBadgesRow}>
            <View style={[styles.viewsBadge, { backgroundColor: isDark ? '#1c1c1e' : '#f3f4f6', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)' }]}>
              <Eye color={isDark ? "#9ca3af" : "#374151"} size={14} />
              <Text style={[styles.viewsBadgeText, { color: isDark ? '#d1d5db' : '#374151' }]}>
                {viewsCount > 0
                  ? t('offer.detail.views.count', { count: viewsCount.toLocaleString(dateLocale) })
                  : t('offer.detail.views.countZero')}
              </Text>
          </View>
            {isLegalSafeVerified ? (
              <View style={styles.topMetaCenterBadge}>
                <LegalVerifiedShieldBadge isDark={isDark} compact />
              </View>
            ) : (
              <View style={styles.topMetaCenterSpacer} />
            )}
            {isNewOfferListing ? (
              <Animated.View
                style={[
                  styles.newOfferBadge,
                  {
                    backgroundColor: isDark ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.14)',
                    borderColor: isDark ? 'rgba(96,165,250,0.65)' : 'rgba(37,99,235,0.45)',
                  },
                  newOfferBadgeAnimatedStyle,
                ]}
              >
                <Text style={[styles.newOfferBadgeText, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
                  {t('offer.detail.views.newOfferBadge')}
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.topMetaEndSpacer} />
            )}
          </View>
          
          {isSamplePreview ? (
            <View
              style={[
                styles.samplePreviewBanner,
                {
                  backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                  borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.25)',
                },
              ]}
            >
              <Text style={[styles.samplePreviewBannerTitle, { color: isDark ? '#6ee7b7' : '#047857' }]}>
                {t('addOffer.step5.proSession.examples.previewBanner')}
              </Text>
              <Text style={[styles.samplePreviewBannerSub, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {t('addOffer.step5.proSession.examples.previewBannerSub')}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.title, isDark && { color: '#ffffff' }]}>{displayOffer.title}</Text>

          {auctionEvent ? (
            <AuctionOfferBanner
              event={auctionEvent}
              isDark={isDark}
              onPress={() =>
                (navigation as any).navigate('AuctionEvent', { eventId: auctionEvent.id })
              }
            />
          ) : null}
          {openHouseEvent && openHouseEvent.status === 'PUBLISHED' && openHouseEvent.totalSpotsLeft > 0 ? (
            <OpenHouseOfferBanner
              event={openHouseEvent}
              isDark={isDark}
              onPress={() =>
                (navigation as any).navigate('OpenHouseEvent', { eventId: openHouseEvent.id })
              }
            />
          ) : null}
          
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

          {!isLegalSafeVerified && isOwner && Number(offer?.id) > 0 && isPolandOffer ? (
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
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('offer.detail.stats.rooms', { count: displayOffer.stats.beds })}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Maximize color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{displayOffer.stats.size}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Layers color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('offer.detail.stats.floor', { floor: formatFloorStat(offer?.floor, t) })}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: isDark ? '#1c1c1e' : '#f6f7f9', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.06)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
              <Calendar color={isDark ? "#e5e7eb" : "#1d1d1f"} size={26} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('offer.detail.stats.year', { year: offer?.yearBuilt || offer?.buildYear || offer?.year || '-' })}</Text>
            </View>
          </View>

          <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>{t('offer.detail.sections.keyParameters')}</Text>
          <View style={[styles.detailsContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f5f6f8', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.05)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
            <View style={[styles.detailsContainerInnerGlow, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]} pointerEvents="none" />
            <View style={[styles.detailRow, { borderTopWidth: 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.transactionType')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{txTypeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.propertyType')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{propTypeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{String(offer?.propertyType || '').toUpperCase() === 'PLOT' ? t('offer.detail.labels.plotArea') : t('offer.detail.labels.area')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{displayOffer.stats.size}</Text></View>
            {String(offer?.propertyType || '').toUpperCase() === 'HOUSE' &&
            Number(String(offer?.plotArea ?? '').replace(',', '.')) > 0 ? (
              <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                <Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.plotArea')}</Text>
                <Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>
                  {`${Number(String(offer.plotArea).replace(',', '.'))} m²`}
                </Text>
              </View>
            ) : null}
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.rooms')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{offer?.rooms != null && offer?.rooms !== '' ? String(offer.rooms) : t('offer.shared.emDash')}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.floor')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatFloorStat(offer?.floor, t)}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.price')}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{displayOffer.price}</Text>
                {displayOffer.priceSecondary ? (
                  <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, textAlign: 'right' }}>{displayOffer.priceSecondary}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.detailRow, { borderBottomColor: isPartnerListing || agentCommissionInfo ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent', borderBottomWidth: isPartnerListing || agentCommissionInfo ? StyleSheet.hairlineWidth : 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.pricePerSqm')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{pricePerSqmLabel || t('offer.shared.emDash')}</Text></View>
            {isPartnerListing || agentCommissionInfo ? (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.agentCommission')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]} numberOfLines={6}>{agentCommissionDetail}</Text></View>
            ) : null}
          </View>

          <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>{t('offer.detail.sections.details')}</Text>
          <View style={[styles.detailsContainer, { backgroundColor: isDark ? '#1c1c1e' : '#f5f6f8', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.05)', borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)' }]}>
            <View style={[styles.detailsContainerInnerGlow, isDark && { borderColor: 'rgba(255,255,255,0.1)' }]} pointerEvents="none" />
            <View style={[styles.detailRow, { borderTopWidth: 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.condition')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatOfferConditionLabel(offer?.condition, t)}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.adminFee')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{adminFeeLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.heating')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{heatingLabel || t('offer.shared.notProvided')}</Text></View>
            <View style={[styles.detailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.furnished')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{furnishedLabel}</Text></View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={[styles.detailLabel, isDark && { color: '#9ca3af' }]}>{t('offer.detail.labels.onMarketSince')}</Text><Text style={[styles.detailValue, isDark && { color: '#e5e7eb' }]}>{formatDate(offer?.createdAt)}</Text></View>
          </View>

          {/* RZUT NIERUCHOMOŚCI */}
          <FloorPlanViewer
            imageUrl={
              offer?.floorPlanUrl
                ? offer.floorPlanUrl.startsWith('/uploads')
                  ? `${API_URL}${offer.floorPlanUrl}`
                  : offer.floorPlanUrl
                : null
            }
            model3dUrl={
              offer?.floorPlan3dUrl
                ? String(offer.floorPlan3dUrl).startsWith('/uploads')
                  ? `${API_URL}${offer.floorPlan3dUrl}`
                  : offer.floorPlan3dUrl
                : null
            }
            scanMeta={(() => {
              try {
                const raw = offer?.floorPlanScanMeta;
                if (!raw || typeof raw !== 'string') return null;
                return normalizeStoredScanMeta(JSON.parse(raw));
              } catch {
                return null;
              }
            })()}
            theme={theme}
          />

          {hasValidMapCoords ? (
            <>
              <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>
                {t('offer.detail.sections.location')}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsLocationPreviewOpen(true);
                }}
                style={({ pressed }) => [
                  styles.inlineMapCard,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDark ? '#1c1c1e' : '#f5f6f8',
                  },
                  pressed && { opacity: 0.86 },
                ]}
              >
                <View style={styles.inlineMapWrap}>
                  <MapView
                    style={styles.inlineMap}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    zoomTapEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
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
                      <Marker coordinate={mapCoordinate} />
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
                  <View style={styles.inlineMapExpandBadge}>
                    <Maximize size={14} color="#ffffff" strokeWidth={2.2} />
                  </View>
                </View>
                <View style={styles.inlineMapFooter}>
                  <MapPin color={isDark ? '#9ca3af' : '#86868b'} size={15} />
                  <Text style={[styles.inlineMapAddress, isDark && { color: '#d1d5db' }]} numberOfLines={2}>
                    {locationLine}
                  </Text>
                </View>
                <Text style={[styles.inlineMapHint, isDark && { color: '#9ca3af' }]}>
                  {mapPresentation.mode === 'pin'
                    ? t('offer.edit.location.mapHintExact')
                    : t('offer.edit.location.mapHintCircle')}
                </Text>
              </Pressable>
            </>
          ) : null}

          {activeAmenities.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 15 }, isDark && { color: '#ffffff' }]}>{t('offer.detail.sections.amenities')}</Text>
              <View style={styles.amenitiesWrapper}>
                {activeAmenities.map((am, i) => <View key={i} style={[styles.amenityPill, isDark && { backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.05)' }]}><Text style={[styles.amenityText, isDark && { color: '#e5e7eb' }]}>{am}</Text></View>)}
              </View>
            </>
          )}

          <View style={[styles.divider, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <Text style={[styles.sectionTitle, isDark && { color: '#ffffff' }]}>{t('offer.detail.sections.about')}</Text>
          <Text style={[styles.description, isDark && { color: '#d1d5db' }]}>{displayOffer.description}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 28 }, isDark && { color: '#ffffff' }]}>{t('offer.detail.sections.gallery')}</Text>
          <View style={styles.gallerySection}>
            <Pressable
              onPress={() => openGallery(galleryPreviewIndex)}
              style={[
                styles.galleryHeroWrap,
                isDark && { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#111111' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('offer.detail.hero.openGallery')}
            >
              <Image
                source={{ uri: imagesToShow[galleryPreviewIndex] }}
                style={styles.galleryHeroImage}
                contentFit="cover"
                contentPosition="center"
                transition={220}
              />
            </Pressable>
            {imagesToShow.length > 1 ? (
              <ScrollView
                horizontal
                nestedScrollEnabled={Platform.OS === 'android'}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryThumbRow}
              >
                {imagesToShow.map((img, idx) => {
                  const isActive = idx === galleryPreviewIndex;
                  return (
                    <Pressable
                      key={`${img}-${idx}`}
                      onPress={() => selectGalleryPreview(idx)}
                      style={[
                        styles.galleryThumbWrap,
                        isDark && { backgroundColor: '#1c1c1e' },
                        isActive && styles.galleryThumbWrapActive,
                        isActive && isDark && { borderColor: '#0A84FF' },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={t('offer.detail.gallery.thumbA11y', {
                        index: idx + 1,
                        total: imagesToShow.length,
                      })}
                    >
                      <Image source={{ uri: img }} style={styles.galleryThumbImage} contentFit="cover" transition={150} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          {!isSamplePreview && Number(offer?.id) > 0 ? (
            <OfferPriceHistorySection
              offerId={Number(offer.id)}
              offer={offer}
              isDark={isDark}
              token={token}
              contentWidth={GALLERY_CONTENT_WIDTH}
            />
          ) : null}

          {isSamplePreview ? (
            <Text style={styles.offerIdText}>{t('addOffer.step5.proSession.examples.previewOfferId')}</Text>
          ) : (
            <Text style={styles.offerIdText}>{t('offer.detail.offerId', { id: offer?.id })}</Text>
          )}
          {!isOwner && !dealSyncLoading && dealNegotiationState?.latestAppointment && (
            <View
              style={[
                styles.negotiationMemoryBox,
                String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? styles.negotiationMemoryBoxConfirmed
                  : styles.negotiationMemoryBoxPending
              ]}
            >
              <Text style={styles.negotiationMemoryLabel}>{t('offer.detail.negotiation.appointmentLabel')}</Text>
              <Text style={styles.negotiationMemoryTitle}>
                {String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? t('offer.detail.negotiation.appointmentConfirmedTitle')
                  : t('offer.detail.negotiation.appointmentPendingTitle')}
              </Text>
              <Text style={styles.negotiationMemoryText}>
                {String(dealNegotiationState.latestAppointment.action || '').toUpperCase() === 'ACCEPTED'
                  ? t('offer.detail.negotiation.appointmentConfirmedBody', {
                      date: dealNegotiationState.latestAppointment?.proposedDate
                        ? new Date(dealNegotiationState.latestAppointment.proposedDate).toLocaleString(dateLocale)
                        : '-',
                    })
                  : Number(dealNegotiationState.latestAppointment?.senderId || 0) === Number(user?.id || 0)
                    ? t('offer.detail.negotiation.appointmentWaitingBody')
                    : t('offer.detail.negotiation.appointmentOwnerAction', {
                        action: getDealActionLabel(dealNegotiationState.latestAppointment.action, t),
                      })}
              </Text>
            </View>
          )}
          {!isOwner && !dealSyncLoading && dealPresentation?.priceNegotiation ? (
            <View
              style={[
                styles.negotiationMemoryBox,
                dealPresentation.priceNegotiation.tone === 'finalized'
                  ? styles.negotiationMemoryBoxFinalized
                  : dealPresentation.priceNegotiation.tone === 'confirmed'
                  ? styles.negotiationMemoryBoxConfirmed
                    : styles.negotiationMemoryBoxPending,
              ]}
            >
              <Text style={styles.negotiationMemoryLabel}>{t('offer.detail.negotiation.priceLabel')}</Text>
              <Text style={styles.negotiationMemoryTitle}>{dealPresentation.priceNegotiation.title}</Text>
              <Text style={styles.negotiationMemoryText}>{dealPresentation.priceNegotiation.body}</Text>
            </View>
          ) : null}
          {/*
            Stały blok w kolorze karty — rezerwuje miejsce pod fixed bottom bar
            (cena + prowizja + Spotkanie / Negocjuj). Bez tego ScrollView (zIndex 2)
            przykrywa pasek i zabiera dotyk.
          */}
          <View
            pointerEvents="none"
            style={{
              height: bottomBarHeight + 12,
              marginHorizontal: -24,
              backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
            }}
          />
        </View>
      </AnimatedScrollView>

      {/* --- NOWY, LUKSUSOWY BOTTOM BAR APPLE-STYLE --- */}
      <View
        style={styles.bottomBarContainer}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          // Aktualizujemy tylko gdy zmiana > 2px, żeby nie wpadać w pętlę re-renderów.
          if (Math.abs(h - bottomBarHeight) > 2) setBottomBarHeight(h);
        }}
      >
        <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 16) + 12 }, Platform.OS === 'android' && { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }, isDark && { backgroundColor: Platform.OS === 'android' ? '#0a0a0a' : 'rgba(10,10,10,0.65)', borderTopColor: 'rgba(255,255,255,0.1)' }]}>
          
          {/* TOP ROW: Cena (z meta-pigułkami) + ROI / status cenowy / sprzedawca */}
          <View style={styles.bottomBarTopRow}>
            <View style={styles.bottomBarPriceColumn}>
              <Text style={styles.bottomBarPriceLabel}>{t('offer.detail.labels.offerPrice')}</Text>
              {priceDiscount.isDiscounted && listedPriceLabel ? (
                <OfferDiscountPriceBlock
                  discountPercent={priceDiscount.discountPercent}
                  listedPriceLabel={listedPriceLabel}
                  isDark={isDark}
                />
              ) : null}
              <Text
                style={[styles.bottomBarPrice, isDark && { color: '#ffffff' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {displayOffer.price}
              </Text>
              {displayOffer.priceSecondary ? (
                <Text style={[styles.bottomBarPriceSqm, isDark && { color: '#9ca3af' }]} numberOfLines={2}>
                  {displayOffer.priceSecondary}
                </Text>
              ) : null}
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
                      {t('offer.detail.adminFeePill', { amount: adminFeeLabel })}
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
                      {t('offer.detail.roi.label')}
                    </Text>
                    <Text style={styles.roiPillValue} numberOfLines={1}>
                      {estimatedRoi}%
                    </Text>
                    <Text style={styles.roiPillSub} numberOfLines={1}>
                      {t('offer.detail.roi.sub')}
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
                        ? t('offer.detail.commission.ownerPillZero')
                        : t('offer.detail.commission.ownerPillPercent', {
                            percent: agentCommissionInfo.percentLabel,
                            amount: agentCommissionAmountLabel ?? agentCommissionInfo.amountLabel,
                          })}
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
          {agentCommissionInfo ? (
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
                      {agentCommissionInfo.isZero ? t('offer.detail.commission.pillZero') : t('offer.detail.commission.pillAgent')}
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
                      {t('offer.detail.commission.zeroHero')}
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
                        {t('offer.detail.commission.approxAmount', { amount: agentCommissionAmountLabel ?? agentCommissionInfo.amountLabel })}
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
                    {t('offer.detail.commission.bodyZero', {
                      agentNote: agentCommissionInfo.companyName
                        ? t('offer.detail.commission.bodyZeroCompany', {
                            companyName: agentCommissionInfo.companyName,
                          })
                        : t('offer.detail.commission.bodyZeroAgentDefault'),
                    })}
                  </>
                ) : (
                  <>
                    {t('offer.detail.commission.bodyPaid', {
                      amount: agentCommissionAmountLabel ?? agentCommissionInfo.amountLabel,
                      percent: agentCommissionInfo.percentLabel,
                      agentSuffix: agentCommissionInfo.companyName
                        ? ` ${agentCommissionInfo.companyName}`
                        : t('offer.detail.commission.bodyPaidAgentDefault'),
                    })}
                    <Text style={{ fontWeight: '800' }}>{t('offer.detail.commission.bodyPaidVatBold')}</Text>
                  </>
                )}
              </Text>
            </View>
          ) : null}

          {/* BOTTOM ROW: Akcje */}
          <View style={styles.bottomActionsRow}>
            {isSamplePreview ? (
              <View
                style={[
                  styles.samplePreviewFooter,
                  {
                    backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
                    borderColor: isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.2)',
                  },
                ]}
              >
                <Text style={[styles.samplePreviewFooterTitle, { color: isDark ? '#6ee7b7' : '#047857' }]}>
                  {t('addOffer.step5.proSession.examples.previewFooter')}
                </Text>
              </View>
            ) : isOwner ? (
              <TouchableOpacity style={[styles.primaryAppleButton, { backgroundColor: isDark ? '#ffffff' : '#1d1d1f', flex: 1 }]} onPress={handleEdit}>
                <Pencil size={18} color={isDark ? '#000000' : '#fff'} />
                <Text style={[styles.primaryAppleButtonText, { color: isDark ? '#000000' : '#ffffff' }]}>{t('offer.detail.ctas.editOffer')}</Text>
              </TouchableOpacity>
            ) : blockBuyerNegotiation ? (
              <TouchableOpacity
                style={[styles.primaryAppleButton, { flex: 1 }]}
                onPress={() => {
                  if (guardPhoneVerification()) return;
                  openDealroom();
                }}
                activeOpacity={0.85}
              >
                <Handshake size={16} color="#fff" />
                <Text style={styles.primaryAppleButtonText}>
                  {dealPresentation?.transactionFinalized ? t('offer.detail.ctas.viewDealroom') : t('offer.detail.ctas.dealroomStatus')}
                </Text>
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
                    <Text style={[styles.secondaryAppleButtonText, isDark && { color: '#ffffff' }]}>{t('offer.detail.ctas.appointment')}</Text>
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
                    <Text style={styles.primaryAppleButtonText}>{t('offer.detail.ctas.negotiate')}</Text>
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
        swipeToCloseEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000000F2"
        HeaderComponent={({ imageIndex }) => (
          <View style={[styles.galleryHeader, { paddingTop: Math.max(insets.top + 6, Platform.OS === 'ios' ? 54 : 36) }]}>
            <TouchableOpacity
              onPress={closeGallery}
              style={styles.galleryCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <X color="#FFFFFF" size={20} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
              {t('offer.detail.gallery.counter', {
                current: (imageIndex ?? galleryCurrentIndex) + 1,
                total: imagesToShow.length,
              })}
            </Text>
            <View style={styles.galleryHeaderSpacer} />
          </View>
        )}
      />

      {isLocationPreviewOpen ? (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setIsLocationPreviewOpen(false)}
      >
        <View style={styles.locationModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsLocationPreviewOpen(false)} />
          <View style={styles.locationModalCard}>
            <View style={styles.locationModalHeader}>
              <Text style={styles.locationModalTitle}>{t('offer.detail.modals.locationTitle')}</Text>
              <TouchableOpacity onPress={() => setIsLocationPreviewOpen(false)} style={styles.locationModalCloseBtn}>
                <X size={16} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.locationModalAddress}>{locationLine}</Text>
            <View style={styles.locationMiniMapWrap}>
              <MapView
                style={styles.locationMiniMap}
                scrollEnabled
                zoomEnabled
                zoomTapEnabled
                rotateEnabled={false}
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
              <Text style={styles.locationModalHint}>{t('offer.detail.modals.locationNoCoords')}</Text>
            ) : mapPresentation.mode === 'circle' ? (
              <Text style={styles.locationModalHint}>{t('offer.detail.modals.locationCircleHint')}</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      ) : null}

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
        title={t('offer.detail.modals.bidTitle')}
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
        title={t('offer.detail.modals.appointmentTitle')}
        onClose={() => setIsAppointmentModalOpen(false)}
        onDone={openDealroom}
      />

      {/* --- MODALE --- */}
      {isOwnerProfileOpen ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setIsOwnerProfileOpen(false)}>
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
                    <Text style={styles.profileBackText}>{t('offer.detail.profile.back')}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.profileBackPlaceholder} />
                )}
                <Text style={styles.profileTitle}>{t('offer.detail.profile.title')}</Text>
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
                <Text style={styles.profileMuted}>{t('offer.detail.profile.loading')}</Text>
              </View>
            ) : (
              <>
                <ProfilePublicHeader
                  user={activeProfileData?.user || activeProfileData}
                  idLabel={t('offer.detail.profile.idLabel', {
                    id: activeProfileData?.user?.id || activeProfileUserId || offer?.userId || '-',
                  })}
                  isDark
                />
                <ProfileReputationBlock
                  reviews={Array.isArray(activeProfileData?.reviews) ? activeProfileData.reviews : []}
                  reviewsCountLabel={(count) => t('offer.detail.profile.reviewsCount', { count })}
                  isDark
                />

                {!isOwner ? (
                  <ProfileWriteMessageButton
                    peerName={activeProfileData?.user?.name}
                    loading={contactWriteLoading}
                    onPress={() => {
                      const peerId = Number(
                        activeProfileData?.user?.id || activeProfileUserId || offer?.userId || 0
                      );
                      if (!peerId) return;
                      setContactWriteLoading(true);
                      void openDirectContactChat(
                        navigation,
                        token,
                        peerId,
                        activeProfileData?.user?.name
                      ).finally(() => {
                        setContactWriteLoading(false);
                        setIsOwnerProfileOpen(false);
                        setProfileHistory([]);
                      });
                    }}
                  />
                ) : null}

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {!Array.isArray(activeProfileData?.reviews) || activeProfileData.reviews.length === 0 ? (
                    <Text style={styles.profileMuted}>{t('offer.detail.profile.noReviews')}</Text>
                  ) : activeProfileData.reviews.slice(0, 12).map((r: any) => (
                    <View key={r.id} style={styles.reviewItem}>
                      <View style={styles.reviewTop}>
                        <View style={{ flex: 1 }}>
                          <Pressable onPress={() => openReviewerProfileInModal(Number(r?.reviewerId || 0))} style={({ pressed }) => [styles.reviewAuthorBtn, pressed && { opacity: 0.7 }]}>
                            <Text style={styles.reviewAuthorText}>
                              {reviewerNameCache[Number(r?.reviewerId || 0)] || t('offer.detail.profile.reviewerFallback', { id: r?.reviewerId || '-' })}
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
                        <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString(dateLocale)}</Text>
                      </View>
                      <Text style={styles.reviewText}>{r.comment || t('offer.detail.profile.noComment')}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
      ) : null}

      {/* --- OFF MARKET: BLOKADA 24H DLA NIE-PRO --- */}
      {isOffMarketLocked && !isGuest ? (
      <Modal visible transparent animationType="fade">
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.offMarketBackdrop} />
          <View style={styles.offMarketOverlay}>
            <View style={styles.offMarketCard}>
              <View style={styles.offMarketTopStripe} />
              <View style={styles.offMarketIconWrap}>
                <Lock color="#D4AF37" size={30} />
              </View>
              <Text style={styles.offMarketTitle}>{t('offer.offMarket.title')}</Text>
              <Text style={styles.offMarketSub}>
                {t('offer.offMarket.subtitle')}
              </Text>
              <View style={styles.countdownRow}>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValue}>{countdownParts.hours}</Text>
                  <Text style={styles.countdownLabel}>{t('offer.offMarket.countdownHours')}</Text>
                </View>
                <Text style={styles.countdownColon}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValue}>{countdownParts.minutes}</Text>
                  <Text style={styles.countdownLabel}>{t('offer.offMarket.countdownMinutes')}</Text>
                </View>
                <Text style={styles.countdownColon}>:</Text>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownValueAccent}>{countdownParts.seconds}</Text>
                  <Text style={styles.countdownLabelAccent}>{t('offer.offMarket.countdownSeconds')}</Text>
                </View>
              </View>
              <Text style={styles.offMarketProHint}>
                {t('offer.offMarket.proHint')}
              </Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.offMarketPrimaryButton} onPress={handleBecomePro}>
                <Crown color="#0a0a0a" size={16} />
                <Text style={styles.offMarketPrimaryButtonText}>{t('offer.offMarket.investorProCta')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.offMarketSecondaryButton} onPress={() => navigation?.goBack()}>
                <Text style={styles.offMarketSecondaryButtonText}>{t('offer.offMarket.waitPatiently')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
      ) : null}

      {/* --- GUEST GATE: DOSTĘP DO OFERTY DLA NIEZALOGOWANYCH --- */}
      {isGuest && isGuestGateVisible ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => navigation?.goBack()}>
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
              <Text style={styles.guestGateTitle}>{t('offer.guestGate.createAccountTitle')}</Text>
              <Text style={styles.guestGateSub}>
                {t('offer.guestGate.createAccountSub')}
              </Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestPrimaryButton} onPress={() => openAuthEntry('register')}>
                <Crown color="#0a0a0a" size={16} />
                <Text style={styles.guestPrimaryButtonText}>{t('offer.guestGate.register')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestSecondaryButton} onPress={() => openAuthEntry('login')}>
                <Text style={styles.guestSecondaryButtonText}>{t('offer.guestGate.login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
      ) : null}

      {isPhoneVerifyGateVisible ? (
      <Modal
        visible
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
              <Text style={styles.guestGateTitle}>{t('offer.guestGate.phoneVerifyTitle')}</Text>
              <Text style={styles.guestGateSub}>
                {t('offer.guestGate.phoneVerifySub')}
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
                <Text style={styles.guestPrimaryButtonText}>{t('offer.guestGate.phoneVerifyCta')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.guestSecondaryButton} onPress={() => setIsPhoneVerifyGateVisible(false)}>
                <Text style={styles.guestSecondaryButtonText}>{t('offer.guestGate.later')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
      ) : null}

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
          headline={lifecycleState.isClosed ? lifecycleState.headline : t('offer.lifecycle.expired.headline')}
          subline={
            lifecycleState.isClosed
              ? lifecycleState.subline
              : t('offer.detail.closedFallbackSubline')
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
      {isMoreMenuOpen ? (
      <Modal
        visible
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
                {t('offer.detail.moreMenu.report')}
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
                  {t('offer.detail.moreMenu.block')}
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
                {t('offer.detail.moreMenu.cancel')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      ) : null}

      <ReportSheet
        visible={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="offer"
        targetId={Number(offer?.id || 0)}
        targetLabel={displayOffer?.title ? t('offer.detail.reportTargetLabel', { title: displayOffer.title }) : undefined}
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
  imageContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: IMG_HEIGHT, zIndex: 1, elevation: 1 },
  scrollLayer: { flex: 1, zIndex: 2 },
  scrollContent: { flexGrow: 0, paddingBottom: 0 },
  heroTapStrip: { height: HERO_TAP_HEIGHT, backgroundColor: 'transparent' },
  heroImagePressable: { flex: 1 },
  mainImage: { width: '100%', height: '100%' },
  heroPhotoPill: {
    position: 'absolute',
    right: 18,
    bottom: HERO_SHEET_OVERLAP + 54,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  heroPhotoPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPhotoPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  topBar: { position: 'absolute', top: 55, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 100 },
  topBarRight: { flexDirection: 'row' },
  glassButton: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  contentSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingTop: 4,
    overflow: 'visible',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 22,
  },
  sheetTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    zIndex: 1,
  },
  sheetGrabberZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    marginBottom: 6,
    marginHorizontal: -8,
    minHeight: 52,
    zIndex: 2,
  },
  sheetDragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  sheetSwipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  sheetSwipeHintText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  price: { fontSize: 34, fontWeight: '800', color: '#1d1d1f', letterSpacing: -1, marginBottom: 8 },
  topMetaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  topMetaCenterBadge: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topMetaCenterSpacer: { flex: 1 },
  topMetaEndSpacer: { minWidth: 0 },
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
  newOfferBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  newOfferBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
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
  inlineMapCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  inlineMapWrap: { height: 200, position: 'relative' },
  inlineMap: { width: '100%', height: '100%' },
  inlineMapExpandBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inlineMapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  inlineMapAddress: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 18,
  },
  inlineMapHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    lineHeight: 16,
  },
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
  offerIdText: { textAlign: 'center', color: '#86868b', fontSize: 12, marginTop: 24, marginBottom: 0, letterSpacing: 0.5 },
  samplePreviewBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  samplePreviewBannerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  samplePreviewBannerSub: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 4 },
  samplePreviewFooter: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  samplePreviewFooterTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
  
  gallerySection: {
    gap: 12,
  },
  galleryHeroWrap: {
    width: '100%',
    height: GALLERY_HERO_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#f3f4f6',
  },
  galleryHeroImage: {
    width: '100%',
    height: '100%',
  },
  galleryThumbRow: {
    gap: 10,
    paddingRight: 4,
  },
  galleryThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#f3f4f6',
  },
  galleryThumbWrapActive: {
    borderColor: '#007AFF',
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  
  // --- ZMIENIONA SEKCJA BOTTOM BAR ---
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
  },
  bottomBar: { 
    paddingHorizontal: 20, 
    paddingTop: 16, 
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

  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  galleryCounter: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    opacity: 0.92,
  },
  galleryCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  galleryHeaderSpacer: { width: 36 },

  offMarketBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.80)' },
  offMarketOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  offMarketCard: { width: '100%', maxWidth: 440, backgroundColor: '#0a0a0a', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', position: 'relative', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 30 },
  offMarketTopStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#D4AF37' },
  offMarketIconWrap: { width: 62, height: 62, borderRadius: 31, marginTop: 6, marginBottom: 18, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center' },
  offMarketTitle: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  offMarketSub: { color: 'rgba(255,255,255,0.52)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 30, paddingHorizontal: 4 },
  offMarketProHint: { color: 'rgba(255,255,255,0.52)', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24, paddingHorizontal: 4 },
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
  negotiationMemoryBoxFinalized: {
    borderColor: 'rgba(59, 130, 246, 0.55)',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
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