import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Sprężyste rozwinięcie / zwinięcie z lekkim „galaretowym” kołysaniem — jak pill Radaru. */
export default function JellyReveal({ visible, children, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    progress.stopAnimation();
    wobble.stopAnimation();

    if (visible) {
      setMounted(true);
      progress.setValue(0);
      wobble.setValue(0);
      Animated.parallel([
        Animated.spring(progress, {
          toValue: 1,
          friction: 6,
          tension: 118,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(wobble, {
            toValue: 1,
            friction: 4,
            tension: 210,
            useNativeDriver: true,
          }),
          Animated.spring(wobble, {
            toValue: 0,
            friction: 5,
            tension: 130,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      return;
    }

    if (!mounted) return;

    Animated.parallel([
      Animated.spring(progress, {
        toValue: 0,
        friction: 9,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.spring(wobble, {
        toValue: 0,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [mounted, progress, visible, wobble]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.72, 1],
  });
  const rotateZ = wobble.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: ['0deg', '-2.8deg', '2.2deg'],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }, { scale }, { rotateZ }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
