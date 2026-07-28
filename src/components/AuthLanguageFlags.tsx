import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '../i18n';
import type { AppLocale } from '../i18n/types';
import LanguageLocaleFlag, { type LanguageFlagId } from './LanguageLocaleFlag';
import { getDeviceAppLocale, useAppLocaleStore } from '../store/useAppLocaleStore';
import { useThemeStore } from '../store/useThemeStore';

const LOCALES: AppLocale[] = ['pl', 'en', 'ru'];

const FLAG_BY_LOCALE: Record<AppLocale, LanguageFlagId> = {
  pl: 'pl',
  en: 'en',
  ru: 'ru',
};

const ACCENT_BY_LOCALE: Record<AppLocale, string> = {
  pl: '#DC143C',
  en: '#012169',
  ru: '#0039A6',
};

type Props = {
  isDark?: boolean;
};

/** Trzy flagi języków na ekranie logowania / rejestracji (bez opcji „system”). */
export default function AuthLanguageFlags({ isDark }: Props) {
  const { t } = useI18n();
  const preference = useAppLocaleStore((s) => s.preference);
  const setPreference = useAppLocaleStore((s) => s.setPreference);
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const sliderX = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const themeSpin = useRef(new Animated.Value(0)).current;

  const activeLocale: AppLocale =
    preference === 'pl' || preference === 'en' || preference === 'ru'
      ? preference
      : getDeviceAppLocale();
  const activeIndex = Math.max(0, LOCALES.indexOf(activeLocale));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sliderX, {
        toValue: activeIndex * (50 + 10),
        damping: 18,
        stiffness: 220,
        mass: 0.72,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [activeIndex, glow, sliderX]);

  useEffect(() => {
    Animated.timing(themeSpin, {
      toValue: themeMode === 'dark' ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [themeMode, themeSpin]);

  const themeRotate = useMemo(
    () => themeSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
    [themeSpin],
  );
  const themeSunOpacity = useMemo(
    () => themeSpin.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [themeSpin],
  );
  const themeMoonOpacity = useMemo(
    () => themeSpin.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    [themeSpin],
  );

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.group,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
          },
        ]}
        accessibilityRole="radiogroup"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sliderGlow,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }),
              transform: [{ translateX: sliderX }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slider,
            {
              transform: [{ translateX: sliderX }],
              backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
              borderColor: ACCENT_BY_LOCALE[activeLocale],
            },
          ]}
        />
        {LOCALES.map((locale) => {
          const active = activeLocale === locale;
          return (
            <Pressable
              key={locale}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`profile.language.labels.${locale}`)}
              onPress={() => {
                if (active) return;
                void Haptics.selectionAsync();
                void setPreference(locale);
              }}
              style={({ pressed }) => [styles.chip, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <LanguageLocaleFlag id={FLAG_BY_LOCALE[locale]} size={active ? 24 : 22} active={active} isDark={isDark} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onPress={() => {
          void Haptics.selectionAsync();
          setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
        }}
        style={({ pressed }) => [
          styles.themeChip,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)',
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
          },
          pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: themeRotate }] }}>
          <Animated.View style={[styles.themeIconLayer, { opacity: themeSunOpacity }]}>
            <Ionicons name="sunny" size={17} color="#F59E0B" />
          </Animated.View>
          <Animated.View style={[styles.themeIconLayerAbsolute, { opacity: themeMoonOpacity }]}>
            <Ionicons name="moon" size={17} color={isDark ? '#C4B5FD' : '#4F46E5'} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 0,
    paddingVertical: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  slider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 50,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  sliderGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 50,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FF2D55',
  },
  chip: {
    width: 50,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  themeChip: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIconLayerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
