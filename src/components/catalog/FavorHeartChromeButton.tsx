import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChromeIconButton from './ChromeIconButton';

type Props = {
  enabled: boolean;
  isDark: boolean;
  lightChrome?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * Top-chrome Favor launcher — opens Favor settings.
 * When Favor is on: pink heart + occasional heartbeat pulse.
 */
export default function FavorHeartChromeButton({
  enabled,
  isDark,
  lightChrome,
  accessibilityLabel,
  onPress,
}: Props) {
  const beat = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      beat.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(beat, {
          toValue: 1.18,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1.12,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 1,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(3200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, enabled]);

  return (
    <View style={styles.wrap}>
      {enabled ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.aura,
            {
              opacity: beat.interpolate({ inputRange: [1, 1.18], outputRange: [0.2, 0.55] }),
              transform: [{ scale: beat }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={enabled ? { transform: [{ scale: beat }] } : undefined}>
        <ChromeIconButton
          icon={enabled ? 'heart' : 'heart-outline'}
          color={enabled ? '#F777B2' : isDark ? '#FFF' : '#1C1C1E'}
          isDark={isDark}
          lightChrome={lightChrome}
          activeBg={enabled ? 'rgba(247,119,178,0.22)' : undefined}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected: enabled }}
          haptic="medium"
          onPress={onPress}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(247,119,178,0.35)',
  },
});
