import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type Props = {
  mode: 'RADAR' | 'GALLERY';
  isDark: boolean;
  radarLabel: string;
  galleryLabel: string;
  onSelectRadar: () => void;
  onSelectGallery: () => void;
  /** W top barze — bez dolnego marginesu i bocznego paddingu. */
  embeddedInTopBar?: boolean;
};

export default function RadarBrowseModeRail({
  mode,
  isDark,
  radarLabel,
  galleryLabel,
  onSelectRadar,
  onSelectGallery,
  embeddedInTopBar = false,
}: Props) {
  return (
    <View style={[styles.outer, embeddedInTopBar && styles.outerEmbedded]}>
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
            accessibilityState={{ selected: mode === 'GALLERY' }}
            onPress={() => {
              if (mode === 'GALLERY') return;
              Haptics.selectionAsync();
              onSelectGallery();
            }}
            style={({ pressed }) => [
              styles.half,
              mode === 'GALLERY' && styles.halfActiveGallery,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons
              name={mode === 'GALLERY' ? 'grid' : 'grid-outline'}
              size={16}
              color={mode === 'GALLERY' ? '#6366F1' : '#8E8E93'}
            />
            <Text
              style={[
                styles.label,
                { color: mode === 'GALLERY' ? (isDark ? '#E0E7FF' : '#3730A3') : '#8E8E93' },
              ]}
              numberOfLines={1}
            >
              {galleryLabel}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'RADAR' }}
            onPress={() => {
              if (mode === 'RADAR') return;
              Haptics.selectionAsync();
              onSelectRadar();
            }}
            style={({ pressed }) => [
              styles.half,
              mode === 'RADAR' && styles.halfActiveRadar,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons
              name={mode === 'RADAR' ? 'map' : 'map-outline'}
              size={16}
              color={mode === 'RADAR' ? '#10b981' : '#8E8E93'}
            />
            <Text
              style={[
                styles.label,
                { color: mode === 'RADAR' ? (isDark ? '#C9F9E7' : '#0B5B43') : '#8E8E93' },
              ]}
              numberOfLines={1}
            >
              {radarLabel}
            </Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  outerEmbedded: {
    paddingHorizontal: 0,
    marginBottom: 0,
    maxWidth: 280,
  },
  blur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  half: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  halfActiveRadar: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  halfActiveGallery: {
    backgroundColor: 'rgba(99,102,241,0.18)',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
