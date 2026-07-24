import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  isDark: boolean;
  lightChrome?: boolean;
  activeBg?: string;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  style?: StyleProp<ViewStyle>;
  haptic?: 'none' | 'selection' | 'light' | 'medium';
};

/** Okrągły przycisk glass w top barze Market — ze springiem przy nacisku. */
export default function ChromeIconButton({
  icon,
  color,
  onPress,
  isDark,
  lightChrome = false,
  activeBg,
  accessibilityLabel,
  accessibilityState,
  style,
  haptic = 'light',
}: Props) {
  return (
    <ApplePressable
      onPress={onPress}
      haptic={haptic}
      pressScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[styles.wrap, lightChrome && styles.wrapLight, style]}
    >
      <BlurView
        intensity={lightChrome ? 96 : isDark ? 80 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.glass, lightChrome && styles.glassLight, activeBg ? { backgroundColor: activeBg } : null]}
      >
        <Ionicons name={icon} size={22} color={color} />
      </BlurView>
    </ApplePressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  wrapLight: {
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  glass: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  glassLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
});
