import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  active: boolean;
  blink: Animated.Value;
  tint: string;
  softBg: string;
};

/** Czytelna dioda statusu — wyraźne mruganie gdy Radar nieaktywny. */
export default function RadarStatusBulb({ active, blink, tint, softBg }: Props) {
  if (active) {
    return (
      <View style={[styles.wrap, { backgroundColor: softBg }]}>
        <Ionicons name="radio" size={17} color={tint} />
      </View>
    );
  }

  const iconOpacity = blink.interpolate({
    inputRange: [0, 0.06, 1],
    outputRange: [0, 0, 1],
  });
  const badgeOpacity = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 1],
  });

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: softBg, opacity: badgeOpacity }]}>
      <Animated.View style={{ opacity: iconOpacity }}>
        <Ionicons name="radio-outline" size={17} color={tint} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
