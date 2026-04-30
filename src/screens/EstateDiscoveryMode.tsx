import React, { useRef, useState, useCallback, useEffect } from 'react';
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

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop';

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

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

  useEffect(() => {
    let mounted = true;
    const fetchOffers = async () => {
      try {
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

        const mapped: DiscoveryOffer[] = list
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

        if (mounted) setOffers(mapped);
      } catch {
        if (mounted) setOffers([]);
      }
    };
    void fetchOffers();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [offers[0]?.id]);

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
  }, [position, width, height]);

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
  }, [position]);

  const handleTopCardImageTap = useCallback(() => {
    const top = offers[0];
    if (!top) return;
    const total = Math.max(1, top.images?.length ?? 1);
    if (total <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivePhotoIndex((prev) => (prev + 1) % total);
  }, [offers]);

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
          <Pressable
            onPress={isFirst ? handleTopCardImageTap : undefined}
            style={styles.cardImageTapLayer}
          >
            <Image
              source={{
                uri: isFirst
                  ? (offer.images?.[activePhotoIndex] || offer.image)
                  : offer.image,
              }}
              style={styles.cardImage}
              contentFit="cover"
            />
          </Pressable>
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
            </BlurView>

          </View>
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