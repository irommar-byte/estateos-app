import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Pressable,
  FlatList,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  InteractionManager,
  Dimensions,
  useColorScheme,
  AppState,
  PanResponder,
} from 'react-native';
import MapViewCore, { Marker, Region, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { RadarMapView } from '../components/MapGestureHost';
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
import { useOpenHouseLiveStore } from '../store/useOpenHouseLiveStore';
import { useBlockedUsersStore } from '../store/useBlockedUsersStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadarCalibrationModal, { RadarFilters } from '../components/RadarCalibrationModal';
import {
  buildRadarActiveScopeLine,
  isRadarFactoryDefaults,
  loadRadarRecentAreas,
  pushRadarRecentArea,
  type RadarRecentSavedArea,
} from '../utils/radarRecentAreas';
import { registerPushNotifications, syncPushDevicePreferences } from '../hooks/usePushNotifications';
import { buildCanonicalRadarPreferencesDto } from '../contracts/parityContracts';
import {
  fetchRadarPreferenceForUser,
  mapContextForCanonicalDto,
  postRadarPreferencesToBackend,
  radarFiltersFromApiPreference,
} from '../utils/radarPreferenceSync';
import { loadRadarCommittedState, saveRadarCommittedState } from '../utils/radarCommittedStorage';
import { radarPropertyTypeMatchesFilter } from '../utils/radarPropertyType';
import {
  filterOffersInMapRegion,
  mergeSelectedOfferIntoMapPins,
  capMapPinsNearCenter,
  shouldShowMapPrivacyCircles,
} from '../utils/radarMapViewport';
import { logAdvancedMapSearch, logRadarCalibrationSearch } from '../services/radarSearchHistoryService';
import CountryChipHangingFlag from '../components/CountryChipHangingFlag';
import { countryLabelInOwnLanguageUpper } from '../utils/phoneRegions';
import {
  STRICT_CITIES,
  STRICT_CITY_DISTRICTS,
  METRO_STRICT_CITIES,
  REST_OF_COUNTRY_CITY,
  resolveIsExactLocation,
  resolveLocalityCountryFromPlace,
  offerMatchesCityFilter,
  offerListingCountryIso,
  formatLocationLabel,
} from '../constants/locationEcosystem';
import { getPublicMapPresentation } from '../utils/publicLocationPrivacy';
import { focusMapCoordinateAboveOverlay, fitMapCoordinatesAboveOverlay } from '../utils/mapCameraFocus';
import { useFloatingChatsLayoutStore } from '../store/useFloatingChatsLayoutStore';
import { getOfferLifecycleState, isOfferClosed } from '../utils/offerLifecycle';
import { syncRadarLiveActivity } from '../services/radarLiveActivityService';
import { API_URL } from '../config/network';
import { mobileFetchJson } from '../utils/mobileFetch';
import { parseOfferList } from '../utils/offerCatalogPipeline';
import { findWebOfferById } from '../utils/webOffersFallback';
import { isOfferLegallyVerified } from '../utils/legalVerificationStatus';
import CurrencySegmentControl from '../components/CurrencySegmentControl';
import AdvancedFilterSegment from '../components/AdvancedFilterSegment';
import PolandScopeNote from '../components/PolandScopeNote';
import JellyReveal from '../components/JellyReveal';
import RadarOfferGallery, {
  type GalleryCountryFilter,
  type GalleryOffer,
  type GalleryPropertyFilter,
  type GallerySortFilter,
  type GalleryTransactionFilter,
} from '../components/radar/RadarOfferGallery';
import { isOfferFeatured } from '../utils/listingPromotion';
import CatalogSearchFilterButton from '../components/CatalogSearchFilterButton';
import MarketCatalogViewToggle, {
  type MarketCatalogContentMode,
} from '../components/catalog/MarketCatalogViewToggle';
import ChromeIconButton from '../components/catalog/ChromeIconButton';
import VerticalSegmentRail from '../components/VerticalSegmentRail';
import RadarStatusBulb from '../components/radar/RadarStatusBulb';
import { OfferMapMarkerPin } from '../components/radar/OfferMapMarkerPin';
import { AndroidMapPriceMarker } from '../components/radar/AndroidMapPriceMarker';
import { AppleMapClusterMarker } from '../components/radar/AppleMapClusterMarker';
import { advancedPriceBoundsToPln, convertBetweenCurrencies } from '../money/convert';
import { formatCurrencySuffix, formatMarkerPriceCompact, resolveOfferDisplayAmount } from '../money/format';
import { parseOfferNumericPrice, resolveOfferListingPrice } from '../money/offerPrice';
import type { ListingCurrency } from '../money/types';
import { useMoneyContext } from '../money/useMoneyContext';
import { localeToDateFormat, useI18n } from '../i18n';
import { t as translate } from '../i18n/translate';
import {
  isFavoriteId,
  loadFavoriteIds,
  normalizeFavoriteIds,
  toggleFavoriteId,
} from '../utils/favoritesStorage';

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
  if (accentHex === RENT_MARKER_COLOR) {
    return ['#8ECBFF', '#3DA3FF', '#0066CC'];
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

function hasFiniteCoords(lat: unknown, lng: unknown): boolean {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

const MAP_CLUSTERING_ENABLED = true;
const MAP_MAX_PINS_IN_VIEW = 420;
const RadarMapComponent: any = RadarMapView;
const SELL_MARKER_COLOR = '#10b981';
const RENT_MARKER_COLOR = '#0A84FF';

const RECENT_SEARCH_KEY = '@estateos_home_search_recent';
const MAX_RECENT_SEARCHES = 8;
const QUICK_CITIES = [...METRO_STRICT_CITIES];
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
  if (abs === 1) return translate('radar.plural.offerOne');
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return translate('radar.plural.offerFew');
  return translate('radar.plural.offerMany');
}

function radarMatchesVerb(n: number) {
  return Math.abs(n) === 1 ? translate('radar.plural.matchesVerbOne') : translate('radar.plural.matchesVerbMany');
}

type RankedSuggestion = {
  key: string;
  value: string;
  category: string;
  count: number;
};
const DEFAULT_REGION = {
  latitude: 52.1,
  longitude: 19.4,
  latitudeDelta: 7.2,
  longitudeDelta: 7.2,
};

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

function extractOfferOwnerCandidateIds(offer: MapOffer): number[] {
  return [
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
}

function isBlockedMapOffer(offer: MapOffer, blockedIds: Set<number>): boolean {
  if (blockedIds.size === 0) return false;
  return extractOfferOwnerCandidateIds(offer).some((id) => blockedIds.has(id));
}

function isMapOfferOwnedByUser(offer: MapOffer, userId: number): boolean {
  if (!userId) return false;
  return extractOfferOwnerCandidateIds(offer).includes(userId);
}

function extractRawOfferOwnerCandidateIds(raw: Record<string, unknown>): number[] {
  return [
    raw?.userId,
    raw?.ownerId,
    raw?.sellerId,
    raw?.authorId,
    raw?.createdById,
    (raw?.user as { id?: unknown } | undefined)?.id,
    (raw?.owner as { id?: unknown } | undefined)?.id,
    (raw?.seller as { id?: unknown } | undefined)?.id,
    (raw?.createdBy as { id?: unknown } | undefined)?.id,
  ]
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function isBlockedRawOffer(raw: Record<string, unknown>, blockedIds: Set<number>): boolean {
  if (blockedIds.size === 0) return false;
  return extractRawOfferOwnerCandidateIds(raw).some((id) => blockedIds.has(id));
}

function isRawOfferOwnedByUser(raw: Record<string, unknown>, userId: number): boolean {
  if (!userId) return false;
  return extractRawOfferOwnerCandidateIds(raw).includes(userId);
}

function offerTransactionTypeMatches(raw: Record<string, unknown>, transactionType: 'SELL' | 'RENT'): boolean {
  const rawTx = String(raw?.transactionType || 'SELL').toUpperCase();
  return rawTx === transactionType;
}

type AdvancedLocationMode = 'CITY' | 'MAP';
type AdvancedMapBounds = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};
type AdvancedFilters = {
  transactionType: 'SELL' | 'RENT';
  priceCurrency: ListingCurrency;
  minPrice: number | null;
  maxPrice: number | null;
  minPricePerM2: number | null;
  maxPricePerM2: number | null;
  minArea: number | null;
  maxArea: number | null;
  minPlotArea: number | null;
  maxPlotArea: number | null;
  minRooms: number | null;
  /** Wolne wyszukiwanie w tytule / opisie / lokalizacji (np. „penthouse”, „piekarnia”). */
  keyword: string;
  city: string;
  districts: string[];
  localityCountryCode: string;
  locationMode: AdvancedLocationMode;
  mapBounds: AdvancedMapBounds | null;
  propertyType: 'ALL' | 'FLAT' | 'HOUSE' | 'PLOT' | 'COMMERCIAL';
};

const EMPTY_BLOCKED_ID_SET = new Set<number>();

const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  transactionType: 'SELL',
  priceCurrency: 'PLN',
  minPrice: null,
  maxPrice: null,
  minPricePerM2: null,
  maxPricePerM2: null,
  minArea: null,
  maxArea: null,
  minPlotArea: null,
  maxPlotArea: null,
  minRooms: null,
  keyword: '',
  city: '',
  districts: [],
  localityCountryCode: '',
  locationMode: 'CITY',
  mapBounds: null,
  propertyType: 'ALL',
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

const getTransactionBadge = (rawTransactionType: unknown) => {
  const normalized = String(rawTransactionType || '').toUpperCase();
  if (normalized === 'RENT') {
    return { label: translate('radar.home.transactionRent'), color: RENT_MARKER_COLOR };
  }
  return { label: translate('radar.home.transactionSell'), color: SELL_MARKER_COLOR };
};

/** Kolor pinezki wyłącznie od typu transakcji (sprzedaż / wynajem). */
function offerMarkerAccent(raw: any): string {
  const tx = String(raw?.transactionType || '').toUpperCase();
  return tx === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;
}

const formatOfferPublishDate = (raw: any, locale: import('../i18n').AppLocale) => {
  const value =
    raw?.publishedAt ||
    raw?.published_at ||
    raw?.publicationDate ||
    raw?.createdAt ||
    raw?.created_at;
  if (!value) return translate('radar.home.publishDateEmpty');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translate('radar.home.publishDateEmpty');
  const dateLocale = localeToDateFormat(locale);
  return translate('radar.home.publishDate', { date: date.toLocaleDateString(dateLocale) });
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

/** Promień trybu „Oferty w Twojej okolicy" na Radarze (bez filtrów / wyszukiwania). */
const NEARBY_RADIUS_KM = 25;
/** Hold na Live Radar: włącz / wyłącz (ms). */
const RADAR_HOLD_SECONDS = 3;
const RADAR_HOLD_MS = RADAR_HOLD_SECONDS * 1000;

function propertyTypeMatchesFilter(rawType: string, filterType: AdvancedFilters['propertyType']): boolean {
  return radarPropertyTypeMatchesFilter(rawType, filterType);
}

/** Który wymiar lokalizacji pominąć przy liczeniu chipów (faceted search). */
type AdvancedLocationFacet = 'country' | 'city' | 'district';

function offerMatchesAdvancedFilters(
  offer: MapOffer,
  filters: AdvancedFilters,
  rate: number,
  locationFacet?: AdvancedLocationFacet,
): boolean {
  const listing = resolveOfferListingPrice(offer.raw, rate);
  const rawPrice = listing.plnAmount > 0 ? listing.plnAmount : listing.amount;
  const rawArea = Number(String(offer.raw?.area ?? '').replace(',', '.')) || 0;
  const rawRooms = Number(String(offer.raw?.rooms ?? '').replace(/[^\d]/g, '')) || 0;
  const rawDistrict = normalizeSearchText(String(offer.raw?.district || '').trim());
  const rawPropertyType = String(offer.raw?.propertyType || '').toUpperCase();
  if (!offerTransactionTypeMatches(offer.raw, filters.transactionType)) return false;

  const { minPln, maxPln } = advancedPriceBoundsToPln(
    filters.minPrice,
    filters.maxPrice,
    filters.priceCurrency,
    rate,
  );
  if (minPln !== null && rawPrice < minPln) return false;
  if (maxPln !== null && rawPrice > maxPln) return false;

  if (filters.minPricePerM2 !== null || filters.maxPricePerM2 !== null) {
    if (!(rawArea > 0) || !(rawPrice > 0)) return false;
    const perM2 = rawPrice / rawArea;
    const { minPln: minPerM2, maxPln: maxPerM2 } = advancedPriceBoundsToPln(
      filters.minPricePerM2,
      filters.maxPricePerM2,
      filters.priceCurrency,
      rate,
    );
    if (minPerM2 !== null && perM2 < minPerM2) return false;
    if (maxPerM2 !== null && perM2 > maxPerM2) return false;
  }

  if (filters.minArea !== null && rawArea < filters.minArea) return false;
  if (filters.maxArea !== null && rawArea > filters.maxArea) return false;

  const plotFilterActive = filters.minPlotArea !== null || filters.maxPlotArea !== null;
  if (plotFilterActive) {
    let rawPlot = 0;
    if (rawPropertyType === 'HOUSE') {
      rawPlot = Number(String(offer.raw?.plotArea ?? '').replace(',', '.')) || 0;
    } else if (rawPropertyType === 'PLOT') {
      rawPlot = Number(String(offer.raw?.plotArea ?? offer.raw?.area ?? '').replace(',', '.')) || 0;
    } else {
      return false;
    }
    if (filters.minPlotArea !== null && rawPlot < filters.minPlotArea) return false;
    if (filters.maxPlotArea !== null && rawPlot > filters.maxPlotArea) return false;
  }

  if (filters.minRooms !== null && rawRooms < filters.minRooms) return false;
  if (!propertyTypeMatchesFilter(rawPropertyType, filters.propertyType)) return false;

  const keyword = normalizeSearchText(filters.keyword || '');
  if (keyword) {
    const haystack = normalizeSearchText(
      [
        offer.raw?.title,
        offer.raw?.description,
        offer.raw?.city,
        offer.raw?.district,
        offer.raw?.street,
        offer.raw?.address,
        offer.type,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!haystack.includes(keyword)) return false;
  }

  if (filters.locationMode === 'CITY') {
    if (locationFacet !== 'country') {
      const selectedCountry = filters.localityCountryCode.trim().toUpperCase();
      if (selectedCountry && offerListingCountryIso(offer.raw) !== selectedCountry) return false;
    }
    if (locationFacet !== 'country' && locationFacet !== 'city') {
      const selectedCity = filters.city.trim();
      if (selectedCity && !radarCityMatches(offer.raw, selectedCity)) return false;
    }
    if (!locationFacet) {
      if (
        filters.districts.length > 0 &&
        !filters.districts.some((d) => normalizeSearchText(d.trim()) === rawDistrict)
      ) {
        return false;
      }
    }
  } else if (!locationFacet) {
    if (!filters.mapBounds) return false;
    const distance = distanceKm(
      filters.mapBounds.centerLat,
      filters.mapBounds.centerLng,
      Number(offer.lat),
      Number(offer.lng),
    );
    if (!Number.isFinite(distance) || distance > filters.mapBounds.radiusKm) return false;
  }

  return true;
}

function countOffersMatchingAdvancedFilters(
  source: MapOffer[],
  filters: AdvancedFilters,
  rate: number,
  locationFacet?: AdvancedLocationFacet,
): number {
  let count = 0;
  for (const offer of source) {
    if (offerMatchesAdvancedFilters(offer, filters, rate, locationFacet)) count += 1;
  }
  return count;
}

/** Wystarczy wybrane państwo — reszta parametrów opcjonalna. */
function isAdvancedLocationReadyForApply(filters: AdvancedFilters): boolean {
  return Boolean(filters.localityCountryCode.trim());
}

function regionForMapBounds(bounds: { centerLat: number; centerLng: number; radiusKm: number }): Region {
  const latDelta = Math.max(0.025, (bounds.radiusKm / 111) * 2.6);
  const lngDelta = Math.max(0.02, latDelta * 1.15);
  return {
    latitude: bounds.centerLat,
    longitude: bounds.centerLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

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

function radarCityMatches(raw: Record<string, unknown>, selectedCity: string) {
  return offerMatchesCityFilter(raw, selectedCity);
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
    rf.requireTwoLevel ? !!raw.isTwoLevel : null,
  ].filter((v) => v !== null) as boolean[];
  if (required.length === 0) return 100;
  const present = required.filter(Boolean).length;
  return clampScore((present / required.length) * 100);
}

/** Twarda bramka geograficzna — bez tego oferta spoza obszaru może wejść samą „punktacją” ceny/metrażu. */
function passesRadarLocationGate(
  offer: MapOffer,
  rf: RadarFilters,
  bounds: RadarMapBounds | null,
): boolean {
  const raw = offer.raw;
  const lat = Number(offer.lat);
  const lng = Number(offer.lng);

  if (rf.calibrationMode === 'CITY') {
    const selCity = rf.city.trim();
    if (selCity && !radarCityMatches(raw, selCity)) return false;
    if (rf.selectedDistricts.length === 0) return true;
    const rawDistrict = normalizeSearchText(String(raw.district || '').trim());
    return rf.selectedDistricts.some((d) => normalizeSearchText(String(d).trim()) === rawDistrict);
  }

  if (!bounds || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const limitKm = radarGeoRadiusLimitKm(bounds.radiusKm, rf.matchThreshold);
  const dKm = distanceKm(bounds.centerLat, bounds.centerLng, lat, lng);
  return dKm <= limitKm;
}

function locationScore(offer: MapOffer, rf: RadarFilters, bounds: RadarMapBounds | null) {
  const raw = offer.raw;
  if (rf.calibrationMode === 'CITY') {
    const selCity = rf.city.trim();
    if (selCity && !radarCityMatches(raw, selCity)) return 0;
    if (rf.selectedDistricts.length === 0) return 100;

    const rawDistrict = normalizeSearchText(String(raw.district || '').trim());
    const districtMatch = rf.selectedDistricts.some((d) => normalizeSearchText(String(d).trim()) === rawDistrict);
    // To nadal jest to samo miasto, ale poza wybraną dzielnicą: wpada dopiero przy szerszym skanowaniu.
    return districtMatch ? 100 : 50;
  }

  if (!bounds) return 0;
  const baseRadius = Math.max(0.1, bounds.radiusKm);
  const dKm = distanceKm(bounds.centerLat, bounds.centerLng, offer.lat, offer.lng);
  if (dKm <= baseRadius) return 100;
  if (dKm <= baseRadius * 2) return clampScore(100 - ((dKm / baseRadius) - 1) * 50);
  return 0;
}

function radarMatchScore(offer: MapOffer, rf: RadarFilters, bounds: RadarMapBounds | null): number {
  const raw = offer.raw;
  if (String(raw.transactionType || '').toUpperCase() !== rf.transactionType) return 0;
  if (rf.propertyType !== 'ALL' && !radarPropertyTypeMatchesFilter(String(raw.propertyType || ''), rf.propertyType)) return 0;

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
  if (!passesRadarLocationGate(offer, rf, bounds)) return false;
  return radarMatchScore(offer, rf, bounds) >= Math.max(50, Math.min(100, rf.matchThreshold));
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
  const { t } = useI18n();
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
  const title = isFavorites ? t('radar.authGate.titleFavorites') : t('radar.authGate.titleRadar');
  const subtitle = isFavorites ? t('radar.authGate.subtitleFavorites') : t('radar.authGate.subtitleRadar');

  const accent = '#10b981';
  const cardBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.96)';
  const textColor = isDark ? '#FFFFFF' : '#1C1C1E';
  const subtitleColor = isDark ? 'rgba(235,235,245,0.72)' : 'rgba(60,60,67,0.7)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
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
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>{t('radar.authGate.bulletPush')}</Text>
            </View>
            <View style={authGateStyles.bulletRow}>
              <Ionicons name="sync-outline" size={16} color={accent} />
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>{t('radar.authGate.bulletSync')}</Text>
            </View>
            <View style={authGateStyles.bulletRow}>
              <Ionicons name="lock-closed-outline" size={16} color={accent} />
              <Text style={[authGateStyles.bulletText, { color: textColor }]}>{t('radar.authGate.bulletSecure')}</Text>
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
            <Text style={authGateStyles.primaryBtnText}>{t('radar.authGate.login')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [authGateStyles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              void Haptics.selectionAsync();
              onRegisterPress();
            }}
          >
            <Text style={[authGateStyles.secondaryBtnText, { color: accent }]}>{t('radar.authGate.register')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [authGateStyles.ghostBtn, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onCancel}
          >
            <Text style={[authGateStyles.ghostBtnText, { color: subtitleColor }]}>{t('radar.authGate.later')}</Text>
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
  const { formatOffer, preference, rate } = useMoneyContext();
  const { t, locale } = useI18n();
  const dateLocale = localeToDateFormat(locale);

  const mapRef = useRef<MapViewCore | null>(null);
  const listRef = useRef<FlatList<any> | null>(null);
  const pendingSearchMapFocusRef = useRef<string | null>(null);

  const [offers, setOffers] = useState<MapOffer[]>([]);
  /** Pełny katalog aktywnych ofert (także bez współrzędnych) — do listy państw w wyszukiwaniu rozszerzonym. */
  const [catalogRawOffers, setCatalogRawOffers] = useState<Record<string, unknown>[]>([]);
  const catalogCountRef = useRef(0);
  const blockedIds = useBlockedUsersStore((s) => s.blockedIds) ?? EMPTY_BLOCKED_ID_SET;
  /** Własne ogłoszenia z `includeAll` — mogą być ACTIVE w profilu, ale poza publicznym feedem Radaru. */
  const [ownerMapOffers, setOwnerMapOffers] = useState<MapOffer[]>([]);
  const [ownerActiveAccountCount, setOwnerActiveAccountCount] = useState(0);
  const [ownerLegalByOfferId, setOwnerLegalByOfferId] = useState<Record<number, boolean>>({});
  /** Ulubione zapisane serduszkiem, ale poza aktualnym feedem mapy — dociągane po ID. */
  const [favoriteHydratedOffers, setFavoriteHydratedOffers] = useState<MapOffer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [offersFetchError, setOffersFetchError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(!!route?.params?.favoritesOnly);
  const tabSurface: 'market' | 'explore' =
    route?.params?.tabSurface === 'explore' ? 'explore' : 'market';
  const [exploreLive, setExploreLive] = useState(
    () => !!(route?.params?.exploreLive || route?.params?.openCalibration || route?.params?.radarFocus),
  );
  const [radarBrowseMode, setRadarBrowseMode] = useState<'RADAR' | 'GALLERY'>(() => {
    if (route?.params?.tabSurface === 'explore') return 'RADAR';
    if (route?.params?.radarBrowseMode === 'RADAR' || route?.params?.radarBrowseMode === 'GALLERY') {
      return route.params.radarBrowseMode;
    }
    return 'GALLERY';
  });
  const [galleryTransactionFilter, setGalleryTransactionFilter] = useState<GalleryTransactionFilter>('SELL');
  const [galleryCountryFilter, setGalleryCountryFilter] = useState<GalleryCountryFilter>('ALL');
  const [galleryPropertyFilter, setGalleryPropertyFilter] = useState<GalleryPropertyFilter>('ALL');
  const [gallerySortFilter, setGallerySortFilter] = useState<GallerySortFilter>('NEWEST');
  const [favoritesMapScope, setFavoritesMapScope] = useState<'FAVORITES' | 'MINE'>('MINE');
  const [unreadDealroomMessagesCount, setUnreadDealroomMessagesCount] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  /** Opt-in: filtr 25 km + zoom GPS — domyślnie pokazujemy całą mapę pinezek. */
  const [nearbyModeEnabled, setNearbyModeEnabled] = useState(false);
  const didFitAllPinsRef = useRef(false);
  const pendingFitAllPinsRef = useRef(false);
  const [fitAllRequestId, setFitAllRequestId] = useState(0);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [marketContentMode, setMarketContentMode] = useState<MarketCatalogContentMode>('catalog');
  const [showCalibration, setShowCalibration] = useState(false);
  const [recentRadarAreasList, setRecentRadarAreasList] = useState<RadarRecentSavedArea[]>([]);
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
   *  • wyłączenie Radaru (`isRadarActive = false`) — bez Radaru nie ma sensu
   *    pokazywać „dopasowań".
   *
   * MA NAJWYŻSZY PRIORYTET w `offerDisplayReason`, więc nigdy nie miesza się
   * wizualnie z innymi trybami — to jest „dedykowany widok wyników Radaru".
   */
  const [showRadarMatchesOnly, setShowRadarMatchesOnly] = useState(false);
  const [calibrationSessionId, setCalibrationSessionId] = useState(0);
  const [favoritesCalibrationSessionId, setFavoritesCalibrationSessionId] = useState(0);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advancedExtrasExpanded, setAdvancedExtrasExpanded] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [mapViewportRegion, setMapViewportRegion] = useState<Region>(DEFAULT_REGION);
  /** iOS AIRMap: nie montuj pinów zanim natywna mapa nie będzie gotowa. */
  const [iosMapPinsReady, setIosMapPinsReady] = useState(Platform.OS !== 'ios');

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
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
    localityCountry: 'Polska',
    localityCountryCode: 'PL',
    selectedDistricts: [] as string[],
    maxPrice: 5000000,
    minArea: 0,
    minYear: 1900,
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
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
  /**
   * `useState(defaultRadarFilters)` ustala `pushNotifications` tylko przy pierwszym montowaniu.
   * Po `restoreSession()` `isRadarActive` może być już `true`, a to pole zostaje `false` — zielony
   * pillek na mapie (ze store) nie zgadza się z modalem kalibracji (ze `radarFilters`).
   */
  useEffect(() => {
    if (!user) return;
    setRadarFilters((prev) =>
      prev.pushNotifications === isRadarActive ? prev : { ...prev, pushNotifications: !!isRadarActive }
    );
  }, [user, isRadarActive]);

  /** Jedno źródło prawdy po stronie serwera (jak WWW) — API wygrywa z lokalnym cache. */
  const radarPreferencesHydratedRef = useRef(false);
  useEffect(() => {
    radarPreferencesHydratedRef.current = false;
  }, [user?.id]);
  useEffect(() => {
    const userId = Number(user?.id || 0);
    if (!userId) return;
    if (radarPreferencesHydratedRef.current) return;
    let cancelled = false;
    void (async () => {
      const applyRestored = (filters: typeof defaultRadarFilters, mapBounds: typeof radarMapBounds | null) => {
        setRadarFilters(filters);
        void setRadarActive(!!filters.pushNotifications);
        if (mapBounds) {
          setRadarMapBounds(mapBounds);
          setMapUsesRadarFilters(true);
          setAreaSummary(`${filters.city || 'Obszar'} · ${mapBounds.radiusKm} km`);
        } else if (!isRadarFactoryDefaults(filters)) {
          setMapUsesRadarFilters(true);
          setAreaSummary(filters.city || '');
        }
      };

      if (token) {
        try {
          const { restoreRadarSessionFromServer } = await import('../utils/radarSessionRestore');
          const restored = await restoreRadarSessionFromServer({
            userId,
            token,
            defaults: defaultRadarFilters,
            setRadarActive,
          });
          if (cancelled) return;
          if (restored) {
            applyRestored(restored.filters, restored.mapBounds);
            radarPreferencesHydratedRef.current = true;
            return;
          }
        } catch (e) {
          if (__DEV__) console.warn('[radar] hydrate from API failed', e);
        }
      }

      const committed = await loadRadarCommittedState(userId);
      if (cancelled) return;
      if (committed) {
        const filters = {
          ...committed.filters,
          pushNotifications: committed.filters.pushNotifications !== false,
        };
        applyRestored(filters, committed.mapBounds);
        radarPreferencesHydratedRef.current = true;
        return;
      }
      radarPreferencesHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, token, setRadarActive]);
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
      radarTopOffset: isTablet ? 116 : isCompactViewport ? 94 : 102,
    }),
    [isTablet, isCompactViewport]
  );
  const bottomCardsInset = useMemo(() => {
    const tabBase = Platform.OS === 'ios' ? 18 : 14;
    return tabBase + insets.bottom;
  }, [insets.bottom]);
  const liveBannerAnchorRef = useRef<View>(null);
  const setOfferPillTopY = useOpenHouseLiveStore((s) => s.setOfferPillTopY);
  const measureLiveBannerAnchor = useCallback(() => {
    requestAnimationFrame(() => {
      liveBannerAnchorRef.current?.measureInWindow((_x, y) => {
        if (Number.isFinite(y) && y > 40) setOfferPillTopY(y);
      });
    });
  }, [setOfferPillTopY]);
  useFocusEffect(
    useCallback(() => {
      measureLiveBannerAnchor();
    }, [measureLiveBannerAnchor])
  );
  useFocusEffect(
    useCallback(() => {
      const top = topBarTop + 56;
      useFloatingChatsLayoutStore.getState().setAnchor({ mode: 'radarFilter', top, right: 19 });
      return () => {
        useFloatingChatsLayoutStore.getState().setAnchor({ mode: 'default' });
      };
    }, [topBarTop])
  );
  const radarButtonTop = useMemo(
    // Snap spacing: stały rytm pionowy niezależnie od rozmiaru iPhone.
    () => topBarTop + topUiSpacing.radarTopOffset,
    [topBarTop, topUiSpacing.radarTopOffset]
  );
  /** Bezpośrednio pod paskiem wyszukiwania — bez luki na mapę. */
  const browseChromeTop = useMemo(() => {
    return topBarTop + 52;
  }, [topBarTop]);
  const isGalleryBrowse = !showOnlyFavorites && radarBrowseMode === 'GALLERY' && !showAreaPicker;
  const isGalleryLightChrome = isGalleryBrowse && !isDark;
  /** iOS: po wyjściu z Galerii MapView potrafi „zamrozić” gesty — odświeżamy je jednym cyklem. */
  const [mapInteract, setMapInteract] = useState(true);
  const galleryWasActiveRef = useRef(false);
  /** Modal „Wyszukiwanie rozszerzone”: niemal pełny ekran — bez obcinania jak przy ~74%. */
  const advancedSheetMaxHeight = useMemo(
    () => Math.round(height - insets.top - Math.max(insets.bottom, 10) - 6),
    [height, insets.top, insets.bottom]
  );
  const advancedSheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 1.1) {
            Keyboard.dismiss();
            setShowAdvancedSearch(false);
          }
        },
      }),
    [],
  );

  const radarPulseA = useRef(new Animated.Value(0)).current;
  const radarPulseB = useRef(new Animated.Value(0)).current;
  const radarInactiveBlink = useRef(new Animated.Value(1)).current;
  const radarCalibrateNudge = useRef(new Animated.Value(0)).current;
  const radarHoldProgress = useRef(new Animated.Value(0)).current;
  const radarHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radarHoldArmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radarHoldHapticRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const radarHoldTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const radarHoldCompletedRef = useRef(false);
  const radarPressStartedAtRef = useRef(0);
  const [radarHoldMode, setRadarHoldMode] = useState<null | 'disable' | 'enable'>(null);
  const [radarHoldSecondsLeft, setRadarHoldSecondsLeft] = useState(3);
  const favoritesHeartBeat = useRef(new Animated.Value(1)).current;
  const favoritesAuraPulse = useRef(new Animated.Value(0)).current;
  const modeIslandOpacity = useRef(new Animated.Value(1)).current;
  const galleryFade = useRef(new Animated.Value(0)).current;
  const gallerySlide = useRef(new Animated.Value(14)).current;
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
  }, [showOnlyFavorites, favoritesMapScope, modeIslandOpacity, modeIslandScale, modeIslandTranslateY]);

  useEffect(() => {
    if (showOnlyFavorites || radarBrowseMode !== 'GALLERY') {
      Animated.parallel([
        Animated.timing(galleryFade, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(gallerySlide, { toValue: 14, duration: 160, useNativeDriver: true }),
      ]).start();
      return;
    }
    galleryFade.setValue(0);
    gallerySlide.setValue(18);
    Animated.parallel([
      Animated.spring(galleryFade, { toValue: 1, friction: 8, tension: 72, useNativeDriver: true }),
      Animated.spring(gallerySlide, { toValue: 0, friction: 9, tension: 78, useNativeDriver: true }),
    ]).start();
  }, [galleryFade, gallerySlide, radarBrowseMode, showOnlyFavorites]);

  useEffect(() => {
    if (isGalleryBrowse) {
      galleryWasActiveRef.current = true;
      setMapInteract(false);
      return;
    }
    if (!galleryWasActiveRef.current) return;
    galleryWasActiveRef.current = false;
    setMapInteract(false);
    const frame = requestAnimationFrame(() => setMapInteract(true));
    return () => cancelAnimationFrame(frame);
  }, [isGalleryBrowse]);

  const hasActiveGalleryFilters = useMemo(
    () =>
      galleryCountryFilter !== 'ALL' ||
      galleryPropertyFilter !== 'ALL' ||
      gallerySortFilter !== 'NEWEST',
    [galleryCountryFilter, galleryPropertyFilter, gallerySortFilter],
  );

  const clearGalleryFilters = useCallback(() => {
    setGalleryTransactionFilter('SELL');
    setGalleryCountryFilter('ALL');
    setGalleryPropertyFilter('ALL');
    setGallerySortFilter('NEWEST');
  }, []);

  const refreshUserLocation = useCallback(async (): Promise<UserLocation> => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLoc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLocation(nextLoc);
      return nextLoc;
    } catch {
      return null;
    }
  }, []);

  const ensureGalleryLocation = useCallback(async (): Promise<boolean> => {
    if (userLocation) return true;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') {
          Alert.alert(
            t('radar.home.galleryLocationDeniedTitle'),
            t('radar.home.galleryLocationDeniedBody'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('radar.home.galleryLocationSettings'), onPress: () => Linking.openSettings() },
            ],
          );
          return false;
        }
      }
      const loc = await refreshUserLocation();
      if (!loc) {
        Alert.alert(t('radar.home.galleryLocationFailedTitle'), t('radar.home.galleryLocationFailedBody'));
        return false;
      }
      return true;
    } catch {
      Alert.alert(t('radar.home.galleryLocationFailedTitle'), t('radar.home.galleryLocationFailedBody'));
      return false;
    }
  }, [refreshUserLocation, t, userLocation]);

  const handleGallerySortChange = useCallback(
    async (sort: GallerySortFilter) => {
      if (sort === 'NEAREST') {
        const ok = await ensureGalleryLocation();
        if (!ok) return;
      }
      setGallerySortFilter(sort);
    },
    [ensureGalleryLocation],
  );

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
    if (isRadarActive || radarHoldMode) {
      const duration = radarHoldMode ? 260 : 1500;
      const stagger = radarHoldMode ? 110 : 760;
      radarPulseA.setValue(0);
      radarPulseB.setValue(0);
      pulseAAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(radarPulseA, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(radarPulseA, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulseBAnim = Animated.loop(
        Animated.sequence([
          Animated.delay(stagger),
          Animated.timing(radarPulseB, { toValue: 1, duration, useNativeDriver: true }),
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
  }, [isRadarActive, radarHoldMode, radarPulseA, radarPulseB]);

  useEffect(() => {
    let blinkLoop: Animated.CompositeAnimation | null = null;
    let nudgeTimer: ReturnType<typeof setInterval> | null = null;

    // Hold (oczekiwanie) → 2× szybciej; inaczej klasyczny kierunkowskaz gdy nieaktywny.
    const shouldBlink = !!radarHoldMode || !isRadarActive;
    if (shouldBlink) {
      const half = radarHoldMode ? 210 : 420;
      radarInactiveBlink.setValue(1);
      blinkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(radarInactiveBlink, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(half),
          Animated.timing(radarInactiveBlink, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(half),
        ]),
      );
      blinkLoop.start();

      if (!isRadarActive && !radarHoldMode) {
        const runNudge = () => {
          radarCalibrateNudge.setValue(0);
          Animated.sequence([
            Animated.timing(radarCalibrateNudge, {
              toValue: 1,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(radarCalibrateNudge, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]).start();
        };
        nudgeTimer = setInterval(runNudge, 30_000);
      }
    } else {
      radarInactiveBlink.stopAnimation();
      radarCalibrateNudge.stopAnimation();
      radarInactiveBlink.setValue(1);
      radarCalibrateNudge.setValue(0);
    }

    return () => {
      blinkLoop?.stop();
      if (nudgeTimer) clearInterval(nudgeTimer);
    };
  }, [isRadarActive, radarHoldMode, radarInactiveBlink, radarCalibrateNudge]);

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
      return nextLoc;
    } catch {
      return null;
    }
  }, []);

  const enableNearbyMode = useCallback(async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        Alert.alert(
          t('radar.home.reason.nearbyPermissionTitle'),
          t('radar.home.reason.nearbyPermissionBody'),
        );
        return;
      }
      setNearbyModeEnabled(true);
      await locateUserAndCenterMap();
      Haptics.selectionAsync();
    } catch {
      // noop
    }
  }, [locateUserAndCenterMap, t]);

  const showAllMapPins = useCallback(() => {
    pendingFitAllPinsRef.current = true;
    didFitAllPinsRef.current = false;
    setNearbyModeEnabled(false);
    setFitAllRequestId((n) => n + 1);
    Haptics.selectionAsync();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (typeof route?.params?.favoritesOnly === 'boolean') {
        setShowOnlyFavorites(route.params.favoritesOnly);
      }
      if (route?.params?.favoritesScope === 'FAVORITES' || route?.params?.favoritesScope === 'MINE') {
        setFavoritesMapScope(route.params.favoritesScope);
      }
      if (route?.params?.tabSurface === 'market') {
        setRadarBrowseMode('GALLERY');
        setExploreLive(false);
      } else if (route?.params?.tabSurface === 'explore') {
        setRadarBrowseMode('RADAR');
        if (route?.params?.exploreLive === true || route?.params?.openCalibration || route?.params?.radarFocus) {
          setExploreLive(true);
        }
      }
      // Deep-link z pusha: gdy App.tsx przekierował tu z intencją „pokaż
      // dopasowania Radaru", podnosimy tryb tu, na ekranie docelowym.
      if (route?.params?.radarFocus === 'matches') {
        setShowRadarMatchesOnly(true);
        setExploreLive(true);
        setRadarBrowseMode('RADAR');
      }
      if (route?.params?.openCalibration) {
        if (user) {
          setRadarFilters((prev) => ({ ...prev, pushNotifications: !!isRadarActive }));
          setCalibrationSessionId((prev) => prev + 1);
          setShowCalibration(true);
        }
        navigation.setParams?.({ openCalibration: undefined });
      }
    }, [route?.params?.favoritesOnly, route?.params?.favoritesScope, route?.params?.radarFocus, route?.params?.openCalibration, route?.params?.tabSurface, route?.params?.exploreLive, user, isRadarActive, navigation])
  );

  useEffect(() => {
    if (!showOnlyFavorites) {
      setFavoritesMapScope('MINE');
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

  const myOffersForMap = useMemo(() => {
    const myId = Number(user?.id || 0);
    if (!myId) return [] as MapOffer[];
    const myFromPublic = offers.filter((o) => isMapOfferOwnedByUser(o, myId));
    const myPublicIds = new Set(myFromPublic.map((o) => Number(o.id)));
    const myFromAccount = ownerMapOffers.filter((o) => !myPublicIds.has(Number(o.id)));
    return [...myFromPublic, ...myFromAccount];
  }, [offers, ownerMapOffers, user?.id]);

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

    const myId = Number(user?.id || 0);
    const browseOffers =
      myId > 0 ? offers.filter((o) => !isMapOfferOwnedByUser(o, myId)) : offers;
    const sourceOffers = showOnlyFavorites
      ? favoritesMapScope === 'MINE'
        ? myOffersForMap
        : browseOffers.filter((o) => favorites.includes(Number(o.id)))
      : browseOffers;

    (sourceOffers ?? []).forEach((o) => {
      bump(o.raw?.city, t('radar.home.searchCategoryCity'));
      bump(o.raw?.district, t('radar.home.searchCategoryDistrict'));
      bump(o.raw?.street, t('radar.home.searchCategoryStreet'));
      bump(o.raw?.address, t('radar.home.searchCategoryAddress'));
      const title = String(o.raw?.title ?? '').trim();
      if (title && normalizeSearchText(title).includes(qFold)) {
        const key = `${t('radar.home.searchCategoryTitle')}|${title}`;
        const vFold = normalizeSearchText(title);
        const vStarts = vFold.startsWith(qFold) ? 12 : 0;
        const cur = map.get(key);
        const sc = vStarts + Math.max(0, 12 - Math.min(12, title.length));
        if (cur) {
          cur.count += 1;
          cur.score = Math.max(cur.score, sc);
        } else {
          map.set(key, { value: title, category: t('radar.home.searchCategoryOffer'), count: 1, score: sc });
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score || b.count - a.count || a.value.localeCompare(b.value, locale === 'pl' ? 'pl' : 'en'))
      .slice(0, 14)
      .map((x, i) => ({
        key: `${x.category}-${x.value}-${i}`,
        value: x.value,
        category: x.category,
        count: x.count,
      }));
  }, [offers, favorites, showOnlyFavorites, favoritesMapScope, searchQuery, myOffersForMap, user?.id, t, locale]);

  const advancedFilterBrowseBase = useMemo(() => {
    const myId = Number(user?.id || 0);
    const offersAfterBlocks =
      blockedIds.size > 0 ? offers.filter((o) => !isBlockedMapOffer(o, blockedIds)) : offers;
    return myId > 0
      ? offersAfterBlocks.filter((o) => !isMapOfferOwnedByUser(o, myId))
      : offersAfterBlocks;
  }, [offers, blockedIds, user?.id]);

  const catalogBrowseBase = useMemo(() => {
    const myId = Number(user?.id || 0);
    const afterBlocks =
      blockedIds.size > 0
        ? catalogRawOffers.filter((o) => !isBlockedRawOffer(o, blockedIds))
        : catalogRawOffers;
    return myId > 0
      ? afterBlocks.filter((o) => !isRawOfferOwnedByUser(o, myId))
      : afterBlocks;
  }, [catalogRawOffers, blockedIds, user?.id]);

  const advancedLocationFacetForCounts = draftAdvancedFilters.localityCountryCode.trim()
    ? ('country' as AdvancedLocationFacet)
    : undefined;

  const countriesWithOffers = useMemo(() => {
    const map = new Map<string, { code: string; label: string; count: number }>();
    let total = 0;
    for (const raw of catalogBrowseBase) {
      if (!offerTransactionTypeMatches(raw, draftAdvancedFilters.transactionType)) continue;
      const code = offerListingCountryIso(raw);
      if (!code) continue;
      total += 1;
      const label = countryLabelInOwnLanguageUpper(code);
      const prev = map.get(code);
      if (prev) prev.count += 1;
      else map.set(code, { code, label, count: 1 });
    }
    return {
      total,
      countries: [...map.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl'),
      ),
    };
  }, [catalogBrowseBase, draftAdvancedFilters.transactionType]);

  const countryFilterEntries = useMemo(() => {
    const dynamic = countriesWithOffers.countries;
    if (dynamic.length > 0) return dynamic;
    return [
      {
        code: 'PL',
        label: countryLabelInOwnLanguageUpper('PL'),
        count: 0,
      },
    ];
  }, [countriesWithOffers.countries]);

  const draftAdvancedLocationReady = isAdvancedLocationReadyForApply(draftAdvancedFilters);
  const draftOfferIdReady = draftOfferIdInput.replace(/\D/g, '').length > 0;
  const canApplyAdvancedSearch = draftOfferIdReady || draftAdvancedLocationReady;
  const draftSelectedCountry = draftAdvancedFilters.localityCountryCode.trim().toUpperCase();
  const draftIsPoland = draftSelectedCountry === 'PL';
  const draftIsAbroad = draftSelectedCountry.length > 0 && !draftIsPoland;

  const backendCities = useMemo(() => {
    const country = draftAdvancedFilters.localityCountryCode.trim().toUpperCase();
    if (!country || country === 'PL') {
      return [...METRO_STRICT_CITIES].sort((a, b) => a.localeCompare(b, 'pl'));
    }
    const cities = new Set<string>();
    for (const offer of advancedFilterBrowseBase) {
      if (offerListingCountryIso(offer.raw) !== country) continue;
      const city = String(offer.raw.city || '').trim();
      if (city && city !== REST_OF_COUNTRY_CITY) cities.add(city);
    }
    return [...cities].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [advancedFilterBrowseBase, draftAdvancedFilters.localityCountryCode]);

  const cityFilterEntries = useMemo(() => {
    const country = draftAdvancedFilters.localityCountryCode.trim().toUpperCase();
    if (country !== 'PL') {
      return [{ city: '', count: 0 }];
    }
    const pool = advancedFilterBrowseBase.filter((offer) =>
      offerMatchesAdvancedFilters(offer, draftAdvancedFilters, rate, 'city'),
    );
    return [
      { city: '', count: pool.length },
      ...backendCities.map((city) => ({
        city,
        count: pool.filter((offer) => radarCityMatches(offer.raw, city)).length,
      })),
    ];
  }, [advancedFilterBrowseBase, backendCities, draftAdvancedFilters, rate]);

  const propertyTypeFilterEntries = useMemo(() => {
    const types = ['ALL', 'FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL'] as const;
    return types.map((type) => ({
      type,
      count: countOffersMatchingAdvancedFilters(
        advancedFilterBrowseBase,
        { ...draftAdvancedFilters, propertyType: type },
        rate,
        advancedLocationFacetForCounts,
      ),
    }));
  }, [advancedFilterBrowseBase, advancedLocationFacetForCounts, draftAdvancedFilters, rate]);

  const draftAdvancedMatchTotal = useMemo(
    () =>
      countOffersMatchingAdvancedFilters(
        advancedFilterBrowseBase,
        draftAdvancedFilters,
        rate,
        undefined,
      ),
    [advancedFilterBrowseBase, draftAdvancedFilters, rate],
  );

  const backendDistrictsForDraftCity = useMemo(() => {
    const selectedCity = draftAdvancedFilters.city.trim();
    if (!selectedCity) return [] as string[];
    return getStrictDistrictsForCity(selectedCity);
  }, [draftAdvancedFilters.city]);

  const districtFilterEntries = useMemo(() => {
    if (!draftAdvancedFilters.city.trim()) return [] as { district: string; count: number }[];
    const pool = advancedFilterBrowseBase.filter((offer) =>
      offerMatchesAdvancedFilters(offer, { ...draftAdvancedFilters, districts: [] }, rate),
    );
    return backendDistrictsForDraftCity.map((district) => {
      const distNorm = normalizeSearchText(district);
      return {
        district,
        count: pool.filter(
          (offer) => normalizeSearchText(String(offer.raw?.district || '').trim()) === distNorm,
        ).length,
      };
    });
  }, [advancedFilterBrowseBase, backendDistrictsForDraftCity, draftAdvancedFilters, rate]);

  const searchOnlyMatchCount = useMemo(() => {
    if (normalizedSearchTokens.length === 0) {
      if (showOnlyFavorites) {
        if (favoritesMapScope === 'MINE') return myOffersForMap.length;
        return normalizeFavoriteIds(favorites).length;
      }
      const myId = Number(user?.id || 0);
      return myId > 0 ? offers.filter((o) => !isMapOfferOwnedByUser(o, myId)).length : offers.length;
    }

    const myId = Number(user?.id || 0);
    const browseOffers =
      myId > 0 ? offers.filter((o) => !isMapOfferOwnedByUser(o, myId)) : offers;
    const sourceOffers = showOnlyFavorites
      ? favoritesMapScope === 'MINE'
        ? myOffersForMap
        : browseOffers.filter((o) => favorites.includes(Number(o.id)))
      : browseOffers;

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
    myOffersForMap,
  ]);

  const hasAdvancedFiltersActive = useMemo(() => {
    return Boolean(
      advancedFilters.transactionType !== 'SELL' ||
      advancedFilters.minPrice !== null ||
      advancedFilters.maxPrice !== null ||
      advancedFilters.minPricePerM2 !== null ||
      advancedFilters.maxPricePerM2 !== null ||
      advancedFilters.minArea !== null ||
      advancedFilters.maxArea !== null ||
      advancedFilters.minPlotArea !== null ||
      advancedFilters.maxPlotArea !== null ||
      advancedFilters.minRooms !== null ||
      advancedFilters.keyword.trim() ||
      advancedFilters.locationMode !== 'CITY' ||
      advancedFilters.mapBounds !== null ||
      advancedFilters.city.trim() ||
      advancedFilters.localityCountryCode.trim() ||
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
    const propertyLabel =
      o.propertyType === 'FLAT'
        ? t('radar.home.propertyFlat')
        : o.propertyType === 'HOUSE'
          ? t('radar.home.propertyHouse')
          : o.propertyType === 'PLOT'
            ? t('radar.home.propertyPlot')
            : t('radar.home.propertyPremises');
    return {
      id: o.id,
      price: '',
      type: `${propertyLabel} • ${formatLocationLabel(o.city, o.district, t('radar.home.locationFallback'))}`,
      area: `${o.area || 0} m²`,
      rooms: `${o.rooms || '-'} ${t('radar.plural.roomsSuffix')}`,
      lat: Number(o.lat),
      lng: Number(o.lng),
      image: firstImage,
      raw: o,
    };
  }, [t]);

  /**
   * Pobranie ofert z backendu. `showSpinner=false` używamy w tle (Radar pollujący)
   * — wtedy nie migamy spinnerem, bo ekran nie ma fokusu i nikt go nie widzi.
   */
  const fetchOffersOnce = useCallback(
    async (showSpinner: boolean): Promise<boolean> => {
      if (showSpinner) setLoading(true);

      const applyRawOfferList = (rawList: any[]) => {
        const activeOnly = rawList.filter((o: any) => !isOfferClosed(o));
        setCatalogRawOffers(activeOnly);
        const mapped = activeOnly
          .map((o: any) => mapRawOffer(o))
          .filter((m: MapOffer | null): m is MapOffer => m !== null);
        setOffers(mapped);
        catalogCountRef.current = mapped.length;
        setOffersFetchError('');
      };

      try {
        const endpoints = [
          `${API_URL}/api/mobile/v1/offers?catalog=1`,
          `${API_URL}/api/mobile/v1/offers`,
          `${API_URL}/api/offers`,
        ];
        let lastError = '';

        for (const url of endpoints) {
          try {
            const { response: res, data } = await mobileFetchJson(url);
            const list = parseOfferList(data);
            if (res.ok && Array.isArray(list)) {
              applyRawOfferList(list);
              return true;
            }
            if (res.ok && list === null) {
              lastError = 'Nieprawidłowa odpowiedź serwera (brak listy ofert)';
            } else {
              lastError = `HTTP ${res.status}`;
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'network';
          }
        }

        if (catalogCountRef.current === 0) {
          setOffersFetchError(lastError || 'Brak połączenia z katalogiem ofert');
        }
        return false;
      } catch {
        if (catalogCountRef.current === 0) {
          setOffersFetchError('Brak połączenia z katalogiem ofert');
        }
        return false;
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [mapRawOffer],
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
    if (!isRadarActive) return;
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void fetchOffersOnce(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [isRadarActive, fetchOffersOnce]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadFavorites = async () => {
        const ids = await loadFavoriteIds({
          apiBaseUrl: API_URL,
          accessToken: token || null,
        });
          if (!mounted) return;
        setFavorites(ids);
      };
      loadFavorites();
      return () => {
        mounted = false;
      };
    }, [showOnlyFavorites, token])
  );

  useEffect(() => {
    const userId = Number(user?.id || 0);
    const mineScope = showOnlyFavorites && favoritesMapScope === 'MINE';
    if (!userId || !token || !mineScope) {
      setOwnerMapOffers([]);
      setOwnerActiveAccountCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${encodeURIComponent(String(userId))}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.offers) ? data.offers : [];
        if (!res.ok || cancelled) return;
        const accountActive = list.filter((o: any) => {
          const life = getOfferLifecycleState(o);
          return !life.isClosed && !life.isPending;
        });
        const mapped = accountActive
          .map((o: any) => mapRawOffer(o))
          .filter((m: MapOffer | null): m is MapOffer => m !== null);
        if (cancelled) return;
        setOwnerActiveAccountCount(accountActive.length);
        setOwnerMapOffers(mapped);
      } catch {
        if (!cancelled) {
          setOwnerActiveAccountCount(0);
          setOwnerMapOffers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, token, mapRawOffer, showOnlyFavorites, favoritesMapScope]);

  // Apple Guideline 1.2 — UGC: pomijamy oferty użytkowników zablokowanych
  // przez aktualnego usera. Filtr żyje TUTAJ (a nie w `setOffers`), żeby
  // reaktywnie odświeżał widok po kliknięciu „Zablokuj" w czacie / detalu.

  const filteredOffers = useMemo(() => {
    const myId = Number(user?.id || 0);

    // Bazowa lista po wycięciu blokad — wszystkie poniższe gałęzie
    // (radar matches, search, advanced filters) operują na tym samym zbiorze.
    const offersAfterBlocks = blockedIds.size > 0 ? offers.filter((o) => !isBlockedMapOffer(o, blockedIds)) : offers;
    // Własne ogłoszenia tylko w Ulubione → Moje (zielona zakładka), nie na Radarze rynku.
    const offersForRadarBrowse =
      myId > 0 ? offersAfterBlocks.filter((o) => !isMapOfferOwnedByUser(o, myId)) : offersAfterBlocks;

    const matchesAdvancedFilters = (offer: MapOffer) =>
      offerMatchesAdvancedFilters(offer, advancedFilters, rate);
    const favoriteIdSet = new Set(normalizeFavoriteIds(favorites));
    const favoriteFromFeed = offersAfterBlocks.filter((o) => favoriteIdSet.has(Number(o.id)));
    const favoriteOffers: MapOffer[] = [];
    const seenFavoriteIds = new Set<number>();
    for (const o of [...favoriteFromFeed, ...favoriteHydratedOffers]) {
      const id = Number(o.id);
      if (!favoriteIdSet.has(id) || seenFavoriteIds.has(id)) continue;
      seenFavoriteIds.add(id);
      favoriteOffers.push(o);
    }
    const myOffers = myOffersForMap.filter((o) => !isBlockedMapOffer(o, blockedIds));

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
    if (showRadarMatchesOnly && isRadarActive) {
      const radarHits = offersForRadarBrowse.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds));
      if (!userLocation) return radarHits;
      return radarHits
        .map((o) => ({ offer: o, distance: distanceKm(userLocation.latitude, userLocation.longitude, o.lat, o.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .map((x) => x.offer);
    }

    const queryFiltered =
      normalizedSearchTokens.length === 0
        ? offersForRadarBrowse
        : offersForRadarBrowse.filter((o) => normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok)));
    const advancedFiltered = queryFiltered.filter(matchesAdvancedFilters);

    // Radar LIVE działa niezależnie od listy/mapy wyników:
    // kalibracja służy do logiki Radaru/Push, a wyszukiwanie rozszerzone odpowiada za wyniki wyszukiwania.
    const shouldApplyRadarToMapResults = false && mapUsesRadarFilters && !hasAdvancedFiltersActive;
    const applyRadar = (list: MapOffer[]) =>
      shouldApplyRadarToMapResults ? list.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds)) : list;
    const radarFiltered = applyRadar(advancedFiltered);

    if (showOnlyFavorites) {
      const scopedBase = favoritesMapScope === 'MINE' ? myOffers : favoriteOffers;
      const scopedList =
        normalizedSearchTokens.length === 0
          ? scopedBase
          : scopedBase.filter((o) => normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok)));
      if (!userLocation) return scopedList;
      return scopedList
        .map((o) => ({ offer: o, distance: distanceKm(userLocation.latitude, userLocation.longitude, o.lat, o.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .map((x) => x.offer);
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
    // Wyszukiwanie tekstowe i filtry rozszerzone = cała baza (sortowana wg odległości od GPS).
    if (hasAdvancedFiltersActive || normalizedSearchTokens.length > 0) {
      return withDistance.map((x) => x.offer);
    }
    // Okolica (25 km) tylko po świadomym CTA — inaczej cała mapa pinezek jak w autach.
    if (nearbyModeEnabled) {
      return withDistance
        .filter((x) => x.distance <= NEARBY_RADIUS_KM)
        .map((x) => x.offer);
    }
    return withDistance.map((x) => x.offer);
  }, [
    offers,
    blockedIds,
    normalizedSearchTokens,
    haystackForOffer,
    showOnlyFavorites,
    favoritesMapScope,
    favorites,
    user?.id,
    userLocation,
    nearbyModeEnabled,
    advancedFilters,
    hasAdvancedFiltersActive,
    mapUsesRadarFilters,
    radarFilters,
    favoritesRadarFilters,
    isFavoritesRadarEnabled,
    radarMapBounds,
    showRadarMatchesOnly,
    isRadarActive,
    ownerMapOffers,
    myOffersForMap,
    rate,
    favoriteHydratedOffers,
  ]);

  const activeOffers = filteredOffers;

  const offersForMapPins = useMemo(() => {
    const selected = activeOffers[activeIndex] ?? null;
    if (MAP_CLUSTERING_ENABLED) {
      // Supercluster filters by viewport bbox — pre-filtering with a different
      // padding caused clusters to vanish without showing individual pins.
      return mergeSelectedOfferIntoMapPins(activeOffers, selected);
    }
    const inView = filterOffersInMapRegion(activeOffers, mapViewportRegion);
    const capped = capMapPinsNearCenter(inView, mapViewportRegion, MAP_MAX_PINS_IN_VIEW);
    return mergeSelectedOfferIntoMapPins(capped, selected);
  }, [activeOffers, activeIndex, mapViewportRegion]);

  const showMapPrivacyCircles = shouldShowMapPrivacyCircles(mapViewportRegion);

  const mapClusterColor =
    advancedFilters.transactionType === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;
  const mapClusterGradient = useMemo(
    () => markerLuxuryGradient(mapClusterColor),
    [mapClusterColor],
  );

  const renderMapCluster = useCallback(
    (cluster: {
      id?: number | string;
      geometry: { coordinates: [number, number] };
      properties: { point_count: number; cluster_id?: number };
      onPress: () => void;
    }) => {
      const clusterKey =
        cluster.properties?.cluster_id ??
        cluster.id ??
        `${cluster.geometry.coordinates[0]}-${cluster.geometry.coordinates[1]}`;
      return (
        <AppleMapClusterMarker
          key={`cluster-${clusterKey}`}
          geometry={cluster.geometry}
          properties={cluster.properties}
          onPress={cluster.onPress}
          accentColor={mapClusterColor}
          gradient={mapClusterGradient}
        />
      );
    },
    [mapClusterColor, mapClusterGradient],
  );

  const galleryOffers = useMemo(() => {
    if (showOnlyFavorites || radarBrowseMode !== 'GALLERY') return [];

    const myId = Number(user?.id || 0);
    const base =
      blockedIds.size > 0 ? offers.filter((o) => !isBlockedMapOffer(o, blockedIds)) : offers;
    const browseOffers =
      myId > 0 ? base.filter((o) => !isMapOfferOwnedByUser(o, myId)) : base;

    let list = browseOffers;
    if (normalizedSearchTokens.length > 0) {
      list = list.filter((o) =>
        normalizedSearchTokens.every((tok) => haystackForOffer(o).includes(tok)),
      );
    }
    if (hasAdvancedFiltersActive) {
      list = list.filter((o) => offerMatchesAdvancedFilters(o, advancedFilters, rate));
    }
    if (galleryTransactionFilter !== 'ALL') {
      list = list.filter(
        (o) => String(o.raw?.transactionType || '').toUpperCase() === galleryTransactionFilter,
      );
    }
    if (galleryCountryFilter === 'PL') {
      list = list.filter((o) => offerListingCountryIso(o.raw) === 'PL');
    } else if (galleryCountryFilter === 'ABROAD') {
      list = list.filter((o) => {
        const code = offerListingCountryIso(o.raw);
        return !!code && code !== 'PL';
      });
    }
    if (galleryPropertyFilter !== 'ALL') {
      const filterType =
        galleryPropertyFilter === 'PREMISES' ? 'COMMERCIAL' : galleryPropertyFilter;
      list = list.filter((o) =>
        propertyTypeMatchesFilter(
          String(o.raw?.propertyType || o.raw?.type || ''),
          filterType as AdvancedFilters['propertyType'],
        ),
      );
    }

    const offerPublishedAtMs = (raw: Record<string, unknown>) => {
      const value = raw?.publishedAt || raw?.published_at || raw?.createdAt || raw?.created_at;
      const ms = new Date(String(value || '')).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const offerAreaValue = (o: MapOffer) => {
      const raw = o.raw?.area ?? o.area;
      const direct = parseOfferNumericPrice(raw);
      if (Number.isFinite(direct) && direct > 0) return direct;
      const match = String(raw || '').match(/[\d]+([.,]\d+)?/);
      return match ? parseFloat(match[0].replace(',', '.')) : 0;
    };

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (gallerySortFilter) {
        case 'PRICE_ASC':
          return resolveOfferListingPrice(a.raw, rate).plnAmount - resolveOfferListingPrice(b.raw, rate).plnAmount;
        case 'PRICE_DESC':
          return resolveOfferListingPrice(b.raw, rate).plnAmount - resolveOfferListingPrice(a.raw, rate).plnAmount;
        case 'AREA_DESC':
          return offerAreaValue(b) - offerAreaValue(a);
        case 'NEAREST':
          if (!userLocation) return 0;
          return (
            distanceKm(userLocation.latitude, userLocation.longitude, a.lat, a.lng) -
            distanceKm(userLocation.latitude, userLocation.longitude, b.lat, b.lng)
          );
        case 'NEWEST':
        default:
          return offerPublishedAtMs(b.raw) - offerPublishedAtMs(a.raw);
      }
    });
    return sorted;
  }, [
    showOnlyFavorites,
    radarBrowseMode,
    offers,
    blockedIds,
    user?.id,
    normalizedSearchTokens,
    haystackForOffer,
    hasAdvancedFiltersActive,
    advancedFilters,
    rate,
    galleryTransactionFilter,
    galleryCountryFilter,
    galleryPropertyFilter,
    gallerySortFilter,
    userLocation,
  ]);

  /** Jak WWW: wyróżnione z katalogu po filtrach transakcji/kraju/typu — bez radaru, wyszukiwania i ukrywania własnych. */
  const galleryFeaturedOffers = useMemo((): GalleryOffer[] => {
    if (showOnlyFavorites || radarBrowseMode !== 'GALLERY') return [];

    let base =
      blockedIds.size > 0
        ? catalogRawOffers.filter((o) => !isBlockedRawOffer(o, blockedIds))
        : catalogRawOffers;
    base = base.filter((o) => !isOfferClosed(o));

    if (galleryTransactionFilter !== 'ALL') {
      base = base.filter(
        (o) => String(o.transactionType || '').toUpperCase() === galleryTransactionFilter,
      );
    }
    if (galleryCountryFilter === 'PL') {
      base = base.filter((o) => offerListingCountryIso(o) === 'PL');
    } else if (galleryCountryFilter === 'ABROAD') {
      base = base.filter((o) => {
        const code = offerListingCountryIso(o);
        return !!code && code !== 'PL';
      });
    }
    if (galleryPropertyFilter !== 'ALL') {
      const filterType =
        galleryPropertyFilter === 'PREMISES' ? 'COMMERCIAL' : galleryPropertyFilter;
      base = base.filter((o) =>
        propertyTypeMatchesFilter(
          String(o.propertyType || o.type || ''),
          filterType as AdvancedFilters['propertyType'],
        ),
      );
    }

    return base
      .filter((o) => isOfferFeatured(o))
      .map((o) => mapRawOffer(o))
      .filter((m): m is MapOffer => m !== null)
      .sort(
        (a, b) =>
          Date.parse(String(b.raw?.promotedUntil || b.raw?.createdAt || 0)) -
          Date.parse(String(a.raw?.promotedUntil || a.raw?.createdAt || 0)),
      );
  }, [
    showOnlyFavorites,
    radarBrowseMode,
    catalogRawOffers,
    blockedIds,
    galleryTransactionFilter,
    galleryCountryFilter,
    galleryPropertyFilter,
    mapRawOffer,
  ]);

  const galleryFavoriteRailItems = useMemo(() => {
    const favoriteIdSet = new Set(normalizeFavoriteIds(favorites));
    const favoriteFromFeed = offers.filter((o) => favoriteIdSet.has(Number(o.id)));
    const seen = new Set<number>();
    const rows: MapOffer[] = [];
    for (const o of [...favoriteFromFeed, ...favoriteHydratedOffers]) {
      const id = Number(o.id);
      if (!favoriteIdSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      rows.push(o);
    }
    return rows.slice(0, 24).map((o) => ({
      id: o.id,
      title: String(o.raw?.title || o.type || 'Oferta'),
      subtitle: [o.area, o.rooms].filter(Boolean).join(' · ') || undefined,
      imageUrl: o.image,
      priceLabel: formatOffer(o.raw).primary,
    }));
  }, [offers, favoriteHydratedOffers, favorites, formatOffer]);

  const galleryMineRailItems = useMemo(() => {
    return myOffersForMap.slice(0, 24).map((o) => ({
      id: o.id,
      title: String(o.raw?.title || o.type || 'Oferta'),
      subtitle: [o.area, o.rooms].filter(Boolean).join(' · ') || undefined,
      imageUrl: o.image,
      priceLabel: formatOffer(o.raw).primary,
    }));
  }, [myOffersForMap, formatOffer]);

  const searchFooterMatchCount = useMemo(() => {
    if (normalizedSearchTokens.length === 0) return searchOnlyMatchCount;
    return activeOffers.length;
  }, [normalizedSearchTokens.length, searchOnlyMatchCount, activeOffers.length]);

  const activeAdvancedMapBounds = useMemo(() => {
    if (!hasAdvancedFiltersActive) return null;
    if (advancedFilters.locationMode !== 'MAP' || !advancedFilters.mapBounds) return null;
    return advancedFilters.mapBounds;
  }, [hasAdvancedFiltersActive, advancedFilters.locationMode, advancedFilters.mapBounds]);

  const radarMatchingOffers = useMemo(() => {
    if (!isRadarActive) return [] as MapOffer[];
    const base =
      blockedIds.size > 0 ? offers.filter((o) => !isBlockedMapOffer(o, blockedIds)) : offers;
    const myId = Number(user?.id || 0);
    const browseOffers =
      myId > 0 ? base.filter((o) => !isMapOfferOwnedByUser(o, myId)) : base;
    return browseOffers.filter((o) => matchesRadarCalibration(o, radarFilters, radarMapBounds));
  }, [offers, radarFilters, radarMapBounds, isRadarActive, user?.id, blockedIds]);

  const visibleRadarMatchingOffers = useMemo(() => {
    if (blockedIds.size === 0) return radarMatchingOffers;
    return radarMatchingOffers.filter((o) => !isBlockedMapOffer(o, blockedIds));
  }, [radarMatchingOffers, blockedIds]);

  useEffect(() => {
    const viewerId = Number(user?.id || 0);
    if (!viewerId || !token) return;
    const ownOfferIds = Array.from(
      new Set(
        activeOffers
          .filter((o) => Number(o?.raw?.userId || o?.raw?.ownerId || 0) === viewerId)
          .map((o) => Number(o.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ).slice(0, 20);
    if (ownOfferIds.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const resolved = await Promise.all(
        ownOfferIds.map(async (id) => {
          try {
            const res = await fetch(`${API_URL}/api/mobile/v1/offers/${id}/legal-verification`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return [id, false] as const;
            const data = await res.json().catch(() => ({}));
            const legalView = data?.data || data;
            const verified = isOfferLegallyVerified(legalView);
            return [id, verified] as const;
          } catch {
            return [id, false] as const;
          }
        }),
      );
      if (cancelled) return;
      const patch: Record<number, boolean> = {};
      resolved.forEach(([id, verified]) => {
        patch[id] = verified;
      });
      setOwnerLegalByOfferId((prev) => ({ ...prev, ...patch }));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeOffers, user?.id, token]);

  /**
   * Powód, dla którego użytkownik widzi aktualnie te konkretne oferty
   * — wyświetlany w pasku „dlaczego to widzę?" nad karuzelą ofert.
   *
   * Tryby (od najwyższego priorytetu, bo nakładają się logicznie):
   *  1. Tryb „Moje oferty"     — Ulubione + scope=MINE.
   *  2. Tryb „Ulubione"        — Ulubione + scope=FAVORITES.
   *  3. Tryb „Rozszerzone"     — aktywne `advancedFilters` (cena, dzielnica, typ…).
   *  4. Tryb „Wyszukiwanie"    — wpisana fraza w pasku wyszukiwania.
   *  5. Tryb „Okolica"         — user włączył „Pokaż w Twojej okolicy" → oferty ≤25 km.
   *  6. Tryb „Wszystkie"       — domyślnie cała baza / cała mapa pinezek.
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
        return t('radar.home.fmtMillion', { value: mln >= 10 ? mln.toFixed(0) : mln.toFixed(1) });
      }
      if (v >= 1_000) return t('radar.home.fmtThousand', { value: String(Math.round(v / 1000)) });
      return `${v}`;
    };
    const propertyTypeShortLabel = (raw: string) => {
      switch ((raw || '').toUpperCase()) {
        case 'FLAT': return t('radar.home.propertyFlat');
        case 'HOUSE': return t('radar.home.propertyHouse');
        case 'PLOT': return t('radar.home.propertyPlot');
        case 'PREMISES': return t('radar.home.propertyPremises');
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
    if (showRadarMatchesOnly && isRadarActive) {
      // Liczymy „nowe" inline — `newRadarMatchesCount` deklarowane jest
      // niżej w pliku (TDZ), a w tym trybie `activeOffers === radarMatchingOffers`.
      let newCount = 0;
      for (const o of activeOffers) {
        if (!seenRadarOfferIds.has(Number(o.id))) newCount += 1;
      }
      const newSuffix = newCount > 0
        ? ` · ${newCount} ${newCount === 1 ? t('radar.plural.newOne') : t('radar.plural.newMany')}`
        : '';
      const r: Reason = isEmpty
        ? {
            icon: 'radio-outline',
            title: t('radar.home.reason.radarMatchesTitle'),
            subtitle: t('radar.home.reason.radarMatchesEmpty'),
            accent: '#10b981',
            severity: 'empty',
            action: { label: t('radar.home.reason.calibrate'), onPress: () => setShowCalibration(true) },
          }
        : {
            icon: 'radio',
            title: t('radar.home.reason.radarMatchesTitle'),
            subtitle: t('radar.home.reason.radarMatchesSubtitle', {
              count: String(count),
              offers: pluralOffers(count),
              verb: radarMatchesVerb(count),
              newSuffix,
            }),
            accent: '#10b981',
            severity: 'normal',
            action: { label: t('radar.home.reason.all'), onPress: () => setShowRadarMatchesOnly(false) },
          };
      return r;
    }

    // Tryb 1 — Moje oferty
    if (showOnlyFavorites && favoritesMapScope === 'MINE') {
      let mineEmptySubtitle = t('radar.home.reason.mineEmptyDefault');
      if (isEmpty && ownerActiveAccountCount > 0) {
        if (ownerMapOffers.length === 0) {
          mineEmptySubtitle = t('radar.home.reason.mineEmptyNoLocation');
        } else if (hasAdvancedFiltersActive) {
          mineEmptySubtitle = t('radar.home.reason.mineEmptyFiltered');
        } else {
          mineEmptySubtitle = t('radar.home.reason.mineEmptyNotOnMap');
        }
      }
      const r: Reason = isEmpty
        ? {
            icon: 'briefcase-outline',
            title: t('radar.home.reason.mineTitle'),
            subtitle: mineEmptySubtitle,
            accent: mineUiAccent,
            severity: 'empty',
            action:
              ownerActiveAccountCount > 0
                ? { label: t('radar.home.reason.profile'), onPress: () => navigation.navigate('Profil') }
                : { label: t('radar.home.reason.add'), onPress: () => navigation.navigate('Dodaj') },
          }
        : {
            icon: 'briefcase-outline',
            title: t('radar.home.reason.mineTitle'),
            subtitle: t('radar.home.reason.mineSubtitle', { count: String(count), offers: pluralOffers(count) }),
            accent: mineUiAccent,
            severity: 'normal',
            action: null,
          };
      return r;
    }

    // Tryb 2 — Ulubione (polubione)
    if (showOnlyFavorites) {
      const savedFavCount = normalizeFavoriteIds(favorites).length;
      let favEmptySubtitle = t('radar.home.reason.favoritesEmptyDefault');
      if (isEmpty && savedFavCount > 0) {
        favEmptySubtitle = hasAdvancedFiltersActive
          ? t('radar.home.reason.favoritesEmptyFiltered', { count: String(savedFavCount) })
          : t('radar.home.reason.favoritesEmptyLoading', { count: String(savedFavCount) });
      }
      const r: Reason = isEmpty
        ? {
            icon: 'heart-outline',
            title: t('radar.home.reason.favoritesTitle'),
            subtitle: favEmptySubtitle,
            accent: favoritesUiAccent,
            severity: 'empty',
            action: null,
          }
        : {
            icon: 'heart',
            title: t('radar.home.reason.favoritesTitle'),
            subtitle: t('radar.home.reason.favoritesSubtitle', { count: String(count), offers: pluralOffers(count) }),
            accent: favoritesUiAccent,
            severity: 'normal',
            action: null,
          };
      return r;
    }

    // Tryb 3 — Wyszukiwanie rozszerzone
    if (hasAdvancedFiltersActive) {
      const txLabel = advancedFilters.transactionType === 'RENT' ? t('radar.home.transactionRentShort') : t('radar.home.transactionSellShort');
      const propLabel = advancedFilters.propertyType !== 'ALL'
        ? propertyTypeShortLabel(advancedFilters.propertyType)
        : null;
      let locLabel: string | null = null;
      if (advancedFilters.locationMode === 'MAP' && advancedFilters.mapBounds) {
        const place = advancedFilters.city.trim() || t('radar.home.selectedArea');
        locLabel = t('radar.home.fmtMapSearchArea', {
          place,
          radius: advancedFilters.mapBounds.radiusKm.toFixed(1),
        });
      } else if (advancedFilters.city.trim()) {
        const districtSuffix = advancedFilters.districts.length > 0
          ? ` · ${advancedFilters.districts[0]}${advancedFilters.districts.length > 1 ? ` +${advancedFilters.districts.length - 1}` : ''}`
          : '';
        locLabel = `${advancedFilters.city.trim()}${districtSuffix}`;
      }
      const priceSuffix = formatCurrencySuffix(advancedFilters.priceCurrency);
      const priceParts: string[] = [];
      if (advancedFilters.minPrice != null) {
        priceParts.push(t('radar.home.fmtFromPrice', { value: fmtThousands(advancedFilters.minPrice), currency: priceSuffix }));
      }
      if (advancedFilters.maxPrice != null) {
        priceParts.push(t('radar.home.fmtToPrice', { value: fmtThousands(advancedFilters.maxPrice), currency: priceSuffix }));
      }
      const priceLabel = priceParts.length > 0 ? priceParts.join(' ') : null;
      const areaLabel = advancedFilters.minArea != null ? t('radar.home.fmtFromArea', { value: String(advancedFilters.minArea) }) : null;
      const roomsLabel = advancedFilters.minRooms != null ? t('radar.home.fmtFromRooms', { count: String(advancedFilters.minRooms) }) : null;

      const details = joinNonEmpty([txLabel, propLabel, locLabel, priceLabel, areaLabel, roomsLabel]);
      const accent = advancedFilters.transactionType === 'RENT' ? RENT_MARKER_COLOR : SELL_MARKER_COLOR;

      const r: Reason = isEmpty
        ? {
            icon: 'options-outline',
            title: t('radar.home.reason.filtersEmptyTitle'),
            subtitle: t('radar.home.reason.filtersEmptySubtitle', { details }),
            accent,
            severity: 'empty',
            action: { label: t('radar.home.reason.reset'), onPress: () => resetAdvancedFilters() },
          }
        : {
            icon: 'options-outline',
            title: t('radar.home.reason.filtersActiveTitle'),
            subtitle: t('radar.home.reason.filtersActiveSubtitle', { count: String(count), offers: pluralOffers(count), details }),
            accent,
            severity: 'normal',
            action: { label: t('radar.home.reason.change'), onPress: () => setShowAdvancedSearch(true) },
          };
      return r;
    }

    // Tryb 4 — Wyszukiwanie tekstowe (bez filtrów rozszerzonych)
    if (trimmedQuery.length > 0) {
      const r: Reason = isEmpty
        ? {
            icon: 'search-outline',
            title: t('radar.home.reason.searchEmptyTitle'),
            subtitle: t('radar.home.reason.searchEmptySubtitle', { query: trimmedQuery }),
            accent: '#10B981',
            severity: 'empty',
            action: { label: t('radar.home.reason.clear'), onPress: () => setSearchQuery('') },
          }
        : {
            icon: 'search-outline',
            title: t('radar.home.reason.searchActiveTitle'),
            subtitle: t('radar.home.reason.searchActiveSubtitle', { count: String(count), offers: pluralOffers(count), query: trimmedQuery }),
            accent: '#10B981',
            severity: 'normal',
            action: { label: t('radar.home.reason.clear'), onPress: () => setSearchQuery('') },
          };
      return r;
    }

    // Tryb 5 — Okolica (GPS + świadome CTA)
    if (nearbyModeEnabled && userLocation) {
      const r: Reason = isEmpty
        ? {
            icon: 'location-outline',
            title: t('radar.home.reason.nearbyEmptyTitle'),
            subtitle: t('radar.home.reason.nearbyEmptySubtitle'),
            accent: '#10B981',
            severity: 'empty',
            action: { label: t('radar.home.reason.showAllMap'), onPress: () => showAllMapPins() },
          }
        : {
            icon: 'location-outline',
            title: t('radar.home.reason.nearbyActiveTitle'),
            subtitle: t('radar.home.reason.nearbyActiveSubtitle', { count: String(count), offers: pluralOffers(count) }),
            accent: '#10B981',
            severity: 'normal',
            action: { label: t('radar.home.reason.showAllMap'), onPress: () => showAllMapPins() },
          };
      return r;
    }

    // Tryb 6 — Wszystko, brak filtrów — sugeruj okolicę
    const r: Reason = isEmpty
      ? {
          icon: 'apps-outline',
          title: t('radar.home.reason.databaseEmptyTitle'),
          subtitle: t('radar.home.reason.databaseEmptySubtitle'),
          accent: isDark ? '#94A3B8' : '#64748B',
          severity: 'empty',
          action: { label: t('radar.home.reason.add'), onPress: () => navigation.navigate('Dodaj') },
        }
      : {
          icon: 'apps-outline',
          title: t('radar.home.reason.allOffersTitle'),
          subtitle: t('radar.home.reason.allOffersSubtitle', { count: String(count), offers: pluralOffers(count) }),
          accent: isDark ? '#94A3B8' : '#64748B',
          severity: 'normal',
          action: { label: t('radar.home.reason.showNearby'), onPress: () => { void enableNearbyMode(); } },
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
    nearbyModeEnabled,
    isDark,
    mineUiAccent,
    favoritesUiAccent,
    navigation,
    showRadarMatchesOnly,
    isRadarActive,
    seenRadarOfferIds,
    ownerActiveAccountCount,
    ownerMapOffers.length,
    visibleRadarMatchingOffers.length,
    t,
    locale,
    enableNearbyMode,
    showAllMapPins,
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

  const newRadarMatchesCount = useMemo(() => {
    let count = 0;
    for (const o of visibleRadarMatchingOffers) {
      if (!seenRadarOfferIds.has(Number(o.id))) count += 1;
    }
    return count;
  }, [visibleRadarMatchingOffers, seenRadarOfferIds]);

  const radarActiveScopeLine = useMemo(() => {
    if (!isRadarActive) return '';
    return buildRadarActiveScopeLine(radarFilters, radarMapBounds);
  }, [isRadarActive, radarFilters, radarMapBounds]);

  const radarCalibrationChrome = useMemo(() => {
    if (isRadarActive) {
      return {
        accent: '#10B981',
        borderColor: isDark ? 'rgba(16,185,129,0.42)' : 'rgba(16,185,129,0.34)',
        fill: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.09)',
        iconBg: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)',
        shadow: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.26 : 0.1,
          shadowRadius: 10,
          elevation: 5,
        },
      };
    }
    return {
      accent: '#FF3B30',
      borderColor: isDark ? 'rgba(255,59,48,0.4)' : 'rgba(255,59,48,0.32)',
      fill: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.07)',
      iconBg: isDark ? 'rgba(255,59,48,0.18)' : 'rgba(255,59,48,0.1)',
      shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.26 : 0.1,
        shadowRadius: 10,
        elevation: 5,
      },
    };
  }, [isRadarActive, isDark]);

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
      !isRadarActive ||
      showOnlyFavorites ||
      hasAdvancedFiltersActive ||
      (searchQuery || '').trim().length > 0
    ) {
      setShowRadarMatchesOnly(false);
    }
  }, [
    showRadarMatchesOnly,
    isRadarActive,
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
      enabled: isRadarActive,
      transactionType: radarFilters.transactionType,
      city: radarFilters.city,
      localityCountry: radarFilters.localityCountry || 'Polska',
      localityCountryCode: radarFilters.localityCountryCode || 'PL',
      districts: radarFilters.selectedDistricts || [],
      propertyType: radarFilters.propertyType,
      maxPrice: sanitizedMaxPrice,
      minArea: sanitizedMinArea,
      minYear: sanitizedMinYear,
      areaRadiusKm: radarMapBounds?.radiusKm ?? null,
      minMatchThreshold: radarFilters.matchThreshold,
      activeMatchesCount: visibleRadarMatchingOffers.length,
      newMatchesCount: newRadarMatchesCount,
      unreadDealroomMessagesCount,
      requireBalcony: !!radarFilters.requireBalcony,
      requireGarden: !!radarFilters.requireGarden,
      requireElevator: !!radarFilters.requireElevator,
      requireParking: !!radarFilters.requireParking,
      requireFurnished: !!radarFilters.requireFurnished,
      requireTwoLevel: !!radarFilters.requireTwoLevel,
    } as const;
    liveActivitySnapshotRef.current = snapshot;
    const fingerprint = JSON.stringify(snapshot);
    if (lastLiveActivityFingerprintRef.current === fingerprint) return;
    lastLiveActivityFingerprintRef.current = fingerprint;
    void syncRadarLiveActivity(snapshot);
  }, [
    isRadarActive,
    radarFilters.transactionType,
    radarFilters.city,
    radarFilters.localityCountry,
    radarFilters.localityCountryCode,
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
    radarFilters.requireTwoLevel,
    radarMapBounds?.radiusKm,
    visibleRadarMatchingOffers.length,
    newRadarMatchesCount,
    unreadDealroomMessagesCount,
  ]);

  /**
   * Po zmianie kluczowych filtrów radaru — odśwież „widziane” dopasowania i wymuś sync Live Activity.
   */
  useEffect(() => {
    if (!isRadarActive) return;
    const currentIds = new Set(
      visibleRadarMatchingOffers
        .map((o) => Number(o?.id))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    setSeenRadarOfferIds((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      seenRadarOfferIdsRef.current = next;
      void AsyncStorage.setItem('@estateos_radar_seen_offer_ids', JSON.stringify(Array.from(next)));
      return next;
    });
    lastLiveActivityFingerprintRef.current = '';
    const snap = liveActivitySnapshotRef.current;
    if (snap) void syncRadarLiveActivity(snap, { force: true });
  }, [
    isRadarActive,
    radarFilters.propertyType,
    radarFilters.transactionType,
    radarFilters.city,
    radarFilters.matchThreshold,
    radarFilters.selectedDistricts,
    radarMapBounds?.centerLat,
    radarMapBounds?.centerLng,
    radarMapBounds?.radiusKm,
  ]);

  /**
   * Heartbeat Live Activity — tylko gdy aplikacja jest aktywna (nie w tle / na lock screen).
   * Rzadszy interwał + `force` omija throttling w serwisie, żeby widget nadal „żył".
   */
  useEffect(() => {
    if (!isRadarActive) return;
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const snap = liveActivitySnapshotRef.current;
      if (!snap) return;
      void syncRadarLiveActivity(snap, { force: true });
    }, 30_000);
    return () => clearInterval(interval);
  }, [isRadarActive]);

  /** Po wybudzeniu / zablokowaniu — odśwież dane, animację i liczniki na lock screenie. */
  useEffect(() => {
    if (!isRadarActive) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        lastLiveActivityFingerprintRef.current = '';
        const snap = liveActivitySnapshotRef.current;
        if (snap) void syncRadarLiveActivity(snap, { force: true });
        return;
      }
      if (state !== 'active') return;
      void fetchOffersOnce(false);
      void refreshUnreadDealroomCountRef.current?.();
      lastLiveActivityFingerprintRef.current = '';
      const snap = liveActivitySnapshotRef.current;
      if (snap) void syncRadarLiveActivity(snap, { force: true });
    });
    return () => sub.remove();
  }, [isRadarActive, fetchOffersOnce]);

  const focusMapToBounds = useCallback((bounds: { centerLat: number; centerLng: number; radiusKm: number }) => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(regionForMapBounds(bounds), 650);
  }, []);

  const focusMapToOffers = useCallback((items: MapOffer[]) => {
    if (!mapRef.current) return;
    if (items.length === 0) return;
    const coords = items
      .map((o) => ({ latitude: Number(o.lat), longitude: Number(o.lng) }))
      .filter((c) => hasFiniteCoords(c.latitude, c.longitude));
    if (coords.length === 0) return;
    fitMapCoordinatesAboveOverlay(mapRef.current, coords);
  }, []);

  /**
   * Jak mapa aut: na starcie Explore dopasuj kamerę do wszystkich pinezek.
   * Flaga `didFitAllPins` ustawiana DOPIERO po udanym fit — inaczej cleanup przy
   * zmianie `activeOffers` anuluje timer i mapa zostaje na DEFAULT_REGION (Warszawa).
   */
  useEffect(() => {
    if (radarBrowseMode !== 'RADAR') {
      didFitAllPinsRef.current = false;
      return;
    }
    if (nearbyModeEnabled || showOnlyFavorites || showRadarMatchesOnly) return;
    if (hasAdvancedFiltersActive || normalizedSearchTokens.length > 0) return;
    if (loading || activeOffers.length === 0) return;
    const shouldFit = !didFitAllPinsRef.current || pendingFitAllPinsRef.current;
    if (!shouldFit) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const offersSnapshot = activeOffers;

    const runFit = () => {
      if (cancelled) return;
      if (!mapRef.current) {
        retryTimer = setTimeout(runFit, 180);
        return;
      }
      focusMapToOffers(offersSnapshot);
      didFitAllPinsRef.current = true;
      pendingFitAllPinsRef.current = false;
    };

    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(runFit);
    }, Platform.OS === 'ios' ? 420 : 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    radarBrowseMode,
    nearbyModeEnabled,
    showOnlyFavorites,
    showRadarMatchesOnly,
    hasAdvancedFiltersActive,
    normalizedSearchTokens.length,
    activeOffers,
    focusMapToOffers,
    fitAllRequestId,
    loading,
  ]);

  const focusMapToActiveSearch = useCallback(() => {
    if (activeOffers.length > 0) {
      focusMapToOffers(activeOffers);
      return;
    }
    if (
      advancedFilters.locationMode === 'MAP' &&
      advancedFilters.mapBounds &&
      hasAdvancedFiltersActive
    ) {
      focusMapToBounds(advancedFilters.mapBounds);
    }
  }, [activeOffers, advancedFilters, hasAdvancedFiltersActive, focusMapToOffers, focusMapToBounds]);

  /**
   * Gdy wchodzimy w tryb „Dopasowania Radaru" (z pusha, deep-linku albo z
   * mini-CTA), automatycznie fitujemy mapę do markerów dopasowań, scrollujemy
   * karuzelę na początek i wyzwalamy lekki haptic. To zamyka pętlę „push →
   * widzę dokładnie co Radar złowił" bez żadnych dodatkowych klików.
   */
  useEffect(() => {
    if (!showRadarMatchesOnly || !isRadarActive) return;
    let cancelled = false;
    Haptics.selectionAsync();
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        if (visibleRadarMatchingOffers.length === 0) return;
        focusMapToOffers(visibleRadarMatchingOffers);
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, Platform.OS === 'ios' ? 220 : 160);
    });
    return () => {
      cancelled = true;
    };
  }, [showRadarMatchesOnly, isRadarActive, visibleRadarMatchingOffers, focusMapToOffers]);

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
        focusMapToActiveSearch();
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, Platform.OS === 'ios' ? 120 : 80);
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, activeOffers, focusMapToActiveSearch]);

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

  useEffect(() => {
    if (!showCalibration || !user) return;
    void (async () => {
      const list = await loadRadarRecentAreas();
      setRecentRadarAreasList(list);
    })();
  }, [showCalibration, user]);

  const handlePickRecentRadarArea = useCallback((entry: RadarRecentSavedArea) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRadarMapBounds(entry.mapBounds);
    setRadarFilters((prev) => ({
      ...entry.filters,
      pushNotifications: prev.pushNotifications,
    }));
    setMapUsesRadarFilters(!isRadarFactoryDefaults(entry.filters));
    setAreaSummary(entry.areaSummaryLine || '');
    setCalibrationSessionId((x) => x + 1);
  }, []);

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
    setRadarFilters((prev) => ({ ...prev, pushNotifications: !!isRadarActive }));
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

  const openManageMyProperties = useCallback(() => {
    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      navigation.navigate('Profil', { authIntent: 'login', openManageListings: true });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Profil', { openManageListings: true });
  }, [navigation, user]);

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
    if (!candidate) {
      candidate = await findWebOfferById(id);
    }
    return candidate;
  }, [token]);

  useEffect(() => {
    if (!showOnlyFavorites || favoritesMapScope !== 'FAVORITES' || favorites.length === 0) {
      setFavoriteHydratedOffers([]);
      return;
    }
    const feedIds = new Set(offers.map((o) => Number(o.id)).filter((id) => id > 0));
    const missing = favorites.filter((id) => !feedIds.has(id));
    if (missing.length === 0) {
      setFavoriteHydratedOffers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const hydrated: MapOffer[] = [];
      for (const id of missing.slice(0, 50)) {
        const raw = await resolveOfferById(id);
        if (cancelled || !raw || isOfferClosed(raw)) continue;
        const mapped = mapRawOffer(raw);
        if (mapped) hydrated.push(mapped);
      }
      if (!cancelled) setFavoriteHydratedOffers(hydrated);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    favorites,
    offers,
    showOnlyFavorites,
    favoritesMapScope,
    resolveOfferById,
    mapRawOffer,
  ]);

  const openAdvancedMapAreaPicker = useCallback(() => {
    setAreaPickerReturnTo('ADVANCED');
    setShowAdvancedSearch(false);
    setRadarBrowseMode('RADAR');
    setShowRadarMatchesOnly(false);
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
      450,
    );
    void pulseHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }, [userLocation, areaPickerDraft.center]);

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
          Alert.alert('EstateOS', t('radar.home.alertOfferNotFound'));
          return;
        } finally {
          setAdvancedOfferIdBusy(false);
        }
      }
    }

    const country = draftAdvancedFilters.localityCountryCode.trim().toUpperCase();
    if (!country) {
      Alert.alert('EstateOS', t('radar.advancedSearch.selectCountryRequired'));
      return;
    }
    if (draftAdvancedFilters.locationMode === 'MAP' && !draftAdvancedFilters.mapBounds) {
      Alert.alert('EstateOS', t('radar.home.alertSelectMapArea'));
      return;
    }

    setAdvancedFilters(draftAdvancedFilters);
    setGalleryTransactionFilter(draftAdvancedFilters.transactionType);
    logAdvancedMapSearch({
      token,
      userId: user?.id,
      payload: {
        transactionType: draftAdvancedFilters.transactionType,
        city: draftAdvancedFilters.city,
        districts: draftAdvancedFilters.districts,
        priceCurrency: draftAdvancedFilters.priceCurrency,
        minPrice: draftAdvancedFilters.minPrice,
        maxPrice: draftAdvancedFilters.maxPrice,
        minArea: draftAdvancedFilters.minArea,
        maxArea: draftAdvancedFilters.maxArea,
        minRooms: draftAdvancedFilters.minRooms,
        propertyType: draftAdvancedFilters.propertyType,
        locationMode: draftAdvancedFilters.locationMode,
        mapBounds: draftAdvancedFilters.mapBounds,
      },
    });
    setPendingMapFocusAfterApply(true);
    setShowAdvancedSearch(false);
    Haptics.selectionAsync();
  };

  const resetAdvancedFilters = () => {
    const reset: AdvancedFilters = { ...DEFAULT_ADVANCED_FILTERS };
    setDraftAdvancedFilters(reset);
    setAdvancedFilters(reset);
    setGalleryTransactionFilter('SELL');
    setDraftOfferIdInput('');
    setAdvancedExtrasExpanded(false);
    setPendingMapFocusAfterApply(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useFocusEffect(
    useCallback(() => {
      if (!pendingMapFocusAfterApply) return;
      const hasMapArea =
        advancedFilters.locationMode === 'MAP' &&
        advancedFilters.mapBounds &&
        hasAdvancedFiltersActive;
      if (activeOffers.length === 0 && !hasMapArea) {
        setPendingMapFocusAfterApply(false);
        return;
      }
      const timerId = setTimeout(() => {
        focusMapToActiveSearch();
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setPendingMapFocusAfterApply(false);
      }, 120);
      return () => clearTimeout(timerId);
    }, [
      pendingMapFocusAfterApply,
      activeOffers.length,
      advancedFilters,
      hasAdvancedFiltersActive,
      focusMapToActiveSearch,
    ])
  );

  /**
   * Po wejściu na zakładkę Radar oznaczamy wszystkie aktualne dopasowania jako „widziane”.
   * Dzięki temu badge „NOWE! N” na Live Activity gaśnie po obejrzeniu ekranu radaru.
   * Zapis trzymamy w AsyncStorage z ograniczeniem do ostatnich 500 ID,
   * żeby zbiór nie rósł w nieskończoność.
   */
  useFocusEffect(
    useCallback(() => {
      const ids = visibleRadarMatchingOffers
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
    }, [visibleRadarMatchingOffers])
  );

  const syncRadarPreferencesToBackend = async (payload: typeof radarFilters) => {
    if (!user?.id || !token) return;
    const dto = buildCanonicalRadarPreferencesDto({
      userId: Number(user.id),
      filters: payload,
      mapContext: mapContextForCanonicalDto(payload, radarMapBounds),
    });
    await postRadarPreferencesToBackend({ apiUrl: API_URL, token, dto });
  };

  const disableLiveRadar = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowRadarMatchesOnly(false);
    const nextFilters = { ...radarFilters, pushNotifications: false };
    setRadarFilters(nextFilters);
    await setRadarActive(false);
    try {
      if (user?.id && token) {
        const dto = buildCanonicalRadarPreferencesDto({
          userId: Number(user.id),
          filters: nextFilters,
          mapContext: mapContextForCanonicalDto(nextFilters, radarMapBounds),
        });
        await postRadarPreferencesToBackend({ apiUrl: API_URL, token, dto });
      }
      const ownerId = Number(user?.id || 0);
      if (ownerId > 0) {
        await saveRadarCommittedState({
          userId: ownerId,
          // Zachowujemy ostatnią konfigurację filtrów — przy ponownym hold-enable
          // włączamy z pushNotifications: true.
          filters: { ...radarFilters, pushNotifications: false },
          mapBounds: radarMapBounds,
          areaSummary,
          committedAtIso: new Date().toISOString(),
        });
      }
    } catch {
      // Lokalny stan i tak wyłączony — sync może dojść przy kolejnej kalibracji.
    }
  }, [radarFilters, radarMapBounds, areaSummary, setRadarActive, user?.id, token]);

  const clearRadarHoldAction = useCallback(() => {
    if (radarHoldArmRef.current) {
      clearTimeout(radarHoldArmRef.current);
      radarHoldArmRef.current = null;
    }
    if (radarHoldTimerRef.current) {
      clearTimeout(radarHoldTimerRef.current);
      radarHoldTimerRef.current = null;
    }
    if (radarHoldHapticRef.current) {
      clearInterval(radarHoldHapticRef.current);
      radarHoldHapticRef.current = null;
    }
    if (radarHoldTickRef.current) {
      clearInterval(radarHoldTickRef.current);
      radarHoldTickRef.current = null;
    }
    radarHoldProgress.stopAnimation();
    radarHoldProgress.setValue(0);
    setRadarHoldMode(null);
    setRadarHoldSecondsLeft(RADAR_HOLD_SECONDS);
  }, [radarHoldProgress]);

  const commitRadarCalibrationState = useCallback(
    async (filtersToApply: RadarFilters, mapSnap: typeof radarMapBounds, summarySnap: string) => {
    setRadarFilters(filtersToApply);
      if (isRadarFactoryDefaults(filtersToApply)) {
        setMapUsesRadarFilters(false);
        setRadarMapBounds(null);
        setAreaSummary('');
      } else {
        setMapUsesRadarFilters(true);
      }
    await setRadarActive(filtersToApply.pushNotifications);
    await syncRadarPreferencesToBackend(filtersToApply);
    if (filtersToApply.pushNotifications && token) {
      const pushOk = await registerPushNotifications(token, { showPrompt: true });
      if (!pushOk) {
        Alert.alert(
          'Powiadomienia radaru',
          'Radar został zapisany, ale nie udało się zarejestrować powiadomień push na tym urządzeniu. Włącz powiadomienia w ustawieniach iPhone’a, potem otwórz ponownie Zakupy / Radar albo „Przywróć zakupy” nie jest potrzebne — wystarczy ponownie zapisać kalibrację.',
        );
      }
    }
      const ownerId = Number(user?.id || 0);
      if (ownerId > 0) {
        await saveRadarCommittedState({
          userId: ownerId,
          filters: filtersToApply,
          mapBounds: mapSnap,
          areaSummary: summarySnap,
          committedAtIso: new Date().toISOString(),
        });
      }
      logRadarCalibrationSearch({
        token,
        userId: user?.id,
        filters: filtersToApply,
        mapBounds: mapSnap,
      });
      void pushRadarRecentArea({
        filters: filtersToApply,
        mapBounds: mapSnap,
        areaSummaryLine: summarySnap,
      });
      lastLiveActivityFingerprintRef.current = '';
    },
    [token, user?.id, setRadarActive],
  );

  const enableLiveRadarFromLastSave = useCallback(async () => {
    if (!user) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      pendingAuthTargetRef.current = 'radar';
      setAuthGateContext('radar');
      return;
    }

    const ownerId = Number(user.id || 0);
    let nextFilters = { ...radarFilters, pushNotifications: true };
    let nextBounds = radarMapBounds;
    let nextSummary = areaSummary;

    if (ownerId > 0) {
      try {
        const committed = await loadRadarCommittedState(ownerId);
        if (committed?.filters) {
          nextFilters = { ...committed.filters, pushNotifications: true };
          nextBounds = committed.mapBounds ?? nextBounds;
          nextSummary = committed.areaSummary || nextSummary;
        }
      } catch {
        // fallback: bieżące filtry w pamięci
      }
    }

    if (isRadarFactoryDefaults({ ...nextFilters, pushNotifications: false })) {
      // Brak zapisanej kalibracji — otwórz ustawienia zamiast pustego LIVE.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      openRadarCalibration();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (nextBounds) {
      setRadarMapBounds(nextBounds);
      setMapUsesRadarFilters(true);
      setAreaSummary(nextSummary || areaSummary);
    }
    await commitRadarCalibrationState(nextFilters, nextBounds, nextSummary || areaSummary);
  }, [
    user,
    radarFilters,
    radarMapBounds,
    areaSummary,
    commitRadarCalibrationState,
  ]);

  const startRadarHoldAction = useCallback(() => {
    if (radarHoldMode) return;
    const mode: 'disable' | 'enable' = isRadarActive ? 'disable' : 'enable';
    radarHoldCompletedRef.current = false;
    setRadarHoldMode(mode);
    setRadarHoldSecondsLeft(RADAR_HOLD_SECONDS);
    radarHoldProgress.setValue(0);
    Animated.timing(radarHoldProgress, {
      toValue: 1,
      duration: RADAR_HOLD_MS,
      useNativeDriver: false,
    }).start();

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    radarHoldHapticRef.current = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 95);

    let left = RADAR_HOLD_SECONDS;
    radarHoldTickRef.current = setInterval(() => {
      left -= 1;
      setRadarHoldSecondsLeft(Math.max(0, left));
      if (left <= 0 && radarHoldTickRef.current) {
        clearInterval(radarHoldTickRef.current);
        radarHoldTickRef.current = null;
      }
    }, 1000);

    radarHoldTimerRef.current = setTimeout(() => {
      radarHoldCompletedRef.current = true;
      if (radarHoldHapticRef.current) {
        clearInterval(radarHoldHapticRef.current);
        radarHoldHapticRef.current = null;
      }
      if (radarHoldTickRef.current) {
        clearInterval(radarHoldTickRef.current);
        radarHoldTickRef.current = null;
      }
      radarHoldProgress.stopAnimation();
      radarHoldProgress.setValue(0);
      setRadarHoldMode(null);
      setRadarHoldSecondsLeft(RADAR_HOLD_SECONDS);
      if (mode === 'disable') {
        void disableLiveRadar();
      } else {
        void enableLiveRadarFromLastSave();
      }
    }, RADAR_HOLD_MS);
  }, [
    radarHoldMode,
    isRadarActive,
    radarHoldProgress,
    disableLiveRadar,
    enableLiveRadarFromLastSave,
  ]);

  useEffect(() => {
    return () => {
      if (radarHoldArmRef.current) clearTimeout(radarHoldArmRef.current);
      if (radarHoldTimerRef.current) clearTimeout(radarHoldTimerRef.current);
      if (radarHoldHapticRef.current) clearInterval(radarHoldHapticRef.current);
      if (radarHoldTickRef.current) clearInterval(radarHoldTickRef.current);
    };
  }, []);

  const applyRadarCalibration = async (
    filtersToApply: RadarFilters,
    options?: { keepCalibrationModalOpen?: boolean },
  ) => {
    const mapSnap = radarMapBounds ? { ...radarMapBounds } : null;
    const summarySnap = areaSummary;
    pendingRadarCalibrationFiltersRef.current = null;
    if (options?.keepCalibrationModalOpen) {
      InteractionManager.runAfterInteractions(() => {
        void commitRadarCalibrationState(filtersToApply, mapSnap, summarySnap);
      });
    } else {
      await commitRadarCalibrationState(filtersToApply, mapSnap, summarySnap);
    }
    if (!options?.keepCalibrationModalOpen) {
    setShowCalibration(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const applyFavoritesCalibration = async (filtersToApply: RadarFilters) => {
    setFavoritesRadarFilters(filtersToApply);
    setIsFavoritesRadarEnabled(filtersToApply.pushNotifications);
    // Preferencje Ulubionych → backend (może ignorować nieznane pola; ważne, by kontrakt nie blokował).
    void (async () => {
      if (user?.id && token) {
        const dto = buildCanonicalRadarPreferencesDto({
          userId: Number(user.id),
          filters: filtersToApply,
          mapContext: mapContextForCanonicalDto(filtersToApply, radarMapBounds),
        });
        await postRadarPreferencesToBackend({ apiUrl: API_URL, token, dto });
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
            notifyIncludeAmounts: false,
            notifyStatusChange: !!filtersToApply.favoritesNotifyStatusChange,
            notifyNewSimilar: !!filtersToApply.favoritesNotifyNewSimilar,
          },
        },
      });
    }
    setShowFavoritesCalibration(false);
    if (!pushPrefsSynced) {
      Alert.alert(
        t('radar.home.alertPushSaveFailed'),
        t('radar.home.alertPushSaveFailedBody')
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
            ? t('radar.home.areaSummaryDistrictCount', { count: String(filters.selectedDistricts.length) })
            : t('radar.home.areaSummaryAllDistricts');
        return `${filters.city} • ${districtLabel} • ${offersInPreview.length} ${pluralOffers(offersInPreview.length)}`;
      }
      if (!radarMapBounds) return areaSummary || undefined;
      const radiusKm = radarGeoRadiusLimitKm(radarMapBounds.radiusKm, filters.matchThreshold);
      return `${filters.city} • ${radiusKm.toFixed(1)} km • ${offersInPreview.length} ${pluralOffers(offersInPreview.length)}`;
    },
    [radarMapBounds, areaSummary, offers, t],
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
    setMapViewportRegion(region);
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
    setRadarBrowseMode('RADAR');
    setShowRadarMatchesOnly(false);
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
    let reverseCountry = resolveLocalityCountryFromPlace({});
    try {
      const reverse = await Location.reverseGeocodeAsync(center);
      const place = reverse?.[0];
      if (place) {
        reverseCountry = resolveLocalityCountryFromPlace(place);
      }
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
      t('radar.home.selectedArea');
    const baseRadarFilters = pendingRadarCalibrationFiltersRef.current || radarFilters;
    const updated: RadarFilters = {
      ...baseRadarFilters,
      calibrationMode: 'MAP',
      city: cityForFilters,
      localityCountry: reverseCountry.labelPl,
      localityCountryCode: reverseCountry.code,
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
      `${cityForFilters} • ${radius.toFixed(1)} km • ${offersInArea.length} ${pluralOffers(offersInArea.length)}`
    );
    if (areaPickerReturnTo === 'ADVANCED') {
      pendingRadarCalibrationFiltersRef.current = null;
      const nextAdvanced: AdvancedFilters = {
        ...draftAdvancedFilters,
        locationMode: 'MAP',
        mapBounds: {
          centerLat: center.latitude,
          centerLng: center.longitude,
          radiusKm: radius,
        },
        city: cityForFilters,
        districts: [],
      };
      setDraftAdvancedFilters(nextAdvanced);
      setAdvancedFilters(nextAdvanced);
      logAdvancedMapSearch({
        token,
        userId: user?.id,
        payload: {
          transactionType: nextAdvanced.transactionType,
          city: nextAdvanced.city,
          districts: nextAdvanced.districts,
          priceCurrency: nextAdvanced.priceCurrency,
          minPrice: nextAdvanced.minPrice,
          maxPrice: nextAdvanced.maxPrice,
          minArea: nextAdvanced.minArea,
          maxArea: nextAdvanced.maxArea,
          minRooms: nextAdvanced.minRooms,
          propertyType: nextAdvanced.propertyType,
          locationMode: nextAdvanced.locationMode,
          mapBounds: nextAdvanced.mapBounds,
        },
      });
      setPendingMapFocusAfterApply(true);
      setShowAreaPicker(false);
      setShowAdvancedSearch(false);
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
            ? t('radar.home.selectedArea')
            : String(radarFilters.city || '').trim()) || t('radar.home.selectedArea');
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
        if (place) {
          const country = resolveLocalityCountryFromPlace(place);
          setRadarFilters((prev) => ({
            ...prev,
            localityCountry: country.labelPl,
            localityCountryCode: country.code,
          }));
        }
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
    const { ids } = await toggleFavoriteId(offerId, favorites, {
      apiBaseUrl: API_URL,
      accessToken: token || null,
    });
    setFavorites(ids);
  };

  const focusOffer = (index: number) => {
    const offer = activeOffers[index];
    if (!offer) return;
    focusMapCoordinateAboveOverlay(mapRef.current, {
      latitude: offer.lat,
      longitude: offer.lng,
    });
    setActiveIndex(index);
  };

  const focusOfferById = useCallback(
    (offerId: number | string) => {
      const index = activeOffers.findIndex((o) => String(o.id) === String(offerId));
      if (index < 0) return;
      const offer = activeOffers[index];
      if (!offer) return;
      focusMapCoordinateAboveOverlay(mapRef.current, {
        latitude: offer.lat,
        longitude: offer.lng,
      });
      setActiveIndex(index);
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [activeOffers],
  );

  const offerMapMarkerLayers = useMemo(() => {
    const circles: React.ReactNode[] = [];
    const markers: React.ReactNode[] = [];
    const selectedOfferId = activeOffers[activeIndex]?.id;
    const iosMap = Platform.OS === 'ios';

    offersForMapPins.forEach((offer, idx) => {
      const isSelected = selectedOfferId != null && String(offer.id) === String(selectedOfferId);
      const markerAccent = offerMarkerAccent(offer.raw);
      const luxColors = markerLuxuryGradient(markerAccent);
      const lat = Number(offer.lat);
      const lng = Number(offer.lng);
      if (!hasFiniteCoords(lat, lng)) return;

      const listing = resolveOfferListingPrice(offer.raw, rate);
      const disp = resolveOfferDisplayAmount({
        amount: listing.amount,
        listingCurrency: listing.currency,
        pricePln: listing.plnAmount,
        displayPreference: preference,
        rate,
      });
      const markerPriceLabel = formatMarkerPriceCompact(disp.displayAmount, disp.displayCurrency);
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
      const offerKey = String(offer.id ?? idx);

      if (circleStyle && showMapPrivacyCircles) {
        circles.push(
          <Circle
            key={`circle-${offerKey}`}
            center={pinCoord}
            radius={presentation.circleRadiusM}
            strokeColor={circleStyle.strokeColor}
            fillColor={circleStyle.fillColor}
            strokeWidth={circleStyle.strokeWidth}
            zIndex={isSelected ? 2 : 1}
          />,
        );
      }

      markers.push(
        iosMap ? (
          <Marker
            key={`marker-${offerKey}`}
            identifier={`marker-${offerKey}`}
            coordinate={pinCoord}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            zIndex={isSelected ? 3 : 2}
            onPress={() => {
              Haptics.selectionAsync();
              focusOfferById(offer.id ?? offerKey);
            }}
          >
            <OfferMapMarkerPin
              label={markerPriceLabel}
              luxColors={luxColors}
              selected={isSelected}
              accent={markerAccent}
            />
          </Marker>
        ) : (
          <AndroidMapPriceMarker
            key={`marker-${offerKey}`}
            coordinate={pinCoord}
            label={markerPriceLabel}
            color={markerAccent}
            selected={isSelected}
            onPress={() => {
              Haptics.selectionAsync();
              focusOfferById(offer.id ?? offerKey);
            }}
          />
        ),
      );
    });

    return { circles, markers };
  }, [offersForMapPins, activeOffers, activeIndex, rate, preference, focusOfferById, showMapPrivacyCircles]);

  const mapPinChildrenReady = Platform.OS !== 'ios' || (iosMapPinsReady && !loading);

  const renderOfferCard = ({ item, index }: any) => {
    const ownVerifiedFromEndpoint = ownerLegalByOfferId[Number(item?.id || 0)] === true;
    const isLegallyVerified = isOfferLegallyVerified(item?.raw, ownVerifiedFromEndpoint);
    const priceLabel = formatOffer(item.raw).primary;

    return (
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
        {isLegallyVerified ? (
          <View style={[styles.legalSealFloating, isDark && styles.legalSealFloatingDark]} accessibilityLabel={t('radar.home.legallyVerified')}>
            <Ionicons name="shield-checkmark" size={15} color={isDark ? '#34d399' : '#059669'} />
          </View>
        ) : null}
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
            {priceLabel}
          </Text>
          <Pressable
            onPress={() => toggleFavorite(Number(item.id))}
            hitSlop={10}
          >
            <Ionicons
              name={isFavoriteId(item.id, favorites) ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavoriteId(item.id, favorites) ? '#FF3B30' : '#8E8E93'}
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
          <Text style={styles.publishDateText}>{formatOfferPublishDate(item.raw, locale)}</Text>
        </View>
      </View>
    </Pressable>
  );
  };

  const searchPanelText = useMemo(() => {
    if (showOnlyFavorites) {
      if (isMineScope) {
        return {
          section: isDark ? 'rgba(210,252,235,0.95)' : '#064E3B',
          body: isDark ? 'rgba(235,255,248,0.98)' : '#022C22',
          secondary: isDark ? 'rgba(190,245,220,0.88)' : '#0F5132',
          tertiary: isDark ? 'rgba(170,240,210,0.78)' : '#166534',
          icon: isDark ? 'rgba(185,245,215,0.88)' : '#15803D',
          chevron: isDark ? 'rgba(200,245,225,0.58)' : '#1F6B4D',
        };
      }
      return {
        section: isDark ? 'rgba(255,225,238,0.95)' : '#4A1228',
        body: isDark ? 'rgba(255,240,248,0.98)' : '#2D0A18',
        secondary: isDark ? 'rgba(255,215,232,0.88)' : '#5C1F38',
        tertiary: isDark ? 'rgba(255,200,220,0.76)' : '#6B2844',
        icon: isDark ? 'rgba(255,200,220,0.85)' : '#732F4A',
        chevron: isDark ? 'rgba(255,215,230,0.58)' : '#8B4562',
      };
    }
    if (isDark) {
      return {
        section: 'rgba(245,245,247,0.9)',
        body: '#FFFFFF',
        secondary: 'rgba(235,235,245,0.86)',
        tertiary: 'rgba(225,225,235,0.72)',
        icon: 'rgba(235,235,245,0.78)',
        chevron: 'rgba(220,220,230,0.55)',
      };
    }
    return {
      section: '#000000',
      body: '#000000',
      secondary: '#1C1C1E',
      tertiary: '#2C2C2E',
      icon: '#3A3A3C',
      chevron: '#48484A',
    };
  }, [isDark, showOnlyFavorites, isMineScope]);

  return (
    <>
    <View
      style={[styles.container, isGalleryLightChrome && styles.containerGalleryLight]}
    >
      <View style={styles.mapStage} collapsable={false}>
          <RadarMapComponent
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            googleRenderer={Platform.OS === 'android' ? 'LEGACY' : undefined}
            style={[
              StyleSheet.absoluteFillObject,
              isGalleryBrowse && { opacity: 0 },
            ]}
            scrollEnabled={mapInteract && !isGalleryBrowse}
            zoomEnabled={mapInteract && !isGalleryBrowse}
            zoomTapEnabled={mapInteract && !isGalleryBrowse}
            rotateEnabled={false}
            onLayout={(e: any) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setMapLayout({ width: w, height: h });
            }}
            initialRegion={DEFAULT_REGION}
            onMapReady={() => {
              if (Platform.OS === 'ios' && !iosMapPinsReady) {
                InteractionManager.runAfterInteractions(() => {
                  requestAnimationFrame(() => setIosMapPinsReady(true));
                });
              }
              // Mapa gotowa wcześniej niż oferty / timer — wymuś ponowną próbę fitu.
              if (!didFitAllPinsRef.current) {
                pendingFitAllPinsRef.current = true;
                setFitAllRequestId((n) => n + 1);
              }
            }}
            onRegionChange={handleMapRegionChange}
            onRegionChangeComplete={handleMapRegionChangeComplete}
            mapType={mapType}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            showsUserLocation
            showsCompass={false}
            {...(MAP_CLUSTERING_ENABLED
              ? {
                  renderCluster: renderMapCluster,
                  clusterColor: mapClusterColor,
                  clusterTextColor: '#FFFFFF',
                  animationEnabled: Platform.OS === 'ios',
                  radius: 58,
                  minPoints: 2,
                  spiralEnabled: false,
                  onClusterPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  },
                }
              : {})}
          >
            {mapPinChildrenReady && activeAdvancedMapBounds ? (
              <Circle
                center={{
                  latitude: activeAdvancedMapBounds.centerLat,
                  longitude: activeAdvancedMapBounds.centerLng,
                }}
                radius={Math.max(200, activeAdvancedMapBounds.radiusKm * 1000)}
                strokeColor={modeAccentColor}
                fillColor={
                  advancedFilters.transactionType === 'RENT'
                    ? 'rgba(10,132,255,0.14)'
                    : 'rgba(16,185,129,0.14)'
                }
                strokeWidth={2.5}
                zIndex={0}
              />
            ) : null}
            {mapPinChildrenReady && activeAdvancedMapBounds ? (
              <Marker
                coordinate={{
                  latitude: activeAdvancedMapBounds.centerLat,
                  longitude: activeAdvancedMapBounds.centerLng,
                }}
                cluster={MAP_CLUSTERING_ENABLED ? false : undefined}
                tracksViewChanges={false}
                zIndex={1}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.searchAreaCenterDot, { borderColor: modeAccentColor, backgroundColor: `${modeAccentColor}33` }]} />
              </Marker>
            ) : null}
            {mapPinChildrenReady ? offerMapMarkerLayers.circles : null}
            {mapPinChildrenReady ? offerMapMarkerLayers.markers : null}
          </RadarMapComponent>
      </View>

      <View style={styles.mapUiChrome} pointerEvents="box-none" collapsable={false}>

      {showOnlyFavorites && favoritesMapScope === 'FAVORITES' && (
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


      <View
        style={[
          styles.topBarContainer,
          showOnlyFavorites || radarBrowseMode === 'RADAR' || radarBrowseMode === 'GALLERY'
            ? styles.topBarFavoritesLayout
            : styles.topBarCompact,
          { top: topBarTop },
        ]}
        pointerEvents="auto"
      >
        <View style={[styles.topBarSideSlot, styles.topBarToolsRow, { width: 'auto', maxWidth: 112 }]}>
          {isGalleryBrowse && tabSurface === 'market' ? (
            <MarketCatalogViewToggle
              mode={marketContentMode}
              onToggle={() =>
                setMarketContentMode((prev) => (prev === 'catalog' ? 'rails' : 'catalog'))
              }
              isDark={isDark}
              lightChrome={isGalleryLightChrome}
              accent="#6366F1"
              accessibilityLabelCatalog={t('radar.home.marketViewCatalogA11y')}
              accessibilityLabelRails={t('radar.home.marketViewRailsA11y')}
            />
          ) : (
            <ChromeIconButton
              icon="map"
              color={showOnlyFavorites ? favoritesScopeAccent : isDark ? '#FFF' : '#1C1C1E'}
              isDark={isDark}
              lightChrome={isGalleryLightChrome}
              activeBg={showOnlyFavorites ? favoritesScopeBg : undefined}
              accessibilityLabel="Map type"
              onPress={() => {
                setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'));
              }}
            />
          )}
          <ChromeIconButton
            icon={showOnlyFavorites ? 'heart' : 'heart-outline'}
            color={showOnlyFavorites ? favoritesScopeAccent : isDark ? '#FFF' : '#1C1C1E'}
            isDark={isDark}
            lightChrome={isGalleryLightChrome}
            activeBg={showOnlyFavorites ? favoritesScopeBg : undefined}
            accessibilityLabel={t('radar.home.favoritesTab')}
            accessibilityState={{ selected: showOnlyFavorites }}
            haptic="medium"
            onPress={() => {
              setShowOnlyFavorites((prev) => {
                const next = !prev;
                if (next) setFavoritesMapScope('MINE');
                return next;
              });
            }}
          />
        </View>

        {showOnlyFavorites ? (
          <Animated.View
            style={[
              styles.topBarCenterStack,
              {
                opacity: modeIslandOpacity,
                transform: [{ translateY: modeIslandTranslateY }, { scale: modeIslandScale }],
              },
            ]}
          >
            <View style={styles.favoritesScopeRailOuter}>
              <VerticalSegmentRail isDark={isDark} />
              <View style={{ height: 8 }} />
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
                      name={favoritesMapScope === 'MINE' ? 'home' : 'home-outline'}
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
                      {t('radar.home.mineTab')}
                    </Text>
                  </Pressable>
                  <View style={[styles.favoritesScopeDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
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
                      {t('radar.home.favoritesTab')}
                    </Text>
                  </Pressable>
                </View>
              </BlurView>
            </View>
            <View style={styles.radarHeroWrap}>
              {favoritesMapScope === 'FAVORITES' && isFavoritesRadarEnabled && (
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
                </View>
              )}
              <JellyReveal visible key={favoritesMapScope}>
                {favoritesMapScope === 'FAVORITES' ? (
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
                        <Text style={[styles.radarTitle, { color: isFavoritesRadarEnabled ? '#F777B2' : '#8E8E93' }]}>
                          {t('radar.home.favorBrand')}
                        </Text>
                        <Text style={styles.radarStatus}>
                          {isFavoritesRadarEnabled ? t('radar.home.statusLoveLive') : t('radar.home.statusInactive')}
                        </Text>
                      </View>
                    </BlurView>
                  </Pressable>
                ) : (
                  <Pressable onPress={openManageMyProperties} style={({ pressed }) => [styles.radarBtnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}>
                    <BlurView
                      intensity={95}
                      tint={isDark ? 'dark' : 'light'}
                      style={[
                        styles.radarPill,
                        {
                          backgroundColor: 'rgba(16,185,129,0.16)',
                        },
                      ]}
                    >
                      <Ionicons name="home" size={18} color="#10b981" />
                      <View style={styles.radarPillTextWrap}>
                        <Text style={[styles.radarTitle, { color: isDark ? '#C9F9E7' : '#0B5B43' }]}>
                          {t('radar.home.manageMyPropertiesTitle')}
                        </Text>
                        <Text style={[styles.radarStatus, { color: isDark ? 'rgba(201,249,231,0.72)' : 'rgba(11,91,67,0.72)' }]}>
                          {t('radar.home.manageMyPropertiesSubtitle')}
                        </Text>
                      </View>
                    </BlurView>
                  </Pressable>
                )}
              </JellyReveal>
            </View>
          </Animated.View>
        ) : radarBrowseMode === 'RADAR' ? (
          <Animated.View
            style={[
              styles.topBarCenterStack,
              {
                opacity: modeIslandOpacity,
                transform: [{ translateY: modeIslandTranslateY }, { scale: modeIslandScale }],
              },
            ]}
          >
            <VerticalSegmentRail isDark={isDark} />
            <JellyReveal visible key="radar-calibration-pill">
              <View style={[styles.radarHeroWrap, tabSurface === 'explore' && { marginTop: 8 }]}>
                {(isRadarActive || radarHoldMode) && (
                  <View pointerEvents="none" style={styles.radarPulseLayer}>
                    <Animated.View
                      style={[
                        styles.radarPulseWave,
                        {
                          borderColor: radarHoldMode
                            ? 'rgba(249,115,22,0.75)'
                            : 'rgba(16,185,129,0.55)',
                          opacity: radarPulseA.interpolate({
                            inputRange: [0, 1],
                            outputRange: [radarHoldMode ? 0.6 : 0.42, 0],
                          }),
                          transform: [
                            {
                              scale: radarPulseA.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.92, radarHoldMode ? 2.2 : 1.85],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.radarPulseWave,
                        {
                          borderColor: radarHoldMode
                            ? 'rgba(251,146,60,0.55)'
                            : 'rgba(16,185,129,0.42)',
                          opacity: radarPulseB.interpolate({
                            inputRange: [0, 1],
                            outputRange: [radarHoldMode ? 0.48 : 0.34, 0],
                          }),
                          transform: [
                            {
                              scale: radarPulseB.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.96, radarHoldMode ? 2.4 : 1.95],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                )}
                <Animated.View
                  style={
                    !isRadarActive && !radarHoldMode
                      ? {
                          transform: [
                            {
                              translateY: radarCalibrateNudge.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, -4, 0],
                              }),
                            },
                            {
                              scale: radarCalibrateNudge.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 1.028, 1],
                              }),
                            },
                          ],
                        }
                      : undefined
                  }
                >
                  <Pressable
                    onPressIn={() => {
                      radarPressStartedAtRef.current = Date.now();
                      if (radarHoldArmRef.current) clearTimeout(radarHoldArmRef.current);
                      // Krótki próg — tap = kalibracja; dopiero przytrzymanie startuje 3 s.
                      radarHoldArmRef.current = setTimeout(() => {
                        radarHoldArmRef.current = null;
                        startRadarHoldAction();
                      }, 320);
                    }}
                    onPressOut={() => {
                      if (!radarHoldCompletedRef.current) {
                        clearRadarHoldAction();
                      }
                    }}
                    onPress={() => {
                      if (radarHoldCompletedRef.current) {
                        radarHoldCompletedRef.current = false;
                        return;
                      }
                      if (Date.now() - radarPressStartedAtRef.current > 280) {
                        return;
                      }
                      openRadarCalibration();
                    }}
                    style={({ pressed }) => [
                      styles.radarBtnWrapper,
                      styles.radarCalibrationBtn,
                      radarCalibrationChrome.shadow,
                      {
                        borderColor: radarHoldMode
                          ? 'rgba(249,115,22,0.9)'
                          : radarCalibrationChrome.borderColor,
                      },
                      pressed && styles.radarCalibrationPressed,
                    ]}
                  >
                    <BlurView
                      intensity={isDark ? 82 : 92}
                      tint={isDark ? 'dark' : 'light'}
                      style={[
                        styles.radarPill,
                        styles.radarCalibrationFace,
                        { backgroundColor: radarCalibrationChrome.fill, overflow: 'hidden' },
                      ]}
                    >
                      {radarHoldMode ? (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.radarHoldFill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(249,115,22,0.32)'
                                : 'rgba(249,115,22,0.26)',
                              width: radarHoldProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              }),
                            },
                          ]}
                        />
                      ) : null}
                      <RadarStatusBulb
                        active={isRadarActive && !radarHoldMode}
                        blink={radarInactiveBlink}
                        tint={radarHoldMode ? '#F97316' : radarCalibrationChrome.accent}
                        softBg={
                          radarHoldMode ? 'rgba(249,115,22,0.22)' : radarCalibrationChrome.iconBg
                        }
                      />
                      <View style={styles.radarPillTextWrap}>
                        <Text
                          style={[
                            styles.radarTitle,
                            {
                              color: radarHoldMode ? '#F97316' : radarCalibrationChrome.accent,
                            },
                          ]}
                        >
                          {t('radar.home.radarBrand')}
                        </Text>
                        <Text
                          style={[
                            styles.radarStatus,
                            radarHoldMode ? { color: isDark ? '#FDBA74' : '#C2410C' } : null,
                          ]}
                        >
                          {radarHoldMode === 'disable'
                            ? t('radar.home.calibrationHoldCountdown', {
                                seconds: String(radarHoldSecondsLeft),
                              })
                            : radarHoldMode === 'enable'
                              ? t('radar.home.calibrationHoldEnableCountdown', {
                                  seconds: String(radarHoldSecondsLeft),
                                })
                              : isRadarActive
                                ? t('radar.home.statusLive')
                                : t('radar.home.statusInactive')}
                        </Text>
                        {!radarHoldMode && isRadarActive && radarActiveScopeLine ? (
                          <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={[
                              styles.radarScopeLine,
                              { color: isDark ? 'rgba(16,185,129,0.92)' : 'rgba(5,120,85,0.95)' },
                            ]}
                          >
                            {radarActiveScopeLine}
                          </Text>
                        ) : null}
                      </View>
                    </BlurView>
                  </Pressable>
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.radarCalibrationTapHint,
                      {
                        color: radarHoldMode
                          ? isDark
                            ? 'rgba(253,186,116,0.92)'
                            : 'rgba(194,65,12,0.78)'
                          : isRadarActive
                            ? isDark
                              ? 'rgba(16,185,129,0.78)'
                              : 'rgba(5,120,85,0.72)'
                            : isDark
                              ? 'rgba(255,180,174,0.78)'
                              : 'rgba(185,28,28,0.62)',
                      },
                    ]}
                  >
                    {radarHoldMode === 'disable'
                      ? t('radar.home.calibrationHoldKeepHint')
                      : radarHoldMode === 'enable'
                        ? t('radar.home.calibrationHoldKeepEnableHint')
                        : isRadarActive
                          ? t('radar.home.calibrationHoldToDisableHint')
                          : t('radar.home.calibrationInactiveHint')}
                  </Text>
                </Animated.View>
              </View>
            </JellyReveal>
          </Animated.View>
        ) : radarBrowseMode === 'GALLERY' ? (
          <Animated.View
            style={[
              styles.topBarCenterStack,
              styles.topBarCenterStackGallery,
              {
                opacity: modeIslandOpacity,
                transform: [{ translateY: modeIslandTranslateY }, { scale: modeIslandScale }],
              },
            ]}
          >
            <VerticalSegmentRail isDark={isDark} />
          </Animated.View>
        ) : (
          <View style={styles.topBarCenterSpacer} />
        )}

        <CatalogSearchFilterButton
          isDark={isDark}
          accent={showOnlyFavorites ? favoritesScopeAccent : modeAccentColor}
          label={t('radar.home.searchCtaLabel')}
          hint={t('radar.home.searchCtaHint')}
          active={hasAdvancedFiltersActive}
          lightChrome={isGalleryLightChrome}
          accessibilityLabel={t('radar.home.advancedSearch')}
          onPress={() => {
            setDraftAdvancedFilters({
              ...advancedFilters,
              localityCountryCode: advancedFilters.localityCountryCode.trim() || 'PL',
            });
            setShowAdvancedSearch(true);
          }}
        />
      </View>

      {!showOnlyFavorites && radarBrowseMode === 'GALLERY' && !showAreaPicker && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.galleryOverlay,
            {
              opacity: galleryFade,
              transform: [{ translateY: gallerySlide }],
              backgroundColor: isDark ? '#000000' : '#E9ECF2',
            },
          ]}
        >
          <View style={[styles.galleryOverlayInner, { paddingTop: browseChromeTop }]}>
          <RadarOfferGallery
            offers={galleryOffers}
            featuredOffers={galleryFeaturedOffers}
            favoriteRailItems={galleryFavoriteRailItems}
            mineRailItems={galleryMineRailItems}
            onPressRailItem={(id) => {
              const fromGallery = galleryOffers.find((o) => Number(o.id) === Number(id));
              const fromFav = [...offers, ...favoriteHydratedOffers, ...myOffersForMap].find(
                (o) => Number(o.id) === Number(id),
              );
              const raw = fromGallery?.raw || fromFav?.raw;
              if (!raw) return;
              Haptics.selectionAsync();
              navigation.navigate('OfferDetail', { offer: raw });
            }}
            isDark={isDark}
            bottomInset={bottomCardsInset + 64}
            favorites={favorites}
            transactionFilter={galleryTransactionFilter}
            countryFilter={galleryCountryFilter}
            propertyFilter={galleryPropertyFilter}
            sortFilter={gallerySortFilter}
            hasActiveFilters={hasActiveGalleryFilters}
            userLocation={userLocation}
            locale={locale}
            refreshing={loading}
            onRefresh={() => void fetchOffersOnce(true)}
            loadError={offers.length === 0 ? offersFetchError : ''}
            onTransactionFilterChange={setGalleryTransactionFilter}
            onCountryFilterChange={setGalleryCountryFilter}
            onPropertyFilterChange={setGalleryPropertyFilter}
            onSortFilterChange={handleGallerySortChange}
            onClearFilters={clearGalleryFilters}
            onPressOffer={(item) => {
              Haptics.selectionAsync();
              navigation.navigate('OfferDetail', { offer: item.raw });
            }}
            onToggleFavorite={toggleFavorite}
            formatPrice={formatOffer}
            formatPublishDate={(raw) => formatOfferPublishDate(raw, locale)}
            isOfferVerified={(offerId, raw) => {
              const ownVerifiedFromEndpoint = ownerLegalByOfferId[Number(offerId || 0)] === true;
              return isOfferLegallyVerified(raw, ownVerifiedFromEndpoint);
            }}
            t={t}
            contentMode={marketContentMode}
          />
          </View>
        </Animated.View>
      )}

      {(showOnlyFavorites || radarBrowseMode !== 'GALLERY') && !showAreaPicker && (
      <View style={styles.offersPreviewContainer} pointerEvents="auto">
        {/* Pasek „Dlaczego widzę te oferty?" — glass-pill w stylu Apple.
            Renderowany ZAWSZE (poza loading) — gdy są oferty, pokazuje tryb
            z parametrami. Gdy brak ofert, ta sama karta zmienia ton (severity
            = 'empty'): tytuł staje się komunikatem „Brak…", subtitle wyjaśnia
            DLACZEGO nie ma wyników, a akcja kontekstowo zachęca do naprawy
            (Resetuj / Wyczyść / Filtruj / Dodaj). Wcześniej znikała → user
            myślał, że appka się zawiesiła. */}
        {!loading && (() => {
          const isEmpty = offerDisplayReason.severity === 'empty';
          // Mini-CTA „Pokaż N" dotyczy głównego Radaru — nie pokazuj na zakładce Ulubione
          // (inaczej przy pustych ulubionych widać „nie masz jeszcze…" + „Pokaż 2" z radaru).
          const radarMatchCount = visibleRadarMatchingOffers.length;
          const showRadarMatchesAction =
            isRadarActive &&
            !showRadarMatchesOnly &&
            !showOnlyFavorites &&
            radarMatchCount > 0;
          const reasonAccent = isEmpty ? '#F59E0B' : offerDisplayReason.accent;
          const reasonIcon = isEmpty ? 'alert-circle' : offerDisplayReason.icon;
          const canRefocusSearchArea = !!activeAdvancedMapBounds;
          return (
            <View
              ref={liveBannerAnchorRef}
              onLayout={measureLiveBannerAnchor}
              style={styles.offerReasonRow}
              pointerEvents="box-none"
            >
              <Pressable
                disabled={!canRefocusSearchArea}
                onPress={() => {
                  if (!canRefocusSearchArea) return;
                  Haptics.selectionAsync();
                  focusMapToActiveSearch();
                }}
                style={({ pressed }) => [pressed && canRefocusSearchArea && { opacity: 0.92 }]}
                accessibilityRole={canRefocusSearchArea ? 'button' : undefined}
                accessibilityLabel={canRefocusSearchArea ? t('radar.home.refocusSearchAreaA11y') : undefined}
              >
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
                <View style={styles.offerReasonCopy}>
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
                {(showRadarMatchesAction || offerDisplayReason.action) && (
                  <View style={styles.offerReasonActions}>
                    {showRadarMatchesAction && (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setShowRadarMatchesOnly(true);
                        }}
                        style={({ pressed }) => [
                          styles.offerReasonAction,
                          styles.offerReasonRadarAction,
                          pressed && { transform: [{ scale: 0.96 }] },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('radar.home.showRadarMatchesA11y', { count: String(radarMatchCount) })}
                      >
                        <View style={styles.offerReasonRadarDot} />
                        <Text style={styles.offerReasonRadarActionText}>
                          {t('radar.home.showRadarMatches', { count: String(radarMatchCount) })}
                        </Text>
                      </Pressable>
                    )}
                    {offerDisplayReason.action && !showRadarMatchesAction && (
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
                  </View>
                )}
              </BlurView>
              </Pressable>
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
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate="fast"
            scrollEventThrottle={16}
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
      )}

      </View>

      {showCalibration ? (
      <RadarCalibrationModal
        visible
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
        recentRadarAreas={recentRadarAreasList}
        onPickRecentRadarArea={handlePickRecentRadarArea}
      />
      ) : null}

      {showFavoritesCalibration ? (
      <RadarCalibrationModal
        visible
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
      ) : null}

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
        <>
          {/* Warstwy osobno (bez pełnoekranowego flex-wrapa) — środek ekranu przepuszcza gesty do MapView. */}
          <View style={styles.areaDimLayer} pointerEvents="none" />
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
          <View style={styles.areaPickerTop} pointerEvents="box-none">
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={styles.areaPickerTopGlass}>
              <Text style={styles.areaPickerTitle}>{t('radar.home.areaPickerTitle')}</Text>
              <Text style={styles.areaPickerSubtitle}>
                {t('radar.home.areaPickerSubtitle')}
              </Text>
            </BlurView>
          </View>
          <View style={styles.areaPickerBottom} pointerEvents="box-none">
            <BlurView intensity={92} tint={isDark ? 'dark' : 'light'} style={styles.areaPickerBottomGlass}>
              <View style={styles.areaRadiusHeader}>
                <Text style={styles.areaRadiusLabel}>{t('radar.home.radius')}</Text>
                <Text style={styles.areaRadiusValue}>
                  {formatRadiusLabel(areaPickerDraft.radiusKm)}
                </Text>
              </View>
              <View style={styles.areaInsightsCard}>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>{t('radar.home.locality')}</Text>
                  <Text style={styles.areaInsightValue}>{areaPickerLiveStats.locality}</Text>
                </View>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>{t('radar.home.area')}</Text>
                  <Text style={styles.areaInsightValue}>
                    {t('radar.home.areaKm2', {
                      area: areaPickerLiveStats.areaKm2.toFixed(1),
                      radius: areaPickerLiveStats.radiusKm.toFixed(1),
                    })}
                  </Text>
                </View>
                <View style={styles.areaInsightRow}>
                  <Text style={styles.areaInsightLabel}>{t('radar.home.offersInArea')}</Text>
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
                  <Text style={styles.areaGhostText}>{t('radar.home.areaBack')}</Text>
                </Pressable>
                <Pressable style={styles.areaApplyBtn} onPress={() => applyAreaSelectionToRadar()}>
                  <Text style={styles.areaApplyText}>{t('radar.home.areaApply')}</Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
        </>
      )}
      
      {showAdvancedSearch ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowAdvancedSearch(false)}>
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
              {...advancedSheetPan.panHandlers}
            >
            <View style={styles.modalDragHandle} />
            <Text style={[styles.advancedSwipeHint, { color: isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93' }]}>
              {t('radar.advancedSearch.swipeDownToClose')}
            </Text>
            <View style={styles.advancedHeader}>
              <View style={styles.advancedHeaderTitleRow}>
                <Ionicons name="search" size={22} color={draftModeAccentColor} />
                <Text style={[styles.advancedTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>{t('radar.advancedSearch.title')}</Text>
              </View>
              <Pressable onPress={resetAdvancedFilters}>
                  <Text style={styles.advancedReset}>{t('radar.advancedSearch.reset')}</Text>
              </Pressable>
            </View>
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
              >
                <Text style={[styles.advancedSectionLead, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                  {t('radar.advancedSearch.modeSection')}
                </Text>
                <AdvancedFilterSegment
                  size="large"
                  options={[
                    { key: 'SELL', label: t('radar.advancedSearch.buy') },
                    { key: 'RENT', label: t('radar.advancedSearch.rent') },
                  ]}
                  value={draftAdvancedFilters.transactionType}
                  onChange={(key) =>
                    setDraftAdvancedFilters((p) => ({ ...p, transactionType: key }))
                  }
                  accentColor={draftModeAccentColor}
                  isDark={isDark}
                />

                <Text style={[styles.advancedSection, { marginTop: 18 }]}>
                  {t('radar.advancedSearch.keywordSection')}
                </Text>
                <View
                  style={[
                    styles.advancedCityInputWrap,
                    {
                      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={18} color={draftModeAccentColor} />
                  <TextInput
                    style={[styles.advancedCityInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    value={draftAdvancedFilters.keyword}
                    onChangeText={(keyword) => setDraftAdvancedFilters((p) => ({ ...p, keyword }))}
                    placeholder={t('radar.advancedSearch.keywordPlaceholder')}
                    placeholderTextColor={isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.55)'}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {draftAdvancedFilters.keyword.trim() ? (
                    <Pressable
                      onPress={() => setDraftAdvancedFilters((p) => ({ ...p, keyword: '' }))}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={20} color="#8E8E93" />
                    </Pressable>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.advancedHint,
                    { marginTop: 8, color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)' },
                  ]}
                >
                  {t('radar.advancedSearch.keywordHint')}
                </Text>

                <Text style={[styles.advancedSection, { marginTop: 18 }]}>
                  {t('radar.advancedSearch.locationSection')}
                </Text>
                <View
                  style={[
                    styles.advancedSubPanel,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Text style={styles.advancedSection}>{t('radar.advancedSearch.countrySection')}</Text>
                  {!draftSelectedCountry ? (
                    <Text
                      style={[
                        styles.advancedHint,
                        { marginBottom: 8, color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)' },
                      ]}
                    >
                      {t('radar.advancedSearch.selectCountryHint')}
                    </Text>
                  ) : null}
                  {countryFilterEntries.length === 0 && loading ? (
                    <Text
                      style={[
                        styles.advancedHint,
                        {
                          marginTop: 4,
                          marginBottom: 4,
                          color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)',
                        },
                      ]}
                    >
                      {t('radar.advancedSearch.countriesLoading')}
                    </Text>
                  ) : (
                  <View style={[styles.advancedRow, styles.advancedCountryRow]}>
                    {countryFilterEntries.map((entry) => {
                      const active = draftAdvancedFilters.localityCountryCode === entry.code;
                      return (
                        <Pressable
                          key={entry.code}
                          style={[
                            styles.advancedChip,
                            styles.advancedChipCountry,
                            active && styles.advancedChipActive,
                            active && {
                              borderColor: draftModeAccentColor,
                              backgroundColor:
                                draftAdvancedFilters.transactionType === 'RENT'
                                  ? 'rgba(10,132,255,0.18)'
                                  : 'rgba(16,185,129,0.18)',
                            },
                          ]}
                          onPress={() => {
                            setAdvancedExtrasExpanded(false);
                            setDraftAdvancedFilters((p) => ({
                              ...p,
                              localityCountryCode: entry.code,
                              locationMode: 'CITY',
                              city: '',
                              districts: [],
                              mapBounds: null,
                            }));
                          }}
                        >
                          <CountryChipHangingFlag iso={entry.code} isDark={isDark} />
                          <Text
                            style={[
                              styles.advancedChipText,
                              styles.advancedChipCountryText,
                              active && styles.advancedChipTextActive,
                              active && { color: draftModeAccentColor },
                            ]}
                          >
                            {`${entry.label} (${entry.count})`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  )}
                </View>

                {draftSelectedCountry ? (
                  <Text
                    style={[
                      styles.advancedHint,
                      {
                        marginTop: 4,
                        marginBottom: 10,
                        color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)',
                      },
                    ]}
                  >
                    {t('radar.advancedSearch.countryReadyHint')}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => setAdvancedExtrasExpanded((v) => !v)}
                  style={({ pressed }) => [
                    styles.advancedExtrasHeader,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={styles.advancedExtrasHeaderCopy}>
                    <Text style={[styles.advancedExtrasTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                      {t('radar.advancedSearch.extraParamsTitle')}
                    </Text>
                    <Text style={[styles.advancedExtrasSub, { color: '#8E8E93' }]}>
                      {t('radar.advancedSearch.extraParamsSubtitle')}
                    </Text>
                  </View>
                  <Ionicons
                    name={advancedExtrasExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#8E8E93"
                  />
                </Pressable>

                <JellyReveal visible={advancedExtrasExpanded}>
                  <View
                    style={[
                      styles.advancedSubPanel,
                      {
                        marginTop: 8,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
              {draftSelectedCountry ? (
                  <>
                  {draftIsPoland ? (
                    <>
                      <PolandScopeNote isDark={isDark} />
                      <Text style={[styles.advancedSection, { marginTop: 12 }]}>
                        {t('radar.advancedSearch.plCitySection')}
                      </Text>
                      <View style={styles.advancedRow}>
                        {cityFilterEntries.map(({ city, count }) => {
                          const active =
                            draftAdvancedFilters.locationMode === 'CITY' &&
                            draftAdvancedFilters.city === city &&
                            !draftAdvancedFilters.mapBounds;
                          const cityLabel = city || t('radar.advancedSearch.allCitiesInCountry');
                          return (
                            <Pressable
                              key={city || 'all'}
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
                                  locationMode: 'CITY',
                                  city,
                                  districts: [],
                                  mapBounds: null,
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
                                {`${cityLabel} (${count})`}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View
                        style={[
                          styles.advancedCityInputWrap,
                          {
                            marginTop: 10,
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
                          },
                        ]}
                      >
                        <Ionicons name="location-outline" size={18} color={draftModeAccentColor} />
                        <TextInput
                          style={[styles.advancedCityInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                          value={draftAdvancedFilters.city}
                          onChangeText={(city) =>
                            setDraftAdvancedFilters((p) => ({
                              ...p,
                              locationMode: 'CITY',
                              city,
                              districts: [],
                              mapBounds: null,
                            }))
                          }
                          placeholder={t('radar.advancedSearch.cityOverridePlaceholder')}
                          placeholderTextColor={isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.55)'}
                          autoCorrect={false}
                          autoCapitalize="words"
                          returnKeyType="done"
                        />
                        {draftAdvancedFilters.city.trim().length > 0 ? (
                          <Pressable
                            onPress={() =>
                              setDraftAdvancedFilters((p) => ({
                                ...p,
                                city: '',
                                districts: [],
                              }))
                            }
                            hitSlop={8}
                          >
                            <Ionicons name="close-circle" size={20} color="#8E8E93" />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.advancedHint,
                          { marginTop: 8, color: isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.65)' },
                        ]}
                      >
                        {t('radar.advancedSearch.cityOverrideHint')}
                      </Text>

                      {draftAdvancedFilters.city.trim() ? (
                        <>
                          <Text style={styles.advancedSection}>
                            {t('radar.calibration.districts', { city: draftAdvancedFilters.city.trim() })}
                          </Text>
                          {districtFilterEntries.length > 0 ? (
                            <View style={styles.advancedRow}>
                              {districtFilterEntries.map(({ district, count }) => {
                                const active = draftAdvancedFilters.districts.includes(district);
                                return (
                                  <Pressable
                                    key={district}
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
                                        locationMode: 'CITY',
                                        mapBounds: null,
                                        districts: p.districts.includes(district)
                                          ? p.districts.filter((d) => d !== district)
                                          : [...p.districts, district],
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
                                      {`${district} (${count})`}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.advancedHint,
                                { marginBottom: 4, color: isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.65)' },
                              ]}
                            >
                              {t('radar.calibration.legacy.districtsUnmapped')}
                            </Text>
                          )}
                          {draftAdvancedFilters.districts.length > 0 ? (
                            <Pressable
                              onPress={() =>
                                setDraftAdvancedFilters((p) => ({ ...p, districts: [] }))
                              }
                              style={{ alignSelf: 'flex-start', marginBottom: 4 }}
                            >
                              <Text style={{ color: '#8E8E93', fontWeight: '700' }}>
                                {t('radar.advancedSearch.clearDistricts')}
                              </Text>
                            </Pressable>
                          ) : null}
                        </>
                      ) : null}

                      <Text style={[styles.advancedOrLabel, { color: isDark ? '#8E8E93' : '#6B7280' }]}>
                        {t('radar.advancedSearch.plOrMapDivider')}
                      </Text>
                    </>
                  ) : null}

                  {draftIsAbroad ? (
                    <Text
                      style={[
                        styles.advancedHint,
                        { marginTop: draftIsPoland ? 0 : 12, marginBottom: 10, color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)' },
                      ]}
                    >
                      {t('radar.advancedSearch.abroadMapOptionalHint')}
                    </Text>
                  ) : null}

                  {(draftIsPoland || draftIsAbroad) ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.advancedMapCard,
                        {
                          borderColor: draftAdvancedFilters.mapBounds ? draftModeAccentColor : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          backgroundColor: draftAdvancedFilters.mapBounds
                            ? draftAdvancedFilters.transactionType === 'RENT'
                              ? isDark
                                ? 'rgba(10,132,255,0.14)'
                                : 'rgba(10,132,255,0.1)'
                              : isDark
                                ? 'rgba(16,185,129,0.14)'
                                : 'rgba(16,185,129,0.1)'
                            : isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.03)',
                          opacity: pressed ? 0.88 : 1,
                        },
                      ]}
                      onPress={openAdvancedMapAreaPicker}
                    >
                      <View
                        style={[
                          styles.advancedMapCardIcon,
                          { backgroundColor: `${draftModeAccentColor}28` },
                        ]}
                      >
                        <Ionicons name="map" size={22} color={draftModeAccentColor} />
                      </View>
                      <View style={styles.advancedMapCardCopy}>
                        <Text style={[styles.advancedMapCardTitle, { color: isDark ? '#FFF' : '#1C1C1E' }]}>
                          {t('radar.advancedSearch.pickMapArea')}
                        </Text>
                        <Text style={[styles.advancedMapCardSub, { color: '#8E8E93' }]}>
                          {draftAdvancedFilters.mapBounds
                            ? t('radar.advancedSearch.mapAreaSelected', {
                                radius: draftAdvancedFilters.mapBounds.radiusKm.toFixed(1),
                              })
                            : t('radar.advancedSearch.mapAreaNotSelected')}
                        </Text>
                        <Text style={[styles.advancedMapCardSub, { color: '#8E8E93', marginTop: 2 }]}>
                          {t('radar.advancedSearch.pickMapAreaSub')}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                  </>
              ) : (
                <Text
                  style={[
                    styles.advancedHint,
                    { marginBottom: 10, color: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.72)' },
                  ]}
                >
                  {t('radar.advancedSearch.selectCountryHint')}
                </Text>
              )}

                <Text style={styles.advancedSection}>{t('radar.advancedSearch.propertyTypeSection')}</Text>
              <View style={styles.advancedRow}>
                {propertyTypeFilterEntries.map(({ type, count }) => {
                    const labelKey = {
                      ALL: 'radar.home.propertyAll',
                      FLAT: 'radar.home.propertyFlat',
                      HOUSE: 'radar.home.propertyHouse',
                      PLOT: 'radar.home.propertyPlot',
                      COMMERCIAL: 'radar.home.propertyPremises',
                    } as const;
                  const active = draftAdvancedFilters.propertyType === type;
                  return (
                    <Pressable key={type} style={[styles.advancedChip, active && styles.advancedChipActive, active && { borderColor: draftModeAccentColor, backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? 'rgba(10,132,255,0.18)' : 'rgba(16,185,129,0.18)' }]} onPress={() => setDraftAdvancedFilters((p) => ({ ...p, propertyType: type }))}>
                        <Text style={[styles.advancedChipText, active && styles.advancedChipTextActive, active && { color: draftModeAccentColor }]}>{`${t(labelKey[type])} (${count})`}</Text>
                    </Pressable>
                  );
                })}
              </View>

                <Text style={styles.advancedSection}>
                  {t('radar.advancedSearch.priceSection', { currency: draftAdvancedFilters.priceCurrency === 'EUR' ? '€' : 'zł' })}
                </Text>
                <CurrencySegmentControl
                  value={draftAdvancedFilters.priceCurrency}
                  onChange={(next) =>
                    setDraftAdvancedFilters((p) => ({
                      ...p,
                      priceCurrency: next,
                      minPrice:
                        p.minPrice != null
                          ? convertBetweenCurrencies(p.minPrice, p.priceCurrency, next, rate)
                          : null,
                      maxPrice:
                        p.maxPrice != null
                          ? convertBetweenCurrencies(p.maxPrice, p.priceCurrency, next, rate)
                          : null,
                    }))
                  }
                  isDark={isDark}
                />
                <Text style={[styles.advancedPriceHint, { color: isDark ? '#8E8E93' : '#6B7280' }]}>
                  {t('radar.advancedSearch.priceHint')}
                </Text>
              <View style={styles.advancedInputRow}>
                <TextInput
                  style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.priceFrom', { currency: draftAdvancedFilters.priceCurrency })}
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={draftAdvancedFilters.minPrice === null ? '' : String(draftAdvancedFilters.minPrice)}
                  onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, minPrice: v ? Number(v.replace(/\D/g, '')) : null }))}
                />
                <TextInput
                  style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.priceTo', { currency: draftAdvancedFilters.priceCurrency })}
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={draftAdvancedFilters.maxPrice === null ? '' : String(draftAdvancedFilters.maxPrice)}
                  onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, maxPrice: v ? Number(v.replace(/\D/g, '')) : null }))}
                />
              </View>

                <Text style={styles.advancedSection}>
                  {t('radar.advancedSearch.pricePerM2Section', {
                    currency: draftAdvancedFilters.priceCurrency === 'EUR' ? '€' : 'zł',
                  })}
                </Text>
                <Text style={[styles.advancedPriceHint, { color: isDark ? '#8E8E93' : '#6B7280' }]}>
                  {t('radar.advancedSearch.pricePerM2Hint')}
                </Text>
                <View style={styles.advancedInputRow}>
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.pricePerM2From', {
                      currency: draftAdvancedFilters.priceCurrency,
                    })}
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={
                      draftAdvancedFilters.minPricePerM2 === null
                        ? ''
                        : String(draftAdvancedFilters.minPricePerM2)
                    }
                    onChangeText={(v) =>
                      setDraftAdvancedFilters((p) => ({
                        ...p,
                        minPricePerM2: v ? Number(v.replace(/\D/g, '')) : null,
                      }))
                    }
                  />
                  <TextInput
                    style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.pricePerM2To', {
                      currency: draftAdvancedFilters.priceCurrency,
                    })}
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    value={
                      draftAdvancedFilters.maxPricePerM2 === null
                        ? ''
                        : String(draftAdvancedFilters.maxPricePerM2)
                    }
                    onChangeText={(v) =>
                      setDraftAdvancedFilters((p) => ({
                        ...p,
                        maxPricePerM2: v ? Number(v.replace(/\D/g, '')) : null,
                      }))
                    }
                  />
                </View>

                <Text style={styles.advancedSection}>{t('radar.advancedSearch.areaSection')}</Text>
              <View style={styles.advancedInputRow}>
                <TextInput
                  style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.from')}
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={draftAdvancedFilters.minArea === null ? '' : String(draftAdvancedFilters.minArea)}
                  onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, minArea: v ? Number(v.replace(/\D/g, '')) : null }))}
                />
                <TextInput
                  style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                    placeholder={t('radar.advancedSearch.to')}
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={draftAdvancedFilters.maxArea === null ? '' : String(draftAdvancedFilters.maxArea)}
                  onChangeText={(v) => setDraftAdvancedFilters((p) => ({ ...p, maxArea: v ? Number(v.replace(/\D/g, '')) : null }))}
                />
              </View>

                {(draftAdvancedFilters.propertyType === 'HOUSE' ||
                  draftAdvancedFilters.propertyType === 'ALL') && (
                  <>
                    <Text style={styles.advancedSection}>{t('radar.advancedSearch.plotAreaSection')}</Text>
                    <View style={styles.advancedInputRow}>
                      <TextInput
                        style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                        placeholder={t('radar.advancedSearch.from')}
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                        value={
                          draftAdvancedFilters.minPlotArea === null
                            ? ''
                            : String(draftAdvancedFilters.minPlotArea)
                        }
                        onChangeText={(v) =>
                          setDraftAdvancedFilters((p) => ({
                            ...p,
                            minPlotArea: v ? Number(v.replace(/\D/g, '')) : null,
                          }))
                        }
                      />
                      <TextInput
                        style={[styles.advancedInput, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                        placeholder={t('radar.advancedSearch.to')}
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                        value={
                          draftAdvancedFilters.maxPlotArea === null
                            ? ''
                            : String(draftAdvancedFilters.maxPlotArea)
                        }
                        onChangeText={(v) =>
                          setDraftAdvancedFilters((p) => ({
                            ...p,
                            maxPlotArea: v ? Number(v.replace(/\D/g, '')) : null,
                          }))
                        }
                      />
                    </View>
                  </>
                )}

                <Text style={styles.advancedSection}>{t('radar.advancedSearch.roomsSection')}</Text>
                <View style={styles.advancedRow}>
                  {([
                    { value: null, label: t('radar.advancedSearch.roomsAny') },
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

                <View
                  style={[
                    styles.advancedOfferIdBlock,
                    {
                      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <Text style={styles.advancedSection}>{t('radar.advancedSearch.offerIdSection')}</Text>
                  <Text
                    style={[
                      styles.advancedHint,
                      { marginBottom: 8, color: isDark ? 'rgba(235,235,245,0.45)' : 'rgba(60,60,67,0.65)' },
                    ]}
                  >
                    {t('radar.advancedSearch.offerIdHint')}
                  </Text>
                  <TextInput
                    style={[
                      styles.advancedInput,
                      {
                        flexGrow: 0,
                        alignSelf: 'stretch',
                        width: '100%',
                        color: isDark ? '#FFF' : '#1C1C1E',
                      },
                    ]}
                    placeholder={t('radar.advancedSearch.offerIdPlaceholder')}
                    placeholderTextColor="#8E8E93"
                    keyboardType="number-pad"
                    value={draftOfferIdInput}
                    onChangeText={setDraftOfferIdInput}
                    returnKeyType="done"
                    editable={!advancedOfferIdBusy}
                  />
                </View>
                  </View>
                </JellyReveal>
            </ScrollView>
              <Pressable
                style={[
                  styles.advancedApplyBtn,
                  {
                    backgroundColor: draftAdvancedFilters.transactionType === 'RENT' ? '#0A84FF' : '#10b981',
                  },
                  (advancedOfferIdBusy || !canApplyAdvancedSearch) && { opacity: 0.55 },
                ]}
                disabled={advancedOfferIdBusy || !canApplyAdvancedSearch}
                onPress={() => void applyAdvancedFilters()}
              >
                {advancedOfferIdBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.advancedApplyText}>
                    {draftOfferIdReady
                      ? t('radar.advancedSearch.apply')
                      : !draftAdvancedLocationReady
                        ? t('radar.advancedSearch.selectCountryPrompt')
                        : t('radar.advancedSearch.applyWithCount', { count: draftAdvancedMatchTotal })}
                  </Text>
                )}
            </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      ) : null}
    </View>
  </>);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapStage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  mapUiChrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  containerGalleryLight: {
    backgroundColor: '#E9ECF2',
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

  searchFocusLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  searchDismissStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 110,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  topBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 50,
  },
  topBarCompact: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topBarFavoritesLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  topBarSideSlot: {
    width: 50,
    flexShrink: 0,
  },
  topBarCenterSpacer: {
    flex: 1,
  },
  topBarCenterStack: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 6,
    maxWidth: 320,
    alignSelf: 'center',
  },
  topBarCenterStackGallery: {
    justifyContent: 'center',
    paddingTop: 2,
  },
  topBarToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarSlot: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    minHeight: 68,
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
  favoritesScopeHalfActiveRadar: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  favoritesScopeHalfActiveGallery: {
    backgroundColor: 'rgba(99,102,241,0.18)',
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
  searchGlassGalleryLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  smartHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  smartFootnote: {
    fontSize: 12,
    fontWeight: '500',
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
  filterButtonWrapGalleryLight: {
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  filterGlass: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterGlassGalleryLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
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
  markerOuterAndroid: {
    overflow: 'visible',
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
  markerCapsuleAndroid: {
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 52,
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
    flexShrink: 0,
  },
  mapMarkerTextAndroid: {
    includeFontPadding: false,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  searchAreaCenterDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
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
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
    elevation: 18,
  },
  galleryOverlayInner: {
    flex: 1,
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
  radarCalibrationBtn: {
    borderWidth: 1,
  },
  radarCalibrationFace: {
    borderRadius: 25,
  },
  radarCalibrationPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  radarCalibrationTapHint: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  radarHoldFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
    minWidth: 220,
    maxWidth: '92%',
  },
  radarPillTextWrap: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    zIndex: 2,
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
  radarScopeLine: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 13,
    letterSpacing: 0.15,
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
  },
  offerReasonCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
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
  offerReasonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 4,
  },
  offerReasonActionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  offerReasonRadarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(16,185,129,0.6)',
    shadowColor: '#10b981',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  offerReasonRadarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  offerReasonRadarActionText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.25,
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
    position: 'relative',
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
  legalSealFloating: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  legalSealFloatingDark: {
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderColor: 'rgba(52,211,153,0.55)',
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
  areaDimLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  areaBackdropBlur: { position: 'absolute' },
  
  areaReticleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 121,
  },
  areaPickerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 122,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 122,
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
    marginBottom: 4,
  },
  advancedSwipeHint: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  advancedHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  advancedCityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  advancedCityInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 10,
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
  advancedSectionLead: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
    marginTop: 4,
  },
  advancedOrLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },
  advancedOfferIdBlock: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  advancedHint: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginBottom: 10,
  },
  advancedSubPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 12,
    overflow: 'visible',
  },
  advancedExtrasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  advancedExtrasHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  advancedExtrasTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  advancedExtrasSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 16,
  },
  advancedMapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 8,
  },
  advancedMapCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedMapCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  advancedMapCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  advancedMapCardSub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  advancedPriceHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 16,
  },
  advancedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advancedCountryRow: {
    paddingTop: 26,
    paddingBottom: 4,
    overflow: 'visible',
  },
  advancedChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.22)',
  },
  advancedChipCountry: {
    overflow: 'visible',
    marginTop: 8,
    paddingRight: 10,
  },
  advancedChipCountryText: {
    paddingRight: 6,
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