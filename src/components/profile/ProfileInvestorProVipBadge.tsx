import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  size?: number;
};

export default function ProfileInvestorProVipBadge({ size = 36 }: Props) {
  const shimmerX = useSharedValue(-1);
  const glow = useSharedValue(0.55);
  const sparkleSeq = useRef(0);
  const [sparkles, setSparkles] = useState<Array<{ id: string; x: number; y: number }>>([]);

  const radius = Math.round(size * 0.28);
  const fontSize = Math.max(10, Math.round(size * 0.3));
  const symbolSize = Math.max(11, Math.round(size * 0.34));

  const spawnSparkleBurst = (count = 3) => {
    const batch = Array.from({ length: count }, () => {
      sparkleSeq.current += 1;
      return {
        id: `vip-sparkle-${sparkleSeq.current}`,
        x: (Math.random() - 0.5) * size * 0.9,
        y: (Math.random() - 0.5) * size * 0.9,
      };
    });
    setSparkles((prev) => [...prev.slice(-8), ...batch]);
    for (const sparkle of batch) {
      setTimeout(() => {
        setSparkles((prev) => prev.filter((s) => s.id !== sparkle.id));
      }, 900);
    }
  };

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1.4, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    const firstSparkle = setTimeout(() => spawnSparkleBurst(3), 900);
    const sparkleTimer = setInterval(() => spawnSparkleBurst(3), 5200);
    return () => {
      clearTimeout(firstSparkle);
      clearInterval(sparkleTimer);
    };
  }, [glow, shimmerX, size]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * size * 0.55 }, { skewX: '-16deg' }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.glowRing,
          glowStyle,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: radius + 4,
          },
        ]}
      />

      {sparkles.map((sparkle) => (
        <View
          key={sparkle.id}
          style={[
            styles.sparkle,
            { transform: [{ translateX: sparkle.x }, { translateY: sparkle.y }] },
          ]}
        >
          <Ionicons name="sparkles" size={Math.max(10, size * 0.28)} color="#FFF3BF" />
        </View>
      ))}

      <View style={[styles.medallion, { width: size, height: size, borderRadius: radius }]}>
        <LinearGradient
          colors={['#FFF4C2', '#FFD95A', '#E8AE1C', '#B8860B']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        <View style={[styles.innerBevel, { borderRadius: radius }]} />
        <Animated.View style={[styles.shimmerBeam, { width: size * 0.42, borderRadius: radius }, shimmerStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.35)',
              'rgba(255,255,255,0.92)',
              'rgba(255,255,255,0.35)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.content}>
          <Text style={[styles.vipText, { fontSize }]}>VIP</Text>
          <View style={[styles.dollarChip, { minWidth: symbolSize + 6, height: symbolSize + 4, borderRadius: (symbolSize + 4) / 2 }]}>
            <Text style={[styles.dollarText, { fontSize: symbolSize * 0.82 }]}>$</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: 'rgba(245,158,11,0.28)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 6,
  },
  medallion: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(184,134,11,0.55)',
    shadowColor: '#8B5A0A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  innerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.55)',
    borderBottomColor: 'rgba(120,72,8,0.35)',
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightColor: 'rgba(120,72,8,0.2)',
  },
  shimmerBeam: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: '50%',
    marginLeft: '-21%',
    opacity: 0.95,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    zIndex: 2,
  },
  vipText: {
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#5C3D05',
    textShadowColor: 'rgba(255,248,220,0.85)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  dollarChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'rgba(92,61,5,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(92,61,5,0.22)',
  },
  dollarText: {
    fontWeight: '900',
    color: '#3D2803',
    marginTop: -1,
  },
  sparkle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -6,
    marginTop: -6,
    zIndex: 4,
    opacity: 0.95,
  },
});
