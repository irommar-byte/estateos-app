import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ApplePressable from '../ApplePressable';
import SlidingIconSegment from './SlidingIconSegment';

export type CatalogRailItem = {
  id: number | string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  badge?: string;
  badgeTone?: 'good' | 'fair' | 'high' | 'low';
};

export type CatalogRailSection = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  items: CatalogRailItem[];
  /** Pokaż pustą taśmę (Ulubione / Moje). */
  showWhenEmpty?: boolean;
  emptyLabel?: string;
};

export type CatalogRailDensity = 'compact' | 'comfortable' | 'large';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  items: CatalogRailItem[];
  emptyLabel?: string;
  isDark: boolean;
  onPressItem: (id: number | string) => void;
  pageSize?: number;
  density?: CatalogRailDensity;
};

const DEFAULT_PAGE_SIZE = 12;
const LOAD_MORE_THRESHOLD_PX = 420;

const DENSITY = {
  compact: { cardW: 132, imageH: 84, radius: 14, titleSize: 12, priceSize: 11 },
  comfortable: { cardW: 172, imageH: 112, radius: 18, titleSize: 13, priceSize: 13 },
  large: { cardW: 248, imageH: 148, radius: 20, titleSize: 15, priceSize: 15 },
} as const;

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return `rgba(99,102,241,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Poziomy pasek jak WWW InfiniteHorizontalRail — doładowuje karty przy przewijaniu w prawo.
 */
export default function CatalogHorizontalRail({
  title,
  icon,
  accent,
  items,
  emptyLabel,
  isDark,
  onPressItem,
  pageSize = DEFAULT_PAGE_SIZE,
  density = 'comfortable',
}: Props) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadingMoreRef = useRef(false);
  const d = DENSITY[density] || DENSITY.comfortable;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const displayItems = useMemo(
    () => items.slice(0, Math.min(visibleCount, items.length)),
    [items, visibleCount],
  );

  const canLoadMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    if (!canLoadMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
    setTimeout(() => {
      loadingMoreRef.current = false;
    }, 120);
  }, [canLoadMore, items.length, pageSize]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!canLoadMore) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const remaining = contentSize.width - contentOffset.x - layoutMeasurement.width;
      if (remaining <= LOAD_MORE_THRESHOLD_PX) loadMore();
    },
    [canLoadMore, loadMore],
  );

  // Płynne zabarwienie: znika u góry i dołu — bez ostrej krawędzi między taśmami.
  const panelBg = isDark
    ? [
        'transparent',
        hexToRgba(accent, 0.08),
        hexToRgba(accent, 0.28),
        hexToRgba(accent, 0.18),
        hexToRgba(accent, 0.06),
        'transparent',
      ]
    : [
        'transparent',
        hexToRgba(accent, 0.1),
        hexToRgba(accent, 0.26),
        hexToRgba(accent, 0.16),
        hexToRgba(accent, 0.06),
        'transparent',
      ];

  return (
    <View style={styles.panel}>
      <LinearGradient
        colors={panelBg as [string, string, ...string[]]}
        locations={[0, 0.12, 0.38, 0.62, 0.86, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['transparent', hexToRgba(accent, 0.12), 'transparent']
            : ['transparent', hexToRgba(accent, 0.1), 'transparent']
        }
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.head}>
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: hexToRgba(accent, isDark ? 0.36 : 0.2),
              borderColor: hexToRgba(accent, 0.45),
              shadowColor: accent,
            },
          ]}
        >
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <View style={styles.headCopy}>
          <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headMeta} numberOfLines={1}>
            {items.length > 0 ? `${items.length} w taśmie` : emptyLabel || 'Pusto'}
          </Text>
        </View>
        {items.length > 0 ? (
          <View style={[styles.countPill, { backgroundColor: hexToRgba(accent, isDark ? 0.32 : 0.18) }]}>
            <Text style={[styles.count, { color: accent }]}>{items.length}</Text>
          </View>
        ) : null}
      </View>

      {items.length === 0 ? (
        emptyLabel ? (
          <View
            style={[
              styles.empty,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.78)',
              },
            ]}
          >
            <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', fontSize: 13 }}>
              {emptyLabel}
            </Text>
          </View>
        ) : null
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.rowScroll}
          onScroll={onScroll}
          scrollEventThrottle={64}
        >
          {displayItems.map((item) => (
            <ApplePressable
              key={String(item.id)}
              onPress={() => onPressItem(item.id)}
              haptic="selection"
              pressScale={0.97}
              style={{ width: d.cardW }}
            >
              {/* Warstwa 1: miękki ambient (daleki, rozproszony). */}
              <View
                style={[
                  styles.shadowAmbient,
                  {
                    borderRadius: d.radius + 2,
                    shadowColor: isDark ? '#000' : accent,
                    shadowOpacity: isDark ? 0.55 : 0.22,
                    shadowRadius: density === 'large' ? 28 : 22,
                    shadowOffset: { width: 0, height: density === 'large' ? 14 : 10 },
                    elevation: 0,
                  },
                ]}
              >
                {/* Warstwa 2: kontaktowy cień pod kartą. */}
                <View
                  style={[
                    styles.shadowContact,
                    {
                      borderRadius: d.radius + 1,
                      shadowColor: '#000',
                      shadowOpacity: isDark ? 0.45 : 0.14,
                      shadowRadius: density === 'large' ? 14 : 10,
                      shadowOffset: { width: 0, height: density === 'large' ? 8 : 5 },
                      elevation: density === 'large' ? 10 : 7,
                    },
                  ]}
                >
                  {/* Warstwa 3: lekki rim / lokalny glow akcentu. */}
                  <View
                    style={[
                      styles.shadowRim,
                      {
                        borderRadius: d.radius,
                        shadowColor: isDark ? '#FFF' : accent,
                        shadowOpacity: isDark ? 0.08 : 0.18,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 0,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.card,
                        {
                          width: d.cardW,
                          borderRadius: d.radius,
                          backgroundColor: isDark ? 'rgba(28,28,30,1)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.05)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.imageClip,
                          {
                            height: d.imageH,
                            borderTopLeftRadius: d.radius,
                            borderTopRightRadius: d.radius,
                          },
                        ]}
                      >
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
                        ) : (
                          <View
                            style={[
                              styles.image,
                              styles.imageFallback,
                              { backgroundColor: hexToRgba(accent, 0.12) },
                            ]}
                          >
                            <Ionicons name={icon} size={22} color={accent} />
                          </View>
                        )}
                        {/* Delikatny highlight na górze zdjęcia — „szkło”. */}
                        <LinearGradient
                          pointerEvents="none"
                          colors={
                            isDark
                              ? ['rgba(255,255,255,0.14)', 'transparent']
                              : ['rgba(255,255,255,0.55)', 'transparent']
                          }
                          style={styles.imageSheen}
                        />
                        <LinearGradient
                          pointerEvents="none"
                          colors={['transparent', 'rgba(0,0,0,0.22)']}
                          style={styles.imageBottomShade}
                        />
                        {item.badge ? (
                          <View
                            style={[
                              styles.tapeBadge,
                              {
                                backgroundColor:
                                  item.badgeTone === 'high'
                                    ? 'rgba(239,68,68,0.92)'
                                    : item.badgeTone === 'low'
                                      ? 'rgba(14,165,233,0.92)'
                                      : item.badgeTone === 'fair'
                                        ? 'rgba(245,158,11,0.92)'
                                        : 'rgba(16,185,129,0.92)',
                              },
                            ]}
                          >
                            <Text style={styles.tapeBadgeText} numberOfLines={1}>
                              {item.badge}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.cardBody}>
                        <Text
                          numberOfLines={density === 'large' ? 2 : 1}
                          style={[
                            styles.cardTitle,
                            { color: isDark ? '#FFF' : '#111', fontSize: d.titleSize },
                          ]}
                        >
                          {item.title}
                        </Text>
                        {item.subtitle ? (
                          <Text numberOfLines={1} style={styles.cardSub}>
                            {item.subtitle}
                          </Text>
                        ) : null}
                        {item.priceLabel ? (
                          <Text
                            numberOfLines={1}
                            style={[styles.cardPrice, { color: accent, fontSize: d.priceSize }]}
                          >
                            {item.priceLabel}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </ApplePressable>
          ))}
          {canLoadMore ? <View style={styles.sentinel} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

type StackProps = {
  sections: CatalogRailSection[];
  isDark: boolean;
  onPressItem: (id: number | string) => void;
  density?: CatalogRailDensity;
};

/** Stos taśm Market — ukrywa puste kategorie (poza showWhenEmpty). */
export function CatalogHorizontalRailStack({
  sections,
  isDark,
  onPressItem,
  density = 'comfortable',
}: StackProps) {
  const visible = sections.filter((s) => s.items.length > 0 || (s.showWhenEmpty && s.emptyLabel));
  if (!visible.length) return null;
  return (
    <View style={styles.stack}>
      {visible.map((section, index) => (
        <View
          key={section.id}
          style={[
            styles.stackItem,
            index > 0 && styles.stackItemOverlap,
          ]}
        >
          <CatalogHorizontalRail
            title={section.title}
            icon={section.icon}
            accent={section.accent}
            items={section.items}
            emptyLabel={section.emptyLabel}
            isDark={isDark}
            onPressItem={onPressItem}
            density={density}
          />
        </View>
      ))}
    </View>
  );
}

type DensityToggleProps = {
  value: CatalogRailDensity;
  onChange: (v: CatalogRailDensity) => void;
  isDark: boolean;
  accent?: string;
};

/** Przełącznik Małe / Średnie / Duże okienka w taśmach — płynny sliding pill. */
export function CatalogRailDensityToggle({
  value,
  onChange,
  isDark,
  accent = '#6366F1',
}: DensityToggleProps) {
  return (
    <SlidingIconSegment
      value={value}
      onChange={onChange}
      isDark={isDark}
      accent={accent}
      options={[
        { key: 'compact', icon: 'grid-outline', accessibilityLabel: 'Małe' },
        { key: 'comfortable', icon: 'tablet-landscape-outline', accessibilityLabel: 'Średnie' },
        { key: 'large', icon: 'tablet-landscape', accessibilityLabel: 'Duże' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: 0 },
  stackItem: {
    zIndex: 1,
  },
  /** Lekkie nachodzenie — gradienty sąsiadujących taśm zlewają się. */
  stackItemOverlap: {
    marginTop: -18,
  },
  panel: {
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'visible',
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  headCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.35 },
  headMeta: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
  },
  count: { fontSize: 12, fontWeight: '800' },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginHorizontal: 12,
  },
  rowScroll: {
    overflow: 'visible',
  },
  row: {
    gap: 14,
    paddingHorizontal: 14,
    paddingRight: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  shadowAmbient: {
    backgroundColor: 'transparent',
  },
  shadowContact: {
    backgroundColor: 'transparent',
  },
  shadowRim: {
    backgroundColor: 'transparent',
  },
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFF',
  },
  imageClip: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  imageBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '28%',
  },
  tapeBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '86%',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tapeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardBody: { paddingHorizontal: 11, paddingVertical: 10, gap: 2 },
  cardTitle: { fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, color: '#8E8E93' },
  cardPrice: { marginTop: 3, fontWeight: '800', letterSpacing: -0.2 },
  sentinel: { width: 24, height: 1 },
  densityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    gap: 1,
  },
  densityBtn: {
    width: 32,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
