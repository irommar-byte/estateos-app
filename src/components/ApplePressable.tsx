import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SPRING = { damping: 16, stiffness: 420, mass: 0.55 };
const RELEASE_SPRING = { damping: 14, stiffness: 280, mass: 0.7 };

type HapticKind = 'none' | 'selection' | 'light' | 'medium';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Skala przy wciśnięciu — Apple: ~0.96–0.98. */
  pressScale?: number;
  haptic?: HapticKind;
};

async function fireHaptic(kind: HapticKind) {
  if (kind === 'none') return;
  if (kind === 'selection') {
    await Haptics.selectionAsync();
    return;
  }
  await Haptics.impactAsync(
    kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
  );
}

/**
 * Uniwersalny przycisk z mikroanimacją skali (Apple spring).
 */
export default function ApplePressable({
  style,
  pressScale = 0.965,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      scale.value = withSpring(pressScale, PRESS_SPRING);
      onPressIn?.(e);
    },
    [onPressIn, pressScale, scale],
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      scale.value = withSpring(1, RELEASE_SPRING);
      onPressOut?.(e);
    },
    [onPressOut, scale],
  );

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      if (disabled) return;
      void fireHaptic(haptic);
      onPress?.(e);
    },
    [disabled, haptic, onPress],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
