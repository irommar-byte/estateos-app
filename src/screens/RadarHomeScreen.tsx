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
  useColorScheme,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import MapViewCore, { Marker, Region, Circle } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadarCalibrationModal, { RadarFilters } from '../components/RadarCalibrationModal';
import { syncPushDevicePreferences } from '../hooks/usePushNotifications';
import { buildCanonicalRadarPreferencesDto } from '../contracts/parityContracts';
import { STRICT_CITIES, STRICT_CITY_DISTRICTS, resolveIsExactLocation } from '../constants/locationEcosystem';
import { getPublicMapPresentation } from '../utils/publicLocationPrivacy';
import { syncRadarLiveActivity } from '../services/radarLiveActivityService';

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

/**
 * Konwersja hex → rgba z dowolną alfą. Używana przy rysowaniu okręgów
 * prywatności na mapie radaru — bardzo niska alfa daje gładkie nakładanie się
 * kilku okręgów (suma jasności rośnie miękko, bez „twardych" przecięć).
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * Parametry okręgu „obszaru" rysowanego pod markerem oferty z ukrytą dokładną
 * lokalizacją. Apple-style: bardzo subtelny fill, czysta cienka obwódka,
 * mocniejsze wartości tylko przy aktywnej karcie.
 *
 * Dlaczego tak niska alfa: przy 4–6 nakładających się okręgach finalna jasność
 * to ~0.30, czyli wciąż delikatny pastel — nie tworzy „plamy" na mapie.
 */
