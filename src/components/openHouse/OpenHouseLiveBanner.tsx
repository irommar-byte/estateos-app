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

const HERO_HOLD_MS = 1400;
const MORPH_MS = 480;
const AFTER_TYPE_MS = 2000;
const ENTER_RISE = 40;
const TYPE_MS = 26;
const GENIE_MS = 620;
/** Stała wysokość — bez poszerzania po morphie. */
const BANNER_H = 46;

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

/** Tekst literka po literce; gdy rośnie — góra znika, widoczny ogon (teleprompter). */
function TypewriterTeleprompter({
  text,
  active,
  textStyle,
  cursorStyle,
  laneHeight = 32,
  msPerChar = TYPE_MS,
  onDoneChange,
}: {
  text: string;
  active: boolean;
  textStyle: object;
  cursorStyle: object;
  laneHeight?: number;
  msPerChar?: number;
  onDoneChange?: (done: boolean) => void;
}) {
  const { visible, done } = useTypewriter(text, active, msPerChar);

  useEffect(() => {
    onDoneChange?.(done);
  }, [done, onDoneChange]);

  return (
    <View style={[teleStyles.lane, { height: laneHeight }]}>
      <View style={teleStyles.inner}>
        <Text style={textStyle}>
          {visible}
          {active && !done ? <Text style={cursorStyle}>|</Text> : null}
        </Text>
      </View>
    </View>
  );
}

const teleStyles = StyleSheet.create({
  lane: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  inner: {
    justifyContent: 'flex-end',
  },
});

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

  const [typingDone, setTypingDone] = useState(false);
  const isGenie = phase === 'genie';

  useEffect(() => {
    if (phase !== 'typing') setTypingDone(false);
  }, [phase]);

  const heroOpacity = morphT.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 0, 0],
  });
  const compactOpacity = morphT.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
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
      easing: Easing.out(Easing.cubic),
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

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || seq !== sequenceKeyRef.current) return;
      schedule(() => {
        if (seq !== sequenceKeyRef.current) return;
        runMorphToCompact();
      }, HERO_HOLD_MS);
    });
  }, [clearHideTimer, schedule, resetMotion, translateY, opacity, runMorphToCompact]);

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
  const showHero = phase === 'hero';
  const showCompact = phase === 'hero' || phase === 'typing' || phase === 'genie';

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
              {showHero ? (
                <Animated.View style={[styles.heroBlock, { opacity: heroOpacity }]} pointerEvents="none">
                  <View style={styles.liveDotLg} />
                  <Text style={styles.heroText} numberOfLines={1}>
                    {alertHead}
                  </Text>
                </Animated.View>
              ) : null}

              {showCompact ? (
                <Animated.View
                  style={[styles.compactRow, { opacity: phase === 'hero' ? compactOpacity : 1 }]}
                  pointerEvents={phase === 'hero' ? 'none' : 'auto'}
                >
                  <View style={styles.alertBlock}>
                    <View style={styles.liveDot} />
                    <Text style={styles.alertText} numberOfLines={2}>
                      {alertHead}
                    </Text>
                  </View>
                  <View style={styles.detailWrap}>
                    {phase === 'typing' || phase === 'genie' ? (
                      <TypewriterTeleprompter
                        text={detail}
                        active={phase === 'typing'}
                        textStyle={styles.detailText}
                        cursorStyle={styles.cursor}
                        laneHeight={32}
                        onDoneChange={setTypingDone}
                      />
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={styles.chevron} />
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
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  pressableGenie: {
    overflow: 'visible',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  cardBody: {
    height: BANNER_H,
  },
  gradient: {
    height: BANNER_H,
    paddingHorizontal: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroBlock: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  liveDotLg: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  heroText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  compactRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  alertBlock: {
    flexShrink: 0,
    maxWidth: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  alertText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  detailWrap: {
    flex: 1,
    minWidth: 0,
    height: 32,
    overflow: 'hidden',
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  cursor: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '300',
  },
  chevron: { flexShrink: 0 },
});
