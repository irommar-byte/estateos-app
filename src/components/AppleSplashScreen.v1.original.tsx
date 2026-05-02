import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Image, Text, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
  withRepeat,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// --- PARTICLES ---
const Particle = ({ startX, startY, size, duration, delay }: any) => {
  const translateY = useSharedValue(startY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(Math.random() * 0.3 + 0.1, { duration: 2000 }));
    translateY.value = withRepeat(
      withTiming(startY - 300, { duration, easing: Easing.linear }),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        { left: startX, width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
};

export default function AppleSplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-width);

  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  const contentOpacity = useSharedValue(1);
  const doorOpen = useSharedValue(0);

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        startX: Math.random() * width,
        startY: Math.random() * height + 100,
        size: Math.random() * 3 + 2,
        duration: 10000 + Math.random() * 10000,
        delay: Math.random() * 2000,
      })),
    []
  );

  // 🔊 SOUND
  const playDoorSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/door.mp3')
      );
      await sound.playAsync();
    } catch (e) {}
  };

  useEffect(() => {
    // LOGO
    logoOpacity.value = withDelay(500, withTiming(1, { duration: 1500 }));
    logoScale.value = withDelay(
      500,
      withSpring(1, { damping: 14, stiffness: 40 })
    );

    // SHIMMER
    shimmerX.value = withDelay(
      2000,
      withTiming(width * 1.2, {
        duration: 2000,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      })
    );

    // TEXT
    textOpacity.value = withDelay(3200, withTiming(1, { duration: 1200 }));
    textTranslateY.value = withDelay(3200, withTiming(0, { duration: 1200 }));

    // FADE
    contentOpacity.value = withDelay(6000, withTiming(0, { duration: 300 }));

    // 🔊 SOUND + HAPTIC
    setTimeout(() => {
      playDoorSound();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 6400);

    // DOORS
    doorOpen.value = withDelay(
      6400,
      withTiming(1, {
        duration: 1200,
        easing: Easing.bezier(0.65, 0, 0.05, 1),
      }, (f) => {
        if (f) runOnJS(onFinish)();
      })
    );
  }, []);

  const leftDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -doorOpen.value * (width / 2 + 50) }],
  }));

  const rightDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: doorOpen.value * (width / 2 + 50) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { rotate: '20deg' }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* DOORS */}
      <Animated.View style={[styles.doorLeft, leftDoorStyle]} />
      <Animated.View style={[styles.doorRight, rightDoorStyle]} />

      {/* CONTENT */}
      <Animated.View style={contentStyle} pointerEvents="none">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}

        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <View style={styles.shimmerContainer}>
            <Animated.View style={[styles.shimmerBeam, shimmerStyle]} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textWrapper, textStyle]}>
          <Text style={styles.taglineMain}>TWÓJ OSOBISTY RADAR</Text>
          <Text style={styles.taglineSub}>Natychmiastowe powiadomienia</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },

  doorLeft: {
    position: 'absolute',
    left: 0,
    width: width / 2,
    height: '100%',
    backgroundColor: '#000',
  },

  doorRight: {
    position: 'absolute',
    right: 0,
    width: width / 2,
    height: '100%',
    backgroundColor: '#000',
  },

  particle: {
    position: 'absolute',
    backgroundColor: '#fff',
  },

  logoWrapper: {
    width: 320,
    height: 320,
  },

  logoImage: {
    width: '100%',
    height: '100%',
  },

  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  shimmerBeam: {
    width: 120,
    height: '200%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    position: 'absolute',
    top: '-50%',
  },

  textWrapper: {
    marginTop: 30,
    alignItems: 'center',
  },

  taglineMain: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 4,
  },

  taglineSub: {
    color: '#888',
    fontSize: 11,
  },
});
