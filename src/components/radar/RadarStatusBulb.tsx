import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  active: boolean;
  blink: Animated.Value;
  tint: string;
  softBg: string;
};

/** Prosta dioda statusu — czytelna, bez przesadzonej stylizacji. */
export default function RadarStatusBulb({ active, blink, tint, softBg }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: softBg }]}>
      {active ? (
        <Ionicons name="radio" size={17} color={tint} />
      ) : (
        <Animated.View style={{ opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }) }}>
          <Ionicons name="radio-outline" size={17} color={tint} />
        </Animated.View>
      )}
    </View>
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
