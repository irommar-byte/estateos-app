import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  FlatList,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/useAuthStore';
import { fetchCarsCatalog, fetchMyCars, formatCarPrice, type CarListing } from '../services/carsApi';
import CarFavoriteButton from '../components/cars/CarFavoriteButton';
import CarAuthGateModal from '../components/cars/CarAuthGateModal';
import CatalogSearchFilterButton from '../components/CatalogSearchFilterButton';
import CarsCatalogMapView, { type CarsCatalogMapViewHandle } from '../components/cars/CarsCatalogMapView';
import CarsAdvancedSearchModal from '../components/cars/CarsAdvancedSearchModal';
import VerticalSegmentRail from '../components/VerticalSegmentRail';
import CollapsibleMarketRails from '../components/catalog/CollapsibleMarketRails';
import { buildCarMarketRailSections } from '../components/catalog/buildMarketRails';
import * as Haptics from 'expo-haptics';
import { useCarScreenTheme, type CarScreenColors } from '../theme/carScreenTheme';
import FeaturedOfferSpotlight from '../components/radar/FeaturedOfferSpotlight';
import { isOfferFeatured } from '../utils/listingPromotion';
import { carToSpotlightOffer } from '../utils/carSpotlightOffer';
import {
  applyCarsAdvancedFilters,
  carsAdvancedFiltersActive,
  EMPTY_CARS_ADVANCED_FILTERS,
  type CarsAdvancedFilters,
} from '../utils/carsAdvancedFilters';
import { VEHICLE_TYPE_OPTIONS } from '../utils/vehicleTypes';
import { loadCarFavoriteIds } from '../utils/carFavoritesStorage';
import { useI18n } from '../i18n';

const CAR_ACCENT = '#0EA5E9';
const FAV_ACCENT = '#F777B2';
const NEARBY_RADIUS_KM = 25;

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function pluralCars(n: number, locale: string) {
  if (locale.startsWith('en')) return n === 1 ? 'listing' : 'listings';
  if (n === 1) return 'ogłoszenie';
  if (n >= 2 && n <= 4) return 'ogłoszenia';
  return 'ogłoszeń';
}

type ViewMode = 'cover' | 'list' | 'grid';
type BrowseMode = 'GALLERY' | 'MAP';
type MarketSurface = 'market' | 'explore';

type Props = {
  surface?: MarketSurface;
  initialBrowseMode?: BrowseMode;
};

