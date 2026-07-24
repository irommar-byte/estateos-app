import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CatalogHorizontalRailStack, type CatalogRailSection } from './CatalogHorizontalRail';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  sections: CatalogRailSection[];
  isDark: boolean;
  onPressItem: (id: number | string) => void;
  title?: string;
  subtitle?: string;
};

/**
 * Zwijany stos taśm Market — domyślnie złożony, po tapnięciu rozwija Ulubione/Moje/Najnowsze…
 */
export default function CollapsibleMarketRails({
  sections,
  isDark,
  onPressItem,
  title = 'Taśmy Market',
  subtitle = 'Ulubione, Moje, Najnowsze i inne kategorie',
}: Props) {
  const [open, setOpen] = useState(false);
  const visibleCount = sections.filter((s) => s.items.length > 0 || s.showWhenEmpty).length;

  if (!visibleCount) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          backgroundColor: isDark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.72)',
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void Haptics.selectionAsync();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.88 }]}
      >
        <View style={[styles.iconBubble, { backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.12)' }]}>
          <Ionicons name="albums-outline" size={16} color="#6366F1" />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: isDark ? '#F5F5F7' : '#111' }]}>{title}</Text>
          <Text style={styles.sub}>{open ? 'Zwiń taśmy' : subtitle}</Text>
        </View>
        <Text style={styles.count}>{visibleCount}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#8E8E93" />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <CatalogHorizontalRailStack sections={sections} isDark={isDark} onPressItem={onPressItem} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  count: { fontSize: 12, fontWeight: '700', color: '#8E8E93', marginRight: 2 },
  body: { paddingHorizontal: 10, paddingBottom: 8 },
});
