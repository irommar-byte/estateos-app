import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

type Props = {
  size?: number;
};

/**
 * Złoty diament Investor Pro — mikro-błysk i delikatny oddech, żeby pakiet
 * wyglądał jak najlepszy wybór (zamiast korony).
 */
export default function ProfileGoldCrown({ size = 32 }: Props) {
  const uid = useId().replace(/:/g, '');
  const gBody = `pgd-body-${uid}`;
  const gFacet = `pgd-facet-${uid}`;
  const gShine = `pgd-shine-${uid}`;
  const gCore = `pgd-core-${uid}`;

  const height = Math.round(size * 0.92);
  const breathe = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    const sparkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(spark, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(spark, {
          toValue: 0,
          duration: 680,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ]),
    );
    breatheLoop.start();
    sparkLoop.start();
    return () => {
      breatheLoop.stop();
      sparkLoop.stop();
    };
  }, [breathe, spark]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });
  const sparkOpacity = spark.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });
  const sparkScale = spark.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });

  return (
    <View style={[styles.wrap, { width: size, height }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size * 0.46,
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={height} viewBox="0 0 80 74">
          <Defs>
            <LinearGradient id={gBody} x1="12" y1="8" x2="68" y2="68" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFF8E1" />
              <Stop offset="0.22" stopColor="#FFE082" />
              <Stop offset="0.55" stopColor="#F5C542" />
              <Stop offset="1" stopColor="#B8860B" />
            </LinearGradient>
            <LinearGradient id={gFacet} x1="40" y1="6" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#FFD54F" stopOpacity="0.15" />
            </LinearGradient>
            <LinearGradient id={gShine} x1="18" y1="14" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <RadialGradient id={gCore} cx="46%" cy="38%" rx="55%" ry="55%">
              <Stop offset="0" stopColor="#FFFDE7" />
              <Stop offset="0.45" stopColor="#FFCA28" />
              <Stop offset="1" stopColor="#C9922E" />
            </RadialGradient>
          </Defs>

          <Ellipse cx="40" cy="70" rx="18" ry="2.4" fill="#000000" opacity="0.16" />

          {/* Crown facets → classic diamond silhouette */}
          <Path
            d="M16 26 L28 10 H52 L64 26 L40 66 Z"
            fill={`url(#${gBody})`}
          />
          <Path d="M16 26 L40 66 L28 26 Z" fill="#D4A017" opacity="0.35" />
          <Path d="M64 26 L40 66 L52 26 Z" fill="#8B5A0A" opacity="0.28" />
          <Path d="M28 10 L40 26 L16 26 Z" fill={`url(#${gFacet})`} />
          <Path d="M52 10 L64 26 L40 26 Z" fill={`url(#${gFacet})`} opacity="0.85" />
          <Path d="M28 10 H52 L40 26 Z" fill={`url(#${gCore})`} opacity="0.9" />
          <Path d="M28 26 H52 L40 66 Z" fill={`url(#${gShine})`} />
          <Path
            d="M28 10 H52 L64 26 L40 66 L16 26 Z"
            fill="none"
            stroke="#FFF8DC"
            strokeWidth="1.1"
            opacity="0.55"
          />
          <Path d="M16 26 H64" stroke="#FFF8DC" strokeWidth="0.8" opacity="0.5" />
          <Path d="M28 10 L40 66" stroke="#FFFFFF" strokeWidth="0.55" opacity="0.28" />
          <Path d="M52 10 L40 66" stroke="#7A4E0C" strokeWidth="0.55" opacity="0.22" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.spark,
          {
            opacity: sparkOpacity,
            transform: [{ scale: sparkScale }, { translateX: size * 0.18 }, { translateY: -size * 0.12 }],
          },
        ]}
      >
        <View style={[styles.sparkArmH, { width: size * 0.22, height: 1.5 }]} />
        <View style={[styles.sparkArmV, { width: 1.5, height: size * 0.22 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(245, 197, 66, 0.45)',
  },
  spark: {
    position: 'absolute',
    top: '18%',
    right: '12%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkArmH: {
    position: 'absolute',
    backgroundColor: '#FFFDE7',
    borderRadius: 1,
  },
  sparkArmV: {
    position: 'absolute',
    backgroundColor: '#FFFDE7',
    borderRadius: 1,
  },
});
