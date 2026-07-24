import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type Props = {
  isDark: boolean;
  accent: string;
  label: string;
  hint?: string;
  active?: boolean;
  lightChrome?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * Wyraźny CTA wyszukiwania / filtrów — zamiast samotnej lupy,
 * żeby użytkownik wiedział, że tu ustawia kupno/wynajem i parametry.
 */
export default function CatalogSearchFilterButton({
  isDark,
  accent,
  label,
  hint,
  active = false,
  lightChrome = false,
  onPress,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      <BlurView
        intensity={lightChrome ? 96 : isDark ? 82 : 92}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.glass,
          lightChrome && styles.glassLight,
          active && { borderColor: `${accent}99`, backgroundColor: `${accent}22` },
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: `${accent}28` }]}>
          <Ionicons name="options-outline" size={18} color={accent} />
          <Ionicons
            name="search"
            size={11}
            color={accent}
            style={styles.searchOverlay}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: isDark ? '#FFF' : '#0F172A' }]} numberOfLines={1}>
            {label}
          </Text>
          {hint ? (
            <Text style={[styles.hint, { color: isDark ? 'rgba(255,255,255,0.62)' : '#64748B' }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {active ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
        <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8'} />
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 168,
    minWidth: 128,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 25,
  },
  glassLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15,23,42,0.08)',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchOverlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  hint: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
