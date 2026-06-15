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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { useI18n } from '../../i18n';
import type { AppLocale } from '../../i18n';
import { isFavoriteId } from '../../utils/favoritesStorage';
import AdvancedFilterSegment from '../AdvancedFilterSegment';
import { resolveOfferPriceDiscount } from '../../utils/offerPriceDiscount';

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
};

const NEAR_ACCENT = '#10b981';

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
const RENT_COLOR = '#0A84FF';
const SELL_COLOR = '#10b981';
const GALLERY_ACCENT = '#6366F1';
const ABROAD_COLOR = '#F59E0B';

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
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.miniChip,
        {
          backgroundColor: active
            ? `${accent}${isDark ? '38' : '24'}`
            : isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(0,0,0,0.04)',
          borderColor: active ? `${accent}99` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
        pressed && { opacity: 0.86, transform: [{ scale: 0.97 }] },
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
    </Pressable>
  );
}

export default function RadarOfferGallery({
  offers,
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
}: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GalleryOffer>>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const gap = 10;
  const horizontalPad = 16;
  const cardWidth = (width - horizontalPad * 2 - gap) / 2;

  const wrapFilterChange = useCallback(<T,>(fn: (v: T) => void, value: T) => {
    animateFilterChange();
    fn(value);
  }, []);

  const transactionOptions = useMemo(
    () =>
      [
        { key: 'ALL' as const, label: t('radar.home.galleryFilterAll') },
        { key: 'RENT' as const, label: t('radar.home.galleryFilterRent') },
        { key: 'SELL' as const, label: t('radar.home.galleryFilterBuy') },
      ] as const,
    [t],
  );

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

  const propertyOptions = useMemo(
    () =>
      [
        ['ALL', 'apps-outline', t('radar.home.propertyAll')],
        ['FLAT', 'business-outline', t('radar.home.propertyFlat')],
        ['HOUSE', 'home-outline', t('radar.home.propertyHouse')],
        ['PLOT', 'map-outline', t('radar.home.propertyPlot')],
        ['PREMISES', 'storefront-outline', t('radar.home.propertyPremises')],
      ] as const,
    [t],
  );

  const filterKey = `${transactionFilter}-${countryFilter}-${propertyFilter}-${sortFilter}`;
  const totalCount = offers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / GALLERY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [filterKey, totalCount]);

  const paginatedOffers = useMemo(() => {
    const start = (safePage - 1) * GALLERY_PAGE_SIZE;
    return offers.slice(start, start + GALLERY_PAGE_SIZE);
  }, [offers, safePage]);

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
        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: isDark ? 'rgba(255,255,255,0.72)' : '#64748B' }]}>
            {t('radar.home.galleryResults', { count: String(offers.length) })}
          </Text>
          <View style={styles.countActions}>
            {hasActiveFilters ? (
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
            ) : null}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                animateFilterChange();
                setFiltersExpanded((v) => !v);
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.expandBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.expandBtnText, { color: GALLERY_ACCENT }]}>
                {filtersExpanded ? t('radar.home.galleryCollapseFilters') : t('radar.home.galleryExpandFilters')}
              </Text>
              <Ionicons
                name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={GALLERY_ACCENT}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.segmentWrap}>
          <AdvancedFilterSegment
            options={transactionOptions}
            value={transactionFilter}
            onChange={(v) => wrapFilterChange(onTransactionFilterChange, v)}
            accentColor={
              transactionFilter === 'RENT' ? RENT_COLOR : transactionFilter === 'SELL' ? SELL_COLOR : GALLERY_ACCENT
            }
            isDark={isDark}
          />
        </View>

        {filtersExpanded ? (
          <View style={styles.expandedFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <MiniChip
                label={t('radar.home.galleryFilterAll')}
                icon="earth-outline"
                active={countryFilter === 'ALL'}
                accent={GALLERY_ACCENT}
                isDark={isDark}
                onPress={() => wrapFilterChange(onCountryFilterChange, 'ALL')}
              />
              <MiniChip
                label={t('radar.home.galleryFilterPoland')}
                icon="flag-outline"
                active={countryFilter === 'PL'}
                accent={SELL_COLOR}
                isDark={isDark}
                onPress={() => wrapFilterChange(onCountryFilterChange, 'PL')}
              />
              <MiniChip
                label={t('radar.home.galleryFilterAbroad')}
                icon="airplane-outline"
                active={countryFilter === 'ABROAD'}
                accent={ABROAD_COLOR}
                isDark={isDark}
                onPress={() => wrapFilterChange(onCountryFilterChange, 'ABROAD')}
              />
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {propertyOptions.map(([key, icon, label]) => (
                <MiniChip
                  key={key}
                  label={label}
                  icon={icon}
                  active={propertyFilter === key}
                  accent={GALLERY_ACCENT}
                  isDark={isDark}
                  onPress={() => wrapFilterChange(onPropertyFilterChange, key)}
                />
              ))}
            </ScrollView>
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
      countryFilter,
      filtersExpanded,
      hasActiveFilters,
      isDark,
      offers.length,
      onClearFilters,
      onCountryFilterChange,
      onPropertyFilterChange,
      onSortFilterChange,
      onTransactionFilterChange,
      propertyFilter,
      propertyOptions,
      sortFilter,
      sortOptions,
      t,
      transactionFilter,
      transactionOptions,
      userLocation,
      wrapFilterChange,
    ],
  );

  const renderItem = ({ item, index }: { item: GalleryOffer; index: number }) => {
    const tx = String(item.raw?.transactionType || '').toUpperCase();
    const txColor = tx === 'RENT' ? RENT_COLOR : SELL_COLOR;
    const txLabel =
      tx === 'RENT' ? t('radar.home.transactionRentShort') : t('radar.home.transactionSellShort');
    const countryCode = offerCountryCode(item.raw);
    const countryLabel = offerCountryLabel(item.raw);
    const cityLine = [item.type, String(item.raw?.district || item.raw?.city || '').trim()]
      .filter(Boolean)
      .join(' · ');
    const fav = isFavoriteId(item.id, favorites);
    const priceLabel = formatPrice(item.raw).primary;
    const priceDiscount = resolveOfferPriceDiscount(item.raw);
    const verified = isOfferVerified(item.id, item.raw);
    const publishLabel = formatPublishDate(item.raw);
    const isLeftColumn = index % 2 === 0;
    const distanceKmValue =
      userLocation && Number.isFinite(item.lat) && Number.isFinite(item.lng)
        ? haversineKm(userLocation.latitude, userLocation.longitude, item.lat, item.lng)
        : null;
    const distanceBadgeLabel =
      distanceKmValue != null
        ? t('radar.home.galleryDistanceBadge', { distance: formatApproxKm(distanceKmValue, locale) })
        : null;

    return (
      <View
        style={[
          styles.cardShell,
          isDark ? styles.cardShellDark : styles.cardShellLight,
          {
            width: cardWidth,
            marginRight: isLeftColumn ? gap : 0,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onPressOffer(item);
          }}
          style={({ pressed }) => [
            styles.cardSurface,
            isDark ? styles.cardSurfaceDark : styles.cardSurfaceLight,
            pressed && (isDark ? styles.cardPressedDark : styles.cardPressedLight),
          ]}
        >
        <View style={styles.imageWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={240} />
          ) : (
            <LinearGradient
              colors={isDark ? ['#3A3A3C', '#2C2C2E'] : ['#E8EDF4', '#D5DCE8']}
              style={[styles.image, styles.imageFallback]}
            >
              <Ionicons name="home-outline" size={26} color="#94A3B8" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'transparent', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.35, 1]}
            style={styles.imageGradient}
            pointerEvents="none"
          />
          {!isDark ? (
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'transparent']}
              style={styles.imageSheen}
              pointerEvents="none"
            />
          ) : null}
          <View style={[styles.txBadge, { backgroundColor: txColor }, !isDark && styles.txBadgeLight]}>
            <Text style={styles.txBadgeText}>{txLabel.toUpperCase()}</Text>
          </View>
          {countryCode !== 'PL' ? (
            <View style={[styles.countryBadge, !isDark && styles.countryBadgeLight]}>
              <Text style={styles.countryBadgeText} numberOfLines={1}>
                {countryLabel}
              </Text>
            </View>
          ) : null}
          {verified ? (
            <View style={[styles.legalBadge, isDark ? styles.legalBadgeDark : styles.legalBadgeLight]}>
              <Ionicons name="shield-checkmark" size={11} color={isDark ? '#34d399' : '#047857'} />
            </View>
          ) : null}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleFavorite(Number(item.id));
            }}
            hitSlop={10}
            style={styles.favBtnOuter}
          >
            <BlurView intensity={isDark ? 50 : 62} tint="dark" style={[styles.favBtn, !isDark && styles.favBtnLight]}>
              <Ionicons name={fav ? 'heart' : 'heart-outline'} size={17} color={fav ? '#FF3B30' : '#FFFFFF'} />
            </BlurView>
          </Pressable>
          <View style={styles.imageFooter}>
            <View style={styles.priceRow}>
              <Text style={styles.cardPrice} numberOfLines={1}>
                {priceLabel}
              </Text>
              {priceDiscount.isDiscounted ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>−{priceDiscount.discountPercent}%</Text>
                </View>
              ) : null}
            </View>
            {distanceBadgeLabel ? (
              <BlurView intensity={isDark ? 48 : 72} tint="dark" style={styles.distancePillLux}>
                <Ionicons name="navigate" size={10} color="#A7F3D0" />
                <Text style={styles.distancePillLuxText} numberOfLines={1}>
                  {distanceBadgeLabel}
                </Text>
              </BlurView>
            ) : null}
          </View>
        </View>
        <View style={[styles.cardBody, isDark ? styles.cardBodyDark : styles.cardBodyLight]}>
          <Text style={[styles.cardTitle, isDark ? styles.cardTitleDark : styles.cardTitleLight]} numberOfLines={2}>
            {String(item.raw?.title || cityLine || t('radar.home.locationFallback'))}
          </Text>
          <Text style={[styles.cardMeta, isDark ? styles.cardMetaDark : styles.cardMetaLight]} numberOfLines={1}>
            {cityLine}
          </Text>
          <View style={styles.specRow}>
            <View style={[styles.specPill, isDark ? styles.specPillDark : styles.specPillLight]}>
              <Text style={[styles.specText, isDark ? styles.specTextDark : styles.specTextLight]}>{item.area}</Text>
            </View>
            {item.rooms ? (
              <View style={[styles.specPill, isDark ? styles.specPillDark : styles.specPillLight]}>
                <Text style={[styles.specText, isDark ? styles.specTextDark : styles.specTextLight]}>{item.rooms}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.cardFooterDivider, isDark && styles.cardFooterDividerDark]} />
          <Text style={[styles.cardFooterMeta, isDark ? styles.cardFooterMetaDark : styles.cardFooterMetaLight]} numberOfLines={1}>
            ID {item.id} · {publishLabel.replace(/^[^:]+:\s*/, '')}
          </Text>
        </View>
        </Pressable>
      </View>
    );
  };

  const listFooter = useMemo(() => {
    if (totalCount === 0 || totalPages <= 1) return null;
    const pageStart = (safePage - 1) * GALLERY_PAGE_SIZE + 1;
    const pageEnd = Math.min(safePage * GALLERY_PAGE_SIZE, totalCount);

    return (
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
                      borderColor: active ? `${GALLERY_ACCENT}99` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
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
    );
  }, [goToPage, isDark, safePage, t, totalCount, totalPages]);

  return (
    <FlatList
      ref={listRef}
      style={styles.root}
      data={paginatedOffers}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      key={`gallery-grid-${filterKey}-p${safePage}`}
      columnWrapperStyle={[styles.columnWrap, { paddingHorizontal: horizontalPad }]}
      contentContainerStyle={{
        paddingBottom: bottomInset + 20,
        flexGrow: paginatedOffers.length === 0 ? 1 : undefined,
      }}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GALLERY_ACCENT} />
        ) : undefined
      }
      initialNumToRender={10}
      maxToRenderPerBatch={12}
      windowSize={8}
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
});
