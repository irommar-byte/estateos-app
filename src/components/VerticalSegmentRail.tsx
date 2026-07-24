import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEcosystemStore, type EcosystemVertical } from '../store/useEcosystemStore';

type Props = {
  isDark: boolean;
  /** Węższy wariant pod top bar. */
  compact?: boolean;
};

export default function VerticalSegmentRail({ isDark, compact = true }: Props) {
  const activeVertical = useEcosystemStore((s) => s.activeVertical);
  const setActiveVertical = useEcosystemStore((s) => s.setActiveVertical);

  const select = (v: EcosystemVertical) => {
    if (activeVertical === v) return;
    void Haptics.selectionAsync();
    setActiveVertical(v);
  };

  return (
    <View style={[styles.outer, compact && styles.outerCompact]}>
      <BlurView
        intensity={isDark ? 85 : 92}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            backgroundColor: isDark ? 'rgba(28,28,30,0.82)' : 'rgba(255,255,255,0.92)',
          },
        ]}
      >
        <View style={styles.row}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeVertical === 'home' }}
            onPress={() => select('home')}
            style={({ pressed }) => [
              styles.half,
              activeVertical === 'home' && styles.halfActiveHome,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons
              name={activeVertical === 'home' ? 'home' : 'home-outline'}
              size={compact ? 15 : 16}
              color={activeVertical === 'home' ? '#10b981' : '#8E8E93'}
            />
            <Text
              style={[
                styles.label,
                { color: activeVertical === 'home' ? (isDark ? '#FFF' : '#111') : '#8E8E93' },
              ]}
            >
              Homes
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeVertical === 'car' }}
            onPress={() => select('car')}
            style={({ pressed }) => [
              styles.half,
              activeVertical === 'car' && styles.halfActiveCar,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons
              name={activeVertical === 'car' ? 'car-sport' : 'car-sport-outline'}
              size={compact ? 15 : 16}
              color={activeVertical === 'car' ? '#0EA5E9' : '#8E8E93'}
            />
            <Text
              style={[
                styles.label,
                { color: activeVertical === 'car' ? (isDark ? '#FFF' : '#111') : '#8E8E93' },
              ]}
            >
              Cars
            </Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'center', maxWidth: 220, width: '100%' },
  outerCompact: { maxWidth: 200 },
  blur: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', padding: 3, gap: 2 },
  half: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 15,
  },
  halfActiveHome: { backgroundColor: 'rgba(16,185,129,0.16)' },
  halfActiveCar: { backgroundColor: 'rgba(14,165,233,0.16)' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
});
