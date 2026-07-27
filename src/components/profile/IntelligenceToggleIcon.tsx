import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain } from 'lucide-react-native';

const SIRI_COLORS = [
  '#FF2D55',
  '#FF375F',
  '#BF5AF2',
  '#5E5CE6',
  '#64D2FF',
  '#30D158',
  '#FFD60A',
  '#FF9F0A',
  '#FF2D55',
] as const;

type Props = {
  enabled: boolean;
  size?: number;
};

/**
 * Profile Intelligence toggle glyph — quiet grey brain off,
 * Siri-style rainbow glow when EstateOS™ Inteligence is on.
 */
export default function IntelligenceToggleIcon({ enabled, size = 36 }: Props) {
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      breathe.setValue(0);
      spin.setValue(0);
      shimmer.setValue(0);
      return;
    }

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    breatheLoop.start();
    spinLoop.start();
    shimmerLoop.start();
    return () => {
      breatheLoop.stop();
      spinLoop.stop();
      shimmerLoop.stop();
    };
  }, [breathe, enabled, shimmer, spin]);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const brainScale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  if (!enabled) {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <Brain size={Math.round(size * 0.55)} color="#8E8E93" strokeWidth={2.2} />
      </View>
    );
  }

  return (
    <View style={[styles.host, { width: size + 10, height: size + 10 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            width: size + 14,
            height: size + 14,
            borderRadius: (size + 14) / 2,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }, { rotate }],
          },
        ]}
      >
        <LinearGradient
          colors={[...SIRI_COLORS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
            transform: [{ rotate }],
          },
        ]}
      >
        <LinearGradient
          colors={['#FF2D55', '#BF5AF2', '#64D2FF', '#30D158', '#FFD60A', '#FF2D55']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            transform: [{ scale: brainScale }],
          },
        ]}
      >
        <LinearGradient
          colors={['#1C1C1E', '#2C2C2E']}
          style={StyleSheet.absoluteFillObject}
        />
        <Brain size={Math.round(size * 0.55)} color="#F5F5F7" strokeWidth={2.35} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    overflow: 'hidden',
    opacity: 0.9,
  },
  core: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
