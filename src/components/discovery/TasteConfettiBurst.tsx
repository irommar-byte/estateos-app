import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#FFFFFF', '#F5F5F7', '#D4D4D8', '#111111', '#D4AF37'];

type Particle = {
  dx: number;
  dy: number;
  rotate: number;
  color: string;
  w: number;
  h: number;
  round: boolean;
};

function makeParticles(seed: number): Particle[] {
  let n = seed || 1;
  const rand = () => {
    n = (n * 16807) % 2147483647;
    return (n - 1) / 2147483646;
  };
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 16 + rand() * 0.5;
    const dist = 22 + rand() * 38;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 8,
      rotate: (rand() - 0.5) * 280,
      color: COLORS[i % COLORS.length],
      w: 3 + rand() * 5,
      h: 2 + rand() * 8,
      round: rand() > 0.62,
    };
  });
}

type Props = {
  nonce: number;
};

/** Luxury burst from the press point — ivory / platinum / ink, not rainbow. */
export default function TasteConfettiBurst({ nonce }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => makeParticles(nonce), [nonce]);

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 740,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [nonce, progress]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {particles.map((p, i) => (
        <Animated.View
          key={`${nonce}-${i}`}
          style={[
            styles.bit,
            {
              width: p.w,
              height: p.h,
              borderRadius: p.round ? 99 : 1,
              backgroundColor: p.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.12, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.dx],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, p.dy],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${p.rotate}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  bit: {
    position: 'absolute',
  },
});
