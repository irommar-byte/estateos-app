import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  label: string;
  luxColors: [string, string, string];
  selected: boolean;
  accent: string;
};

/** Android: prostszy pin (bez gradientu) — RN Maps snapshotuje markery niezawodniej. */
export function OfferMapMarkerPin({ label, luxColors, selected, accent }: Props) {
  if (Platform.OS === 'android') {
    return (
      <View
        collapsable={false}
        style={[
          styles.markerOuter,
          styles.markerOuterAndroid,
          selected && styles.markerOuterSelected,
          { elevation: selected ? 14 : 10 },
        ]}
      >
        <View
          style={[
            styles.markerCapsule,
            styles.markerCapsuleAndroid,
            selected && styles.markerCapsuleSelected,
            { backgroundColor: luxColors[1], borderColor: 'rgba(255,255,255,0.92)' },
          ]}
        >
          <Text style={[styles.mapMarkerText, styles.mapMarkerTextAndroid]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={[styles.markerPinTail, { borderTopColor: luxColors[2] }]} />
      </View>
    );
  }

  return (
    <View
      collapsable={false}
      style={[styles.markerOuter, selected && styles.markerOuterSelected, { shadowColor: accent }]}
    >
      <LinearGradient
        colors={luxColors}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={[styles.markerCapsule, selected && styles.markerCapsuleSelected]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
          style={styles.markerHighlight}
          pointerEvents="none"
        />
        <Text style={styles.mapMarkerText} numberOfLines={1}>
          {label}
        </Text>
      </LinearGradient>
      <View style={[styles.markerPinTail, { borderTopColor: luxColors[2] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  markerOuter: {
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  markerOuterAndroid: {
    overflow: 'visible',
  },
  markerOuterSelected: {
    transform: [{ scale: 1.08 }],
    shadowOpacity: 0.52,
    shadowRadius: 18,
  },
  markerCapsule: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCapsuleAndroid: {
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 52,
  },
  markerCapsuleSelected: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  markerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  markerPinTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.92,
  },
  mapMarkerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.35,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    flexShrink: 0,
  },
  mapMarkerTextAndroid: {
    includeFontPadding: false,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
});
