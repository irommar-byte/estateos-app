import React, { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, Zap, MapPin, Maximize } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { isOfferClosed } from '../utils/offerLifecycle';
import { useMoneyContext } from '../money/useMoneyContext';
import { resolveOfferListingPrice } from '../money/offerPrice';
import { resolveOfferPriceDiscount } from '../utils/offerPriceDiscount';
import {
  buildChartSeriesFromHistory,
} from '../utils/offerPriceHistory';
import { fetchOfferPriceHistory } from '../services/offerPriceHistoryService';
import OfferPriceHistoryChart from '../components/offer/OfferPriceHistoryChart';
import {
  type DiscoveryEventType,
  type DiscoveryDislikeReasonCode,
} from '../contracts/discoveryContracts';
import {
  fetchDiscoveryFeed,
  flushDiscoveryEventQueue,
  getOrCreateDiscoverySession,
  mutateDiscoveryTrope,
  trackDiscoveryEvent,
} from '../services/discoveryService';
import { useDiscoveryStore } from '../store/useDiscoveryStore';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoverySessionIsland, { type DiscoveryIslandState } from '../components/discovery/DiscoverySessionIsland';
import DiscoveryGlassOrb from '../components/discovery/DiscoveryGlassOrb';
import DiscoverySmartGallery from '../components/discovery/DiscoverySmartGallery';
import DiscoveryDislikeReasonSheet, { type DislikeReason } from '../components/discovery/DiscoveryDislikeReasonSheet';
import DiscoveryPrioritySheet from '../components/discovery/DiscoveryPrioritySheet';
import DiscoveryInsightBubble from '../components/discovery/DiscoveryInsightBubble';
import DiscoveryEndDeck from '../components/discovery/DiscoveryEndDeck';
import DiscoveryErrorRecovery from '../components/discovery/DiscoveryErrorRecovery';
import DiscoveryPauseSheet from '../components/discovery/DiscoveryPauseSheet';
import DiscoveryContradictionCareSheet from '../components/discovery/DiscoveryContradictionCareSheet';
import { shouldAskDiscoveryDislikeReason } from '../utils/discoveryExperienceState';
import { DISCOVERY_EASE_OUT } from '../components/discovery/discoveryMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// === PALETA DISCOVERY (Apple glass) ===
const RR_BLACK = '#000000';
const RR_GOLD = '#C9A227';
const RR_IVORY = '#F5F0E6';
const RR_GREEN = '#30D158';
const RR_RED = '#FF453A';

type DiscoveryOffer = {
  id: string;
  title: string;
  location: string;
  price: string;
  /** Only set when list price is authentically higher than current. */
  originalPrice: string | null;
  hasPriceDrop: boolean;
  discountPercent: number;
  area: string;
  daysOnMarket: number;
  /** Empty when there is no real price movement — never invent a trend. */
  priceHistory: number[];
  images: string[];
  image: string;
  matchScore?: number | null;
  matchReason?: string | null;
  galleryPlan?: { orderedAssets: string[]; assetRoles?: Array<{ asset: string; role: string }> } | null;
};

type DiscoveryProfile = {
  likedLocations: Record<string, number>;
  dislikedLocations: Record<string, number>;
  medianLikedPrice: number | null;
  medianLikedArea: number | null;
  interactions: number;
};

const DISCOVERY_DISLIKE_REASONS = [
  { key: 'PRICE_TOO_HIGH', label: 'Za drogo' },
  { key: 'LOCATION_MISMATCH', label: 'Lokalizacja' },
  { key: 'LAYOUT_MISMATCH', label: 'Układ / metraż' },
  { key: 'QUALITY_LOW', label: 'Standard' },
] as const satisfies readonly { key: DiscoveryDislikeReasonCode; label: string }[];

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop';

const normalizeMediaUrl = (raw: string | null | undefined): string | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
};

const parseMaybeArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // fallback for "a,b,c" style
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
    }
    return [trimmed];
  }
};

