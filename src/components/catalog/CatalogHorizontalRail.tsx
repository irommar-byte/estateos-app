import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

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

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={[styles.iconBubble, { backgroundColor: `${accent}22` }]}>
          <Ionicons name={icon} size={14} color={accent} />
        </View>
        <Text style={[styles.title, { color: isDark ? '#F5F5F7' : '#111' }]}>{title}</Text>
        {items.length > 0 ? (
          <Text style={[styles.count, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)' }]}>
            {items.length}
          </Text>
        ) : null}
      </View>

      {items.length === 0 ? (
        emptyLabel ? (
          <View
            style={[
              styles.empty,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
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
            <Pressable
              key={String(item.id)}
              onPress={() => onPressItem(item.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : '#FFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.imageFallback, { backgroundColor: `${accent}18` }]}>
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
            </Pressable>
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
  stack: { gap: 2 },
  section: { marginBottom: 18, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  iconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  count: { fontSize: 12, fontWeight: '600' },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  row: { gap: 12, paddingRight: 8 },
  card: {
    width: 168,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: { width: '100%', height: 108 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { paddingHorizontal: 10, paddingVertical: 9, gap: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardSub: { fontSize: 11, color: '#8E8E93' },
  cardPrice: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  sentinel: { width: 24, height: 1 },
});
