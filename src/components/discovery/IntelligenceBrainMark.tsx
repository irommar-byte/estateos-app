import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain } from 'lucide-react-native';
import {
  INTELLIGENCE_BRAIN_GLYPH,
  INTELLIGENCE_BRAIN_GLYPH_SOFT,
  INTELLIGENCE_BRAIN_OFF,
  INTELLIGENCE_OIL,
} from '../../lib/discovery/intelligenceBrand';

type Props = {
  size?: number;
  /** When false, quiet grey brain on dark chip (profile-style). */
  living?: boolean;
  /** Soft white glyph (better on bright UI). */
  softGlyph?: boolean;
};

/**
 * Canonical Intelligence mark — white brain on Siri oil swirl (same DNA as the launcher).
 */
export default function IntelligenceBrainMark({
  size = 36,
  living = true,
  softGlyph = false,
}: Props) {
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!living) {
      breathe.setValue(0);
      spin.setValue(0);
      return;
    }
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 7200,
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
  }, [breathe, living, spin]);

  const swirlScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const radius = size / 2;
  const iconSize = Math.round(size * 0.48);
  const glyph = softGlyph ? INTELLIGENCE_BRAIN_GLYPH_SOFT : INTELLIGENCE_BRAIN_GLYPH;

  if (!living) {
    return (
      <View style={[styles.off, { width: size, height: size, borderRadius: radius }]}>
        <Brain size={iconSize} color={INTELLIGENCE_BRAIN_OFF} strokeWidth={2.2} />
      </View>
    );
  }

  return (
    <View style={[styles.on, { width: size, height: size, borderRadius: radius }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swirl,
          {
            width: size * 1.7,
            height: size * 1.7,
            transform: [{ scale: swirlScale }, { rotate }],
          },
        ]}
      >
        <LinearGradient
          colors={[...INTELLIGENCE_OIL]}
          start={{ x: 0, y: 0.1 }}
          end={{ x: 1, y: 0.9 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.28)', 'transparent', 'rgba(0,0,0,0.22)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.glyph}>
        <Brain size={iconSize} color={glyph} strokeWidth={2.3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  off: {
    backgroundColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  on: {
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  swirl: {
    position: 'absolute',
  },
  glyph: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
