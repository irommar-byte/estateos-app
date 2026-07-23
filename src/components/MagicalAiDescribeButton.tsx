import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type MagicalAiDescribeButtonProps = {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Siri-like rainbow border + shimmer CTA for AI listing copy. */
export default function MagicalAiDescribeButton({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  onPress,
}: MagicalAiDescribeButtonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 320],
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [{ opacity: pressed || busy || disabled ? 0.82 : 1 }]}
    >
      <View style={styles.outer}>
        <LinearGradient
          colors={['#FF375F', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#BF5AF2', '#FF375F']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.inner}>
          <Animated.View
            pointerEvents="none"
            style={[styles.shimmerSweep, { transform: [{ translateX }] }]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shimmerBar}
            />
          </Animated.View>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.label} numberOfLines={2}>
            {busy ? busyLabel || label : label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    padding: 2,
    overflow: 'hidden',
  },
  inner: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(12,12,18,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  shimmerSweep: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  shimmerBar: {
    width: 72,
    height: '100%',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
});
