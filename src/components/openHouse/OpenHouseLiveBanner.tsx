import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../store/useThemeStore';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import { useI18n, getAppLocale } from '../../i18n';
import { formatOpenHouseLiveDetail } from './openHouseLiveFormat';
import type { LayoutChangeEvent } from 'react-native';

const AUTO_HIDE_MS = 30_000;
const ENTER_FROM = 420;

const MARQUEE_GAP = '   ◆   ';
const MARQUEE_PX_PER_SEC = 52;

function DetailMarquee({ text, style }: { text: string; style: object }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [laneWidth, setLaneWidth] = React.useState(0);
  const [textWidth, setTextWidth] = React.useState(0);
  const shouldScroll = textWidth > laneWidth + 6 && laneWidth > 0 && textWidth > 0;
  const loopDistance = textWidth + 56;

  useEffect(() => {
    scrollX.setValue(0);
    if (!shouldScroll) return;
    const duration = Math.max(7000, Math.round((loopDistance / MARQUEE_PX_PER_SEC) * 1000));
    const loop = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -loopDistance,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shouldScroll, loopDistance, scrollX, text]);

  return (
    <View style={marqueeStyles.lane} onLayout={(e) => setLaneWidth(e.nativeEvent.layout.width)}>
      <Text style={[style, marqueeStyles.measure]} onLayout={(e: LayoutChangeEvent) => setTextWidth(e.nativeEvent.layout.width)}>
        {text}
      </Text>
      {shouldScroll ? (
        <Animated.View style={[marqueeStyles.track, { transform: [{ translateX: scrollX }] }]}>
          <Text style={style}>{text}</Text>
          <Text style={style}>{MARQUEE_GAP}</Text>
          <Text style={style}>{text}</Text>
          <Text style={style}>{MARQUEE_GAP}</Text>
        </Animated.View>
      ) : (
        <Text style={style}>{text}</Text>
      )}
    </View>
  );
}

const marqueeStyles = StyleSheet.create({
  lane: { flex: 1, minWidth: 0, overflow: 'hidden', justifyContent: 'center' },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
  track: { flexDirection: 'row', alignItems: 'center' },
});

type Props = {
  topOffset: number;
};

export default function OpenHouseLiveBanner({ topOffset }: Props) {
  const { t } = useI18n();
  const locale = getAppLocale();
  const navigation = useNavigation<any>();
  const themeMode = useThemeStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'auto' ? systemScheme === 'dark' : themeMode === 'dark';

  const items = useOpenHouseLiveStore((s) => s.items);
  const index = useOpenHouseLiveStore((s) => s.index);
  const phase = useOpenHouseLiveStore((s) => s.phase);
  const plusAnchor = useOpenHouseLiveStore((s) => s.plusAnchor);
  const setPhase = useOpenHouseLiveStore((s) => s.setPhase);
  const setIndex = useOpenHouseLiveStore((s) => s.setIndex);
  const dockToPlus = useOpenHouseLiveStore((s) => s.dockToPlus);

  const slideX = useRef(new Animated.Value(ENTER_FROM)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genieRunningRef = useRef(false);

  const active = items[index % Math.max(items.length, 1)];
  const detail = useMemo(() => {
    if (!active) return '';
    return formatOpenHouseLiveDetail(active, locale);
  }, [active, locale]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const runGenieToPlus = useCallback(() => {
    if (genieRunningRef.current) return;
    genieRunningRef.current = true;
    clearHideTimer();
    const { width } = Dimensions.get('window');
    const bannerCenterX = width / 2;
    const bannerY = topOffset + 24;
    const ax = plusAnchor.x > 0 ? plusAnchor.x : width / 2;
    const ay = plusAnchor.y > 0 ? plusAnchor.y : Dimensions.get('window').height - 72;

    Animated.parallel([
      Animated.timing(slideX, {
        toValue: ax - bannerCenterX,
        duration: 520,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: ay - bannerY,
        duration: 520,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.06,
        duration: 520,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 480,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      genieRunningRef.current = false;
      if (finished) {
        slideX.setValue(ENTER_FROM);
        translateY.setValue(0);
        scale.setValue(1);
        opacity.setValue(0);
        setPhase('docked');
      }
    });
  }, [clearHideTimer, plusAnchor, setPhase, slideX, translateY, scale, opacity, topOffset]);

  const runEnter = useCallback(() => {
    clearHideTimer();
    slideX.setValue(ENTER_FROM);
    translateY.setValue(0);
    scale.setValue(1);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        friction: 9,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setPhase('visible');
      hideTimerRef.current = setTimeout(() => {
        runGenieToPlus();
      }, AUTO_HIDE_MS);
    });
  }, [clearHideTimer, runGenieToPlus, setPhase, slideX, opacity]);

  useEffect(() => {
    if (phase === 'entering' && items.length) runEnter();
    if (phase === 'genie' && items.length) runGenieToPlus();
  }, [phase, items.length, runEnter, runGenieToPlus]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  useEffect(() => {
    if (items.length <= 1 || phase !== 'visible') return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 12_000);
    return () => clearInterval(timer);
  }, [items.length, phase, setIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 48 || Math.abs(g.vx) > 0.65 || g.dy > 40) {
            dockToPlus();
          }
        },
      }),
    [dockToPlus]
  );

  if (!items.length || !active) return null;
  if (phase === 'hidden' || phase === 'docked') return null;

  const alertHead = t('openHouse.ticker.alertHeadline');

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: topOffset,
          opacity,
          transform: [{ translateX: slideX }, { translateY }, { scale }],
        },
      ]}
    >
      <View {...panResponder.panHandlers}>
        <Pressable
          onPress={() => {
            clearHideTimer();
            navigation.navigate('OpenHouseEvent', { eventId: active.eventId });
            dockToPlus();
          }}
          style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.94 }]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(245,158,11,0.96)', 'rgba(180,120,20,0.9)']
                : ['rgba(255,200,70,0.98)', 'rgba(245,158,11,0.95)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            <View style={styles.alertBlock}>
              <View style={styles.liveDot} />
              <Text style={styles.alertText} numberOfLines={2}>
                {alertHead}
              </Text>
            </View>
            <View style={styles.detailWrap}>
              <DetailMarquee text={detail} style={styles.detailText} />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={styles.chevron} />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 48,
  },
  pressable: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  gradient: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertBlock: {
    flexShrink: 0,
    maxWidth: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  alertText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 13,
  },
  detailWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  chevron: { flexShrink: 0 },
});
