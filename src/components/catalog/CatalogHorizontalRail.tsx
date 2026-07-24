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

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  items: CatalogRailItem[];
  emptyLabel?: string;
  isDark: boolean;
  onPressItem: (id: number | string) => void;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 12;
const LOAD_MORE_THRESHOLD_PX = 420;

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
 * Panel 3D z tłem działu (accent).
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
}: Props) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadingMoreRef = useRef(false);

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

  const panelBg = isDark
    ? [hexToRgba(accent, 0.18), hexToRgba(accent, 0.06), 'rgba(18,18,20,0.92)']
    : [hexToRgba(accent, 0.16), hexToRgba(accent, 0.05), 'rgba(255,255,255,0.94)'];

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: isDark ? hexToRgba(accent, 0.35) : hexToRgba(accent, 0.28),
          shadowColor: accent,
        },
      ]}
    >
      <LinearGradient colors={panelBg as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.panelSheen, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)' }]} />
      <View style={[styles.accentRail, { backgroundColor: accent }]} />

      <View style={styles.head}>
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: hexToRgba(accent, isDark ? 0.28 : 0.18),
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
          <View style={[styles.countPill, { backgroundColor: hexToRgba(accent, isDark ? 0.28 : 0.16) }]}>
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
                backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.72)',
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
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.06)',
                  shadowColor: isDark ? '#000' : accent,
                },
              ]}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.imageFallback, { backgroundColor: hexToRgba(accent, 0.14) }]}>
                  <Ionicons name={icon} size={22} color={accent} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: isDark ? '#FFF' : '#111' }]}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={styles.cardSub}>
                    {item.subtitle}
                  </Text>
                ) : null}
                {item.priceLabel ? (
                  <Text numberOfLines={1} style={[styles.cardPrice, { color: accent }]}>
                    {item.priceLabel}
                  </Text>
                ) : null}
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
};

/** Stos taśm Market — ukrywa puste kategorie (poza showWhenEmpty). */
export function CatalogHorizontalRailStack({ sections, isDark, onPressItem }: StackProps) {
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
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  panel: {
    marginBottom: 2,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  panelSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginHorizontal: 12,
  },
  row: { gap: 12, paddingHorizontal: 12, paddingRight: 16 },
  card: {
    width: 168,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  image: { width: '100%', height: 108 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { paddingHorizontal: 10, paddingVertical: 9, gap: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardSub: { fontSize: 11, color: '#8E8E93' },
  cardPrice: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  sentinel: { width: 24, height: 1 },
});
