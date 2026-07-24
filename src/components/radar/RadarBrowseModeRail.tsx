import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type Mode = 'RADAR' | 'GALLERY';

type Props = {
  mode: Mode;
  isDark: boolean;
  radarLabel: string;
  galleryLabel: string;
  onSelectRadar: () => void;
  onSelectGallery: () => void;
  /** W top barze — bez dolnego marginesu i bocznego paddingu. */
  embeddedInTopBar?: boolean;
  /**
   * galleryMap: Galeria | Mapa (domyślne)
   * mapRadar: Mapa | Radar (tab Mapy+Radar)
   */
  variant?: 'galleryMap' | 'mapRadar';
};

export default function RadarBrowseModeRail({
  mode,
  isDark,
  radarLabel,
  galleryLabel,
  onSelectRadar,
  onSelectGallery,
  embeddedInTopBar = false,
  variant = 'galleryMap',
}: Props) {
  const isMapRadar = variant === 'mapRadar';
  /** W mapRadar: GALLERY = Mapa, RADAR = Radar live */
  const leftActive = mode === 'GALLERY';
  const rightActive = mode === 'RADAR';
  const leftIcon = (isMapRadar
    ? leftActive
      ? 'map'
      : 'map-outline'
    : leftActive
      ? 'grid'
      : 'grid-outline') as keyof typeof Ionicons.glyphMap;
  const rightIcon = (isMapRadar
    ? rightActive
      ? 'radio'
      : 'radio-outline'
    : rightActive
      ? 'map'
      : 'map-outline') as keyof typeof Ionicons.glyphMap;
  const leftAccent = isMapRadar ? '#0EA5E9' : '#6366F1';
  const rightAccent = '#10b981';

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
            accessibilityState={{ selected: leftActive }}
            onPress={() => {
              if (leftActive) return;
              Haptics.selectionAsync();
              onSelectGallery();
            }}
            style={({ pressed }) => [
              styles.half,
              leftActive && { backgroundColor: `${leftAccent}29` },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name={leftIcon} size={16} color={leftActive ? leftAccent : '#8E8E93'} />
            <Text
              style={[
                styles.label,
                {
                  color: leftActive
                    ? isDark
                      ? '#E0F2FE'
                      : isMapRadar
                        ? '#075985'
                        : '#3730A3'
                    : '#8E8E93',
                },
              ]}
              numberOfLines={1}
            >
              {galleryLabel}
            </Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: rightActive }}
            onPress={() => {
              if (rightActive) return;
              Haptics.selectionAsync();
              onSelectRadar();
            }}
            style={({ pressed }) => [
              styles.half,
              rightActive && styles.halfActiveRadar,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name={rightIcon} size={16} color={rightActive ? rightAccent : '#8E8E93'} />
            <Text
              style={[
                styles.label,
                { color: rightActive ? (isDark ? '#C9F9E7' : '#0B5B43') : '#8E8E93' },
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
