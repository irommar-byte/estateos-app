import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { fetchCarsCatalog, formatCarPrice, type CarListing } from '../services/carsApi';
import CarFavoriteButton from '../components/cars/CarFavoriteButton';
import CarAuthGateModal from '../components/cars/CarAuthGateModal';
import CarsCatalogMapView from '../components/cars/CarsCatalogMapView';
import CarsAdvancedSearchModal from '../components/cars/CarsAdvancedSearchModal';
import RadarBrowseModeRail from '../components/radar/RadarBrowseModeRail';
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

const CAR_ACCENT = '#0EA5E9';

type ViewMode = 'list' | 'grid';
type BrowseMode = 'GALLERY' | 'MAP';

export default function CarsCatalogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, elevation, isDark } = useCarScreenTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isTabletLike = screenWidth >= 600;
  const [browseMode, setBrowseMode] = useState<BrowseMode>('GALLERY');
  const [viewMode, setViewMode] = useState<ViewMode>(isTabletLike ? 'grid' : 'list');
  const isGridView = viewMode === 'grid';
  const topBarOffset = Math.max(insets.top + 8, 52);
  const cardLayout = useMemo(() => {
    const horizontalPad = 40;
    const gap = 14;
    if (isGridView) {
      const cardWidth = (screenWidth - horizontalPad - gap) / 2;
      return { cardWidth, imageAspectRatio: 4 / 3, compact: true };
    }
    return { cardWidth: undefined as number | undefined, imageAspectRatio: 16 / 10, compact: false };
  }, [isGridView, screenWidth]);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const token = useAuthStore((s) => s.token);
  const [cars, setCars] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<CarsAdvancedFilters>(EMPTY_CARS_ADVANCED_FILTERS);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<CarsAdvancedFilters>(EMPTY_CARS_ADVANCED_FILTERS);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedMapCarId, setSelectedMapCarId] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [featuredSpotlightBottom, setFeaturedSpotlightBottom] = useState(420);
  const featuredSpotlightVisible = scrollY < Math.max(featuredSpotlightBottom - 72, 0);
  const isGalleryLightChrome = browseMode === 'GALLERY' && !isDark;
  const hasAdvancedFiltersActive = useMemo(() => carsAdvancedFiltersActive(advancedFilters), [advancedFilters]);

  const loadCars = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await fetchCarsCatalog();
      setCars(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Błąd ładowania katalogu aut.');
      setCars([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  const makes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.make).filter(Boolean))).sort(),
    [cars],
  );

  const filtered = useMemo(() => applyCarsAdvancedFilters(cars, advancedFilters), [cars, advancedFilters]);

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
    setSelectedMapCarId(car.id);
    openCarDetail(car);
  };

  const browseModeRail = (
    <RadarBrowseModeRail
      mode={browseMode === 'MAP' ? 'RADAR' : 'GALLERY'}
      isDark={isDark}
      embeddedInTopBar
      radarLabel="Mapa"
      galleryLabel="Galeria"
      onSelectRadar={() => setBrowseMode('MAP')}
      onSelectGallery={() => setBrowseMode('GALLERY')}
    />
  );

  return (
    <View style={styles.screen}>
      {browseMode === 'MAP' ? (
        <CarsCatalogMapView
          cars={filtered}
          selectedCarId={selectedMapCarId}
          onSelectCar={handleMapCarPress}
          isDark={isDark}
          mapType={mapType}
        />
      ) : null}

      {browseMode === 'GALLERY' ? (
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: topBarOffset + 58 }]}
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
            Jedno konto EstateOS — przełączaj się między nieruchomościami i autami bez ponownego logowania.
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

          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                onPress={() =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    make: '',
                    makeSlug: '',
                    model: '',
                    modelSlug: '',
                    generation: '',
                    generationSlug: '',
                  }))
                }
                style={[styles.chip, !advancedFilters.make && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, !advancedFilters.make && styles.chipLabelActive]}>Wszystkie</Text>
              </Pressable>
              {makes.map((make) => (
                <Pressable
                  key={make}
                  onPress={() =>
                    setAdvancedFilters((prev) => ({
                      ...prev,
                      make: prev.make === make ? '' : make,
                      makeSlug: '',
                      model: '',
                      modelSlug: '',
                      generation: '',
                      generationSlug: '',
                    }))
                  }
                  style={[styles.chip, advancedFilters.make === make && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, advancedFilters.make === make && styles.chipLabelActive]}>{make}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {!loading && !error && filtered.length > 0 ? (
            <View style={styles.viewToggleRow}>
              <Text style={styles.viewToggleLabel}>Widok</Text>
              <View style={styles.viewToggleGroup}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'list' }}
                  onPress={() => toggleViewMode('list')}
                  style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                >
                  <Ionicons
                    name={viewMode === 'list' ? 'list' : 'list-outline'}
                    size={16}
                    color={viewMode === 'list' ? colors.chipActiveText : colors.muted}
                  />
                  <Text style={[styles.viewToggleBtnLabel, viewMode === 'list' && styles.viewToggleBtnLabelActive]}>
                    Lista
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'grid' }}
                  onPress={() => toggleViewMode('grid')}
                  style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                >
                  <Ionicons
                    name={viewMode === 'grid' ? 'grid' : 'grid-outline'}
                    size={16}
                    color={viewMode === 'grid' ? colors.chipActiveText : colors.muted}
                  />
                  <Text style={[styles.viewToggleBtnLabel, viewMode === 'grid' && styles.viewToggleBtnLabelActive]}>
                    Siatka
                  </Text>
                </Pressable>
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
            <View style={[styles.list, isGridView && styles.listGrid]}>
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
        </ScrollView>
      ) : null}

      <View pointerEvents="box-none" style={[styles.topBarContainer, { top: topBarOffset }]}>
        {browseMode === 'MAP' ? (
          <Pressable
            style={({ pressed }) => [
              styles.topBarSideSlot,
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
          <View style={styles.topBarSideSlot} />
        )}

        <View style={styles.topBarCenter}>{browseModeRail}</View>

        <Pressable
          style={({ pressed }) => [
            styles.topBarSideSlot,
            styles.filterButtonWrap,
            isGalleryLightChrome && styles.filterButtonWrapGalleryLight,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDraftAdvancedFilters(advancedFilters);
            setShowAdvancedSearch(true);
          }}
          accessibilityLabel="Wyszukiwanie rozszerzone"
        >
          <BlurView
            intensity={isGalleryLightChrome ? 96 : isDark ? 80 : 90}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.filterGlass, isGalleryLightChrome && styles.filterGlassGalleryLight]}
          >
            <Ionicons name="search" size={22} color={isDark ? '#FFF' : '#1C1C1E'} />
            {hasAdvancedFiltersActive ? (
              <View style={[styles.filterActiveDot, { backgroundColor: CAR_ACCENT }]} />
            ) : null}
          </BlurView>
        </Pressable>
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

      <CarsAdvancedSearchModal
        visible={showAdvancedSearch}
        isDark={isDark}
        cars={cars}
        draft={draftAdvancedFilters}
        onChangeDraft={setDraftAdvancedFilters}
        onClose={() => setShowAdvancedSearch(false)}
        onReset={() => setDraftAdvancedFilters(EMPTY_CARS_ADVANCED_FILTERS)}
        onApply={() => {
          setAdvancedFilters(draftAdvancedFilters);
          setShowAdvancedSearch(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

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
  });
}
