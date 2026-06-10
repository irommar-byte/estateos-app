import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  active: boolean;
  blink: Animated.Value;
  isDark: boolean;
};

const BULB_SIZE = 30;
const HALO_SIZE = 54;

export default function RadarStatusBulb({ active, blink, isDark }: Props) {
  if (active) {
    return (
      <View style={styles.housing}>
        <View
          style={[
            styles.steadyHalo,
            {
              backgroundColor: isDark ? 'rgba(16,185,129,0.38)' : 'rgba(16,185,129,0.28)',
              shadowColor: '#10B981',
            },
          ]}
        />
        <LinearGradient colors={['#57534E', '#292524', '#1C1917']} style={styles.socketBase} />
        <LinearGradient colors={['#6EE7B7', '#10B981', '#047857']} style={styles.socketRing} />
        <View style={[styles.glass, styles.glassLitGreen, { borderColor: 'rgba(167,243,208,0.55)' }]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.glassSheen}
          />
          <View style={styles.activeCoreGlow} />
          <Ionicons name="radio" size={15} color="#F0FDF4" style={styles.iconLayer} />
          <View style={styles.specularHot} />
        </View>
      </View>
    );
  }

  const haloOpacity = blink.interpolate({
    inputRange: [0, 0.15, 0.55, 1],
    outputRange: [0, 0.08, 0.42, 0.78],
  });
  const haloScale = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.62],
  });
  const innerGlowOpacity = blink.interpolate({
    inputRange: [0, 0.1, 0.45, 1],
    outputRange: [0, 0.22, 0.72, 1],
  });
  const coreGlowOpacity = blink.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.35, 1],
  });
  const coreGlowScale = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.08],
  });
  const filamentOpacity = blink.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.32, 0.58, 1],
  });
  const hotFilamentOpacity = blink.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.15, 0.95],
  });
  const specOpacity = blink.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.25, 0.92],
  });
  const glassTintOpacity = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.55],
  });

  return (
    <View style={styles.housing}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.outerHalo,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
            backgroundColor: isDark ? '#FF5A45' : '#FF6B57',
            shadowColor: '#FF3B30',
          },
        ]}
      />
      <LinearGradient colors={['#57534E', '#292524', '#1C1917']} style={styles.socketBase} />
      <LinearGradient
        colors={['#A8A29E', '#57534E', '#292524']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.socketRing}
      />
      <View style={[styles.glass, styles.glassOff, { borderColor: isDark ? 'rgba(255,180,174,0.28)' : 'rgba(255,59,48,0.22)' }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.innerWarmGlow, { opacity: innerGlowOpacity }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.coreFilamentGlow,
            {
              opacity: coreGlowOpacity,
              transform: [{ scale: coreGlowScale }],
            },
          ]}
        />
        <Animated.View pointerEvents="none" style={[styles.glassWarmTint, { opacity: glassTintOpacity }]} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.glassSheen}
        />
        <Animated.View style={[styles.iconLayer, { opacity: filamentOpacity }]}>
          <Ionicons name="radio-outline" size={15} color={isDark ? '#FF6B5A' : '#DC2626'} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, styles.iconHotLayer, { opacity: hotFilamentOpacity }]}>
          <Ionicons name="radio" size={15} color="#FFF7ED" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.specularHot, { opacity: specOpacity }]} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.specularStreak,
            {
              opacity: specOpacity,
              transform: [
                {
                  scaleX: blink.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  housing: {
    width: BULB_SIZE,
    height: BULB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steadyHalo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 8,
  },
  outerHalo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 10,
  },
  socketBase: {
    position: 'absolute',
    bottom: 1,
    width: 20,
    height: 7,
    borderRadius: 2,
  },
  socketRing: {
    position: 'absolute',
    bottom: 5,
    width: 22,
    height: 5,
    borderRadius: 2,
  },
  glass: {
    width: BULB_SIZE,
    height: BULB_SIZE,
    borderRadius: BULB_SIZE / 2,
    borderWidth: 1.2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassOff: {
    backgroundColor: 'rgba(28,12,10,0.55)',
  },
  glassLitGreen: {
    backgroundColor: 'rgba(4,47,36,0.72)',
  },
  glassSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  glassWarmTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF8A65',
  },
  innerWarmGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF5722',
    borderRadius: BULB_SIZE / 2,
  },
  coreFilamentGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD180',
    shadowColor: '#FF6D00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  activeCoreGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6EE7B7',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  iconLayer: {
    zIndex: 3,
  },
  iconHotLayer: {
    position: 'absolute',
  },
  specularHot: {
    position: 'absolute',
    top: 5,
    left: 6,
    width: 10,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '-18deg' }],
    zIndex: 4,
  },
  specularStreak: {
    position: 'absolute',
    top: 7,
    left: 8,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
    zIndex: 4,
  },
});
