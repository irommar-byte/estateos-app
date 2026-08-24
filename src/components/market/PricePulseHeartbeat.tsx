import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** ECG / Activity zigzag that beats in a heartbeat rhythm — matches WWW `.eos-ecg-icon`. */
export default function PricePulseHeartbeat({ color, size = 16 }: { color: string; size?: number }) {
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0.15,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(720),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size + 4,
          height: size + 4,
          opacity: beat.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
          transform: [
            {
              scale: beat.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }),
            },
          ],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2 12h3.5l1.8-4.5 2.4 9L13 7.5 15.2 12H22"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
