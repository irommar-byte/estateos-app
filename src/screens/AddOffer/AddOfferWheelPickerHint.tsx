import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  label: string;
  accent?: string;
  maskColor?: string;
};

/** Animowana podpowiedź „przesuń palcem” na natywnym bębnie iOS. */
export default function AddOfferWheelPickerHint({
  visible,
  label,
  accent = '#10b981',
  maskColor = '#ffffff',
}: Props) {
  const fingerY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) return undefined;
    fingerY.setValue(0);
    pulse.setValue(0.85);
    const moveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fingerY, { toValue: -22, duration: 650, useNativeDriver: true }),
        Animated.timing(fingerY, { toValue: 22, duration: 650, useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
      ]),
    );
    moveLoop.start();
    pulseLoop.start();
    return () => {
      moveLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, fingerY, pulse]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Zakrywa kreski UIPickerView i „‒” w centrum — znika przy pierwszym przewinięciu. */}
      <View style={[styles.centerMask, { backgroundColor: maskColor }]} />
      <Animated.View style={[styles.fingerWrap, { transform: [{ translateY: fingerY }, { scale: pulse }] }]}>
        <Ionicons name="hand-left-outline" size={32} color={accent} />
      </Animated.View>
      <Text style={[styles.label, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fingerWrap: {
    marginBottom: 6,
    zIndex: 1,
    shadowColor: '#10b981',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  centerMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -34,
    height: 68,
    borderRadius: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    zIndex: 1,
  },
});
