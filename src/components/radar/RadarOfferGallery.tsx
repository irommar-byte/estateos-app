import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { useI18n } from '../../i18n';
import type { AppLocale } from '../../i18n';
import { isFavoriteId } from '../../utils/favoritesStorage';
import { resolveOfferPriceDiscount } from '../../utils/offerPriceDiscount';
import { isOfferFeatured } from '../../utils/listingPromotion';
import FeaturedOfferSpotlight from './FeaturedOfferSpotlight';
import type { CatalogRailDensity, CatalogRailItem } from '../catalog/CatalogHorizontalRail';
import {
  CatalogHorizontalRailStack,
  CatalogRailDensityToggle,
} from '../catalog/CatalogHorizontalRail';
import { buildHomeMarketRailSections } from '../catalog/buildMarketRails';
import type { MarketCatalogContentMode } from '../catalog/MarketCatalogViewToggle';
import ApplePressable from '../ApplePressable';
import MarketUnreadQuickReplyBubble from '../messaging/MarketUnreadQuickReplyBubble';
import { carCardElevation, useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';
import { formatLocationLabel } from '../../constants/locationEcosystem';

export type GalleryViewMode = 'cover' | 'list' | 'grid';

export type GalleryTransactionFilter = 'ALL' | 'RENT' | 'SELL';
export type GalleryCountryFilter = 'ALL' | 'PL' | 'ABROAD';
export type GalleryPropertyFilter = 'ALL' | 'FLAT' | 'HOUSE' | 'PLOT' | 'PREMISES';
export type GallerySortFilter = 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'AREA_DESC' | 'NEAREST';

export type GalleryOffer = {
  id: number | string;
  price: string;
  type: string;
  area: string;
  rooms: string;
  lat: number;
  lng: number;
  image: string | null;
  raw: Record<string, unknown>;
};

type UserLocation = { latitude: number; longitude: number } | null;

const GALLERY_PAGE_SIZE = 20;

type Props = {
  offers: GalleryOffer[];
  /** Wyróżnione z pełnego katalogu (filtry galerii, bez wyszukiwania/radaru/wykluczenia własnych). */
  featuredOffers?: GalleryOffer[];
  isDark: boolean;
  bottomInset: number;
  favorites: number[];
  transactionFilter: GalleryTransactionFilter;
  countryFilter: GalleryCountryFilter;
  propertyFilter: GalleryPropertyFilter;
  sortFilter: GallerySortFilter;
  hasActiveFilters: boolean;
  userLocation: UserLocation;
  locale: AppLocale;
  onTransactionFilterChange: (v: GalleryTransactionFilter) => void;
  onCountryFilterChange: (v: GalleryCountryFilter) => void;
  onPropertyFilterChange: (v: GalleryPropertyFilter) => void;
  onSortFilterChange: (v: GallerySortFilter) => void;
  onClearFilters: () => void;
  onPressOffer: (offer: GalleryOffer) => void;
  onToggleFavorite: (offerId: number) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  loadError?: string;
  formatPrice: (raw: Record<string, unknown>) => { primary: string };
  formatPublishDate: (raw: Record<string, unknown>) => string;
  isOfferVerified: (offerId: number | string, raw: Record<string, unknown>) => boolean;
  t: ReturnType<typeof useI18n>['t'];
  favoriteRailItems?: CatalogRailItem[];
  mineRailItems?: CatalogRailItem[];
  onPressRailItem?: (id: number | string) => void;
  /** Katalog siatki vs taśmy Market (przełączane ikoną w top barze). */
  contentMode?: MarketCatalogContentMode;
};

const NEAR_ACCENT = '#10b981';
const GALLERY_ACCENT = '#6366F1';
const ABROAD_COLOR = '#F59E0B';

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function formatApproxKm(km: number, locale: AppLocale): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  const value =
    km < 1 ? Math.max(0.1, Math.round(km * 10) / 10) : km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return value.toLocaleString(locale === 'pl' ? 'pl-PL' : locale === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: km < 10 ? 1 : 0,
    minimumFractionDigits: 0,
  });
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateFilterChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function offerCountryCode(raw: Record<string, unknown>): string {
  const code = String(raw?.localityCountryCode || 'PL')
    .trim()
    .toUpperCase()
    .replace(/^COUNTRY:/, '');
  return code || 'PL';
}

