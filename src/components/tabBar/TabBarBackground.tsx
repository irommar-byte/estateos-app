import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  isDark: boolean;
};

export default function TabBarBackground({ isDark }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView
        intensity={isDark ? 62 : 78}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? 'rgba(10,10,12,0.55)' : 'rgba(255,255,255,0.55)',
          },
        ]}
      />
    </View>
  );
}

export const TAB_BAR_BASE_HEIGHT = 95;
