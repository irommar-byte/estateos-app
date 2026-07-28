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
  /** false = bez mikro-animacji (np. nieaktywny baner). */
  animate?: boolean;
  /** Desaturowany diament (szary). */
  muted?: boolean;
};

/**
 * Złoty diament Investor Pro — mikro-błysk i delikatny oddech.
 */
export default function ProfileGoldCrown({ size = 32, animate = true, muted = false }: Props) {
  const uid = useId().replace(/:/g, '');
  const gBody = `pgd-body-${uid}`;
  const gFacet = `pgd-facet-${uid}`;
  const gShine = `pgd-shine-${uid}`;
  const gCore = `pgd-core-${uid}`;

  const height = Math.round(size * 0.92);
  const breathe = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      breathe.setValue(0);
      spark.setValue(0);
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
  }, [animate, breathe, spark]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });
  const sparkOpacity = spark.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });
  const sparkScale = spark.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });

  const bodyStops = muted
    ? [
        { offset: '0', color: '#F5F5F7' },
        { offset: '0.22', color: '#D1D1D6' },
        { offset: '0.55', color: '#8E8E93' },
        { offset: '1', color: '#636366' },
      ]
    : [
        { offset: '0', color: '#FFF8E1' },
        { offset: '0.22', color: '#FFE082' },
        { offset: '0.55', color: '#F5C542' },
        { offset: '1', color: '#B8860B' },
      ];

  return (
    <View style={[styles.wrap, { width: size, height }, muted && styles.wrapMuted]} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size * 0.46,
            opacity: muted ? 0.08 : glowOpacity,
            backgroundColor: muted ? 'rgba(142,142,147,0.35)' : 'rgba(245, 197, 66, 0.45)',
            transform: [{ scale: animate ? scale : 1 }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: animate ? scale : 1 }] }}>
        <Svg width={size} height={height} viewBox="0 0 80 74">
          <Defs>
            <LinearGradient id={gBody} x1="12" y1="8" x2="68" y2="68" gradientUnits="userSpaceOnUse">
              {bodyStops.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
            <LinearGradient id={gFacet} x1="40" y1="6" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={muted ? '0.35' : '0.85'} />
              <Stop offset="1" stopColor={muted ? '#AEAEB2' : '#FFD54F'} stopOpacity="0.15" />
            </LinearGradient>
            <LinearGradient id={gShine} x1="18" y1="14" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={muted ? '0.25' : '0.7'} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <RadialGradient id={gCore} cx="46%" cy="38%" rx="55%" ry="55%">
              <Stop offset="0" stopColor={muted ? '#F2F2F7' : '#FFFDE7'} />
              <Stop offset="0.45" stopColor={muted ? '#C7C7CC' : '#FFCA28'} />
              <Stop offset="1" stopColor={muted ? '#8E8E93' : '#C9922E'} />
            </RadialGradient>
          </Defs>

          <Ellipse cx="40" cy="70" rx="18" ry="2.4" fill="#000000" opacity="0.16" />

          <Path d="M16 26 L28 10 H52 L64 26 L40 66 Z" fill={`url(#${gBody})`} />
          <Path d="M16 26 L40 66 L28 26 Z" fill={muted ? '#8E8E93' : '#D4A017'} opacity="0.35" />
          <Path d="M64 26 L40 66 L52 26 Z" fill={muted ? '#636366' : '#8B5A0A'} opacity="0.28" />
          <Path d="M28 10 L40 26 L16 26 Z" fill={`url(#${gFacet})`} />
          <Path d="M52 10 L64 26 L40 26 Z" fill={`url(#${gFacet})`} opacity="0.85" />
          <Path d="M28 10 H52 L40 26 Z" fill={`url(#${gCore})`} opacity="0.9" />
          <Path d="M28 26 H52 L40 66 Z" fill={`url(#${gShine})`} />
          <Path
            d="M28 10 H52 L64 26 L40 66 L16 26 Z"
            fill="none"
            stroke={muted ? '#E5E5EA' : '#FFF8DC'}
            strokeWidth="1.1"
            opacity="0.55"
          />
          <Path d="M16 26 H64" stroke={muted ? '#E5E5EA' : '#FFF8DC'} strokeWidth="0.8" opacity="0.5" />
          <Path d="M28 10 L40 66" stroke="#FFFFFF" strokeWidth="0.55" opacity="0.28" />
          <Path d="M52 10 L40 66" stroke={muted ? '#636366' : '#7A4E0C'} strokeWidth="0.55" opacity="0.22" />
        </Svg>
      </Animated.View>
      {animate ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapMuted: {
    opacity: 0.92,
  },
  glow: {
    position: 'absolute',
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