const parsePriceNumber = (value: unknown): number => {
  const n = Number(String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const extractImageFromOffer = (raw: any): string => {
  const direct = [
    raw?.image,
    raw?.imageUrl,
    raw?.thumbnail,
    raw?.thumbnailUrl,
    raw?.photo,
    raw?.cover,
    raw?.coverImage,
    raw?.mainImage,
    raw?.mainPhoto,
    raw?.featuredImage,
    raw?.media?.[0]?.url,
  ]
    .map((v) => normalizeMediaUrl(String(v ?? '').trim()))
    .find(Boolean);
  if (direct) return direct;

  const candidates = [
    ...parseMaybeArray(raw?.images),
    ...parseMaybeArray(raw?.photos),
    ...parseMaybeArray(raw?.gallery),
    ...parseMaybeArray(raw?.media),
  ];
  for (const item of candidates) {
    if (typeof item === 'string') {
      const normalized = normalizeMediaUrl(item.trim());
      if (normalized) return normalized;
    }
    if (item && typeof item === 'object') {
      const url = normalizeMediaUrl(String(item.url ?? item.src ?? item.uri ?? item.path ?? '').trim());
      if (url) return url;
    }
  }

  return PLACEHOLDER_IMAGE;
};

const extractImagesFromOffer = (raw: any): string[] => {
  const urls: string[] = [];
  const pushIfValid = (value: unknown) => {
    const normalized = normalizeMediaUrl(value == null ? null : String(value));
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };

  [
    raw?.image,
    raw?.imageUrl,
    raw?.thumbnail,
    raw?.thumbnailUrl,
    raw?.photo,
    raw?.cover,
    raw?.coverImage,
    raw?.mainImage,
    raw?.mainPhoto,
    raw?.featuredImage,
    raw?.media?.[0]?.url,
  ].forEach(pushIfValid);

  const candidates = [
    ...parseMaybeArray(raw?.images),
    ...parseMaybeArray(raw?.photos),
    ...parseMaybeArray(raw?.gallery),
    ...parseMaybeArray(raw?.media),
  ];
  for (const item of candidates) {
    if (typeof item === 'string') {
      pushIfValid(item);
    } else if (item && typeof item === 'object') {
      pushIfValid(item.url ?? item.src ?? item.uri ?? item.path);
    }
  }

  return urls.length > 0 ? urls : [PLACEHOLDER_IMAGE];
};

const formatPln = (value: number) =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)))} PLN`;

/** Build a short series only when previous price is meaningfully above current. */
const buildPriceHistory = (priceNow: number, previousPrice: number): number[] => {
  if (!(previousPrice > 0 && priceNow > 0)) return [];
  const dropRatio = (previousPrice - priceNow) / previousPrice;
  if (dropRatio < 0.01) return [];
  const nowM = priceNow / 1_000_000;
  const prevM = previousPrice / 1_000_000;
  return [
    Number(prevM.toFixed(2)),
    Number((prevM * 0.99 + nowM * 0.01).toFixed(2)),
    Number(((prevM + nowM) / 2).toFixed(2)),
    Number((prevM * 0.2 + nowM * 0.8).toFixed(2)),
    Number(nowM.toFixed(2)),
  ];
};

const resolveDiscoveryPriceDrop = (
  raw: Record<string, unknown> | null | undefined,
  listingPln: number,
) => {
  const meta = resolveOfferPriceDiscount(raw);
  const listFromMeta = meta.listPricePln;
  const listRaw =
    listFromMeta > 0
      ? listFromMeta
      : Number(raw?.listPricePln ?? raw?.previousPrice ?? raw?.oldPrice ?? 0) || 0;
  const authentic =
    listRaw > listingPln &&
    listingPln > 0 &&
    (listRaw - listingPln) / listRaw >= 0.01;
  if (!authentic) {
    return { hasDrop: false as const, listPricePln: 0, discountPercent: 0 };
  }
  const discountPercent =
    meta.isDiscounted && meta.discountPercent > 0
      ? meta.discountPercent
      : Math.round(((listRaw - listingPln) / listRaw) * 100);
  return { hasDrop: true as const, listPricePln: listRaw, discountPercent };
};

function extractOffersArray(json: any): any[] | null {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.offers)) return json.offers;
  if (Array.isArray(json?.items)) return json.items;
  return null;
}

function orderByRankedIds(fullList: any[], rankedIds: Array<string | number>): any[] {
  if (!rankedIds.length) return fullList;
  const byId = new Map(fullList.map((o) => [String(o?.id), o]));
  const ordered: any[] = [];
  const seen = new Set<string>();
  for (const id of rankedIds) {
    const key = String(id);
    const hit = byId.get(key);
    if (!hit || seen.has(key)) continue;
    ordered.push(hit);
    seen.add(key);
  }
  for (const item of fullList) {
    const key = String(item?.id);
    if (!key || seen.has(key)) continue;
    ordered.push(item);
    seen.add(key);
  }
  return ordered;
}

export default function EstateDiscoveryMode({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <EstateDiscoveryModeInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function EstateDiscoveryModeInner({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s: any) => s.token);
  const userId = useAuthStore((s: any) => s.user?.id);
  const discoverySession = useDiscoveryStore((s) => s.session);
  const setDiscoverySession = useDiscoveryStore((s) => s.setSession);
  const hydrateDiscoveryStore = useDiscoveryStore((s) => s.hydrate);
  const persistDiscoveryStore = useDiscoveryStore((s) => s.persist);
  const mergeServerDiscoveryProfile = useDiscoveryStore((s) => s.mergeServerProfile);
  const foundationProfile = useDiscoveryStore((s) => s.profile);
  const { formatOffer } = useMoneyContext();
  const isTablet = width >= 768;
  const [deckSize, setDeckSize] = useState({ w: width, h: Math.max(420, height * 0.62) });

  // Pełny stage — karta prawie edge-to-edge (bez „uciętych” czarnych ramek).
  const cardMetrics = useMemo(() => {
    const hPad = isTablet ? Math.max(20, deckSize.w * 0.04) : 0;
    const vPad = isTablet ? 10 : 0;
    const availW = Math.max(280, deckSize.w - hPad * 2);
    const availH = Math.max(360, deckSize.h - vPad * 2);
    const fill = isTablet ? 0.96 : 1;
    let cardW = Math.round(availW * fill);
    let cardH = Math.round(availH * fill);
    if (isTablet) {
      const maxAspect = 0.86;
      if (cardW / cardH > maxAspect) {
        cardW = Math.round(cardH * maxAspect);
      }
    }
    return {
      CARD_WIDTH: cardW,
      CARD_HEIGHT: cardH,
      SWIPE_THRESHOLD_X: cardW * 0.28,
      SWIPE_THRESHOLD_Y: -cardH * 0.18,
    };
  }, [deckSize.h, deckSize.w, isTablet]);
  const { CARD_WIDTH, CARD_HEIGHT, SWIPE_THRESHOLD_X, SWIPE_THRESHOLD_Y } = cardMetrics;

  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const position = useRef(new Animated.ValueXY()).current;
  /** Tylko gaszenie przy wylocie — NIGDY nie ustawiaj z powrotem na 1, póki w slocie jest jeszcze stara oferta. */
  const topCardOpacity = useRef(new Animated.Value(1)).current;
  const pendingRevealRef = useRef(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const activePhotoIndexRef = useRef(0);
  activePhotoIndexRef.current = activePhotoIndex;
  const topOfferId = offers[0]?.id;
  const topOfferRef = useRef<DiscoveryOffer | null>(null);
  const offersRef = useRef<DiscoveryOffer[]>([]);
  const swipingRef = useRef(false);
  const pendingResetRef = useRef(false);
  const cardShownAtRef = useRef(Date.now());
  const trackedOfferRef = useRef<string | null>(null);
  const saveAffirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceSwipeRef = useRef<((
    direction: 'right' | 'left' | 'up',
    velocity?: { vx?: number; vy?: number },
  ) => void) | null>(null);
  const sendDiscoveryEventRef = useRef<((eventType: DiscoveryEventType, offer: DiscoveryOffer, extra?: {
    reasonCode?: DiscoveryDislikeReasonCode;
    photoIndex?: number;
    score?: number;
    dwellMs?: number;
    decisionLatencyMs?: number;
    correctionTarget?: string;
  }) => Promise<void>) | null>(null);
  const [profile, setProfile] = useState<DiscoveryProfile>({
    likedLocations: {},
    dislikedLocations: {},
    medianLikedPrice: null,
    medianLikedArea: null,
    interactions: 0,
  });
  const [pendingDislikeOffer, setPendingDislikeOffer] = useState<DiscoveryOffer | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [priceSeriesByOffer, setPriceSeriesByOffer] = useState<Record<string, number[]>>({});
  const [saveOffer, setSaveOffer] = useState<DiscoveryOffer | null>(null);
  const [priorityOffer, setPriorityOffer] = useState<DiscoveryOffer | null>(null);
  const [insightVisible, setInsightVisible] = useState(false);
  const [pauseVisible, setPauseVisible] = useState(false);
  const [careDismissed, setCareDismissed] = useState(false);
  const [undoOffer, setUndoOffer] = useState<DiscoveryOffer | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dislikeCountRef = useRef(0);

  const mapRawOffersToDiscovery = useCallback((list: any[]): DiscoveryOffer[] => {
    return list
      .map((raw: any): DiscoveryOffer | null => {
        const listing = resolveOfferListingPrice(raw);
        if (listing.amount <= 0) return null;
        const drop = resolveDiscoveryPriceDrop(raw, listing.plnAmount);
        const city = String(raw?.city ?? '').trim();
        const district = String(raw?.district ?? '').trim();
        const title = String(raw?.title ?? raw?.name ?? '').trim() || 'Oferta premium';
        const areaValue = parsePriceNumber(raw?.area);
        const createdAtMs = raw?.createdAt ? new Date(raw.createdAt).getTime() : Date.now();
        const daysOnMarket = Math.max(1, Math.round((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
        const location = [district, city].filter(Boolean).join(', ') || 'Polska';
        const extractedImages = extractImagesFromOffer(raw);
        // galleryPlan zwraca ścieżki względne (`/uploads/...`) — bez API_URL Image jest czarny.
        const plannedImages = Array.isArray(raw?.galleryPlan?.orderedAssets)
          ? raw.galleryPlan.orderedAssets
              .map((image: unknown) => (typeof image === 'string' ? normalizeMediaUrl(image) : null))
              .filter((url: string | null): url is string => Boolean(url))
          : [];
        const images = plannedImages.length > 0 ? plannedImages : extractedImages;
        const scoreRaw = raw?.score ?? raw?.matchScore;
        const scoreNum = scoreRaw == null ? null : Number(scoreRaw);
        const originalPrice = drop.hasDrop
          ? formatOffer({
              ...raw,
              priceAmount: drop.listPricePln,
              price: drop.listPricePln,
              pricePln: drop.listPricePln,
              priceCurrency: 'PLN',
            }).primary
          : null;
        return {
          id: String(raw?.id ?? `${title}-${city}-${Math.random()}`),
          title,
          location,
          price: formatOffer(raw).primary,
          originalPrice,
          hasPriceDrop: drop.hasDrop,
          discountPercent: drop.discountPercent,
          area: `${Math.max(0, Math.round(areaValue || 0))} m²`,
          daysOnMarket,
          priceHistory: drop.hasDrop
            ? buildPriceHistory(listing.plnAmount, drop.listPricePln)
            : [],
          images,
          image: images[0] || extractImageFromOffer(raw),
          matchScore:
            typeof scoreNum === 'number' && Number.isFinite(scoreNum)
              ? Math.max(0, Math.min(100, Math.round(scoreNum)))
              : null,
          matchReason: raw?.reason == null ? null : String(raw.reason),
          galleryPlan: raw?.galleryPlan
            ? { ...raw.galleryPlan, orderedAssets: images }
            : null,
        };
      })
      .filter(Boolean) as DiscoveryOffer[];
  }, [formatOffer]);

  const sendDiscoveryEvent = useCallback(
    async (
      eventType: DiscoveryEventType,
      offer: DiscoveryOffer,
      extra?: {
        reasonCode?: DiscoveryDislikeReasonCode;
        photoIndex?: number;
        score?: number;
        dwellMs?: number;
        decisionLatencyMs?: number;
        correctionTarget?: string;
      }
    ) => {
      await trackDiscoveryEvent({
        token,
        eventType,
        offerId: Number(offer.id),
        sessionId: discoverySession?.id,
        photoIndex: extra?.photoIndex ?? activePhotoIndex,
        score: extra?.score ?? null,
        reasonCode: extra?.reasonCode || null,
        dwellMs: extra?.dwellMs ?? null,
        decisionLatencyMs: extra?.decisionLatencyMs ?? null,
        correctionTarget: extra?.correctionTarget ?? null,
      });
    },
    [activePhotoIndex, discoverySession?.id, token]
  );

  const flushDiscoveryQueue = useCallback(
    async () => flushDiscoveryEventQueue(token),
    [token],
  );

  useEffect(() => {
    sendDiscoveryEventRef.current = sendDiscoveryEvent;
  }, [sendDiscoveryEvent]);

  useEffect(() => {
    offersRef.current = offers;
    topOfferRef.current = offers[0] || null;
  }, [offers]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (saveAffirmTimerRef.current) clearTimeout(saveAffirmTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void hydrateDiscoveryStore(userId);
    void getOrCreateDiscoverySession().then((session) => {
      if (!mounted) return;
      setDiscoverySession(session);
      void trackDiscoveryEvent({
        token,
        eventType: 'DISCOVERY_OPEN_SESSION',
        sessionId: session.id,
      });
    });
    return () => {
      mounted = false;
    };
  }, [hydrateDiscoveryStore, setDiscoverySession, token, userId]);

  useEffect(() => {
    void persistDiscoveryStore(userId);
  }, [persistDiscoveryStore, profile, userId]);

  useEffect(() => {
    return () => {
      if (!discoverySession?.id) return;
      void trackDiscoveryEvent({
        token,
        eventType: 'DISCOVERY_PAUSE',
        sessionId: discoverySession.id,
      });
    };
  }, [discoverySession?.id, token]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchOffers = async () => {
      setLoadingFeed(true);
      setFeedError(false);
      try {
        await flushDiscoveryQueue();
        const feedJson = await fetchDiscoveryFeed(token, discoverySession?.id);
        const feedList = feedJson.items;
        const rankedIds = feedList.map((item) => item.id);

        // Prefer full payloads from personalized feed (now includes price/images).
        let mapped = mapRawOffersToDiscovery(feedList.filter((o: any) => !isOfferClosed(o)));

        // If feed was slim or incomplete, hydrate from catalog and keep ranking order.
        if (mapped.length < Math.min(8, rankedIds.length || 8)) {
          const res = await fetch(`${API_URL}/api/mobile/v1/offers`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const json = await res.json().catch(() => ({}));
          let list = extractOffersArray(json);
          if (!res.ok || !list) {
            const webRes = await fetch(`${API_URL}/api/offers`);
            if (webRes.ok) {
              const webJson = await webRes.json().catch(() => null);
              list = extractOffersArray(webJson);
            }
          }
          if (Array.isArray(list)) {
            const ordered = orderByRankedIds(
              list.filter((o: any) => !isOfferClosed(o)),
              rankedIds,
            );
            const hydrated = mapRawOffersToDiscovery(ordered);
            if (hydrated.length > mapped.length) {
              // Preserve server matchScore/reason when available.
              const scoreById = new Map(
                feedList.map((item) => [String(item.id), { score: item.score, reason: item.reason }]),
              );
              mapped = hydrated.map((offer) => {
                const meta = scoreById.get(String(offer.id));
                if (!meta) return offer;
                return {
                  ...offer,
                  matchScore: meta.score ?? offer.matchScore,
                  matchReason: meta.reason ?? offer.matchReason,
                };
              });
            }
          }
        }

        if (feedJson.profile) {
          mergeServerDiscoveryProfile(feedJson.profile);
          setProfile((prev) => ({
            ...prev,
            medianLikedPrice:
              prev.medianLikedPrice == null && Number(feedJson.profile?.preferredBudgetPln) > 0
                ? Math.round(Number(feedJson.profile?.preferredBudgetPln))
                : prev.medianLikedPrice,
            medianLikedArea:
              prev.medianLikedArea == null && Number(feedJson.profile?.preferredAreaM2) > 0
                ? Math.round(Number(feedJson.profile?.preferredAreaM2))
                : prev.medianLikedArea,
          }));
        }

        if (mounted) setOffers(mapped);
      } catch {
        if (mounted) {
          setOffers([]);
          setFeedError(true);
        }
      } finally {
        if (mounted) setLoadingFeed(false);
      }
    };
    void fetchOffers();
    return () => {
      mounted = false;
    };
  }, [discoverySession?.id, feedRefreshKey, flushDiscoveryQueue, mapRawOffersToDiscovery, mergeServerDiscoveryProfile, token]);

  useEffect(() => {
    setActivePhotoIndex(0);
    cardShownAtRef.current = Date.now();
    const top = topOfferRef.current;
    if (top && trackedOfferRef.current !== top.id) {
      trackedOfferRef.current = top.id;
      void sendDiscoveryEventRef.current?.('DISCOVERY_VIEW_CARD', top);
    }
    if (pendingResetRef.current) {
      pendingResetRef.current = false;
    }
  }, [topOfferId]);

  /**
   * Reveal nowej karty DOPIERO gdy topOfferId się zmienił (stara treść już nie jest w slocie).
   * Wcześniejsze `opacity.setValue(1)` przy starej ofercie = duch na środku.
   */
  useLayoutEffect(() => {
    if (!pendingRevealRef.current) return;
    pendingRevealRef.current = false;
    position.setValue({ x: 0, y: 0 });
    topCardOpacity.setValue(1);
    swipingRef.current = false;
  }, [topOfferId, position, topCardOpacity]);

  useEffect(() => {
    const top = offers[0];
    if (!top?.images?.length) return;
    const current = top.images[activePhotoIndex];
    const next = top.images[(activePhotoIndex + 1) % top.images.length];
    const prev = top.images[(activePhotoIndex - 1 + top.images.length) % top.images.length];
    const preload = [current, next, prev].filter(Boolean);
    if (preload.length === 0) return;
    void Image.prefetch(preload);
  }, [offers, activePhotoIndex]);

  const resetPosition = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 7,
      tension: 68,
      useNativeDriver: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start(() => {
      swipingRef.current = false;
    });
  }, [position]);

  const armUndo = useCallback((offer: DiscoveryOffer) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoOffer(offer);
    undoTimerRef.current = setTimeout(() => {
      setUndoOffer(null);
    }, 7000);
  }, []);

  const showSaveAffirmationBriefly = useCallback((offer: DiscoveryOffer) => {
    if (saveAffirmTimerRef.current) clearTimeout(saveAffirmTimerRef.current);
    setSaveOffer(offer);
    saveAffirmTimerRef.current = setTimeout(() => {
      setSaveOffer(null);
    }, 2200);
  }, []);

  const commitDecision = useCallback((direction: 'right' | 'left' | 'up', top: DiscoveryOffer) => {
    const price = parsePriceNumber(top.price);
    const area = parsePriceNumber(top.area);
    const locationKey = top.location.split(',')[0]?.trim().toLowerCase() || top.location.toLowerCase();
    setProfile((prev) => {
      const next: DiscoveryProfile = {
        likedLocations: { ...prev.likedLocations },
        dislikedLocations: { ...prev.dislikedLocations },
        medianLikedPrice: prev.medianLikedPrice,
        medianLikedArea: prev.medianLikedArea,
        interactions: prev.interactions + 1,
      };
      if (direction === 'right' || direction === 'up') {
        next.likedLocations[locationKey] = (next.likedLocations[locationKey] || 0) + 1;
        next.medianLikedPrice =
          next.medianLikedPrice == null ? price : Math.round((next.medianLikedPrice * 0.72) + (price * 0.28));
        next.medianLikedArea =
          next.medianLikedArea == null ? area : Math.round((next.medianLikedArea * 0.72) + (area * 0.28));
      } else if (direction === 'left') {
        next.dislikedLocations[locationKey] = (next.dislikedLocations[locationKey] || 0) + 1;
      }
      return next;
    });
    if (direction === 'left') {
      dislikeCountRef.current += 1;
      if (shouldAskDiscoveryDislikeReason(dislikeCountRef.current)) setPendingDislikeOffer(top);
    } else {
      setPendingDislikeOffer(null);
    }
    void sendDiscoveryEventRef.current?.(
      direction === 'right'
        ? 'DISCOVERY_LIKE'
        : direction === 'left'
          ? 'DISCOVERY_DISLIKE'
          : 'DISCOVERY_PRIORITY',
      top,
      { decisionLatencyMs: Date.now() - cardShownAtRef.current },
    );

    if (direction === 'right') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (direction === 'left') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    pendingResetRef.current = true;
    setOffers((prev) => prev.slice(1));
    setActivePhotoIndex(0);
    armUndo(top);
    if (direction === 'right') showSaveAffirmationBriefly(top);
  }, [armUndo, showSaveAffirmationBriefly]);

  const onSwipeComplete = useCallback((direction: 'right' | 'left' | 'up') => {
    const top = offersRef.current[0];
    if (!top) {
      position.setValue({ x: 0, y: 0 });
      topCardOpacity.setValue(1);
      swipingRef.current = false;
      return;
    }
    if (direction === 'up') {
      position.setValue({ x: 0, y: 0 });
      topCardOpacity.setValue(1);
      swipingRef.current = false;
      setPriorityOffer(top);
      return;
    }

    // 1) Zgaś slot (native). 2) Podmień ofertę. 3) Reveal dopiero w useLayoutEffect po nowym topOfferId.
    Animated.timing(topCardOpacity, {
      toValue: 0,
      duration: 16,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        topCardOpacity.setValue(1);
        position.setValue({ x: 0, y: 0 });
        swipingRef.current = false;
        return;
      }
      pendingRevealRef.current = true;
      // Position zostaje OFF-SCREEN aż do layout effect — przy opacity 0 i tak niewidoczne,
      // ale NIE przywracamy opacity=1 przy starej ofercie (to był duch).
      commitDecision(direction, top);
    });
  }, [commitDecision, position, topCardOpacity]);

  // === ANIMACJE KARTY ===
  const forceSwipe = useCallback((
    direction: 'right' | 'left' | 'up',
    velocity?: { vx?: number; vy?: number },
  ) => {
    if (swipingRef.current) return;
    if (!offersRef.current[0]) return;
    swipingRef.current = true;

    let toX = 0;
    let toY = 0;
    if (direction === 'right') toX = width + CARD_WIDTH + 120;
    if (direction === 'left') toX = -(width + CARD_WIDTH + 120);
    if (direction === 'up') toY = -(height + CARD_HEIGHT + 120);

    const speed = direction === 'up' ? Math.abs(velocity?.vy ?? 0) : Math.abs(velocity?.vx ?? 0);
    const duration = speed > 1.2 ? 190 : speed > 0.7 ? 230 : 280;

    Animated.timing(position, {
      toValue: { x: toX, y: toY },
      duration,
      easing: DISCOVERY_EASE_OUT,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        position.setValue({ x: 0, y: 0 });
        topCardOpacity.setValue(1);
        swipingRef.current = false;
        return;
      }
      onSwipeComplete(direction);
    });
  }, [CARD_HEIGHT, CARD_WIDTH, height, onSwipeComplete, position, topCardOpacity, width]);

  forceSwipeRef.current = forceSwipe;

  const layoutRef = useRef({ width, height });
  layoutRef.current = { width, height };
  const resetPositionRef = useRef(resetPosition);
  resetPositionRef.current = resetPosition;

  // PanResponder raz — zawsze przez refy (bez stale closure na offers).
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (swipingRef.current) return false;
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 8;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (swipingRef.current) return false;
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = gestureState.dy > 0 ? gestureState.dy * 0.22 : gestureState.dy;
        position.setValue({ x: gestureState.dx, y: newY });
      },
      onPanResponderRelease: (_, gestureState) => {
        const { width: w, height: h } = layoutRef.current;
        const thresholdX = w * 0.22;
        const thresholdY = -h * 0.16;
        const { dx, dy, vx, vy } = gestureState;
        const flungRight = dx > thresholdX || (vx > 1.05 && dx > 36);
        const flungLeft = dx < -thresholdX || (vx < -1.05 && dx < -36);
        const flungUp = dy < thresholdY && Math.abs(dx) < thresholdX * 1.15;
        if (flungUp) {
          forceSwipeRef.current?.('up', { vx, vy });
        } else if (flungRight) {
          forceSwipeRef.current?.('right', { vx, vy });
        } else if (flungLeft) {
          forceSwipeRef.current?.('left', { vx, vy });
        } else {
          resetPositionRef.current?.();
        }
      },
      onPanResponderTerminate: () => {
        resetPositionRef.current?.();
      },
    }),
  ).current;

  const undoLastDecision = useCallback(() => {
    if (!undoOffer) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    pendingResetRef.current = true;
    pendingRevealRef.current = false;
    position.setValue({ x: 0, y: 0 });
    topCardOpacity.setValue(1);
    swipingRef.current = false;
    setOffers((prev) => [undoOffer, ...prev]);
    setActivePhotoIndex(0);
    void sendDiscoveryEvent('DISCOVERY_UNDO', undoOffer);
    setUndoOffer(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [position, sendDiscoveryEvent, topCardOpacity, undoOffer]);

  function confirmPriority(mode: 'priority' | 'save') {
    const offer = priorityOffer;
    if (!offer) return;
    setPriorityOffer(null);
    if (mode === 'priority') {
      void mutateDiscoveryTrope(token, { offerId: Number(offer.id), action: 'PRIORITIZE' });
      commitDecision('up', offer);
    } else {
      void sendDiscoveryEvent('DISCOVERY_SAVE', offer);
      void mutateDiscoveryTrope(token, { offerId: Number(offer.id), action: 'SAVE' });
      setSaveOffer(offer);
    }
  }

  const handleTopCardImageTap = useCallback((zone: 'left' | 'right') => {
    const top = offers[0];
    if (!top) return;
    const total = Math.max(1, top.images?.length ?? 1);
    if (total <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePhotoIndex((prev) => {
      const nextIndex = zone === 'left' ? (prev - 1 + total) % total : (prev + 1) % total;
      void sendDiscoveryEvent('DISCOVERY_PHOTO_VIEW', top, { photoIndex: nextIndex });
      return nextIndex;
    });
  }, [offers, sendDiscoveryEvent]);

  const openTopGallery = useCallback(() => {
    const top = offers[0];
    if (!top) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void sendDiscoveryEvent('DISCOVERY_PHOTO_VIEW', top, { photoIndex: activePhotoIndex });
    setGalleryVisible(true);
  }, [activePhotoIndex, offers, sendDiscoveryEvent]);

  useEffect(() => {
    const top = offers[0];
    if (!top?.hasPriceDrop) return;
    const offerId = Number(top.id);
    if (!Number.isFinite(offerId) || offerId <= 0) return;
    let cancelled = false;
    void fetchOfferPriceHistory(offerId, token).then((remote) => {
      if (cancelled || !remote || remote.length < 2) return;
      const series = buildChartSeriesFromHistory(remote);
      if (series.length < 2) return;
      setPriceSeriesByOffer((prev) =>
        prev[top.id]?.length >= 2 ? prev : { ...prev, [top.id]: series },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [offers, token]);

  const topOfferInsight = useMemo(() => {
    const top = offers[0];
    if (!top) return { score: 50, reason: 'Budujemy Twój profil preferencji' };
    if (top.matchScore != null && top.matchReason) {
      return { score: top.matchScore, reason: top.matchReason };
    }
    const locationKey = top.location.split(',')[0]?.trim().toLowerCase() || top.location.toLowerCase();
    const price = parsePriceNumber(top.price);
    const area = parsePriceNumber(top.area);
    let score = top.matchScore ?? 50;
    const reasons: string[] = [];

    const likedLoc = profile.likedLocations[locationKey] || 0;
    const dislikedLoc = profile.dislikedLocations[locationKey] || 0;
    if (likedLoc > 0) {
      score += Math.min(18, likedLoc * 5);
      reasons.push('lokalizacja zgodna z Twoimi wyborami');
    }
    if (dislikedLoc > 0) {
      score -= Math.min(20, dislikedLoc * 6);
      reasons.push('lokalizacja rzadziej wybierana');
    }

    if (profile.medianLikedPrice && price > 0) {
      const diff = Math.abs(price - profile.medianLikedPrice) / profile.medianLikedPrice;
      if (diff <= 0.2) {
        score += 12;
        reasons.push('cena bliska preferowanemu zakresowi');
      } else if (diff > 0.45) {
        score -= 10;
      }
    }

    if (profile.medianLikedArea && area > 0) {
      const diffA = Math.abs(area - profile.medianLikedArea) / Math.max(1, profile.medianLikedArea);
      if (diffA <= 0.25) {
        score += 10;
        reasons.push('metraż dopasowany do Twojego profilu');
      }
    }

    score = Math.max(35, Math.min(98, Math.round(score)));
    return {
      score,
      reason: reasons[0] || top.matchReason || 'algorytm testuje nowe warianty pod Twój gust',
    };
  }, [offers, profile]);

  const profileHint = useMemo(() => {
    if (profile.interactions <= 0) return 'Przesuń kartę — uczymy się Twojego gustu';
    const topCity = Object.entries(profile.likedLocations).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topCity) {
      const pretty = topCity.charAt(0).toUpperCase() + topCity.slice(1);
      return `Kierunek: ${pretty}`;
    }
    if (profile.medianLikedPrice) {
      const short = new Intl.NumberFormat('pl-PL', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(profile.medianLikedPrice);
      return `Budżet ~${short} zł`;
    }
    return 'Profil się uczy';
  }, [profile]);

  const islandState = useMemo<DiscoveryIslandState>(() => {
    if (undoOffer) return { kind: 'undo', onUndo: undoLastDecision };
    if (saveOffer) return { kind: 'saved' };
    if (offers[0]) {
      return {
        kind: 'insight',
        onOpen: () => {
          const offer = offers[0];
          if (offer) void sendDiscoveryEvent('DISCOVERY_INSIGHT_OPEN', offer);
          setInsightVisible(true);
        },
      };
    }
    return { kind: 'idle', hint: profileHint };
  }, [offers, profileHint, saveOffer, sendDiscoveryEvent, undoLastDecision, undoOffer]);

  // === INTERPOLACJE IKON NA ŚRODKU ===
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD_X],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const likeScale = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD_X],
    outputRange: [0.55, 1.35],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD_X, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nopeScale = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD_X, -20],
    outputRange: [1.35, 0.55],
    extrapolate: 'clamp',
  });

  const fastTrackOpacity = position.y.interpolate({
    inputRange: [SWIPE_THRESHOLD_Y, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const fastTrackScale = position.y.interpolate({
    inputRange: [SWIPE_THRESHOLD_Y, -20],
    outputRange: [1.35, 0.55],
    extrapolate: 'clamp',
  });

  const cardBox = {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    left: Math.max(0, (deckSize.w - CARD_WIDTH) / 2),
    top: Math.max(0, (deckSize.h - CARD_HEIGHT) / 2),
    borderRadius: isTablet ? 28 : 0,
    borderWidth: isTablet ? StyleSheet.hairlineWidth : 0,
  };

  const renderCardFace = (
    offer: DiscoveryOffer,
    opts: { photoIndex: number; showChrome: boolean },
  ) => {
    const photoCount = Math.max(1, offer.images?.length || 1);
    const chartSeries: number[] =
      (priceSeriesByOffer[offer.id]?.length ?? 0) >= 2
        ? priceSeriesByOffer[offer.id]!
        : offer.priceHistory;
    const chromeTop = Math.max(14, insets.top + 4);

    return (
    <>
      <View style={styles.cardImageTapLayer}>
        <Image
          source={{ uri: offer.images?.[opts.photoIndex] || offer.image }}
          style={styles.cardImage}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
        />
        {opts.showChrome ? (
          <Pressable
            style={styles.cardOpenTap}
            onPress={openTopGallery}
            accessibilityRole="button"
            accessibilityLabel="Otwórz galerię zdjęć"
          />
        ) : null}
      </View>
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.18, 0.55, 1]}
        style={styles.cardGradient}
      />
      {opts.showChrome ? (
        <View style={[styles.photoPagerOverlay, { top: chromeTop }]} pointerEvents="box-none">
          <View style={styles.photoPagerTopRow} pointerEvents="box-none">
            <View style={styles.photoPagerSpacer} />
            <View style={styles.photoCounterBadge}>
              <Text style={styles.photoCounterText}>
                {Math.min(opts.photoIndex + 1, photoCount)}/{photoCount}
              </Text>
            </View>
          </View>
          <View style={styles.photoDotsRow}>
            {(offer.images || [offer.image]).slice(0, 8).map((img, idx) => {
              const active = idx === opts.photoIndex;
              return <View key={`${offer.id}-dot-${idx}-${img}`} style={[styles.photoDot, active && styles.photoDotActive]} />;
            })}
          </View>
        </View>
      ) : null}
      {opts.showChrome && photoCount > 1 ? (
        <>
          <Pressable
            onPress={() => handleTopCardImageTap('left')}
            style={[styles.photoArrowBtn, styles.photoArrowLeft]}
            accessibilityRole="button"
            accessibilityLabel="Poprzednie zdjęcie"
            hitSlop={10}
          >
            <BlurView intensity={40} tint="dark" style={styles.photoArrowGlass}>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
            </BlurView>
          </Pressable>
          <Pressable
            onPress={() => handleTopCardImageTap('right')}
            style={[styles.photoArrowBtn, styles.photoArrowRight]}
            accessibilityRole="button"
            accessibilityLabel="Następne zdjęcie"
            hitSlop={10}
          >
            <BlurView intensity={40} tint="dark" style={styles.photoArrowGlass}>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </BlurView>
          </Pressable>
        </>
      ) : null}
      <View style={styles.offerInfoWrap} pointerEvents="box-none">
        <Pressable onPress={opts.showChrome ? openTopGallery : undefined} disabled={!opts.showChrome}>
          <View style={styles.locationRow}>
            <MapPin size={13} color={RR_GOLD} />
            <Text style={styles.offerLocation}>{offer.location}</Text>
          </View>
          <Text style={styles.offerTitle} numberOfLines={2}>
            {offer.title}
          </Text>
          <View style={styles.specsRow}>
            <View style={styles.priceStack}>
              {offer.hasPriceDrop && offer.originalPrice ? (
                <Text style={styles.offerPriceWas}>{offer.originalPrice}</Text>
              ) : null}
              <Text style={styles.offerPrice}>{offer.price}</Text>
            </View>
            {offer.hasPriceDrop && offer.discountPercent > 0 ? (
              <View style={styles.discountPill}>
                <Text style={styles.discountPillText}>−{offer.discountPercent}%</Text>
              </View>
            ) : null}
            <View style={styles.specDivider} />
            <Maximize size={13} color="rgba(235,235,245,0.55)" style={{ marginRight: 5 }} />
            <Text style={styles.offerArea}>{offer.area}</Text>
          </View>
        </Pressable>
        <BlurView intensity={38} tint="dark" style={styles.miniDashboard}>
          <View style={styles.dashHeaderRow}>
            <View>
              <Text style={styles.dashLabel}>NA RYNKU</Text>
              <Text style={styles.dashValue}>
                {offer.daysOnMarket === 1 ? '1 dzień' : `${offer.daysOnMarket} dni`}
              </Text>
            </View>
            {offer.hasPriceDrop && offer.originalPrice ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dashLabel}>BYŁO</Text>
                <Text style={styles.dashValueMuted}>{offer.originalPrice}</Text>
              </View>
            ) : null}
          </View>
          {offer.hasPriceDrop && chartSeries.length >= 2 ? (
            <View style={styles.priceChartWrap}>
              <OfferPriceHistoryChart
                data={chartSeries}
                width={CARD_WIDTH - 56}
                height={48}
                gradientId={`discovery-price-${offer.id}`}
              />
            </View>
          ) : null}
          {opts.showChrome ? (
            <Pressable
              onPress={() => {
                void sendDiscoveryEvent('DISCOVERY_INSIGHT_OPEN', offer, {
                  score: topOfferInsight.score,
                });
                setInsightVisible(true);
              }}
              style={styles.intelligenceRow}
              accessibilityRole="button"
              accessibilityLabel="Dlaczego ta oferta"
            >
              <View style={styles.intelligenceIcon}>
                <Ionicons name="sparkles" size={13} color={RR_GOLD} />
              </View>
              <View style={styles.intelligenceCopy}>
                <Text style={styles.intelligenceLabel}>Intelligence</Text>
                <Text style={styles.intelligenceReason} numberOfLines={2}>
                  {offer.matchReason || topOfferInsight.reason}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.45)" />
            </Pressable>
          ) : null}
        </BlurView>
      </View>
    </>
    );
  };

  // === RENDEROWANIE KART ===
  const renderCards = () => {
    if (loadingFeed) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Dobieramy oferty</Text>
          <Text style={styles.emptySub}>Uczymy się Twojego gustu…</Text>
        </View>
      );
    }
    if (feedError) {
      return (
        <DiscoveryErrorRecovery
          onRetry={() => setFeedRefreshKey((key) => key + 1)}
          onExit={() => navigation?.goBack?.()}
        />
      );
    }
    if (offers.length === 0) {
      return (
        <DiscoveryEndDeck
          onWiden={() => setFeedRefreshKey((key) => key + 1)}
          onChangeDirection={() => {
            navigation?.navigate?.('DiscoveryLifeShift');
          }}
          onTropes={() => navigation?.navigate?.('DiscoveryTropes')}
          onPause={() => setPauseVisible(true)}
        />
      );
    }

    const under = offers[1];
    const top = offers[0];
    return (
      <>
        {under ? (
          <View
            key="discovery-under-slot"
            style={[styles.cardContainer, cardBox, { zIndex: 1 }]}
            pointerEvents="none"
          >
            {renderCardFace(under, { photoIndex: 0, showChrome: false })}
          </View>
        ) : null}

        {top ? (
          <Animated.View
            key="discovery-top-slot"
            style={[
              styles.cardContainer,
              cardBox,
              {
                zIndex: 10,
                opacity: topCardOpacity,
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {renderCardFace(top, { photoIndex: activePhotoIndex, showChrome: true })}
            <View style={styles.centerIconOverlay} pointerEvents="none">
              <Animated.View style={[styles.centerIconWrap, { opacity: likeOpacity, transform: [{ scale: likeScale }] }]}>
                <Ionicons name="heart" size={100} color={RR_GREEN} style={styles.iconShadow} />
              </Animated.View>
              <Animated.View style={[styles.centerIconWrap, { opacity: nopeOpacity, transform: [{ scale: nopeScale }] }]}>
                <Ionicons name="sad" size={100} color={RR_RED} style={styles.iconShadow} />
              </Animated.View>
              <Animated.View style={[styles.centerIconWrap, { opacity: fastTrackOpacity, transform: [{ scale: fastTrackScale }] }]}>
                <Ionicons name="flash" size={110} color={RR_GOLD} style={styles.iconShadow} />
              </Animated.View>
            </View>
          </Animated.View>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {offers[0] ? (
        <View style={styles.ambientLayer} pointerEvents="none">
          <Image
            source={{ uri: offers[0].images?.[activePhotoIndex] || offers[0].image }}
            style={styles.ambientImage}
            contentFit="cover"
            blurRadius={48}
            transition={200}
          />
          <View style={styles.ambientScrim} />
        </View>
      ) : null}

      <DiscoverySessionIsland state={islandState} onBack={() => setPauseVisible(true)} />

      <View
        style={styles.cardsWrapper}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w < 40 || h < 40) return;
          setDeckSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }}
      >
        {renderCards()}
      </View>

      {offers.length > 0 && (
        <View
          style={[
            styles.actionButtonsRow,
            isTablet && styles.actionButtonsRowTablet,
            { paddingBottom: Math.max(18, insets.bottom + 10) },
          ]}
        >
          <DiscoveryGlassOrb onPress={() => forceSwipe('left')} accessibilityLabel="Pomiń ofertę">
            <X size={28} color="#D0D0D4" />
          </DiscoveryGlassOrb>
          <DiscoveryGlassOrb onPress={() => forceSwipe('up')} accessibilityLabel="Nadaj priorytet ofercie" size={66} tint="rgba(212,175,55,0.16)">
            <Zap size={32} color={RR_GOLD} />
          </DiscoveryGlassOrb>
          <DiscoveryGlassOrb onPress={() => forceSwipe('right')} accessibilityLabel="Wybierz ofertę">
            <Heart size={28} color={RR_GREEN} />
          </DiscoveryGlassOrb>
        </View>
      )}
      <DiscoverySmartGallery
        visible={galleryVisible}
        images={offers[0]?.images || []}
        index={activePhotoIndex}
        onChangeIndex={(index) => {
          setActivePhotoIndex(index);
          const offer = offers[0];
          if (offer) void sendDiscoveryEvent('DISCOVERY_PHOTO_VIEW', offer, { photoIndex: index });
        }}
        onClose={(dwellMs) => {
          const offer = offers[0];
          if (offer) void sendDiscoveryEvent('DISCOVERY_PHOTO_VIEW', offer, { dwellMs, photoIndex: activePhotoIndex });
          setGalleryVisible(false);
        }}
        onOpenDetail={() => {
          const offer = offers[0];
          if (!offer) return;
          setGalleryVisible(false);
          void sendDiscoveryEvent('DISCOVERY_DEPTH_OPEN', offer, { score: topOfferInsight.score });
          navigation?.navigate?.('OfferDetail', { offerId: Number(offer.id) || offer.id });
        }}
      />
      <DiscoveryDislikeReasonSheet
        visible={!!pendingDislikeOffer}
        reasons={DISCOVERY_DISLIKE_REASONS as readonly DislikeReason[]}
        onChoose={(reason) => {
          if (pendingDislikeOffer) void sendDiscoveryEvent('DISCOVERY_DISLIKE', pendingDislikeOffer, { reasonCode: reason.key });
          setPendingDislikeOffer(null);
        }}
        onSkip={() => setPendingDislikeOffer(null)}
      />
      <DiscoveryPrioritySheet
        visible={!!priorityOffer}
        onConfirm={() => confirmPriority('priority')}
        onSaveContinue={() => confirmPriority('save')}
        onCancel={() => setPriorityOffer(null)}
      />
      <DiscoveryInsightBubble
        visible={insightVisible}
        reason={topOfferInsight.reason}
        onClose={() => setInsightVisible(false)}
        onReject={() => {
          const offer = offers[0];
          if (offer) {
            void sendDiscoveryEvent('DISCOVERY_CORRECTION', offer, {
              score: topOfferInsight.score,
              correctionTarget: `city:${offer.location.split(',').pop()?.trim() || 'unknown'}`,
            });
          }
          setInsightVisible(false);
          setFeedRefreshKey((key) => key + 1);
        }}
      />
      <DiscoveryPauseSheet
        visible={pauseVisible}
        onPause={() => {
          const offer = offers[0];
          if (offer) void sendDiscoveryEvent('DISCOVERY_PAUSE', offer);
          setPauseVisible(false);
          navigation?.replace?.('DiscoveryResume');
        }}
        onResume={() => setPauseVisible(false)}
      />
      <DiscoveryContradictionCareSheet
        visible={Boolean(
          !careDismissed
          && (foundationProfile?.contradictionIndex || 0) >= 0.72
          && (foundationProfile?.interactions || 0) >= 12,
        )}
        onSlow={() => setCareDismissed(true)}
        onShift={() => {
          setCareDismissed(true);
          navigation?.navigate?.('DiscoveryLifeShift');
        }}
        onPause={() => {
          setCareDismissed(true);
          setPauseVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RR_BLACK,
  },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  ambientImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
  },
  ambientScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 60 : 40,
    zIndex: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: RR_GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 2,
  },
  headerProfileHint: {
    color: 'rgba(244,232,204,0.72)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  cardsWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyTitle: {
    color: RR_IVORY,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySub: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // === KARTA ===
  cardContainer: {
    position: 'absolute',
    borderRadius: 28,
    backgroundColor: '#0A0A0B',
    overflow: 'hidden',
    opacity: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0A0A0B',
  },
  cardImageTapLayer: {
    width: '100%',
    height: '100%',
  },
  cardOpenTap: {
    ...StyleSheet.absoluteFillObject,
  },
  photoPagerOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
  },
  photoPagerTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  photoPagerSpacer: {
    flex: 1,
  },
  photoCounterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  photoCounterText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  photoDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  photoDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  photoDotActive: {
    width: 14,
    borderRadius: 3,
    backgroundColor: RR_GOLD,
  },
  photoArrowBtn: {
    position: 'absolute',
    top: '38%',
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 20,
  },
  photoArrowLeft: {
    left: 10,
  },
  photoArrowRight: {
    right: 10,
  },
  photoArrowGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '65%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  
  // === CENTRALNE IKONY (EMOTIKONY) ===
  centerIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 20,
  },

  // === INFO O OFERCIE ===
  offerInfoWrap: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  offerLocation: {
    color: RR_GOLD,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 5,
  },
  offerTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 10,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  priceStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  offerPriceWas: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginBottom: 1,
  },
  offerPrice: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  discountPill: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(48,209,88,0.18)',
  },
  discountPillText: {
    color: RR_GREEN,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  specDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 12,
  },
  offerArea: {
    color: 'rgba(235,235,245,0.78)',
    fontSize: 16,
    fontWeight: '600',
  },

  // === MINIPANEL ===
  miniDashboard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  priceChartWrap: {
    marginTop: 8,
    marginBottom: 2,
  },
  intelligenceRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  intelligenceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,162,39,0.16)',
  },
  intelligenceCopy: {
    flex: 1,
  },
  intelligenceLabel: {
    color: RR_GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  intelligenceReason: {
    color: 'rgba(245,240,230,0.92)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  dashHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dashLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  dashValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dashValueMuted: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },

  // === PRZYCISKI AKCJI ===
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 40,
    marginTop: 10,
  },
  actionButtonsRowTablet: {
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    paddingHorizontal: 72,
    marginTop: 6,
  },
  dislikeReasonWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 126 : 112,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dislikeReasonGlass: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dislikeReasonTitle: {
    color: '#E5E5EA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  dislikeReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dislikeReasonChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dislikeReasonChipText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionBtnBlur: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  actionBtnFastTrack: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  btnGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 40,
  },

  // === TOAST (Biały Piorun) ===
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    alignSelf: 'center',
    zIndex: 100,
  },
  toastBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    overflow: 'hidden',
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 10,
  }
});