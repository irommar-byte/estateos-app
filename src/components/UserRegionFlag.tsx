import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import type { CountryCode } from 'libphonenumber-js';
import { flagEmojiFromIso2, inferCountryFromPhone } from '../utils/phoneRegions';

type Props = {
  /** Dowolny zapis z profilu / API (E.164, z spacjami, legacy). */
  phone?: string | null;
  /** Gdy numeru nie ma lub nie da się sparsować — np. region urządzenia lub PL. */
  fallbackIso?: CountryCode;
  size?: number;
  /** Wyłącz animację (np. na liście wielu kart). */
  animated?: boolean;
  /** Motyw z ekranu nadrzędnego — steruje tintem szkła (soczewka). */
  isDark?: boolean;
};

/**
 * Flaga regionu na „szkle” (Blur) — emoji pozostaje normalne, tło przeźroczyste
 * zamiast białej płyty; delikatny swing jak chorągiewka.
 */
export default function UserRegionFlag({
  phone,
  fallbackIso = 'PL',
  size = 32,
  animated = true,
  isDark: isDarkProp,
}: Props) {
  const systemScheme = useColorScheme();
  const isDark = isDarkProp ?? systemScheme === 'dark';
  const iso = useMemo(() => inferCountryFromPhone(phone, fallbackIso), [phone, fallbackIso]);
  const emoji = flagEmojiFromIso2(iso);
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 2100, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: 2100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, swing]);

  const rotateZ = swing.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  const translateY = swing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -1.5, 0] });
  const scale = swing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });

  const fontSize = Math.round(size * 0.72);
  const radius = size * 0.28;
  const blurTint = isDark ? 'dark' : 'light';
  const borderGlass = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.65)';
  const veil = isDark ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.14)';

  return (
    <View style={[styles.wrap, { width: size + 6, height: size + 6 }]} pointerEvents="none">
      <View style={[styles.perspective, { width: size + 6, height: size + 6 }]}>
        <Animated.View
          style={[
            styles.flagFace,
            {
              width: size,
              height: size,
              borderRadius: radius,
              overflow: 'hidden',
              borderColor: borderGlass,
              transform: animated
                ? ([
                    { rotateZ: rotateZ as any },
                    { translateY: translateY as any },
                    { scale: scale as any },
                  ] as const)
                : undefined,
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? (isDark ? 42 : 36) : 28}
            tint={blurTint}
            style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { borderRadius: radius, backgroundColor: veil }]}
          />
          <Text style={[styles.emoji, { fontSize, lineHeight: fontSize + 2 }]} allowFontScaling={false}>
            {emoji}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  perspective: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagFace: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  emoji: {
    textAlign: 'center',
    zIndex: 2,
  },
});
