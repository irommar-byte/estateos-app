import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
  FlatList,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  InteractionManager,
  Dimensions,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import MapViewCore, { Marker, Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadarCalibrationModal, { RadarFilters } from '../components/RadarCalibrationModal';
import { syncPushDevicePreferences } from '../hooks/usePushNotifications';
import { STRICT_CITIES, STRICT_CITY_DISTRICTS } from '../constants/locationEcosystem';

// --- LUKSUSOWA SOCZEWKA KALIBRACJI (APPLE-STYLE) ---
const CalibrationLens = ({ isMoving, isDark, diameter }: { isMoving: boolean, isDark: boolean, diameter: number }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const focusHapticAtRef = useRef(0);

  useEffect(() => {
    if (isMoving) {
      // 1. FAZA SZUKANIA (Rozszerzenie i utrata ostrości)
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1.08, friction: 7, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.72, duration: 140, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    } else {
      // 2. FAZA ŁAPANIA OSTROŚCI: wyraźniejsza soczewka + pojedynczy, kontrolowany klik.
      const now = Date.now();
      if (now - focusHapticAtRef.current > 900) {
        focusHapticAtRef.current = now;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 0.96, friction: 7, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 9, useNativeDriver: true })
        ]),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 360, useNativeDriver: true })
        ])
      ]).start();
    }
  }, [isMoving]);

  return (
    <View style={[styles.lensWrapper, { width: diameter, height: diameter }]} pointerEvents="none">
      {/* Animowany zielony rozbłysk */}
      <Animated.View style={[
        styles.lensGlow,
        {
          width: diameter, height: diameter, borderRadius: diameter / 2,
          opacity: glowAnim,
          transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }]
        }
      ]} />

      {/* Główna soczewka */}
      <Animated.View style={[
        styles.lensCore,
        {
          width: diameter, height: diameter, borderRadius: diameter / 2,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          borderColor: isMoving ? 'rgba(142,142,147,0.48)' : '#10f08a',
          borderWidth: isMoving ? 2 : 3.5,
        }
      ]}>
        <BlurView intensity={isMoving ? 18 : 4} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.lensDot, { backgroundColor: isMoving ? '#8E8E93' : '#10b981' }]} />
        <View style={[styles.crosshair, styles.crosshairTop]} />
        <View style={[styles.crosshair, styles.crosshairBottom]} />
        <View style={[styles.crosshair, styles.crosshairLeft]} />
        <View style={[styles.crosshair, styles.crosshairRight]} />
      </Animated.View>
    </View>
  );
};

function markerLuxuryGradient(accentHex: string): [string, string, string] {
  if (accentHex === '#0A84FF') {
    return ['#8ECBFF', '#3DA3FF', '#0066CC'];
  }
  if (accentHex === '#FF9F0A') {
    return ['#FFD08A', '#FFB648', '#FF8A00'];
  }
  return ['#6EE7B7', '#22C993', '#0A9F6E'];
}

function clusterBubbleDimensions(points: number) {
  if (points >= 50) return { diameter: 64, halo: 82, fontSize: 19 };
  if (points >= 25) return { diameter: 58, halo: 76, fontSize: 18 };
  if (points >= 15) return { diameter: 54, halo: 72, fontSize: 17 };
  if (points >= 10) return { diameter: 50, halo: 68, fontSize: 17 };
  if (points >= 8) return { diameter: 46, halo: 62, fontSize: 16 };
  if (points >= 4) return { diameter: 42, halo: 56, fontSize: 16 };
  return { diameter: 38, halo: 52, fontSize: 15 };
}

