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
 * Siri-style rainbow swirl inside the badge when EstateOS™ Intelligence is on.
 */
export default function IntelligenceToggleIcon({ enabled, size = 36 }: Props) {
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      breathe.setValue(0);
      spin.setValue(0);
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

    breatheLoop.start();
    spinLoop.start();
    return () => {
      breatheLoop.stop();
      spinLoop.stop();
    };
  }, [breathe, enabled, spin]);

  const swirlScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const radius = size * 0.28;

  if (!enabled) {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: radius }]}>
        <Brain size={Math.round(size * 0.55)} color="#8E8E93" strokeWidth={2.2} />
      </View>
    );
  }

  return (
    <View style={[styles.boxOn, { width: size, height: size, borderRadius: radius }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swirl,
          {
            width: size * 1.65,
            height: size * 1.65,
            opacity: 0.95,
            transform: [{ scale: swirlScale }, { rotate }],
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

      <View style={styles.brainLayer}>
        <Brain size={Math.round(size * 0.55)} color="#F5F5F7" strokeWidth={2.35} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxOn: {
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  swirl: {
    position: 'absolute',
  },
  brainLayer: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
