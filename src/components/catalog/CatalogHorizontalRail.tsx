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

export type CatalogRailItem = {
  id: number | string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  priceLabel?: string;
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

  // Pełniejsze zabarwienie taśmy — solidny tint działu na całym panelu.
  const panelBg = isDark
    ? [hexToRgba(accent, 0.34), hexToRgba(accent, 0.2), hexToRgba(accent, 0.12)]
    : [hexToRgba(accent, 0.28), hexToRgba(accent, 0.16), hexToRgba(accent, 0.1)];

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: isDark ? hexToRgba(accent, 0.42) : hexToRgba(accent, 0.28),
          shadowColor: accent,
        },
      ]}
    >
      <LinearGradient
        colors={panelBg as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.panelSheen,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.45)' },
        ]}
      />

      <View style={styles.head}>
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: hexToRgba(accent, isDark ? 0.36 : 0.22),
              borderColor: hexToRgba(accent, 0.5),
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
          <View style={[styles.countPill, { backgroundColor: hexToRgba(accent, isDark ? 0.32 : 0.2) }]}>
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
              <View
                style={[
                  styles.card,
                  {
                    width: d.cardW,
                    borderRadius: d.radius,
                    backgroundColor: isDark ? 'rgba(28,28,30,1)' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
                    shadowColor: isDark ? '#000' : '#0F172A',
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
                    <View style={[styles.image, styles.imageFallback, { backgroundColor: hexToRgba(accent, 0.12) }]}>
                      <Ionicons name={icon} size={22} color={accent} />
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text
                    numberOfLines={density === 'large' ? 2 : 1}
                    style={[styles.cardTitle, { color: isDark ? '#FFF' : '#111', fontSize: d.titleSize }]}
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
      {visible.map((section) => (
        <CatalogHorizontalRail
          key={section.id}
          title={section.title}
          icon={section.icon}
          accent={section.accent}
          items={section.items}
          emptyLabel={section.emptyLabel}
          isDark={isDark}
          onPressItem={onPressItem}
          density={density}
        />
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

/** Przełącznik Małe / Średnie / Duże okienka w taśmach. */
export function CatalogRailDensityToggle({
  value,
  onChange,
  isDark,
  accent = '#6366F1',
}: DensityToggleProps) {
  const options: { key: CatalogRailDensity; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'compact', icon: 'grid-outline', label: 'Małe' },
    { key: 'comfortable', icon: 'tablet-landscape-outline', label: 'Średnie' },
    { key: 'large', icon: 'tablet-landscape', label: 'Duże' },
  ];

  return (
    <View
      style={[
        styles.densityWrap,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
        },
      ]}
    >
      {options.map((opt) => {
        const selected = value === opt.key;
        return (
          <ApplePressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            haptic="selection"
            pressScale={0.94}
            onPress={() => {
              if (!selected) onChange(opt.key);
            }}
            style={[
              styles.densityBtn,
              selected && {
                backgroundColor: hexToRgba(accent, isDark ? 0.35 : 0.18),
              },
            ]}
          >
            <Ionicons name={opt.icon} size={15} color={selected ? accent : '#8E8E93'} />
          </ApplePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  panel: {
    marginBottom: 2,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 14,
    paddingBottom: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  panelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
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
  row: { gap: 12, paddingHorizontal: 14, paddingRight: 18 },
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  imageClip: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
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
