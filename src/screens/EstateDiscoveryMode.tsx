import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { isOfferClosed } from '../utils/offerLifecycle';
import { useMoneyContext } from '../money/useMoneyContext';
import { resolveOfferListingPrice } from '../money/offerPrice';
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

// === LUKSUSOWA PALETA ===
const RR_BLACK = '#040405';
const RR_GOLD = '#D4AF37';
const RR_IVORY = '#F4E8CC';
const RR_GREEN = '#32D74B';
const RR_RED = '#FF3B30';

type DiscoveryOffer = {
  id: string;
  title: string;
  location: string;
  price: string;
  originalPrice: string;
  area: string;
  daysOnMarket: number;
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

const buildPriceHistory = (priceNow: number, previousMaybe: number): number[] => {
  const nowM = Math.max(0.001, priceNow / 1_000_000);
  const prevM = previousMaybe > 0 ? previousMaybe / 1_000_000 : nowM * 1.04;
  return [
    Number((prevM * 1.05).toFixed(2)),
    Number((prevM * 1.02).toFixed(2)),
    Number(prevM.toFixed(2)),
    Number(((prevM + nowM) / 2).toFixed(2)),
    Number(nowM.toFixed(2)),
  ];
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

// === KOMPONENT WYKRESU (APPLE STOCKS STYLE) ===
const PriceHistoryChart = ({ data, width }: { data: number[], width: number }) => {
  const chartHeight = 50;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Tworzenie ścieżki SVG
  const pathData = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = chartHeight - ((point - min) / range) * (chartHeight - 10) - 5;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Ścieżka tła (cieniowania)
  const areaPath = `${pathData} L ${width} ${chartHeight} L 0 ${chartHeight} Z`;

  // Kolor w zależności od trendu (spadek to okazja, więc zielony/złoty)
  const isDrop = data[0] > data[data.length - 1];
  const strokeColor = isDrop ? RR_GREEN : RR_GOLD;

  return (
    <View style={{ height: chartHeight, width, marginTop: 10 }}>
      <Svg width={width} height={chartHeight}>
        <Defs>
          <SvgGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={strokeColor} stopOpacity="0.4" />
            <Stop offset="1" stopColor={strokeColor} stopOpacity="0.0" />
          </SvgGradient>
        </Defs>
        <Path d={areaPath} fill="url(#chartGlow)" />
        <Path d={pathData} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

export default function EstateDiscoveryMode({ navigation }: any) {
  const { width, height } = useWindowDimensions();
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
  
  // Responsywne wyliczanie wielkości karty
  const CARD_WIDTH = isTablet ? Math.min(width * 0.75, 540) : width * 0.94;
  const CARD_HEIGHT = isTablet ? Math.min(height * 0.75, 780) : height * 0.72;
  const SWIPE_THRESHOLD_X = CARD_WIDTH * 0.28;
  const SWIPE_THRESHOLD_Y = -CARD_HEIGHT * 0.18;

  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const position = useRef(new Animated.ValueXY()).current;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const topOfferId = offers[0]?.id;
  const topOfferRef = useRef<DiscoveryOffer | null>(null);
  const offersRef = useRef<DiscoveryOffer[]>([]);
  const swipingRef = useRef(false);
  const pendingResetRef = useRef(false);
  const cardShownAtRef = useRef(Date.now());
  const trackedOfferRef = useRef<string | null>(null);
  const saveAffirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceSwipeRef = useRef<((direction: 'right' | 'left' | 'up') => void) | null>(null);
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
        const previousPrice = parsePriceNumber(
          raw?.listPricePln ?? raw?.originalPrice ?? raw?.previousPrice ?? raw?.priceStart,
        );
        const prevPln =
          previousPrice > 0 && (raw?.isDiscounted || previousPrice > listing.plnAmount)
            ? resolveOfferListingPrice({
                priceAmount: previousPrice,
                price: previousPrice,
                priceCurrency: listing.currency,
                pricePln: Number(raw?.listPricePln) > 0 ? Number(raw?.listPricePln) : undefined,
              }).plnAmount
            : listing.plnAmount;
        const city = String(raw?.city ?? '').trim();
        const district = String(raw?.district ?? '').trim();
        const title = String(raw?.title ?? raw?.name ?? '').trim() || 'Oferta premium';
        const areaValue = parsePriceNumber(raw?.area);
        const createdAtMs = raw?.createdAt ? new Date(raw.createdAt).getTime() : Date.now();
        const daysOnMarket = Math.max(1, Math.round((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
        const location = [district, city].filter(Boolean).join(', ') || 'Polska';
        const extractedImages = extractImagesFromOffer(raw);
        const plannedImages = Array.isArray(raw?.galleryPlan?.orderedAssets)
          ? raw.galleryPlan.orderedAssets.filter((image: unknown) => typeof image === 'string' && image.trim())
          : [];
        const images = plannedImages.length ? plannedImages : extractedImages;
        const scoreRaw = raw?.score ?? raw?.matchScore;
        const scoreNum = scoreRaw == null ? null : Number(scoreRaw);
        return {
          id: String(raw?.id ?? `${title}-${city}-${Math.random()}`),
          title,
          location,
          price: formatOffer(raw).primary,
          originalPrice: formatOffer({
            ...raw,
            priceAmount: previousPrice || listing.amount,
            price: previousPrice || listing.amount,
            priceCurrency: listing.currency,
          }).primary,
          area: `${Math.max(0, Math.round(areaValue || 0))} m²`,
          daysOnMarket,
          priceHistory: buildPriceHistory(listing.plnAmount, prevPln),
          images,
          image: images[0] || extractImageFromOffer(raw),
          matchScore:
            typeof scoreNum === 'number' && Number.isFinite(scoreNum)
              ? Math.max(0, Math.min(100, Math.round(scoreNum)))
              : null,
          matchReason: raw?.reason == null ? null : String(raw.reason),
          galleryPlan: raw?.galleryPlan || null,
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
    // Po zmianie talii: zeruj pozycję DOPIERO gdy nowa karta już jest topką —
    // bez springów skali/opacity (to powodowało mryganie i podskoki).
    if (pendingResetRef.current) {
      pendingResetRef.current = false;
      position.setValue({ x: 0, y: 0 });
      swipingRef.current = false;
    }
  }, [position, topOfferId]);

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
      friction: 6,
      tension: 48,
      useNativeDriver: false,
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
      swipingRef.current = false;
      return;
    }
    if (direction === 'up') {
      position.setValue({ x: 0, y: 0 });
      swipingRef.current = false;
      setPriorityOffer(top);
      return;
    }
    commitDecision(direction, top);
  }, [commitDecision, position]);

  // === ANIMACJE KARTY ===
  const forceSwipe = useCallback((direction: 'right' | 'left' | 'up') => {
    if (swipingRef.current) return;
    if (!offersRef.current[0]) return;
    swipingRef.current = true;

    let toX = 0;
    let toY = 0;
    if (direction === 'right') toX = width * 1.35;
    if (direction === 'left') toX = -width * 1.35;
    if (direction === 'up') toY = -height * 1.25;

    Animated.timing(position, {
      toValue: { x: toX, y: toY },
      duration: 260,
      easing: DISCOVERY_EASE_OUT,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        position.setValue({ x: 0, y: 0 });
        swipingRef.current = false;
        return;
      }
      onSwipeComplete(direction);
    });
  }, [height, onSwipeComplete, position, width]);

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
        return Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (swipingRef.current) return false;
        return Math.abs(gestureState.dx) > 12;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = gestureState.dy > 0 ? gestureState.dy * 0.15 : gestureState.dy;
        position.setValue({ x: gestureState.dx, y: newY });
      },
      onPanResponderRelease: (_, gestureState) => {
        const { width: w, height: h } = layoutRef.current;
        const thresholdX = w * 0.28;
        const thresholdY = -h * 0.18;
        if (gestureState.dy < thresholdY && Math.abs(gestureState.dx) < thresholdX) {
          forceSwipeRef.current?.('up');
        } else if (gestureState.dx > thresholdX) {
          forceSwipeRef.current?.('right');
        } else if (gestureState.dx < -thresholdX) {
          forceSwipeRef.current?.('left');
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
    setOffers((prev) => [undoOffer, ...prev]);
    setActivePhotoIndex(0);
    void sendDiscoveryEvent('DISCOVERY_UNDO', undoOffer);
    setUndoOffer(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sendDiscoveryEvent, undoOffer]);

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
    if (offers[0]?.matchReason) {
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
    outputRange: ['-12deg', '0deg', '12deg'],
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

  const nextCardScale = position.x.interpolate({
    inputRange: [-width * 0.28, 0, width * 0.28],
    outputRange: [1, 0.945, 1],
    extrapolate: 'clamp',
  });
  const nextCardLift = position.x.interpolate({
    inputRange: [-width * 0.28, 0, width * 0.28],
    outputRange: [0, 8, 0],
    extrapolate: 'clamp',
  });

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

    return offers.map((offer, index) => {
      const isFirst = index === 0;
      const isSecond = index === 1;
      if (!isFirst && !isSecond) return null;

      return (
        <Animated.View
          key={offer.id}
          style={[
            styles.cardContainer,
            { width: CARD_WIDTH, height: CARD_HEIGHT },
            isFirst && {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
              zIndex: 10,
            },
            isSecond && {
              transform: [{ translateY: nextCardLift }, { scale: nextCardScale }],
              zIndex: 1,
            },
          ]}
          {...(isFirst ? panResponder.panHandlers : {})}
        >
          <View style={styles.cardImageTapLayer}>
            <Image
              source={{
                uri: isFirst
                  ? (offer.images?.[activePhotoIndex] || offer.image)
                  : offer.image,
              }}
              style={styles.cardImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
            />
            {isFirst ? (
              <View style={styles.tapZonesLayer} pointerEvents="box-none">
                <Pressable style={styles.tapZoneLeft} onPress={() => handleTopCardImageTap('left')} />
                <Pressable style={styles.tapZoneRight} onPress={() => handleTopCardImageTap('right')} />
              </View>
            ) : null}
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            locations={[0.18, 0.58, 1]}
            style={styles.cardGradient}
          />
          {isFirst && (
            <View style={styles.photoPagerOverlay} pointerEvents="box-none">
              <View style={styles.photoCounterBadge}>
                <Text style={styles.photoCounterText}>
                  {Math.min((activePhotoIndex + 1), Math.max(1, offer.images?.length || 1))}/{Math.max(1, offer.images?.length || 1)}
                </Text>
              </View>
              <View style={styles.photoDotsRow}>
                {(offer.images || [offer.image]).slice(0, 8).map((img, idx) => {
                  const active = idx === activePhotoIndex;
                  return <View key={`${offer.id}-dot-${idx}-${img}`} style={[styles.photoDot, active && styles.photoDotActive]} />;
                })}
              </View>
              <Pressable
                onPress={() => setGalleryVisible(true)}
                style={styles.galleryOpenButton}
                accessibilityRole="button"
                accessibilityLabel="Otwórz galerię zdjęć"
              >
                <BlurView intensity={45} tint="dark" style={styles.galleryOpenGlass}>
                  <Ionicons name="expand-outline" size={16} color="#FFF" />
                </BlurView>
              </Pressable>
            </View>
          )}

          {isFirst && (
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
          )}

          <View style={styles.offerInfoWrap}>
            <View style={styles.locationRow}>
              <MapPin size={14} color={RR_GOLD} />
              <Text style={styles.offerLocation}>{offer.location}</Text>
            </View>

            <Text style={styles.offerTitle} numberOfLines={1}>{offer.title}</Text>

            <View style={styles.specsRow}>
              <Text style={styles.offerPrice}>{offer.price}</Text>
              <View style={styles.specDivider} />
              <Maximize size={14} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.offerArea}>{offer.area}</Text>
            </View>

            <BlurView intensity={50} tint="dark" style={styles.miniDashboard}>
              <View style={styles.dashHeaderRow}>
                <View>
                  <Text style={styles.dashLabel}>CENA STARTOWA</Text>
                  <Text style={styles.dashValueMuted}>{offer.originalPrice}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.dashLabel}>NA RYNKU OD</Text>
                  <Text style={styles.dashValue}>{offer.daysOnMarket} dni</Text>
                </View>
              </View>

              <PriceHistoryChart data={offer.priceHistory} width={CARD_WIDTH - 64} />
              {isFirst ? (
                <Text style={styles.discoveryQuietHint}>Dopasowanie wyjaśnimy na Twoje życzenie.</Text>
              ) : null}
            </BlurView>
          </View>
          {isFirst ? (
            <Pressable
              onPress={() => {
                void sendDiscoveryEvent('DISCOVERY_DEPTH_OPEN', offer, { score: topOfferInsight.score });
                navigation?.navigate?.('OfferDetail', { offerId: Number(offer.id) || offer.id });
              }}
              style={styles.infoChevronBtn}
              hitSlop={14}
            >
              <BlurView intensity={45} tint="dark" style={styles.infoChevronGlass}>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </BlurView>
            </Pressable>
          ) : null}
        </Animated.View>
      );
    }).reverse();
  };

  return (
    <View style={styles.container}>
      <DiscoverySessionIsland state={islandState} onBack={() => setPauseVisible(true)} />

      <View style={styles.cardsWrapper}>
        {renderCards()}
      </View>

      {offers.length > 0 && (
        <View style={styles.actionButtonsRow}>
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
    borderRadius: 32,
    backgroundColor: '#111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  cardImageTapLayer: {
    width: '100%',
    height: '100%',
  },
  tapZonesLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapZoneLeft: {
    width: '50%',
    height: '100%',
  },
  tapZoneRight: {
    width: '50%',
    height: '100%',
  },
  photoPagerOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 10,
  },
  photoCounterBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  photoCounterText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  photoDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  galleryOpenButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  galleryOpenGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  photoDotActive: {
    width: 16,
    borderRadius: 4,
    backgroundColor: RR_GOLD,
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
    padding: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    opacity: 0.9,
  },
  offerLocation: {
    color: RR_GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginLeft: 6,
  },
  offerTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  offerPrice: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  specDivider: {
    width: 2,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
  },
  offerArea: {
    color: '#EBEBF5',
    fontSize: 18,
    fontWeight: '600',
  },

  // === MINIDASHBOARD (WYKRES) ===
  miniDashboard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  discoveryQuietHint: {
    marginTop: 10,
    color: 'rgba(215,215,219,0.68)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  infoChevronBtn: {
    position: 'absolute',
    right: 14,
    bottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 30,
  },
  infoChevronGlass: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  dashHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dashLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dashValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dashValueMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
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