import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  tint?: string;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function DiscoveryGlassOrb({
  children,
  onPress,
  accessibilityLabel,
  size = 58,
  tint = DISCOVERY_COLORS.glassDark,
  style,
  disabled = false,
}: Props) {
  return (
    <ApplePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={[styles.touch, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.45 : 1 }, style]}
      haptic="light"
    >
      <BlurView intensity={52} tint="dark" style={[styles.blur, { borderRadius: size / 2, backgroundColor: tint }]}>
        {children}
      </BlurView>
    </ApplePressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DISCOVERY_COLORS.glassBorder,
  },
  blur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
