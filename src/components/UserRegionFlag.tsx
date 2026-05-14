import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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
};

/**
 * „Powiewająca” flaga regionu — badge przy awatarze (lekki swing + głębia cieniem).
 */
export default function UserRegionFlag({
  phone,
  fallbackIso = 'PL',
  size = 32,
  animated = true,
}: Props) {
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

  const rotateZ = swing.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
  const translateY = swing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -2, 0] });
  const scale = swing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] });

  const fontSize = Math.round(size * 0.72);

  return (
    <View style={[styles.wrap, { width: size + 6, height: size + 6 }]} pointerEvents="none">
      <View style={[styles.perspective, { width: size + 6, height: size + 6 }]}>
        <Animated.View
          style={[
            styles.flagFace,
            {
              width: size,
              height: size,
              borderRadius: size * 0.22,
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 5,
  },
  emoji: {
    textAlign: 'center',
  },
});
