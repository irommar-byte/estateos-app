import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useI18n } from '../i18n';
import type { AppLocale } from '../i18n/types';
import LanguageLocaleFlag, { type LanguageFlagId } from './LanguageLocaleFlag';
import { getDeviceAppLocale, useAppLocaleStore } from '../store/useAppLocaleStore';

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

  const activeLocale: AppLocale =
    preference === 'pl' || preference === 'en' || preference === 'ru'
      ? preference
      : getDeviceAppLocale();

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {LOCALES.map((locale) => {
        const active = activeLocale === locale;
        const accent = ACCENT_BY_LOCALE[locale];
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
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active
                  ? isDark
                    ? 'rgba(255,255,255,0.14)'
                    : '#FFFFFF'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(255,255,255,0.72)',
                borderColor: active ? accent : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                shadowColor: active ? accent : '#000',
                shadowOpacity: active ? 0.28 : 0.08,
              },
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
          >
            <LanguageLocaleFlag
              id={FLAG_BY_LOCALE[locale]}
              size={active ? 24 : 22}
              active={active}
              isDark={isDark}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    width: 50,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
});