function offerCountryLabel(raw: Record<string, unknown>): string {
  const explicit = String(raw?.localityCountry || '').trim();
  if (explicit) return explicit;
  const code = offerCountryCode(raw);
  if (code === 'PL') return 'Polska';
  if (code === 'JP') return 'Japonia';
  if (code === 'DE') return 'Niemcy';
  return code;
}

function MiniChip({
  label,
  icon,
  active,
  accent,
  isDark,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  accent: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <ApplePressable
      onPress={onPress}
      haptic="selection"
      pressScale={0.96}
      style={[
        styles.miniChip,
        {
          backgroundColor: active
            ? `${accent}${isDark ? '38' : '24'}`
            : isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(0,0,0,0.04)',
          borderColor: active ? `${accent}99` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={12} color={active ? accent : isDark ? '#A1A1AA' : '#64748B'} />
      ) : null}
      <Text
        style={[styles.miniChipLabel, { color: active ? accent : isDark ? '#D4D4D8' : '#475569' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </ApplePressable>
  );
}

export default function RadarOfferGallery({
  offers,
  featuredOffers: featuredOffersProp,
  isDark,
  bottomInset,
  favorites,
  transactionFilter,
  countryFilter,
  propertyFilter,
  sortFilter,
  hasActiveFilters,
  userLocation,
  locale,
  onTransactionFilterChange,
  onCountryFilterChange,
  onPropertyFilterChange,
  onSortFilterChange,
  onClearFilters,
  onPressOffer,
  onToggleFavorite,
  refreshing = false,
  onRefresh,
  loadError,
  formatPrice,
  formatPublishDate,
  isOfferVerified,
  t,
  favoriteRailItems = [],
  mineRailItems = [],
  onPressRailItem,
  contentMode = 'catalog',
}: Props) {
  const { width } = useWindowDimensions();
  const { colors, elevation, isDark: _carIsDark } = useCarScreenTheme();
  const listRef = useRef<FlatList<GalleryOffer>>(null);
  const [scrollY, setScrollY] = useState(0);
  const [featuredSpotlightBottom, setFeaturedSpotlightBottom] = useState(420);
  const featuredSpotlightVisible = scrollY < Math.max(featuredSpotlightBottom - 72, 0);
  const isTabletLike = width >= 600;
  const [viewMode, setViewMode] = useState<GalleryViewMode>(isTabletLike ? 'grid' : 'cover');
  const [railDensity, setRailDensity] = useState<CatalogRailDensity>('comfortable');
  const [page, setPage] = useState(1);
  const gap = 14;
  const horizontalPad = 20;
  /** Cover = dawna Lista (duże karty). Lista = 2× więcej (mniejsze). Siatka = siatka. */
  const isCoverView = viewMode === 'cover';
  const isListView = viewMode === 'list';
  const isGridView = viewMode === 'grid';
  const isMultiCol = isListView || isGridView;
  const numColumns = isListView ? 2 : isGridView ? (width >= 900 ? 3 : 2) : 1;
  const cardWidth = isMultiCol
    ? (width - horizontalPad * 2 - gap * (numColumns - 1)) / numColumns
    : width - horizontalPad * 2;
  const imageAspectRatio = isCoverView ? 16 / 10 : isListView ? 5 / 4 : 4 / 3;
  const catalogStyles = useMemo(() => createCatalogStyles(colors, isDark), [colors, isDark]);

  const wrapFilterChange = useCallback(<T,>(fn: (v: T) => void, value: T) => {
    animateFilterChange();
    fn(value);
  }, []);

  const sortOptions = useMemo(
    () =>
      [
        { key: 'NEAREST' as const, label: t('radar.home.gallerySortNearest'), icon: 'navigate-outline' as const, accent: NEAR_ACCENT },
        { key: 'NEWEST' as const, label: t('radar.home.gallerySortNewest'), icon: 'time-outline' as const, accent: GALLERY_ACCENT },
        { key: 'PRICE_ASC' as const, label: t('radar.home.gallerySortPriceAsc'), icon: 'arrow-up-outline' as const, accent: GALLERY_ACCENT },
        { key: 'PRICE_DESC' as const, label: t('radar.home.gallerySortPriceDesc'), icon: 'arrow-down-outline' as const, accent: GALLERY_ACCENT },
        { key: 'AREA_DESC' as const, label: t('radar.home.gallerySortArea'), icon: 'resize-outline' as const, accent: GALLERY_ACCENT },
      ] as const,
    [t],
  );


  /** Stały page size — zmiana widoku nie przeładowuje listy. */
  const pageSize = GALLERY_PAGE_SIZE;
  const filtersKey = `${transactionFilter}-${countryFilter}-${propertyFilter}-${sortFilter}`;
  const totalCount = offers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const featuredOffers = useMemo(() => {
    const pool = featuredOffersProp ?? offers;
    return pool
      .filter((item) => isOfferFeatured(item.raw))
      .sort(
        (a, b) =>
          Date.parse(String(b.raw?.promotedUntil || b.raw?.createdAt || 0)) -
          Date.parse(String(a.raw?.promotedUntil || a.raw?.createdAt || 0)),
      );
  }, [featuredOffersProp, offers]);

  const marketRailSections = useMemo(() => {
    const toHome = (item: GalleryOffer | CatalogRailItem & { raw?: Record<string, unknown>; lat?: number; lng?: number }) => {
      if ('raw' in item && item.raw) {
        const g = item as GalleryOffer;
        return {
          id: g.id,
          lat: g.lat,
          lng: g.lng,
          title: String(g.raw?.title || g.type || 'Oferta'),
          subtitle: [g.area, g.rooms].filter(Boolean).join(' · ') || undefined,
          imageUrl: g.image,
          priceLabel: formatPrice(g.raw).primary,
          raw: g.raw,
        };
      }
      const r = item as CatalogRailItem;
      return {
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        imageUrl: r.imageUrl,
        priceLabel: r.priceLabel,
        raw: {},
      };
    };

    const favFromIds = new Set(favoriteRailItems.map((x) => String(x.id)));
    const favorites = [
      ...favoriteRailItems.map((item) => {
        const full = offers.find((o) => String(o.id) === String(item.id));
        return full
          ? toHome(full)
          : {
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              imageUrl: item.imageUrl,
              priceLabel: item.priceLabel,
              raw: {},
            };
      }),
    ];
    const mine = mineRailItems.map((item) => {
      const full = offers.find((o) => String(o.id) === String(item.id));
      return full
        ? toHome(full)
        : {
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            imageUrl: item.imageUrl,
            priceLabel: item.priceLabel,
            raw: {},
          };
    });
    const catalog = offers.map(toHome);
    void favFromIds;

    return buildHomeMarketRailSections({
      favorites,
      mine,
      catalog,
      userLocation,
      labels: {
        favorites: t('radar.home.galleryRailFavorites'),
        mine: t('radar.home.galleryRailMine'),
        newest: t('radar.home.galleryRailNewest'),
        nearest: t('radar.home.galleryRailNearest'),
        discounted: t('radar.home.galleryRailDiscounted'),
        flats: t('radar.home.galleryRailFlats'),
        houses: t('radar.home.galleryRailHouses'),
        plots: t('radar.home.galleryRailPlots'),
        commercial: t('radar.home.galleryRailCommercial'),
        favoritesEmpty: t('radar.home.galleryRailFavoritesEmpty'),
        mineEmpty: t('radar.home.galleryRailMineEmpty'),
      },
    });
  }, [offers, favoriteRailItems, mineRailItems, userLocation, formatPrice, t]);

  useEffect(() => {
    setPage(1);
  }, [filtersKey, totalCount]);

  const paginatedOffers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return offers.slice(start, start + pageSize);
  }, [offers, safePage, pageSize]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) return;
      Haptics.selectionAsync();
      animateFilterChange();
      setPage(nextPage);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    },
    [safePage, totalPages],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={[catalogStyles.sectionHead, { paddingHorizontal: horizontalPad }]}>
          <Text style={catalogStyles.eyebrow}>{t('radar.home.galleryEyebrow')}</Text>
          <Text style={catalogStyles.sectionTitle}>{t('radar.home.galleryCatalogTitle')}</Text>
          <Text style={catalogStyles.countLine}>
            {t('radar.home.galleryResults', { count: String(offers.length) })}
          </Text>
        </View>

        {featuredOffers.length > 0 ? (
          <View
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              setFeaturedSpotlightBottom(y + height);
            }}
          >
            <FeaturedOfferSpotlight
              offers={featuredOffers}
              isDark={isDark}
              title={t('radar.home.galleryFeaturedSectionTitle')}
              lead={t('radar.home.galleryFeaturedLead')}
              badgeLabel={t('radar.home.galleryFeaturedBadge')}
              formatPrice={formatPrice}
              onPressOffer={onPressOffer}
              autoRotateEnabled={featuredSpotlightVisible}
            />
          </View>
        ) : null}

        <View style={[catalogStyles.viewToggleRow, { paddingHorizontal: horizontalPad, marginBottom: 4 }]}>
          <Text style={catalogStyles.viewToggleLabel}>{t('radar.home.galleryViewLabel')}</Text>
          <View style={catalogStyles.viewToggleGroup}>
            {(
              [
                { key: 'cover' as const, label: t('radar.home.galleryViewCover'), iconOn: 'tablet-landscape', iconOff: 'tablet-landscape-outline' },
                { key: 'list' as const, label: t('radar.home.galleryViewList'), iconOn: 'list', iconOff: 'list-outline' },
                { key: 'grid' as const, label: t('radar.home.galleryViewGrid'), iconOn: 'grid', iconOff: 'grid-outline' },
              ] as const
            ).map((mode) => {
              const selected = viewMode === mode.key;
              return (
                <ApplePressable
                  key={mode.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  haptic="selection"
                  pressScale={0.96}
                  onPress={() => {
                    if (selected) return;
                    setViewMode(mode.key);
                  }}
                  style={[catalogStyles.viewToggleBtn, selected && catalogStyles.viewToggleBtnActive]}
                >
                  <Ionicons
                    name={(selected ? mode.iconOn : mode.iconOff) as any}
                    size={16}
                    color={selected ? colors.chipActiveText : colors.muted}
                  />
                  <Text
                    style={[
                      catalogStyles.viewToggleBtnLabel,
                      selected && catalogStyles.viewToggleBtnLabelActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </ApplePressable>
              );
            })}
          </View>
        </View>

        {hasActiveFilters ? (
          <View style={[styles.countRow, { paddingHorizontal: horizontalPad, justifyContent: 'flex-end' }]}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                animateFilterChange();
                onClearFilters();
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.clearLink, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close-circle-outline" size={14} color="#FF3B30" />
              <Text style={styles.clearLinkText}>{t('radar.home.galleryClearFilters')}</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {sortOptions.map((opt) => (
            <MiniChip
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              active={sortFilter === opt.key}
              accent={opt.accent}
              isDark={isDark}
              onPress={() => wrapFilterChange(onSortFilterChange, opt.key)}
            />
          ))}
        </ScrollView>
        {userLocation ? (
          <View style={[styles.distanceHintRow, !isDark && styles.distanceHintRowLight]}>
            <Ionicons name="locate" size={12} color={NEAR_ACCENT} />
            <Text style={[styles.distanceHintText, { color: isDark ? 'rgba(201,249,231,0.72)' : '#475569' }]}>
              {t('radar.home.galleryDistanceHint')}
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [
      featuredOffers,
      featuredSpotlightVisible,
      hasActiveFilters,
      isDark,
      offers.length,
      onClearFilters,
      onPressOffer,
      onSortFilterChange,
      sortFilter,
      sortOptions,
      t,
      userLocation,
      viewMode,
      formatPrice,
      catalogStyles,
      colors,
      horizontalPad,
      wrapFilterChange,
    ],
  );

  const renderItem = ({ item, index }: { item: GalleryOffer; index: number }) => {
    const tx = String(item.raw?.transactionType || '').toUpperCase();
    const txLabel =
      tx === 'RENT' ? t('radar.home.transactionRentShort') : t('radar.home.transactionSellShort');
    const typeOnly = String(item.type || '').split('•')[0].trim();
    const cityLine = [typeOnly, formatLocationLabel(item.raw?.city, item.raw?.district, '')]
      .filter(Boolean)
      .join(' · ');
    const fav = isFavoriteId(item.id, favorites);
    const priceLabel = formatPrice(item.raw).primary;
    const priceDiscount = resolveOfferPriceDiscount(item.raw);
    const verified = isOfferVerified(item.id, item.raw);
    const publishLabel = formatPublishDate(item.raw);
    const featured = isOfferFeatured(item.raw);
    const isLeftColumn = isMultiCol ? index % numColumns !== numColumns - 1 : true;
    const distanceKmValue =
      userLocation && Number.isFinite(item.lat) && Number.isFinite(item.lng)
        ? haversineKm(userLocation.latitude, userLocation.longitude, item.lat, item.lng)
        : null;

    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPressOffer(item);
        }}
        style={({ pressed }) => [
          catalogStyles.card,
          elevation.card,
          {
            width: cardWidth,
            marginRight: isMultiCol && isLeftColumn ? gap : 0,
            marginBottom: gap,
            alignSelf: isMultiCol ? undefined : 'center',
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        <View style={catalogStyles.cardImageWrap}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={[catalogStyles.cardImage, { aspectRatio: imageAspectRatio }]}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[catalogStyles.cardImage, catalogStyles.cardImageFallback, { aspectRatio: imageAspectRatio }]}>
              <Ionicons name="home-outline" size={28} color={colors.muted} />
            </View>
          )}
          <View style={[catalogStyles.txChip, tx === 'RENT' ? catalogStyles.txChipRent : catalogStyles.txChipSell]}>
            <Text style={catalogStyles.txChipText}>{txLabel.toUpperCase()}</Text>
          </View>
          {featured ? (
            <View style={catalogStyles.featuredChip}>
              <Ionicons name="sparkles" size={9} color="#000" />
              <Text style={catalogStyles.featuredChipText}>{t('radar.home.galleryFeaturedBadge')}</Text>
            </View>
          ) : null}
          {verified ? (
            <View style={catalogStyles.verifiedChip}>
              <Ionicons name="shield-checkmark" size={11} color="#34D399" />
            </View>
          ) : null}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleFavorite(Number(item.id));
            }}
            hitSlop={10}
            style={catalogStyles.favBtn}
          >
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? '#FF3B30' : '#FFF'} />
          </Pressable>
        </View>
        <View style={[catalogStyles.cardBody, isGridView && catalogStyles.cardBodyCompact]}>
          <Text style={catalogStyles.cardMeta} numberOfLines={1}>
            {cityLine}
          </Text>
          <Text style={catalogStyles.cardTitle} numberOfLines={isGridView ? 2 : 2}>
            {String(item.raw?.title || t('radar.home.locationFallback'))}
          </Text>
          <Text style={catalogStyles.cardSub} numberOfLines={1}>
            {[item.area, item.rooms].filter(Boolean).join(' · ')}
            {distanceKmValue != null
              ? ` · ~${formatApproxKm(distanceKmValue, locale)} km`
              : ''}
          </Text>
          <View style={catalogStyles.priceRow}>
            <Text style={catalogStyles.cardPrice}>{priceLabel}</Text>
            {priceDiscount.isDiscounted ? (
              <View style={catalogStyles.discountChip}>
                <Text style={catalogStyles.discountChipText}>−{priceDiscount.discountPercent}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={catalogStyles.cardFooter} numberOfLines={1}>
            ID {item.id} · {publishLabel.replace(/^[^:]+:\s*/, '')}
          </Text>
        </View>
      </Pressable>
    );
  };

  const listFooter = useMemo(() => {
    const pageStart = (safePage - 1) * pageSize + 1;
    const pageEnd = Math.min(safePage * pageSize, totalCount);
    const showPagination = totalCount > 0 && totalPages > 1;

    return (
      <View>
        {showPagination ? (
          <View style={styles.paginationBlock}>
            <Text style={[styles.paginationRangeText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
              {t('radar.home.galleryPageRange', {
                from: String(pageStart),
                to: String(pageEnd),
                total: String(totalCount),
              })}
            </Text>
            <View style={styles.paginationRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('radar.home.galleryPagePrev')}
                disabled={safePage <= 1}
                onPress={() => goToPage(safePage - 1)}
                style={({ pressed }) => [
                  styles.paginationArrow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    opacity: safePage <= 1 ? 0.35 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={isDark ? '#E5E7EB' : '#374151'} />
              </Pressable>

              <View style={styles.paginationPages}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const active = pageNum === safePage;
                  return (
                    <Pressable
                      key={pageNum}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t('radar.home.galleryPageGo', { page: String(pageNum) })}
                      onPress={() => goToPage(pageNum)}
                      style={({ pressed }) => [
                        styles.paginationPageChip,
                        {
                          backgroundColor: active
                            ? `${GALLERY_ACCENT}${isDark ? '40' : '28'}`
                            : isDark
                              ? 'rgba(255,255,255,0.07)'
                              : 'rgba(0,0,0,0.04)',
                          borderColor: active
                            ? `${GALLERY_ACCENT}99`
                            : isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.06)',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.paginationPageChipText,
                          { color: active ? GALLERY_ACCENT : isDark ? '#D4D4D8' : '#475569' },
                        ]}
                      >
                        {pageNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('radar.home.galleryPageNext')}
                disabled={safePage >= totalPages}
                onPress={() => goToPage(safePage + 1)}
                style={({ pressed }) => [
                  styles.paginationArrow,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    opacity: safePage >= totalPages ? 0.35 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#E5E7EB' : '#374151'} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }, [
    goToPage,
    isDark,
    pageSize,
    safePage,
    t,
    totalCount,
    totalPages,
  ]);

  if (contentMode === 'rails' && onPressRailItem) {
    const visibleRails = marketRailSections.filter(
      (s) => s.items.length > 0 || (s.showWhenEmpty && s.emptyLabel),
    );
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingBottom: bottomInset + 88,
          paddingTop: 8,
          paddingHorizontal: 10,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GALLERY_ACCENT} />
          ) : undefined
        }
      >
        <View style={[styles.railsHero, { borderColor: isDark ? 'rgba(99,102,241,0.38)' : 'rgba(99,102,241,0.22)' }]}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(99,102,241,0.28)', 'rgba(15,23,42,0.55)', 'rgba(15,23,42,0.2)']
                : ['rgba(99,102,241,0.18)', 'rgba(255,255,255,0.95)', 'rgba(238,242,255,0.9)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.railsHeroSheen} />
          <View style={[styles.railsIconBubble, { backgroundColor: isDark ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.16)' }]}>
            <Ionicons name="albums" size={18} color={GALLERY_ACCENT} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.railsEyebrow}>EstateOS™ Market</Text>
            <Text style={[styles.railsTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
              {t('radar.home.galleryRailsStackTitle')}
            </Text>
            <Text style={styles.railsSub} numberOfLines={2}>
              {t('radar.home.galleryRailsViewLead')}
            </Text>
          </View>
          <View style={styles.railsHeroActions}>
            <CatalogRailDensityToggle
              value={railDensity}
              onChange={setRailDensity}
              isDark={isDark}
              accent={GALLERY_ACCENT}
            />
            <MarketUnreadQuickReplyBubble isDark={isDark} accent={GALLERY_ACCENT} />
          </View>
        </View>
        {visibleRails.length ? (
          <CatalogHorizontalRailStack
            sections={marketRailSections}
            isDark={isDark}
            density={railDensity}
            onPressItem={onPressRailItem}
          />
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="albums-outline" size={40} color={isDark ? '#6366F1' : '#94A3B8'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
              {t('radar.home.galleryRailsEmptyTitle')}
            </Text>
            <Text style={[styles.emptyBody, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
              {t('radar.home.galleryRailsEmptyBody')}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={styles.root}
      data={paginatedOffers}
      keyExtractor={(item) => String(item.id)}
      numColumns={numColumns}
      key={`gallery-cols-${numColumns}`}
      extraData={`${viewMode}-${cardWidth}-${imageAspectRatio}`}
      columnWrapperStyle={
        isMultiCol ? [catalogStyles.columnWrap, { paddingHorizontal: horizontalPad }] : undefined
      }
      contentContainerStyle={{
        paddingBottom: bottomInset + 88,
        paddingTop: 4,
        flexGrow: paginatedOffers.length === 0 ? 1 : undefined,
      }}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GALLERY_ACCENT} />
        ) : undefined
      }
      initialNumToRender={12}
      maxToRenderPerBatch={16}
      windowSize={10}
      removeClippedSubviews={false}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="images-outline" size={40} color={isDark ? '#6366F1' : '#94A3B8'} />
          <Text style={[styles.emptyTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
            {t('radar.home.galleryEmptyTitle')}
          </Text>
          <Text style={[styles.emptyBody, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
            {loadError || t('radar.home.galleryEmptyBody')}
          </Text>
          {loadError && onRefresh ? (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                onRefresh();
              }}
              style={({ pressed }) => [
                styles.emptyResetBtn,
                {
                  backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.12)',
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <Text style={[styles.emptyResetText, { color: GALLERY_ACCENT }]}>Odśwież katalog</Text>
            </Pressable>
          ) : null}
          {hasActiveFilters ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onClearFilters();
              }}
              style={({ pressed }) => [
                styles.emptyResetBtn,
                {
                  backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.12)',
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <Text style={[styles.emptyResetText, { color: GALLERY_ACCENT }]}>
                {t('radar.home.galleryClearFilters')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
    />
  );
}

function createCatalogStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    sectionHead: {
      gap: 4,
      marginBottom: 8,
    },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.5,
      lineHeight: 34,
    },
    countLine: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
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
    viewToggleBtnLabelActive: {
      color: colors.chipActiveText,
    },
    columnWrap: {
      gap: 0,
    },
    card: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      backgroundColor: isDark ? 'rgba(15,23,42,0.72)' : '#FFFFFF',
      overflow: 'hidden',
    },
    cardImageWrap: {
      position: 'relative',
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
      overflow: 'hidden',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    cardImage: {
      width: '100%',
    },
    cardImageFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    txChip: {
      position: 'absolute',
      top: 10,
      left: 10,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    txChipRent: {
      backgroundColor: 'rgba(10,132,255,0.92)',
    },
    txChipSell: {
      backgroundColor: 'rgba(16,185,129,0.92)',
    },
    txChipText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    featuredChip: {
      position: 'absolute',
      top: 10,
      right: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: '#FBBF24',
    },
    featuredChipText: {
      color: '#000',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    verifiedChip: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    favBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    cardBody: {
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 12,
      gap: 4,
    },
    cardBodyCompact: {
      paddingHorizontal: 10,
      paddingTop: 9,
      paddingBottom: 10,
    },
    cardMeta: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 21,
      letterSpacing: -0.3,
    },
    cardSub: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    cardPrice: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    discountChip: {
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: 'rgba(248,113,113,0.18)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(248,113,113,0.45)',
    },
    discountChipText: {
      color: '#FCA5A5',
      fontSize: 10,
      fontWeight: '900',
    },
    cardFooter: {
      marginTop: 4,
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
    },
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    paddingTop: 4,
    paddingBottom: 6,
    gap: 8,
  },
  paginationBlock: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'center',
  },
  paginationRangeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  paginationArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationPages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
  },
  paginationPageChip: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationPageChipText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  countActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearLinkText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandedFilters: {
    gap: 6,
  },
  segmentWrap: {
    paddingHorizontal: 16,
  },
  distanceHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 18,
    paddingBottom: 2,
  },
  distanceHintRowLight: {
    marginHorizontal: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  distanceHintText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 1,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniChipLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  columnWrap: {
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  cardShell: {
    borderRadius: 22,
    marginBottom: 14,
  },
  cardShellLight: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 10,
  },
  cardShellDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
  },
  cardSurface: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardSurfaceLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
  },
  cardSurfaceDark: {
    backgroundColor: 'rgba(36,36,38,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardPressedLight: {
    transform: [{ scale: 0.985 }, { translateY: 1 }],
    opacity: 0.96,
  },
  cardPressedDark: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  imageWrap: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: '#CBD5E1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  imageSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
  },
  txBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  txBadgeLight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  txBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  countryBadge: {
    position: 'absolute',
    top: 10,
    right: 46,
    maxWidth: '40%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.78)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  countryBadgeLight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  countryBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  legalBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  legalBadgeLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  legalBadgeDark: {
    backgroundColor: 'rgba(28,28,30,0.88)',
  },
  favBtnOuter: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  favBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  favBtnLight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  imageFooter: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 6,
  },
  cardPrice: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.35,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  discountBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.55)',
    backgroundColor: 'rgba(127,29,29,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  discountBadgeText: {
    color: '#fecaca',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  distancePillLux: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,243,208,0.35)',
  },
  distancePillLuxText: {
    color: '#ECFDF5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
    gap: 4,
  },
  cardBodyLight: {
    backgroundColor: '#FAFBFD',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.05)',
  },
  cardBodyDark: {
    backgroundColor: 'rgba(30,30,32,0.98)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    letterSpacing: -0.25,
  },
  cardTitleLight: {
    color: '#111827',
  },
  cardTitleDark: {
    color: '#FFFFFF',
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardMetaLight: {
    color: '#64748B',
  },
  cardMetaDark: {
    color: 'rgba(255,255,255,0.52)',
  },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  specPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  specPillLight: {
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  specPillDark: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  specText: {
    fontSize: 10,
    fontWeight: '700',
  },
  specTextLight: {
    color: '#475569',
  },
  specTextDark: {
    color: '#94A3B8',
  },
  cardFooterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.07)',
    marginTop: 6,
    marginBottom: 2,
  },
  cardFooterDividerDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardFooterMeta: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  cardFooterMetaLight: {
    color: '#94A3B8',
  },
  cardFooterMetaDark: {
    color: 'rgba(255,255,255,0.35)',
  },
  railsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 4,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  railsHeroSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  railsHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  railsIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  railsEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#6366F1',
    marginBottom: 2,
  },
  railsTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  railsSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    lineHeight: 16,
  },
  railsCountPill: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(99,102,241,0.16)',
  },
  railsCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewToggleBtnLight: {
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  viewToggleBtnDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  viewToggleBtnActive: {
    borderColor: 'rgba(99,102,241,0.45)',
  },
  viewToggleLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  featuredBlock: {
    marginBottom: 14,
    gap: 8,
  },
  featuredTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  featuredRow: {
    gap: 10,
    paddingRight: 4,
  },
  featuredCard: {
    width: 168,
    height: 196,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  featuredCardLight: {
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: '#FFF7ED',
  },
  featuredCardDark: {
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: '#1C1917',
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.25)',
  },
  featuredGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
  },
  featuredBadge: {
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
  featuredBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  featuredPrice: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 28,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  featuredMeta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
  },
  featuredPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FBBF24',
  },
  featuredPillText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
