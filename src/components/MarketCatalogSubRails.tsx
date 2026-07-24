import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export type HomeTxFilter = 'SELL' | 'RENT';

type HomeProps = {
  isDark: boolean;
  value: HomeTxFilter;
  onChange: (v: HomeTxFilter) => void;
};

/** Pod Homes: Kupno | Wynajem */
export function HomeTransactionSubRail({ isDark, value, onChange }: HomeProps) {
  return (
    <View style={styles.outer}>
      <BlurView
        intensity={isDark ? 80 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
            backgroundColor: isDark ? 'rgba(28,28,30,0.75)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        <View style={styles.row}>
          {(
            [
              { key: 'SELL' as const, label: 'Kupno', accent: '#10b981' },
              { key: 'RENT' as const, label: 'Wynajem', accent: '#0A84FF' },
            ] as const
          ).map((opt) => {
            const selected = value === opt.key;
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (selected) return;
                  void Haptics.selectionAsync();
                  onChange(opt.key);
                }}
                style={({ pressed }) => [
                  styles.half,
                  selected && { backgroundColor: `${opt.accent}29` },
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    { color: selected ? (isDark ? '#FFF' : '#111') : '#8E8E93' },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

type CarProps = {
  isDark: boolean;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
};

/** Pod Cars: wszystkie typy pojazdów (+ Wszystkie). */
export function CarVehicleTypeSubRail({ isDark, value, options, onChange }: CarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carRow}
      style={styles.carScroll}
    >
      <Pressable
        onPress={() => {
          if (!value) return;
          void Haptics.selectionAsync();
          onChange('');
        }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            backgroundColor: !value
              ? 'rgba(14,165,233,0.2)'
              : isDark
                ? 'rgba(28,28,30,0.85)'
                : 'rgba(255,255,255,0.92)',
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Text style={[styles.chipLabel, { color: !value ? '#0EA5E9' : '#8E8E93' }]}>Wszystkie</Text>
      </Pressable>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(selected ? '' : opt.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                backgroundColor: selected
                  ? 'rgba(14,165,233,0.2)'
                  : isDark
                    ? 'rgba(28,28,30,0.85)'
                    : 'rgba(255,255,255,0.92)',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: selected ? '#0EA5E9' : '#8E8E93' }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'center', maxWidth: 220, width: '100%', marginTop: 6 },
  blur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', padding: 3, gap: 2 },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  carScroll: { marginTop: 6, maxWidth: 320, alignSelf: 'center' },
  carRow: { gap: 6, paddingHorizontal: 2, alignItems: 'center' },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipLabel: { fontSize: 11, fontWeight: '700' },
});
