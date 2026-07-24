import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  active: boolean;
  blink: Animated.Value;
  tint: string;
  softBg: string;
};

/**
 * Dioda statusu Live Radar.
 * Nieaktywna (czerwona) mruga jak kierunkowskaz w aucie — ostre ON/OFF.
 */
export default function RadarStatusBulb({ active, blink, tint, softBg }: Props) {
  if (active) {
    return (
      <Animated.View style={[styles.wrap, { backgroundColor: softBg }]}>
        <Ionicons name="radio" size={17} color={tint} />
      </Animated.View>
    );
  }

  // Kierunkowskaz: pełna jasność ↔ prawie zgaszona (bez miękkiego fade).
  const bulbOpacity = blink.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0.12, 0.12, 1, 1],
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: softBg,
          opacity: bulbOpacity,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tint,
        },
      ]}
    >
      <Ionicons name="radio" size={17} color={tint} />
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