function radarPrivacyCircleStyle(accentHex: string, isSelected: boolean) {
  return {
    strokeColor: hexToRgba(accentHex, isSelected ? 0.55 : 0.32),
    fillColor: hexToRgba(accentHex, isSelected ? 0.14 : 0.07),
    strokeWidth: isSelected ? 1.6 : 1,
  };
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
  // Diakrytyki nie mogą blokować dopasowania (np. lodz = łódź, slask = śląsk).
  return s
    .replace(/[Ąą]/g, 'a')
    .replace(/[Ćć]/g, 'c')
    .replace(/[Ęę]/g, 'e')
    .replace(/[Łł]/g, 'l')
    .replace(/[Ńń]/g, 'n')
    .replace(/[Óó]/g, 'o')
    .replace(/[Śś]/g, 's')
    .replace(/[ŹźŻż]/g, 'z')
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
type AdvancedLocationMode = 'CITY' | 'MAP';
type AdvancedMapBounds = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};
type AdvancedFilters = {
  transactionType: 'SELL' | 'RENT';
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  minRooms: number | null;
  city: string;
  districts: string[];
  locationMode: AdvancedLocationMode;
  mapBounds: AdvancedMapBounds | null;
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

/**
 * Brama logowania dla funkcji radaru.
 *
 * Pokazywana, gdy niezalogowany użytkownik próbuje otworzyć kalibrację
 * Radaru lub Ulubionych. Bez konta:
 *   • backend nie przyjmuje preferencji radaru (`syncRadarPreferencesToBackend`
 *     ma `if (!user?.id) return`),
 *   • token push nie jest rejestrowany (`usePushNotifications` wymaga authTokena),
 *   • więc Live Activity i powiadomienia byłyby placebo (Apple Review 4.2 / 5.1.1).
 *
 * UI: glassmorphic sheet w stylu Apple, identyczny z confirmCard ze Step2_Location,
 * z dwoma CTA — „Zaloguj się" (primary) i „Załóż konto" (secondary).
 */
const RadarAuthGateModal = ({
  visible,
  context,
  isDark,
  onCancel,
  onLoginPress,
  onRegisterPress,
}: {
  visible: boolean;
  context: 'radar' | 'favorites' | null;
  isDark: boolean;
  onCancel: () => void;
  onLoginPress: () => void;
  onRegisterPress: () => void;
}) => {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      lift.setValue(40);
      scale.setValue(0.94);
    }
  }, [visible, fade, lift, scale]);

  const isFavorites = context === 'favorites';
  const title = isFavorites ? 'Zaloguj się, by zarządzać Ulubionymi' : 'Zaloguj się, by aktywować Radar';
  const subtitle = isFavorites
    ? 'Powiadomienia o zmianach cen, propozycjach od kupujących i nowych podobnych ofertach wymagają konta — dzięki temu wiemy, do kogo wysłać alert.'
    : 'Radar EstateOS™ wysyła powiadomienia push o ofertach pasujących do Twoich kryteriów. Bez konta nie ma do kogo przypisać preferencji ani komu wysłać alertu.';

  const accent = '#10b981';
  const cardBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.96)';
  const textColor = isDark ? '#FFFFFF' : '#1C1C1E';
  const subtitleColor = isDark ? 'rgba(235,235,245,0.72)' : 'rgba(60,60,67,0.7)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View style={[authGateStyles.overlay, { opacity: fade }]}>
        <BlurView intensity={42} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <Animated.View
          style={[
            authGateStyles.card,
            { backgroundColor: cardBg, borderColor, transform: [{ translateY: lift }, { scale }] },
          ]}
        >
          <View style={[authGateStyles.iconBubble, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
            <Ionicons name={isFavorites ? 'heart' : 'radio'} size={28} color={accent} />
          </View>

          <Text style={[authGateStyles.title, { color: textColor }]}>{title}</Text>
          <Text style={[authGateStyles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>

          <View style={[authGateStyles.bulletList, { borderColor }]}>
            <View style={authGateStyles.bulletRow}>
              <Ionicons name="notifications-outline" size={16} color={accent} />
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>Powiadomienia push o nowych dopasowaniach</Text>
            </View>
            <View style={authGateStyles.bulletRow}>
              <Ionicons name="sync-outline" size={16} color={accent} />
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>Synchronizacja filtrów między urządzeniami</Text>
            </View>
            <View style={authGateStyles.bulletRow}>
              <Ionicons name="lock-closed-outline" size={16} color={accent} />
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>Bezpieczne zapisanie Twoich preferencji</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              authGateStyles.primaryBtn,
              { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLoginPress();
            }}
          >
            <Text style={authGateStyles.primaryBtnText}>Zaloguj się</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [authGateStyles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              void Haptics.selectionAsync();
              onRegisterPress();
            }}
          >
            <Text style={[authGateStyles.secondaryBtnText, { color: accent }]}>Załóż konto</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [authGateStyles.ghostBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onCancel}
          >
            <Text style={[authGateStyles.ghostBtnText, { color: subtitleColor }]}>Może później</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const authGateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 22,
  },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  bulletList: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ghostBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default function RadarHomeScreen({ navigation, route, splashDone }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
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
  const [unreadDealroomMessagesCount, setUnreadDealroomMessagesCount] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showFavoritesCalibration, setShowFavoritesCalibration] = useState(false);
  // Brama logowania dla kalibracji radaru / Ulubionych — bez konta nie pozwalamy
  // włączać push, zapisywać preferencji w backendzie ani uruchamiać Live Activity
  // (które bez konta nie miałyby sensu — push token nie jest rejestrowany,
  // a snapshot nigdy nie zostanie odświeżony przez backend).
  // `authGateContext` steruje widocznością modalu (null = ukryty).
  // `pendingAuthTargetRef` pamięta cel po zamknięciu modalu, żeby auto-resume po
  // loginie nadal wiedział do której kalibracji wrócić — modal MUSI zniknąć
  // natychmiast po kliknięciu „Zaloguj się", inaczej native overlay Modal RN
  // zasłania ekran AuthScreen na zakładce Profil.
  const [authGateContext, setAuthGateContext] = useState<null | 'radar' | 'favorites'>(null);
  const pendingAuthTargetRef = useRef<null | 'radar' | 'favorites'>(null);
  /**
   * Tryb „Dopasowania Radaru" — gdy `true`, karuzela ofert pokazuje WYŁĄCZNIE
   * to, co Radar realnie złowił (`radarMatchingOffers`), zamiast domyślnej listy
   * „Oferty w Twojej okolicy / Filtry / Ulubione".
   *
   * KIEDY SIĘ WŁĄCZA
   * ─────────────────
   *  • automatycznie po tapnięciu pusha typu „Radar znalazł X ofert"
   *    (gdy push nie miał konkretnego offerId — wtedy `App.tsx` przekierowuje
   *     na zakładkę Radar i sygnalizuje to przez `route.params.radarFocus = 'matches'`),
   *  • ręcznie z mini-CTA „Pokaż N dopasowań" pod pillem „EstateOS™ Radar",
   *  • mapa fituje się do dopasowań przy każdym wejściu w ten tryb.
   *
   * KIEDY SIĘ WYŁĄCZA
   * ─────────────────
   *  • akcja „Wszystkie" w banerze powodu,
   *  • dowolne aktywne wyszukiwanie/filtry/„tylko ulubione" (effecty poniżej),
   *  • wyłączenie Radaru (`isRadarEnabled = false`) — bez Radaru nie ma sensu
   *    pokazywać „dopasowań".
   *
   * MA NAJWYŻSZY PRIORYTET w `offerDisplayReason`, więc nigdy nie miesza się
   * wizualnie z innymi trybami — to jest „dedykowany widok wyników Radaru".
   */
  const [showRadarMatchesOnly, setShowRadarMatchesOnly] = useState(false);
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
    minRooms: null,
    city: '',
    districts: [],
    locationMode: 'CITY',
    mapBounds: null,
    propertyType: 'ALL',
  });
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<AdvancedFilters>({
    transactionType: 'SELL',
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    minRooms: null,
    city: '',
    districts: [],
    locationMode: 'CITY',
    mapBounds: null,
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
  const [areaPickerReturnTo, setAreaPickerReturnTo] = useState<'RADAR' | 'ADVANCED'>('RADAR');
  const [areaPickerDraft, setAreaPickerDraft] = useState<RadarAreaDraft>({
    center: { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude },
    radiusKm: 8,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  });
  const [areaPickerResolvedLocality, setAreaPickerResolvedLocality] = useState('');
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
  const isCompactViewport = useMemo(() => !isTablet && height <= 760, [height, isTablet]);
  const topUiSpacing = useMemo(
    () => ({
      // Search + chip + breathing room before Radar/Favor island.
      radarTopOffset: isTablet ? 116 : isCompactViewport ? 94 : 102,
      favorTopOffset: isTablet ? 98 : isCompactViewport ? 84 : 90,
    }),
    [isTablet, isCompactViewport]
  );
  const bottomCardsInset = useMemo(() => {
    const tabBase = Platform.OS === 'ios' ? 18 : 14;
    return tabBase + insets.bottom;
  }, [insets.bottom]);
  const radarButtonTop = useMemo(
    // Snap spacing: stały rytm pionowy niezależnie od rozmiaru iPhone.
    () => topBarTop + topUiSpacing.radarTopOffset,
    [topBarTop, topUiSpacing.radarTopOffset]
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
  const modeIslandOpacity = useRef(new Animated.Value(1)).current;
  const modeIslandTranslateY = useRef(new Animated.Value(0)).current;
  const modeIslandScale = useRef(new Animated.Value(1)).current;
  const lastLiveActivityFingerprintRef = useRef('');
  /** Ostatni snapshot Live Activity — używany przez heartbeat co 15 s. */
  const liveActivitySnapshotRef = useRef<any>(null);
  /** Bufor filtrów z modala kalibracji podczas wejścia do „Obszaru mapy”. */
  const pendingRadarCalibrationFiltersRef = useRef<RadarFilters | null>(null);

  /**
   * Zbiór ID ofert, które użytkownik już widział od ostatniego wejścia
   * na zakładkę Radar. Persystowany w AsyncStorage. Dzięki temu w Live Activity
   * pokazujemy „NOWE! N” tylko dla świeżo wpadających dopasowań.
   */
  const [seenRadarOfferIds, setSeenRadarOfferIds] = useState<Set<number>>(new Set());
  const seenRadarOfferIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    seenRadarOfferIdsRef.current = seenRadarOfferIds;
  }, [seenRadarOfferIds]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@estateos_radar_seen_offer_ids');
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setSeenRadarOfferIds(new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n))));
        }
      } catch {
        // noop — przy błędzie startujemy z pustym zbiorem
      }
    })();
  }, []);

  useEffect(() => {
    // Premium "snap-in" when changing Radar/Favor mode.
    modeIslandOpacity.setValue(0);
    modeIslandTranslateY.setValue(showOnlyFavorites ? 10 : 8);
    modeIslandScale.setValue(0.985);
    Animated.parallel([
      Animated.timing(modeIslandOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(modeIslandTranslateY, { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }),
      Animated.spring(modeIslandScale, { toValue: 1, friction: 8, tension: 115, useNativeDriver: true }),
    ]).start();
  }, [showOnlyFavorites, modeIslandOpacity, modeIslandScale, modeIslandTranslateY]);

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

  // Wylogowanie / brak sesji → wymusza wyłączenie radaru, niezależnie od tego co
  // zostało zapisane w AsyncStorage z poprzedniej sesji. Bez tego user mógłby
  // przegapić logout (Live Activity dalej świecący po wyjściu z konta) — Apple
  // Reviewer też złapie ten case przy teście „log out".
  useEffect(() => {
    if (!user && (isRadarActive || isRadarEnabled)) {
      setIsRadarEnabled(false);
      void setRadarActive(false);
    }
  }, [user, isRadarActive, isRadarEnabled, setRadarActive]);

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
      // Deep-link z pusha: gdy App.tsx przekierował tu z intencją „pokaż
      // dopasowania Radaru", podnosimy tryb tu, na ekranie docelowym.
      if (route?.params?.radarFocus === 'matches') {
        setShowRadarMatchesOnly(true);
      }
    }, [route?.params?.favoritesOnly, route?.params?.favoritesScope, route?.params?.radarFocus])
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

    const sourceOffers = showOnlyFavorites
      ? offers.filter((o) => favorites.includes(Number(o.id)))
      : offers;

    sourceOffers.forEach((o) => {
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
  }, [offers, favorites, showOnlyFavorites, searchQuery]);

  const backendCities = useMemo(() => {
    return [...STRICT_CITIES].sort((a, b) => a.localeCompare(b, 'pl'));
  }, []);

  const backendDistrictsForDraftCity = useMemo(() => {
    const selectedCity = draftAdvancedFilters.city.trim();
    if (!selectedCity) return [] as string[];
    return getStrictDistrictsForCity(selectedCity);
  }, [draftAdvancedFilters.city]);

  const searchOnlyMatchCount = useMemo(() => {
    if (normalizedSearchTokens.length === 0) {
      if (showOnlyFavorites) {
        const scopedBaseIds =
          favoritesMapScope === 'MINE'
            ? offers
                .filter((o) => {
                  const myId = Number(user?.id || 0);
                  if (!myId) return false;
                  const ownerCandidateIds = [
                    o.raw?.userId,
                    o.raw?.ownerId,
                    o.raw?.sellerId,
                    o.raw?.authorId,
                    o.raw?.createdById,
                    o.raw?.user?.id,
                    o.raw?.owner?.id,
                    o.raw?.seller?.id,
                    o.raw?.createdBy?.id,
                  ]
                    .map((v) => Number(v || 0))
                    .filter((v) => Number.isFinite(v) && v > 0);
                  return ownerCandidateIds.includes(myId);
                })
                .map((o) => Number(o.id))
            : favorites;
        return offers.filter((o) => scopedBaseIds.includes(Number(o.id))).length;
      }
      return offers.length;
    }

    const sourceOffers = showOnlyFavorites
      ? offers.filter((o) => favorites.includes(Number(o.id)))
      : offers;

    return sourceOffers.filter((o) =>
      normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok))
    ).length;
  }, [
    offers,
    favorites,
    favoritesMapScope,
    showOnlyFavorites,
    user?.id,
    normalizedSearchTokens,
    haystackForOffer,
  ]);

  const hasAdvancedFiltersActive = useMemo(() => {
    return Boolean(
      advancedFilters.transactionType !== 'SELL' ||
      advancedFilters.minPrice !== null ||
      advancedFilters.maxPrice !== null ||
      advancedFilters.minArea !== null ||
      advancedFilters.maxArea !== null ||
      advancedFilters.minRooms !== null ||
      advancedFilters.locationMode !== 'CITY' ||
      advancedFilters.mapBounds !== null ||
      advancedFilters.city.trim() ||
      advancedFilters.districts.length > 0 ||
      advancedFilters.propertyType !== 'ALL'
    );
  }, [advancedFilters]);

  const favoritesUiAccent = '#F777B2';
  const favoritesUiBg = isDark ? 'rgba(90, 24, 56, 0.62)' : 'rgba(255, 210, 234, 0.9)';
  const favoritesUiSubtleBg = isDark ? 'rgba(247,119,178,0.22)' : 'rgba(247,119,178,0.16)';
  const mineUiAccent = '#10b981';
  const mineUiBg = isDark ? 'rgba(20, 60, 48, 0.62)' : 'rgba(214, 246, 232, 0.9)';
  const mineUiSubtleBg = isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.14)';
  const isMineScope = showOnlyFavorites && favoritesMapScope === 'MINE';
  const favoritesScopeAccent = isMineScope ? mineUiAccent : favoritesUiAccent;
  const favoritesScopeBg = isMineScope ? mineUiBg : favoritesUiBg;
  const favoritesScopeSubtleBg = isMineScope ? mineUiSubtleBg : favoritesUiSubtleBg;
  const modeAccentColor = showOnlyFavorites
    ? favoritesScopeAccent
    : advancedFilters.transactionType === 'RENT'
      ? RENT_MARKER_COLOR
      : SELL_MARKER_COLOR;
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

  /**
   * Mapowanie surowej oferty z backendu → `MapOffer` używane przez listę i mapę.
   * Wydzielone z `fetchOffers`, żeby ten sam normalizer mógł być użyty zarówno
   * w focus-fetchu (oryginalny), jak i w background-pollerze (Live Activity).
   */
  const mapRawOffer = useCallback((o: any): MapOffer | null => {
    if (!Number.isFinite(Number(o?.lat)) || !Number.isFinite(Number(o?.lng))) return null;
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
  }, []);

  /**
   * Pobranie ofert z backendu. `showSpinner=false` używamy w tle (Radar pollujący)
   * — wtedy nie migamy spinnerem, bo ekran nie ma fokusu i nikt go nie widzi.
   */
  const fetchOffersOnce = useCallback(
    async (showSpinner: boolean): Promise<boolean> => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/mobile/v1/offers`);
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data?.offers)) {
          const mapped = data.offers
            .map((o: any) => mapRawOffer(o))
            .filter((m: MapOffer | null): m is MapOffer => m !== null);
          setOffers(mapped);
          return true;
        }
        setOffers([]);
        return false;
      } catch {
        setOffers([]);
        return false;
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [mapRawOffer]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (cancelled) return;
        await fetchOffersOnce(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchOffersOnce])
  );

  /**
   * BACKGROUND POLLING dla Live Activity.
   *
   * Bez tego: gdy user przełączy się na zakładkę „Wiadomości" lub „Profil",
   * `fetchOffers` w `useFocusEffect` przestaje się odpalać → `radarMatchingOffers`
   * pozostaje stary → snapshot wysyłany heartbeatem co 15s ma ZAWSZE tę samą
   * liczbę dopasowań. Skutek: Live Activity na lock screenie nigdy nie pokaże
   * „NOWE! N" dla świeżych ofert, choć radar je teoretycznie monitoruje.
   *
   * Z tym effectem: dopóki radar jest włączony, w tle co 30 s odświeżamy listę
   * ofert. `setOffers` zatrzaska nowy stan → przeliczy się `radarMatchingOffers`
   * → przeliczy się `newRadarMatchesCount` → snapshot w useEffect-cie poniżej
   * pojawi się z nowym fingerprintem → Live Activity dostanie update.
   * Niezależnie od tego, na którą zakładkę przełączył się user.
   *
   * Spinner wyłączony — to czysty background poll.
   */
  useEffect(() => {
    if (!isRadarEnabled) return;
    const interval = setInterval(() => {
      void fetchOffersOnce(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [isRadarEnabled, fetchOffersOnce]);

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
      const rawRooms = Number(String(offer.raw?.rooms ?? '').replace(/[^\d]/g, '')) || 0;
      const rawCity = normalizeSearchText(String(offer.raw?.city || '').trim());
      const rawDistrict = normalizeSearchText(String(offer.raw?.district || '').trim());
      const rawPropertyType = String(offer.raw?.propertyType || '').toUpperCase();
      const rawTransactionType = String(offer.raw?.transactionType || '').toUpperCase();
      if (rawTransactionType !== advancedFilters.transactionType) return false;
      if (advancedFilters.minPrice !== null && rawPrice < advancedFilters.minPrice) return false;
      if (advancedFilters.maxPrice !== null && rawPrice > advancedFilters.maxPrice) return false;
      if (advancedFilters.minArea !== null && rawArea < advancedFilters.minArea) return false;
      if (advancedFilters.maxArea !== null && rawArea > advancedFilters.maxArea) return false;
      if (advancedFilters.minRooms !== null && rawRooms < advancedFilters.minRooms) return false;

      if (advancedFilters.locationMode === 'CITY') {
        const selectedCity = normalizeSearchText(advancedFilters.city.trim());
        if (selectedCity && !radarCityMatches(rawCity, selectedCity)) return false;
        if (
          advancedFilters.districts.length > 0 &&
          !advancedFilters.districts.some((d) => normalizeSearchText(d.trim()) === rawDistrict)
        ) return false;
      } else if (advancedFilters.mapBounds) {
        const distance = distanceKm(
          advancedFilters.mapBounds.centerLat,
          advancedFilters.mapBounds.centerLng,
          Number(offer.lat),
          Number(offer.lng)
        );
        if (!Number.isFinite(distance) || distance > advancedFilters.mapBounds.radiusKm) return false;
      }

      if (advancedFilters.propertyType !== 'ALL' && rawPropertyType !== advancedFilters.propertyType) return false;
      return true;
    };
    const favoriteOffers = offers.filter((o) => favorites.includes(Number(o.id)));
    const myOffers = offers.filter(isMyOffer);

    /**
     * Najwyższy priorytet: tryb „Dopasowania Radaru".
     *
     * Bierzemy oferty, które przechodzą predykat kalibracji
     * (`matchesRadarCalibration`) — bez nakładania wyszukiwania/filtrów/scope
     * Ulubionych. To celowo „izolowany widok": użytkownik tu trafia z pusha
     * albo z mini-CTA na pillu Radaru — i widzi DOKŁADNIE to, co Radar złowił.
     * Sortujemy po dystansie od użytkownika (jeśli mamy GPS), żeby najbliższe
     * dopasowania były pierwsze.
     */
    if (showRadarMatchesOnly && isRadarEnabled) {
      const radarHits = offers.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds));
      if (!userLocation) return radarHits;
      return radarHits
        .map((o) => ({ offer: o, distance: distanceKm(userLocation.latitude, userLocation.longitude, o.lat, o.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .map((x) => x.offer);
    }

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
    const applyFavoritesRadar = (list: MapOffer[]) =>
      isFavoritesRadarEnabled
        ? list.filter((o) => matchesRadarCalibration(o, favoritesRadarFilters, radarMapBounds))
        : list;

    if (showOnlyFavorites) {
      const scopedBase = favoritesMapScope === 'MINE' ? myOffers : favoriteOffers;
      const scopedAndAdvanced = applyFavoritesRadar(applyRadar(scopedBase.filter(matchesAdvancedFilters)));
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
    favoritesRadarFilters,
    isFavoritesRadarEnabled,
    radarMapBounds,
    showRadarMatchesOnly,
    isRadarEnabled,
  ]);

  const activeOffers = filteredOffers;

  /**
   * Powód, dla którego użytkownik widzi aktualnie te konkretne oferty
   * — wyświetlany w pasku „dlaczego to widzę?" nad karuzelą ofert.
   *
   * Tryby (od najwyższego priorytetu, bo nakładają się logicznie):
   *  1. Tryb „Moje oferty"     — Ulubione + scope=MINE.
   *  2. Tryb „Ulubione"        — Ulubione + scope=FAVORITES.
   *  3. Tryb „Rozszerzone"     — aktywne `advancedFilters` (cena, dzielnica, typ…).
   *  4. Tryb „Wyszukiwanie"    — wpisana fraza w pasku wyszukiwania.
   *  5. Tryb „Okolica"         — masz GPS, brak innych filtrów → oferty do 25 km.
   *  6. Tryb „Wszystkie"       — brak filtrów, brak lokalizacji → cała baza.
   *
   * Każdy tryb dostaje krótki tytuł („Wyszukiwanie rozszerzone"),
   * podtytuł z konkretami (np. „Sprzedaż · Mokotów · do 800 tys.")
   * oraz licznik wyników, żeby użytkownik nie pogubił się dlaczego
   * lista ma akurat tyle pozycji.
   */
  const offerDisplayReason = useMemo(() => {
    const count = activeOffers.length;
    const trimmedQuery = (searchQuery || '').trim();
    const isEmpty = count === 0;

    // Helpery formatujące — lokalne, żeby nie zaśmiecać globalnego scope.
    const fmtThousands = (v: number) => {
      if (v >= 1_000_000) {
        const mln = v / 1_000_000;
        return `${mln >= 10 ? mln.toFixed(0) : mln.toFixed(1)} mln`;
      }
      if (v >= 1_000) return `${Math.round(v / 1000)} tys.`;
      return `${v}`;
    };
    const propertyTypeShortLabel = (raw: string) => {
      switch ((raw || '').toUpperCase()) {
        case 'FLAT': return 'Mieszkanie';
        case 'HOUSE': return 'Dom';
        case 'PLOT': return 'Działka';
        case 'PREMISES': return 'Lokal';
        default: return '';
      }
    };
    const joinNonEmpty = (parts: (string | null | undefined)[]) =>
      parts.filter((p): p is string => !!p && p.trim().length > 0).join(' · ');

    type Reason = {
      icon: string;
      title: string;
      subtitle: string;
      accent: string;
      severity: 'normal' | 'empty';
      action: null | { label: string; onPress: () => void };
    };

    // Tryb 0 — Dopasowania Radaru (PRIORYTET NAJWYŻSZY).
    // Wchodzi tylko gdy user świadomie wszedł w ten tryb (push lub mini-CTA).
    // Każde inne aktywne kryterium (search/filtry/Ulubione) wcześniej już
    // zostało skasowane przez efekty „auto-dismiss radar matches mode".
    if (showRadarMatchesOnly && isRadarEnabled) {
      // Liczymy „nowe" inline — `newRadarMatchesCount` deklarowane jest
      // niżej w pliku (TDZ), a w tym trybie `activeOffers === radarMatchingOffers`.
      let newCount = 0;
      for (const o of activeOffers) {
        if (!seenRadarOfferIds.has(Number(o.id))) newCount += 1;
      }
      const newSuffix = newCount > 0 ? ` · ${newCount} ${newCount === 1 ? 'nowa' : 'nowych'}` : '';
      const r: Reason = isEmpty
        ? {
            icon: 'radio-outline',
            title: 'Dopasowania Radaru',
            subtitle:
              'Aktualnie żadna oferta nie pasuje do Twojej kalibracji. Rozszerz kryteria — Radar nadal czuwa w tle.',
            accent: '#10b981',
            severity: 'empty',
            action: { label: 'Kalibruj', onPress: () => setShowCalibration(true) },
          }
        : {
            icon: 'radio',
            title: 'Dopasowania Radaru',
            subtitle: `${count} ${pluralOffers(count)} pasuje do Twojej kalibracji${newSuffix}`,
            accent: '#10b981',
            severity: 'normal',
            action: { label: 'Wszystkie', onPress: () => setShowRadarMatchesOnly(false) },
          };
      return r;
    }

    // Tryb 1 — Moje oferty
    if (showOnlyFavorites && favoritesMapScope === 'MINE') {
      const r: Reason = isEmpty
        ? {
            icon: 'briefcase-outline',
            title: 'Moje oferty',
            subtitle: 'Nie masz aktywnych ogłoszeń. Dodaj pierwsze, aby pojawiło się tutaj.',
            accent: mineUiAccent,
            severity: 'empty',
            action: { label: 'Dodaj', onPress: () => navigation.navigate('Dodaj') },
          }
        : {
            icon: 'briefcase-outline',
            title: 'Moje oferty',
            subtitle: `${count} ${pluralOffers(count)} · tylko Twoje aktywne ogłoszenia`,
            accent: mineUiAccent,
            severity: 'normal',
            action: null,
          };
      return r;
    }

    // Tryb 2 — Ulubione (polubione)
    if (showOnlyFavorites) {
      const r: Reason = isEmpty
        ? {
            icon: 'heart-outline',
            title: 'Twoje ulubione',
            subtitle: 'Nie masz jeszcze ulubionych. Stuknij serce na karcie oferty, aby ją zapisać.',
            accent: favoritesUiAccent,
            severity: 'empty',
            action: null,
          }
        : {
            icon: 'heart',
            title: 'Twoje ulubione',
            subtitle: `${count} ${pluralOffers(count)} · oznaczone sercem`,
            accent: favoritesUiAccent,
            severity: 'normal',
            action: null,
          };
      return r;
    }

    // Tryb 3 — Wyszukiwanie rozszerzone
    if (hasAdvancedFiltersActive) {
      const txLabel = advancedFilters.transactionType === 'RENT' ? 'Wynajem' : 'Sprzedaż';
      const propLabel = advancedFilters.propertyType !== 'ALL'
        ? propertyTypeShortLabel(advancedFilters.propertyType)
        : null;
      let locLabel: string | null = null;
      if (advancedFilters.locationMode === 'MAP' && advancedFilters.mapBounds) {
        locLabel = `Obszar ${advancedFilters.mapBounds.radiusKm.toFixed(1)} km`;
      } else if (advancedFilters.city.trim()) {
        const districtSuffix = advancedFilters.districts.length > 0
          ? ` · ${advancedFilters.districts[0]}${advancedFilters.districts.length > 1 ? ` +${advancedFilters.districts.length - 1}` : ''}`
          : '';
        locLabel = `${advancedFilters.city.trim()}${districtSuffix}`;
      }
      const priceParts: string[] = [];
      if (advancedFilters.minPrice != null) priceParts.push(`od ${fmtThousands(advancedFilters.minPrice)} zł`);
      if (advancedFilters.maxPrice != null) priceParts.push(`do ${fmtThousands(advancedFilters.maxPrice)} zł`);
      const priceLabel = priceParts.length > 0 ? priceParts.join(' ') : null;
      const areaLabel = advancedFilters.minArea != null ? `od ${advancedFilters.minArea} m²` : null;
      const roomsLabel = advancedFilters.minRooms != null ? `od ${advancedFilters.minRooms} pok.` : null;

      const details = joinNonEmpty([txLabel, propLabel, locLabel, priceLabel, areaLabel, roomsLabel]);
      const accent = advancedFilters.transactionType === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;

      const r: Reason = isEmpty
        ? {
            icon: 'options-outline',
            title: 'Brak ofert dla filtrów',
            subtitle: `Żadna oferta nie pasuje do: ${details}. Spróbuj rozszerzyć kryteria.`,
            accent,
            severity: 'empty',
            action: { label: 'Resetuj', onPress: () => resetAdvancedFilters() },
          }
        : {
            icon: 'options-outline',
            title: 'Wyszukiwanie rozszerzone',
            subtitle: `${count} ${pluralOffers(count)} · ${details}`,
            accent,
            severity: 'normal',
            action: { label: 'Zmień', onPress: () => setShowAdvancedSearch(true) },
          };
      return r;
    }

    // Tryb 4 — Wyszukiwanie tekstowe (bez filtrów rozszerzonych)
    if (trimmedQuery.length > 0) {
      const r: Reason = isEmpty
        ? {
            icon: 'search-outline',
            title: 'Brak wyników wyszukiwania',
            subtitle: `Żadna oferta nie pasuje do frazy „${trimmedQuery}". Sprawdź pisownię lub zmień zapytanie.`,
            accent: '#10B981',
            severity: 'empty',
            action: { label: 'Wyczyść', onPress: () => setSearchQuery('') },
          }
        : {
            icon: 'search-outline',
            title: 'Wyszukiwanie',
            subtitle: `${count} ${pluralOffers(count)} dla frazy „${trimmedQuery}"`,
            accent: '#10B981',
            severity: 'normal',
            action: { label: 'Wyczyść', onPress: () => setSearchQuery('') },
          };
      return r;
    }

    // Tryb 5 — Okolica (GPS bez filtrów)
    if (userLocation) {
      const r: Reason = isEmpty
        ? {
            icon: 'location-outline',
            title: 'Brak ofert w okolicy',
            subtitle: 'W promieniu 25 km od Twojej lokalizacji nie ma jeszcze ofert. Spróbuj wyszukiwania rozszerzonego.',
            accent: '#10B981',
            severity: 'empty',
            action: { label: 'Filtruj', onPress: () => setShowAdvancedSearch(true) },
          }
        : {
            icon: 'location-outline',
            title: 'Oferty w Twojej okolicy',
            subtitle: `${count} ${pluralOffers(count)} · do 25 km od Twojej lokalizacji`,
            accent: '#10B981',
            severity: 'normal',
            action: { label: 'Filtruj', onPress: () => setShowAdvancedSearch(true) },
          };
      return r;
    }

    // Tryb 6 — Wszystko, brak filtrów, brak lokalizacji
    const r: Reason = isEmpty
      ? {
          icon: 'apps-outline',
          title: 'Brak ofert w bazie',
          subtitle: 'Aktualnie nie ma żadnych ogłoszeń do wyświetlenia. Zajrzyj później lub dodaj swoje.',
          accent: isDark ? '#94A3B8' : '#64748B',
          severity: 'empty',
          action: { label: 'Dodaj', onPress: () => navigation.navigate('Dodaj') },
        }
      : {
          icon: 'apps-outline',
          title: 'Wszystkie oferty',
          subtitle: `${count} ${pluralOffers(count)} · brak aktywnych filtrów`,
          accent: isDark ? '#94A3B8' : '#64748B',
          severity: 'normal',
          action: { label: 'Filtruj', onPress: () => setShowAdvancedSearch(true) },
        };
    return r;
  }, [
    activeOffers,
    activeOffers.length,
    showOnlyFavorites,
    favoritesMapScope,
    hasAdvancedFiltersActive,
    advancedFilters,
    searchQuery,
    userLocation,
    isDark,
    mineUiAccent,
    favoritesUiAccent,
    navigation,
    showRadarMatchesOnly,
    isRadarEnabled,
    seenRadarOfferIds,
  ]);

  /**
   * Licznik nieprzeczytanych wiadomości w Dealroomach.
   * Odświeżamy go:
   *  • przy starcie ekranu i co 20 s (siatka bezpieczeństwa),
   *  • przy KAŻDYM przychodzącym powiadomieniu push (real-time — patrz listener niżej),
   *  • przy kliknięciu w powiadomienie (np. otwarcie aplikacji z lock-screena).
   * Dzięki temu liczba na Live Activity i sticky-notification rośnie od razu,
   * a nie dopiero po wejściu do appki.
   */
  const refreshUnreadDealroomCountRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;

    const normalizeDealsPayload = (payload: any): any[] => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.deals)) return payload.deals;
      if (Array.isArray(payload.items)) return payload.items;
      if (Array.isArray(payload.data?.deals)) return payload.data.deals;
      if (Array.isArray(payload.data?.items)) return payload.data.items;
      if (Array.isArray(payload.data)) return payload.data;
      return [];
    };

    const refreshUnread = async () => {
      if (!token) {
        if (!cancelled) setUnreadDealroomMessagesCount(0);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/mobile/v1/deals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        const total = normalizeDealsPayload(data).reduce(
          (sum, deal) => sum + Math.max(0, Number(deal?.unread || 0)),
          0
        );
        if (!cancelled) setUnreadDealroomMessagesCount(Number.isFinite(total) ? total : 0);
      } catch {
        if (!cancelled) setUnreadDealroomMessagesCount(0);
      }
    };

    refreshUnreadDealroomCountRef.current = refreshUnread;
    void refreshUnread();
    const interval = setInterval(refreshUnread, 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  /**
   * Real-time refresh licznika przy KAŻDYM przychodzącym pushu.
   * Reagujemy szeroko (każdy nie-radarowy push) — koszt to jedno żądanie `/api/mobile/v1/deals`,
   * a użytkownik widzi liczbę natychmiast, bez czekania na 20-sekundowy interwał.
   * Bezpiecznie pomijamy własne sticky-notification Radaru (feature: radar_live_activity),
   * żeby nie tworzyć pętli przy aktualizacji Live Activity.
   *
   * Dodatkowo: gdy tap-em wraca odpowiedź na pusha typu „Radar znalazł X ofert"
   * (push BEZ konkretnego offerId — bo to alert zbiorczy), AUTOMATYCZNIE
   * przełączamy ekran w tryb „Dopasowania Radaru", żeby user od razu widział
   * to co Radar złowił, a nie ogólny widok „Oferty w okolicy".
   */
  useEffect(() => {
    if (!token) return;

    const looksLikeRadarMatchPush = (data: Record<string, unknown>) => {
      const feature = String(data?.feature || '').toLowerCase();
      if (feature === 'radar_match' || feature === 'radar_matches') return true;
      const candidates = [data?.target, data?.targetType, data?.type, data?.notificationType, data?.entity]
        .map((v) => String(v || '').toLowerCase());
      // Heurystyka: dowolne pole wskazujące „radar"/„match", BEZ jednoczesnego
      // wskazania konkretnej oferty czy dealroomu (te idą do OfferDetail/Chat).
      const mentionsRadar = candidates.some((c) => c.includes('radar') || c.includes('match'));
      const hasOfferIdHint = !!(
        data?.offerId || (data as any)?.offer_id || (data as any)?.listingId || (data as any)?.propertyId
      );
      const hasDealIdHint = !!(data?.dealId || (data as any)?.deal_id || (data as any)?.threadId);
      return mentionsRadar && !hasOfferIdHint && !hasDealIdHint;
    };

    const handleIncomingNotification = (notification: Notifications.Notification) => {
      try {
        const data = (notification?.request?.content?.data || {}) as Record<string, unknown>;
        if (data?.feature === 'radar_live_activity') return;
        void refreshUnreadDealroomCountRef.current?.();
      } catch {
        // noop
      }
    };

    const receivedSub = Notifications.addNotificationReceivedListener(handleIncomingNotification);
    const responseSub = Notifications.addNotificationResponseReceivedListener(({ notification }) => {
      handleIncomingNotification(notification);
      try {
        const data = (notification?.request?.content?.data || {}) as Record<string, unknown>;
        if (looksLikeRadarMatchPush(data)) {
          // App.tsx już przekierował na zakładkę Radar (fallback radar bez offerId).
          // Tu tylko podnosimy tryb „Dopasowania Radaru" — fit mapy i banner
          // zrobi efekt poniżej.
          setShowRadarMatchesOnly(true);
        }
      } catch {
        // noop
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [token]);

  /**
   * Rzeczywiste dopasowania konfiguracji radaru, nie lista wyświetlana na mapie.
   * Wcześniej `activeMatchesCount` brał `activeOffers.length`, ale ta lista
   * z premedytacją IGNORUJE filtry radaru (komentarz w `filteredOffers`).
   * Tu liczymy „co radar realnie monitoruje" przez ten sam predykat,
   * którego używa preview kalibracji.
   */
  const radarMatchingOffers = useMemo(() => {
    if (!isRadarEnabled) return [] as MapOffer[];
    return offers.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds));
  }, [offers, radarFilters, radarMapBounds, isRadarEnabled]);

  const newRadarMatchesCount = useMemo(() => {
    let count = 0;
    for (const o of radarMatchingOffers) {
      if (!seenRadarOfferIds.has(Number(o.id))) count += 1;
    }
    return count;
  }, [radarMatchingOffers, seenRadarOfferIds]);

  /**
   * Auto-wygaszanie trybu „Dopasowania Radaru" gdy pojawia się jakikolwiek
   * konkurencyjny stan filtrowania. Trzymamy obietnicę z komentarza przy
   * `showRadarMatchesOnly`: to ma być widok IZOLOWANY — gdy user zaczyna
   * szukać/filtrować/zaznacza ulubione, automatycznie wracamy do normalnego
   * widoku, żeby nic się nie poplątało wizualnie.
   */
  useEffect(() => {
    if (!showRadarMatchesOnly) return;
    if (
      !isRadarEnabled ||
      showOnlyFavorites ||
      hasAdvancedFiltersActive ||
      (searchQuery || '').trim().length > 0
    ) {
      setShowRadarMatchesOnly(false);
    }
  }, [
    showRadarMatchesOnly,
    isRadarEnabled,
    showOnlyFavorites,
    hasAdvancedFiltersActive,
    searchQuery,
  ]);

  useEffect(() => {
    // Sentinele „brak limitu” z `defaultRadarFilters` traktujemy jako pustki.
    // Inaczej Live Activity rysowała „Rok budowy: od 1900 r.” nawet wtedy,
    // gdy użytkownik niczego nie ustawił.
    const sanitizedMinYear = radarFilters.minYear && radarFilters.minYear > 1900 ? radarFilters.minYear : null;
    const sanitizedMinArea = radarFilters.minArea && radarFilters.minArea > 0 ? radarFilters.minArea : null;
    const RENT_DEFAULT_MAX = 50000;
    const SELL_DEFAULT_MAX = 5_000_000;
    const defaultMax = radarFilters.transactionType === 'RENT' ? RENT_DEFAULT_MAX : SELL_DEFAULT_MAX;
    const sanitizedMaxPrice = radarFilters.maxPrice && radarFilters.maxPrice > 0 && radarFilters.maxPrice < defaultMax
      ? radarFilters.maxPrice
      : null;

    const snapshot = {
      enabled: isRadarEnabled,
      transactionType: radarFilters.transactionType,
      city: radarFilters.city,
      districts: radarFilters.selectedDistricts || [],
      propertyType: radarFilters.propertyType,
      maxPrice: sanitizedMaxPrice,
      minArea: sanitizedMinArea,
      minYear: sanitizedMinYear,
      areaRadiusKm: radarMapBounds?.radiusKm ?? null,
      minMatchThreshold: radarFilters.matchThreshold,
      activeMatchesCount: radarMatchingOffers.length,
      newMatchesCount: newRadarMatchesCount,
      unreadDealroomMessagesCount,
      requireBalcony: !!radarFilters.requireBalcony,
      requireGarden: !!radarFilters.requireGarden,
      requireElevator: !!radarFilters.requireElevator,
      requireParking: !!radarFilters.requireParking,
      requireFurnished: !!radarFilters.requireFurnished,
    } as const;
    liveActivitySnapshotRef.current = snapshot;
    const fingerprint = JSON.stringify(snapshot);
    if (lastLiveActivityFingerprintRef.current === fingerprint) return;
    lastLiveActivityFingerprintRef.current = fingerprint;
    void syncRadarLiveActivity(snapshot);
  }, [
    isRadarEnabled,
    radarFilters.transactionType,
    radarFilters.city,
    radarFilters.selectedDistricts,
    radarFilters.propertyType,
    radarFilters.maxPrice,
    radarFilters.minArea,
    radarFilters.minYear,
    radarFilters.matchThreshold,
    radarFilters.requireBalcony,
    radarFilters.requireGarden,
    radarFilters.requireElevator,
    radarFilters.requireParking,
    radarFilters.requireFurnished,
    radarMapBounds?.radiusKm,
    radarMatchingOffers.length,
    newRadarMatchesCount,
    unreadDealroomMessagesCount,
  ]);

  /**
   * Heartbeat Live Activity co 15 s — wymusza re-emit snapshotu z nowym `updatedAtIso`,
   * dzięki czemu iOS „odświeża" Activity i widzimy ruch (zegarek + kropka pulsu).
   * Bez tego widget potrafi wyglądać na zamrożony, kiedy nic w filtrach się nie zmienia.
   */
  useEffect(() => {
    if (!isRadarEnabled) return;
    const interval = setInterval(() => {
      const snap = liveActivitySnapshotRef.current;
      if (!snap) return;
      // Wymuszamy nowy fingerprint przez świeży `updatedAtIso` (service i tak go nadpisuje).
      void syncRadarLiveActivity(snap);
    }, 15000);
    return () => clearInterval(interval);
  }, [isRadarEnabled]);

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

  /**
   * Gdy wchodzimy w tryb „Dopasowania Radaru" (z pusha, deep-linku albo z
   * mini-CTA), automatycznie fitujemy mapę do markerów dopasowań, scrollujemy
   * karuzelę na początek i wyzwalamy lekki haptic. To zamyka pętlę „push →
   * widzę dokładnie co Radar złowił" bez żadnych dodatkowych klików.
   */
  useEffect(() => {
    if (!showRadarMatchesOnly || !isRadarEnabled) return;
    let cancelled = false;
    Haptics.selectionAsync();
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        if (radarMatchingOffers.length === 0) return;
        focusMapToOffers(radarMatchingOffers);
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, Platform.OS === 'ios' ? 220 : 160);
    });
    return () => {
      cancelled = true;
    };
  }, [showRadarMatchesOnly, isRadarEnabled, radarMatchingOffers, focusMapToOffers]);

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

  /**
   * Auto-fokus mapy po wejściu w „Ulubione" / „Moje" (lub po przełączeniu między
   * tymi scopami).
   *
   * Bez tego efektu mapa zostaje tam, gdzie była — typowo nad Warszawą, podczas
   * gdy jedyne ulubione/własne ogłoszenie znajduje się np. w Górze Kalwarii.
   * User widzi kartę oferty na dole, ale na mapie pinezki nie ma (jest poza
   * widokiem). Aby ją zobaczyć, musi sam przewinąć listę → wtedy `focusOffer`
   * przeskakuje na markerze. To kontrintuicyjne.
   *
   * Logika: śledzimy ostatnio auto-zfokusowany scope. Auto-focus odpala się:
   *   • przy pierwszym wejściu w „Ulubione" (z innej zakładki),
   *   • przy przełączeniu zakładki wewnętrznej „Ulubione ↔ Moje".
   *
   * Nie odpala się przy każdej drobnej zmianie `activeOffers` (np. polling
   * radaru w tle), więc user nie zostaje wyrzucony z miejsca, w które sam
   * przesunął mapę.
   */
  const lastAutoFocusedFavoritesScopeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showOnlyFavorites) {
      lastAutoFocusedFavoritesScopeRef.current = null;
      return;
    }
    if (activeOffers.length === 0) return;
    if (lastAutoFocusedFavoritesScopeRef.current === favoritesMapScope) return;
    lastAutoFocusedFavoritesScopeRef.current = favoritesMapScope;

    let cancelled = false;
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        if (activeOffers.length === 0) return;
        focusMapToOffers(activeOffers);
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, Platform.OS === 'ios' ? 220 : 160);
    });
    return () => {
      cancelled = true;
    };
  }, [showOnlyFavorites, favoritesMapScope, activeOffers, focusMapToOffers]);

  const openRadarCalibration = () => {
    // Bez aktywnej sesji: pokazujemy bramę logowania zamiast otwierać kalibrację.
    // Powód: bez `user.id` backend nie przyjmuje preferencji (`syncRadarPreferencesToBackend`
    // ma early return), push token nie jest rejestrowany (`usePushNotifications`
    // wymaga auth tokena), więc Live Activity i „powiadomienia" stałyby się
    // wizualnym placebo — czego App Review nie zaakceptuje (4.2 / 5.1.1).
    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      pendingAuthTargetRef.current = 'radar';
      setAuthGateContext('radar');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalibrationSessionId((prev) => prev + 1);
    setShowCalibration(true);
  };

  const openFavoritesCalibration = () => {
    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      pendingAuthTargetRef.current = 'favorites';
      setAuthGateContext('favorites');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavoritesCalibrationSessionId((prev) => prev + 1);
    setShowFavoritesCalibration(true);
  };

  // Reset bramy logowania po faktycznym zalogowaniu — i automatyczne przeniesienie
  // do tej kalibracji, którą user pierwotnie chciał otworzyć (UX: nie tracimy intencji).
  // Czytamy `pendingAuthTargetRef.current`, bo modal już mógł być zamknięty
  // (`authGateContext === null`) zanim user zdążył się zalogować.
  useEffect(() => {
    if (!user) return;
    const target = pendingAuthTargetRef.current;
    if (!target) return;
    pendingAuthTargetRef.current = null;
    setAuthGateContext(null);
    // Krótkie opóźnienie — czas, by nawigacja wróciła z zakładki Profil
    // na zakładkę Radar/Ulubione i widok się ustabilizował.
    const t = setTimeout(() => {
      if (target === 'radar') {
        setCalibrationSessionId((prev) => prev + 1);
        setShowCalibration(true);
      } else {
        setFavoritesCalibrationSessionId((prev) => prev + 1);
        setShowFavoritesCalibration(true);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [user]);

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

    if (draftAdvancedFilters.locationMode === 'MAP' && !draftAdvancedFilters.mapBounds) {
      Alert.alert('EstateOS', 'Wybierz obszar na mapie dla trybu „Według obszaru mapy”.');
      return;
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
      minRooms: null,
      city: '',
      districts: [],
      locationMode: 'CITY',
      mapBounds: null,
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

  /**
   * Po wejściu na zakładkę Radar oznaczamy wszystkie aktualne dopasowania jako „widziane”.
   * Dzięki temu badge „NOWE! N” na Live Activity gaśnie po obejrzeniu ekranu radaru.
   * Zapis trzymamy w AsyncStorage z ograniczeniem do ostatnich 500 ID,
   * żeby zbiór nie rósł w nieskończoność.
   */
  useFocusEffect(
    useCallback(() => {
      const ids = radarMatchingOffers
        .map((o) => Number(o?.id))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) return;
      const prev = seenRadarOfferIdsRef.current;
      const hasAllAlready = ids.every((id) => prev.has(id));
      if (hasAllAlready) return;
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      // bezpieczne ograniczenie zbioru — trzymamy ostatnie 500
      const trimmed = next.size > 500 ? new Set(Array.from(next).slice(-500)) : next;
      setSeenRadarOfferIds(trimmed);
      seenRadarOfferIdsRef.current = trimmed;
      void AsyncStorage.setItem('@estateos_radar_seen_offer_ids', JSON.stringify(Array.from(trimmed)));
    }, [radarMatchingOffers])
  );

  const syncRadarPreferencesToBackend = async (payload: typeof radarFilters) => {
    if (!user?.id) return;
    try {
      const dto = buildCanonicalRadarPreferencesDto({
        userId: Number(user.id),
        filters: payload,
        mapContext: {
          lat: radarMapBounds?.centerLat,
          lng: radarMapBounds?.centerLng,
          radius: radarMapBounds?.radiusKm,
        },
      });
      await fetch(`${API_URL}/api/radar/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
    } catch {
      // noop
    }
  };

  const applyRadarCalibration = async (filtersToApply: RadarFilters) => {
    pendingRadarCalibrationFiltersRef.current = null;
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
          const dto = buildCanonicalRadarPreferencesDto({
            userId: Number(user.id),
            filters: filtersToApply,
            mapContext: {
              lat: radarMapBounds?.centerLat,
              lng: radarMapBounds?.centerLng,
              radius: radarMapBounds?.radiusKm,
            },
          });
          await fetch(`${API_URL}/api/radar/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
          });
        }
      } catch {
        // noop
      }
    })();

    // Preferencje push per-device (produkcyjnie: backend może upsert po expoPushToken).
    let pushPrefsSynced = true;
    if (token) {
      pushPrefsSynced = await syncPushDevicePreferences({
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
    if (!pushPrefsSynced) {
      Alert.alert(
        'Nie udało się zapisać ustawień push',
        'Sprawdź, czy powiadomienia systemowe dla EstateOS są włączone i ponów zapis ustawień.'
      );
    }
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
    setAreaPickerReturnTo('RADAR');
    pendingRadarCalibrationFiltersRef.current = currentFilters;
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

    // ZASADA: w trybie „obszar na mapie" miastem radaru jest miasto środka koła z reverse-geocodingu.
    // Heurystyka ofertowa była niepoprawna w pustym lub mieszanym obszarze — pokazywała sąsiednią
    // metropolię zamiast miasta, w które użytkownik faktycznie wycelował.
    let reverseCity = '';
    try {
      const reverse = await Location.reverseGeocodeAsync(center);
      const place = reverse?.[0];
      reverseCity = String(
        place?.city || place?.district || place?.subregion || place?.region || ''
      ).trim();
    } catch {
      // noop
    }

    const cityCount = new Map<string, number>();
    for (const offer of offersInArea) {
      const cityRaw = String(offer.raw?.city || '').trim();
      const districtRaw = String(offer.raw?.district || '').trim();
      const locality = normalizeSearchText(cityRaw) === normalizeSearchText('Reszta kraju')
        ? districtRaw
        : cityRaw || districtRaw;
      if (!locality) continue;
      cityCount.set(locality, (cityCount.get(locality) || 0) + 1);
    }
    const topOffersLocality =
      cityCount.size > 0
        ? Array.from(cityCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : '';

    const cityForFilters =
      reverseCity ||
      areaPickerResolvedLocality ||
      topOffersLocality ||
      (normalizeSearchText(String(radarFilters.city || '').trim()) === normalizeSearchText('Reszta kraju')
        ? ''
        : String(radarFilters.city || '').trim()) ||
      'Wybrany obszar';
    const baseRadarFilters = pendingRadarCalibrationFiltersRef.current || radarFilters;
    const updated: RadarFilters = {
      ...baseRadarFilters,
      calibrationMode: 'MAP',
      city: cityForFilters,
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
      `${cityForFilters} • ${radius.toFixed(1)} km • ${offersInArea.length} ofert`
    );
    if (areaPickerReturnTo === 'ADVANCED') {
      pendingRadarCalibrationFiltersRef.current = null;
      setDraftAdvancedFilters((prev) => ({
        ...prev,
        locationMode: 'MAP',
        mapBounds: {
          centerLat: center.latitude,
          centerLng: center.longitude,
          radiusKm: radius,
        },
        city: cityForFilters,
        districts: [],
      }));
      setShowAreaPicker(false);
      setShowAdvancedSearch(true);
      void pulseHaptic('success');
      return;
    }

    setShowAreaPicker(false);
    pendingRadarCalibrationFiltersRef.current = updated;
    // Wymuszamy nową sesję modala po powrocie z mapy, aby draft nie „łapał” starej Warszawy.
    setCalibrationSessionId((prev) => prev + 1);
    setShowCalibration(true);
    void pulseHaptic('success');
  };

  const areaPickerLiveStats = useMemo(() => {
    const center = areaPickerDraft.center;
    const radiusKm = areaPickerDraft.radiusKm;
    const offersInArea = offers.filter((o) => distanceKm(center.latitude, center.longitude, o.lat, o.lng) <= radiusKm);

    const localityCount = new Map<string, number>();
    for (const offer of offersInArea) {
      const cityRaw = String(offer.raw?.city || '').trim();
      const districtRaw = String(offer.raw?.district || '').trim();
      const locality = normalizeSearchText(cityRaw) === normalizeSearchText('Reszta kraju')
        ? districtRaw
        : cityRaw || districtRaw;
      if (!locality) continue;
      localityCount.set(locality, (localityCount.get(locality) || 0) + 1);
    }

    const topLocalityFromOffers =
      localityCount.size > 0
        ? Array.from(localityCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : (normalizeSearchText(String(radarFilters.city || '').trim()) === normalizeSearchText('Reszta kraju')
            ? 'Wybrany obszar'
            : String(radarFilters.city || '').trim()) || 'Wybrany obszar';
    const topLocality = areaPickerResolvedLocality || topLocalityFromOffers;
    const areaKm2 = Math.PI * radiusKm * radiusKm;

    return {
      offersCount: offersInArea.length,
      locality: topLocality,
      areaKm2,
      radiusKm,
    };
  }, [areaPickerDraft, offers, radarFilters.city, areaPickerResolvedLocality]);

  useEffect(() => {
    if (!showAreaPicker) return;
    const latitude = areaPickerDraft.center.latitude;
    const longitude = areaPickerDraft.center.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (cancelled) return;
        const place = reverse?.[0];
        const locality = String(
          place?.city ||
            place?.district ||
            place?.subregion ||
            place?.region ||
            ''
        ).trim();
        if (locality) setAreaPickerResolvedLocality(locality);
      } catch {
        // noop - zostawiamy ostatnią znaną miejscowość
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [showAreaPicker, areaPickerDraft.center.latitude, areaPickerDraft.center.longitude]);

  useEffect(() => {
    if (showAreaPicker) return;
    setAreaPickerResolvedLocality('');
  }, [showAreaPicker]);

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
          backgroundColor: showOnlyFavorites
            ? favoritesScopeBg
            : isDark
              ? 'rgba(28, 28, 30, 0.85)'
              : 'rgba(255, 255, 255, 0.9)',
          borderColor: showOnlyFavorites
            ? (isMineScope ? 'rgba(16,185,129,0.5)' : 'rgba(247,119,178,0.5)')
            : isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.05)',
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
          <Text
            style={[
              styles.cardPrice,
              {
                color: showOnlyFavorites
                  ? (isMineScope ? (isDark ? '#C9F9E7' : '#0B5B43') : isDark ? '#FFD4E7' : '#5E1C3F')
                  : isDark
                    ? '#FFF'
                    : '#1C1C1E',
              },
            ]}
            numberOfLines={1}
          >
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
          <View style={[styles.badge, { backgroundColor: showOnlyFavorites ? favoritesScopeSubtleBg : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="resize" size={12} color="#8E8E93" />
            <Text style={[styles.badgeText, { color: showOnlyFavorites ? favoritesScopeAccent : isDark ? '#E5E5EA' : '#1C1C1E' }]}>{item.area}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: showOnlyFavorites ? favoritesScopeSubtleBg : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)' }]}>
            <Ionicons name="bed" size={12} color="#8E8E93" />
            <Text style={[styles.badgeText, { color: showOnlyFavorites ? favoritesScopeAccent : isDark ? '#E5E5EA' : '#1C1C1E' }]}>{item.rooms}</Text>
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

          // Prywatność lokalizacji na publicznej mapie:
          //  • `isExactLocation === true`  → pełen pin z ceną w dokładnym punkcie
          //  • `isExactLocation === false` → pin (z ceną) PRZESUNIĘTY deterministycznie
          //    + delikatny okrąg ~250 m, który komunikuje „obszar". Środek okręgu i pin
          //    leżą w tym samym, zjitterowanym punkcie — budynek znajduje się gdzieś
          //    wewnątrz okręgu, ale nigdy w jego centrum.
          // Helper `getPublicMapPresentation` jest deterministyczny względem `offer.id`,
          // więc te same coords są zwracane przy każdym renderze (nie da się ich uśrednić
          // do prawdziwego punktu).
          const isExact = resolveIsExactLocation(offer.raw?.isExactLocation);
          const presentation = getPublicMapPresentation({
            lat,
            lng,
            offerId: offer.id ?? null,
            isExactLocation: isExact,
            viewerIsOwner: false,
          });
          const pinCoord = { latitude: presentation.latitude, longitude: presentation.longitude };
          const circleStyle = presentation.mode === 'circle'
            ? radarPrivacyCircleStyle(markerAccent, isSelected)
            : null;

          return (
            <React.Fragment key={`offer-${String(offer.id ?? idx)}`}>
              {circleStyle ? (
                <Circle
                  center={pinCoord}
                  radius={presentation.circleRadiusM}
                  strokeColor={circleStyle.strokeColor}
                  fillColor={circleStyle.fillColor}
                  strokeWidth={circleStyle.strokeWidth}
                  zIndex={isSelected ? 2 : 1}
                />
              ) : null}
              <Marker
                coordinate={pinCoord}
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
            </React.Fragment>
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
                    ? favoritesAuraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.16] })
                    : 0.04,
                },
              ]}
            >
              <Ionicons
                name={idx % 3 === 0 ? 'heart' : 'heart-outline'}
                size={h.size}
                color={idx % 3 === 0 ? 'rgba(247,119,178,0.34)' : 'rgba(247,119,178,0.2)'}
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
          <BlurView
            intensity={isDark ? 80 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.searchGlass,
              showOnlyFavorites && {
                backgroundColor: favoritesScopeBg,
                borderColor: isMineScope ? 'rgba(16,185,129,0.55)' : 'rgba(247,119,178,0.55)',
              },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={showOnlyFavorites ? favoritesScopeAccent : isDark ? '#FFF' : '#1C1C1E'}
              style={{ marginLeft: 16 }}
            />
            <TextInput
              ref={searchInputRef}
              style={[
                styles.searchInput,
                {
                  color: showOnlyFavorites
                    ? (isMineScope ? (isDark ? '#C9F9E7' : '#0B5B43') : isDark ? '#FFD4E7' : '#5E1C3F')
                    : isDark
                      ? '#FFF'
                      : '#1C1C1E',
                },
              ]}
              placeholder="Miasto, dzielnica, ulica…"
              placeholderTextColor={showOnlyFavorites ? (isMineScope ? 'rgba(16,185,129,0.9)' : 'rgba(247,119,178,0.9)') : '#8E8E93'}
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
          <BlurView
            intensity={isDark ? 80 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.filterGlass, showOnlyFavorites && { backgroundColor: favoritesScopeBg }]}
          >
            <Ionicons name="map" size={22} color={showOnlyFavorites ? favoritesScopeAccent : isDark ? '#FFF' : '#1C1C1E'} />
          </BlurView>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.filterButtonWrap, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDraftAdvancedFilters(advancedFilters);
            setShowAdvancedSearch(true);
          }}
          accessibilityLabel="Wyszukiwanie rozszerzone"
        >
          <BlurView
            intensity={isDark ? 80 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.filterGlass, showOnlyFavorites && { backgroundColor: favoritesScopeBg }]}
          >
            <Ionicons
              name="options"
              size={22}
              color={showOnlyFavorites ? favoritesScopeAccent : isDark ? '#FFF' : '#1C1C1E'}
            />
            {hasAdvancedFiltersActive && (
              <View style={[styles.filterActiveDot, { backgroundColor: showOnlyFavorites ? favoritesScopeAccent : modeAccentColor }]} />
            )}
          </BlurView>
        </Pressable>
      </View>

      {showOnlyFavorites && (
        <Animated.View
          style={[
            styles.favorFloatingIslandWrap,
            {
              top: topBarTop + topUiSpacing.favorTopOffset,
              opacity: modeIslandOpacity,
              transform: [{ translateY: modeIslandTranslateY }, { scale: modeIslandScale }],
            },
          ]}
        >
          <View style={styles.favoritesScopeRailOuter}>
            <BlurView
              intensity={isDark ? 85 : 92}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.favoritesScopeRailBlur,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.82)',
                },
              ]}
            >
              <View style={styles.favoritesScopeRailRow}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: favoritesMapScope === 'FAVORITES' }}
                  onPress={() => {
                    if (favoritesMapScope === 'FAVORITES') return;
                    Haptics.selectionAsync();
                    setFavoritesMapScope('FAVORITES');
                  }}
                  style={({ pressed }) => [
                    styles.favoritesScopeHalf,
                    favoritesMapScope === 'FAVORITES' && styles.favoritesScopeHalfActiveFav,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Ionicons
                    name={favoritesMapScope === 'FAVORITES' ? 'heart' : 'heart-outline'}
                    size={16}
                    color={favoritesMapScope === 'FAVORITES' ? '#F777B2' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.favoritesScopeHalfLabel,
                      { color: favoritesMapScope === 'FAVORITES' ? (isDark ? '#FFD4E7' : '#5E1C3F') : '#8E8E93' },
                    ]}
                    numberOfLines={1}
                  >
                    Ulubione
                  </Text>
                </Pressable>
                <View style={[styles.favoritesScopeDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: favoritesMapScope === 'MINE' }}
                  onPress={() => {
                    if (favoritesMapScope === 'MINE') return;
                    Haptics.selectionAsync();
                    setFavoritesMapScope('MINE');
                  }}
                  style={({ pressed }) => [
                    styles.favoritesScopeHalf,
                    favoritesMapScope === 'MINE' && styles.favoritesScopeHalfActiveMine,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Ionicons
                    name={favoritesMapScope === 'MINE' ? 'person' : 'person-outline'}
                    size={16}
                    color={favoritesMapScope === 'MINE' ? '#10b981' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.favoritesScopeHalfLabel,
                      { color: favoritesMapScope === 'MINE' ? (isDark ? '#C9F9E7' : '#0B5B43') : '#8E8E93' },
                    ]}
                    numberOfLines={1}
                  >
                    Moje
                  </Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
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
        </Animated.View>
      )}
      
      {isSearchFocused && (
        <View style={[styles.suggestionsWrap, { top: Platform.OS === 'ios' ? 113 : 98 }]}>
          <BlurView
            intensity={isDark ? 85 : 95}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.suggestionsGlass,
              { maxHeight: Math.min(height * 0.52, 440) },
              showOnlyFavorites && { backgroundColor: favoritesUiBg, borderColor: 'rgba(247,119,178,0.55)' },
            ]}
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
                        <Text
                          style={[
                            styles.suggestionText,
                            { color: showOnlyFavorites ? (isDark ? '#FFD4E7' : '#5E1C3F') : isDark ? '#FFF' : '#1C1C1E' },
                          ]}
                          numberOfLines={1}
                        >
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
                        style={[
                          styles.cityChip,
                          {
                            borderColor: showOnlyFavorites
                              ? 'rgba(247,119,178,0.5)'
                              : isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.08)',
                            backgroundColor: showOnlyFavorites ? favoritesUiSubtleBg : 'rgba(128,128,128,0.08)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cityChipText,
                            { color: showOnlyFavorites ? (isDark ? '#FFD4E7' : '#5E1C3F') : isDark ? '#FFF' : '#1C1C1E' },
                          ]}
                        >
                          {city}
                        </Text>
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
                            <Text
                              style={[
                                styles.suggestionText,
                                { color: showOnlyFavorites ? (isDark ? '#FFD4E7' : '#5E1C3F') : isDark ? '#FFF' : '#1C1C1E' },
                              ]}
                              numberOfLines={2}
                            >
                              {item.value}
                            </Text>
                            <Text style={[styles.suggestionCategory, { color: '#8E8E93' }]}>{item.category}</Text>
                          </View>
                          <View
                            style={[
                              styles.countBadge,
                              {
                                backgroundColor: showOnlyFavorites
                                  ? favoritesUiSubtleBg
                                  : isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(0,0,0,0.05)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.countBadgeText,
                                { color: showOnlyFavorites ? favoritesUiAccent : isDark ? '#FFF' : '#1C1C1E' },
                              ]}
                            >
                              {item.count}
                            </Text>
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
        <Animated.View
          style={[
            styles.radarToggleContainer,
            {
              top: radarButtonTop,
              opacity: modeIslandOpacity,
              transform: [{ translateY: modeIslandTranslateY }, { scale: modeIslandScale }],
            },
          ]}
        >
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
            {/* Mini-CTA: „Pokaż N dopasowań" — pokazujemy gdy Radar ma realne
                trafienia, a tryb dedykowanego widoku jest jeszcze nieaktywny.
                To zamyka pętlę dla użytkownika, który nie tapnął pusha: jednym
                klikiem przełącza widok listy/mapy na tylko-dopasowania. */}
            {isRadarEnabled && !showRadarMatchesOnly && radarMatchingOffers.length > 0 && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowRadarMatchesOnly(true);
                }}
                style={({ pressed }) => [
                  styles.radarMatchesCta,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Pokaż ${radarMatchingOffers.length} dopasowań Radaru`}
              >
                <View style={styles.radarMatchesCtaDot} />
                <Text style={styles.radarMatchesCtaText}>
                  Pokaż {radarMatchingOffers.length} {pluralOffers(radarMatchingOffers.length)}
                  {newRadarMatchesCount > 0 ? ` · ${newRadarMatchesCount} NOWE` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#10b981" />
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      <View style={styles.offersPreviewContainer}>
        {/* Pasek „Dlaczego widzę te oferty?" — glass-pill w stylu Apple.
            Renderowany ZAWSZE (poza loading) — gdy są oferty, pokazuje tryb
            z parametrami. Gdy brak ofert, ta sama karta zmienia ton (severity
            = 'empty'): tytuł staje się komunikatem „Brak…", subtitle wyjaśnia
            DLACZEGO nie ma wyników, a akcja kontekstowo zachęca do naprawy
            (Resetuj / Wyczyść / Filtruj / Dodaj). Wcześniej znikała → user
            myślał, że appka się zawiesiła. */}
        {!loading && (() => {
          const isEmpty = offerDisplayReason.severity === 'empty';
          // W pustym stanie nakładamy delikatny amber halo na akcent trybu —
          // info wizualne, że to nie awaria, tylko brak wyników dla filtrów.
          const reasonAccent = isEmpty ? '#F59E0B' : offerDisplayReason.accent;
          const reasonIcon = isEmpty ? 'alert-circle' : offerDisplayReason.icon;
          return (
            <View style={styles.offerReasonRow} pointerEvents="box-none">
              <BlurView
                intensity={isDark ? 60 : 80}
                tint={isDark ? 'dark' : 'light'}
                style={[
                  styles.offerReasonPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(20,20,22,0.62)'
                      : 'rgba(255,255,255,0.78)',
                    borderColor: `${reasonAccent}${isEmpty ? '55' : '33'}`,
                    minHeight: isEmpty ? 64 : undefined,
                  },
                ]}
              >
                <View
                  style={[
                    styles.offerReasonIconBubble,
                    { backgroundColor: `${reasonAccent}22` },
                  ]}
                >
                  <Ionicons
                    name={reasonIcon as any}
                    size={14}
                    color={reasonAccent}
                  />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.offerReasonTitle,
                      { color: isDark ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    {offerDisplayReason.title}
                  </Text>
                  <Text
                    numberOfLines={isEmpty ? 2 : 1}
                    ellipsizeMode="tail"
                    style={[
                      styles.offerReasonSubtitle,
                      { color: isDark ? 'rgba(255,255,255,0.66)' : 'rgba(15,23,42,0.62)' },
                    ]}
                  >
                    {offerDisplayReason.subtitle}
                  </Text>
                </View>
                {offerDisplayReason.action && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      offerDisplayReason.action?.onPress();
                    }}
                    style={({ pressed }) => [
                      styles.offerReasonAction,
                      { backgroundColor: `${reasonAccent}1F`, borderColor: `${reasonAccent}55` },
                      pressed && { transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <Text style={[styles.offerReasonActionText, { color: reasonAccent }]}>
                      {offerDisplayReason.action.label}
                    </Text>
                  </Pressable>
                )}
              </BlurView>
            </View>
          );
        })()}

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

      <RadarAuthGateModal
        visible={authGateContext !== null}
        context={authGateContext}
        isDark={isDark}
        onCancel={() => {
          pendingAuthTargetRef.current = null;
          setAuthGateContext(null);
        }}
        onLoginPress={() => {
          // KOLEJNOŚĆ KRYTYCZNA: najpierw zamykamy modal (RN renderuje go jako
          // native overlay nad WSZYSTKIM — tabami, stackiem itd.), dopiero potem
          // nawigujemy. Bez tego AuthScreen jest renderowany, ale niewidoczny,
          // bo zasłania go native window Modal'a. setTimeout daje fade-outowi
          // animacji modalu dokończyć, zanim user zobaczy ekran logowania.
          setAuthGateContext(null);
          setTimeout(() => {
            navigation.navigate('Profil', { authIntent: 'login' });
          }, 220);
        }}
        onRegisterPress={() => {
          setAuthGateContext(null);
          setTimeout(() => {
            navigation.navigate('Profil', { authIntent: 'register' });
          }, 220);
        }}
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
              <View style={styles.areaInsightsCard}>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>Miejscowość</Text>
                  <Text style={styles.areaInsightValue}>{areaPickerLiveStats.locality}</Text>
                </View>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>Obszar</Text>
                  <Text style={styles.areaInsightValue}>
                    {areaPickerLiveStats.areaKm2.toFixed(1)} km² ({areaPickerLiveStats.radiusKm.toFixed(1)} km)
                  </Text>
                </View>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>Oferty w obszarze</Text>
                  <Text style={styles.areaInsightValue}>
                    {areaPickerLiveStats.offersCount} {pluralOffers(areaPickerLiveStats.offersCount)}
                  </Text>
                </View>
              </View>
              <View style={styles.areaActionRow}>
                <Pressable
                  style={styles.areaGhostBtn}
                  onPress={() => {
                    setShowAreaPicker(false);
                    if (areaPickerReturnTo === 'ADVANCED') setShowAdvancedSearch(true);
                    else {
                      setCalibrationSessionId((prev) => prev + 1);
                      setShowCalibration(true);
                    }
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

                <Text style={styles.advancedSection}>Lokalizacja</Text>
                <View style={styles.advancedRow}>
                  {([
                    { key: 'CITY', label: 'Według miast' },
                    { key: 'MAP', label: 'Według obszaru mapy' },
                  ] as const).map((item) => {
                    const active = draftAdvancedFilters.locationMode === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        style={[
                          styles.advancedChip,
                          active && styles.advancedChipActive,
                          active && {
                            borderColor: draftModeAccentColor,
                            backgroundColor:
                              draftAdvancedFilters.transactionType === 'RENT'
                                ? 'rgba(10,132,255,0.18)'
                                : 'rgba(16,185,129,0.18)',
                          },
                        ]}
                        onPress={() =>
                          setDraftAdvancedFilters((p) => ({
                            ...p,
                            locationMode: item.key,
                            ...(item.key === 'CITY' ? { mapBounds: null } : {}),
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.advancedChipText,
                            active && styles.advancedChipTextActive,
                            active && { color: draftModeAccentColor },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {draftAdvancedFilters.locationMode === 'CITY' ? (
                  <>
                    <Text style={styles.advancedSection}>Miasto</Text>
                    <View style={styles.advancedRow}>
                      {['', ...backendCities].map((city) => {
                        const active = draftAdvancedFilters.city === city;
                        return (
                          <Pressable key={city || 'all'} style={[styles.advancedChip, active && styles.advancedChipActive, active && { borderColor: draftModeAccentColor, backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)' }]} onPress={() => setDraftAdvancedFilters((p) => ({ ...p, city, districts: [], mapBounds: null }))}>
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
                  </>
                ) : (
                  <View style={{ marginBottom: 12 }}>
                    <Pressable
                      style={[
                        styles.advancedChip,
                        styles.advancedChipActive,
                        {
                          alignSelf: 'flex-start',
                          borderColor: draftModeAccentColor,
                          backgroundColor:
                            draftAdvancedFilters.transactionType === 'RENT'
                              ? 'rgba(10,132,255,0.18)'
                              : 'rgba(16,185,129,0.18)',
                        },
                      ]}
                      onPress={() => {
                        setAreaPickerReturnTo('ADVANCED');
                        setShowAdvancedSearch(false);
                        const baseCenter = userLocation || areaPickerDraft.center;
                        setAreaPickerDraft((prev) => ({
                          ...prev,
                          center: baseCenter,
                          latitudeDelta: 0.16,
                          longitudeDelta: 0.12,
                        }));
                        setShowAreaPicker(true);
                        mapRef.current?.animateToRegion(
                          {
                            latitude: baseCenter.latitude,
                            longitude: baseCenter.longitude,
                            latitudeDelta: 0.16,
                            longitudeDelta: 0.12,
                          },
                          450
                        );
                        void pulseHaptic(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                    >
                      <Text style={[styles.advancedChipText, { color: draftModeAccentColor, fontWeight: '800' }]}>
                        Zaznacz obszar na mapie
                      </Text>
                    </Pressable>
                    <Text style={{ marginTop: 8, color: '#8E8E93', fontWeight: '600' }}>
                      {draftAdvancedFilters.mapBounds
                        ? `Obszar: ${draftAdvancedFilters.mapBounds.radiusKm.toFixed(1)} km`
                        : 'Nie wybrano obszaru — stuknij i zaznacz na mapie.'}
                    </Text>
                  </View>
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

                <Text style={styles.advancedSection}>Pokoje (min.)</Text>
                <View style={styles.advancedRow}>
                  {([
                    { value: null, label: 'Dowolnie' },
                    { value: 1, label: '1+' },
                    { value: 2, label: '2+' },
                    { value: 3, label: '3+' },
                    { value: 4, label: '4+' },
                    { value: 5, label: '5+' },
                  ] as const).map((room) => {
                    const active = draftAdvancedFilters.minRooms === room.value;
                    return (
                      <Pressable
                        key={room.label}
                        style={[
                          styles.advancedChip,
                          active && styles.advancedChipActive,
                          active && {
                            borderColor: draftModeAccentColor,
                            backgroundColor:
                              draftAdvancedFilters.transactionType === 'RENT'
                                ? 'rgba(10,132,255,0.18)'
                                : 'rgba(16,185,129,0.18)',
                          },
                        ]}
                        onPress={() =>
                          setDraftAdvancedFilters((p) => ({
                            ...p,
                            minRooms: room.value,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.advancedChipText,
                            active && styles.advancedChipTextActive,
                            active && { color: draftModeAccentColor },
                          ]}
                        >
                          {room.label}
                        </Text>
                      </Pressable>
                    );
                  })}
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
    minHeight: 68,
  },
  favorFloatingIslandWrap: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 48,
    elevation: 48,
  },
  favoritesScopeRailOuter: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  favoritesScopeRailBlur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  favoritesScopeRailRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  favoritesScopeHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  favoritesScopeHalfActiveFav: {
    backgroundColor: 'rgba(247,119,178,0.16)',
  },
  favoritesScopeHalfActiveMine: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  favoritesScopeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  favoritesScopeHalfLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.15,
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
  searchModeChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '92%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchModeChipText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.15,
    lineHeight: 11,
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
  /**
   * Mini-CTA pod pillem „EstateOS™ Radar / Status: LIVE" — pojawia się tylko,
   * gdy Radar realnie złowił coś, a użytkownik nie jest jeszcze w trybie
   * „Dopasowania Radaru". Jedno tapnięcie ⇒ przełączenie listy/mapy na same
   * dopasowania (alternatywna ścieżka dla user-a, który nie tapnął pusha).
   */
  radarMatchesCta: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.55)',
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  radarMatchesCtaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  radarMatchesCtaText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  offerReasonRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  offerReasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  offerReasonIconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerReasonTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  offerReasonSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  offerReasonAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offerReasonActionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  areaInsightsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  areaInsightRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaInsightLabel: {
    color: '#D1D1D6',
    fontSize: 12,
    fontWeight: '700',
  },
  areaInsightValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: '62%',
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