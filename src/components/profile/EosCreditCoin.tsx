import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  size?: number;
  /** Okresowy obrót 3D — tylko gdy lit/autoSpin. */
  autoSpin?: boolean;
  /** false = czarno-biała moneta, bez ruchu. */
  lit?: boolean;
};

/**
 * Złota moneta EOS — idle + obrót gdy `lit`; szara/statyczna gdy brak kredytów.
 */
export default function EosCreditCoin({ size = 36, autoSpin = true, lit = true }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const live = lit && autoSpin;

  useEffect(() => {
    if (!live) {
      spin.setValue(0);
      float.setValue(0);
      return;
    }
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    floatLoop.start();

    const spinLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(3800),
        Animated.timing(spin, {
          toValue: 1,
          duration: 1400,
          easing: Easing.bezier(0.45, 0.05, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    spinLoop.start();

    return () => {
      floatLoop.stop();
      spinLoop.stop();
    };
  }, [live, float, spin]);

  const rotateY = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1.5],
  });
  const brandSize = Math.max(7, Math.round(size * 0.22));
  const subSize = Math.max(5, Math.round(size * 0.16));

  const colors = lit
    ? (['#FFF9E6', '#FDE68A', '#EAB308', '#CA8A04', '#FBBF24'] as const)
    : (['#F2F2F7', '#E5E5EA', '#C7C7CC', '#8E8E93', '#AEAEB2'] as const);

  return (
    <View style={[styles.scene, { width: size, height: size }, !lit && styles.sceneDim]} pointerEvents="none">
      <Animated.View
        style={[
          styles.coin,
          {
            width: size,
            height: size,
            transform: live
              ? [{ perspective: 480 }, { translateY }, { rotateY }]
              : [{ perspective: 480 }],
          },
        ]}
      >
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.95 }}
          style={[
            styles.face,
            {
              borderRadius: size / 2,
              borderColor: lit ? 'rgba(234, 179, 8, 0.65)' : 'rgba(142,142,147,0.45)',
              shadowOpacity: lit ? 0.28 : 0.08,
            },
          ]}
        >
          <View
            style={[
              styles.rim,
              {
                borderRadius: size / 2,
                borderColor: lit ? 'rgba(146, 64, 14, 0.35)' : 'rgba(99,99,102,0.35)',
              },
            ]}
          />
          <Text style={[styles.brand, { fontSize: brandSize, color: lit ? '#78350F' : '#3A3A3C' }]}>EOS</Text>
          <Text style={[styles.sub, { fontSize: subSize, color: lit ? '#713F12' : '#636366' }]}>PLUS</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneDim: {
    opacity: 0.9,
  },
  coin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
  },
  brand: {
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  sub: {
    marginTop: 1,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
