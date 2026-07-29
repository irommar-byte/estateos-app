import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Smartphone } from 'lucide-react-native';

type Props = {
  visible: boolean;
};

/**
 * Subtelna podpowiedź: obróć telefon w poziomie, żeby zobaczyć show na pełnym kadrze.
 */
export default function CinemaRotateHint({ visible }: Props) {
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 220 });
      return;
    }
    opacity.value = withTiming(1, { duration: 420 });
    rotate.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(90, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(90, { duration: 500 }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false,
    );
  }, [visible, opacity, rotate]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, wrapStyle]}>
      <View style={styles.card}>
        <Animated.View style={phoneStyle}>
          <Smartphone color="#FFFFFF" size={28} strokeWidth={1.8} />
        </Animated.View>
        <Text style={styles.title}>Obróć telefon</Text>
        <Text style={styles.sub}>Poziomo zobaczysz pełny kadr zdjęcia</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 56,
  },
  card: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
