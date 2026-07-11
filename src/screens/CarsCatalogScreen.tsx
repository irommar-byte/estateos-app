import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { fetchCarsCatalog, fetchMyCars, formatCarPrice, type CarListing } from '../services/carsApi';
import CarFavoriteButton from '../components/cars/CarFavoriteButton';
import CarAuthGateModal from '../components/cars/CarAuthGateModal';
import { isCarFavoriteId, loadCarFavoriteIds } from '../utils/carFavoritesStorage';
import * as Haptics from 'expo-haptics';
import { useCarScreenTheme, type CarScreenColors } from '../theme/carScreenTheme';

type Tab = 'catalog' | 'mine' | 'favorites';
type ViewMode = 'list' | 'grid';

export default function CarsCatalogScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, elevation } = useCarScreenTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isTabletLike = screenWidth >= 600;
  const [viewMode, setViewMode] = useState<ViewMode>(isTabletLike ? 'grid' : 'list');
  const isGridView = viewMode === 'grid';
  const cardLayout = useMemo(() => {
    const horizontalPad = 40;
    const gap = 14;
    if (isGridView) {
      const cardWidth = (screenWidth - horizontalPad - gap) / 2;
      return { cardWidth, imageAspectRatio: 4 / 3, compact: true };
    }
    return { cardWidth: undefined as number | undefined, imageAspectRatio: 16 / 10, compact: false };
  }, [isGridView, screenWidth]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('catalog');
  const [cars, setCars] = useState<CarListing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [authGateOpen, setAuthGateOpen] = useState(false);

  const loadFavorites = useCallback(async () => {
    const ids = await loadCarFavoriteIds();
    setFavoriteIds(ids);
    return ids;
  }, []);

  const loadCars = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const favIds = await loadFavorites();
        const rows =
          tab === 'mine' && token ? await fetchMyCars(token) : await fetchCarsCatalog();
        setCars(tab === 'favorites' ? rows.filter((car) => isCarFavoriteId(car.id, favIds)) : rows);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Błąd ładowania katalogu aut.');
        setCars([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, token, loadFavorites],
  );

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  const makes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.make).filter(Boolean))).sort(),
    [cars],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cars.filter((car) => {
      if (tab === 'favorites' && !isCarFavoriteId(car.id, favoriteIds)) return false;
      if (makeFilter && car.make !== makeFilter) return false;
      if (!q) return true;
      const haystack = [car.title, car.make, car.model, car.city, car.fuelType].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [cars, query, makeFilter, tab, favoriteIds]);

  const openAdd = () => {
    if (!user || !token) {
      setAuthGateOpen(true);
      return;
    }
    navigation.navigate('AddCarListing', { mode: 'create' });
  };

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

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 70, 110) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCars(true)} tintColor={colors.accentSoft} />}
    >
      <Text style={styles.eyebrow}>EstateOS™Car</Text>
      <Text style={styles.title}>Katalog samochodów</Text>
      <Text style={styles.lead}>
        Jedno konto EstateOS — przełączaj się między nieruchomościami i autami bez ponownego logowania.
      </Text>

      <View style={styles.actionsRow}>
        <Pressable onPress={openAdd} style={styles.addBtn}>
          <Text style={styles.addBtnLabel}>+ Dodaj auto</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('catalog')} style={[styles.tab, tab === 'catalog' && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === 'catalog' && styles.tabLabelActive]}>Katalog</Text>
        </Pressable>
        <Pressable onPress={() => setTab('favorites')} style={[styles.tab, tab === 'favorites' && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === 'favorites' && styles.tabLabelActive]}>Ulubione</Text>
        </Pressable>
        <Pressable onPress={() => setTab('mine')} style={[styles.tab, tab === 'mine' && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === 'mine' && styles.tabLabelActive]}>Moje auta</Text>
        </Pressable>
      </View>

      {tab === 'catalog' || tab === 'favorites' ? (
        <View style={styles.filters}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj marki, modelu, miasta..."
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
          />
          {tab === 'catalog' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                onPress={() => setMakeFilter('')}
                style={[styles.chip, !makeFilter && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, !makeFilter && styles.chipLabelActive]}>Wszystkie</Text>
              </Pressable>
              {makes.map((make) => (
                <Pressable
                  key={make}
                  onPress={() => setMakeFilter(make)}
                  style={[styles.chip, makeFilter === make && styles.chipActive]}
                >
                  <Text style={[styles.chipLabel, makeFilter === make && styles.chipLabelActive]}>{make}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

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
      ) : tab === 'mine' && !token ? (
        <Text style={styles.muted}>Zaloguj się, aby zobaczyć swoje ogłoszenia aut.</Text>
      ) : tab === 'favorites' && favoriteIds.length === 0 ? (
        <Text style={styles.muted}>Nie masz jeszcze ulubionych aut. Kliknij serduszko na ogłoszeniu.</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.muted}>
          {tab === 'mine'
            ? 'Nie masz jeszcze ogłoszeń samochodowych.'
            : tab === 'favorites'
              ? 'Brak ulubionych aut pasujących do wyszukiwania.'
              : 'Brak ogłoszeń samochodowych.'}
        </Text>
      ) : (
        <View style={[styles.list, isGridView && styles.listGrid]}>
          {filtered.map((car) => (
            <Pressable
              key={car.id}
              onPress={() => navigation.navigate('CarDetail', { carId: car.id, car })}
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
                    onToggle={async () => {
                      const ids = await loadFavorites();
                      if (tab === 'favorites') {
                        setCars((prev) => prev.filter((car) => isCarFavoriteId(car.id, ids)));
                      }
                    }}
                  />
                </View>
              </View>
              <View style={[styles.cardBody, cardLayout.compact && styles.cardBodyCompact]}>
                <Text style={[styles.cardMeta, cardLayout.compact && styles.cardMetaCompact]} numberOfLines={1}>
                  {car.make} · {car.model} · {car.year}
                </Text>
                <Text
                  style={[styles.cardTitle, cardLayout.compact && styles.cardTitleCompact]}
                  numberOfLines={cardLayout.compact ? 2 : 2}
                >
                  {car.title}
                </Text>
                <Text style={[styles.cardSub, cardLayout.compact && styles.cardSubCompact]} numberOfLines={1}>
                  {car.city} · {new Intl.NumberFormat('pl-PL').format(car.mileageKm)} km · {car.fuelType}
                </Text>
                <Text style={[styles.cardPrice, cardLayout.compact && styles.cardPriceCompact]}>
                  {formatCarPrice(car.pricePln)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <CarAuthGateModal
        visible={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onLoginPress={() => openAuthEntry('login')}
        onRegisterPress={() => openAuthEntry('register')}
      />
    </ScrollView>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    container: {
      minHeight: '100%',
      paddingHorizontal: 20,
      paddingBottom: 60,
      backgroundColor: colors.bg,
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
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    addBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    addBtnLabel: {
      color: colors.primaryButtonText,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    tab: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    tabActive: {
      borderColor: colors.chipActiveBorder,
      backgroundColor: colors.chipActiveBg,
    },
    tabLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    tabLabelActive: { color: colors.chipActiveText },
    filters: { gap: 10 },
    searchInput: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
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
  });
}
