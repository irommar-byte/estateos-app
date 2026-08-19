import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { ACQUISITION_GUIDE_STEPS } from '../../lib/acquisitionOfferReady';

export default function AcquisitionGuideChrome({
  step,
  hasError,
  isDark,
}: {
  step: number;
  hasError?: boolean;
  isDark?: boolean;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevStep = useRef(step);
  const guide = ACQUISITION_GUIDE_STEPS.find((item) => item.id === step) || ACQUISITION_GUIDE_STEPS[0];
  const titleColor = hasError ? '#FF3B30' : isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? '#8E8E93' : '#6C6C70';

  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, step]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.kicker, { color: hasError ? '#FF3B30' : '#34C759' }]}>
        KROK {step} Z {ACQUISITION_GUIDE_STEPS.length}
      </Text>
      <Text style={[styles.title, { color: titleColor }]}>{guide.title}</Text>
      <Text style={[styles.question, { color: muted }]}>{guide.question}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 18,
    marginTop: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  question: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
});
