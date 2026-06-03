import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type TextStyle,
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

const ROTATE_MS = 9000;
const MARQUEE_PX_PER_SEC = 42;

function truncateMiddle(text: string, max: number): string {
  const s = text.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function TickerMarquee({ text, style }: { text: string; style: TextStyle }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [laneWidth, setLaneWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const onLaneLayout = (e: LayoutChangeEvent) => {
    setLaneWidth(e.nativeEvent.layout.width);
  };

  const onMeasureLayout = (e: LayoutChangeEvent) => {
    setTextWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    animRef.current?.stop();
    scrollX.setValue(0);

    const overflow = textWidth - laneWidth;
    if (overflow <= 4 || laneWidth <= 0 || textWidth <= 0) return;

    const distance = overflow + 32;
    const duration = Math.max(6000, Math.round((distance / MARQUEE_PX_PER_SEC) * 1000));

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(scrollX, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(scrollX, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
    };
  }, [text, textWidth, laneWidth, scrollX]);

  return (
    <View style={styles.marqueeLane} onLayout={onLaneLayout}>
      <View style={styles.measureWrap} pointerEvents="none">
        <Text style={[style, styles.measureText]} onLayout={onMeasureLayout} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[style, styles.marqueeText, { transform: [{ translateX: scrollX }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

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
  const barOpacity = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const next = await fetchOpenHouseTicker(token);
      if (cancelled) return;
      setItems(next);
      setIndex(0);
      if (next.length) {
        Animated.timing(barOpacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      } else {
        barOpacity.setValue(0);
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, token, barOpacity]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((prev) => (prev + 1) % items.length);
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, messageOpacity]);

  const active = items[index % Math.max(items.length, 1)];
  const label = useMemo(() => {
    if (!active) return '';
    const shortTitle = truncateMiddle(active.title ?? '', 36);
    if (!active.startsAt) {
      return `${active.city ?? ''} · ${shortTitle}`.trim();
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
      title: shortTitle,
      date,
      spots: String(active.spotsLeft),
    });
  }, [active, locale, t]);

  if (!enabled || !items.length || !active) return null;

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 4, opacity: barOpacity }]}
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
            <Text style={styles.liveLabel} numberOfLines={1}>
              {t('openHouse.ticker.label')}
            </Text>
          </View>
          <Animated.View style={[styles.messageWrap, { opacity: messageOpacity }]}>
            <TickerMarquee text={label} style={styles.message} />
          </Animated.View>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={styles.chevron} />
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
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDotWrap: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    marginRight: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
    maxWidth: 108,
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
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  messageWrap: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 8,
  },
  marqueeLane: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  measureWrap: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    flexDirection: 'row',
  },
  measureText: {
    flexShrink: 0,
  },
  marqueeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    flexShrink: 0,
  },
});