export default function CarsCatalogScreen({
  surface = 'market',
  initialBrowseMode,
}: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { colors, elevation, isDark } = useCarScreenTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isTabletLike = screenWidth >= 600;
  const resolvedInitial: BrowseMode =
    initialBrowseMode || (surface === 'explore' ? 'MAP' : 'GALLERY');
  const [browseMode, setBrowseMode] = useState<BrowseMode>(resolvedInitial);
  const [viewMode, setViewMode] = useState<ViewMode>(isTabletLike ? 'grid' : 'cover');
  const isListView = viewMode === 'list';
  const isGridView = viewMode === 'grid';
  const isMultiCol = isListView || isGridView;
  const topBarOffset = Math.max(insets.top + 8, 52);
  const bottomCardsInset = useMemo(() => {
    const tabBase = Platform.OS === 'ios' ? 18 : 14;
    return tabBase + insets.bottom;
  }, [insets.bottom]);
  const cardLayout = useMemo(() => {
    const horizontalPad = 40;
    const gap = 14;
    if (isListView) {
      const cardWidth = (screenWidth - horizontalPad - gap) / 2;
      return { cardWidth, imageAspectRatio: 5 / 4, compact: true };
    }
    if (isGridView) {
      const cols = screenWidth >= 900 ? 3 : 2;
      const cardWidth = (screenWidth - horizontalPad - gap * (cols - 1)) / cols;
      return { cardWidth, imageAspectRatio: 4 / 3, compact: true };
    }
    return { cardWidth: undefined as number | undefined, imageAspectRatio: 16 / 10, compact: false };
  }, [isListView, isGridView, screenWidth]);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const token = useAuthStore((s) => s.token);
  const [cars, setCars] = useState<CarListing[]>([]);
  const [myCars, setMyCars] = useState<CarListing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<CarsAdvancedFilters>(EMPTY_CARS_ADVANCED_FILTERS);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<CarsAdvancedFilters>(EMPTY_CARS_ADVANCED_FILTERS);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showCarMapAreaPicker, setShowCarMapAreaPicker] = useState(false);
  const [carMapAreaDraft, setCarMapAreaDraft] = useState({
    latitude: 52.2297,
    longitude: 21.0122,
    radiusKm: 25,
  });
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedMapCarId, setSelectedMapCarId] = useState<number | null>(null);
  const [activeMapIndex, setActiveMapIndex] = useState(0);
  const [nearbyModeEnabled, setNearbyModeEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapViewRef = useRef<CarsCatalogMapViewHandle>(null);
  const mapListRef = useRef<FlatList<CarListing>>(null);
  const pendingFitAllRef = useRef(false);
  const didFitAllPinsRef = useRef(false);
  const [scrollY, setScrollY] = useState(0);
  const [featuredSpotlightBottom, setFeaturedSpotlightBottom] = useState(420);
  const featuredSpotlightVisible = scrollY < Math.max(featuredSpotlightBottom - 72, 0);
  const isGalleryLightChrome = browseMode === 'GALLERY' && !isDark;
  const hasAdvancedFiltersActive = useMemo(() => carsAdvancedFiltersActive(advancedFilters), [advancedFilters]);

  useEffect(() => {
    setBrowseMode(surface === 'explore' ? 'MAP' : 'GALLERY');
  }, [surface]);

  const loadCars = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [rows, favIds] = await Promise.all([fetchCarsCatalog(), loadCarFavoriteIds()]);
      setCars(rows);
      setFavoriteIds(favIds);
      if (token) {
        try {
          setMyCars(await fetchMyCars(token));
        } catch {
          setMyCars([]);
        }
      } else {
        setMyCars([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Błąd ładowania katalogu aut.');
      setCars([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  const favoriteCars = useMemo(
    () => cars.filter((c) => favoriteIds.includes(c.id)),
    [cars, favoriteIds],
  );

  const filtered = useMemo(() => {
    const base = showOnlyFavorites ? favoriteCars : cars;
    return applyCarsAdvancedFilters(base, advancedFilters);
  }, [cars, favoriteCars, advancedFilters, showOnlyFavorites]);

  const marketRailSections = useMemo(() => {
    const toListing = (car: CarListing) => ({
      id: car.id,
      title: car.title || `${car.make} ${car.model}`,
      subtitle: [car.year, car.city].filter(Boolean).join(' · ') || undefined,
      imageUrl: car.imageUrl,
      priceLabel: formatCarPrice(car.pricePln),
      vehicleType: car.vehicleType,
      cityLat: car.cityLat,
      cityLng: car.cityLng,
      createdAt: car.createdAt,
      year: car.year,
      city: car.city,
      make: car.make,
      model: car.model,
    });
    return buildCarMarketRailSections({
      favorites: favoriteCars.map(toListing),
      mine: myCars.map(toListing),
      catalog: cars.map(toListing),
      userLocation: null,
      labels: {
        favorites: t('radar.home.galleryRailFavorites'),
        mine: t('radar.home.galleryRailMine'),
        newest: t('radar.home.galleryRailNewest'),
        nearest: t('radar.home.galleryRailNearest'),
        motorcycle: t('radar.home.galleryRailMotorcycles'),
        car: t('radar.home.galleryRailCars'),
        van: t('radar.home.galleryRailVans'),
        truck: t('radar.home.galleryRailTrucks'),
        favoritesEmpty: 'Dodaj auta do ulubionych, żeby zobaczyć je tutaj.',
        mineEmpty: 'Twoje ogłoszenia aut pojawią się tutaj po wystawieniu.',
      },
    });
  }, [favoriteCars, myCars, cars, t]);

  const featuredSpotlightCars = useMemo(
    () =>
      cars
        .filter((car) => isOfferFeatured(car as unknown as Record<string, unknown>))
        .sort(
          (a, b) =>
            Date.parse(String(b.promotedUntil || b.createdAt || 0)) -
            Date.parse(String(a.promotedUntil || a.createdAt || 0)),
        )
        .map(carToSpotlightOffer),
    [cars],
  );

  const mappableCount = useMemo(
    () => filtered.filter((car) => Number.isFinite(car.cityLat) && Number.isFinite(car.cityLng)).length,
    [filtered],
  );

  const mapCars = useMemo(() => {
    const withCoords = filtered.filter(
      (car) => Number.isFinite(car.cityLat) && Number.isFinite(car.cityLng),
    );
    if (!userLocation) return withCoords;
    const ranked = withCoords
      .map((car) => ({
        car,
        distance: distanceKm(
          userLocation.latitude,
          userLocation.longitude,
          Number(car.cityLat),
          Number(car.cityLng),
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
    if (nearbyModeEnabled) {
      return ranked.filter((row) => row.distance <= NEARBY_RADIUS_KM).map((row) => row.car);
    }
    return ranked.map((row) => row.car);
  }, [filtered, userLocation, nearbyModeEnabled]);

  useEffect(() => {
    if (browseMode !== 'MAP') return;
    if (mapCars.length === 0) {
      setSelectedMapCarId(null);
      setActiveMapIndex(0);
      return;
    }
    const stillSelected = mapCars.some((car) => car.id === selectedMapCarId);
    if (!stillSelected) {
      setSelectedMapCarId(mapCars[0].id);
      setActiveMapIndex(0);
    }
  }, [browseMode, mapCars, selectedMapCarId]);

  useEffect(() => {
    if (browseMode !== 'MAP') {
      didFitAllPinsRef.current = false;
      return;
    }
    if (nearbyModeEnabled) return;
    if (loading || mapCars.length === 0) return;
    const shouldFit = !didFitAllPinsRef.current || pendingFitAllRef.current;
    if (!shouldFit) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const carsSnapshot = mapCars;

    const runFit = () => {
      if (cancelled) return;
      if (!mapViewRef.current) {
        retryTimer = setTimeout(runFit, 180);
        return;
      }
      mapViewRef.current.fitToCars();
      didFitAllPinsRef.current = true;
      pendingFitAllRef.current = false;
    };

    const timer = setTimeout(runFit, 360);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [browseMode, mapCars, nearbyModeEnabled, loading]);

  const mapReason = useMemo(() => {
    const count = mapCars.length;
    const offersWord = pluralCars(count, locale);
    if (nearbyModeEnabled) {
      if (count === 0) {
        return {
          title: t('radar.home.reason.nearbyEmptyTitle'),
          subtitle: t('radar.home.reason.nearbyEmptySubtitle'),
          accent: CAR_ACCENT,
          actionLabel: t('radar.home.reason.showAllMap'),
          empty: true,
        };
      }
      return {
        title: t('radar.home.reason.nearbyActiveTitle'),
        subtitle: t('radar.home.reason.nearbyActiveSubtitle', {
          count: String(count),
          offers: offersWord,
        }),
        accent: CAR_ACCENT,
        actionLabel: t('radar.home.reason.showAllMap'),
        empty: false,
      };
    }
    if (count === 0) {
      return {
        title: t('radar.home.reason.databaseEmptyTitle'),
        subtitle: t('radar.home.reason.databaseEmptySubtitle'),
        accent: isDark ? '#94A3B8' : '#64748B',
        actionLabel: null as string | null,
        empty: true,
      };
    }
    return {
      title: t('radar.home.reason.allOffersTitle'),
      subtitle: t('radar.home.reason.allOffersSubtitle', {
        count: String(count),
        offers: offersWord,
      }),
      accent: isDark ? '#94A3B8' : '#64748B',
      actionLabel: t('radar.home.reason.showNearby'),
      empty: false,
    };
  }, [mapCars.length, nearbyModeEnabled, t, locale, isDark]);

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
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLoc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLocation(nextLoc);
      setNearbyModeEnabled(true);
      setActiveMapIndex(0);
      void Haptics.selectionAsync();
      setTimeout(() => {
        mapViewRef.current?.fitToCars();
        mapListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 120);
    } catch {
      // noop
    }
  }, [t]);

  const showAllMapPins = useCallback(() => {
    pendingFitAllRef.current = true;
    setNearbyModeEnabled(false);
    setActiveMapIndex(0);
    void Haptics.selectionAsync();
    setTimeout(() => {
      mapViewRef.current?.fitToCars();
      mapListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 80);
  }, []);

  const focusMapCarAtIndex = useCallback(
    (index: number) => {
      const car = mapCars[index];
      if (!car) return;
      setActiveMapIndex(index);
      setSelectedMapCarId(car.id);
      mapViewRef.current?.focusCar(car);
    },
    [mapCars],
  );

  const mapCardWidth = screenWidth * 0.85;
  const mapCardStride = mapCardWidth + 16;

  const openAuthEntry = (intent: 'login' | 'register') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAuthGateOpen(false);
    navigation.navigate('MainTabs', { screen: 'Profil', params: { authIntent: intent } });
  };

  const toggleViewMode = (mode: ViewMode) => {
    if (viewMode === mode) return;
    void Haptics.selectionAsync();
    setViewMode(mode);
  };

  const openCarDetail = (car: CarListing) => {
    void Haptics.selectionAsync();
    navigation.navigate('CarDetail', { carId: car.id, car });
  };

  const handleMapCarPress = (car: CarListing) => {
    const index = mapCars.findIndex((row) => row.id === car.id);
    if (index >= 0) {
      focusMapCarAtIndex(index);
      mapListRef.current?.scrollToIndex({ index, animated: true });
    } else {
      setSelectedMapCarId(car.id);
      mapViewRef.current?.focusCar(car);
    }
  };

  const openMapCarDetail = (car: CarListing) => {
    focusMapCarAtIndex(Math.max(0, mapCars.findIndex((row) => row.id === car.id)));
    openCarDetail(car);
  };

  const centerChrome = (
    <View style={{ width: '100%', alignItems: 'center', gap: 2 }}>
      <VerticalSegmentRail isDark={isDark} />
    </View>
  );

  return (
    <View style={styles.screen}>
      {browseMode === 'MAP' ? (
        <CarsCatalogMapView
          ref={mapViewRef}
          cars={mapCars}
          selectedCarId={selectedMapCarId}
          onSelectCar={handleMapCarPress}
          isDark={isDark}
          mapType={mapType}
        />
      ) : null}

      {browseMode === 'GALLERY' ? (
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: topBarOffset + 58 },
          ]}
          onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadCars(true)}
              tintColor={colors.accentSoft}
            />
          }
        >
          <Text style={styles.eyebrow}>EstateOS™Car</Text>
          <Text style={styles.title}>Katalog samochodów</Text>
          <Text style={styles.lead}>
            {filtered.length} ogłoszeń
            {advancedFilters.vehicleType
              ? ` · ${VEHICLE_TYPE_OPTIONS.find((o) => o.value === advancedFilters.vehicleType)?.labelPl || ''}`
              : ''}
          </Text>

          {featuredSpotlightCars.length > 0 ? (
            <View
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                setFeaturedSpotlightBottom(y + height);
              }}
            >
              <FeaturedOfferSpotlight
                offers={featuredSpotlightCars}
                isDark={isDark}
                title="Galeria wyróżnionych"
                lead="Premiumowa ekspozycja — rotacja co 20 sekund."
                badgeLabel="Wyróżnione"
                formatPrice={(raw) => ({ primary: formatCarPrice(Number(raw?.pricePln || 0)) })}
                onPressOffer={(item) => openCarDetail(item.raw as unknown as CarListing)}
                autoRotateEnabled={featuredSpotlightVisible}
              />
            </View>
          ) : null}

          {!loading && !error && filtered.length > 0 ? (
            <View style={styles.viewToggleRow}>
              <Text style={styles.viewToggleLabel}>Widok</Text>
              <View style={styles.viewToggleGroup}>
                {(
                  [
                    { key: 'cover' as const, label: 'Cover', iconOn: 'tablet-landscape', iconOff: 'tablet-landscape-outline' },
                    { key: 'list' as const, label: 'Lista', iconOn: 'list', iconOff: 'list-outline' },
                    { key: 'grid' as const, label: 'Siatka', iconOn: 'grid', iconOff: 'grid-outline' },
                  ] as const
                ).map((mode) => {
                  const selected = viewMode === mode.key;
                  return (
                    <Pressable
                      key={mode.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => toggleViewMode(mode.key)}
                      style={[styles.viewToggleBtn, selected && styles.viewToggleBtnActive]}
                    >
                      <Ionicons
                        name={(selected ? mode.iconOn : mode.iconOff) as any}
                        size={16}
                        color={selected ? colors.chipActiveText : colors.muted}
                      />
                      <Text style={[styles.viewToggleBtnLabel, selected && styles.viewToggleBtnLabelActive]}>
                        {mode.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.accentSoft} />
              <Text style={styles.muted}>Ładowanie ofert aut...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => loadCars()} style={styles.retryBtn}>
                <Text style={styles.retryLabel}>Spróbuj ponownie</Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.muted}>Brak ogłoszeń samochodowych.</Text>
          ) : (
            <View style={[styles.list, isMultiCol && styles.listGrid]}>
              {filtered.map((car) => (
                <Pressable
                  key={car.id}
                  onPress={() => openCarDetail(car)}
                  style={({ pressed }) => [
                    styles.card,
                    cardLayout.cardWidth ? { width: cardLayout.cardWidth } : null,
                    elevation.card,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.cardImageWrap}>
                    <Image
                      source={{ uri: car.imageUrl }}
                      style={[styles.cardImage, { aspectRatio: cardLayout.imageAspectRatio }]}
                      contentFit="cover"
                    />
                <View style={[styles.cardFavWrap, cardLayout.compact && styles.cardFavWrapCompact]}>
                  <CarFavoriteButton
                    carId={car.id}
                    isLoggedIn={Boolean(token)}
                    onAuthRequired={() => setAuthGateOpen(true)}
                  />
                </View>
                {isOfferFeatured(car as unknown as Record<string, unknown>) ? (
                  <View style={styles.featuredChip}>
                    <Ionicons name="sparkles" size={10} color="#000" />
                    <Text style={styles.featuredChipText}>Wyróżnione</Text>
                  </View>
                ) : null}
              </View>
                  <View style={[styles.cardBody, cardLayout.compact && styles.cardBodyCompact]}>
                    <Text style={[styles.cardMeta, cardLayout.compact && styles.cardMetaCompact]} numberOfLines={1}>
                      {car.make} · {car.model} · {car.year}
                    </Text>
                    <Text
                      style={[styles.cardTitle, cardLayout.compact && styles.cardTitleCompact]}
                      numberOfLines={2}
                    >
                      {car.title}
                    </Text>
                    <Text style={[styles.cardSub, cardLayout.compact && styles.cardSubCompact]} numberOfLines={1}>
                      {car.city} · {new Intl.NumberFormat('pl-PL').format(car.mileageKm)} km · {car.fuelType}
                      {car.exteriorColor ? ` · ${car.exteriorColor}` : ''}
                    </Text>
                    <Text style={[styles.cardPrice, cardLayout.compact && styles.cardPriceCompact]}>
                      {formatCarPrice(car.pricePln)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <CollapsibleMarketRails
            sections={marketRailSections}
            isDark={isDark}
            onPressItem={(id) => {
              const car =
                myCars.find((c) => c.id === Number(id)) || cars.find((c) => c.id === Number(id));
              if (car) openCarDetail(car);
            }}
            title={t('radar.home.galleryRailsStackTitle')}
            subtitle={t('radar.home.galleryRailsStackSubtitle')}
          />
        </ScrollView>
      ) : null}

      <View pointerEvents="box-none" style={[styles.topBarContainer, { top: topBarOffset }]}>
        <View style={[styles.topBarSideSlot, { width: 'auto', maxWidth: 112, flexDirection: 'row', gap: 10 }]}>
          {browseMode === 'MAP' ? (
            <Pressable
              style={({ pressed }) => [
                styles.filterButtonWrap,
                isGalleryLightChrome && styles.filterButtonWrapGalleryLight,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'));
              }}
              accessibilityLabel="Typ mapy"
            >
              <BlurView
                intensity={isDark ? 80 : 90}
                tint={isDark ? 'dark' : 'light'}
                style={styles.filterGlass}
              >
                <Ionicons name="map" size={22} color={isDark ? '#FFF' : '#1C1C1E'} />
              </BlurView>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.filterButtonWrap,
                isGalleryLightChrome && styles.filterButtonWrapGalleryLight,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'));
              }}
              accessibilityLabel="Typ mapy"
            >
              <BlurView
                intensity={isGalleryLightChrome ? 96 : isDark ? 80 : 90}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.filterGlass, isGalleryLightChrome && styles.filterGlassGalleryLight]}
              >
                <Ionicons name="map" size={22} color={isDark ? '#FFF' : '#1C1C1E'} />
              </BlurView>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.filterButtonWrap,
              isGalleryLightChrome && styles.filterButtonWrapGalleryLight,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowOnlyFavorites((prev) => !prev);
            }}
            accessibilityLabel="Ulubione"
            accessibilityState={{ selected: showOnlyFavorites }}
          >
            <BlurView
              intensity={isGalleryLightChrome ? 96 : isDark ? 80 : 90}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.filterGlass,
                isGalleryLightChrome && styles.filterGlassGalleryLight,
                showOnlyFavorites && { backgroundColor: 'rgba(247,119,178,0.22)' },
              ]}
            >
              <Ionicons
                name={showOnlyFavorites ? 'heart' : 'heart-outline'}
                size={22}
                color={showOnlyFavorites ? FAV_ACCENT : isDark ? '#FFF' : '#1C1C1E'}
              />
            </BlurView>
          </Pressable>
        </View>

        <View style={styles.topBarCenter}>{centerChrome}</View>

        <CatalogSearchFilterButton
          isDark={isDark}
          accent={CAR_ACCENT}
          label={t('radar.home.searchCtaLabel')}
          hint={t('radar.home.searchCtaHintCars')}
          active={hasAdvancedFiltersActive}
          lightChrome={isGalleryLightChrome}
          accessibilityLabel={t('radar.home.advancedSearch')}
          onPress={() => {
            setDraftAdvancedFilters(advancedFilters);
            setShowAdvancedSearch(true);
          }}
        />
      </View>

      {browseMode === 'MAP' && !loading && !error && mappableCount === 0 ? (
        <View pointerEvents="none" style={[styles.mapEmptyOverlay, { top: topBarOffset + 72 }]}>
          <Text style={styles.mapEmptyTitle}>Brak pinezek na mapie</Text>
          <Text style={styles.mapEmptyText}>
            Żadne z widocznych ogłoszeń nie ma zapisanego położenia. Dodaj lokalizację przy wystawianiu auta.
          </Text>
        </View>
      ) : null}

      {browseMode === 'MAP' && loading ? (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator color={colors.accentSoft} size="large" />
        </View>
      ) : null}

      {browseMode === 'MAP' && !loading ? (
        <View style={styles.mapOffersPreview} pointerEvents="box-none">
          <View style={styles.mapReasonRow} pointerEvents="box-none">
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.mapReasonPill,
                {
                  backgroundColor: isDark ? 'rgba(20,20,22,0.62)' : 'rgba(255,255,255,0.78)',
                  borderColor: `${mapReason.accent}${mapReason.empty ? '55' : '33'}`,
                  minHeight: mapReason.empty ? 64 : undefined,
                },
              ]}
            >
              <View style={[styles.mapReasonIconBubble, { backgroundColor: `${mapReason.accent}22` }]}>
                <Ionicons
                  name={mapReason.empty ? 'alert-circle' : nearbyModeEnabled ? 'navigate' : 'car-sport'}
                  size={14}
                  color={mapReason.accent}
                />
              </View>
              <View style={styles.mapReasonCopy}>
                <Text
                  numberOfLines={1}
                  style={[styles.mapReasonTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                >
                  {mapReason.title}
                </Text>
                <Text
                  numberOfLines={mapReason.empty ? 2 : 1}
                  ellipsizeMode="tail"
                  style={[
                    styles.mapReasonSubtitle,
                    { color: isDark ? 'rgba(255,255,255,0.66)' : 'rgba(15,23,42,0.62)' },
                  ]}
                >
                  {mapReason.subtitle}
                </Text>
              </View>
              {mapReason.actionLabel ? (
                <Pressable
                  onPress={() => {
                    if (nearbyModeEnabled) showAllMapPins();
                    else void enableNearbyMode();
                  }}
                  style={({ pressed }) => [
                    styles.mapReasonAction,
                    {
                      backgroundColor: `${mapReason.accent}1F`,
                      borderColor: `${mapReason.accent}55`,
                    },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <Text style={[styles.mapReasonActionText, { color: mapReason.accent }]}>
                    {mapReason.actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </BlurView>
          </View>

          {mapCars.length > 0 ? (
            <FlatList
              ref={mapListRef}
              data={mapCars}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={mapCardStride}
              snapToAlignment="start"
              disableIntervalMomentum
              decelerationRate="fast"
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomCardsInset }}
              getItemLayout={(_, index) => ({
                length: mapCardStride,
                offset: mapCardStride * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / mapCardStride);
                focusMapCarAtIndex(Math.max(0, Math.min(idx, mapCars.length - 1)));
              }}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  mapListRef.current?.scrollToIndex({ index: info.index, animated: true });
                }, 120);
              }}
              renderItem={({ item, index }) => {
                const selected = item.id === selectedMapCarId || index === activeMapIndex;
                return (
                  <Pressable
                    onPress={() => openMapCarDetail(item)}
                    style={[
                      styles.mapOfferCard,
                      {
                        width: mapCardWidth,
                        backgroundColor: isDark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.92)',
                        borderColor: selected
                          ? `${CAR_ACCENT}99`
                          : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <View style={styles.mapOfferImageWrap}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.mapOfferImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View
                          style={[
                            styles.mapOfferImage,
                            {
                              backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB',
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                          ]}
                        >
                          <Ionicons name="car-sport" size={22} color="#8E8E93" />
                        </View>
                      )}
                    </View>
                    <View style={styles.mapOfferInfo}>
                      <View style={styles.mapOfferTopRow}>
                        <Text
                          style={[styles.mapOfferPrice, { color: isDark ? '#FFF' : '#1C1C1E' }]}
                          numberOfLines={1}
                        >
                          {formatCarPrice(item.pricePln)}
                        </Text>
                        <CarFavoriteButton
                          carId={item.id}
                          size={20}
                          isLoggedIn={!!token}
                          onAuthRequired={() => setAuthGateOpen(true)}
                          onToggle={(_id, _added) => {
                            void loadCarFavoriteIds().then(setFavoriteIds);
                          }}
                        />
                      </View>
                      <Text style={styles.mapOfferTitle} numberOfLines={1}>
                        {item.title || `${item.make} ${item.model}`}
                      </Text>
                      <Text style={styles.mapOfferMeta} numberOfLines={1}>
                        {[item.year, item.city, item.mileageKm != null ? `${new Intl.NumberFormat('pl-PL').format(item.mileageKm)} km` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          ) : (
            <View style={{ paddingBottom: bottomCardsInset, height: 12 }} />
          )}
        </View>
      ) : null}

      <CarsAdvancedSearchModal
        visible={showAdvancedSearch}
        isDark={isDark}
        cars={cars}
        draft={draftAdvancedFilters}
        onChangeDraft={setDraftAdvancedFilters}
        onClose={() => setShowAdvancedSearch(false)}
        onReset={() => setDraftAdvancedFilters(EMPTY_CARS_ADVANCED_FILTERS)}
        onPickMapArea={() => {
          const withCoords = cars.filter(
            (c) => Number.isFinite(c.cityLat) && Number.isFinite(c.cityLng),
          );
          if (withCoords.length > 0) {
            const lat =
              withCoords.reduce((s, c) => s + Number(c.cityLat), 0) / withCoords.length;
            const lng =
              withCoords.reduce((s, c) => s + Number(c.cityLng), 0) / withCoords.length;
            setCarMapAreaDraft((prev) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              radiusKm: draftAdvancedFilters.mapBounds?.radiusKm || 25,
            }));
          }
          setShowAdvancedSearch(false);
          setShowCarMapAreaPicker(true);
        }}
        onApply={() => {
          setAdvancedFilters(draftAdvancedFilters);
          setShowAdvancedSearch(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <Modal
        visible={showCarMapAreaPicker}
        animationType="slide"
        onRequestClose={() => {
          setShowCarMapAreaPicker(false);
          setShowAdvancedSearch(true);
        }}
      >
        <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#F2F2F7' }}>
          <View
            style={{
              paddingTop: Math.max(insets.top, 12),
              paddingHorizontal: 16,
              paddingBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              onPress={() => {
                setShowCarMapAreaPicker(false);
                setShowAdvancedSearch(true);
              }}
            >
              <Text style={{ color: CAR_ACCENT, fontWeight: '700' }}>Anuluj</Text>
            </Pressable>
            <Text style={{ color: isDark ? '#FFF' : '#1C1C1E', fontWeight: '800' }}>
              Obszar na mapie
            </Text>
            <Pressable
              onPress={() => {
                setDraftAdvancedFilters((prev) => ({
                  ...prev,
                  city: '',
                  mapBounds: {
                    centerLat: carMapAreaDraft.latitude,
                    centerLng: carMapAreaDraft.longitude,
                    radiusKm: carMapAreaDraft.radiusKm,
                  },
                }));
                setShowCarMapAreaPicker(false);
                setShowAdvancedSearch(true);
                void Haptics.selectionAsync();
              }}
            >
              <Text style={{ color: CAR_ACCENT, fontWeight: '800' }}>Zapisz</Text>
            </Pressable>
          </View>
          <Text
            style={{
              paddingHorizontal: 16,
              marginBottom: 8,
              color: isDark ? 'rgba(255,255,255,0.65)' : '#64748B',
              fontSize: 12,
            }}
          >
            Przesuń mapę — środek ekranu to punkt wyszukiwania. Promień: {carMapAreaDraft.radiusKm} km.
          </Text>
          <View style={{ flex: 1 }}>
            <MapView
              style={StyleSheet.absoluteFill}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: carMapAreaDraft.latitude,
                longitude: carMapAreaDraft.longitude,
                latitudeDelta: 0.45,
                longitudeDelta: 0.45,
              }}
              onRegionChangeComplete={(region: Region) => {
                setCarMapAreaDraft((prev) => ({
                  ...prev,
                  latitude: region.latitude,
                  longitude: region.longitude,
                }));
              }}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
              <Circle
                center={{
                  latitude: carMapAreaDraft.latitude,
                  longitude: carMapAreaDraft.longitude,
                }}
                radius={carMapAreaDraft.radiusKm * 1000}
                strokeColor={CAR_ACCENT}
                fillColor="rgba(14,165,233,0.15)"
              />
            </MapView>
          </View>
          <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[15, 25, 50, 100].map((km) => (
                <Pressable
                  key={km}
                  onPress={() => setCarMapAreaDraft((prev) => ({ ...prev, radiusKm: km }))}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor:
                      carMapAreaDraft.radiusKm === km
                        ? 'rgba(14,165,233,0.2)'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.05)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor:
                      carMapAreaDraft.radiusKm === km ? CAR_ACCENT : 'rgba(142,142,147,0.35)',
                  }}
                >
                  <Text
                    style={{
                      color: carMapAreaDraft.radiusKm === km ? CAR_ACCENT : isDark ? '#FFF' : '#1C1C1E',
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {km} km
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <CarAuthGateModal
        visible={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onLoginPress={() => openAuthEntry('login')}
        onRegisterPress={() => openAuthEntry('register')}
      />
    </View>
  );
}

function createStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    topBarContainer: {
      position: 'absolute',
      left: 20,
      right: 20,
      zIndex: 20,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    topBarSideSlot: {
      width: 50,
      flexShrink: 0,
    },
    topBarCenter: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
      paddingHorizontal: 6,
      maxWidth: 320,
      alignSelf: 'center',
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
      borderWidth: 1,
      borderColor: '#FFF',
    },
    container: {
      minHeight: '100%',
      paddingHorizontal: 20,
      paddingBottom: 60,
      gap: 14,
    },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    lead: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 23,
    },
    filters: { gap: 10 },
    chips: { gap: 8, paddingVertical: 2 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipActive: {
      borderColor: colors.chipActiveBorder,
      backgroundColor: colors.chipActiveBg,
    },
    chipLabel: { color: colors.chipText, fontSize: 12, fontWeight: '600' },
    chipLabelActive: { color: colors.chipActiveText },
    viewToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    viewToggleLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    viewToggleGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    viewToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    viewToggleBtnActive: {
      borderColor: colors.chipActiveBorder,
      backgroundColor: colors.chipActiveBg,
    },
    viewToggleBtnLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    viewToggleBtnLabelActive: { color: colors.chipActiveText },
    centerBox: {
      marginTop: 24,
      alignItems: 'center',
      gap: 10,
    },
    muted: {
      color: colors.muted,
      fontSize: 14,
    },
    error: {
      color: '#FCA5A5',
      fontSize: 14,
      textAlign: 'center',
    },
    retryBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    retryLabel: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    list: {
      marginTop: 8,
      gap: 14,
    },
    listGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    card: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    cardPressed: {
      opacity: 0.92,
    },
    cardImageWrap: {
      position: 'relative',
    },
    cardImage: {
      width: '100%',
      backgroundColor: colors.inputBg,
    },
    cardFavWrap: {
      position: 'absolute',
      top: 10,
      right: 10,
    },
    cardFavWrapCompact: {
      top: 6,
      right: 6,
      transform: [{ scale: 0.9 }],
    },
    featuredChip: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: '#FBBF24',
    },
    featuredChipText: {
      color: '#000',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    cardBody: {
      padding: 14,
      gap: 4,
    },
    cardBodyCompact: {
      padding: 10,
      gap: 2,
    },
    cardMeta: {
      color: colors.accentSoft,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    cardMetaCompact: {
      fontSize: 8,
      letterSpacing: 1.1,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
    },
    cardTitleCompact: {
      fontSize: 14,
      lineHeight: 18,
    },
    cardSub: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    cardSubCompact: {
      fontSize: 11,
      lineHeight: 15,
    },
    cardPrice: {
      marginTop: 4,
      color: colors.accent,
      fontSize: 17,
      fontWeight: '800',
    },
    cardPriceCompact: {
      marginTop: 2,
      fontSize: 14,
    },
    mapEmptyOverlay: {
      position: 'absolute',
      left: 20,
      right: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.94)',
      padding: 16,
      gap: 6,
      zIndex: 10,
    },
    mapEmptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    mapEmptyText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    mapLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(242,242,247,0.55)',
      zIndex: 8,
    },
    mapOffersPreview: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
      elevation: 20,
    },
    mapReasonRow: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    mapReasonPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    mapReasonIconBubble: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapReasonCopy: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 10,
    },
    mapReasonTitle: {
      fontSize: 12.5,
      fontWeight: '800',
      letterSpacing: 0.1,
    },
    mapReasonSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 1,
    },
    mapReasonAction: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flexShrink: 0,
      marginLeft: 4,
    },
    mapReasonActionText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    mapOfferCard: {
      marginRight: 16,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      flexDirection: 'row',
      minHeight: 108,
    },
    mapOfferImageWrap: {
      width: 108,
      alignSelf: 'stretch',
    },
    mapOfferImage: {
      width: '100%',
      height: '100%',
      minHeight: 108,
    },
    mapOfferInfo: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: 'center',
      gap: 4,
    },
    mapOfferTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    mapOfferPrice: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    mapOfferTitle: {
      color: isDark ? 'rgba(255,255,255,0.88)' : '#334155',
      fontSize: 13,
      fontWeight: '600',
    },
    mapOfferMeta: {
      color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
      fontSize: 12,
      fontWeight: '500',
    },
  });
}
