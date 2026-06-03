import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { fetchOpenHouseTicker } from '../../services/openHouseService';
import type { OpenHouseTickerItem } from '../../contracts/openHouseContract';
import { useI18n, localeToDateFormat } from '../../i18n';

type Props = {
  enabled?: boolean;
};

export default function OpenHouseLiveTicker({ enabled = true }: Props) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const [items, setItems] = useState<OpenHouseTickerItem[]>([]);
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const next = await fetchOpenHouseTicker(token);
      if (cancelled) return;
      setItems(next);
      if (next.length) {
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, token, opacity]);

  useEffect(() => {
    if (!items.length) return;
    translateX.setValue(40);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(5200),
        Animated.timing(translateX, {
          toValue: -40,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) setIndex((prev) => (prev + 1) % items.length);
    });
  }, [index, items, translateX]);

  const active = items[index % Math.max(items.length, 1)];
  const label = useMemo(() => {
    if (!active?.startsAt) {
      return `${active?.city ?? ''} · ${active?.title ?? ''}`.trim();
    }
    const date = new Date(active.startsAt).toLocaleString(localeToDateFormat(locale), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return t('openHouse.ticker.openHouseInvite', {
      city: active.city,
      title: active.title,
      date,
      spots: String(active.spotsLeft),
    });
  }, [active, locale, t]);

  if (!enabled || !items.length || !active) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top: insets.top + 4,
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('openHouse.ticker.tapToReserve')}
        onPress={() => navigation.navigate('OpenHouseEvent', { eventId: active.eventId })}
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.92 }]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(245,158,11,0.95)', 'rgba(180,120,20,0.92)']
              : ['rgba(255,196,60,0.98)', 'rgba(245,158,11,0.95)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.liveDotWrap}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>{t('openHouse.ticker.label')}</Text>
          </View>
          <Animated.Text numberOfLines={1} style={[styles.message, { transform: [{ translateX }] }]}>
            {label}
          </Animated.Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  pressable: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  gradient: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  liveLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
