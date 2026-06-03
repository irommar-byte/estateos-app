import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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

const HERO_HOLD_MS = 1600;
const MORPH_MS = 720;
const AFTER_TYPE_MS = 7000;
const ENTER_RISE = 48;
const TYPE_MS = 28;
const GENIE_MS = 620;

function useTypewriter(text: string, active: boolean, msPerChar = TYPE_MS) {
  const [visible, setVisible] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || !text) {
      setVisible('');
      setDone(false);
      return;
    }
    setVisible('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      const next = text.slice(0, i);
      setVisible(next);
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, msPerChar);
    return () => clearInterval(id);
  }, [text, active, msPerChar]);

  return { visible, done };
}

type Props = {
  bottom: number;
};

export default function OpenHouseLiveBanner({ bottom }: Props) {
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
  const dockToPlus = useOpenHouseLiveStore((s) => s.dockToPlus);
  const markBannerPlayed = useOpenHouseLiveStore((s) => s.markBannerPlayed);

  const wrapRef = useRef<View>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_RISE)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const morphT = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genieRunningRef = useRef(false);
  const sequenceKeyRef = useRef(0);

  const active = items[index % Math.max(items.length, 1)];
  const detail = useMemo(() => {
    if (!active) return '';
    return formatOpenHouseLiveDetail(active, locale);
  }, [active, locale]);

  const isTyping = phase === 'typing';
  const { visible: typedDetail, done: typingDone } = useTypewriter(detail, isTyping);
  const isGenie = phase === 'genie';

  const heroOpacity = morphT.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 0.35, 0],
  });
  const heroScale = morphT.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });
  const heroShiftY = morphT.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const compactOpacity = morphT.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.55, 1],
  });
  const compactScale = morphT.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(fn, ms);
    },
    [clearHideTimer]
  );

  const resetMotion = useCallback(() => {
    translateX.setValue(0);
    translateY.setValue(ENTER_RISE);
    scaleX.setValue(1);
    scaleY.setValue(1);
    opacity.setValue(0);
    morphT.setValue(0);
  }, [translateX, translateY, scaleX, scaleY, opacity, morphT]);

  const runMorphToCompact = useCallback(() => {
    morphT.setValue(0);
    Animated.timing(morphT, {
      toValue: 1,
      duration: MORPH_MS,
      easing: Easing.bezier(0.33, 0, 0.18, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPhase('typing');
    });
  }, [morphT, setPhase]);

  const runGenieToPlus = useCallback(() => {
    if (genieRunningRef.current) return;
    genieRunningRef.current = true;
    clearHideTimer();

    const startGenie = (bx: number, by: number, bw: number, bh: number) => {
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const ax = plusAnchor.x > 0 ? plusAnchor.x : cx;
      const ay = plusAnchor.y > 0 ? plusAnchor.y : cy + 120;

      translateX.setValue(0);
      translateY.setValue(0);
      scaleX.setValue(1);
      scaleY.setValue(1);
      opacity.setValue(1);

      const easing = Easing.bezier(0.32, 0, 0.67, 0);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: ax - cx,
          duration: GENIE_MS,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: ay - cy,
          duration: GENIE_MS,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(scaleX, {
          toValue: 0.12,
          duration: GENIE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 0.05,
          duration: GENIE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
          }).start(() => {
            genieRunningRef.current = false;
            resetMotion();
            markBannerPlayed();
          });
        } else {
          genieRunningRef.current = false;
        }
      });
    };

    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((bx, by, bw, bh) => {
        startGenie(bx, by, bw, bh);
      });
    });
  }, [clearHideTimer, plusAnchor, markBannerPlayed, translateX, translateY, scaleX, scaleY, opacity, resetMotion]);

  const runHeroEnter = useCallback(() => {
    clearHideTimer();
    sequenceKeyRef.current += 1;
    const seq = sequenceKeyRef.current;
    resetMotion();
    translateY.setValue(ENTER_RISE);
    scaleX.setValue(0.96);
    scaleY.setValue(0.96);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.spring(scaleX, {
        toValue: 1,
        friction: 9,
        tension: 76,
        useNativeDriver: true,
      }),
      Animated.spring(scaleY, {
        toValue: 1,
        friction: 9,
        tension: 76,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || seq !== sequenceKeyRef.current) return;
      schedule(() => {
        if (seq !== sequenceKeyRef.current) return;
        runMorphToCompact();
      }, HERO_HOLD_MS);
    });
  }, [clearHideTimer, schedule, resetMotion, translateY, scaleX, scaleY, opacity, runMorphToCompact]);

  useEffect(() => {
    if (phase === 'hero' && items.length) runHeroEnter();
    if (phase === 'genie' && items.length) runGenieToPlus();
  }, [phase, items.length, runHeroEnter, runGenieToPlus]);

  useEffect(() => {
    if (phase !== 'typing' || !typingDone) return;
    schedule(() => dockToPlus(), AFTER_TYPE_MS);
  }, [phase, typingDone, schedule, dockToPlus]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 48 || Math.abs(g.vx) > 0.65 || g.dy < -40 || g.dy > 40) {
            dockToPlus();
          }
        },
      }),
    [dockToPlus]
  );

  if (!items.length || !active) return null;
  if (phase === 'hidden' || phase === 'docked') return null;

  const alertHead = t('openHouse.ticker.alertHeadline');
  const showHeroLayer = phase === 'hero';
  const showCompactLayer = phase === 'hero' || phase === 'typing' || phase === 'genie';

  return (
    <Animated.View
      ref={wrapRef}
      pointerEvents="box-none"
      style={[
        styles.wrap,
        isGenie && styles.wrapGenie,
        {
          bottom,
          opacity,
          transform: [{ translateX }, { translateY }, { scaleX }, { scaleY }],
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
          style={({ pressed }) => [styles.pressable, isGenie && styles.pressableGenie, pressed && { opacity: 0.94 }]}
        >
          <View style={styles.cardBody}>
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
              {showHeroLayer ? (
                <Animated.View
                  style={[
                    styles.heroBlock,
                    styles.layer,
                    {
                      opacity: heroOpacity,
                      transform: [{ scale: heroScale }, { translateY: heroShiftY }],
                    },
                  ]}
                  pointerEvents="auto"
                >
                  <View style={styles.liveDotLg} />
                  <Text style={styles.heroText}>{alertHead}</Text>
                </Animated.View>
              ) : null}

              {showCompactLayer ? (
                <Animated.View
                  style={[
                    styles.compactRow,
                    phase === 'hero' ? styles.layer : null,
                    phase === 'hero'
                      ? {
                          opacity: compactOpacity,
                          transform: [{ scale: compactScale }],
                        }
                      : null,
                  ]}
                  pointerEvents={phase === 'hero' ? 'none' : 'auto'}
                >
                  <View style={styles.alertBlock}>
                    <View style={styles.liveDot} />
                    <Text style={styles.alertText} numberOfLines={2}>
                      {alertHead}
                    </Text>
                  </View>
                  <View style={styles.detailWrap}>
                    <Text style={styles.detailText}>
                      {phase === 'typing' ? typedDetail : phase === 'hero' ? '' : detail}
                      {phase === 'typing' && !typingDone ? (
                        <Text style={styles.cursor}>|</Text>
                      ) : null}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={styles.chevron} />
                </Animated.View>
              ) : null}
            </LinearGradient>
          </View>
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
  wrapGenie: {
    zIndex: 60,
    overflow: 'visible',
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
  pressableGenie: {
    overflow: 'visible',
    shadowOpacity: 0.35,
    shadowRadius: 22,
  },
  cardBody: {
    minHeight: 52,
  },
  gradient: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    minHeight: 52,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  liveDotLg: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  heroText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
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
    justifyContent: 'center',
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  cursor: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '300',
  },
  chevron: { flexShrink: 0 },
});
