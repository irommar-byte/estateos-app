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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import {
  buildDiscoveryEventPayload,
  parseDiscoveryFeedItems,
  type DiscoveryEventType,
  type DiscoveryDislikeReasonCode,
} from '../contracts/discoveryContracts';

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
};

type DiscoveryProfile = {
  likedLocations: Record<string, number>;
  dislikedLocations: Record<string, number>;
  medianLikedPrice: number | null;
  medianLikedArea: number | null;
  interactions: number;
};

const DISCOVERY_EVENT_QUEUE_KEY = 'discovery_event_queue_v1';
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

async function enqueueDiscoveryEvent(payload: any) {
  try {
    const raw = await AsyncStorage.getItem(DISCOVERY_EVENT_QUEUE_KEY);
    const queue = raw ? (JSON.parse(raw) as any[]) : [];
    queue.push(payload);
    await AsyncStorage.setItem(DISCOVERY_EVENT_QUEUE_KEY, JSON.stringify(queue.slice(-120)));
  } catch {
    // noop
  }
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
  const isTablet = width >= 768;
  
  // Responsywne wyliczanie wielkości karty
  const CARD_WIDTH = isTablet ? Math.min(width * 0.75, 540) : width * 0.94;
  const CARD_HEIGHT = isTablet ? Math.min(height * 0.75, 780) : height * 0.72;
  
  const SWIPE_THRESHOLD_X = CARD_WIDTH * 0.35;
  const SWIPE_THRESHOLD_Y = -CARD_HEIGHT * 0.25;

  const [offers, setOffers] = useState<DiscoveryOffer[]>([]);
  const position = useRef(new Animated.ValueXY()).current;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const topOfferId = offers[0]?.id;
  const [profile, setProfile] = useState<DiscoveryProfile>({
    likedLocations: {},
    dislikedLocations: {},
    medianLikedPrice: null,
    medianLikedArea: null,
    interactions: 0,
  });
  const [pendingDislikeOffer, setPendingDislikeOffer] = useState<DiscoveryOffer | null>(null);

  const mapRawOffersToDiscovery = useCallback((list: any[]): DiscoveryOffer[] => {
    return list
      .map((raw: any): DiscoveryOffer | null => {
        const priceNow = parsePriceNumber(raw?.price);
        if (!priceNow) return null;
        const previousPrice = parsePriceNumber(raw?.originalPrice ?? raw?.previousPrice ?? raw?.priceStart);
        const city = String(raw?.city ?? '').trim();
        const district = String(raw?.district ?? '').trim();
        const title = String(raw?.title ?? raw?.name ?? '').trim() || 'Oferta premium';
        const areaValue = parsePriceNumber(raw?.area);
        const createdAtMs = raw?.createdAt ? new Date(raw.createdAt).getTime() : Date.now();
        const daysOnMarket = Math.max(1, Math.round((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
        const location = [district, city].filter(Boolean).join(', ') || 'Polska';
        const images = extractImagesFromOffer(raw);
        return {
          id: String(raw?.id ?? `${title}-${city}-${Math.random()}`),
          title,
          location,
          price: formatPln(priceNow),
          originalPrice: formatPln(previousPrice || priceNow),
          area: `${Math.max(0, Math.round(areaValue || 0))} m²`,
          daysOnMarket,
          priceHistory: buildPriceHistory(priceNow, previousPrice),
          images,
          image: images[0] || extractImageFromOffer(raw),
        };
      })
      .filter(Boolean) as DiscoveryOffer[];
  }, []);

  const sendDiscoveryEvent = useCallback(
    async (
      eventType: DiscoveryEventType,
      offer: DiscoveryOffer,
      extra?: { reasonCode?: DiscoveryDislikeReasonCode; photoIndex?: number; score?: number }
    ) => {
      const payload = buildDiscoveryEventPayload({
        eventType,
        offerId: Number(offer.id),
        photoIndex: extra?.photoIndex ?? activePhotoIndex,
        score: extra?.score ?? null,
        reasonCode: extra?.reasonCode || null,
        platform: Platform.OS,
        at: new Date().toISOString(),
      });
      if (!payload) return;
      try {
        const res = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          await enqueueDiscoveryEvent(payload);
        }
      } catch {
        await enqueueDiscoveryEvent(payload);
      }
    },
    [activePhotoIndex, token]
  );

  const flushDiscoveryQueue = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DISCOVERY_EVENT_QUEUE_KEY);
      const queue = raw ? (JSON.parse(raw) as any[]) : [];
      if (!queue.length) return;
      const nextQueue: any[] = [];
      for (const payload of queue) {
        try {
          const res = await fetch(`${API_URL}/api/mobile/v1/discovery/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) nextQueue.push(payload);
        } catch {
          nextQueue.push(payload);
        }
      }
      await AsyncStorage.setItem(DISCOVERY_EVENT_QUEUE_KEY, JSON.stringify(nextQueue.slice(-120)));
    } catch {
      // noop
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    const fetchOffers = async () => {
      try {
        await flushDiscoveryQueue();
        // 1) Prefer feed "for you" from backend
        const feedRes = await fetch(`${API_URL}/api/mobile/v1/discovery/feed?mode=for_you&limit=40`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const feedJson = await feedRes.json().catch(() => ({}));
        const feedList = parseDiscoveryFeedItems(feedJson);

        let mapped = mapRawOffersToDiscovery(feedList);
        // 2) Fallback to generic offers if feed unavailable/empty
        if (mapped.length === 0) {
          const res = await fetch(`${API_URL}/api/mobile/v1/offers`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const json = await res.json().catch(() => ({}));
          const list = Array.isArray(json)
            ? json
            : Array.isArray(json?.offers)
              ? json.offers
              : Array.isArray(json?.items)
                ? json.items
                : [];
          mapped = mapRawOffersToDiscovery(list);
        }

        if (mounted) setOffers(mapped);
      } catch {
        if (mounted) setOffers([]);
      }
    };
    void fetchOffers();
    return () => {
      mounted = false;
    };
  }, [token, flushDiscoveryQueue, mapRawOffersToDiscovery]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [topOfferId]);

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

  // === SYSTEM POWIADOMIEŃ (TOAST) ===
  const showToast = (message: string) => {
    setToastMessage(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // === FIZYKA PAN RESPONDERA ===
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = gestureState.dy > 0 ? gestureState.dy * 0.15 : gestureState.dy; // Blokujemy swipe w dół
        position.setValue({ x: gestureState.dx, y: newY });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < SWIPE_THRESHOLD_Y && Math.abs(gestureState.dx) < SWIPE_THRESHOLD_X) {
          forceSwipe('up');
        } else if (gestureState.dx > SWIPE_THRESHOLD_X) {
          forceSwipe('right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD_X) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  // === ANIMACJE KARTY ===
  const forceSwipe = useCallback((direction: 'right' | 'left' | 'up') => {
    let toX = 0; let toY = 0;
    if (direction === 'right') toX = width * 1.5;
    if (direction === 'left') toX = -width * 1.5;
    if (direction === 'up') toY = -height * 1.5;

    Animated.timing(position, {
      toValue: { x: toX, y: toY },
      duration: 350,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  }, [position, width, height, onSwipeComplete]);

  const resetPosition = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [position]);

  const onSwipeComplete = useCallback((direction: 'right' | 'left' | 'up') => {
    const top = offers[0];
    if (top) {
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
      if (direction === 'left') setPendingDislikeOffer(top);
      else setPendingDislikeOffer(null);
      void sendDiscoveryEvent(
        direction === 'right'
          ? 'DISCOVERY_LIKE'
          : direction === 'left'
            ? 'DISCOVERY_DISLIKE'
            : 'DISCOVERY_FAST_TRACK',
        top
      );
    }

    if (direction === 'right') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (direction === 'left') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (direction === 'up') {
      showToast('Dodano do ulubionych i wysłano do Agenta ⚡');
    }

    setOffers((prev) => prev.slice(1));
    setActivePhotoIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [position, offers, sendDiscoveryEvent]);

  const handleTopCardImageTap = useCallback((zone: 'left' | 'right') => {
    const top = offers[0];
    if (!top) return;
    const total = Math.max(1, top.images?.length ?? 1);
    if (total <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePhotoIndex((prev) => {
      if (zone === 'left') return (prev - 1 + total) % total;
      return (prev + 1) % total;
    });
  }, [offers]);

  const topOfferInsight = useMemo(() => {
    const top = offers[0];
    if (!top) return { score: 50, reason: 'Budujemy Twój profil preferencji' };
    const locationKey = top.location.split(',')[0]?.trim().toLowerCase() || top.location.toLowerCase();
    const price = parsePriceNumber(top.price);
    const area = parsePriceNumber(top.area);
    let score = 50;
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
      reason: reasons[0] || 'algorytm testuje nowe warianty pod Twój gust',
    };
  }, [offers, profile]);

  // === INTERPOLACJE IKON NA ŚRODKU ===
  const rotate = position.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
  
  // Zielone Serce
  const likeOpacity = position.x.interpolate({ inputRange: [20, SWIPE_THRESHOLD_X], outputRange: [0, 1], extrapolate: 'clamp' });
  const likeScale = position.x.interpolate({ inputRange: [20, SWIPE_THRESHOLD_X], outputRange: [0.5, 1.5], extrapolate: 'clamp' });

  // Smutna Buźka
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD_X, -20], outputRange: [1, 0], extrapolate: 'clamp' });
  const nopeScale = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD_X, -20], outputRange: [1.5, 0.5], extrapolate: 'clamp' });

  // Złoty Piorun
  const fastTrackOpacity = position.y.interpolate({ inputRange: [SWIPE_THRESHOLD_Y, -20], outputRange: [1, 0], extrapolate: 'clamp' });
  const fastTrackScale = position.y.interpolate({ inputRange: [SWIPE_THRESHOLD_Y, -20], outputRange: [1.5, 0.5], extrapolate: 'clamp' });

  const nextCardScale = position.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: [1, 0.94, 1], extrapolate: 'clamp' });

  // === RENDEROWANIE KART ===
  const renderCards = () => {
    if (offers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Katalog Przejrzany</Text>
          <Text style={styles.emptySub}>Radar uczy się Twoich preferencji.</Text>
        </View>
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
            isFirst && { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }], zIndex: 10 },
            isSecond && { transform: [{ scale: nextCardScale }], zIndex: 1 },
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
              transition={120}
              cachePolicy="memory-disk"
            />
            {isFirst ? (
              <View style={styles.tapZonesLayer} pointerEvents="box-none">
                <Pressable style={styles.tapZoneLeft} onPress={() => handleTopCardImageTap('left')} />
                <Pressable style={styles.tapZoneRight} onPress={() => handleTopCardImageTap('right')} />
              </View>
            ) : null}
          </View>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)', '#000']} locations={[0.2, 0.65, 1]} style={styles.cardGradient} />
          {isFirst && (
            <View style={styles.photoPagerOverlay} pointerEvents="none">
              <View style={styles.photoCounterBadge}>
                <Text style={styles.photoCounterText}>
                  {Math.min((activePhotoIndex + 1), Math.max(1, offer.images?.length || 1))}/{Math.max(1, offer.images?.length || 1)}
                </Text>
              </View>
              <View style={styles.photoDotsRow}>
                {(offer.images || [offer.image]).map((img, idx) => {
                  const active = idx === activePhotoIndex;
                  return <View key={`${offer.id}-dot-${idx}-${img}`} style={[styles.photoDot, active && styles.photoDotActive]} />;
                })}
              </View>
            </View>
          )}

          {/* === GIGANTYCZNE IKONY NA ŚRODKU (Aktywne tylko na 1 karcie) === */}
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

          {/* === INFORMACJE O OFERCIE === */}
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

            {/* === MINIDASHBOARD Z WYKRESEM === */}
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
                <View style={styles.smartInsightRow}>
                  <Text style={styles.smartInsightBadge}>SMART MATCH {topOfferInsight.score}%</Text>
                  <Text style={styles.smartInsightText}>{topOfferInsight.reason}</Text>
                </View>
              ) : null}
            </BlurView>

          </View>
          {isFirst ? (
            <Pressable
              onPress={() => {
                void sendDiscoveryEvent('DISCOVERY_OPEN', offer, { score: topOfferInsight.score });
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
      {/* TOAST NOTIFICATION (Fast Track) */}
      {toastMessage && (
        <Animated.View style={styles.toastContainer}>
          <BlurView intensity={80} tint="dark" style={styles.toastBlur}>
            <Zap size={18} color={RR_GOLD} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* NAGŁÓWEK */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack()} style={styles.backBtn} hitSlop={20}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>EstateOS™ Discovery</Text>
          <Text style={styles.headerSubtitle}>KATALOG SELEKCJI</Text>
        </View>
      </View>

      {/* KARTY */}
      <View style={styles.cardsWrapper}>
        {renderCards()}
      </View>

      {/* PRZYCISKI AKCJI NA DOLE */}
      {offers.length > 0 && (
        <View style={styles.actionButtonsRow}>
          <Pressable onPress={() => forceSwipe('left')} style={({ pressed }) => [styles.actionBtnBlur, pressed && { transform: [{scale: 0.9}]}]}>
            <BlurView intensity={40} tint="dark" style={styles.btnGlass}>
              <X size={28} color="#A0A0A5" />
            </BlurView>
          </Pressable>

          <Pressable onPress={() => forceSwipe('up')} style={({ pressed }) => [styles.actionBtnBlur, styles.actionBtnFastTrack, pressed && { transform: [{scale: 0.9}]}]}>
            <BlurView intensity={60} tint="dark" style={styles.btnGlass}>
              <Zap size={32} color={RR_GOLD} />
            </BlurView>
          </Pressable>

          <Pressable onPress={() => forceSwipe('right')} style={({ pressed }) => [styles.actionBtnBlur, pressed && { transform: [{scale: 0.9}]}]}>
            <BlurView intensity={40} tint="dark" style={styles.btnGlass}>
              <Heart size={28} color={RR_GREEN} />
            </BlurView>
          </Pressable>
        </View>
      )}
      {pendingDislikeOffer && (
        <View style={styles.dislikeReasonWrap}>
          <BlurView intensity={55} tint="dark" style={styles.dislikeReasonGlass}>
            <Text style={styles.dislikeReasonTitle}>Dlaczego pomijasz tę ofertę?</Text>
            <View style={styles.dislikeReasonRow}>
              {DISCOVERY_DISLIKE_REASONS.map((reason) => (
                <Pressable
                  key={reason.key}
                  onPress={() => {
                    void sendDiscoveryEvent('DISCOVERY_DISLIKE_REASON', pendingDislikeOffer, { reasonCode: reason.key });
                    setPendingDislikeOffer(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [styles.dislikeReasonChip, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.dislikeReasonChipText}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
          </BlurView>
        </View>
      )}
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
  smartInsightRow: {
    marginTop: 10,
    gap: 5,
  },
  smartInsightBadge: {
    color: RR_GREEN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  smartInsightText: {
    color: '#D7D7DB',
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