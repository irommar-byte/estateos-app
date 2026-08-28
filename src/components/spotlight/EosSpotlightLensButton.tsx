import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  active?: boolean;
  size?: number;
};

export default function EosSpotlightLensButton({ active = false, size = 38 }: Props) {
  const float = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  useEffect(() => {
    Animated.timing(tilt, {
      toValue: active ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, tilt]);

  const ringSize = size;
  const glassSize = size - 6;
  const iconSize = Math.round(size * 0.42);

  return (
    <Animated.View
      style={{
        width: ringSize,
        height: ringSize,
        transform: [
          {
            translateY: float.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -1.5],
            }),
          },
          {
            rotateX: tilt.interpolate({
              inputRange: [0, 1],
              outputRange: ['8deg', '14deg'],
            }),
          },
          {
            rotateZ: tilt.interpolate({
              inputRange: [0, 1],
              outputRange: ['-4deg', '-10deg'],
            }),
          },
          {
            scale: tilt.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.05],
            }),
          },
        ],
      }}
    >
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
      <View
        style={[
          styles.glass,
          {
            width: glassSize,
            height: glassSize,
            borderRadius: glassSize / 2,
            top: 3,
            left: 3,
          },
        ]}
      >
        <Ionicons name="search" size={iconSize} color="#0f172a" style={{ opacity: 0.82 }} />
        <View style={styles.shine} />
      </View>
      <View style={styles.handle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    backgroundColor: '#cbd5e1',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  glass: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(248,250,252,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  shine: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: '42%',
    height: '34%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  handle: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#64748b',
    transform: [{ rotate: '38deg' }],
  },
});