function hasFiniteCoords(lat: unknown, lng: unknown): boolean {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function formatClusterCount(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

const API_URL = 'https://estateos.pl';
const RadarMapComponent: any = Platform.OS === 'ios' ? MapViewCore : ClusteredMapView;
const PARTNER_MARKER_COLOR = '#FF9F0A';
const SELL_MARKER_COLOR = '#10b981';
const RENT_MARKER_COLOR = '#0A84FF';

const RECENT_SEARCH_KEY = '@estateos_home_search_recent';
const MAX_RECENT_SEARCHES = 8;
const QUICK_CITIES = [...STRICT_CITIES];
const FAVORITES_MAP_HEARTS = [
  { left: '8%', top: '20%', size: 12, drift: -8 },
  { left: '16%', top: '30%', size: 10, drift: 10 },
  { left: '25%', top: '16%', size: 9, drift: -6 },
  { left: '34%', top: '28%', size: 11, drift: 8 },
  { left: '44%', top: '18%', size: 12, drift: -9 },
  { left: '56%', top: '30%', size: 10, drift: 7 },
  { left: '66%', top: '17%', size: 9, drift: -7 },
  { left: '76%', top: '29%', size: 11, drift: 9 },
  { left: '86%', top: '21%', size: 10, drift: -8 },
  { left: '11%', top: '58%', size: 10, drift: 7 },
  { left: '23%', top: '66%', size: 12, drift: -10 },
  { left: '36%', top: '60%', size: 10, drift: 8 },
  { left: '49%', top: '68%', size: 11, drift: -7 },
  { left: '62%', top: '61%', size: 9, drift: 6 },
  { left: '74%', top: '67%', size: 12, drift: -9 },
  { left: '87%', top: '59%', size: 10, drift: 7 },
] as const;

function normalizeSearchText(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function pluralOffers(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'oferta';
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'oferty';
  return 'ofert';
}

type RankedSuggestion = {
  key: string;
  value: string;
  category: string;
  count: number;
};
const DEFAULT_REGION = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};
let hasAskedLocationInCurrentSession = false;

type MapOffer = {
  id: number | string;
  price: string;
  type: string;
  area: string;
  rooms: string;
  lat: number;
  lng: number;
  image: string | null;
  raw: any;
};

type UserLocation = { latitude: number; longitude: number } | null;
type AdvancedFilters = {
  transactionType: 'SELL' | 'RENT';
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  city: string;
  districts: string[];
  propertyType: 'ALL' | 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL';
};
type RadarAreaDraft = {
  center: { latitude: number; longitude: number };
  radiusKm: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const toAbsoluteImage = (img: string | null | undefined) => {
  if (!img) return null;
  if (img.startsWith('/uploads')) return `${API_URL}${img}`;
  return img;
};

const formatMarkerPrice = (price: string) => {
  const raw = Number(String(price).replace(/[^\d]/g, ''));
  if (!Number.isFinite(raw) || raw <= 0) return '---';
  if (raw >= 1000000) return `${(raw / 1000000).toFixed(1)}M`;
  return `${Math.round(raw / 1000)}k`;
};

const getTransactionBadge = (rawTransactionType: unknown) => {
  const normalized = String(rawTransactionType || '').toUpperCase();
  if (normalized === 'RENT') {
    return { label: 'WYNAJEM', color: RENT_MARKER_COLOR };
  }
  return { label: 'SPRZEDAŻ', color: SELL_MARKER_COLOR };
};

function isPartnerOffer(raw: any): boolean {
  const candidates = [
    raw?.role,
    raw?.userRole,
    raw?.ownerRole,
    raw?.publisherRole,
    raw?.accountType,
    raw?.source,
    raw?.listingSource,
    raw?.authorType,
    raw?.user?.role,
    raw?.owner?.role,
    raw?.seller?.role,
    raw?.user?.planType,
    raw?.owner?.planType,
    raw?.seller?.planType,
  ]
    .map((v) => String(v || '').toUpperCase())
    .filter(Boolean);

  if (
    raw?.isPartner === true ||
    raw?.partner === true ||
    raw?.isAgency === true ||
    raw?.agency === true ||
    raw?.isProAgency === true
  ) {
    return true;
  }

  return candidates.some((v) => v.includes('PARTNER') || v.includes('AGENCY'));
}

function offerMarkerAccent(raw: any): string {
  if (isPartnerOffer(raw)) return PARTNER_MARKER_COLOR;
  const tx = String(raw?.transactionType || '').toUpperCase();
  return tx === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;
}

const formatOfferPublishDate = (raw: any) => {
  const value =
    raw?.publishedAt ||
    raw?.published_at ||
    raw?.publicationDate ||
    raw?.createdAt ||
    raw?.created_at;
  if (!value) return 'Publikacja: -';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Publikacja: -';
  return `Publikacja: ${date.toLocaleDateString('pl-PL')}`;
};

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

/** Max price: przy 100% sztywny limit kalibracji; przy niższej skali do +10% tolerancji (liniowo). */
function radarPriceCap(maxPrice: number, matchThreshold: number): number {
  const t = Math.max(50, Math.min(100, matchThreshold));
  // Normalizacja po faktycznym zakresie suwaka 50..100.
  const normalizedRelax = Math.max(0, Math.min(1, (100 - t) / 50));
  const slack = normalizedRelax * 0.1;
  return maxPrice * (1 + slack);
}

/** Promień geograficzny: przy 100% dokładnie zaznaczony krąg; niżej stopniowo szerzej (do ~2× przy 50%). */
function radarGeoRadiusLimitKm(baseRadiusKm: number, matchThreshold: number): number {
  const t = Math.max(50, Math.min(100, matchThreshold));
  // Normalizacja po faktycznym zakresie suwaka 50..100.
  const normalizedRelax = Math.max(0, Math.min(1, (100 - t) / 50));
  const relax = normalizedRelax * 1.0;
  return baseRadiusKm * (1 + relax);
}

function radarCityMatches(rawCityNorm: string, selectedCityNorm: string) {
  if (!selectedCityNorm) return true;
  if (rawCityNorm === selectedCityNorm) return true;
  return false;
}

function getStrictDistrictsForCity(cityLabel: string): string[] {
  const selectedCityNorm = normalizeSearchText(String(cityLabel || '').trim());
  if (!selectedCityNorm) return [];
  const direct = Object.entries(STRICT_CITY_DISTRICTS).find(
    ([cityName]) => normalizeSearchText(cityName) === selectedCityNorm
  )?.[1];
  return direct ? [...direct].sort((a, b) => a.localeCompare(b, 'pl')) : [];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approxKmPerPixel(region: Region, mapWidthPx: number, mapHeightPx: number) {
  const latKmVisible = region.latitudeDelta * 111.32;
  const lngKmVisible =
    region.longitudeDelta *
    111.32 *
    Math.cos((region.latitude * Math.PI) / 180);
  const kmPerPxLat = latKmVisible / Math.max(1, mapHeightPx);
  const kmPerPxLng = lngKmVisible / Math.max(1, mapWidthPx);
  return {
    kmPerPxAvg: (kmPerPxLat + kmPerPxLng) / 2,
  };
}

function formatRadiusLabel(km: number) {
  return `${Math.round(km * 10) / 10} km`;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const numericOfferValue = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

function upperLimitScore(value: number, max: number, allowedSlackPct: number) {
  if (!max || value <= max) return 100;
  const slack = Math.max(1, max * allowedSlackPct);
  return clampScore(100 - ((value - max) / slack) * 50);
}

function lowerLimitScore(value: number, min: number, fullDropPct: number) {
  if (!min || value >= min) return 100;
  const floor = Math.max(0, min * (1 - fullDropPct));
  if (value <= floor) return clampScore((value / Math.max(1, min)) * 60);
  return clampScore(60 + ((value - floor) / Math.max(1, min - floor)) * 40);
}

function yearScore(year: number, minYear: number) {
  if (!minYear || minYear <= 1900 || year >= minYear) return 100;
  const yearsOlder = minYear - year;
  if (yearsOlder <= 15) return clampScore(100 - (yearsOlder / 15) * 40);
  return clampScore(60 - Math.min(60, ((yearsOlder - 15) / 35) * 60));
}

function amenityScore(raw: any, rf: RadarFilters) {
  const required = [
    rf.requireBalcony ? !!raw.hasBalcony : null,
    rf.requireGarden ? !!raw.hasGarden : null,
    rf.requireElevator ? !!raw.hasElevator : null,
    rf.requireParking ? !!raw.hasParking : null,
    rf.requireFurnished ? !!raw.isFurnished : null,
  ].filter((v) => v !== null) as boolean[];
  if (required.length === 0) return 100;
  const present = required.filter(Boolean).length;
  return clampScore((present / required.length) * 100);
}

function locationScore(offer: MapOffer, rf: RadarFilters, bounds: RadarMapBounds | null) {
  const raw = offer.raw;
  if (rf.calibrationMode === 'CITY') {
    const rawCity = normalizeSearchText(String(raw.city || '').trim());
    const selCity = normalizeSearchText(rf.city.trim());
    if (selCity && !radarCityMatches(rawCity, selCity)) return 0;
    if (rf.selectedDistricts.length === 0) return 100;

    const rawDistrict = normalizeSearchText(String(raw.district || '').trim());
    const districtMatch = rf.selectedDistricts.some((d) => normalizeSearchText(String(d).trim()) === rawDistrict);
    // To nadal jest to samo miasto, ale poza wybraną dzielnicą: wpada dopiero przy szerszym skanowaniu.
    return districtMatch ? 100 : 50;
  }

  if (!bounds) return 100;
  const baseRadius = Math.max(0.1, bounds.radiusKm);
  const dKm = distanceKm(bounds.centerLat, bounds.centerLng, offer.lat, offer.lng);
  if (dKm <= baseRadius) return 100;
  if (dKm <= baseRadius * 2) return clampScore(100 - ((dKm / baseRadius) - 1) * 50);
  return 0;
}

function radarMatchScore(offer: MapOffer, rf: RadarFilters, bounds: RadarMapBounds | null): number {
  const raw = offer.raw;
  if (String(raw.transactionType || '').toUpperCase() !== rf.transactionType) return 0;
  if (rf.propertyType !== 'ALL' && String(raw.propertyType || '').toUpperCase() !== rf.propertyType) return 0;

  const rawPrice = numericOfferValue(raw.price);
  const rawArea = numericOfferValue(raw.area);
  const yearRaw = raw.yearBuilt != null ? parseInt(String(raw.yearBuilt), 10) : 1900;
  const year = Number.isFinite(yearRaw) ? yearRaw : 1900;

  const parts = [
    { weight: 30, score: locationScore(offer, rf, bounds) },
    { weight: 25, score: upperLimitScore(rawPrice, rf.maxPrice, 0.1) },
    { weight: 15, score: lowerLimitScore(rawArea, rf.minArea, 0.2) },
    { weight: 10, score: yearScore(year, rf.minYear) },
    { weight: 20, score: amenityScore(raw, rf) },
  ];

  const total = parts.reduce((sum, part) => sum + part.weight * part.score, 0);
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  return clampScore(total / Math.max(1, weight));
}

type RadarMapBounds = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

function matchesRadarCalibration(
  offer: MapOffer,
  rf: RadarFilters,
  bounds: RadarMapBounds | null
): boolean {
  return radarMatchScore(offer, rf, bounds) >= Math.max(50, Math.min(100, rf.matchThreshold));
}

function isRadarFactoryDefaults(f: RadarFilters): boolean {
  return (
    f.calibrationMode === 'MAP' &&
    f.transactionType === 'SELL' &&
    f.propertyType === 'ALL' &&
    f.city === 'Warszawa' &&
    f.selectedDistricts.length === 0 &&
    f.maxPrice === 5000000 &&
    f.minArea === 0 &&
    f.minYear === 1900 &&
    !f.requireBalcony &&
    !f.requireGarden &&
    !f.requireElevator &&
    !f.requireParking &&
    !f.requireFurnished &&
    f.matchThreshold === 100
  );
}

export default function RadarHomeScreen({ navigation, route, splashDone }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';
  const { user, isRadarActive, setRadarActive, token } = useAuthStore() as any;

  const mapRef = useRef<MapViewCore | null>(null);
  const listRef = useRef<FlatList<any> | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const pendingSearchMapFocusRef = useRef<string | null>(null);

  const [isRadarEnabled, setIsRadarEnabled] = useState(!!isRadarActive);
  const [searchQuery, setSearchQuery] = useState('');
  const [offers, setOffers] = useState<MapOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(!!route?.params?.favoritesOnly);
  const [favoritesMapScope, setFavoritesMapScope] = useState<'FAVORITES' | 'MINE'>('FAVORITES');
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showFavoritesCalibration, setShowFavoritesCalibration] = useState(false);
  const [calibrationSessionId, setCalibrationSessionId] = useState(0);
  const [favoritesCalibrationSessionId, setFavoritesCalibrationSessionId] = useState(0);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const [isMapMoving, setIsMapMoving] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    transactionType: 'SELL',
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    city: '',
    districts: [],
    propertyType: 'ALL',
  });
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<AdvancedFilters>({
    transactionType: 'SELL',
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    city: '',
    districts: [],
    propertyType: 'ALL',
  });
  const [draftOfferIdInput, setDraftOfferIdInput] = useState('');
  const [advancedOfferIdBusy, setAdvancedOfferIdBusy] = useState(false);
  /** Bez KeyboardAvoidingView w modalu — tylko padding od klawiatury, żeby sheet się nie „wystrzeliwał” w górę. */
  const [advancedSearchKeyboardInset, setAdvancedSearchKeyboardInset] = useState(0);
  const [pendingMapFocusAfterApply, setPendingMapFocusAfterApply] = useState(false);
  const defaultRadarFilters: RadarFilters = {
    calibrationMode: 'MAP',
    transactionType: 'SELL' as 'RENT' | 'SELL',
    propertyType: 'ALL',
    city: 'Warszawa',
    selectedDistricts: [] as string[],
    maxPrice: 5000000,
    minArea: 0,
    minYear: 1900,
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    pushNotifications: !!isRadarActive,
    matchThreshold: 100,
    favoritesNotifyPriceChange: true,
    favoritesNotifyDealProposals: true,
    favoritesNotifyIncludeAmounts: false,
    favoritesNotifyStatusChange: true,
    favoritesNotifyNewSimilar: true,
  };
  const defaultFavoritesRadarFilters: RadarFilters = {
    ...defaultRadarFilters,
    pushNotifications: false,
  };
  const [radarFilters, setRadarFilters] = useState(defaultRadarFilters);
  const [favoritesRadarFilters, setFavoritesRadarFilters] = useState(defaultFavoritesRadarFilters);
  const [isFavoritesRadarEnabled, setIsFavoritesRadarEnabled] = useState(false);
  /** Po kalibracji / zaznaczeniu obszaru filtry radaru (cena, skala %, krąg mapy) mają wpływać na listę i mapę. */
  const [mapUsesRadarFilters, setMapUsesRadarFilters] = useState(false);
  /** Środek i promień zaznaczone na mapie — przy 100% skali tylko oferty wewnątrz tego kręgu. */
  const [radarMapBounds, setRadarMapBounds] = useState<RadarMapBounds | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [areaPickerDraft, setAreaPickerDraft] = useState<RadarAreaDraft>({
    center: { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude },
    radiusKm: 8,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  });
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const areaRegionRef = useRef<Region | null>(null);
  const areaReticleScale = useRef(new Animated.Value(1)).current;
  const areaReticleOpacity = useRef(new Animated.Value(0.92)).current;
  const areaHaloOpacity = useRef(new Animated.Value(0.28)).current;
  const [areaSummary, setAreaSummary] = useState<string>('');
  const isTablet = width >= 768;
  const topBarTop = useMemo(
    () => insets.top + (isTablet ? 14 : 8),
    [insets.top, isTablet]
  );
  const bottomCardsInset = useMemo(() => {
    const tabBase = Platform.OS === 'ios' ? 18 : 14;
    return tabBase + insets.bottom;
  }, [insets.bottom]);
  const radarButtonTop = useMemo(
    () => topBarTop + (isTablet ? 84 : Platform.OS === 'ios' ? 76 : 68),
    [Platform.OS, isTablet, topBarTop]
  );
  /** Modal „Wyszukiwanie rozszerzone”: niemal pełny ekran — bez obcinania jak przy ~74%. */
  const advancedSheetMaxHeight = useMemo(
    () => Math.round(height - insets.top - Math.max(insets.bottom, 10) - 6),
    [height, insets.top, insets.bottom]
  );
  const radarPulseA = useRef(new Animated.Value(0)).current;
  const radarPulseB = useRef(new Animated.Value(0)).current;
  const favoritesHeartBeat = useRef(new Animated.Value(1)).current;
  const favoritesAuraPulse = useRef(new Animated.Value(0)).current;

  const pulseHaptic = useCallback(async (style: Haptics.ImpactFeedbackStyle | 'selection' | 'success') => {
    try {
      if (style === 'selection') {
        await Haptics.selectionAsync();
      } else if (style === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(style);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    let pulseAAnim: Animated.CompositeAnimation | null = null;
    let pulseBAnim: Animated.CompositeAnimation | null = null;
    if (isRadarEnabled) {
      radarPulseA.setValue(0);
      radarPulseB.setValue(0);
      pulseAAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(radarPulseA, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(radarPulseA, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulseBAnim = Animated.loop(
        Animated.sequence([
          Animated.delay(760),
          Animated.timing(radarPulseB, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(radarPulseB, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulseAAnim.start();
      pulseBAnim.start();
    } else {
      radarPulseA.stopAnimation();
      radarPulseB.stopAnimation();
      radarPulseA.setValue(0);
      radarPulseB.setValue(0);
    }
    return () => {
      pulseAAnim?.stop();
      pulseBAnim?.stop();
    };
  }, [isRadarEnabled, radarPulseA, radarPulseB]);

  useEffect(() => {
    let beatAnim: Animated.CompositeAnimation | null = null;
    let auraAnim: Animated.CompositeAnimation | null = null;
    if (isFavoritesRadarEnabled && showOnlyFavorites) {
      favoritesHeartBeat.setValue(1);
      favoritesAuraPulse.setValue(0);
      beatAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(favoritesHeartBeat, { toValue: 1.12, duration: 360, useNativeDriver: true }),
          Animated.timing(favoritesHeartBeat, { toValue: 0.96, duration: 220, useNativeDriver: true }),
          Animated.timing(favoritesHeartBeat, { toValue: 1, duration: 340, useNativeDriver: true }),
          Animated.delay(180),
        ])
      );
      auraAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(favoritesAuraPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(favoritesAuraPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      beatAnim.start();
      auraAnim.start();
    } else {
      favoritesHeartBeat.stopAnimation();
      favoritesAuraPulse.stopAnimation();
      favoritesHeartBeat.setValue(1);
      favoritesAuraPulse.setValue(0);
    }
    return () => {
      beatAnim?.stop();
      auraAnim?.stop();
    };
  }, [favoritesAuraPulse, favoritesHeartBeat, isFavoritesRadarEnabled, showOnlyFavorites]);

  const BASE_AREA_RETICLE_DIAMETER = Math.min(width * 0.48, 240);
  const [areaReticleDiameter, setAreaReticleDiameter] = useState(BASE_AREA_RETICLE_DIAMETER);
  useEffect(() => {
    setAreaReticleDiameter(BASE_AREA_RETICLE_DIAMETER);
  }, [BASE_AREA_RETICLE_DIAMETER]);
  const areaLensLeft = useMemo(() => Math.round(Math.max(0, (width - areaReticleDiameter) / 2)), [width, areaReticleDiameter]);
  const areaLensTop = useMemo(() => Math.round(Math.max(0, (height - areaReticleDiameter) / 2)), [height, areaReticleDiameter]);

  const locateUserAndCenterMap = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLoc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLocation(nextLoc);
      mapRef.current?.animateToRegion({
        latitude: nextLoc.latitude,
        longitude: nextLoc.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.08,
      }, 500);
    } catch {
      // noop
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (typeof route?.params?.favoritesOnly === 'boolean') {
        setShowOnlyFavorites(route.params.favoritesOnly);
      }
      if (route?.params?.favoritesScope === 'FAVORITES' || route?.params?.favoritesScope === 'MINE') {
        setFavoritesMapScope(route.params.favoritesScope);
      }
    }, [route?.params?.favoritesOnly, route?.params?.favoritesScope])
  );

  useEffect(() => {
    if (!showOnlyFavorites) {
      setFavoritesMapScope('FAVORITES');
    }
  }, [showOnlyFavorites]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SEARCH_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRecentSearches(parsed.filter((x) => typeof x === 'string').slice(0, MAX_RECENT_SEARCHES));
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showAdvancedSearch) {
      setAdvancedSearchKeyboardInset(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      const h = e?.endCoordinates?.height;
      setAdvancedSearchKeyboardInset(typeof h === 'number' && Number.isFinite(h) ? Math.round(h) : 0);
    };
    const onHide = () => setAdvancedSearchKeyboardInset(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [showAdvancedSearch]);

  const persistRecentSearch = useCallback(async (phrase: string) => {
    const t = phrase.trim();
    if (t.length < 2) return;
    setRecentSearches((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const finalizeSearchChoice = useCallback(
    (phrase: string) => {
      const t = phrase.trim();
      setSearchQuery(phrase);
      if (t.length >= 2) pendingSearchMapFocusRef.current = t;
      else pendingSearchMapFocusRef.current = null;
      void persistRecentSearch(phrase);
      setIsSearchFocused(false);
      Keyboard.dismiss();
      Haptics.selectionAsync();
    },
    [persistRecentSearch]
  );

  const haystackForOffer = useCallback((o: MapOffer) => {
    return normalizeSearchText(
      [
        o.type,
        String(o.raw?.city ?? ''),
        String(o.raw?.district ?? ''),
        String(o.raw?.street ?? ''),
        String(o.raw?.address ?? ''),
        String(o.raw?.title ?? ''),
      ].join(' ')
    );
  }, []);

  const normalizedSearchTokens = useMemo(() => {
    const t = normalizeSearchText(searchQuery.trim());
    return t.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const rankedPlaceSuggestions = useMemo((): RankedSuggestion[] => {
    const rawQ = searchQuery.trim();
    if (rawQ.length < 2) return [];
    const qFold = normalizeSearchText(rawQ);
    if (!qFold) return [];

    type Acc = { value: string; category: string; count: number; score: number };
    const map = new Map<string, Acc>();

    const bump = (value: string | undefined | null, categoryPl: string) => {
      if (!value || typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      const vFold = normalizeSearchText(trimmed);
      if (!vFold.includes(qFold)) return;
      const key = `${categoryPl}|${trimmed}`;
      const vStarts = vFold.startsWith(qFold) ? 12 : 0;
      const shortBonus = Math.max(0, 24 - Math.min(24, trimmed.length));
      const score = vStarts + shortBonus;
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        cur.score = Math.max(cur.score, score);
      } else {
        map.set(key, { value: trimmed, category: categoryPl, count: 1, score });
      }
    };

    offers.forEach((o) => {
      bump(o.raw?.city, 'Miasto');
      bump(o.raw?.district, 'Dzielnica');
      bump(o.raw?.street, 'Ulica');
      bump(o.raw?.address, 'Adres');
      const title = String(o.raw?.title ?? '').trim();
      if (title && normalizeSearchText(title).includes(qFold)) {
        const key = `Tytuł|${title}`;
        const vFold = normalizeSearchText(title);
        const vStarts = vFold.startsWith(qFold) ? 12 : 0;
        const cur = map.get(key);
        const sc = vStarts + Math.max(0, 12 - Math.min(12, title.length));
        if (cur) {
          cur.count += 1;
          cur.score = Math.max(cur.score, sc);
        } else {
          map.set(key, { value: title, category: 'Oferta', count: 1, score: sc });
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score || b.count - a.count || a.value.localeCompare(b.value, 'pl'))
      .slice(0, 14)
      .map((x, i) => ({
        key: `${x.category}-${x.value}-${i}`,
        value: x.value,
        category: x.category,
        count: x.count,
      }));
  }, [offers, searchQuery]);

  const backendCities = useMemo(() => {
    return [...STRICT_CITIES].sort((a, b) => a.localeCompare(b, 'pl'));
  }, []);

  const backendDistrictsForDraftCity = useMemo(() => {
    const selectedCity = draftAdvancedFilters.city.trim();
    if (!selectedCity) return [] as string[];
    return getStrictDistrictsForCity(selectedCity);
  }, [draftAdvancedFilters.city]);

  const searchOnlyMatchCount = useMemo(() => {
    if (normalizedSearchTokens.length === 0) return offers.length;
    return offers.filter((o) => normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok))).length;
  }, [offers, normalizedSearchTokens, haystackForOffer]);

  const hasAdvancedFiltersActive = useMemo(() => {
    return Boolean(
      advancedFilters.transactionType !== 'SELL' ||
      advancedFilters.minPrice !== null ||
      advancedFilters.maxPrice !== null ||
      advancedFilters.minArea !== null ||
      advancedFilters.maxArea !== null ||
      advancedFilters.city.trim() ||
      advancedFilters.districts.length > 0 ||
      advancedFilters.propertyType !== 'ALL'
    );
  }, [advancedFilters]);

  const modeAccentColor = advancedFilters.transactionType === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;
  const draftModeAccentColor = draftAdvancedFilters.transactionType === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;

  const renderLuxuryCluster = useCallback(
    (clusterData: any) => {
      const { geometry, properties, onPress, clusterColor } = clusterData;
      const count = Number(properties.point_count ?? 0);
      const coords = {
        longitude: Number(geometry?.coordinates?.[0]),
        latitude: Number(geometry?.coordinates?.[1]),
      };
      if (!hasFiniteCoords(coords.latitude, coords.longitude)) return null;
      const accent = (clusterColor as string) || modeAccentColor;
      const luxColors = markerLuxuryGradient(accent);
      const { diameter, halo, fontSize } = clusterBubbleDimensions(count);
      const cid = clusterData.id ?? `${coords.latitude}_${coords.longitude}_${count}`;
      const haloTint = accent.length === 7 ? `${accent}44` : accent;
      return (
        <Marker
          key={`cluster-${cid}`}
          coordinate={coords}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress?.();
          }}
          style={{ zIndex: count + 800 }}
          tracksViewChanges={false}
        >
          <View style={[styles.clusterOuter, { width: halo, height: halo, shadowColor: accent }]}>
            <View
              style={[
                styles.clusterHalo,
                {
                  width: halo,
                  height: halo,
                  borderRadius: halo / 2,
                  backgroundColor: haloTint,
                },
              ]}
            />
            <LinearGradient
              colors={luxColors}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={[
                styles.clusterDisk,
                {
                  width: diameter,
                  height: diameter,
                  borderRadius: diameter / 2,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)', 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.48 }}
                style={[styles.clusterHighlight, { borderRadius: diameter / 2 }]}
                pointerEvents="none"
              />
              <Text style={[styles.clusterCountText, { fontSize }]}>{formatClusterCount(count)}</Text>
            </LinearGradient>
          </View>
        </Marker>
      );
    },
    [modeAccentColor]
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      if (!splashDone) return () => { mounted = false; };

      const run = async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!mounted) return;

          if (permission.status === 'granted') {
            await locateUserAndCenterMap();
            return;
          }

          if (hasAskedLocationInCurrentSession) return;
          hasAskedLocationInCurrentSession = true;

          Alert.alert(
            'Lokalizacja',
            'Czy chcesz udostępnić położenie, aby od razu pokazać nieruchomości w okolicy?',
            [
              { text: 'Nie teraz', style: 'cancel' },
              {
                text: 'Zezwól',
                onPress: async () => {
                  try {
                    const req = await Location.requestForegroundPermissionsAsync();
                    if (!mounted || req.status !== 'granted') return;
                    await locateUserAndCenterMap();
                  } catch {
                    // noop
                  }
                },
              },
            ]
          );
        } catch {
          // noop
        }
      };

      run();
      return () => {
        mounted = false;
      };
    }, [locateUserAndCenterMap, splashDone])
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const fetchOffers = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/api/mobile/v1/offers`);
          const data = await res.json();
          if (!mounted) return;
          if (res.ok && data?.success && Array.isArray(data?.offers)) {
            const mapped = data.offers
              .filter((o: any) => Number.isFinite(Number(o?.lat)) && Number.isFinite(Number(o?.lng)))
              .map((o: any): MapOffer => {
                let firstImage: string | null = null;
                try {
                  const parsed = typeof o.images === 'string' ? JSON.parse(o.images) : o.images;
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    firstImage = toAbsoluteImage(parsed[0]);
                  }
                } catch {
                  firstImage = null;
                }
                const propertyLabel = o.propertyType === 'FLAT'
                  ? 'Mieszkanie'
                  : o.propertyType === 'HOUSE'
                    ? 'Dom'
                    : o.propertyType === 'PLOT'
                      ? 'Działka'
                      : 'Lokal';
                return {
                  id: o.id,
                  price: `${Number(o.price || 0).toLocaleString('pl-PL')} PLN`,
                  type: `${propertyLabel} • ${o.district || o.city || 'Lokalizacja'}`,
                  area: `${o.area || 0} m²`,
                  rooms: `${o.rooms || '-'} pok.`,
                  lat: Number(o.lat),
                  lng: Number(o.lng),
                  image: firstImage,
                  raw: o,
                };
              });
            setOffers(mapped);
          } else {
            setOffers([]);
          }
        } catch {
          if (mounted) setOffers([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      fetchOffers();
      return () => {
        mounted = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadFavorites = async () => {
        try {
          const raw = await AsyncStorage.getItem('@estateos_favorites');
          if (!mounted) return;
          setFavorites(raw ? JSON.parse(raw) : []);
        } catch {
          if (mounted) setFavorites([]);
        }
      };
      loadFavorites();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const filteredOffers = useMemo(() => {
    const isMyOffer = (offer: MapOffer) => {
      const myId = Number(user?.id || 0);
      if (!myId) return false;
      const ownerCandidateIds = [
        offer.raw?.userId,
        offer.raw?.ownerId,
        offer.raw?.sellerId,
        offer.raw?.authorId,
        offer.raw?.createdById,
        offer.raw?.user?.id,
        offer.raw?.owner?.id,
        offer.raw?.seller?.id,
        offer.raw?.createdBy?.id,
      ]
        .map((v) => Number(v || 0))
        .filter((v) => Number.isFinite(v) && v > 0);
      return ownerCandidateIds.includes(myId);
    };

    const matchesAdvancedFilters = (offer: MapOffer) => {
      const rawPrice = Number(String(offer.raw?.price ?? '').replace(/[^\d]/g, '')) || 0;
      const rawArea = Number(String(offer.raw?.area ?? '').replace(',', '.')) || 0;
      const rawCity = normalizeSearchText(String(offer.raw?.city || '').trim());
      const rawDistrict = normalizeSearchText(String(offer.raw?.district || '').trim());
      const rawPropertyType = String(offer.raw?.propertyType || '').toUpperCase();
      const rawTransactionType = String(offer.raw?.transactionType || '').toUpperCase();
      if (rawTransactionType !== advancedFilters.transactionType) return false;
      if (advancedFilters.minPrice !== null && rawPrice < advancedFilters.minPrice) return false;
      if (advancedFilters.maxPrice !== null && rawPrice > advancedFilters.maxPrice) return false;
      if (advancedFilters.minArea !== null && rawArea < advancedFilters.minArea) return false;
      if (advancedFilters.maxArea !== null && rawArea > advancedFilters.maxArea) return false;
      const selectedCity = normalizeSearchText(advancedFilters.city.trim());
      if (selectedCity && !radarCityMatches(rawCity, selectedCity)) return false;
      if (
        advancedFilters.districts.length > 0 &&
        !advancedFilters.districts.some((d) => normalizeSearchText(d.trim()) === rawDistrict)
      ) return false;
      if (advancedFilters.propertyType !== 'ALL' && rawPropertyType !== advancedFilters.propertyType) return false;
      return true;
    };
    const favoriteOffers = offers.filter((o) => favorites.includes(Number(o.id)));
    const myOffers = offers.filter(isMyOffer);
    const queryFiltered =
      normalizedSearchTokens.length === 0
        ? offers
        : offers.filter((o) => normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok)));
    const advancedFiltered = queryFiltered.filter(matchesAdvancedFilters);

    // Radar LIVE działa niezależnie od listy/mapy wyników:
    // kalibracja służy do logiki Radaru/Push, a wyszukiwanie rozszerzone odpowiada za wyniki wyszukiwania.
    const shouldApplyRadarToMapResults = false && mapUsesRadarFilters && !hasAdvancedFiltersActive;
    const applyRadar = (list: MapOffer[]) =>
      shouldApplyRadarToMapResults ? list.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds)) : list;
    const radarFiltered = applyRadar(advancedFiltered);

    if (showOnlyFavorites) {
      const scopedBase = favoritesMapScope === 'MINE' ? myOffers : favoriteOffers;
      const scopedAndAdvanced = applyRadar(scopedBase.filter(matchesAdvancedFilters));
      if (!userLocation) return scopedAndAdvanced;
      const sortedScoped = scopedAndAdvanced
        .map((o) => ({ offer: o, distance: distanceKm(userLocation.latitude, userLocation.longitude, o.lat, o.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .map((x) => x.offer);
      return sortedScoped;
    }
    
    if (!userLocation) {
      if (hasAdvancedFiltersActive) return radarFiltered;
      const pinned = [...radarFiltered];
      favoriteOffers.forEach((fav) => {
        if (!pinned.some((o) => Number(o.id) === Number(fav.id))) pinned.push(fav);
      });
      return pinned;
    }

    const withDistance = radarFiltered
      .map((o) => ({ offer: o, distance: distanceKm(userLocation.latitude, userLocation.longitude, o.lat, o.lng) }))
      .sort((a, b) => a.distance - b.distance);
    const nearby = withDistance.filter((x) => x.distance <= 25).map((x) => x.offer);
    const baseList = nearby.length > 0 ? nearby : withDistance.map((x) => x.offer);
    if (hasAdvancedFiltersActive) return baseList;
    const pinned = [...baseList];
    favoriteOffers.forEach((fav) => {
      if (!pinned.some((o) => Number(o.id) === Number(fav.id))) pinned.push(fav);
    });
    return pinned;
  }, [
    offers,
    normalizedSearchTokens,
    haystackForOffer,
    showOnlyFavorites,
    favoritesMapScope,
    favorites,
    user?.id,
    userLocation,
    advancedFilters,
    hasAdvancedFiltersActive,
    mapUsesRadarFilters,
    radarFilters,
    radarMapBounds,
  ]);

  const activeOffers = filteredOffers;

  const focusMapToOffers = useCallback((items: MapOffer[]) => {
    if (!mapRef.current || items.length === 0) return;
    if (items.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: items[0].lat,
          longitude: items[0].lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.02,
        },
        650
      );
      return;
    }
    const coords = items
      .map((o) => ({ latitude: Number(o.lat), longitude: Number(o.lng) }))
      .filter((c) => hasFiniteCoords(c.latitude, c.longitude));
    if (coords.length === 0) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 80, bottom: 280, left: 80 },
      animated: true,
    });
  }, []);

  useEffect(() => {
    const pending = pendingSearchMapFocusRef.current;
    if (pending === null) return;
    if (normalizeSearchText(searchQuery.trim()) !== normalizeSearchText(pending)) return;
    pendingSearchMapFocusRef.current = null;

    let cancelled = false;
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        if (activeOffers.length === 0) return;
        focusMapToOffers(activeOffers);
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, Platform.OS === 'ios' ? 120 : 80);
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, activeOffers, focusMapToOffers]);

  const openRadarCalibration = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalibrationSessionId((prev) => prev + 1);
    setShowCalibration(true);
  };

  const openFavoritesCalibration = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavoritesCalibrationSessionId((prev) => prev + 1);
    setShowFavoritesCalibration(true);
  };

  const resolveOfferById = useCallback(async (id: number): Promise<any | null> => {
    const headers = token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : undefined;
    const [mobileRes, webRes] = await Promise.allSettled([
      fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`, { headers }),
      fetch(`${API_URL}/api/offers/${id}`),
    ]);
    let candidate: any = null;
    if (mobileRes.status === 'fulfilled' && mobileRes.value.ok) {
      try {
        const mobileJson = await mobileRes.value.json();
        const list = Array.isArray(mobileJson?.offers) ? mobileJson.offers : [];
        candidate = list.find((o: any) => Number(o?.id || 0) === id) || null;
      } catch {
        /* noop */
      }
    }
    if (!candidate && webRes.status === 'fulfilled' && webRes.value.ok) {
      try {
        const webJson = await webRes.value.json();
        candidate = webJson?.offer || webJson?.data || (webJson?.id ? webJson : null);
      } catch {
        /* noop */
      }
    }
    return candidate;
  }, [token]);

  const applyAdvancedFilters = async () => {
    const digitsOnly = draftOfferIdInput.replace(/\D/g, '');
    if (digitsOnly) {
      const id = Number(digitsOnly);
      if (Number.isFinite(id) && id > 0) {
        setAdvancedOfferIdBusy(true);
        Keyboard.dismiss();
        try {
          const found = await resolveOfferById(id);
          if (found) {
            setShowAdvancedSearch(false);
            setDraftOfferIdInput('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate('OfferDetail', { offer: found });
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert('EstateOS', 'Nie znaleziono oferty o podanym numerze.');
          return;
        } finally {
          setAdvancedOfferIdBusy(false);
        }
      }
    }

    setAdvancedFilters(draftAdvancedFilters);
    setPendingMapFocusAfterApply(true);
    setShowAdvancedSearch(false);
    Haptics.selectionAsync();
  };

  const resetAdvancedFilters = () => {
    const reset: AdvancedFilters = {
      transactionType: 'SELL',
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      city: '',
      districts: [],
      propertyType: 'ALL',
    };
    setDraftAdvancedFilters(reset);
    setAdvancedFilters(reset);
    setDraftOfferIdInput('');
    setPendingMapFocusAfterApply(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useFocusEffect(
    useCallback(() => {
      if (!pendingMapFocusAfterApply) return;
      if (activeOffers.length === 0) {
        setPendingMapFocusAfterApply(false);
        return;
      }
      const t = setTimeout(() => {
        focusMapToOffers(activeOffers);
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setPendingMapFocusAfterApply(false);
      }, 120);
      return () => clearTimeout(t);
    }, [pendingMapFocusAfterApply, activeOffers, focusMapToOffers])
  );

  const syncRadarPreferencesToBackend = async (payload: typeof radarFilters) => {
    if (!user?.id) return;
    try {
      await fetch(`${API_URL}/api/radar/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionType: payload.transactionType,
          propertyType: payload.propertyType === 'ALL' ? null : payload.propertyType,
          city: payload.city,
          selectedDistricts: payload.selectedDistricts || [],
          maxPrice: payload.maxPrice ?? null,
          minArea: payload.minArea ?? null,
          minYear: payload.minYear ?? null,
          requireBalcony: !!payload.requireBalcony,
          requireGarden: !!payload.requireGarden,
          requireElevator: !!payload.requireElevator,
          requireParking: !!payload.requireParking,
          requireFurnished: !!payload.requireFurnished,
          pushNotifications: payload.pushNotifications !== false,
          minMatchThreshold: payload.matchThreshold,
        }),
      });
    } catch {
      // noop
    }
  };

  const applyRadarCalibration = async (filtersToApply: RadarFilters) => {
    setRadarFilters(filtersToApply);
    if (isRadarFactoryDefaults(filtersToApply)) {
      setMapUsesRadarFilters(false);
      setRadarMapBounds(null);
      setAreaSummary('');
    } else {
      setMapUsesRadarFilters(true);
    }
    await setRadarActive(filtersToApply.pushNotifications);
    setIsRadarEnabled(filtersToApply.pushNotifications);
    await syncRadarPreferencesToBackend(filtersToApply);
    setShowCalibration(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const applyFavoritesCalibration = async (filtersToApply: RadarFilters) => {
    setFavoritesRadarFilters(filtersToApply);
    setIsFavoritesRadarEnabled(filtersToApply.pushNotifications);
    // Preferencje Ulubionych → backend (może ignorować nieznane pola; ważne, by kontrakt nie blokował).
    void (async () => {
      try {
        if (user?.id) {
          await fetch(`${API_URL}/api/radar/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              variant: 'FAVORITES',
              pushNotifications: filtersToApply.pushNotifications !== false,
              favoritesNotifyPriceChange: !!filtersToApply.favoritesNotifyPriceChange,
              favoritesNotifyDealProposals: !!filtersToApply.favoritesNotifyDealProposals,
              favoritesNotifyIncludeAmounts: !!filtersToApply.favoritesNotifyIncludeAmounts,
              favoritesNotifyStatusChange: !!filtersToApply.favoritesNotifyStatusChange,
              favoritesNotifyNewSimilar: !!filtersToApply.favoritesNotifyNewSimilar,
            }),
          });
        }
      } catch {
        // noop
      }
    })();

    // Preferencje push per-device (produkcyjnie: backend może upsert po expoPushToken).
    if (token) {
      void syncPushDevicePreferences({
        authToken: token,
        devicePreferences: {
          favorites: {
            enabled: filtersToApply.pushNotifications !== false,
            notifyPriceChange: !!filtersToApply.favoritesNotifyPriceChange,
            notifyDealProposals: !!filtersToApply.favoritesNotifyDealProposals,
            notifyIncludeAmounts: !!filtersToApply.favoritesNotifyIncludeAmounts,
            notifyStatusChange: !!filtersToApply.favoritesNotifyStatusChange,
            notifyNewSimilar: !!filtersToApply.favoritesNotifyNewSimilar,
          },
        },
      });
    }
    setShowFavoritesCalibration(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getAreaSummaryPreview = useCallback(
    (filters: RadarFilters): string | undefined => {
      const offersInPreview = offers.filter((offer) => matchesRadarCalibration(offer, filters, radarMapBounds));
      if (filters.calibrationMode === 'CITY') {
        const districtLabel =
          filters.selectedDistricts.length > 0
            ? `${filters.selectedDistricts.length} dzielnic`
            : 'wszystkie dzielnice';
        return `${filters.city} • ${districtLabel} • ${offersInPreview.length} ${pluralOffers(offersInPreview.length)}`;
      }
      if (!radarMapBounds) return areaSummary || undefined;
      const radiusKm = radarGeoRadiusLimitKm(radarMapBounds.radiusKm, filters.matchThreshold);
      return `${filters.city} • ${radiusKm.toFixed(1)} km • ${offersInPreview.length} ${pluralOffers(offersInPreview.length)}`;
    },
    [radarMapBounds, areaSummary, offers]
  );

  const getMatchingOffersCountPreview = useCallback(
    (filters: RadarFilters): number => {
      return offers.filter((offer) => matchesRadarCalibration(offer, filters, radarMapBounds)).length;
    },
    [offers, radarMapBounds]
  );

  const handleMapRegionChange = (region: Region) => {
    if (!showAreaPicker) return;
    areaRegionRef.current = region;
    if (!isMapMoving) {
      setIsMapMoving(true);
      Animated.parallel([
        Animated.spring(areaReticleScale, {
          toValue: 1.06,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(areaReticleOpacity, {
          toValue: 0.78,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(areaHaloOpacity, {
          toValue: 0.12,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (!mapLayout.width || !mapLayout.height) return;
    const { kmPerPxAvg } = approxKmPerPixel(
      region,
      mapLayout.width,
      mapLayout.height
    );
    const nextRadius = clamp(
      (areaReticleDiameter / 2) * kmPerPxAvg,
      0.3,
      10
    );
    setAreaPickerDraft((prev) => ({
      ...prev,
      center: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      radiusKm: Math.round(nextRadius * 10) / 10,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    }));
  };

  const handleMapRegionChangeComplete = (region: Region) => {
    if (!showAreaPicker) return;
    areaRegionRef.current = region;
    if (!mapLayout.width || !mapLayout.height) {
      setIsMapMoving(false);
      return;
    }
    const { kmPerPxAvg } = approxKmPerPixel(
      region,
      mapLayout.width,
      mapLayout.height
    );
    const nextRadius = clamp(
      (areaReticleDiameter / 2) * kmPerPxAvg,
      0.3,
      10
    );
    setAreaPickerDraft((prev) => ({
      ...prev,
      center: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      radiusKm: Math.round(nextRadius * 10) / 10,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    }));
    setIsMapMoving(false);
    Animated.parallel([
      Animated.spring(areaReticleScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(areaReticleOpacity, {
        toValue: 0.95,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(areaHaloOpacity, {
        toValue: 0.26,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const openAreaPickerFromCalibration = (currentFilters: RadarFilters) => {
    setRadarFilters(currentFilters);
    const baseCenter = userLocation || areaPickerDraft.center;
    setAreaPickerDraft((prev) => ({
      ...prev,
      center: baseCenter,
      latitudeDelta: 0.16,
      longitudeDelta: 0.12,
    }));
    setShowCalibration(false);
    setShowAreaPicker(true);
    mapRef.current?.animateToRegion(
      {
        latitude: baseCenter.latitude,
        longitude: baseCenter.longitude,
        latitudeDelta: 0.16,
        longitudeDelta: 0.12,
      },
      550
    );
    void pulseHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const applyAreaSelectionToRadar = async () => {
    const center = areaPickerDraft.center;
    const radius = areaPickerDraft.radiusKm;
    const offersInArea = offers.filter((o) => distanceKm(center.latitude, center.longitude, o.lat, o.lng) <= radius);

    const cityCount = new Map<string, number>();
    for (const offer of offersInArea) {
      const city = String(offer.raw?.city || '').trim();
      if (!city) continue;
      cityCount.set(city, (cityCount.get(city) || 0) + 1);
    }

    let selectedCity =
      cityCount.size > 0
        ? Array.from(cityCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : radarFilters.city;

    if (cityCount.size === 0) {
      try {
        const reverse = await Location.reverseGeocodeAsync(center);
        const place = reverse?.[0];
        const cityGuess = String(place?.city || place?.subregion || place?.region || '').trim();
        if (cityGuess) selectedCity = cityGuess;
      } catch {
        // noop
      }
    }

    const strictMatchCity =
      STRICT_CITIES.find((cityName) => normalizeSearchText(cityName) === normalizeSearchText(selectedCity)) ||
      STRICT_CITIES.find((cityName) => normalizeSearchText(cityName) === normalizeSearchText(radarFilters.city)) ||
      STRICT_CITIES[0];
    const updated: RadarFilters = {
      ...radarFilters,
      calibrationMode: 'MAP',
      city: strictMatchCity,
      selectedDistricts: [],
    };

    setRadarFilters(updated);
    setRadarMapBounds({
      centerLat: center.latitude,
      centerLng: center.longitude,
      radiusKm: radius,
    });
    setMapUsesRadarFilters(true);
    setAreaSummary(
      `${strictMatchCity} • ${radius.toFixed(1)} km • ${offersInArea.length} ofert`
    );
    setShowAreaPicker(false);
    setShowCalibration(true);
    void pulseHaptic('success');
  };

  const toggleFavorite = async (offerId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = favorites.includes(offerId)
      ? favorites.filter((id) => id !== offerId)
      : [...favorites, offerId];
    setFavorites(next);
    try {
      await AsyncStorage.setItem('@estateos_favorites', JSON.stringify(next));
    } catch {
      // noop
    }
  };

  const focusOffer = (index: number) => {
    const offer = activeOffers[index];
    if (!offer) return;
    mapRef.current?.animateToRegion({
      latitude: offer.lat,
      longitude: offer.lng,
      latitudeDelta: 0.035,
      longitudeDelta: 0.02,
    }, 350);
    setActiveIndex(index);
  };

  const renderOfferCard = ({ item, index }: any) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        focusOffer(index);
        navigation.navigate('OfferDetail', { offer: item.raw });
      }}
      style={[
        styles.offerCard,
        {
          width: width * 0.85,
          backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      <View style={styles.cardImageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="home" size={22} color="#8E8E93" />
          </View>
        )}
        <View style={[styles.transactionBadge, styles.transactionBadgeOnImage, { backgroundColor: getTransactionBadge(item.raw?.transactionType).color }]}>
          <Text style={styles.transactionBadgeText}>{getTransactionBadge(item.raw?.transactionType).label}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardPrice, { color: isDark ? '#FFF' : '#1C1C1E' }]} numberOfLines={1}>
            {item.price}
          </Text>
          <Pressable
            onPress={() => toggleFavorite(Number(item.id))}
            hitSlop={10}
          >
            <Ionicons
              name={favorites.includes(Number(item.id)) ? 'heart' : 'heart-outline'}
              size={22}
              color={favorites.includes(Number(item.id)) ? '#FF3B30' : '#8E8E93'}
            />
          </Pressable>
        </View>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{item.type}</Text>

        <View style={styles.cardBadgesRow}>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="resize" size={12} color="#8E8E93" />
            <Text style={[styles.badgeText, { color: isDark ? '#E5E5EA' : '#1C1C1E' }]}>{item.area}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="bed" size={12} color="#8E8E93" />
            <Text style={[styles.badgeText, { color: isDark ? '#E5E5EA' : '#1C1C1E' }]}>{item.rooms}</Text>
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          <View style={styles.cardFooterTopRow}>
            <Text style={styles.offerIdText}>ID: {item.id}</Text>
            <View style={styles.amenitiesInlineRow}>
              {[
                { key: 'garden', icon: 'leaf', enabled: !!item.raw?.hasGarden },
                { key: 'parking', icon: 'car', enabled: !!item.raw?.hasParking },
                { key: 'balcony', icon: 'sunny', enabled: !!item.raw?.hasBalcony },
                { key: 'elevator', icon: 'arrow-up', enabled: !!item.raw?.hasElevator },
                { key: 'furnished', icon: 'cube', enabled: !!item.raw?.isFurnished },
              ]
                .filter((amenity) => amenity.enabled)
                .map((amenity) => (
                  <Ionicons key={amenity.key} name={amenity.icon as any} size={14} color="#10B981" />
                ))}
            </View>
          </View>
          <Text style={styles.publishDateText}>{formatOfferPublishDate(item.raw)}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <>
    <View style={styles.container}>
      <RadarMapComponent
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        onLayout={(e: any) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setMapLayout({ width: w, height: h });
        }}
        initialRegion={DEFAULT_REGION}
        onRegionChange={handleMapRegionChange}
        onRegionChangeComplete={handleMapRegionChangeComplete}
        mapType={mapType}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        showsUserLocation
        showsCompass={false}
        {...(Platform.OS === 'ios'
          ? {}
          : {
              radius: 52,
              maxZoom: 20,
              minZoom: 1,
              minPoints: 2,
              extent: 512,
              animationEnabled: false,
              clusterColor: modeAccentColor,
              clusterTextColor: '#FFFFFF',
              renderCluster: renderLuxuryCluster,
              spiralEnabled: false,
              preserveClusterPressBehavior: true,
              edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            })}
      >
        {activeOffers.map((offer, idx) => {
          const isSelected = activeIndex === idx;
          const markerAccent = offerMarkerAccent(offer.raw);
          const luxColors = markerLuxuryGradient(markerAccent);
          const lat = Number(offer.lat);
          const lng = Number(offer.lng);
          if (!hasFiniteCoords(lat, lng)) return null;
          return (
            <Marker
              key={String(offer.id ?? idx)}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
              onPress={() => {
                Haptics.selectionAsync();
                focusOffer(idx);
                listRef.current?.scrollToIndex({ index: idx, animated: true });
              }}
            >
              <View style={[styles.markerOuter, isSelected && styles.markerOuterSelected, { shadowColor: markerAccent }]}>
                <LinearGradient
                  colors={luxColors}
                  start={{ x: 0.12, y: 0 }}
                  end={{ x: 0.88, y: 1 }}
                  style={[styles.markerCapsule, isSelected && styles.markerCapsuleSelected]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)', 'transparent']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.55 }}
                    style={styles.markerHighlight}
                    pointerEvents="none"
                  />
                  <Text style={styles.mapMarkerText}>{formatMarkerPrice(offer.price)}</Text>
                </LinearGradient>
                <View style={[styles.markerPinTail, { borderTopColor: luxColors[2] }]} />
              </View>
            </Marker>
          );
        })}
      </RadarMapComponent>

      {showOnlyFavorites && (
        <View pointerEvents="none" style={styles.favoritesMapDecorLayer}>
          {FAVORITES_MAP_HEARTS.map((h, idx) => (
            <Animated.View
              key={`map-heart-${idx}`}
              style={[
                styles.favoritesMapHeart,
                {
                  left: h.left,
                  top: h.top,
                  transform: [
                    { translateX: -h.size / 2 },
                    { translateY: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0, h.drift] }) },
                    { scale: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.14] }) },
                  ],
                  opacity: isFavoritesRadarEnabled
                    ? favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.64] })
                    : 0.18,
                },
              ]}
            >
              <Ionicons
                name={idx % 4 === 0 ? 'heart' : idx % 7 === 0 ? 'heart-outline' : 'sparkles-outline'}
                size={h.size}
                color={idx % 3 === 0 ? 'rgba(255,141,196,0.85)' : 'rgba(246,119,178,0.72)'}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {isSearchFocused && (
        <Pressable
          style={styles.searchBackdrop}
          onPress={() => {
            Keyboard.dismiss();
            setIsSearchFocused(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="Zamknij pole wyszukiwania"
        />
      )}

      <View style={[styles.topBarContainer, { top: topBarTop }]}>
        <View style={styles.searchBarSlot}>
          <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.searchGlass}>
            <Ionicons name="search" size={20} color={isDark ? '#FFF' : '#1C1C1E'} style={{ marginLeft: 16 }} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
              placeholder="Miasto, dzielnica, ulica…"
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              onSubmitEditing={() => finalizeSearchChoice(searchQuery)}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                hitSlop={10}
                style={styles.searchClearBtn}
                accessibilityLabel="Wyczyść wyszukiwanie"
              >
                <Ionicons name="close-circle" size={22} color="#8E8E93" />
              </Pressable>
            )}
          </BlurView>
        </View>

        <Pressable
          style={({ pressed }) => [styles.filterButtonWrap, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'));
          }}
        >
          <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.filterGlass}>
            <Ionicons name="map" size={22} color={isDark ? '#FFF' : '#1C1C1E'} />
          </BlurView>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.filterButtonWrap, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDraftAdvancedFilters(advancedFilters);
            setShowAdvancedSearch(true);
          }}
        >
          <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={styles.filterGlass}>
            <Ionicons name="options" size={22} color={isDark ? '#FFF' : '#1C1C1E'} />
            {hasAdvancedFiltersActive && <View style={[styles.filterActiveDot, { backgroundColor: modeAccentColor }]} />}
          </BlurView>
        </Pressable>
      </View>

      {showOnlyFavorites && (
        <View style={[styles.favorFloatingIslandWrap, { top: topBarTop + (isTablet ? 66 : 60) }]}>
          <View style={styles.radarHeroWrap}>
            {isFavoritesRadarEnabled && (
              <View pointerEvents="none" style={styles.radarPulseLayer}>
                <Animated.View
                  style={[
                    styles.favoritesAuraWave,
                    {
                      borderColor: 'rgba(235,112,168,0.48)',
                      opacity: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0] }),
                      transform: [{ scale: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.85] }) }],
                    },
                  ]}
                />
                {[
                  { x: -72, y: -8, size: 10 },
                  { x: -44, y: -28, size: 8 },
                  { x: -16, y: -36, size: 9 },
                  { x: 20, y: -34, size: 10 },
                  { x: 52, y: -18, size: 8 },
                  { x: 74, y: 2, size: 9 },
                  { x: -68, y: 20, size: 8 },
                  { x: 48, y: 22, size: 8 },
                ].map((heart, idx) => (
                  <Animated.View
                    key={`fav-heart-${idx}`}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: [
                        { translateX: heart.x },
                        { translateY: heart.y },
                        { scale: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.2] }) },
                      ],
                      opacity: favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.08] }),
                    }}
                  >
                    <Ionicons name="heart" size={heart.size} color="rgba(247,117,172,0.72)" />
                  </Animated.View>
                ))}
              </View>
            )}
            <Pressable onPress={openFavoritesCalibration} style={({ pressed }) => [styles.radarBtnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}>
              <BlurView
                intensity={95}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.radarPill,
                  {
                    backgroundColor: isFavoritesRadarEnabled ? 'rgba(232,108,165,0.22)' : 'rgba(255,255,255,0.1)',
                  },
                ]}
              >
                <Animated.View style={{ transform: [{ scale: favoritesHeartBeat }] }}>
                  <Ionicons
                    name={isFavoritesRadarEnabled ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFavoritesRadarEnabled ? '#F777B2' : '#8E8E93'}
                  />
                </Animated.View>
                <View style={styles.radarPillTextWrap}>
                  <Text style={[styles.radarTitle, { color: isFavoritesRadarEnabled ? '#F777B2' : '#8E8E93' }]}>EstateOS™ Favor</Text>
                  <Text style={styles.radarStatus}>{isFavoritesRadarEnabled ? 'Status: LOVE LIVE' : 'Status: NIEAKTYWNY'}</Text>
                </View>
              </BlurView>
            </Pressable>
          </View>
        </View>
      )}
      
      {isSearchFocused && (
        <View style={[styles.suggestionsWrap, { top: Platform.OS === 'ios' ? 113 : 98 }]}>
          <BlurView
            intensity={isDark ? 85 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.suggestionsGlass, { maxHeight: Math.min(height * 0.52, 440) }]}
          >
            <ScrollView
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {searchQuery.trim().length === 0 && (
                <>
                  <Text style={[styles.smartSectionTitle, { color: '#8E8E93' }]}>Ostatnie wyszukiwania</Text>
                  {recentSearches.length === 0 ? (
                    <Text style={[styles.smartHint, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93' }]}>
                      Zapisujemy tu miasta i adresy, które wybierzesz z listy poniżej.
                    </Text>
                  ) : (
                    recentSearches.map((s) => (
                      <TouchableOpacity
                        key={`r-${s}`}
                        activeOpacity={0.65}
                        onPress={() => finalizeSearchChoice(s)}
                        style={styles.suggestionRowTouchable}
                      >
                        <Ionicons name="time-outline" size={18} color="#8E8E93" />
                        <Text style={[styles.suggestionText, { color: isDark ? '#FFF' : '#1C1C1E' }]} numberOfLines={1}>
                          {s}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                      </TouchableOpacity>
                    ))
                  )}
                  <Text style={[styles.smartSectionTitle, { color: '#8E8E93', marginTop: 6 }]}>Szybki wybór miasta</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.cityChipsRow}
                  >
                    {QUICK_CITIES.map((city) => (
                      <Pressable
                        key={city}
                        onPress={() => finalizeSearchChoice(city)}
                        style={[styles.cityChip, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)' }]}
                      >
                        <Text style={[styles.cityChipText, { color: isDark ? '#FFF' : '#1C1C1E' }]}>{city}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Text style={[styles.smartFootnote, { color: isDark ? 'rgba(255,255,255,0.35)' : '#8E8E93' }]}>
                    Zacznij wpisywać — pokażemy dopasowania z ofert (ulica, dzielnica, tytuł) oraz liczbę pasujących ogłoszeń.
                  </Text>
                </>
              )}

              {searchQuery.trim().length === 1 && (
                <Text style={[styles.smartHint, { color: isDark ? 'rgba(255,255,255,0.55)' : '#636366', paddingVertical: 8 }]}>
                  Wpisz jeszcze jedną literę, aby pojawiły się inteligentne podpowiedzi z aktualnych ofert.
                </Text>
              )}

              {searchQuery.trim().length >= 2 && (
                <>
                  {rankedPlaceSuggestions.length === 0 ? (
                    <View style={styles.smartEmptyBlock}>
                      <Ionicons name="search-outline" size={28} color="#8E8E93" />
                      <Text style={[styles.smartEmptyTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                        Brak dopasowań w tekstach ofert
                      </Text>
                      <Text style={[styles.smartHint, { color: '#8E8E93', textAlign: 'center' }]}>
                        Spróbuj innej frazy albo użyj filtrów (ikonka opcji). Możesz podać kilka słów naraz, np. „mokotów 3 pok”.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.smartSectionTitle, { color: '#8E8E93' }]}>Podpowiedzi z ofert</Text>
                      {rankedPlaceSuggestions.map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          activeOpacity={0.65}
                          onPress={() => finalizeSearchChoice(item.value)}
                          style={styles.suggestionRowTouchable}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.category}: ${item.value}`}
                        >
                          <Ionicons name="navigate-outline" size={18} color={modeAccentColor} />
                          <View style={styles.suggestionMain}>
                            <Text style={[styles.suggestionText, { color: isDark ? '#FFF' : '#1C1C1E' }]} numberOfLines={2}>
                              {item.value}
                            </Text>
                            <Text style={[styles.suggestionCategory, { color: '#8E8E93' }]}>{item.category}</Text>
                          </View>
                          <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                            <Text style={[styles.countBadgeText, { color: isDark ? '#FFF' : '#1C1C1E' }]}>{item.count}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </>
              )}

              {(normalizedSearchTokens.length > 0 || searchQuery.trim().length >= 2) && (
                <View
                  style={[
                    styles.smartFooter,
                    { borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  <Ionicons name="map-outline" size={16} color={modeAccentColor} />
                  <Text style={[styles.smartFooterText, { color: isDark ? 'rgba(255,255,255,0.75)' : '#636366' }]}>
                    W bazie ogłoszeń:{' '}
                    <Text style={{ fontWeight: '700', color: isDark ? '#FFF' : '#1C1C1E' }}>
                      {searchOnlyMatchCount} {pluralOffers(searchOnlyMatchCount)}
                    </Text>{' '}
                    pasuje do wpisanego tekstu
                  </Text>
                </View>
              )}
            </ScrollView>
          </BlurView>
        </View>
      )}

      {!showOnlyFavorites && (
        <View style={[styles.radarToggleContainer, { top: radarButtonTop }]}>
          <View style={styles.radarHeroWrap}>
            {isRadarEnabled && (
              <View pointerEvents="none" style={styles.radarPulseLayer}>
                <Animated.View
                  style={[
                    styles.radarPulseWave,
                    {
                      borderColor: 'rgba(16,185,129,0.55)',
                      opacity: radarPulseA.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }),
                      transform: [{ scale: radarPulseA.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.85] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.radarPulseWave,
                    {
                      borderColor: 'rgba(16,185,129,0.42)',
                      opacity: radarPulseB.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0] }),
                      transform: [{ scale: radarPulseB.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.95] }) }],
                    },
                  ]}
                />
              </View>
            )}
            <Pressable onPress={openRadarCalibration} style={({ pressed }) => [styles.radarBtnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}>
              <BlurView
                intensity={95}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.radarPill,
                  { backgroundColor: isRadarEnabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 59, 48, 0.14)' },
                ]}
              >
                <Ionicons name={isRadarEnabled ? 'radio' : 'radio-outline'} size={18} color={isRadarEnabled ? '#10b981' : '#FF3B30'} />
                <View style={styles.radarPillTextWrap}>
                  <Text style={[styles.radarTitle, { color: isRadarEnabled ? '#10b981' : '#FF3B30' }]}>EstateOS™ Radar</Text>
                  <Text style={styles.radarStatus}>{isRadarEnabled ? 'Status: LIVE' : 'Status: NIEAKTYWNY'}</Text>
                </View>
              </BlurView>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.offersPreviewContainer}>
        {loading ? (
          <View style={{ paddingBottom: bottomCardsInset, alignItems: 'center' }}>
            <ActivityIndicator color={isDark ? '#FFF' : '#111'} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={activeOffers}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.85 + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomCardsInset }}
            renderItem={renderOfferCard}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (width * 0.85 + 16));
              focusOffer(idx);
            }}
            getItemLayout={(_, index) => ({
              length: width * 0.85 + 16,
              offset: (width * 0.85 + 16) * index,
              index,
            })}
          />
        )}
      </View>

      <RadarCalibrationModal
        visible={showCalibration}
        calibrationSessionId={calibrationSessionId}
        isDark={isDark}
        variant="radar"
        initialFilters={radarFilters}
        matchingOffersCount={activeOffers.length}
        areaSummary={areaSummary}
        getAreaSummaryPreview={getAreaSummaryPreview}
        getMatchingOffersCountPreview={getMatchingOffersCountPreview}
        onClose={() => setShowCalibration(false)}
        onApply={applyRadarCalibration}
        onOpenAreaPicker={openAreaPickerFromCalibration}
      />

      <RadarCalibrationModal
        visible={showFavoritesCalibration}
        calibrationSessionId={favoritesCalibrationSessionId}
        isDark={isDark}
        variant="favorites"
        initialFilters={favoritesRadarFilters}
        matchingOffersCount={activeOffers.length}
        areaSummary={areaSummary}
        getAreaSummaryPreview={getAreaSummaryPreview}
        getMatchingOffersCountPreview={getMatchingOffersCountPreview}
        onClose={() => setShowFavoritesCalibration(false)}
        onApply={applyFavoritesCalibration}
        onOpenAreaPicker={openAreaPickerFromCalibration}
      />
      
      {showAreaPicker && (
        <View style={styles.areaPickerOverlay} pointerEvents="box-none">
          {/* PRZYCIEMNIENIE TŁA */}
          <View style={styles.areaDimLayer} pointerEvents="none" />
          {/* SOCZEWKA */}
          <View
            pointerEvents="none"
            style={[
              styles.areaReticleWrap,
              {
                left: areaLensLeft,
                top: areaLensTop,
                width: areaReticleDiameter,
                height: areaReticleDiameter,
              },
            ]}
          >
            <Animated.View
              style={{
                width: areaReticleDiameter,
                height: areaReticleDiameter,
                borderRadius: areaReticleDiameter / 2,
                transform: [{ scale: areaReticleScale }],
                opacity: areaReticleOpacity,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  width: areaReticleDiameter,
                  height: areaReticleDiameter,
                  borderRadius: areaReticleDiameter / 2,
                  borderWidth: 1.5,
                  borderColor: 'rgba(16,185,129,0.4)',
                  opacity: areaHaloOpacity,
                }}
              />
              <CalibrationLens
                isMoving={isMapMoving}
                isDark={isDark}
                diameter={areaReticleDiameter}
              />
            </Animated.View>
          </View>
          {/* GÓRA */}
          <View style={styles.areaPickerTop} pointerEvents="box-none">
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.areaPickerTopGlass}>
              <Text style={styles.areaPickerTitle}>Zaznacz obszar radaru</Text>
              <Text style={styles.areaPickerSubtitle}>
                Promień liczony jest na podstawie rzeczywistego widoku mapy.
              </Text>
            </BlurView>
          </View>
          {/* DÓŁ */}
          <View style={styles.areaPickerBottom} pointerEvents="box-none">
            <BlurView intensity={92} tint={isDark ? 'dark' : 'light'} style={styles.areaPickerBottomGlass}>
              <View style={styles.areaRadiusHeader}>
                <Text style={styles.areaRadiusLabel}>Promień</Text>
                <Text style={styles.areaRadiusValue}>
                  {formatRadiusLabel(areaPickerDraft.radiusKm)}
                </Text>
              </View>
              <View style={styles.areaActionRow}>
                <Pressable
                  style={styles.areaGhostBtn}
                  onPress={() => {
                    setShowAreaPicker(false);
                    setShowCalibration(true);
                  }}
                >
                  <Text style={styles.areaGhostText}>Wróć</Text>
                </Pressable>
                <Pressable style={styles.areaApplyBtn} onPress={() => applyAreaSelectionToRadar()}>
                  <Text style={styles.areaApplyText}>Zastosuj</Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
        </View>
      )}
      
      <Modal visible={showAdvancedSearch} transparent animationType="slide" onRequestClose={() => setShowAdvancedSearch(false)}>
        <View style={styles.advancedOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAdvancedSearch(false)} />
          <View style={{ width: '100%', flex: 1, justifyContent: 'flex-end' }}>
            <View
              style={[
                styles.advancedSheet,
                { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
                { height: advancedSheetMaxHeight, maxHeight: advancedSheetMaxHeight },
                advancedSearchKeyboardInset > 0 && { paddingBottom: advancedSearchKeyboardInset },
              ]}
            >
              <View style={styles.modalDragHandle} />
              <View style={styles.advancedHeader}>
                <Text style={[styles.advancedTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>Wyszukiwanie rozszerzone</Text>
                <Pressable onPress={resetAdvancedFilters}>
                  <Text style={styles.advancedReset}>Reset</Text>
                </Pressable>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
              >
                <Text style={styles.advancedSection}>ID oferty</Text>
                <TextInput
                  style={[
                    styles.advancedInput,
                    { flexGrow: 0, alignSelf: 'stretch', width: '100%', color: isDark ? '#FFF' : '#1C1C1E', marginBottom: 12 },
                  ]}
                  placeholder="Numer oferty"
                  placeholderTextColor="#8E8E93"
                  keyboardType="number-pad"
                  value={draftOfferIdInput}
                  onChangeText={setDraftOfferIdInput}
                  returnKeyType="done"
                  editable={!advancedOfferIdBusy}
                />

                <Text style={styles.advancedSection}>Tryb</Text>
                <View style={styles.advancedRow}>
                  {([
                    { key: 'SELL', label: 'Kupno' },
                    { key: 'RENT', label: 'Najem' },
                  ] as const).map((item) => {
                    const active = draftAdvancedFilters.transactionType === item.key;
                    return (
                      <Pressable key={item.key} style={[styles.advancedChip, active && styles.advancedChipActive, active && { borderColor: draftModeAccentColor, backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)' }]} onPress={() => setDraftAdvancedFilters((p) => ({ ...p, transactionType: item.key }))}>
                        <Text style={[styles.advancedChipText, active && styles.advancedChipTextActive, active && { color: draftModeAccentColor }]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.advancedSection}>Miasto</Text>
                <View style={styles.advancedRow}>
                  {['', ...backendCities].map((city) => {
                    const active = draftAdvancedFilters.city === city;
                    return (
                      <Pressable key={city || 'all'} style={[styles.advancedChip, active && styles.advancedChipActive, active && { borderColor: draftModeAccentColor, backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)' }]} onPress={() => setDraftAdvancedFilters((p) => ({ ...p, city, districts: [] }))}>
                        <Text style={[styles.advancedChipText, active && styles.advancedChipTextActive, active && { color: draftModeAccentColor }]}>{city || 'Wszystkie'}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.advancedSection}>Dzielnica</Text>
                <View style={styles.advancedRow}>
                  {(() => {
                    const selectedCity = draftAdvancedFilters.city.trim();
                    const chips = selectedCity ? backendDistrictsForDraftCity : [];
                    return chips.map((district) => {
                      const active = draftAdvancedFilters.districts.includes(district);
                      return (
                        <Pressable
                          key={district}
                          style={[
                            styles.advancedChip,
                            active && styles.advancedChipActive,
                            active && {
                              borderColor: draftModeAccentColor,
                              backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)',
                            },
                            !selectedCity && { opacity: 0.5 },
                          ]}
                          disabled={!selectedCity}
                          onPress={() =>
                            setDraftAdvancedFilters((p) => ({
                              ...p,
                              districts: p.districts.includes(district)
                                ? p.districts.filter((d) => d !== district)
                                : [...p.districts, district],
                            }))
                          }
                        >
                          <Text style={[styles.advancedChipText, active && styles.advancedChipTextActive, active && { color: draftModeAccentColor }]}>
                            {district}
                          </Text>
                        </Pressable>
                      );
                    });
                  })()}
                </View>
                {draftAdvancedFilters.districts.length > 0 && (
                  <Pressable
                    onPress={() => setDraftAdvancedFilters((p) => ({ ...p, districts: [] }))}
                    style={{ alignSelf: 'flex-start', marginBottom: 8 }}
                  >
                    <Text style={{ color: '#8E8E93', fontWeight: '700' }}>Wyczyść dzielnice</Text>
                  </Pressable>
                )}

                <Text style={styles.advancedSection}>Typ nieruchomości</Text>
                <View style={styles.advancedRow}>
                  {(['ALL', 'FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL'] as const).map((type) => {
                    const labels = { ALL: 'Wszystkie', FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' };
                    const active = draftAdvancedFilters.propertyType === type;
                    return (
                      <Pressable key={type} style={[styles.advancedChip, active && styles.advancedChipActive, active && { borderColor: draftModeAccentColor, backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)' }]} onPress={() => setDraftAdvancedFilters((p) => ({ ...p, propertyType: type }))}>
                        <Text style={[styles.advancedChipText, active && styles.advancedChipTextActive, active && { color: draftModeAccentColor }]}>{labels[type]}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.advancedSection}>Cena (PLN)</Text>
                <View style={styles.advancedInputRow}>
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder="Od"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={draftAdvancedFilters.minPrice === null ? '' : String(draftAdvancedFilters.minPrice)}
                    onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, minPrice: v ? Number(v.replace(/\D/g, '')) : null }))}
                  />
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder="Do"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={draftAdvancedFilters.maxPrice === null ? '' : String(draftAdvancedFilters.maxPrice)}
                    onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, maxPrice: v ? Number(v.replace(/\D/g, '')) : null }))}
                  />
                </View>

                <Text style={styles.advancedSection}>Metraż (m²)</Text>
                <View style={styles.advancedInputRow}>
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder="Od"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={draftAdvancedFilters.minArea === null ? '' : String(draftAdvancedFilters.minArea)}
                    onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, minArea: v ? Number(v.replace(/\D/g, '')) : null }))}
                  />
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder="Do"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={draftAdvancedFilters.maxArea === null ? '' : String(draftAdvancedFilters.maxArea)}
                    onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, maxArea: v ? Number(v.replace(/\D/g, '')) : null }))}
                  />
                </View>
              </ScrollView>
              <Pressable
                style={[
                  styles.advancedApplyBtn,
                  { backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? '#0A84FF' : '#10b981' },
                  advancedOfferIdBusy && { opacity: 0.75 },
                ]}
                disabled={advancedOfferIdBusy}
                onPress={() => void applyAdvancedFilters()}
              >
                {advancedOfferIdBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.advancedApplyText}>Zastosuj filtry</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  </>);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // --- STYL LUKSUSOWEJ SOCZEWKI KALIBRACJI ---
  lensWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lensCore: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  lensGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  lensDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  crosshair: {
    position: 'absolute',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  crosshairTop: { width: 2.5, height: 12, top: 0 },
  crosshairBottom: { width: 2.5, height: 12, bottom: 0 },
  crosshairLeft: { width: 12, height: 2.5, left: 0 },
  crosshairRight: { width: 12, height: 2.5, right: 0 },

  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    zIndex: 8,
  },
  topBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 50,
  },
  searchBarSlot: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    minHeight: 52,
  },
  favorFloatingIslandWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 48,
    elevation: 48,
  },
  searchGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  searchClearBtn: {
    paddingRight: 14,
    justifyContent: 'center',
  },
  smartSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  smartHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  smartFootnote: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  cityChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionMain: {
    flex: 1,
    minWidth: 0,
  },
  suggestionCategory: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  countBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  smartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  smartFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  smartEmptyBlock: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  smartEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterButtonWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  filterGlass: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  suggestionsWrap: {
    position: 'absolute',
    left: 20,
    right: 82,
    zIndex: 52,
  },
  suggestionsGlass: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  suggestionRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  markerOuter: {
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  markerOuterSelected: {
    transform: [{ scale: 1.08 }],
    shadowOpacity: 0.52,
    shadowRadius: 18,
  },
  markerCapsule: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCapsuleSelected: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  markerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  markerPinTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.92,
  },
  mapMarkerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.35,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clusterOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 12,
  },
  clusterHalo: {
    position: 'absolute',
    opacity: 0.42,
  },
  clusterDisk: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  clusterHighlight: {
    ...StyleSheet.absoluteFillObject,
  },
  clusterCountText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.25,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  favoritesMapDecorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  favoritesMapHeart: {
    position: 'absolute',
  },
  radarToggleContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 22,
    elevation: 22,
  },
  radarHeroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulseLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulseWave: {
    position: 'absolute',
    width: 280,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
  },
  favoritesAuraWave: {
    position: 'absolute',
    width: 280,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
  },
  radarBtnWrapper: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 9,
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 10,
    minWidth: 220,
  },
  radarPillTextWrap: {
    flexDirection: 'column',
  },
  radarTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.1,
  },
  radarStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 1,
    letterSpacing: 0.7,
  },
  favoritesScopeContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 24,
    elevation: 24,
  },
  offersPreviewContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
  offerCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 24,
    marginRight: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  cardImageWrap: {
    width: 90,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 16,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  transactionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  transactionBadgeOnImage: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 6,
  },
  transactionBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooterRow: {
    marginTop: 8,
  },
  cardFooterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amenitiesInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 16,
  },
  offerIdText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '700',
  },
  publishDateText: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  areaPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    justifyContent: 'space-between',
  },
  areaDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  areaBackdropBlur: { position: 'absolute' },
  
  areaReticleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaPickerTop: {
    paddingTop: Platform.OS === 'ios' ? 56 : 26,
    paddingHorizontal: 16,
  },
  areaPickerTopGlass: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  areaPickerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  areaPickerSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  areaPickerBottom: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  areaPickerBottomGlass: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  areaRadiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  areaRadiusLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  areaRadiusValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  areaZoomHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  areaZoomHintText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  areaActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  areaGhostBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,142,147,0.24)',
  },
  areaGhostText: {
    color: '#D1D1D6',
    fontSize: 14,
    fontWeight: '700',
  },
  areaApplyBtn: {
    flex: 1.2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  areaApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  advancedOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  advancedSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 16,
    flexDirection: 'column',
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  advancedTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  advancedReset: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  advancedSection: {
    marginTop: 8,
    marginBottom: 6,
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  advancedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advancedChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.22)',
  },
  advancedChipActive: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: '#10b981',
  },
  advancedChipText: {
    color: '#8E8E93',
    fontWeight: '600',
    fontSize: 12,
  },
  advancedChipTextActive: {
    color: '#10b981',
    fontWeight: '800',
  },
  advancedInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  advancedInput: {
    flex: 1,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  advancedApplyBtn: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  advancedApplyText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});